import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { findUnguardedPeerImports, guardBuildPeerImports, guardPeerImports, optionalPeerNames } from './guard-optional-peer-imports.mjs';

const requireFromPackage = createRequire(join(dirname(dirname(fileURLToPath(import.meta.url))), 'package.json'));
const { build } = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'))('esbuild');
const peers = ['dompurify', '@aceshooting/lyra-map'];

test('reads only peers declared optional', () => {
  assert.deepEqual(optionalPeerNames({ peerDependenciesMeta: { a: { optional: true }, b: { optional: false }, c: {} } }), ['a']);
  assert.deepEqual(optionalPeerNames({}), []);
});

test('finds peer specifiers and subpaths, and nothing else', () => {
  const source = `const a=()=>import("dompurify"),b=()=>import("@aceshooting/lyra-map/scene"),c=()=>import("./local.js"),d=()=>import("dompurify-like"),e="import('dompurify')";`;
  assert.deepEqual(findUnguardedPeerImports(source, peers).map(({ specifier }) => specifier), ['dompurify', '@aceshooting/lyra-map/scene']);
});

test('a try block in an enclosing function does not guard a nested import', () => {
  assert.equal(findUnguardedPeerImports('async function a(){try{return ()=>import("dompurify")}catch(e){throw e}}', peers).length, 1);
  assert.equal(findUnguardedPeerImports('async function a(){try{return await import("dompurify")}catch(e){throw e}}', peers).length, 0);
  assert.equal(findUnguardedPeerImports('async function a(){try{}catch(e){return import("dompurify")}}', peers).length, 1);
});

test('offsets stay correct after non-ASCII text', () => {
  const guarded = guardPeerImports('const a="é😀";export const b=()=>import("dompurify");', peers);
  assert.equal(guarded, 'const a="é😀";export const b=()=>(async()=>{try{return await import("dompurify")}catch(e){throw e}})();');
});

test('guarding is idempotent and keeps import attributes', () => {
  const guarded = guardPeerImports('export const a=()=>import("dompurify",{with:{type:"json"}});', peers);
  assert.ok(guarded.includes('import("dompurify",{with:{type:"json"}})'));
  assert.deepEqual(findUnguardedPeerImports(guarded, peers), []);
  assert.equal(guardPeerImports(guarded, peers), guarded);
});

test('a guarded missing peer builds in esbuild where a bare one fails, and still rejects at run time', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyra-guard-'));
  try {
    const bare = 'export const load = () => import("no-such-optional-peer");\n';
    writeFileSync(join(dir, 'bare.js'), bare);
    writeFileSync(join(dir, 'guarded.js'), guardPeerImports(bare, ['no-such-optional-peer']));
    const options = { bundle: true, write: false, format: 'esm', logLevel: 'silent', absWorkingDir: dir };
    await assert.rejects(build({ ...options, entryPoints: ['bare.js'] }));
    const { outputFiles } = await build({ ...options, entryPoints: ['guarded.js'] });
    const emitted = join(dir, 'emitted.mjs');
    writeFileSync(emitted, outputFiles[0].text);
    const { load } = await import(emitted);
    await assert.rejects(load(), { code: 'ERR_MODULE_NOT_FOUND' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rewrites only modules with an unguarded peer import', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyra-guard-'));
  try {
    mkdirSync(join(dir, 'nested'));
    writeFileSync(join(dir, 'nested', 'a.js'), 'export const a=()=>import("dompurify");');
    writeFileSync(join(dir, 'b.js'), 'export const b=()=>import("./a.js");');
    assert.deepEqual(await guardBuildPeerImports(dir, peers), { imports: 1, files: 1 });
    assert.deepEqual(findUnguardedPeerImports(readFileSync(join(dir, 'nested', 'a.js'), 'utf8'), peers), []);
    assert.equal(readFileSync(join(dir, 'b.js'), 'utf8'), 'export const b=()=>import("./a.js");');
    assert.deepEqual(await guardBuildPeerImports(dir, peers), { imports: 0, files: 0 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
