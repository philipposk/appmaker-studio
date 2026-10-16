import React, { useEffect, useState } from 'react';
import { TOKENS, I } from '../../design';
import {
  BillingStatus, TOPUP_PACKS, getBillingStatus, isProPlan,
  startProCheckout, startTopup, openBillingPortal,
} from '../../lib/billing';

/** Pro plan + credit balance, shown at the top of Settings → LLM Providers. */
const ProBillingCard: React.FC = () => {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('billing');
    // Coming back from Stripe Checkout → force a sync so credits show up now.
    // Switch the default to "pro" only if it can't run on its own (no saved key, not Ollama).
    if (flag === 'subscribed') {
      try {
        const current = localStorage.getItem('appmaker.defaultProvider') || 'groq';
        const keys = JSON.parse(localStorage.getItem('appmaker.providerKeys') || '{}');
        if (current !== 'ollama' && !keys?.[current]?.trim?.()) localStorage.setItem('appmaker.defaultProvider', 'pro');
      } catch { /* ignore */ }
    }
    getBillingStatus(!!flag).then(setStatus).catch((e) => setError(e.message));
    if (flag) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError('');
    try { await fn(); } catch (e: any) { setError(e?.message || String(e)); setBusy(''); }
  };

  const btn = (primary: boolean): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    border: primary ? 'none' : `1px solid ${TOKENS.hairline2}`,
    background: primary ? TOKENS.accent : 'transparent',
    color: primary ? '#0B0B0E' : TOKENS.text1,
  });

  const pro = isProPlan(status);
  const owner = status?.plan === 'owner';
  const markupPct = Math.round(((status?.markup ?? 1.4) - 1) * 100);
  const proOpen = status?.pro_open !== false;

  return (
    <div
      style={{
        marginBottom: 24, padding: '16px 18px', borderRadius: 10,
        background: pro ? TOKENS.accentSoft : TOKENS.panel,
        border: `1px solid ${pro ? TOKENS.accentLine : TOKENS.hairline}`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <I.Bolt size={16} style={{ color: TOKENS.accent }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            AppMaker Pro {owner ? '· owner' : pro ? '· active' : ''}
          </div>
          <div style={{ fontSize: 12.5, color: TOKENS.text3 }}>
            {owner
              ? 'Unlimited on the platform key. Usage is logged, not charged.'
              : pro
                ? `No key needed. Each build is charged from your credits at model cost + ${markupPct}%.`
                : `$5/month. Build without your own key; pay per build from prepaid credits (model cost + ${markupPct}%).`}
          </div>
        </div>
        {status && pro && !owner && (
          <div style={{ fontFamily: TOKENS.mono, fontSize: 15, fontWeight: 600 }}>
            ${status.balance_usd.toFixed(2)}
          </div>
        )}
      </div>

      {status && !pro && (
        <div>
          {proOpen ? (
            <button disabled={!!busy} style={btn(true)} onClick={() => run('pro', startProCheckout)}>
              {busy === 'pro' ? 'Opening checkout…' : 'Upgrade to Pro'}
            </button>
          ) : (
            <span style={{ fontSize: 12.5, color: TOKENS.text2 }}>Pro opens soon.</span>
          )}
        </div>
      )}

      {status && pro && !owner && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {proOpen && TOPUP_PACKS.map((amt) => (
            <button key={amt} disabled={!!busy} style={btn(true)} onClick={() => run(`t${amt}`, () => startTopup(amt))}>
              {busy === `t${amt}` ? 'Opening…' : `Add $${amt}`}
            </button>
          ))}
          <button disabled={!!busy} style={btn(false)} onClick={() => run('portal', openBillingPortal)}>
            Manage subscription
          </button>
        </div>
      )}

      {status && pro && status.ledger.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, color: TOKENS.text2 }}>Recent usage</summary>
          <div style={{ marginTop: 8, display: 'grid', gap: 4, fontFamily: TOKENS.mono, fontSize: 11.5, color: TOKENS.text2 }}>
            {status.ledger.map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <span style={{ color: TOKENS.text3 }}>{new Date(l.created_at).toLocaleString()}</span>
                <span>{l.kind}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.model ?? ''}</span>
                <span>{l.amount_usd >= 0 ? '+' : ''}{l.amount_usd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {!status && !error && <div style={{ fontSize: 12.5, color: TOKENS.text3 }}>Loading plan…</div>}
      {error && <div style={{ fontSize: 12.5, color: '#FB7185' }}>{error}</div>}
    </div>
  );
};

export default ProBillingCard;
