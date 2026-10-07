/** Returned when a property is absent from the inspected object. */
export const MISSING_OWN_DATA_DESCRIPTOR = Symbol(
  'missing-own-data-descriptor'
);

/** Returned when descriptor reflection fails or the own property is accessor-backed. */
export const UNSAFE_OWN_DATA_DESCRIPTOR = Symbol('unsafe-own-data-descriptor');

/** Whether a value can carry own or inherited property descriptors, including callable objects. */
export function isObjectValue(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

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

const MAX_INHERITED_DESCRIPTOR_PROTOTYPES = 100;

/** Resolves an own or inherited property descriptor without invoking accessors. */
export function getInheritedPropertyDescriptor(
  target: object,
  key: PropertyKey
): PropertyDescriptor | undefined {
  let current: object | null = target;
  for (let depth = 0; current && depth < MAX_INHERITED_DESCRIPTOR_PROTOTYPES; depth += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, key);
    } catch {
      return undefined;
    }
    if (descriptor) return descriptor;
    try {
      current = Object.getPrototypeOf(current) as object | null;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

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

/** Read an own data value without invoking an accessor. Missing and unsafe descriptors yield
 * `undefined`; callers needing that distinction should use `getOwnDataDescriptor()` directly. */
export function readOwnDataValue(target: object, key: PropertyKey): unknown | undefined {
  const descriptor = getOwnDataDescriptor(target, key);
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined
    : descriptor.value;
}

/** Bound and freeze descriptor-safe array projections. Validation runs before reserving an
 * identity, so a malformed duplicate cannot hide a later valid row. */
export function projectFrozenRows<T>(
  value: unknown,
  project: (entry: unknown, index: number) => T | undefined,
  limit: number,
  empty: readonly T[],
  identity?: (row: T) => string
): readonly T[] {
  try {
    if (!Array.isArray(value)) return empty;
    const length = getOwnDataDescriptor(value, 'length');
    if (length === MISSING_OWN_DATA_DESCRIPTOR || length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' || !Number.isSafeInteger(length.value) || length.value < 0)
      return empty;
    const rows: T[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < Math.min(length.value, limit); index += 1) {
      const descriptor = getOwnDataDescriptor(value, String(index));
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
      const row = project(descriptor.value, index);
      if (row === undefined) continue;
      if (identity) {
        const id = identity(row);
        if (seen.has(id)) continue;
        seen.add(id);
      }
      rows.push(row);
    }
    return Object.freeze(rows);
  } catch {
    return empty;
  }
}

/** A bounded frozen string list. Sparse/non-string entries can be skipped or rejected by the
 * caller's contract; unsafe descriptors always reject the whole list. */
export function projectStringList(
  value: unknown,
  limit: number,
  options: { readonly strict?: boolean; readonly rejectOversized?: boolean } = {}
): readonly string[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = getOwnDataDescriptor(value, 'length');
    if (length === MISSING_OWN_DATA_DESCRIPTOR || length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' || !Number.isSafeInteger(length.value) || length.value < 0 ||
      (options.rejectOversized && length.value > limit)) return undefined;
    const strings: string[] = [];
    for (let index = 0; index < Math.min(length.value, limit); index += 1) {
      const descriptor = getOwnDataDescriptor(value, String(index));
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) return undefined;
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || typeof descriptor.value !== 'string') {
        if (options.strict) return undefined;
        continue;
      }
      strings.push(descriptor.value);
    }
    return Object.freeze(strings);
  } catch {
    return undefined;
  }
}

const FUNCTION_TO_STRING = Function.prototype.toString;
const OBJECT_CONSTRUCTOR_SOURCE = FUNCTION_TO_STRING.call(Object);

/** Accept plain/null-prototype records across realms without invoking constructor accessors. */
export function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    if (Object.getPrototypeOf(prototype) !== null) return false;
    const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    if (!constructor || !Object.hasOwn(constructor, 'value') || typeof constructor.value !== 'function') return false;
    const declaredPrototype = Object.getOwnPropertyDescriptor(constructor.value, 'prototype');
    return Boolean(declaredPrototype && Object.hasOwn(declaredPrototype, 'value') && declaredPrototype.value === prototype &&
      FUNCTION_TO_STRING.call(constructor.value) === OBJECT_CONSTRUCTOR_SOURCE);
  } catch { return false; }
}

/** Descriptor-only array length admission; callers classify the array once before this read. */
export function readOwnArrayLength(value: object): number | undefined {
  const descriptor = getOwnDataDescriptor(value, 'length');
  return descriptor !== MISSING_OWN_DATA_DESCRIPTOR && descriptor !== UNSAFE_OWN_DATA_DESCRIPTOR &&
    typeof descriptor.value === 'number' && Number.isSafeInteger(descriptor.value) && descriptor.value >= 0
    ? descriptor.value : undefined;
}
