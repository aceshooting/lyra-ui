// Factory ownership is kept outside the public registry module so its export surface stays fixed.
const factorySources = new WeakMap<object, ReadonlyMap<string, unknown>>();

/** @internal Registers only the immutable factory wrapper's inaccessible native backing. */
export function rememberDocumentRendererRegistry(
  registry: object,
  entries: ReadonlyMap<string, unknown>,
): void {
  factorySources.set(registry, entries);
}

/** @internal Unwraps known factory handles before the normal bounded collection snapshot. */
export function documentRendererRegistrySource(value: unknown): unknown {
  return value !== null && typeof value === 'object'
    ? factorySources.get(value) ?? value
    : value;
}
