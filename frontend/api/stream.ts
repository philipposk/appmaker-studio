/**
 * POST /api/stream — multi-provider LLM streaming proxy (Vercel Function).
 *
 * Replaces the Supabase Edge Function `appmaker-stream`: Vercel Hobby lets a
 * function run 300s vs Supabase free's 150s, which long builds need.
 *
 * Body: { prompt, provider, apiKey?, model?, appType?, refineFrom? }
 * Streams SSE events:
 *   event: token   data: {delta}
 *   event: action  data: {action: {type, ...}}
 *   event: done    data: {model, usage, charged_usd?, balance_usd?}
 *   event: error   data: {message}
 *
 * provider "pro" = no user key: runs on the platform OpenRouter key and debits
 * the user's prepaid credits (appmaker.credit_ledger) at actual cost x MARKUP.
 * Unfinished builds (provider error, timeout, client gone) are charged $0.
 *
 * Env: REACT_APP_SUPABASE_URL + REACT_APP_SUPABASE_ANON_KEY (already set, for
 *      verifying the user). Pro only: SUPABASE_SERVICE_ROLE_KEY,
 *      APPMAKER_OPENROUTER_KEY, APPMAKER_MARKUP (default 1.4).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || 'https://fmrnqepyyjucnfbrqawl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const PRO_KEY = process.env.APPMAKER_OPENROUTER_KEY || '';
const MARKUP = Number(process.env.APPMAKER_MARKUP || '1.4');

// Stop ourselves before Vercel's 300s hard kill so billing always settles.
const DEADLINE_MS = 270_000;
const MAX_PROMPT_CHARS = 8_000;
const MAX_CONTEXT_CHARS = 400_000;

const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq:       'https://api.groq.com/openai/v1/chat/completions',
  openai:     'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  together:   'https://api.together.xyz/v1/chat/completions',
  mistral:    'https://api.mistral.ai/v1/chat/completions',
};

const DEFAULT_MODELS: Record<string, string> = {
  groq:       'llama-3.3-70b-versatile',
  openai:     'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  together:   'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  mistral:    'codestral-latest',
  anthropic:  'claude-3-5-haiku-20241022',
};

// ── Pro models: free OpenRouter models first (same strategy as
// appmaker.6x7.gr), then cheap paid twins when the free pool is busy.
const PRO_MAX_TOKENS = 16_000;
// USD per token (input, output) for paid fallbacks — used for the up-front
// hold and as a fallback if OpenRouter omits usage.cost.
const PRO_PAID: Record<string, [number, number]> = {
  'openai/gpt-oss-120b':        [0.15e-6, 0.60e-6],
  'qwen/qwen3-coder-next':      [0.12e-6, 0.80e-6],
  'deepseek/deepseek-v4-flash': [0.09e-6, 0.18e-6],
};
const HOLD_PRICE: [number, number] = [0.15e-6, 0.80e-6]; // worst of the above

const FREE_PREF: Record<string, number> = {
  'openai/gpt-oss-120b:free': 10,
  'nvidia/nemotron-3-super-120b-a12b:free': 9.5,
  'nousresearch/hermes-3-llama-3.1-405b:free': 9,
  'z-ai/glm-4.5-air:free': 9,
  'qwen/qwen3-next-80b-a3b-instruct:free': 8.5,
  'meta-llama/llama-3.3-70b-instruct:free': 8,
  'minimax/minimax-m2.5:free': 7.5,
  'qwen/qwen3-coder:free': 7,
  'deepseek/deepseek-v4-flash:free': 6.5,
  'google/gemma-4-31b-it:free': 6,
};

let freeCache: { at: number; models: string[] } | null = null;
async function freeModels(): Promise<string[]> {
  if (freeCache && Date.now() - freeCache.at < 3_600_000) return freeCache.models;
  let models: string[] = [];
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    const data = (await res.json()) as { data: { id: string; pricing?: { prompt?: string; completion?: string } }[] };
    models = data.data
      .filter((m) => Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0 && (FREE_PREF[m.id] ?? 0) > 0)
      .sort((a, b) => (FREE_PREF[b.id] ?? 0) - (FREE_PREF[a.id] ?? 0))
      .map((m) => m.id);
  } catch { /* fall through to paid models */ }
  freeCache = { at: Date.now(), models };
  return models;
}

