import { expect } from '@open-wc/testing';

import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';

type RealmImport = (specifier: string) => Promise<Record<string, unknown>>;
type EntrypointImport = () => Promise<Record<string, unknown>>;
type PackageEntrypointImports = {
  importRoot: EntrypointImport;
  importAll: EntrypointImport;
  importLocalization: EntrypointImport;
  importEmpty: EntrypointImport;
  importEmptyClass: EntrypointImport;
  importCsv: EntrypointImport;
  importUtilities: EntrypointImport;
  importPositioner: EntrypointImport;
};

const definedAmong = (registry: CustomElementRegistry, tags: readonly string[]): string[] =>
  tags.filter((tag) => registry.get(tag) !== undefined);

function createEntrypointRealm(): {
  frame: HTMLIFrameElement;
  registry: CustomElementRegistry;
  importModule: RealmImport;
} {
  const frame = document.createElement('iframe');
  frame.hidden = true;
  document.body.append(frame);

  const realm = frame.contentWindow;
  if (!realm) {
    frame.remove();
    throw new Error('Could not create an isolated package-entrypoint realm.');
  }

  // Construct the importer inside the child Window so every imported module evaluates against
  // that Window's globalThis and CustomElementRegistry. The absolute fixture URL is independent of
  // about:blank's base URL; the fixture's bare package self-references exercise package exports.
  const importModule = realm.Function('specifier', 'return import(specifier);') as RealmImport;
  return { frame, registry: realm.customElements, importModule };
}

// Keep the three stages in one realm and in this order: each stage depends on the registry left by
// the previous one. The realm itself is fresh per attempt because custom-element definitions cannot
// be undone; otherwise Mocha's retry after a late all.js failure would start with lr-empty already
// registered and hide the original failure behind a misleading stage-one assertion.
it('registers nothing from the root, exactly one tag from a granular entry, and the set from all.js', async function () {
  this.timeout(120_000);
  const { frame, registry, importModule } = createEntrypointRealm();
  const packageTags = [...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS];

  try {
    const entrypoints = (await importModule(
      new URL('../test/package-entrypoints-realm.js', import.meta.url).href,
    )) as unknown as PackageEntrypointImports;

    // 1. The root carries the named/type surface WITHOUT registering the library.
    const root = await entrypoints.importRoot();
    expect(typeof root.LyraEmpty).to.equal('function');
    expect(definedAmong(registry, packageTags).join(',')).to.equal('');

    // Representative exact and wildcard subpaths resolve without registering a component.
    const localization = await entrypoints.importLocalization();
    const classEntry = await entrypoints.importEmptyClass();
    const helperEntry = await entrypoints.importCsv();
    const utilities = await entrypoints.importUtilities();
    const positioner = await entrypoints.importPositioner();
    expect(typeof localization.registerLyraLocale).to.equal('function');
    expect(typeof localization.setLyraLocale).to.equal('function');
    expect(typeof localization.resolveLyraString).to.equal('function');
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
    expect(typeof utilities.FormAssociated).to.equal('function');
    expect(typeof utilities.groupByRecency).to.equal('function');
    expect(typeof utilities.LyraElement).to.equal('function');
    expect(typeof positioner.place).to.equal('function');
    expect(definedAmong(registry, packageTags).join(',')).to.equal('');

    // 2. A granular registration entry registers EXACTLY its own tag -- and registers the very
    //    class the root re-exports, which a `typeof` check could not distinguish from a duplicate.
    await entrypoints.importEmpty();
    expect(registry.get('lr-empty') === root.LyraEmpty).to.be.true;
    expect(definedAmong(registry, packageTags).join(',')).to.equal('lr-empty');

    // 3. `all.js` is the documented compatibility path for the pre-8 root side effect: the whole
    //    root-included set, and still nothing from an optional-peer family.
    await entrypoints.importAll();
    // Compare counts and names, never element constructors: a failed assertion carrying a DOM-ish
    // value as chai's `actual` hangs the whole file.
    expect(definedAmong(registry, ROOT_BARREL_TAGS).length).to.equal(ROOT_BARREL_TAGS.length);
    expect(definedAmong(registry, ROOT_BARREL_OPTIONAL_PEER_TAGS).join(',')).to.equal('');
  } finally {
    frame.remove();
  }
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
