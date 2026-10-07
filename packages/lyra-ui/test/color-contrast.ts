/**
 * WCAG contrast helpers for rendered-colour assertions.
 *
 * Computed colours come back in whatever space the cascade produced (`rgb()`, `oklab()`, the
 * result of a `color-mix()`), so every value is normalized through a 1x1 canvas before the
 * relative-luminance math runs. That keeps the ratio independent of the engine's serialization.
 */

type Rgba = [number, number, number, number];

interface ColorCanvas {
  context: CanvasRenderingContext2D;
  rgba: Map<string, Rgba>;
}

const MAX_CACHED_COLORS = 256;
const colorCanvases = new WeakMap<Document, ColorCanvas>();
const absoluteColorNames = new Set(['black', 'white', 'transparent']);
const absoluteColorFunction = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/iu;
const contextualColorSyntax = /\b(?:currentcolor|env|from|light-dark|var)\b/iu;

function isCacheableColor(color: string): boolean {
  const normalized = color.trim().toLowerCase();
  if (contextualColorSyntax.test(normalized)) return false;
  if (/^#[\da-f]{3,8}$/iu.test(normalized)) return true;
  if (/^[a-z]+$/iu.test(normalized)) {
    return absoluteColorNames.has(normalized);
  }
  if (/^color\(\s*--/iu.test(normalized)) return false;
  return absoluteColorFunction.test(normalized);
}

function colorCanvas(document_: Document): ColorCanvas {
  const cached = colorCanvases.get(document_);
  if (cached) return cached;

  const canvas = document_.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const created = { context, rgba: new Map<string, Rgba>() };
  colorCanvases.set(document_, created);
  return created;
}

/** Paints `color` into a 1x1 canvas and reads it back as `[r, g, b, a]` bytes. */
export function toRgba(color: string): [number, number, number, number] {
  const document_ = document;
  const { context, rgba } = colorCanvas(document_);
  const cacheable = isCacheableColor(color);
  if (cacheable) {
    const cached = rgba.get(color);
    if (cached) {
      rgba.delete(color);
      rgba.set(color, cached);
      return [cached[0], cached[1], cached[2], cached[3]];
    }
  }

  // Invalid colors retain a fresh canvas's black fallback, not the previous paint.
  context.fillStyle = 'black';
  context.fillStyle = color;
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  const result: Rgba = [r!, g!, b!, a!];
  if (cacheable) {
    rgba.set(color, result);
    if (rgba.size > MAX_CACHED_COLORS) {
      const oldest = rgba.keys().next().value;
      if (oldest !== undefined) rgba.delete(oldest);
    }
  }
  return [result[0], result[1], result[2], result[3]];
}

function luminance([r, g, b]: [number, number, number, number]): number {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}

/** WCAG 2.x contrast ratio between two opaque colours. */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(toRgba(foreground));
  const b = luminance(toRgba(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The first non-transparent computed background among `nodes`, in order. */
export function effectiveBackground(...nodes: Element[]): string {
  for (const node of nodes) {
    const background = getComputedStyle(node).backgroundColor;
    if (toRgba(background)[3] !== 0) return background;
  }
  return getComputedStyle(document.body).backgroundColor;
}

/** Resolves a custom property as `root` sees it, by probing a throwaway child of `root`. */
export function resolvedColorToken(root: ShadowRoot | Element, token: string): string {
  const probe = document.createElement('span');
  probe.style.setProperty('color', `var(${token})`);
  root.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}
