import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import { chromium } from 'playwright';
import {
  packageDir,
  registrationDistPath,
  renderSsrMatrix,
} from './ssr-fixture.mjs';

// Exercise the published metadata through a production bundler, not only the direct browser
// module graph below. A side-effect-only hydration entry missing from package.json#sideEffects is
// silently discarded when ssr-loader imports it; direct ESM tests cannot reveal that failure.
const requireFromPackage = createRequire(join(packageDir, 'package.json'));
const requireFromLoaderHost = createRequire(
  requireFromPackage.resolve('@web/dev-server-esbuild')
);
const esbuild = requireFromLoaderHost('esbuild');
const packageJson = JSON.parse(
  await readFile(join(packageDir, 'package.json'), 'utf8')
);
const optionalPeers = Object.keys(packageJson.peerDependencies ?? {}).filter(
  (name) => packageJson.peerDependenciesMeta?.[name]?.optional === true
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
const bundledLoaderSource = new TextDecoder().decode(
  bundledLoader.outputFiles[0].contents
);
assert.match(
  bundledLoaderSource,
  /defer-hydration/,
  'production bundling ssr-loader must retain the transitive Lit hydration hook'
);

const hydrationTagArg = process.argv.find((argument) =>
  argument.startsWith('--tag=')
);
const hydrationTag = hydrationTagArg?.slice('--tag='.length);
const hydrationMatrix = await renderSsrMatrix();
const { inventory, loader, elementRenderers } = hydrationMatrix;
const entries = hydrationTag
  ? hydrationMatrix.entries.filter(({ tag }) => tag === hydrationTag)
  : hydrationMatrix.entries;
if (hydrationTag) {
  assert.ok(
    entries.some(({ tag }) => tag === hydrationTag),
    `unknown hydration probe tag: ${hydrationTag}`
  );
}
const statefulProbeMarkup = new Map([
  [
    'lr-badge',
    await collectResult(
      render(
        html`<lr-badge data-ssr-probe="lr-badge"
          ><span slot="start" data-ssr-light="lr-badge">●</span>Deployment
          complete<span slot="end">✓</span></lr-badge
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-alert',
    await collectResult(
      render(
        html`<lr-alert data-ssr-probe="lr-alert" open
          ><span slot="icon" data-ssr-light="lr-alert">!</span>Message</lr-alert
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-callout',
    await collectResult(
      render(
        html`<lr-callout data-ssr-probe="lr-callout"
          ><span slot="icon" data-ssr-light="lr-callout">!</span
          ><strong slot="heading">Attention</strong>Message</lr-callout
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-empty',
    await collectResult(
      render(
        html`<lr-empty data-ssr-probe="lr-empty"
          ><span data-ssr-light="lr-empty">Illustration</span
          ><strong slot="heading">No results</strong
          ><span slot="description">Try another query</span
          ><button slot="actions">Reset</button></lr-empty
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-chip',
    await collectResult(
      render(
        html`<lr-chip data-ssr-probe="lr-chip" removable
          ><span slot="start" data-ssr-light="lr-chip">●</span>Research<span
            slot="end"
            >✓</span
          ></lr-chip
        >`,
        { elementRenderers }
      )
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
          ><span slot="header" data-ssr-light="lr-flow-node"
            >Stateful header</span
          ></lr-flow-node
        >`,
        { elementRenderers }
      )
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
          ><span data-ssr-light="lr-menu-item"
            >Stateful menu item</span
          ></lr-menu-item
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-rating',
    await collectResult(
      render(
        html`<lr-rating
          data-ssr-probe="lr-rating"
          aria-label="Quality score"
          value="3"
          max="7"
          required
          readonly
          disabled
          ><span data-ssr-light="lr-rating">Stateful rating</span></lr-rating
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-tag',
    await collectResult(
      render(
        html`<lr-tag data-ssr-probe="lr-tag" with-remove
          ><span slot="start" data-ssr-light="lr-tag">●</span>Alpha<span
            slot="end"
            >✓</span
          ></lr-tag
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-chip-group',
    await collectResult(
      render(
        html`<lr-chip-group data-ssr-probe="lr-chip-group" max-visible="2"
          ><lr-chip data-ssr-light="lr-chip-group">One</lr-chip
          ><lr-chip>Two</lr-chip><lr-chip>Three</lr-chip></lr-chip-group
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-avatar-group',
    await collectResult(
      render(
        html`<lr-avatar-group data-ssr-probe="lr-avatar-group" max="2"
          ><lr-avatar data-ssr-light="lr-avatar-group" label="One"></lr-avatar
          ><lr-avatar label="Two"></lr-avatar
          ><lr-avatar label="Three"></lr-avatar
        ></lr-avatar-group>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-lightbox',
    await collectResult(
      render(
        html`<lr-lightbox data-ssr-probe="lr-lightbox" open
          ><button slot="actions" data-ssr-light="lr-lightbox">
            Download
          </button></lr-lightbox
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-model-select',
    await collectResult(
      render(
        html`<lr-model-select data-ssr-probe="lr-model-select"
          ><span slot="label" data-ssr-light="lr-model-select">Model</span
          ><span slot="error">Choose a model</span
          ><span slot="hint">Available models</span></lr-model-select
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-voice-picker',
    await collectResult(
      render(
        html`<lr-voice-picker data-ssr-probe="lr-voice-picker"
          ><span slot="label" data-ssr-light="lr-voice-picker">Voice</span
          ><span slot="error">Choose a voice</span
          ><span slot="hint">Preview a voice</span></lr-voice-picker
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-combobox',
    await collectResult(
      render(
        html`<lr-combobox data-ssr-probe="lr-combobox">
          <span slot="label" data-ssr-light="lr-combobox">Country</span
          ><span slot="start">&#x1f30d;</span><span slot="end">&#x2713;</span
          ><span slot="error">Choose a country</span
          ><span slot="hint">Start typing</span>
        </lr-combobox>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-option',
    await collectResult(
      render(
        html`<lr-option data-ssr-probe="lr-option" value="alpha"
          ><span slot="start" data-ssr-light="lr-option">&#x25cf;</span
          >Alpha<span slot="end">Primary</span></lr-option
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-input',
    await collectResult(
      render(
        html`<lr-input data-ssr-probe="lr-input">
          <span slot="label" data-ssr-light="lr-input">Name</span
          ><span slot="start">@</span><span slot="end">&#x2713;</span
          ><span slot="error">Enter a name</span
          ><span slot="hint">Public name</span>
        </lr-input>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-select',
    await collectResult(
      render(
        html`<lr-select data-ssr-probe="lr-select">
          <span slot="label" data-ssr-light="lr-select">Status</span
          ><span slot="start">&#x25cf;</span><span slot="end">&#x2713;</span
          ><span slot="error">Choose a status</span
          ><span slot="hint">One status</span>
        </lr-select>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-textarea',
    await collectResult(
      render(
        html`<lr-textarea data-ssr-probe="lr-textarea">
          <span slot="label" data-ssr-light="lr-textarea">Notes</span
          ><span slot="error">Enter notes</span
          ><span slot="hint">Markdown supported</span>
        </lr-textarea>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-breadcrumb-item',
    await collectResult(
      render(
        html`<lr-breadcrumb-item data-ssr-probe="lr-breadcrumb-item"
          ><span slot="start" data-ssr-light="lr-breadcrumb-item">&#x2302;</span
          >Home<span slot="end">1</span></lr-breadcrumb-item
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-file-input',
    await collectResult(
      render(
        html`<lr-file-input data-ssr-probe="lr-file-input">
          <span slot="label" data-ssr-light="lr-file-input">Attachments</span
          ><span slot="error">Choose a smaller file</span
          ><span slot="hint">PDF only</span>
        </lr-file-input>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-flow-canvas',
    await collectResult(
      render(
        html`<lr-flow-canvas
          data-ssr-probe="lr-flow-canvas"
          .nodes=${[
            { id: 'fetch', data: { label: 'Fetch' }, position: { x: 0, y: 0 } },
            {
              id: 'answer',
              data: { label: 'Answer' },
              position: { x: 240, y: 0 },
            },
          ]}
          .edges=${[{ id: 'fetch-answer', source: 'fetch', target: 'answer' }]}
          ><span hidden data-ssr-light="lr-flow-canvas"></span
        ></lr-flow-canvas>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-dashboard-grid',
    await collectResult(
      render(
        html`<lr-dashboard-grid
          data-ssr-probe="lr-dashboard-grid"
          .layout=${[
            { cellId: 'summary', x: 0, y: 0, w: 3, h: 1, label: 'Summary' },
          ]}
          ><span hidden data-ssr-light="lr-dashboard-grid"></span
        ></lr-dashboard-grid>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-table',
    await collectResult(
      render(
        html`<lr-table
          data-ssr-probe="lr-table"
          aria-label="Documents"
          .columns=${[{ key: 'name', label: 'Name', cell: (row) => row.name }]}
          .rows=${[{ name: 'Alpha.pdf' }]}
          ><span hidden data-ssr-light="lr-table"></span
        ></lr-table>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-document-library',
    await collectResult(
      render(
        html`<lr-document-library
          data-ssr-probe="lr-document-library"
          .documents=${[
            { id: 'alpha', name: 'Alpha.pdf', mimeType: 'application/pdf' },
          ]}
          ><span hidden data-ssr-light="lr-document-library"></span
        ></lr-document-library>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-emoji-picker',
    await collectResult(
      render(
        html`<lr-emoji-picker
          data-ssr-probe="lr-emoji-picker"
          .groups=${[
            {
              key: 'faces',
              label: 'Faces',
              emojis: Array.from({ length: 200 }, (_value, index) => ({
                emoji: '😀',
                name: `face-${index}`,
              })),
            },
          ]}
          ><span hidden data-ssr-light="lr-emoji-picker"></span
        ></lr-emoji-picker>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-virtual-list',
    await collectResult(
      render(
        html`<lr-virtual-list
          data-ssr-probe="lr-virtual-list"
          aria-label="Results"
          row-height="48"
          .items=${['Alpha', 'Beta']}
          .renderItem=${(item) => item}
          ><span hidden data-ssr-light="lr-virtual-list"></span
        ></lr-virtual-list>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-qr-code',
    await collectResult(
      render(
        html`<lr-qr-code data-ssr-probe="lr-qr-code" value="hello"
          ><span hidden data-ssr-light="lr-qr-code"></span
        ></lr-qr-code>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-video-playlist',
    await collectResult(
      render(
        html`<lr-video-playlist
          data-ssr-probe="lr-video-playlist"
          .items=${[
            {
              title: 'Server introduction',
              duration: 125,
            },
            { title: 'Unavailable lesson', unavailable: true },
          ]}
          ><lr-video
            data-ssr-light="lr-video-playlist"
            title="Server introduction"
          ></lr-video
          ><lr-video title="Unavailable lesson" inert></lr-video
        ></lr-video-playlist>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-result-field',
    await collectResult(
      render(
        html`<lr-result-field
          data-ssr-probe="lr-result-field"
          label="Status"
          value="fallback"
          ><span data-ssr-light="lr-result-field">Live</span></lr-result-field
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-result-card',
    await collectResult(
      render(
        html`<lr-result-card data-ssr-probe="lr-result-card" with-actions
          ><button slot="actions" data-ssr-light="lr-result-card">Copy</button
          >Body</lr-result-card
        >`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-tab-group',
    await collectResult(
      render(
        html`<lr-tab-group data-ssr-probe="lr-tab-group">
          <section slot="one" label="One" data-ssr-light="lr-tab-group">
            Panel one
          </section>
          <section slot="two" label="Two">Panel two</section>
        </lr-tab-group>`,
        { elementRenderers }
      )
    ),
  ],
  [
    'lr-multi-split',
    await collectResult(
      render(
        html`<lr-multi-split data-ssr-probe="lr-multi-split" .sizes=${[50, 50]}
          ><section data-ssr-light="lr-multi-split">One</section>
          <section>Two</section></lr-multi-split
        >`,
        { elementRenderers }
      )
    ),
  ],
]);
const progressiveSlotParts = {
  'lr-badge': ['start', 'end'],
  'lr-alert': ['icon'],
  'lr-callout': ['icon', 'heading'],
  'lr-empty': ['icon', 'heading', 'description', 'actions'],
  'lr-chip': ['start', 'end'],
  'lr-tag': ['start', 'end'],
  'lr-lightbox': ['actions'],
  'lr-model-select': ['form-control-label', 'error', 'hint'],
  'lr-voice-picker': ['form-control-label', 'error', 'hint'],
  'lr-combobox': ['form-control-label', 'start', 'end', 'error', 'hint'],
  'lr-option': ['start', 'end'],
  'lr-input': ['form-control-label', 'start', 'end', 'error', 'hint'],
  'lr-select': ['form-control-label', 'start', 'end', 'error', 'hint'],
  'lr-textarea': ['form-control-label', 'error', 'hint'],
  'lr-breadcrumb-item': ['start', 'end'],
  'lr-file-input': ['form-control-label', 'error', 'hint'],
};
const populatedHydrationTags = new Set([
  ...Object.keys(progressiveSlotParts),
  'lr-chip-group',
  'lr-avatar-group',
  'lr-flow-canvas',
  'lr-dashboard-grid',
  'lr-table',
  'lr-document-library',
  'lr-emoji-picker',
  'lr-virtual-list',
  'lr-qr-code',
  'lr-video-playlist',
  'lr-result-field',
  'lr-result-card',
  'lr-tab-group',
  'lr-multi-split',
]);
for (const [tag, markup] of statefulProbeMarkup) {
  const entry = entries.find((candidate) => candidate.tag === tag);
  if (hydrationTag && !entry) continue;
  if (hydrationTag && tag !== hydrationTag) continue;
  assert.ok(entry, `${tag}: missing stateful hydration entry`);
  entry.html = markup;
}
const litRoot = await realpath(join(packageDir, 'node_modules', 'lit'));
const litDependencyRoot = resolve(litRoot, '..');
const floatingDomRoot = await realpath(
  join(packageDir, 'node_modules', '@floating-ui', 'dom')
);
const floatingScopeRoot = resolve(floatingDomRoot, '..');

const mounts = new Map([
  ['/dist/', join(packageDir, 'dist')],
  [
    '/modules/ssr-client/',
    await realpath(join(packageDir, 'node_modules', '@lit-labs', 'ssr-client')),
  ],
  ['/modules/lit/', litRoot],
  ['/modules/lit-html/', await realpath(join(litDependencyRoot, 'lit-html'))],
  [
    '/modules/lit-element/',
    await realpath(join(litDependencyRoot, 'lit-element')),
  ],
  [
    '/modules/reactive-element/',
    await realpath(join(litDependencyRoot, '@lit', 'reactive-element')),
  ],
  ['/modules/floating-dom/', floatingDomRoot],
  ['/modules/floating-core/', await realpath(join(floatingScopeRoot, 'core'))],
  [
    '/modules/floating-utils/',
    await realpath(join(floatingScopeRoot, 'utils')),
  ],
]);

const importMap = {
  imports: {
    '@lit-labs/ssr-client/': '/modules/ssr-client/',
    '@lit/reactive-element': '/modules/reactive-element/reactive-element.js',
    '@lit/reactive-element/': '/modules/reactive-element/',
    lit: '/modules/lit/index.js',
    'lit/': '/modules/lit/',
    'lit-html': '/modules/lit-html/lit-html.js',
    'lit-html/': '/modules/lit-html/',
    'lit-element/': '/modules/lit-element/',
    '@floating-ui/dom': '/modules/floating-dom/dist/floating-ui.dom.mjs',
    '@floating-ui/core': '/modules/floating-core/dist/floating-ui.core.mjs',
    '@floating-ui/utils': '/modules/floating-utils/dist/floating-ui.utils.mjs',
    '@floating-ui/utils/dom':
      '/modules/floating-utils/dist/floating-ui.utils.dom.mjs',
  },
};

const optionalRegistrationUrls = inventory.components
  .filter(({ rootIncluded }) => !rootIncluded)
  .map(
    (component) =>
      `/${registrationDistPath(component)
        .slice(packageDir.length + 1)
        .replaceAll('\\', '/')}`
  );

const fixtureMarkup = entries
  .map(
    ({ tag, html }) => `<section data-fixture-tag="${tag}">${html}</section>`
  )
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
      // Property bindings do not serialize as attributes. Restore each populated probe's public
      // model on the still-unupgraded host so its first browser render is meaningfully comparable
      // with the property-driven declarative shadow DOM emitted by the server.
      for (const fixture of document.querySelectorAll('[data-fixture-tag]')) {
        const host = fixture.firstElementChild;
        switch (host.localName) {
          case 'lr-flow-canvas':
            host.nodes = [
              { id: 'fetch', data: { label: 'Fetch' }, position: { x: 0, y: 0 } },
              { id: 'answer', data: { label: 'Answer' }, position: { x: 240, y: 0 } },
            ];
            host.edges = [{ id: 'fetch-answer', source: 'fetch', target: 'answer' }];
            break;
          case 'lr-dashboard-grid':
            host.layout = [{ cellId: 'summary', x: 0, y: 0, w: 3, h: 1, label: 'Summary' }];
            break;
          case 'lr-table':
            host.columns = [{ key: 'name', label: 'Name', cell: (row) => row.name }];
            host.rows = [{ name: 'Alpha.pdf' }];
            break;
          case 'lr-document-library':
            host.documents = [{ id: 'alpha', name: 'Alpha.pdf', mimeType: 'application/pdf' }];
            break;
          case 'lr-emoji-picker':
            host.groups = [{
              key: 'faces',
              label: 'Faces',
              emojis: Array.from(
                { length: 200 },
                (_value, index) => ({ emoji: '😀', name: 'face-' + index }),
              ),
            }];
            break;
          case 'lr-virtual-list':
            host.items = ['Alpha', 'Beta'];
            host.renderItem = (item) => item;
            break;
          case 'lr-video-playlist':
            host.items = [
              {
                title: 'Server introduction',
                duration: 125,
              },
              { title: 'Unavailable lesson', unavailable: true },
            ];
            break;
          case 'lr-multi-split':
            host.sizes = [50, 50];
            break;
        }
      }
      globalThis.__lyraSemanticSnapshot = (host) => ({
        hostRole: host.getAttribute('role'),
        statusOwnerCount:
          (host.getAttribute('role') === 'status' ? 1 : 0) +
          (host.shadowRoot?.querySelectorAll('[role="status"]').length ?? 0),
        sliderOwnerCount:
          (host.getAttribute('role') === 'slider' ? 1 : 0) +
          (host.shadowRoot?.querySelectorAll('[role="slider"]').length ?? 0),
        shadowStatusOwnerCount: host.shadowRoot?.querySelectorAll('[role="status"]').length ?? 0,
        shadowSliderOwnerCount: host.shadowRoot?.querySelectorAll('[role="slider"]').length ?? 0,
        tabindex: host.getAttribute('tabindex'),
        accessibleName: host.getAttribute('aria-label'),
        managedAccessibleName: host.getAttribute('data-lr-rating-managed-label'),
        valueMin: host.getAttribute('aria-valuemin'),
        valueMax: host.getAttribute('aria-valuemax'),
        valueNow: host.getAttribute('aria-valuenow'),
        valueText: host.getAttribute('aria-valuetext'),
        disabled: host.getAttribute('aria-disabled'),
        readonly: host.getAttribute('aria-readonly'),
        required: host.getAttribute('aria-required'),
      });
      const progressivePartsByTag = ${JSON.stringify(progressiveSlotParts)};
      globalThis.__lyraPopulatedNode = (host) => {
        switch (host.localName) {
          case 'lr-flow-canvas':
            return host.shadowRoot?.querySelector('[data-node-id="fetch"]');
          case 'lr-dashboard-grid':
            return host.shadowRoot?.querySelector('[data-cell-id="summary"]');
          case 'lr-table':
            return host.shadowRoot?.querySelector('tbody tr');
          case 'lr-document-library':
            return host.shadowRoot?.querySelector('lr-table')?.shadowRoot?.querySelector('tbody tr');
          case 'lr-emoji-picker':
            return host.shadowRoot?.querySelector('[part~="emoji"]');
          case 'lr-virtual-list':
            return host.shadowRoot?.querySelector('[data-row-index="0"]');
          case 'lr-qr-code':
            // The optional peer may resolve immediately after the first update and legitimately
            // replace the pending child. The populated component's stable server-owned wrapper is
            // the node whose hydration identity is contractual.
            return host.shadowRoot?.querySelector('[part~="qr-code"]');
          case 'lr-video-playlist':
            return host.shadowRoot?.querySelector('[part~="playlist-item"]');
          case 'lr-result-field':
            return host.shadowRoot?.querySelector('[part="value"]');
          case 'lr-result-card':
            return host.shadowRoot?.querySelector('[part="actions"]');
          case 'lr-tab-group':
            return host.shadowRoot?.querySelector('slot:not([name])');
          case 'lr-multi-split':
            return host.shadowRoot?.querySelector('[role="separator"]');
          case 'lr-badge':
          case 'lr-tag':
          case 'lr-chip':
            return host.shadowRoot?.querySelector('[part~="start"]');
          case 'lr-alert':
          case 'lr-callout':
          case 'lr-empty':
            return host.shadowRoot?.querySelector('[part~="icon"]');
          case 'lr-chip-group':
          case 'lr-avatar-group':
            return host.shadowRoot?.querySelector('slot:not([name])');
          case 'lr-lightbox':
            return host.shadowRoot?.querySelector('[part~="actions"]');
        }
        const firstProgressivePart = progressivePartsByTag[host.localName]?.[0];
        if (firstProgressivePart) {
          return host.shadowRoot?.querySelector('[part~="' + firstProgressivePart + '"]');
        }
        return undefined;
      };
      globalThis.__lyraBeforeHydration = new Map(
        [...document.querySelectorAll('[data-fixture-tag]')].map((fixture) => {
          const host = fixture.firstElementChild;
          return [fixture.dataset.fixtureTag, {
            host,
            root: host.shadowRoot,
            shadowNodes: host.shadowRoot ? [...host.shadowRoot.childNodes] : [],
            lightNode: host.querySelector('[data-ssr-light]'),
            populatedNode: globalThis.__lyraPopulatedNode(host),
            directShadowNodeSignature: host.shadowRoot
              ? [...host.shadowRoot.childNodes].map((node) => ({
                  type: node.nodeType,
                  name: node.nodeName,
                  text: node.nodeType === Node.COMMENT_NODE ? node.data : undefined,
                }))
              : [],
            semantics: globalThis.__lyraSemanticSnapshot(host),
            chipIcon: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="start"]')
              : undefined,
            chipRemoveButton: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')
              : undefined,
            chipIconHidden: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="start"]')?.hasAttribute('hidden')
              : undefined,
            chipRemoveLabel: host.localName === 'lr-chip'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
              : undefined,
            flowPulse: host.localName === 'lr-flow-node'
              ? host.shadowRoot?.querySelector('[part~="card"]')?.hasAttribute('data-pulse')
              : undefined,
            flowHasBuiltInHeader: host.localName === 'lr-flow-node'
              ? host.shadowRoot?.querySelector('[part="header"]')?.hasAttribute('hidden') === false
              : undefined,
            tagRemoveButton: host.localName === 'lr-tag'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')
              : undefined,
            tagRemoveLabel: host.localName === 'lr-tag'
              ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
              : undefined,
            progressiveParts: progressivePartsByTag[host.localName] ?? [],
            progressivePartNodes: Object.fromEntries(
              (progressivePartsByTag[host.localName] ?? []).map((part) => [
                part,
                host.shadowRoot?.querySelector('[part~="' + part + '"]'),
              ]),
            ),
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
        const withTimeout = async (promise, label) => {
          let handle;
          try {
            return await Promise.race([
              promise,
              new Promise((_resolve, reject) => {
                handle = setTimeout(() => reject(new Error(label + ' timed out')), 15_000);
              }),
            ]);
          } finally {
            clearTimeout(handle);
          }
        };
        const firstHydrationPromises = fixtures.map(async (fixture) => {
          const tag = fixture.dataset.fixtureTag;
          const host = fixture.firstElementChild;
          const before = globalThis.__lyraBeforeHydration.get(tag);
          try {
            await withTimeout(customElements.whenDefined(host.localName), tag + ' definition');
            if (host.updateComplete) {
              await withTimeout(host.updateComplete, tag + ' first update');
            }
            firstHydrationResults.set(tag, {
            semantics: globalThis.__lyraSemanticSnapshot(host),
            rootReused: before.root !== null && before.root === host.shadowRoot,
            shadowNodesReused:
              before.root !== null &&
              before.shadowNodes.length === host.shadowRoot?.childNodes.length &&
              before.shadowNodes.every(
                (node, index) => host.shadowRoot.childNodes[index] === node,
              ),
            populatedNodeReused:
              before.populatedNode !== undefined &&
              before.populatedNode === globalThis.__lyraPopulatedNode(host),
            directShadowNodeSignature: host.shadowRoot
              ? [...host.shadowRoot.childNodes].map((node) => ({
                  type: node.nodeType,
                  name: node.nodeName,
                  text: node.nodeType === Node.COMMENT_NODE ? node.data : undefined,
                }))
              : [],
            chipIconReused:
              before.chipIcon ===
              (host.localName === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="start"]')
                : undefined),
            chipRemoveButtonReused:
              before.chipRemoveButton ===
              (host.localName === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')
                : undefined),
            chipIconHiddenPreserved:
              before.chipIconHidden ===
              (host.localName === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="start"]')?.hasAttribute('hidden')
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
                ? host.shadowRoot?.querySelector('[part="header"]')?.hasAttribute('hidden') === false
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
            progressivePartsPreserved: before.progressiveParts.every((part) => {
              const server = before.progressivePartNodes[part];
              const current = host.shadowRoot?.querySelector('[part~="' + part + '"]');
              return server != null && server === current && !current.hasAttribute('hidden');
            }),
            });
          } catch (error) {
            const detail = error instanceof Error ? error.stack ?? error.message : String(error);
            throw new Error(tag + ': first hydration failed: ' + detail);
          }
        });
        globalThis.__lyraHydrationStage = 'importing-loader';
        const loader = await import('/dist/ssr-loader.js');
        globalThis.__lyraHydrationStage = 'importing-optional-registrations';
        await Promise.all(${JSON.stringify(
          optionalRegistrationUrls
        )}.map((url) => import(url)));
        globalThis.__lyraHydrationStage = 'awaiting-first-updates';
        await Promise.all(firstHydrationPromises);
        globalThis.__lyraHydrationStage = 'awaiting-settled-updates';
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

        globalThis.__lyraHydrationStage = 'diagnosing';
        const diagnostics = await Promise.all(fixtures.map(async (fixture) => {
          const host = fixture.firstElementChild;
          const tag = fixture.dataset.fixtureTag;
          const mode = loader.getLyraSsrMode(tag);
          if (!customElements.get(host.localName)) {
            return { tag, mode, status: 'unregistered' };
          }
          // The crawl already awaited and captured the first hydration update above. A component
          // may legitimately start open-ended media/observer work in a corrective update; runtime
          // readiness here is structural and must not hang the gate on a moving updateComplete.
          return {
            tag,
            mode,
            status: host.shadowRoot
              ? mode === 'render-and-hydrate' ? 'hydrated' : 'client-rendered'
              : 'missing-shadow-root',
          };
        }));
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
              serverSemantics: before.semantics,
              firstHydrationSemantics: firstHydration.semantics,
              hydratedSemantics: globalThis.__lyraSemanticSnapshot(host),
              rootReused: firstHydration.rootReused,
              shadowNodesReused: firstHydration.shadowNodesReused,
              populatedFirstNodeReused: firstHydration.populatedNodeReused,
              directShadowNodeSignatureBefore: before.directShadowNodeSignature,
              directShadowNodeSignatureAfter: firstHydration.directShadowNodeSignature,
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
              progressiveServerPartsVisible: before.progressiveParts.every((part) => {
                const server = before.progressivePartNodes[part];
                return server != null && !server.hasAttribute('hidden');
              }),
              progressiveFirstPartsPreserved: firstHydration.progressivePartsPreserved,
              progressiveSettledPartsPreserved: before.progressiveParts.every((part) => {
                const server = before.progressivePartNodes[part];
                const current = host.shadowRoot?.querySelector('[part~="' + part + '"]');
                return server != null && server === current && !current.hasAttribute('hidden');
              }),
              startedWithoutShadow: before.root === null,
              hasClientShadow: host.shadowRoot !== null,
              lightNodeReused: before.lightNode === host.querySelector('[data-ssr-light]'),
              probeAttribute: host.getAttribute('data-ssr-probe'),
              chipIconReused: tag === 'lr-chip'
                ? before.chipIcon === host.shadowRoot?.querySelector('[part~="start"]')
                : undefined,
              chipRemoveButtonReused: tag === 'lr-chip'
                ? before.chipRemoveButton ===
                  host.shadowRoot?.querySelector('[part~="remove-button"]')
                : undefined,
              chipIconHidden: tag === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="start"]')?.hasAttribute('hidden')
                : undefined,
              chipRemoveLabel: tag === 'lr-chip'
                ? host.shadowRoot?.querySelector('[part~="remove-button"]')?.getAttribute('aria-label')
                : undefined,
              flowPulse: tag === 'lr-flow-node'
                ? host.shadowRoot?.querySelector('[part~="card"]')?.hasAttribute('data-pulse')
                : undefined,
              flowHasBuiltInHeader: tag === 'lr-flow-node'
                ? host.shadowRoot?.querySelector('[part="header"]')?.hasAttribute('hidden') === false
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
        globalThis.__lyraHydrationStage = 'done';
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
      'content-type':
        mimeTypes[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end('Not found');
  }
}

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(
    new URL(request.url ?? '/', 'http://localhost').pathname
  );
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
assert.ok(
  address && typeof address !== 'string',
  'hydration server did not expose a port'
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.emulateMedia({ reducedMotion: 'no-preference' });
const browserFindings = [];
page.on('pageerror', (error) =>
  browserFindings.push(`pageerror: ${error.stack ?? error.message}`)
);
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    if (/needs the optional peer dependenc(?:y|ies)/.test(message.text()))
      return;
    browserFindings.push(`console.${message.type()}: ${message.text()}`);
  }
});
page.on('requestfailed', (request) => {
  browserFindings.push(
    `request failed: ${request.url()} (${
      request.failure()?.errorText ?? 'unknown'
    })`
  );
});

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  try {
    await page.waitForFunction(
      () => globalThis.__lyraHydrationDone === true,
      undefined,
      {
        timeout: 60_000,
      }
    );
  } catch (error) {
    const stage = await page.evaluate(() => globalThis.__lyraHydrationStage);
    throw new Error(
      `hydration fixture timed out during ${stage ?? 'startup'}`,
      { cause: error }
    );
  }
  const outcome = await page.evaluate(() => ({
    error: globalThis.__lyraHydrationError,
    result: globalThis.__lyraHydrationResult,
  }));
  assert.equal(
    outcome.error,
    undefined,
    `hydration fixture failed: ${outcome.error}`
  );
  assert.equal(
    outcome.result.components.length,
    entries.length,
    'hydration result count drifted from inventory'
  );

  const shouldAssertHydrationTag = (tag) =>
    hydrationTag === undefined || hydrationTag === tag;
  const hydrationResult = (tag) => {
    const component = outcome.result.components.find(
      (candidate) => candidate.tag === tag
    );
    assert.ok(component, `${tag} must be present in the hydration crawl`);
    return component;
  };
  const semanticPhases = (component) => [
    ['server', component.serverSemantics],
    ['first hydration update', component.firstHydrationSemantics],
    ['settled hydration', component.hydratedSemantics],
  ];

  if (shouldAssertHydrationTag('lr-badge')) {
    const badgeHydration = hydrationResult('lr-badge');
    const expectedBadgeSemantics = {
      hostRole: 'status',
      statusOwnerCount: 1,
      sliderOwnerCount: 0,
      shadowStatusOwnerCount: 0,
      shadowSliderOwnerCount: 0,
      tabindex: null,
      accessibleName: null,
      managedAccessibleName: null,
      valueMin: null,
      valueMax: null,
      valueNow: null,
      valueText: null,
      disabled: null,
      readonly: null,
      required: null,
    };
    for (const [phase, semantics] of semanticPhases(badgeHydration)) {
      assert.deepEqual(
        semantics,
        expectedBadgeSemantics,
        `lr-badge ${phase} must retain exactly one host status owner and no shadow duplicate`
      );
    }
  }

  if (shouldAssertHydrationTag('lr-rating')) {
    const ratingHydration = hydrationResult('lr-rating');
    const expectedRatingSemantics = {
      hostRole: 'slider',
      statusOwnerCount: 0,
      sliderOwnerCount: 1,
      shadowStatusOwnerCount: 0,
      shadowSliderOwnerCount: 0,
      tabindex: '-1',
      accessibleName: 'Quality score',
      managedAccessibleName: null,
      valueMin: '0',
      valueMax: '7',
      valueNow: '3',
      valueText: '3',
      disabled: 'true',
      readonly: 'true',
      required: 'true',
    };
    for (const [phase, semantics] of semanticPhases(ratingHydration)) {
      assert.deepEqual(
        semantics,
        expectedRatingSemantics,
        `lr-rating ${phase} must retain one host-owned value/name/state slider surface`
      );
    }
  }

  if (shouldAssertHydrationTag('lr-checkbox')) {
    const checkboxHydration = hydrationResult('lr-checkbox');
    assert.equal(
      checkboxHydration.mode,
      'render-and-hydrate',
      'lr-checkbox must retain node-preserving server hydration'
    );
    assert.equal(
      checkboxHydration.rootReused,
      true,
      'lr-checkbox must reuse its declarative shadow root on the first hydration update'
    );
    assert.equal(
      checkboxHydration.shadowNodesReused,
      true,
      'lr-checkbox must preserve its server shadow nodes on the first hydration update'
    );
  }

  if (shouldAssertHydrationTag('lr-chip')) {
    const chipHydration = hydrationResult('lr-chip');
    assert.equal(
      chipHydration.mode,
      'render-and-hydrate',
      'lr-chip must retain node-preserving server hydration'
    );
    assert.equal(
      chipHydration.rootReused && chipHydration.shadowNodesReused,
      true,
      'lr-chip must preserve its declarative root and direct nodes on the first hydration update'
    );
    assert.equal(
      chipHydration.chipServerIconHidden,
      false,
      'server chip must progressively expose authored icon content without JavaScript'
    );
    assert.equal(
      chipHydration.chipServerRemoveLabel,
      'Remove',
      'server chip must use the context-free remove label while light DOM is unavailable'
    );
    assert.deepEqual(
      {
        iconReused: chipHydration.chipFirstIconReused,
        removeButtonReused: chipHydration.chipFirstRemoveButtonReused,
        iconHiddenPreserved: chipHydration.chipFirstIconHiddenPreserved,
        removeLabelPreserved: chipHydration.chipFirstRemoveLabelPreserved,
      },
      {
        iconReused: true,
        removeButtonReused: true,
        iconHiddenPreserved: true,
        removeLabelPreserved: true,
      },
      'lr-chip first hydration render must preserve its nested actions and server-only state'
    );
    assert.equal(
      chipHydration.chipIconReused && chipHydration.chipRemoveButtonReused,
      true,
      'lr-chip corrective update must preserve the server icon and remove-button nodes'
    );
    assert.equal(
      chipHydration.chipIconHidden,
      false,
      'hydrated chip must reveal its assigned icon'
    );
    assert.equal(
      chipHydration.chipRemoveLabel,
      'Remove Research',
      'hydrated chip must add its light-DOM context to the remove label'
    );
  }

  for (const tag of Object.keys(progressiveSlotParts)) {
    if (!shouldAssertHydrationTag(tag)) continue;
    const component = hydrationResult(tag);
    assert.equal(
      component.progressiveServerPartsVisible,
      true,
      `${tag} populated SSR must leave authored slot wrappers visible without JavaScript`
    );
    assert.equal(
      component.progressiveFirstPartsPreserved,
      true,
      `${tag} first hydration update must reuse and preserve every progressive slot wrapper`
    );
    assert.equal(
      component.progressiveSettledPartsPreserved,
      true,
      `${tag} settled hydration must keep every authored slot wrapper visible and reused`
    );
  }

  if (shouldAssertHydrationTag('lr-flow-node')) {
    const flowNodeHydration = hydrationResult('lr-flow-node');
    assert.equal(
      flowNodeHydration.mode,
      'render-and-hydrate',
      'lr-flow-node must retain node-preserving server hydration'
    );
    assert.equal(
      flowNodeHydration.rootReused && flowNodeHydration.shadowNodesReused,
      true,
      'lr-flow-node must preserve its declarative root and nodes on the first hydration update'
    );
    assert.equal(
      flowNodeHydration.flowServerPulse,
      false,
      'server flow node must start without motion'
    );
    assert.equal(
      flowNodeHydration.flowServerHasBuiltInHeader,
      true,
      'server flow node must retain its fallback header before slot assignment is observable'
    );
    assert.equal(
      flowNodeHydration.flowPulsePreserved &&
        flowNodeHydration.flowHeaderPreserved,
      true,
      'lr-flow-node first hydration render must reproduce both server-only state decisions'
    );
    assert.equal(
      flowNodeHydration.flowPulse,
      true,
      'hydrated running flow node must enable motion'
    );
    assert.equal(
      flowNodeHydration.flowHasBuiltInHeader,
      false,
      'hydrated flow node must replace its fallback with the assigned header'
    );
  }

  if (shouldAssertHydrationTag('lr-menu-item')) {
    const menuItemHydration = hydrationResult('lr-menu-item');
    assert.equal(
      menuItemHydration.mode,
      'render-and-hydrate',
      'lr-menu-item must retain node-preserving server hydration'
    );
    assert.equal(
      menuItemHydration.rootReused,
      true,
      'lr-menu-item must reuse its declarative shadow root on the first hydration update'
    );
    assert.equal(
      menuItemHydration.shadowNodesReused,
      true,
      'lr-menu-item must preserve its server shadow nodes on the first hydration update'
    );
    assert.equal(
      menuItemHydration.menuAriaDisabled,
      'true',
      'hydrated disabled/loading menu item must retain its disabled semantics'
    );
    assert.equal(
      menuItemHydration.menuHasSpinner,
      true,
      'hydrated loading menu item must retain its spinner state'
    );
  }

  if (shouldAssertHydrationTag('lr-tag')) {
    const tagHydration = hydrationResult('lr-tag');
    for (const [phase, semantics] of semanticPhases(tagHydration)) {
      assert.equal(
        semantics.statusOwnerCount,
        0,
        `lr-tag ${phase} must not acquire badge status semantics`
      );
      assert.equal(
        semantics.shadowStatusOwnerCount,
        0,
        `lr-tag ${phase} must not expose a shadow status owner`
      );
    }
    assert.equal(
      tagHydration.mode,
      'render-and-hydrate',
      'lr-tag must retain node-preserving server hydration'
    );
    assert.equal(
      tagHydration.rootReused && tagHydration.shadowNodesReused,
      true,
      'lr-tag must preserve its declarative root and nodes on the first hydration update'
    );
    assert.equal(
      tagHydration.tagServerRemoveLabel,
      'Remove',
      'server tag must use the context-free remove label while light DOM is unavailable'
    );
    assert.equal(
      tagHydration.tagFirstRemoveButtonReused &&
        tagHydration.tagFirstRemoveLabelPreserved,
      true,
      'lr-tag first hydration render must preserve the server remove action and its bare label'
    );
    assert.equal(
      tagHydration.tagRemoveButtonReused,
      true,
      'lr-tag contextual-label update must keep the server remove button node'
    );
    assert.equal(
      tagHydration.tagRemoveLabel,
      'Remove Alpha',
      'hydrated tag must add its light-DOM context to the remove label'
    );
  }

  const failures = [...outcome.result.updateErrors, ...browserFindings];
  for (const result of outcome.result.components) {
    if (result.probeAttribute !== result.tag)
      failures.push(`${result.tag}: host attribute changed`);
    if (!result.lightNodeReused)
      failures.push(`${result.tag}: light DOM node identity changed`);
    if (result.mode === 'render-and-hydrate') {
      if (result.status !== 'hydrated')
        failures.push(`${result.tag}: diagnostic=${result.status}`);
      if (!result.rootReused)
        failures.push(`${result.tag}: declarative shadow root was replaced`);
      if (!result.shadowNodesReused) {
        failures.push(
          `${result.tag}: server shadow nodes were replaced ` +
            JSON.stringify({
              before: result.directShadowNodeSignatureBefore,
              after: result.directShadowNodeSignatureAfter,
            })
        );
      }
      if (
        populatedHydrationTags.has(result.tag) &&
        !result.populatedFirstNodeReused
      ) {
        failures.push(
          `${result.tag}: populated server node was replaced on first hydration`
        );
      }
    } else {
      if (result.status !== 'client-rendered')
        failures.push(`${result.tag}: diagnostic=${result.status}`);
      if (!result.startedWithoutShadow)
        failures.push(`${result.tag}: fallback emitted server shadow DOM`);
      if (!result.hasClientShadow)
        failures.push(
          `${result.tag}: client upgrade did not render shadow DOM`
        );
    }
  }
  assert.deepEqual(
    failures,
    [],
    `hydration contract failures:\n${failures.join('\n')}`
  );
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(
  `Hydration crawl passed: ${loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS.length} shadow roots reused, ` +
    `${loader.LYRA_SSR_CLIENT_RENDER_TAGS.length} explicit client fallbacks upgraded.`
);
