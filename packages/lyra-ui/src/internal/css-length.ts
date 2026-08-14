/** CSS's initial `font-size` (`medium`), used when a computed font size can't be read — a
 *  disconnected element has no computed style, so `getComputedStyle()` reports empty strings. */
const FALLBACK_FONT_SIZE_PX = 16;

/** A signed CSS `<number>` plus, optionally, one of the supported resolvable units.
 *  Exponent notation is deliberately excluded: `1e3px` is not a valid CSS length either. */
const CSS_LENGTH_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em|vw|vh|%)?$/i;

/** Explicit layout context used to resolve relative CSS lengths. */
export interface ResolveCssLengthOptions {
  readonly host?: Element;
  readonly percentBase?: number;
  readonly viewportBasis?:
    | Window
    | Readonly<{ inlineSize: number; blockSize: number }>;
}

/** The element's computed `font-size` in px, or the CSS initial size if it has no computed style. */
function fontSizePx(element: Element, view: Window): number {
  const size = Number.parseFloat(view.getComputedStyle(element).fontSize);
  return Number.isFinite(size) && size > 0 ? size : FALLBACK_FONT_SIZE_PX;
}

/**
 * Resolves a CSS length to pixels against explicit layout context. A `rem` value tracks the
 * document root font size, `em` tracks the supplied host, `%` uses `percentBase`, and `vw`/`vh`
 * use `viewportBasis` (or the host document's live viewport when no basis is supplied).
 *
 * Note this is a `@container` query's rule, NOT a `@media` query's: inside a media query, relative
 * units resolve against the browser's *initial* font size and ignore any `html { font-size }`
 * override entirely. The two agree only while an app leaves the root font size alone. Callers that
 * need real media-query semantics must hand the authored length to `matchMedia()` and let the
 * browser resolve it, rather than converting it here first — see `OrientationBreakpointController`'s
 * `'viewport'` basis.
 *
 * Accepted forms — the ones that mean something as a *layout breakpoint*:
 *
 * - a bare number, or a numeric string, in px (`900`, `'900'`) — the historical form;
 * - `px` (`'900px'`), identical to the bare form;
 * - `rem` (`'56.25rem'`), resolved against `document.documentElement`'s computed font size — *not*
 *   against `host`;
 * - `em` (`'3em'`), resolved against `options.host`'s computed font size, falling back to the
 *   document root (i.e. behaving like `rem`) when the host is omitted or has no computed style;
 * - `%` (`'50%'`), resolved against `options.percentBase`; it is unavailable without that base;
 * - `vw`/`vh`, resolved against a supplied `Window` or `{ inlineSize, blockSize }` viewport basis,
 *   otherwise against the host/ambient document's live viewport.
 *
 * Units are case-insensitive and surrounding whitespace is ignored. The root font size is read on
 * every call and never cached, so browser zoom, a user font-size preference, or an app changing its
 * base size are picked up on the next measurement with no invalidation mechanism.
 *
 * Everything else resolves to `undefined`, meaning "no usable length" — callers treat that the same
 * as an unset value. That includes font-metric (`ch`/`ex`) and absolute (`pt`/`cm`/…) units plus
 * `calc()`/`var()` expressions.
 *
 * Negative and zero lengths are resolved faithfully rather than rejected (`-2rem` at a 16px root is
 * `-32`); this reports what a value means in pixels and leaves range policy to the caller. `NaN`,
 * `Infinity`, `''`, `null` and `undefined` all resolve to `undefined`.
 *
 * @returns pixels, or `undefined` for an unparseable value.
 */
export function resolveCssLength(
  value: number | string | undefined,
  options?: ResolveCssLengthOptions,
): number | undefined {
  // `null` is outside the declared type but reachable: Lit writes it back to a property whose
  // attribute was removed.
  if (value == null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  const match = CSS_LENGTH_RE.exec(value.trim());
  if (match === null) return undefined;

  // safe: capture group 1 (the numeric part) is non-optional, so it exists on any match.
  const length = Number.parseFloat(match[1]!);
  if (!Number.isFinite(length)) return undefined;

  const host = options?.host;
  const ownerDocument = host?.ownerDocument ?? (typeof document === 'undefined' ? undefined : document);
  const ownerWindow = ownerDocument?.defaultView;

  switch (match[2]?.toLowerCase()) {
    case 'rem':
      if (!ownerDocument || !ownerWindow) return undefined;
      return length * fontSizePx(ownerDocument.documentElement, ownerWindow);
    case 'em':
      if (!ownerDocument || !ownerWindow) return undefined;
      return (
        length *
        fontSizePx(
          host && ownerWindow.getComputedStyle(host).fontSize
            ? host
            : ownerDocument.documentElement,
          ownerWindow,
        )
      );
    case '%': {
      const base = options?.percentBase;
      return typeof base === 'number' && Number.isFinite(base)
        ? (length / 100) * base
        : undefined;
    }
    case 'vw':
    case 'vh': {
      const basis = options?.viewportBasis ?? ownerWindow;
      if (!basis) return undefined;
      const dimension =
        match[2].toLowerCase() === 'vw'
          ? 'innerWidth' in basis
            ? basis.innerWidth
            : basis.inlineSize
          : 'innerHeight' in basis
            ? basis.innerHeight
            : basis.blockSize;
      return Number.isFinite(dimension) ? (length / 100) * dimension : undefined;
    }
    default:
      return length;
  }
}