const SYSTEM_PROMPT = `You are AppMaker, an expert full-stack code generator.
Generate complete, working, production-quality applications.

Output ONLY structured XML action blocks in this format:

<appmakerAction type="artifact" name="Project Name"></appmakerAction>
<appmakerAction type="file" path="src/App.tsx">FULL FILE CONTENT HERE</appmakerAction>
<appmakerAction type="file" path="src/index.ts">FULL FILE CONTENT HERE</appmakerAction>
<appmakerAction type="shell" cmd="npm install"></appmakerAction>

Rules:
- Start with ONE artifact action naming the project.
- Output EVERY file needed to run the app (no placeholders, no TODOs).
- Include package.json with all dependencies.
- For web apps: React 18 + TypeScript + Vite (not CRA). Tailwind CSS for styling.
- For backend: Node.js + Express + TypeScript.
- Include a README.md with setup instructions.
- Shell actions for install commands go LAST.
- Do NOT output markdown, explanations, or any text outside action blocks.
- Do NOT truncate file contents — output every line.`;

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } | null;
type Emit = (event: string, data: unknown) => void;
type Msg = { role: string; content: string };
type StreamResult = { model: string; requested: string; usage: Usage; completed: boolean; chars: number };

/** Run a billing write; retry up to 3 times on error. False if it never stuck. */
async function billingWrite(call: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 * attempt));
    try {
      const { error } = await call();
      if (!error) return true;
    } catch { /* network blip: retry */ }
  }
  return false;
}

function parseActions(text: string): { actions: object[]; remainder: string } {
  const actions: object[] = [];
  let remainder = text;
  const re = /<appmakerAction([^>]*)>([\s\S]*?)<\/appmakerAction>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const attrs = m[1];
    const content = m[2];
    const type = attrs.match(/type="([^"]+)"/)?.[1] ?? 'unknown';
    const path = attrs.match(/path="([^"]+)"/)?.[1] ?? '';
    if (type === 'artifact') actions.push({ type: 'artifact', name: attrs.match(/name="([^"]+)"/)?.[1] ?? 'App' });
    else if (type === 'file') actions.push({ type: 'file', path, content });
    else if (type === 'shell') actions.push({ type: 'shell', cmd: attrs.match(/cmd="([^"]+)"/)?.[1] ?? content.trim() });
    else if (type === 'delete') actions.push({ type: 'delete', path });
  }
  const ends = Array.from(text.matchAll(/<\/appmakerAction>/g));
  const last = ends[ends.length - 1];
  if (last) remainder = text.slice((last.index ?? 0) + last[0].length);
  return { actions, remainder };
}

/** Feed streamed text through the action parser, emitting tokens + actions. */
function actionSink(emit: Emit) {
  let pending = '';
  let chars = 0;
  return {
    push(delta: string) {
      chars += delta.length;
      emit('token', { delta });
      pending += delta;
      const { actions, remainder } = parseActions(pending);
      pending = remainder;
      for (const a of actions) emit('action', { action: a });
    },
    flush() {
      for (const a of parseActions(pending).actions) emit('action', { action: a });
    },
    get chars() { return chars; },
  };
}

/** Read an SSE byte stream line by line. */
async function* sseLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
}

/**
 * OpenAI-compatible streaming. `models` are tried in order until one accepts
 * the request (before any token is streamed). `completed` is true only when
 * the provider ended the stream normally.
 */
async function streamOpenAICompat(
  url: string, apiKey: string, models: string[], messages: Msg[], emit: Emit, signal: AbortSignal,
  extra: Record<string, unknown> = {}, extraHeaders: Record<string, string> = {},
): Promise<StreamResult> {
  let resp: Response | null = null;
  let model = models[0];
  // The id we asked for and the provider accepted (chunk.model may differ).
  let requested = models[0];
  let lastErr = '';
  for (const m of models) {
    model = m;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify({ model: m, messages, stream: true, temperature: 0.2, ...extra }),
      signal,
    });
    if (r.ok && r.body) { resp = r; requested = m; break; }
    lastErr = `Provider error ${r.status} (${m}): ${(await r.text().catch(() => '')).slice(0, 200)}`;
  }
  if (!resp?.body) {
    emit('error', { message: lastErr || 'Provider unavailable' });
    return { model, requested: model, usage: null, completed: false, chars: 0 };
  }
  const sink = actionSink(emit);
  let usage: Usage = null;
  let completed = false;
  for await (const raw of sseLines(resp.body)) {
    if (raw === '[DONE]') { completed = true; continue; }
    try {
      const chunk = JSON.parse(raw);
      if (chunk.model) model = chunk.model;
      if (chunk.usage) usage = chunk.usage;
      if (chunk.error) emit('error', { message: String(chunk.error.message ?? chunk.error) });
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) sink.push(delta);
      if (chunk.choices?.[0]?.finish_reason) completed = true;
    } catch { /* ignore malformed chunks */ }
  }
  sink.flush();
  return { model, requested, usage, completed, chars: sink.chars };
}

