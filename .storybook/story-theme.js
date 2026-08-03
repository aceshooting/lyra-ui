import { create } from 'storybook/theming';
import { normalizeStoryThemeName } from './theme-contract.js';

export { normalizeStoryThemeName } from './theme-contract.js';

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

export function storyTheme(themeName) {
  return LYRA_STORYBOOK_THEMES[normalizeStoryThemeName(themeName)];
}
