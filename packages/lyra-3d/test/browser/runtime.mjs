import fs from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, firefox, webkit } = require('playwright');
const root = process.env.LYRA_3D_TEST_ASSETS;
if (!root) throw new Error('Missing test asset directory');
const channel = process.argv[2] ?? 'chromium';
// Set by scripts/coverage.mjs: each page's Chromium V8 ranges are saved for the coverage report.
const coverageOutput = process.env.LYRA_3D_COVERAGE_OUTPUT;
if (coverageOutput) fs.mkdirSync(coverageOutput, { recursive: true });
let coveragePages = 0;
const engine = { chromium, firefox, webkit, chrome: chromium, msedge: chromium }[channel];
if (!engine) throw new Error(`Unknown browser ${channel}`);

// Opt-in real-GPU configuration for frame-rate measurement, Chromium only. Default runs render in
// software (SwiftShader, llvmpipe) and never assert a frame rate.
const gpu = process.env.LYRA_3D_GPU;
const GPU_CONFIGURATIONS = {
  vulkan: {
    args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-surface', '--ignore-gpu-blocklist'],
    env: { VK_ICD_FILENAMES: process.env.VK_ICD_FILENAMES ?? '/usr/share/vulkan/icd.d/nvidia_icd.json' },
  },
  egl: {
    args: ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'],
    env: { __EGL_VENDOR_LIBRARY_FILENAMES: process.env.__EGL_VENDOR_LIBRARY_FILENAMES ?? '/usr/share/glvnd/egl_vendor.d/10_nvidia.json' },
  },
};
if (gpu && (engine !== chromium || !GPU_CONFIGURATIONS[gpu])) {
  throw new Error(`LYRA_3D_GPU=${gpu} needs Chromium and one of ${Object.keys(GPU_CONFIGURATIONS).join(', ')}`);
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end();
    return;
  }
  const type = file.endsWith('.html') ? 'text/html' : /\.m?js$/u.test(file) ? 'text/javascript' : 'application/octet-stream';
  response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

// Headless Firefox has no WebGL on Linux, so Firefox (and WebKit, for parity with the map
// companion) run headed on a private display.
let display;
process.on('exit', () => display?.kill('SIGTERM'));
const headed = process.platform === 'linux' && (engine === firefox || engine === webkit);
let displayName = process.env.DISPLAY;
if (headed && !displayName) {
  display = spawn('Xvfb', ['-displayfd', '3', '-screen', '0', '1280x1024x24', '-nolisten', 'tcp'], {
    stdio: ['ignore', 'ignore', 'ignore', 'pipe'],
  });
  displayName = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test display startup timeout')), 5000);
    display.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    let value = '';
    display.stdio[3].on('data', (chunk) => {
      value += chunk;
      if (value.includes('\n')) {
        clearTimeout(timer);
        resolve(`:${value.trim()}`);
      }
    });
  });
}
const configuration = gpu ? GPU_CONFIGURATIONS[gpu] : undefined;
const browser = await engine.launch({
  headless: !headed,
  ...(headed || configuration ? { env: { ...process.env, ...(headed ? { DISPLAY: displayName } : {}), ...configuration?.env } } : {}),
  ...(engine === firefox ? { firefoxUserPrefs: { 'webgl.force-enabled': true } } : {}),
  ...(['chrome', 'msedge'].includes(channel) ? { channel } : {}),
  ...(engine === chromium ? { args: configuration?.args ?? ['--enable-unsafe-swiftshader'] } : {}),
  timeout: 30000,
});

async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  const page = await context.newPage();
  if (coverageOutput) await page.coverage.startJSCoverage({ resetOnNavigation: false });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.ready, null, { timeout: 15000 });
  return { context, page, errors };
}

async function saveCoverage(page) {
  if (!coverageOutput) return;
  // Page scripts are served from the consumer build, which the report reads again; only the
  // ranges are kept, one file per page.
  const entries = (await page.coverage.stopJSCoverage()).map(({ url, functions }) => ({ url, functions }));
  coveragePages += 1;
  fs.writeFileSync(path.join(coverageOutput, `page-${String(coveragePages).padStart(4, '0')}.json`), JSON.stringify(entries));
}

/**
 * Expected noise: 404s for the deliberately missing worker, and three.js reporting the context it
 * could not create in the unsupported-browser case. Any other page error fails the case.
 */
const unexpected = (errors) => errors.filter((entry) =>
  !/missing\.worker|404|Failed to load resource|THREE\.WebGLRenderer: Error creating WebGL context/iu.test(entry));

async function runCase(name) {
  const { context, page, errors } = await openPage();
  try {
    const result = await page.evaluate((caseName) => window.fixture.run(caseName), name);
    await saveCoverage(page);
    return { ...result, errors: unexpected(errors) };
  } finally {
    await context.close();
  }
}

