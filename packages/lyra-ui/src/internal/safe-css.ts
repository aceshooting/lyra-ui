/**
 * Matches only actual CSS color syntax: hex (`#fff`/`#ffffff`/`#ffffffff`),
 * bare keywords (named colors, `transparent`, `currentColor`), the standard
 * color functions, and `var(--custom-property)` references. Anything else --
 * notably `url(...)`, which is otherwise valid `background` syntax -- is
 * rejected.
 */
const SAFE_SWATCH_COLOR =
  /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([-+0-9.%,/\s]+\)|var\(--[\w-]+\))$/;

/**
 * Rejects a caller-supplied swatch color that isn't recognizable CSS color
 * syntax -- both to stop it breaking out of the single `background`
 * declaration it's assigned to (e.g. `;`, `{`, `}`, which terminate/reopen a
 * declaration) and to stop non-color values such as `url(...)` from being
 * accepted, which `background` also parses and would fetch as soon as the
 * swatch renders. This matters even when the swatch's color is set via Lit's
 * `styleMap` directive (not raw string interpolation): `styleMap`'s first
 * commit for a given attribute part serializes the whole `style` value as a
 * single string (only later updates go through the safe
 * `CSSStyleDeclaration.setProperty()` path), so an unsanitized value could
 * still inject on that first render.
 */
export function sanitizeSwatchColor(color: string): string | undefined {
  return SAFE_SWATCH_COLOR.test(color.trim()) ? color : undefined;
}
