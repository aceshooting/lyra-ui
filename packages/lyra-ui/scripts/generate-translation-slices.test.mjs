import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateTranslationSlices, translationSliceFailures } from './generate-translation-slices.mjs';

// Six-key fixture: two keys exclusive to `forms`, two exclusive to `layout`, two ('collapse',
// 'open') reachable from BOTH -- the shape that must route to the `shared` slice instead of being
// duplicated into every family that touches it.
const catalog = `
type Key = 'formsOnly' | 'formsOnly2' | 'layoutOnly' | 'layoutOnly2' | 'collapse' | 'open';
const DEFAULT_STRINGS: Record<Key, string> = {
  formsOnly: 'Forms only',
  formsOnly2: 'Forms only 2',
  layoutOnly: 'Layout only',
  layoutOnly2: 'Layout only 2',
  collapse: 'Collapse',
  open: 'Open',
};
`;

const formsClass = `export class LyraSampleForm extends LyraElement {
  render() {
    return this.localize('formsOnly') + this.localize('formsOnly2') +
      this.localize('collapse') + this.localize('open');
  }
}
`;

const layoutClass = `export class LyraSampleLayout extends LyraElement {
  render() {
    return this.localize('layoutOnly') + this.localize('layoutOnly2') +
      this.localize('collapse') + this.localize('open');
  }
}
`;

const xxCatalog = `// xx translation catalog fixture.
import { registerLyraLocale } from '../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../internal/localization.js';

const strings: LyraLocaleStrings = {
  formsOnly: 'XX forms only',
  formsOnly2: 'XX forms only 2',
  layoutOnly: 'XX layout only',
  layoutOnly2: 'XX layout only 2',
  collapse: 'XX collapse',
  open: 'XX open',
};

registerLyraLocale('xx', strings, { dir: 'rtl', name: 'XX' });
`;

async function buildFixture() {
  const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-translation-slices-'));
  const internal = path.join(fixture, 'src', 'internal');
  const formsDir = path.join(fixture, 'src', 'components', 'forms', 'sample-form');
  const layoutDir = path.join(fixture, 'src', 'components', 'layout', 'sample-layout');
  const translations = path.join(fixture, 'src', 'translations');
  await mkdir(internal, { recursive: true });
  await mkdir(formsDir, { recursive: true });
  await mkdir(layoutDir, { recursive: true });
  await mkdir(translations, { recursive: true });
  await writeFile(path.join(internal, 'localization.ts'), catalog);
  await writeFile(path.join(formsDir, 'sample-form.class.ts'), formsClass);
  await writeFile(path.join(layoutDir, 'sample-layout.class.ts'), layoutClass);
  await writeFile(path.join(translations, 'xx.ts'), xxCatalog);
  return fixture;
}

