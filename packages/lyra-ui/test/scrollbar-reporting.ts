/**
 * Works around a Firefox `getComputedStyle().scrollbarWidth` limitation in this repo's test
 * harness: under the Firefox launcher, EVERY element -- a bare `<div style="scrollbar-width:
 * thin">`, one driven by a `var()`, even `document.documentElement` -- reports `'none'`
 * regardless of what CSS actually resolves the property to (confirmed live: a forced
 * `overflow-y: scroll` box shows zero reserved gutter width for `none`, `thin`, and `auto` alike
 * in this harness, so there is no rendering side effect to fall back on either -- Firefox here
 * genuinely never paints a classic scrollbar). `scrollbarGutter` is unaffected and reports
 * correctly on every engine here; only `scrollbarWidth` is broken.
 *
 * A naive fix -- read the resolved `--lr-theme-scrollbar-width` custom property off the element
 * instead -- is NOT sufficient and was rejected in review: a custom property inherits through the
 * DOM/shadow tree regardless of whether any rule on the element actually consumes it via `var()`,
 * so reading it back only proves ordinary CSS custom-property inheritance, never that the
 * component's own stylesheet wires the hook into `scrollbar-width` for that part. Mutation-tested
 * proof: hardcoding a part's `scrollbar-width` to a literal (disconnecting it from
 * `var(--lr-theme-scrollbar-width, ...)`) must fail the corresponding test on every engine; a
 * property-only readback cannot detect that disconnect because the custom property is still
 * sitting there, inherited, unconsumed.
 *
 * `readScrollbarWidth()` fixes this by reading the actual CSS declaration text for
 * `scrollbar-width` on the named part selector, straight out of the component's own
 * `adoptedStyleSheets` (CSSOM parsing behaves identically on every engine -- it is not subject to
 * the Firefox `getComputedStyle` bug at all, since we never ask Firefox to resolve
 * `scrollbar-width`):
 *
 * - If the declaration is a literal (`scrollbar-width: none;`, no `var()`), that literal string
 *   IS the effective value -- return it as-is. This is what proves an unconditional override rule
 *   (e.g. `lr-scroller`'s `:host([without-scrollbar])` opt-out) is actually the rule in force,
 *   and a mutation of its literal is caught identically on every engine.
 * - If the declaration is `var(--custom-prop, fallback)` (or the indirected
 *   `var(--lr-scrollbar-width)`, whose own default is set once in `internal/tokens.styles.ts`),
 *   resolve `--custom-prop`'s cascaded value via `getComputedStyle` -- custom properties ARE
 *   reported correctly on every engine here, including Firefox -- falling back to the CSS-declared
 *   fallback text only when the property is unset. Because the declaration text itself is the
 *   thing under test, disconnecting the `var()` (hardcoding a literal, or changing which property
 *   or fallback it names) is caught exactly like the literal case above; an ancestor overriding the
 *   custom property is proven by the real, unmodified cascade resolving that property's value, not
 *   by any Firefox-specific readback.
 *
 * On an engine that reports `scrollbar-width` truthfully (Chromium, WebKit here), none of this
 * applies -- `readScrollbarWidth()` returns the real `getComputedStyle(...).scrollbarWidth`
 * unchanged, so coverage there is exactly what a direct read would have given.
 */

let reportsScrollbarWidth: boolean | undefined;

function probeScrollbarWidthReporting(): boolean {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.scrollbarWidth = 'thin';
  document.body.append(probe);
  const reported = getComputedStyle(probe).scrollbarWidth === 'thin';
  probe.remove();
  return reported;
}

/** Memoized: whether this engine's `getComputedStyle().scrollbarWidth` can be trusted at all. */
export function scrollbarWidthIsReported(): boolean {
  if (reportsScrollbarWidth === undefined) {
    reportsScrollbarWidth = probeScrollbarWidthReporting();
  }
  return reportsScrollbarWidth;
}

