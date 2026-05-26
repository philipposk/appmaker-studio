const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();

// Database connection (non-blocking - start connection but don't wait)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vibecoders', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Middleware - CORS must be first to handle preflight requests
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vibecoders API is running' });
});

// Import routes
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/apps');
const generateRoutes = require('./routes/generate');
const adminRoutes = require('./routes/admin');
const testRoutes = require('./routes/tests');
const deploymentRoutes = require('./routes/deployment');
const streamRoutes = require('./routes/stream');
const autofixRoutes = require('./routes/autofix');

app.use('/api/auth', authRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', testRoutes);
app.use('/api', deploymentRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/autofix', autofixRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Vibecoders API server running on port ${PORT}`);
  console.log(`📝 Backend logs will appear in this terminal window`);
  console.log(`👀 Watch this terminal when generating apps to see detailed logs`);
});

module.exports = app;