const fixture = await buildFixture();
try {
  // RED: before generation, no `src/translations/xx/` slice directory exists at all -- a consumer
  // writing `import '@aceshooting/lyra-translations/xx/forms';` would resolve nothing. Confirm
  // the generator itself reports every slice + the aggregate as pending (not yet written), which is
  // the same signal a `--write`-less CI run would surface as a stale-slices failure.
  const before = await generateTranslationSlices({ packageDir: fixture, write: false, exclusions: {} });
  assert.equal(before.changedFileCount, 4, 'forms + layout + shared slices + rewritten aggregate = 4 pending files');
  assert.deepEqual(
    translationSliceFailures(before, { write: false }),
    ['Translation slices are stale (4 file(s) to write, 0 to remove); rerun with --write.'],
  );
  const xxUntouched = await readFile(path.join(fixture, 'src', 'translations', 'xx.ts'), 'utf8');
  assert.match(xxUntouched, /XX forms only/, 'a dry run (write: false) must not touch any file');

  // GREEN: --write actually produces the sliced shape.
  const result = await generateTranslationSlices({ packageDir: fixture, write: true, exclusions: {} });
  assert.equal(result.changedFileCount, 4);
  assert.deepEqual(
    result.results.map((r) => r.tag),
    ['xx'],
  );
  assert.equal(result.results[0].sliceCount, 3, 'forms, layout, shared -- no empty slice for this fixture');

  const formsSlice = await readFile(path.join(fixture, 'src', 'translations', 'xx', 'forms.ts'), 'utf8');
  const layoutSlice = await readFile(path.join(fixture, 'src', 'translations', 'xx', 'layout.ts'), 'utf8');
  const sharedSlice = await readFile(path.join(fixture, 'src', 'translations', 'xx', 'shared.ts'), 'utf8');

  // Importing only the `forms` slice registers ONLY lr-sample-form's strings, never
  // lr-sample-layout's -- the exact proof `check-localization-slices.mjs` runs at the dist level.
  assert.match(formsSlice, /formsOnly: 'XX forms only'/);
  assert.match(formsSlice, /formsOnly2: 'XX forms only 2'/);
  assert.doesNotMatch(formsSlice, /layoutOnly/);
  assert.doesNotMatch(formsSlice, /\bcollapse\b/, '"collapse" is reachable from both families -> shared, not forms');
  assert.match(layoutSlice, /layoutOnly: 'XX layout only'/);
  assert.doesNotMatch(layoutSlice, /formsOnly/);

  // The two keys reachable from BOTH families are routed to `shared`, exactly once each (never
  // duplicated into `forms` AND `layout`).
  assert.match(sharedSlice, /collapse: 'XX collapse'/);
  assert.match(sharedSlice, /open: 'XX open'/);
  assert.equal((sharedSlice.match(/^\s*(collapse|open):/gm) ?? []).length, 2);

  // RTL metadata is replicated onto every slice, not just one, so importing a single family slice
  // alone still carries the locale's direction/name.
  for (const slice of [formsSlice, layoutSlice, sharedSlice]) {
    assert.match(slice, /registerLyraLocale\('xx', strings, \{ dir: 'rtl', name: 'XX' \}\);/);
  }

  // The rewritten aggregate is a pure re-export -- no translated text of its own -- that imports
  // every emitted slice, preserving "one import gets everything".
  const aggregate = await readFile(path.join(fixture, 'src', 'translations', 'xx.ts'), 'utf8');
  assert.doesNotMatch(aggregate, /XX forms only/);
  assert.match(aggregate, /import '\.\/xx\/forms\.js';/);
  assert.match(aggregate, /import '\.\/xx\/layout\.js';/);
  assert.match(aggregate, /import '\.\/xx\/shared\.js';/);

  // GENERATED banner: a single compact banner, not a per-file essay -- and its "do not edit by
  // hand" clause is its own first line verbatim, exactly as `check-translation-catalog-size.mjs`'s
  // own doc comment (which justifies a regex parse over a full AST parse) says it is.
  for (const slice of [formsSlice, layoutSlice, sharedSlice]) {
    assert.match(slice, /^\/\/ GENERATED by scripts\/generate-translation-slices\.mjs -- do not edit by hand\.\n/);
  }
  assert.match(aggregate, /^\/\/ GENERATED by scripts\/generate-translation-slices\.mjs -- do not edit by hand/);

  // Nothing family-specific belongs in the slice banner: the family is already encoded in the file
  // path (`xx/forms.ts` vs `xx/layout.ts`), so a translator opening either file sees byte-identical
  // header lines -- not a repeated "owned exclusively by ..." sentence per family.
  const headerLines = (source) => source.split('\n').slice(0, 3).join('\n');
  assert.equal(headerLines(formsSlice), headerLines(layoutSlice));
  assert.equal(headerLines(formsSlice), headerLines(sharedSlice));
  assert.doesNotMatch(formsSlice, /owned exclusively/);

  // BYTE-IDENTICAL MERGE: reassembling every slice's entries must reproduce exactly the six
  // original catalog values -- the core "no consumer-visible behaviour change" guarantee.
  const reassembled = {};
  for (const slice of [formsSlice, layoutSlice, sharedSlice]) {
    for (const match of slice.matchAll(/^\s*(\w+): '([^']*)',$/gm)) {
      reassembled[match[1]] = match[2];
    }
  }
  assert.deepEqual(reassembled, {
    formsOnly: 'XX forms only',
    formsOnly2: 'XX forms only 2',
    layoutOnly: 'XX layout only',
    layoutOnly2: 'XX layout only 2',
    collapse: 'XX collapse',
    open: 'XX open',
  });

  // IDEMPOTENT: a second --write run, and a subsequent check-mode run, both report nothing pending.
  const second = await generateTranslationSlices({ packageDir: fixture, write: true, exclusions: {} });
  assert.equal(second.changedFileCount, 0);
  assert.equal(second.removedFileCount, 0);
  const checked = await generateTranslationSlices({ packageDir: fixture, write: false, exclusions: {} });
  assert.equal(checked.changedFileCount, 0);
  assert.deepEqual(translationSliceFailures(checked, { write: false }), []);

  // ALREADY-SLICED SOURCE OF TRUTH: once migrated, a translator's edit to a slice file survives
  // regeneration untouched -- the generator reads slices back, not the (now stale) aggregate.
  const editedForms = formsSlice.replace("formsOnly: 'XX forms only',", "formsOnly: 'XX forms only EDITED',");
  await writeFile(path.join(fixture, 'src', 'translations', 'xx', 'forms.ts'), editedForms);
  const afterEdit = await generateTranslationSlices({ packageDir: fixture, write: true, exclusions: {} });
  assert.equal(afterEdit.changedFileCount, 0, 'regenerating from an already-sliced locale must not overwrite a translator edit');
  const formsAfter = await readFile(path.join(fixture, 'src', 'translations', 'xx', 'forms.ts'), 'utf8');
  assert.match(formsAfter, /XX forms only EDITED/);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

