import { readCanvasRgba, resolveCanvasColor, toRgbaString } from './canvas-color.js';
import { finiteRange } from './numbers.js';
import { ENGINE_STYLE_MEDIA_QUERIES } from './engine-admission.js';

/**
 * Plain style values an optional WebGL engine paints with: concrete CSS colour strings and CSS
 * pixels. Owned structurally here so the optional companion's declarations stay out of this
 * library's public type graph.
 */
export interface EngineStyle {
  readonly background: string;
  readonly foreground: string;
  readonly muted: string;
  readonly accent: string;
  readonly focus: string;
  /** Categorical colours, indexed by an item's category. */
  readonly palette: readonly string[];
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly pointSize: number;
  readonly lineWidth: number;
  readonly devicePixelRatio: number;
  readonly reducedMotion: boolean;
  readonly forcedColors: boolean;
}

export interface EngineStyleOptions {
  /** Custom properties resolved into `palette`, in order. Defaults to {@link ENGINE_CHART_PALETTE}. */
  readonly palette?: readonly string[];
  /** Point size in CSS pixels when no `probe` carries it, or when the probe's is unusable. Defaults to 8. */
  readonly pointSize?: number;
  /** Line width in CSS pixels when no `probe` carries it. Defaults to 1. */
  readonly lineWidth?: number;
  /**
   * An element whose computed `inline-size` and `border-block-start-width` carry the point-size
   * and line-width tokens, so their units resolve live.
   */
  readonly probe?: Element | null;
  /** Values the caller already resolved (a graph's paint, for example); used verbatim, never probed. */
  readonly overrides?: Partial<EngineStyle>;
}

/** The categorical chart tokens, in palette order. */
export const ENGINE_CHART_PALETTE: readonly string[] = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `--lr-color-chart-${index + 1}`),
);

export { ENGINE_STYLE_MEDIA_QUERIES } from './engine-admission.js';

type ColorField = 'background' | 'foreground' | 'muted' | 'accent' | 'focus';

const COLOR_TOKENS: ReadonlyArray<readonly [ColorField, string]> = [
  ['background', '--lr-color-surface'],
  ['foreground', '--lr-color-text'],
  ['muted', '--lr-color-text-quiet'],
  ['accent', '--lr-color-brand'],
  ['focus', '--lr-focus-ring-color'],
];

interface ResolvedEngineStyle {
  readonly key: string;
  readonly style: EngineStyle;
  /** Concrete colours by theme context and token value, reused until either changes. */
  readonly colors: ReadonlyMap<string, string>;
}

const resolvedStyles = new WeakMap<Element, ResolvedEngineStyle>();

/** Without a browsing context nothing resolves; empty colours leave the engine on its defaults. */
function windowlessStyle(options: EngineStyleOptions): EngineStyle {
  const overrides = options.overrides ?? {};
  const color = (field: ColorField): string => overrides[field] ?? '';
  return Object.freeze({
    background: color('background'),
    foreground: color('foreground'),
    muted: color('muted'),
    accent: color('accent'),
    focus: color('focus'),
    palette: Object.freeze([...(overrides.palette ?? [])]),
    fontFamily: overrides.fontFamily ?? '',
    fontSize: overrides.fontSize ?? 14,
    pointSize: overrides.pointSize ?? finiteRange(options.pointSize ?? 8, 8, 1, 1024),
    lineWidth: overrides.lineWidth ?? finiteRange(options.lineWidth ?? 1, 1, 0, 64),
    devicePixelRatio: overrides.devicePixelRatio ?? 1,
    reducedMotion: overrides.reducedMotion ?? true,
    forcedColors: overrides.forcedColors ?? false,
  });
}

/**
 * Resolves the live design tokens, fonts, point size, line width, a bounded device pixel ratio and
 * the motion/forced-colour preferences an engine paints with, all in the host's owner window.
 * Repeated calls return the identical frozen object until one of those inputs changes, so a caller
 * can skip `setStyle()` by identity; a token value already resolved in the same theme context is
 * not probed again.
 */
export function resolveEngineStyle(host: Element, options: EngineStyleOptions = {}): EngineStyle {
  const view = host.ownerDocument.defaultView;
  if (!view) return windowlessStyle(options);
  const overrides = options.overrides ?? {};
  const computed = view.getComputedStyle(host);
  const measured = options.probe ? view.getComputedStyle(options.probe) : undefined;
  const [reducedMotion = false, forcedColors = false, dark = false] =
    ENGINE_STYLE_MEDIA_QUERIES.map((query) => view.matchMedia(query).matches);
  const fields = COLOR_TOKENS.filter(([field]) => overrides[field] === undefined);
  const paletteTokens = overrides.palette === undefined ? options.palette ?? ENGINE_CHART_PALETTE : [];
  const tokens = [...fields.map(([, token]) => token), ...paletteTokens];
  const values = tokens.map((token) => computed.getPropertyValue(token).trim());
  const context = tokens.length ? JSON.stringify([computed.color, computed.colorScheme, dark, forcedColors]) : '';
  const font = overrides.fontFamily === undefined || overrides.fontSize === undefined
    ? [computed.fontFamily, computed.fontSize]
    : [];
  const key = JSON.stringify([context, tokens, values, font, measured?.inlineSize, measured?.borderBlockStartWidth,
    view.devicePixelRatio, reducedMotion, forcedColors, options.pointSize, options.lineWidth, overrides]);
  const previous = resolvedStyles.get(host);
  if (previous?.key === key) return previous.style;

  const colors = new Map<string, string>();
  const resolved = tokens.map((token, index) => {
    const memo = `${context}\n${values[index]}`;
    let value = colors.get(memo) ?? previous?.colors.get(memo);
    if (value === undefined) {
      const css = resolveCanvasColor(host, `var(${token})`, computed.color);
      const rgba = readCanvasRgba(host.ownerDocument, css);
      value = rgba ? toRgbaString(rgba) : css;
    }
    colors.set(memo, value);
    return value;
  });
  const color = new Map(fields.map(([field], index): [ColorField, string] => [field, resolved[index]!]));
  const pick = (field: ColorField): string => overrides[field] ?? color.get(field)!;
  const pointFallback = finiteRange(options.pointSize ?? 8, 8, 1, 1024);
  const lineFallback = finiteRange(options.lineWidth ?? 1, 1, 0, 64);
  const style: EngineStyle = Object.freeze({
    background: pick('background'),
    foreground: pick('foreground'),
    muted: pick('muted'),
    accent: pick('accent'),
    focus: pick('focus'),
    palette: Object.freeze([...(overrides.palette ?? resolved.slice(fields.length))]),
    fontFamily: overrides.fontFamily ?? computed.fontFamily,
    fontSize: overrides.fontSize ?? finiteRange(Number.parseFloat(computed.fontSize), 14, 1, 128),
    pointSize: overrides.pointSize
      ?? (measured ? finiteRange(Number.parseFloat(measured.inlineSize), pointFallback, 1, 1024) : pointFallback),
    lineWidth: overrides.lineWidth
      ?? (measured ? finiteRange(Number.parseFloat(measured.borderBlockStartWidth), lineFallback, 0, 64) : lineFallback),
    devicePixelRatio: overrides.devicePixelRatio ?? finiteRange(view.devicePixelRatio, 1, 0.25, 4),
    reducedMotion: overrides.reducedMotion ?? reducedMotion,
    forcedColors: overrides.forcedColors ?? forcedColors,
  });
  resolvedStyles.set(host, { key, style, colors });
  return style;
}
