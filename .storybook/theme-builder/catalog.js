import localeManifest from '../../packages/lyra-ui/locales.json';
import designTokens from '../../packages/lyra-ui/design-tokens.json';
import { LYRA_SHAPE_PRESETS } from '../../packages/lyra-ui/src/theme/options/shape.js';
import { LYRA_TYPOGRAPHY_PRESETS } from '../../packages/lyra-ui/src/theme/options/typography.js';
import { LYRA_ELEVATION_PRESETS } from '../../packages/lyra-ui/src/theme/options/elevation.js';
import { LYRA_CHART_PALETTES, getLyraChartPaletteTokens } from '../../packages/lyra-ui/src/theme/options/charts.js';
import { BUILDER_MOTION_PRESETS, BUILDER_FONT_PAIRS } from './option-data.js';

export const FIELD_GROUPS = Object.freeze({
  motion: ['duration-fast', 'duration-normal', 'duration-slow', 'duration-icon', 'easing-standard', 'easing-emphasized'],
  typography: ['font-family-heading', 'font-family-body', 'font-family-mono', 'font-size-m', 'font-size-xl', 'font-size-2xl', 'font-weight-normal', 'font-weight-bold', 'heading-letter-spacing', 'line-height-compact', 'line-height-snug', 'line-height-normal', 'line-height-loose'],
  shape: ['border-radius-xs', 'border-radius-m', 'border-radius-button', 'border-radius-container', 'form-control-radius'],
  elevation: ['shadow-xs', 'shadow-s', 'shadow-m', 'shadow-l', 'shadow-xl', 'shadow-color', 'color-surface-container-lowest', 'color-surface-container-low', 'color-surface-container', 'color-surface-container-high', 'color-surface-container-highest'],
  palette: [...Array.from({ length: 8 }, (_, i) => `color-chart-${i + 1}`), ...['sequential', 'diverging'].flatMap(kind => [1, 2, 3].map(i => `color-chart-${kind}-${i}`))],
});

export function createCatalog(defineLyraLook) {
  const extension = designTokens.$extensions['com.aceshooting.lyra.looks'];
  if (extension.schemaVersion !== 1) throw new Error('Unsupported look interchange');
  const looks = Object.values(extension.definitions).map(value => defineLyraLook(value));
  return Object.freeze({ looks, locales: localeManifest.locales.filter(entry => entry.kind !== 'testing-only'), runtimeFallbacks: localeManifest.runtimeFallbacks, shape: LYRA_SHAPE_PRESETS, typography: LYRA_TYPOGRAPHY_PRESETS,
    elevation: LYRA_ELEVATION_PRESETS, motion: BUILDER_MOTION_PRESETS, fontPairs: BUILDER_FONT_PAIRS,
    palette: Object.fromEntries(Object.keys(LYRA_CHART_PALETTES).map(id => [id, getLyraChartPaletteTokens(id)])) });
}
