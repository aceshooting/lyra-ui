import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { javascriptExportTargets, staticEngine3dReach, verifyEngine3dIsolation } from './engine-3d-isolation.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const requireFromPackage = createRequire(join(packageDir, 'package.json'));
const esbuild = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'))('esbuild');

test('collects every JavaScript export target once', () => {
  assert.deepEqual(javascriptExportTargets({
    '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    './a.js': './dist/a.js',
    './again.js': './dist/a.js',
    './theme.css': './dist/theme.css',
    './data.json': './data.json',
    './cli': { node: './dist/cli/run.mjs' },
    './internal/*': null,
  }), ['dist/a.js', 'dist/cli/run.mjs', 'dist/lyra.js']);
});

test('reports a static chain to the companion and ignores lazy imports', () => {
  const metafile = {
    inputs: {
      'dist/a.js': { imports: [{ path: 'dist/b.js', kind: 'import-statement' }] },
      'dist/b.js': { imports: [{ path: '@aceshooting/lyra-3d/graph', kind: 'import-statement', external: true }] },
      'dist/c.js': { imports: [{ path: '@aceshooting/lyra-3d/points', kind: 'dynamic-import', external: true }] },
      'dist/d.js': { imports: [{ path: 'three', kind: 'require-call', external: true }] },
      'dist/e.js': { imports: [{ path: '../node_modules/three/build/three.module.js', kind: 'import-statement' }] },
      'dist/f.js': { imports: [{ path: 'lit', kind: 'import-statement', external: true }, { path: 'dist/f.js', kind: 'import-statement' }] },
    },
  };
  assert.deepEqual(staticEngine3dReach(metafile, ['dist/a.js', 'dist/c.js', 'dist/d.js', 'dist/e.js', 'dist/f.js']), [
    { entry: 'dist/a.js', chain: ['dist/a.js', 'dist/b.js', '@aceshooting/lyra-3d/graph'] },
    { entry: 'dist/d.js', chain: ['dist/d.js', 'three'] },
    { entry: 'dist/e.js', chain: ['dist/e.js', '../node_modules/three/build/three.module.js'] },
  ]);
});

test('discriminates a static from a lazy companion import in a real esbuild graph', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-3d-isolation-'));
  try {
    mkdirSync(join(directory, 'dist'));
    writeFileSync(join(directory, 'dist/lazy.js'), "export const load = () => import('@aceshooting/lyra-3d/graph');\n");
    writeFileSync(join(directory, 'dist/shared.js'), "import { Scene } from 'three';\nexport const scene = () => new Scene();\n");
    writeFileSync(join(directory, 'dist/eager.js'), "export { scene } from './shared.js';\n");
    const exportsMap = { './lazy.js': './dist/lazy.js', './eager.js': './dist/eager.js' };
    const errors = await verifyEngine3dIsolation({ esbuild, packageDir: directory, exportsMap, external: [] });
    assert.deepEqual(errors, [
      'dist/eager.js: statically reaches three (dist/eager.js -> dist/shared.js -> three); load it with import() instead',
    ]);
    const clean = await verifyEngine3dIsolation({ esbuild, packageDir: directory, exportsMap: { './lazy.js': './dist/lazy.js' }, external: [] });
    assert.deepEqual(clean, []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
