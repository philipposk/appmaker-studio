/**
 * StreamingGeneratorService
 *
 * Single-pass code generation that streams atomic file operations from
 * the LLM. Replaces the slow N-call-per-component generator.
 *
 * Output protocol — model is instructed to emit XML-ish blocks:
 *   <appmakerAction type="file" path="src/App.jsx">
 *   ...file contents...
 *   </appmakerAction>
 *   <appmakerAction type="delete" path="src/Old.jsx" />
 *   <appmakerAction type="shell">npm install react-router-dom</appmakerAction>
 *   <appmakerArtifact name="My Todo App" />
 *
 * The parser is stream-safe: it emits operations the moment a closing tag
 * is seen, so the UI can render files as they finish.
 */
const { runWithFallback, getProvider } = require('./llmProviders');

const SYSTEM_PROMPT = `You are AppMaker, an expert full-stack engineer that builds complete, production-ready web apps from a single user prompt.

OUTPUT FORMAT — VERY IMPORTANT
You MUST emit your work as a stream of <appmakerAction> tags. Do not output prose, explanations, or markdown outside these tags.

Allowed actions:
  <appmakerArtifact name="HUMAN_READABLE_APP_NAME" />
  <appmakerAction type="file" path="relative/path/from/project/root.ext">
  FULL FILE CONTENTS — never truncated, never "..." — exact bytes you want written.
  </appmakerAction>
  <appmakerAction type="delete" path="relative/path.ext" />
  <appmakerAction type="shell">single shell command to run after files are written</appmakerAction>

RULES
1. Emit <appmakerArtifact /> FIRST with the app name.
2. Emit files in dependency order: package.json first, then config, then source, then tests.
3. ALWAYS include both a working package.json AND an entry point (src/main.tsx or src/App.jsx) so the project runs immediately.
4. Use Vite + React + TypeScript + Tailwind + shadcn/ui patterns for frontend unless the user specifies otherwise.
5. Use Express + Node for backend if needed; put it under \`server/\` and add a "dev:server" script.
6. Production-quality code: real error handling, semantic HTML, accessible components, responsive layout.
7. No placeholders like "// TODO" — write the real implementation.
8. End with one <appmakerAction type="shell">npm install &amp;&amp; npm run dev</appmakerAction> (or equivalent).
9. NEVER wrap actions in markdown code fences.

If a previous generation context is provided (for refinement), reuse existing file paths and only emit files that change.`;

const ACTION_OPEN_RE = /<appmakerAction\b([^>]*)>/i;
const ACTION_CLOSE_RE = /<\/appmakerAction>/i;
const ARTIFACT_RE = /<appmakerArtifact\b([^/]*?)\/>/i;

function parseAttrs(attrStr) {
  const out = {};
  const re = /(\w+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) out[m[1]] = m[2];
  return out;
}

/**
 * Build a parser that consumes streamed text and emits action objects
 * via the `onAction` callback as soon as each one is complete.
 *
 * onAction({ type: 'artifact', name }) | { type: 'file', path, content }
 *                                      | { type: 'delete', path }
 *                                      | { type: 'shell', cmd }
 */
function createStreamParser(onAction) {
  let buffer = '';

  function consume() {
    // Self-closing artifact tag — emit and remove.
    let m = buffer.match(ARTIFACT_RE);
    if (m) {
      const attrs = parseAttrs(m[1]);
      if (attrs.name) onAction({ type: 'artifact', name: attrs.name });
      buffer = buffer.slice(m.index + m[0].length);
    }

    // Iterate paired <appmakerAction ...>...</appmakerAction> blocks.
    // Also handle self-closing <appmakerAction ... />.
    while (true) {
      const open = buffer.match(ACTION_OPEN_RE);
      if (!open) return;
      const attrs = parseAttrs(open[1]);
      const selfClose = open[1].trim().endsWith('/');
      const afterOpen = open.index + open[0].length;

      if (selfClose) {
        if (attrs.type === 'delete' && attrs.path) {
          onAction({ type: 'delete', path: attrs.path });
        }
        buffer = buffer.slice(afterOpen);
        continue;
      }

      const closeRel = buffer.slice(afterOpen).match(ACTION_CLOSE_RE);
      if (!closeRel) return; // wait for more data
      const inner = buffer.slice(afterOpen, afterOpen + closeRel.index);
      const end = afterOpen + closeRel.index + closeRel[0].length;

      if (attrs.type === 'file' && attrs.path) {
        onAction({ type: 'file', path: attrs.path, content: inner });
      } else if (attrs.type === 'shell') {
        onAction({ type: 'shell', cmd: inner.trim() });
      } else if (attrs.type === 'delete' && attrs.path) {
        onAction({ type: 'delete', path: attrs.path });
      }
      buffer = buffer.slice(end);
    }
  }

  return {
    push(delta) {
      buffer += delta;
      consume();
    },
    end() {
      consume();
      return buffer;
    },
  };
}

class StreamingGeneratorService {
  /**
   * @param {object} opts
   * @param {string} opts.provider  - default provider name
   * @param {string} [opts.apiKey]  - override key for the provider
   * @param {string[]} [opts.fallbackProviders]
   */
  constructor({ provider = 'groq', apiKey, fallbackProviders = ['groq', 'openrouter', 'openai', 'anthropic', 'ollama'] } = {}) {
    this.providerName = provider;
    this.apiKey = apiKey;
    this.fallback = fallbackProviders;
  }

  /**
   * Generate an app, streaming actions to `onAction`.
   *
   * @param {string} prompt
   * @param {object} options { appType, model, temperature, refineFrom }
   * @param {(ev: object) => void} onEvent  receives:
   *   { type: 'token', delta }
   *   { type: 'action', action }
   *   { type: 'done', usage, model }
   *   { type: 'error', message }
   */
  async generate(prompt, options = {}, onEvent = () => {}) {
    const { appType = 'web', model, temperature = 0.4, refineFrom } = options;

    const userMsg = [
      `App type: ${appType}`,
      `User request: ${prompt}`,
      refineFrom ? `\nExisting project context (refine — only emit changed files):\n${refineFrom}` : '',
    ].join('\n');

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ];

    const parser = createStreamParser((action) => onEvent({ type: 'action', action }));

    const onDelta = (delta) => {
      onEvent({ type: 'token', delta });
      parser.push(delta);
    };

    try {
      const result = await runWithFallback({
        providers: [this.providerName, ...this.fallback.filter((p) => p !== this.providerName)],
        messages,
        opts: { model, temperature, maxTokens: 8192 },
        stream: true,
        onDelta,
      });
      parser.end();
      onEvent({ type: 'done', usage: result.usage, model: result.model });
      return result;
    } catch (err) {
      onEvent({ type: 'error', message: err.message });
      throw err;
    }
  }
}

module.exports = StreamingGeneratorService;
module.exports.createStreamParser = createStreamParser;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
