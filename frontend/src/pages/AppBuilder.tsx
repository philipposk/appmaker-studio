import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApp } from '../store/slices/appSlice';
import VisualEditor from '../components/builder/VisualEditor';
import WorkflowEditor from '../components/builder/WorkflowEditor';
import CodeEditor from '../components/builder/CodeEditor';
import AIPrompt from '../components/builder/AIPrompt';
import TestRunner from '../components/builder/TestRunner';
import DeploymentPanel from '../components/builder/DeploymentPanel';
import LivePreview from '../components/builder/LivePreview';
import { TOKENS, I, Sidebar, Pill, IconProps } from '../design';

type Tab = 'preview' | 'code' | 'tests' | 'workflow' | 'visual' | 'deploy';

const TABS: { id: Tab; label: string; icon: React.FC<IconProps> }[] = [
  { id: 'preview', label: 'Preview', icon: I.Eye },
  { id: 'code', label: 'Code', icon: I.Code },
  { id: 'tests', label: 'Tests', icon: I.Beaker },
  { id: 'workflow', label: 'Workflow', icon: I.Stack },
  { id: 'visual', label: 'Visual', icon: I.Layout },
  { id: 'deploy', label: 'Deploy', icon: I.Rocket },
];

/**
 * Workspace — sidebar | chat (AIPrompt) | preview-area.
 *
 * The right pane is a tabbed surface that swaps between LivePreview,
 * CodeEditor, TestRunner, WorkflowEditor, VisualEditor and DeploymentPanel.
 */
const AppBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentApp, loading } = useAppSelector((s) => s.apps);
  const [tab, setTab] = useState<Tab>('preview');
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    if (id) dispatch(fetchApp(id));
  }, [id, dispatch]);

  if (loading || !currentApp) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          height: '100%',
          background: TOKENS.bg,
          color: TOKENS.text2,
        }}
      >
        <div>Loading…</div>
      </div>
    );
  }

  const hasCode = !!currentApp.generatedCode;
  const filesCount =
    (currentApp.generatedCode?.frontend?.structure?.length || 0) +
    (currentApp.generatedCode?.backend?.structure?.length || 0);
  const iterations = currentApp.generation?.iterations?.length || 0;

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
      <Sidebar active="projects" />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <WorkspaceHeader
          name={currentApp.name}
          status={currentApp.status}
          iterations={iterations}
          onBack={() => navigate('/apps')}
          onDeploy={() => setTab('deploy')}
        />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: AI chat (uses the streaming AIPrompt) */}
          <div
            style={{
              width: 420,
              flexShrink: 0,
              borderRight: `1px solid ${TOKENS.hairline}`,
              display: 'flex',
              flexDirection: 'column',
              background: TOKENS.bg,
              overflow: 'auto',
            }}
          >
            <AIPrompt appId={id} app={currentApp} />
          </div>

          {/* Right: preview / code / tests / workflow */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: TOKENS.panel, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '8px 12px',
                borderBottom: `1px solid ${TOKENS.hairline}`,
                background: TOKENS.bg,
              }}
            >
              {TABS.map((t) => {
                if (!hasCode && t.id !== 'preview' && t.id !== 'deploy') return null;
                const Ico = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '7px 12px',
                      borderRadius: 7,
                      border: 0,
                      cursor: 'pointer',
                      background: active ? TOKENS.panel2 : 'transparent',
                      color: active ? TOKENS.text1 : TOKENS.text2,
                      fontSize: 12.5,
                      fontWeight: 500,
                    }}
                  >
                    <Ico size={13} />
                    {t.label}
                    {t.id === 'tests' && filesCount > 0 && (
                      <span style={{ marginLeft: 6 }}>
                        <Pill kind="default" dot={false}>
                          {filesCount}
                        </Pill>
                      </span>
                    )}
                  </button>
                );
              })}

              <div style={{ flex: 1 }} />

              {tab === 'preview' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 2,
                    background: TOKENS.panel,
                    borderRadius: 7,
                    border: `1px solid ${TOKENS.hairline}`,
                  }}
                >
                  <ViewToggle Ico={I.Monitor} active={viewport === 'desktop'} onClick={() => setViewport('desktop')} />
                  <ViewToggle Ico={I.Phone} active={viewport === 'mobile'} onClick={() => setViewport('mobile')} />
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflow: 'auto', background: TOKENS.bg }}>
              {tab === 'preview' && (
                <div
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    padding: 24,
                    background: `radial-gradient(circle at 50% 0%, rgba(255,106,61,0.07), transparent 60%), ${TOKENS.bg}`,
                    minHeight: '100%',
                  }}
                >
                  <div
                    style={{
                      width: viewport === 'mobile' ? 390 : '100%',
                      maxWidth: viewport === 'mobile' ? 390 : 1080,
                      height: viewport === 'mobile' ? 720 : '70vh',
                      maxHeight: viewport === 'mobile' ? 720 : 720,
                      background: '#fff',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
                    }}
                  >
                    <LivePreview app={currentApp} />
                  </div>
                </div>
              )}
              {tab === 'code' && hasCode && <CodeEditor app={currentApp} />}
              {tab === 'tests' && hasCode && <TestRunner app={currentApp} />}
              {tab === 'workflow' && hasCode && <WorkflowEditor app={currentApp} />}
              {tab === 'visual' && hasCode && <VisualEditor app={currentApp} />}
              {tab === 'deploy' && <DeploymentPanel app={currentApp} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const WorkspaceHeader: React.FC<{
  name: string;
  status: string;
  iterations: number;
  onBack: () => void;
  onDeploy: () => void;
}> = ({ name, status, iterations, onBack, onDeploy }) => (
  <header
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '11px 18px',
      borderBottom: `1px solid ${TOKENS.hairline}`,
    }}
  >
    <button
      onClick={onBack}
      style={{
        background: 'transparent',
        border: 0,
        color: TOKENS.text3,
        cursor: 'pointer',
        display: 'inline-flex',
        gap: 4,
        alignItems: 'center',
        fontSize: 13,
      }}
    >
      ← Projects
    </button>
    <span style={{ color: TOKENS.text3 }}>/</span>
    <span style={{ color: TOKENS.text1, fontSize: 13, fontWeight: 500 }}>{name}</span>
    <Pill kind={status === 'active' ? 'live' : status === 'paused' ? 'building' : 'draft'}>
      {status}
    </Pill>

    <div style={{ flex: 1 }} />

    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: TOKENS.text3 }}>
      <I.Branch size={13} />
      <span className="am-mono">main</span>
      <span style={{ width: 1, height: 12, background: TOKENS.hairline2, margin: '0 4px' }} />
      <span>v{iterations} · saved</span>
    </div>

    <div style={{ display: 'flex', gap: 6 }}>
      <button
        style={{
          padding: '7px 12px',
          borderRadius: 7,
          border: `1px solid ${TOKENS.hairline2}`,
          background: TOKENS.panel,
          color: TOKENS.text1,
          fontSize: 12.5,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <I.Code size={13} />
        Download .zip
      </button>
      <button
        onClick={onDeploy}
        style={{
          padding: '7px 12px',
          borderRadius: 7,
          border: 0,
          background: TOKENS.accent,
          color: '#0B0B0E',
          fontSize: 12.5,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 4px 14px rgba(255,106,61,0.3)',
        }}
      >
        <I.Rocket size={13} />
        Deploy
      </button>
    </div>
  </header>
);

const ViewToggle: React.FC<{ Ico: React.FC<IconProps>; active: boolean; onClick: () => void }> = ({ Ico, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: 28,
      height: 24,
      borderRadius: 5,
      border: 0,
      cursor: 'pointer',
      background: active ? TOKENS.panel2 : 'transparent',
      color: active ? TOKENS.text1 : TOKENS.text3,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    <Ico size={13} />
  </button>
);

export default AppBuilder;
