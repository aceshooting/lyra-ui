import type { Lyra3dStyle } from './contract.js';

/** An sRGB color with every channel in `[0, 1]`. */
export interface Lyra3dRgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** {@link Lyra3dStyle} with parsed colors and every number clamped to a usable range. */
export interface ResolvedLyra3dStyle {
  readonly background: Lyra3dRgba;
  readonly foreground: Lyra3dRgba;
  readonly muted: Lyra3dRgba;
  readonly accent: Lyra3dRgba;
  readonly focus: Lyra3dRgba;
  /** Never empty. */
  readonly palette: readonly Lyra3dRgba[];
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly pointSize: number;
  readonly lineWidth: number;
  readonly devicePixelRatio: number;
  readonly reducedMotion: boolean;
  readonly forcedColors: boolean;
}

/** Used for any field a component leaves out or supplies in an unusable form. */
export const DEFAULT_LYRA_3D_STYLE: Lyra3dStyle = Object.freeze({
  background: 'rgba(0, 0, 0, 0)',
  foreground: '#1b1f24',
  muted: '#6b7280',
  accent: '#035ec6',
  focus: '#035ec6',
  palette: Object.freeze(['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7']),
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  pointSize: 6,
  lineWidth: 1,
  devicePixelRatio: 1,
  reducedMotion: false,
  forcedColors: false,
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(%?)$/iu;

/** Parses one channel: a number on `scale` (255 for rgb, 1 for color()) or a percentage. */
function channel(token: string, scale: number): number | null {
  if (token === 'none') return 0;
  const match = NUMBER.exec(token);
  if (!match) return null;
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) return null;
  return clamp(match[1] === '%' ? value / 100 : value / scale, 0, 1);
}

/** Splits a functional color body into its channel tokens and optional alpha token. */
function functionTokens(body: string): { channels: string[]; alpha?: string } | null {
  const trimmed = body.trim();
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return null;
    const [first = '', second = '', third = '', alpha] = parts;
    return alpha === undefined ? { channels: [first, second, third] } : { channels: [first, second, third], alpha };
  }
  const [main = '', alpha, extra] = trimmed.split('/').map((part) => part.trim());
  if (extra !== undefined) return null;
  const channels = main.split(/\s+/u).filter(Boolean);
  return alpha === undefined ? { channels } : { channels, alpha };
}

/**
 * Parses the concrete color forms `getComputedStyle` and a canvas color probe produce: `#hex`
 * (3, 4, 6 or 8 digits), `rgb()`/`rgba()` in comma or space syntax, `color(srgb ...)` and
 * `transparent`. Returns `null` for anything else, including unresolved `var()` expressions.
 */
export function parseCssColor(value: unknown): Lyra3dRgba | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return Object.freeze({ r: 0, g: 0, b: 0, a: 0 });
  const hex = HEX.exec(text);
  if (hex) {
    const digits = hex[1] as string;
    const expanded = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits;
    const byte = (index: number) => Number.parseInt(expanded.slice(index * 2, index * 2 + 2), 16) / 255;
    return Object.freeze({ r: byte(0), g: byte(1), b: byte(2), a: expanded.length === 8 ? byte(3) : 1 });
  }
  const rgb = /^rgba?\((.*)\)$/u.exec(text);
  const srgb = /^color\(\s*srgb\s+(\S.*)\)$/u.exec(text);
  const body = rgb?.[1] ?? srgb?.[1];
  if (body === undefined) return null;
  const tokens = functionTokens(body);
  if (!tokens || tokens.channels.length !== 3) return null;
  const scale = rgb ? 255 : 1;
  const [r, g, b] = tokens.channels.map((token) => channel(token, scale));
  const a = tokens.alpha === undefined ? 1 : channel(tokens.alpha, 1);
  if (r == null || g == null || b == null || a == null) return null;
  return Object.freeze({ r, g, b, a });
}

function color(value: unknown, fallback: string): Lyra3dRgba {
  return parseCssColor(value) ?? (parseCssColor(fallback) as Lyra3dRgba);
}

function finite(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function own(source: unknown, key: keyof Lyra3dStyle): unknown {
  if (typeof source !== 'object' || source === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

/**
 * Resolves a style from an untrusted source. Only own data properties are read, unusable fields
 * fall back to {@link DEFAULT_LYRA_3D_STYLE}, and the palette always keeps at least one color.
 */
export function resolveLyra3dStyle(style: unknown): ResolvedLyra3dStyle {
  const defaults = DEFAULT_LYRA_3D_STYLE;
  const rawPalette = own(style, 'palette');
  const palette = Array.isArray(rawPalette)
    ? rawPalette.slice(0, 256).map((entry) => parseCssColor(entry)).filter((entry): entry is Lyra3dRgba => entry !== null)
    : [];
  const fontFamily = own(style, 'fontFamily');
  return Object.freeze({
    background: color(own(style, 'background'), defaults.background),
    foreground: color(own(style, 'foreground'), defaults.foreground),
    muted: color(own(style, 'muted'), defaults.muted),
    accent: color(own(style, 'accent'), defaults.accent),
    focus: color(own(style, 'focus'), defaults.focus),
    palette: Object.freeze(palette.length > 0 ? palette : defaults.palette.map((entry) => color(entry, '#000'))),
    fontFamily: typeof fontFamily === 'string' && fontFamily.trim() ? fontFamily.trim() : defaults.fontFamily,
    fontSize: finite(own(style, 'fontSize'), defaults.fontSize, 1, 256),
    pointSize: finite(own(style, 'pointSize'), defaults.pointSize, 0, 1024),
    lineWidth: finite(own(style, 'lineWidth'), defaults.lineWidth, 0, 64),
    devicePixelRatio: finite(own(style, 'devicePixelRatio'), defaults.devicePixelRatio, 0.25, 4),
    reducedMotion: own(style, 'reducedMotion') === true,
    forcedColors: own(style, 'forcedColors') === true,
  });
}
