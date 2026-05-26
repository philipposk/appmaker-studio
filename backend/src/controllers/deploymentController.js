const App = require('../models/App');
const deploymentService = require('../services/deploymentService');

// @desc    Deploy app
// @route   POST /api/apps/:id/deploy
// @access  Private
exports.deployApp = async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Check ownership
    if (app.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to deploy this app'
      });
    }

    if (!app.generatedCode) {
      return res.status(400).json({
        success: false,
        message: 'App code has not been generated yet'
      });
    }

    const { platform, vercelToken, netlifyToken, netlifySiteId } = req.body;

    if (!platform || (platform === 'vercel' && !vercelToken) || (platform === 'netlify' && (!netlifyToken || !netlifySiteId))) {
      return res.status(400).json({
        success: false,
        message: 'Missing deployment credentials'
      });
    }

    // Update status to building
    app.deployment.status = 'building';
    await app.save();

    try {
      let deployment;
      
      if (platform === 'vercel') {
        deployment = await deploymentService.deployToVercel(app, vercelToken);
      } else if (platform === 'netlify') {
        deployment = await deploymentService.deployToNetlify(app, netlifyToken, netlifySiteId);
      } else {
        throw new Error('Unsupported platform');
      }

      // Update app with deployment info
      app.deployment.status = 'deployed';
      app.deployment.url = deployment.url;
      app.deployment.buildId = deployment.deploymentId;
      app.deployment.platform = platform;
      app.deployment.deployedAt = new Date();
      
      if (req.body.env) {
        app.deployment.env = new Map(Object.entries(req.body.env));
      }

      await app.save();

      res.json({
        success: true,
        deployment: {
          url: deployment.url,
          platform,
          deploymentId: deployment.deploymentId,
          status: 'deployed'
        }
      });
    } catch (deployError) {
      app.deployment.status = 'failed';
      await app.save();
      
      throw deployError;
    }
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Deployment failed'
    });
  }
};

// @desc    Get deployment status
// @route   GET /api/apps/:id/deployment/status
// @access  Private
exports.getDeploymentStatus = async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    if (!app.deployment?.buildId) {
      return res.json({
        success: true,
        status: 'not_deployed'
      });
    }

    // This would require storing deployment tokens securely
    // For now, return the stored status
    res.json({
      success: true,
      deployment: {
        status: app.deployment.status,
        url: app.deployment.url,
        platform: app.deployment.platform,
        deployedAt: app.deployment.deployedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get deployment status'
    });
  }
};

