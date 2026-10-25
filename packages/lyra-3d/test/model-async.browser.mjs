import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, symlink, readFile, writeFile, copyFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { chromium, firefox, webkit } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const selected = process.env.LYRA_3D_MODEL_PACKAGE_ROOT;
assert.ok(selected, 'Set LYRA_3D_MODEL_PACKAGE_ROOT to the exact unpacked package under qualification');
const packageRoot = resolve(selected);
const channel = process.env.LYRA_3D_BROWSER ?? 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(channel), 'Use a configured browser engine');
const suite = process.env.LYRA_3D_MODEL_ASYNC_SUITE ?? 'smoke';
assert.ok(['smoke', 'formats', 'ply', 'ply-required', 'all'].includes(suite));
const resultFile = process.env.LYRA_3D_MODEL_ASYNC_RESULT;
assert.ok(resultFile, 'Set LYRA_3D_MODEL_ASYNC_RESULT to retain the complete qualification receipt');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test(`packed async model ${suite} campaign (${channel})`, { timeout: 600000 }, async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), 'lyra-model-async-'));
  let server, browser;
  const receipt = { suite, channel, package: null, sourceHashes: {}, cases: [], status: 'starting' };
  const save = async () => { await mkdir(dirname(resolve(resultFile)), { recursive: true }); await writeFile(resultFile, JSON.stringify(receipt, null, 2)); };
  try {
    const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.name, '@aceshooting/lyra-3d'); receipt.package = manifest.version;
    for (const file of ['dist/model/index.js', 'dist/model/engine.js', 'dist/model/model-preparation.js', 'dist/model/model.worker.js']) receipt.sourceHashes[file] = digest(await readFile(resolve(packageRoot, file)));
    const installed = resolve(scratch, 'node_modules/@aceshooting'); await mkdir(installed, { recursive: true });
    await symlink(packageRoot, resolve(installed, 'lyra-3d'), 'dir');
    await symlink(await realpath(resolve(root, 'node_modules/three')), resolve(scratch, 'node_modules/three'), 'dir');
    await writeFile(resolve(scratch, 'package.json'), '{"private":true,"type":"module"}');
    for (const name of ['model-async.mjs', 'model-async-fixtures.mjs']) {
      const path = resolve(root, 'test/browser', name); receipt.sourceHashes[name] = digest(await readFile(path));
      await copyFile(path, resolve(scratch, name));
    }
    await writeFile(resolve(scratch, 'index.html'), '<!doctype html><link rel="icon" href="data:,"><body style="margin:0"><script type="module" src="./model-async.mjs"></script></body>');
    await build({ configFile: false, root: scratch, base: './', logLevel: 'warn', worker: { format: 'es' }, resolve: { preserveSymlinks: true }, build: { outDir: resolve(scratch, 'out'), modulePreload: false, minify: true, rolldownOptions: { onwarn(warning) { throw new Error(`Consumer build warning ${warning.code}: ${warning.message}`); } } } });
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
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await ({ chromium, firefox, webkit })[channel].launch({ headless: process.env.LYRA_3D_HEADED !== '1', ...(channel === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {}) });
    const context = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    const inventory = await context.newPage(); await inventory.goto(origin); await inventory.waitForSelector('body[data-ready="true"]', { state: 'attached' });
    const all = await inventory.evaluate(() => window.modelAsyncCases); await inventory.close();
    const cases = all.filter(name => suite === 'all' || (suite === 'ply-required' ? name.startsWith('ply:double-') && name.includes('-mesh-') : suite === 'ply' ? name.startsWith('ply:') : suite === 'formats' ? !name.startsWith('ply:') : ['parity:xyz', 'parity:gltf-png', 'worker-abort'].includes(name)));
    assert.ok(cases.length > 0); receipt.status = 'running'; await save();
    for (const name of cases) {
      const page = await context.newPage(); const entry = { name, status: 'running', pageErrors: [], requests: [], failedRequests: [], consoleErrors: [], workerUrls: [] };
      receipt.cases.push(entry);
      page.on('pageerror', error => entry.pageErrors.push(error.message));
      page.on('worker', worker => entry.workerUrls.push(worker.url()));
      page.on('console', message => { if (message.type() === 'error') entry.consoleErrors.push(message.text()); });
      const requested = request => entry.requests.push(request.url());
      const failed = request => entry.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText });
      context.on('request', requested); context.on('requestfailed', failed);
      try {
        await page.goto(origin); await page.waitForSelector('body[data-ready="true"]', { state: 'attached' });
        entry.result = await page.evaluate(name => Promise.race([
          window.runModelAsyncCase(name),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Bounded model case exceeded 60 seconds')), 60000)),
        ]), name);
        assert.deepEqual(entry.pageErrors, [], 'Unexpected uncaught browser exception');
        assert.deepEqual(entry.failedRequests, [], 'Unexpected failed resource request');
        assert.ok(entry.requests.every(url => url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')), 'Model requested an external resource');
        assert.deepEqual(entry.consoleErrors, [], 'Unexpected renderer console error');
        entry.renderingQualified = true;
        entry.status = 'passed';
      } catch (error) { entry.status = 'failed'; entry.error = error.message; }
      finally {
        await page.evaluate(() => window.cleanupModelAsync?.()).catch(() => {});
        await page.close(); context.off('request', requested); context.off('requestfailed', failed); await save();
      }
    }
    receipt.status = receipt.cases.every(entry => entry.status === 'passed') ? 'passed' : 'failed'; await save();
    assert.equal(receipt.status, 'passed', receipt.cases.filter(entry => entry.status === 'failed').map(entry => `${entry.name}: ${entry.error}`).join('\n'));
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(scratch, { recursive: true, force: true });
    await save();
  }
});
