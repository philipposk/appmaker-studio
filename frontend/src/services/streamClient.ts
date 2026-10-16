/**
 * SSE client — talks to the /api/stream Vercel Function instead of the old
 * Express backend.
 *
 * Auth: reads the current Supabase session access_token and sends it
 * as Authorization: Bearer; the function verifies it.
 *
 * Save: writes directly to appmaker.apps / appmaker.iterations via
 * supabase-js (handled in appSlice.ts — not here).
 */

import { supabase } from '../lib/supabase';
import { buildGeneratedCode, getAppFiles } from '../lib/appFiles';
import { getBillingStatus, invalidateBillingStatus, isProPlan, showUpgrade, BillingStatus } from '../lib/billing';

export type StreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'action'; action: FileAction }
  | { type: 'done'; usage?: any; model?: string; charged_usd?: number; balance_usd?: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'continue'; round: number; filesSoFar: number }
  | { type: 'complete'; ok: boolean }
  // autofix events (kept for forward-compat, AutoFix now runs in browser)
  | { type: 'iteration_start'; iteration: number }
  | { type: 'validators'; iteration: number; results: any }
  | { type: 'patch_applied'; iteration: number; files: number }
  | { type: 'green'; iteration: number }
  | { type: 'no_progress'; iteration: number }
  | { type: 'result'; ok: boolean; iterations: number; reason?: string };

export type FileAction =
  | { type: 'artifact'; name: string }
  | { type: 'file'; path: string; content: string }
  | { type: 'delete'; path: string }
  | { type: 'shell'; cmd: string };

export interface GenerateOptions {
  prompt: string;
  appType?: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  refineFrom?: string;
}

/**
 * Streaming endpoint: the Vercel Function in frontend/api/stream.ts (300s
 * limit vs 150s on the old Supabase Edge Function). Same origin, so no CORS.
 * Override with REACT_APP_STREAM_URL for local dev against a deployed API.
 */
const EDGE_STREAM_URL = (process.env.REACT_APP_STREAM_URL as string) || '/api/stream';

/** Get the current session's access token (used as Bearer in Edge Fn auth). */
async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

/**
 * POST to the streaming Edge Function and yield parsed SSE events.
 * Returns { promise, cancel }.
 */
