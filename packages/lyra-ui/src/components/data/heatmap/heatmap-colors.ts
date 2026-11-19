import { getScratchCtx } from '../../../internal/canvas.js';
import { readCanvasRgba, toRgbaString } from '../../../internal/canvas-color.js';
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

export { toRgbaString as formatRgb };

function warnInvalidColor(color: string): void {
  devWarnOnce(
    `heatmap-invalid-color:${color}`,
    `<lr-heatmap> could not parse "${color}" (set via --lr-heatmap-scale-lo/-hi) as a CSS ` +
      'color; falling back to the default ramp endpoint.'
  );
}

function warnNoCanvasContext(): void {
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
 * Uses canvas normalization and falls back to `fallbackHex` for invalid colors.
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

  ctx.fillStyle = 'rgb(1, 2, 3)';
  const sentinelNormalized = ctx.fillStyle;
  ctx.fillStyle = color;
  if (ctx.fillStyle === sentinelNormalized) {
    ctx.fillStyle = 'rgb(4, 5, 6)';
    const second = ctx.fillStyle;
    ctx.fillStyle = color;
    if (ctx.fillStyle === second) {
      warnInvalidColor(color);
      return fallback;
    }
  }
  const normalized = ctx.fillStyle;
  // A pixel read quantizes alpha, so prefer the serialized value when possible.
  const parsed = hexToRgb(normalized) ?? parseRgbString(normalized);
  if (parsed) return parsed;
  const rgba = readCanvasRgba(ctx.canvas.ownerDocument, normalized, ctx);
  return rgba ? [...rgba] : fallback;
}

