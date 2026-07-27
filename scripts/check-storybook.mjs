import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import axe from 'axe-core';
import { FAMILY_LABELS } from '../.storybook/story-indexer.js';

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
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(
    () => Boolean(document.querySelector('#storybook-root')?.firstElementChild),
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(150);
}

async function waitForDocs(page, baseUrl, id, theme = 'dark') {
  currentStoryId = `${id}/docs`;
  await page.setViewportSize({ width: 1280, height: 800 });

  const url = new URL(baseUrl);
  url.searchParams.set('path', `/docs/${id}`);
  url.searchParams.set('globals', `theme:${theme}`);
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });

  const iframe = await page.waitForSelector('#storybook-preview-iframe', { timeout: 15_000 });
  const frame = await iframe.contentFrame();
  if (!frame) throw new Error(`${id} docs iframe was not available`);

  await frame.waitForSelector('.sbdocs-wrapper', { timeout: 15_000 });
  try {
    await frame.waitForFunction(
      (expectedTheme) => document.documentElement.dataset.lyraTheme === expectedTheme,
      theme,
      { timeout: 15_000 },
    );
  } catch {
    const state = await frame.evaluate(() => ({
      dataset: document.documentElement.dataset.lyraTheme,
      url: location.href,
    }));
    throw new Error(`${id} Docs did not apply theme ${theme}: ${JSON.stringify(state)}`);
  }
  return frame;
}

