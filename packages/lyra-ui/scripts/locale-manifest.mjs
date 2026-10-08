import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinnedPluralCategories, validatePluralCategoryPin } from './cldr-plural-categories.mjs';
import { readTranslationCatalogInventory } from './check-translations.mjs';
import { validateTranslationReviews } from './translation-review.mjs';
import { readTranslationReviews } from './translation-review-source.mjs';
import { TRANSLATIONS_PACKAGE } from './translations-companion.mjs';

const defaultPackageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function canonicalLocale(locale) {
  let canonical;
  try {
    [canonical] = Intl.getCanonicalLocales(locale);
  } catch {
    throw new Error(`${JSON.stringify(locale)} is not a valid BCP 47 locale tag`);
  }
  return canonical;
}

function localeScript(locale) {
  const script = new Intl.Locale(locale).maximize().script;
  if (!script) throw new Error(`${locale} has no maximized script in the pinned Intl.Locale data`);
  return script;
}

function packageSpecifier(relativeModulePath) {
  return `${TRANSLATIONS_PACKAGE}/${relativeModulePath.replace(/^\.\//u, '').replace(/^translations\//u, '')}`;
}

export function countCoverage({ locale, ownKeys, sourceKeys, parent, parentKeys }) {
  if (parent !== null && !Array.isArray(parentKeys))
    throw new Error(`${locale}: explicit parent coverage requires resolved parent keys`);
  const sourceSet = new Set(sourceKeys);
  const ownSet = new Set(ownKeys);
  const translatedOwnKeyCount = [...ownSet].filter((key) => sourceSet.has(key)).length;
  const inheritedKeyCount = [...new Set(parentKeys ?? [])].filter((key) => sourceSet.has(key) && !ownSet.has(key)).length;
  const missingKeyCount = sourceSet.size - translatedOwnKeyCount - inheritedKeyCount;
  if (missingKeyCount < 0) throw new Error(`${locale} contains more distinct keys than the English source`);
  return { translatedOwnKeyCount, inheritedKeyCount, missingKeyCount };
}

export function canonicalCatalogIdentities(sourceLocales) {
  const byCanonicalLocale = new Map();
  for (const sourceLocale of sourceLocales) {
    const locale = canonicalLocale(sourceLocale);
    const prior = byCanonicalLocale.get(locale);
    if (prior) throw new Error(`catalogs ${prior} and ${sourceLocale} both canonicalize to ${locale}`);
    byCanonicalLocale.set(locale, sourceLocale);
  }
  return byCanonicalLocale;
}

function translationEntries({ review, module, ownKeys, parentKeys, sourceKeys, pluralPin }) {
  const locale = canonicalLocale(review.locale);
  const coverage = countCoverage({ locale, ownKeys, sourceKeys, parent: module.parent, parentKeys });
  if (review.direction !== 'ltr' && review.direction !== 'rtl') {
    throw new Error(`${locale} review metadata has an invalid direction`);
  }
  const families = Object.fromEntries(
    Object.entries(module.familyPaths)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, relativePath]) => [family, packageSpecifier(`translations/${relativePath.replace(/^\.\//u, '')}`)]),
  );
  const missingFamilyPaths = Object.keys(module.familyPaths).filter((family) => !families[family]);
  if (missingFamilyPaths.length > 0) {
    throw new Error(`${locale} has a stale family import path: ${missingFamilyPaths.join(', ')}`);
  }
  return {
    locale,
    ...(review.locale === locale ? {} : { sourceLocale: review.locale }),
    kind: 'translated',
    direction: review.direction,
    script: localeScript(locale),
    parent: module.parent,
    aggregateImport: packageSpecifier(`translations/${module.aggregatePath.replace(/^\.\//u, '')}`),
    familyImports: families,
    sourceKeyCount: sourceKeys.length,
    ...coverage,
    reviewTier: review.reviewTier,
    reviewStatus: review.reviewer.status,
    pluralCategories: pinnedPluralCategories(pluralPin, locale),
  };
}

