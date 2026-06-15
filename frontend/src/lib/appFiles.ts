/**
 * Canonical generated-code shape + helpers.
 *
 * The streaming generator emits a flat list of files. UI consumers
 * (CodeEditor, LivePreview, WorkflowEditor, AIPrompt refine-context)
 * read a NESTED shape: generatedCode.frontend.structure / backend.structure
 * / tests.unitTests. These two shapes diverged and broke the
 * generate → view → refine loop (audit finding #1).
 *
 * This module is the single source of truth:
 *   - buildGeneratedCode(files) → the nested shape every reader expects,
 *     while ALSO preserving the flat `files` array for forward use.
 *   - getAppFiles(app) → flat {path,content}[] from whichever shape exists.
 *
 * Persist with buildGeneratedCode; read with getAppFiles. Never hand-build
 * the shape at a call-site again.
 */

export interface CodeFile {
  path: string;
  content: string;
  type?: string;
}

export interface GeneratedCode {
  /** Flat source of truth — every file the generator produced. */
  files?: CodeFile[];
  /** Shell commands to run (e.g. "npm install"). */
  shellCommands?: string[];
  frontend?: { structure?: CodeFile[]; dependencies?: Record<string, string> };
  backend?: { structure?: CodeFile[]; dependencies?: Record<string, string> };
  tests?: { unitTests?: CodeFile[]; integrationTests?: CodeFile[] };
  config?: { packageJson?: any; buildConfig?: any };
}

const BACKEND_HINTS = [
  /^server\//i, /^backend\//i, /(^|\/)api\//i,
  /(^|\/)routes\//i, /(^|\/)controllers\//i, /(^|\/)models\//i,
  /(^|\/)middleware\//i, /\.server\.[jt]sx?$/i, /^server\.[jt]s$/i,
];
const TEST_HINTS = [/\.test\./i, /\.spec\./i, /(^|\/)__tests__\//i, /(^|\/)tests?\//i];

function isTest(path: string)    { return TEST_HINTS.some((re) => re.test(path)); }
function isBackend(path: string) { return BACKEND_HINTS.some((re) => re.test(path)); }

/**
 * Split a flat file list into the nested shape readers expect, while keeping
 * the flat `files` array intact. `type` is preserved if present.
 */
export function buildGeneratedCode(files: CodeFile[], shellCommands?: string[]): GeneratedCode {
  const frontend: CodeFile[] = [];
  const backend: CodeFile[] = [];
  const tests: CodeFile[] = [];
  for (const f of files) {
    if (!f?.path || typeof f.content !== 'string') continue;
    if (isTest(f.path)) tests.push(f);
    else if (isBackend(f.path)) backend.push(f);
    else frontend.push(f);
  }
  return {
    files,
    shellCommands,
    frontend: { structure: frontend },
    backend:  { structure: backend },
    tests:    { unitTests: tests },
  };
}

/**
 * Read every file out of an app regardless of which shape it was stored in.
 * Prefers the flat `files` array; falls back to concatenating the nested
 * structures (handles legacy rows and partial data).
 */
export function getAppFiles(app: any): CodeFile[] {
  const gc: GeneratedCode | undefined = app?.generatedCode || app?.generated_code;
  if (!gc) return [];
  if (Array.isArray(gc.files) && gc.files.length) {
    return gc.files.filter((f) => f?.path && typeof f.content === 'string');
  }
  const out: CodeFile[] = [];
  const push = (arr?: CodeFile[]) =>
    (arr || []).forEach((f) => {
      if (f?.path && typeof f.content === 'string') out.push(f);
    });
  push(gc.frontend?.structure);
  push(gc.backend?.structure);
  push(gc.tests?.unitTests);
  push(gc.tests?.integrationTests);
  return out;
}

/** Count files across whichever shape is present. */
export function countAppFiles(app: any): number {
  return getAppFiles(app).length;
}