async function chooseToolbarTheme(page, currentTheme, nextTheme) {
  const themeButton = page
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${currentTheme}$`, 'i') })
    .first();
  await themeButton.waitFor({ state: 'visible', timeout: 10_000 });
  await themeButton.click();

  const option = page.getByRole('option').filter({ hasText: new RegExp(`^${nextTheme}$`, 'i') }).first();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
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

async function auditComponentDocs(browser, baseUrl, entries) {
  const matrices = [
    { name: 'desktop', width: 980, height: 760, direction: 'ltr' },
    { name: 'narrow', width: 390, height: 800, direction: 'ltr' },
    { name: 'narrow-rtl', width: 390, height: 800, direction: 'rtl' },
  ];
  const work = matrices.flatMap((matrix) => entries.map((entry) => ({ entry, matrix })));
  const failures = [];
  let cursor = 0;

  async function worker() {
    const auditPage = await browser.newPage({ deviceScaleFactor: 1 });
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= work.length) break;

      const { entry, matrix } = work[index];
      const browserErrors = [];
      const isExpectedRequestFailure = (url) => {
        const parsed = new URL(url);
        return (
          parsed.hostname === 'tile.openstreetmap.org' ||
          parsed.hostname === 'example.invalid' ||
          (entry.id === 'animatedimage--docs' &&
            parsed.pathname.endsWith('/does-not-exist-lr-animated-image.gif'))
        );
      };
      const isIgnorableError = (text) =>
        /tile\.openstreetmap\.org/.test(text) ||
        (entry.id === 'map--docs' && /Failed to fetch/.test(text));
      const onPageError = (error) => {
        const text = String(error);
        if (!isIgnorableError(text)) browserErrors.push(`pageerror: ${text}`);
      };
      const onConsole = (message) => {
        if (
          message.type() !== 'error' ||
          isIgnorableError(message.text()) ||
          /Failed to load resource: net::ERR_|Failed to load resource.*404/.test(message.text())
        ) {
          return;
        }
        browserErrors.push(`console: ${message.text()}`);
      };
      const onRequestFailed = (request) => {
        if (isExpectedRequestFailure(request.url())) return;
        browserErrors.push(
          `request failed: ${request.url()} (${request.failure()?.errorText ?? 'unknown error'})`,
        );
      };
      const onResponse = (response) => {
        if (response.status() < 400 || isExpectedRequestFailure(response.url())) return;
        browserErrors.push(`HTTP ${response.status()}: ${response.url()}`);
      };
      auditPage.on('pageerror', onPageError);
      auditPage.on('console', onConsole);
      auditPage.on('requestfailed', onRequestFailed);
      auditPage.on('response', onResponse);

      try {
        await auditPage.setViewportSize({ width: matrix.width, height: matrix.height });
        await auditPage.goto(
          `${baseUrl}/iframe.html?id=${encodeURIComponent(entry.id)}&viewMode=docs&globals=theme:dark;direction:${matrix.direction};density:comfortable`,
          { waitUntil: 'domcontentloaded', timeout: 20_000 },
        );
        await auditPage.waitForSelector('.sbdocs-wrapper', { timeout: 15_000 });
        await auditPage.waitForTimeout(120);

        const layout = await auditPage.evaluate(async () => {
          const updatePromises = [...document.querySelectorAll('*')]
            .filter(
              (element) =>
                element.localName.startsWith('lr-') &&
                typeof element.updateComplete?.then === 'function',
            )
            .map((element) => element.updateComplete.catch(() => undefined));
          await Promise.all(updatePromises);

          // Storybook's Docs page applies some layout-affecting CSS -- notably the ArgsTable's
          // horizontal-scroll wrapper -- asynchronously, after custom elements finish updating.
          // A page whose ArgsTable is unusually wide relative to its scroller (little margin
          // before that wrapper's overflow-x is actually applied) can get measured mid-reflow
          // under CI's tighter CPU budget, producing a false "document width exceeds" failure
          // even though the wrapper ends up correctly scoped a frame or two later. Wait for
          // document.documentElement.scrollWidth to stop moving across consecutive animation
          // frames instead of trusting a snapshot taken at a fixed, content-agnostic delay.
          let lastScrollWidth = document.documentElement.scrollWidth;
          let stableFrames = 0;
          const settleDeadline = performance.now() + 1000;
          while (stableFrames < 3 && performance.now() < settleDeadline) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const currentScrollWidth = document.documentElement.scrollWidth;
            if (currentScrollWidth === lastScrollWidth) {
              stableFrames += 1;
            } else {
              stableFrames = 0;
              lastScrollWidth = currentScrollWidth;
            }
          }

          const apiTables = [...document.querySelectorAll('table.docblock-argstable')].map((table) => {
            const scroller = table.parentElement;
            return {
              tableWidth: Math.round(table.getBoundingClientRect().width),
              scrollerClientWidth: scroller?.clientWidth ?? 0,
              scrollerScrollWidth: scroller?.scrollWidth ?? 0,
              scrollerOverflowX: scroller ? getComputedStyle(scroller).overflowX : '',
            };
          });
          const openFrames = [...document.querySelectorAll('.docs-story [open]')]
            .filter((element) => element.localName.startsWith('lr-'))
            .map((element) => {
              const canvas = element.closest('.docs-story');
              const preview = element.closest('.sbdocs-preview');
              const zoomWrapper = canvas?.querySelector(
                ':scope > div:has(> .innerZoomElementWrapper)',
              );
              return {
                tag: element.localName,
                canvasOverflow: canvas ? getComputedStyle(canvas).overflow : '',
                previewOverflow: preview ? getComputedStyle(preview).overflow : '',
                zoomTransform: zoomWrapper ? getComputedStyle(zoomWrapper).transform : '',
              };
            });
          const visibleErrors = [
            ...document.querySelectorAll('.sb-errordisplay, [data-testid="storyError"]'),
          ]
            .filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0;
            })
            .map((element) => element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 300) ?? '');

          return {
            documentClientWidth: document.documentElement.clientWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            apiTables,
            openFrames,
            visibleErrors,
          };
        });

        const pageFailures = [];
        if (layout.documentScrollWidth > layout.documentClientWidth + 1) {
          // TEMP DIAGNOSTIC (remove before merge): CI reproduces this overflow deterministically
          // while local sandboxes do not, so find the actual offending element(s) and their
          // resolved fonts directly from the CI runner instead of guessing further.
          const diagnostics = await auditPage.evaluate(() => {
            const docWidth = document.documentElement.clientWidth;
            const isClipped = (element) => {
              let node = element.parentElement;
              while (node) {
                const style = getComputedStyle(node);
                if (
                  ['auto', 'scroll'].includes(style.overflowX) &&
                  node.scrollWidth > node.clientWidth + 1
                ) {
                  return true;
                }
                node = node.parentElement;
              }
              return false;
            };
            const offenders = [];
            for (const element of document.querySelectorAll('*')) {
              const rect = element.getBoundingClientRect();
              if (rect.right > docWidth + 1 && !isClipped(element)) {
                offenders.push({
                  tag: element.tagName,
                  cls: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
                  part: element.getAttribute?.('part') ?? '',
                  width: Math.round(rect.width),
                  right: Math.round(rect.right),
                  fontFamily: getComputedStyle(element).fontFamily,
                  text: (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 100),
                });
              }
            }
            offenders.sort((a, b) => b.right - a.right);
            return {
              userAgent: navigator.userAgent,
              devicePixelRatio: window.devicePixelRatio,
              scrollHeight: document.documentElement.scrollHeight,
              clientHeight: document.documentElement.clientHeight,
              offenders: offenders.slice(0, 8),
            };
          });
          pageFailures.push(
            `document width ${layout.documentScrollWidth}px exceeds ${layout.documentClientWidth}px DIAGNOSTICS: ${JSON.stringify(diagnostics)}`,
          );
        }
        for (const table of layout.apiTables) {
          if (
            table.tableWidth > table.scrollerClientWidth + 1 &&
            (!['auto', 'scroll'].includes(table.scrollerOverflowX) ||
              table.scrollerScrollWidth <= table.scrollerClientWidth)
          ) {
            pageFailures.push(`wide API table is not locally scrollable: ${JSON.stringify(table)}`);
          }
        }
        for (const frame of layout.openFrames) {
          if (
            frame.canvasOverflow !== 'visible' ||
            frame.previewOverflow !== 'visible' ||
            frame.zoomTransform !== 'none'
          ) {
            pageFailures.push(`open ${frame.tag} is trapped by its Docs frame: ${JSON.stringify(frame)}`);
          }
        }
        pageFailures.push(...layout.visibleErrors.map((error) => `Storybook error display: ${error}`));
        pageFailures.push(...browserErrors);
        if (pageFailures.length) {
          failures.push(`${entry.id} [${matrix.name}]: ${pageFailures.join('; ')}`);
        }
      } catch (error) {
        failures.push(`${entry.id} [${matrix.name}]: ${error instanceof Error ? error.message : error}`);
      } finally {
        auditPage.off('pageerror', onPageError);
        auditPage.off('console', onConsole);
        auditPage.off('requestfailed', onRequestFailed);
        auditPage.off('response', onResponse);
      }
    }
    await auditPage.close();
  }

  await Promise.all(Array.from({ length: 6 }, () => worker()));
  if (failures.length) {
    throw new Error(
      `Docs layout audit failed on ${failures.length} of ${work.length} page/viewport checks:\n${failures.join('\n')}`,
    );
  }

  return { pages: entries.length, checks: work.length };
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

  const familyLabels = new Set(Object.values(FAMILY_LABELS));
  const componentEntries = Object.values(index.entries ?? {}).filter((entry) =>
    entry.importPath?.includes('/src/components/'),
  );
  const componentDocsEntries = componentEntries.filter((entry) => entry.type === 'docs');
  const ungroupedEntries = componentEntries.filter((entry) => !familyLabels.has(entry.title?.split('/')[0]));
  if (ungroupedEntries.length) {
    throw new Error(
      `Storybook component entries are not grouped by family: ${ungroupedEntries
        .slice(0, 5)
        .map((entry) => `${entry.id} (${entry.title})`)
        .join(', ')}`,
    );
  }

  const assetNames = await readdir(join(staticRoot, 'assets'));
  if (!assetNames.some((name) => name.startsWith('maplibre-gl-worker-'))) {
    throw new Error(
      'Storybook is missing the MapLibre module worker; configure its Vite worker URL before rendering map stories',
    );
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
    const docsFrame = await waitForDocs(page, baseUrl, 'checkbox--docs', 'dark');
    await docsFrame.waitForSelector('lr-checkbox', { timeout: 15_000 });
    const darkDocsTheme = await docsFrame.evaluate(() => {
      const wrapper = document.querySelector('.sbdocs-wrapper');
      const heading = document.querySelector('.sbdocs-title');
      const checkbox = document.querySelector('lr-checkbox');
      const checkboxLabel = checkbox?.shadowRoot?.querySelector('[part="label"]');
      return {
        dataset: document.documentElement.dataset.lyraTheme,
        wrapperBackground: wrapper ? getComputedStyle(wrapper).backgroundColor : '',
        headingColor: heading ? getComputedStyle(heading).color : '',
        checkboxColor: checkboxLabel ? getComputedStyle(checkboxLabel).color : '',
      };
    });
    if (
      darkDocsTheme.dataset !== 'dark' ||
      darkDocsTheme.wrapperBackground !== 'rgb(13, 17, 23)' ||
      darkDocsTheme.headingColor !== 'rgb(240, 246, 252)' ||
      darkDocsTheme.checkboxColor !== 'rgb(240, 246, 252)'
    ) {
      throw new Error(`dark Docs theme is not consistently legible: ${JSON.stringify(darkDocsTheme)}`);
    }

    for (const privateMember of ['_checked', 'deferredLoad', 'effectiveLocale']) {
      if ((await docsFrame.getByText(privateMember, { exact: true }).count()) > 0) {
        throw new Error(`Checkbox Docs exposes non-public API member ${privateMember}`);
      }
    }
    if ((await docsFrame.getByText('checked', { exact: true }).count()) === 0) {
      throw new Error('Checkbox Docs did not render its public checked API');
    }

    await chooseToolbarTheme(page, 'Dark', 'Light');
    await docsFrame.waitForFunction(() => document.documentElement.dataset.lyraTheme === 'light');
    await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)');
    const lightDocsTheme = await docsFrame.evaluate(() => {
      const wrapper = document.querySelector('.sbdocs-wrapper');
      const heading = document.querySelector('.sbdocs-title');
      return {
        wrapperBackground: wrapper ? getComputedStyle(wrapper).backgroundColor : '',
        headingColor: heading ? getComputedStyle(heading).color : '',
      };
    });
    if (
      lightDocsTheme.wrapperBackground !== 'rgb(255, 255, 255)' ||
      lightDocsTheme.headingColor !== 'rgb(26, 26, 26)'
    ) {
      throw new Error(`light Docs theme did not follow the toolbar: ${JSON.stringify(lightDocsTheme)}`);
    }

    await chooseToolbarTheme(page, 'Light', 'High contrast');
    await docsFrame.waitForFunction(() => document.documentElement.dataset.lyraTheme === 'high-contrast');

    const landingFrame = await waitForDocs(page, baseUrl, 'introduction--docs', 'light');
    const lightLanding = await landingFrame.evaluate(() => {
      const landing = document.querySelector('.lr-landing');
      const heading = document.querySelector('.lr-landing h1');
      const primaryButtonText = document.querySelector('.lr-landing__button--primary p');
      return {
        dataset: document.documentElement.dataset.lyraTheme,
        backgroundImage: landing ? getComputedStyle(landing).backgroundImage : '',
        headingBackground: heading ? getComputedStyle(heading).backgroundImage : '',
        primaryButtonColor: primaryButtonText ? getComputedStyle(primaryButtonText).color : '',
      };
    });
    if (
      lightLanding.dataset !== 'light' ||
      lightLanding.backgroundImage === 'none' ||
      lightLanding.headingBackground === 'none' ||
      lightLanding.primaryButtonColor !== 'rgb(255, 255, 255)'
    ) {
      throw new Error(`Introduction did not render its light theme: ${JSON.stringify(lightLanding)}`);
    }

    const highContrastLandingFrame = await waitForDocs(page, baseUrl, 'introduction--docs', 'high-contrast');
    const highContrastLanding = await highContrastLandingFrame.evaluate(() => {
      const landing = document.querySelector('.lr-landing');
      const panel = document.querySelector('.lr-landing__showcase');
      const heading = document.querySelector('.lr-landing h1');
      return {
        dataset: document.documentElement.dataset.lyraTheme,
        backgroundImage: landing ? getComputedStyle(landing).backgroundImage : '',
        panelShadow: panel ? getComputedStyle(panel).boxShadow : '',
        headingColor: heading ? getComputedStyle(heading).color : '',
      };
    });
    if (
      highContrastLanding.dataset !== 'high-contrast' ||
      highContrastLanding.backgroundImage !== 'none' ||
      highContrastLanding.panelShadow !== 'none' ||
      highContrastLanding.headingColor !== 'rgb(0, 0, 0)'
    ) {
      throw new Error(`Introduction did not render its high-contrast theme: ${JSON.stringify(highContrastLanding)}`);
    }

    const dropdownDocsFrame = await waitForDocs(page, baseUrl, 'overlay-dropdown--docs', 'dark');
    const dropdownDocs = dropdownDocsFrame.locator('lr-dropdown').first();
    await dropdownDocs.evaluate((element) => {
      // A realistically tall action list proves both failure modes that a one-row popup can hide:
      // the Docs canvas must not cap Floating UI's available height, and the opened surface must
      // paint above the controls table that follows the story.
      for (let index = 1; index <= 8; index += 1) {
        const item = document.createElement('button');
        item.type = 'button';
        item.role = 'menuitem';
        item.textContent = `Additional menu action ${index}`;
        item.style.display = 'block';
        element.append(item);
      }
    });
    await dropdownDocs.locator('button[slot="trigger"]').click();
    await dropdownDocsFrame.waitForTimeout(150);
    const dropdownDocsLayout = await dropdownDocs.evaluate((element) => {
      const popup = element.shadowRoot?.querySelector('[part="popup"]');
      const canvas = element.closest('.docs-story');
      const preview = element.closest('.sbdocs-preview');
      const zoomWrapper = canvas?.querySelector(':scope > div:has(> .innerZoomElementWrapper)');
      if (!(popup instanceof HTMLElement) || !(canvas instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        return { error: 'Dropdown Docs did not render its expected popup/canvas structure' };
      }
      const rect = popup.getBoundingClientRect();
      const sampleYs = [rect.top + 4, rect.top + rect.height / 2, rect.bottom - 4];
      const samplesBelongToDropdown = sampleYs.map((y) => {
        const hit = document.elementFromPoint(rect.left + 8, y);
        return hit === element || (hit instanceof Node && element.contains(hit));
      });
      return {
        availableBlockSize: Number.parseFloat(
          getComputedStyle(popup).getPropertyValue('--lr-positioner-available-block-size'),
        ),
        clientHeight: popup.clientHeight,
        scrollHeight: popup.scrollHeight,
        canvasOverflow: getComputedStyle(canvas).overflow,
        previewOverflow: getComputedStyle(preview).overflow,
        zoomTransform: zoomWrapper ? getComputedStyle(zoomWrapper).transform : '',
        samplesBelongToDropdown,
      };
    });
    if (
      dropdownDocsLayout.error ||
      dropdownDocsLayout.clientHeight !== dropdownDocsLayout.scrollHeight ||
      dropdownDocsLayout.availableBlockSize < 200 ||
      dropdownDocsLayout.canvasOverflow !== 'visible' ||
      dropdownDocsLayout.previewOverflow !== 'visible' ||
      dropdownDocsLayout.zoomTransform !== 'none' ||
      !dropdownDocsLayout.samplesBelongToDropdown?.every(Boolean)
    ) {
      throw new Error(
        `Dropdown is clipped or stacked below surrounding Docs content: ${JSON.stringify(dropdownDocsLayout)}`,
      );
    }

    const narrowDocsPage = await browser.newPage({
      viewport: { width: 390, height: 800 },
      deviceScaleFactor: 1,
    });
    try {
      await narrowDocsPage.goto(
        `${baseUrl}/iframe.html?id=overlay-dropdown--docs&viewMode=docs&globals=theme:dark`,
        { waitUntil: 'domcontentloaded', timeout: 20_000 },
      );
      await narrowDocsPage.waitForSelector('.docblock-argstable', { timeout: 15_000 });
      const narrowArgsLayout = await narrowDocsPage.evaluate(() => {
        const table = document.querySelector('.docblock-argstable');
        const scroller = table?.parentElement;
        return {
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          scrollerClientWidth: scroller?.clientWidth ?? 0,
          scrollerScrollWidth: scroller?.scrollWidth ?? 0,
          scrollerOverflowX: scroller ? getComputedStyle(scroller).overflowX : '',
        };
      });
      if (
        narrowArgsLayout.documentScrollWidth > narrowArgsLayout.documentClientWidth + 1 ||
        narrowArgsLayout.scrollerScrollWidth <= narrowArgsLayout.scrollerClientWidth ||
        !['auto', 'scroll'].includes(narrowArgsLayout.scrollerOverflowX)
      ) {
        throw new Error(
          `Narrow Docs API table is not locally contained: ${JSON.stringify(narrowArgsLayout)}`,
        );
      }
    } finally {
      await narrowDocsPage.close();
    }

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

    const docsAudit = await auditComponentDocs(browser, baseUrl, componentDocsEntries);

    if (browserErrors.length) throw new Error(`Storybook browser errors:\n${browserErrors.join('\n')}`);

    console.log(
      `Docs layout audit passed for ${docsAudit.pages} component pages across ${docsAudit.checks} desktop, narrow, and RTL checks.`,
    );
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
