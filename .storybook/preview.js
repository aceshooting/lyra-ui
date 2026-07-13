import { setCustomElementsManifest } from '@storybook/web-components';
// Docs/story authoring only — lyra-* components' shadow DOM never sees this.
import './tailwind.css';
// Registers every lyra-* custom element once, for every story — no per-story imports needed.
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

const LYRA_THEME_TOKENS = {
  light: {
    '--wa-color-surface-default': '#ffffff',
    '--wa-color-text-normal': '#1f2328',
    '--wa-color-text-quiet': '#656d76',
    '--wa-color-surface-border': '#d0d7de',
    '--wa-color-brand-fill-loud': '#0969da',
    '--wa-color-brand-fill-quiet': '#ddf4ff',
    '--wa-color-brand-on-loud': '#ffffff',
    '--wa-color-success-fill-loud': '#1a7f37',
    '--wa-color-success-fill-quiet': '#dafbe1',
    '--wa-color-success-on-loud': '#ffffff',
    '--wa-color-warning-fill-loud': '#9a6700',
    '--wa-color-warning-fill-quiet': '#fff8c5',
    '--wa-color-warning-on-loud': '#ffffff',
    '--wa-color-danger-fill-loud': '#cf222e',
    '--wa-color-danger-fill-quiet': '#ffebe9',
    '--wa-color-danger-on-loud': '#ffffff',
    '--wa-color-focus': '#0969da',
    '--wa-color-overlay': 'rgb(0 0 0 / 50%)',
    '--wa-color-no-data': 'rgb(128 128 128 / 25%)',
    '--wa-color-shadow': '#000000',
    '--wa-color-chart-1': '#8250df',
    '--wa-color-chart-2': '#bf3989',
    '--wa-color-chart-3': '#0a7d91',
    '--wa-color-chart-4': '#57606a',
    '--wa-color-chart-5': '#b083f5',
    '--wa-color-chart-6': '#f470b8',
    '--wa-color-chart-7': '#52d6e8',
    '--wa-color-chart-8': '#c9d1d9',
  },
  dark: {
    '--wa-color-surface-default': '#0d1117',
    '--wa-color-text-normal': '#f0f6fc',
    '--wa-color-text-quiet': '#8b949e',
    '--wa-color-surface-border': '#30363d',
    '--wa-color-brand-fill-loud': '#4493f8',
    '--wa-color-brand-fill-quiet': '#1f3b5c',
    '--wa-color-brand-on-loud': '#0d1117',
    '--wa-color-success-fill-loud': '#3fb950',
    '--wa-color-success-fill-quiet': '#17411e',
    '--wa-color-success-on-loud': '#0d1117',
    '--wa-color-warning-fill-loud': '#d29922',
    '--wa-color-warning-fill-quiet': '#3b2900',
    '--wa-color-warning-on-loud': '#0d1117',
    '--wa-color-danger-fill-loud': '#f85149',
    '--wa-color-danger-fill-quiet': '#4c1210',
    '--wa-color-danger-on-loud': '#0d1117',
    '--wa-color-focus': '#4493f8',
    '--wa-color-overlay': 'rgb(0 0 0 / 72%)',
    '--wa-color-no-data': 'rgb(255 255 255 / 20%)',
    '--wa-color-shadow': '#000000',
    '--wa-color-chart-1': '#b083f5',
    '--wa-color-chart-2': '#f470b8',
    '--wa-color-chart-3': '#52d6e8',
    '--wa-color-chart-4': '#8b949e',
    '--wa-color-chart-5': '#d2a8ff',
    '--wa-color-chart-6': '#ff9bce',
    '--wa-color-chart-7': '#7ee7f2',
    '--wa-color-chart-8': '#c9d1d9',
  },
  'high-contrast': {
    '--wa-color-surface-default': 'Canvas',
    '--wa-color-text-normal': 'CanvasText',
    '--wa-color-text-quiet': 'CanvasText',
    '--wa-color-surface-border': 'ButtonText',
    '--wa-color-brand-fill-loud': 'LinkText',
    '--wa-color-brand-fill-quiet': 'Canvas',
    '--wa-color-brand-on-loud': 'Canvas',
    '--wa-color-success-fill-loud': 'LinkText',
    '--wa-color-success-fill-quiet': 'Canvas',
    '--wa-color-success-on-loud': 'Canvas',
    '--wa-color-warning-fill-loud': 'CanvasText',
    '--wa-color-warning-fill-quiet': 'Canvas',
    '--wa-color-warning-on-loud': 'Canvas',
    '--wa-color-danger-fill-loud': 'LinkText',
    '--wa-color-danger-fill-quiet': 'Canvas',
    '--wa-color-danger-on-loud': 'Canvas',
    '--wa-color-focus': 'Highlight',
    '--wa-color-overlay': 'CanvasText',
    '--wa-color-no-data': 'CanvasText',
    '--wa-color-shadow': 'CanvasText',
    '--wa-color-chart-1': 'LinkText',
    '--wa-color-chart-2': 'Highlight',
    '--wa-color-chart-3': 'CanvasText',
    '--wa-color-chart-4': 'ButtonText',
    '--wa-color-chart-5': 'LinkText',
    '--wa-color-chart-6': 'Highlight',
    '--wa-color-chart-7': 'CanvasText',
    '--wa-color-chart-8': 'ButtonText',
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

const withLyraTheme = (story, context) => {
  applyLyraTheme(context.globals.theme);
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
  },
  decorators: [withLyraTheme],
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;
