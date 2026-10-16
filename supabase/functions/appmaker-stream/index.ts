import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * appmaker-stream — multi-provider LLM streaming proxy.
 *
 * Legacy: the studio frontend now uses frontend/api/stream.ts (incl. Pro);
 * this function is kept only for older clients and is own-key only.
 *
 * Accepts a POST with {prompt, provider, apiKey, model, appType, refineFrom}
 * and streams structured SSE events back:
 *   event: token   data: {delta: string}
 *   event: action  data: {action: {type, ...}}
 *   event: done    data: {model, usage}
 *   event: error   data: {message}
 *
 * JWT auth handled by Supabase (verify_jwt: true on deploy).
 * User API key forwarded per-request; never stored.
 */

const ALLOWED_ORIGINS = [
  'https://studio.6x7.gr',
  'https://appmaker.6x7.gr',
  'http://localhost:3000',
  'http://localhost:3001',
];

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

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Parse <appmakerAction> blocks out of a text chunk.
// Returns parsed actions and the remainder (incomplete block).
function parseActions(text: string): { actions: object[]; remainder: string } {
  const actions: object[] = [];
  let remainder = text;
  const fullBlockRe = /<appmakerAction([^>]*)>([\s\S]*?)<\/appmakerAction>/g;
  let m: RegExpExecArray | null;
  while ((m = fullBlockRe.exec(text)) !== null) {
    const attrs = m[1];
    const content = m[2];
    const typeM = attrs.match(/type="([^"]+)"/);
    const pathM = attrs.match(/path="([^"]+)"/);
    const nameM = attrs.match(/name="([^"]+)"/);
    const cmdM  = attrs.match(/cmd="([^"]+)"/);
    const type = typeM?.[1] ?? 'unknown';
    if (type === 'artifact') actions.push({ type: 'artifact', name: nameM?.[1] ?? 'App' });
    else if (type === 'file')  actions.push({ type: 'file',  path: pathM?.[1] ?? '', content });
    else if (type === 'shell') actions.push({ type: 'shell', cmd: cmdM?.[1] ?? content.trim() });
    else if (type === 'delete') actions.push({ type: 'delete', path: pathM?.[1] ?? '' });
  }
  // Remainder = text after last complete block (may contain a partial opening tag)
  const lastEnd = [...text.matchAll(/<\/appmakerAction>/g)].at(-1);
  if (lastEnd) remainder = text.slice(lastEnd.index! + lastEnd[0].length);
  return { actions, remainder };
}

// `models` is tried in order until one accepts the request (rotation happens
// before any token is streamed, so the client never sees a half switch).
async function streamOpenAICompat(
  url: string, apiKey: string, models: string[],
  messages: object[], controller: ReadableStreamDefaultController<Uint8Array>,
  extra: Record<string, unknown> = {}, extraHeaders: Record<string, string> = {},
) {
  const enc = new TextEncoder();
  let resp: Response | null = null;
  let model = models[0];
  let lastErr = '';
  for (const m of models) {
    model = m;
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify({ model: m, messages, stream: true, temperature: 0.2, ...extra }),
    });
    if (resp.ok && resp.body) break;
    lastErr = `Provider error ${resp.status} (${m}): ${(await resp.text().catch(() => '')).slice(0, 200)}`;
    resp = null;
  }
  if (!resp || !resp.body) {
    controller.enqueue(enc.encode(sse('error', { message: lastErr || 'Provider unavailable' })));
    return { finishModel: model, usage: null };
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let fullText = '';
  let pendingBlock = '';
  let finishModel = model;
  // deno-lint-ignore no-explicit-any
  let usage: any = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (raw === '[DONE]') continue;
      try {
        const chunk = JSON.parse(raw);
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (chunk.model) finishModel = chunk.model;
        if (chunk.usage) usage = chunk.usage;
        if (!delta) continue;
        // Emit token
        controller.enqueue(enc.encode(sse('token', { delta })));
        // Accumulate for action parsing
        pendingBlock += delta;
        fullText    += delta;
        // Parse complete action blocks out of the pending buffer
        const { actions, remainder } = parseActions(pendingBlock);
        pendingBlock = remainder;
        for (const a of actions) {
          controller.enqueue(enc.encode(sse('action', { action: a })));
        }
      } catch { /* ignore malformed chunks */ }
    }
  }
  // Catch any leftover complete blocks in pendingBlock
  const { actions: trailing } = parseActions(pendingBlock);
  for (const a of trailing) {
    controller.enqueue(enc.encode(sse('action', { action: a })));
  }
  return { finishModel, usage };
}

