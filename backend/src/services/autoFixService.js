/**
 * AutoFixService
 *
 * Given a generated project on disk, run validators (tsc, eslint, jest)
 * and, if any fail, feed the errors back to the LLM with the offending
 * files attached and ask for a minimal patch (atomic file ops).
 *
 * Stops when:
 *   - all validators pass, OR
 *   - maxIterations reached, OR
 *   - the LLM emits zero file actions on a pass (no progress).
 */
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const StreamingGeneratorService = require('./streamingGeneratorService');
const { createStreamParser } = require('./streamingGeneratorService');
const { runWithFallback } = require('./llmProviders');

const FIX_SYSTEM_PROMPT = `You are AppMaker AutoFix. You receive:
  1. A list of validator errors (tsc, eslint, jest, npm install).
  2. The current contents of files the errors reference.

Emit ONLY <appmakerAction type="file" path="..."> blocks containing the corrected file contents. Do NOT explain. Do NOT include files that do not need to change. Never truncate. End the response immediately after the last </appmakerAction>.`;

function runCmd(cmd, args, cwd, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env, CI: 'true' } });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message });
    });
  });
}

async function runValidators(projectDir, { skip = [] } = {}) {
  const results = {};
  if (!skip.includes('install') && (await fs.pathExists(path.join(projectDir, 'package.json')))) {
    results.install = await runCmd('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], projectDir, {
      timeoutMs: 240000,
    });
  }
  if (!skip.includes('tsc') && (await fs.pathExists(path.join(projectDir, 'tsconfig.json')))) {
    results.tsc = await runCmd('npx', ['--yes', 'tsc', '--noEmit', '--pretty', 'false'], projectDir);
  }
  if (!skip.includes('eslint')) {
    const hasEslint =
      (await fs.pathExists(path.join(projectDir, '.eslintrc'))) ||
      (await fs.pathExists(path.join(projectDir, '.eslintrc.json'))) ||
      (await fs.pathExists(path.join(projectDir, 'eslint.config.js')));
    if (hasEslint) {
      results.eslint = await runCmd('npx', ['--yes', 'eslint', '.', '--format', 'compact'], projectDir);
    }
  }
  if (!skip.includes('jest')) {
    const pkg = await fs.readJson(path.join(projectDir, 'package.json')).catch(() => ({}));
    if (pkg.scripts?.test && !/no test specified/i.test(pkg.scripts.test)) {
      results.jest = await runCmd('npm', ['test', '--', '--ci', '--reporters=default'], projectDir, {
        timeoutMs: 240000,
      });
    }
  }
  return results;
}

function hasFailures(results) {
  return Object.values(results).some((r) => r && r.code !== 0);
}

/**
 * Extract referenced file paths from a stderr/stdout blob.
 * Best-effort regex covering tsc, eslint, jest, node stack traces.
 */
function extractReferencedFiles(text, projectDir) {
  const found = new Set();
  if (!text) return [];
  const patterns = [
    /(?:^|\s)([./\w\-\\]+\.(?:tsx?|jsx?|json|css|scss))(?::\d+:\d+)?/gm,
    /at .*\(([^()]+\.(?:tsx?|jsx?)):\d+:\d+\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      let rel = m[1].replace(/^\.\//, '');
      if (rel.startsWith(projectDir)) rel = path.relative(projectDir, rel);
      if (!rel || rel.includes('node_modules')) continue;
      found.add(rel);
    }
  }
  return Array.from(found);
}

async function buildFixPrompt(projectDir, results) {
  const errorChunks = [];
  const referenced = new Set();
  for (const [name, r] of Object.entries(results)) {
    if (!r || r.code === 0) continue;
    const blob = (r.stderr || '') + '\n' + (r.stdout || '');
    errorChunks.push(`### ${name} (exit ${r.code})\n${blob.slice(0, 4000)}`);
    extractReferencedFiles(blob, projectDir).forEach((f) => referenced.add(f));
  }
  const fileChunks = [];
  for (const rel of referenced) {
    const abs = path.join(projectDir, rel);
    if (await fs.pathExists(abs)) {
      const content = await fs.readFile(abs, 'utf8');
      fileChunks.push(`<file path="${rel}">\n${content}\n</file>`);
    }
  }
  return [
    'VALIDATOR ERRORS:',
    errorChunks.join('\n\n'),
    '',
    'CURRENT FILE CONTENTS:',
    fileChunks.join('\n\n') || '(no files identified from errors — inspect package.json and entry points)',
    '',
    'Emit corrected files now.',
  ].join('\n');
}

async function applyFileActions(projectDir, actions) {
  let written = 0;
  for (const a of actions) {
    if (a.type !== 'file' || !a.path) continue;
    const abs = path.join(projectDir, a.path);
    await fs.ensureDir(path.dirname(abs));
    await fs.writeFile(abs, a.content, 'utf8');
    written++;
  }
  return written;
}

/**
 * Run the fix loop on `projectDir`.
 *
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} [opts.provider='groq']
 * @param {string} [opts.apiKey]
 * @param {number} [opts.maxIterations=3]
 * @param {(ev:object)=>void} [opts.onEvent]
 */
async function autoFix({ projectDir, provider = 'groq', apiKey, maxIterations = 3, onEvent = () => {} } = {}) {
  for (let i = 1; i <= maxIterations; i++) {
    onEvent({ type: 'iteration_start', iteration: i });
    const results = await runValidators(projectDir);
    onEvent({ type: 'validators', iteration: i, results: summarize(results) });

    if (!hasFailures(results)) {
      onEvent({ type: 'green', iteration: i });
      return { ok: true, iterations: i, results };
    }

    const userPrompt = await buildFixPrompt(projectDir, results);
    const actions = [];
    const parser = createStreamParser((a) => actions.push(a));

    await runWithFallback({
      providers: [provider, 'openrouter', 'openai', 'anthropic', 'ollama'],
      messages: [
        { role: 'system', content: FIX_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      opts: { temperature: 0.1, maxTokens: 6000 },
      stream: true,
      onDelta: (delta) => {
        parser.push(delta);
        onEvent({ type: 'token', delta });
      },
    });
    parser.end();

    const written = await applyFileActions(projectDir, actions);
    onEvent({ type: 'patch_applied', iteration: i, files: written });
    if (written === 0) {
      onEvent({ type: 'no_progress', iteration: i });
      return { ok: false, iterations: i, results, reason: 'LLM emitted no file fixes' };
    }
  }
  return { ok: false, iterations: maxIterations, reason: 'maxIterations reached' };
}

function summarize(results) {
  const out = {};
  for (const [k, v] of Object.entries(results)) {
    out[k] = {
      code: v.code,
      ok: v.code === 0,
      tail: ((v.stderr || '') + (v.stdout || '')).slice(-400),
    };
  }
  return out;
}

module.exports = {
  autoFix,
  runValidators,
  hasFailures,
};
