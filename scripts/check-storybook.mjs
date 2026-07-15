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
];

const storyChecks = new Map([
  ['checkbox--default', 'lyra-checkbox'],
  ['dialog--open-initially', 'lyra-dialog'],
  ['responsivepanel--forced-overlay-bottom-sheet', 'lyra-responsive-panel'],
  ['apprail--forced-icon-only', 'lyra-app-rail'],
  ['table--default', 'lyra-table'],
  ['toast--triggers', 'button'],
  ['codeblock--plain-fallback', 'lyra-code-block'],
  ['charts-litechart--default', 'lyra-lite-chart'],
  ['map--default', 'lyra-map'],
  ['graph--default', 'lyra-graph'],
]);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
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

async function waitForStory(page, baseUrl, id, viewport, theme = 'light') {
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
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    for (const id of requiredStories) {
      await waitForStory(page, baseUrl, id, { width: 1280, height: 800 });
      await expectSelector(page, id, storyChecks.get(id));
    }

    await waitForStory(page, baseUrl, 'checkbox--default', { width: 1280, height: 800 }, 'dark');
    const darkTheme = await page.evaluate(() => ({
      scheme: document.documentElement.style.colorScheme,
      surface: document.documentElement.style.getPropertyValue('--lyra-theme-color-surface-default'),
    }));
    if (darkTheme.scheme !== 'dark' || darkTheme.surface !== '#0d1117') {
      throw new Error(`dark Storybook theme did not apply semantic tokens: ${JSON.stringify(darkTheme)}`);
    }
    await runA11y(page, 'checkbox--default/dark');

    await waitForStory(page, baseUrl, 'checkbox--default', { width: 1280, height: 800 }, 'high-contrast');
    const highContrastTheme = await page.evaluate(() => ({
      scheme: document.documentElement.style.colorScheme,
      surface: document.documentElement.style.getPropertyValue('--lyra-theme-color-surface-default'),
    }));
    if (highContrastTheme.scheme !== 'light' || highContrastTheme.surface !== 'Canvas') {
      throw new Error(`high-contrast Storybook theme did not apply semantic tokens: ${JSON.stringify(highContrastTheme)}`);
    }
    await runA11y(page, 'checkbox--default/high-contrast');

    await waitForStory(page, baseUrl, 'dialog--open-initially', { width: 1280, height: 800 });
    await runA11y(page, 'dialog--open-initially');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('lyra-dialog')?.hasAttribute('open'));

    await waitForStory(page, baseUrl, 'toast--triggers', { width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Neutral' }).click();
    await page.waitForSelector('lyra-toast', { state: 'attached', timeout: 3000 });

    await waitForStory(page, baseUrl, 'codeblock--plain-fallback', { width: 1280, height: 800 });
    const codeFallback = await page.locator('lyra-code-block').evaluate((element) => ({
      pre: Boolean(element.shadowRoot?.querySelector('[part="pre"]')),
      code: element.shadowRoot?.querySelector('[part="code"]')?.textContent ?? '',
    }));
    if (!codeFallback.pre || !codeFallback.code.includes('Just plain text')) {
      throw new Error(`plain code fallback did not render as expected: ${JSON.stringify(codeFallback)}`);
    }

    await waitForStory(page, baseUrl, 'responsivepanel--forced-overlay-bottom-sheet', { width: 390, height: 800 });
    await page.getByRole('button', { name: 'Open panel' }).click();
    await page.waitForFunction(() => document.querySelector('lyra-responsive-panel')?.hasAttribute('open'));
    const panelBox = await page.locator('lyra-responsive-panel').locator('[part="panel"]').boundingBox();
    if (!panelBox || panelBox.width <= 0 || panelBox.height <= 0) {
      throw new Error('bottom-sheet story has no visible layout box at mobile width');
    }

    for (const id of ['apprail--forced-icon-only', 'table--default', 'charts-litechart--default', 'map--default', 'graph--default']) {
      await waitForStory(page, baseUrl, id, { width: 1280, height: 800 });
      await runA11y(page, id);
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
