const INVALID_COLOR_SENTINELS = ['rgb(1, 2, 3)', 'rgb(4, 5, 6)'] as const;

/** Concrete fallback shared by canvas consumers when a live accent token cannot be resolved. */
export const DEFAULT_CANVAS_COLOR = '#0969da';

/**
 * Resolves a CSS color expression in an element's live theme scope. Canvas APIs silently retain
 * their previous paint when assigned an unresolved variable, `currentColor`, or an invalid value,
 * so every canvas-bound color must cross this concrete DOM color probe first.
 */
export function resolveCanvasColor(scope: Element, color: string, fallback: string): string {
  const ownerDocument = scope.ownerDocument;
  const view = ownerDocument.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') return fallback;

  const normalized = color.trim().toLowerCase();
  if (normalized === 'currentcolor' || normalized === 'inherit' || normalized === 'unset') {
    return view.getComputedStyle(scope).color || fallback;
  }

  const parent = ownerDocument.createElement('span');
  const probe = ownerDocument.createElement('span');
  parent.hidden = true;
  parent.setAttribute('aria-hidden', 'true');
  probe.style.color = color;
  parent.append(probe);
  (scope.shadowRoot ?? scope).append(parent);
  try {
    parent.style.color = INVALID_COLOR_SENTINELS[0];
    const first = view.getComputedStyle(probe).color;
    if (!first || first !== INVALID_COLOR_SENTINELS[0]) return first || fallback;

    // A second inherited sentinel distinguishes an invalid declaration from a legitimate color
    // whose concrete value happens to equal the first sentinel.
    parent.style.color = INVALID_COLOR_SENTINELS[1];
    const second = view.getComputedStyle(probe).color;
    return !second || second === INVALID_COLOR_SENTINELS[1] ? fallback : second;
  } finally {
    parent.remove();
  }
}

/**
 * Array form of `resolveCanvasColor`, memoized across the batch.
 *
 * Each individual resolution inserts a probe element into the scope and reads
 * `getComputedStyle`, forcing a synchronous style recalculation -- twice for a color that hits the
 * first sentinel. That is a fine price once per chart, and a punishing one per *data point*: a
 * series carrying a per-point `color` array paid it for every row, so a 600-point series meant 600
 * probe insertions and at least 600 forced recalcs before a single pixel was drawn. On WebKit that
 * alone overran the test suite's 6s per-test timeout.
 *
 * Authored color arrays are overwhelmingly a handful of distinct strings repeated across many
 * points (a two-tone threshold ramp, one highlight against one base), so memoizing by string
 * collapses the work to the number of *distinct* colors. The cache lives exactly as long as this
 * call, so a later draw still re-reads the live theme and picks up `--lr-*` changes.
 */
export function resolveCanvasColors(
  scope: Element,
  colors: Iterable<string>,
  fallback: string
): string[] {
  const memo = new Map<string, string>();
  const resolved: string[] = [];
  for (const color of colors) {
    let value = memo.get(color);
    if (value === undefined) {
      value = resolveCanvasColor(scope, color, fallback);
      memo.set(color, value);
    }
    resolved.push(value);
  }
  return resolved;
}

/** An sRGB colour as `[r, g, b, a]`: channels 0-255, alpha 0-1. */
export type CanvasRgba = readonly [number, number, number, number];

const READBACK_BASES = ['#010203', '#040506'] as const;

/**
 * Reads any CSS colour the canvas understands (named, hex, `hsl()`, `color-mix()`, `oklch()`, ...)
 * back as sRGB `[r, g, b, a]` by painting one pixel. Returns `undefined` for an invalid value, an
 * unresolved `var()`, or a document without a canvas. Canvas silently keeps its previous fill on
 * an invalid assignment, so the colour is painted over two different base fills; differing
 * results mean the assignment was rejected.
 */
export function readCanvasRgba(doc: Document, css: string): CanvasRgba | undefined {
  let ctx: CanvasRenderingContext2D | null;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  } catch {
    return undefined;
  }
  if (!ctx) return undefined;
  const pixels: Uint8ClampedArray[] = [];
  for (const base of READBACK_BASES) {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = base;
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    pixels.push(ctx.getImageData(0, 0, 1, 1).data);
  }
  const [first, second] = pixels as [Uint8ClampedArray, Uint8ClampedArray];
  for (let i = 0; i < 4; i++) if (first[i] !== second[i]) return undefined;
  return [first[0]!, first[1]!, first[2]!, first[3]! / 255];
}

/** Serializes a colour as a comma-form `rgb()`/`rgba()` string (alpha omitted when opaque). */
export function toRgbaString(color: CanvasRgba): string {
  const [r, g, b, a] = color;
  const channel = (v: number): number => Math.min(255, Math.max(0, Math.round(Number.isFinite(v) ? v : 0)));
  const alpha = Math.min(1, Math.max(0, Number.isFinite(a) ? a : 1));
  return alpha >= 1
    ? `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`
    : `rgba(${channel(r)}, ${channel(g)}, ${channel(b)}, ${Number(alpha.toFixed(3))})`;
}
