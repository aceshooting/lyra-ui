import { create } from 'storybook/theming';

const SHARED_BRAND = {
  brandTitle: 'Lyra UI',
  brandImage: './lyra-mark.svg',
  brandUrl: 'https://github.com/aceshooting/lyra-ui',
  brandTarget: '_blank',
  fontBase: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontCode: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
};

export const LYRA_STORYBOOK_THEMES = {
  light: create({
    ...SHARED_BRAND,
    base: 'light',
    colorPrimary: '#0969da',
    colorSecondary: '#0969da',
    appBg: '#ffffff',
    appContentBg: '#ffffff',
    appPreviewBg: '#ffffff',
    appBorderColor: '#d0d7de',
    appBorderRadius: 12,
    appHoverBg: '#f6f8fa',
    textColor: '#1a1a1a',
    textMutedColor: '#656d76',
    barBg: '#ffffff',
    barTextColor: '#6b7280',
    barSelectedColor: '#0969da',
    barHoverColor: '#1a1a1a',
    inputBg: '#ffffff',
    inputBorder: '#d0d7de',
    inputTextColor: '#1a1a1a',
  }),
  dark: create({
    ...SHARED_BRAND,
    base: 'dark',
    colorPrimary: '#4493f8',
    colorSecondary: '#4493f8',
    appBg: '#0d1117',
    appContentBg: '#0d1117',
    appPreviewBg: '#0d1117',
    appBorderColor: '#30363d',
    appBorderRadius: 12,
    appHoverBg: '#161b22',
    textColor: '#f0f6fc',
    textMutedColor: '#8b949e',
    barBg: '#0d1117',
    barTextColor: '#8b949e',
    barSelectedColor: '#4493f8',
    barHoverColor: '#f0f6fc',
    inputBg: '#161b22',
    inputBorder: '#30363d',
    inputTextColor: '#f0f6fc',
  }),
};

export function normalizeStoryThemeName(themeName) {
  return Object.hasOwn(LYRA_STORYBOOK_THEMES, themeName) ? themeName : 'dark';
}

export function storyTheme(themeName) {
  return LYRA_STORYBOOK_THEMES[normalizeStoryThemeName(themeName)];
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

/** Resolve a semantic color after the preview decorator has applied a theme. */
export function storyColor(name) {
  const property = COLOR_PROPERTIES[name];
  if (!property || typeof document === 'undefined') return 'currentColor';
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return value || `var(${property})`;
}
