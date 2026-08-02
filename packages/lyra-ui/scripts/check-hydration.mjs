import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { packageDir, registrationDistPath, renderSsrMatrix } from './ssr-fixture.mjs';

const { entries, inventory, loader } = await renderSsrMatrix();
const litRoot = await realpath(join(packageDir, 'node_modules', 'lit'));
const litDependencyRoot = resolve(litRoot, '..');
const floatingDomRoot = await realpath(join(packageDir, 'node_modules', '@floating-ui', 'dom'));
const floatingScopeRoot = resolve(floatingDomRoot, '..');

const mounts = new Map([
  ['/dist/', join(packageDir, 'dist')],
  ['/modules/ssr-client/', await realpath(join(packageDir, 'node_modules', '@lit-labs', 'ssr-client'))],
  ['/modules/lit/', litRoot],
  ['/modules/lit-html/', await realpath(join(litDependencyRoot, 'lit-html'))],
  ['/modules/lit-element/', await realpath(join(litDependencyRoot, 'lit-element'))],
  [
    '/modules/reactive-element/',
    await realpath(join(litDependencyRoot, '@lit', 'reactive-element')),
  ],
  ['/modules/floating-dom/', floatingDomRoot],
  ['/modules/floating-core/', await realpath(join(floatingScopeRoot, 'core'))],
  ['/modules/floating-utils/', await realpath(join(floatingScopeRoot, 'utils'))],
]);

const importMap = {
  imports: {
    '@lit-labs/ssr-client/': '/modules/ssr-client/',
    '@lit/reactive-element': '/modules/reactive-element/reactive-element.js',
    '@lit/reactive-element/': '/modules/reactive-element/',
    'lit': '/modules/lit/index.js',
    'lit/': '/modules/lit/',
    'lit-html': '/modules/lit-html/lit-html.js',
    'lit-html/': '/modules/lit-html/',
    'lit-element/': '/modules/lit-element/',
    '@floating-ui/dom': '/modules/floating-dom/dist/floating-ui.dom.mjs',
    '@floating-ui/core': '/modules/floating-core/dist/floating-ui.core.mjs',
    '@floating-ui/utils': '/modules/floating-utils/dist/floating-ui.utils.mjs',
    '@floating-ui/utils/dom': '/modules/floating-utils/dist/floating-ui.utils.dom.mjs',
  },
};

const optionalRegistrationUrls = inventory.components
  .filter(({ rootIncluded }) => !rootIncluded)
  .map((component) =>
    `/${registrationDistPath(component).slice(packageDir.length + 1).replaceAll('\\', '/')}`,
  );

const fixtureMarkup = entries
  .map(({ tag, html }) => `<section data-fixture-tag="${tag}">${html}</section>`)
  .join('\n');

const documentHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <script type="importmap">${JSON.stringify(importMap)}</script>
  </head>
  <body>
    ${fixtureMarkup}
    <script>
      globalThis.__lyraBeforeHydration = new Map(
        [...document.querySelectorAll('[data-fixture-tag]')].map((fixture) => {
          const host = fixture.firstElementChild;
          return [fixture.dataset.fixtureTag, {
            host,
            root: host.shadowRoot,
            shadowNodes: host.shadowRoot ? [...host.shadowRoot.childNodes] : [],
            lightNode: host.querySelector('[data-ssr-light]'),
          }];
        }),
      );
    </script>
    <script type="module">
      try {
        const loader = await import('/dist/ssr-loader.js');
        await Promise.all(${JSON.stringify(optionalRegistrationUrls)}.map((url) => import(url)));
        const fixtures = [...document.querySelectorAll('[data-fixture-tag]')];
        const updateErrors = (await Promise.all(fixtures.map(async (fixture) => {
          const host = fixture.firstElementChild;
          try {
            await customElements.whenDefined(host.localName);
            if (host.updateComplete) await host.updateComplete;
            return undefined;
          } catch (error) {
            const detail = error instanceof Error ? error.stack ?? error.message : String(error);
            return host.localName + ': ' + detail;
          }
        }))).filter(Boolean);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const diagnostics = await loader.diagnoseLyraHydration(document);
        const byTag = new Map(diagnostics.map((entry) => [entry.tag, entry]));
        globalThis.__lyraHydrationResult = {
          updateErrors,
          components: fixtures.map((fixture) => {
          const tag = fixture.dataset.fixtureTag;
          const host = fixture.firstElementChild;
          const before = globalThis.__lyraBeforeHydration.get(tag);
          const mode = loader.getLyraSsrMode(tag);
          const diagnostic = byTag.get(tag);
          return {
            tag,
            mode,
            status: diagnostic?.status,
            rootReused: before.root !== null && before.root === host.shadowRoot,
            shadowNodesReused:
              before.root !== null &&
              before.shadowNodes.length === host.shadowRoot?.childNodes.length &&
              before.shadowNodes.every((node, index) => host.shadowRoot.childNodes[index] === node),
            startedWithoutShadow: before.root === null,
            hasClientShadow: host.shadowRoot !== null,
            lightNodeReused: before.lightNode === host.querySelector('[data-ssr-light]'),
            probeAttribute: host.getAttribute('data-ssr-probe'),
            };
          }),
        };
      } catch (error) {
        globalThis.__lyraHydrationError = error instanceof Error
          ? error.stack ?? error.message
          : String(error);
      } finally {
        globalThis.__lyraHydrationDone = true;
      }
    </script>
  </body>
