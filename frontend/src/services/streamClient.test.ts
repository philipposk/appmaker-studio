import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';
import { getBillingStatus, showUpgrade, BillingStatus } from '../lib/billing';
import { routeRequest, streamGenerate, StreamEvent } from './streamClient';

Object.assign(global, { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder });

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}));
jest.mock('../lib/billing', () => ({
  ...jest.requireActual('../lib/billing'),
  getBillingStatus: jest.fn(),
  invalidateBillingStatus: jest.fn(),
  showUpgrade: jest.fn(),
}));

const billing = (plan: BillingStatus['plan'], balance_usd = 0): BillingStatus => ({
  plan, status: 'active', current_period_end: null, balance_usd, markup: 1.4, pro_open: true, ledger: [],
});
const mockBilling = getBillingStatus as jest.Mock;

const sse = (...events: [string, object][]) =>
  events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');

function okStream(text: string) {
  const bytes = new NodeTextEncoder().encode(text);
  let sent = false;
  return {
    ok: true, status: 200,
    body: { getReader: () => ({ read: async () => (sent ? { done: true, value: undefined } : ((sent = true), { done: false, value: bytes })) }) },
    text: async () => text,
  };
}

const RETIRED = 'Provider error 404 (llama-3.3-70b-versatile): {"error":{"code":"model_not_found"}}';
const failure = (message: string, status?: number) =>
  okStream(sse(['error', { message, status }], ['done', { model: 'm', usage: null }]));
const success = (model = 'pro-model') =>
  okStream(sse(['token', { delta: 'x' }], ['action', { action: { type: 'artifact', name: 'App' } }], ['done', { model, usage: { total_tokens: 5 } }]));

let fetchMock: jest.Mock;
const sentProviders = () => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).provider);

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock = jest.fn();
  (global as any).fetch = fetchMock;
});

describe('routeRequest', () => {
  const own = { prompt: 'p', provider: 'groq', apiKey: 'k' };

  it('owner with an unchosen default provider builds on pro', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    const r = await routeRequest(own);
    expect(r.opts).toMatchObject({ provider: 'pro', apiKey: undefined });
    expect(r.canFallback).toBe(false);
  });

  it('pro with credits also defaults to pro, pro with no credits keeps the own key', async () => {
    mockBilling.mockResolvedValue(billing('pro', 3));
    expect((await routeRequest(own)).opts.provider).toBe('pro');
    mockBilling.mockResolvedValue(billing('pro', 0));
    const r = await routeRequest(own);
    expect(r.opts.provider).toBe('groq');
    expect(r.canFallback).toBe(false);
  });

  it('an explicit provider choice stays on the own key, with Pro as fallback', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    const r = await routeRequest({ ...own, providerExplicit: true });
    expect(r.opts.provider).toBe('groq');
    expect(r.canFallback).toBe(true);
  });

  it('free users keep their key and get no fallback', async () => {
    mockBilling.mockResolvedValue(billing('free'));
    const r = await routeRequest({ ...own, providerExplicit: true });
    expect(r).toMatchObject({ opts: { provider: 'groq' }, canFallback: false });
  });

  it('a failed plan lookup does not block an own-key build', async () => {
    mockBilling.mockRejectedValue(new Error('down'));
    const r = await routeRequest(own);
    expect(r).toMatchObject({ opts: { provider: 'groq' }, canFallback: false });
  });

  it('no key: pro builds on pro, free gets the upgrade modal, lookup failure throws', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    expect((await routeRequest({ prompt: 'p', provider: 'groq' })).opts.provider).toBe('pro');
    mockBilling.mockResolvedValue(billing('free'));
    await expect(routeRequest({ prompt: 'p', provider: 'groq' })).rejects.toThrow(/upgrade to Pro/);
    expect(showUpgrade).toHaveBeenCalledWith('needs_key_or_pro');
    mockBilling.mockRejectedValue(new Error('down'));
    await expect(routeRequest({ prompt: 'p', provider: 'groq' })).rejects.toThrow(/Couldn't check your plan/);
  });

  it('pro with zero credits and no key is told to top up', async () => {
    mockBilling.mockResolvedValue(billing('pro', 0));
    await expect(routeRequest({ prompt: 'p', provider: 'pro' })).rejects.toThrow(/Out of credits/);
    expect(showUpgrade).toHaveBeenCalledWith('no_credits', 0);
  });
});

