import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { fetchApps, deleteApp } from '../store/slices/appSlice';
import './Apps.scss';

const AppsList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { apps, loading } = useAppSelector((state) => state.apps);

  useEffect(() => {
    dispatch(fetchApps());
  }, [dispatch]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this app?')) {
      dispatch(deleteApp(id));
    }
  };

  if (loading) {
    return (
      <div className="apps-page">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="apps-page">
      <div className="apps-page__header">
        <h1>My Apps</h1>
        <Link to="/apps/create" className="btn btn--primary">
          ➕ Create New App
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="empty-state">
          <h2>No apps yet</h2>
          <p>Create your first app to get started with vibecoding!</p>
          <Link to="/apps/create" className="btn btn--primary">
            Create App
          </Link>
        </div>
      ) : (
        <div className="apps-grid">
          {apps.map((app) => (
            <div key={app._id} className="app-card">
              <div className="app-card__header">
                <h3>{app.name}</h3>
                <span className={`status-badge status-badge--${app.status}`}>
                  {app.status}
                </span>
              </div>
              <p className="app-card__description">
                {app.description || 'No description'}
              </p>
              <div className="app-card__meta">
                <span className="app-card__type">{app.type}</span>
                {app.integrations?.groq?.enabled && (
                  <span className="integration-badge">🔗 Groq</span>
                )}
              </div>
              <div className="app-card__footer">
                <Link to={`/apps/${app._id}`} className="btn btn--primary">
                  View Details
                </Link>
                <button
                  onClick={() => handleDelete(app._id)}
                  className="btn btn--danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppsList;

