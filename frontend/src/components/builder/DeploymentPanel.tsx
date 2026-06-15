import React, { useState } from 'react';
import { TOKENS, I } from '../../design';
import { downloadAppZip } from '../../lib/downloadZip';
import { countAppFiles } from '../../lib/appFiles';

interface DeploymentPanelProps {
  app: any;
}

/**
 * Deployment panel.
 *
 * Download is fully client-side (zips the generated files in the browser).
 * "Deploy" no longer calls the removed Express backend — generated apps ship
 * to production by exporting and pushing to Vercel/GitHub (the 6x7 platform's
 * hosting). We surface clear instructions instead of a dead button.
 */
const DeploymentPanel: React.FC<DeploymentPanelProps> = ({ app }) => {
  const fileCount = countAppFiles(app);
  const hasCode = fileCount > 0;
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState('');

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadErr('');
    try {
      const res = await downloadAppZip(app);
      if (!res.ok) setDownloadErr('Nothing to export yet — generate the app first.');
    } catch (e: any) {
      setDownloadErr(e?.message || 'Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', fontFamily: TOKENS.sans, color: TOKENS.text1 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600 }}>Deploy &amp; export</h3>
        <p style={{ margin: 0, color: TOKENS.text3, fontSize: 13.5 }}>
          Download your app or ship it to production.
        </p>
      </div>

      {!hasCode && (
        <div style={card('dashed')}>
          <p style={{ margin: 0, color: TOKENS.text3, fontSize: 13.5 }}>
            No code generated yet. Use the chat to generate your app first.
          </p>
        </div>
      )}

      {hasCode && (
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Download */}
          <div style={card()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={iconBox(TOKENS.accent)}><I.Code size={16} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Download source ({fileCount} files)</div>
                <div style={{ fontSize: 12.5, color: TOKENS.text3 }}>Full project as a .zip, ready to run.</div>
              </div>
            </div>
            <button onClick={handleDownload} disabled={downloading} style={primaryBtn(downloading)}>
              <I.Code size={14} /> {downloading ? 'Zipping…' : 'Download .zip'}
            </button>
            {downloadErr && (
              <div style={{ marginTop: 8, color: '#FF8E72', fontSize: 12.5 }}>{downloadErr}</div>
            )}
          </div>

          {/* Deploy to production */}
          <div style={card()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={iconBox(TOKENS.green)}><I.Rocket size={16} /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Deploy to production</div>
                <div style={{ fontSize: 12.5, color: TOKENS.text3 }}>Host it on the 6x7 platform (Vercel).</div>
              </div>
            </div>
            <ol style={{ margin: '4px 0 12px', paddingLeft: 18, color: TOKENS.text2, fontSize: 13, lineHeight: 1.7 }}>
              <li>Download the .zip above and push it to a Git repo.</li>
              <li>Import the repo in Vercel and add it as a 6x7.gr subdomain.</li>
              <li>Point its env at the shared Supabase project — done.</li>
            </ol>
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noreferrer noopener"
              style={{ ...secondaryBtn, textDecoration: 'none', width: 'fit-content' }}
            >
              <I.Globe size={14} /> Open Vercel
            </a>
          </div>

          {/* Current deployment status, if any */}
          {app.deployment?.url && (
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: TOKENS.green }} />
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>Live</span>
              </div>
              <a href={app.deployment.url} target="_blank" rel="noreferrer noopener"
                 style={{ color: TOKENS.accent, fontSize: 13, fontFamily: TOKENS.mono }}>
                {app.deployment.url}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* style helpers */
const card = (border: 'solid' | 'dashed' = 'solid'): React.CSSProperties => ({
  background: TOKENS.panel,
  border: `1px ${border} ${border === 'dashed' ? TOKENS.hairline2 : TOKENS.hairline}`,
  borderRadius: 12,
  padding: 16,
});
const iconBox = (color: string): React.CSSProperties => ({
  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
  background: 'rgba(255,255,255,0.04)', color, display: 'grid', placeItems: 'center',
});
const primaryBtn = (busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', borderRadius: 8, border: 0,
  background: TOKENS.accent, color: '#0B0B0E', fontSize: 13, fontWeight: 500,
  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
  fontFamily: TOKENS.sans,
});
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', borderRadius: 8, border: `1px solid ${TOKENS.hairline2}`,
  background: 'transparent', color: TOKENS.text1, fontSize: 13, cursor: 'pointer',
  fontFamily: TOKENS.sans,
};

export default DeploymentPanel;
