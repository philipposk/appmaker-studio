import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApps } from '../store/slices/appSlice';
import { TOKENS, I, Sidebar, Pill, IconProps } from '../design';
import { streamGenerate, saveStreamResult, FileAction, StreamEvent } from '../services/streamClient';
import { getActiveProvider } from './ProviderSettings';

/**
 * Home / Dashboard — "What should we build today?" hero with prompt
 * input, stack / db / auth selectors, prebuilt chips, and a recent-
 * projects strip.
 *
 * Wires the prompt into the streaming generator (POST /api/stream/generate)
 * and persists the result via POST /api/apps/save-stream on completion,
 * then navigates into the new builder.
 */

const STACKS = [
  { name: 'React', dot: TOKENS.blue, active: true },
  { name: 'Next.js', dot: TOKENS.text2 },
  { name: 'SvelteKit', dot: TOKENS.text2 },
];
const DBS = [
  { name: 'MongoDB', dot: TOKENS.green, active: true },
  { name: 'Postgres', dot: TOKENS.text2 },
  { name: 'SQLite', dot: TOKENS.text2 },
];
const AUTH = [
  { name: 'Auth: Email', dot: TOKENS.green, active: true },
  { name: 'Auth: OAuth', dot: TOKENS.text2 },
];

const CHIPS = [
  { i: I.Stack, t: 'Marketplace with Stripe' },
  { i: I.Chat, t: 'Real-time team chat' },
  { i: I.Database, t: 'Internal admin tool' },
  { i: I.Layout, t: 'Landing + waitlist' },
  { i: I.Cube, t: 'Inventory tracker' },
];

type Status = 'live' | 'building' | 'draft';
const STATUS_BY_APP_STATUS: Record<string, Status> = {
  active: 'live',
  paused: 'building',
  draft: 'draft',
  archived: 'draft',
};

function pickAccent(i: number) {
  return ['#5BB3FF', TOKENS.accent, '#FB7185', '#4ADE80', '#F5B647'][i % 5];
}

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { apps } = useAppSelector((s) => s.apps);

  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [artifactName, setArtifactName] = useState('');
  const [streamModel, setStreamModel] = useState('');
  const [tokensUsed, setTokensUsed] = useState<number | undefined>();
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(fetchApps());
  }, [dispatch]);

  const recents = useMemo(() => (apps || []).slice(0, 3), [apps]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || running) return;
    setRunning(true);
    setFiles([]);
    setLog([]);
    setArtifactName('');
    setStreamModel('');
    setTokensUsed(undefined);
    setError('');

    const { provider, apiKey } = getActiveProvider();
    const started = Date.now();
    // Accumulators outside of React state so we can use the final values
    // after the stream completes without racing against batched setState.
    const accFiles: { path: string; content: string }[] = [];
    const accLog: string[] = [];
    let accArtifact = '';
    let accModel = '';
    let accTokens: number | undefined;

    const onAction = (a: FileAction) => {
      if (a.type === 'artifact') {
        accArtifact = a.name;
        setArtifactName(a.name);
      } else if (a.type === 'file') {
        const idx = accFiles.findIndex((f) => f.path === a.path);
        if (idx >= 0) accFiles[idx] = { path: a.path, content: a.content };
        else accFiles.push({ path: a.path, content: a.content });
        setFiles([...accFiles]);
        accLog.push(`+ ${a.path} (${a.content.length} ch)`);
        setLog([...accLog]);
      } else if (a.type === 'shell') {
        accLog.push(`$ ${a.cmd}`);
        setLog([...accLog]);
      } else if (a.type === 'delete') {
        accLog.push(`- ${a.path}`);
        setLog([...accLog]);
      }
    };

    const onEvent = (ev: StreamEvent) => {
      if (ev.type === 'action') onAction(ev.action);
      else if (ev.type === 'done') {
        accModel = (ev as any).model || '';
        accTokens = (ev as any).usage?.total_tokens;
        setStreamModel(accModel);
        setTokensUsed(accTokens);
        accLog.push(`done — ${accModel} / ${accTokens ?? '?'} tokens`);
        setLog([...accLog]);
      } else if (ev.type === 'error') {
        setError(ev.message);
        accLog.push(`ERROR: ${ev.message}`);
        setLog([...accLog]);
      }
    };

    try {
      const { promise } = streamGenerate(
        { prompt: prompt.trim(), appType: 'web', provider, apiKey },
        onEvent,
      );
      await promise;
    } catch (err: any) {
      setError(err?.message || String(err));
      setRunning(false);
      return;
    } finally {
      setRunning(false);
    }

    if (accFiles.length > 0) {
      try {
        const res = await saveStreamResult({
          prompt: prompt.trim(),
          provider,
          model: accModel,
          files: accFiles,
          streamLog: accLog.join('\n'),
          tokensUsed: accTokens,
          durationMs: Date.now() - started,
          artifactName: accArtifact,
          appType: 'web',
        });
        if (res?.app?._id) navigate(`/apps/${res.app._id}/builder`);
      } catch (err: any) {
        setError(err?.message || String(err));
      }
    }
  };

  return (
    <div
      className="am-root"
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: TOKENS.bg,
        color: TOKENS.text1,
      }}
    >
      <Sidebar active="home" />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />

        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '56px 32px 40px' }}>
            <HeroIntro model={streamModel} />

            <form onSubmit={handleSubmit}>
              <PromptBox
                value={prompt}
                onChange={setPrompt}
                onSubmit={handleSubmit}
                running={running}
              />
            </form>

            <ChipRow chips={CHIPS} onChipClick={(t) => setPrompt(t)} />

            {(files.length > 0 || log.length > 0 || error) && (
              <StreamPanel
                artifactName={artifactName}
                files={files}
                log={log}
                error={error}
                tokensUsed={tokensUsed}
                streamModel={streamModel}
              />
            )}

            <RecentSection recents={recents} />

            <FigmaDropCallout />
          </div>
        </div>
      </main>
    </div>
  );
};

