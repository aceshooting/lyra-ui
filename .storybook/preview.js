import { setCustomElementsManifest } from '@storybook/web-components';
import { LyraDocsContainer } from './docs-container.js';
import { publicStorybookManifest } from './storybook-manifest.js';
import { applyLyraTheme } from './story-theme.js';
// Docs/story authoring only — lr-* components' shadow DOM never sees this.
import './tailwind.css';
// Registers every lr-* custom element once, for every story — no per-story imports needed.
import '../packages/lyra-ui/src/lyra.js';
// The families above intentionally exclude components with an optional peer
// dependency (chart.js, maplibre-gl, d3-*) so consumers who import the root
// barrel never pull in those peers unconditionally. Storybook, unlike a real
// consumer, always has every peer installed and needs every component's
// story to render — so register these directly here instead.
import '../packages/lyra-ui/src/components/charts/chart/chart.js';
import '../packages/lyra-ui/src/components/charts/chart/bar-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/line-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/pie-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/doughnut-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/scatter-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/bubble-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/radar-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/polar-area-chart.js';
import '../packages/lyra-ui/src/components/charts/chart/box-plot.js';
import '../packages/lyra-ui/src/components/charts/chart/histogram.js';
import '../packages/lyra-ui/src/components/media/map/map.js';
import '../packages/lyra-ui/src/components/retrieval/graph/graph.js';
// <lr-map>'s optional peer `maplibre-gl` ships its own CSS as a side-effect import — same
// requirement as the old docs/ playground had.
import 'maplibre-gl/dist/maplibre-gl.css';
// Drives the autodocs prop/event/slot tables — regenerate via `pnpm --filter
// @aceshooting/lyra-ui run manifest` whenever a component's public API changes.
import customElements from '../packages/lyra-ui/custom-elements.json';

setCustomElementsManifest(publicStorybookManifest(customElements));

// deploy-docs.yml redeploys on every push to main, fully replacing storybook-static's
// content-hashed chunks. A tab that's had the docs open across a redeploy can still hold a
// cached iframe bundle referencing a story chunk hash the new deploy already deleted, so the
// dynamic import 404s ("Failed to fetch dynamically imported module"). Vite's preload-helper
// (bundled into iframe.html) dispatches this event in exactly that case; reload once to pick up
// the current build. Guarded via sessionStorage since reload re-executes this file from scratch,
// so an in-memory flag would never survive the reload and could loop forever on a genuinely
// broken deploy.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('lr-docs-reloaded-after-preload-error')) {
    sessionStorage.setItem('lr-docs-reloaded-after-preload-error', '1');
    window.location.reload();
  }
});

function applyLyraPresentation(globals) {
  const direction = globals.direction === 'rtl' ? 'rtl' : 'ltr';
  const density = globals.density === 'compact' ? 'compact' : 'comfortable';
  const root = document.documentElement;

  root.dir = direction;
  root.dataset.lyraDirection = direction;
  root.dataset.lyraDensity = density;
  root.style.setProperty('--lr-docs-density-gap', density === 'compact' ? '.625rem' : '1rem');
}

const withLyraTheme = (story, context) => {
  applyLyraTheme(context.globals.theme);
  applyLyraPresentation(context.globals);
  return story();
};

/** @type { import('@storybook/web-components-vite').Preview } */
const preview = {
  // Generate a component docs page for every story file by default. Individual
  // story files may still add or override tags when a page needs special handling.
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Lyra semantic color theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'high-contrast', title: 'High contrast' },
        ],
      },
    },
    direction: {
      name: 'Direction',
      description: 'Preview the component in left-to-right or right-to-left layout.',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        dynamicTitle: true,
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
      },
    },
    density: {
      name: 'Density',
      description: 'Choose the amount of breathing room around story examples.',
      toolbar: {
        title: 'Density',
        icon: 'expand',
        dynamicTitle: true,
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
    direction: 'ltr',
    density: 'comfortable',
  },
  decorators: [withLyraTheme],
  parameters: {
    controls: {
      expanded: true,
      // Match conventional story args only. CSS custom properties such as
      // --lr-lightbox-control-color are documented tokens, not color controls.
      matchers: { color: /^(background|color)$/i, date: /Date$/i },
    },
    docs: {
      container: LyraDocsContainer,
      toc: { headingSelector: 'h2, h3' },
    },
    // @storybook/addon-a11y's afterEach hook otherwise auto-runs axe-core on
    // every story render, racing with scripts/check-storybook.mjs's own
    // manual axe.run() calls on the same document ("Axe is already running").
    // check-storybook.mjs is this project's actual a11y gate, so disable the
    // addon's automatic pass instead of running two axe scans concurrently.
    a11y: { test: 'off' },
  },
};

export default preview;
