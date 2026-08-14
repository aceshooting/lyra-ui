import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import {
  enumeratePublicSsrStateCases,
  loadSsrFixtureContext,
  readEditorHtmlData,
  renderSsrMatrix,
  renderSsrProbe,
  renderSsrStateProbe,
  packageDir,
} from './ssr-fixture.mjs';

assert.equal(globalThis.window, undefined, 'SSR gate must run without a window shim');
assert.equal(globalThis.document, undefined, 'SSR gate must run without a document shim');

function assertIsolatedNodeImport(label, source) {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', source],
    { cwd: packageDir, encoding: 'utf8' },
  );
  assert.equal(
    result.status,
    0,
    `${label} failed under Node:\n${result.stderr || result.stdout}`,
  );
}

// Keep each public import shape isolated. In particular, importing the all-components barrel before
// the granular registrations would populate Node's module cache and could conceal a top-level
// browser-global access in a granular module.
const noBrowserGlobals =
  "if (typeof window !== 'undefined' || typeof document !== 'undefined') process.exit(2);";
assertIsolatedNodeImport(
  'root package import',
  `${noBrowserGlobals} await import('@aceshooting/lyra-ui'); ${noBrowserGlobals}`,
);
assertIsolatedNodeImport(
  'SSR loader import',
  `${noBrowserGlobals} await import('@aceshooting/lyra-ui/ssr-loader.js'); ${noBrowserGlobals}`,
);
assertIsolatedNodeImport(
  'granular registration imports',
  `
    import { readFile } from 'node:fs/promises';
    import { join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    ${noBrowserGlobals}
    const packageDir = ${JSON.stringify(packageDir)};
    const inventory = JSON.parse(
      await readFile(join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
    );
    for (const component of inventory.components) {
      const modulePath = join(
        packageDir,
        'dist',
        component.registrationModule.slice('src/'.length).replace(/\\.ts$/, '.js'),
      );
      await import(pathToFileURL(modulePath));
    }
    ${noBrowserGlobals}
  `,
);

// Animated Image's reduced-motion branch used to assume a browser-owned document during render.
// Keep a named, document-less server-render regression ahead of the aggregate traversal so a
// recurrence points to the exact component instead of aborting anonymously partway through it.
const animatedImageContext = await loadSsrFixtureContext();
const animatedImageHtml = await renderSsrProbe(
  'lr-animated-image',
  animatedImageContext.elementRenderers,
);
assert.match(
  animatedImageHtml,
  /part="base"/,
  'lr-animated-image must render without an owner document on the server',
);

// Checkbox seeds browser slot-presence state on its first connection. Keep that optimization from
// making server rendering depend on a browser-owned render root or light-DOM child collections.
const checkboxHtml = await renderSsrProbe(
  'lr-checkbox',
  animatedImageContext.elementRenderers,
);
assert.match(
  checkboxHtml,
  /part="base checkbox"/,
  'lr-checkbox must render before browser slot assignment is observable',
);

// Menu-item state changes are browser notifications, but their first reactive update also runs in
// the server renderer. Exercise the mapped subclass that exposed the ownerless event path.
const dropdownItemHtml = await renderSsrProbe(
  'lr-dropdown-item',
  animatedImageContext.elementRenderers,
);
assert.match(
  dropdownItemHtml,
  /part="base"/,
  'lr-dropdown-item must render when no owner document is available for event construction',
);

// Flow Node resolves reduced-motion from its current browser owner. On the server that owner is
// intentionally absent, so a running-card decoration must fail closed instead of aborting render.
const flowNodeHtml = await renderSsrProbe(
  'lr-flow-node',
  animatedImageContext.elementRenderers,
);
assert.match(
  flowNodeHtml,
  /part="card"/,
  'lr-flow-node must render without an owner window for reduced-motion detection',
);

// Flow Canvas resolves edge reduced-motion from its current browser owner. Server rendering has
// no owner document, so its empty surface must still complete the no-window render path.
const flowCanvasHtml = await renderSsrProbe(
  'lr-flow-canvas',
  animatedImageContext.elementRenderers,
);
assert.match(
  flowCanvasHtml,
  /part="base"/,
  'lr-flow-canvas must render edges without an owner document on the server',
);

