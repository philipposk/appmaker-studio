import React, { useState, useEffect } from 'react';
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
import './AppBuilder.scss';

const AppBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentApp, loading } = useAppSelector((state) => state.apps);
  const [activeTab, setActiveTab] = useState<'visual' | 'workflow' | 'code' | 'prompt' | 'tests' | 'deploy' | 'preview'>('prompt');

  useEffect(() => {
    if (id) {
      dispatch(fetchApp(id));
    }
  }, [id, dispatch]);

  if (loading || !currentApp) {
    return (
      <div className="app-builder-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-builder">
      <div className="app-builder-header">
        <button onClick={() => navigate('/apps')} className="btn btn--secondary">
          ← Back to Apps
        </button>
        <h1>{currentApp.name}</h1>
        <div className="app-builder-actions">
          {currentApp.generatedCode && (
            <button className="btn btn--primary" onClick={() => setActiveTab('deploy')}>
              🚀 Deploy
            </button>
          )}
        </div>
      </div>

      <div className="app-builder-tabs">
        <button
          className={`tab ${activeTab === 'prompt' ? 'active' : ''}`}
          onClick={() => setActiveTab('prompt')}
        >
          🤖 AI Prompt
        </button>
        {currentApp.generatedCode && (
          <>
            <button
              className={`tab ${activeTab === 'visual' ? 'active' : ''}`}
              onClick={() => setActiveTab('visual')}
            >
              🎨 Visual Editor
            </button>
            <button
              className={`tab ${activeTab === 'workflow' ? 'active' : ''}`}
              onClick={() => setActiveTab('workflow')}
            >
              🔄 Workflow
            </button>
            <button
              className={`tab ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              💻 Code Editor
            </button>
            <button
              className={`tab ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              ✅ Tests
            </button>
            <button
              className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              👁️ Preview
            </button>
          </>
        )}
        <button
          className={`tab ${activeTab === 'deploy' ? 'active' : ''}`}
          onClick={() => setActiveTab('deploy')}
        >
          🚀 Deploy
        </button>
      </div>

      <div className="app-builder-content">
        {activeTab === 'prompt' && <AIPrompt appId={id!} app={currentApp} />}
        {activeTab === 'visual' && currentApp.generatedCode && (
          <VisualEditor app={currentApp} />
        )}
        {activeTab === 'workflow' && currentApp.generatedCode && (
          <WorkflowEditor app={currentApp} />
        )}
        {activeTab === 'code' && currentApp.generatedCode && (
          <CodeEditor app={currentApp} />
        )}
        {activeTab === 'tests' && currentApp.generatedCode && (
          <TestRunner app={currentApp} />
        )}
        {activeTab === 'preview' && currentApp.generatedCode && (
          <LivePreview app={currentApp} />
        )}
        {activeTab === 'deploy' && (
          <DeploymentPanel app={currentApp} />
        )}
      </div>
    </div>
  );
};

export default AppBuilder;

