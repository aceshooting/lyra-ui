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
  'high-contrast': create({
    ...SHARED_BRAND,
    base: 'light',
    colorPrimary: '#0000ee',
    colorSecondary: '#0000ee',
    appBg: '#ffffff',
    appContentBg: '#ffffff',
    appPreviewBg: '#ffffff',
    appBorderColor: '#000000',
    appBorderRadius: 8,
    appHoverBg: '#ffff00',
    textColor: '#000000',
    textMutedColor: '#000000',
    barBg: '#ffffff',
    barTextColor: '#000000',
    barSelectedColor: '#0000ee',
    barHoverColor: '#000000',
    inputBg: '#ffffff',
    inputBorder: '#000000',
    inputTextColor: '#000000',
  }),
};

export const LYRA_THEME_TOKENS = {
  light: {
    '--lr-theme-color-surface-default': '#ffffff',
    '--lr-theme-color-text-normal': '#1f2328',
    '--lr-theme-color-text-quiet': '#656d76',
    '--lr-theme-color-surface-border': '#d0d7de',
    '--lr-theme-color-brand-fill-loud': '#0969da',
    '--lr-theme-color-brand-fill-quiet': '#ddf4ff',
    '--lr-theme-color-brand-on-loud': '#ffffff',
    '--lr-theme-color-success-fill-loud': '#1a7f37',
    '--lr-theme-color-success-fill-quiet': '#dafbe1',
    '--lr-theme-color-success-on-loud': '#ffffff',
    '--lr-theme-color-warning-fill-loud': '#9a6700',
    '--lr-theme-color-warning-fill-quiet': '#fff8c5',
    '--lr-theme-color-warning-on-loud': '#ffffff',
    '--lr-theme-color-danger-fill-loud': '#cf222e',
    '--lr-theme-color-danger-fill-quiet': '#ffebe9',
    '--lr-theme-color-danger-on-loud': '#ffffff',
    '--lr-theme-color-focus': '#0969da',
    '--lr-theme-color-overlay': 'rgb(0 0 0 / 50%)',
    '--lr-theme-color-no-data': 'rgb(128 128 128 / 25%)',
    '--lr-theme-color-shadow': '#000000',
    '--lr-theme-color-chart-1': '#8250df',
    '--lr-theme-color-chart-2': '#bf3989',
    '--lr-theme-color-chart-3': '#0a7d91',
    '--lr-theme-color-chart-4': '#57606a',
    '--lr-theme-color-chart-5': '#b083f5',
    '--lr-theme-color-chart-6': '#f470b8',
    '--lr-theme-color-chart-7': '#52d6e8',
    '--lr-theme-color-chart-8': '#c9d1d9',
  },
  dark: {
    '--lr-theme-color-surface-default': '#0d1117',
    '--lr-theme-color-text-normal': '#f0f6fc',
    '--lr-theme-color-text-quiet': '#8b949e',
    '--lr-theme-color-surface-border': '#30363d',
    '--lr-theme-color-brand-fill-loud': '#4493f8',
    '--lr-theme-color-brand-fill-quiet': '#1f3b5c',
    '--lr-theme-color-brand-on-loud': '#0d1117',
    '--lr-theme-color-success-fill-loud': '#3fb950',
    '--lr-theme-color-success-fill-quiet': '#17411e',
    '--lr-theme-color-success-on-loud': '#0d1117',
    '--lr-theme-color-warning-fill-loud': '#d29922',
    '--lr-theme-color-warning-fill-quiet': '#3b2900',
    '--lr-theme-color-warning-on-loud': '#0d1117',
    '--lr-theme-color-danger-fill-loud': '#f85149',
    '--lr-theme-color-danger-fill-quiet': '#4c1210',
    '--lr-theme-color-danger-on-loud': '#0d1117',
    '--lr-theme-color-focus': '#4493f8',
    '--lr-theme-color-overlay': 'rgb(0 0 0 / 72%)',
    '--lr-theme-color-no-data': 'rgb(255 255 255 / 20%)',
    '--lr-theme-color-shadow': '#000000',
    '--lr-theme-color-chart-1': '#b083f5',
    '--lr-theme-color-chart-2': '#f470b8',
    '--lr-theme-color-chart-3': '#52d6e8',
    '--lr-theme-color-chart-4': '#8b949e',
    '--lr-theme-color-chart-5': '#d2a8ff',
    '--lr-theme-color-chart-6': '#ff9bce',
    '--lr-theme-color-chart-7': '#7ee7f2',
    '--lr-theme-color-chart-8': '#c9d1d9',
  },
  'high-contrast': {
    '--lr-theme-color-surface-default': 'Canvas',
    '--lr-theme-color-text-normal': 'CanvasText',
    '--lr-theme-color-text-quiet': 'CanvasText',
    '--lr-theme-color-surface-border': 'ButtonText',
    '--lr-theme-color-brand-fill-loud': 'LinkText',
    '--lr-theme-color-brand-fill-quiet': 'Canvas',
    '--lr-theme-color-brand-on-loud': 'Canvas',
    '--lr-theme-color-success-fill-loud': 'LinkText',
    '--lr-theme-color-success-fill-quiet': 'Canvas',
    '--lr-theme-color-success-on-loud': 'Canvas',
    '--lr-theme-color-warning-fill-loud': 'CanvasText',
    '--lr-theme-color-warning-fill-quiet': 'Canvas',
    '--lr-theme-color-warning-on-loud': 'Canvas',
    '--lr-theme-color-danger-fill-loud': 'LinkText',
    '--lr-theme-color-danger-fill-quiet': 'Canvas',
    '--lr-theme-color-danger-on-loud': 'Canvas',
    '--lr-theme-color-focus': 'Highlight',
    '--lr-theme-color-overlay': 'CanvasText',
    '--lr-theme-color-no-data': 'CanvasText',
    '--lr-theme-color-shadow': 'CanvasText',
    '--lr-theme-color-chart-1': 'LinkText',
    '--lr-theme-color-chart-2': 'Highlight',
    '--lr-theme-color-chart-3': 'CanvasText',
    '--lr-theme-color-chart-4': 'ButtonText',
    '--lr-theme-color-chart-5': 'LinkText',
    '--lr-theme-color-chart-6': 'Highlight',
    '--lr-theme-color-chart-7': 'CanvasText',
    '--lr-theme-color-chart-8': 'ButtonText',
  },
};

export function normalizeStoryThemeName(themeName) {
  return Object.hasOwn(LYRA_STORYBOOK_THEMES, themeName) ? themeName : 'dark';
}

export function storyTheme(themeName) {
  return LYRA_STORYBOOK_THEMES[normalizeStoryThemeName(themeName)];
}

export function applyLyraTheme(themeName, targetDocument = globalThis.document) {
  if (!targetDocument) return;

  const theme = normalizeStoryThemeName(themeName);
  const root = targetDocument.documentElement;
  const body = targetDocument.body;
  const colorScheme = theme === 'dark' ? 'dark' : 'light';

  root.dataset.lyraTheme = theme;
  root.style.colorScheme = colorScheme;
  if (body) {
    body.dataset.lyraTheme = theme;
    body.style.colorScheme = colorScheme;
  }
  for (const [property, value] of Object.entries(LYRA_THEME_TOKENS[theme])) {
    root.style.setProperty(property, value);
  }
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
