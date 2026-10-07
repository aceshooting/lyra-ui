import { getScratchCtx } from '../../../internal/canvas.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const HEX_RE = /^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE =
  /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i;

/**
 * Parses a strict `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa` hex string into an
 * `[r, g, b, a]` quadruple (`a` in `[0, 1]`, defaulting to `1` for the
 * 3/6-digit alpha-less forms), or `null` if `hex` isn't one (rather than
 * silently coercing an unparsable string to `0` via
 * `Number.parseInt(..., 16)` returning `NaN`).
 */
export function hexToRgb(hex: string): [number, number, number, number] | null {
  const clean = hex.trim().replace('#', '');
  if (!HEX_RE.test(clean)) return null;
  const hasAlpha = clean.length === 4 || clean.length === 8;
  const full =
    clean.length <= 4
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  if (hasAlpha) {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      (num & 255) / 255,
    ];
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
}

function parseRgbString(
  value: string
): [number, number, number, number] | null {
  const match = RGB_RE.exec(value);
  if (!match) return null;
  const a = match[4] === undefined ? 1 : Number(match[4]);
  return [Number(match[1]), Number(match[2]), Number(match[3]), a];
}

/** Resolves the color `ctx.fillStyle` currently holds to concrete `[r, g, b, a]` bytes by
 *  rendering and reading back a single pixel, the same `getImageData(0, 0, 1, 1)` idiom
 *  `theme.ts`/`shiki-dark-theme.ts`/`color-core.ts` already use elsewhere in this library. Unlike
 *  string-matching the canvas's read-back serialization, this resolves any CSS color syntax the
 *  canvas accepts -- including `oklch()`, `lab()`, and `color(display-p3 ...)`, which canvas
 *  round-trips through `ctx.fillStyle` using their own literal syntax rather than normalizing to
 *  a form `hexToRgb`/`parseRgbString` recognize -- without hand-implementing each color space's
 *  conversion math. Returns `null` if `getImageData` itself throws (e.g. a tainted canvas). */
function resolveViaPixelReadback(
  ctx: CanvasRenderingContext2D
): [number, number, number, number] | null {
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  } catch {
    return null;
  }
}

/** Formats an `[r, g, b, a]` quadruple as the shortest equivalent CSS color —
 *  `rgb(r, g, b)` when fully opaque (matching every pre-alpha-support call
 *  site's output exactly), `rgba(r, g, b, a)` otherwise. */
export function formatRgb([r, g, b, a]: [number, number, number, number]): string {
  const alpha = Math.min(1, Math.max(0, a));
  return alpha >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

function warnInvalidColor(color: string): void {
  devWarnOnce(
    `heatmap-invalid-color:${color}`,
    `<lr-heatmap> could not parse "${color}" (set via --lr-heatmap-scale-lo/-hi) as a CSS ` +
      'color; falling back to the default ramp endpoint.'
  );
}

let warnedNoCanvasContext = false;

/** Distinct from `warnInvalidColor()`: that one means "this color string is not valid CSS", this
 *  one means "the environment can't tell us, because there is no canvas 2D context to parse it
 *  with". Both end at the same fallback, so without separate messages a consumer debugging a wrong
 *  ramp color cannot tell a typo'd token from a headless/canvas-disabled environment. Warned once
 *  per page, not once per color: the cause is environmental, and `resolveRgb()` runs per ramp
 *  endpoint on every draw pass. */
function warnNoCanvasContext(): void {
  if (warnedNoCanvasContext) return;
  warnedNoCanvasContext = true;
  devWarnOnce(
    'heatmap-no-canvas-context',
    '<lr-heatmap>: no 2D canvas context is available in this environment; color resolution ' +
      'for non-hex/non-rgb values (e.g. oklch(), color(srgb ...), named colors) will fall back ' +
      'to the given default instead of resolving the requested color.'
  );
}

/**
 * Resolves any syntactically valid CSS `<color>` — hex, `rgb()`, `hsl()`,
 * `oklch()`, a named color, etc. — to an `[r, g, b, a]` quadruple (`a` in
 * `[0, 1]`, `1` for an opaque input). A translucent input (e.g.
 * `rgba(255,255,255,.028)`, a common way to key a color ramp off a themed
 * "quiet surface" token) round-trips its alpha rather than silently
 * resolving to the fully opaque equivalent.
 *
 * Hand-rolling a parser for every CSS color syntax is unnecessary and
 * error-prone (a naive hex-only parser silently turns an unrecognized format
 * into `NaN` -> `0`, i.e. solid black). The canvas 2D context already
 * implements the full CSS color grammar via its `fillStyle` setter, so this
 * normalizes through that instead. Assigning an unparsable string to
 * `fillStyle` is a spec'd no-op (the previous value is kept, it never
 * throws), so a sentinel round-trip is used to detect that case and fall
 * back to `fallbackHex` (with a one-time development diagnostic) instead of
 * silently drawing the wrong color.
 */
export function resolveRgb(
  color: string,
  fallbackHex: string,
  ownerDocument?: Document
): [number, number, number, number] {
  const fallback = hexToRgb(fallbackHex) ?? [0, 0, 0, 1];
  const direct = hexToRgb(color);
  if (direct) return direct;

  const ctx = getScratchCtx(ownerDocument);
  if (!ctx) {
    warnNoCanvasContext();
    return fallback;
  }

  const sentinel = 'rgb(1, 2, 3)';
  ctx.fillStyle = sentinel;
  const sentinelNormalized = ctx.fillStyle;
  ctx.fillStyle = color;
  if (ctx.fillStyle === sentinelNormalized && color.trim() !== sentinel) {
    warnInvalidColor(color);
    return fallback;
  }
  const normalized = ctx.fillStyle;
  return (
    hexToRgb(normalized) ??
    parseRgbString(normalized) ??
    resolveViaPixelReadback(ctx) ??
    fallback
  );
}

