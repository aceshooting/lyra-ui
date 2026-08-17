const GLOBAL_ATTRIBUTE_EXEMPTIONS = new Set([
  'id',
  'hidden',
  'inert',
  'tabindex',
  'title',
  'role',
  'part',
  'exportparts',
  'is',
  'popover',
  'translate',
  'spellcheck',
  'autocapitalize',
  'autofocus',
  'contenteditable',
  'draggable',
  'enterkeyhint',
  'inputmode',
  'nonce',
  'accesskey',
  'itemid',
  'itemprop',
  'itemref',
  'itemscope',
  'itemtype',
]);

/** `class`/`style`/`slot`/`lang`/`dir`/`aria-label`/`aria-describedby` are not exempted here --
 *  `LyraElement`'s own `REACTIVE_HOST_ATTRIBUTES`/`DIRECTION_HOST_ATTRIBUTES` already merge them
 *  into every component's `observedAttributes`, so they never reach this exemption check at all. */
function isExemptAttribute(name: string): boolean {
  return (
    name.startsWith('data-') ||
    name.startsWith('aria-') ||
    GLOBAL_ATTRIBUTE_EXEMPTIONS.has(name)
  );
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0)
  );
  for (let i = 0; i < rows; i++) distances[i]![0] = i;
  for (let j = 0; j < cols; j++) distances[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i]![j] = Math.min(
        distances[i - 1]![j]! + 1,
        distances[i]![j - 1]! + 1,
        distances[i - 1]![j - 1]! + cost
      );
    }
  }
  return distances[rows - 1]![cols - 1]!;
}

const SUGGESTION_MAX_DISTANCE = 3;

function closestObservedAttribute(
  name: string,
  observed: readonly string[]
): string | undefined {
  let best: string | undefined;
  let bestDistance = SUGGESTION_MAX_DISTANCE + 1;
  for (const candidate of observed) {
    const distance = levenshteinDistance(name, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= SUGGESTION_MAX_DISTANCE ? best : undefined;
}

type LitWarningGlobal = { litIssuedWarnings?: Set<string> };

/** Piggybacks on Lit's own dev-mode signal (`@lit/reactive-element`'s `development` build sets
 *  this global when a consumer's bundler resolves Lit into dev mode) rather than shipping a
 *  separate lyra-ui dev/prod build -- see
 *  docs/superpowers/specs/2026-08-17-dev-mode-unknown-attribute-warning-design.md. */
function litDevWarnings(): Set<string> | undefined {
  return (globalThis as LitWarningGlobal).litIssuedWarnings;
}

/**
 * Dev-mode-only: warns once per (tag, attribute-name) when `host` carries an attribute that
 * isn't in `observedAttributes` and isn't in the always-exempt global/data/aria set. No-op when
 * Lit's own dev-mode signal isn't present (production, or a dev environment where Lit itself
 * isn't in dev mode).
 */
export function warnUnknownAttributes(
  host: Element,
  observedAttributes: readonly string[]
): void {
  const warnings = litDevWarnings();
  if (!warnings) return;
  const observedSet = new Set(observedAttributes);
  for (const name of host.getAttributeNames()) {
    if (observedSet.has(name) || isExemptAttribute(name)) continue;
    const key = `lyra-unknown-attribute:${host.localName}:${name}`;
    if (warnings.has(key)) continue;
    warnings.add(key);
    const suggestion = closestObservedAttribute(name, observedAttributes);
    console.warn(
      suggestion
        ? `<${host.localName}>: unknown attribute '${name}' — did you mean '${suggestion}'?`
        : `<${host.localName}>: unknown attribute '${name}'`
    );
  }
}
