import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApp, updateApp, testGroq } from '../store/slices/appSlice';
import './AppDetail.scss';

const AppDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentApp, loading } = useAppSelector((state) => state.apps);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      dispatch(fetchApp(id));
    }
  }, [id, dispatch]);

  const handleTestGroq = async () => {
    if (!id) return;
    setTestingGroq(true);
    setTestResult(null);
    try {
      const result = await dispatch(testGroq(id));
      if (testGroq.fulfilled.match(result)) {
        setTestResult('✅ Groq connection successful!');
      } else {
        setTestResult('❌ Failed to connect to Groq');
      }
    } catch (error) {
      setTestResult('❌ Error testing Groq connection');
    } finally {
      setTestingGroq(false);
    }
  };

  if (loading || !currentApp) {
    return (
      <div className="app-detail-page">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-detail-page">
      <div className="app-detail-header">
        <button onClick={() => navigate('/apps')} className="btn btn--secondary">
          ← Back to Apps
        </button>
        <h1>{currentApp.name}</h1>
        <div className="header-actions">
          <span className={`status-badge status-badge--${currentApp.status}`}>
            {currentApp.status}
          </span>
          {currentApp.generatedCode ? (
            <button
              onClick={() => navigate(`/apps/${currentApp._id}/builder`)}
              className="btn btn--primary"
            >
              🚀 Open Builder
            </button>
          ) : (
            <button
              onClick={() => navigate(`/apps/${currentApp._id}/builder`)}
              className="btn btn--primary"
            >
              🤖 Generate App
            </button>
          )}
        </div>
      </div>

      <div className="app-detail-content">
        <div className="app-detail-main">
          <div className="card">
            <div className="card__header">
              <h2>App Information</h2>
            </div>
            <div className="card__content">
              <div className="info-row">
                <span className="info-label">Description:</span>
                <span className="info-value">{currentApp.description || 'No description'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Type:</span>
                <span className="info-value">{currentApp.type}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">{currentApp.status}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Created:</span>
                <span className="info-value">
                  {new Date(currentApp.createdAt || '').toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <h2>Groq Integration</h2>
            </div>
            <div className="card__content">
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">
                  {currentApp.integrations?.groq?.enabled ? (
                    <span className="integration-status enabled">✅ Enabled</span>
                  ) : (
                    <span className="integration-status disabled">❌ Not Connected</span>
                  )}
                </span>
              </div>
              {currentApp.integrations?.groq?.enabled && (
                <>
                  <div className="info-row">
                    <span className="info-label">Connected:</span>
                    <span className="info-value">
                      {currentApp.integrations.groq.connectedAt
                        ? new Date(currentApp.integrations.groq.connectedAt).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Usage Count:</span>
                    <span className="info-value">
                      {currentApp.integrations.groq.usageCount || 0}
                    </span>
                  </div>
                </>
              )}
              <div className="card__actions">
                <button
                  onClick={handleTestGroq}
                  className="btn btn--primary"
                  disabled={testingGroq}
                >
                  {testingGroq ? 'Testing...' : 'Test Groq Connection'}
                </button>
              </div>
              {testResult && (
                <div className={`alert ${testResult.includes('✅') ? 'alert--success' : 'alert--error'}`}>
                  {testResult}
                </div>
              )}
            </div>
          </div>

          {currentApp.statistics && (
            <div className="card">
              <div className="card__header">
                <h2>Statistics</h2>
              </div>
              <div className="card__content">
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Views</span>
                    <span className="stat-value">{currentApp.statistics.views || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Interactions</span>
                    <span className="stat-value">{currentApp.statistics.interactions || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppDetail;

