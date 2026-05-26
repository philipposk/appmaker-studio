const App = require('../models/App');
const User = require('../models/User');
const AppGeneratorService = require('../services/appGeneratorService');
const IncrementalUpdateService = require('../services/incrementalUpdateService');

// @desc    Generate app from prompt
// @route   POST /api/apps/generate
// @access  Private
exports.generateApp = async (req, res) => {
  try {
    const { prompt, appType = 'web' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    const user = await User.findById(req.user.id);
    
    // Check app limit
    const userApps = await App.countDocuments({ owner: req.user.id });
    if (userApps >= user.subscription.maxApps) {
      return res.status(403).json({
        success: false,
        message: `You have reached your app limit (${user.subscription.maxApps}). Upgrade your plan to create more apps.`
      });
    }

    // Get API key
    const apiKey = req.body.groqAPIKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Groq API key is required'
      });
    }

    // Generate app
    const generator = AppGeneratorService.create(apiKey);
    
    // Show progress (could be implemented with WebSockets for real-time updates)
    // For now, we'll generate synchronously
    const generatedApp = await generator.generateApp(prompt, appType);

    // Create app record
    const app = await App.create({
      name: generatedApp.appPlan.appName,
      description: prompt,
      owner: req.user.id,
      type: appType,
      status: 'draft',
      configuration: {
        groqAPIKey: apiKey,
        groqModel: 'llama-3.3-70b-versatile'
      },
      generatedCode: {
        frontend: {
          ...generatedApp.frontend,
          structure: Array.isArray(generatedApp.frontend?.structure) 
            ? generatedApp.frontend.structure 
            : []
        },
        backend: {
          ...generatedApp.backend,
          structure: Array.isArray(generatedApp.backend?.structure) 
            ? generatedApp.backend.structure 
            : []
        },
        config: generatedApp.config
      },
      tests: {
        unitTests: generatedApp.tests.unitTests,
        integrationTests: generatedApp.tests.integrationTests
      },
      generation: {
        prompt,
        iterations: [{
          prompt,
          generatedAt: new Date()
        }],
        lastGenerated: new Date(),
        model: 'llama-3.3-70b-versatile'
      },
      integrations: {
        groq: {
          enabled: true,
          connectedAt: new Date(),
          lastUsed: new Date(),
          usageCount: 1
        }
      }
    });

    // Add to user's apps
    user.apps.push(app._id);
    await user.save();

    res.status(201).json({
      success: true,
      app,
      message: 'App generated successfully!'
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate app'
    });
  }
};

