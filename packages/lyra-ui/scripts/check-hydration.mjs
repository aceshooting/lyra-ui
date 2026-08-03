import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import { chromium } from 'playwright';
import { packageDir, registrationDistPath, renderSsrMatrix } from './ssr-fixture.mjs';

// Exercise the published metadata through a production bundler, not only the direct browser
// module graph below. A side-effect-only hydration entry missing from package.json#sideEffects is
// silently discarded when ssr-loader imports it; direct ESM tests cannot reveal that failure.
const requireFromPackage = createRequire(join(packageDir, 'package.json'));
const requireFromLoaderHost = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'));
const esbuild = requireFromLoaderHost('esbuild');
const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
const optionalPeers = Object.keys(packageJson.peerDependencies ?? {}).filter(
  (name) => packageJson.peerDependenciesMeta?.[name]?.optional === true,
);
const bundledLoader = await esbuild.build({
  entryPoints: [join(packageDir, 'dist', 'ssr-loader.js')],
  absWorkingDir: packageDir,
  bundle: true,
  external: optionalPeers.flatMap((name) => [name, `${name}/*`]),
  format: 'esm',
  minify: true,
  write: false,
  logLevel: 'silent',
});
const bundledLoaderSource = new TextDecoder().decode(bundledLoader.outputFiles[0].contents);
assert.match(
  bundledLoaderSource,
  /defer-hydration/,
  'production bundling ssr-loader must retain the transitive Lit hydration hook',
);

