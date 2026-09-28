import { resolveCanvasColor } from '../internal/canvas-color.js';
import { finiteRange } from '../internal/numbers.js';
import { LYRA_CHART_PALETTES } from './options/charts.js';
import type { LyraChartPalette, LyraChartPaletteMode, LyraChartPaletteName, LyraChartScale } from './options/charts.js';

export interface LyraChartPaletteOptions {
  /** Explicit resolved mode, including when rendering without a document. */
  readonly mode: LyraChartPaletteMode;
  /** Palette used only for tokens absent or invalid in the supplied scope. */
  readonly palette?: LyraChartPaletteName;
}

/**
 * Reads the same live chart tokens used by SVG and resolves them for canvas as well.
 * Pass null for deterministic DOM-free palette data. No chart engine is imported.
 */
export function resolveLyraChartPalette(scope: Element | null, options: LyraChartPaletteOptions): LyraChartPalette {
  const fallback = LYRA_CHART_PALETTES[options.palette ?? 'lyra'][options.mode];
  const style = scope?.ownerDocument.defaultView?.getComputedStyle(scope);
  if (!scope || !style) return fallback;
  const resolve = (kind: 'categorical' | 'sequential' | 'diverging') => fallback[kind].map((color, index) => {
    const suffix = kind === 'categorical' ? `${index + 1}` : `${kind}-${index + 1}`;
    const value = style.getPropertyValue(`--lr-color-chart-${suffix}`).trim()
      || style.getPropertyValue(`--lr-theme-color-chart-${suffix}`).trim();
    return value ? resolveCanvasColor(scope, value, color) : color;
  });
  return Object.freeze({
    categorical: Object.freeze(resolve('categorical')),
    sequential: freezeScale(resolve('sequential')),
    diverging: freezeScale(resolve('diverging')),
  });
}

function freezeScale(colors: readonly string[]): LyraChartScale {
  return Object.freeze([colors[0]!, colors[1]!, colors[2]!]);
}

/**
 * Samples a three-stop scale at 0..1 using sRGB interpolation; 0.5 is the exact middle stop.
 * Supply the same result to canvas paint and SVG fill/stroke. Non-finite positions use zero.
 * With no DOM, stops must be six-digit hex colors (as all built-in palettes are); otherwise
 * the nearest stop is returned. Domain normalization and a diverging midpoint belong to the caller.
 */
export function sampleLyraChartScale(scope: Element | null, scale: LyraChartScale, position: number): string {
  const t = finiteRange(position, 0, 0, 1) * 2;
  if (t === 0 || t === 1 || t === 2) {
    const stop = scale[t]!;
    return scope ? resolveCanvasColor(scope, stop, stop) : stop;
  }
  const index = Math.floor(t);
  const fraction = t - index;
  const low = scale[index]!;
  const high = scale[index + 1]!;
  const nearest = fraction < 0.5 ? low : high;
  if (scope) return resolveCanvasColor(scope, `color-mix(in srgb, ${low} ${(1 - fraction) * 100}%, ${high})`, nearest);
  if (![low, high].every(color => /^#[\da-f]{6}$/i.test(color))) return nearest;
  const channels = [1, 3, 5].map(offset => {
    const start = Number.parseInt(low.slice(offset, offset + 2), 16);
    const end = Number.parseInt(high.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * fraction);
  });
  return `rgb(${channels.join(', ')})`;
}
