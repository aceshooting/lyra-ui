#!/usr/bin/env node

// Emits a translation catalog SKELETON for one locale: every `DEFAULT_STRINGS` key, in
// `DEFAULT_STRINGS` order, with the English text as the starting value, and every count-bearing
// message expanded to exactly the CLDR plural categories that locale actually has.
//
// The point is that the three things a human translator cannot be trusted to get right by hand are
// made structural instead. `scripts/check-translations.mjs` fails a catalog that is missing a key,
// invents one, reorders them, drops a plural category, or renames a `{placeholder}` -- and every
// one of those is a mistake you make by TYPING a 1200-entry object, not by translating. Generating
// the shape leaves only the translation to do.
//
// The emitted values are English on purpose. A sentinel like 'TODO' would be worse: it makes an
// untranslated catalog render garbage rather than fall back to a language the reader at least has a
// chance with, and the gate cannot tell a sentinel from a legitimately identical string ("OK",
// "JSON", "PDF") anyway. Untranslated coverage is reported by `--report` instead.
//
// Run: node scripts/scaffold-translation.mjs <tag> [--force]
//      node scripts/scaffold-translation.mjs --report

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

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

function emit(tag, entries) {
  const categories = new Intl.PluralRules(tag).resolvedOptions().pluralCategories;
  const lines = entries.map(([key, message]) => {
    if (typeof message === 'string') return `  ${key}: ${quote(message)},`;
    // A locale gets exactly its own categories: seeding a Russian catalog with English's
    // {one, other} is the precise bug the plural rework existed to remove, since every count from
    // two upward would silently widen to `other`.
    const fallback = message.other ?? Object.values(message)[0];
    const body = categories.map((category) => `    ${category}: ${quote(message[category] ?? fallback)},`);
    return [`  ${key}: {`, ...body, '  },'].join('\n');
  });
  return `// ${tag} translation catalog for @aceshooting/lyra-ui.
//
// A side-effect-only module: a consumer writes a bare
// \`import '@aceshooting/lyra-ui/translations/${tag}';\` and reads nothing from it. Keep the keys in
// DEFAULT_STRINGS order -- \`scripts/check-translations.mjs\` enforces coverage, order, placeholder
// names and the plural-category set for this locale, and a catalog that cannot be diffed against
// another line-for-line is a catalog nobody will review.
//
// Regenerate the SHAPE (never the translations) with:
//   node scripts/scaffold-translation.mjs ${tag} --force
import { registerLyraLocale, type LyraLocaleStrings } from '../internal/localization.js';

const strings: LyraLocaleStrings = {
${lines.join('\n')}
};

registerLyraLocale('${tag}', strings);
`;
}

const args = process.argv.slice(2);
const entries = readDefaults();

if (args.includes('--report')) {
  const english = new Map(entries);
  const flatten = (message) => (typeof message === 'string' ? [message] : Object.values(message));
  const rows = [];
  for (const file of existsSync(translationsRoot) ? readdirSync(translationsRoot) : []) {
    if (!file.endsWith('.ts')) continue;
    const tag = file.replace(/\.ts$/, '');
    const source = readFileSync(join(translationsRoot, file), 'utf8');
    const program = parseSync(file, source).program;
    let object;
    visit(program, (node) => {
      if (object) return;
      if (node.type === 'VariableDeclarator' && node.id?.name === 'strings') object = node.init;
    });
    if (!object) {
      rows.push(`${tag}: could not read its \`strings\` object`);
      continue;
    }
    let total = 0;
    let untranslated = 0;
    for (const property of object.properties) {
      const key = propName(property);
      const text = literal(property.value);
      const values = text !== undefined ? [text] : property.value.properties.map((v) => literal(v.value));
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
const target = join(translationsRoot, `${tag}.ts`);
if (existsSync(target) && !args.includes('--force')) {
  console.error(`${relativeish(target)} already exists; pass --force to overwrite its SHAPE (translations are lost)`);
  process.exit(1);
}
function relativeish(path) {
  return path.slice(packageRoot.length);
}
writeFileSync(target, emit(tag, entries), 'utf8');
console.log(
  `wrote ${relativeish(target)}: ${entries.length} keys, plural categories ` +
    `[${new Intl.PluralRules(tag).resolvedOptions().pluralCategories.join(', ')}]`,
);