function sourceEntry(sourceKeys, pluralPin) {
  return {
    locale: 'en',
    kind: 'source',
    direction: 'ltr',
    script: localeScript('en'),
    parent: null,
    aggregateImport: null,
    familyImports: {},
    sourceKeyCount: sourceKeys.length,
    translatedOwnKeyCount: 0,
    inheritedKeyCount: 0,
    missingKeyCount: 0,
    reviewTier: null,
    reviewStatus: 'source',
    pluralCategories: pinnedPluralCategories(pluralPin, 'en'),
  };
}

function pseudoEntry({ module, sourceKeys, pluralPin }) {
  const locale = canonicalLocale(module.locale);
  return {
    locale,
    kind: 'testing-only',
    direction: module.direction,
    script: localeScript(locale),
    parent: 'en',
    aggregateImport: packageSpecifier(`translations/${module.aggregatePath.replace(/^\.\//u, '')}`),
    familyImports: {},
    sourceKeyCount: sourceKeys.length,
    translatedOwnKeyCount: 0,
    inheritedKeyCount: 0,
    missingKeyCount: 0,
    syntheticKeyCount: sourceKeys.length,
    reviewTier: null,
    reviewStatus: 'testing-only',
    pluralCategories: pinnedPluralCategories(pluralPin, locale),
  };
}

function validateRuntimePin(pin, runtime) {
  for (const key of ['node', 'icu', 'cldr', 'unicode']) {
    if (runtime[key] !== pin.runtime?.[key]) {
      throw new Error(
        `locale generation requires pinned ${key} ${String(pin.runtime?.[key])}; ` +
          `current runtime reports ${String(runtime[key])}`,
      );
    }
  }
}

