import { finiteRange } from '../../../internal/numbers.js';

/**
 * Colour model and (de)serialization used by `<lr-color-picker>`.
 *
 * The picker works internally in HSVA because that is the space its
 * saturation/brightness grid and hue/alpha sliders map onto directly: the grid's
 * two axes are literally `s` and `v`, and the hue slider is literally `h`. Every
 * public format (`hex`/`rgb`/`hsl`/`hsv`, each with an optional alpha channel)
 * is derived from that one working value, so a value survives arbitrary format
 * switches without accumulating rounding drift in an intermediate representation.
 *
 * Kept dependency-free on purpose: a colour library would be a runtime peer for
 * arithmetic that fits in a few dozen lines, and the one thing a hand-rolled
 * parser genuinely cannot do — resolve CSS colour *names* and newer colour
 * functions — is delegated to the browser's own CSS parser instead
 * (see `parseViaCssom`).
 */

/** Hue in degrees `[0, 360]`, saturation/value in percent `[0, 100]`, alpha `[0, 1]`. */
export interface LyraColorHsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

/** The formats `<lr-color-picker>`'s `format` property accepts. */
export type LyraColorPickerFormat = 'hex' | 'rgb' | 'hsl' | 'hsv';

/** Every format `getFormattedValue()` can emit — each base format plus its alpha-carrying twin. */
export type LyraColorPickerOutputFormat =
  | 'hex'
  | 'hexa'
  | 'rgb'
  | 'rgba'
  | 'hsl'
  | 'hsla'
  | 'hsv'
  | 'hsva';

const CSS_WIDE_KEYWORDS = /^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i;
const HEX_PATTERN = /^#([0-9a-f]+)$/i;
const FUNCTION_PATTERN = /^([a-z]+)\(([^()]*)\)$/i;
// `\d+(?:\.\d*)?` (not `\d+\.?\d*`) matches the identical set of digit strings but removes the
// ambiguous overlap between the two digit quantifiers around an optional `.` -- that overlap is
// polynomial-time on long all-digit input with no matching suffix (e.g. author-supplied CSS color
// values), since the engine backtracks through every possible split between them before failing.
const NUMBER_PATTERN = /^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(%?)$/;
const ANGLE_PATTERN = /^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(deg|grad|rad|turn)?$/i;

const clamp = (value: number, min: number, max: number): number => finiteRange(value, min, min, max);

/** Wraps an arbitrary hue onto `[0, 360)`, keeping an exact 360 as 360 so the slider can reach its end. */
function normalizeHue(hue: number): number {
  if (!Number.isFinite(hue)) return 0;
  if (hue === 360) return 360;
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Builds a normalized HSVA record from loose numbers, so no caller has to clamp twice. */
export function hsva(h: number, s: number, v: number, a = 1): LyraColorHsva {
  return {
    h: normalizeHue(h),
    s: clamp(s, 0, 100),
    v: clamp(v, 0, 100),
    a: clamp(a, 0, 1),
  };
}

/** HSV (`s`/`v` in percent) to 8-bit RGB channels. */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sector = normalizeHue(h) / 60;
  const saturation = clamp(s, 0, 100) / 100;
  const value = clamp(v, 0, 100) / 100;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = value - chroma;
  let r = 0;
  let g = 0;
  let b = 0;
  if (sector < 1) [r, g, b] = [chroma, secondary, 0];
  else if (sector < 2) [r, g, b] = [secondary, chroma, 0];
  else if (sector < 3) [r, g, b] = [0, chroma, secondary];
  else if (sector < 4) [r, g, b] = [0, secondary, chroma];
  else if (sector < 5) [r, g, b] = [secondary, 0, chroma];
  else [r, g, b] = [chroma, 0, secondary];
  return { r: (r + base) * 255, g: (g + base) * 255, b: (b + base) * 255 };
}

/** 8-bit RGB channels to HSV (`s`/`v` in percent). */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const red = clamp(r, 0, 255) / 255;
  const green = clamp(g, 0, 255) / 255;
  const blue = clamp(b, 0, 255) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const chroma = max - min;
  let hue = 0;
  if (chroma !== 0) {
    if (max === red) hue = 60 * (((green - blue) / chroma) % 6);
    else if (max === green) hue = 60 * ((blue - red) / chroma + 2);
    else hue = 60 * ((red - green) / chroma + 4);
  }
  return { h: normalizeHue(hue), s: max === 0 ? 0 : (chroma / max) * 100, v: max * 100 };
}

