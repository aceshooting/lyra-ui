import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

// Static color copies from packages/lyra-ui/src/internal/tokens.styles.ts's --lyra-theme-*
// fallbacks. If those fallbacks change, update this file too — Storybook's manager theme API
// takes literal values, not CSS custom properties, so this can't read tokens.styles.ts directly.
const lyraTheme = create({
  base: 'light',
  brandTitle: 'Lyra UI',
  brandUrl: 'https://github.com/aceshooting/lyra-ui',
  colorPrimary: '#0969da',
  colorSecondary: '#0969da',
  appBg: '#ffffff',
  appContentBg: '#ffffff',
  appBorderColor: '#8a8a90',
  textColor: '#1a1a1a',
  barTextColor: '#6b7280',
  barSelectedColor: '#0969da',
});

addons.setConfig({
  theme: lyraTheme,
});
