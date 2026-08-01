#!/usr/bin/env node

// Guards the shipped translation catalogs (`src/translations/<tag>.ts`) against the four ways a
// catalog silently rots, none of which any other gate or the type system can see:
//
//   1. A KEY GOES MISSING. `LyraLocaleStrings` is `Partial<...>` by design -- a per-instance
//      `.strings` override is meant to carry two keys, not twelve hundred -- so a catalog that
//      forgot 300 keys type-checks perfectly and just renders English in the middle of a German
//      page. Only a coverage check catches that.
//   2. A KEY IS INVENTED. `LyraLocaleStrings` also has a `Record<string, ...>` index signature (a
//      component may use a key outside the built-in union), so a typo'd key -- `closeButtn` --
//      type-checks and is simply never read. It looks translated and renders English forever.
//   3. A PLACEHOLDER IS TRANSLATED. `resolveLyraString()` interpolates `{count}` by exact name; a
//      catalog that helpfully localizes the token to `{anzahl}` renders the literal text
//      "{anzahl}" to the user, because an unknown name is passed through verbatim rather than
//      throwing.
//   4. A PLURAL CATEGORY IS MISSING. Since 8.0.0 a count-bearing message is an object keyed by
//      CLDR plural category. A Russian catalog that authors only `{one, other}` -- the English
//      shape -- silently widens `few`/`many` to `other` for every count from 2 upward, which is
//      exactly the bug the plural rework existed to remove. The required category set is read
//      from `Intl.PluralRules(tag).resolvedOptions().pluralCategories`, so it tracks the runtime's
//      CLDR data rather than a hand-copied table. (If a future ICU adds a category to a locale
//      this check goes red -- that is a genuine translation gap surfacing, not a false positive.)
//
// Key ORDER is enforced too: catalogs are mechanically comparable only if they enumerate keys in
// the same order as `DEFAULT_STRINGS`, and a review that cannot diff two catalogs side by side is
// a review that will not spot 1 and 2 either.
//
// Finally, a catalog is a side-effect-only module -- a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/de';` and reads nothing from it -- so an undeclared
// one is dropped outright by any bundler honoring `package.json#sideEffects`, exactly as
// `flag-peer.js` was through 7.8.0. `scripts/check-side-effects.mjs` only walks
// `src/components/`, so the declaration for `src/translations/` is verified here instead. It
// bootstraps: with zero catalogs declared the requirement is printed as a NOTE, and from the first
// declared entry onward every catalog must be declared or this fails.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const localizationFile = join(packageRoot, 'src/internal/localization.ts');
const translationsRoot = join(packageRoot, 'src/translations');
const packageJsonPath = join(packageRoot, 'package.json');

/** The complete CLDR plural category set; a catalog may not invent a seventh. */
const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

function parseProgram(file, source) {
  const result = parseSync(file, source);
  if (result.errors.length > 0) {
    const details = result.errors.map((error) => error.message ?? String(error)).join('\n');
    throw new SyntaxError(`${file} could not be parsed:\n${details}`);
  }
  return result.program;
}

function visitAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) visitAst(child, visitor);
    } else if (value && typeof value === 'object') {
      visitAst(value, visitor);
    }
  }
}

function propertyName(property) {
  if (property.type !== 'Property' || property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') return property.key.value;
  return undefined;
}

function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw;
  }
  return undefined;
}

/**
 * Reads one message-map object literal into `[key, string | Record<category, string>][]`, in
 * source order. Anything that is not a plain string or a flat object of plain strings is reported
 * rather than silently skipped -- a computed or interpolated message would defeat every check
 * below.
 */
function messageEntries(objectExpression, file, errors) {
  const entries = [];
  for (const property of objectExpression.properties) {
    const key = propertyName(property);
    if (key === undefined) {
      errors.push(`${file}: a message entry is computed or spread; every entry must be a literal key`);
      continue;
    }
    const text = literalString(property.value);
    if (text !== undefined) {
      entries.push([key, text]);
      continue;
    }
    if (property.value.type === 'ObjectExpression') {
      const variants = {};
      let ok = true;
      for (const variant of property.value.properties) {
        const category = propertyName(variant);
        const variantText = literalString(variant.value);
        if (category === undefined || variantText === undefined) {
          errors.push(`${file}: "${key}" has a plural variant that is not a literal category: string pair`);
          ok = false;
          continue;
        }
        variants[category] = variantText;
      }
      if (ok) entries.push([key, variants]);
      continue;
    }
    errors.push(`${file}: "${key}" is neither a string literal nor a plural-category object`);
  }
  return entries;
}