// @desc    Refine/regenerate app
// @route   POST /api/apps/:id/refine
// @access  Private
exports.refineApp = async (req, res) => {
  try {
    const { prompt } = req.body;
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
        message: 'Not authorized to refine this app'
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Refinement prompt is required'
      });
    }

    const apiKey = app.configuration?.groqAPIKey || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'Groq API key not configured'
      });
    }

    // Check if this is a targeted refinement or full regeneration
    const isTargetedRefinement = req.body.targetComponent || req.body.targetType; // 'component', 'styling', 'bug', 'feature'
    
    let refinedApp;
    
    if (isTargetedRefinement && req.body.targetComponent && app.generatedCode) {
      // Incremental update - refine specific component
      const incrementalService = IncrementalUpdateService.create(apiKey);
      const componentName = req.body.targetComponent;
      
      // Find the component in generated code
      const componentFile = app.generatedCode.frontend?.structure?.find(
        f => f.path.includes(componentName) || f.name === componentName
      );
      
      if (componentFile) {
        const appContext = {
          appName: app.name,
          features: app.generatedCode.frontend?.structure || []
        };
        
        let updatedCode;
        
        switch (req.body.targetType) {
          case 'styling':
            updatedCode = await incrementalService.updateStyling(
              componentFile.content,
              componentName,
              prompt,
              appContext
            );
            break;
          case 'bug':
            updatedCode = await incrementalService.fixBug(
              componentFile.content,
              componentName,
              prompt,
              appContext
            );
            break;
          case 'feature':
            updatedCode = await incrementalService.addFeature(
              componentFile.content,
              prompt,
              appContext
            );
            break;
          default:
            updatedCode = await incrementalService.refineComponent(
              componentFile.content,
              componentName,
              prompt,
              appContext
            );
        }
        
        // Update only this component
        componentFile.content = updatedCode;
        refinedApp = {
          appPlan: { appName: app.name },
          frontend: app.generatedCode.frontend,
          backend: app.generatedCode.backend,
          tests: app.tests,
          config: app.generatedCode.config
        };
      } else {
        // Component not found, fall back to full regeneration
        const generator = AppGeneratorService.create(apiKey);
        refinedApp = await generator.generateApp(
          `${app.description}. Refinement: ${prompt}`,
          app.type
        );
      }
    } else {
      // Full regeneration
      console.log('🔄 Starting full app regeneration...');
      console.log('   App ID:', req.params.id);
      console.log('   Prompt:', prompt);
      console.log('   App Type:', app.type);
      
      const generator = AppGeneratorService.create(apiKey);
      const existingPlan = app.generation?.iterations?.[0] || {
        appName: app.name,
        features: [],
        components: [],
        pages: [],
        apiEndpoints: []
      };
      
      console.log('   Using API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT PROVIDED');
      
      refinedApp = await generator.generateApp(
        `${existingPlan.prompt || app.description}. Refinement: ${prompt}`,
        app.type
      );
      
      console.log('✅ Generation completed');
      console.log('   Frontend structure:', refinedApp.frontend?.structure?.length || 0, 'files');
      console.log('   Backend structure:', refinedApp.backend?.structure?.length || 0, 'files');
    }

    // Validate and ensure structure arrays are properly formatted
    const validateStructure = (structure) => {
      if (!structure) return [];
      
      // Already an array - validate and return
      if (Array.isArray(structure)) {
        // Ensure each item has required fields
        return structure.map(item => {
          // Handle both object and string formats
          if (typeof item === 'object' && item !== null) {
            return {
              path: typeof item.path === 'string' ? item.path : String(item.path || ''),
              content: typeof item.content === 'string' ? item.content : String(item.content || ''),
              type: typeof item.type === 'string' ? item.type : String(item.type || 'component')
            };
          }
          return null;
        }).filter(item => item !== null);
      }
      
      // String input - try to parse
      if (typeof structure === 'string') {
        // Check if it's a JavaScript string concatenation pattern (the problematic format)
        if (structure.includes("' + '") || structure.includes('` + `') || structure.includes('" + "')) {
          console.error('Detected JavaScript string concatenation pattern in structure - this should not happen. Returning empty array.');
          console.error('Structure snippet:', structure.substring(0, 200));
          return []; // Return empty array - the structure should be built programmatically, not from AI string
        }
        
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(structure);
          if (Array.isArray(parsed)) {
            return validateStructure(parsed);
          }
        } catch (e) {
          // If parsing fails, return empty array
          console.error('Failed to parse structure string as JSON:', e.message);
          console.error('Structure snippet:', structure.substring(0, 200));
        }
        return [];
      }
      
      // Invalid type - return empty array
      console.error('Invalid structure type:', typeof structure);
      return [];
    };

    // Update app with validated structures
    // Ensure we always have valid structures (arrays, not strings)
    const frontendStructure = refinedApp.frontend?.structure;
    const backendStructure = refinedApp.backend?.structure;
    
    console.log('Frontend structure type:', typeof frontendStructure, Array.isArray(frontendStructure));
    console.log('Backend structure type:', typeof backendStructure, Array.isArray(backendStructure));
    
    if (typeof frontendStructure === 'string') {
      console.error('ERROR: Frontend structure is a string, not an array!');
      console.error('First 300 chars:', frontendStructure.substring(0, 300));
    }
    if (typeof backendStructure === 'string') {
      console.error('ERROR: Backend structure is a string, not an array!');
      console.error('First 300 chars:', backendStructure.substring(0, 300));
    }
    
    app.generatedCode = {
      frontend: refinedApp.frontend ? {
        ...refinedApp.frontend,
        structure: validateStructure(frontendStructure)
      } : (app.generatedCode?.frontend || { structure: [] }),
      backend: refinedApp.backend ? {
        ...refinedApp.backend,
        structure: validateStructure(backendStructure)
      } : (app.generatedCode?.backend || { structure: [] }),
      config: refinedApp.config || app.generatedCode?.config
    };
    
    // Final safety check - ensure structures are arrays before saving
    if (!Array.isArray(app.generatedCode.frontend?.structure)) {
      console.error('CRITICAL: Frontend structure is still not an array after validation! Setting to empty array.');
      app.generatedCode.frontend = { ...app.generatedCode.frontend, structure: [] };
    }
    if (!Array.isArray(app.generatedCode.backend?.structure)) {
      console.error('CRITICAL: Backend structure is still not an array after validation! Setting to empty array.');
      app.generatedCode.backend = { ...app.generatedCode.backend, structure: [] };
    }

    // Check if structures are empty after validation
    const frontendHasContent = app.generatedCode.frontend?.structure?.length > 0;
    const backendHasContent = app.generatedCode.backend?.structure?.length > 0;
    
    if (!frontendHasContent && !backendHasContent) {
      console.error('❌ ERROR: Both frontend and backend structures are empty after generation!');
      console.error('   This usually means the Groq API failed or returned invalid data.');
      console.error('   Frontend structure length:', app.generatedCode.frontend?.structure?.length || 0);
      console.error('   Backend structure length:', app.generatedCode.backend?.structure?.length || 0);
      console.error('   Frontend structure type:', typeof app.generatedCode.frontend?.structure);
      console.error('   Backend structure type:', typeof app.generatedCode.backend?.structure);
      
      // Throw error so it gets caught by the enhanced error handler
      throw new Error('App generation failed: No code was generated. This might be due to Groq API rate limits or an error. Please try again in a few minutes or check your Groq API key.');
    }
    
    app.tests = {
      unitTests: refinedApp.tests?.unitTests || app.tests?.unitTests || [],
      integrationTests: refinedApp.tests?.integrationTests || app.tests?.integrationTests || []
    };
    
    // Initialize generation if it doesn't exist
    if (!app.generation) {
      app.generation = {
        prompt: app.description || prompt,
        iterations: [],
        lastGenerated: new Date(),
        model: 'llama-3.3-70b-versatile'
      };
    }
    
    app.generation.iterations.push({
      prompt,
      generatedAt: new Date(),
      changes: prompt
    });
    app.generation.lastGenerated = new Date();
    app.integrations.groq.usageCount += 1;
    app.integrations.groq.lastUsed = new Date();

    await app.save();

    res.json({
      success: true,
      app,
      message: 'App refined successfully!'
    });
  } catch (error) {
    console.error('❌ Refinement error:', error);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack?.substring(0, 500));
    
    // Provide more detailed error message
    let errorMessage = error.message || 'Failed to refine app';
    let detailedInfo = '';
    
    // Add helpful context for common errors
    if (errorMessage.includes('No code was generated')) {
      detailedInfo = '\n\n🔍 Detailed Error Information:\n' +
        'The backend tried to generate code but received empty responses from Groq API.\n\n' +
        'Possible causes:\n' +
        '1. ⏱️  Groq API rate limits reached - wait 5-10 minutes and try again\n' +
        '2. 🔑 Groq API key invalid/expired - check at https://console.groq.com\n' +
        '3. 🚫 All available models are rate limited - upgrade your Groq tier\n' +
        '4. 🌐 Network connectivity issues - check your internet\n' +
        '5. 💳 Groq account quota exceeded - check billing at https://console.groq.com/settings/billing\n\n' +
        'The system automatically tries 5 different models, but if all are rate limited,\n' +
        'you need to wait or upgrade your Groq API tier.';
      
      errorMessage += detailedInfo;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit')) {
      errorMessage += '\n\n💡 Tip: The system automatically tries different models when one is rate limited. If all models fail, wait a few minutes and try again.';
    }
    
    // Log detailed error for debugging
    console.error('📋 Full error details sent to frontend:', {
      message: errorMessage,
      originalError: error.message,
      stack: error.stack?.substring(0, 300)
    });
    
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

// @desc    Download app as ZIP
// @route   GET /api/apps/:id/download
// @access  Private
exports.downloadApp = async (req, res) => {
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
        message: 'Not authorized to download this app'
      });
    }

    if (!app.generatedCode) {
      return res.status(400).json({
        success: false,
        message: 'App code has not been generated yet'
      });
    }

    // Create app structure
    const appData = {
      appPlan: {
        appName: app.name,
        features: [],
        components: [],
        pages: [],
        apiEndpoints: []
      },
      frontend: app.generatedCode.frontend,
      backend: app.generatedCode.backend,
      config: app.generatedCode.config
    };

    const apiKey = app.configuration?.groqAPIKey || process.env.GROQ_API_KEY;
    const generator = AppGeneratorService.create(apiKey);
    
    const fs = require('fs-extra');
    const path = require('path');
    const downloadDir = path.join(__dirname, '../../downloads');
    await fs.ensureDir(downloadDir);
    
    const zipPath = path.join(downloadDir, `${app._id}.zip`);
    await generator.createAppZip(appData, zipPath);

    res.download(zipPath, `${app.name.replace(/\s+/g, '-')}.zip`, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      fs.remove(zipPath).catch(console.error);
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download app'
    });
  }
};

