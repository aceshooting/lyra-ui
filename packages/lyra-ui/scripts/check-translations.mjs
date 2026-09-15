#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

// Guards the shipped translation catalogs (`src/translations/<tag>.ts`) against the four ways a
// catalog silently rots, none of which any other gate or the type system can see:
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
// Key ORDER is enforced too: catalogs are mechanically comparable only if they enumerate keys in
// the same order as `DEFAULT_STRINGS`, and a review that cannot diff two catalogs side by side is
// a review that will not spot 1 and 2 either.
// Finally, a catalog is a side-effect-only module -- a consumer writes a bare
// `import '@aceshooting/lyra-ui/translations/de';` and reads nothing from it -- so an undeclared
// one is dropped outright by any bundler honoring `package.json#sideEffects`, exactly as
// `flag-peer.js` was through 7.8.0. `scripts/check-side-effects.mjs` only walks
// `src/components/`, so the declaration for `src/translations/` is verified here instead. It
// bootstraps: with zero catalogs declared the requirement is printed as a NOTE, and from the first
// declared entry onward every catalog must be declared or this fails.

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { computeFamilyKeyIndex } from './generate-default-string-slices.mjs';
import { validateTranslationReviews } from './translation-review.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const localizationFile = join(packageRoot, 'src/internal/localization.ts');
const localizationRuntimeFile = join(packageRoot, 'src/internal/localization-runtime.ts');
const translationsRoot = join(packageRoot, 'src/translations');
const packageJsonPath = join(packageRoot, 'package.json');
const reviewFixturePath = join(packageRoot, 'scripts/fixtures/translation-reviews.json');
const reviewSchemaPath = join(packageRoot, 'scripts/fixtures/translation-reviews.schema.json');
const upstreamTagsPath = join(packageRoot, 'scripts/fixtures/upstream-tags.json');

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

/** The `registerLyraLocale('<tag>', <identifier>[, <meta>])` call a catalog module must make. */
function registrationCall(program) {
  let call;
  visitAst(program, (node) => {
    if (call || node.type !== 'CallExpression') return;
    if (node.callee?.type !== 'Identifier' || node.callee.name !== 'registerLyraLocale') return;
    call = {
      tag: literalString(node.arguments?.[0]),
      identifier: node.arguments?.[1]?.type === 'Identifier' ? node.arguments[1].name : undefined,
      meta: node.arguments?.[2]?.type === 'ObjectExpression' ? node.arguments[2] : undefined,
    };
  });
  return call;
}

/** Every bare (no-binding) `import '<specifier>';` in a program, in source order. Since 16.0.0 a
 *  migrated locale's aggregate `<tag>.ts` is exactly this shape: no direct `registerLyraLocale()`
 *  call of its own, just one side-effect import per family slice under `./<tag>/`. */
function bareImportSpecifiers(program) {
  const specifiers = [];
  for (const node of program.body) {
    if (node.type === 'ImportDeclaration' && node.specifiers.length === 0) {
      specifiers.push(node.source.value);
    }
  }
  return specifiers;
}

