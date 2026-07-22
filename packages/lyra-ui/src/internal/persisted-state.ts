/**
 * Shared `localStorage` persistence for components that expose a `storage-key` attribute.
 *
 * Every access is guarded twice: once around the `localStorage` call itself (the whole API throws,
 * not just returns null, in Safari private browsing, in a sandboxed iframe without
 * `allow-same-origin`, and when a site-data policy blocks storage), and once around
 * `JSON.parse`/`JSON.stringify`. Persistence is a convenience, never a correctness requirement, so
 * both functions fail silently rather than surfacing an error into a Lit lifecycle callback --
 * throwing out of `willUpdate()`/`updated()` would break rendering over a storage quota.
 */

/**
 * Reads a JSON value previously written by `writePersistedState()` for `key`, or `null` if the key
 * is unset, storage is unavailable, the key is missing, the stored text is malformed, or the parsed
 * value fails `isValid`.
 *
 * `isValid` is a type guard, so callers get a typed result with no separate cast, and a stored value
 * whose shape has drifted (an older release's format, or another script writing the same key) is
 * rejected instead of being trusted.
 */
export function readPersistedState<T>(
  key: string | undefined,
  isValid: (parsed: unknown) => parsed is T,
): T | null {
  if (!key) return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    /* localStorage unavailable (private browsing, sandboxed iframe, etc.) */
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValid(parsed) ? parsed : null;
  } catch {
    /* ignore malformed persisted state */
    return null;
  }
}

/**
 * Writes `value` as JSON under `key`. A no-op for an unset key -- persistence is opt-in, so a
 * component with no `storage-key` must not touch storage at all. Any failure (quota exceeded,
 * private browsing, sandboxed iframe, a value that cannot be serialized) is silently ignored.
 */
export function writePersistedState(key: string | undefined, value: unknown): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore persistence failures (e.g. quota exceeded, private browsing) */
  }
}
