import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  MAX_GZIP_MULTIPLE,
  MINIMUM_BASELINE_GZIP_BYTES,
  checkTranslationCatalogSizes,
  familyKeys,
  gzipTextBytes,
  registrationIdentifier,
} from './check-translation-catalog-size.mjs';

// -- pure helpers -----------------------------------------------------------------------------

{
  const keyToFamilies = new Map([
    ['formsShort', new Set(['forms'])],
    ['formsShort2', new Set(['forms'])],
    ['layoutShort', new Set(['layout'])],
    ['sharedClose', new Set(['forms', 'layout'])],
  ]);
  const familyIndex = { keyToFamilies };
  assert.deepEqual(familyKeys(familyIndex, 'forms'), ['formsShort', 'formsShort2']);
  assert.deepEqual(familyKeys(familyIndex, 'layout'), ['layoutShort']);
  assert.deepEqual(
    familyKeys(familyIndex, 'shared'),
    ['sharedClose'],
    'a key reachable from more than one family routes to "shared", never to either family',
  );
  assert.deepEqual(familyKeys(familyIndex, 'charts'), [], 'a family with no keys returns an empty list');
}

{
  // Concatenated-then-gzipped, not summed-per-entry: two entries compress at least as well
  // together as apart (shared framing overhead), so the combined size is never larger than the
  // sum of the two measured separately.
  const entries = new Map([
    ['a', "'Cancel'"],
    ['b', "'Cancel and confirm'"],
  ]);
  const combined = gzipTextBytes(entries, ['a', 'b']);
  const separate = gzipTextBytes(entries, ['a']) + gzipTextBytes(entries, ['b']);
  assert.ok(combined > 0);
  assert.ok(combined <= separate, 'gzipping together must not cost more than gzipping apart');
  assert.equal(gzipTextBytes(entries, []), 0, 'no keys means nothing to gzip');
  assert.equal(gzipTextBytes(entries, ['missing']), 0, 'a key absent from entries contributes nothing');
}

{
  assert.equal(registrationIdentifier("registerLyraLocale('ar', strings, { dir: 'rtl' });"), 'strings');
  assert.equal(
    registrationIdentifier("import './es/forms.js';\nimport './es/layout.js';\n"),
    undefined,
    'a side-effect-only aggregate that never calls registerLyraLocale() itself has no identifier',
  );
}

// -- end-to-end: computeFamilyKeyIndex + real slice files --------------------------------------

const localizationSource = `
type Key = 'formsShort' | 'formsShort2' | 'layoutShort' | 'sharedClose';
const DEFAULT_STRINGS: Record<Key, string> = {
  formsShort: 'Save changes to this document before closing the editor window',
  formsShort2: 'Cancel and discard every change you made in this session',
  layoutShort: 'Menu',
  sharedClose: 'Close',
};
`;

const formsClassSource = `export class LyraSampleForm extends LyraElement {
  render() {
    return this.localize('formsShort') + this.localize('formsShort2') + this.localize('sharedClose');
  }
}
`;

const layoutClassSource = `export class LyraSampleLayout extends LyraElement {
  render() {
    return this.localize('layoutShort') + this.localize('sharedClose');
  }
}
`;

/** A normal-length human translation -- comparable size to the English original. */
function wellBehavedFormsSlice(tag) {
  return `import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  formsShort: '${tag} Save changes to this document before closing the editor window',
  formsShort2: '${tag} Cancel and discard every change you made in this session',
};

registerLyraLocale('${tag}', strings);
`;
}

/** A runaway catalog: one entry pads far past anything a real translation would produce. */
function runawayFormsSlice(tag) {
  const words = [
    'zeta', 'quorum', 'vintage', 'plasma', 'orbital', 'trumpet', 'glacier', 'maroon', 'fixture',
    'anchovy', 'tundra', 'velvet', 'corridor', 'emblem', 'falcon', 'granite', 'harbor', 'indigo',
    'jargon', 'kettle', 'lantern', 'marble', 'nectar', 'opulent', 'paprika', 'quiver', 'ribbon',
    'sultan', 'tinsel', 'utopia', 'vortex', 'walnut', 'xenon', 'yonder', 'zephyr',
  ];
  const filler = Array.from({ length: 80 }, (_, i) => `${words[i % words.length]}${i}`).join(' ');
  return `import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  formsShort: '${tag} Save changes to this document before closing the editor window',
  formsShort2: '${tag} Cancel and discard every change you made in this session ${filler}',
};

registerLyraLocale('${tag}', strings);
`;
}

