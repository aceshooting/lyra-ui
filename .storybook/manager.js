import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';

// Static color copies from packages/lyra-ui/src/internal/tokens.styles.ts's --lr-theme-*
// fallbacks. If those fallbacks change, update this file too — Storybook's manager theme API
// takes literal values, not CSS custom properties, so this can't read tokens.styles.ts directly.
const LYRA_MANAGER_THEMES = {
  light: create({
    base: 'light',
    brandTitle: 'Lyra UI',
    brandImage: './lyra-mark.svg',
    brandUrl: 'https://github.com/aceshooting/lyra-ui',
    brandTarget: '_blank',
    colorPrimary: '#0969da',
    colorSecondary: '#0969da',
    appBg: '#ffffff',
    appContentBg: '#ffffff',
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
    base: 'dark',
    brandTitle: 'Lyra UI',
    brandImage: './lyra-mark.svg',
    brandUrl: 'https://github.com/aceshooting/lyra-ui',
    brandTarget: '_blank',
    colorPrimary: '#4493f8',
    colorSecondary: '#4493f8',
    appBg: '#0d1117',
    appContentBg: '#0d1117',
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
    base: 'light',
    brandTitle: 'Lyra UI',
    brandImage: './lyra-mark.svg',
    brandUrl: 'https://github.com/aceshooting/lyra-ui',
    brandTarget: '_blank',
    colorPrimary: '#0000ee',
    colorSecondary: '#0000ee',
    appBg: '#ffffff',
    appContentBg: '#ffffff',
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

addons.setConfig({
  theme: LYRA_MANAGER_THEMES.dark,
});

// The preview's "Theme" toolbar global (.storybook/preview.js) only reaches the preview iframe's
// document -- the manager UI (this file's chrome: sidebar, toolbar, Docs page background) is a
// separate React app that never re-renders from that global on its own. GLOBALS_UPDATED is the
// one channel event both sides share, so re-applying setConfig here is what keeps the manager
// chrome in sync with the toolbar instead of staying permanently light.
addons.getChannel().on(GLOBALS_UPDATED, ({ globals }) => {
  const theme = Object.hasOwn(LYRA_MANAGER_THEMES, globals?.theme) ? globals.theme : 'dark';
  addons.setConfig({ theme: LYRA_MANAGER_THEMES[theme] });
});
