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
import { parseSync } from 'oxc-parser';
import { catalogEntries, computeFamilyKeyIndex } from './generate-default-string-slices.mjs';

const defaultPackageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function parseProgram(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    throw new SyntaxError(
      `${file} could not be parsed:\n${result.errors.map((error) => error.message ?? String(error)).join('\n')}`,
    );
  }
  return result.program;
}

function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) for (const child of value) visitAst(child, visitor);
    else if (value && typeof value === 'object') visitAst(value, visitor);
  }
}

function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

/** The `registerLyraLocale('<tag>', <identifier>[, <meta>])` call a catalog/slice file must make. */
function findRegistration(program, source, file) {
  let call;
  visitAst(program, (node) => {
    if (call || node.type !== 'CallExpression') return;
    if (node.callee?.type !== 'Identifier' || node.callee.name !== 'registerLyraLocale') return;
    call = node;
  });
  if (!call) return undefined;
  const tag = literalString(call.arguments?.[0]);
  const identifierArg = call.arguments?.[1];
  const metaArg = call.arguments?.[2];
  if (!tag || identifierArg?.type !== 'Identifier') {
    throw new Error(`${file}: expected a registerLyraLocale('<tag>', <identifier>[, meta]) call`);
  }
  return {
    tag,
    identifierName: identifierArg.name,
    metaText: metaArg ? source.slice(metaArg.start, metaArg.end).trim() : undefined,
  };
}

async function readCatalogFile(file) {
  const source = await readFile(file, 'utf8');
  const program = parseProgram(file, source);
  const registration = findRegistration(program, source, file);
  if (!registration) throw new Error(`${file}: no registerLyraLocale(...) call found`);
  const entries = catalogEntries(source, file, registration.identifierName);
  return { tag: registration.tag, metaText: registration.metaText, entries };
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
  let metaText;
  for (const sliceName of sliceNames) {
    const file = path.join(localeDir, `${sliceName}.ts`);
    if (!existsSync(file)) continue;
    const slice = await readCatalogFile(file);
    tag ??= slice.tag;
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
  return { tag, metaText, entries };
}

function relativeImport(fromFile, toFile) {
  let specifier = path.relative(path.dirname(fromFile), toFile).replaceAll(path.sep, '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier.replace(/\.ts$/, '.js');
}

function sliceSource({ tag, family, metaText, entries, runtimeImport, typeImport }) {
  const lines = entries.map(([key, text]) => `  ${key}: ${text},`);
  const registration = metaText
    ? `registerLyraLocale('${tag}', strings, ${metaText});`
    : `registerLyraLocale('${tag}', strings);`;
  const familyProse =
    family === 'shared'
      ? 'cross-cutting strings reachable from more than one component family'
      : `strings owned exclusively by \`src/components/${family}/**\``;
  return `// GENERATED by scripts/generate-translation-slices.mjs -- do not edit by hand.
//
// The \`${family}\` slice of the ${tag} translation catalog for @aceshooting/lyra-ui: ${familyProse}.
// A side-effect-only module -- a consumer writes a bare
// \`import '@aceshooting/lyra-ui/translations/${tag}/${family}';\` and reads nothing from it.
// \`../${tag}.ts\` re-exports every slice for this locale and remains the safe, back-compat
// default; import this file directly only once the application knows it needs exactly this
// family's strings. Keep the keys in DEFAULT_STRINGS order -- \`scripts/check-translations.mjs\`
// enforces coverage, order, placeholder names and the plural-category set per slice now, not just
// per locale.
//
// Regenerate with: node scripts/generate-translation-slices.mjs --write
import { registerLyraLocale } from '${runtimeImport}';
import type { LyraLocaleStrings } from '${typeImport}';

const strings: LyraLocaleStrings = {
${lines.join('\n')}
};

${registration}
`;
}

function aggregateSource(tag, sliceNames) {
  const imports = sliceNames.map((name) => `import './${tag}/${name}.js';`).join('\n');
  return `// GENERATED by scripts/generate-translation-slices.mjs -- do not edit by hand.
//
// ${tag} translation catalog for @aceshooting/lyra-ui.
//
// Back-compat aggregate: importing this file registers every family slice below, preserving the
// pre-16.0.0 "one import gets everything" behaviour and merge semantics (a later
// registerLyraLocale() call, or a per-instance \`.strings\` override, still wins). An application
// that only uses a handful of components can import the family slice(s) it actually needs instead
// -- e.g. \`@aceshooting/lyra-ui/translations/${tag}/data\` -- for a smaller bundle. Every catalog
// key belongs to exactly one slice: its owning family, or \`shared\` when more than one family
// reaches it. To translate, edit the slice file under \`./${tag}/\`, never this file.
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

  const writes = [];
  const results = [];
  const keepByLocaleDir = new Map();

  for (const name of localeFiles) {
    const tag = name.slice(0, -'.ts'.length);
    const aggregateFile = path.join(translationsRoot, name);
    const localeDir = path.join(translationsRoot, tag);

    const current = existsSync(localeDir)
      ? await readSlicedCatalog(localeDir, sliceNames)
      : await readCatalogFile(aggregateFile);
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

    const emittedSliceNames = sliceNames.filter((sliceName) => bySlice.get(sliceName).length > 0);
    const keep = new Set();
    for (const sliceName of emittedSliceNames) {
      const sliceFile = path.join(localeDir, `${sliceName}.ts`);
      keep.add(path.basename(sliceFile));
      writes.push({
        file: sliceFile,
        kind: 'slice',
        source: sliceSource({
          tag,
          family: sliceName,
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

if (isMainModule(import.meta.url)) {
  const write = process.argv.includes('--write');
  const result = await generateTranslationSlices({ write });
  const failures = translationSliceFailures(result, { write });
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
  } else {
    console.log(
      `Translation slices ${write ? 'generated' : 'verified'}: ` +
        result.results.map((r) => `${r.tag} (${r.sliceCount} slices, ${r.keyCount} keys)`).join(', '),
    );
  }
}
