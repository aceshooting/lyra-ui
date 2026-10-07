import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { bundleInitialRoute } from './bundle-initial-entry.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const esbuild = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');

test('callable initial routes retain exports while deferring dynamic chunks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-initial-entry-'));
  try {
    await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module', sideEffects: false }));
    await writeFile(join(directory, 'loader.js'), 'export async function loadValue() { return (await import("./lazy.js")).value; }');
    await writeFile(join(directory, 'lazy.js'), 'export const value = "loaded";');
    let output;
    const instrumented = { build: async options => (output = await esbuild.build(options)) };
    const bare = await bundleInitialRoute(instrumented, directory, [], 'bare', ['loader.js']);
    assert.equal(bare.gzipBytes, gzipSync('', { level: 9 }).length);
    const callable = await bundleInitialRoute(instrumented, directory, [], 'callable', ['loader.js'], true);
    const [entryPath, entry] = Object.entries(output.metafile.outputs).find(([, value]) => value.entryPoint === 'bundle-initial-callable.js');
    assert.deepEqual(entry.exports, ['loadValue']);
    assert.ok(entry.imports.some(imported => imported.kind === 'dynamic-import'));
    assert.equal(callable.outputCount, 1);
    const bytes = output.outputFiles.find(file => file.path.endsWith(entryPath.replace(/^.*[\\/]/u, ''))).contents;
    assert.equal(callable.gzipBytes, gzipSync(bytes, { level: 9 }).length);
    assert.ok(callable.gzipBytes > bare.gzipBytes);
    for (const file of output.outputFiles) {
      await writeFile(join(directory, basename(file.path)), file.contents);
    }
    const entryModule = await import(pathToFileURL(join(directory, basename(entryPath))).href);
    assert.equal(await entryModule.loadValue(), 'loaded');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('initial routes include static shared chunks and exclude deferred payloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-initial-shared-'));
  try {
    await writeFile(join(directory, 'shared.js'), 'export const value = globalThis.sharedValue;');
    await writeFile(join(directory, 'loader.js'), 'import { value } from "./shared.js"; export const initialValue = value; export async function loadValue() { return (await import("./lazy.js")).value; }');
    await writeFile(join(directory, 'lazy.js'), 'export { value } from "./shared.js"; export const payload = "deferred payload";');
    let output;
    const instrumented = { build: async options => (output = await esbuild.build(options)) };
    const measured = await bundleInitialRoute(instrumented, directory, [], 'shared', ['loader.js'], true);
    const [entryPath, entry] = Object.entries(output.metafile.outputs).find(([, value]) => value.entryPoint === 'bundle-initial-shared.js');
    const staticPaths = [entryPath, ...entry.imports.filter(value => value.kind !== 'dynamic-import').map(value => value.path)];
    assert.equal(staticPaths.length, 2, 'fixture must produce a separate static shared chunk');
    assert.equal(measured.outputCount, staticPaths.length);
    const expectedGzip = output.outputFiles
      .filter(file => staticPaths.some(value => basename(value) === basename(file.path)))
      .reduce((total, file) => total + gzipSync(file.contents, { level: 9 }).length, 0);
    assert.equal(measured.gzipBytes, expectedGzip);
    const allGzip = output.outputFiles.reduce((total, file) => total + gzipSync(file.contents, { level: 9 }).length, 0);
    assert.ok(allGzip > measured.gzipBytes, 'deferred bytes must not enter the initial route');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('registration routes retain side effects with the existing bare-import semantics', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-initial-registration-'));
  try {
    await writeFile(join(directory, 'register.js'), 'globalThis.registered = true; export const unused = 123;');
    let output;
    const instrumented = { build: async options => (output = await esbuild.build(options)) };
    const measured = await bundleInitialRoute(instrumented, directory, [], 'registration', ['register.js']);
    const entry = Object.values(output.metafile.outputs).find(value => value.entryPoint === 'bundle-initial-registration.js');
    assert.deepEqual(entry.exports, []);
    assert.match(output.outputFiles[0].text, /registered/);
    assert.equal(measured.outputCount, 1);
    assert.ok(measured.gzipBytes > gzipSync('', { level: 9 }).length);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
