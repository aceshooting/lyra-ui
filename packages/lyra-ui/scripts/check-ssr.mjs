import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { renderSsrMatrix, packageDir } from './ssr-fixture.mjs';

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

const { entries, inventory, loader } = await renderSsrMatrix();
const inventoryTags = inventory.components.map(({ tag }) => tag).sort();
const declaredTags = [
  ...loader.LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  ...loader.LYRA_SSR_CLIENT_RENDER_TAGS,
].sort();

assert.deepEqual(declaredTags, inventoryTags, 'SSR support matrix must classify every inventory tag once');
assert.equal(new Set(declaredTags).size, declaredTags.length, 'SSR support tiers must be disjoint');

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
    `declarative-shadow-DOM tags + ${loader.LYRA_SSR_CLIENT_RENDER_TAGS.length} client fallbacks.`,
);
