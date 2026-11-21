import { addons } from 'storybook/manager-api';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';

import {
  LYRA_STORYBOOK_THEMES,
  normalizeStoryThemeName,
  storyTheme,
} from './story-theme.js';

// Storybook 10.6.8 schedules sibling-story preloading with an unguarded requestIdleCallback(),
// which WebKit does not implement, so every story render in Safari throws in the manager. Supply
// a macrotask fallback only where the API is missing; engines that have it keep the native one.
if (typeof globalThis.requestIdleCallback !== 'function') {
  globalThis.requestIdleCallback = (callback) =>
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 1);
  globalThis.cancelIdleCallback = (handle) => clearTimeout(handle);
}

addons.setConfig({
  theme: LYRA_STORYBOOK_THEMES.dark,
});

// The theme global originates in the preview, while the sidebar and toolbar belong to the
// manager's React application. Update the live manager API: setConfig() only establishes startup
// configuration and does not re-theme an already-mounted manager.
addons.register('lyra-theme-sync', (api) => {
  addons.getChannel().on(GLOBALS_UPDATED, ({ globals }) => {
    api.setOptions({ theme: storyTheme(normalizeStoryThemeName(globals?.theme)) });
  });
});
