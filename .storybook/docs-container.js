import { DocsContainer } from '@storybook/addon-docs/blocks';
import { createElement, useEffect, useLayoutEffect, useState } from 'react';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';

import { applyLyraTheme, normalizeStoryThemeName, storyTheme } from './story-theme.js';

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
    document.documentElement.dataset.lyraTheme ?? themeFromUrl(),
  );
}

export function LyraDocsContainer({ context, children }) {
  const [themeName, setThemeName] = useState(() => initialThemeName(context));

  useLayoutEffect(() => {
    applyLyraTheme(themeName);
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
    { context, theme: storyTheme(themeName) },
    children,
  );
}
