import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axe from 'axe-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const staticRoot = join(root, 'storybook-static');
const indexPath = join(staticRoot, 'index.json');

const requiredStories = [
  'checkbox--default',
  'dialog--open-initially',
  'responsivepanel--forced-overlay-bottom-sheet',
  'apprail--forced-icon-only',
  'table--default',
  'toast--triggers',
  'codeblock--plain-fallback',
  'charts-litechart--default',
  'map--default',
  'graph--default',
  // Representative coverage for the new component families (flow canvas, KG-RAG/graph-explorer,
  // chat pickers/cards, and new document viewers) added since this list was last extended -- see
  // the dedicated checks below for what each one actually asserts.
  'emoji-picker--with-supplied-groups',
  'voice-picker--default',
  'source-picker--default',
  'entity-card--default',
  'flow-canvas--default',
  'graph-legend--default',
  'documentviewer-notebookviewer--default',
  'archiveviewer--default',
  'documentviewer-xmlviewer--default',
  'threadlist--default',
];

const storyChecks = new Map([
  ['checkbox--default', 'lr-checkbox'],
  ['dialog--open-initially', 'lr-dialog'],
  ['responsivepanel--forced-overlay-bottom-sheet', 'lr-responsive-panel'],
  ['apprail--forced-icon-only', 'lr-app-rail'],
  ['table--default', 'lr-table'],
  ['toast--triggers', 'button'],
  ['codeblock--plain-fallback', 'lr-code-block'],
  ['charts-litechart--default', 'lr-lite-chart'],
  ['map--default', 'lr-map'],
  ['graph--default', 'lr-graph'],
  ['emoji-picker--with-supplied-groups', 'lr-emoji-picker'],
  ['voice-picker--default', 'lr-voice-picker'],
  ['source-picker--default', 'lr-source-picker'],
  ['entity-card--default', 'lr-entity-card'],
  ['flow-canvas--default', 'lr-flow-canvas'],
  ['graph-legend--default', 'lr-graph-legend'],
  ['documentviewer-notebookviewer--default', 'lr-notebook-viewer'],
  ['archiveviewer--default', 'lr-archive-viewer'],
  ['documentviewer-xmlviewer--default', 'lr-xml-viewer'],
  ['threadlist--default', 'lr-thread-list'],
]);

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

let currentStoryId;

async function waitForStory(page, baseUrl, id, viewport, theme = 'light') {
  currentStoryId = id;
  await page.setViewportSize(viewport);
  const url = `${baseUrl}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(
    () => Boolean(document.querySelector('#storybook-root')?.firstElementChild),
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(150);
}

async function runA11y(page, id) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const config = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } };
    return globalThis.axe.run(document, config);
  });
  if (result.violations.length) {
    const summary = result.violations
      .map((violation) => `${violation.id}: ${violation.nodes.length} node(s)`)
      .join(', ');
    throw new Error(`${id} has accessibility violations: ${summary}`);
  }
}

async function expectSelector(page, id, selector) {
  const count = await page.locator(selector).count();
  if (count === 0) throw new Error(`${id} did not render ${selector}`);
}

// A few new-family viewers (notebook-viewer, thread-list) delegate row rendering to the internal
// `lr-virtual-list`, which needs a ResizeObserver-driven layout pass (beyond `waitForStory`'s own
// settle window) before the windowed row count is final. Poll instead of guessing a fixed delay.
async function waitForLocatorCount(locator, predicate, timeoutMs = 5000) {
  const start = Date.now();
  let last = -1;
  while (Date.now() - start < timeoutMs) {
    last = await locator.count();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for locator count (last seen: ${last})`);
}

