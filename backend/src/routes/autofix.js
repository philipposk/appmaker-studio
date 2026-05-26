/**
 * AutoFix routes.
 *
 * POST /api/autofix              - body: { projectDir, provider, apiKey, maxIterations }
 *                                   SSE stream of fix iterations.
 */
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { autoFix } = require('../services/autoFixService');

const router = express.Router();

router.post('/', async (req, res) => {
  const { projectDir, provider, apiKey, maxIterations } = req.body || {};
  if (!projectDir) return res.status(400).json({ message: 'projectDir is required' });

  const abs = path.resolve(projectDir);
  // Only allow operating inside backend/temp/ or backend/downloads/ for safety.
  const allowedRoot = path.resolve(__dirname, '..', '..');
  if (!abs.startsWith(allowedRoot)) {
    return res.status(400).json({ message: 'projectDir must be inside backend workspace' });
  }
  if (!(await fs.pathExists(abs))) {
    return res.status(404).json({ message: `projectDir not found: ${abs}` });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => clearInterval(heartbeat));

  try {
    const result = await autoFix({
      projectDir: abs,
      provider: provider || 'groq',
      apiKey,
      maxIterations: Number(maxIterations) || 3,
      onEvent: (ev) => send(ev.type, ev),
    });
    send('result', result);
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

module.exports = router;
