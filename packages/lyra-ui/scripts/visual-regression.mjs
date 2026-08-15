// Visual-regression harness: screenshots the machine-readable Storybook matrix in
// visual-baselines/manifest.json and diffs each capture against a committed baseline PNG.
// *** See packages/lyra-ui/visual-baselines/README.md for what a mismatch does and doesn't prove
// before trusting a baseline. This is a blocking CI gate (packages/lyra-ui/visual-baselines/README.md
// documents the determinism work that made that safe) -- a mismatch here fails the CI job. ***
// Mirrors the existing scripts/check-storybook.mjs pattern one directory up (a local static
// server for storybook-static/ + Playwright Chromium driving iframe.html directly with
// Storybook's `globals` URL param for theme/direction) rather than introducing a second test
// framework (e.g. @storybook/test-runner, which would require Jest -- this repo's stack is
// @web/test-runner for unit tests and plain Playwright scripts for Storybook-driven checks; see
// AGENTS.md's Testing conventions section).
// Usage (from packages/lyra-ui/, or via `pnpm --filter @aceshooting/lyra-ui test:visual`):
//   node scripts/visual-regression.mjs                     # capture + diff against baselines
//   node scripts/visual-regression.mjs --update-snapshots   # promote human-reviewed captures
//   node scripts/visual-regression.mjs --filter checkbox    # limit to matching story ids
//   VISUAL_SHARD_INDEX=1 VISUAL_SHARD_TOTAL=3 node scripts/visual-regression.mjs
//                                                        # run one deterministic capture shard
// Requires `storybook-static/` to already exist (`pnpm docs:build` from the repo root) and the
// Playwright Chromium browser to be installed (`pnpm --filter @aceshooting/lyra-ui exec
// playwright install --with-deps chromium`), same preconditions as check-storybook.mjs.

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat, mkdir, writeFile, rm, appendFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { comparePngs } from './visual-regression-compare.mjs';
import {
  readVisualShardCoordinates,
  shardVisualCaptures,
  visualCapturePlan,
} from './visual-regression-shard.mjs';
import { loadVisualStory } from './visual-story-readiness.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const staticRoot = join(repoRoot, 'storybook-static');
const indexPath = join(staticRoot, 'index.json');
const baselineDir = join(packageRoot, 'visual-baselines');
const outputRootDir = join(packageRoot, '.visual-diff-output');
const manifestPath = fileURLToPath(new URL('../visual-baselines/manifest.json', import.meta.url));
const visualManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const VISUAL_AXES = new Map(visualManifest.axes.map((axis) => [axis.name, axis]));
const VISUAL_STORIES = visualManifest.stories;
const EXPECTED_TAGS_BY_STORY = new Map(VISUAL_STORIES.map((story) => [story.id, []]));
for (const [tagName, storyIds] of Object.entries(visualManifest.tagCoverage)) {
  for (const storyId of storyIds) EXPECTED_TAGS_BY_STORY.get(storyId)?.push(tagName);
}

const args = process.argv.slice(2);
const UPDATE = args.includes('--update-snapshots') || args.includes('-u');
const filterArgIndex = args.indexOf('--filter');
const FILTER = filterArgIndex !== -1 ? args[filterArgIndex + 1] : undefined;
if (filterArgIndex !== -1 && !FILTER) throw new Error('--filter needs a story-id substring.');
const { shardIndex: VISUAL_SHARD_INDEX, shardTotal: VISUAL_SHARD_TOTAL } =
  readVisualShardCoordinates();
const outputDir =
  VISUAL_SHARD_TOTAL === 1
    ? outputRootDir
    : join(outputRootDir, `shard-${VISUAL_SHARD_INDEX}-of-${VISUAL_SHARD_TOTAL}`);

