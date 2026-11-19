/** Whether a value is a local-realm plain record or a null-prototype record. */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Like {@link isPlainRecord}, but also accepts a record from another realm (an iframe or a
 * structured clone): any object whose prototype is `null` or sits directly under a null prototype.
 * Theme tokens, the runtime snapshot guard and the GeoJSON `isRecord` deliberately differ (a
 * constructor-source check, accepting class instances, and accepting any non-array object).
 */
export function isCrossRealmPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  try {
    // Inside the guard: `Array.isArray` throws on a revoked proxy.
    if (Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  } catch {
    return false;
  }
}

/** Whether a value is a non-null object or function (the only values with properties to read). */
export function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/**
 * A non-null, non-array object that is safe to read keys from: a revoked Proxy (whose
 * `Array.isArray` throws) is rejected, while class instances and other-realm records are accepted.
 */
export function isSafeNonArrayObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  try {
    return !Array.isArray(value);
  } catch {
    return false;
  }
}

/** `Array.isArray` for caller data: an array from any realm, and `false` for a revoked proxy. */
export function isRuntimeArray(value: unknown): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

/**
 * Whether `new value()` is allowed, decided without running the candidate: constructing `Object`
 * with `value` as `new.target` only reads its `prototype`. A revoked or throwing proxy is rejected.
 */
export function isConstructor(value: unknown): value is new (...args: never[]) => object {
  if (typeof value !== 'function') return false;
  try {
    return Reflect.construct(Object, [], value) !== null;
  } catch {
    return false;
  }
}
