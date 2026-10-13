import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Exercise the installed package through Vite's normal optional-peer and asset resolution. */
export async function verifyPackedShikiConsumer({ fixtureDir, withShiki, expectedShikiVersion }) {
  const require = createRequire(join(fixtureDir, 'package.json'));
  if (expectedShikiVersion) assert.equal(require('shiki/package.json').version, expectedShikiVersion);
  if (!withShiki) assert.throws(() => require.resolve('shiki'), { code: 'MODULE_NOT_FOUND' });
  const { build, createLogger, preview } = await import(pathToFileURL(require.resolve('vite')).href);
  const { chromium } = await import('playwright');
  const root = join(fixtureDir, 'shiki-consumer');
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
  await writeFile(join(root, 'main.js'), `
import { setShikiCoreEngine } from '@aceshooting/lyra-ui/components/lr-code-block-core.js';
${withShiki ? '' : "import '@aceshooting/lyra-ui/components/lr-markdown.js';"}
window.renderCode = async (engine, highlight) => {
  if (engine !== 'default') setShikiCoreEngine(engine);
  const element = document.createElement('lr-code-block-core');
  element.code = 'alpha';
  if (highlight) {
    element.language = 'test';
    element.languages = { test: { name: 'test', scopeName: 'source.test', patterns: [{ match: 'alpha', name: 'keyword.control' }] } };
  }
  document.body.append(element);
  await element.updateComplete;
};
`);
  const warnings = [];
  const logger = createLogger('silent');
  logger.warn = logger.warnOnce = message => warnings.push(message);
  // No externalization, resolver aliases, asset bridges, or warning filters: these would hide
  // failures in the package's own optional-peer handling.
  const config = { configFile: false, root, customLogger: logger };
  await build(config);
  assert.deepEqual(warnings, [], 'The packed Shiki consumer must build without warnings');
  let server;
  let browser;
  try {
    server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } });
    browser = await chromium.launch({ headless: true });
    const cases = withShiki
      ? [{ engine: 'default', highlight: true }, { engine: 'javascript', highlight: true }, { engine: 'default', highlight: false }]
      : [{ engine: 'default', highlight: false }, { engine: 'default', highlight: true }];
    for (const { engine, highlight } of cases) {
      // Fresh contexts keep Shiki's module-level WASM cache from warming the next engine case.
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const errors = [];
        const binaryRequests = [];
        page.on('request', request => {
          if (new URL(request.url()).pathname.endsWith('.wasm')) binaryRequests.push(request.url());
        });
        page.on('pageerror', error => errors.push(String(error)));
        page.on('console', message => {
          if (message.type() === 'warning' || message.type() === 'error') errors.push(message.text());
        });
        await page.goto(server.resolvedUrls.local[0]);
        await page.waitForFunction(() => typeof window.renderCode === 'function');
        await page.evaluate(({ engine, highlight }) => window.renderCode(engine, highlight), { engine, highlight });
        await page.waitForFunction(highlighted => {
          const root = document.querySelector('lr-code-block-core')?.shadowRoot;
          if (highlighted) return [...(root?.querySelectorAll('pre.shiki span[style]') ?? [])]
            .some(span => span.textContent === 'alpha' && span.style.color !== '');
          return root?.querySelector('code')?.textContent?.includes('alpha') && !root.querySelector('pre.shiki');
        }, withShiki && highlight, { timeout: 30_000 });
        await page.waitForLoadState('networkidle');
        assert.equal(binaryRequests.length, withShiki && highlight && engine === 'default' ? 1 : 0,
          'Only requested Oniguruma highlighting may fetch the binary asset');
        assert.deepEqual(errors, [], `The ${engine} packed consumer must run without errors or warnings`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    if (server) await new Promise((accept, reject) => server.httpServer.close(error => error ? reject(error) : accept()));
  }
}
