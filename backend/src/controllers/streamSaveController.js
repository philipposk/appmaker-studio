/**
 * Persists files produced by the streaming generator into either:
 *   - an existing App (appId given), or
 *   - a freshly created App (no appId, name + type required).
 *
 * Splits the flat file list into the App schema's frontend / backend
 * buckets by path heuristics:
 *   - paths starting with `server/`, `backend/`, or matching common
 *     Node-backend extensions => backend.structure
 *   - everything else => frontend.structure
 *
 * Records an iteration entry with provider, model, files-changed,
 * token usage, and optional raw stream log.
 */
const App = require('../models/App');

const BACKEND_PREFIXES = ['server/', 'backend/', 'api/'];
const BACKEND_FILES = new Set(['server.js', 'index.js']); // top-level node entrypoints

function classify(path) {
  const p = String(path || '').replace(/^\.\//, '');
  if (BACKEND_PREFIXES.some((pre) => p.startsWith(pre))) return 'backend';
  if (BACKEND_FILES.has(p)) return 'backend';
  if (p.startsWith('src/') || p.startsWith('public/') || p === 'index.html' || p.endsWith('.tsx') || p.endsWith('.jsx')) {
    return 'frontend';
  }
  // package.json, vite.config — duplicate-classify as frontend (most common case for monorepo-less apps)
  return 'frontend';
}

function inferType(path) {
  const p = String(path || '');
  if (p.includes('/pages/')) return 'page';
  if (p.includes('/components/')) return 'component';
  if (p.includes('/routes/')) return 'route';
  if (p.includes('/models/')) return 'model';
  if (p.includes('/controllers/')) return 'controller';
  if (p.includes('/services/')) return 'service';
  if (p.endsWith('.css') || p.endsWith('.scss')) return 'style';
  if (p.endsWith('.test.js') || p.endsWith('.test.ts') || p.endsWith('.spec.js')) return 'test';
  if (p === 'package.json' || p.endsWith('.config.js') || p.endsWith('.config.ts')) return 'config';
  return 'other';
}

function splitFiles(files) {
  const frontend = [];
  const backend = [];
  for (const f of files || []) {
    if (!f || !f.path || typeof f.content !== 'string') continue;
    const entry = { path: f.path, content: f.content, type: inferType(f.path) };
    if (classify(f.path) === 'backend') backend.push(entry);
    else frontend.push(entry);
  }
  return { frontend, backend };
}

exports.saveStreamResult = async (req, res) => {
  try {
    const {
      appId,
      prompt,
      provider,
      model,
      files,
      shellCommands,
      streamLog,
      tokensUsed,
      durationMs,
      artifactName,
      appType,
      description,
    } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: 'files[] is required and must be non-empty' });
    }

    const { frontend, backend } = splitFiles(files);
    const iteration = {
      prompt: prompt || '',
      generatedAt: new Date(),
      changes: artifactName || `Stream generation (${files.length} files)`,
      provider: provider || 'groq',
      model: model || '',
      streamLog: typeof streamLog === 'string' ? streamLog.slice(0, 100_000) : undefined,
      filesChanged: files.map((f) => f.path).filter(Boolean),
      tokensUsed: Number(tokensUsed) || undefined,
      durationMs: Number(durationMs) || undefined,
      source: 'stream',
    };

    let app;
    if (appId) {
      app = await App.findById(appId);
      if (!app) return res.status(404).json({ message: 'App not found' });
      if (String(app.owner) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      app.generatedCode = app.generatedCode || {};
      app.generatedCode.frontend = { ...(app.generatedCode.frontend?.toObject?.() || app.generatedCode.frontend || {}), structure: frontend };
      app.generatedCode.backend = { ...(app.generatedCode.backend?.toObject?.() || app.generatedCode.backend || {}), structure: backend };
    } else {
      app = new App({
        name: artifactName || `App ${new Date().toISOString().slice(0, 16)}`,
        description: description || prompt?.slice(0, 480) || '',
        owner: req.user._id,
        type: appType || 'web',
        generatedCode: {
          frontend: { structure: frontend },
          backend: { structure: backend },
        },
      });
    }

    app.generation = app.generation || {};
    app.generation.prompt = prompt || app.generation.prompt;
    app.generation.iterations = [...(app.generation.iterations || []), iteration];
    app.generation.lastGenerated = new Date();
    app.generation.model = model || app.generation.model;
    app.generation.defaultProvider = provider || app.generation.defaultProvider || 'groq';

    await app.save();
    res.json({
      success: true,
      app: {
        _id: app._id,
        name: app.name,
        frontendFiles: frontend.length,
        backendFiles: backend.length,
        shellCommands: Array.isArray(shellCommands) ? shellCommands : [],
      },
    });
  } catch (err) {
    console.error('[streamSave] failed:', err);
    res.status(500).json({ message: err.message || 'Failed to save stream result' });
  }
};
