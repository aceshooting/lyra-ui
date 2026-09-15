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
  // writing `import '@aceshooting/lyra-ui/translations/xx/forms';` would resolve nothing. Confirm
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