function namedObjectLiteral(program, name) {
  let found;
  visitAst(program, (node) => {
    if (
      found ||
      node.type !== 'VariableDeclarator' ||
      node.id?.type !== 'Identifier' ||
      node.id.name !== name ||
      node.init?.type !== 'ObjectExpression'
    ) {
      return;
    }
    found = node.init;
  });
  return found;
}

/** The `registerLyraLocale('<tag>', <identifier>)` call a catalog module must make. */
function registrationCall(program) {
  let call;
  visitAst(program, (node) => {
    if (call || node.type !== 'CallExpression') return;
    if (node.callee?.type !== 'Identifier' || node.callee.name !== 'registerLyraLocale') return;
    call = {
      tag: literalString(node.arguments?.[0]),
      identifier: node.arguments?.[1]?.type === 'Identifier' ? node.arguments[1].name : undefined,
    };
  });
  return call;
}

const PLACEHOLDER = /\{(\w+)\}/g;

function placeholders(text) {
  return new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]));
}

function unionPlaceholders(message) {
  const names = new Set();
  for (const text of typeof message === 'string' ? [message] : Object.values(message)) {
    for (const name of placeholders(text)) names.add(name);
  }
  return names;
}

function pluralCategoriesFor(tag) {
  return new Intl.PluralRules(tag).resolvedOptions().pluralCategories;
}

