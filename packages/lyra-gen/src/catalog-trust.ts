/** Catalogs returned by `createCatalog`: frozen, so validation results against them may be reused. */
const createdCatalogs = new WeakSet<object>();

export function markCreatedCatalog<T extends object>(catalog: T): T {
  createdCatalogs.add(catalog);
  return catalog;
}

export const isCreatedCatalog = (catalog: object): boolean => createdCatalogs.has(catalog);
