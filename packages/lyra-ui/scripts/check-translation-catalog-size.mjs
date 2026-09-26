#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// `check-translations.mjs` guards a catalog's KEYS -- coverage, order, placeholder names, plural
// categories -- but nothing guards its SIZE. A slice that accidentally embeds a duplicated block, a
// pasted-in blob, or one key whose translated value is wildly longer than any legitimate human
// translation would produce inflates every consumer's per-locale bundle
// (`@aceshooting/lyra-ui/translations/<tag>/<family>`) with no other gate noticing:
// `scripts/package-budgets.json`'s ceiling is a single whole-tarball number that a few extra
// kilobytes in one obscure locale/family slice cannot meaningfully move, and
// `scripts/generate-component-quality.mjs`'s per-component gzip measurement never reads
// `src/translations/**` at all.
//
// The baseline for "how big should this family's strings be in this locale" is the family's own
// ENGLISH text -- `DEFAULT_STRINGS` filtered through the exact same per-component
// key-reachability index `generate-translation-slices.mjs` itself routes slices from
// (`computeFamilyKeyIndex()`, reused rather than re-derived, so this check can never disagree with
// what a slice is actually allowed to contain).
//
// Comparing GZIP, not raw bytes, matters specifically here: a legitimate translation can
// legitimately run longer than English per character (German compounds, Slavic case suffixes) while
// CJK and Arabic scripts often run SHORTER in character count despite a higher per-character UTF-8
// byte cost. Gzip absorbs both without any per-language tuning table, because a real human
// translation and a runaway/duplicated one compress very differently.
//
// The multiple is deliberately generous (see MAX_GZIP_MULTIPLE below): this is a coarse tripwire
// for a genuinely runaway catalog, not a style opinion about translation verbosity, and a false
// failure here blocks every locale's release over one slice. A family whose English baseline is
// tiny is exempted (MINIMUM_BASELINE_GZIP_BYTES): gzip framing overhead alone can swing that ratio.
//
// Scope: only the per-family SLICED shape (`src/translations/<tag>/<family>.ts`) is measured, since
// every catalog currently ships that way; a future still-monolithic `<tag>.ts`
// (`check-translations.mjs`'s other supported shape) is not sliced by family and has nothing to
// compare a per-family baseline against, so it is left to that check's own key-level coverage gate.
//
// Run: node scripts/check-translation-catalog-size.mjs

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { catalogEntries, computeFamilyKeyIndex } from './generate-default-string-slices.mjs';

const defaultPackageDir = fileURLToPath(new URL('../', import.meta.url));

/** How many times a family slice's own gzipped value text may exceed its English baseline before
 *  this gate fails. Deliberately generous -- see the header comment. */
export const MAX_GZIP_MULTIPLE = 3;

/** Below this many gzip bytes of English baseline text, a family's ratio is noise (gzip framing
 *  overhead, a handful of very short strings dominating the count) rather than a signal; the
 *  comparison is skipped entirely for that family. */
export const MINIMUM_BASELINE_GZIP_BYTES = 100;

/**
 * A locale slice's `registerLyraLocale('<tag>', <identifier>, ...)` call, read with a targeted
 * regex rather than a full parse: the file is mechanically GENERATED
 * (`generate-translation-slices.mjs` -- "do not edit by hand" is its own first line), so its shape
 * cannot vary the way hand-authored source can. This is the same tradeoff
 * `check-numeric-guards.mjs` documents for its own heuristic matching.
 *
 * @param {string} source
 * @returns {string | undefined}
 */
export function registrationIdentifier(source) {
  return /registerLyraLocale\(\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][\w$]*)/.exec(source)?.[1];
}

/**
 * The keys `familyIndex` (from `computeFamilyKeyIndex()`) routes to `family`: a real component
 * family's own exclusively-owned keys, or every key more than one family reaches when
 * `family === 'shared'`. Mirrors `check-translations.mjs`'s own `orderedKeysForSlice()`, minus the
 * `DEFAULT_STRINGS`-order requirement that check already enforces -- sorted here instead, since
 * only the byte total is read.
 *
 * @param {{ keyToFamilies: Map<string, Set<string>> }} familyIndex
 * @param {string} family
 * @returns {string[]}
 */
export function familyKeys(familyIndex, family) {
  const keys = [];
  for (const [key, owners] of familyIndex.keyToFamilies) {
    if (family === 'shared' ? owners.size > 1 : owners.size === 1 && owners.has(family)) {
      keys.push(key);
    }
  }
  return keys.sort();
}

/**
 * Gzips `keys`' values from `entries` (a `catalogEntries()` map) concatenated into one buffer, so
 * the measurement reflects real cross-entry compression rather than summed per-entry overhead --
 * the same reason `check-bundle-size.mjs` gzips a whole bundle rather than averaging per-module
 * gzip sizes.
 *
 * @param {Map<string, string>} entries
 * @param {readonly string[]} keys
 * @returns {number}
 */
