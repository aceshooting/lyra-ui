/** CSS's initial `font-size` (`medium`), used when a computed font size can't be read — a
 *  disconnected element has no computed style, so `getComputedStyle()` reports empty strings. */
const FALLBACK_FONT_SIZE_PX = 16;

/** A signed CSS `<number>` plus, optionally, one of the units meaningful for a breakpoint.
 *  Exponent notation is deliberately excluded: `1e3px` is not a valid CSS length either. */
const BREAKPOINT_LENGTH_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em)?$/i;

/** The element's computed `font-size` in px, or the CSS initial size if it has no computed style. */
function fontSizePx(element: Element): number {
  const size = Number.parseFloat(getComputedStyle(element).fontSize);
  return Number.isFinite(size) && size > 0 ? size : FALLBACK_FONT_SIZE_PX;
}

/**
 * Resolves a CSS length to pixels against the document root (like a `@media`/`@container` query),
 * so a breakpoint authored in `rem` tracks the user's root font size.
 *
 * Accepted forms — the ones that mean something as a *layout breakpoint*:
 *
 * - a bare number, or a numeric string, in px (`900`, `'900'`) — the historical form;
 * - `px` (`'900px'`), identical to the bare form;
 * - `rem` (`'56.25rem'`), resolved against `document.documentElement`'s computed font size, exactly
 *   as a `rem` in a CSS `@media` query is — *not* against `host`;
 * - `em` (`'3em'`), resolved against `host`'s own computed font size, falling back to the document
 *   root (i.e. behaving like `rem`) when `host` is omitted or has no computed style.
 *
 * Units are case-insensitive and surrounding whitespace is ignored. The root font size is read on
 * every call and never cached, so browser zoom, a user font-size preference, or an app changing its
 * base size are picked up on the next measurement with no invalidation mechanism.
 *
 * Everything else resolves to `undefined`, meaning "no usable length" — callers treat that the same
 * as an unset value. That deliberately includes viewport (`vw`/`vh`), percentage (`%`) and
 * font-metric (`ch`/`ex`) units, absolute units (`pt`/`cm`/…), and `calc()`/`var()` expressions:
 * this helper resolves a threshold that is compared against an element's *own* allocated size, and
 * a viewport- or container-relative threshold silently mixes two different reference boxes. A
 * consumer that wants a viewport-relative breakpoint should drive the property from its own
 * `matchMedia()` controller instead.
 *
 * Negative and zero lengths are resolved faithfully rather than rejected (`-2rem` at a 16px root is
 * `-32`); this reports what a value means in pixels and leaves range policy to the caller. `NaN`,
 * `Infinity`, `''`, `null` and `undefined` all resolve to `undefined`.
 *
 * @returns pixels, or `undefined` for an unparseable value.
 */
export function resolveCssLength(value: number | string | undefined, host?: Element): number | undefined {
  // `null` is outside the declared type but reachable: Lit writes it back to a property whose
  // attribute was removed.
  if (value == null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  const match = BREAKPOINT_LENGTH_RE.exec(value.trim());
  if (match === null) return undefined;

  const length = Number.parseFloat(match[1]);
  if (!Number.isFinite(length)) return undefined;

  switch (match[2]?.toLowerCase()) {
    case 'rem':
      return length * fontSizePx(document.documentElement);
    case 'em':
      return length * fontSizePx(host ?? document.documentElement);
    default:
      return length;
  }
}
