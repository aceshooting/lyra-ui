import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';

// Static color copies from packages/lyra-ui/src/internal/tokens.styles.ts's --lyra-theme-*
// fallbacks. If those fallbacks change, update this file too — Storybook's manager theme API
// takes literal values, not CSS custom properties, so this can't read tokens.styles.ts directly.
const LYRA_MANAGER_THEMES = {
  light: create({
    base: 'light',
    brandTitle: 'Lyra UI',
    brandImage: '/lyra-mark.svg',
    brandUrl: 'https://github.com/aceshooting/lyra-ui',
    colorPrimary: '#0969da',
    colorSecondary: '#0969da',
    appBg: '#ffffff',
    appContentBg: '#ffffff',
    appBorderColor: '#8a8a90',
    textColor: '#1a1a1a',
    barTextColor: '#6b7280',
    barSelectedColor: '#0969da',
  }),
  dark: create({
    base: 'dark',
    brandTitle: 'Lyra UI',
    brandImage: '/lyra-mark.svg',
    brandUrl: 'https://github.com/aceshooting/lyra-ui',
    colorPrimary: '#4493f8',
    colorSecondary: '#4493f8',
    appBg: '#0d1117',
    appContentBg: '#0d1117',
    appBorderColor: '#30363d',
    textColor: '#f0f6fc',
    barTextColor: '#8b949e',
    barSelectedColor: '#4493f8',
  }),
};
// The preview's "high-contrast" theme has no distinct manager counterpart — dark reads closer
// to it than the default light chrome, so it's the better of the two available fallbacks.
LYRA_MANAGER_THEMES['high-contrast'] = LYRA_MANAGER_THEMES.dark;

addons.setConfig({
  theme: LYRA_MANAGER_THEMES.light,
});

// The preview's "Theme" toolbar global (.storybook/preview.js) only reaches the preview iframe's
// document -- the manager UI (this file's chrome: sidebar, toolbar, Docs page background) is a
// separate React app that never re-renders from that global on its own. GLOBALS_UPDATED is the
// one channel event both sides share, so re-applying setConfig here is what keeps the manager
// chrome in sync with the toolbar instead of staying permanently light.
addons.getChannel().on(GLOBALS_UPDATED, ({ globals }) => {
  const theme = Object.hasOwn(LYRA_MANAGER_THEMES, globals?.theme) ? globals.theme : 'light';
  addons.setConfig({ theme: LYRA_MANAGER_THEMES[theme] });
});
