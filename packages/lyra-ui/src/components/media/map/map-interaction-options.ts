import { getOwnDataDescriptor, isPlainDataRecord, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

export interface LyraMapInteractionOptions { readonly interactive?: boolean; readonly priority?: number; }
export interface LyraMapBasemapInteraction extends LyraMapInteractionOptions { readonly layerId: string; }
export interface CanonicalMapInteraction { readonly interactive: boolean; readonly priority: number; }
const OFF = Object.freeze({ interactive: false, priority: 0 });
/** Invalid explicit interaction options cannot accidentally enable a query target. */
export function projectMapInteractionOptions(value: object): CanonicalMapInteraction {
  const enabled = getOwnDataDescriptor(value, 'interactive'), priority = getOwnDataDescriptor(value, 'priority');
  if (enabled === UNSAFE_OWN_DATA_DESCRIPTOR || priority === UNSAFE_OWN_DATA_DESCRIPTOR) return OFF;
  const interactive = enabled === MISSING_OWN_DATA_DESCRIPTOR ? undefined : enabled.value;
  const rank = priority === MISSING_OWN_DATA_DESCRIPTOR ? undefined : priority.value;
  if (interactive !== undefined && typeof interactive !== 'boolean' || rank !== undefined &&
    (typeof rank !== 'number' || !Number.isFinite(rank) || Math.abs(rank) > 1000000)) return OFF;
  return Object.freeze({ interactive: interactive !== false, priority: typeof rank === 'number' ? rank : 0 });
}
export function projectMapBasemapInteractions(value: unknown): readonly (CanonicalMapInteraction & { readonly layerId: string })[] | undefined {
  try {
    if (value === undefined || value === null) return Object.freeze([]);
    if (!Array.isArray(value)) return undefined;
    const count = getOwnDataDescriptor(value, 'length');
    if (typeof count !== 'object' || typeof count.value !== 'number' || count.value > 4096) return undefined;
    const result: (CanonicalMapInteraction & { readonly layerId: string })[] = [], seen = new Set<string>();
    for (let index = 0; index < count.value; index++) {
      const item = getOwnDataDescriptor(value, String(index)); if (typeof item !== 'object' || !isPlainDataRecord(item.value)) return undefined;
      const id = getOwnDataDescriptor(item.value, 'layerId');
      if (typeof id !== 'object' || typeof id.value !== 'string' || !id.value.trim() || id.value.length > 1024 || seen.has(id.value)) return undefined;
      seen.add(id.value); result.push(Object.freeze({ layerId: id.value, ...projectMapInteractionOptions(item.value) }));
    }
    return Object.freeze(result);
  } catch { return undefined; }
}