const { entries, inventory, loader, elementRenderers } = await renderSsrMatrix();
const statefulProbeMarkup = new Map([
  [
    'lr-chip',
    await collectResult(
      render(
        html`<lr-chip data-ssr-probe="lr-chip" removable><span
          slot="icon"
          data-ssr-light="lr-chip"
        >●</span>Research</lr-chip>`,
        { elementRenderers },
      ),
    ),
  ],
  [
    'lr-flow-node',
    await collectResult(
      render(
        html`<lr-flow-node
          data-ssr-probe="lr-flow-node"
          aria-label="SSR probe lr-flow-node"
          status="running"
        ><span slot="header" data-ssr-light="lr-flow-node">Stateful header</span></lr-flow-node>`,
        { elementRenderers },
      ),
    ),
  ],
  [
    'lr-menu-item',
    await collectResult(
      render(
        html`<lr-menu-item
          data-ssr-probe="lr-menu-item"
          aria-label="SSR probe lr-menu-item"
          disabled
          loading
        ><span data-ssr-light="lr-menu-item">Stateful menu item</span></lr-menu-item>`,
        { elementRenderers },
      ),
    ),
  ],
  [
    'lr-tag',
    await collectResult(
      render(
        html`<lr-tag
          data-ssr-probe="lr-tag"
          with-remove
        ><span data-ssr-light="lr-tag">Alpha</span></lr-tag>`,
        { elementRenderers },
      ),
    ),
  ],
]);
for (const [tag, markup] of statefulProbeMarkup) {
  const entry = entries.find((candidate) => candidate.tag === tag);
  assert.ok(entry, `${tag}: missing stateful hydration entry`);
  entry.html = markup;
}
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
            chipIcon: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="icon"]')
              : undefined,
            chipRemoveButton: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')
              : undefined,
            chipIconHidden: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="icon"]')?.hasAttribute('hidden')
              : undefined,
            chipRemoveLabel: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
              : undefined,
            flowPulse: host.localName === 'lr-flow-node'
              ? host.shadowRoot?.querySelector('[part~="card"]')?.hasAttribute('data-pulse')
              : undefined,
            flowHasBuiltInHeader: host.localName === 'lr-flow-node'
              ? host.shadowRoot?.querySelector('[part="header"]') !== null
              : undefined,
            tagRemoveButton: host.localName === 'lr-tag'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')
              : undefined,
            tagRemoveLabel: host.localName === 'lr-tag'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
              : undefined,
          }];
        }),
      );
    </script>
    <script type="module">
      try {
        const fixtures = [...document.querySelectorAll('[data-fixture-tag]')];
        // Register every definition waiter before the compatibility loader starts upgrading
        // hosts. This captures node identity at Lit's first completed hydration update, rather
        // than after a component's legitimate post-hydration async state changes have rendered.
        const firstHydrationResults = new Map();
        const firstHydrationPromises = fixtures.map(async (fixture) => {
          const tag = fixture.dataset.fixtureTag;
          const host = fixture.firstElementChild;
          const before = globalThis.__lyraBeforeHydration.get(tag);
          await customElements.whenDefined(host.localName);
          if (host.updateComplete) await host.updateComplete;
          firstHydrationResults.set(tag, {
            rootReused: before.root !== null && before.root === host.shadowRoot,
            shadowNodesReused:
              before.root !== null &&
              before.shadowNodes.length === host.shadowRoot?.childNodes.length &&
              before.shadowNodes.every(
                (node, index) => host.shadowRoot.childNodes[index] === node,
              ),
            chipIconReused:
              before.chipIcon ===
              (host.localName === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="icon"]')
                : undefined),
            chipRemoveButtonReused:
              before.chipRemoveButton ===
              (host.localName === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')
                : undefined),
            chipIconHiddenPreserved:
              before.chipIconHidden ===
              (host.localName === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="icon"]')?.hasAttribute('hidden')
                : undefined),
            chipRemoveLabelPreserved:
              before.chipRemoveLabel ===
              (host.localName === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
                : undefined),
            flowPulsePreserved:
              before.flowPulse ===
              (host.localName === 'lr-flow-node'
                ? host.shadowRoot?.querySelector('[part~="card"]')?.hasAttribute('data-pulse')
                : undefined),
            flowHeaderPreserved:
              before.flowHasBuiltInHeader ===
              (host.localName === 'lr-flow-node'
                ? host.shadowRoot?.querySelector('[part="header"]') !== null
                : undefined),
            tagRemoveButtonReused:
              before.tagRemoveButton ===
              (host.localName === 'lr-tag'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')
                : undefined),
            tagRemoveLabelPreserved:
              before.tagRemoveLabel ===
              (host.localName === 'lr-tag'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
                : undefined),
          });
        });
        const loader = await import('/dist/ssr-loader.js');
        await Promise.all(${JSON.stringify(optionalRegistrationUrls)}.map((url) => import(url)));
        await Promise.all(firstHydrationPromises);
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
            const firstHydration = firstHydrationResults.get(tag);
            const mode = loader.getLyraSsrMode(tag);
            const diagnostic = byTag.get(tag);
            return {
              tag,
              mode,
              status: diagnostic?.status,
              rootReused: firstHydration.rootReused,
              shadowNodesReused: firstHydration.shadowNodesReused,
              chipServerIconHidden: before.chipIconHidden,
              chipServerRemoveLabel: before.chipRemoveLabel,
              chipFirstIconReused: firstHydration.chipIconReused,
              chipFirstRemoveButtonReused: firstHydration.chipRemoveButtonReused,
              chipFirstIconHiddenPreserved: firstHydration.chipIconHiddenPreserved,
              chipFirstRemoveLabelPreserved: firstHydration.chipRemoveLabelPreserved,
              flowServerPulse: before.flowPulse,
              flowServerHasBuiltInHeader: before.flowHasBuiltInHeader,
              flowPulsePreserved: firstHydration.flowPulsePreserved,
              flowHeaderPreserved: firstHydration.flowHeaderPreserved,
              tagServerRemoveLabel: before.tagRemoveLabel,
              tagFirstRemoveButtonReused: firstHydration.tagRemoveButtonReused,
              tagFirstRemoveLabelPreserved: firstHydration.tagRemoveLabelPreserved,
              startedWithoutShadow: before.root === null,
              hasClientShadow: host.shadowRoot !== null,
              lightNodeReused: before.lightNode === host.querySelector('[data-ssr-light]'),
              probeAttribute: host.getAttribute('data-ssr-probe'),
              chipIconReused: tag === 'lr-chip'
                ? before.chipIcon === host.shadowRoot?.querySelector('[part~="icon"]')
                : undefined,
              chipRemoveButtonReused: tag === 'lr-chip'
                ? before.chipRemoveButton ===
                  host.shadowRoot?.querySelector('[part~="remove-button"]')
                : undefined,
              chipIconHidden: tag === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="icon"]')?.hasAttribute('hidden')
                : undefined,
              chipRemoveLabel: tag === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
                : undefined,
              flowPulse: tag === 'lr-flow-node'
                ? host.shadowRoot?.querySelector('[part~="card"]')?.hasAttribute('data-pulse')
                : undefined,
              flowHasBuiltInHeader: tag === 'lr-flow-node'
                ? host.shadowRoot?.querySelector('[part="header"]') !== null
                : undefined,
              menuAriaDisabled: tag === 'lr-menu-item'
                ? host.getAttribute('aria-disabled')
                : undefined,
              menuHasSpinner: tag === 'lr-menu-item'
                ? host.shadowRoot?.querySelector('[part~="spinner"]') !== null
                : undefined,
              tagRemoveButtonReused: tag === 'lr-tag'
                ? before.tagRemoveButton ===
                  host.shadowRoot?.querySelector('[part~="remove-button"]')
                : undefined,
              tagRemoveLabel: tag === 'lr-tag'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
                : undefined,
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
await page.emulateMedia({ reducedMotion: 'no-preference' });
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
  const checkboxHydration = outcome.result.components.find(({ tag }) => tag === 'lr-checkbox');
  assert.ok(checkboxHydration, 'lr-checkbox must be present in the hydration crawl');
  assert.equal(
    checkboxHydration.mode,
    'render-and-hydrate',
    'lr-checkbox must retain node-preserving server hydration',
  );
  assert.equal(
    checkboxHydration.rootReused,
    true,
    'lr-checkbox must reuse its declarative shadow root on the first hydration update',
  );
  assert.equal(
    checkboxHydration.shadowNodesReused,
    true,
    'lr-checkbox must preserve its server shadow nodes on the first hydration update',
  );
  const chipHydration = outcome.result.components.find(({ tag }) => tag === 'lr-chip');
  assert.ok(chipHydration, 'lr-chip must be present in the hydration crawl');
  assert.equal(
    chipHydration.mode,
    'render-and-hydrate',
    'lr-chip must retain node-preserving server hydration',
  );
  assert.equal(
    chipHydration.rootReused && chipHydration.shadowNodesReused,
    true,
    'lr-chip must preserve its declarative root and direct nodes on the first hydration update',
  );
  assert.equal(
    chipHydration.chipServerIconHidden,
    true,
    'server chip must hide an icon whose light-DOM assignment is unavailable',
  );
  assert.equal(
    chipHydration.chipServerRemoveLabel,
    'Remove',
    'server chip must use the context-free remove label while light DOM is unavailable',
  );
  assert.equal(
    chipHydration.chipFirstIconReused &&
      chipHydration.chipFirstRemoveButtonReused &&
      chipHydration.chipFirstIconHiddenPreserved &&
      chipHydration.chipFirstRemoveLabelPreserved,
    true,
    'lr-chip first hydration render must preserve its nested actions and server-only state',
  );
  assert.equal(
    chipHydration.chipIconReused && chipHydration.chipRemoveButtonReused,
    true,
    'lr-chip corrective update must preserve the server icon and remove-button nodes',
  );
  assert.equal(
    chipHydration.chipIconHidden,
    false,
    'hydrated chip must reveal its assigned icon',
  );
  assert.equal(
    chipHydration.chipRemoveLabel,
    'Remove Research',
    'hydrated chip must add its light-DOM context to the remove label',
  );
  const flowNodeHydration = outcome.result.components.find(({ tag }) => tag === 'lr-flow-node');
  assert.ok(flowNodeHydration, 'lr-flow-node must be present in the hydration crawl');
  assert.equal(
    flowNodeHydration.mode,
    'render-and-hydrate',
    'lr-flow-node must retain node-preserving server hydration',
  );
  assert.equal(
    flowNodeHydration.rootReused && flowNodeHydration.shadowNodesReused,
    true,
    'lr-flow-node must preserve its declarative root and nodes on the first hydration update',
  );
  assert.equal(flowNodeHydration.flowServerPulse, false, 'server flow node must start without motion');
  assert.equal(
    flowNodeHydration.flowServerHasBuiltInHeader,
    true,
    'server flow node must retain its fallback header before slot assignment is observable',
  );
  assert.equal(
    flowNodeHydration.flowPulsePreserved && flowNodeHydration.flowHeaderPreserved,
    true,
    'lr-flow-node first hydration render must reproduce both server-only state decisions',
  );
  assert.equal(flowNodeHydration.flowPulse, true, 'hydrated running flow node must enable motion');
  assert.equal(
    flowNodeHydration.flowHasBuiltInHeader,
    false,
    'hydrated flow node must replace its fallback with the assigned header',
  );
  const menuItemHydration = outcome.result.components.find(({ tag }) => tag === 'lr-menu-item');
  assert.ok(menuItemHydration, 'lr-menu-item must be present in the hydration crawl');
  assert.equal(
    menuItemHydration.mode,
    'render-and-hydrate',
    'lr-menu-item must retain node-preserving server hydration',
  );
  assert.equal(
    menuItemHydration.rootReused,
    true,
    'lr-menu-item must reuse its declarative shadow root on the first hydration update',
  );
  assert.equal(
    menuItemHydration.shadowNodesReused,
    true,
    'lr-menu-item must preserve its server shadow nodes on the first hydration update',
  );
  assert.equal(
    menuItemHydration.menuAriaDisabled,
    'true',
    'hydrated disabled/loading menu item must retain its disabled semantics',
  );
  assert.equal(
    menuItemHydration.menuHasSpinner,
    true,
    'hydrated loading menu item must retain its spinner state',
  );
  const tagHydration = outcome.result.components.find(({ tag }) => tag === 'lr-tag');
  assert.ok(tagHydration, 'lr-tag must be present in the hydration crawl');
  assert.equal(
    tagHydration.mode,
    'render-and-hydrate',
    'lr-tag must retain node-preserving server hydration',
  );
  assert.equal(
    tagHydration.rootReused && tagHydration.shadowNodesReused,
    true,
    'lr-tag must preserve its declarative root and nodes on the first hydration update',
  );
  assert.equal(
    tagHydration.tagServerRemoveLabel,
    'Remove',
    'server tag must use the context-free remove label while light DOM is unavailable',
  );
  assert.equal(
    tagHydration.tagFirstRemoveButtonReused && tagHydration.tagFirstRemoveLabelPreserved,
    true,
    'lr-tag first hydration render must preserve the server remove action and its bare label',
  );
  assert.equal(
    tagHydration.tagRemoveButtonReused,
    true,
    'lr-tag contextual-label update must keep the server remove button node',
  );
  assert.equal(
    tagHydration.tagRemoveLabel,
    'Remove Alpha',
    'hydrated tag must add its light-DOM context to the remove label',
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
