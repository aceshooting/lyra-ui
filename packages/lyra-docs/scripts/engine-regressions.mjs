import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium, firefox, webkit } from 'playwright';
import { withPreparedSource } from './engine/source.mjs';
import { serveStatic } from './lib/static-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const scripts = path.join(root, 'scripts');
const lock = JSON.parse(await readFile(path.join(scripts, 'engine-source.lock.json'), 'utf8'));
const require = createRequire(path.join(root, 'package.json'));
const corePackage = require.resolve('@docx-editor.dev/core/package.json');
const peers = { chromium, firefox, webkit };
const names = (process.env.DOCX_BROWSERS ?? 'chromium,firefox,webkit').split(',');
assert(names.length && names.every(name => Object.hasOwn(peers, name))
  && new Set(names).size === names.length, 'Invalid or duplicate DOCX_BROWSERS');
const cases = ['table-preparation', 'refresh-preparation-rejection', 'refresh-preparation-cancellation'];
const mutant = process.env.DOCX_ENGINE_REGRESSION_MUTANT ?? '';
assert(['', 'refresh-rejection', 'refresh-cancellation'].includes(mutant), 'Unknown causal mutant');
const selected = mutant ? [mutant === 'refresh-rejection' ? cases[1] : cases[2]] : cases;
const report = { sourceVersion: lock.upstream.version, sourceCommit: lock.upstream.commit, mutant,
  scope: 'Locked source behavior with a test-only preparation delay/failure gate; not shipped artifact qualification.', checks: [] };
