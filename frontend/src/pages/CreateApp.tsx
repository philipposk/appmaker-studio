import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../utils/hooks';
import { createApp } from '../store/slices/appSlice';
import TemplateSelector from '../components/builder/TemplateSelector';
import './AppForm.scss';

const CreateApp: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((state) => state.apps);
  const { user } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'web' as 'web' | 'mobile' | 'api' | 'integration',
  });
  const [useTemplate, setUseTemplate] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const appData: any = {
      name: formData.name,
      description: formData.description,
      type: formData.type,
      status: 'draft',
    };

    const result = await dispatch(createApp(appData));
    if (createApp.fulfilled.match(result)) {
      navigate(`/apps/${result.payload._id}/builder`);
    }
  };

  if (useTemplate) {
    return (
      <div className="app-form-page">
        <div className="template-mode">
          <button
            onClick={() => setUseTemplate(false)}
            className="btn btn--secondary"
            style={{ marginBottom: '1rem' }}
          >
            ← Back to Manual Creation
          </button>
          <TemplateSelector />
        </div>
      </div>
    );
  }

  return (
    <div className="app-form-page">
      <div className="app-form-container">
        <div className="form-header">
          <h1>Create New App</h1>
          <button
            onClick={() => setUseTemplate(true)}
            className="btn btn--primary"
          >
            📚 Browse Templates
          </button>
        </div>
        <p className="form-subtitle">
          Create a new app and start vibecoding. You can create up to {user?.subscription?.maxApps || 3} apps on your current plan.
        </p>

        {error && (
          <div className="alert alert--error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="app-form">
          <div className="form-group">
            <label htmlFor="name" className="label">
              App Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input"
              required
              disabled={loading}
              placeholder="My Awesome App"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input"
              rows={4}
              disabled={loading}
              placeholder="Describe your app..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="type" className="label">
              App Type *
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="input"
              required
              disabled={loading}
            >
              <option value="web">Web App</option>
              <option value="mobile">Mobile App</option>
              <option value="api">API</option>
              <option value="integration">Integration</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create App'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/apps')}
              className="btn btn--secondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateApp;