export function postSSE(
  url: string,
  body: any,
  onEvent: (ev: StreamEvent) => void,
): { promise: Promise<void>; cancel: () => void } {
  const controller = new AbortController();
  const promise = (async () => {
    const token = await getToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      let err: { code?: string; message?: string; balance_usd?: number } = {};
      try { err = JSON.parse(text); } catch { /* not JSON */ }
      if (err.code === 'needs_pro' || err.code === 'no_key') showUpgrade('needs_key_or_pro');
      if (err.code === 'no_credits') showUpgrade('no_credits', err.balance_usd);
      throw new Error(err.message || `Stream request failed: ${res.status} ${text}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = raw.split('\n');
        let event = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith(':')) continue;
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        try {
          const data = JSON.parse(dataLines.join('\n'));
          onEvent({ type: event, ...data } as StreamEvent);
        } catch { /* ignore malformed */ }
      }
    }
  })();
  return { promise, cancel: () => controller.abort() };
}

/**
 * Decide who pays for this generation. The user's own key wins; otherwise a
 * Pro (or owner) account runs on the platform key ("pro"). Anyone else gets
 * the "add a key or go Pro" modal instead of a request.
 */
async function routeRequest(opts: GenerateOptions): Promise<GenerateOptions> {
  const ownKey = opts.provider !== 'pro' && (opts.apiKey?.trim() || opts.provider === 'ollama');
  if (ownKey) return opts;
  let status: BillingStatus;
  // A failed lookup is not "free": don't nag a paying user with the upgrade modal.
  try { status = await getBillingStatus(); } catch {
    throw new Error("Couldn't check your plan. Try again in a moment.");
  }
  if (isProPlan(status)) {
    if (status.plan === 'pro' && status.balance_usd <= 0) {
      showUpgrade('no_credits', status.balance_usd);
      throw new Error('Out of credits. Top up to keep building.');
    }
    return { ...opts, provider: 'pro', apiKey: undefined, model: undefined };
  }
  showUpgrade('needs_key_or_pro');
  throw new Error('Add your own API key, or upgrade to Pro to build with ours.');
}

/** Extra rounds after a build hits the server time limit (each round ≤270s). */
const MAX_CONTINUES = 2;

/**
 * Stream a generation. If the server stops a long build (error code
 * "timeout"), automatically start another round that gets the files written
 * so far and is asked to write only what's missing — files keep arriving
 * through the same onEvent, with a 'continue' event in between.
 */
export function streamGenerate(opts: GenerateOptions, onEvent: (ev: StreamEvent) => void) {
  let inner: { promise: Promise<void>; cancel: () => void } | null = null;
  let cancelled = false;
  const promise = (async () => {
    const routed = await routeRequest(opts);
    const written = new Map<string, string>();
    let req = routed;
    for (let round = 0; !cancelled; round++) {
      let timedOut = false;
      inner = postSSE(EDGE_STREAM_URL, req, (ev) => {
        if (ev.type === 'action' && ev.action.type === 'file') written.set(ev.action.path, ev.action.content);
        if (ev.type === 'done' && ev.balance_usd !== undefined) invalidateBillingStatus();
        if (ev.type === 'error' && ev.code === 'timeout' && round < MAX_CONTINUES) { timedOut = true; return; }
        onEvent(ev);
      });
      await inner.promise;
      if (!timedOut || cancelled) return;

      onEvent({ type: 'continue', round: round + 1, filesSoFar: written.size });
      const soFar = Array.from(written, ([path, content]) => `--- ${path}\n${content}`).join('\n\n');
      req = {
        ...routed,
        refineFrom: [routed.refineFrom, soFar].filter(Boolean).join('\n\n'),
        prompt:
          `CONTINUE an interrupted build. Original request: ${opts.prompt.slice(0, 4000)}\n` +
          `Already written (full content is in the context): ${Array.from(written.keys()).join(', ') || 'none'}.\n` +
          'Write ONLY the files that are still missing to finish this request. Do not repeat finished files.',
      };
    }
  })();
  return { promise, cancel: () => { cancelled = true; inner?.cancel(); } };
}

/** listProviders: static list now that the Edge Function handles all providers. */
export async function listProviders(): Promise<{ available: string[]; all: string[] }> {
  return {
    available: [], // availability is provider-key-dependent and checked by Edge Fn at runtime
    all: ['pro', 'groq', 'openai', 'openrouter', 'anthropic', 'together', 'mistral', 'ollama'],
  };
}

/** streamAutoFix is kept for API compat but AutoFix runs in the browser now (WebContainer). */
export function streamAutoFix(
  _body: { projectDir: string; provider?: string; apiKey?: string; maxIterations?: number },
  _onEvent: (ev: StreamEvent) => void,
): { promise: Promise<void>; cancel: () => void } {
  const promise = Promise.reject(new Error('AutoFix runs in-browser via WebContainer — no server call needed.'));
  return { promise, cancel: () => {} };
}

export interface SaveStreamBody {
  appId?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  files: { path: string; content: string }[];
  shellCommands?: string[];
  streamLog?: string;
  tokensUsed?: number;
  durationMs?: number;
  artifactName?: string;
  appType?: string;
  description?: string;
}

/**
 * Save is now handled directly via supabase-js in appSlice.ts.
 * This shim is kept so existing call-sites compile; it delegates to appSlice.
 * Returns { app: { id } } to match old shape.
 */
export async function saveStreamResult(body: SaveStreamBody): Promise<{ app: { _id: string } }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Not authenticated');

  // On refine (existing appId) the model streams back only the files it
  // changed. Merge them OVER the app's existing files so untouched files are
  // not deleted (audit: refine data loss). New/changed paths win.
  let filesToSave = body.files;
  if (body.appId) {
    const { data: existing } = await supabase
      .schema('appmaker').from('apps')
      .select('generated_code').eq('id', body.appId).single();
    const merged = new Map(
      getAppFiles({ generated_code: existing?.generated_code }).map((f) => [f.path, f]),
    );
    for (const f of body.files) merged.set(f.path, f);
    filesToSave = Array.from(merged.values());
  }

  // Canonical nested shape (frontend/backend/tests.structure) every reader
  // expects, with the flat `files` array preserved. See lib/appFiles.
  const generatedCode = buildGeneratedCode(filesToSave, body.shellCommands);

  if (body.appId) {
    // Refine: patch only code + generation. Never reset name/status/type/desc.
    const { error } = await supabase
      .schema('appmaker')
      .from('apps')
      .update({
        generated_code: generatedCode,
        generation: { prompt: body.prompt, defaultProvider: body.provider },
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.appId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);

    await supabase.schema('appmaker').from('iterations').insert({
      app_id:        body.appId,
      user_id:       userId,
      prompt:        body.prompt,
      provider:      body.provider,
      model:         body.model,
      stream_log:    body.streamLog,
      files_changed: body.files.map((f) => f.path),
      tokens_used:   body.tokensUsed,
      duration_ms:   body.durationMs,
      source:        'stream',
    });

    return { app: { _id: body.appId } };
  }

  // Create new app
  const appPayload = {
    user_id:      userId,
    name:         body.artifactName || body.prompt?.slice(0, 60) || 'New App',
    description:  body.description || body.prompt?.slice(0, 200),
    type:         body.appType || 'web',
    status:       'draft',
    generated_code: generatedCode,
    generation:   { prompt: body.prompt, defaultProvider: body.provider },
  };

  const { data, error } = await supabase
    .schema('appmaker')
    .from('apps')
    .insert(appPayload)
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Insert failed');

  // Insert first iteration
  await supabase.schema('appmaker').from('iterations').insert({
    app_id:        data.id,
    user_id:       userId,
    prompt:        body.prompt,
    provider:      body.provider,
    model:         body.model,
    stream_log:    body.streamLog,
    files_changed: body.files.map(f => f.path),
    tokens_used:   body.tokensUsed,
    duration_ms:   body.durationMs,
    source:        'stream',
  });

  return { app: { _id: data.id } };
}
