import { setCustomElementsManifest } from '@storybook/web-components';
// Docs/story authoring only — lr-* components' shadow DOM never sees this.
import './tailwind.css';
// Registers every lr-* custom element once, for every story — no per-story imports needed.
import '../packages/lyra-ui/src/lyra.js';
// The families above intentionally exclude components with an optional peer
// dependency (chart.js, maplibre-gl, d3-*) so consumers who import the root
// barrel never pull in those peers unconditionally. Storybook, unlike a real
// consumer, always has every peer installed and needs every component's
// story to render — so register these directly here instead.
import '../packages/lyra-ui/src/components/chart/chart.js';
import '../packages/lyra-ui/src/components/chart/bar-chart.js';
import '../packages/lyra-ui/src/components/chart/line-chart.js';
import '../packages/lyra-ui/src/components/chart/pie-chart.js';
import '../packages/lyra-ui/src/components/chart/doughnut-chart.js';
import '../packages/lyra-ui/src/components/chart/scatter-chart.js';
import '../packages/lyra-ui/src/components/chart/bubble-chart.js';
import '../packages/lyra-ui/src/components/chart/radar-chart.js';
import '../packages/lyra-ui/src/components/chart/polar-area-chart.js';
import '../packages/lyra-ui/src/components/chart/box-plot.js';
import '../packages/lyra-ui/src/components/chart/histogram.js';
import '../packages/lyra-ui/src/components/map/map.js';
import '../packages/lyra-ui/src/components/graph/graph.js';
// <lr-map>'s optional peer `maplibre-gl` ships its own CSS as a side-effect import — same
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
  if (!sessionStorage.getItem('lr-docs-reloaded-after-preload-error')) {
    sessionStorage.setItem('lr-docs-reloaded-after-preload-error', '1');
    window.location.reload();
  }
});

