/** Internal, non-configurable safety ceilings for declarative widget resolution. */
export const WIDGET_MAX_DEPTH = 32;
export const WIDGET_MAX_NODES = 5000;
export const WIDGET_MAX_PROPS_PER_NODE = 100;
export const WIDGET_MAX_WARNINGS = 100;

function decodePointerSegment(raw: string): string | undefined {
  let decoded = '';
  for (let index = 0; index < raw.length; index++) {
    const character = raw[index]!;
    if (character !== '~') {
      decoded += character;
      continue;
    }
    const escaped = raw[++index];
    if (escaped === '0') decoded += '~';
    else if (escaped === '1') decoded += '/';
    else return undefined;
  }
  return decoded;
}

function canonicalArrayIndex(segment: string): number | undefined {
  if (!/^(?:0|[1-9][0-9]*)$/.test(segment)) return undefined;
  const index = Number(segment);
  return Number.isSafeInteger(index) ? index : undefined;
}

/** Resolves an RFC 6901 pointer without accepting noncanonical array-index spellings. */
export function readWidgetPointer(root: unknown, path: string): unknown {
  if (path === '') return root;
  if (!path.startsWith('/')) return undefined;
  let current = root;
  for (const raw of path.slice(1).split('/')) {
    const segment = decodePointerSegment(raw);
    if (segment === undefined) return undefined;
    if (
      segment === '__proto__' ||
      segment === 'prototype' ||
      segment === 'constructor'
    ) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = canonicalArrayIndex(segment);
      if (index === undefined || index >= current.length) return undefined;
      current = current[index];
    } else if (
      current &&
      typeof current === 'object' &&
      Object.hasOwn(current, segment)
    ) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}
