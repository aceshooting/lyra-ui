#!/usr/bin/env node

// Emits a translation catalog SKELETON for one locale: every `DEFAULT_STRINGS` key, in
// `DEFAULT_STRINGS` order, with the English text as the starting value, and every count-bearing
// message expanded to exactly the CLDR plural categories that locale actually has.
// The point is that the three things a human translator cannot be trusted to get right by hand are
// made structural instead. `scripts/check-translations.mjs` fails a catalog that is missing a key,
// invents one, reorders them, drops a plural category, or renames a `{placeholder}` -- and every
// one of those is a mistake you make by TYPING a 1200-entry object, not by translating. Generating
// the shape leaves only the translation to do.
// The emitted values are English on purpose. A sentinel like 'TODO' would be worse: it makes an
// untranslated catalog render garbage rather than fall back to a language the reader at least has a
// chance with, and the gate cannot tell a sentinel from a legitimately identical string ("OK",
// "JSON", "PDF") anyway. Untranslated coverage is reported by `--report` instead.
// `registerLyraLocale()`'s third argument -- the locale METADATA -- is preserved, not regenerated.
// It is the one thing in a catalog that is neither a key nor a translation, and it is load-bearing:
// `getLyraLocaleDirection()` answers from a registered `dir` first and only then from `Intl.Locale`'s
// text-info surface, which several shipping engines still do not expose. A `--force` reshape that
// re-emitted the bare two-argument call would therefore silently turn ar/fa/he LTR for every
// application asking the library which direction a locale needs. So: an existing file's meta
// argument is carried across verbatim, and a brand-new RTL catalog is scaffolded WITH one rather
// than leaving the direction to a runtime that may not know it.
// Since 16.0.0 the emitted SHAPE is the per-family sliced one, not a single monolithic file: one
// `src/translations/<tag>/<family>.ts` per component family (plus a `shared` slice for keys more
// than one family reaches) and a thin `src/translations/<tag>.ts` re-export aggregate, matching
// what `scripts/generate-translation-slices.mjs` produces for an already-shipped locale. A locale
// scaffolded fresh is therefore authored directly in the sliced shape -- there is no longer an
// intermediate monolith to migrate later. Family membership reuses the exact per-component
// key-reachability data `generate-default-string-slices.mjs` already computes
// (`computeFamilyKeyIndex()`), never re-derived.
//
// Run: node scripts/scaffold-translation.mjs <tag> [--force]
//      node scripts/scaffold-translation.mjs --report

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { computeFamilyKeyIndex } from './generate-default-string-slices.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const localizationFile = join(packageRoot, 'src/internal/localization.ts');
const translationsRoot = join(packageRoot, 'src/translations');

function visit(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) for (const child of value) visit(child, visitor);
    else if (value && typeof value === 'object') visit(value, visitor);
  }
}

const literal = (node) => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
};
const propName = (property) =>
  property.key?.type === 'Identifier' ? property.key.name : literal(property.key);

/** `DEFAULT_STRINGS` as `[key, string | Record<category, string>][]`, in source order. */
function readDefaults() {
  const source = readFileSync(localizationFile, 'utf8');
  const program = parseSync(localizationFile, source).program;
  let object;
  visit(program, (node) => {
    if (object) return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'DEFAULT_STRINGS') object = node.init;
  });
  if (!object) throw new Error('could not find the DEFAULT_STRINGS object literal');
  return object.properties.map((property) => {
    const key = propName(property);
    const text = literal(property.value);
    if (text !== undefined) return [key, text];
    const variants = {};
    for (const variant of property.value.properties) variants[propName(variant)] = literal(variant.value);
    return [key, variants];
  });
}

// Newlines and tabs must be escaped, not embedded: a few messages are multi-line, and emitting one
// raw inside a single-quoted literal produces a file that will not parse at all.
const quote = (text) =>
  `'${text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}'`;