async function main() {
  const errors = [];
  const notes = [];

  const localizationSource = await readFile(localizationFile, 'utf8');
  const localizationProgram = parseProgram('src/internal/localization.ts', localizationSource);
  const defaults = namedObjectLiteral(localizationProgram, 'DEFAULT_STRINGS');
  if (!defaults) throw new Error('src/internal/localization.ts does not declare DEFAULT_STRINGS as an object literal');
  const englishEntries = messageEntries(defaults, 'src/internal/localization.ts', errors);
  if (englishEntries.length < 100) {
    throw new Error(`implausibly few DEFAULT_STRINGS entries parsed (${englishEntries.length})`);
  }
  const english = new Map(englishEntries);
  const englishOrder = englishEntries.map(([key]) => key);

  let files = [];
  try {
    files = (await readdir(translationsRoot))
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .sort();
  } catch {
    console.log('No src/translations/ directory yet; nothing to check.');
    return;
  }
  if (files.length === 0) {
    console.log('No translation catalogs in src/translations/; nothing to check.');
    return;
  }

  const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const declaredSideEffects = new Set(pkg.sideEffects ?? []);
  const anyCatalogDeclared = [...declaredSideEffects].some((entry) => entry.includes('/translations/'));
  const requiredSideEffects = [];

  const summaries = [];

  for (const name of files) {
    const file = relative(packageRoot, join(translationsRoot, name));
    const source = await readFile(join(translationsRoot, name), 'utf8');
    const program = parseProgram(file, source);

    const registration = registrationCall(program);
    if (!registration?.tag || !registration.identifier) {
      errors.push(`${file}: expected a top-level registerLyraLocale('<tag>', <catalog>) call`);
      continue;
    }
    const { tag, identifier } = registration;

    const base = name.slice(0, -'.ts'.length);
    if (tag.toLowerCase().replace(/_/g, '-') !== base.toLowerCase()) {
      errors.push(`${file}: registers "${tag}" but the file is named "${base}.ts" -- they must agree`);
    }
    let categories;
    try {
      categories = pluralCategoriesFor(tag);
    } catch {
      errors.push(`${file}: "${tag}" is not a language tag Intl.PluralRules accepts`);
      continue;
    }

    const catalog = namedObjectLiteral(program, identifier);
    if (!catalog) {
      errors.push(`${file}: could not find the "${identifier}" catalog object literal`);
      continue;
    }
    const entries = messageEntries(catalog, file, errors);
    const translated = new Map(entries);

    const missing = englishOrder.filter((key) => !translated.has(key));
    if (missing.length > 0) {
      errors.push(
        `${file}: ${missing.length} key(s) missing (a Partial<> catalog type cannot catch this): ` +
          `${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`,
      );
    }
    const invented = [...translated.keys()].filter((key) => !english.has(key));
    if (invented.length > 0) {
      errors.push(
        `${file}: ${invented.length} key(s) do not exist in DEFAULT_STRINGS and are read by nothing: ` +
          `${invented.slice(0, 12).join(', ')}${invented.length > 12 ? ', …' : ''}`,
      );
    }
    const order = entries.map(([key]) => key).filter((key) => english.has(key));
    const expectedOrder = englishOrder.filter((key) => translated.has(key));
    const firstDrift = order.findIndex((key, index) => key !== expectedOrder[index]);
    if (firstDrift !== -1) {
      errors.push(
        `${file}: key order diverges from DEFAULT_STRINGS at "${order[firstDrift]}" ` +
          `(expected "${expectedOrder[firstDrift]}") -- catalogs must stay diffable against English`,
      );
    }

    for (const [key, source_message] of english) {
      const message = translated.get(key);
      if (message === undefined) continue;

      const englishIsPlural = typeof source_message !== 'string';
      const translatedIsPlural = typeof message !== 'string';
      if (englishIsPlural && !translatedIsPlural) {
        errors.push(`${file}: "${key}" is pluralized in English but translated as a single string`);
        continue;
      }
      if (!englishIsPlural && translatedIsPlural) {
        errors.push(`${file}: "${key}" is not pluralized in English but translated as a category object`);
        continue;
      }

      if (translatedIsPlural) {
        const authored = Object.keys(message);
        const unknown = authored.filter((category) => !PLURAL_CATEGORIES.includes(category));
        if (unknown.length > 0) {
          errors.push(`${file}: "${key}" declares non-CLDR plural categor(y|ies): ${unknown.join(', ')}`);
        }
        const uncovered = categories.filter((category) => !authored.includes(category));
        if (uncovered.length > 0) {
          errors.push(
            `${file}: "${key}" is missing the ${uncovered.join('/')} categor(y|ies) that "${tag}" requires ` +
              `(Intl.PluralRules reports ${categories.join('/')}) -- those counts would silently widen to "other"`,
          );
        }
        if (!authored.includes('other')) {
          errors.push(`${file}: "${key}" has no "other" variant, which is the mandatory terminal fallback`);
        }
      }

      const expected = unionPlaceholders(source_message);
      const actual = unionPlaceholders(message);
      const lost = [...expected].filter((placeholder) => !actual.has(placeholder));
      if (lost.length > 0) {
        errors.push(`${file}: "${key}" drops the {${lost.join('}, {')}} placeholder(s) present in English`);
      }
      const strayed = [...actual].filter((placeholder) => !expected.has(placeholder));
      if (strayed.length > 0) {
        errors.push(
          `${file}: "${key}" introduces the {${strayed.join('}, {')}} placeholder(s), which nothing supplies ` +
            `-- they would render as literal text`,
        );
      }
      // The `other` variant is the one every locale is guaranteed to reach, so it must carry the
      // full English placeholder set even when a narrower category (Arabic `zero`, Russian `one`)
      // idiomatically spells the number out instead.
      if (translatedIsPlural && typeof message.other === 'string') {
        const otherExpected = placeholders(typeof source_message === 'string' ? source_message : source_message.other);
        const otherActual = placeholders(message.other);
        const otherLost = [...otherExpected].filter((placeholder) => !otherActual.has(placeholder));
        if (otherLost.length > 0) {
          errors.push(`${file}: "${key}".other drops the {${otherLost.join('}, {')}} placeholder(s)`);
        }
      }
    }

    const srcEntry = `./src/translations/${name}`;
    const distEntry = `./dist/translations/${base}.js`;
    requiredSideEffects.push(srcEntry, distEntry);
    if (anyCatalogDeclared) {
      if (!declaredSideEffects.has(srcEntry)) errors.push(`package.json#sideEffects is missing "${srcEntry}"`);
      if (!declaredSideEffects.has(distEntry)) errors.push(`package.json#sideEffects is missing "${distEntry}"`);
    }

    summaries.push(`${tag} (${translated.size} keys, plural categories: ${categories.join('/')})`);
  }

  if (!anyCatalogDeclared) {
    notes.push(
      'NOTE: no translation catalog is declared in package.json#sideEffects yet, so a production\n' +
        'bundler may drop the registerLyraLocale() call in every one of them. Add these entries --\n' +
        'this check turns into a hard gate as soon as the first one is present:\n' +
        requiredSideEffects.map((entry) => `      ${JSON.stringify(entry)},`).join('\n'),
    );
  }

  for (const note of notes) console.log(note);

  if (errors.length > 0) {
    console.error(`\nTranslation catalog check failed with ${errors.length} problem(s):\n`);
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Translation catalogs verified: ${files.length} locale(s) x ${english.size} keys ` +
      `(${englishOrder.filter((key) => typeof english.get(key) !== 'string').length} pluralized).`,
  );
  for (const summary of summaries) console.log(`- ${summary}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
