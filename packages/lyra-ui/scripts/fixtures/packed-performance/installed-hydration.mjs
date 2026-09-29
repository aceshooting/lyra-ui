import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureDir = fileURLToPath(new URL('.', import.meta.url));
const workerPath = join(fixtureDir, 'ssr-worker.mjs');
const browserRunnerPath = join(fixtureDir, 'hydration-runner.js');
const SSR_EXPORT = './ssr.js';
const HYDRATION_EXPORT = './hydration.js';
const REGISTRATION_EXPORT = './components/lr-input.js';
const PACKAGE_NAME = '@aceshooting/lyra-ui';

/** Resolves the simple public export shapes used by the installed qualification fixture. */
export function resolvePublicExportTarget(metadata, exportName) {
  const entry = metadata?.exports?.[exportName];
  const target = typeof entry === 'string' ? entry : entry?.default;
  assert.equal(typeof target, 'string', `package does not expose a default target for ${exportName}`);
  assert.ok(target.startsWith('./') && !target.includes('\\'), `${exportName} must resolve to a package-relative target`);
  const segments = target.slice(2).split('/');
  assert.ok(segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..'), `${exportName} target escapes package root`);
  return target;
}

function summarize(samples) {
  assert.ok(samples.length > 0, 'cannot summarize an empty timing distribution');
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction) => sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
  const meanMs = samples.reduce((total, value) => total + value, 0) / samples.length;
  const varianceMs2 = samples.reduce((total, value) => total + ((value - meanMs) ** 2), 0) / samples.length;
  return {
    count: samples.length,
    minMs: sorted[0],
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted.at(-1),
    meanMs,
    standardDeviationMs: Math.sqrt(varianceMs2),
    rawSamplesMs: samples,
  };
}

async function getPublicRouteTargets(packageInfo) {
  const targets = {
    ssr: resolvePublicExportTarget(packageInfo.metadata, SSR_EXPORT),
    hydration: resolvePublicExportTarget(packageInfo.metadata, HYDRATION_EXPORT),
    registration: resolvePublicExportTarget(packageInfo.metadata, REGISTRATION_EXPORT),
  };
  for (const [name, target] of Object.entries(targets)) {
    const path = join(packageInfo.root, target);
    assert.ok((await stat(path)).isFile(), `${packageInfo.key}: public ${name} export target is missing`);
  }
  const requireFromInstalledPackage = createRequire(join(packageInfo.root, 'package.json'));
  for (const [exportName, target] of [
    [SSR_EXPORT, targets.ssr],
    [HYDRATION_EXPORT, targets.hydration],
    [REGISTRATION_EXPORT, targets.registration],
  ]) {
    const resolved = requireFromInstalledPackage.resolve(`${PACKAGE_NAME}${exportName.slice(1)}`);
    assert.equal(
      resolved,
      join(packageInfo.root, target),
      `${packageInfo.key}: Node package export resolution disagrees with ${exportName}`,
    );
  }
  return targets;
}

/**
 * Runs SSR in a new worker per package so the server-side custom-element registry cannot leak
 * between the exact v23 and v24 installed tarballs. The worker imports only declared public
 * package routes; it never reads the repository component inventory.
 */
export async function renderInstalledHydrationFixture(packageInfo, config, { smokeOnly = false } = {}) {
  const targets = await getPublicRouteTargets(packageInfo);
  const result = await new Promise((accept, reject) => {
    const worker = new Worker(workerPath, {
      workerData: {
        ssrModulePath: join(packageInfo.root, targets.ssr),
        registrationModulePath: join(packageInfo.root, targets.registration),
        warmupSamples: smokeOnly ? 0 : config.warmupSamples,
        measuredSamples: smokeOnly ? 0 : config.measuredSamples,
        smokeOnly,
      },
    });
    let settled = false;
    worker.once('message', (message) => {
      settled = true;
      if (message?.ok) accept(message);
      else reject(new Error(`${packageInfo.key}: installed SSR worker failed: ${message?.error ?? 'unknown worker error'}`));
    });
    worker.once('error', (error) => {
      if (!settled) reject(error);
    });
    worker.once('exit', (code) => {
      if (!settled) reject(new Error(`${packageInfo.key}: installed SSR worker exited before returning a result (${code})`));
    });
  });
  assert.equal(result.mode, 'render-and-hydrate', `${packageInfo.key}: lr-input SSR mode is unsupported for identity testing`);
  return { ...result, targets };
}

function publicBrowserUrl(origin, packageInfo, target) {
  const relativeTarget = relative(packageInfo.root, join(packageInfo.root, target)).split(sep).join('/');
  assert.ok(relativeTarget.length > 0 && !relativeTarget.startsWith('../'), 'public route target escaped installed package');
  return `${origin}/packages/${packageInfo.key}/${relativeTarget}`;
}

