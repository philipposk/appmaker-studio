const mongoose = require('mongoose');

const appSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'App name is required'],
    trim: true,
    maxlength: [100, 'App name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['web', 'mobile', 'api', 'integration'],
    default: 'web'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'archived'],
    default: 'draft'
  },
  configuration: {
    provider: {
      type: String,
      enum: ['aws', 'azure', 'google-cloud', 'custom'],
      default: 'aws'
    },
    groqAPIKey: {
      type: String,
      select: false // Don't expose API keys by default
    },
    groqModel: {
      type: String,
      default: 'llama-3.3-70b-versatile'
    },
    settings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  integrations: {
    groq: {
      enabled: { type: Boolean, default: false },
      connectedAt: Date,
      lastUsed: Date,
      usageCount: { type: Number, default: 0 }
    }
  },
  metadata: {
    version: { type: String, default: '1.0.0' },
    tags: [String],
    category: String,
    isPublic: { type: Boolean, default: false },
    media: [{
      type: { type: String, enum: ['image', 'video'] },
      url: String,
      thumbnail: String
    }]
  },
  statistics: {
    views: { type: Number, default: 0 },
    interactions: { type: Number, default: 0 },
    lastAccessed: Date
  },
  // Generated code and app structure
  generatedCode: {
    frontend: {
      code: { type: String, select: false },
      structure: [{
        path: String,
        content: String,
        type: String // 'component', 'page', 'util', 'style', etc.
      }],
      dependencies: {
        type: Map,
        of: String
      }
    },
    backend: {
      code: { type: String, select: false },
      structure: [{
        path: String,
        content: String,
        type: String // 'route', 'controller', 'model', 'service', etc.
      }],
      dependencies: {
        type: Map,
        of: String
      }
    },
    config: {
      packageJson: { type: mongoose.Schema.Types.Mixed },
      buildConfig: { type: mongoose.Schema.Types.Mixed }
    }
  },
  // Tests
  tests: {
    unitTests: [{
      path: String,
      content: String,
      status: { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' },
      results: mongoose.Schema.Types.Mixed,
      lastRun: Date
    }],
    integrationTests: [{
      path: String,
      content: String,
      status: { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' },
      results: mongoose.Schema.Types.Mixed,
      lastRun: Date
    }],
    testCoverage: {
      lines: Number,
      functions: Number,
      branches: Number,
      statements: Number
    }
  },
  // Deployment
  deployment: {
    status: { type: String, enum: ['not_deployed', 'building', 'deployed', 'failed'], default: 'not_deployed' },
    url: String,
    buildId: String,
    deployedAt: Date,
    platform: { type: String, enum: ['vercel', 'netlify', 'custom'], default: 'vercel' },
    env: {
      type: Map,
      of: String
    }
  },
  // AI generation metadata
  generation: {
    prompt: String,
    iterations: [{
      prompt: String,
      generatedAt: Date,
      changes: String
    }],
    lastGenerated: Date,
    model: String
  }
}, {
  timestamps: true
});

// Index for faster queries
appSchema.index({ owner: 1, status: 1 });
appSchema.index({ 'metadata.isPublic': 1 });
appSchema.index({ createdAt: -1 });

module.exports = mongoose.model('App', appSchema);

