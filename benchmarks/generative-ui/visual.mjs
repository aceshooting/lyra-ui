#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildContext } from '../../packages/lyra-gen/scripts/measure-bundles.mjs';
import { comparePngs } from '../../packages/lyra-ui/scripts/visual-regression-compare.mjs';
import { serve } from './run.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const VISUAL_CASES = Object.freeze(['idle', 'complete', 'edited-rejected-tail', 'interrupted', 'reset']);

/** Record the actual semibold font, since an identical CSS stack can resolve differently by OS. */
async function visualFontIdentity(page, engine) {
  const computed = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.id = 'gen-visual-font-probe'; probe.textContent = 'Review note';
    probe.setAttribute('aria-hidden', 'true'); probe.style.font = '600 14px Arial, sans-serif';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    return { family: style.fontFamily, weight: style.fontWeight, size: style.fontSize };
  });
  let session;
  try {
    let platformFonts = null;
    if (engine === 'chromium') {
      session = await page.context().newCDPSession(page);
      await session.send('DOM.enable'); await session.send('CSS.enable');
      const { root } = await session.send('DOM.getDocument');
      const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#gen-visual-font-probe' });
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
      platformFonts = fonts.map(font => font.postScriptName).sort();
      assert.ok(platformFonts.length > 0 && platformFonts.every(name => typeof name === 'string' && name.length > 0), 'The font probe must resolve a real platform font.');
    }
    return { ...computed, platformFonts };
  } finally {
    if (session) await session.detach();
    await page.evaluate(() => document.getElementById('gen-visual-font-probe')?.remove());
  }
}
export function visualOptions(args) {
  const options = { browser: 'chromium', capture: false, baselines: undefined, output: undefined };
  for (const argument of args) {
    if (argument === '--capture') { options.capture = true; continue; }
    const [key, ...rest] = argument.split('='); const value = rest.join('=');
    if (key === '--browser' && ['chromium', 'firefox', 'webkit'].includes(value)) options.browser = value;
    else if (key === '--baselines' && value) options.baselines = value;
    else if (key === '--output' && value) options.output = value;
    else throw new Error('Invalid visual replay argument.');
  }
  if (!options.baselines || !options.output) throw new Error('Supply explicit --baselines and --output paths.');
  return options;
}
export function checkVisualBaseline(baseline, identity) {
  assert.equal(baseline.schemaVersion, 1);
  assert.equal(baseline.reviewed, true, 'Captured screenshots require visual review before comparison.');
  assert.deepEqual(baseline.identity, identity, 'Toolchain, browser, environment or recording changed; capture a new candidate for review.');
  assert.deepEqual(Object.keys(baseline.cases), [...VISUAL_CASES]);
}

