const scopes = new WeakMap(), records = new WeakMap(), issuedHooks = new WeakSet();
const unqualified = Object.freeze({ status: 'unqualified' }), refused = Object.freeze({ status: 'refused' });
const object = value => value !== null && (typeof value === 'object' || typeof value === 'function');
const unavailable = () => { throw new TypeError('Native terrain authority unavailable.'); };
const live = record => record && !record.closed && !record.revoked && scopes.get(record.gl) === record;

/** Scopes the exact synchronous native callback without inspecting its result. */
export function withNativeTerrainHookScope(gl, hook, invoke) {
  if (!object(gl) || hook !== undefined && typeof hook !== 'function' || typeof invoke !== 'function') unavailable();
  const previous = scopes.get(gl);
  if (previous) previous.revoked = true;
  const record = { gl, hook, previous, closed: false, revoked: false, result: undefined };
  if (hook !== undefined) {
    issuedHooks.add(hook);
    const authority = Object.freeze(Object.create(null));
    records.set(authority, record);
    record.result = Object.freeze({ status: 'admitted', authority });
  }
  scopes.set(gl, record);
  try { return invoke(); }
  finally {
    record.closed = true;
    if (previous) scopes.set(gl, previous); else scopes.delete(gl);
  }
}

/** Distinguishes an unissued peer hook from an invalid native callback scope. */
export function captureNativeTerrainAuthority(gl, hook) {
  if (hook === undefined) return unqualified;
  if (!object(gl) || typeof hook !== 'function') return refused;
  const record = scopes.get(gl);
  if (live(record) && record.hook === hook) return record.result;
  return record || issuedHooks.has(hook) ? refused : unqualified;
}

/** Verifies identity only; callers must separately bind their closed operation record. */
export function assertNativeTerrainAuthority(authority, gl, hook) {
  const record = object(authority) ? records.get(authority) : undefined;
  if (!live(record) || record.gl !== gl || record.hook !== hook) unavailable();
}
