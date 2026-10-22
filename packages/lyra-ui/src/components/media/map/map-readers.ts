import { getOwnDataDescriptor, MISSING_OWN_DATA_DESCRIPTOR, UNSAFE_OWN_DATA_DESCRIPTOR } from '../../../internal/data-descriptors.js';

/** An own data property of a caller or peer value, read without invoking accessors. */
export function mapOwnValue(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined;
  const descriptor = getOwnDataDescriptor(value, key);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ? undefined : descriptor.value;
}

/** A frozen finite `[longitude, latitude]` read from a peer `{ lng, lat }` value. */
export function mapCoordinates(value: unknown): readonly [number, number] | undefined {
  const lng = mapOwnValue(value, 'lng'), lat = mapOwnValue(value, 'lat');
  return typeof lng === 'number' && Number.isFinite(lng) && typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    ? Object.freeze([lng, lat] as const) : undefined;
}

/** A rendered box size key; observers compare it so their initial notification is not a resize. */
export function renderedSizeKey(element: Element): string {
  const box = element.getBoundingClientRect();
  return `${box.width}x${box.height}`;
}
