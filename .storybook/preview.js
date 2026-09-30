// First, so a layered reset in the docs-authoring CSS cannot outrank Lyra's light-DOM layers.
import './layer-order.css';
import { setCustomElementsManifest } from '@storybook/web-components';
import { LyraDocsContainer } from './docs-container.js';
import { LyraDocsPage } from './docs-page.js';
import { publicStorybookManifest } from './storybook-manifest.js';
import { normalizeStoryPresentation, STORY_PRESENTATION_DEFAULTS } from './theme-contract.js';
import { installDocsPreloadRecovery } from './docs-load-boundaries.js';
import { setLyraStyle } from '../packages/lyra-ui/src/theme/theme.js';
// The preview uses the exact stylesheet consumers import. Storybook-specific colors stay in the
// manager theme; component previews never maintain a second, partial token palette.
import '../packages/lyra-ui/src/theme.css';
// Import the optional shadcn look as text so the `look` toolbar can add or remove it.
import shadcnLookCss from '../packages/lyra-ui/src/looks/shadcn.css?inline';
// Docs/story authoring only — lr-* components' shadow DOM never sees this.
import './tailwind.css';
// Registers the root-included lr-* custom elements once, for every story — no per-story imports
// needed. The package root (`lyra.js`) is intentionally registration-free; `all.js` is the
// explicit compatibility entry that performs registrations.
import '../packages/lyra-ui/src/all.js';
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
// broken deploy. A mounted builder handles lazy-load errors locally to preserve its draft.
installDocsPreloadRecovery(window);

const LOOK_STYLE_ID = 'lr-storybook-look';

/** Adds or removes the shadcn stylesheet required by the selected look. */
function applyLyraLook(look) {
  const existing = document.getElementById(LOOK_STYLE_ID);
  if (look !== 'shadcn') {
    existing?.remove();
    return;
  }
  if (existing) return;
  const style = document.createElement('style');
  style.id = LOOK_STYLE_ID;
  style.textContent = shadcnLookCss;
  document.head.append(style);
}

function applyLyraPresentation(globals) {
  const { theme, look, surface, accent, direction } = normalizeStoryPresentation(globals);
  const root = document.documentElement;

  applyLyraLook(look);
  setLyraStyle({
    look,
    surface,
    density: 'comfortable',
    mode: theme,
    accent,
  });
  root.dir = direction;
  root.dataset.lyraDirection = direction;
}

function bootstrapLyraPresentationFromUrl() {
  const serialized = new URL(window.location.href).searchParams.get('globals') ?? '';
  const globals = Object.fromEntries(
    serialized
      .split(';')
      .map((entry) => entry.split(':', 2))
      .filter(([name, value]) => name && value),
  );
  applyLyraPresentation(globals);
}

// Story modules can evaluate top-level fixture data before decorators run. Apply URL-selected
// production tokens first so a module-level storyColor() resolves the same mode as the canvas.
bootstrapLyraPresentationFromUrl();

const withLyraTheme = (story, context) => {
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
        ],
      },
    },
    look: {
      name: 'Look',
      description: 'The default shadcn look or Lyra\'s original look.',
      toolbar: {
        title: 'Look',
        icon: 'component',
        dynamicTitle: true,
        items: [
          { value: 'lyra', title: 'Lyra' },
          { value: 'shadcn', title: 'shadcn/ui' },
        ],
      },
    },
    surface: {
      name: 'Surface',
      description: 'Glass by default; the surface global accepts glass or solid.',
    },
    accent: {
      name: 'Accent',
      description: 'Emerald by default; the accent global accepts emerald or none.',
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
  },
  initialGlobals: STORY_PRESENTATION_DEFAULTS,
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
      // Storybook's default DocsPage plus the component's granular import path. Applies to
      // autodocs pages only -- an MDX entry's `page` is always its own compiled content (see
      // MdxDocsRender), so the guide pages under `.storybook/*.mdx` are unaffected.
      page: LyraDocsPage,
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