</html>`;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

async function serveFile(response, root, relativePath) {
  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
    response.writeHead(200, {
      'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end('Not found');
  }
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(documentHtml);
    return;
  }
  for (const [prefix, root] of mounts) {
    if (pathname.startsWith(prefix)) {
      await serveFile(response, root, pathname.slice(prefix.length));
      return;
    }
  }
  response.writeHead(404).end('Not found');
});

await new Promise((resolveListen, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolveListen);
});
const address = server.address();
assert.ok(address && typeof address !== 'string', 'hydration server did not expose a port');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const browserFindings = [];
page.on('pageerror', (error) => browserFindings.push(`pageerror: ${error.stack ?? error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    if (/needs the optional peer dependenc(?:y|ies)/.test(message.text())) return;
    browserFindings.push(`console.${message.type()}: ${message.text()}`);
  }
});
page.on('requestfailed', (request) => {
  browserFindings.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
});

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForFunction(() => globalThis.__lyraHydrationDone === true, undefined, {
    timeout: 60_000,
  });
  const outcome = await page.evaluate(() => ({
    error: globalThis.__lyraHydrationError,
    result: globalThis.__lyraHydrationResult,
  }));
  assert.equal(outcome.error, undefined, `hydration fixture failed: ${outcome.error}`);
  assert.equal(
    outcome.result.components.length,
    entries.length,
    'hydration result count drifted from inventory',
  );

  const failures = [...outcome.result.updateErrors, ...browserFindings];
  for (const result of outcome.result.components) {
    if (result.probeAttribute !== result.tag) failures.push(`${result.tag}: host attribute changed`);
    if (!result.lightNodeReused) failures.push(`${result.tag}: light DOM node identity changed`);
    if (result.mode === 'render-and-hydrate') {
      if (result.status !== 'hydrated') failures.push(`${result.tag}: diagnostic=${result.status}`);
      if (!result.rootReused) failures.push(`${result.tag}: declarative shadow root was replaced`);
      if (!result.shadowNodesReused) failures.push(`${result.tag}: server shadow nodes were replaced`);
    } else {
      if (result.status !== 'client-rendered') failures.push(`${result.tag}: diagnostic=${result.status}`);
      if (!result.startedWithoutShadow) failures.push(`${result.tag}: fallback emitted server shadow DOM`);
      if (!result.hasClientShadow) failures.push(`${result.tag}: client upgrade did not render shadow DOM`);
    }
  }
  assert.deepEqual(failures, [], `hydration contract failures:\n${failures.join('\n')}`);
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(
  `Hydration crawl passed: ${loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS.length} shadow roots reused, ` +
    `${loader.LYRA_SSR_CLIENT_RENDER_TAGS.length} explicit client fallbacks upgraded.`,
);