async function streamAnthropic(
  apiKey: string, model: string,
  messages: object[], controller: ReadableStreamDefaultController<Uint8Array>
) {
  const enc = new TextEncoder();
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model, messages, stream: true, max_tokens: 16000,
      system: SYSTEM_PROMPT,
    }),
  });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => '');
    controller.enqueue(enc.encode(sse('error', { message: `Anthropic error ${resp.status}: ${txt.slice(0, 200)}` })));
    return { finishModel: model, usage: null };
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let pendingBlock = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          const delta = ev.delta.text ?? '';
          controller.enqueue(enc.encode(sse('token', { delta })));
          pendingBlock += delta;
          const { actions, remainder } = parseActions(pendingBlock);
          pendingBlock = remainder;
          for (const a of actions) controller.enqueue(enc.encode(sse('action', { action: a })));
        } else if (ev.type === 'message_delta' && ev.usage) {
          outputTokens = ev.usage.output_tokens ?? 0;
        } else if (ev.type === 'message_start' && ev.message?.usage) {
          inputTokens = ev.message.usage.input_tokens ?? 0;
        }
      } catch { /* ignore */ }
    }
  }
  const { actions: trailing } = parseActions(pendingBlock);
  for (const a of trailing) controller.enqueue(enc.encode(sse('action', { action: a })));
  return { finishModel: model, usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens } };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

  let body: {
    prompt: string;
    provider?: string;
    apiKey?: string;
    model?: string;
    appType?: string;
    refineFrom?: string;
    temperature?: number;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid JSON' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const { prompt, provider = 'groq', apiKey, appType = 'web', refineFrom } = body;
  const json = (status: number, b: unknown) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (!prompt?.trim()) return json(400, { message: 'prompt is required' });
  // Pro (platform key + credits) moved to the Vercel function; never spend it here.
  if (provider === 'pro') return json(410, { code: 'moved', message: 'Pro builds run via studio.6x7.gr/api/stream.' });

  const messages: object[] = [
    ...(provider !== 'anthropic' ? [{ role: 'system', content: SYSTEM_PROMPT }] : []),
    ...(refineFrom
      ? [
          { role: 'user', content: `Existing code context:\n${refineFrom}` },
          { role: 'assistant', content: 'I have reviewed the existing code.' },
          { role: 'user', content: `Change the existing app as follows, keeping everything else as it is: ${prompt.trim()}\n\nOutput ONLY the files you add or change (full content of each), no artifact action, no unchanged files. Never output a file whose content in the context is marked [TRUNCATED].` },
        ]
      : [{ role: 'user', content: `Build a ${appType} app: ${prompt.trim()}` }]),
  ];

  // The user's own key only. No fallback to the platform's env keys — those
  // are shared with sibling apps and would let any signed-in user spend them.
  const resolvedKey = apiKey?.trim() ?? '';
  if (!resolvedKey && provider !== 'ollama') {
    return json(400, { code: 'no_key', message: `No API key for provider "${provider}". Add it in Provider Settings, or upgrade to Pro.` });
  }

  const model = body.model?.trim() || DEFAULT_MODELS[provider] || DEFAULT_MODELS.groq;
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // deno-lint-ignore no-explicit-any
      let result: { finishModel: string; usage: any } = { finishModel: model, usage: null };
      try {
        if (provider === 'anthropic') {
          result = await streamAnthropic(resolvedKey, model, messages, controller);
        } else if (provider === 'ollama') {
          const ollamaUrl = Deno.env.get('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
          result = await streamOpenAICompat(`${ollamaUrl}/api/chat`, '', [model], messages, controller);
        } else {
          const url = PROVIDER_ENDPOINTS[provider] ?? PROVIDER_ENDPOINTS.groq;
          result = await streamOpenAICompat(url, resolvedKey, [model], messages, controller);
        }
      } catch (err) {
        controller.enqueue(enc.encode(sse('error', { message: String(err) })));
      }

      controller.enqueue(enc.encode(sse('done', { model: result.finishModel, usage: result.usage })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
