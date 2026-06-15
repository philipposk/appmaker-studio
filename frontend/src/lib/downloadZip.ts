import JSZip from 'jszip';
import { getAppFiles } from './appFiles';

/**
 * Export a generated app as a .zip — entirely client-side. No backend.
 *
 * Replaces the old `downloadApp` thunk that fetched a zip from the (now
 * removed) Express endpoint `/generate/:id/download`. We already hold every
 * file in `app.generatedCode`, so we zip in the browser and trigger a download.
 */

function slugify(name: string): string {
  return (name || 'appmaker-export')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'appmaker-export';
}

export async function downloadAppZip(app: any): Promise<{ ok: boolean; fileCount: number }> {
  const files = getAppFiles(app);
  if (!files.length) return { ok: false, fileCount: 0 };

  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.path, f.content ?? '');
  }

  // A small README so the export is self-explanatory.
  const shell: string[] = app?.generatedCode?.shellCommands || app?.generated_code?.shellCommands || [];
  zip.file(
    'README.appmaker.md',
    [
      `# ${app?.name || 'AppMaker export'}`,
      '',
      app?.description ? `> ${app.description}` : '',
      '',
      'Generated with AppMaker (appmaker.6x7.gr).',
      '',
      '## Run',
      '```bash',
      ...(shell.length ? shell : ['npm install', 'npm run dev']),
      '```',
      '',
    ].join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(app?.name)}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { ok: true, fileCount: files.length };
}
