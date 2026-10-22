/**
 * Turns backend / provider failures into short plain-English messages, and
 * decides which failures are worth retrying on AppMaker Pro. The raw text is
 * kept by the callers in their (collapsible) log; it never goes in the error box.
 */

export type ErrorKind =
  | 'model_gone'
  | 'bad_key'
  | 'rate_limited'
  | 'provider_down'
  | 'no_credits'
  | 'needs_key'
  | 'timeout'
  | 'network'
  | 'unknown';

export interface RawError {
  message: string;
  code?: string;
  status?: number;
}

const LABELS: Record<string, string> = {
  pro: 'AppMaker Pro',
  groq: 'Groq',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic',
  together: 'Together',
  mistral: 'Mistral',
  ollama: 'Ollama',
};

export const providerLabel = (provider?: string) => (provider && LABELS[provider]) || 'The AI provider';

const asRaw = (e: RawError | string | unknown): RawError => {
  if (typeof e === 'string') return { message: e };
  const o = e as Partial<RawError> | null;
  return { message: String(o?.message ?? e ?? ''), code: o?.code, status: o?.status };
};

export function classifyError(input: RawError | string | unknown): ErrorKind {
  const e = asRaw(input);
  const msg = e.message;
  const fromText = /(?:error|status)\s+(\d{3})/i.exec(msg)?.[1];
  const status = e.status ?? (fromText ? Number(fromText) : undefined);

  if (e.code === 'timeout') return 'timeout';
  if (e.code === 'no_credits' || /out of credits/i.test(msg)) return 'no_credits';
  if (e.code === 'needs_pro' || e.code === 'no_key' || /add your own api key|upgrade to pro/i.test(msg)) return 'needs_key';
  if (status === 404 || /model_not_found|model_decommissioned|model_not_available|decommissioned|model .*does not exist/i.test(msg)) return 'model_gone';
  if (status === 401 || status === 403 || /invalid[_ ]api[_ ]key|incorrect api key|unauthori[sz]ed|authentication/i.test(msg)) return 'bad_key';
  if (status === 429 || /rate.?limit|quota|too many requests/i.test(msg)) return 'rate_limited';
  if ((status !== undefined && (status >= 500 || status === 408)) || /overloaded|bad gateway|service unavailable/i.test(msg)) return 'provider_down';
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) return 'network';
  return 'unknown';
}

/** Plain enough to show as-is: short, no JSON, no provider boilerplate. */
const isPlain = (msg: string) =>
  !!msg && msg.length <= 140 && !/[{}]/.test(msg) && !/provider error|anthropic error|stream request failed/i.test(msg);

export function friendlyError(input: RawError | string | unknown, provider?: string): string {
  const e = asRaw(input);
  const kind = classifyError(e);
  const who = providerLabel(provider);
  switch (kind) {
    case 'model_gone':
      return `${who === 'The AI provider' ? 'The AI model' : `${who}'s AI model`} is no longer available. Try again, or pick another provider.`;
    case 'bad_key':
      return provider === 'pro'
        ? 'AppMaker Pro could not authenticate. Try again in a moment.'
        : `${who === 'The AI provider' ? 'Your' : `Your ${who}`} API key was rejected. Check it in Settings → LLM Providers.`;
    case 'rate_limited':
      return `${who} is busy or you hit its rate limit. Wait a minute and try again.`;
    case 'provider_down':
      return `${who} is having problems right now. Try again shortly.`;
    case 'network':
      return "Couldn't reach AppMaker. Check your connection and try again.";
    case 'no_credits':
      return isPlain(e.message) ? e.message : 'Out of credits. Top up to keep building.';
    case 'needs_key':
      return isPlain(e.message) ? e.message : 'Add your own API key, or upgrade to Pro to build with ours.';
    case 'timeout':
      return isPlain(e.message) ? e.message : 'This build ran too long and was stopped.';
    default:
      return isPlain(e.message) ? e.message : 'Something went wrong while building. Open the details below for more.';
  }
}

const FALLBACK_REASONS: Partial<Record<ErrorKind, string>> = {
  model_gone: 'model retired',
  bad_key: 'key rejected',
  rate_limited: 'rate limited',
  provider_down: 'provider down',
};

/** Failures where AppMaker Pro can take over the same request. */
export const isFallbackEligible = (input: RawError | string | unknown) =>
  classifyError(input) in FALLBACK_REASONS;

export function fallbackNotice(fromProvider: string | undefined, input: RawError | string | unknown): string {
  const reason = FALLBACK_REASONS[classifyError(input)] ?? 'it failed';
  return `Your ${providerLabel(fromProvider)} key failed (${reason}), used AppMaker Pro instead.`;
}