function isEvidenceOnly(story, axis) {
  return axis.artifactPolicy === 'evidence-only' || story.comparisonPolicy === 'evidence-only';
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// Determinism controls. Before these existed the harness's only settling step was a
// `networkidle` + fixed 250ms wait, which let three independent noise sources move pixels
// between two runs of *identical* code -- the reason baseline refreshes kept re-blessing a
// dozen-plus PNGs on sub-1% byte churn:
//   1. in-flight CSS animations/transitions -- handled per-screenshot by Playwright's
//      `animations: 'disabled'` (fast-forwards finite ones to their final frame, cancels
//      infinite ones) plus a context-level `reducedMotion: 'reduce'` for the JS-driven
//      animations that consult the media query instead of running pure CSS;
//   2. webfonts still swapping in -- handled by awaiting `document.fonts.ready`, which
//      `networkidle` does *not* imply (the font file can be fetched but not yet applied);
//   3. wall-clock reads and the host's default timezone -- any component rendering "2 minutes
//      ago", a "today" highlight, or a formatted current date produces a different image every
//      run. FIXED_CLOCK pins `Date.now` and `new Date()` without pausing timers (`setFixedTime`,
//      not `pauseAt`), while FIXED_TIME_ZONE makes local calendar fields and `Intl` formatting
//      independent of the capturing host. Streaming / polling / rAF-driven components still
//      reach their steady state normally.
// A fixed, arbitrary instant. Any component that renders a relative or absolute current date
// resolves against this, so its capture is reproducible. Deliberately not "now".
const FIXED_CLOCK = new Date('2026-01-01T12:00:00.000Z');
const FIXED_TIME_ZONE = 'UTC';

// Fourth determinism source, found the hard way: `--lr-font`/`--lr-font-mono` (tokens.styles.ts)
// default to the generic `system-ui`/`ui-monospace` stacks, which resolve to whatever font
// substitution the HOST happens to have -- not the same set on a dev sandbox (which tends to
// carry a full multi-script font superset) as on a fresh CI runner image. That mismatch doesn't
// just anti-alias glyph edges differently (a few tenths of a percent, harmless); word-cloud's
// spiral-search layout feeds each word's *measured* box straight into where the next word's
// collision search starts, so a sub-pixel measureText() difference cascades into a completely
// different final layout (3.6% diff, by far the worst of the family) even though its sampled
// story never calls Math.random() at all (orientations="horizontal", the class default -- see
// word-cloud-layout.ts's `rotated = orientations === 'mixed' && random() < ...`). Forcing both
// tokens to a concrete, non-generic family name removes the substitution entirely. Liberation
// Sans/Mono specifically because they're an ubiquitous small Debian/Ubuntu package
// (`fonts-liberation`) that `playwright install --with-deps chromium` (this repo's own CI step)
// already pulls in as a Chromium dependency -- no bundled font asset to license/subset/maintain.
const FONT_OVERRIDE_CSS = `:root {
  --lr-theme-font-family-body: 'Liberation Sans', sans-serif;
  --lr-theme-font-family-mono: 'Liberation Mono', monospace;
}`;

const VIEWPORT = { width: 1280, height: 800 };
// Per-story viewport overrides, matching scripts/check-storybook.mjs's own use of a narrow
// viewport for the mobile bottom-sheet story.
const VIEWPORT_OVERRIDES = {
  'layout-page--mobile-drawer': { width: 390, height: 800 },
  'responsivepanel--forced-overlay-bottom-sheet': { width: 390, height: 800 },
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serve(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const filePath = normalize(join(staticRoot, relativePath));
  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream' });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end('Not found');
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine Storybook server port');
  return `http://127.0.0.1:${address.port}`;
}

async function assertStoryReady(page, id, expectedTags) {
  const evidence = await page.evaluate(async ({ storyId, expectedTagNames }) => {
    const root = document.querySelector('#storybook-root');
    if (!(root instanceof HTMLElement)) {
      throw new Error(`${storyId} did not render #storybook-root.`);
    }

    // Include document-level portals and recursively inspect shadow roots. A shallow query rooted
    // at #storybook-root can miss both an overlay's rendered surface and an inert lr-* dependency
    // nested in another component's shadow tree.
    const renderedElements = [];
    const visit = (parent) => {
      for (const element of parent.children) {
        renderedElements.push(element);
        if (element.shadowRoot) visit(element.shadowRoot);
        visit(element);
      }
    };
    visit(document.body);
    const lyraElements = renderedElements.filter((element) => element.localName.startsWith('lr-'));
    const renderedTagNames = new Set(lyraElements.map((element) => element.localName));
    const missingExpectedTags = expectedTagNames.filter((tagName) => !renderedTagNames.has(tagName));
    if (missingExpectedTags.length) {
      throw new Error(
        `${storyId} does not render manifest-enrolled tag(s): ${missingExpectedTags.join(', ')}.`,
      );
    }
    const unregistered = [...new Set(
      lyraElements
        .filter((element) => !customElements.get(element.localName))
        .map((element) => element.localName),
    )];
    if (unregistered.length) {
      throw new Error(
        `${storyId} contains inert custom element(s): ${unregistered.join(', ')}. ` +
          'Storybook must import the registration entry before baselining.',
      );
    }

    await Promise.all(
      lyraElements.map((element) =>
        typeof element.updateComplete?.then === 'function'
          ? element.updateComplete
          : Promise.resolve(),
      ),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const hasVisibleBox = (element) => {
      const candidates = [
        element,
        ...(element.shadowRoot?.querySelectorAll('*') ?? []),
        ...element.querySelectorAll('*'),
      ];
      return candidates.some((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        );
      });
    };
    const visibleLyraElements = lyraElements.filter(hasVisibleBox);
    if (lyraElements.length && !visibleLyraElements.length) {
      throw new Error(`${storyId} registered lr-* elements, but none has a visible rendered box.`);
    }

    const hasMeaningfulFallback =
      (root.textContent?.trim().length ?? 0) > 0 ||
      Boolean(root.querySelector('canvas, img, svg, video, input, button, table'));
    if (!lyraElements.length && !hasMeaningfulFallback) {
      throw new Error(`${storyId} rendered neither a Lyra element nor meaningful native content.`);
    }

    return {
      lyraElementCount: lyraElements.length,
      visibleLyraElementCount: visibleLyraElements.length,
    };
  }, { storyId: id, expectedTagNames: expectedTags });

  return evidence;
}

async function assertNarrowAllocation(page, story) {
  if (story.narrowProbe !== 'viewport-fit') return;
  await page.evaluate((storyId) => {
    const root = document.querySelector('#storybook-root');
    const scrollingElement = document.scrollingElement;
    if (!(root instanceof HTMLElement) || !scrollingElement) {
      throw new Error(`${storyId} narrow fixture did not render a measurable Storybook root.`);
    }
    if (window.innerWidth > 320) {
      throw new Error(`${storyId} narrow axis rendered at ${window.innerWidth}px instead of 320px or less.`);
    }
    if (scrollingElement.scrollWidth > window.innerWidth + 1) {
      throw new Error(
        `${storyId} overflows its narrow allocation: ${scrollingElement.scrollWidth}px content in ` +
          `${window.innerWidth}px viewport.`,
      );
    }
    const rect = root.getBoundingClientRect();
    if (rect.left < -1 || rect.right > window.innerWidth + 1) {
      throw new Error(
        `${storyId} Storybook root escapes its narrow viewport (${rect.left}px..${rect.right}px).`,
      );
    }
  }, story.id);
}

function paintedPixelStats(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  const cornerOffsets = [
    0,
    (png.width - 1) * 4,
    (png.width * (png.height - 1)) * 4,
    (png.width * png.height - 1) * 4,
  ];
  const cornerColors = cornerOffsets.map((offset) =>
    `${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]},${png.data[offset + 3]}`,
  );
  const background = cornerColors
    .map((color) => ({ color, count: cornerColors.filter((candidate) => candidate === color).length }))
    .sort((left, right) => right.count - left.count)[0].color.split(',').map(Number);

  let paintedPixels = 0;
  let chromaticPixels = 0;
  const colorBuckets = new Set();
  for (let offset = 0; offset < png.data.length; offset += 4) {
    const red = png.data[offset];
    const green = png.data[offset + 1];
    const blue = png.data[offset + 2];
    const alpha = png.data[offset + 3];
    const backgroundDistance =
      Math.abs(red - background[0]) +
      Math.abs(green - background[1]) +
      Math.abs(blue - background[2]) +
      Math.abs(alpha - background[3]);
    if (backgroundDistance > 24) paintedPixels += 1;
    if (alpha > 0 && Math.max(red, green, blue) - Math.min(red, green, blue) >= 24) {
      chromaticPixels += 1;
      colorBuckets.add(`${red >> 4},${green >> 4},${blue >> 4}`);
    }
  }
  return {
    width: png.width,
    height: png.height,
    paintedPixels,
    chromaticPixels,
    chromaticBuckets: colorBuckets.size,
    pixelSignature: png.data.toString('base64'),
  };
}

function assertCaptureHasPaint(pngBuffer, label, minimumPaintedPixels = 64) {
  const stats = paintedPixelStats(pngBuffer);
  if (stats.paintedPixels < minimumPaintedPixels) {
    throw new Error(
      `${label} is visually empty: only ${stats.paintedPixels} pixels differ from the canvas background.`,
    );
  }
  return stats;
}

async function assertForcedColorsPaintedPixels(page, story) {
  const forcedColorsActive = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
  if (!forcedColorsActive) {
    throw new Error(`${story.id} forced-colors axis did not activate the browser media feature.`);
  }

  if (story.forcedColorsProbe === 'intrinsic-color') {
    const grid = page.locator('lr-color-picker').locator('[part~="grid"]');
    await grid.waitFor({ state: 'visible', timeout: 5_000 });
    const gridPixels = await grid.screenshot({ animations: 'disabled' });
    const stats = assertCaptureHasPaint(gridPixels, `${story.id} intrinsic color grid`, 256);
    if (stats.chromaticPixels < 256 || stats.chromaticBuckets < 8) {
      throw new Error(
        `${story.id} intrinsic color pixels were flattened by forced colors: ` +
          `${stats.chromaticPixels} chromatic pixels across ${stats.chromaticBuckets} color buckets.`,
      );
    }
    return;
  }

  if (story.forcedColorsProbe === 'chart-encodings') {
    await page.evaluate(async () => {
      const chart = document.querySelector('lr-chart');
      if (!(chart instanceof HTMLElement)) {
        throw new Error('Chart painted-pixel fixture did not render lr-chart.');
      }
      chart.type = 'line';
      chart.legend = true;
      chart.labels = ['Q1', 'Q2', 'Q3'];
      chart.datasets = Array.from({ length: 8 }, (_, index) => ({
        label: `Series ${index + 1}`,
        data: [index + 1, 9 - index, index + 2],
        fill: true,
      }));
      await chart.updateComplete;
      const deadline = performance.now() + 5_000;
      while (!chart.chart && performance.now() < deadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      if (!chart.chart) throw new Error('Chart.js did not initialize for the painted-pixel fixture.');
      chart.refreshTheme?.();
      await chart.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    const chartCanvas = page.locator('lr-chart').locator('canvas');
    await chartCanvas.waitFor({ state: 'visible', timeout: 5_000 });
    const canvasPixels = await chartCanvas.screenshot({ animations: 'disabled' });
    assertCaptureHasPaint(canvasPixels, `${story.id} chart canvas`, 512);

    const swatches = page.locator('lr-chart').locator('[part~="legend-swatch"]');
    await swatches.first().waitFor({ state: 'visible', timeout: 5_000 });
    const swatchCount = await swatches.count();
    if (swatchCount !== 8) {
      throw new Error(`${story.id} expected 8 forced-color legend encodings, found ${swatchCount}.`);
    }
    const signatures = [];
    for (let index = 0; index < swatchCount; index += 1) {
      const pixels = await swatches.nth(index).screenshot({ animations: 'disabled' });
      signatures.push(paintedPixelStats(pixels).pixelSignature);
    }
    if (new Set(signatures).size !== 8) {
      throw new Error(
        `${story.id} painted ${new Set(signatures).size} distinct legend patterns for 8 repeated-color series.`,
      );
    }
  }
}

async function captureStory(page, baseUrl, story, axis) {
  const { id } = story;
  const theme = axis.globals?.theme ?? 'light';
  const direction = axis.globals?.direction ?? 'ltr';
  const viewport = axis.viewport ?? VIEWPORT_OVERRIDES[id] ?? VIEWPORT;
  await page.setViewportSize(viewport);
  await page.emulateMedia({
    forcedColors: axis.emulation?.forcedColors ?? 'none',
    reducedMotion: 'reduce',
  });
  const url = `${baseUrl}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme};direction:${direction}`;
  // Applied before the story's first component upgrade so canvas painters that measure text
  // during their initial render (e.g. word-cloud's spiral-search layout) see the forced font on
  // their very first pass rather than re-measuring after a live custom-property change.
  await loadVisualStory(page, url, FONT_OVERRIDE_CSS);
  // Let webfonts, chart/canvas/map render passes, and async fixture fetches (pdf.js, mammoth,
  // papaparse) settle. networkidle is best-effort: components with a live/streaming poll timer
  // (e.g. generation-status, stream-status) never go idle, so this must not be fatal.
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  // Webfonts being *fetched* (what networkidle observes) is not the same as them being *applied*;
  // screenshotting between those two moments captures fallback-font metrics and shifts every
  // glyph in the image. Best-effort like networkidle above: a story that never settles its font
  // loading must not be fatal to the run.
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(250);
  if (id === 'layout-page--mobile-drawer') {
    // The story's resting state proves the 320px allocation but leaves its defining surface
    // closed. Open it through the public method so the baseline includes the modal drawer,
    // backdrop, logical edge, focus treatment, and scroll-lock layout on every theme/RTL axis.
    await page.evaluate(async () => {
      const host = document.querySelector('lr-page');
      if (!(host instanceof HTMLElement) || typeof host.showNavigation !== 'function') {
        throw new Error('Mobile Page visual fixture did not render its public drawer API.');
      }
      host.showNavigation();
      await host.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForFunction(() => {
      const host = document.querySelector('lr-page');
      const drawer = host?.shadowRoot?.querySelector('[part~="drawer"]');
      return host?.navOpen === true && drawer?.getAttribute('role') === 'dialog';
    });
  }
  if (id === 'utility-visually-hidden--skip-link') {
    // A resting visually-hidden screenshot is indistinguishable from the component being absent.
    // Focus its real light-DOM link so this baseline covers the component's visible contract.
    await page.evaluate(async () => {
      const host = document.querySelector('lr-visually-hidden');
      const link = host?.querySelector('a');
      if (!(host instanceof HTMLElement) || !(link instanceof HTMLAnchorElement)) {
        throw new Error('Visually Hidden visual fixture did not render its skip link.');
      }
      link.focus();
      await host.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.waitForFunction(() => {
      const host = document.querySelector('lr-visually-hidden');
      return host?.contains(document.activeElement) === true && getComputedStyle(host).clipPath === 'none';
    });
  }
  if (id === 'layout-menu-label--default') {
    // The label story composes labels inside a standalone (non-dropdown-contained, non-submenu)
    // menu. Since menu.class.ts's `cd4f2d22` refactor, that host is unconditionally visible --
    // `:host { display: flex; ... }`, with visibility-gating only applying to `[data-contained]`/
    // `[data-submenu]` hosts via the internal `.submenu-surface` class -- and `LyraMenu` no longer
    // has a public `open` property at all (dropdown-open state now lives on the owning
    // `lr-dropdown`). The generic `loadVisualStory` readiness wait already covers this story; no
    // special interaction is needed before it settles.
    await page.evaluate(async () => {
      const menu = document.querySelector('lr-menu');
      if (!(menu instanceof HTMLElement)) {
        throw new Error('Menu Label visual fixture did not render its containing menu.');
      }
      await menu.updateComplete;
    });
  }
  if (id === 'threadlist--default') {
    // This story nests Lit updates three levels deep: thread-list -> virtual-list ->
    // conversation-item. The outer rows can already have stable geometry while a conversation
    // item's `active` host attribute has applied its CSS background but its queued Lit render has
    // not added the active indicator (or the new `dir="auto"` text nodes) yet. Waiting only for
    // row boxes therefore admits a real, repeatable half-rendered frame on a slower CI runner.
    // Await every currently-rendered layer directly before checking layout stability.
    await page.evaluate(async () => {
      const host = document.querySelector('lr-thread-list');
      await host?.updateComplete;
      const list = host?.shadowRoot?.querySelector('lr-virtual-list');
      await list?.updateComplete;
      const items = [...(list?.shadowRoot?.querySelectorAll('lr-conversation-item') ?? [])];
      await Promise.all(items.map((item) => item.updateComplete));
      await list?.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.all(items.map((item) => item.updateComplete));
    });
    await page.waitForFunction(
      () => {
        const host = document.querySelector('lr-thread-list');
        const list = host?.shadowRoot?.querySelector('lr-virtual-list');
        const root = list?.shadowRoot;
        const viewport = root?.querySelector('[part="base"]');
        const rows = [...(root?.querySelectorAll('[part="row"]') ?? [])];
        const items = [...(root?.querySelectorAll('lr-conversation-item') ?? [])];
        const activeItem = items.find((item) => item.hasAttribute('active'));
        const activeIndicator = activeItem?.shadowRoot?.querySelector('[part="active-indicator"]');
        if (
          !(viewport instanceof HTMLElement) ||
          rows.length < 5 ||
          items.length < 3 ||
          !(activeIndicator instanceof HTMLElement)
        ) {
          return false;
        }

        const signature = [
          rows.length,
          viewport.clientHeight,
          viewport.scrollHeight,
          ...rows.flatMap((row) => {
            const rect = row.getBoundingClientRect();
            return [rect.top, rect.height];
          }),
          ...items.flatMap((item) => {
            const rect = item.getBoundingClientRect();
            return [rect.left, rect.width, rect.height];
          }),
          ...Object.values(activeIndicator.getBoundingClientRect().toJSON()),
        ].join('|');
        const key = '__lyraThreadListVisualLayout';
        const previous = globalThis[key];
        globalThis[key] =
          previous?.signature === signature
            ? { signature, stableFrames: previous.stableFrames + 1 }
            : { signature, stableFrames: 1 };
        return globalThis[key].stableFrames >= 2;
      },
      undefined,
      { polling: 'raf', timeout: 5_000 },
    );
  }
  // Full-viewport screenshot rather than a `#storybook-root`-clipped one: several of the sampled
  // families (dialog, drawer, overlay-dropdown, overlay-popover, overlay-tooltip,
  // toolapprovaldialog, menu) render their open surface via `root-registration-allowlist.ts`'s
  // document-level portal, which lands as a sibling of #storybook-root rather than inside it --
  // clipping to that element's bounding box would silently crop the very content the RTL/theme
  // axes exist to catch a regression in.
  // `animations: 'disabled'` fast-forwards finite CSS animations/transitions to their last frame
  // and cancels infinite ones -- preferred over injecting `* { animation: none !important }`,
  // which would strand an entrance animation at its *starting* keyframe rather than its
  // resting state. `caret: 'hide'` is Playwright's default but is stated explicitly here because
  // the sampled form controls (input, textarea, combobox, select) autofocus in some stories and a
  // blinking caret is otherwise a coin-flip pixel.
  await assertStoryReady(page, id, EXPECTED_TAGS_BY_STORY.get(id) ?? []);
  if (axis.name === 'forced-colors') {
    await assertForcedColorsPaintedPixels(page, story);
  }
  if (axis.name === 'narrow') await assertNarrowAllocation(page, story);
  const screenshot = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
  assertCaptureHasPaint(screenshot, `${id} / ${axis.name}`);
  return screenshot;
}

// Escapes a value for safe placement inside a single markdown table cell. Order matters:
// backslashes first (so the following escapes aren't themselves un-escaped), then pipes (which
// would otherwise split the cell), then newlines (which would otherwise break out of the row --
// this table's content ends up in GITHUB_STEP_SUMMARY, which renders as markdown/HTML).
function escapeMarkdownCell(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function promoteReviewedCandidates() {
  if (VISUAL_SHARD_TOTAL !== 1) {
    throw new Error(
      'Snapshot promotion requires an unsharded candidate report; unset VISUAL_SHARD_INDEX and ' +
        'VISUAL_SHARD_TOTAL before using --update-snapshots.',
    );
  }
  const baselineReview = visualManifest.baselineReview;
  if (baselineReview.status !== 'complete') {
    throw new Error(
      'Baseline promotion is disabled while manifest.json records pending-human-review. Run the ' +
        'normal harness, have a human inspect .visual-diff-output/current, and record that review ' +
        'before using --update-snapshots.',
    );
  }

  const reportPath = join(outputDir, 'report.json');
  if (!(await pathExists(reportPath))) {
    throw new Error('No reviewed candidate report exists; run the normal visual harness first.');
  }
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const results = new Map(report.map((result) => [`${result.id}/${result.axis}`, result]));
  const targetStories = VISUAL_STORIES.filter((story) => !FILTER || story.id.includes(FILTER));
  if (FILTER && targetStories.length === 0) {
    throw new Error(`--filter ${FILTER} matched no stories in the visual manifest.`);
  }

  let promoted = 0;
  let evidenceOnly = 0;
  for (const story of targetStories) {
    const profile = visualManifest.coverageProfiles[story.profile];
    for (const axisName of profile.axes) {
      const axis = VISUAL_AXES.get(axisName);
      if (!axis) throw new Error(`${story.id} names unknown visual axis ${axisName}`);
      if (isEvidenceOnly(story, axis)) {
        evidenceOnly += 1;
        continue;
      }

      const key = `${story.id}/${axisName}`;
      const result = results.get(key);
      if (!result || typeof result.candidateSha256 !== 'string') {
        throw new Error(`${key} has no hash-bound candidate in ${reportPath}; run and review it first.`);
      }
      if (['error', 'console-error'].includes(result.status)) {
        throw new Error(`${key} failed its semantic capture checks and cannot be promoted.`);
      }
      const candidatePath = join(outputDir, 'current', story.id, `${axisName}.png`);
      const candidate = await readFile(candidatePath);
      assertCaptureHasPaint(candidate, `${key} reviewed candidate`);
      const actualSha256 = sha256(candidate);
      if (actualSha256 !== result.candidateSha256) {
        throw new Error(
          `${key} changed after its candidate report was written (${actualSha256} != ` +
            `${result.candidateSha256}); rerun and review the exact replacement.`,
        );
      }
      await mkdir(join(baselineDir, story.id), { recursive: true });
      await writeFile(join(baselineDir, story.id, `${axisName}.png`), candidate);
      promoted += 1;
    }
  }
  console.log(
    `Promoted ${promoted} exact hash-verified, human-reviewed candidate PNG(s); ` +
      `${evidenceOnly} evidence-only capture(s) remained ephemeral.`,
  );
}

async function main() {
  if (UPDATE) return promoteReviewedCandidates();
  if (!(await pathExists(indexPath))) {
    throw new Error(`${indexPath} is missing; run \`pnpm docs:build\` from the repo root first.`);
  }
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const entries = new Set(Object.keys(index.entries ?? {}));

  const matchingCaptures = visualCapturePlan(visualManifest, FILTER);
  if (FILTER && matchingCaptures.length === 0) {
    throw new Error(`--filter ${FILTER} matched no stories in this harness's sample list.`);
  }
  const targetCaptures = shardVisualCaptures(
    matchingCaptures,
    VISUAL_SHARD_INDEX,
    VISUAL_SHARD_TOTAL,
  );
  if (targetCaptures.length === 0) {
    throw new Error(
      `Visual shard ${VISUAL_SHARD_INDEX}/${VISUAL_SHARD_TOTAL} is empty for ` +
        `${matchingCaptures.length} capture(s).`,
    );
  }
  const targetStories = [
    ...new Map(targetCaptures.map(({ story }) => [story.id, story])).values(),
  ];

  const missing = targetStories.filter((story) => !entries.has(story.id)).map((story) => story.id);
  if (missing.length) {
    throw new Error(`Storybook catalog is missing story id(s) sampled by this harness: ${missing.join(', ')}`);
  }

  await rm(outputDir, { recursive: true, force: true });

  const server = createServer(serve);
  const baseUrl = await listen(server);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    timezoneId: FIXED_TIME_ZONE,
  });
  // Pins Date.now()/new Date() for every story in the run while leaving setTimeout/setInterval/
  // rAF running at real speed. Together with the browser context's fixed timezone, date-rendering
  // components are reproducible while streaming and polling components still settle. Installed
  // once -- it survives the per-story navigations.
  await page.clock.setFixedTime(FIXED_CLOCK);
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`${message.text()}`);
  });

  const results = [];
  try {
    for (const { story, axisName } of targetCaptures) {
      const axis = VISUAL_AXES.get(axisName);
      if (!axis) throw new Error(`${story.id} names unknown visual axis ${axisName}`);
      const { id } = story;
      browserErrors.length = 0;
      const label = `${id} / ${axis.name}`;
      let screenshot;
      try {
        screenshot = await captureStory(page, baseUrl, story, axis);
      } catch (error) {
        results.push({ id, axis: axis.name, status: 'error', message: error instanceof Error ? error.message : String(error) });
        console.error(`  [error] ${label}: ${error instanceof Error ? error.message : error}`);
        continue;
      }

      if (browserErrors.length) {
        results.push({
          id,
          axis: axis.name,
          status: 'console-error',
          message: browserErrors.join('; '),
        });
        console.error(`  [console-error] ${label}: ${browserErrors.join('; ')}`);
        continue;
      }
      const candidateSha256 = sha256(screenshot);

      await mkdir(join(outputDir, 'current', id), { recursive: true });
      await writeFile(join(outputDir, 'current', id, `${axis.name}.png`), screenshot);

      if (isEvidenceOnly(story, axis)) {
        await mkdir(join(outputDir, 'evidence', id), { recursive: true });
        await writeFile(join(outputDir, 'evidence', id, `${axis.name}.png`), screenshot);
        results.push({
          id,
          axis: axis.name,
          status: 'evidence-only',
          candidateSha256,
          message:
            story.comparisonReason ??
            'This axis records semantic evidence but has no human-approved pixel baseline.',
        });
        console.log(`  [evidence-only] ${label}`);
        continue;
      }

      const baselinePath = join(baselineDir, id, `${axis.name}.png`);
      if (!(await pathExists(baselinePath))) {
        await mkdir(join(outputDir, 'new', id), { recursive: true });
        await writeFile(join(outputDir, 'new', id, `${axis.name}.png`), screenshot);
        results.push({ id, axis: axis.name, status: 'new', candidateSha256 });
        console.log(`  [new, no baseline yet] ${label}`);
        continue;
      }

      const baselineBuffer = await readFile(baselinePath);
      const comparison = comparePngs(baselineBuffer, screenshot);
      if (comparison.status === 'match') {
        results.push({ id, axis: axis.name, status: 'match', ratio: comparison.ratio, candidateSha256 });
        console.log(`  [match] ${label} (${(comparison.ratio * 100).toFixed(3)}% diff)`);
      } else if (comparison.status === 'mismatch') {
        if (comparison.diffPng) {
          await mkdir(join(outputDir, 'diff', id), { recursive: true });
          await writeFile(join(outputDir, 'diff', id, `${axis.name}.png`), comparison.diffPng);
        }
        results.push({
          id,
          axis: axis.name,
          status: 'mismatch',
          ratio: comparison.ratio ?? null,
          reason: comparison.reason,
          candidateSha256,
        });
        console.log(`  [MISMATCH] ${label}${comparison.reason ? `: ${comparison.reason}` : ` (${(comparison.ratio * 100).toFixed(3)}% diff)`}`);
      } else {
        results.push({ id, axis: axis.name, status: 'error', message: comparison.message });
        console.error(`  [error] ${label}: ${comparison.message}`);
      }
    }
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, 'report.json'), JSON.stringify(results, null, 2));

  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const summaryLines = [
    '# Visual regression report',
    '',
    '**This is a blocking visual-regression gate.** A mismatch fails the job and should be inspected',
    'before either implementation or baseline changes are accepted. A clean run proves stability against',
    'the committed images, not that those images are inherently correct -- see',
    '`packages/lyra-ui/visual-baselines/README.md`.',
    '',
    `Sampled ${targetStories.length} stories across the manifest's ${VISUAL_AXES.size} axes = ${results.length} capture results ` +
      `(shard ${VISUAL_SHARD_INDEX}/${VISUAL_SHARD_TOTAL}; ${matchingCaptures.length} capture(s) in the filtered plan).`,
    '',
    `| status | count |`,
    `| --- | --- |`,
    ...Object.entries(counts).map(([status, count]) => `| ${status} | ${count} |`),
    '',
  ];
  const mismatches = results.filter((r) => r.status === 'mismatch' || r.status === 'error' || r.status === 'console-error');
  if (mismatches.length) {
    summaryLines.push('## Findings', '', '| story | axis | status | detail |', '| --- | --- | --- | --- |');
    for (const r of mismatches) {
      const detail = r.reason ?? r.message ?? (r.ratio != null ? `${(r.ratio * 100).toFixed(3)}% pixels changed` : '');
      summaryLines.push(`| ${escapeMarkdownCell(r.id)} | ${escapeMarkdownCell(r.axis)} | ${escapeMarkdownCell(r.status)} | ${escapeMarkdownCell(detail)} |`);
    }
    summaryLines.push('');
  }
  const newBaselines = results.filter((r) => r.status === 'new');
  if (newBaselines.length) {
    summaryLines.push(
      `## New captures with no existing baseline (${newBaselines.length})`,
      '',
      'Review `.visual-diff-output/current` as a human before recording approval and promoting captures.',
      '',
    );
  }
  const summaryMarkdown = summaryLines.join('\n');
  await writeFile(join(outputDir, 'summary.md'), summaryMarkdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${summaryMarkdown}\n`);
  }

  console.log(`\n${summaryMarkdown}`);
  console.log(`Full report: ${join(outputDir, 'report.json')}`);

  const hasFailures = results.some((r) => r.status === 'mismatch' || r.status === 'error' || r.status === 'console-error' || r.status === 'new');
  if (hasFailures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
