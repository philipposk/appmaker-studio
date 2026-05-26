import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApps } from '../store/slices/appSlice';
import './Dashboard.scss';

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { apps, loading } = useAppSelector((state) => state.apps);

  useEffect(() => {
    dispatch(fetchApps());
  }, [dispatch]);

  const activeApps = apps.filter(app => app.status === 'active').length;
  const draftApps = apps.filter(app => app.status === 'draft').length;

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1>Welcome back, {user?.username || 'Vibecoder'}! 👋</h1>
        <p className="dashboard__subtitle">Manage and create your apps with ease</p>
      </div>

      <div className="dashboard__stats">
        <div className="stat-card">
          <div className="stat-card__icon">📱</div>
          <div className="stat-card__content">
            <h3>{apps.length}</h3>
            <p>Total Apps</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">✅</div>
          <div className="stat-card__content">
            <h3>{activeApps}</h3>
            <p>Active Apps</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">📝</div>
          <div className="stat-card__content">
            <h3>{draftApps}</h3>
            <p>Draft Apps</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">⚡</div>
          <div className="stat-card__content">
            <h3>{user?.subscription?.maxApps || 0}</h3>
            <p>App Limit</p>
          </div>
        </div>
      </div>

      <div className="dashboard__actions">
        <Link to="/apps/create" className="btn btn--primary btn--large">
          ➕ Create New App
        </Link>
        <Link to="/apps" className="btn btn--secondary btn--large">
          View All Apps
        </Link>
      </div>

      <div className="dashboard__prompt">
        <h2>Quick Generate</h2>
        <p>Describe your app idea and get a complete, tested app in seconds!</p>
        <Link to="/apps/create" className="btn btn--primary">
          🤖 Start Vibecoding
        </Link>
      </div>

      {loading ? (
        <div className="dashboard__loading">
          <div className="spinner"></div>
        </div>
      ) : apps.length > 0 ? (
        <div className="dashboard__recent">
          <h2>Recent Apps</h2>
          <div className="apps-grid">
            {apps.slice(0, 6).map((app) => (
              <Link key={app._id} to={`/apps/${app._id}`} className="app-card">
                <div className="app-card__header">
                  <h3>{app.name}</h3>
                  <span className={`status-badge status-badge--${app.status}`}>
                    {app.status}
                  </span>
                </div>
                <p className="app-card__description">
                  {app.description || 'No description'}
                </p>
                <div className="app-card__footer">
                  <span className="app-card__type">{app.type}</span>
                  {app.integrations?.groq?.enabled && (
                    <span className="integration-badge">🔗 Groq</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="dashboard__empty">
          <div className="empty-state">
            <h2>No apps yet</h2>
            <p>Get started by creating your first app!</p>
            <Link to="/apps/create" className="btn btn--primary">
              Create Your First App
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