const TopBar: React.FC = () => (
  <header
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px',
      borderBottom: `1px solid ${TOKENS.hairline}`,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: TOKENS.text3, fontSize: 13 }}>
      <span style={{ color: TOKENS.text2 }}>Workspace</span>
      <span>/</span>
      <span style={{ color: TOKENS.text1 }}>Home</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <SearchBox />
      <IconBtn>
        <I.GitHub size={15} />
      </IconBtn>
      <button
        style={{
          padding: '7px 12px',
          borderRadius: 8,
          border: `1px solid ${TOKENS.hairline2}`,
          background: TOKENS.panel,
          color: TOKENS.text1,
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <I.Rocket size={14} /> Upgrade
      </button>
    </div>
  </header>
);

const HeroIntro: React.FC<{ model: string }> = ({ model }) => (
  <div style={{ textAlign: 'center', marginBottom: 28 }}>
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 4px 8px',
        borderRadius: 999,
        background: TOKENS.panel,
        border: `1px solid ${TOKENS.hairline2}`,
        fontSize: 11.5,
        color: TOKENS.text2,
        marginBottom: 18,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: TOKENS.green }} />
      Generating with{' '}
      <span className="am-mono" style={{ color: TOKENS.text1 }}>
        {model || 'llama-3.3-70b'}
      </span>
    </div>
    <h1
      style={{
        margin: 0,
        fontSize: 40,
        fontWeight: 600,
        letterSpacing: '-0.025em',
        color: TOKENS.text1,
        lineHeight: 1.1,
      }}
    >
      What should we build today?
    </h1>
    <p style={{ margin: '12px 0 0', color: TOKENS.text2, fontSize: 15.5 }}>
      Describe an app. We&apos;ll generate the frontend, backend, tests and deploy it.
    </p>
  </div>
);

const PromptBox: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  running: boolean;
}> = ({ value, onChange, onSubmit, running }) => (
  <div
    style={{
      background: TOKENS.panel,
      border: `1px solid ${TOKENS.hairline2}`,
      borderRadius: 16,
      padding: 4,
      boxShadow: '0 0 0 6px rgba(20,184,166,0.04), 0 24px 60px -20px rgba(0,0,0,0.6)',
    }}
  >
    <div style={{ padding: '14px 16px 6px' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="A todo app with user auth, drag-and-drop reordering, a calendar view, search, and dark mode."
        rows={3}
        style={{
          width: '100%',
          background: 'transparent',
          border: 0,
          outline: 0,
          resize: 'vertical',
          fontSize: 15,
          color: TOKENS.text1,
          fontFamily: 'inherit',
          lineHeight: 1.6,
          minHeight: 92,
        }}
      />
    </div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        borderTop: `1px solid ${TOKENS.hairline}`,
      }}
    >
      <Selector icon={I.Code} items={STACKS} />
      <Selector icon={I.Database} items={DBS} />
      <Selector icon={I.Lock} items={AUTH} />
      <IconBtn>
        <I.Paperclip size={14} />
      </IconBtn>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, color: TOKENS.text4, fontFamily: TOKENS.mono }}>⌘↵</span>
      <button
        type="submit"
        disabled={running || !value.trim()}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: 0,
          cursor: running || !value.trim() ? 'not-allowed' : 'pointer',
          opacity: running || !value.trim() ? 0.55 : 1,
          background: TOKENS.accent,
          color: '#0B0B0E',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 4px 14px rgba(20,184,166,0.4)',
        }}
      >
        <I.ArrowUp size={16} stroke={2.4} />
      </button>
    </div>
  </div>
);

