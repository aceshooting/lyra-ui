#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// Splits each shipped `src/translations/<tag>.ts` MONOLITH -- one side-effect module registering
// every localizable string for every component in one `registerLyraLocale()` call -- into one
// GENERATED file per component family, `src/translations/<tag>/<family>.ts`, each registering only
// the strings its own family's components reach. `src/translations/<tag>.ts` becomes a thin,
// hand-untouched, GENERATED re-export of every slice: the pre-16.0.0 "one import gets everything"
// behaviour and merge semantics (a later `registerLyraLocale()` call, or a per-instance `.strings`
// override, still wins) are unchanged, but an application that imports only the families it renders
// now ships only their strings.
//
// Family membership is NOT re-derived here -- it is the exact per-component key-reachability walk
// `generate-default-string-slices.mjs` already computes (and `check-localization-slices.mjs`
// already proves correct) for the English default-string slices, imported as
// `computeFamilyKeyIndex()`. A key reachable from exactly one family goes to that family's slice; a
// key reachable from more than one (a shared a11y/overlay/selection string) goes to the `shared`
// slice instead of being duplicated into every family that touches it.
//
// SOURCE OF TRUTH: once a locale has migrated (its `src/translations/<tag>/` directory exists),
// its own slice files are authoritative -- a translator edits `fr/data.ts` directly, never `fr.ts`.
// A locale that has not migrated yet is read from its still-monolithic aggregate file. Either way,
// every value is carried across as RAW SOURCE TEXT (never re-serialized through JS), so a
// regeneration can only ever relocate an entry, never rewrite its bytes.
//
// Run: node scripts/generate-translation-slices.mjs [--write]

import { existsSync } from 'node:fs';
import { readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTranslationCatalogModule } from './check-translations.mjs';
import { catalogEntries, computeFamilyKeyIndex } from './generate-default-string-slices.mjs';

const defaultPackageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function readCatalogFile(file) {
  const source = await readFile(file, 'utf8');
  const { registration, imports } = readTranslationCatalogModule(source, file);
  const { tag, parent, meta, identifier } = registration;
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u.test(tag) ||
      (parent && !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u.test(parent)))
    throw new Error(`${file}: locale and parent must be literal locale tags`);
  const entries = catalogEntries(source, file, identifier);
  return { tag, parent, imports, metaText: meta ? source.slice(meta.start, meta.end).trim() : undefined, entries };
}

/**
 * Reassembles a migrated locale's authoritative entries from its own slice files (translator
 * edits land there directly). Every slice must agree on the registered tag and on locale metadata
 * (`dir`/`name`) when more than one declares it -- that can only diverge if something hand-edited a
 * slice inconsistently, which is a data-integrity bug worth failing loudly on rather than silently
 * picking one.
 */
async function readSlicedCatalog(localeDir, sliceNames) {
  const entries = new Map();
  let tag;
  let parent;
  let metaText;
  for (const sliceName of sliceNames) {
    const file = path.join(localeDir, `${sliceName}.ts`);
    if (!existsSync(file)) continue;
    const slice = await readCatalogFile(file);
    const expectedImports = slice.parent ? [`../${slice.parent}/${sliceName}.js`] : [];
    if (JSON.stringify(slice.imports) !== JSON.stringify(expectedImports))
      throw new Error(`${file}: parent imports must exactly match the declared parent family`);
    tag ??= slice.tag;
    if (parent !== undefined && parent !== slice.parent) throw new Error(`${file}: parent declaration disagrees with a sibling slice`);
    if (parent === undefined) parent = slice.parent;
    if (slice.tag !== tag) {
      throw new Error(`${file}: registers "${slice.tag}" but a sibling slice registers "${tag}"`);
    }
    if (slice.metaText !== undefined) {
      if (metaText !== undefined && metaText !== slice.metaText) {
        throw new Error(
          `${file}: locale metadata ${slice.metaText} disagrees with a sibling slice's ${metaText}`,
        );
      }
      metaText = slice.metaText;
    }
    for (const [key, text] of slice.entries) {
      if (entries.has(key)) throw new Error(`${file}: key "${key}" is already registered by another slice`);
      entries.set(key, text);
    }
  }
  if (!tag) throw new Error(`${localeDir}: contains no recognised translation slice file`);
  return { tag, parent, metaText, entries };
}

