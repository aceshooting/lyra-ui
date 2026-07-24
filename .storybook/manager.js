import { addons } from 'storybook/manager-api';
import { GLOBALS_UPDATED } from 'storybook/internal/core-events';

import {
  LYRA_STORYBOOK_THEMES,
  normalizeStoryThemeName,
  storyTheme,
} from './story-theme.js';

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