// Tree Item's browser-only declarative-label sampling participates in its first-render state. The
// server has neither a render root nor light-DOM collections, and must retain the fallback state.
const treeItemHtml = await renderSsrProbe(
  'lr-tree-item',
  animatedImageContext.elementRenderers,
);
assert.match(
  treeItemHtml,
  /part="base tree-item"/,
  'lr-tree-item must render before declarative label assignment is observable',
);

// Table captures a browser roving-focus owner before collection updates. Server rendering has no
// HTMLElement constructor or active element, so the first reactive update must skip that browser-
// only focus snapshot without aborting the otherwise server-renderable table.
const tableHtml = await renderSsrProbe(
  'lr-table',
  animatedImageContext.elementRenderers,
);
assert.match(
  tableHtml,
  /part="base"/,
  'lr-table must render without a browser HTMLElement constructor',
);

// Property bindings are the primary authoring surface for collection/model components. The
// inventory crawl above only exercises empty defaults, which previously let every one of these
// populated states crash, disappear, or serialize a false empty state while the tag still claimed
// render-and-hydrate support.
const populatedFlowNodes = [
  { id: 'fetch', data: { label: 'Fetch' }, position: { x: 0, y: 0 } },
  { id: 'answer', data: { label: 'Answer' }, position: { x: 240, y: 0 } },
];
const populatedFlowEdges = [{ id: 'fetch-answer', source: 'fetch', target: 'answer' }];
const populatedFlowCanvasHtml = await collectResult(
  render(
    html`<lr-flow-canvas
      .nodes=${populatedFlowNodes}
      .edges=${populatedFlowEdges}
    ></lr-flow-canvas>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(populatedFlowCanvasHtml, /data-node-id="fetch"/, 'populated lr-flow-canvas SSR lost its first node');
assert.match(populatedFlowCanvasHtml, /data-edge-id="fetch-answer"/, 'populated lr-flow-canvas SSR lost its edge');

const populatedDashboardHtml = await collectResult(
  render(
    html`<lr-dashboard-grid .layout=${[
      { id: 'summary', x: 0, y: 0, w: 3, h: 1, label: 'Summary' },
    ]}></lr-dashboard-grid>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(populatedDashboardHtml, /data-cell-id="summary"/, 'populated lr-dashboard-grid SSR lost its cell');
assert.doesNotMatch(
  populatedDashboardHtml,
  /<(?:div|p|span)[^>]*part="empty"/,
  'populated lr-dashboard-grid SSR serialized a false empty state',
);

const populatedTableHtml = await collectResult(
  render(
    html`<lr-table
      aria-label="Documents"
      .columns=${[{ key: 'name', label: 'Name', cell: (row) => row.name }]}
      .rows=${[{ name: 'Alpha.pdf' }]}
    ></lr-table>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(populatedTableHtml, /Alpha\.pdf/, 'populated lr-table SSR lost its row content');
assert.doesNotMatch(
  populatedTableHtml,
  /<(?:div|p|span)[^>]*part="empty"/,
  'populated lr-table SSR serialized a false empty state',
);

const populatedDocumentLibraryHtml = await collectResult(
  render(
    html`<lr-document-library .documents=${[
      { id: 'alpha', name: 'Alpha.pdf', mimeType: 'application/pdf' },
    ]}></lr-document-library>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(populatedDocumentLibraryHtml, /Alpha\.pdf/, 'populated lr-document-library SSR lost its document row');
assert.doesNotMatch(
  populatedDocumentLibraryHtml,
  /<(?:div|p|span)[^>]*part="empty"/,
  'populated lr-document-library SSR serialized a false empty table',
);

const emojiGroups = (count) => [{
  label: 'Faces',
  emojis: Array.from({ length: count }, (_value, index) => ({ emoji: '😀', name: `face-${index}` })),
}];
for (const count of [199, 200, 201]) {
  const emojiHtml = await collectResult(
    render(html`<lr-emoji-picker .groups=${emojiGroups(count)}></lr-emoji-picker>`, {
      elementRenderers: animatedImageContext.elementRenderers,
    }),
  );
  assert.match(emojiHtml, /part="emoji"/, `lr-emoji-picker SSR lost options at the ${count}-item threshold`);
  assert.doesNotMatch(
    emojiHtml,
    /<(?:div|p|span)[^>]*part="empty"/,
    `lr-emoji-picker SSR serialized false empty state at ${count} items`,
  );
}

const populatedVirtualListHtml = await collectResult(
  render(
    html`<lr-virtual-list
      aria-label="Results"
      row-height="48"
      .items=${['Alpha', 'Beta']}
      .renderItem=${(item) => item}
    ></lr-virtual-list>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(populatedVirtualListHtml, /data-row-index="0"/, 'populated lr-virtual-list SSR emitted no initial row window');
assert.match(populatedVirtualListHtml, /Alpha/, 'populated lr-virtual-list SSR lost its first item');

const populatedQrHtml = await collectResult(
  render(html`<lr-qr-code value="hello"></lr-qr-code>`, {
    elementRenderers: animatedImageContext.elementRenderers,
  }),
);
assert.match(populatedQrHtml, /part="loading"/, 'populated lr-qr-code SSR must serialize an honest pending state');
assert.doesNotMatch(populatedQrHtml, /part="empty"/, 'populated lr-qr-code SSR must not claim it has no data');

const populatedVideoPlaylistHtml = await collectResult(
  render(
    html`<lr-video-playlist
      .items=${[
        {
          title: 'Server introduction',
          poster: 'https://example.test/intro.jpg',
          duration: 125,
        },
        { title: 'Unavailable lesson', unavailable: true },
      ]}
    ><lr-video title="Server introduction" poster="https://example.test/intro.jpg"></lr-video
      ><lr-video title="Unavailable lesson" inert></lr-video
    ></lr-video-playlist>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.equal(
  [...populatedVideoPlaylistHtml.matchAll(/<button[^>]*part="playlist-item"/g)].length,
  2,
  'populated lr-video-playlist SSR must serialize every seeded playlist row',
);
assert.match(
  populatedVideoPlaylistHtml,
  /Server introduction/,
  'populated lr-video-playlist SSR lost its first title',
);
assert.match(
  populatedVideoPlaylistHtml,
  /part="playlist-duration"[^]*2:05/,
  'populated lr-video-playlist SSR lost its deterministic duration',
);

// Light-DOM collection APIs are equally absent from Lit's server element model. These populated
// slot probes make fallback duplication and missing interactive structure visible independently of
// the generic light-DOM-preservation assertion below.
const populatedResultFieldHtml = await collectResult(
  render(
    html`<lr-result-field label="Status" value="fallback"><span data-rich-value>Live</span></lr-result-field>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.doesNotMatch(
  populatedResultFieldHtml,
  /part="value"[^]*>[^<]*fallback[^]*<slot/,
  'lr-result-field SSR must not duplicate its value fallback beside rich slotted content',
);

const populatedResultCardHtml = await collectResult(
  render(
    html`<lr-result-card with-actions><button slot="actions">Copy</button>Body</lr-result-card>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(
  populatedResultCardHtml,
  /<div part="header"(?![^>]*\bhidden\b)/,
  'actions-only lr-result-card SSR must expose its header',
);
assert.match(
  populatedResultCardHtml,
  /<div part="actions"(?![^>]*\bhidden\b)/,
  'actions-only lr-result-card SSR must expose its actions wrapper',
);

const populatedTabGroupHtml = await collectResult(
  render(
    html`<lr-tab-group>
      <section slot="one" label="One">Panel one</section>
      <section slot="two" label="Two">Panel two</section>
    </lr-tab-group>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(
  populatedTabGroupHtml,
  /<slot(?![^>]*\bhidden\b)[^>]*><\/slot>/,
  'populated lr-tab-group SSR must expose its native light-DOM fallback before enhancement',
);
assert.match(populatedTabGroupHtml, /Panel one/, 'populated lr-tab-group SSR lost its first fallback panel');

const populatedSplitHtml = await collectResult(
  render(
    html`<lr-split .sizes=${[50, 50]}><section>One</section><section>Two</section></lr-split>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
assert.match(populatedSplitHtml, /role="separator"/, 'two-panel lr-split SSR emitted no divider');

// A server cannot inspect light-DOM slot assignment. Presence-driven components therefore use a
// progressive fallback: named/default slot wrappers stay visible in DSD so authored content works
// without JavaScript, then browser hydration collapses only genuinely empty wrappers.
const progressiveSlotCases = [
  {
    tag: 'lr-badge',
    template: html`<lr-badge><span slot="start">●</span>Ready<span slot="end">✓</span></lr-badge>`,
    parts: ['start', 'end'],
  },
  {
    tag: 'lr-tag',
    template: html`<lr-tag><span slot="start">●</span>Alpha<span slot="end">✓</span></lr-tag>`,
    parts: ['start', 'end'],
  },
  {
    tag: 'lr-chip',
    template: html`<lr-chip><span slot="icon">●</span>Alpha<span slot="end">✓</span></lr-chip>`,
    parts: ['icon', 'end'],
  },
  {
    tag: 'lr-alert',
    template: html`<lr-alert open><span slot="icon">!</span>Message</lr-alert>`,
    parts: ['icon'],
  },
  {
    tag: 'lr-callout',
    template: html`<lr-callout><span slot="icon">!</span><strong slot="heading">Attention</strong
      >Message</lr-callout>`,
    parts: ['icon', 'heading'],
  },
  {
    tag: 'lr-empty',
    template: html`<lr-empty><span>Illustration</span><strong slot="heading">No results</strong
      ><span slot="description">Try another query</span><button slot="actions">Reset</button></lr-empty>`,
    parts: ['icon', 'heading', 'description', 'actions'],
  },
  {
    tag: 'lr-lightbox',
    template: html`<lr-lightbox open><button slot="actions">Download</button></lr-lightbox>`,
    parts: ['actions'],
  },
  {
    tag: 'lr-model-select',
    template: html`<lr-model-select><span slot="label">Model</span
      ><span slot="error">Choose a model</span><span slot="hint">Available models</span
    ></lr-model-select>`,
    parts: ['form-control-label', 'error', 'hint'],
  },
  {
    tag: 'lr-voice-picker',
    template: html`<lr-voice-picker><span slot="label">Voice</span
      ><span slot="error">Choose a voice</span><span slot="hint">Preview a voice</span
    ></lr-voice-picker>`,
    parts: ['form-control-label', 'error', 'hint'],
  },
  {
    tag: 'lr-combobox',
    template: html`<lr-combobox>
      <span slot="label">Country</span><span slot="start">&#x1f30d;</span
      ><span slot="end">&#x2713;</span><span slot="error">Choose a country</span
      ><span slot="hint">Start typing</span>
    </lr-combobox>`,
    parts: ['form-control-label', 'start', 'end', 'error', 'hint'],
  },
  {
    tag: 'lr-option',
    template: html`<lr-option value="alpha"><span slot="start">&#x25cf;</span>Alpha<span
      slot="end"
    >Primary</span></lr-option>`,
    parts: ['start', 'end'],
  },
  {
    tag: 'lr-input',
    template: html`<lr-input>
      <span slot="label">Name</span><span slot="start">@</span><span slot="end">&#x2713;</span
      ><span slot="error">Enter a name</span><span slot="hint">Public name</span>
    </lr-input>`,
    parts: ['form-control-label', 'start', 'end', 'error', 'hint'],
  },
  {
    tag: 'lr-select',
    template: html`<lr-select>
      <span slot="label">Status</span><span slot="start">&#x25cf;</span
      ><span slot="end">&#x2713;</span><span slot="error">Choose a status</span
      ><span slot="hint">One status</span>
    </lr-select>`,
    parts: ['form-control-label', 'start', 'end', 'error', 'hint'],
  },
  {
    tag: 'lr-textarea',
    template: html`<lr-textarea>
      <span slot="label">Notes</span><span slot="error">Enter notes</span
      ><span slot="hint">Markdown supported</span>
    </lr-textarea>`,
    parts: ['form-control-label', 'error', 'hint'],
  },
  {
    tag: 'lr-breadcrumb-item',
    template: html`<lr-breadcrumb-item><span slot="start">&#x2302;</span>Home<span
      slot="end"
    >1</span></lr-breadcrumb-item>`,
    parts: ['start', 'end'],
  },
  {
    tag: 'lr-file-input',
    template: html`<lr-file-input>
      <span slot="label">Attachments</span><span slot="error">Choose a smaller file</span
      ><span slot="hint">PDF only</span>
    </lr-file-input>`,
    parts: ['form-control-label', 'error', 'hint'],
  },
];
for (const { tag, template, parts } of progressiveSlotCases) {
  const markup = await collectResult(render(template, {
    elementRenderers: animatedImageContext.elementRenderers,
  }));
  for (const part of parts) {
    const opening = markup.match(new RegExp(`<[^>]+part="[^"]*\\b${part}\\b[^"]*"[^>]*>`))?.[0];
    assert.ok(
      opening && !/(?:^|\s)hidden(?:\s|=|>)/.test(opening),
      `${tag} populated SSR must expose its ${part} slot wrapper without JavaScript`,
    );
  }
}

for (const [tag, template, overflowPart] of [
  [
    'lr-chip-group',
    html`<lr-chip-group max-visible="2"><lr-chip>One</lr-chip><lr-chip>Two</lr-chip
      ><lr-chip>Three</lr-chip></lr-chip-group>`,
    'overflow-indicator',
  ],
  [
    'lr-avatar-group',
    html`<lr-avatar-group max="2"><lr-avatar label="One"></lr-avatar><lr-avatar label="Two"
      ></lr-avatar><lr-avatar label="Three"></lr-avatar></lr-avatar-group>`,
    'overflow-badge',
  ],
]) {
  const markup = await collectResult(render(template, {
    elementRenderers: animatedImageContext.elementRenderers,
  }));
  assert.doesNotMatch(
    markup,
    new RegExp(`part="${overflowPart}"`),
    `${tag} SSR must progressively expose every authored child instead of claiming a false count`,
  );
}

if (process.argv.includes('--populated-only')) {
  console.log('Populated SSR property/slot probes passed.');
  process.exit(0);
}

function openingTag(markup, tag) {
  const match = markup.match(new RegExp(`<${tag}\\b[^>]*>`));
  assert.ok(match, `${tag}: server output lost its opening tag`);
  return match[0];
}

function serializedAttributeCount(markup, attribute, value) {
  return markup.match(new RegExp(`\\s${attribute}="${value}"`, 'g'))?.length ?? 0;
}

// These host-vs-shadow ownership checks use the real Lit server renderer. The aggregate crawl
// below proves that each tag emits declarative shadow DOM, but cannot tell one semantic owner from
// a host plus a duplicate role hidden inside that shadow tree.
const badgeSemanticHtml = await collectResult(
  render(html`<lr-badge>Deployment complete</lr-badge>`, {
    elementRenderers: animatedImageContext.elementRenderers,
  }),
);
const badgeOpeningTag = openingTag(badgeSemanticHtml, 'lr-badge');
assert.match(badgeOpeningTag, /\srole="status"/, 'lr-badge must serialize its status role on the host');
assert.equal(
  serializedAttributeCount(badgeSemanticHtml, 'role', 'status'),
  1,
  'lr-badge SSR must expose exactly one host-owned status role and no shadow duplicate',
);

const tagSemanticHtml = await collectResult(
  render(html`<lr-tag>Selection</lr-tag>`, {
    elementRenderers: animatedImageContext.elementRenderers,
  }),
);
assert.doesNotMatch(
  openingTag(tagSemanticHtml, 'lr-tag'),
  /\srole="status"/,
  'lr-tag must not inherit badge status semantics on its host',
);
assert.equal(
  serializedAttributeCount(tagSemanticHtml, 'role', 'status'),
  0,
  'lr-tag SSR must expose no status role in either host or shadow DOM',
);

const ratingSemanticHtml = await collectResult(
  render(
    html`<lr-rating
      aria-label="Quality score"
      value="3"
      max="7"
      required
      readonly
      disabled
    ></lr-rating>`,
    { elementRenderers: animatedImageContext.elementRenderers },
  ),
);
const ratingOpeningTag = openingTag(ratingSemanticHtml, 'lr-rating');
const ratingHostSemantics = [
  ['role', 'slider'],
  ['tabindex', '-1'],
  ['aria-label', 'Quality score'],
  ['aria-valuemin', '0'],
  ['aria-valuemax', '7'],
  ['aria-valuenow', '3'],
  ['aria-valuetext', '3'],
  ['aria-disabled', 'true'],
  ['aria-readonly', 'true'],
  ['aria-required', 'true'],
];
for (const [attribute, value] of ratingHostSemantics) {
  assert.match(
    ratingOpeningTag,
    new RegExp(`\\s${attribute}="${value}"`),
    `lr-rating SSR host is missing ${attribute}=${JSON.stringify(value)}`,
  );
  assert.equal(
    serializedAttributeCount(ratingSemanticHtml, attribute, value),
    1,
    `lr-rating SSR must serialize ${attribute}=${JSON.stringify(value)} on its one host owner only`,
  );
}
assert.doesNotMatch(
  ratingOpeningTag,
  /\sdata-lr-rating-managed-label=/,
  'lr-rating SSR must preserve an authored accessible name rather than marking it as generated',
);
assert.equal(
  serializedAttributeCount(ratingSemanticHtml, 'role', 'slider'),
  1,
  'lr-rating SSR must expose exactly one host slider and no shadow slider',
);
assert.match(
  ratingSemanticHtml,
  /<div(?=[^>]*\bpart="base rating")(?=[^>]*\baria-hidden="true")[^>]*>/,
  'lr-rating SSR shadow symbols must remain presentational chrome',
);

const { entries, inventory, loader } = await renderSsrMatrix();
const inventoryTags = inventory.components.map(({ tag }) => tag).sort();
const declaredTags = [
  ...loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  ...loader.LYRA_SSR_CLIENT_RENDER_TAGS,
].sort();

assert.deepEqual(declaredTags, inventoryTags, 'SSR support matrix must classify every inventory tag once');
assert.equal(new Set(declaredTags).size, declaredTags.length, 'SSR support tiers must be disjoint');
assert.ok(
  loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS.length >= 264,
  'SSR support must not regress below the approved 264 declarative-shadow-DOM components',
);
assert.ok(
  loader.LYRA_SSR_CLIENT_RENDER_TAGS.length <= 19,
  'SSR support must not exceed the approved 19 evidence-backed client fallbacks',
);

for (const tag of [
  'lr-bar-chart',
  'lr-box-plot',
  'lr-bubble-chart',
  'lr-chart',
  'lr-doughnut-chart',
  'lr-graph',
  'lr-histogram',
  'lr-line-chart',
  'lr-pie-chart',
  'lr-polar-area-chart',
  'lr-radar-chart',
  'lr-scatter-chart',
  'lr-progress-ring',
]) {
  assert.equal(loader.getLyraSsrMode(tag), 'render-and-hydrate', `${tag} must render on the server`);
}

for (const entry of entries) {
  assert.ok(entry.mode, `${entry.tag}: missing SSR support mode`);
  assert.match(entry.html, new RegExp(`<${entry.tag}\\b`), `${entry.tag}: server output lost its host`);
  assert.match(entry.html, /data-ssr-probe="lr-[^"]+"/, `${entry.tag}: host attributes were not serialized`);
  assert.match(entry.html, new RegExp(`data-ssr-light="${entry.tag}"`), `${entry.tag}: light DOM was not preserved`);

  if (entry.mode === 'render-and-hydrate') {
    assert.match(
      entry.html,
      /<template shadowroot="open" shadowrootmode="open">/,
      `${entry.tag}: supported SSR tier did not emit declarative shadow DOM`,
    );
  } else {
    assert.doesNotMatch(
      entry.html,
      /<template shadowroot=/,
      `${entry.tag}: client-render fallback unexpectedly emitted shadow DOM`,
    );
  }
}

// The default crawl proves that every component renders, but public boolean and enum attributes
// frequently select code that the default state never reaches. Derive this matrix from generated
// editor metadata so a newly documented state enters the SSR gate automatically.
const publicStateCases = enumeratePublicSsrStateCases(
  await readEditorHtmlData(),
  loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
);
assert.ok(
  publicStateCases.length >= 2_750,
  `public SSR state coverage unexpectedly fell to ${publicStateCases.length} cases`,
);
assert.equal(
  new Set(publicStateCases.map(({ tag, attribute, value }) => `${tag}\0${attribute}\0${value}`)).size,
  publicStateCases.length,
  'public SSR state matrix must not contain duplicate cases',
);

const publicStateFailures = [];
for (const stateCase of publicStateCases) {
  const label = `${stateCase.tag}[${stateCase.attribute}=${JSON.stringify(stateCase.value)}]`;
  try {
    const stateHtml = await renderSsrStateProbe(stateCase, animatedImageContext.elementRenderers);
    assert.match(
      stateHtml,
      new RegExp(`<${stateCase.tag}\\b`),
      `${label}: server output lost its host`,
    );
    assert.match(
      stateHtml,
      /<template shadowroot="open" shadowrootmode="open">/,
      `${label}: server output lost its declarative shadow root`,
    );
  } catch (error) {
    publicStateFailures.push(`${label}: ${error?.stack ?? error}`);
  }
}
if (publicStateFailures.length > 0) {
  assert.fail(`public SSR state matrix failed:\n${publicStateFailures.join('\n\n')}`);
}

const page = entries.find(({ tag }) => tag === 'lr-page');
assert.equal(page?.mode, 'render-and-hydrate', 'lr-page is a required SSR/hydration fixture');
assert.match(page.html, /part="base page"/, 'lr-page SSR output is missing its semantic base');

// File Input used to inspect `this.children` during its first update. Lit's server renderer does
// not expose that browser-only collection, so keep a named regression in addition to the generic
// matrix traversal above.
const fileInput = entries.find(({ tag }) => tag === 'lr-file-input');
assert.equal(fileInput?.mode, 'render-and-hydrate', 'lr-file-input must remain in the SSR render tier');
assert.match(fileInput.html, /part="[^"]*\bfile-input\b[^"]*"/, 'lr-file-input did not complete its server render');
assert.match(fileInput.html, /part="[^"]*\bform-control\b[^"]*"/, 'lr-file-input SSR output is missing form-control chrome');
assert.match(fileInput.html, /part="error"/, 'lr-file-input SSR output is missing its error surface');
const semanticDropzoneDescribesError =
  /<button(?=[^>]*\bpart="[^"]*\bbase\b[^"]*")(?=[^>]*\baria-describedby="[^"]*\bfile-input-error\b[^"]*")[^>]*>/;

const fileInputErrorHtml = await renderSsrStateProbe(
  { tag: 'lr-file-input', attribute: 'error-text', value: 'Choose a supporting document.' },
  animatedImageContext.elementRenderers,
);
assert.match(fileInputErrorHtml, /id="file-input-error"/, 'lr-file-input SSR error text is missing its owned id');
assert.match(fileInputErrorHtml, /part="error"/, 'lr-file-input SSR error text is missing its public part');
assert.match(fileInputErrorHtml, /Choose a supporting document\./, 'lr-file-input SSR error text did not render');
assert.doesNotMatch(
  fileInputErrorHtml,
  /<div id="file-input-error"[^>]*\bhidden\b/,
  'lr-file-input SSR error text must not leave its owned error surface hidden',
);
assert.match(
  fileInputErrorHtml,
  semanticDropzoneDescribesError,
  'lr-file-input SSR error text is not associated with its semantic dropzone',
);

const fileInputSlottedErrorHtml = await renderSsrStateProbe(
  { tag: 'lr-file-input', attribute: 'with-error', value: '', slot: 'error' },
  animatedImageContext.elementRenderers,
);
assert.match(
  fileInputSlottedErrorHtml,
  /<span slot="error"[^>]*>State probe<\/span>/,
  'lr-file-input SSR probe did not provide rich error slot content',
);
assert.doesNotMatch(
  fileInputSlottedErrorHtml,
  /<div id="file-input-error"[^>]*\bhidden\b/,
  'lr-file-input SSR-hinted rich error content must not leave its error surface hidden',
);
assert.match(
  fileInputSlottedErrorHtml,
  /<div id="file-input-error"(?=[^>]*\bpart="error")(?![^>]*\bhidden\b)[^>]*>(?:(?!<\/div>)[\s\S])*?<slot name="error">/,
  'lr-file-input SSR-hinted rich error content must project through the visible error frame',
);
assert.match(
  fileInputSlottedErrorHtml,
  semanticDropzoneDescribesError,
  'lr-file-input SSR-hinted rich error content is not associated with its semantic dropzone',
);

assert.equal(globalThis.window, undefined, 'server rendering must not install a window shim');
assert.equal(globalThis.document, undefined, 'server rendering must not install a document shim');

console.log(
  `SSR imports and render matrix passed: ${loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS.length} ` +
    `declarative-shadow-DOM tags + ${loader.LYRA_SSR_CLIENT_RENDER_TAGS.length} client fallbacks; ` +
    `${publicStateCases.length} public boolean/enum states.`,
);
