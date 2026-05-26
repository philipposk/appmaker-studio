/**
 * SSE streaming routes for code generation.
 *
 * GET  /api/stream/providers           - list usable providers
 * POST /api/stream/generate            - body: { prompt, appType, provider, model, refineFrom }
 *                                         responds with text/event-stream
 */
const express = require('express');
const StreamingGeneratorService = require('../services/streamingGeneratorService');
const { listAvailableProviders, listProviders } = require('../services/llmProviders');

const router = express.Router();

router.get('/providers', (req, res) => {
  res.json({
    available: listAvailableProviders(),
    all: listProviders(),
  });
});

router.post('/generate', async (req, res) => {
  const { prompt, appType, provider, model, refineFrom, temperature, apiKey } = req.body || {};
  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ message: 'prompt is required' });
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

  // Heartbeat so proxies do not close the connection during long LLM calls.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => clearInterval(heartbeat));

  try {
    const svc = new StreamingGeneratorService({ provider: provider || 'groq', apiKey });
    await svc.generate(
      prompt,
      { appType, model, temperature, refineFrom },
      (ev) => {
        // Map internal events 1:1 onto SSE events.
        send(ev.type, ev);
      }
    );
    send('complete', { ok: true });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

module.exports = router;
