#!/usr/bin/env node
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { findUnexpectedDiagnostics, structuralDocsFailure } from './docs-diagnostics.mjs';

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return value.length ? [[key, value.join('=')]] : [];
  }),
);
const configuredUrl = args.get('url') ?? process.env.DOCS_URL;
let localServer;
let baseUrl = configuredUrl;
if (!baseUrl) {
  const staticRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    process.env.STORYBOOK_STATIC_DIR ?? '../storybook-static',
  );
  const mimeTypes = {
    '.css': 'text/css',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.mjs': 'text/javascript',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };
  localServer = createServer((request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const filePath = path.resolve(staticRoot, `.${requestPath === '/' ? '/index.html' : requestPath}`);
      if (!filePath.startsWith(`${staticRoot}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const file = statSync(filePath).isDirectory() ? path.join(filePath, 'index.html') : filePath;
      response.setHeader('Content-Type', mimeTypes[path.extname(file)] ?? 'application/octet-stream');
      createReadStream(file).on('error', () => response.writeHead(404).end()).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${localServer.address().port}`;
}
const start = Number(args.get('start') ?? 0);
const endArg = args.get('end');
const requestedConcurrency = Number(args.get('concurrency') ?? process.env.DOCS_CHECK_CONCURRENCY ?? 4);
const concurrency = Math.min(8, Math.max(1, Number.isFinite(requestedConcurrency) ? Math.trunc(requestedConcurrency) : 4));

const GOTO_TIMEOUT = 20_000;
const RENDER_TIMEOUT = 20_000;
const CLICK_TIMEOUT = 10_000;
/** Storybook's Source block flips its own label asynchronously; re-querying sooner re-clicks it. */
const CLICK_SETTLE_MS = 20;
const POLL_INTERVAL_MS = 120;
/** Consecutive idle polls that end a page: docs blocks mount progressively, well after `load`. */
const QUIET_POLLS = 3;
const STABILISE_BUDGET_MS = 30_000;
const MAX_CLICKS = 80;
/**
 * A docs page may navigate under us at any moment — `.storybook/preview.js` reloads the preview
 * once when a lazily imported chunk fails to resolve, and a story is free to do the same. Playwright
 * rejects whatever call was in flight when that happens ("interrupted by another navigation",
 * "Execution context was destroyed"), so each step is re-run against the document that won.
 */
const NAVIGATION_RACE =
  /interrupted by another navigation|Execution context was destroyed|frame (?:was |got )?detached|because of a navigation/i;
const NAVIGATION_ATTEMPTS = 4;

const isNavigationRace = (error) => NAVIGATION_RACE.test(String(error));

/** Re-runs `step` against the page that won a navigation race; other failures propagate untouched. */
async function tolerateNavigation(page, step) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await step();
    } catch (error) {
      if (attempt >= NAVIGATION_ATTEMPTS || !isNavigationRace(error) || page.isClosed()) throw error;
      await page.waitForLoadState('domcontentloaded', { timeout: GOTO_TIMEOUT }).catch(() => {});
    }
  }
}

/**
 * Drives one docs page on a page of its own, so a late navigation can only ever disturb the doc that
 * triggered it. Sharing a single tab across all docs let one stray reload interrupt the next doc's
 * `goto`, whose own (still queued) navigation then interrupted the doc after it — one late reload
 * cascaded into a run of unrelated pages, and the shared tab also mis-attributed console output to
 * whichever doc happened to be loading when it arrived.
 */
async function inspectDoc(context, doc) {
  const page = await context.newPage();
  const diagnostics = { console: [], pageErrors: [], requests: [], responses: [], navigations: [] };
  const navigationRequests = [];
  const onConsole = (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      diagnostics.console.push({
        type: message.type(),
        text: message.text(),
        url: message.location().url,
      });
    }
  };
  const onPageError = (error) => diagnostics.pageErrors.push(String(error));
  const onRequestFailed = (request) =>
    diagnostics.requests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' });
  const onResponse = (response) => {
    if (response.status() >= 400) {
      diagnostics.responses.push({ url: response.url(), status: response.status() });
    }
  };
  const onRequest = (request) => {
    // Only real document loads count — Storybook's own same-document history updates are not the
    // page replacing itself, and this list is what makes a self-reload visible in the summary.
    if (!request.isNavigationRequest()) return;
    try {
      if (request.frame() === page.mainFrame()) navigationRequests.push(request.url());
    } catch {
      // A request whose frame is already gone can't be the one we're still driving.
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);
  page.on('request', onRequest);

  let clicked = 0;
  try {
    await tolerateNavigation(page, () =>
      page.goto(`${baseUrl}/iframe.html?id=${encodeURIComponent(doc.id)}&viewMode=docs`, {
        waitUntil: 'domcontentloaded',
        timeout: GOTO_TIMEOUT,
      }),
    );
    // Storybook only flips <body> to one of these once the preview has actually rendered (or given
    // up). Counting before that is what let a slow page report "no Show code controls" and pass
    // while its controls were still mounting. The locator re-resolves across a reload.
    const renderedBody = () => page.locator('body.sb-show-main, body.sb-show-errordisplay, body.sb-show-nopreview');
    await tolerateNavigation(page, () => renderedBody().first().waitFor({ state: 'attached', timeout: RENDER_TIMEOUT }));

    const anySwitch = () => page.locator('button[role="switch"]');
    const showCode = () => anySwitch().filter({ hasText: 'Show code' });
    const deadline = Date.now() + STABILISE_BUDGET_MS;
    let idlePolls = 0;
    let previousTotal = -1;
    while (idlePolls < QUIET_POLLS && Date.now() < deadline && clicked < MAX_CLICKS) {
      let expanded = false;
      while ((await tolerateNavigation(page, () => showCode().count())) > 0 && clicked < MAX_CLICKS) {
        // Every "static" demo story on an autodocs page mounts and opens together (see e.g.
        // MentionPopover's stories), so a floating overlay left open by an earlier story can end up
        // sitting over a later toggle purely from where the page has grown to by now -- that's an
        // incidental visual overlap from unrelated demo content, not a real reason this toggle isn't
        // clickable. Scroll it into view as a normal click would, then dispatch a native click
        // directly on the element: immune to the coordinate-based hit-test a simulated mouse click
        // (even with `force`, which also skips the auto-scroll a real click gets) would fail on.
        await tolerateNavigation(page, async () => {
          const control = showCode().first();
          await control.scrollIntoViewIfNeeded({ timeout: CLICK_TIMEOUT });
          await control.evaluate((element) => element.click());
        });
        clicked += 1;
        expanded = true;
        await page.waitForTimeout(CLICK_SETTLE_MS);
      }
      const total = await tolerateNavigation(page, () => anySwitch().count());
      // A page that has replaced itself is mid-render, and its tally means nothing yet: re-checking
      // the render class every poll is what makes a self-reload cost a few more polls instead of an
      // early, empty pass. A freshly mounted docs block changes the tally the same way, so only an
      // unchanged, fully expanded, rendered page several polls running counts as done.
      const rendered = (await tolerateNavigation(page, () => renderedBody().count())) > 0;
      idlePolls = expanded || !rendered || total !== previousTotal ? 0 : idlePolls + 1;
      previousTotal = total;
      if (idlePolls < QUIET_POLLS) await page.waitForTimeout(POLL_INTERVAL_MS);
    }

    const remaining = await tolerateNavigation(page, () => showCode().count());
    const expandedSwitches = () => anySwitch().filter({ hasText: 'Hide code' });
    const expandedControls = await tolerateNavigation(page, () => expandedSwitches().count());
    const sourceTexts = await tolerateNavigation(page, () =>
      expandedSwitches().evaluateAll((controls) =>
        controls.map((control) => {
          const sourceId = control.getAttribute('aria-controls');
          return sourceId ? (document.getElementById(sourceId)?.textContent ?? '') : '';
        }),
      ),
    );
    diagnostics.navigations = navigationRequests.slice(1);
    // A page that never stops mounting controls, or one whose control never flips out of the
    // "Show code" state and is therefore clicked forever, is as broken as one left unexpanded.
    const failure = structuralDocsFailure({
      clicked,
      remaining,
      expandedControls,
      sourceTexts,
      settled: idlePolls >= QUIET_POLLS,
      reachedClickCap: clicked >= MAX_CLICKS,
      requiresControls: doc.importPath.includes('/src/components/'),
    });
    return {
      ...doc,
      clicked,
      remaining,
      expandedControls,
      sourceBlocks: sourceTexts.length,
      failure,
      diagnostics,
    };
  } catch (error) {
    diagnostics.navigations = navigationRequests.slice(1);
    return { ...doc, clicked, remaining: null, failure: String(error), diagnostics };
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
    page.off('request', onRequest);
    await page.close().catch(() => {});
  }
}

// Same reasoning as web-test-runner.config.js's chromiumLaunchOptions: /dev/shm is small
// (64MB on the runners, and by default in a container), this sweep drives several pages at
// once across every docs entry, and exhausting it kills the renderer with no CDP error --
// which reads as a stray action timeout on whichever story happened to be mid-scroll.
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
// One context for every doc: each doc still gets its own tab (its own navigation queue and session
// storage), but they share the HTTP cache, so 282 loads don't re-fetch the same Storybook chunks.
const context = await browser.newContext();
const indexPage = await context.newPage();
const index = await indexPage.goto(`${baseUrl}/index.json`, { waitUntil: 'domcontentloaded' });
if (!index?.ok()) throw new Error(`Could not load ${baseUrl}/index.json (${index?.status() ?? 'no response'})`);

const entries = await indexPage.evaluate(() =>
  fetch(new URL('index.json', location.href)).then((response) => response.json()),
);
await indexPage.close();
const docs = Object.values(entries.entries)
  .filter((entry) => entry.type === 'docs')
  .map(({ id, title, importPath }) => ({ id, title, importPath }));
const end = endArg === undefined ? docs.length - 1 : Number(endArg);
const selected = docs.slice(start, end + 1);
const results = new Array(selected.length);

const startedAt = Date.now();
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (cursor < selected.length) {
      const position = cursor;
      cursor += 1;
      results[position] = await inspectDoc(context, selected[position]);
    }
  }),
);
const elapsedMs = Date.now() - startedAt;

await context.close();
await browser.close();
localServer?.close();

const structuralFailures = results.filter((result) => result.failure);
const diagnosticPages = results.filter(
  (result) =>
    result.diagnostics.console.length ||
    result.diagnostics.pageErrors.length ||
    result.diagnostics.requests.length ||
    result.diagnostics.responses.length ||
    result.diagnostics.navigations.length,
);
const diagnosticFailures = results
  .map((result) => ({ ...result, unexpectedDiagnostics: findUnexpectedDiagnostics(result) }))
  .filter((result) => result.unexpectedDiagnostics.length > 0);
const summary = {
  url: baseUrl,
  range: [start, end],
  concurrency,
  elapsedMs,
  pages: results.length,
  controls: results.reduce((total, result) => total + result.clicked + (result.remaining ?? 0), 0),
  clicked: results.reduce((total, result) => total + result.clicked, 0),
  structuralFailures,
  diagnosticPages,
  diagnosticFailures,
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode = structuralFailures.length || diagnosticFailures.length ? 1 : 0;
