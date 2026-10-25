import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, symlink, readFile, writeFile, copyFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { build } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const selected = process.env.LYRA_3D_MODEL_PACKAGE_ROOT;
assert.ok(selected, 'Set LYRA_3D_MODEL_PACKAGE_ROOT to the exact unpacked package under qualification');
const packageRoot = resolve(selected);
const loaders = ['GLTFLoader', 'OBJLoader', 'PCDLoader', 'PLYLoader', 'STLLoader'];

test('packed XYZ requests exclude unused loaders and later OBJ/GLB load only their format modules', async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), 'lyra-model-loading-'));
  let server; let browser; let engineError;
  try {
    const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.name, '@aceshooting/lyra-3d');
    const installed = resolve(scratch, 'node_modules/@aceshooting'); await mkdir(installed, { recursive: true });
    await symlink(packageRoot, resolve(installed, 'lyra-3d'), 'dir');
    await symlink(await realpath(resolve(root, 'node_modules/three')), resolve(scratch, 'node_modules/three'), 'dir');
    await writeFile(resolve(scratch, 'package.json'), '{"private":true,"type":"module"}');
    await copyFile(resolve(root, 'test/browser/model-loading.mjs'), resolve(scratch, 'fixture.mjs'));
    await writeFile(resolve(scratch, 'index.html'), '<!doctype html><link rel="icon" href="data:,"><script type="module" src="./fixture.mjs"></script>');
    const graph = {};
    await build({ configFile: false, root: scratch, base: './', logLevel: 'warn', resolve: { preserveSymlinks: true }, plugins: [{ name: 'record-model-chunk-modules', generateBundle(_options, bundle) {
      for (const [name, chunk] of Object.entries(bundle)) if (chunk.type === 'chunk') graph[name] = { modules: Object.keys(chunk.modules), imports: chunk.imports, dynamicImports: chunk.dynamicImports };
    } }], build: { outDir: resolve(scratch, 'out'), modulePreload: false, minify: true, rolldownOptions: { onwarn(warning) { throw new Error(`Consumer build warning ${warning.code}: ${warning.message}`); } } } });
    const requests = [];
    server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const file = resolve(scratch, 'out', pathname === '/' ? 'index.html' : `.${pathname}`);
        if (!file.startsWith(resolve(scratch, 'out') + '/')) { response.writeHead(403).end(); return; }
        response.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream', 'cache-control': 'no-store' });
        response.end(await readFile(file));
      } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage();
    page.on('pageerror', error => { engineError = error; });
    page.on('request', request => { requests.push(new URL(request.url()).pathname.slice(1)); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForSelector('body[data-ready="true"]');
    const observedLoaders = () => [...new Set(requests.flatMap(path => (graph[path]?.modules ?? []).flatMap(module => loaders.filter(loader => module.replaceAll('\\', '/').endsWith(`/loaders/${loader}.js`)))))].sort();
    const save = async phase => {
      const result = process.env.LYRA_3D_MODEL_LOADING_RESULT;
      if (result) { await mkdir(dirname(resolve(result)), { recursive: true }); await writeFile(result, JSON.stringify({ phase, package: manifest.version, graph, requests, observedLoaders: observedLoaders() }, null, 2)); }
    };
    await page.evaluate(() => window.loadModelFormat('xyz'));
    await save('xyz');
    assert.deepEqual(observedLoaders(), [], 'real requested chunks for initial XYZ must not contain any of the five unused Three loaders');
    await page.evaluate(() => window.loadModelFormat('obj'));
    await save('obj');
    assert.deepEqual(observedLoaders(), ['OBJLoader']);
    await page.evaluate(() => window.loadModelFormat('glb'));
    await save('glb');
    assert.deepEqual(observedLoaders(), ['GLTFLoader', 'OBJLoader']);
    assert.equal(engineError, undefined);
    await page.evaluate(() => window.disposeModelFixture());
    await save('complete');
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(scratch, { recursive: true, force: true });
  }
});
