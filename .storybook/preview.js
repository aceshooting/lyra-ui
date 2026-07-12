import { setCustomElementsManifest } from '@storybook/web-components';
// Docs/story authoring only — lyra-* components' shadow DOM never sees this.
import './tailwind.css';
// Registers every lyra-* custom element once, for every story — no per-story imports needed.
import '../packages/lyra-ui/src/lyra.js';
// <lyra-map>'s optional peer `maplibre-gl` ships its own CSS as a side-effect import — same
// requirement as the old docs/ playground had.
import 'maplibre-gl/dist/maplibre-gl.css';
// Drives the autodocs prop/event/slot tables — regenerate via `pnpm --filter
// @aceshooting/lyra-ui run manifest` whenever a component's public API changes.
import customElements from '../packages/lyra-ui/custom-elements.json';

setCustomElementsManifest(customElements);

// deploy-docs.yml redeploys on every push to main, fully replacing storybook-static's
// content-hashed chunks. A tab that's had the docs open across a redeploy can still hold a
// cached iframe bundle referencing a story chunk hash the new deploy already deleted, so the
// dynamic import 404s ("Failed to fetch dynamically imported module"). Vite's preload-helper
// (bundled into iframe.html) dispatches this event in exactly that case; reload once to pick up
// the current build. Guarded via sessionStorage since reload re-executes this file from scratch,
// so an in-memory flag would never survive the reload and could loop forever on a genuinely
// broken deploy.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('lyra-docs-reloaded-after-preload-error')) {
    sessionStorage.setItem('lyra-docs-reloaded-after-preload-error', '1');
    window.location.reload();
  }
});

/** @type { import('@storybook/web-components-vite').Preview } */
const preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
  },
};

export default preview;
