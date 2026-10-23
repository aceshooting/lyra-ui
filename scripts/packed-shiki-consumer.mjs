import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Exercise explicit engine ownership through the installed package and ordinary Vite resolution. */
export async function verifyPackedShikiConsumer({ fixtureDir, withShiki, expectedShikiVersion }) {
  const require = createRequire(join(fixtureDir, 'package.json'));
  if (expectedShikiVersion) assert.equal(require('shiki/package.json').version, expectedShikiVersion);
  if (!withShiki) assert.throws(() => require.resolve('shiki'), { code: 'MODULE_NOT_FOUND' });
  const { build, createLogger, preview } = await import(pathToFileURL(require.resolve('vite')).href);
  const playwright = await import('playwright');
  const chromium = typeof playwright.chromium?.launch === 'function' ? playwright.chromium : playwright.default?.chromium;
  assert.equal(typeof chromium?.launch, 'function');
  const packagedBinary = await readFile(join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui',
    'dist', 'components', 'conversation', 'code-block', 'onig.wasm'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(packagedBinary.length, 466_610);
  assert.equal(hash(packagedBinary), 'fd885c2d12e5951e59d761ebd4a006e06254b1491fd6f530c92b69fb4d8d77d9');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const engine of withShiki ? ['unused', 'default', 'javascript', 'oniguruma'] : ['default']) {
      const root = join(fixtureDir, `shiki-consumer-${engine}`);
      await mkdir(root, { recursive: true });
      await writeFile(join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
      await writeFile(join(root, 'main.js'), engine === 'unused'
        ? "import { discover } from '@aceshooting/lyra-ui/autoloader.js';\n"
        : `
import { setShikiCoreEngine } from '@aceshooting/lyra-ui/components/lr-code-block-core.js';
${engine === 'oniguruma' ? "import { createShikiOnigurumaEngine } from '@aceshooting/lyra-ui/components/conversation/code-block/shiki-oniguruma.js';" : ''}
${withShiki ? '' : "import '@aceshooting/lyra-ui/components/lr-markdown.js';"}
window.renderCode = async highlight => {
  ${engine === 'oniguruma' ? 'setShikiCoreEngine(createShikiOnigurumaEngine);' : engine === 'javascript' ? "setShikiCoreEngine('javascript');" : ''}
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
      // No resolver aliases, externalization, output cleanup or asset bridges.
      const config = { configFile: false, root, customLogger: logger };
      const result = await build(config);
      assert.deepEqual(warnings, [], 'The packed Shiki consumer must build without warnings');
      assert(!Array.isArray(result) && result.output);
      const assets = result.output.filter(row => row.type === 'asset');
      const wasm = assets.filter(row => row.fileName.endsWith('.wasm'));
      assert.equal(wasm.length, engine === 'oniguruma' ? 1 : 0, `${engine} emitted WASM ownership`);
      if (engine === 'oniguruma') {
        assert.equal(Buffer.byteLength(wasm[0].source), packagedBinary.length);
        assert.equal(hash(wasm[0].source), hash(packagedBinary));
      } else {
        assert(!result.output.some(row => row.type === 'chunk' && row.code.includes(packagedBinary.toString('base64').slice(0, 96))),
          'Default imports must not inline the binary');
      }
      if (engine === 'unused') {
        assert.equal(assets.filter(row => row.fileName === 'index.html').length, 1);
        assert.equal(assets.filter(row => row.fileName !== 'index.html').length, 0);
        continue;
      }
      const server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } });
      try {
        for (const highlight of [false, true]) {
          const context = await browser.newContext();
          try {
            const page = await context.newPage(), errors = [], binaryRequests = [];
            page.on('request', request => {
              if (new URL(request.url()).pathname.endsWith('.wasm')) binaryRequests.push(request.url());
            });
            page.on('pageerror', error => errors.push(String(error)));
            page.on('console', message => {
              if (message.type() === 'warning' || message.type() === 'error') errors.push(message.text());
            });
            await page.goto(server.resolvedUrls.local[0]);
            await page.waitForFunction(() => typeof window.renderCode === 'function');
            assert.equal(binaryRequests.length, 0, 'Importing an engine factory must not fetch the binary');
            await page.evaluate(highlight => window.renderCode(highlight), highlight);
            await page.waitForFunction(highlighted => {
              const root = document.querySelector('lr-code-block-core')?.shadowRoot;
              if (highlighted) return [...(root?.querySelectorAll('pre.shiki span[style]') ?? [])]
                .some(span => span.textContent === 'alpha' && span.style.color !== '');
              return root?.querySelector('code')?.textContent?.includes('alpha') && !root.querySelector('pre.shiki');
            }, withShiki && highlight, { timeout: 30_000 });
            await page.waitForLoadState('networkidle');
            assert.equal(binaryRequests.length, withShiki && highlight && engine === 'oniguruma' ? 1 : 0,
              'Only explicitly selected and requested Oniguruma highlighting may fetch the binary');
            assert.deepEqual(errors, [], `The ${engine} packed consumer must run without errors or warnings`);
          } finally { await context.close(); }
        }
      } finally {
        await new Promise((accept, reject) => server.httpServer.close(error => error ? reject(error) : accept()));
      }
    }
  } finally { await browser.close(); }
}
