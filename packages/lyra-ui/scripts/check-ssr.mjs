import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
assert.match(fileInput.html, /part="file-input"/, 'lr-file-input did not complete its server render');

assert.equal(globalThis.window, undefined, 'server rendering must not install a window shim');
assert.equal(globalThis.document, undefined, 'server rendering must not install a document shim');

console.log(
  `SSR imports and render matrix passed: ${loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS.length} ` +
    `declarative-shadow-DOM tags + ${loader.LYRA_SSR_CLIENT_RENDER_TAGS.length} client fallbacks; ` +
    `${publicStateCases.length} public boolean/enum states.`,
);
