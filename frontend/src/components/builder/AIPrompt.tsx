import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { generateApp, refineApp } from '../../store/slices/generationSlice';
import { fetchApp } from '../../store/slices/appSlice';
import { listProviders, streamGenerate, saveStreamResult, FileAction, StreamEvent } from '../../services/streamClient';
import { getActiveProvider } from '../../pages/ProviderSettings';
import './AIPrompt.scss';

interface AIPromptProps {
  appId?: string;
  app?: any;
}

type GeneratedFile = { path: string; content: string };

const AIPrompt: React.FC<AIPromptProps> = ({ appId, app }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { generating, error } = useAppSelector((state) => state.generation);

  const [prompt, setPrompt] = useState('');
  const [appType, setAppType] = useState('web');
  const [groqAPIKey, setGroqAPIKey] = useState('');
  const [refinementType, setRefinementType] = useState<'full' | 'component' | 'styling' | 'bug' | 'feature'>('full');
  const [targetComponent, setTargetComponent] = useState('');

  // Streaming mode state (new pipeline)
  const [streamMode, setStreamMode] = useState<boolean>(true);
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

  const isExistingApp = !!app?.generatedCode;
  const refineFromContext = useMemo(() => {
    if (!isExistingApp) return undefined;
    const files: any[] = [
      ...(app?.generatedCode?.frontend?.structure || []),
      ...(app?.generatedCode?.backend?.structure || []),
    ];
    return files
      .filter((f) => f?.path && typeof f.content === 'string')
      .slice(0, 40) // cap context
      .map((f) => `--- ${f.path}\n${f.content.slice(0, 2000)}`)
      .join('\n\n');
  }, [isExistingApp, app]);

  // ----- Legacy non-streaming path (kept for fallback / non-streaming providers) -----
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
          const next = idx >= 0 ? [...prev.slice(0, idx), { path: a.path, content: a.content }, ...prev.slice(idx + 1)] : [...prev, { path: a.path, content: a.content }];
          return next;
        });
        log(`+ ${a.path} (${a.content.length} chars)`);
      } else if (a.type === 'delete') log(`- ${a.path}`);
      else if (a.type === 'shell') {
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
        log(`done — model ${model || '?'}, tokens ${tokens ?? '?'}`);
      }
      else if (ev.type === 'error') {
        setStreamError(ev.message);
        log(`ERROR: ${ev.message}`);
      } else if (ev.type === 'complete') log('--- stream complete ---');
    };

    try {
      const { promise } = streamGenerate(
        {
          prompt: prompt.trim(),
          appType,
          provider: activeProvider,
          apiKey: activeKey,
          refineFrom: refineFromContext,
        },
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
        appId: appId,
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
        // Newly created — navigate into its builder.
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
    <div className="ai-prompt">
      <div className="ai-prompt-container">
        <div className="ai-prompt-header">
          <h2>{isExistingApp ? 'Refine Your App' : 'Generate Your App'}</h2>
          <p className="ai-prompt-subtitle">
            {isExistingApp
              ? 'Describe how you want to improve or modify your app'
              : "Describe your app idea and we'll generate a complete, tested, publishable app"}
          </p>
        </div>

        {error && !streamMode && <div className="alert alert--error">{error}</div>}
        {streamError && <div className="alert alert--error">Stream error: {streamError}</div>}

        <form onSubmit={onSubmit} className="ai-prompt-form">
          <div className="form-group">
            <label htmlFor="prompt" className="label">
              {isExistingApp ? 'Refinement Prompt' : 'App Description'} *
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="input prompt-textarea"
              rows={8}
              placeholder={
                isExistingApp
                  ? 'Example: Add a dark mode toggle, create a user profile page, add authentication...'
                  : 'Example: Create a todo app with user authentication, drag-and-drop reordering, and real-time sync.'
              }
              required
              disabled={busy}
            />
            <small className="form-help">
              Be specific about features, design preferences, and functionality.
            </small>
          </div>

          <div className="form-group" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={streamMode}
                onChange={(e) => setStreamMode(e.target.checked)}
                disabled={busy}
              />
              <span>Stream mode (single-pass, atomic file ops)</span>
            </label>

            {streamMode && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Provider</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  disabled={busy}
                  className="input"
                  style={{ minWidth: 180 }}
                >
                  {(allProviders.length ? allProviders : ['groq', 'openai', 'openrouter', 'anthropic', 'ollama']).map((p) => (
                    <option key={p} value={p}>
                      {p}
                      {availableProviders.includes(p) ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {isExistingApp && !streamMode && (
            <>
              <div className="form-group">
                <label htmlFor="refinementType" className="label">
                  Refinement Type
                </label>
                <select
                  id="refinementType"
                  value={refinementType}
                  onChange={(e) => setRefinementType(e.target.value as any)}
                  className="input"
                  disabled={busy}
                >
                  <option value="full">Full App Regeneration</option>
                  <option value="component">Update Specific Component</option>
                  <option value="styling">Update Styling</option>
                  <option value="bug">Fix Bug</option>
                  <option value="feature">Add Feature</option>
                </select>
              </div>
              {refinementType !== 'full' && (
                <div className="form-group">
                  <label htmlFor="targetComponent" className="label">
                    Target Component
                  </label>
                  <input
                    type="text"
                    id="targetComponent"
                    value={targetComponent}
                    onChange={(e) => setTargetComponent(e.target.value)}
                    className="input"
                    placeholder="e.g., Header, UserProfile, TodoList"
                    disabled={busy}
                  />
                </div>
              )}
            </>
          )}

          {!isExistingApp && (
            <>
              <div className="form-group">
                <label htmlFor="appType" className="label">App Type *</label>
                <select
                  id="appType"
                  value={appType}
                  onChange={(e) => setAppType(e.target.value)}
                  className="input"
                  required
                  disabled={busy}
                >
                  <option value="web">Web App</option>
                  <option value="mobile">Mobile App</option>
                  <option value="api">API</option>
                  <option value="integration">Integration</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="groqAPIKey" className="label">
                  Per-request API key (Optional)
                </label>
                <input
                  type="password"
                  id="groqAPIKey"
                  value={groqAPIKey}
                  onChange={(e) => setGroqAPIKey(e.target.value)}
                  className="input"
                  placeholder="Leave empty to use saved key / backend env"
                  disabled={busy}
                />
                <small className="form-help">
                  Overrides any key saved in <a href="/settings/providers">Provider Settings</a> for this request.
                </small>
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn--primary btn--large" disabled={busy || !prompt.trim()}>
              {busy ? (
                <>
                  <div className="spinner spinner--small"></div>
                  {streamMode ? 'Streaming…' : isExistingApp ? 'Refining…' : 'Generating…'}
                </>
              ) : streamMode ? (
                <>⚡ Stream Generate</>
              ) : isExistingApp ? (
                <>✨ Refine App</>
              ) : (
                <>🚀 Generate App</>
              )}
            </button>
          </div>
        </form>

        {streamMode && (streamedFiles.length > 0 || streamLog.length > 0) && (
          <div className="generation-history" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{artifactName ? `📦 ${artifactName}` : 'Streaming output'}</h3>
              {streamedFiles.length > 0 && !streamRunning && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleSaveStream}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : appId ? '💾 Save to this App' : '💾 Save as New App'}
                </button>
              )}
            </div>
            {savedAppId && (
              <div className="alert alert--success" style={{ marginBottom: 12 }}>
                Saved. App id: <code>{savedAppId}</code>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 13, opacity: 0.8 }}>Files ({streamedFiles.length})</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 320, overflow: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
                  {streamedFiles.map((f) => (
                    <li key={f.path} style={{ padding: '4px 0', borderBottom: '1px solid var(--border, #eee)' }}>
                      <code>{f.path}</code>
                      <span style={{ opacity: 0.6, marginLeft: 8 }}>{f.content.length} ch</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 13, opacity: 0.8 }}>Log</h4>
                <pre style={{ fontSize: 11, maxHeight: 320, overflow: 'auto', background: 'var(--bg-tertiary, #fafafa)', padding: 8, borderRadius: 6 }}>
                  {streamLog.join('\n')}
                </pre>
              </div>
            </div>
          </div>
        )}

        {isExistingApp && app?.generation?.iterations && app.generation.iterations.length > 0 && (
          <div className="generation-history">
            <h3>Generation History</h3>
            <div className="history-list">
              {app.generation.iterations.map((iteration: any, index: number) => (
                <div key={index} className="history-item">
                  <div className="history-item-header">
                    <span className="history-index">#{index + 1}</span>
                    <span className="history-date">{new Date(iteration.generatedAt).toLocaleString()}</span>
                  </div>
                  <p className="history-prompt">{iteration.prompt}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPrompt;
