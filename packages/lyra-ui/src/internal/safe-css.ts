import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from './data-descriptors.js';

const UNSAFE_CSS_STRUCTURE = /[;{}]/;
const URL_FUNCTION = /url\s*\(/i;
const SAFE_SWATCH_COLOR_FALLBACK =
  /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\([^;{}]*\)|var\(--[\w-]+(?:\s*,[^;{}]+)?\))$/;
const SAFE_LENGTH_FALLBACK =
  /^(?:auto|none|fit-content|max-content|min-content|stretch|[-+]?(?:\d+|\d*\.\d+)(?:px|em|rem|%|ch|ex|cap|ic|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cm|mm|q|in|pt|pc)|(?:calc|min|max|clamp|var)\([^;{}]+\))$/;
const SAFE_INSET_FALLBACK =
  /^(?:(?:auto|[-+]?(?:\d+|\d*\.\d+)(?:px|em|rem|%|ch|vw|vh|vmin|vmax)|var\(--[\w-]+(?:\s*,[^;{}]+)?\))(?:\s+|$)){1,4}$/;

function structurallySafe(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !UNSAFE_CSS_STRUCTURE.test(value) &&
    !URL_FUNCTION.test(value)
  );
}

function propertyAccepts(property: string, value: string, fallback: RegExp): boolean {
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports(property, value.trim());
  }
  return fallback.test(value.trim());
}

/**
 * Returns a CSS color only when the browser parses it as the `color` property.
 *
 * This is also the swatch guard. A caller-supplied swatch color has to be rejected unless it is
 * recognizable CSS color syntax -- both to stop it breaking out of the single declaration it is
 * assigned to (`;`, `{`, `}` terminate/reopen a declaration) and to stop non-color values such as
 * `url(...)` from being accepted, which `background` also parses and would fetch as soon as the
 * swatch renders. That matters even when the value is applied through Lit's `styleMap` directive
 * rather than raw string interpolation: `styleMap`'s FIRST commit for a given attribute part
 * serializes the whole `style` value as one string (only later updates take the safe
 * `CSSStyleDeclaration.setProperty()` path), so an unsanitized value could still inject on that
 * first render.
 */
export function sanitizeCssColor(color: unknown): string | undefined {
  if (!structurallySafe(color)) return undefined;
  return propertyAccepts('color', color, SAFE_SWATCH_COLOR_FALLBACK) ? color : undefined;
}

/** Returns a CSS length only when it is valid for the named sizing property. */
export function sanitizeCssLength(
  value: unknown,
  property: 'height' | 'max-height' = 'max-height',
): string | undefined {
  if (!structurallySafe(value)) return undefined;
  return propertyAccepts(property, value, SAFE_LENGTH_FALLBACK) ? value : undefined;
}

/** Returns a one-to-four-value inset shorthand only when the browser accepts it. */
export function sanitizeCssInset(value: unknown): string | undefined {
  if (!structurallySafe(value)) return undefined;
  return propertyAccepts('inset', value, SAFE_INSET_FALLBACK) ? value : undefined;
}

export type SafeCssResize = 'none' | 'both' | 'horizontal' | 'vertical';

/** Narrows an untrusted runtime value to the native CSS `resize` vocabulary. */
export function sanitizeCssResize(
  value: unknown,
  fallback: SafeCssResize,
): SafeCssResize {
  return value === 'none' ||
    value === 'both' ||
    value === 'horizontal' ||
    value === 'vertical'
    ? value
    : fallback;
}

export interface SafePercentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Validates public percentage geometry before it reaches an inline style. */
export function sanitizePercentRect(value: unknown): SafePercentRect | undefined {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
    const read = (key: keyof SafePercentRect): unknown | undefined => {
      const descriptor = getOwnDataDescriptor(value, key);
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
      )
        return undefined;
      return descriptor.value;
    };
    const x = read('x');
    const y = read('y');
    const width = read('width');
    const height = read('height');
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 0 ||
      height < 0
    )
      return undefined;
    return { x, y, width, height };
  } catch {
    return undefined;
  }
}
