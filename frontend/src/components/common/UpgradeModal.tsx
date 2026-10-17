import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOKENS, I } from '../../design';
import { UPGRADE_EVENT, UpgradeReason, TOPUP_PACKS, getBillingStatus, startProCheckout, startTopup } from '../../lib/billing';

/**
 * "Add your own key or go Pro" — opened via showUpgrade() from any
 * generation entry point (prompt arrow, builder refine) when the user has no
 * key and no Pro plan, or a Pro user runs out of credits.
 */
const UpgradeModal: React.FC = () => {
  const navigate = useNavigate();
  const [reason, setReason] = useState<UpgradeReason | null>(null);
  const [balance, setBalance] = useState<number | undefined>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Pro sales not open yet (status.pro_open === false). Unknown/failed = open, as before.
  const [proClosed, setProClosed] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      setReason(d.reason);
      setBalance(d.balanceUsd);
      setError('');
      setBusy('');
      setProClosed(false);
      getBillingStatus().then((s) => setProClosed(s.pro_open === false)).catch(() => { /* keep defaults */ });
    };
    window.addEventListener(UPGRADE_EVENT, onOpen);
    return () => window.removeEventListener(UPGRADE_EVENT, onOpen);
  }, []);

  if (!reason) return null;
  const close = () => setReason(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError('');
    try { await fn(); } catch (e: any) { setError(e?.message || String(e)); setBusy(''); }
  };

  const card: React.CSSProperties = {
    flex: 1, minWidth: 220, padding: 18, borderRadius: 12,
    background: TOKENS.panel2, border: `1px solid ${TOKENS.hairline}`,
    display: 'flex', flexDirection: 'column', gap: 10,
  };
  const btn = (primary: boolean): React.CSSProperties => ({
    padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: primary ? 'none' : `1px solid ${TOKENS.hairline2}`,
    background: primary ? TOKENS.accent : 'transparent',
    color: primary ? '#0B0B0E' : TOKENS.text1,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
        display: 'grid', placeItems: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, padding: 24, borderRadius: 16,
          background: TOKENS.panel, border: `1px solid ${TOKENS.hairline2}`,
          color: TOKENS.text1, fontFamily: TOKENS.sans,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <I.Sparkle size={18} style={{ color: TOKENS.accent }} />
          <h2 id="upgrade-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {reason === 'no_credits' ? 'Out of credits' : 'Pick how to power AppMaker'}
          </h2>
          <button onClick={close} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: TOKENS.text3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ margin: '0 0 18px', color: TOKENS.text2, fontSize: 13.5 }}>
          {reason === 'no_credits'
            ? `Your balance is $${(balance ?? 0).toFixed(2)}. Add credits to keep building.`
            : 'Building an app needs an AI model. Bring your own key, or let us handle it.'}
        </p>

        {reason === 'no_credits' ? (proClosed ? (
          <div style={{ color: TOKENS.text3, fontSize: 12.5 }}>Top-ups open soon.</div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TOPUP_PACKS.map((amt, i) => (
              <button key={amt} disabled={!!busy} style={{ ...btn(i === 0), flex: 1 }}
                onClick={() => run(`topup${amt}`, () => startTopup(amt))}>
                {busy === `topup${amt}` ? 'Opening…' : `Add $${amt}`}
              </button>
            ))}
          </div>
        )) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={card}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Use your own key</div>
              <div style={{ color: TOKENS.text3, fontSize: 12.5, flex: 1 }}>
                Free with us. Groq has a free tier; OpenAI, OpenRouter and others work too.
              </div>
              <button style={btn(false)} onClick={() => { close(); navigate('/settings/providers'); }}>
                Add API key
              </button>
            </div>
            <div style={{ ...card, border: `1px solid ${TOKENS.accentLine}`, background: TOKENS.accentSoft }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{proClosed ? 'Pro — coming soon' : 'Go Pro — $5/month'}</div>
              <div style={{ color: TOKENS.text2, fontSize: 12.5, flex: 1 }}>
                No key needed. Prepaid credits, charged per build at model cost + 40%. Many builds cost $0.
              </div>
              {proClosed ? (
                <button disabled style={{ ...btn(true), opacity: 0.5, cursor: 'default' }}>Coming soon</button>
              ) : (
                <button disabled={!!busy} style={btn(true)} onClick={() => run('pro', startProCheckout)}>
                  {busy === 'pro' ? 'Opening checkout…' : 'Upgrade to Pro'}
                </button>
              )}
            </div>
          </div>
        )}

        {error && <div style={{ marginTop: 14, color: '#FB7185', fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
};

export default UpgradeModal;