async function runPointerCase(name) {
  const { context, page, errors } = await openPage();
  try {
    const prepared = await page.evaluate((caseName) => window.fixture.setup(caseName), name);
    const points = prepared.setup;
    if (name.startsWith('viewport-') && prepared.action === 'drag') {
      await page.mouse.move(points.start.x, points.start.y);
      await page.mouse.down();
      await page.mouse.move(points.end.x, points.end.y, { steps: prepared.steps ?? 12 });
      if (name === 'viewport-drag-render-failure') {
        await page.evaluate((caseName) => window.fixture.checkpoint(caseName), name);
      }
      await page.mouse.up();
    } else if (name.startsWith('graph-')) {
      await page.mouse.move(points.start.x, points.start.y);
      if (name === 'graph-pick') {
        await page.mouse.click(points.start.x, points.start.y);
        await page.mouse.dblclick(points.end.x, points.end.y);
      } else {
        await page.mouse.down();
        await page.mouse.move(points.end.x, points.end.y, { steps: 8 });
        const action = { 'graph-drag-pin': 'moved', 'graph-drag-cancel': 'cancel', 'graph-drag-replace': 'replace' }[name];
        if (action) await page.evaluate(([n, a]) => window.fixture.graphCheckpoint(n, a), [name, action]);
        await page.mouse.up();
        if (name === 'graph-drag-replace') await page.mouse.move(points.end.x + 30, points.end.y + 10);
      }
    } else if (name.startsWith('points-') && prepared.action === 'drag' || name === 'panorama-orbit') {
      const modifiers = prepared.modifiers ?? [];
      await page.mouse.move(points.start.x, points.start.y);
      for (const key of modifiers) await page.keyboard.down(key);
      try {
        await page.mouse.down({ button: prepared.button ?? 'left' });
        await page.mouse.move(points.end.x, points.end.y, { steps: prepared.steps ?? 12 });
        await page.evaluate((n) => n.startsWith('points-') ? window.fixture.pointsCheckpoint(n, 'moved') : window.fixture.panoramaCheckpoint(n, 'moved'), name);
        await page.mouse.up({ button: prepared.button ?? 'left' });
      } finally {
        for (const key of modifiers.reverse()) await page.keyboard.up(key);
      }
    } else if (name === 'points-hover-click' || name === 'panorama-hotspot-click') {
      await page.mouse.move(points.hover.x, points.hover.y, { steps: 4 });
      await page.waitForTimeout(150);
      await page.mouse.click(points.click.x, points.click.y);
      const double = points.double ?? points.click;
      await page.mouse.dblclick(double.x, double.y);
      await page.keyboard.down('Shift');
      try { await page.mouse.click(points.empty.x, points.empty.y); } finally { await page.keyboard.up('Shift'); }
    } else if (name === 'orbit') {
      await page.mouse.move(points.start.x, points.start.y);
      await page.mouse.down();
      await page.mouse.move(points.end.x, points.end.y, { steps: 12 });
      await page.mouse.up();
    } else if (name === 'hover-click') {
      await page.mouse.move(points.hover.x, points.hover.y, { steps: 4 });
      await page.waitForTimeout(150);
      await page.mouse.click(points.click.x, points.click.y);
      await page.mouse.dblclick(points.click.x, points.click.y);
      await page.keyboard.down('Shift');
      await page.mouse.click(points.empty.x, points.empty.y);
      await page.keyboard.up('Shift');
    }
    const result = await page.evaluate(([caseName, setup]) => window.fixture.verify(caseName, setup), [name, prepared]);
    await saveCoverage(page);
    return { ...result, errors: unexpected(errors) };
  } finally {
    await context.close();
  }
}

const { page: probe, context: probeContext } = await openPage();
const caseNames = await probe.evaluate(() => window.fixture.caseNames);
const pointerCaseNames = await probe.evaluate(() => window.fixture.pointerCaseNames);
const performanceCaseNames = await probe.evaluate(() => window.fixture.performanceCaseNames);
await probeContext.close();
const selected = process.env.LYRA_3D_TEST_CASES?.split(',');
const inventory = [...caseNames, ...pointerCaseNames, ...performanceCaseNames];
// Unknown selections use the normal receipt/teardown path too.
const results = (selected ?? []).filter((name) => !inventory.includes(name)).map((name) => ({
  name, passed: false, error: 'Unknown selected browser case', errors: [],
}));
for (const name of gpu ? performanceCaseNames : [...caseNames, ...pointerCaseNames]) {
  if (selected && !selected.includes(name)) continue;
  let result;
  try {
    result = pointerCaseNames.includes(name) ? await runPointerCase(name) : await runCase(name);
  } catch (error) {
    result = { name, passed: false, error: String(error?.message ?? error), errors: [] };
  }
  if (result.errors.length > 0 || result.skipped) result.passed = false;
  results.push(result);
  console.log(JSON.stringify(result));
}
const browserVersion = browser.version();
await browser.close();
if (display) {
  const exited = new Promise((resolve) => display.once('exit', resolve));
  display.kill('SIGTERM');
  await exited;
}
await new Promise((resolve) => server.close(resolve));
const receipt = {
  channel,
  headed,
  gpu: gpu ?? null,
  browserVersion,
  playwright: require('playwright/package.json').version,
  node: process.version,
  results,
};
fs.writeFileSync(process.env.LYRA_3D_TEST_RESULT, JSON.stringify(receipt, null, 2));
const failed = results.filter((result) => !result.passed && !result.skipped).map((result) => result.name);
const unqualified = results.filter((result) => result.skipped).map((result) => ({ name: result.name, reason: result.skipped }));
const passed = results.filter((result) => result.passed && !result.skipped).length;
console.log(JSON.stringify({ channel, gpu: gpu ?? null, passed, failed, unqualified }));
process.exitCode = failed.length > 0 || unqualified.length > 0 || results.length === 0 ? 1 : 0;
