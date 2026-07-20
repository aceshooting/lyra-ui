import { getDisplayNames } from '../../../internal/intl-cache.js';

/**
 * ISO 3166-1 alpha-2 shape: exactly two ASCII letters, case-insensitive.
 * Shared by `flag.ts` (validating `country`) and `languageToCountry` below
 * (validating a language tag's region subtag), because both values end up
 * passed to the peer package `@aceshooting/lyra-flags`' `flagUrl()`, which
 * naively interpolates its `code` argument into a `new URL('./flags/${code}.svg',
 * ...)` with no validation of its own -- an unvalidated value containing `../`
 * segments can escape the intended flags/ directory. Anything that doesn't
 * match this shape is treated the same as an unknown/missing flag.
 */
export const ALPHA2_RE = /^[a-z]{2}$/i;

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
 * A region subtag wins (`en-US` → `us`); otherwise the base language is mapped. The region subtag
 * isn't always in the second position -- a script subtag (e.g. `zh-Hant-TW`, ISO 15924, always 4
 * letters) can sit between the base language and the region, so every subtag after the base is
 * scanned for the first 2-letter alpha match rather than assuming it's always `parts[1]`.
 */
export function languageToCountry(language: string): string | undefined {
  const parts = language.toLowerCase().split(/[-_]/);
  const base = parts[0];
  const region = parts.slice(1).find((part) => ALPHA2_RE.test(part));
  if (region) return region;
  return LANGUAGE_TO_COUNTRY[base];
}

/**
 * The endonym of a BCP-47 language tag — the locale's name written in that locale itself
 * (`'fr'` → `français`, `'pt-BR'` → `português (Brasil)`), which is what a language switcher should
 * list so a reader who understands none of the current UI language can still find their own.
 *
 * Derived from `Intl.DisplayNames`, so no name table ships with the library and the result follows
 * the browser's own ICU data; the instance comes from the shared memoized cache, since a picker
 * renders one lookup per offered locale on every render pass. A tag with no display name resolves
 * to the tag itself, and so does a structurally invalid one — `Intl.DisplayNames` throws a
 * `RangeError` on those rather than falling back, and a language picker should degrade to showing
 * the raw tag rather than tearing down the render.
 *
 * Pair it with {@link languageToCountry} for the flag half of the same row.
 */
export function localeNativeName(tag: string): string {
  try {
    return getDisplayNames(tag, { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}
