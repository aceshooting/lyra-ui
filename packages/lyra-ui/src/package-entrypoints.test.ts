import { expect } from '@open-wc/testing';

import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';

// The eager-import counterpart of the root's registration-free contract. A bundler drops all of
// this (`./dist/lyra.js` is not in package.json#sideEffects), but an unconditional import evaluates
// three curated imperative re-exports that cannot work without their element: `toast()` reaches
// toast/toast-item, `confirm()` reaches dialog, and the widget-renderer default registry reaches
// the elements it renders. Anything BEYOND this set means a registration import has crept back into
// `src/lyra.ts`, which is precisely the regression the 8.0.0 split exists to prevent.
const ROOT_HELPER_REGISTERED_TAGS = [
  'lr-badge',
  'lr-button',
  'lr-card',
  'lr-dialog',
  'lr-markdown',
  'lr-media-card',
  'lr-result-card',
  'lr-result-field',
  'lr-stat',
  'lr-toast',
  'lr-toast-item',
];

const definedAmong = (tags: readonly string[]): string[] =>
  tags.filter((tag) => customElements.get(tag) !== undefined);

// Declared FIRST on purpose: the three stages are only meaningful in order, in a registry that no
// earlier import has warmed. Split into three `it`s, or reordered after a test that imports a
// registration entry, each stage would still pass with the others broken.
it('registers nothing from the root, exactly one tag from a granular entry, and the set from all.js', async function () {
  this.timeout(120_000);

  // 1. The root carries the named/type surface WITHOUT registering the library.
  const root = await import('@aceshooting/lyra-ui');
  expect(typeof root.LyraEmpty).to.equal('function');
  expect(definedAmong([...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS]).join(',')).to.equal(
    ROOT_HELPER_REGISTERED_TAGS.join(','),
  );

  // 2. A granular registration entry registers EXACTLY its own tag -- and registers the very class
  //    the root re-exports, which a `typeof` check could not tell from a duplicated class module.
  await import('@aceshooting/lyra-ui/components/overlays/empty/empty.js');
  expect(customElements.get('lr-empty')).to.equal(root.LyraEmpty);
  expect(definedAmong([...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS]).join(',')).to.equal(
    [...ROOT_HELPER_REGISTERED_TAGS, 'lr-empty'].sort().join(','),
  );

  // 3. `all.js` is the documented compatibility path for the pre-8 root side effect: the whole
  //    root-included set, and still nothing from an optional-peer family.
  await import('@aceshooting/lyra-ui/all.js');
  // Compare counts and names, never element constructors: a failed assertion carrying a DOM-ish
  // value as chai's `actual` hangs the whole file.
  expect(definedAmong(ROOT_BARREL_TAGS).length).to.equal(ROOT_BARREL_TAGS.length);
  expect(definedAmong(ROOT_BARREL_OPTIONAL_PEER_TAGS).join(',')).to.equal('');
});

it('resolves the published root entry and representative granular subpaths', async function () {
  // Importing the complete barrel can contend with the other module-heavy
  // test files when the full suite starts them concurrently.
  this.timeout(60_000);
  const localization = await import('@aceshooting/lyra-ui/localization.js');
  const root = await import('@aceshooting/lyra-ui');
  const classEntry = await import('@aceshooting/lyra-ui/components/overlays/empty/empty.class.js');
  const helperEntry = await import('@aceshooting/lyra-ui/components/utility/export-button/csv.js');

  expect(typeof localization.registerLyraLocale).to.equal('function');
  expect(typeof localization.setLyraLocale).to.equal('function');
  expect(typeof localization.resolveLyraString).to.equal('function');
  // The rest of the surface `llms/shared.md` tells applications to import from exactly this entry.
  // `getLyraLocaleDirection` is the 8.0.0 addition, and is asserted by its answer rather than its
  // `typeof` so a re-export that resolved to some unrelated function could not satisfy it.
  expect(typeof localization.getLyraLocale).to.equal('function');
  expect(typeof localization.getLyraLocaleDirection).to.equal('function');
  expect(localization.getLyraLocaleDirection('en')).to.equal('ltr');
  expect(typeof localization.getRegisteredLyraLocales).to.equal('function');
  expect(typeof localization.subscribeLyraLocaleRegistry).to.equal('function');
  expect(typeof localization.resolveLyraLocale).to.equal('function');
  expect(typeof localization.resolveLyraDirection).to.equal('function');
  expect(typeof localization.LYRA_DEFAULT_STRINGS).to.equal('object');
  expect(typeof root.LyraElement).to.equal('function');
  expect(typeof root.groupByRecency).to.equal('function');
  expect(typeof classEntry.LyraEmpty).to.equal('function');
  expect(typeof helperEntry.buildCsv).to.equal('function');
});

it('resolves the curated utilities barrel and a granular utility subpath', async function () {
  this.timeout(60_000);
  const barrel = await import('@aceshooting/lyra-ui/utilities');
  const granular = await import('@aceshooting/lyra-ui/utilities/positioner.js');

  // The two helpers that were reachable ONLY through the side-effectful root barrel until 8.0.0:
  // an application building its own form-associated control beside Lyra's had to import every
  // component in the library to get the mixin.
  expect(typeof barrel.FormAssociated).to.equal('function');
  expect(typeof barrel.groupByRecency).to.equal('function');
  expect(typeof barrel.LyraElement).to.equal('function');
  expect(typeof granular.place).to.equal('function');
});

it('resolves Persian and Hebrew locale subpaths and executes their registration side effects', async () => {
  const localization = await import('@aceshooting/lyra-ui/localization.js');
  await import('@aceshooting/lyra-ui/translations/fa.js');
  await import('@aceshooting/lyra-ui/translations/he.js');
  expect(localization.getRegisteredLyraLocales()).to.include('fa');
  expect(localization.getRegisteredLyraLocales()).to.include('he');

  const manifest = (await import('/package.json')) as unknown as { sideEffects: string[] };
  for (const entry of [
    './dist/translations/fa.js',
    './dist/translations/he.js',
    './src/translations/fa.ts',
    './src/translations/he.ts',
  ]) {
    expect(manifest.sideEffects, entry).to.include(entry);
  }
});

it('does not publish src/internal as a deep-import subpath', async () => {
  // `internal/` is deliberately outside the exports map: it is where the library is free to move
  // things, and the curated `utilities/*` re-exports above are the supported way to reach any of
  // it. The boundary is enforced by the EXPORTS MAP, so that is what this asserts.
  //
  // Deliberately not written as a failed `import()`: this runner serves source over its own dev
  // server rather than resolving through Node, so an unresolvable specifier throws whether or not
  // the exports map allows it -- a test that passes identically with `"./internal/*"` present,
  // i.e. one that proves nothing. Real resolution through a published tarball is covered by
  // `check:packed-consumer`.
  // Imported rather than fetched: this runner serves `.json` transformed into an ES module, so a
  // raw `fetch().json()` gets JavaScript source back and throws.
  const manifest = (await import('/package.json')) as unknown as { exports: Record<string, unknown> };
  const internalKeys = Object.keys(manifest.exports).filter((key) => key.startsWith('./internal'));
  expect(internalKeys.join(', ')).to.equal('');
  // ...and the curated replacements really are declared, so the boundary has a documented door.
  expect(Object.keys(manifest.exports)).to.include('./utilities/*');
});
