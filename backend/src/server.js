const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Behind a reverse proxy / platform load balancer (Render, Railway, nginx, etc.)
// so that req.ip and rate-limit see the real client IP, not the proxy.
app.set('trust proxy', 1);

/* ── Security headers ─────────────────────────────────────────
 * API serves JSON + SSE only (the SPA is hosted separately), so we
 * relax cross-origin resource policy to allow the frontend domain. */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
);

/* ── CORS (must run before routes to answer preflight) ──────── */
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow same-origin / curl / server-to-server (no Origin header)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 204,
  }),
);

/* ── Response compression — but NEVER for SSE streams ───────── */
app.use(
  compression({
    filter: (req, res) => {
      // Server-Sent Events must not be buffered/compressed or the
      // client never sees tokens until the stream ends.
      if (req.headers.accept === 'text/event-stream') return false;
      if (res.getHeader('Content-Type') === 'text/event-stream') return false;
      return compression.filter(req, res);
    },
  }),
);

/* ── Body parsing with sane size limits ─────────────────────── */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

/* ── Rate limiting ──────────────────────────────────────────── */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please slow down.' },
});

// Tighter limit on auth to blunt credential-stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts, try again later.' },
});

// Generation/AutoFix are expensive (LLM + sandbox); cap per IP per hour.
const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Generation rate limit reached. Try again in a bit.' },
});

app.use('/api', generalLimiter);

/* ── Health check (before DB so it answers even if DB is down) ─ */
app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    db: states[mongoose.connection.readyState] || 'unknown',
    uptime: process.uptime(),
  });
});

/* ── Routes ─────────────────────────────────────────────────── */
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/apps');
const generateRoutes = require('./routes/generate');
const adminRoutes = require('./routes/admin');
const testRoutes = require('./routes/tests');
const deploymentRoutes = require('./routes/deployment');
const streamRoutes = require('./routes/stream');
const autofixRoutes = require('./routes/autofix');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/generate', generateLimiter, generateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', testRoutes);
app.use('/api', deploymentRoutes);
app.use('/api/stream', generateLimiter, streamRoutes);
app.use('/api/autofix', generateLimiter, autofixRoutes);

/* ── 404 + error handler ────────────────────────────────────── */
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  if (err && /not allowed by CORS/.test(err.message)) {
    return res.status(403).json({ message: err.message });
  }
  console.error(err.stack || err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(!isProd && { stack: err.stack }),
  });
});

/* ── DB connection + start ──────────────────────────────────── */
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vibecoders';

async function connectWithRetry(attempt = 1) {
  const MAX_ATTEMPTS = 5;
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error(`❌ MongoDB connection failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, err.message);
    if (attempt >= MAX_ATTEMPTS) {
      if (isProd) {
        console.error('Giving up on MongoDB in production — exiting so the platform restarts us.');
        process.exit(1);
      }
      console.warn('⚠️  Continuing without MongoDB (dev mode). DB routes will fail until it is up.');
      return;
    }
    const backoff = Math.min(1000 * 2 ** attempt, 15000);
    await new Promise((r) => setTimeout(r, backoff));
    return connectWithRetry(attempt + 1);
  }
}

// Start listening immediately so /api/health answers even while the DB is
// still connecting (platform health probes need a fast 200), then connect
// to Mongo in the background with retry/backoff.
const server = app.listen(PORT, () => {
  console.log(`🚀 AppMaker API running on port ${PORT} (${isProd ? 'production' : 'development'})`);
});
connectWithRetry();

/* ── Graceful shutdown ──────────────────────────────────────── */
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  if (server) {
    server.close(() => {
      mongoose.connection.close(false).finally(() => process.exit(0));
    });
    // Force-exit if it hangs
    setTimeout(() => process.exit(1), 10000).unref();
  } else {
    process.exit(0);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
