import { preparedAdversarial, preparedAdversarialCases } from './prepared-adversarial.mjs';
import { adversarial, adversarialCases } from './adversarial.mjs';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, firefox, webkit } = require('playwright');
const root = process.env.MAP_TEST_ASSETS;
if (!root) throw new Error('Missing test asset directory');
const requests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  let body, type;
  if (pathname === '/') {
    body =
      '<!doctype html><link rel="icon" href="data:,"><link rel="stylesheet" href="/map.css"><script type="module" src="/fixture.mjs"></script>';
    type = 'text/html';
  } else if (pathname === '/font.ttf') {
    body = fs.readFileSync(process.env.MAP_TEST_FONT);
    type = 'font/ttf';
  } else if (pathname === '/metadata-observation.json') {
    body = JSON.stringify({
      forbiddenTiles: requests.filter(request => request.path === '/metadata-forbidden.png').length,
      rasterTiles: requests.filter(request => request.path === '/raster.png').length
    });
    type = 'application/json';
  } else if (pathname === '/metadata-invalid-tilejson.json') {
    body = JSON.stringify({
      tiles: ['http://' + req.headers.host + '/metadata-forbidden.png'], minzoom: 0, maxzoom: 0, tileSize: 256, scheme: 'invalid'
    });
    type = 'application/json';
  } else if (pathname === '/metadata-valid-tilejson.json') {
    body = JSON.stringify({ tiles: ['http://' + req.headers.host + '/raster.png'], minzoom: 0, maxzoom: 0, tileSize: 256, scheme: 'xyz' });
    type = 'application/json';
  } else if (/^\/metadata-(invalid|valid)-sprite(?:@2x)?\.json$/.test(pathname)) {
    const icon = { x: 0, y: 0, width: 16, height: 16, pixelRatio: 1, sdf: false };
    body = JSON.stringify(pathname.includes('invalid')
      ? { partial: icon, broken: { ...icon, x: 250 } }
      : Object.fromEntries([['recovered', icon], ['constructor', icon], ['__proto__', icon], ['hasOwnProperty', icon]]));
    type = 'application/json';
  } else if (/^\/metadata-(invalid|valid)-sprite(?:@2x)?\.png$/.test(pathname) || pathname === '/metadata-forbidden.png') {
    body = fs.readFileSync(path.join(root, 'raster.png'));
    type = 'image/png';
  } else if (pathname === '/raster.png' || pathname === '/dem.png') {
    body = fs.readFileSync(path.join(root, pathname.slice(1)));
    type = 'image/png';
  } else if (pathname === '/style.json') {
    body = JSON.stringify({
      version: 8,
      sources: { sample: { type: 'geojson', data: JSON.parse(fs.readFileSync(path.join(root, 'data.json'))) } },
      layers: [
        { id: 'bg', type: 'background' },
        { id: 'circle', type: 'circle', source: 'sample' }
      ]
    });
    type = 'application/json';
  } else {
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + '/') || !fs.existsSync(file)) {
      console.log(JSON.stringify({ status: 404, path: pathname }));
      res.writeHead(404);
      res.end();
      return;
    }
    body = fs.readFileSync(file);
    type =
      pathname.endsWith('.js') || pathname.endsWith('.mjs')
        ? 'text/javascript'
        : pathname.endsWith('.json')
        ? 'application/json'
        : pathname.endsWith('.css')
        ? 'text/css'
        : 'application/octet-stream';
  }
  requests.push({ path: pathname, bytes: typeof body === 'string' ? Buffer.byteLength(body) : body.length });
  res.writeHead(200, {
    'content-type': type,
    'cache-control':
      /\.m?js$/.test(pathname) && pathname !== '/fixture.mjs' ? 'public,max-age=31536000,immutable' : 'no-store'
  });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = 'http://127.0.0.1:' + server.address().port;
