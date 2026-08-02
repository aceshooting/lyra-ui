import { expect } from '@open-wc/testing';

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
