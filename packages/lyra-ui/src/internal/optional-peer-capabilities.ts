/**
 * The sanitizer capability Lyra consumes from DOMPurify.
 *
 * This owned structural type keeps optional peer declarations out of Lyra's
 * public declaration graph while still requiring loaders to validate the
 * method they call.
 */
export interface HtmlSanitizer {
  sanitize(input: string, options?: Record<string, unknown>): unknown;
}

/** Returns an ESM default export when present, otherwise the original value. */
export function unwrapOptionalPeerDefault(value: unknown): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return value;
  return 'default' in value ? value.default : value;
}

/**
 * Selects an optional peer by capability, preferring the module namespace before its default.
 *
 * Some CJS/ESM interop wrappers expose both shapes. The namespace may carry the real named API
 * while an unrelated or stale `default` is also present, so property presence alone is not enough
 * to choose safely.
 */
export function resolveOptionalPeerCapability<Capability>(
  value: unknown,
  isCapability: (candidate: unknown) => candidate is Capability,
): Capability | null {
  if (isCapability(value)) return value;
  const defaultExport = unwrapOptionalPeerDefault(value);
  return isCapability(defaultExport) ? defaultExport : null;
}

/** Narrows an unknown optional-peer value to the sanitizer capability Lyra uses. */
export function isHtmlSanitizer(value: unknown): value is HtmlSanitizer {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'sanitize' in value &&
    typeof value.sanitize === 'function'
  );
}
