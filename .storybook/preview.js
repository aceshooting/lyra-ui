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
