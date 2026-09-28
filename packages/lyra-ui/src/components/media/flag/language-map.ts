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

/** ISO 3166-1 alpha-3 shape: exactly three ASCII letters, case-insensitive. Length alone
 *  disambiguates the two code spaces, so no explicit format hint is needed. */
export const ALPHA3_RE = /^[a-z]{3}$/i;

/**
 * The 249 officially-assigned ISO 3166-1 alpha-3 -> alpha-2 mappings, packed as fixed-width
 * 5-character records (3 for alpha-3, 2 for alpha-2) rather than an object literal.
 *
 * Public statistical sources (World Bank, UN, IMF, most open-data portals) key country records on
 * alpha-3, so without this every consumer plotting country data ships its own copy of this same
 * table. A `Record<string, string>` of 249 entries costs several KB of parsed object literal in a
 * component whose entire point is to stay small; this string is ~1.2 KB and is expanded into a Map
 * lazily, on the first alpha-3 lookup, so an app that only ever passes alpha-2 never pays for it.
 */
const ALPHA3_TO_ALPHA2_PACKED =
  'abwawafgafagoaoaiaaialaaxalbalandadareaeargararmamasmasataaqatftfatgagausauautatazeazbdibi' +
  'belbebenbjbesbqbfabfbgdbdbgrbgbhrbhbhsbsbihbablmblblrbyblzbzbmubmbolbobrabrbrbbbbrnbnbtnbt' +
  'bvtbvbwabwcafcfcancacckccchechchlclchncncivcicmrcmcodcdcogcgcokckcolcocomkmcpvcvcricrcubcu' +
  'cuwcwcxrcxcymkycypcyczeczdeudedjidjdmadmdnkdkdomdodzadzecuecegyegeriereshehespesesteeethet' +
  'finfifjifjflkfkfrafrfrofofsmfmgabgagbrgbgeogeggyggghaghgibgigingnglpgpgmbgmgnbgwgnqgqgrcgr' +
  'grdgdgrlglgtmgtgufgfgumguguygyhkghkhmdhmhndhnhrvhrhtihthunhuidnidimnimindiniotioirlieirnir' +
  'irqiqislisisrilitaitjamjmjeyjejorjojpnjpkazkzkenkekgzkgkhmkhkirkiknaknkorkrkwtkwlaolalbnlb' +
  'lbrlrlbylylcalclielilkalklsolsltultluxlulvalvmacmomafmfmarmamcomcmdamdmdgmgmdvmvmexmxmhlmh' +
  'mkdmkmlimlmltmtmmrmmmnememngmnmnpmpmozmzmrtmrmsrmsmtqmqmusmumwimwmysmymytytnamnanclncnerne' +
  'nfknfngangnicniniununldnlnornonplnpnrunrnzlnzomnompakpkpanpapcnpnperpephlphplwpwpngpgpolpl' +
  'priprprkkpprtptprypypsepspyfpfqatqareurerourorusrurwarwsausasdnsdsensnsgpsgsgsgsshnshsjmsj' +
  'slbsbsleslslvsvsmrsmsomsospmpmsrbrsssdssstpstsursrsvksksvnsisweseswzszsxmsxsycscsyrsytcatc' +
  'tcdtdtgotgthathtjktjtkltktkmtmtlstltontottotttuntnturtrtuvtvtwntwtzatzugaugukruaumiumuryuy' +
  'usausuzbuzvatvavctvcvenvevgbvgvirvivnmvnvutvuwlfwfwsmwsyemyezafzazmbzmzwezw';

let alpha3Lookup: Map<string, string> | undefined;

/**
 * The alpha-2 code for an ISO 3166-1 alpha-3 code, or `undefined` when it isn't one. Case
 * insensitive. Deliberately excludes user-assigned and withdrawn codes: a historical or defunct
 * state has no current flag to resolve, so it takes the component's unresolved path rather than
 * silently mapping to a successor state's flag.
 */