console.log('generate-translation-slices.test.mjs: all assertions passed');

const deltaFixture = await buildFixture();
try {
  const translations = path.join(deltaFixture, 'src/translations');
  await writeFile(path.join(translations, 'xx-CA.ts'), `import './xx.js';
import { registerLyraLocaleDelta } from '../internal/localization-runtime.js';
const strings = { formsOnly: 'Regional form' };
registerLyraLocaleDelta('xx-CA', 'xx', strings, { dir: 'ltr' });
`);
  const generated = await generateTranslationSlices({ packageDir: deltaFixture, write: true, exclusions: {} });
  assert.equal(generated.results.find(({ tag }) => tag === 'xx-CA').sliceCount, 3, 'empty regional slices retain parent family subpaths');
  const empty = await readFile(path.join(translations, 'xx-CA/layout.ts'), 'utf8');
  assert.match(empty, /import '\.\.\/xx\/layout\.js';/u);
  assert.match(empty, /registerLyraLocaleDelta\('xx-CA', 'xx', strings, \{ dir: 'ltr' \}\)/u);
  assert.doesNotMatch(empty, /XX layout only/u, 'inherited values are not copied into child sources');
  const regional = await readFile(path.join(translations, 'xx-CA/forms.ts'), 'utf8');
  assert.match(regional, /formsOnly: 'Regional form'/u);
  assert.equal((await generateTranslationSlices({ packageDir: deltaFixture, write: true, exclusions: {} })).changedFileCount, 0);
  const parentForms = path.join(translations, 'xx/forms.ts');
  await writeFile(parentForms, (await readFile(parentForms, 'utf8')).replace('XX forms only', 'Regional form'));
  await generateTranslationSlices({ packageDir: deltaFixture, write: true, exclusions: {} });
  assert.equal(await readFile(path.join(translations, 'xx-CA/forms.ts'), 'utf8'), regional, 'regeneration never drops an authored override that now equals its parent');
  await writeFile(path.join(translations, 'xx-CA/layout.ts'), empty.replace("'xx', strings", "'missing', strings"));
  await assert.rejects(generateTranslationSlices({ packageDir: deltaFixture, write: true, exclusions: {} }), /parent/u);
  assert.equal(await readFile(path.join(translations, 'xx-CA/forms.ts'), 'utf8'), regional, 'invalid parent declarations fail before writes');
} finally {
  await rm(deltaFixture, { recursive: true, force: true });
}