const ChipRow: React.FC<{
  chips: typeof CHIPS;
  onChipClick: (text: string) => void;
}> = ({ chips, onChipClick }) => (
  <div
    style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: 20,
    }}
  >
    {chips.map(({ i: Ico, t }) => (
      <button
        key={t}
        type="button"
        onClick={() => onChipClick(t)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 12px',
          borderRadius: 999,
          background: TOKENS.panel,
          border: `1px solid ${TOKENS.hairline}`,
          color: TOKENS.text2,
          fontSize: 12.5,
          cursor: 'pointer',
        }}
      >
        <Ico size={13} />
        {t}
      </button>
    ))}
  </div>
);

const StreamPanel: React.FC<{
  artifactName: string;
  files: { path: string; content: string }[];
  log: string[];
  error: string;
  tokensUsed?: number;
  streamModel: string;
}> = ({ artifactName, files, log, error, tokensUsed, streamModel }) => (
  <div
    style={{
      marginTop: 36,
      padding: 16,
      background: TOKENS.panel,
      border: `1px solid ${TOKENS.hairline}`,
      borderRadius: 12,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <I.Sparkle size={14} style={{ color: TOKENS.accent }} />
      <span style={{ color: TOKENS.text1, fontSize: 13.5, fontWeight: 500 }}>
        {artifactName || 'Streaming…'}
      </span>
      {streamModel && (
        <span style={{ fontFamily: TOKENS.mono, fontSize: 11, color: TOKENS.text3 }}>
          {streamModel} · {tokensUsed ?? '…'} tokens
        </span>
      )}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            color: TOKENS.text4,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}
        >
          Files ({files.length})
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 220, overflow: 'auto', fontFamily: TOKENS.mono, fontSize: 11.5 }}>
          {files.map((f) => (
            <li
              key={f.path}
              style={{
                padding: '3px 0',
                borderBottom: `1px solid ${TOKENS.hairline}`,
                color: TOKENS.text2,
              }}
            >
              <span style={{ color: TOKENS.text1 }}>{f.path}</span>
              <span style={{ color: TOKENS.text4, marginLeft: 8 }}>{f.content.length} ch</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
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
            fontSize: 11,
            color: TOKENS.text2,
            background: TOKENS.bg,
            border: `1px solid ${TOKENS.hairline}`,
            padding: 8,
            borderRadius: 6,
            maxHeight: 220,
            overflow: 'auto',
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {log.join('\n')}
        </pre>
      </div>
    </div>
    {error && (
      <div style={{ marginTop: 10, color: '#FF8E72', fontSize: 12 }}>
        {error}
      </div>
    )}
  </div>
);

const RecentSection: React.FC<{ recents: any[] }> = ({ recents }) => {
  const navigate = useNavigate();
  return (
    <div style={{ marginTop: 56 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            color: TOKENS.text2,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Recent projects
        </h2>
        <button
          type="button"
          onClick={() => navigate('/apps')}
          style={{
            fontSize: 12.5,
            color: TOKENS.text2,
            background: 'transparent',
            border: 0,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          View all <I.Arrow size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {recents.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: 24,
              borderRadius: 12,
              background: TOKENS.panel,
              border: `1px dashed ${TOKENS.hairline2}`,
              color: TOKENS.text3,
              textAlign: 'center',
              fontSize: 13.5,
            }}
          >
            No projects yet. Run a prompt above to create your first one.
          </div>
        )}
        {recents.map((p: any, i: number) => (
          <RecentCard
            key={p._id}
            name={p.name}
            desc={p.description || 'No description'}
            status={STATUS_BY_APP_STATUS[p.status] || 'draft'}
            updated={new Date(p.updatedAt || p.createdAt || Date.now()).toLocaleString()}
            accent={pickAccent(i)}
            onClick={() => navigate(`/apps/${p._id}/builder`)}
          />
        ))}
      </div>
    </div>
  );
};

const FigmaDropCallout: React.FC = () => (
  <div
    style={{
      marginTop: 48,
      padding: '14px 18px',
      borderRadius: 12,
      background: TOKENS.panel,
      border: `1px dashed ${TOKENS.hairline2}`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      color: TOKENS.text2,
      fontSize: 13,
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: TOKENS.panel2,
        display: 'grid',
        placeItems: 'center',
        color: TOKENS.accent,
      }}
    >
      <I.Wand size={16} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ color: TOKENS.text1, fontSize: 13.5, fontWeight: 500 }}>
        Got a Figma file or screenshot?
      </div>
      <div>Drop it in and we&apos;ll match the design.</div>
    </div>
    <button
      style={{
        padding: '7px 12px',
        borderRadius: 7,
        border: `1px solid ${TOKENS.hairline2}`,
        background: 'transparent',
        color: TOKENS.text1,
        fontSize: 12.5,
        cursor: 'pointer',
      }}
    >
      Upload
    </button>
  </div>
);

const SearchBox: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      width: 220,
      background: TOKENS.panel,
      border: `1px solid ${TOKENS.hairline}`,
      borderRadius: 8,
      color: TOKENS.text3,
      fontSize: 13,
    }}
  >
    <I.Search size={14} />
    <span style={{ flex: 1 }}>Search projects…</span>
    <span className="am-mono" style={{ fontSize: 11, color: TOKENS.text4 }}>
      ⌘K
    </span>
  </div>
);

