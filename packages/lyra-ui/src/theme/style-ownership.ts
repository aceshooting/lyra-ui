/** Reversible inline writes shared by the runtime and the pre-paint bootstrap. */
export interface OwnedStyleValue {
  before: string | null;
  priority: string;
  written: string | null;
  requested?: string;
}
export interface StyleOwnership {
  attributes: Map<string, OwnedStyleValue>;
  properties: Map<string, OwnedStyleValue>;
}

/**
 * Reads a bounded, data-only snapshot without invoking accessors or map overrides.
 * Keep this helper self-contained: the bootstrap embeds the same implementation.
 */
export function readStyleOwnership(raw: unknown): StyleOwnership | undefined {
  try {
    if (!raw || typeof raw !== 'object') return undefined;
    const data = (value: object, key: string): unknown => Object.getOwnPropertyDescriptor(value, key)?.value;
    const result: StyleOwnership = { attributes: new Map(), properties: new Map() };
    for (const kind of ['attributes', 'properties'] as const) {
      const source = data(raw, kind);
      let count = 0;
      Map.prototype.forEach.call(source, (value: unknown, name: unknown) => {
        // Two capped input maps, private mode branches, follow switches, and accent ramps.
        if (++count > 8192 || typeof name !== 'string' || name.length > 96 ||
          !(kind === 'attributes' ? /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/ : /^--(?:lr-theme-|_lr-)[a-z0-9-]+$/).test(name) ||
          !value || typeof value !== 'object') throw new TypeError('Invalid style ownership');
        const before = data(value, 'before');
        const written = data(value, 'written');
        const priority = data(value, 'priority');
        const requested = data(value, 'requested');
        if ((before !== null && typeof before !== 'string') || (written !== null && typeof written !== 'string') ||
          typeof priority !== 'string' || (requested !== undefined && typeof requested !== 'string')) {
          throw new TypeError('Invalid style ownership value');
        }
        result[kind].set(name, { before, written, priority, ...(requested === undefined ? {} : { requested }) });
      });
    }
    return result;
  } catch { return undefined; }
}