for (const [label, mutate, expected] of [
  ['spread override', (source) => source.replace("formsOnly: 'Regional form',", "formsOnly: 'Regional form', ...{ formsOnly2: 'Hidden override' },"), /spread|literal|unsupported/u],
  ['wrong parent family import', (source) => source.replace("../xx/forms.js", "../xx/shared.js"), /parent.*import|import.*parent/u],
]) {
  const root = await buildFixture();
  try {
    const translations = path.join(root, 'src/translations');
    await writeFile(path.join(translations, 'xx-CA.ts'), `import './xx.js'; const strings = {formsOnly: 'Regional form'}; registerLyraLocaleDelta('xx-CA', 'xx', strings);`);
    await generateTranslationSlices({ packageDir: root, write: true, exclusions: {} });
    const file = path.join(translations, 'xx-CA/forms.ts');
    const invalid = mutate(await readFile(file, 'utf8'));
    await writeFile(file, invalid);
    const parentFile = path.join(translations, 'xx/forms.ts');
    const parentBytes = await readFile(parentFile, 'utf8');
    await assert.rejects(generateTranslationSlices({ packageDir: root, write: true, exclusions: {} }), expected, label);
    assert.equal(await readFile(file, 'utf8'), invalid, `${label} must remain untouched on rejection`);
    assert.equal(await readFile(parentFile, 'utf8'), parentBytes, 'other catalog files remain untouched');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const portugueseFixture = await buildFixture();
try {
  const translations = path.join(portugueseFixture, 'src/translations');
  const fixtures = path.join(portugueseFixture, 'scripts/fixtures');
  await mkdir(fixtures, { recursive: true });
  await writeFile(path.join(translations, 'pt-BR.ts'), xxCatalog.replaceAll('xx', 'pt-BR'));
  await writeFile(path.join(translations, 'pt-PT.ts'), xxCatalog.replaceAll('xx', 'pt-PT')
    .replace("formsOnly: 'XX forms only'", "formsOnly: 'European forms only'"));
  await writeFile(path.join(fixtures, 'pt-PT-overrides.ts'),
    "const strings = { formsOnly: 'European forms only' };\n");
  await generateTranslationSlices({ packageDir: portugueseFixture, write: true, exclusions: {} });
  const regionalForms = path.join(translations, 'pt-PT/forms.ts');
  const regionalLayout = path.join(translations, 'pt-PT/layout.ts');
  assert.match(await readFile(regionalForms, 'utf8'), /formsOnly: 'European forms only'/u);
  assert.match(await readFile(regionalLayout, 'utf8'), /layoutOnly: 'XX layout only'/u);
  assert.doesNotMatch(await readFile(regionalForms, 'utf8'), /import '\.\.\/pt-BR\//u,
    'a regional consumer slice must not import its authoring base');
  assert.equal((await generateTranslationSlices({ packageDir: portugueseFixture, write: false, exclusions: {} })).changedFileCount, 0);
  const baseLayout = path.join(translations, 'pt-BR/layout.ts');
  await writeFile(baseLayout, (await readFile(baseLayout, 'utf8'))
    .replace("layoutOnly: 'XX layout only'", "layoutOnly: 'Updated base layout'"));
  await generateTranslationSlices({ packageDir: portugueseFixture, write: true, exclusions: {} });
  assert.match(await readFile(regionalLayout, 'utf8'), /layoutOnly: 'Updated base layout'/u,
    'an inherited authoring value is flattened into the standalone regional slice');
  assert.match(await readFile(regionalForms, 'utf8'), /formsOnly: 'European forms only'/u,
    'regional overrides survive a base edit');
} finally {
  await rm(portugueseFixture, { recursive: true, force: true });
}
