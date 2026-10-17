import { classifyError, fallbackNotice, friendlyError, isFallbackEligible } from './streamErrors';

const RETIRED =
  'Provider error 404 (llama-3.3-70b-versatile): {"error":{"message":"The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.","type":"invalid_request_error","code":"model_not_found"}}';

describe('classifyError', () => {
  it.each([
    [RETIRED, undefined, 'model_gone'],
    ['Provider error 400 (x): {"error":{"code":"model_decommissioned"}}', undefined, 'model_gone'],
    ['Provider error 401 (x): {"error":{"message":"Invalid API Key"}}', undefined, 'bad_key'],
    ['Provider error 403 (x): forbidden', undefined, 'bad_key'],
    ['Provider error 429 (x): {"error":"rate_limit_exceeded"}', undefined, 'rate_limited'],
    ['Provider error 503 (x): upstream down', undefined, 'provider_down'],
    ['Anthropic error 529: overloaded_error', undefined, 'provider_down'],
    ['Out of credits. Top up to keep building.', 'no_credits', 'no_credits'],
    ['Add your own API key or upgrade to Pro.', 'needs_pro', 'needs_key'],
    ['This build ran too long', 'timeout', 'timeout'],
    ['Failed to fetch', undefined, 'network'],
    ['Something odd', undefined, 'unknown'],
  ])('%s -> %s', (message, code, kind) => {
    expect(classifyError({ message: message as string, code: code as string | undefined })).toBe(kind);
  });

  it('prefers an explicit status over the message text', () => {
    expect(classifyError({ message: 'boom', status: 429 })).toBe('rate_limited');
  });
});

describe('friendlyError', () => {
  it('never shows raw JSON or provider boilerplate', () => {
    for (const msg of [RETIRED, 'Provider error 500 (m): {"a":1}', 'Stream request failed: 500 {x}']) {
      const out = friendlyError(msg, 'groq');
      expect(out).not.toMatch(/[{}]|Provider error|model_not_found|llama-3\.3/);
    }
  });

  it('names the provider for a retired model', () => {
    expect(friendlyError(RETIRED, 'groq')).toBe("Groq's AI model is no longer available. Try again, or pick another provider.");
  });

  it('points a rejected key at Settings', () => {
    expect(friendlyError({ message: 'x', status: 401 }, 'openai')).toBe('Your OpenAI API key was rejected. Check it in Settings → LLM Providers.');
  });

  it('maps busy / rate limit / network', () => {
    expect(friendlyError({ message: 'x', status: 429 }, 'groq')).toMatch(/busy or you hit its rate limit/);
    expect(friendlyError({ message: 'x', status: 502 }, 'mistral')).toMatch(/Mistral is having problems/);
    expect(friendlyError('Failed to fetch')).toMatch(/Couldn't reach AppMaker/);
  });

  it('keeps short plain messages and out-of-credits wording', () => {
    expect(friendlyError({ message: 'Out of credits. Top up to keep building.', code: 'no_credits' })).toBe('Out of credits. Top up to keep building.');
    expect(friendlyError('Sign in first.')).toBe('Sign in first.');
  });

  it('falls back to a generic line for long/unknown text', () => {
    expect(friendlyError('x'.repeat(300))).toMatch(/Something went wrong/);
  });
});

describe('fallback decision', () => {
  it('retries on Pro for model gone, bad key, rate limit, provider down', () => {
    expect(isFallbackEligible({ message: RETIRED })).toBe(true);
    expect(isFallbackEligible({ message: 'x', status: 401 })).toBe(true);
    expect(isFallbackEligible({ message: 'x', status: 403 })).toBe(true);
    expect(isFallbackEligible({ message: 'x', status: 429 })).toBe(true);
    expect(isFallbackEligible({ message: 'x', status: 500 })).toBe(true);
  });

  it('does not retry credits, timeout, network or unknown errors', () => {
    expect(isFallbackEligible({ message: 'x', code: 'no_credits' })).toBe(false);
    expect(isFallbackEligible({ message: 'x', code: 'timeout' })).toBe(false);
    expect(isFallbackEligible('Failed to fetch')).toBe(false);
    expect(isFallbackEligible('weird')).toBe(false);
  });

  it('writes one plain log line', () => {
    expect(fallbackNotice('groq', { message: RETIRED })).toBe('Your Groq key failed (model retired), used AppMaker Pro instead.');
    expect(fallbackNotice('openai', { message: 'x', status: 401 })).toBe('Your OpenAI key failed (key rejected), used AppMaker Pro instead.');
  });
});