const LYRA_THEME_TOKENS = {
  light: {
    '--lr-theme-color-surface-default': '#ffffff',
    '--lr-theme-color-text-normal': '#1f2328',
    '--lr-theme-color-text-quiet': '#656d76',
    '--lr-theme-color-surface-border': '#d0d7de',
    '--lr-theme-color-brand-fill-loud': '#0969da',
    '--lr-theme-color-brand-fill-quiet': '#ddf4ff',
    '--lr-theme-color-brand-on-loud': '#ffffff',
    '--lr-theme-color-success-fill-loud': '#1a7f37',
    '--lr-theme-color-success-fill-quiet': '#dafbe1',
    '--lr-theme-color-success-on-loud': '#ffffff',
    '--lr-theme-color-warning-fill-loud': '#9a6700',
    '--lr-theme-color-warning-fill-quiet': '#fff8c5',
    '--lr-theme-color-warning-on-loud': '#ffffff',
    '--lr-theme-color-danger-fill-loud': '#cf222e',
    '--lr-theme-color-danger-fill-quiet': '#ffebe9',
    '--lr-theme-color-danger-on-loud': '#ffffff',
    '--lr-theme-color-focus': '#0969da',
    '--lr-theme-color-overlay': 'rgb(0 0 0 / 50%)',
    '--lr-theme-color-no-data': 'rgb(128 128 128 / 25%)',
    '--lr-theme-color-shadow': '#000000',
    '--lr-theme-color-chart-1': '#8250df',
    '--lr-theme-color-chart-2': '#bf3989',
    '--lr-theme-color-chart-3': '#0a7d91',
    '--lr-theme-color-chart-4': '#57606a',
    '--lr-theme-color-chart-5': '#b083f5',
    '--lr-theme-color-chart-6': '#f470b8',
    '--lr-theme-color-chart-7': '#52d6e8',
    '--lr-theme-color-chart-8': '#c9d1d9',
  },
  dark: {
    '--lr-theme-color-surface-default': '#0d1117',
    '--lr-theme-color-text-normal': '#f0f6fc',
    '--lr-theme-color-text-quiet': '#8b949e',
    '--lr-theme-color-surface-border': '#30363d',
    '--lr-theme-color-brand-fill-loud': '#4493f8',
    '--lr-theme-color-brand-fill-quiet': '#1f3b5c',
    '--lr-theme-color-brand-on-loud': '#0d1117',
    '--lr-theme-color-success-fill-loud': '#3fb950',
    '--lr-theme-color-success-fill-quiet': '#17411e',
    '--lr-theme-color-success-on-loud': '#0d1117',
    '--lr-theme-color-warning-fill-loud': '#d29922',
    '--lr-theme-color-warning-fill-quiet': '#3b2900',
    '--lr-theme-color-warning-on-loud': '#0d1117',
    '--lr-theme-color-danger-fill-loud': '#f85149',
    '--lr-theme-color-danger-fill-quiet': '#4c1210',
    '--lr-theme-color-danger-on-loud': '#0d1117',
    '--lr-theme-color-focus': '#4493f8',
    '--lr-theme-color-overlay': 'rgb(0 0 0 / 72%)',
    '--lr-theme-color-no-data': 'rgb(255 255 255 / 20%)',
    '--lr-theme-color-shadow': '#000000',
    '--lr-theme-color-chart-1': '#b083f5',
    '--lr-theme-color-chart-2': '#f470b8',
    '--lr-theme-color-chart-3': '#52d6e8',
    '--lr-theme-color-chart-4': '#8b949e',
    '--lr-theme-color-chart-5': '#d2a8ff',
    '--lr-theme-color-chart-6': '#ff9bce',
    '--lr-theme-color-chart-7': '#7ee7f2',
    '--lr-theme-color-chart-8': '#c9d1d9',
  },
  'high-contrast': {
    '--lr-theme-color-surface-default': 'Canvas',
    '--lr-theme-color-text-normal': 'CanvasText',
    '--lr-theme-color-text-quiet': 'CanvasText',
    '--lr-theme-color-surface-border': 'ButtonText',
    '--lr-theme-color-brand-fill-loud': 'LinkText',
    '--lr-theme-color-brand-fill-quiet': 'Canvas',
    '--lr-theme-color-brand-on-loud': 'Canvas',
    '--lr-theme-color-success-fill-loud': 'LinkText',
    '--lr-theme-color-success-fill-quiet': 'Canvas',
    '--lr-theme-color-success-on-loud': 'Canvas',
    '--lr-theme-color-warning-fill-loud': 'CanvasText',
    '--lr-theme-color-warning-fill-quiet': 'Canvas',
    '--lr-theme-color-warning-on-loud': 'Canvas',
    '--lr-theme-color-danger-fill-loud': 'LinkText',
    '--lr-theme-color-danger-fill-quiet': 'Canvas',
    '--lr-theme-color-danger-on-loud': 'Canvas',
    '--lr-theme-color-focus': 'Highlight',
    '--lr-theme-color-overlay': 'CanvasText',
    '--lr-theme-color-no-data': 'CanvasText',
    '--lr-theme-color-shadow': 'CanvasText',
    '--lr-theme-color-chart-1': 'LinkText',
    '--lr-theme-color-chart-2': 'Highlight',
    '--lr-theme-color-chart-3': 'CanvasText',
    '--lr-theme-color-chart-4': 'ButtonText',
    '--lr-theme-color-chart-5': 'LinkText',
    '--lr-theme-color-chart-6': 'Highlight',
    '--lr-theme-color-chart-7': 'CanvasText',
    '--lr-theme-color-chart-8': 'ButtonText',
  },
};

function applyLyraTheme(themeName) {
  const theme = Object.hasOwn(LYRA_THEME_TOKENS, themeName) ? themeName : 'light';
  const root = document.documentElement;
  const body = document.body;
  const colorScheme = theme === 'dark' ? 'dark' : 'light';

  root.dataset.lyraTheme = theme;
  root.style.colorScheme = colorScheme;
  if (body) {
    body.dataset.lyraTheme = theme;
    body.style.colorScheme = colorScheme;
  }
  for (const [property, value] of Object.entries(LYRA_THEME_TOKENS[theme])) {
    root.style.setProperty(property, value);
  }
}

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
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Lyra semantic color theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
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
      defaultValue: 'ltr',
      toolbar: {
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
      },
    },
    density: {
      name: 'Density',
      description: 'Choose the amount of breathing room around story examples.',
      defaultValue: 'comfortable',
      toolbar: {
        icon: 'expand',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
      },
    },
  },
  decorators: [withLyraTheme],
  parameters: {
    controls: {
      expanded: true,
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    docs: {
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