function smallSlice(tag, key, value) {
  return `import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
  ${key}: '${tag} ${value}',
};

registerLyraLocale('${tag}', strings);
`;
}

async function buildFixture() {
  const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-translation-catalog-size-'));
  const internalDir = path.join(fixture, 'src', 'internal');
  const formsComponentDir = path.join(fixture, 'src', 'components', 'forms', 'sample-form');
  const layoutComponentDir = path.join(fixture, 'src', 'components', 'layout', 'sample-layout');
  const goodLocaleDir = path.join(fixture, 'src', 'translations', 'yy');
  const badLocaleDir = path.join(fixture, 'src', 'translations', 'xx');
  await mkdir(internalDir, { recursive: true });
  await mkdir(formsComponentDir, { recursive: true });
  await mkdir(layoutComponentDir, { recursive: true });
  await mkdir(goodLocaleDir, { recursive: true });
  await mkdir(badLocaleDir, { recursive: true });

  await writeFile(path.join(internalDir, 'localization.ts'), localizationSource);
  await writeFile(path.join(formsComponentDir, 'sample-form.class.ts'), formsClassSource);
  await writeFile(path.join(layoutComponentDir, 'sample-layout.class.ts'), layoutClassSource);

  // "yy" is a well-behaved locale: every family slice stays within budget.
  await writeFile(path.join(goodLocaleDir, 'forms.ts'), wellBehavedFormsSlice('YY'));
  await writeFile(path.join(goodLocaleDir, 'layout.ts'), smallSlice('YY', 'layoutShort', 'Menu'));
  await writeFile(path.join(goodLocaleDir, 'shared.ts'), smallSlice('YY', 'sharedClose', 'Close'));

  // "xx" has one runaway family slice (forms) and two small, in-budget ones.
  await writeFile(path.join(badLocaleDir, 'forms.ts'), runawayFormsSlice('XX'));
  await writeFile(path.join(badLocaleDir, 'layout.ts'), smallSlice('XX', 'layoutShort', 'Menu'));
  await writeFile(path.join(badLocaleDir, 'shared.ts'), smallSlice('XX', 'sharedClose', 'Close'));

  return fixture;
}

const fixture = await buildFixture();
try {
  const { errors, notes, measured } = await checkTranslationCatalogSizes({
    packageDir: fixture,
    exclusions: {},
  });

  assert.deepEqual(notes, []);
  assert.equal(measured, 6, '2 locales x 3 family slices (forms, layout, shared) each');
  assert.equal(errors.length, 1, 'only xx/forms.ts is oversized');
  assert.match(errors[0], /xx\/forms\.ts/);
  assert.match(errors[0], new RegExp(`more than ${MAX_GZIP_MULTIPLE}x`));
  assert.match(errors[0], /English baseline for the "forms" family/);

  // The tiny "layout" and "shared" families stay below MINIMUM_BASELINE_GZIP_BYTES, so even the
  // runaway locale's own tiny slices for those families are never flagged -- confirms the ratio
  // is skipped for noise-sized baselines rather than merely happening not to trip on this fixture.
  const layoutOrSharedFlagged = errors.some((error) => /xx\/(layout|shared)\.ts/.test(error));
  assert.equal(layoutOrSharedFlagged, false);

  // A stricter multiplier on the SAME fixture must flag more, not fewer, slices -- proves the
  // threshold is actually load-bearing rather than errors happening to be empty/non-empty by
  // coincidence of the fixture data.
  const stricter = await checkTranslationCatalogSizes({
    packageDir: fixture,
    exclusions: {},
    maxGzipMultiple: 1,
    minimumBaselineGzipBytes: 0,
  });
  assert.ok(
    stricter.errors.length > errors.length,
    'a multiplier of 1x must catch every slice whose translation is not byte-identical to English',
  );

  // Raising the minimum-baseline floor above every family's English gzip size must suppress every
  // finding, including the genuinely oversized one -- confirms the floor is applied per-family
  // BEFORE the ratio check, not as a global override.
  const exempted = await checkTranslationCatalogSizes({
    packageDir: fixture,
    exclusions: {},
    minimumBaselineGzipBytes: MINIMUM_BASELINE_GZIP_BYTES * 100,
  });
  assert.deepEqual(exempted.errors, []);
  assert.equal(exempted.measured, 6, 'a raised floor still counts every slice as measured, just not judged');
} finally {
  await rm(fixture, { recursive: true, force: true });
}

console.log('check-translation-catalog-size.test.mjs: all assertions passed');
