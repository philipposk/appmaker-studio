import { buildGeneratedCode, getAppFiles, countAppFiles } from './appFiles';

/**
 * Guards audit finding #1: the generator emits a flat file list, but every UI
 * reader (CodeEditor, LivePreview, WorkflowEditor) consumes the NESTED shape
 * (generatedCode.frontend.structure / backend.structure / tests.unitTests).
 * If save and read ever diverge again, the whole generate→view→refine loop
 * silently breaks. These tests assert the contract holds in both directions.
 */

const FILES = [
  { path: 'src/App.tsx', content: 'export default () => null;' },
  { path: 'package.json', content: '{"name":"x"}' },
  { path: 'server/index.ts', content: 'app.listen(3000)' },
  { path: 'src/App.test.tsx', content: 'test("x", () => {})' },
];

describe('buildGeneratedCode → reader shape', () => {
  const gc = buildGeneratedCode(FILES, ['npm install']);

  it('keeps the flat files array (source of truth)', () => {
    expect(gc.files).toHaveLength(4);
    expect(gc.shellCommands).toEqual(['npm install']);
  });

  it('populates the nested structure every UI reader expects', () => {
    // CodeEditor / LivePreview read these exact paths.
    expect(gc.frontend?.structure).toBeDefined();
    expect(gc.backend?.structure).toBeDefined();
    expect(gc.tests?.unitTests).toBeDefined();
  });

  it('routes files to the right bucket by path', () => {
    const fePaths = gc.frontend!.structure!.map((f) => f.path);
    const bePaths = gc.backend!.structure!.map((f) => f.path);
    const testPaths = gc.tests!.unitTests!.map((f) => f.path);
    expect(fePaths).toContain('src/App.tsx');
    expect(fePaths).toContain('package.json');
    expect(bePaths).toContain('server/index.ts');
    expect(testPaths).toContain('src/App.test.tsx');
  });
});

describe('getAppFiles → reads back what was saved', () => {
  it('round-trips through the nested shape (the prod path)', () => {
    const saved = { generatedCode: buildGeneratedCode(FILES) };
    const read = getAppFiles(saved);
    expect(read.map((f) => f.path).sort()).toEqual(FILES.map((f) => f.path).sort());
  });

  it('reads a legacy nested-only app (no flat files array)', () => {
    const legacy = {
      generatedCode: {
        frontend: { structure: [{ path: 'a.tsx', content: '1' }] },
        backend: { structure: [{ path: 'b.ts', content: '2' }] },
      },
    };
    expect(getAppFiles(legacy).map((f) => f.path)).toEqual(['a.tsx', 'b.ts']);
  });

  it('reads the snake_case generated_code key too', () => {
    const row = { generated_code: buildGeneratedCode(FILES) };
    expect(countAppFiles(row)).toBe(4);
  });

  it('returns [] for an app with no code', () => {
    expect(getAppFiles({})).toEqual([]);
    expect(countAppFiles(null)).toBe(0);
  });

  it('skips malformed entries (missing path/content)', () => {
    const messy = { generatedCode: { files: [{ path: 'ok.ts', content: 'x' }, { path: '' }, { content: 'y' }] } };
    expect(getAppFiles(messy)).toHaveLength(1);
  });
});