export async function runVisual(options) {
  assert.equal(process.versions.node, (await readFile(join(here, '../../.nvmrc'), 'utf8')).trim(), 'Use the pinned Node version.');
  const context = await buildContext();
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-recorded-visual-'));
  const baselineDirectory = resolve(options.baselines);
  let browser, server;
  try {
    const build = await context.esbuild.build({
      absWorkingDir: here, entryPoints: [join(here, 'visual-fixture/main.js')], bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022',
      outdir: scratch, minify: true, sourcemap: false, metafile: true, logLevel: 'silent',
      conditions: ['browser', 'production'], define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [context.plugin], external: context.optionalPeers.flatMap(peer => [peer, `${peer}/*`]),
    });
    const externalImports = [...new Set(Object.values(build.metafile.outputs).flatMap(output => output.imports.filter(edge => edge.external).map(edge => edge.path)))].sort();
    await writeFile(join(scratch, 'index.html'), (await readFile(join(here, 'visual-fixture/index.html'), 'utf8')).replace('</head>', '<link rel="stylesheet" href="./main.css"></head>'));
    const hosted = await serve(scratch); server = hosted.server;
    const playwright = await import('playwright');
    browser = await playwright[options.browser].launch({ headless: true });
    const identity = {
      fixtureHash: hash(await readFile(join(here, '../../packages/lyra-gen/examples/recordings/chat-review.v1.json'))),
      node: process.versions.node, playwright: JSON.parse(await readFile(createRequire(import.meta.url).resolve('playwright/package.json'), 'utf8')).version,
      browser: options.browser, browserVersion: browser.version(), os: process.platform, arch: process.arch,
      viewport: { width: 900, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light',
    };
    if (options.capture) await mkdir(baselineDirectory, { recursive: false });
    const isolated = await browser.newContext({ viewport: identity.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: identity.locale, timezoneId: identity.timezoneId, colorScheme: identity.colorScheme, serviceWorkers: 'block' });
    let blocked = 0;
    const errors = [];
    await isolated.route('**/*', async route => {
      const request = route.request();
      if (new URL(request.url()).origin === hosted.origin && ['GET', 'HEAD'].includes(request.method())) await route.continue();
      else { blocked++; await route.abort(); }
    });
    await isolated.routeWebSocket(/.*/, socket => { blocked++; socket.close(); });
    const page = await isolated.newPage();
    page.on('pageerror', error => { errors.push(error.message); });
    page.setDefaultTimeout(15000);
    await page.goto(hosted.origin, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__recordedReplay));
    await page.evaluate(() => document.fonts.ready);
    identity.font = await visualFontIdentity(page, options.browser);
    const baseline = options.capture ? { schemaVersion: 1, reviewed: false, identity, cases: {} } : JSON.parse(await readFile(join(baselineDirectory, 'baseline.json'), 'utf8'));
    if (!options.capture) checkVisualBaseline(baseline, identity);
    const report = { schemaVersion: 1, status: options.capture ? 'candidate-needs-review' : 'passed', kind: 'recorded-authored-synthetic-visual', identity, externalImports, cases: [], interactions: [], networkBlocked: 0, pageErrors: [] };
    async function state(expected) {
      await page.waitForFunction(value => document.querySelector('main').dataset.replayState === value, expected);
      await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
    }
    async function screenshot(name) {
      await page.mouse.move(0, 0);
      const current = await page.screenshot({ animations: 'disabled', caret: 'hide' });
      if (options.capture) {
        await writeFile(join(baselineDirectory, `${name}.png`), current, { flag: 'wx' });
        baseline.cases[name] = hash(current);
        report.cases.push({ name, status: 'captured-candidate', sha256: hash(current) });
      } else {
        const reference = await readFile(join(baselineDirectory, `${name}.png`));
        assert.equal(hash(reference), baseline.cases[name], 'Baseline image changed without a corresponding reviewed manifest.');
        const comparison = comparePngs(reference, current);
        if (comparison.status !== 'match') {
          const failureDirectory = `${resolve(options.output)}.images`;
          await mkdir(failureDirectory, { recursive: true });
          await writeFile(join(failureDirectory, `${name}.current.png`), current, { flag: 'wx' });
          if (comparison.diffPng) await writeFile(join(failureDirectory, `${name}.diff.png`), comparison.diffPng, { flag: 'wx' });
          throw new Error(`Recorded replay visual mismatch: ${name}.`);
        }
        report.cases.push({ name, status: 'match', diffPixels: comparison.diffPixels, sha256: hash(current) });
      }
    }
    await state('idle'); await screenshot('idle');
    // Use real keyboard activation for the native replay button.
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button', { name: 'Replay recorded cadence', exact: true }).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Enter'); await state('complete');
    await page.waitForFunction(() => [...document.querySelector('main').querySelectorAll('lr-message-parts')].some(parts => [...parts.shadowRoot.querySelectorAll('lr-gen-view')].some(view => view.status === 'ready')));
    assert.equal(await page.locator('lr-gen-view lr-input input').count(), 1);
    assert.deepEqual(await page.locator('lr-gen-view lr-input [part="form-control-label"]').evaluate(element => {
      const style = getComputedStyle(element);
      return { family: style.fontFamily, weight: style.fontWeight, size: style.fontSize };
    }), { family: identity.font.family, weight: identity.font.weight, size: identity.font.size }, 'The pinned fixture font must reach generated form chrome.');
    await screenshot('complete'); report.interactions.push('keyboard-start-and-complete');
    const field = page.locator('lr-gen-view lr-input input');
    await field.fill('Keep this local edit');
    await page.getByRole('button', { name: 'Try an invalid generated tail', exact: true }).click(); await state('error');
    assert.equal(await field.inputValue(), 'Keep this local edit');
    const rejected = JSON.parse(await page.evaluate(() => window.__recordedReplay.snapshot()));
    assert.ok(rejected.islands.some(island => island.status === 'error'));
    assert.ok(rejected.islands.some(island => island.status === 'ready'));
    assert.match(await page.getByRole('status').first().textContent(), /Previously accepted content remains available/);
    await screenshot('edited-rejected-tail'); report.interactions.push('rejected-tail-retains-edited-control');
    await page.getByRole('button', { name: 'Reset replay', exact: true }).click(); await state('idle');
    await page.evaluate(() => window.__recordedReplay.interruptAfter(6));
    await page.getByRole('button', { name: 'Replay recorded cadence', exact: true }).click(); await state('interrupted');
    const interrupted = JSON.parse(await page.evaluate(() => window.__recordedReplay.snapshot()));
    assert.equal(interrupted.status, 'interrupted');
    assert.ok(interrupted.islands.some(island => island.status === 'ready'));
    assert.ok(interrupted.islands.some(island => island.status === 'incomplete'));
    assert.equal(await page.locator('lr-gen-view lr-input input').count(), 1);
    await screenshot('interrupted'); report.interactions.push('interrupt-at-recorded-boundary-retains-completed-island');
    // Reset through the UI while a timer is waiting, then prove the old replay never appends.
    await page.getByRole('button', { name: 'Replay recorded cadence', exact: true }).click(); await state('playing');
    await page.getByRole('button', { name: 'Reset replay', exact: true }).click(); await state('idle');
    await page.waitForTimeout(1900);
    assert.equal(await page.locator('main').getAttribute('data-replay-state'), 'idle');
    assert.equal(await page.locator('lr-gen-view').count(), 0);
    await screenshot('reset'); report.interactions.push('reset-cancels-pending-replay');
    await page.evaluate(() => window.__recordedReplay.demo.dispose());
    assert.equal(await page.locator('main > *').count(), 0);
    report.interactions.push('dispose-removes-demo');
    assert.equal(blocked, 0); assert.deepEqual(errors, []);
    report.networkBlocked = blocked; report.pageErrors = errors;
    if (options.capture) await writeFile(join(baselineDirectory, 'baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`, { flag: 'wx' });
    await writeFile(resolve(options.output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    return report;
  } finally {
    await Promise.allSettled([...(browser ? [browser.close()] : []), ...(server ? [new Promise(resolveClosed => server.close(resolveClosed))] : [])]);
    await rm(scratch, { recursive: true, force: true });
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await runVisual(visualOptions(process.argv.slice(2))).then(report => console.log(JSON.stringify({ status: report.status, cases: report.cases.length }))).catch(error => {
    console.error(`Recorded replay visual check failed: ${error.message}`); process.exitCode = 1;
  });
}
