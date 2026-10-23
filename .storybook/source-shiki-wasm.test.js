import './source-shiki-wasm-owner.test.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build, createLogger, createServer, preview } from 'vite';
import { chromium } from 'playwright';
import storybook from './main.js';
import { sourceShikiWasmPlugin } from './source-shiki-wasm.js';
import { reviewedSha256 } from '../packages/lyra-ui/scripts/generate-shiki-wasm.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const sourceModule = fileURLToPath(new URL('../packages/lyra-ui/src/components/conversation/code-block/shiki-oniguruma.ts', import.meta.url));
const coreModule = fileURLToPath(new URL('../packages/lyra-ui/src/components/conversation/code-block/shiki-types.ts', import.meta.url));
const codeBlockModule = fileURLToPath(new URL('../packages/lyra-ui/src/components/lr-code-block-core.ts', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('source asset bridge only transforms the exact Shiki source module', () => {
  const plugin = sourceShikiWasmPlugin();
  const source = "fetch(new URL('./onig.wasm', import.meta.url))";
  assert.equal(plugin.transform(source, '/another/shiki-oniguruma.ts'), undefined);
  assert.equal(plugin.transform(source, sourceModule.replace('/src/', '/dist/')), undefined);
  assert.throws(() => plugin.transform('', sourceModule), /exactly one/);
  assert.throws(() => plugin.transform(source + source, sourceModule), /exactly one/);
});

test('source Storybook builds and serves reviewed WASM without dist', async t => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-source-shiki-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  const fixtureSource = `
import { loadShikiHighlighterCore, setShikiCoreEngine } from ${JSON.stringify(coreModule)};
import { createShikiOnigurumaEngine } from ${JSON.stringify(sourceModule)};
import ${JSON.stringify(codeBlockModule)};
window.renderPlainCode = async () => {
  const element = document.createElement('lr-code-block-core');
  element.code = 'alpha';
  document.body.append(element);
  await element.updateComplete;
  return element.shadowRoot.querySelector('code')?.textContent;
};
window.highlight = async engine => {
  setShikiCoreEngine(engine === 'oniguruma' ? createShikiOnigurumaEngine : engine);
  const highlighter = await loadShikiHighlighterCore({ test: {
    name: 'test', scopeName: 'source.test', patterns: [{ match: 'alpha', name: 'keyword.control' }]
  } });
  return highlighter?.codeToHtml('alpha', { lang: 'test', theme: 'github-light' });
};
`;
  const configured = await storybook.viteFinal({});
  const plugins = configured.plugins.filter(plugin =>
    ['lyra-source-shiki-wasm', 'lyra-source-diagnostic-condition'].includes(plugin.name));
  assert.equal(plugins.length, 2, 'Storybook must install both source integrations');
  plugins.push({
    name: 'reject-built-library', enforce: 'pre',
    load(id) {
      assert.ok(!id.replaceAll('\\', '/').includes('/packages/lyra-ui/dist/'),
        'Source stories must not require a built library');
    },
  });
  const warnings = [];
  const logger = createLogger('silent');
  logger.warn = logger.warnOnce = message => warnings.push(message);
  const config = {
    configFile: false, root, plugins, customLogger: logger,
    server: { host: '127.0.0.1', port: 0, fs: { allow: [repository, root] } },
    preview: { host: '127.0.0.1', port: 0 },
  };
  await writeFile(join(root, 'main.js'), `
import { loadShikiHighlighterCore } from ${JSON.stringify(coreModule)};
import ${JSON.stringify(codeBlockModule)};
window.highlightDefault = () => loadShikiHighlighterCore({});
`);
  const defaultResult = await build(config);
  assert.equal(defaultResult.output.filter(file => file.fileName.endsWith('.wasm')).length, 0,
    'Default source stories must not emit the opt-in binary');
  assert.deepEqual(warnings, [], 'Default source build must not warn');
  await writeFile(join(root, 'main.js'), fixtureSource);
  const result = await build(config);
  const binaries = result.output.filter(file => file.fileName.endsWith('.wasm'));
  assert.equal(binaries.length, 1);
  assert.equal(hash(binaries[0].source), reviewedSha256);
  assert.deepEqual(warnings, [], 'Source build must resolve the asset without warnings');
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const mode of ['preview', 'dev']) {
    const server = mode === 'preview' ? await preview(config) : await createServer(config);
    try {
      if (mode === 'dev') await server.listen();
      for (const engine of ['oniguruma', 'javascript']) {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          const responses = [];
          const errors = [];
          page.on('pageerror', error => errors.push(String(error)));
          page.on('response', response => {
            if (new URL(response.url()).pathname.endsWith('.wasm')) responses.push(response);
          });
          await page.goto(server.resolvedUrls.local[0]);
          await page.waitForFunction(() => typeof window.highlight === 'function');
          assert.equal(await page.evaluate(() => window.renderPlainCode()), 'alpha');
          assert.equal(responses.length, 0, 'Loading source stories must not fetch WASM');
          const html = await page.evaluate(engine => window.highlight(engine), engine);
          assert.match(html ?? '', /<span style="color:[^"]+">alpha<\/span>/);
          assert.equal(responses.length, engine === 'oniguruma' ? 1 : 0);
          if (responses.length) {
            assert.equal(responses[0].status(), 200);
            assert.equal(hash(await responses[0].body()), reviewedSha256);
          }
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      }
    } finally {
      if (mode === 'dev') await server.close();
      else await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    }
  }
  assert.deepEqual(warnings, [], 'Source dev serving must resolve the asset without warnings');
});
