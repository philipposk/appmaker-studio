/**
 * SSE client for /api/stream/generate and /api/autofix.
 *
 * Plain EventSource only supports GET. We POST a JSON body, then read the
 * response body as a text stream and parse SSE manually.
 */

export type StreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'action'; action: FileAction }
  | { type: 'done'; usage?: any; model?: string }
  | { type: 'error'; message: string }
  | { type: 'complete'; ok: boolean }
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

const API = (process.env.REACT_APP_API_URL as string) || 'http://localhost:8000/api';

/**
 * POST an SSE stream and yield parsed events.
 * Aborted via the returned `cancel` function.
 */
export function postSSE(
  path: string,
  body: any,
  onEvent: (ev: StreamEvent) => void,
): { promise: Promise<void>; cancel: () => void } {
  const controller = new AbortController();
  const promise = (async () => {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`SSE request failed: ${res.status} ${text}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = raw.split('\n');
        let event = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith(':')) continue; // heartbeat
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        try {
          const data = JSON.parse(dataLines.join('\n'));
          onEvent({ type: event, ...data } as StreamEvent);
        } catch {
          /* ignore malformed */
        }
      }
    }
  })();
  return { promise, cancel: () => controller.abort() };
}

export function streamGenerate(opts: GenerateOptions, onEvent: (ev: StreamEvent) => void) {
  return postSSE('/stream/generate', opts, onEvent);
}

export function streamAutoFix(
  body: { projectDir: string; provider?: string; apiKey?: string; maxIterations?: number },
  onEvent: (ev: StreamEvent) => void,
) {
  return postSSE('/autofix', body, onEvent);
}

export async function listProviders(): Promise<{ available: string[]; all: string[] }> {
  const res = await fetch(`${API}/stream/providers`);
  return res.json();
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
 * Persist streamed files into a new or existing App via the auth-protected
 * apps controller. Pulls the JWT from localStorage (same place api.ts uses).
 */
export async function saveStreamResult(body: SaveStreamBody) {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(`${API}/apps/save-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`save-stream failed: ${res.status} ${text}`);
  }
  return res.json();
}
