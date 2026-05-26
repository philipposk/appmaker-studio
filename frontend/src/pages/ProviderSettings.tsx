import React, { useEffect, useState } from 'react';
import { listProviders } from '../services/streamClient';
import { TOKENS, I, Sidebar } from '../design';

/**
 * Provider settings page.
 *
 * API keys entered here are stored in localStorage only.
 * They are forwarded as the `apiKey` field on each /api/stream/generate
 * request body — never persisted on the backend.
 */

const PROVIDER_INFO: Record<string, { label: string; keyEnv: string; help: string; getKeyUrl: string }> = {
  groq: {
    label: 'Groq',
    keyEnv: 'GROQ_API_KEY',
    help: 'Fastest LPU inference. Free tier with generous rate limits.',
    getKeyUrl: 'https://console.groq.com/keys',
  },
  openai: {
    label: 'OpenAI',
    keyEnv: 'OPENAI_API_KEY',
    help: 'GPT-4o / o-series models. Pay-as-you-go.',
    getKeyUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    label: 'OpenRouter',
    keyEnv: 'OPENROUTER_API_KEY',
    help: 'One key, hundreds of models. Good for fallback + cost control.',
    getKeyUrl: 'https://openrouter.ai/keys',
  },
  anthropic: {
    label: 'Anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
    help: 'Claude Sonnet / Opus / Haiku. Best for code generation.',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
  together: {
    label: 'Together AI',
    keyEnv: 'TOGETHER_API_KEY',
    help: 'Open-weights hosting — Llama, Qwen, DeepSeek.',
    getKeyUrl: 'https://api.together.xyz/settings/api-keys',
  },
  mistral: {
    label: 'Mistral',
    keyEnv: 'MISTRAL_API_KEY',
    help: 'Mistral Large / Codestral.',
    getKeyUrl: 'https://console.mistral.ai/api-keys/',
  },
  ollama: {
    label: 'Ollama (local)',
    keyEnv: '',
    help: 'Local models, no key needed. Run `ollama serve` on this machine.',
    getKeyUrl: 'https://ollama.com/download',
  },
};

const LS_KEYS = 'appmaker.providerKeys';
const LS_DEFAULT = 'appmaker.defaultProvider';

function loadKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_KEYS) || '{}'); }
  catch { return {}; }
}
function saveKeys(keys: Record<string, string>) {
  localStorage.setItem(LS_KEYS, JSON.stringify(keys));
}