function relativeImport(fromFile, toFile) {
  let specifier = path.relative(path.dirname(fromFile), toFile).replaceAll(path.sep, '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier.replace(/\.ts$/, '.js');
}

function sliceSource({ tag, parent, parentImport, metaText, entries, runtimeImport, typeImport }) {
  const lines = entries.map(([key, text]) => `  ${key}: ${text},`);
  const register = parent ? 'registerLyraLocaleDelta' : 'registerLyraLocale';
  const args = `'${tag}', ${parent ? `'${parent}', ` : ''}strings${metaText ? `, ${metaText}` : ''}`;
  const registration = `${register}(${args});`;
  return `// GENERATED by scripts/generate-translation-slices.mjs -- do not edit by hand.
// String values ARE hand-edited here and survive regeneration verbatim; regenerate structure with
// node scripts/generate-translation-slices.mjs --write.
${parentImport ? `import '${parentImport}';\n` : ''}import { ${register} } from '${runtimeImport}';
import type { LyraLocaleStrings } from '${typeImport}';

const strings: LyraLocaleStrings = {
${lines.join('\n')}
};

${registration}
`;
}

function aggregateSource(tag, sliceNames) {
  const imports = sliceNames.map((name) => `import './${tag}/${name}.js';`).join('\n');
  return `// GENERATED by scripts/generate-translation-slices.mjs -- do not edit by hand; to
// translate, edit the slice file under ./${tag}/, never this file. Back-compat aggregate:
// importing it registers every family slice (import one directly for a smaller bundle).
// Regenerate: node scripts/generate-translation-slices.mjs --write.
${imports}
`;
}

/**
 * Regenerates every `src/translations/<tag>/<family>.ts` slice and `src/translations/<tag>.ts`
 * aggregate from the current family index and each locale's current authoritative entries.
 *
 * Returns per-locale results plus the full set of pending file writes/removals, so the CLI (and
 * tests) can report staleness without necessarily writing anything.
 */
export async function generateTranslationSlices({
  packageDir = defaultPackageDir,
  write = false,
  exclusions,
} = {}) {
  const { keyToFamilies, familyToKeys } = await computeFamilyKeyIndex(
    exclusions === undefined ? { packageDir } : { packageDir, exclusions },
  );
  const families = [...familyToKeys.keys()].sort();
  const sliceNames = [...families, 'shared'];

  const catalogFile = path.join(packageDir, 'src/internal/localization.ts');
  const runtimeFile = path.join(packageDir, 'src/internal/localization-runtime.ts');
  const catalogSource = await readFile(catalogFile, 'utf8');
  const englishOrder = [...catalogEntries(catalogSource, catalogFile).keys()];

  const translationsRoot = path.join(packageDir, 'src/translations');
  const localeFiles = (await readdir(translationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
    .map((entry) => entry.name)
    .sort();

  const catalogs = new Map();
  for (const name of localeFiles) {
    const tag = name.slice(0, -'.ts'.length);
    const localeDir = path.join(translationsRoot, tag);
    const current = existsSync(localeDir)
      ? await readSlicedCatalog(localeDir, sliceNames)
      : await readCatalogFile(path.join(translationsRoot, name));
    if (current.tag !== tag) throw new Error(`${name}: registered tag does not match its file name`);
    if (!existsSync(localeDir) && current.parent &&
        JSON.stringify(current.imports) !== JSON.stringify([`./${current.parent}.js`]))
      throw new Error(`${name}: parent import must match the declared parent aggregate`);
    catalogs.set(tag, current);
  }
  for (const tag of catalogs.keys()) {
    const visited = new Set();
    let current = tag;
    while (current) {
      if (visited.has(current)) throw new Error(`Locale parent cycle at ${current}`);
      if (visited.size > 32) throw new Error('Locale parent chain exceeds 32 edges');
      visited.add(current);
      const catalog = catalogs.get(current);
      if (!catalog) throw new Error(`Unknown locale parent ${current}`);
      current = catalog.parent;
    }
  }
  const resolved = new Map();
  function resolve(tag, chain = []) {
    if (chain.includes(tag)) throw new Error(`Locale parent cycle: ${[...chain, tag].join(' -> ')}`);
    if (chain.length > 32) throw new Error('Locale parent chain exceeds 32 edges');
    if (resolved.has(tag)) return resolved.get(tag);
    const current = catalogs.get(tag);
    if (!current) throw new Error(`Unknown locale parent ${tag}`);
    const entries = new Map([...(current.parent ? resolve(current.parent, [...chain, tag]) : []), ...current.entries]);
    if (current.parent && englishOrder.some((key) => !entries.has(key))) throw new Error(`${tag}: parent and own messages leave missing resolved keys`);
    resolved.set(tag, entries);
    return entries;
  }
  for (const tag of catalogs.keys()) resolve(tag);

  const writes = [];
  const results = [];
  const keepByLocaleDir = new Map();

  for (const name of localeFiles) {
    const tag = name.slice(0, -'.ts'.length);
    const aggregateFile = path.join(translationsRoot, name);
    const localeDir = path.join(translationsRoot, tag);

    const current = catalogs.get(tag);
    if (current.tag !== tag) {
      throw new Error(`${name}: registers "${current.tag}" but the file is named "${tag}.ts" -- they must agree`);
    }

    const bySlice = new Map(sliceNames.map((sliceName) => [sliceName, []]));
    for (const key of englishOrder) {
      const text = current.entries.get(key);
      if (text === undefined) continue; // a missing key is check-translations.mjs's job to report
      const owners = keyToFamilies.get(key);
      const sliceName = owners && owners.size === 1 ? [...owners][0] : 'shared';
      bySlice.get(sliceName).push([key, text]);
    }
    const routedKeyCount = [...bySlice.values()].reduce((total, entries) => total + entries.length, 0);
    const inventedKeys = [...current.entries.keys()].filter((key) => !englishOrder.includes(key));
    if (inventedKeys.length > 0) {
      throw new Error(
        `${name}: ${inventedKeys.length} catalog key(s) have no DEFAULT_STRINGS entry and cannot be ` +
          `routed to a slice: ${inventedKeys.slice(0, 5).join(', ')}`,
      );
    }

    const inheritedSlices = new Set();
    if (current.parent) {
      for (const key of resolved.get(current.parent).keys()) {
        const owners = keyToFamilies.get(key);
        inheritedSlices.add(owners && owners.size === 1 ? [...owners][0] : 'shared');
      }
    }
    const emittedSliceNames = sliceNames.filter((sliceName) => bySlice.get(sliceName).length > 0 || inheritedSlices.has(sliceName));
    const keep = new Set();
    for (const sliceName of emittedSliceNames) {
      const sliceFile = path.join(localeDir, `${sliceName}.ts`);
      keep.add(path.basename(sliceFile));
      writes.push({
        file: sliceFile,
        kind: 'slice',
        source: sliceSource({
          tag,
          parent: current.parent,
          parentImport: current.parent ? `../${current.parent}/${sliceName}.js` : undefined,
          metaText: current.metaText,
          entries: bySlice.get(sliceName),
          runtimeImport: relativeImport(sliceFile, runtimeFile),
          typeImport: relativeImport(sliceFile, catalogFile),
        }),
      });
    }
    keepByLocaleDir.set(localeDir, keep);
    writes.push({ file: aggregateFile, kind: 'aggregate', source: aggregateSource(tag, emittedSliceNames) });
    results.push({
      tag,
      keyCount: current.entries.size,
      routedKeyCount,
      sliceCount: emittedSliceNames.length,
    });
  }

  // Stale slice files: present on disk but no longer part of the family index's expected set for
  // that locale (e.g. a family whose last localizable component was removed).
  const removals = [];
  for (const [localeDir, keep] of keepByLocaleDir) {
    if (!existsSync(localeDir)) continue;
    const onDisk = (await readdir(localeDir)).filter((entry) => entry.endsWith('.ts'));
    for (const entry of onDisk) {
      if (!sliceNames.includes(entry.slice(0, -'.ts'.length))) {
        throw new Error(
          `${path.join(localeDir, entry)}: unrecognised translation slice file (expected one of ` +
            `${sliceNames.join(', ')})`,
        );
      }
      if (!keep.has(entry)) removals.push(path.join(localeDir, entry));
    }
  }

  const changed = [];
  for (const { file, source } of writes) {
    const existing = existsSync(file) ? await readFile(file, 'utf8') : undefined;
    if (existing !== source) changed.push(file);
  }

  if (write && (changed.length > 0 || removals.length > 0)) {
    for (const localeDir of keepByLocaleDir.keys()) await mkdir(localeDir, { recursive: true });
    await Promise.all(writes.map(({ file, source }) => writeFile(file, source)));
    await Promise.all(removals.map((file) => rm(file)));
  }

  return { results, changedFileCount: changed.length, removedFileCount: removals.length, changed, removals };
}

export function translationSliceFailures(result, { write = false } = {}) {
  const failures = [];
  if (!write && (result.changedFileCount > 0 || result.removedFileCount > 0)) {
    failures.push(
      `Translation slices are stale (${result.changedFileCount} file(s) to write, ` +
        `${result.removedFileCount} to remove); rerun with --write.`,
    );
  }
  return failures;
}

/** The CLI's whole run, returning its exit status (also run in-process by check-localization-catalogs.mjs). */
export async function runTranslationSlicesCli({ write = false } = {}) {
  const result = await generateTranslationSlices({ write });
  const failures = translationSliceFailures(result, { write });
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    return 1;
  }
  console.log(
    `Translation slices ${write ? 'generated' : 'verified'}: ` +
      result.results.map((r) => `${r.tag} (${r.sliceCount} slices, ${r.keyCount} keys)`).join(', '),
  );
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await runTranslationSlicesCli({ write: process.argv.includes('--write') });
}
