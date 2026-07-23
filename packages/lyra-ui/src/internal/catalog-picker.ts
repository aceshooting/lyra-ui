/** Shared behavior for catalog-backed pickers with string shorthand and stale-value retention. */
export interface CatalogEntry {
  id: string;
  label: string;
}

export type DisplayCatalogEntry<T extends CatalogEntry> = T & { synthetic: boolean };

export function normalizeCatalog<T extends CatalogEntry>(
  catalog: readonly (string | T)[] | undefined,
): T[] {
  return (catalog ?? []).map((entry) =>
    typeof entry === 'string' ? ({ id: entry, label: entry } as T) : entry,
  );
}

export function withSyntheticCatalogValue<T extends CatalogEntry>(
  catalog: readonly T[],
  value: string,
): DisplayCatalogEntry<T>[] {
  const entries = catalog.map((entry) => ({ ...entry, synthetic: false }));
  if (catalog.length && value && !catalog.some((entry) => entry.id === value)) {
    entries.push({ id: value, label: value, synthetic: true } as DisplayCatalogEntry<T>);
  }
  return entries;
}

export function filterCatalogEntries<T>(
  entries: readonly T[],
  query: string,
  locale: string,
  fields: (entry: T) => readonly string[],
): T[] {
  const normalized = query.trim().toLocaleLowerCase(locale);
  if (!normalized) return [...entries];
  return entries.filter((entry) =>
    fields(entry).some((value) => value.toLocaleLowerCase(locale).includes(normalized)),
  );
}

