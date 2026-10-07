import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { stripTestOnlyBuildExports } from './strip-test-only-build-exports.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-strip-test-exports-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function write(name, source) {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
    return file;
  }
  const source = write('src/internal/example.ts', 'export const testOnly = true;\nexport function useful() { return true; }\n');
  const js = write('dist/internal/example.js', '/** Private test seam. */\nexport const testOnly = true;\nexport function useful() { return true; }\n');
  const declaration = write('dist/internal/example.d.ts', '/** Private test seam. */\nexport declare const testOnly = true;\nexport declare function useful(): boolean;\n');
  return { root, write, source, js, declaration };
}

test('removes only audited test exports from emitted runtime and declarations', (t) => {
  const { root, js, declaration } = fixture(t);
  const result = stripTestOnlyBuildExports(root, { 'internal/example': ['testOnly'] });
  assert.deepEqual(result, { files: 2, exports: 1 });
  for (const file of [js, declaration]) {
    const published = readFileSync(file, 'utf8');
    assert.doesNotMatch(published, /testOnly|Private test seam/);
    assert.match(published, /useful/);
  }
});

test('an unexpected production reference fails before any emitted file changes', (t) => {
  const { root, write, js, declaration } = fixture(t);
  write('src/internal/consumer.ts', "import { testOnly } from './example.js';\nexport const value = testOnly;\n");
  const beforeJs = readFileSync(js, 'utf8');
  const beforeDeclaration = readFileSync(declaration, 'utf8');
  assert.throws(() => stripTestOnlyBuildExports(root, { 'internal/example': ['testOnly'] }),
    /referenced by production source/);
  assert.equal(readFileSync(js, 'utf8'), beforeJs);
  assert.equal(readFileSync(declaration, 'utf8'), beforeDeclaration);
  assert.equal(existsSync(js), true);
});

test('an owning-module reference also prevents emitted export removal', (t) => {
  const { root, source, js } = fixture(t);
  writeFileSync(source, 'export const testOnly = true;\nexport const accidental = testOnly;\n');
  const beforeJs = readFileSync(js, 'utf8');
  assert.throws(() => stripTestOnlyBuildExports(root, { 'internal/example': ['testOnly'] }),
    /referenced by owning production source/);
  assert.equal(readFileSync(js, 'utf8'), beforeJs);
});

test('a missing audited export fails before changing either emitted file', (t) => {
  const { root, js, declaration } = fixture(t);
  writeFileSync(declaration, 'export declare function useful(): boolean;\n');
  const beforeJs = readFileSync(js, 'utf8');
  assert.throws(() => stripTestOnlyBuildExports(root, { 'internal/example': ['testOnly'] }),
    /expected exactly one test-only export/);
  assert.equal(readFileSync(js, 'utf8'), beforeJs);
});
