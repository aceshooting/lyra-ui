const CATEGORY_NAMES = Object.freeze(['few', 'many', 'one', 'other', 'two', 'zero']);
const EXPECTED_RUNTIME = Object.freeze({
  node: '22.23.2',
  icu: '78.2',
  cldr: '48.0',
  unicode: '17.0',
});
const LAHNDA_FALLBACK = Object.freeze({
  resolvedLocale: 'en-US',
  reason: 'ICU 78.2 does not support lah (the canonical form of pnb). Preserve the existing runtime fallback category set; this is not Lahnda grammatical certification.',
});

function canonicalLocale(locale) {
  return Intl.getCanonicalLocales(locale.replaceAll('_', '-'))[0];
}

export function pinnedPluralCategories(pin, locale) {
  const canonical = canonicalLocale(locale);
  if (!pin?.locales || !Object.hasOwn(pin.locales, canonical)) {
    throw new Error(
      `CLDR plural-category pin has no exact entry for ${JSON.stringify(locale)}; ` +
        'update the reviewed pin with Node 22.23.2 before scaffolding or checking this locale',
    );
  }
  const categories = pin.locales[canonical];
  if (!validCategories(categories)) {
    throw new Error(`CLDR plural-category pin has an invalid category list for ${JSON.stringify(locale)}`);
  }
  return [...categories];
}

function validCategories(categories) {
  return Array.isArray(categories) && categories.length > 0 &&
    categories.every((category) => CATEGORY_NAMES.includes(category)) &&
    new Set(categories).size === categories.length &&
    JSON.stringify(categories) === JSON.stringify([...categories].sort()) &&
    categories.includes('other');
}

export function validatePluralCategoryPin(pin) {
  const errors = [];
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) {
    return ['CLDR plural-category pin must be an object'];
  }
  if (pin.schemaVersion !== 1) errors.push('CLDR plural-category pin schemaVersion must be 1');
  for (const [key, expected] of Object.entries(EXPECTED_RUNTIME)) {
    if (pin.runtime?.[key] !== expected) {
      errors.push(`CLDR plural-category pin runtime.${key} must be ${expected}`);
    }
  }
  if (typeof pin.source !== 'string' || pin.source.trim().length < 24) {
    errors.push('CLDR plural-category pin source must describe the versioned ICU query');
  }
  if (!pin.locales || typeof pin.locales !== 'object' || Array.isArray(pin.locales)) {
    errors.push('CLDR plural-category pin locales must be an object');
    return errors;
  }
  const locales = Object.keys(pin.locales);
  if (!Object.hasOwn(pin.locales, 'en')) errors.push('CLDR plural-category pin must include the English source locale en');
  if (JSON.stringify(locales) !== JSON.stringify([...locales].sort())) {
    errors.push('CLDR plural-category pin locales must be sorted by canonical locale tag');
  }
  for (const locale of locales) {
    let canonical;
    try {
      [canonical] = Intl.getCanonicalLocales(locale);
    } catch {
      errors.push(`CLDR plural-category pin contains invalid locale tag ${JSON.stringify(locale)}`);
      continue;
    }
    if (canonical !== locale) {
      errors.push(`CLDR plural-category pin locale ${JSON.stringify(locale)} is not canonical (use ${canonical})`);
    }
    const categories = pin.locales[locale];
    if (!validCategories(categories)) {
      errors.push(
        `CLDR plural-category pin locales.${locale} must be a sorted unique category list containing other`,
      );
    }
  }
  const fallbacks = pin.runtimeFallbacks ?? {};
  if (typeof fallbacks !== 'object' || fallbacks === null || Array.isArray(fallbacks)) {
    errors.push('CLDR plural-category pin runtimeFallbacks must be an object');
  } else {
    for (const locale of Object.keys(fallbacks)) {
      if (locale !== 'lah' || !Object.hasOwn(pin.locales, locale)) {
        errors.push(`CLDR plural-category pin has an unreviewed runtime fallback for ${locale}`);
      }
    }
    if (Object.hasOwn(pin.locales, 'lah') &&
        (fallbacks.lah?.resolvedLocale !== LAHNDA_FALLBACK.resolvedLocale ||
         fallbacks.lah?.reason !== LAHNDA_FALLBACK.reason ||
         JSON.stringify(pin.locales.lah) !== JSON.stringify(['one', 'other']))) {
      errors.push('CLDR plural-category pin lah requires its explicit reviewed English runtime fallback provenance');
    }
  }
  return errors;
}

export function capturePluralCategoryPin(locales, versions = process.versions) {
  for (const [key, expected] of Object.entries(EXPECTED_RUNTIME)) {
    if (versions[key] !== expected) {
      throw new Error(
        `CLDR pin capture requires Node ${EXPECTED_RUNTIME.node} / ICU ${EXPECTED_RUNTIME.icu}; ` +
          `the current runtime reports ${key}=${String(versions[key])}`,
      );
    }
  }
  const canonicalLocales = [...new Set(['en', ...locales].map(canonicalLocale))].sort();
  const categoriesByLocale = {};
  const runtimeFallbacks = {};
  for (const locale of canonicalLocales) {
    const supported = Intl.PluralRules.supportedLocalesOf([locale]).length > 0;
    if (!supported && locale !== 'lah') {
      throw new Error(`CLDR pin capture refuses unsupported locale ${locale}; host-default fallback is not locale evidence`);
    }
    if (!supported) runtimeFallbacks[locale] = { ...LAHNDA_FALLBACK };
    categoriesByLocale[locale] = new Intl.PluralRules(supported ? locale : LAHNDA_FALLBACK.resolvedLocale, { type: 'cardinal' })
      .resolvedOptions()
      .pluralCategories
      .slice()
      .sort();
  }
  return {
    schemaVersion: 1,
    runtime: { ...EXPECTED_RUNTIME },
    source:
      'Captured from cardinal Intl.PluralRules(locale).resolvedOptions().pluralCategories on the pinned Node, ICU, CLDR, and Unicode versions.',
    locales: categoriesByLocale,
    runtimeFallbacks,
  };
}
