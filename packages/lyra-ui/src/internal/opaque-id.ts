let counter = 0;

/**
 * A collision-resistant opaque identifier, optionally prefixed. Uses `crypto.randomUUID()` when
 * available, then `crypto.getRandomValues()`, then a counter plus `Math.random()`; it never
 * throws, including on insecure origins where `randomUUID` is undefined. Not a security token.
 */
export function opaqueId(prefix = ''): string {
  const cryptoApi = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  let body: string | undefined;
  try {
    if (typeof cryptoApi?.randomUUID === 'function') body = cryptoApi.randomUUID();
    else if (typeof cryptoApi?.getRandomValues === 'function') {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      body = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    body = undefined;
  }
  if (body === undefined) {
    counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
    body = `${counter.toString(36)}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
  return prefix + body;
}
