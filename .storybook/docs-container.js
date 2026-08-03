import { DocsContainer } from '@storybook/addon-docs/blocks';
import { createElement, useEffect, useLayoutEffect, useState } from 'react';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';
import { create } from 'storybook/theming';
import { setLyraTheme } from '../packages/lyra-ui/src/theme/theme.js';

import { normalizeStoryThemeName, storyColor, storyToken } from './theme-contract.js';

function productionDocsTheme(themeName) {
  return create({
    base: normalizeStoryThemeName(themeName),
    colorPrimary: storyColor('brand'),
    colorSecondary: storyColor('brand'),
    appBg: storyColor('surface'),
    appContentBg: storyColor('surface'),
    appPreviewBg: storyColor('surface'),
    appBorderColor: storyColor('border'),
    appHoverBg: storyColor('brandQuiet'),
    textColor: storyColor('text'),
    textMutedColor: storyColor('quiet'),
    barBg: storyColor('surface'),
    barTextColor: storyColor('quiet'),
    barSelectedColor: storyColor('brand'),
    barHoverColor: storyColor('text'),
    inputBg: storyColor('surface'),
    inputBorder: storyColor('border'),
    inputTextColor: storyColor('text'),
    fontBase: storyToken('--lr-theme-font-family-body'),
    fontCode: storyToken('--lr-theme-font-family-mono'),
  });
}

function themeFromUrl() {
  try {
    const globals = new URL(window.parent.location.href).searchParams.get('globals') ?? '';
    const match = globals.match(/(?:^|;)theme:([^;]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function initialThemeName(context) {
  try {
    const story = context.componentStories()[0];
    if (story) return normalizeStoryThemeName(context.getStoryContext(story).globals.theme);
  } catch {
    // An unattached MDX page has no component story; use its URL/document state below.
  }

  return normalizeStoryThemeName(
    document.documentElement.dataset.lrTheme ?? themeFromUrl(),
  );
}

export function LyraDocsContainer({ context, children }) {
  const [themeName, setThemeName] = useState(() => initialThemeName(context));
  const [docsTheme, setDocsTheme] = useState(() => productionDocsTheme(themeName));

  useLayoutEffect(() => {
    setLyraTheme({ mode: themeName, accent: null });
    setDocsTheme(productionDocsTheme(themeName));
  }, [themeName]);

  useEffect(() => {
    const onGlobalsUpdated = ({ globals }) => {
      setThemeName(normalizeStoryThemeName(globals?.theme));
    };
    context.channel.on(GLOBALS_UPDATED, onGlobalsUpdated);
    return () => context.channel.off(GLOBALS_UPDATED, onGlobalsUpdated);
  }, [context.channel]);

  return createElement(
    DocsContainer,
    { context, theme: docsTheme },
    children,
  );
}