const sourceEntries = Object.fromEntries([
  ['', 'index'], ['/automation', 'automation/index'], ['/binding', 'binding/index'],
  ['/collaboration', 'collaboration/index'], ['/collaboration/replication', 'collaboration/replication'],
  ['/contracts/editor', 'contracts/editor'], ['/contracts/document', 'contracts/document'],
  ['/contracts/interaction', 'contracts/interaction'], ['/contracts/modules', 'contracts/modules'],
  ['/contracts/types', 'contracts/types-barrel'], ['/layout', 'layout/index'], ['/output', 'output/index'],
  ['/store', 'store/index'], ['/editor', 'editor/index'], ['/export', 'export/index'],
].map(([suffix, file]) => [`@docx-editor.dev/core${suffix}`, `src/${file}.ts`]));
const temporary = await mkdtemp(path.join(tmpdir(), 'lyra-docx-regressions-'));
const gateId = '\0docx-preparation-gate';
try {
  await withPreparedSource(lock, scripts, async directory => {
    const source = path.join(directory, 'packages/core');
    const editorFile = path.join(source, 'src/editor/docx-editor.ts');
    const preparationFile = path.join(source, 'src/features/document-preparation.ts');
    let mutantEdits = 0;
    await build({ configFile: false, root, publicDir: false, base: './',
      define: { __DOCX_HARFBUZZ_WASM_URL_SUPPORTED__: 'true' },
      plugins: [{ name: 'locked-engine-regressions', enforce: 'pre',
        async resolveId(id, importer) {
          if (id === 'virtual:docx-preparation-gate') return gateId;
          if (importer === editorFile && id === '../features/document-preparation.ts') return gateId;
          if (id.startsWith('virtual:docx-engine/')) {
            assert(importer?.startsWith(path.join(scripts, 'engine-regression-fixtures') + path.sep),
              'Engine source aliases are limited to regression fixtures');
            return path.join(source, 'src', id.slice('virtual:docx-engine/'.length));
          }
          if (Object.hasOwn(sourceEntries, id)) return path.join(source, sourceEntries[id]);
          if (id === 'module') return path.join(source, 'src/layout/node-module-shim.ts');
          if (importer?.startsWith(source + path.sep) && !id.startsWith('.') && !path.isAbsolute(id) && !id.startsWith('\0')) {
            assert(!id.startsWith('@docx-editor.dev/core'), `Unknown source route ${id}`);
            return this.resolve(id, corePackage, { skipSelf: true });
          }
        },
        load(id) {
          if (id !== gateId) return;
          return `import * as actual from ${JSON.stringify(preparationFile)};
export const preparePresentation = actual.preparePresentation;
let next;
export function gateNextPreparation() {
  if (next) throw new Error('Preparation gate already armed');
  let enter, finish, release, reject;
  const started = new Promise(r => enter = r), finished = new Promise(r => finish = r);
  const wait = new Promise((yes, no) => { release = yes; reject = no; });
  next = { enter, finish, wait };
  return { started, finished, release, reject };
}
export async function prepareDocument(...args) {
  const gate = next; next = undefined;
  if (!gate) return actual.prepareDocument(...args);
  gate.enter();
  try { await gate.wait; return await actual.prepareDocument(...args); }
  finally { gate.finish(); }
}`;
        },
        transform(code, id) {
          if (id !== editorFile || !mutant) return;
          const needle = mutant === 'refresh-rejection'
            ? '      refreshHost?.mounted(bytes, error);'
            : '      featureGeneration += 1;\n      featuresOpening = false;\n      mandatoryOpen = null;\n      deferredRefreshBytes = null;';
          assert.equal(code.split(needle).length - 1, 1, 'Causal mutant no longer identifies exactly one fix');
          mutantEdits++;
          return { code: code.replace(needle, mutant === 'refresh-rejection' ? '' : '      deferredRefreshBytes = null;'), map: null };
        },
      }],
      build: { outDir: temporary, emptyOutDir: false, minify: false, sourcemap: false,
        lib: { entry: path.join(scripts, 'engine-regression-fixtures/refresh-regressions.mjs'), formats: ['es'], fileName: () => 'regressions.js' } },
    });
    assert.equal(mutantEdits, mutant ? 1 : 0);
    await writeFile(path.join(temporary, 'index.html'), '<!doctype html><html><body><script type="module" src="./regressions.js"></script></body></html>');
    const server = serveStatic(temporary, { index: '/index.html', mime: { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      for (const name of names) {
        const browser = await peers[name].launch({ headless: true });
        try {
          for (const testCase of selected) {
            const page = await browser.newPage();
            const pageErrors = [], consoleErrors = [], requestFailures = [], externalRequests = [];
            page.on('pageerror', error => pageErrors.push(String(error)));
            page.on('console', message => {
              if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(`${message.type()}: ${message.text()}`);
            });
            page.on('requestfailed', request => requestFailures.push(`${request.url()}: ${request.failure()?.errorText}`));
            page.on('request', request => {
              const target = new URL(request.url());
              if (target.origin !== `http://127.0.0.1:${server.address().port}` && target.protocol !== 'data:') externalRequests.push(request.url());
            });
            try {
              await page.goto(`http://127.0.0.1:${server.address().port}`);
              await page.waitForFunction(() => typeof window.runEngineRegression === 'function');
              await page.evaluate(testCase => window.runEngineRegression(testCase), testCase);
              assert.deepEqual(pageErrors, [], 'Unhandled engine errors');
              assert.deepEqual(consoleErrors, [], 'Unexpected engine console warnings or errors');
              assert.deepEqual(requestFailures, [], 'Failed engine source requests');
              assert.deepEqual(externalRequests, [], 'Unexpected external engine source requests');
              report.checks.push({ browser: name, testCase, status: 'passed', pageErrors, consoleErrors, requestFailures, externalRequests });
            } catch (error) {
              report.checks.push({ browser: name, testCase, status: 'failed', error: String(error), pageErrors, consoleErrors, requestFailures, externalRequests });
            } finally { await page.close(); }
          }
        } finally { await browser.close(); }
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
  const reportFile = process.env.DOCX_ENGINE_REGRESSION_REPORT;
  if (reportFile) await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
assert(report.checks.length && report.checks.every(check => check.status === 'passed'), 'DOCX engine source regressions failed');
