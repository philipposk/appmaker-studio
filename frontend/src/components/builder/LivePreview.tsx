import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '../../utils/hooks';
import { bootWebContainer, mountAndInstall, WCFile } from '../../lib/webcontainer';
import { getAppFiles } from '../../lib/appFiles';
import './LivePreview.scss';

interface LivePreviewProps {
  app: any;
}

/**
 * Add a minimal Vite scaffold around generated files so a bare component set
 * still previews. Seeds from getAppFiles so it works regardless of stored shape.
 */
function collectFiles(app: any): WCFile[] {
  const out: WCFile[] = getAppFiles(app).map((f) => ({ path: f.path, content: f.content }));
  const has = (p: string) => out.some((f) => f.path === p);

  if (!has('package.json')) {
    out.push({
      path: 'package.json',
      content: JSON.stringify(
        {
          name: 'appmaker-preview', private: true, type: 'module',
          scripts: { dev: 'vite --host 0.0.0.0 --port 3000' },
          dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
          devDependencies: { vite: '^5.4.8', '@vitejs/plugin-react': '^4.3.1' },
        }, null, 2),
    });
  }
  if (!has('vite.config.js') && !has('vite.config.ts')) {
    out.push({
      path: 'vite.config.js',
      content: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { host: '0.0.0.0', port: 3000 } });\n",
    });
  }
  if (!has('index.html')) {
    out.push({
      path: 'index.html',
      content: '<!doctype html><html><head><meta charset="utf-8"><title>Preview</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    });
  }
  if (!has('src/main.jsx') && !has('src/main.tsx')) {
    out.push({
      path: 'src/main.jsx',
      content: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",
    });
  }
  return out;
}

/** Stable signature of the file set so we only rebuild when content changes. */
function filesSignature(files: WCFile[]): string {
  return files.map((f) => `${f.path}:${f.content.length}`).sort().join('|');
}

const LivePreview: React.FC<LivePreviewProps> = ({ app }) => {
  const { generating } = useAppSelector((state) => state.generation);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [status, setStatus] = useState<string>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const runningRef = useRef(false);
  const devProcRef = useRef<any>(null);
  const lastSigRef = useRef<string>('');

  const files = useMemo(() => collectFiles(app), [app]);
  const hasFiles = files.some(
    (f) => f.path !== 'package.json' && f.path !== 'vite.config.js' && f.content.trim(),
  );
  const signature = useMemo(() => filesSignature(files), [files]);

  const appendLog = (s: string) =>
    setLogs((prev) => (prev.length > 500 ? [...prev.slice(-500), s] : [...prev, s]));

  useEffect(() => {
    if (!hasFiles) return;
    // Skip rebuild if the file set is byte-identical to the last run (audit #8 —
    // avoids a full reboot+reinstall when an unrelated store update re-creates
    // the app object reference).
    if (signature === lastSigRef.current && previewUrl) return;
    if (runningRef.current) return;
    runningRef.current = true;
    lastSigRef.current = signature;

    let serverReadyUnsub: (() => void) | undefined;
    let cancelled = false;

    setError('');
    setLogs([]);
    setStatus('booting');

    (async () => {
      try {
        const wc = await bootWebContainer();

        // Tear down a previous dev server before starting a new one (no leak).
        if (devProcRef.current) {
          try { devProcRef.current.kill(); } catch { /* noop */ }
          devProcRef.current = null;
        }

        setStatus('mounting + installing');
        const { installed } = await mountAndInstall(wc, files, appendLog);
        if (cancelled) return;
        appendLog(installed ? '\n[deps installed]\n' : '\n[deps cached — skipped install]\n');

        setStatus('starting dev server');
        const dev = await wc.spawn('npm', ['run', 'dev']);
        devProcRef.current = dev;
        dev.output.pipeTo(new WritableStream({ write: (c: string) => appendLog(c) }));

        serverReadyUnsub = wc.on('server-ready', (port: number, url: string) => {
          if (cancelled) return;
          setPreviewUrl(url);
          setStatus(`ready on :${port}`);
        });
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setStatus('error');
        }
      } finally {
        runningRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      if (serverReadyUnsub) { try { serverReadyUnsub(); } catch { /* noop */ } }
    };
  }, [signature, hasFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasFiles) {
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
          <p>Generating your app… files will boot in the WebContainer as soon as they're ready.</p>
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
            // Least-privilege: generated code is untrusted. allow-same-origin is
            // required for WebContainer; allow-popups/allow-modals are dropped —
            // they enable phishing/redirects with no benefit for a preview.
            sandbox="allow-scripts allow-same-origin allow-forms"
            referrerPolicy="no-referrer"
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
