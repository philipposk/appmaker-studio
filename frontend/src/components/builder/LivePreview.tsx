import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '../../utils/hooks';
import './LivePreview.scss';

// WebContainer is loaded lazily so the rest of the app still works
// if the user hasn't run `npm install @webcontainer/api`.
type WebContainer = any;

interface AppFile {
  path: string;
  content: string;
}

interface LivePreviewProps {
  app: any;
}

/**
 * Convert a flat file list like [{ path: 'src/App.jsx', content }, ...]
 * into the nested FileSystemTree object WebContainer expects:
 *   { src: { directory: { 'App.jsx': { file: { contents } } } } }
 */
function filesToTree(files: AppFile[]): any {
  const root: any = {};
  for (const f of files) {
    if (!f?.path) continue;
    const parts = f.path.replace(/^\.?\/+/, '').split('/').filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        cursor[part] = { file: { contents: f.content ?? '' } };
      } else {
        if (!cursor[part]) cursor[part] = { directory: {} };
        cursor = cursor[part].directory;
      }
    }
  }
  return root;
}

/**
 * Best-effort: read both frontend and backend structures from the app.
 */
function collectFiles(app: any): AppFile[] {
  const out: AppFile[] = [];
  const push = (arr: any[]) =>
    (arr || []).forEach((f: any) => {
      if (f?.path && typeof f.content === 'string') out.push({ path: f.path, content: f.content });
    });
  push(app?.generatedCode?.frontend?.structure);
  push(app?.generatedCode?.backend?.structure);
  push(app?.generatedCode?.tests?.unitTests);
  push(app?.generatedCode?.tests?.integrationTests);
  // If a default package.json wasn't generated, fall back to a minimal Vite setup
  // so `npm install && npm run dev` works for previewing single-file demos.
  if (!out.some((f) => f.path === 'package.json')) {
    out.push({
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'appmaker-preview',
          private: true,
          type: 'module',
          scripts: { dev: 'vite --host 0.0.0.0 --port 3000' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: { vite: '^5.4.8', '@vitejs/plugin-react': '^4.3.1' },
        },
        null,
        2,
      ),
    });
  }
  if (!out.some((f) => f.path === 'vite.config.js' || f.path === 'vite.config.ts')) {
    out.push({
      path: 'vite.config.js',
      content:
        "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { host: '0.0.0.0', port: 3000 } });\n",
    });
  }
  if (!out.some((f) => f.path === 'index.html')) {
    out.push({
      path: 'index.html',
      content:
        '<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    });
  }
  if (!out.some((f) => f.path === 'src/main.jsx' || f.path === 'src/main.tsx')) {
    out.push({
      path: 'src/main.jsx',
      content:
        "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",
    });
  }
  return out;
}

// Singleton boot — WebContainer cannot be booted twice per page.
let bootPromise: Promise<WebContainer> | null = null;
async function bootWebContainer(): Promise<WebContainer> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const mod = await import('@webcontainer/api').catch((e) => {
      throw new Error(
        '@webcontainer/api is not installed. Run `npm install @webcontainer/api xterm xterm-addon-fit` in the frontend dir.\n' +
          String(e),
      );
    });
    return mod.WebContainer.boot();
  })();
  return bootPromise;
}

const LivePreview: React.FC<LivePreviewProps> = ({ app }) => {
  const { generating } = useAppSelector((state) => state.generation);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [status, setStatus] = useState<string>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const wcRef = useRef<WebContainer | null>(null);
  const runningRef = useRef(false);

  const files = useMemo(() => collectFiles(app), [app]);
  const hasFiles = files.some((f) => f.path !== 'package.json' && f.path !== 'vite.config.js' && f.content.trim());

  const appendLog = (s: string) => setLogs((prev) => (prev.length > 500 ? [...prev.slice(-500), s] : [...prev, s]));

  useEffect(() => {
    if (!hasFiles) return;
    if (runningRef.current) return;
    runningRef.current = true;
    setError('');
    setLogs([]);
    setPreviewUrl('');
    setStatus('booting');

    (async () => {
      try {
        const wc = await bootWebContainer();
        wcRef.current = wc;

        setStatus('mounting files');
        const tree = filesToTree(files);
        await wc.mount(tree);

        setStatus('npm install');
        const install = await wc.spawn('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error']);
        install.output.pipeTo(
          new WritableStream({
            write(chunk) {
              appendLog(chunk);
            },
          }),
        );
        const installCode = await install.exit;
        if (installCode !== 0) throw new Error(`npm install failed (exit ${installCode}). See terminal output.`);

        setStatus('npm run dev');
        const dev = await wc.spawn('npm', ['run', 'dev']);
        dev.output.pipeTo(
          new WritableStream({
            write(chunk) {
              appendLog(chunk);
            },
          }),
        );

        // server-ready fires when a port starts listening inside the container.
        wc.on('server-ready', (port: number, url: string) => {
          setPreviewUrl(url);
          setStatus(`ready on :${port}`);
        });
      } catch (err: any) {
        setError(err?.message || String(err));
        setStatus('error');
      } finally {
        runningRef.current = false;
      }
    })();
  }, [files, hasFiles]);

  if (!app?.generatedCode) {
    return (
      <div className="live-preview">
        <div className="preview-empty">
          <p>No code generated yet. Generate your app first to see a preview.</p>
        </div>
      </div>
    );
  }
  if (generating) {
    return (
      <div className="live-preview">
        <div className="preview-empty">
          <div className="spinner"></div>
          <p>Generating your app... files will boot in the WebContainer as soon as they're ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-preview">
      <div className="preview-header">
        <h3>Live Preview</h3>
        <div className="preview-actions">
          <span className="preview-status">{status}</span>
        </div>
      </div>
      <div className="preview-container">
        {error ? (
          <div className="preview-empty">
            <p style={{ color: '#c33' }}>Preview error: {error}</p>
            <details>
              <summary>Terminal output</summary>
              <pre style={{ maxHeight: 280, overflow: 'auto', textAlign: 'left' }}>{logs.join('')}</pre>
            </details>
          </div>
        ) : previewUrl ? (
          <iframe
            src={previewUrl}
            className="preview-iframe"
            title="Live Preview"
            // WebContainer requires same-origin iframe permissions for HMR + module workers.
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          />
        ) : (
          <div className="preview-loading">
            <div className="spinner"></div>
            <p>{status}</p>
            <pre style={{ maxHeight: 220, overflow: 'auto', textAlign: 'left', fontSize: 11 }}>{logs.slice(-60).join('')}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePreview;