export function alpha3ToAlpha2(code: string): string | undefined {
  if (!ALPHA3_RE.test(code)) return undefined;
  if (!alpha3Lookup) {
    alpha3Lookup = new Map();
    for (let index = 0; index < ALPHA3_TO_ALPHA2_PACKED.length; index += 5) {
      alpha3Lookup.set(
        ALPHA3_TO_ALPHA2_PACKED.slice(index, index + 3),
        ALPHA3_TO_ALPHA2_PACKED.slice(index + 3, index + 5),
      );
    }
  }
  return alpha3Lookup.get(code.toLowerCase());
}

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
  nn: 'no',
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
  kk: 'kz',
  // Some Intl.Locale/ICU builds canonicalize `pnb` to `lah`; both forms should resolve consistently.
  lah: 'pk',
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
  am: 'et',
  bho: 'in',
  gu: 'in',
  ha: 'ng',
  ig: 'ng',
  jv: 'id',
  kn: 'in',
  ln: 'cd',
  ml: 'in',
  mr: 'in',
  my: 'mm',
  ne: 'np',
  om: 'et',
  or: 'in',
  pa: 'in',
  pcm: 'ng',
  pnb: 'pk',
  ps: 'af',
  sd: 'pk',
  su: 'id',
  sw: 'tz',
  te: 'in',
  tl: 'ph',
  uz: 'uz',
  yo: 'ng',
  zu: 'za',
  ca: 'es',
  lb: 'lu',
  fil: 'ph',
};

function mappedCountry(language: string): string | undefined {
  return Object.hasOwn(LANGUAGE_TO_COUNTRY, language)
    ? LANGUAGE_TO_COUNTRY[language]
    : undefined;
}

/**
 * The region a script subtag implies for its language when that differs from the region the bare
 * language implies (`zh-Hant` → `tw`, while `zh` → `cn`), from CLDR likely subtags. `undefined`
 * when the script adds no regional signal (`en-Latn`, `sr-Latn`) or the data is unavailable.
 */
function scriptImpliedRegion(locale: Intl.Locale): string | undefined {
  if (!locale.script) return undefined;
  const scriptRegion = locale.maximize().region;
  const languageRegion = new Intl.Locale(locale.language).maximize().region;
  return scriptRegion && ALPHA2_RE.test(scriptRegion) && scriptRegion !== languageRegion
    ? scriptRegion.toLowerCase()
    : undefined;
}

/**
 * Resolve a BCP-47-ish language tag to a flag country code. Numeric regions have no derived
 * country flag; provide an explicit country on the flag component when an application needs one.
 * A region subtag wins (`en-US` → `us`); otherwise the base language is mapped. The region subtag
 * isn't always in the second position -- a script subtag (e.g. `zh-Hant-TW`, ISO 15924, always 4
 * letters) can sit between the base language and the region, so every subtag after the base is
 * scanned for the first 2-letter alpha match rather than assuming it's always `parts[1]`. Base
 * language fallback accepts only the lookup table's own entries, never inherited object members.
 *
 * A region-less tag whose script implies a different likely region than its bare language does
 * (`zh-Hant` → `tw`, where `zh` → `cn`) takes that region instead of the table default, so
 * Traditional and Simplified Chinese never share one flag. The rule applies to every table
 * language, not only Chinese: `kk-Arab` (Kazakh as written in China) takes `cn` over `kz`. The
 * script only corrects a table default: a language with no table entry stays unresolved, and a
 * script that implies the language's own likely region (`en-Latn`) keeps the table's convention
 * (`gb`). Engines without `Intl.Locale` likely-subtags data fall back to the table default.
 */
export function languageToCountry(language: string): string | undefined {
  if (typeof language !== 'string') return undefined;
  const normalized = language.trim().replaceAll('_', '-');
  if (!normalized) return undefined;
  try {
    const locale = new Intl.Locale(normalized);
    // Numeric regions can name multiple countries (for example Latin America); no flag represents them.
    if (locale.region && /^\d{3}$/.test(locale.region)) return undefined;
    if (locale.region && ALPHA2_RE.test(locale.region)) return locale.region.toLowerCase();
    const mapped = mappedCountry(locale.language.toLowerCase());
    return mapped === undefined ? undefined : (scriptImpliedRegion(locale) ?? mapped);
  } catch {
    // Older engines or malformed input use the bounded structural fallback below.
  }
  const parts = normalized.toLowerCase().split('-').slice(0, 16);
  const base = parts[0]!;
  // A singleton in the first position starts a private-use tag (`x-ca`). It is not a language
  // subtag, so neither the following token nor a language-default lookup is meaningful.
  if (base.length === 1) return undefined;
  for (const part of parts.slice(1)) {
    if (!/^[a-z0-9]{1,8}$/.test(part)) break;
    // A singleton starts a Unicode extension or private-use sequence. Tokens after it are not
    // language-script-region fields (`en-u-ca-gregory` and `en-x-ca` must not become Canada).
    if (part.length === 1) break;
    if (/^\d{3}$/.test(part)) return undefined;
    if (ALPHA2_RE.test(part)) return part;
  }
  return mappedCountry(base);
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
