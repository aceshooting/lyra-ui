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
 *  separate lyra-ui dev/prod build. */
function litDevWarnings(): Set<string> | undefined {
  return (globalThis as LitWarningGlobal).litIssuedWarnings;
}

/** Emits a development diagnostic when Lit's development signal is present. Callers retain
 * their own bounded deduplication state when warnings belong to one document generation. */
export function devWarn(message: string): void {
  if (litDevWarnings()) console.warn(message);
}

/**
 * Dev-mode-only: emits `message` at most once per `key` for the page. Shares the exact gate and
 * dedupe store `warnUnknownAttributes` uses below, so a diagnostic added by a component behaves
 * like the attribute diagnostic: silent in production, silent when Lit itself is not in dev mode,
 * and never repeated for the same key however many instances exist.
 */
export function devWarnOnce(key: string, message: string): void {
  const warnings = litDevWarnings();
  if (!warnings) return;
  if (warnings.has(key)) return;
  warnings.add(key);
  console.warn(message);
}

/**
 * Dev-mode-only: warns once per (tag, attribute-name) when `host` carries an attribute that
 * isn't in `observedAttributes`, isn't in `knownUnobservedAttributes`, and isn't in the
 * always-exempt global/data/aria set. No-op when Lit's own dev-mode signal isn't present
 * (production, or a dev environment where Lit itself is not in dev mode).
 *
 * `knownUnobservedAttributes` exists because "not observed" is not the same as "not ours". Two
 * shapes of genuinely-owned attribute never reach `observedAttributes`:
 *
 * - **Self-reflected read-only state.** `<lr-animated-image>` publishes its live `playing` state
 *   with `toggleAttribute('playing', ...)`, `<lr-menu-item>` does the same for `submenu-open`,
 *   `<lr-app-rail>` for its derived `mode`. Nothing observes them because setting them from
 *   markup means nothing -- they are output, not input. Left undeclared, a component reports its
 *   *own* attribute as unknown, in every consumer app, the moment that state turns on.
 * - **CSS-only public attributes.** `<lr-page>`'s documented `disable-sticky` is consumed purely
 *   by `:host([disable-sticky~="header"])` selectors, so it needs no reactive property. Left
 *   undeclared, correct authored markup draws a warning telling the author it is wrong.
 *
 * Both cases are false positives against real, documented API, which is corrosive in a way a
 * missed warning is not: a diagnostic that cries wolf about a component's own output teaches
 * consumers to tune out the ones that matter.
 */
export function warnUnknownAttributes(
  host: Element,
  observedAttributes: readonly string[],
  knownUnobservedAttributes: readonly string[] = []
): void {
  const warnings = litDevWarnings();
  if (!warnings) return;
  const observedSet = new Set([...observedAttributes, ...knownUnobservedAttributes]);
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