/** Analyze checked-in source once for both the discovery manifest and optional literal loader map. */
export async function analyzeLocaleInventory({ packageDir = defaultPackageDir, runtime = process.versions } = {}) {
  const pluralPinPath = path.join(packageDir, 'scripts/fixtures/cldr-plural-categories.json');
  const upstreamPath = path.join(packageDir, 'scripts/fixtures/upstream-tags.json');
  const [reviews, pluralPin, upstream, inventory] = await Promise.all([
    readTranslationReviews({ packageDir }),
    readFile(pluralPinPath, 'utf8').then(JSON.parse),
    readFile(upstreamPath, 'utf8').then(JSON.parse),
    readTranslationCatalogInventory({ packageDir }),
  ]);
  const pinErrors = validatePluralCategoryPin(pluralPin);
  if (pinErrors.length > 0) throw new Error(pinErrors.join('\n'));
  validateRuntimePin(pluralPin, runtime);

  const sourceKeys = inventory.englishEntries.map(([key]) => key);
  const catalogLocales = sorted(inventory.catalogs.keys());
  const reviewedLocales = reviews.catalogs.map((record) => record.locale);
  if (JSON.stringify(catalogLocales) !== JSON.stringify(reviewedLocales)) {
    throw new Error(
      `review records must cover exactly the discovered catalog modules; source=[${catalogLocales.join(', ')}], ` +
        `reviews=[${reviewedLocales.join(', ')}]`,
    );
  }
  const reviewErrors = validateTranslationReviews(reviews, {
    englishEntries: inventory.englishEntries,
    catalogs: inventory.catalogs,
    upstreamPins: { webawesome: upstream.webawesome, shoelace: upstream.shoelace },
    requireApproved: false,
  });
  if (reviewErrors.length > 0) throw new Error(reviewErrors.join('\n'));

  const modules = new Map(inventory.modules.map((module) => [module.locale, module]));
  const reviewByLocale = new Map(reviews.catalogs.map((record) => [record.locale, record]));
  const localeTags = ['en', ...catalogLocales, ...inventory.pseudoModules.map(({ locale }) => locale)];
  for (const locale of localeTags) pinnedPluralCategories(pluralPin, canonicalLocale(locale));

  canonicalCatalogIdentities(catalogLocales);

  const translatedEntries = catalogLocales.map((locale) => {
    const review = reviewByLocale.get(locale);
    const module = modules.get(locale);
    if (!review || !module) throw new Error(`${locale} has stale review or aggregate module metadata`);
    return translationEntries({
      review,
      module,
      ownKeys: inventory.authoredCatalogs.get(locale).map(([key]) => key),
      parentKeys: module.parent ? inventory.catalogs.get(module.parent).map(([key]) => key) : undefined,
      sourceKeys,
      pluralPin,
    });
  });
  const pseudoEntries = inventory.pseudoModules.map((module) => pseudoEntry({ module, sourceKeys, pluralPin }));
  const manifest = {
    schemaVersion: 1,
    pluralRules: {
      cldr: pluralPin.runtime.cldr,
      icu: pluralPin.runtime.icu,
      unicode: pluralPin.runtime.unicode,
    },
    runtimeFallbacks: pluralPin.runtimeFallbacks ?? {},
    sourceKeyCount: sourceKeys.length,
    locales: [sourceEntry(sourceKeys, pluralPin), ...translatedEntries, ...pseudoEntries]
      .sort((left, right) => left.locale.localeCompare(right.locale)),
  };
  const loaderLocales = [];
  for (const [sourceLocale, module] of modules) {
    const locale = canonicalLocale(sourceLocale);
    if (locale === 'en') throw new Error('English source must not be included in the optional loader map');
    if (locale.startsWith('en-XA') || locale === 'ar-XB') {
      throw new Error('pseudo locales must not be included in the optional loader map');
    }
    loaderLocales.push({
      locale,
      sourceLocale,
      importPath: `../translations/${module.aggregatePath.replace(/^\.\//u, '')}`,
    });
  }
  loaderLocales.sort((left, right) => left.locale.localeCompare(right.locale));
  for (let index = 1; index < loaderLocales.length; index += 1) {
    if (loaderLocales[index - 1].locale === loaderLocales[index].locale) {
      throw new Error(`loader map has duplicate canonical locale ${loaderLocales[index].locale}`);
    }
  }
  return { packageDir, manifest, loaderLocales, inventory, pluralPin };
}

export function renderLocaleLoaderMap(locales) {
  const entries = [...locales].sort((left, right) => left.locale.localeCompare(right.locale)).map(({ locale, importPath }) => {
    if (canonicalLocale(locale) !== locale) throw new Error(`${locale} loader key is not canonical`);
    if (!/^\.\.\/translations\/[\w-]+\.js$/u.test(importPath)) {
      throw new Error(`${locale} loader import path is invalid: ${importPath}`);
    }
    return `  '${locale}': () => import('${importPath}'),`;
  });
  return [
    '// GENERATED by scripts/generate-locale-manifest.mjs -- do not edit by hand.',
    '// This optional literal-import map is consumed only by the locale-loader entry point.',
    'export const localeLoaders: Readonly<Record<string, () => Promise<unknown>>> = Object.freeze({',
    ...entries,
    '});',
    '',
  ].join('\n');
}

export function renderLocaleArtifacts({ packageDir = defaultPackageDir, manifest, loaderLocales }) {
  return new Map([
    [
      path.join(packageDir, 'locales.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    ],
    [
      path.join(packageDir, 'src/internal/locale-loaders.generated.ts'),
      renderLocaleLoaderMap(loaderLocales),
    ],
  ]);
}

export async function artifactProblems(artifacts, { read = readFile } = {}) {
  const problems = [];
  for (const [file, expected] of artifacts) {
    let actual;
    try {
      actual = await read(file, 'utf8');
    } catch {
      problems.push(`${file} is missing`);
      continue;
    }
    if (actual !== expected) problems.push(`${file} is stale`);
  }
  return problems;
}