async function main() {
  let index;
  try {
    index = JSON.parse(await readFile(indexPath, 'utf8'));
  } catch {
    throw new Error('storybook-static/index.json is missing; run `pnpm docs:build` first');
  }

  const entries = new Set(Object.keys(index.entries ?? {}));
  for (const id of requiredStories) {
    if (!entries.has(id)) throw new Error(`Storybook catalog is missing required story ${id}`);
  }

  const server = createServer(serve);
  const baseUrl = await listen(server);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const browserErrors = [];
  // map--default fetches live tiles from tile.openstreetmap.org; a CI runner without egress to
  // that host (or a transient hiccup) shouldn't fail this otherwise-passing smoke/a11y check.
  // A blocked/failed tile request can surface in more than one URL-less, host-less shape depending
  // on exactly how it fails: Chromium's own automatic "Failed to load resource: net::ERR_*"
  // network-log line (emitted for every failed request regardless of JS-level handling), or --
  // if a rejected fetch() promise goes uncaught -- the generic `TypeError: Failed to fetch`.
  // Only ignore these network-failure shapes while map--default itself is the current story, so a
  // real network-error bug surfacing in some other component still fails the check.
  const isIgnorableNetworkError = (text) =>
    /tile\.openstreetmap\.org/.test(text) ||
    (currentStoryId === 'map--default' && /Failed to fetch|Failed to load resource|net::ERR_/.test(text));
  page.on('pageerror', (error) => {
    const text = String(error);
    if (!isIgnorableNetworkError(text)) browserErrors.push(text);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnorableNetworkError(message.text())) browserErrors.push(message.text());
  });

  try {
    for (const id of requiredStories) {
      await waitForStory(page, baseUrl, id, { width: 1280, height: 800 });
      await expectSelector(page, id, storyChecks.get(id));
    }

    await waitForStory(page, baseUrl, 'checkbox--default', { width: 1280, height: 800 }, 'dark');
    const darkTheme = await page.evaluate(() => ({
      scheme: document.documentElement.style.colorScheme,
      surface: document.documentElement.style.getPropertyValue('--lr-theme-color-surface-default'),
    }));
    if (darkTheme.scheme !== 'dark' || darkTheme.surface !== '#0d1117') {
      throw new Error(`dark Storybook theme did not apply semantic tokens: ${JSON.stringify(darkTheme)}`);
    }
    await runA11y(page, 'checkbox--default/dark');

    await waitForStory(page, baseUrl, 'checkbox--default', { width: 1280, height: 800 }, 'high-contrast');
    const highContrastTheme = await page.evaluate(() => ({
      scheme: document.documentElement.style.colorScheme,
      surface: document.documentElement.style.getPropertyValue('--lr-theme-color-surface-default'),
    }));
    if (highContrastTheme.scheme !== 'light' || highContrastTheme.surface !== 'Canvas') {
      throw new Error(`high-contrast Storybook theme did not apply semantic tokens: ${JSON.stringify(highContrastTheme)}`);
    }
    await runA11y(page, 'checkbox--default/high-contrast');

    await waitForStory(page, baseUrl, 'dialog--open-initially', { width: 1280, height: 800 });
    await runA11y(page, 'dialog--open-initially');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('lr-dialog')?.hasAttribute('open'));

    await waitForStory(page, baseUrl, 'toast--triggers', { width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Neutral' }).click();
    await page.waitForSelector('lr-toast', { state: 'attached', timeout: 3000 });

    await waitForStory(page, baseUrl, 'codeblock--plain-fallback', { width: 1280, height: 800 });
    const codeFallback = await page.locator('lr-code-block').evaluate((element) => ({
      pre: Boolean(element.shadowRoot?.querySelector('[part="pre"]')),
      code: element.shadowRoot?.querySelector('[part="code"]')?.textContent ?? '',
    }));
    if (!codeFallback.pre || !codeFallback.code.includes('Just plain text')) {
      throw new Error(`plain code fallback did not render as expected: ${JSON.stringify(codeFallback)}`);
    }

    await waitForStory(page, baseUrl, 'responsivepanel--forced-overlay-bottom-sheet', { width: 390, height: 800 });
    if (await page.locator('lr-responsive-panel').evaluate((element) => element.hasAttribute('open'))) {
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('lr-responsive-panel')?.hasAttribute('open'));
    }
    await page.getByRole('button', { name: 'Open panel' }).click();
    await page.waitForFunction(() => document.querySelector('lr-responsive-panel')?.hasAttribute('open'));
    const panelBox = await page.locator('lr-responsive-panel').locator('[part="panel"]').boundingBox();
    if (!panelBox || panelBox.width <= 0 || panelBox.height <= 0) {
      throw new Error('bottom-sheet story has no visible layout box at mobile width');
    }

    for (const id of ['apprail--forced-icon-only', 'table--default', 'charts-litechart--default', 'map--default', 'graph--default']) {
      await waitForStory(page, baseUrl, id, { width: 1280, height: 800 });
      await runA11y(page, id);
    }

    // -- New component families ------------------------------------------------------------
    // Each check below exercises a real interaction/rendering contract for its component (not just
    // "did it render without throwing"), mirroring the depth of the checks above: pickers/cards
    // commit a selection through a click and a11y-check the interactive surface; flow-canvas asserts
    // its SVG surface renders (like graph--default/map--default); the document viewers assert their
    // actually-rendered content.

    await waitForStory(page, baseUrl, 'emoji-picker--with-supplied-groups', { width: 1280, height: 800 });
    await runA11y(page, 'emoji-picker--with-supplied-groups');
    await page.locator('lr-emoji-picker').locator('[part="emoji"]').first().click();
    const pickedEmoji = await page.locator('lr-emoji-picker').evaluate((element) => element.value);
    if (pickedEmoji !== '😀') {
      throw new Error(`emoji-picker did not commit the clicked emoji: got ${JSON.stringify(pickedEmoji)}`);
    }

    await waitForStory(page, baseUrl, 'voice-picker--default', { width: 1280, height: 800 });
    await runA11y(page, 'voice-picker--default');
    await page.locator('lr-voice-picker').locator('[part="trigger"]').click();
    await page.locator('lr-voice-picker').locator('[part="option"]').first().click();
    const pickedVoice = await page.locator('lr-voice-picker').evaluate((element) => element.value);
    if (pickedVoice !== 'aria') {
      throw new Error(`voice-picker did not commit the selected option: got ${JSON.stringify(pickedVoice)}`);
    }

    await waitForStory(page, baseUrl, 'source-picker--default', { width: 1280, height: 800 });
    await runA11y(page, 'source-picker--default');
    await page.locator('lr-source-picker').locator('[part="item"]').last().click();
    const selectedIds = await page.locator('lr-source-picker').evaluate((element) => element.selectedIds);
    if (!selectedIds.includes('doc3')) {
      throw new Error(`source-picker did not toggle the clicked leaf into selectedIds: got ${JSON.stringify(selectedIds)}`);
    }

    await waitForStory(page, baseUrl, 'entity-card--default', { width: 1280, height: 800 });
    await runA11y(page, 'entity-card--default');
    await page.evaluate(() => {
      window.__lyraEntityActivations = [];
      document.addEventListener('lr-entity-activate', (event) => {
        window.__lyraEntityActivations.push(event.detail);
      });
    });
    await page.locator('lr-entity-card').locator('[part="focus-button"]').click();
    const entityActivations = await page.evaluate(() => window.__lyraEntityActivations);
    if (entityActivations.length !== 1 || entityActivations[0]?.id !== 'e1') {
      throw new Error(`entity-card focus button did not emit lr-entity-activate for e1: got ${JSON.stringify(entityActivations)}`);
    }

    await waitForStory(page, baseUrl, 'flow-canvas--default', { width: 1280, height: 800 });
    const flowEdgesSurface = await page.locator('lr-flow-canvas').locator('[part="edges"]').count();
    const flowNodeCount = await page.locator('lr-flow-canvas').locator('[part="node"]').count();
    if (flowEdgesSurface === 0 || flowNodeCount !== 3) {
      throw new Error(`flow-canvas did not render its SVG surface/nodes as expected: edges=${flowEdgesSurface} nodes=${flowNodeCount}`);
    }
    await runA11y(page, 'flow-canvas--default');

    await waitForStory(page, baseUrl, 'graph-legend--default', { width: 1280, height: 800 });
    await runA11y(page, 'graph-legend--default');
    await page.locator('lr-graph-legend').locator('[part="item"]').first().click();
    const hiddenTypes = await page.locator('lr-graph-legend').evaluate((element) => element.hiddenTypes);
    if (!hiddenTypes.includes('person')) {
      throw new Error(`graph-legend did not toggle the clicked type into hiddenTypes: got ${JSON.stringify(hiddenTypes)}`);
    }

    await waitForStory(page, baseUrl, 'documentviewer-notebookviewer--default', { width: 1280, height: 800 });
    const notebookCellCount = await waitForLocatorCount(
      page.locator('lr-notebook-viewer').locator('[part="cell"]'),
      (count) => count === 2,
    );
    const notebookOutputText = await page.locator('lr-notebook-viewer').locator('[part="output"]').first().textContent();
    if (notebookCellCount !== 2 || !notebookOutputText?.includes('count')) {
      throw new Error(
        `notebook-viewer did not render its cells/outputs as expected: cells=${notebookCellCount} output=${JSON.stringify(notebookOutputText)}`,
      );
    }
    await runA11y(page, 'documentviewer-notebookviewer--default');

    await waitForStory(page, baseUrl, 'archiveviewer--default', { width: 1280, height: 800 });
    await page.locator('lr-archive-viewer').locator('[part="entry-name"], [part="error"]').first().waitFor({ timeout: 10_000 });
    const archiveErrorCount = await page.locator('lr-archive-viewer').locator('[part="error"]').count();
    if (archiveErrorCount > 0) {
      const archiveErrorText = await page.locator('lr-archive-viewer').locator('[part="error"]').textContent();
      throw new Error(`archive-viewer failed to load its fixture archive: ${archiveErrorText}`);
    }
    const archiveEntryNames = await page.locator('lr-archive-viewer').locator('[part="entry-name"]').allTextContents();
    if (!archiveEntryNames.some((name) => name.includes('README.txt'))) {
      throw new Error(`archive-viewer did not list the archive's entries as expected: ${JSON.stringify(archiveEntryNames)}`);
    }
    await runA11y(page, 'archiveviewer--default');

    await waitForStory(page, baseUrl, 'documentviewer-xmlviewer--default', { width: 1280, height: 800 });
    const xmlRootTag = await page.locator('lr-xml-viewer').locator('[part="tag"]').first().textContent();
    if (xmlRootTag !== 'rss') {
      throw new Error(`xml-viewer did not render the parsed document's root tag: got ${JSON.stringify(xmlRootTag)}`);
    }
    await runA11y(page, 'documentviewer-xmlviewer--default');

    await waitForStory(page, baseUrl, 'threadlist--default', { width: 1280, height: 800 });
    await runA11y(page, 'threadlist--default');
    const threadItemsLocator = page.locator('lr-thread-list').locator('lr-conversation-item');
    const threadCountBeforeSearch = await waitForLocatorCount(threadItemsLocator, (count) => count === 5);
    await page.locator('lr-thread-list').locator('[part="search-input"]').fill('Refactor');
    const threadCountAfterSearch = await waitForLocatorCount(threadItemsLocator, (count) => count === 1);
    const filteredThreadTitle = await threadItemsLocator.first().getAttribute('title');
    if (threadCountBeforeSearch !== 5 || threadCountAfterSearch !== 1 || filteredThreadTitle !== 'Refactor the auth module') {
      throw new Error(
        `thread-list search did not filter to the matching thread: before=${threadCountBeforeSearch} after=${threadCountAfterSearch} title=${JSON.stringify(filteredThreadTitle)}`,
      );
    }

    if (browserErrors.length) throw new Error(`Storybook browser errors:\n${browserErrors.join('\n')}`);
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`Storybook smoke/a11y checks passed for ${requiredStories.length} representative stories.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
