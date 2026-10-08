import { devWarnOnce, litDevWarnings } from './dev-warning.js';
import { DOCUMENT_TOKEN_SCOPE_SELECTOR, LAYER_CONSUMED_INPUTS } from './document-tokens.generated.js';
import { foreignLyraTokenLayer, hasLyraTokens } from './document-tokens.js';
export { devWarn, devWarnOnce, deprecationWarningKey, warnDeprecatedUsage, type LyraDeprecatedUsageKind } from './dev-warning.js';

/**
 * Structural view of the `protected static knownUnobservedAttributes` a component may declare for
 * attributes it owns without observing -- host state it reflects onto itself as output
 * (`<lr-animated-image playing>`), and documented public attributes consumed only by
 * `:host([attr])` selectors (`<lr-page disable-sticky="header">`).
 *
 * Declaring it keeps the dev-mode unknown-attribute diagnostic from reporting a component's own
 * API as a mistake, while leaving it armed for everything else -- do not use it to silence a
 * warning about an attribute a consumer really did get wrong, which is the diagnostic's whole job.
 */
interface KnownUnobservedAttributeHost {
  knownUnobservedAttributes: readonly string[];
}

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

/**
 * Framework-owned attributes: written by a host framework's renderer, never by the app author,
 * and never something a Lyra component could react to. Decided per-framework, not with a blanket
 * underscore or dash rule, so a genuine typo (`_foo`, `ng-reflectx`) keeps warning:
 *
 * - `_ngcontent-*` / `_nghost-*` -- Angular's emulated view encapsulation writes these as pure CSS
 *   scoping markers on every element inside/hosting a component using the (default) `Emulated`
 *   encapsulation mode, custom elements included. The id suffix shape changed across Angular
 *   versions (`_ngcontent-c0` pre-Ivy-stable, `_ngcontent-ng-c1234567890` current), so the
 *   exemption matches the stable prefix, not the suffix.
 * - `ng-reflect-*` -- Angular's dev-mode-only reflection of a bound `@Input()`'s last value back
 *   onto the DOM (for the dev tools/debugger), one attribute per input, present only when Angular
 *   itself is not built for production (`ngDevMode` true). Prefix-exempt: the suffix is the
 *   kebab-cased input name, which varies per binding.
 * - `ng-version` -- set once, verbatim, on an Angular application's root element by
 *   `bootstrapApplication`/`bootstrapModule`. Exact-match, not a prefix: unlike the two above it
 *   is a single fixed attribute, not a per-input family.
 * - Vue's scoped-style marker (`data-v-<hash>`) needs no entry here -- it already matches the
 *   `data-*` prefix below.
 * - Svelte's scoped-style mechanism writes a generated class (`svelte-<hash>`) onto `class`, never
 *   a new attribute, so there is nothing to exempt for it. Same for React, which manages custom
 *   element properties/attributes directly with no framework-owned attribute of its own.
 */
const FRAMEWORK_ATTRIBUTE_EXACT = new Set(['ng-version']);
const FRAMEWORK_ATTRIBUTE_PREFIXES = ['_ngcontent-', '_nghost-', 'ng-reflect-'];

