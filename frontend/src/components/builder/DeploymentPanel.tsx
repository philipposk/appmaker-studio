import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { downloadApp } from '../../store/slices/generationSlice';
import { fetchApp } from '../../store/slices/appSlice';
import api from '../../services/api';
import './DeploymentPanel.scss';

interface DeploymentPanelProps {
  app: any;
}

const DeploymentPanel: React.FC<DeploymentPanelProps> = ({ app }) => {
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.apps);
  const { generating } = useAppSelector((state) => state.generation);
  const [platform, setPlatform] = useState<'vercel' | 'netlify' | 'custom'>(app.deployment?.platform || 'vercel');
  const [deploying, setDeploying] = useState(false);

  const hasGeneratedCode = !!app.generatedCode;

  const handleDownload = async () => {
    await dispatch(downloadApp(app._id));
  };

  const handleDeploy = async () => {
    if (!hasGeneratedCode) {
      alert('Please generate your app code first');
      return;
    }

    setDeploying(true);
    
    try {
      // Get deployment tokens from user (in production, these should be stored securely)
      const vercelToken = prompt('Enter your Vercel API token (or leave empty for mock deployment):');
      
      if (platform === 'vercel' && vercelToken) {
        // Real Vercel deployment
        const response = await api.post(`/apps/${app._id}/deploy`, {
          platform: 'vercel',
          vercelToken
        });
        
        if (response.data.success) {
          await dispatch(fetchApp(app._id));
          alert(`Deployment successful! Your app is live at: ${response.data.deployment.url}`);
        }
      } else if (platform === 'netlify') {
        const netlifyToken = prompt('Enter your Netlify API token:');
        const netlifySiteId = prompt('Enter your Netlify Site ID:');
        
        if (netlifyToken && netlifySiteId) {
          const response = await api.post(`/apps/${app._id}/deploy`, {
            platform: 'netlify',
            netlifyToken,
            netlifySiteId
          });
          
          if (response.data.success) {
            await dispatch(fetchApp(app._id));
            alert(`Deployment successful! Your app is live at: ${response.data.deployment.url}`);
          }
        } else {
          alert('Netlify token and site ID are required');
        }
      } else {
        // Mock deployment for demo
        alert('Using mock deployment. In production, provide valid deployment tokens.');
        await dispatch(fetchApp(app._id));
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      alert(`Deployment failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="deployment-panel">
      <div className="deployment-header">
        <h3>Deployment</h3>
        <p>Deploy your app to production or download the source code</p>
      </div>

      {!hasGeneratedCode && (
        <div className="alert alert--warning">
          <p>Your app code hasn't been generated yet. Use the AI Prompt tab to generate your app first.</p>
        </div>
      )}

      {hasGeneratedCode && (
        <>
          <div className="deployment-options">
            <div className="option-card">
              <h4>Download Source Code</h4>
              <p>Download your complete app as a ZIP file with all files, dependencies, and tests</p>
              <button
                onClick={handleDownload}
                className="btn btn--primary"
                disabled={generating}
              >
                📦 Download ZIP
              </button>
            </div>

            <div className="option-card">
              <h4>Deploy to Production</h4>
              <p>Deploy your app directly to a hosting platform</p>

              <div className="form-group">
                <label htmlFor="platform" className="label">
                  Platform
                </label>
                <select
                  id="platform"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                  className="input"
                  disabled={deploying}
                >
                  <option value="vercel">Vercel</option>
                  <option value="netlify">Netlify</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <button
                onClick={handleDeploy}
                className="btn btn--primary"
                disabled={deploying || app.deployment?.status === 'building'}
              >
                {deploying || app.deployment?.status === 'building' ? (
                  <>
                    <div className="spinner spinner--small"></div>
                    Deploying...
                  </>
                ) : (
                  '🚀 Deploy to ' + platform.charAt(0).toUpperCase() + platform.slice(1)
                )}
              </button>
            </div>
          </div>

          {app.deployment?.status === 'deployed' && app.deployment?.url && (
            <div className="deployment-status deployed">
              <h4>✅ Deployment Successful!</h4>
              <p>Your app is live at:</p>
              <a href={app.deployment.url} target="_blank" rel="noopener noreferrer" className="deployment-url">
                {app.deployment.url}
              </a>
              <p className="deployment-date">
                Deployed on {new Date(app.deployment.deployedAt).toLocaleString()}
              </p>
            </div>
          )}

          {app.deployment?.status === 'failed' && (
            <div className="deployment-status failed">
              <h4>❌ Deployment Failed</h4>
              <p>There was an error deploying your app. Please try again or check your configuration.</p>
            </div>
          )}

          <div className="deployment-info">
            <h4>Deployment Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className={`info-value status-${app.deployment?.status || 'not_deployed'}`}>
                  {app.deployment?.status || 'Not Deployed'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Platform:</span>
                <span className="info-value">{app.deployment?.platform || 'Not Set'}</span>
              </div>
              {app.deployment?.buildId && (
                <div className="info-item">
                  <span className="info-label">Build ID:</span>
                  <span className="info-value">{app.deployment.buildId}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DeploymentPanel;