const ProviderSettings: React.FC = () => {
  const [available, setAvailable] = useState<string[]>([]);
  const [all, setAll] = useState<string[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [defaultProvider, setDefaultProvider] = useState<string>('groq');
  const [savedFlash, setSavedFlash] = useState<string>('');
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    setKeys(loadKeys());
    setDefaultProvider(localStorage.getItem(LS_DEFAULT) || 'groq');
    listProviders()
      .then((d) => { setAvailable(d.available || []); setAll(d.all || []); })
      .catch((e) => setLoadError(e.message));
  }, []);

  const updateKey = (name: string, value: string) =>
    setKeys((prev) => ({ ...prev, [name]: value }));

  const handleSave = () => {
    saveKeys(keys);
    localStorage.setItem(LS_DEFAULT, defaultProvider);
    setSavedFlash('Saved');
    window.setTimeout(() => setSavedFlash(''), 1500);
  };

  const handleClear = (name: string) => {
    const next = { ...keys };
    delete next[name];
    setKeys(next);
    saveKeys(next);
  };

  const providers = all.length ? all : Object.keys(PROVIDER_INFO);

  return (
    <div
      className="am-root"
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: TOKENS.bg,
        color: TOKENS.text1,
        fontFamily: TOKENS.sans,
      }}
    >
      <Sidebar active="settings" />

      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* Top bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '13px 24px',
            borderBottom: `1px solid ${TOKENS.hairline}`,
          }}
        >
          <I.Settings size={16} style={{ color: TOKENS.text3 }} />
          <span style={{ color: TOKENS.text2, fontSize: 13 }}>Settings</span>
          <span style={{ color: TOKENS.text3 }}>/</span>
          <span style={{ color: TOKENS.text1, fontSize: 13, fontWeight: 500 }}>LLM Providers</span>
        </header>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 24px 60px' }}>
          {/* Intro */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              LLM Providers
            </h1>
            <p style={{ margin: 0, color: TOKENS.text2, fontSize: 14, lineHeight: 1.55 }}>
              Keys you enter here are stored in your browser (<code style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.text1 }}>localStorage</code>) and forwarded per-request — never written to the backend.
            </p>
          </div>

          {loadError && (
            <div
              style={{
                marginBottom: 20,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(255,142,114,0.1)',
                border: '1px solid rgba(255,142,114,0.25)',
                color: '#FF8E72',
                fontSize: 13,
              }}
            >
              Backend unreachable — {loadError}. Provider list is estimated.
            </div>
          )}

          {/* Default provider selector */}
          <div
            style={{
              marginBottom: 24,
              padding: '14px 16px',
              borderRadius: 10,
              background: TOKENS.panel,
              border: `1px solid ${TOKENS.hairline}`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <I.Sparkle size={15} style={{ color: TOKENS.accent }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Default provider</div>
              <div style={{ fontSize: 12, color: TOKENS.text3 }}>Used when no provider is explicitly chosen in a prompt.</div>
            </div>
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              style={{
                background: TOKENS.panel2,
                border: `1px solid ${TOKENS.hairline2}`,
                borderRadius: 7,
                color: TOKENS.text1,
                fontSize: 13,
                padding: '6px 10px',
                fontFamily: TOKENS.sans,
                minWidth: 160,
              }}
            >
              {providers.map((p) => (
                <option key={p} value={p}>{PROVIDER_INFO[p]?.label || p}</option>
              ))}
            </select>
          </div>

          {/* Provider cards grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: 14,
              marginBottom: 24,
            }}
          >
            {providers.map((name) => {
              const info = PROVIDER_INFO[name] || { label: name, keyEnv: '', help: '', getKeyUrl: '' };
              const isLocal = name === 'ollama';
              const isAvail = available.includes(name);
              const isDefault = name === defaultProvider;

              return (
                <div
                  key={name}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: TOKENS.panel,
                    border: `1px solid ${isDefault ? TOKENS.accentLine : TOKENS.hairline}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{info.label}</span>
                      {isDefault && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 500,
                            padding: '2px 7px',
                            borderRadius: 99,
                            background: TOKENS.accentSoft,
                            color: TOKENS.accent,
                          }}
                        >
                          default
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 99,
                        background: isAvail
                          ? 'rgba(74,222,128,0.12)'
                          : isLocal
                          ? TOKENS.panel2
                          : 'rgba(245,182,71,0.1)',
                        color: isAvail ? TOKENS.green : isLocal ? TOKENS.text3 : TOKENS.amber,
                      }}
                    >
                      {isAvail ? '● Connected' : isLocal ? '○ Local' : '○ No key'}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 12.5, color: TOKENS.text3, lineHeight: 1.45 }}>{info.help}</p>

                  {!isLocal && (
                    <>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="password"
                          value={keys[name] || ''}
                          onChange={(e) => updateKey(name, e.target.value)}
                          placeholder={info.keyEnv ? `env ${info.keyEnv}` : 'API key'}
                          autoComplete="off"
                          style={{
                            flex: 1,
                            background: TOKENS.panel2,
                            border: `1px solid ${TOKENS.hairline2}`,
                            borderRadius: 7,
                            color: TOKENS.text1,
                            fontSize: 12.5,
                            padding: '7px 10px',
                            fontFamily: TOKENS.mono,
                            outline: 0,
                          }}
                        />
                        {keys[name] && (
                          <button
                            type="button"
                            onClick={() => handleClear(name)}
                            style={{
                              padding: '0 10px',
                              borderRadius: 7,
                              border: `1px solid ${TOKENS.hairline2}`,
                              background: 'transparent',
                              color: TOKENS.text3,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {info.getKeyUrl && (
                        <a
                          href={info.getKeyUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          style={{
                            fontSize: 12,
                            color: TOKENS.text2,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          Get a key <I.Arrow size={11} />
                        </a>
                      )}
                    </>
                  )}

                  {isLocal && (
                    <p style={{ margin: 0, fontSize: 12, color: TOKENS.text4, fontFamily: TOKENS.mono }}>
                      ollama serve · default http://localhost:11434
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 0,
                background: TOKENS.accent,
                color: '#0B0B0E',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(255,106,61,0.3)',
              }}
            >
              Save keys
            </button>
            {savedFlash && (
              <span style={{ fontSize: 13, color: TOKENS.green, display: 'flex', alignItems: 'center', gap: 5 }}>
                <I.Check size={13} /> {savedFlash}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProviderSettings;

/**
 * Helper: get the user's currently-selected provider + key combo.
 * Called from Dashboard, AIPrompt, etc.
 */
export function getActiveProvider(): { provider: string; apiKey?: string } {
  const provider = localStorage.getItem(LS_DEFAULT) || 'groq';
  const keys = loadKeys();
  return { provider, apiKey: keys[provider] || undefined };
}