function isFrameworkOwnedAttribute(name: string): boolean {
  return (
    FRAMEWORK_ATTRIBUTE_EXACT.has(name) ||
    FRAMEWORK_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

/** `class`/`style`/`slot`/`lang`/`dir`/`aria-label`/`aria-describedby` are not exempted here --
 *  `LyraElement`'s own `REACTIVE_HOST_ATTRIBUTES`/`DIRECTION_HOST_ATTRIBUTES` already merge them
 *  into every component's `observedAttributes`, so they never reach this exemption check at all. */
function isExemptAttribute(name: string): boolean {
  return (
    name.startsWith('data-') ||
    name.startsWith('aria-') ||
    GLOBAL_ATTRIBUTE_EXEMPTIONS.has(name) ||
    isFrameworkOwnedAttribute(name)
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

const attributeNamesByClass = new WeakMap<object, { observed: readonly string[]; all: ReadonlySet<string> }>();

function attributeNamesFor(ctor: object): { observed: readonly string[]; all: ReadonlySet<string> } {
  let names = attributeNamesByClass.get(ctor);
  if (!names) {
    const observed = (ctor as { observedAttributes?: readonly string[] }).observedAttributes ?? [];
    const known = (ctor as Partial<KnownUnobservedAttributeHost>).knownUnobservedAttributes ?? [];
    names = { observed, all: new Set([...observed, ...known]) };
    attributeNamesByClass.set(ctor, names);
  }
  return names;
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
  observedAttributes?: readonly string[],
  knownUnobservedAttributes?: readonly string[]
): void {
  const warnings = litDevWarnings();
  if (!warnings) return;
  const names = host.getAttributeNames();
  if (names.length === 0) return;
  let observed: readonly string[];
  let observedSet: ReadonlySet<string>;
  if (observedAttributes === undefined && knownUnobservedAttributes === undefined) {
    // A class's observed and known attribute names are fixed once it is defined; resolve them
    // once per class instead of re-running the `observedAttributes` getter on every connect.
    const classNames = attributeNamesFor(host.constructor);
    observed = classNames.observed;
    observedSet = classNames.all;
  } else {
    observed = observedAttributes ?? (host.constructor as { observedAttributes?: readonly string[] }).observedAttributes ?? [];
    observedSet = new Set([
      ...observed,
      ...(knownUnobservedAttributes ?? (host.constructor as Partial<KnownUnobservedAttributeHost>).knownUnobservedAttributes ?? []),
    ]);
  }
  for (const name of names) {
    if (observedSet.has(name) || isExemptAttribute(name)) continue;
    const key = `lyra-unknown-attribute:${host.localName}:${name}`;
    if (warnings.has(key)) continue;
    warnings.add(key);
    const suggestion = closestObservedAttribute(name, observed);
    console.warn(
      suggestion
        ? `<${host.localName}>: unknown attribute '${name}' — did you mean '${suggestion}'?`
        : `<${host.localName}>: unknown attribute '${name}'`
    );
  }
}

/** Composed parent: a slotted node's assigned slot is not walked; inheritance follows the host. */
function composedParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root.nodeType === 11 && 'host' in root ? (root as ShadowRoot).host : null;
}

const checkedScopeChains = new WeakSet<Element>();
const THEME_SCOPE_LIST = `:root,${DOCUMENT_TOKEN_SCOPE_SELECTOR}`;
const LAYER_INPUTS = new Set(LAYER_CONSUMED_INPUTS);

/** The layer-consumed `--lr-theme-*` inputs `element`'s own inline style sets. */
function inlineLayerInputs(element: Element): string[] {
  const style = (element as Partial<ElementCSSInlineStyle>).style;
  if (!style || style.length === 0) return [];
  const found: string[] = [];
  for (let index = 0; index < style.length; index++) {
    const name = style.item(index);
    if (LAYER_INPUTS.has(name)) found.push(name);
  }
  return found;
}

/**
 * Development-only theme-scope diagnostic (RFC 0002), run on every Lyra connect. It reads no
 * computed style. Each warning is issued once per page under a fixed key, so a test that exercises
 * the case deliberately can seed exactly that key:
 *
 * - `lyra-theme-scope:false-marker` -- `data-lr-theme-scope="false"` still marks a scope (HTML
 *   presence semantics), which is rarely what a framework binding meant.
 * - `lyra-theme-scope:unscoped-input` -- walking from the host (included) up the composed ancestor
 *   chain to the nearest theme scope, an element's inline style sets a --lr-theme-* input that the
 *   document layer consumes, but the element is not a scope, so the components below it no longer
 *   re-derive from it. Stylesheet-applied inputs and later `setProperty()` calls are left to
 *   `findUnscopedThemeInputs()` and the migration report.
 * - `lyra-theme-scope:layer-missing` -- the layer could not be adopted into the host's document.
 * - `lyra-theme-scope:foreign-layer` -- a different token layer (another Lyra release) was already
 *   present; the later-adopted layer wins where their values differ.
 */
export function warnThemeScopeUsage(host: Element): void {
  if (!litDevWarnings()) return;
  if (host.getAttribute('data-lr-theme-scope') === 'false') {
    devWarnOnce(
      'lyra-theme-scope:false-marker',
      `<${host.localName}>: data-lr-theme-scope="false" still marks a theme scope; omit the attribute (or bind it to null) to unmark the element.`
    );
  }
  const doc = host.ownerDocument;
  if (doc.defaultView && !hasLyraTokens(doc)) {
    devWarnOnce(
      'lyra-theme-scope:layer-missing',
      `<${host.localName}>: the Lyra document token layer is not adopted in this document; link @aceshooting/lyra-ui/tokens-root.css or call adoptLyraTokens(document).`
    );
  }
  const foreign = foreignLyraTokenLayer(doc);
  if (foreign) {
    devWarnOnce(
      'lyra-theme-scope:foreign-layer',
      `A different Lyra token layer (${foreign}) was already present in this document; the later-adopted layer wins where values differ. Load one copy of @aceshooting/lyra-ui per page.`
    );
  }
  for (let element: Element | null = host; element && !checkedScopeChains.has(element); element = composedParent(element)) {
    checkedScopeChains.add(element);
    if (element.matches(THEME_SCOPE_LIST)) break;
    const inputs = inlineLayerInputs(element);
    if (inputs.length) {
      devWarnOnce(
        'lyra-theme-scope:unscoped-input',
        `<${element.localName}> sets ${inputs.join(', ')} inline but is not a theme scope, so Lyra components below it keep the nearest scope's values. Add data-lr-theme-scope to the element.`
      );
      break;
    }
  }
}