/** HSV to HSL, both with percent-scaled components. */
export function hsvToHsl(h: number, s: number, v: number): { h: number; s: number; l: number } {
  const value = clamp(v, 0, 100) / 100;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = value * (1 - saturation / 2);
  const denominator = Math.min(lightness, 1 - lightness);
  return {
    h: normalizeHue(h),
    s: denominator === 0 ? 0 : ((value - lightness) / denominator) * 100,
    l: lightness * 100,
  };
}

/** HSL to HSV, both with percent-scaled components. */
export function hslToHsv(h: number, s: number, l: number): { h: number; s: number; v: number } {
  const lightness = clamp(l, 0, 100) / 100;
  const saturation = clamp(s, 0, 100) / 100;
  const value = lightness + saturation * Math.min(lightness, 1 - lightness);
  return {
    h: normalizeHue(h),
    s: value === 0 ? 0 : 2 * (1 - lightness / value) * 100,
    v: value * 100,
  };
}

function parseNumber(text: string | undefined, percentBase: number): number | null {
  if (text === undefined) return null;
  const match = NUMBER_PATTERN.exec(text.trim());
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) return null;
  return match[2] === '%' ? (raw / 100) * percentBase : raw;
}

function parseAngle(text: string | undefined): number | null {
  if (text === undefined) return null;
  const match = ANGLE_PATTERN.exec(text.trim());
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) return null;
  switch ((match[2] ?? 'deg').toLowerCase()) {
    case 'grad':
      return (raw * 360) / 400;
    case 'rad':
      return (raw * 180) / Math.PI;
    case 'turn':
      return raw * 360;
    default:
      return raw;
  }
}

/** Splits a colour function's argument list, accepting both the legacy comma
 *  syntax (`rgb(1, 2, 3, 0.5)`) and the modern space/slash syntax (`rgb(1 2 3 / 50%)`). */
function splitArguments(body: string): { channels: string[]; alpha?: string } {
  const [head = '', tail] = body.split('/');
  const channels = head
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (tail !== undefined) return { channels, alpha: tail.trim() };
  if (channels.length === 4) return { channels: channels.slice(0, 3), alpha: channels[3] };
  return { channels };
}

function parseHex(text: string): LyraColorHsva | null {
  const match = HEX_PATTERN.exec(text);
  if (!match) return null;
  const digits = match[1]!;
  const short = digits.length === 3 || digits.length === 4;
  const long = digits.length === 6 || digits.length === 8;
  if (!short && !long) return null;
  const size = short ? 1 : 2;
  const channel = (index: number): number => {
    const slice = digits.slice(index * size, index * size + size);
    return Number.parseInt(short ? slice + slice : slice, 16);
  };
  const hasAlpha = digits.length === 4 || digits.length === 8;
  const { h, s, v } = rgbToHsv(channel(0), channel(1), channel(2));
  return hsva(h, s, v, hasAlpha ? channel(3) / 255 : 1);
}

function parseFunctional(text: string): LyraColorHsva | null {
  const match = FUNCTION_PATTERN.exec(text);
  if (!match) return null;
  const name = match[1]!.toLowerCase();
  const { channels, alpha } = splitArguments(match[2] ?? '');
  if (channels.length !== 3) return null;
  const alphaValue = alpha === undefined ? 1 : parseNumber(alpha, 1);
  if (alphaValue === null) return null;

  if (name === 'rgb' || name === 'rgba') {
    const r = parseNumber(channels[0], 255);
    const g = parseNumber(channels[1], 255);
    const b = parseNumber(channels[2], 255);
    if (r === null || g === null || b === null) return null;
    const converted = rgbToHsv(r, g, b);
    return hsva(converted.h, converted.s, converted.v, alphaValue);
  }
  if (name === 'hsl' || name === 'hsla' || name === 'hsv' || name === 'hsva') {
    const h = parseAngle(channels[0]);
    const second = parseNumber(channels[1], 100);
    const third = parseNumber(channels[2], 100);
    if (h === null || second === null || third === null) return null;
    if (name.startsWith('hsv')) return hsva(h, second, third, alphaValue);
    const converted = hslToHsv(h, second, third);
    return hsva(converted.h, converted.s, converted.v, alphaValue);
  }
  return null;
}

/**
 * Last-resort resolution through the browser's own CSS parser, for everything the
 * hand-rolled grammar above deliberately does not implement: the 148 CSS colour
 * names, `hwb()`, `lab()`/`lch()`, `oklab()`/`oklch()`, `color()`, `color-mix()`.
 *
 * `CSSStyleDeclaration` rejects an invalid value outright (the property keeps its
 * previous, empty value), which doubles as the validity test; the *computed* value
 * is what actually resolves a name to concrete channels, and a computed style is
 * only meaningful for an element in a document — hence the transient probe. CSS-wide
 * keywords are rejected first: CSSOM accepts them, but they would resolve against
 * whatever happens to be inherited rather than naming a colour at all.
 */
