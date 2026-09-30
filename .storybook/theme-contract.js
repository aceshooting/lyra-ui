const LYRA_STORY_THEME_NAMES = Object.freeze(['light', 'dark']);

export const STORY_PRESENTATION_DEFAULTS = Object.freeze({
  theme: 'dark',
  look: 'shadcn',
  surface: 'glass',
  accent: 'emerald',
  direction: 'ltr',
});

/** Normalize preview/manager globals without importing Storybook's manager-only theme bundle. */
export function normalizeStoryThemeName(themeName) {
  return LYRA_STORY_THEME_NAMES.includes(themeName) ? themeName : 'dark';
}

/** Resolve independent preview axes, including the explicit cleared-accent URL value. */
export function normalizeStoryPresentation(globals = {}) {
  return {
    theme: normalizeStoryThemeName(globals.theme),
    look: globals.look === 'lyra' || globals.look === 'shadcn' ? globals.look : STORY_PRESENTATION_DEFAULTS.look,
    surface: globals.surface === 'solid' || globals.surface === 'glass' ? globals.surface : STORY_PRESENTATION_DEFAULTS.surface,
    accent: globals.accent === 'none' || globals.accent === null ? null : STORY_PRESENTATION_DEFAULTS.accent,
    direction: globals.direction === 'rtl' ? 'rtl' : 'ltr',
  };
}

const COLOR_PROPERTIES = {
  surface: '--lr-theme-color-surface-default',
  text: '--lr-theme-color-text-normal',
  quiet: '--lr-theme-color-text-quiet',
  border: '--lr-theme-color-surface-border',
  brand: '--lr-theme-color-brand-fill-loud',
  brandQuiet: '--lr-theme-color-brand-fill-quiet',
  onBrand: '--lr-theme-color-brand-on-loud',
  success: '--lr-theme-color-success-fill-loud',
  successQuiet: '--lr-theme-color-success-fill-quiet',
  warning: '--lr-theme-color-warning-fill-loud',
  warningQuiet: '--lr-theme-color-warning-fill-quiet',
  danger: '--lr-theme-color-danger-fill-loud',
  dangerQuiet: '--lr-theme-color-danger-fill-quiet',
  noData: '--lr-theme-color-no-data',
  chart1: '--lr-theme-color-chart-1',
  chart2: '--lr-theme-color-chart-2',
  chart3: '--lr-theme-color-chart-3',
  chart4: '--lr-theme-color-chart-4',
};

/** Resolve any production theme property after the preview decorator has applied a mode. */
export function storyToken(property) {
  if (typeof document === 'undefined') return `var(${property})`;
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return value || `var(${property})`;
}

/** Resolve a named semantic color from the live, complete production theme. */
export function storyColor(name) {
  const property = COLOR_PROPERTIES[name];
  return property ? storyToken(property) : 'currentColor';
}