function collectStyleRules(sheet: CSSStyleSheet, out: CSSStyleRule[]): void {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    // A cross-origin or not-yet-parsed sheet throws on `cssRules` access; nothing to collect.
    return;
  }
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      out.push(rule);
    } else if ('cssRules' in rule) {
      // Grouping rules (`@media`, `@container`, `@supports`, ...) nest further style rules.
      collectStyleRules(rule as unknown as CSSStyleSheet, out);
    }
  }
}

/**
 * Finds the literal `scrollbar-width` declaration text for the CSS rule whose selector text is
 * exactly `selector`, searching `root`'s adopted stylesheets (falling back to `<style>` elements
 * for an engine that does not use constructable stylesheets). When more than one rule shares the
 * selector and declares `scrollbar-width`, the last one found wins, matching source-order cascade
 * tie-breaking for equal-specificity same-sheet rules. Throws if no matching declaration exists,
 * so a renamed part or a typoed selector surfaces immediately instead of silently reading
 * `undefined`.
 */
function findScrollbarWidthDeclaration(root: ShadowRoot, selector: string): string {
  const sheets: CSSStyleSheet[] =
    root.adoptedStyleSheets && root.adoptedStyleSheets.length > 0
      ? Array.from(root.adoptedStyleSheets)
      : (Array.from(root.querySelectorAll('style'))
          .map((style) => (style as HTMLStyleElement).sheet)
          .filter((sheet): sheet is CSSStyleSheet => sheet !== null) as CSSStyleSheet[]);

  const rules: CSSStyleRule[] = [];
  for (const sheet of sheets) {
    collectStyleRules(sheet, rules);
  }

  let declared: string | undefined;
  for (const rule of rules) {
    if (rule.selectorText !== selector) continue;
    const value = rule.style.getPropertyValue('scrollbar-width').trim();
    if (value) declared = value;
  }

  if (declared === undefined) {
    throw new Error(
      `readScrollbarWidth: no CSS rule for selector ${JSON.stringify(selector)} declares scrollbar-width`
    );
  }
  return declared;
}

const VAR_DECLARATION = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/;

/** Parses a `var(--prop, fallback)` (or `var(--prop)`) declaration; `null` for a literal value. */
function parseVarDeclaration(declared: string): { property: string; fallback: string } | null {
  const match = VAR_DECLARATION.exec(declared);
  if (!match) return null;
  const [, property, fallback] = match;
  // The pattern cannot match without capturing group 1, but the test tree compiles with
  // noUncheckedIndexedAccess, so narrow it rather than asserting.
  if (property === undefined) return null;
  return { property, fallback: (fallback ?? '').trim() };
}

/**
 * Reads the effective `scrollbar-width` of `partEl` for a test assertion. `selector` must be the
 * exact CSS selector text (as the engine serializes it, e.g. `[part="viewport"]` or
 * `:host([without-scrollbar]) [part="viewport"]`) of the rule under test in `partEl`'s own shadow
 * root -- pass the override rule's selector for an "ancestor/host overrides the default" case, the
 * base rule's selector otherwise. See the file header for why this, and not a raw custom-property
 * readback, is required on an engine that cannot report `scrollbar-width` truthfully.
 */
export function readScrollbarWidth(partEl: Element, selector: string): string {
  if (scrollbarWidthIsReported()) {
    return getComputedStyle(partEl).scrollbarWidth;
  }

  const root = partEl.getRootNode();
  if (!(root instanceof ShadowRoot)) {
    throw new Error('readScrollbarWidth: partEl must be rendered inside a shadow root');
  }

  const declared = findScrollbarWidthDeclaration(root, selector);
  const varRef = parseVarDeclaration(declared);
  if (!varRef) {
    // A literal declaration (no `var()`) IS the effective value -- it does not depend on any
    // ancestor-supplied custom property, so there is nothing further to resolve.
    return declared;
  }

  const hookValue = getComputedStyle(partEl).getPropertyValue(varRef.property).trim();
  if (hookValue) return hookValue;
  if (varRef.fallback) return varRef.fallback;
  throw new Error(
    `readScrollbarWidth: ${varRef.property} is unset and ${JSON.stringify(selector)}'s declaration has no CSS fallback`
  );
}