describe('streamGenerate fallback', () => {
  const explicitOwn = { prompt: 'p', provider: 'groq', apiKey: 'k', providerExplicit: true };
  const run = async (opts: Parameters<typeof streamGenerate>[0]) => {
    const events: StreamEvent[] = [];
    await streamGenerate(opts, (e) => events.push(e)).promise;
    return events;
  };

  it('retries on pro when the own key fails before output, hiding the failed attempt', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    fetchMock.mockResolvedValueOnce(failure(RETIRED, 404)).mockResolvedValueOnce(success());
    const events = await run(explicitOwn);
    expect(sentProviders()).toEqual(['groq', 'pro']);
    expect(events.find((e) => e.type === 'notice')).toMatchObject({
      message: 'Your Groq key failed (model retired), used AppMaker Pro instead.',
    });
    expect(events.filter((e) => e.type === 'error')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('apiKey');
  });

  it.each([[401], [403], [429], [503]])('falls back on status %i', async (status) => {
    mockBilling.mockResolvedValue(billing('owner'));
    fetchMock.mockResolvedValueOnce(failure(`Provider error ${status} (m): x`, status)).mockResolvedValueOnce(success());
    await run(explicitOwn);
    expect(sentProviders()).toEqual(['groq', 'pro']);
  });

  it('does not fall back for free users: the error reaches the UI', async () => {
    mockBilling.mockResolvedValue(billing('free'));
    fetchMock.mockResolvedValueOnce(failure(RETIRED, 404));
    const events = await run(explicitOwn);
    expect(sentProviders()).toEqual(['groq']);
    expect(events.filter((e) => e.type === 'error')).toHaveLength(1);
  });

  it('does not fall back once output has streamed', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    fetchMock.mockResolvedValueOnce(okStream(
      sse(['token', { delta: 'x' }], ['error', { message: 'Provider error 500 (m): x', status: 500 }], ['done', { model: 'm' }]),
    ));
    const events = await run(explicitOwn);
    expect(sentProviders()).toEqual(['groq']);
    expect(events.filter((e) => e.type === 'error')).toHaveLength(1);
  });

  it('does not fall back for non-provider errors (e.g. timeout)', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    fetchMock
      .mockResolvedValueOnce(okStream(sse(['error', { code: 'timeout', message: 'too long' }], ['done', { model: 'm' }])))
      .mockResolvedValue(success()); // the automatic continuation round
    const events = await run({ ...explicitOwn });
    expect(sentProviders()).toEqual(['groq', 'groq']); // continues on the same provider, never switches to pro
    expect(events.some((e) => e.type === 'notice')).toBe(false);
  });

  it('falls back only once: a failing pro retry surfaces its error', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    fetchMock.mockResolvedValueOnce(failure(RETIRED, 404)).mockResolvedValueOnce(failure('Provider error 500 (m): x', 500));
    const events = await run(explicitOwn);
    expect(sentProviders()).toEqual(['groq', 'pro']);
    expect(events.filter((e) => e.type === 'error')).toHaveLength(1);
  });

  it('owner with a stale default goes straight to pro (no failed attempt at all)', async () => {
    mockBilling.mockResolvedValue(billing('owner'));
    fetchMock.mockResolvedValueOnce(success());
    const events = await run({ prompt: 'p', provider: 'groq', apiKey: 'k' });
    expect(sentProviders()).toEqual(['pro']);
    expect(events[0]).toEqual({ type: 'route', provider: 'pro' });
  });
});
