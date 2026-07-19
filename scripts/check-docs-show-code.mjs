#!/usr/bin/env node
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
  const staticRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../storybook-static');
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const index = await page.goto(`${baseUrl}/index.json`, { waitUntil: 'domcontentloaded' });
if (!index?.ok()) throw new Error(`Could not load ${baseUrl}/index.json (${index?.status() ?? 'no response'})`);

const entries = await page.evaluate(() => fetch(new URL('index.json', location.href)).then((response) => response.json()));
const docs = Object.values(entries.entries)
  .filter((entry) => entry.type === 'docs')
  .map(({ id, title }) => ({ id, title }));
const end = endArg === undefined ? docs.length - 1 : Number(endArg);
const selected = docs.slice(start, end + 1);
const results = [];

for (const doc of selected) {
  const diagnostics = { console: [], pageErrors: [], requests: [] };
  const onConsole = (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      diagnostics.console.push({ type: message.type(), text: message.text() });
    }
  };
  const onPageError = (error) => diagnostics.pageErrors.push(String(error));
  const onRequestFailed = (request) =>
    diagnostics.requests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' });

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);

  let clicked = 0;
  let failure;
  try {
    await page.goto(`${baseUrl}/iframe.html?id=${encodeURIComponent(doc.id)}&viewMode=docs`, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    await page.waitForTimeout(160);
    const showCode = () => page.locator('button[role="switch"]').filter({ hasText: 'Show code' });
    while ((await showCode().count()) > 0 && clicked < 80) {
      await showCode().first().click({ timeout: 4_000 });
      clicked += 1;
      await page.waitForTimeout(20);
    }
    const remaining = await showCode().count();
    if (remaining > 0) failure = `${remaining} Show code control(s) remained visible`;
    results.push({ ...doc, clicked, remaining, failure, diagnostics });
  } catch (error) {
    results.push({ ...doc, clicked, remaining: null, failure: String(error), diagnostics });
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
}

await browser.close();
localServer?.close();

const structuralFailures = results.filter((result) => result.failure);
const diagnosticPages = results.filter(
  (result) => result.diagnostics.console.length || result.diagnostics.pageErrors.length || result.diagnostics.requests.length,
);
const summary = {
  url: baseUrl,
  range: [start, end],
  pages: results.length,
  controls: results.reduce((total, result) => total + result.clicked + (result.remaining ?? 0), 0),
  clicked: results.reduce((total, result) => total + result.clicked, 0),
  structuralFailures,
  diagnosticPages,
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode = structuralFailures.length ? 1 : 0;
