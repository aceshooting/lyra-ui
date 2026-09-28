import type { LyraThemeTokens, LyraThemeTokenName } from '../theme.js';

export type LyraChartPaletteName = 'lyra' | 'shadcn' | 'material';
export type LyraChartPaletteMode = 'light' | 'dark';
/** Magnitude fills for labeled/bounded data, not contrast-qualified foreground or text colors. */
export type LyraChartScale = readonly [low: string, middle: string, high: string];
export interface LyraChartPalette {
  readonly categorical: readonly string[];
  readonly sequential: LyraChartScale;
  readonly diverging: LyraChartScale;
}

// The categorical set is shared across looks, preserving the contrast and color-vision
// separation of the established chart ramp. Ordered magnitude scales are look-specific.
/* categorical options: generated -- see scripts/generate-chart-palette.mjs */
const LIGHT_CATEGORIES = Object.freeze([
  '#0e006e', '#4d011a', '#862002', '#503983', '#315fdd', '#935e7c', '#de6906', '#8f81d3',
]);
const DARK_CATEGORIES = Object.freeze([
  '#bbff94', '#ffbce8', '#2bd66a', '#bb99cb', '#7888fe', '#9b6b90', '#db3a29', '#555de3',
]);
/* categorical options: end */

function palette(categorical: readonly string[], sequential: LyraChartScale, diverging: LyraChartScale): LyraChartPalette {
  return Object.freeze({ categorical, sequential: Object.freeze(sequential), diverging: Object.freeze(diverging) });
}

/** Optional engine-free palettes. Importing this data does not read or change document styles. */
export const LYRA_CHART_PALETTES = Object.freeze({
  lyra: Object.freeze({
    light: palette(LIGHT_CATEGORIES, ['#dbeafe', '#3b82f6', '#1e3a8a'], ['#92400e', '#f3f4f6', '#1e40af']),
    dark: palette(DARK_CATEGORIES, ['#172554', '#3b82f6', '#bfdbfe'], ['#fbbf24', '#374151', '#93c5fd']),
  }),
  shadcn: Object.freeze({
    light: palette(LIGHT_CATEGORIES, ['#e5e5e5', '#737373', '#171717'], ['#9a3412', '#f5f5f5', '#075985']),
    dark: palette(DARK_CATEGORIES, ['#262626', '#a3a3a3', '#fafafa'], ['#fdba74', '#404040', '#7dd3fc']),
  }),
  material: Object.freeze({
    light: palette(LIGHT_CATEGORIES, ['#ede9fe', '#8b5cf6', '#4c1d95'], ['#9d174d', '#f5f3ff', '#115e59']),
    dark: palette(DARK_CATEGORIES, ['#2e1065', '#8b5cf6', '#ddd6fe'], ['#f9a8d4', '#3f3f46', '#5eead4']),
  }),
}) satisfies Readonly<Record<LyraChartPaletteName, Readonly<Record<LyraChartPaletteMode, LyraChartPalette>>>>;

/** Mode-paired overrides for setLyraStyle/applyLyraStyleScope; compose with other token maps. */
export function getLyraChartPaletteTokens(name: LyraChartPaletteName): LyraThemeTokens {
  const selected = LYRA_CHART_PALETTES[name];
  const tokens: Record<LyraThemeTokenName, { readonly light: string; readonly dark: string }> = {};
  for (const kind of ['categorical', 'sequential', 'diverging'] as const) {
    selected.light[kind].forEach((light, index) => {
      const suffix = kind === 'categorical' ? `${index + 1}` : `${kind}-${index + 1}`;
      tokens[`--lr-theme-color-chart-${suffix}`] = Object.freeze({ light, dark: selected.dark[kind][index]! });
    });
  }
  return Object.freeze(tokens);
}

export type LyraChartMarker = 'circle' | 'square' | 'triangle' | 'diamond';
export interface LyraChartSeriesCue {
  readonly marker: LyraChartMarker;
  /** Canvas setLineDash values, or SVG stroke-dasharray values joined with spaces. */
  readonly dash: readonly number[];
}
const CUES: readonly LyraChartSeriesCue[] = Object.freeze(
  (['circle', 'square', 'triangle', 'diamond'] as const).flatMap(marker => [
    Object.freeze({ marker, dash: Object.freeze([] as number[]) }),
    Object.freeze({ marker, dash: Object.freeze([6, 3]) }),
  ])
);

/** Stable eight-series marker/dash cycle; pair with visible labels and accessible chart data. */
export function getLyraChartSeriesCue(index: number): LyraChartSeriesCue {
  const normalized = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return CUES[normalized % CUES.length]!;
}