function parseViaCssom(text: string): LyraColorHsva | null {
  if (typeof document === 'undefined' || CSS_WIDE_KEYWORDS.test(text)) return null;
  const cached = cssomCache.get(text);
  if (cached !== undefined) return cached;
  const resolved = resolveViaCssom(text);
  // Bounded so a component fed a long stream of distinct colour names cannot grow this without
  // limit; the eviction order does not matter for correctness, only for hit rate.
  if (cssomCache.size >= CSSOM_CACHE_LIMIT) cssomCache.clear();
  cssomCache.set(text, resolved);
  return resolved;
}

const CSSOM_CACHE_LIMIT = 64;
const cssomCache = new Map<string, LyraColorHsva | null>();

function resolveViaCssom(text: string): LyraColorHsva | null {
  const probe = document.createElement('span');
  probe.style.color = text;
  if (probe.style.color === '') return null;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const serialized = computed.trim();
  const functional = parseFunctional(serialized);
  if (functional) return functional;

  // Modern computed colors may remain in lab()/oklch()/color() form. Canvas converts every
  // browser-supported computed color into the picker's sRGB working space without duplicating
  // the browser's color-science implementation.
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = serialized;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
  const converted = rgbToHsv(red, green, blue);
  return hsva(converted.h, converted.s, converted.v, alpha / 255);
}

/** Parses any colour this component accepts, or returns `null` when the input is not a colour. */
export function parseColor(input: string): LyraColorHsva | null {
  const text = (input ?? '').trim();
  if (text === '') return null;
  return parseHex(text) ?? parseFunctional(text) ?? parseViaCssom(text);
}

const hexByte = (channel: number): string =>
  Math.round(clamp(channel, 0, 255))
    .toString(16)
    .padStart(2, '0');

const round = (value: number): string => String(Math.round(value));

/** Two-decimal alpha, matching the alpha precision the upstream API emits. */
const alphaText = (alpha: number): string => clamp(alpha, 0, 1).toFixed(2);

/**
 * Serializes a colour in one of the eight public formats. `uppercase` applies to the
 * whole string (`#FF0000`, `RGB(255, 0, 0)`), mirroring the upstream `uppercase` contract.
 */
export function formatColor(
  color: LyraColorHsva,
  format: LyraColorPickerOutputFormat,
  uppercase = false,
): string {
  const { r, g, b } = hsvToRgb(color.h, color.s, color.v);
  let text: string;
  switch (format) {
    case 'hex':
      text = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
      break;
    case 'hexa':
      text = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}${hexByte(color.a * 255)}`;
      break;
    case 'rgb':
      text = `rgb(${round(r)}, ${round(g)}, ${round(b)})`;
      break;
    case 'rgba':
      text = `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${alphaText(color.a)})`;
      break;
    case 'hsv':
      text = `hsv(${round(color.h)}, ${round(color.s)}%, ${round(color.v)}%)`;
      break;
    case 'hsva':
      text = `hsva(${round(color.h)}, ${round(color.s)}%, ${round(color.v)}%, ${alphaText(color.a)})`;
      break;
    default: {
      const hsl = hsvToHsl(color.h, color.s, color.v);
      text =
        format === 'hsla'
          ? `hsla(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%, ${alphaText(color.a)})`
          : `hsl(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%)`;
      break;
    }
  }
  return uppercase ? text.toUpperCase() : text;
}

/** Adds the alpha-carrying variant of a base format when the alpha channel is in play. */
export function withAlphaFormat(
  format: LyraColorPickerFormat,
  includeAlpha: boolean,
): LyraColorPickerOutputFormat {
  return (includeAlpha ? `${format}a` : format) as LyraColorPickerOutputFormat;
}

/**
 * A plain `rgba()` string for use as an actual CSS paint value. Always emitted in this
 * one syntax regardless of the public `format`, because `hsv()`/`hsva()` are this
 * component's own vocabulary and mean nothing to a stylesheet.
 */
export function cssColor(color: LyraColorHsva): string {
  const { r, g, b } = hsvToRgb(color.h, color.s, color.v);
  return `rgba(${round(r)}, ${round(g)}, ${round(b)}, ${alphaText(color.a)})`;
}

/** Whether two colours are the same once rounded to the 8-bit RGBA precision the picker emits. */
export function sameColor(left: LyraColorHsva, right: LyraColorHsva): boolean {
  return formatColor(left, 'hexa') === formatColor(right, 'hexa');
}
