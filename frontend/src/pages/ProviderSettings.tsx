import React, { useEffect, useState } from 'react';
import { listProviders } from '../services/streamClient';
import './ProviderSettings.scss';

/**
 * Provider settings page.
 *
 * Lets the user:
 *   - see which LLM providers the backend has keys for (available)
 *   - see which are registered in code but missing a key
 *   - store per-provider API keys in localStorage so they're sent with
 *     each /api/stream/generate request without ever being persisted
 *     server-side.
 *
 * Keys never touch the server's filesystem — they're just forwarded
 * as the `apiKey` field on the streaming POST body.
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
    help: 'Open-weights hosting (Llama, Qwen, DeepSeek).',
    getKeyUrl: 'https://api.together.xyz/settings/api-keys',
  },
  mistral: {
    label: 'Mistral La Plateforme',
    keyEnv: 'MISTRAL_API_KEY',
    help: 'Mistral Large / Codestral.',
    getKeyUrl: 'https://console.mistral.ai/api-keys/',
  },
  ollama: {
    label: 'Ollama (local)',
    keyEnv: '',
    help: 'Local models. No key — just `ollama serve` on this machine.',
    getKeyUrl: 'https://ollama.com/download',
  },
};

const LS_KEYS = 'appmaker.providerKeys';
const LS_DEFAULT = 'appmaker.defaultProvider';

function loadKeys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEYS) || '{}');
  } catch {
    return {};
  }
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
      .then((d) => {
        setAvailable(d.available || []);
        setAll(d.all || []);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const updateKey = (name: string, value: string) => {
    setKeys((prev) => ({ ...prev, [name]: value }));
  };
  const handleSave = () => {
    saveKeys(keys);
    localStorage.setItem(LS_DEFAULT, defaultProvider);
    setSavedFlash('Saved.');
    window.setTimeout(() => setSavedFlash(''), 1500);
  };
  const handleClear = (name: string) => {
    const next = { ...keys };
    delete next[name];
    setKeys(next);
    saveKeys(next);
  };

  return (
    <div className="provider-settings">
      <header className="provider-settings__header">
        <h1>LLM Providers</h1>
        <p>
          AppMaker can talk to any of these providers. Keys you enter here stay in your browser
          (<code>localStorage</code>) and are forwarded per-request — never written to disk on the
          backend.
        </p>
        {loadError && <div className="alert alert--error">Backend unreachable: {loadError}</div>}
      </header>

      <section className="provider-settings__default">
        <label>
          Default provider:
          <select
            value={defaultProvider}
            onChange={(e) => setDefaultProvider(e.target.value)}
          >
            {all.length === 0
              ? Object.keys(PROVIDER_INFO).map((p) => <option key={p} value={p}>{PROVIDER_INFO[p]?.label || p}</option>)
              : all.map((p) => <option key={p} value={p}>{PROVIDER_INFO[p]?.label || p}</option>)}
          </select>
        </label>
      </section>

      <div className="provider-settings__grid">
        {(all.length ? all : Object.keys(PROVIDER_INFO)).map((name) => {
          const info = PROVIDER_INFO[name] || { label: name, keyEnv: '', help: '', getKeyUrl: '' };
          const isLocal = name === 'ollama';
          const isAvail = available.includes(name);
          return (
            <div key={name} className={`provider-card ${isAvail ? 'is-available' : 'is-missing'}`}>
              <div className="provider-card__head">
                <h3>{info.label}</h3>
                <span className={`badge ${isAvail ? 'badge--ok' : 'badge--warn'}`}>
                  {isAvail ? 'Connected' : isLocal ? 'Local-only' : 'No key'}
                </span>
              </div>
              <p className="provider-card__help">{info.help}</p>
              {!isLocal && (
                <>
                  <label className="provider-card__label">
                    API key (browser-only)
                    <input
                      type="password"
                      value={keys[name] || ''}
                      onChange={(e) => updateKey(name, e.target.value)}
                      placeholder={info.keyEnv ? `defaults to env ${info.keyEnv}` : ''}
                      autoComplete="off"
                    />
                  </label>
                  <div className="provider-card__actions">
                    {info.getKeyUrl && (
                      <a href={info.getKeyUrl} target="_blank" rel="noreferrer noopener">
                        Get a key →
                      </a>
                    )}
                    {keys[name] && (
                      <button type="button" className="btn btn--small" onClick={() => handleClear(name)}>
                        Clear
                      </button>
                    )}
                  </div>
                </>
              )}
              {isLocal && (
                <p className="provider-card__help">
                  Start Ollama with <code>ollama serve</code>. Backend talks to it on{' '}
                  <code>OLLAMA_BASE_URL</code> (default <code>http://localhost:11434</code>).
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="provider-settings__footer">
        <button type="button" className="btn btn--primary" onClick={handleSave}>
          Save
        </button>
        {savedFlash && <span className="flash">{savedFlash}</span>}
      </div>
    </div>
  );
};

export default ProviderSettings;

/**
 * Helper for other components: get the user's currently-selected
 * provider + key combo to send with a generate request.
 */
export function getActiveProvider(): { provider: string; apiKey?: string } {
  const provider = localStorage.getItem(LS_DEFAULT) || 'groq';
  const keys = loadKeys();
  return { provider, apiKey: keys[provider] || undefined };
}