const channel = process.argv[2] ?? 'chromium';
const engine = { chromium, firefox, webkit, chrome: chromium, msedge: chromium }[channel];
let display;
process.on('exit', () => display?.kill('SIGTERM'));
const headed = process.platform === 'linux' && (engine === firefox || engine === webkit);
let displayName = process.env.DISPLAY;
if (headed && !displayName) {
  display = spawn('Xvfb', ['-displayfd', '3', '-screen', '0', '1280x1024x24', '-nolisten', 'tcp'], {
    stdio: ['ignore', 'ignore', 'ignore', 'pipe']
  });
  displayName = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test display startup timeout')), 5000);
    display.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    display.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('Test display exited before initialization'));
    });
    let value = '';
    display.stdio[3].on('data', (chunk) => {
      value += chunk;
      if (value.includes('\n')) {
        clearTimeout(timer);
        resolve(':' + value.trim());
      }
    });
  });
}
const browser = await engine.launch({
  headless: !headed,
  ...(headed ? { env: { ...process.env, DISPLAY: displayName } } : {}),
  ...(engine === firefox ? { firefoxUserPrefs: { 'webgl.force-enabled': true } } : {}),
  ...(['chrome', 'msedge'].includes(channel) ? { channel } : {}),
  ...(engine === chromium ? { args: ['--enable-unsafe-swiftshader'] } : {}),
  timeout: 30000
});
const browserErrors = [];
const browserWarnings = [];
async function positive(name) {
  const context = await browser.newContext();
  const pageErrors = [],
    consoleErrors = [];
  const externalScripts = [];
  if (name === 'built-in-mixed-direction-label') context.on('request', (request) => {
    const target = new URL(request.url());
    if ((request.resourceType() === 'script' || /\.m?js$/.test(target.pathname)) &&
        target.origin !== new URL(url).origin) {
      externalScripts.push(request.url());
    }
  });
  context.on('page', (page) => {
    page.on('pageerror', (e) => pageErrors.push({ url: page.url(), message: e.message }));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
      if (m.type() === 'warning') browserWarnings.push({ name, message: m.text() });
    });
  });
  const page = await context.newPage();
  let result, failure;
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.ready, null, { timeout: 15000 });
    result = await page.evaluate((name) => window.fixture.run(name), name);
    await page.evaluate(() => window.fixture.finish());
    if (name === 'built-in-mixed-direction-label' && externalScripts.length) {
      throw Error('Mixed-direction label requested an external text plugin: ' + JSON.stringify(externalScripts));
    }
  } catch (error) {
    failure = error;
  } finally {
    await context.close();
    browserErrors.push(
      ...pageErrors.map((error) => ({ name, ...error })),
      ...consoleErrors.map((message) => ({ name, message }))
    );
  }
  if (failure || pageErrors.length || consoleErrors.length) {
    const error = failure ?? Error(JSON.stringify({ pageErrors, consoleErrors }));
    error.pageErrors = pageErrors;
    error.consoleErrors = consoleErrors;
    throw error;
  }
  return { ...result, pageErrors, consoleErrors, ...(name === 'built-in-mixed-direction-label' ? { externalScripts } : {}) };
}
const results = [];
const cases = process.env.MAP_TEST_CASES?.split(',') ?? [
  'prepared-canvas-identity',
  'prepared-features-null-style',
  'built-in-mixed-direction-label',
  'canvas-image',
  'raster',
  'geojson',
  'vector-symbol',
  'cluster',
  'dynamic-features',
  'terrain',
  'custom',
  'prepare-features-null-style',
  'invalid-source-preparation',
  'invalid-remote-metadata',
  'controls-exports',
  'url-transform',
  'context-restore',
  'reconnect',
  ...preparedAdversarialCases,
  ...adversarialCases
];
for (const name of cases) {
  const requestStart = requests.length;
  let result;
  try {
    result = preparedAdversarialCases.includes(name) ? await preparedAdversarial(browser, url, name) :
      adversarialCases.includes(name) ? await adversarial(browser, url, name) : await positive(name);
  } catch (error) {
    result = {
      name,
      passed: false,
      error: error.message,
      pageErrors: error.pageErrors ?? [],
      consoleErrors: error.consoleErrors ?? []
    };
  }
  const caseRequests = requests.slice(requestStart);
  result.coldContext = true;
  result.requests = caseRequests;
  result.httpBytes = caseRequests.reduce((sum, request) => sum + request.bytes, 0);
  result.scriptBytes = caseRequests
    .filter((request) => /\.m?js$/.test(request.path))
    .reduce((sum, request) => sum + request.bytes, 0);
  results.push(result);
  console.log(JSON.stringify(result));
}
const closeStart = performance.now();
let closed = false;
const close = browser.close().then(() => (closed = true));
let timer;
await Promise.race([close, new Promise((r) => (timer = setTimeout(r, 10000)))]);
clearTimeout(timer);
const strictClose = closed && performance.now() - closeStart < 10000;
await close;
const closeMs = performance.now() - closeStart;
if (display) {
  const done = new Promise((r) => display.once('exit', r));
  display.kill('SIGTERM');
  await done;
}
await new Promise((r) => server.close(r));
const receipt = {
  channel,
  headed,
  firefoxUserPrefs: engine === firefox ? { 'webgl.force-enabled': true } : undefined,
  browserVersion: browser.version(),
  playwright: require('playwright/package.json').version,
  node: process.version,
  results,
  browserErrors,
  browserWarnings,
  strictClose,
  closeMs,
  requests
};
fs.writeFileSync(process.env.MAP_TEST_RESULT, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ channel, results, browserErrors, browserWarnings, strictClose }));
process.exitCode = results.some((x) => !x.passed) || browserErrors.length || !strictClose ? 1 : 0;
