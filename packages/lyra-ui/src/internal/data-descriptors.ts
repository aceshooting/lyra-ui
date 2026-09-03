/** Returned when a property is absent from the inspected object. */
export const MISSING_OWN_DATA_DESCRIPTOR = Symbol(
  'missing-own-data-descriptor'
);

/** Returned when descriptor reflection fails or the own property is accessor-backed. */
export const UNSAFE_OWN_DATA_DESCRIPTOR = Symbol('unsafe-own-data-descriptor');

/** An own descriptor whose value can be inspected without invoking a source accessor. */
interface OwnDataPropertyDescriptor {
  readonly configurable: boolean;
  readonly enumerable: boolean;
  readonly value: unknown;
  readonly writable: boolean;
}

/** Tri-state result for bounded, descriptor-safe projection code. */
export type OwnDataDescriptorResult =
  | OwnDataPropertyDescriptor
  | typeof MISSING_OWN_DATA_DESCRIPTOR
  | typeof UNSAFE_OWN_DATA_DESCRIPTOR;

/**
 * Reads only an own data descriptor. Missing properties remain distinguishable from properties
 * that cannot be inspected without invoking an accessor or crossing a hostile reflection trap.
 */
export function getOwnDataDescriptor(
  target: object,
  key: PropertyKey
): OwnDataDescriptorResult {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
  } catch {
    return UNSAFE_OWN_DATA_DESCRIPTOR;
  }
  if (!descriptor) return MISSING_OWN_DATA_DESCRIPTOR;
  if (!Object.hasOwn(descriptor, 'value')) return UNSAFE_OWN_DATA_DESCRIPTOR;
  return descriptor as OwnDataPropertyDescriptor;
}