const IconBtn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <button
    style={{
      width: 32,
      height: 32,
      borderRadius: 8,
      border: `1px solid ${TOKENS.hairline}`,
      background: TOKENS.panel,
      color: TOKENS.text2,
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
    }}
  >
    {children}
  </button>
);

const Selector: React.FC<{
  icon: React.FC<IconProps>;
  items: { name: string; dot: string; active?: boolean }[];
}> = ({ icon: Ico, items }) => {
  const active = items.find((x) => x.active) || items[0];
  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 10px 6px 8px',
        borderRadius: 7,
        background: 'transparent',
        border: `1px solid ${TOKENS.hairline}`,
        color: TOKENS.text1,
        fontSize: 12.5,
        cursor: 'pointer',
      }}
    >
      <Ico size={13} style={{ color: TOKENS.text3 }} />
      <span style={{ width: 6, height: 6, borderRadius: 99, background: active.dot }} />
      {active.name}
    </button>
  );
};

const RecentCard: React.FC<{
  name: string;
  desc: string;
  status: Status;
  updated: string;
  accent: string;
  onClick: () => void;
}> = ({ name, desc, status, updated, accent, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: TOKENS.panel,
      border: `1px solid ${TOKENS.hairline}`,
      borderRadius: 12,
      padding: 14,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        height: 84,
        borderRadius: 8,
        background: TOKENS.bg,
        border: `1px solid ${TOKENS.hairline}`,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: 99, background: '#FF5F57' }} />
        <span style={{ width: 5, height: 5, borderRadius: 99, background: '#FEBC2E' }} />
        <span style={{ width: 5, height: 5, borderRadius: 99, background: '#28C840' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
        <div style={{ width: 26, background: TOKENS.panel2, borderRadius: 3 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ height: 6, background: accent, borderRadius: 2, width: '40%' }} />
          <div style={{ height: 4, background: TOKENS.panel3, borderRadius: 2, width: '80%' }} />
          <div style={{ height: 4, background: TOKENS.panel3, borderRadius: 2, width: '65%' }} />
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ height: 10, background: TOKENS.panel3, borderRadius: 2, flex: 1 }} />
            <div style={{ height: 10, background: TOKENS.panel3, borderRadius: 2, flex: 1 }} />
          </div>
        </div>
      </div>
    </div>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: TOKENS.text1, fontSize: 13.5, fontWeight: 500 }}>{name}</span>
        <Pill kind={status}>{status}</Pill>
      </div>
      <div style={{ color: TOKENS.text3, fontSize: 12.5, lineHeight: 1.45 }}>{desc}</div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: TOKENS.text4, fontFamily: TOKENS.mono }}>
        Updated {updated}
      </div>
    </div>
  </div>
);

export default Dashboard;
