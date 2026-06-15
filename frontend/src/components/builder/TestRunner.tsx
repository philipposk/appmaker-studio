import React, { useMemo, useRef, useState } from 'react';
import { TOKENS, I } from '../../design';
import { bootWebContainer, mountAndInstall, runProcess } from '../../lib/webcontainer';
import { getAppFiles } from '../../lib/appFiles';

interface TestRunnerProps {
  app: any;
}

/**
 * Runs the generated app's test suite in the browser WebContainer — no
 * backend. Replaces the old api.post('/apps/:id/tests/run') that hit a dead
 * Express server. Detects the package.json `test` script; streams output;
 * reports pass/fail by exit code with a best-effort summary parse.
 */
const TestRunner: React.FC<TestRunnerProps> = ({ app }) => {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  const files = useMemo(() => getAppFiles(app).map((f) => ({ path: f.path, content: f.content })), [app]);
  const pkg = useMemo(() => {
    try { return JSON.parse(files.find((f) => f.path === 'package.json')?.content || '{}'); }
    catch { return {}; }
  }, [files]);
  const hasTestScript = !!pkg?.scripts?.test && !/no test specified/.test(pkg.scripts.test);
  const testFileCount = files.filter((f) => /\.(test|spec)\./.test(f.path) || /__tests__\//.test(f.path)).length;

  const append = (s: string) => {
    setOutput((prev) => (prev.length > 40000 ? prev.slice(-40000) + s : prev + s));
    requestAnimationFrame(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight));
  };

  const handleRun = async () => {
    setRunning(true); setOutput(''); setResult(null); setError('');
    try {
      const wc = await bootWebContainer();
      append('› mounting files + installing deps…\n');
      await mountAndInstall(wc, files, append);
      append('\n› npm test\n\n');
      const code = await runProcess(wc, 'npm', ['test', '--', '--run'], append);
      setResult(code === 0 ? 'pass' : 'fail');
    } catch (e: any) {
      setError(e?.message || String(e));
      setResult('fail');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: '0 auto', fontFamily: TOKENS.sans, color: TOKENS.text1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Tests</h3>
          <p style={{ margin: 0, color: TOKENS.text3, fontSize: 13.5 }}>
            {testFileCount > 0 ? `${testFileCount} test file${testFileCount > 1 ? 's' : ''} · ` : ''}
            runs in your browser (WebContainer)
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running || !hasTestScript}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', borderRadius: 8, border: 0,
            background: hasTestScript ? TOKENS.accent : TOKENS.panel2,
            color: hasTestScript ? '#0B0B0E' : TOKENS.text4,
            fontSize: 13, fontWeight: 500, fontFamily: TOKENS.sans,
            cursor: running || !hasTestScript ? 'not-allowed' : 'pointer',
            opacity: running ? 0.7 : 1,
          }}
        >
          <I.Play size={13} /> {running ? 'Running…' : 'Run tests'}
        </button>
      </div>

      {!hasTestScript && (
        <div style={{
          padding: 16, borderRadius: 12, background: TOKENS.panel,
          border: `1px dashed ${TOKENS.hairline2}`, color: TOKENS.text3, fontSize: 13.5,
        }}>
          No <code style={{ fontFamily: TOKENS.mono, color: TOKENS.text2 }}>test</code> script in this app's
          package.json yet. Ask the builder to add tests, then run them here.
        </div>
      )}

      {result && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          padding: '10px 14px', borderRadius: 10,
          background: result === 'pass' ? 'rgba(74,222,128,0.1)' : 'rgba(255,142,114,0.1)',
          border: `1px solid ${result === 'pass' ? 'rgba(74,222,128,0.25)' : 'rgba(255,142,114,0.25)'}`,
          color: result === 'pass' ? TOKENS.green : '#FF8E72', fontSize: 13.5, fontWeight: 500,
        }}>
          {result === 'pass' ? <I.Check size={15} /> : <span>✕</span>}
          {result === 'pass' ? 'All tests passed' : 'Tests failed'}
        </div>
      )}

      {error && <div style={{ color: '#FF8E72', fontSize: 13, marginBottom: 10 }}>{error}</div>}

      {(output || running) && (
        <pre
          ref={logRef}
          style={{
            fontFamily: TOKENS.mono, fontSize: 11.5, lineHeight: 1.5,
            color: TOKENS.text2, background: TOKENS.bg,
            border: `1px solid ${TOKENS.hairline}`, borderRadius: 10,
            padding: 14, maxHeight: 420, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap',
          }}
        >
          {output || 'booting…'}
        </pre>
      )}
    </div>
  );
};

export default TestRunner;
