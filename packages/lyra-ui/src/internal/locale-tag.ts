/**
 * Canonicalize BCP-47 tags while retaining one identity for the shipped Tagalog and Western
 * Punjabi catalogs across browser ICU versions. Older engines preserve tl/pnb where newer
 * engines return their CLDR primary-language aliases fil/lah. This never adds another catalog.
 * @internal
 */
export function canonicalizeLocaleTag(locale: string): string {
  const canonical = Intl.getCanonicalLocales(locale)[0]!;
  const language = canonical.split('-', 1)[0]!;
  const replacement = language === 'tl' ? 'fil' : language === 'pnb' ? 'lah' : language;
  return replacement + canonical.slice(language.length);
}
