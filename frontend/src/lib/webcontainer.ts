/**
 * Shared in-browser WebContainer runtime.
 *
 * WebContainer can only boot ONCE per page, so the boot promise and the
 * filesystem are a singleton shared by every consumer (LivePreview, TestRunner).
 * Booting it independently in two components throws "WebContainer already booted".
 *
 * Also fixes audit #8: node_modules persists across mounts in the same booted
 * instance, so we skip `npm install` when package.json is unchanged instead of
 * reinstalling on every file change.
 */

type WebContainer = any;

export interface WCFile {
  path: string;
  content: string;
}

let bootPromise: Promise<WebContainer> | null = null;
let lastInstallSig: string | null = null;

/** Boot (or reuse) the singleton WebContainer. Lazily imports the SDK. */
export async function bootWebContainer(): Promise<WebContainer> {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const mod = await import('@webcontainer/api').catch((e) => {
      throw new Error('@webcontainer/api failed to load: ' + String(e));
    });
    return mod.WebContainer.boot();
  })();
  return bootPromise;
}

/** Flat file list → the nested FileSystemTree WebContainer expects. */
export function filesToTree(files: WCFile[]): any {
  const root: any = {};
  for (const f of files) {
    if (!f?.path) continue;
    const parts = f.path.replace(/^\.?\/+/, '').split('/').filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (isLeaf) cursor[part] = { file: { contents: f.content ?? '' } };
      else {
        if (!cursor[part]) cursor[part] = { directory: {} };
        cursor = cursor[part].directory;
      }
    }
  }
  return root;
}

function packageJsonOf(files: WCFile[]): string {
  return files.find((f) => f.path === 'package.json')?.content ?? '';
}

/** Run a command to completion, streaming output to onLog. Returns exit code. */
export async function runProcess(
  wc: WebContainer,
  cmd: string,
  args: string[],
  onLog?: (chunk: string) => void,
): Promise<number> {
  const proc = await wc.spawn(cmd, args);
  if (onLog) {
    proc.output.pipeTo(new WritableStream({ write: (c: string) => onLog(c) }));
  }
  return proc.exit;
}

/**
 * Mount files and install deps only if package.json changed since the last
 * install (node_modules persists in the singleton fs). Returns whether an
 * install actually ran.
 */
export async function mountAndInstall(
  wc: WebContainer,
  files: WCFile[],
  onLog?: (chunk: string) => void,
): Promise<{ installed: boolean }> {
  await wc.mount(filesToTree(files));
  const sig = packageJsonOf(files);
  if (sig && sig === lastInstallSig) {
    return { installed: false }; // deps unchanged — skip the slow step
  }
  const code = await runProcess(wc, 'npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], onLog);
  if (code !== 0) throw new Error(`npm install failed (exit ${code}).`);
  lastInstallSig = sig;
  return { installed: true };
}

/** Force the next mountAndInstall to reinstall (e.g. after a reset). */
export function invalidateInstallCache() {
  lastInstallSig = null;
}