/** The base language subtag of a locale tag, normalized the way `normalizeLocale()` does. */
function baseLanguage(tag) {
  return tag.trim().replace(/_/g, '-').toLowerCase().split('-')[0];
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

/** Source text of a top-level `function <name>(...)` declaration, or `undefined`. */
function functionSource(program, source, name) {
  let found;
  visitAst(program, (node) => {
    if (found || node.type !== 'FunctionDeclaration' || node.id?.name !== name) return;
    found = source.slice(node.start, node.end);
  });
  return found;
}

/**
 * Fails a regional-only catalog whose base tag would render English.
 *
 * `pt-BR` and `zh-CN` are the only Portuguese and Chinese catalogs that ship, so `lang="pt"`,
 * `lang="pt-PT"`, `lang="zh"` and `lang="zh-Hans-CN"` reach them only through the base-language
 * widening half of `localeCandidates()` -- the plain BCP-47 truncation walk can only ever go from
 * more specific to less specific, never sideways into a region. Deleting that half type-checks,
 * passes every test that uses a base-tag catalog (`fa`, `he`, `de`), and silently renders English
 * for the two largest catalogs in the package; nothing else would notice.
 *
 * So: whenever a base language ships only regional catalogs, `localeCandidates()` must still
 * contain the widening step. The check costs nothing while every catalog is a bare base tag.
 */
function checkRegionalReachability(tags, localizationProgram, localizationSource) {
  const byLanguage = new Map();
  for (const tag of tags) {
    const language = baseLanguage(tag);
    if (!byLanguage.has(language)) byLanguage.set(language, []);
    byLanguage.get(language).push(tag);
  }
  const unreachable = [...byLanguage]
    .filter(([language, group]) => !group.some((tag) => tag.toLowerCase() === language))
    .map(([language, group]) => `"${language}" (only ${group.join(', ')} ship)`);
  if (unreachable.length === 0) return [];

  const candidates = functionSource(localizationProgram, localizationSource, 'localeCandidates');
  if (candidates === undefined) {
    return ['src/internal/localization-runtime.ts no longer declares localeCandidates(); locale lookup cannot be verified'];
  }
  if (candidates.includes('regionalFallbacks')) return [];
  return [
    'src/internal/localization-runtime.ts: localeCandidates() dropped the base-language widening step ' +
      '(regionalFallbacks), so these base languages resolve to English despite a fully translated ' +
      `catalog being registered: ${unreachable.join('; ')}`,
  ];
}

/** Validates the `registerLyraLocale()` metadata object (`dir`/`name`) a catalog or slice file
 *  declares, pushing onto `errors`. */
function validateMeta(file, meta, errors) {
  if (!meta) return;
  for (const property of meta.properties) {
    const member = propertyName(property);
    if (member !== 'dir' && member !== 'name') {
      errors.push(`${file}: registerLyraLocale() metadata has an unknown member "${member ?? '<computed>'}"`);
      continue;
    }
    const value = literalString(property.value);
    if (value === undefined) {
      errors.push(`${file}: registerLyraLocale() metadata "${member}" must be a string literal`);
    } else if (member === 'dir' && value !== 'ltr' && value !== 'rtl') {
      errors.push(`${file}: registerLyraLocale() metadata dir is "${value}"; only "ltr" and "rtl" exist`);
    }
  }
}

/**
 * Runs the four structural checks (coverage, order, placeholders, plural categories) a catalog
 * FILE must satisfy against `expectedOrderedKeys` -- the subset of `DEFAULT_STRINGS`, in
 * `DEFAULT_STRINGS` order, this particular file is responsible for. For a still-monolithic
 * `<tag>.ts` (or a future one that never migrates) that is the full English key set, unchanged from
 * pre-16.0.0 behaviour; for a per-family slice it is exactly that family's routed keys, so the same
 * rules now apply per-slice rather than only to a locale as a whole.
 */
function validateCatalogEntries({ file, entries, expectedOrderedKeys, english, categories, errors }) {
  const translated = new Map(entries);
  const expectedSet = new Set(expectedOrderedKeys);

  const missing = expectedOrderedKeys.filter((key) => !translated.has(key));
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
  // A key that IS a real DEFAULT_STRINGS entry but does not belong in THIS slice per the current
  // family index means the slice generator was not rerun after a family reassignment -- a
  // regeneration bug, distinct from an invented key.
  const misplaced = [...translated.keys()].filter((key) => english.has(key) && !expectedSet.has(key));
  if (misplaced.length > 0) {
    errors.push(
      `${file}: ${misplaced.length} key(s) do not belong in this slice per the current family index: ` +
        `${misplaced.slice(0, 12).join(', ')}${misplaced.length > 12 ? ', …' : ''} -- regenerate with ` +
        'node scripts/generate-translation-slices.mjs --write',
    );
  }
  const order = entries.map(([key]) => key).filter((key) => expectedSet.has(key));
  const expectedOrder = expectedOrderedKeys.filter((key) => translated.has(key));
  const firstDrift = order.findIndex((key, index) => key !== expectedOrder[index]);
  if (firstDrift !== -1) {
    errors.push(
      `${file}: key order diverges from DEFAULT_STRINGS at "${order[firstDrift]}" ` +
        `(expected "${expectedOrder[firstDrift]}") -- catalogs must stay diffable against English`,
    );
  }

  for (const [key, source_message] of english) {
    if (!expectedSet.has(key)) continue;
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
          `${file}: "${key}" is missing the ${uncovered.join('/')} categor(y|ies) this locale requires ` +
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
}

async function main() {
  const errors = [];
  const notes = [];

  const localizationSource = await readFile(localizationFile, 'utf8');
  const localizationProgram = parseProgram('src/internal/localization.ts', localizationSource);
  const localizationRuntimeSource = await readFile(localizationRuntimeFile, 'utf8');
  const localizationRuntimeProgram = parseProgram(
    'src/internal/localization-runtime.ts',
    localizationRuntimeSource,
  );
  const defaults = namedObjectLiteral(localizationProgram, 'DEFAULT_STRINGS');
  if (!defaults) throw new Error('src/internal/localization.ts does not declare DEFAULT_STRINGS as an object literal');
  const englishEntries = messageEntries(defaults, 'src/internal/localization.ts', errors);
  if (englishEntries.length < 100) {
    throw new Error(`implausibly few DEFAULT_STRINGS entries parsed (${englishEntries.length})`);
  }
  const english = new Map(englishEntries);
  const englishOrder = englishEntries.map(([key]) => key);

  // The SAME per-component key-reachability data the English default-string slices are generated
  // from (`generate-default-string-slices.mjs`'s `computeFamilyKeyIndex()`), reused rather than
  // re-derived, so a translation slice's expected key set can never drift from what
  // `generate-translation-slices.mjs` actually routes there.
  const familyIndex = await computeFamilyKeyIndex({ packageDir: packageRoot });
  const orderedKeysForSlice = (sliceName) => {
    if (sliceName === 'shared') {
      return englishOrder.filter((key) => (familyIndex.keyToFamilies.get(key)?.size ?? 0) > 1);
    }
    return englishOrder.filter((key) => {
      const owners = familyIndex.keyToFamilies.get(key);
      return owners?.size === 1 && owners.has(sliceName);
    });
  };
  const knownSliceNames = new Set([...familyIndex.familyToKeys.keys(), 'shared']);

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
  const catalogEntries = new Map();
  const registeredTags = [];

  for (const name of files) {
    const file = relative(packageRoot, join(translationsRoot, name));
    const source = await readFile(join(translationsRoot, name), 'utf8');
    const program = parseProgram(file, source);
    const base = name.slice(0, -'.ts'.length);

    const registration = registrationCall(program);
    if (registration?.tag && registration.identifier) {
      // STILL-MONOLITHIC shape: a locale that has not migrated to per-family slices (or a future
      // one that deliberately never does). Validated exactly as before 16.0.0, against the full
      // English key set.
      const { tag, identifier, meta } = registration;
      registeredTags.push(tag);
      validateMeta(file, meta, errors);

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
      catalogEntries.set(tag, entries);
      validateCatalogEntries({ file, entries, expectedOrderedKeys: englishOrder, english, categories, errors });

      const srcEntry = `./src/translations/${name}`;
      const distEntry = `./dist/translations/${base}.js`;
      requiredSideEffects.push(srcEntry, distEntry);
      if (anyCatalogDeclared) {
        if (!declaredSideEffects.has(srcEntry)) errors.push(`package.json#sideEffects is missing "${srcEntry}"`);
        if (!declaredSideEffects.has(distEntry)) errors.push(`package.json#sideEffects is missing "${distEntry}"`);
      }
      summaries.push(`${tag} (${entries.length} keys, plural categories: ${categories.join('/')})`);
      continue;
    }

    // SLICED shape: `${name}` must be a pure side-effect re-export of `./${base}/<family>.js`
    // slices -- the authoritative catalog data lives in those files, not here.
    const imports = bareImportSpecifiers(program);
    const localeDir = join(translationsRoot, base);
    if (imports.length === 0 || !existsSync(localeDir)) {
      errors.push(
        `${file}: expected a top-level registerLyraLocale('<tag>', <catalog>) call, or a side-effect` +
          `-only aggregate importing ./${base}/<family>.js slices (src/translations/${base}/ not found)`,
      );
      continue;
    }
    const onDiskSlices = (await readdir(localeDir))
      .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
      .sort();
    const expectedSpecifiers = onDiskSlices
      .map((entry) => `./${base}/${entry.slice(0, -'.ts'.length)}.js`)
      .sort();
    const actualSpecifiers = [...imports].sort();
    if (JSON.stringify(actualSpecifiers) !== JSON.stringify(expectedSpecifiers)) {
      errors.push(
        `${file}: imports [${actualSpecifiers.join(', ')}] but src/translations/${base}/ contains slices ` +
          `[${expectedSpecifiers.join(', ')}] -- regenerate with node scripts/generate-translation-slices.mjs --write`,
      );
    }

    let tag;
    const unionEntries = [];
    for (const sliceFileName of onDiskSlices) {
      const sliceFile = relative(packageRoot, join(localeDir, sliceFileName));
      const sliceName = sliceFileName.slice(0, -'.ts'.length);
      if (!knownSliceNames.has(sliceName)) {
        errors.push(`${sliceFile}: "${sliceName}" is not a known component family, nor "shared"`);
      }
      const sliceSource = await readFile(join(localeDir, sliceFileName), 'utf8');
      const sliceProgram = parseProgram(sliceFile, sliceSource);
      const sliceRegistration = registrationCall(sliceProgram);
      if (!sliceRegistration?.tag || !sliceRegistration.identifier) {
        errors.push(`${sliceFile}: expected a top-level registerLyraLocale('<tag>', <catalog>) call`);
        continue;
      }
      tag ??= sliceRegistration.tag;
      if (sliceRegistration.tag !== tag) {
        errors.push(`${sliceFile}: registers "${sliceRegistration.tag}" but a sibling slice registers "${tag}"`);
      }
      validateMeta(sliceFile, sliceRegistration.meta, errors);

      let sliceCategories;
      try {
        sliceCategories = pluralCategoriesFor(sliceRegistration.tag);
      } catch {
        errors.push(`${sliceFile}: "${sliceRegistration.tag}" is not a language tag Intl.PluralRules accepts`);
        continue;
      }
      const sliceCatalog = namedObjectLiteral(sliceProgram, sliceRegistration.identifier);
      if (!sliceCatalog) {
        errors.push(`${sliceFile}: could not find the "${sliceRegistration.identifier}" catalog object literal`);
        continue;
      }
      const sliceEntries = messageEntries(sliceCatalog, sliceFile, errors);
      unionEntries.push(...sliceEntries);
      validateCatalogEntries({
        file: sliceFile,
        entries: sliceEntries,
        expectedOrderedKeys: orderedKeysForSlice(sliceName),
        english,
        categories: sliceCategories,
        errors,
      });

      const srcEntry = `./src/translations/${base}/${sliceFileName}`;
      const distEntry = `./dist/translations/${base}/${sliceName}.js`;
      requiredSideEffects.push(srcEntry, distEntry);
      if (anyCatalogDeclared) {
        if (!declaredSideEffects.has(srcEntry)) errors.push(`package.json#sideEffects is missing "${srcEntry}"`);
        if (!declaredSideEffects.has(distEntry)) errors.push(`package.json#sideEffects is missing "${distEntry}"`);
      }
    }
    if (!tag) continue; // every slice already reported its own error above

    if (tag.toLowerCase().replace(/_/g, '-') !== base.toLowerCase()) {
      errors.push(`${file}: slices register "${tag}" but the directory is named "${base}/" -- they must agree`);
    }
    registeredTags.push(tag);

    const unionMap = new Map();
    for (const [key, value] of unionEntries) {
      if (unionMap.has(key)) {
        errors.push(`src/translations/${base}/: key "${key}" is registered by more than one slice`);
        continue;
      }
      unionMap.set(key, value);
    }
    // Reassembled in DEFAULT_STRINGS order, not slice-iteration order: consumers of `catalogEntries`
    // -- `validateTranslationReviews()`'s content-addressed `messageSnapshot()` in particular --
    // hash the ORDERED entry list, and that snapshot must stay identical to what the pre-16.0.0
    // monolith produced, or every approved review goes stale for a purely mechanical reason.
    catalogEntries.set(tag, englishOrder.filter((key) => unionMap.has(key)).map((key) => [key, unionMap.get(key)]));

    const srcAggregateEntry = `./src/translations/${name}`;
    const distAggregateEntry = `./dist/translations/${base}.js`;
    requiredSideEffects.push(srcAggregateEntry, distAggregateEntry);
    if (anyCatalogDeclared) {
      if (!declaredSideEffects.has(srcAggregateEntry)) {
        errors.push(`package.json#sideEffects is missing "${srcAggregateEntry}"`);
      }
      if (!declaredSideEffects.has(distAggregateEntry)) {
        errors.push(`package.json#sideEffects is missing "${distAggregateEntry}"`);
      }
    }
    summaries.push(`${tag} (${unionMap.size} keys across ${onDiskSlices.length} slices)`);
  }

  errors.push(...checkRegionalReachability(
    registeredTags,
    localizationRuntimeProgram,
    localizationRuntimeSource,
  ));

  try {
    const [reviewSource, schemaSource, upstreamSource] = await Promise.all([
      readFile(reviewFixturePath, 'utf8'),
      readFile(reviewSchemaPath, 'utf8'),
      readFile(upstreamTagsPath, 'utf8'),
    ]);
    const fixture = JSON.parse(reviewSource);
    // Parsing the schema here makes a missing or malformed authoritative schema fail the same gate
    // as its fixture, even though cross-file facts are enforced by validateTranslationReviews().
    JSON.parse(schemaSource);
    const upstream = JSON.parse(upstreamSource);
    errors.push(
      ...validateTranslationReviews(fixture, {
        englishEntries,
        catalogs: catalogEntries,
        upstreamPins: {
          webawesome: upstream.webawesome,
          shoelace: upstream.shoelace,
        },
        requireApproved: true,
      }).map((error) => `scripts/fixtures/translation-reviews.json: ${error}`),
    );
  } catch (error) {
    errors.push(
      `translation review fixture/schema could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
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

if (isMainModule(import.meta.url)) {
  await main();
}
