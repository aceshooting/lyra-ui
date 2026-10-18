import { getOwnDataDescriptor, UNSAFE_OWN_DATA_DESCRIPTOR } from './data-descriptors.js';

/** Shared clone-owned row shape used by the international selectors. */
export interface SelectionCatalogEntry {
  readonly code: string;
  readonly label?: string;
  readonly symbol?: string;
  readonly group?: string;
  readonly disabled?: boolean;
}

export interface SelectionCatalogRow extends SelectionCatalogEntry {
  readonly label: string;
  readonly searchText: string;
}

/** Source rows any catalog-backed picker inspects: the international selectors here, and the
 * model/voice pickers through `normalizeCatalog()` in `catalog-picker.ts`. */
export const CATALOG_ROW_LIMIT = 1_024;

/** Source positions excluded by the catalog inspection ceiling. Invalid or duplicate rows
 * inside the inspected prefix do not contribute to omitted. */
export interface SelectionCatalogTruncation {
  readonly source: number;
  readonly retained: number;
  readonly omitted: number;
}

const acceptAnyCode = (_code: string) => true;
const admittedCatalogs = new WeakMap<object, {
  normalize: (code: string) => string;
  accepts: (code: string) => boolean;
  truncation?: SelectionCatalogTruncation;
}>();

/** Count-only original-input loss retained with an admitted catalog snapshot. */
export function selectionCatalogTruncation(snapshot: unknown): SelectionCatalogTruncation | undefined {
  return snapshot !== null && typeof snapshot === 'object' ? admittedCatalogs.get(snapshot)?.truncation : undefined;
}

/** A bounded catalog boundary that never evaluates caller-owned property getters. */
export function snapshotSelectionCatalog(
  source: unknown,
  normalize: (code: string) => string,
  accepts: (code: string) => boolean = acceptAnyCode,
): readonly SelectionCatalogEntry[] | undefined {
  if (source == null) return undefined;
  try { if (!Array.isArray(source)) return Object.freeze([]); }
  catch { return Object.freeze([]); }
  const admitted = admittedCatalogs.get(source as object);
  if (admitted?.normalize === normalize && admitted.accepts === accepts) return source as readonly SelectionCatalogEntry[];
  const lengthDescriptor = getOwnDataDescriptor(source as object, 'length');
  const length = typeof lengthDescriptor === 'symbol' ? undefined : lengthDescriptor.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return Object.freeze([]);
  const result: SelectionCatalogEntry[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < Math.min(length, CATALOG_ROW_LIMIT); index++) {
    const itemDescriptor = getOwnDataDescriptor(source as object, String(index));
    if (typeof itemDescriptor === 'symbol') continue;
    const item = itemDescriptor.value;
    let rawCode: unknown = item;
    const fields: Record<string, unknown> = {};
    if (typeof item !== 'string') {
      if (!item || typeof item !== 'object') continue;
      const codeDescriptor = getOwnDataDescriptor(item, 'code');
      if (typeof codeDescriptor === 'symbol') continue;
      rawCode = codeDescriptor.value;
      let unsafe = false;
      for (const key of ['label', 'symbol', 'group', 'disabled']) {
        const descriptor = getOwnDataDescriptor(item, key);
        if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) { unsafe = true; break; }
        if (typeof descriptor !== 'symbol') fields[key] = descriptor.value;
      }
      if (unsafe) continue;
    }
    if (typeof rawCode !== 'string') continue;
    const code = normalize(rawCode);
    if (!code || code.length > 256 || !accepts(code) || seen.has(code)) continue;
    if (['label', 'symbol', 'group'].some((key) => fields[key] !== undefined && typeof fields[key] !== 'string')) continue;
    if (fields['disabled'] !== undefined && typeof fields['disabled'] !== 'boolean') continue;
    seen.add(code);
    result.push(Object.freeze({
      code,
      ...(fields['label'] === undefined ? {} : { label: fields['label'] as string }),
      ...(fields['symbol'] === undefined ? {} : { symbol: fields['symbol'] as string }),
      ...(fields['group'] === undefined ? {} : { group: fields['group'] as string }),
      ...(fields['disabled'] === undefined ? {} : { disabled: fields['disabled'] as boolean }),
    }));
  }
  const snapshot = Object.freeze(result);
  const originalLoss = admitted?.truncation;
  const omitted = originalLoss?.omitted ?? Math.max(0, length - CATALOG_ROW_LIMIT);
  const truncation = omitted > 0 ? Object.freeze({
    source: originalLoss?.source ?? length,
    retained: snapshot.length,
    omitted,
  }) : undefined;
  admittedCatalogs.set(snapshot, { normalize, accepts, truncation });
  return snapshot;
}

export function normalizeSelectionValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
