/**
 * SSE client — talks to the Supabase Edge Function (appmaker-stream)
 * instead of the old Express backend.
 *
 * Auth: reads the current Supabase session access_token and sends it
 * as Authorization: Bearer. The Edge Function has verify_jwt: true.
 *
 * Save: writes directly to appmaker.apps / appmaker.iterations via
 * supabase-js (handled in appSlice.ts — not here).
 */

import { supabase } from '../lib/supabase';
import { buildGeneratedCode, getAppFiles } from '../lib/appFiles';

export type StreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'action'; action: FileAction }
  | { type: 'done'; usage?: any; model?: string }
  | { type: 'error'; message: string }
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

/** Edge Function URL — set REACT_APP_SUPABASE_URL in .env */
const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL as string)
  || 'https://fmrnqepyyjucnfbrqawl.supabase.co';

const EDGE_STREAM_URL = `${SUPABASE_URL}/functions/v1/appmaker-stream`;

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
      throw new Error(`Stream request failed: ${res.status} ${text}`);
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

export function streamGenerate(opts: GenerateOptions, onEvent: (ev: StreamEvent) => void) {
  return postSSE(EDGE_STREAM_URL, opts, onEvent);
}

/** listProviders: static list now that the Edge Function handles all providers. */
export async function listProviders(): Promise<{ available: string[]; all: string[] }> {
  return {
    available: [], // availability is provider-key-dependent and checked by Edge Fn at runtime
    all: ['groq', 'openai', 'openrouter', 'anthropic', 'together', 'mistral', 'ollama'],
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
