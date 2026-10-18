import { resolveIntlLocale } from './intl-cache.js';

/** Locale-aware, accent-insensitive search text. */
export function foldSearchText(text: string, locale: string): string {
  return text.toLocaleLowerCase(resolveIntlLocale(locale)).normalize('NFKD').replace(/\p{M}/gu, '');
}

/** Prepare the query once before scanning a folded corpus. */
export function prepareNeedle(text: string, locale: string): string {
  return foldSearchText(text.trim(), locale);
}

/** Memoizes a folded corpus for immutable entry arrays. Replace the array when entries change. */
export function createHaystackMemo<T>(fold: (entry: T, locale: string) => string):
(entries: readonly T[], locale: string) => readonly string[] {
  const cache = new WeakMap<readonly T[], { locale: string; values: readonly string[] }>();
  return (entries, locale) => {
    const previous = cache.get(entries);
    if (previous?.locale === locale) return previous.values;
    const values = entries.map(entry => fold(entry, locale));
    cache.set(entries, { locale, values });
    return values;
  };
}