export async function createHydrationPageHtml({ packageInfo, origin, importMap, ssr }) {
  const runner = await readFile(browserRunnerPath, 'utf8');
  const configuration = {
    hydrationUrl: publicBrowserUrl(origin, packageInfo, ssr.targets.hydration),
    registrationUrl: publicBrowserUrl(origin, packageInfo, ssr.targets.registration),
    expectedValue: ssr.expectedValue,
    expectedLightDomText: ssr.expectedLightDomText,
    measureTiming: ssr.measureTiming === true,
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script type="importmap">${JSON.stringify({ imports: importMap.imports })}</script><script>window.configuration=${JSON.stringify(configuration)}</script></head><body>${ssr.html}<script type="module">${runner}</script></body></html>`;
}

/**
 * Measures hydration of an installed public SSR result. The surrounding packed runner supplies
 * its already-verified browser, server, lock-bound package, import map, and common sample plan.
 */
export async function measureInstalledHydrationInBrowser({ browser, server, packageInfo, importMap, config, ssr }) {
  server.setPage(packageInfo.key, await createHydrationPageHtml({
    packageInfo,
    origin: server.origin,
    importMap,
    ssr,
  }));
  const samples = [];
  const warmups = [];
  for (let index = 0; index < config.warmupSamples + config.measuredSamples; index += 1) {
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
      page.on('response', (response) => {
        if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      await page.route('**/*', (route) => {
        if (route.request().url().startsWith(`${server.origin}/`)) return route.continue();
        errors.push(`unexpected external request: ${route.request().url()}`);
        return route.abort();
      });
      await page.goto(`${server.origin}/fixture/${packageInfo.key}/`, { waitUntil: 'load' });
      await page.waitForFunction(() => Boolean(window.__lyraHydrationResult), undefined, { timeout: 30000 });
      const result = await page.evaluate(() => window.__lyraHydrationResult);
      assert.deepEqual(errors, [], `${packageInfo.key}: hydration page had runtime or network errors`);
      assert.equal(result.preservedDeclarativeShadowRoot, true);
      assert.equal(result.preservedNativeInput, true);
      assert.equal(result.preservedInputValue, ssr.expectedValue);
      assert.equal(result.preservedLightDomNode, true);
      assert.equal(result.preservedLightDomText, ssr.expectedLightDomText);
      (index < config.warmupSamples ? warmups : samples).push(result.hydrationToUsableMs);
    } finally {
      await context.close();
    }
  }
  assert.equal(warmups.length, config.warmupSamples);
  assert.equal(samples.length, config.measuredSamples);
  return {
    mode: ssr.mode,
    server: {
      setupMs: ssr.setupMs,
      registrationMs: ssr.registrationMs,
      warmupSamples: ssr.warmupSamplesMs,
      render: summarize(ssr.renderSamplesMs),
    },
    browser: {
      warmupSamples: warmups,
      hydrationToUsable: summarize(samples),
    },
    assertions: {
      publicSsrRoute: SSR_EXPORT,
      publicHydrationRoute: HYDRATION_EXPORT,
      publicRegistrationRoute: REGISTRATION_EXPORT,
      modeVerifiedAsRenderAndHydrate: true,
      preservedDeclarativeShadowRoot: true,
      preservedNativeInputAndValue: true,
      preservedLightDomNodeAndContent: true,
    },
  };
}

/** Runs one public-route SSR/hydration identity check and deliberately records no timing values. */
export async function runInstalledHydrationSmoke({ browser, server, packageInfo, importMap, config }) {
  const ssr = await renderInstalledHydrationFixture(packageInfo, config, { smokeOnly: true });
  server.setPage(packageInfo.key, await createHydrationPageHtml({
    packageInfo,
    origin: server.origin,
    importMap,
    ssr,
  }));
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await page.route('**/*', (route) => {
      if (route.request().url().startsWith(`${server.origin}/`)) return route.continue();
      errors.push(`unexpected external request: ${route.request().url()}`);
      return route.abort();
    });
    await page.goto(`${server.origin}/fixture/${packageInfo.key}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.__lyraHydrationResult), undefined, { timeout: 30000 });
    const result = await page.evaluate(() => window.__lyraHydrationResult);
    assert.deepEqual(errors, [], `${packageInfo.key}: hydration smoke had runtime or network errors`);
    assert.equal(result.hydrationToUsableMs, undefined, 'smoke mode must not record timing samples');
    assert.equal(result.preservedDeclarativeShadowRoot, true);
    assert.equal(result.preservedNativeInput, true);
    assert.equal(result.preservedInputValue, ssr.expectedValue);
    assert.equal(result.preservedLightDomNode, true);
    assert.equal(result.preservedLightDomText, ssr.expectedLightDomText);
    return {
      mode: ssr.mode,
      assertions: {
        publicSsrRoute: SSR_EXPORT,
        publicHydrationRoute: HYDRATION_EXPORT,
        publicRegistrationRoute: REGISTRATION_EXPORT,
        modeVerifiedAsRenderAndHydrate: true,
        preservedDeclarativeShadowRoot: true,
        preservedNativeInputAndValue: true,
        preservedLightDomNodeAndContent: true,
        noTimingSamplesRecorded: true,
      },
    };
  } finally {
    await context.close();
  }
}
