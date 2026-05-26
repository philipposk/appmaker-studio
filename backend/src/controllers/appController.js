const App = require('../models/App');
const User = require('../models/User');
const GroqService = require('../services/groqService');

// @desc    Get all apps
// @route   GET /api/apps
// @access  Private
exports.getApps = async (req, res) => {
  try {
    const filter = { owner: req.user.id };

    // If user is admin, allow viewing all apps or filter
    if (req.user.role === 'admin' && req.query.all === 'true') {
      delete filter.owner;
    }

    const apps = await App.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: apps.length,
      apps
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get single app
// @route   GET /api/apps/:id
// @access  Private
exports.getApp = async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Check ownership or admin
    if (app.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this app'
      });
    }

    res.json({
      success: true,
      app
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Create new app
// @route   POST /api/apps
// @access  Private
exports.createApp = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Check app limit based on subscription
    const userApps = await App.countDocuments({ owner: req.user.id });
    const maxApps = user.subscription?.maxApps || 3; // Default to 3 if subscription not set
    
    console.log(`📊 App limit check: User has ${userApps} apps, limit is ${maxApps}`);
    
    if (userApps >= maxApps) {
      return res.status(403).json({
        success: false,
        message: `You have reached your app limit (${maxApps} apps). You currently have ${userApps} apps. Upgrade your plan or delete an existing app to create more.`
      });
    }

    req.body.owner = req.user.id;
    
    // Initialize generatedCode structure if not provided (for new apps without generated code yet)
    if (!req.body.generatedCode) {
      req.body.generatedCode = {
        frontend: {
          structure: [],
          dependencies: {}
        },
        backend: {
          structure: [],
          dependencies: {}
        },
        config: {}
      };
    }
    
    // Ensure structure arrays exist
    if (!req.body.generatedCode.frontend) {
      req.body.generatedCode.frontend = { structure: [], dependencies: {} };
    }
    if (!req.body.generatedCode.frontend.structure) {
      req.body.generatedCode.frontend.structure = [];
    }
    if (!req.body.generatedCode.backend) {
      req.body.generatedCode.backend = { structure: [], dependencies: {} };
    }
    if (!req.body.generatedCode.backend.structure) {
      req.body.generatedCode.backend.structure = [];
    }
    
    const app = await App.create(req.body);

    // Add app to user's apps array
    user.apps.push(app._id);
    await user.save();

    res.status(201).json({
      success: true,
      app
    });
  } catch (error) {
    console.error('❌ Error creating app:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      errors: error.errors
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Update app
// @route   PUT /api/apps/:id
// @access  Private
exports.updateApp = async (req, res) => {
  try {
    let app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Check ownership or admin
    if (app.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this app'
      });
    }

    app = await App.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      app
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Delete app
// @route   DELETE /api/apps/:id
// @access  Private
exports.deleteApp = async (req, res) => {
  try {
    const app = await App.findById(req.params.id);

    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Check ownership or admin
    if (app.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this app'
      });
    }

    await app.deleteOne();

    // Remove from user's apps array
    const user = await User.findById(req.user.id);
    user.apps = user.apps.filter(appId => appId.toString() !== req.params.id);
    await user.save();

    res.json({
      success: true,
      message: 'App deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Test Groq integration
// @route   POST /api/apps/:id/test-groq
// @access  Private
exports.testGroq = async (req, res) => {
  try {
    const app = await App.findById(req.params.id).select('+configuration.groqAPIKey');

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
        message: 'Not authorized to test this app'
      });
    }

    const apiKey = app.configuration?.groqAPIKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Groq API key not configured'
      });
    }

    const groqService = GroqService.create(apiKey);
    const testResult = await groqService.testConnection();

    // Update app integration status
    app.integrations.groq.enabled = true;
    app.integrations.groq.connectedAt = new Date();
    app.integrations.groq.lastUsed = new Date();
    await app.save();

    res.json({
      success: true,
      ...testResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