// Base languages written right-to-left, as a floor under `Intl.Locale`'s text-info surface. That
// surface is spelled `textInfo` in some engines, `getTextInfo()` in others and is missing entirely
// in older ones, so a scaffold that trusted it alone would emit no `dir` at all on exactly the
// runtimes where the declaration matters most.
const RTL_BASE_LANGUAGES = new Set(['ar', 'ckb', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi']);

function baseLanguage(tag) {
  try {
    return new Intl.Locale(tag).language;
  } catch {
    return tag.split(/[-_]/)[0].toLowerCase();
  }
}

function localeDirection(tag) {
  if (RTL_BASE_LANGUAGES.has(baseLanguage(tag))) return 'rtl';
  try {
    const resolved = new Intl.Locale(tag);
    return (resolved.textInfo?.direction ?? resolved.getTextInfo?.().direction) === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

/** The locale's own endonym, for the informational `name` slot. Undefined when the runtime has no
 *  display name for it and would just echo the tag back. */
function endonym(tag) {
  try {
    const language = baseLanguage(tag);
    const name = new Intl.DisplayNames(tag, { type: 'language' }).of(language);
    return name && name.toLowerCase() !== language.toLowerCase() ? name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The meta argument a NEW catalog should carry. LTR is the platform default and needs no
 * declaration, so only an RTL locale gets one -- an `{ dir: 'ltr' }` on every Latin-script catalog
 * would be noise a translator is tempted to delete.
 */
function deriveMeta(tag) {
  if (localeDirection(tag) !== 'rtl') return undefined;
  const name = endonym(tag);
  return `{ dir: 'rtl'${name ? `, name: ${quote(name)}` : ''} }`;
}

/** The meta argument an existing target (sliced directory, or a still-monolithic file) already
 *  declared, verbatim, or undefined. Every slice of a sliced locale carries the same meta (each
 *  must be independently self-sufficient for direction/name when imported alone), so the first one
 *  found is authoritative. */
function readExistingMeta(tag) {
  const sliceDir = join(translationsRoot, tag);
  const candidates = existsSync(sliceDir)
    ? readdirSync(sliceDir).filter((entry) => entry.endsWith('.ts')).map((entry) => join(sliceDir, entry))
    : [join(translationsRoot, `${tag}.ts`)].filter(existsSync);
  for (const file of candidates) {
    const source = readFileSync(file, 'utf8');
    const program = parseSync(file, source).program;
    let meta;
    visit(program, (node) => {
      if (meta !== undefined) return;
      if (node.type !== 'CallExpression') return;
      if (node.callee?.type !== 'Identifier' || node.callee.name !== 'registerLyraLocale') return;
      const argument = node.arguments?.[2];
      if (argument) meta = source.slice(argument.start, argument.end).trim();
    });
    if (meta !== undefined) return meta;
  }
  return undefined;
}

function messageLines(entries, categories) {
  return entries.map(([key, message]) => {
    if (typeof message === 'string') return `  ${key}: ${quote(message)},`;
    // A locale gets exactly its own categories: seeding a Russian catalog with English's
    // {one, other} is the precise bug the plural rework existed to remove, since every count from
    // two upward would silently widen to `other`.
    const fallback = message.other ?? Object.values(message)[0];
    const body = categories.map((category) => `    ${category}: ${quote(message[category] ?? fallback)},`);
    return [`  ${key}: {`, ...body, '  },'].join('\n');
  });
}

function emitSlice(tag, family, entries, categories, meta) {
  const registration = meta
    ? [
        '',
        `// \`dir\` is declared, not inferred: no component reads it (direction still comes from the`,
        `// platform \`dir\` cascade), but it is what lets an application ask the library whether this`,
        `// locale needs \`dir="rtl"\` instead of keeping its own tag table.`,
        `registerLyraLocale('${tag}', strings, ${meta});`,
      ].join('\n')
    : `\nregisterLyraLocale('${tag}', strings);`;
  const familyProse =
    family === 'shared'
      ? 'cross-cutting strings reachable from more than one component family'
      : `strings owned exclusively by \`src/components/${family}/**\``;
  return `// The \`${family}\` slice of the ${tag} translation catalog for @aceshooting/lyra-ui: ${familyProse}.
// A side-effect-only module: a consumer writes a bare
// \`import '@aceshooting/lyra-ui/translations/${tag}/${family}';\` and reads nothing from it. Keep the
// keys in DEFAULT_STRINGS order -- \`scripts/check-translations.mjs\` enforces coverage, order,
// placeholder names and the plural-category set for this slice, and a catalog that cannot be
// diffed against another line-for-line is a catalog nobody will review.
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs ${tag} --force
import { registerLyraLocale } from '../../internal/localization-runtime.js';
import type { LyraLocaleStrings } from '../../internal/localization.js';

const strings: LyraLocaleStrings = {
${messageLines(entries, categories).join('\n')}
};
${registration}
`;
}

function emitAggregate(tag, sliceNames) {
  const imports = sliceNames.map((name) => `import './${tag}/${name}.js';`).join('\n');
  return `// ${tag} translation catalog for @aceshooting/lyra-ui.
//
// Back-compat aggregate: importing this file registers every family slice below. An application
// that only uses a handful of components can import the family slice(s) it actually needs instead
// -- e.g. \`@aceshooting/lyra-ui/translations/${tag}/forms\` -- for a smaller bundle. To translate,
// edit the slice file under \`./${tag}/\`, never this file.
${imports}
`;
}

function relativeish(path) {
  return path.slice(packageRoot.length);
}

/** Every `[key, message]` a locale currently has, read from its sliced directory when one exists
 *  and from the still-monolithic file otherwise. */
function readCurrentEntries(tag) {
  const sliceDir = join(translationsRoot, tag);
  const files = existsSync(sliceDir)
    ? readdirSync(sliceDir)
        .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
        .map((entry) => join(sliceDir, entry))
    : [join(translationsRoot, `${tag}.ts`)].filter(existsSync);
  const entries = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const program = parseSync(file, source).program;
    let object;
    visit(program, (node) => {
      if (object) return;
      if (
        node.type === 'VariableDeclarator' &&
        node.id?.name === 'strings' &&
        node.init?.type === 'ObjectExpression'
      ) {
        object = node.init;
      }
    });
    if (!object) continue;
    for (const property of object.properties) {
      const key = propName(property);
      const text = literal(property.value);
      const value = text !== undefined
        ? text
        : Object.fromEntries(property.value.properties.map((v) => [propName(v), literal(v.value)]));
      entries.push([key, value]);
    }
  }
  return entries;
}

const args = process.argv.slice(2);
const entries = readDefaults();

if (args.includes('--report')) {
  const english = new Map(entries);
  const flatten = (message) => (typeof message === 'string' ? [message] : Object.values(message));
  const rows = [];
  // Same top-level `.ts` file enumeration the original tool used: a real catalog always keeps its
  // `<tag>.ts` aggregate (sliced or still-monolithic), so this never needs to also walk bare
  // directories -- which would wrongly pick up `pseudo/`, a directory with no `<tag>.ts` sibling.
  const tags = existsSync(translationsRoot)
    ? readdirSync(translationsRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
        .map((entry) => entry.name.replace(/\.ts$/, ''))
        .sort()
    : [];
  for (const tag of tags) {
    const currentEntries = readCurrentEntries(tag);
    if (currentEntries.length === 0) {
      rows.push(`${tag}: could not read its catalog entries`);
      continue;
    }
    let total = 0;
    let untranslated = 0;
    for (const [key, value] of currentEntries) {
      const values = flatten(value);
      const source = new Set(flatten(english.get(key) ?? ''));
      total += 1;
      if (values.every((value) => source.has(value))) untranslated += 1;
    }
    const pct = total === 0 ? 0 : Math.round(((total - untranslated) / total) * 100);
    rows.push(`${tag}: ${total - untranslated}/${total} translated (${pct}%)`);
  }
  console.log(rows.length ? rows.join('\n') : 'no catalogs under src/translations/');
  process.exit(0);
}

const tag = args.find((arg) => !arg.startsWith('--'));
if (!tag) {
  console.error('usage: node scripts/scaffold-translation.mjs <tag> [--force]  |  --report');
  process.exit(1);
}
const sliceDir = join(translationsRoot, tag);
const flatTarget = join(translationsRoot, `${tag}.ts`);
const alreadyExists = existsSync(sliceDir) || existsSync(flatTarget);
if (alreadyExists && !args.includes('--force')) {
  console.error(`${relativeish(sliceDir)}/ already exists; pass --force to overwrite its SHAPE (translations are lost)`);
  process.exit(1);
}
// Preserved meta beats derived meta: the catalog that is already on disk is the authority on its
// own direction and endonym, and a reshape may not overwrite a hand-corrected one.
const meta = readExistingMeta(tag) ?? deriveMeta(tag);
const categories = new Intl.PluralRules(tag).resolvedOptions().pluralCategories;

const { keyToFamilies, familyToKeys } = await computeFamilyKeyIndex({ packageDir: packageRoot });
const sliceNames = [...familyToKeys.keys()].sort();
const bySlice = new Map(sliceNames.map((name) => [name, []]));
bySlice.set('shared', []);
for (const [key, message] of entries) {
  const owners = keyToFamilies.get(key);
  const sliceName = owners && owners.size === 1 ? [...owners][0] : 'shared';
  bySlice.get(sliceName).push([key, message]);
}
const emittedSliceNames = [...sliceNames, 'shared'].filter((name) => bySlice.get(name).length > 0);

mkdirSync(sliceDir, { recursive: true });
for (const name of emittedSliceNames) {
  writeFileSync(
    join(sliceDir, `${name}.ts`),
    emitSlice(tag, name, bySlice.get(name), categories, meta),
    'utf8',
  );
}
writeFileSync(join(translationsRoot, `${tag}.ts`), emitAggregate(tag, emittedSliceNames), 'utf8');
console.log(
  `wrote ${relativeish(sliceDir)}/ (${emittedSliceNames.length} slices) and ${relativeish(flatTarget)}: ` +
    `${entries.length} keys, plural categories [${categories.join(', ')}]` +
    (meta ? `, meta ${meta}` : ''),
);

