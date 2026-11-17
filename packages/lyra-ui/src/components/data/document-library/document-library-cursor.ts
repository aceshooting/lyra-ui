import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

/** Cursor inputs are admitted atomically; partial lists cannot describe the host's query. */
export function cursorIds(value: unknown, maximum: number, current: () => boolean): readonly string[] {
  const field = (key: PropertyKey): unknown => {
    if (!current()) throw new TypeError('Obsolete cursor input');
    const descriptor = getOwnDataDescriptor(value as object, key);
    if (!current()) throw new TypeError('Obsolete cursor input');
    if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new TypeError('Invalid cursor list');
    return descriptor.value;
  };
  if (!Array.isArray(value)) throw new TypeError('Invalid cursor list');
  const length = field('length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 10_000) throw new RangeError('Cursor list limit');
  const ids = new Set<string>();
  let units = 0;
  for (let index = 0; index < length; index++) {
    const id = field(String(index));
    if (typeof id !== 'string' || !id.trim() || id.length > 65_536) throw new TypeError('Invalid cursor key');
    if (!ids.has(id)) {
      units += id.length;
      if (units > 2_000_000) throw new RangeError('Cursor input text limit');
      ids.add(id);
      if (ids.size > maximum) throw new RangeError('Cursor unique-key limit');
    }
  }
  return Object.freeze([...ids]);
}

/** Admits bounded query text and detached, deduplicated tags before provider dispatch. */
export function cursorQueryText(searchTerm: unknown, tags: unknown, current: () => boolean) {
  if (typeof searchTerm !== 'string' || searchTerm.length > 65_536) throw new TypeError('Invalid cursor search');
  const tagFilter = cursorIds(tags, 500, current);
  if (tagFilter.reduce((units, tag) => units + tag.length, searchTerm.length) > 2_000_000) throw new RangeError('Cursor query text limit');
  return Object.freeze({ searchTerm, tagFilter });
}
