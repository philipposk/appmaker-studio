import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { generateApp, refineApp } from '../../store/slices/generationSlice';
import { fetchApp } from '../../store/slices/appSlice';
import { listProviders, streamGenerate, saveStreamResult, FileAction, StreamEvent } from '../../services/streamClient';
import { getActiveProvider } from '../../pages/ProviderSettings';
import { TOKENS, I } from '../../design';

interface AIPromptProps {
  appId?: string;
  app?: any;
}

type GeneratedFile = { path: string; content: string };

/**
 * AI chat panel — left column of the builder workspace.
 * Handles both the legacy non-streaming path and the new SSE streaming path.
 * All keys stay in localStorage; never sent to or persisted by the backend.
 */
const AIPrompt: React.FC<AIPromptProps> = ({ appId, app }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { generating, error } = useAppSelector((state) => state.generation);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [prompt, setPrompt] = useState('');
  const [appType, setAppType] = useState('web');
  const [groqAPIKey, setGroqAPIKey] = useState('');
  const [refinementType, setRefinementType] = useState<'full' | 'component' | 'styling' | 'bug' | 'feature'>('full');
  const [targetComponent, setTargetComponent] = useState('');

  // Streaming mode state
  // Streaming via the Edge Function is the only working path; the legacy
  // non-stream backend was removed. Kept as a const so the legacy branches
  // below compile but are never reached (no user-facing dead toggle).
  const streamMode = true;
  const [provider, setProvider] = useState<string>(getActiveProvider().provider);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [allProviders, setAllProviders] = useState<string[]>([]);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [streamedFiles, setStreamedFiles] = useState<GeneratedFile[]>([]);
  const [shellCommands, setShellCommands] = useState<string[]>([]);
  const [artifactName, setArtifactName] = useState<string>('');
  const [streamRunning, setStreamRunning] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string>('');
  const [streamModel, setStreamModel] = useState<string>('');
  const [tokensUsed, setTokensUsed] = useState<number | undefined>(undefined);
  const [streamStartedAt, setStreamStartedAt] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedAppId, setSavedAppId] = useState<string>('');

  useEffect(() => {
    listProviders()
      .then((d) => {
        setAvailableProviders(d.available || []);
        setAllProviders(d.all || []);
      })
      .catch(() => {});
  }, []);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLog]);

  const isExistingApp = !!app?.generatedCode;
  const refineFromContext = useMemo(() => {
    if (!isExistingApp) return undefined;
    const files: any[] = [
      ...(app?.generatedCode?.frontend?.structure || []),
      ...(app?.generatedCode?.backend?.structure || []),
    ];
    return files
      .filter((f) => f?.path && typeof f.content === 'string')
      .slice(0, 40)
      .map((f) => `--- ${f.path}\n${f.content.slice(0, 2000)}`)
      .join('\n\n');
  }, [isExistingApp, app]);

  // ----- Legacy non-streaming path -----
  const handleLegacyGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    const result = await dispatch(generateApp({ prompt: prompt.trim(), appType, groqAPIKey: groqAPIKey || undefined }));
    if (generateApp.fulfilled.match(result)) navigate(`/apps/${result.payload.app._id}/builder`);
  };

  const handleLegacyRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !appId) return;
    const result = await dispatch(
      refineApp({
        id: appId,
        prompt: prompt.trim(),
        targetType: refinementType !== 'full' ? refinementType : undefined,
        targetComponent: refinementType !== 'full' && targetComponent ? targetComponent : undefined,
      }),
    );
    if (refineApp.fulfilled.match(result)) {
      dispatch(fetchApp(appId));
      setPrompt('');
    }
  };

  // ----- New SSE streaming path -----
  const handleStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || streamRunning) return;
    setStreamLog([]);
    setStreamedFiles([]);
    setShellCommands([]);
    setArtifactName('');
    setStreamError('');
    setStreamModel('');
    setTokensUsed(undefined);
    setSavedAppId('');
    setStreamRunning(true);
    setStreamStartedAt(Date.now());

    const { provider: defaultProv, apiKey: storedKey } = getActiveProvider();
    const activeProvider = provider || defaultProv;
    const activeKey = groqAPIKey || storedKey;

    const log = (s: string) => setStreamLog((prev) => (prev.length > 800 ? [...prev.slice(-800), s] : [...prev, s]));

    const onAction = (a: FileAction) => {
      if (a.type === 'artifact') setArtifactName(a.name);
      else if (a.type === 'file') {
        setStreamedFiles((prev) => {
          const idx = prev.findIndex((f) => f.path === a.path);
          const next =
            idx >= 0
              ? [...prev.slice(0, idx), { path: a.path, content: a.content }, ...prev.slice(idx + 1)]
              : [...prev, { path: a.path, content: a.content }];
          return next;
        });
        log(`+ ${a.path} (${a.content.length} chars)`);
      } else if (a.type === 'delete') {
        log(`- ${a.path}`);
      } else if (a.type === 'shell') {
        log(`$ ${a.cmd}`);
        setShellCommands((prev) => [...prev, a.cmd]);
      }
    };

    const onEvent = (ev: StreamEvent) => {
      if (ev.type === 'action') onAction(ev.action);
      else if (ev.type === 'done') {
        const model = (ev as any).model || '';
        const tokens = (ev as any).usage?.total_tokens;
        if (model) setStreamModel(model);
        if (tokens) setTokensUsed(tokens);
        log(`✓ done — ${model || '?'} · ${tokens ?? '?'} tokens`);
      } else if (ev.type === 'error') {
        setStreamError(ev.message);
        log(`✗ ${ev.message}`);
      } else if (ev.type === 'complete') {
        log('─── stream complete ───');
      }
    };

    try {
      const { promise } = streamGenerate(
        { prompt: prompt.trim(), appType, provider: activeProvider, apiKey: activeKey, refineFrom: refineFromContext },
        onEvent,
      );
      await promise;
    } catch (err: any) {
      setStreamError(err?.message || String(err));
    } finally {
      setStreamRunning(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    if (streamMode) return handleStream(e);
    return isExistingApp ? handleLegacyRefine(e) : handleLegacyGenerate(e);
  };

  const handleSaveStream = async () => {
    if (!streamedFiles.length || saving) return;
    setSaving(true);
    try {
      const res = await saveStreamResult({
        appId,
        prompt: prompt.trim(),
        provider,
        model: streamModel,
        files: streamedFiles,
        shellCommands,
        streamLog: streamLog.join('\n'),
        tokensUsed,
        durationMs: streamStartedAt ? Date.now() - streamStartedAt : undefined,
        artifactName,
        appType,
      });
      setSavedAppId(res?.app?._id || '');
      if (!appId && res?.app?._id) {
        navigate(`/apps/${res.app._id}/builder`);
      } else if (appId) {
        dispatch(fetchApp(appId));
      }
    } catch (err: any) {
      setStreamError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const busy = generating || streamRunning;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: TOKENS.bg,
        fontFamily: TOKENS.sans,
        color: TOKENS.text1,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: `1px solid ${TOKENS.hairline}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.Sparkle size={15} style={{ color: TOKENS.accent }} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>
              {isExistingApp ? 'Refine' : 'Generate'}
            </span>
          </div>
        </div>

        {streamMode && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: TOKENS.text3 }}>Provider</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={busy}
              style={{
                flex: 1,
                background: TOKENS.panel2,
                border: `1px solid ${TOKENS.hairline2}`,
                borderRadius: 6,
                color: TOKENS.text1,
                fontSize: 12,
                padding: '4px 8px',
                fontFamily: TOKENS.sans,
              }}
            >
              {(allProviders.length ? allProviders : ['groq', 'openai', 'openrouter', 'anthropic', 'ollama']).map((p) => (
                <option key={p} value={p}>
                  {p}{availableProviders.includes(p) ? ' ✓' : ''}
                </option>
              ))}
            </select>
            {streamModel && (
              <span style={{ fontSize: 11, color: TOKENS.text4, fontFamily: TOKENS.mono, whiteSpace: 'nowrap' }}>
                {tokensUsed ? `${tokensUsed} tok` : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stream output */}
      {streamMode && (streamedFiles.length > 0 || streamLog.length > 0) && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Artifact name + save */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <I.Cube size={13} style={{ color: TOKENS.accent }} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: TOKENS.text1 }}>
                {artifactName || 'Streaming…'}
              </span>
              {streamRunning && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: TOKENS.accent,
                    animation: 'am-caret 1s step-end infinite',
                  }}
                />
              )}
            </div>
            {streamedFiles.length > 0 && !streamRunning && (
              <button
                type="button"
                onClick={handleSaveStream}
                disabled={saving}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 0,
                  background: TOKENS.accent,
                  color: '#0B0B0E',
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <I.Check size={12} />
                {saving ? 'Saving…' : appId ? 'Save to App' : 'Save as App'}
              </button>
            )}
          </div>

          {savedAppId && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 7,
                background: 'rgba(74,222,128,0.1)',
                border: `1px solid rgba(74,222,128,0.25)`,
                color: TOKENS.green,
                fontSize: 12,
                fontFamily: TOKENS.mono,
              }}
            >
              ✓ Saved · {savedAppId}
            </div>
          )}

          {/* Files */}
          {streamedFiles.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: TOKENS.text4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}
              >
                Files ({streamedFiles.length})
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {streamedFiles.map((f) => (
                  <li
                    key={f.path}
                    style={{
                      padding: '4px 0',
                      borderBottom: `1px solid ${TOKENS.hairline}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ fontFamily: TOKENS.mono, fontSize: 11, color: TOKENS.text2 }}>
                      {f.path}
                    </span>
                    <span style={{ fontFamily: TOKENS.mono, fontSize: 10, color: TOKENS.text4, marginLeft: 8, flexShrink: 0 }}>
                      {f.content.length} ch
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Log */}
          {streamLog.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: TOKENS.text4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}
              >
                Log
              </div>
              <pre
                style={{
                  fontFamily: TOKENS.mono,
                  fontSize: 10.5,
                  color: TOKENS.text2,
                  background: TOKENS.panel,
                  border: `1px solid ${TOKENS.hairline}`,
                  padding: '8px 10px',
                  borderRadius: 7,
                  maxHeight: 260,
                  overflow: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {streamLog.join('\n')}
                <div ref={logEndRef} />
              </pre>
            </div>
          )}

          {streamError && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 7,
                background: 'rgba(255,142,114,0.1)',
                border: '1px solid rgba(255,142,114,0.25)',
                color: '#FF8E72',
                fontSize: 11.5,
              }}
            >
              {streamError}
            </div>
          )}
        </div>
      )}

      {/* Generation history (existing apps, no active stream) */}
      {isExistingApp && !streamRunning && streamedFiles.length === 0 && app?.generation?.iterations?.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          <div
            style={{
              fontSize: 10.5,
              color: TOKENS.text4,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            History
          </div>
          {app.generation.iterations.map((it: any, i: number) => (
            <div
              key={i}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.hairline}`,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                  fontSize: 11,
                  color: TOKENS.text4,
                  fontFamily: TOKENS.mono,
                }}
              >
                <span>#{i + 1}</span>
                <span>{new Date(it.generatedAt).toLocaleString()}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: TOKENS.text2, lineHeight: 1.45 }}>{it.prompt}</p>
            </div>
          ))}
        </div>
      )}

      {/* Spacer when nothing to show */}
      {!(streamedFiles.length > 0 || streamLog.length > 0) &&
        !(isExistingApp && app?.generation?.iterations?.length > 0) && (
          <div style={{ flex: 1 }} />
        )}

      {/* Legacy error */}
      {error && !streamMode && (
        <div
          style={{
            margin: '0 16px 8px',
            padding: '8px 10px',
            borderRadius: 7,
            background: 'rgba(255,142,114,0.1)',
            border: '1px solid rgba(255,142,114,0.25)',
            color: '#FF8E72',
            fontSize: 11.5,
          }}
        >
          {error}
        </div>
      )}

      {/* Optional extras for non-stream / existing app */}
      {isExistingApp && !streamMode && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <SelectField
            label="Refinement type"
            value={refinementType}
            onChange={(v) => setRefinementType(v as any)}
            options={[
              { value: 'full', label: 'Full regeneration' },
              { value: 'component', label: 'Update component' },
              { value: 'styling', label: 'Update styling' },
              { value: 'bug', label: 'Fix bug' },
              { value: 'feature', label: 'Add feature' },
            ]}
            disabled={busy}
          />
          {refinementType !== 'full' && (
            <TextInput
              label="Target component"
              value={targetComponent}
              onChange={setTargetComponent}
              placeholder="e.g., Header, UserProfile"
              disabled={busy}
            />
          )}
        </div>
      )}

      {!isExistingApp && !streamMode && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <SelectField
            label="App type"
            value={appType}
            onChange={setAppType}
            options={[
              { value: 'web', label: 'Web App' },
              { value: 'mobile', label: 'Mobile App' },
              { value: 'api', label: 'API' },
              { value: 'integration', label: 'Integration' },
            ]}
            disabled={busy}
          />
          <TextInput
            label="API key override (optional)"
            value={groqAPIKey}
            onChange={setGroqAPIKey}
            placeholder="Leave empty to use saved key"
            type="password"
            disabled={busy}
          />
        </div>
      )}

      {/* Prompt input */}
      <form
        onSubmit={onSubmit}
        style={{
          flexShrink: 0,
          padding: '12px 16px 14px',
          borderTop: `1px solid ${TOKENS.hairline}`,
          background: TOKENS.bg,
        }}
      >
        <div
          style={{
            background: TOKENS.panel,
            border: `1px solid ${TOKENS.hairline2}`,
            borderRadius: 12,
            padding: 4,
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                onSubmit(e as any);
              }
            }}
            placeholder={
              isExistingApp
                ? 'Describe a change — add dark mode, fix the auth flow, add a new page…'
                : 'Describe the app you want to build…'
            }
            rows={3}
            disabled={busy}
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              outline: 0,
              resize: 'none',
              fontSize: 13.5,
              color: TOKENS.text1,
              fontFamily: TOKENS.sans,
              lineHeight: 1.55,
              padding: '8px 10px 4px',
              minHeight: 72,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 6px',
              borderTop: `1px solid ${TOKENS.hairline}`,
            }}
          >
            <span style={{ flex: 1, fontSize: 11, color: TOKENS.text4, fontFamily: TOKENS.mono }}>⌘↵</span>
            <button
              type="submit"
              disabled={busy || !prompt.trim()}
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                border: 0,
                cursor: busy || !prompt.trim() ? 'not-allowed' : 'pointer',
                opacity: busy || !prompt.trim() ? 0.45 : 1,
                background: TOKENS.accent,
                color: '#0B0B0E',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 3px 10px rgba(20,184,166,0.35)',
              }}
            >
              {busy ? (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    border: '2px solid rgba(0,0,0,0.3)',
                    borderTopColor: '#0B0B0E',
                    borderRadius: 99,
                    display: 'block',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
              ) : (
                <I.ArrowUp size={14} stroke={2.4} />
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

/* ── tiny local helpers ────────────────────────────────────── */

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}> = ({ label, value, onChange, options, disabled }) => (
  <div>
    <div style={{ fontSize: 11, color: TOKENS.text4, marginBottom: 4 }}>{label}</div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%',
        background: TOKENS.panel2,
        border: `1px solid ${TOKENS.hairline2}`,
        borderRadius: 7,
        color: TOKENS.text1,
        fontSize: 12.5,
        padding: '6px 8px',
        fontFamily: TOKENS.sans,
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', disabled }) => (
  <div>
    <div style={{ fontSize: 11, color: TOKENS.text4, marginBottom: 4 }}>{label}</div>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%',
        background: TOKENS.panel2,
        border: `1px solid ${TOKENS.hairline2}`,
        borderRadius: 7,
        color: TOKENS.text1,
        fontSize: 12.5,
        padding: '6px 8px',
        fontFamily: TOKENS.sans,
        outline: 0,
        boxSizing: 'border-box',
      }}
    />
  </div>
);

export default AIPrompt;
