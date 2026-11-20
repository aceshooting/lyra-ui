import { readCanvasRgba, resolveCanvasColor, toRgbaString } from './canvas-color.js';
import { finiteRange } from './numbers.js';
import { ENGINE_CHART_PALETTE, ENGINE_COLOR_TOKENS, ENGINE_STYLE_MEDIA_QUERIES, type EngineStyle } from './engine-admission.js';

export type { EngineStyle } from './engine-admission.js';

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
}

export { ENGINE_CHART_PALETTE, ENGINE_COLOR_TOKENS, ENGINE_STYLE_MEDIA_QUERIES, engineStyle } from './engine-admission.js';

interface ResolvedEngineStyle {
  readonly key: string;
  readonly style: EngineStyle;
  /** Concrete colours by theme context and token value, reused until either changes. */
  readonly colors: ReadonlyMap<string, string>;
}

const resolvedStyles = new WeakMap<Element, ResolvedEngineStyle>();

/**
 * Resolves the live design tokens, fonts, point size, line width, a bounded device pixel ratio and
 * the motion/forced-colour preferences an engine paints with, all in the host's owner window.
 * Repeated calls return the identical frozen object until one of those inputs changes, so a caller
 * can skip `setStyle()` by identity; a token value already resolved in the same theme context is
 * not probed again.
 */
export function resolveEngineStyle(host: Element, options: EngineStyleOptions = {}): EngineStyle {
  const view = host.ownerDocument.defaultView!;
  const computed = view.getComputedStyle(host);
  const measured = options.probe ? view.getComputedStyle(options.probe) : undefined;
  const [reducedMotion = false, forcedColors = false, dark = false] =
    ENGINE_STYLE_MEDIA_QUERIES.map((query) => view.matchMedia(query).matches);
  const tokens = [...ENGINE_COLOR_TOKENS, ...options.palette ?? ENGINE_CHART_PALETTE];
  const values = tokens.map((token) => computed.getPropertyValue(token).trim());
  const context = JSON.stringify([computed.color, computed.colorScheme, dark, forcedColors]);
  const key = JSON.stringify([context, tokens, values, computed.fontFamily, computed.fontSize, measured?.inlineSize,
    measured?.borderBlockStartWidth, view.devicePixelRatio, reducedMotion, options.pointSize, options.lineWidth]);
  const previous = resolvedStyles.get(host);
  if (previous?.key === key) return previous.style;

  const colors = new Map<string, string>();
  const [background, foreground, muted, accent, focus, ...palette] = tokens.map((token, index) => {
    const memo = `${context}\n${values[index]}`;
    let value = colors.get(memo) ?? previous?.colors.get(memo);
    if (value === undefined) {
      const css = resolveCanvasColor(host, `var(${token})`, computed.color);
      const rgba = readCanvasRgba(host.ownerDocument, css);
      value = rgba ? toRgbaString(rgba) : css;
    }
    colors.set(memo, value);
    return value;
  }) as [string, string, string, string, string, ...string[]];
  const pointFallback = finiteRange(options.pointSize ?? 8, 8, 1, 1024);
  const lineFallback = finiteRange(options.lineWidth ?? 1, 1, 0, 64);
  const style: EngineStyle = Object.freeze({
    background, foreground, muted, accent, focus,
    palette: Object.freeze(palette),
    fontFamily: computed.fontFamily,
    fontSize: finiteRange(Number.parseFloat(computed.fontSize), 14, 1, 128),
    pointSize: measured ? finiteRange(Number.parseFloat(measured.inlineSize), pointFallback, 1, 1024) : pointFallback,
    lineWidth: measured ? finiteRange(Number.parseFloat(measured.borderBlockStartWidth), lineFallback, 0, 64) : lineFallback,
    devicePixelRatio: finiteRange(view.devicePixelRatio, 1, 0.25, 4),
    reducedMotion,
    forcedColors,
  });
  resolvedStyles.set(host, { key, style, colors });
  return style;
}