async function streamAnthropic(
  apiKey: string, model: string, messages: Msg[], emit: Emit, signal: AbortSignal,
): Promise<StreamResult> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 16000, system: SYSTEM_PROMPT }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    emit('error', { message: `Anthropic error ${resp.status}: ${txt.slice(0, 200)}` });
    return { model, requested: model, usage: null, completed: false, chars: 0 };
  }
  const sink = actionSink(emit);
  let inTok = 0;
  let outTok = 0;
  let completed = false;
  for await (const raw of sseLines(resp.body)) {
    try {
      const ev = JSON.parse(raw);
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') sink.push(ev.delta.text ?? '');
      else if (ev.type === 'message_start') inTok = ev.message?.usage?.input_tokens ?? 0;
      else if (ev.type === 'message_delta') outTok = ev.usage?.output_tokens ?? outTok;
      else if (ev.type === 'message_stop') completed = true;
    } catch { /* ignore */ }
  }
  sink.flush();
  return { model, requested: model, usage: { prompt_tokens: inTok, completion_tokens: outTok, total_tokens: inTok + outTok }, completed, chars: sink.chars };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();
  // Every request needs a signed-in user (no anonymous proxy).
  const auth = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = token ? await auth.auth.getUser(token) : { data: { user: null } };
  if (!user) return json(401, { code: 'auth', message: 'Sign in first.' });

  let body: { prompt?: string; provider?: string; apiKey?: string; model?: string; appType?: string; refineFrom?: string };
  try { body = await req.json(); } catch { return json(400, { message: 'Invalid JSON' }); }

  const { prompt, provider = 'groq', apiKey, appType = 'web', refineFrom } = body;
  if (!prompt?.trim()) return json(400, { message: 'prompt is required' });
  if (prompt.length > MAX_PROMPT_CHARS) return json(400, { message: `Prompt too long (max ${MAX_PROMPT_CHARS} chars).` });
  if (refineFrom && refineFrom.length > MAX_CONTEXT_CHARS) return json(400, { message: 'App too large to refine in one go.' });
  if (provider !== 'pro' && provider !== 'anthropic' && provider !== 'ollama' && !PROVIDER_ENDPOINTS[provider]) {
    return json(400, { message: `Unknown provider "${provider}".` });
  }
  if (provider === 'ollama') return json(400, { message: 'Ollama runs on your machine; it cannot be reached from the hosted app.' });

  const messages: Msg[] = [
    ...(provider !== 'anthropic' ? [{ role: 'system', content: SYSTEM_PROMPT }] : []),
    ...(refineFrom
      ? [
          { role: 'user', content: `Existing code context:\n${refineFrom}` },
          { role: 'assistant', content: 'I have reviewed the existing code.' },
          { role: 'user', content: `Change the existing app as follows, keeping everything else as it is: ${prompt.trim()}\n\nOutput ONLY the files you add or change (full content of each), no artifact action, no unchanged files. Never output a file whose content in the context is marked [TRUNCATED].` },
        ]
      : [{ role: 'user', content: `Build a ${appType} app: ${prompt.trim()}` }]),
  ];

  // ── Who pays ──
  let pro: { plan: 'owner' | 'pro'; holdId: number | null; holdMicros: number } | null = null;
  let key = '';
  // Only Pro touches billing tables, so only Pro needs the service-role key.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY || ANON_KEY, { auth: { persistSession: false } });
  if (provider === 'pro') {
    if (!SERVICE_KEY || !PRO_KEY) return json(503, { message: 'Pro is not configured yet on the server.' });
    const { data: sub } = await admin.from('subscriptions').select('plan, status')
      .eq('user_id', user.id).eq('app', 'appmaker').maybeSingle();
    const active = !!sub && ['active', 'trialing'].includes(sub.status);
    const plan = active && (sub!.plan === 'owner' || sub!.plan === 'pro') ? (sub!.plan as 'owner' | 'pro') : null;
    if (!plan) return json(402, { code: 'needs_pro', message: 'Add your own API key or upgrade to Pro.' });
    let holdId: number | null = null;
    let holdMicros = 0;
    if (plan === 'pro') {
      // Upper bound: a token is never shorter than one UTF-8 byte.
      const bytes = messages.reduce((n, m) => n + Buffer.byteLength(m.content, 'utf8'), 0);
      const holdUsd = (bytes * HOLD_PRICE[0] + PRO_MAX_TOKENS * HOLD_PRICE[1]) * MARKUP;
      holdMicros = Math.ceil(holdUsd * 1e6);
      const { data: id, error } = await admin.schema('appmaker').rpc('credit_hold', {
        p_user: user.id, p_amount: holdMicros, p_model: 'openrouter',
      });
      if (error) return json(500, { message: `Billing error: ${error.message}` });
      if (id == null) {
        const { data: bal } = await admin.schema('appmaker').rpc('credit_balance', { p_user: user.id });
        return json(402, { code: 'no_credits', message: 'Out of credits. Top up to keep building.', balance_usd: Number(bal ?? 0) / 1e6 });
      }
      holdId = id as number;
    }
    pro = { plan, holdId, holdMicros };
    key = PRO_KEY;
  } else {
    key = apiKey?.trim() ?? '';
    if (!key) return json(400, { code: 'no_key', message: `No API key for provider "${provider}". Add it in Provider Settings, or upgrade to Pro.` });
  }

  const model = body.model?.trim() || DEFAULT_MODELS[provider] || DEFAULT_MODELS.groq;
  const enc = new TextEncoder();
  const upstream = new AbortController();
  const timer = setTimeout(() => upstream.abort(new Error('deadline')), DEADLINE_MS - (Date.now() - startedAt));
  let clientGone = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event, data) => {
        if (clientGone) return;
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); }
        catch { clientGone = true; }
      };

      let result: StreamResult = { model, requested: model, usage: null, completed: false, chars: 0 };
      try {
        if (pro) {
          const models = [...(await freeModels()).slice(0, 5), ...Object.keys(PRO_PAID)];
          result = await streamOpenAICompat(PROVIDER_ENDPOINTS.openrouter, key, models, messages, emit, upstream.signal,
            // max_price (USD / 1M tokens) = HOLD_PRICE, so no route can cost more than the hold.
            { max_tokens: PRO_MAX_TOKENS, usage: { include: true }, provider: { max_price: { prompt: 0.15, completion: 0.8 } } },
            { 'HTTP-Referer': 'https://studio.6x7.gr', 'X-Title': 'AppMaker Studio' });
        } else if (provider === 'anthropic') {
          result = await streamAnthropic(key, model, messages, emit, upstream.signal);
        } else {
          result = await streamOpenAICompat(PROVIDER_ENDPOINTS[provider], key, [model], messages, emit, upstream.signal);
        }
      } catch (err) {
        const timedOut = upstream.signal.aborted && !clientGone;
        emit('error', timedOut
          ? { code: 'timeout', message: 'This build ran too long and was stopped. You were not charged for the unfinished part.' }
          : { message: String(err) });
      } finally {
        clearTimeout(timer);
      }

      // ── Settle Pro billing: only finished builds are charged ──
      let billing: { charged_usd: number; balance_usd: number } | undefined;
      if (pro) {
        let rawUsd = 0;
        if (result.completed) {
          rawUsd = Number(result.usage?.cost ?? NaN);
          if (!Number.isFinite(rawUsd)) {
            // OpenRouter omitted cost: price the model we asked for (free models = $0).
            const req = result.requested;
            const price: [number, number] = req.endsWith(':free') || FREE_PREF[req] != null ? [0, 0] : PRO_PAID[req] ?? HOLD_PRICE;
            const inTok = result.usage?.prompt_tokens ?? Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 3);
            const outTok = result.usage?.completion_tokens ?? Math.ceil(result.chars / 3);
            rawUsd = inTok * price[0] + outTok * price[1];
          }
        }
        const rawMicros = Math.round(rawUsd * 1e6);
        // Never charge more than was held.
        const chargeMicros = pro.plan === 'owner' ? 0 : Math.min(Math.ceil(rawMicros * MARKUP), pro.holdMicros);
        const tokens = Number(result.usage?.total_tokens ?? 0);
        const holdId = pro.holdId;
        const ok = holdId != null
          ? await billingWrite(() => admin.schema('appmaker').rpc('credit_settle', {
              p_hold: holdId, p_amount: chargeMicros, p_raw_cost: rawMicros, p_tokens: tokens, p_model: result.model,
            }))
          : await billingWrite(() => admin.schema('appmaker').rpc('credit_log_usage', {
              p_user: user.id, p_amount: 0, p_raw_cost: rawMicros, p_tokens: tokens, p_model: result.model,
            }));
        if (!ok) console.error('[stream] billing settle failed', { hold_id: holdId, user_id: user.id, amount_micros: chargeMicros });
        const { data: bal } = await admin.schema('appmaker').rpc('credit_balance', { p_user: user.id });
        billing = { charged_usd: chargeMicros / 1e6, balance_usd: Number(bal ?? 0) / 1e6 };
      }

      emit('done', { model: result.model, usage: result.usage, ...(billing ?? {}) });
      if (!clientGone) controller.close();
    },
    cancel() {
      // Tab closed / user pressed stop: stop spending tokens upstream.
      clientGone = true;
      upstream.abort(new Error('client cancelled'));
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