export function gzipTextBytes(entries, keys) {
  const parts = keys.map((key) => entries.get(key)).filter((value) => value !== undefined);
  if (parts.length === 0) return 0;
  return gzipSync(Buffer.from(parts.join('\n'), 'utf8')).length;
}

/**
 * Compares every on-disk `src/translations/<locale>/<family>.ts` slice's gzipped value text against
 * that same family's English baseline.
 *
 * @param {{
 *   packageDir?: string;
 *   maxGzipMultiple?: number;
 *   minimumBaselineGzipBytes?: number;
 *   exclusions?: Record<string, string[]>;
 * }} [options] `exclusions` forwards to `computeFamilyKeyIndex()` -- overridable so a fixture
 *   package (which never contains the real, path-specific `DEFAULT_STRING_SLICE_EXCLUSIONS`
 *   targets) can pass `{}` instead of failing on those paths' absence, exactly as
 *   `generate-translation-slices.test.mjs` and `generate-default-string-slices.test.mjs` already do
 *   for the sibling generators.
 * @returns {Promise<{ errors: string[]; notes: string[]; measured: number }>}
 */
export async function checkTranslationCatalogSizes({
  packageDir = defaultPackageDir,
  maxGzipMultiple = MAX_GZIP_MULTIPLE,
  minimumBaselineGzipBytes = MINIMUM_BASELINE_GZIP_BYTES,
  exclusions,
} = {}) {
  const errors = [];
  const notes = [];
  const translationsRoot = join(packageDir, 'src/translations');

  const localizationFile = join(packageDir, 'src/internal/localization.ts');
  const localizationSource = await readFile(localizationFile, 'utf8');
  const english = catalogEntries(localizationSource, 'src/internal/localization.ts', 'DEFAULT_STRINGS');

  const familyIndex = await computeFamilyKeyIndex(
    exclusions === undefined ? { packageDir } : { packageDir, exclusions },
  );
  const families = [...familyIndex.familyToKeys.keys(), 'shared'].sort();
  const keysByFamily = new Map(families.map((family) => [family, familyKeys(familyIndex, family)]));
  const englishGzipByFamily = new Map(
    families.map((family) => [family, gzipTextBytes(english, keysByFamily.get(family))]),
  );

  let localeDirs = [];
  try {
    localeDirs = (await readdir(translationsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    notes.push('No src/translations/ directory yet; nothing to check.');
    return { errors, notes, measured: 0 };
  }
  if (localeDirs.length === 0) {
    notes.push('No per-family translation slices in src/translations/; nothing to check.');
    return { errors, notes, measured: 0 };
  }

  let measured = 0;
  for (const locale of localeDirs) {
    const localeDir = join(translationsRoot, locale);
    const sliceFileNames = (await readdir(localeDir))
      .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
      .sort();
    for (const sliceFileName of sliceFileNames) {
      const family = sliceFileName.slice(0, -'.ts'.length);
      const englishBytes = englishGzipByFamily.get(family);
      // Not a recognized family: check-translations.mjs already fails this file for it.
      if (englishBytes === undefined) continue;

      const file = relative(packageDir, join(localeDir, sliceFileName));
      const source = await readFile(join(localeDir, sliceFileName), 'utf8');
      const identifier = registrationIdentifier(source);
      if (!identifier) {
        errors.push(`${file}: no registerLyraLocale('<tag>', <identifier>, ...) call found`);
        continue;
      }
      let entries;
      try {
        entries = catalogEntries(source, file, identifier);
      } catch (error) {
        errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      measured += 1;
      if (englishBytes < minimumBaselineGzipBytes) continue;

      const localeBytes = gzipTextBytes(entries, keysByFamily.get(family));
      const ceiling = englishBytes * maxGzipMultiple;
      if (localeBytes > ceiling) {
        errors.push(
          `${file}: gzipped catalog text is ${localeBytes} bytes, more than ${maxGzipMultiple}x the ` +
            `${englishBytes}-byte English baseline for the "${family}" family (ceiling ` +
            `${Math.round(ceiling)} bytes) -- check for duplicated, pasted-in, or oversized entries`,
        );
      }
    }
  }

  return { errors, notes, measured };
}

if (isMainModule(import.meta.url)) {
  const { errors, notes, measured } = await checkTranslationCatalogSizes();
  for (const note of notes) console.log(note);
  if (errors.length > 0) {
    console.error(`\nTranslation catalog size check failed with ${errors.length} problem(s):\n`);
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
  } else if (measured > 0) {
    console.log(
      `Translation catalog sizes verified: ${measured} locale/family slice(s) within ` +
        `${MAX_GZIP_MULTIPLE}x of their English baseline.`,
    );
  }
}
