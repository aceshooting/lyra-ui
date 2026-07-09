/**
 * Default mapping from a language subtag to a representative country flag
 * (ISO 3166-1 alpha-2). Languages don't map 1:1 to countries; these are the
 * conventional choices for language pickers. Override per-app as needed.
 */
export const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  en: 'gb',
  fr: 'fr',
  de: 'de',
  es: 'es',
  it: 'it',
  pt: 'pt',
  nl: 'nl',
  ar: 'sa',
  zh: 'cn',
  ja: 'jp',
  ko: 'kr',
  ru: 'ru',
  pl: 'pl',
  tr: 'tr',
  sv: 'se',
  da: 'dk',
  fi: 'fi',
  no: 'no',
  nb: 'no',
  cs: 'cz',
  sk: 'sk',
  el: 'gr',
  he: 'il',
  hi: 'in',
  th: 'th',
  vi: 'vn',
  id: 'id',
  ms: 'my',
  uk: 'ua',
  ro: 'ro',
  hu: 'hu',
  bg: 'bg',
  hr: 'hr',
  sr: 'rs',
  sl: 'si',
  et: 'ee',
  lv: 'lv',
  lt: 'lt',
  fa: 'ir',
  ur: 'pk',
  bn: 'bd',
  ta: 'in',
  ca: 'es',
};

/**
 * Resolve a BCP-47-ish language tag to a flag country code.
 * A region subtag wins (`en-US` → `us`); otherwise the base language is mapped.
 */
export function languageToCountry(language: string): string | undefined {
  const parts = language.toLowerCase().split(/[-_]/);
  const base = parts[0];
  const region = parts[1];
  if (region && region.length === 2) return region;
  return LANGUAGE_TO_COUNTRY[base];
}
