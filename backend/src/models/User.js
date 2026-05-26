const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['developer', 'admin'],
    default: 'developer'
  },
  profile: {
    firstName: String,
    lastName: String,
    bio: String,
    avatar: String
  },
  privacy: {
    showEmail: { type: Boolean, default: false },
    showProfile: { type: Boolean, default: true },
    dataSharing: { type: Boolean, default: false }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free'
    },
    maxApps: {
      type: Number,
      default: 3 // Free plan allows 3 apps
    },
    startDate: Date,
    endDate: Date
  },
  apps: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'App'
  }],
  notifications: [{
    type: {
      type: String,
      enum: ['app_update', 'integration_issue', 'security_alert', 'system'],
      required: true
    },
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Set max apps based on subscription
userSchema.pre('save', function(next) {
  const planLimits = {
    free: 3,
    pro: 20,
    enterprise: Infinity
  };
  if (this.isModified('subscription.plan')) {
    this.subscription.maxApps = planLimits[this.subscription.plan] || 3;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);

