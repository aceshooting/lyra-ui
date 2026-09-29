import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import axe from 'axe-core';

const started = Date.now();
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const engine = option('--browser', 'chromium');
const directory = resolve(option('--storybook-dir', 'storybook-static'));
const port = Number(option('--port', '8350'));
// This URL is served by the test HTTP server, not resolved as a Node module.
const diagnosticsRoute = '/__builder_diagnostics.js';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
let failBuilderModule = false;
let builderFaultCss;
let delayBuilderModule = false;
let delayedBuilderUrl;
const delayedBuilder = [];
let failLocale = false;
let delayArabic = false;
let releaseArabic;
const localeFailureRequests = [];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (failBuilderModule && /^\/assets\/view-[^/]+\.js$/.test(pathname)) {
      // Isolate the injected JavaScript outage from styles canceled by recovery navigation.
      const css = await builderFaultCss?.ready;
      assert.equal(css?.status, 200, 'fault document stylesheet did not finish successfully');
      intentionalFailures.add(`http://127.0.0.1:${port}${pathname}`); injectedModuleFailures++; response.writeHead(503, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end('Unavailable'); return; }
    if (delayBuilderModule && /^\/assets\/view-[^/]+\.js$/.test(pathname)) { delayedBuilderUrl = `http://127.0.0.1:${port}${pathname}`; await new Promise(resolve => delayedBuilder.push(resolve)); }
    if (failLocale && /^\/assets\/ur-[^/]+\.js$/.test(pathname)) { const url = `http://127.0.0.1:${port}${pathname}`; intentionalFailures.add(url); localeFailureRequests.push(url); response.writeHead(503, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }).end('Unavailable'); return; }
    if (delayArabic && /^\/assets\/ar-[^/]+\.js$/.test(pathname)) await new Promise(resolve => { releaseArabic = resolve; });
    if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    if (pathname === diagnosticsRoute) { response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await readFile('.storybook/theme-builder/diagnostics.js')); return; }
    const file = resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${directory}${sep}`)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(accept => server.listen(port, '127.0.0.1', accept));
const browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const external = [];
const intentionalFailures = new Set();
let injectedModuleFailures = 0;
const expectedConsole = [];
const unexpectedNetworkFailures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() !== 'error') return;
  if (intentionalFailures.has(message.location().url) && /Failed to load resource|Load failed|Loading failed for the module/.test(message.text())) expectedConsole.push(message.text());
  else errors.push(message.text());
});
page.on('requestfailed', request => { if (!intentionalFailures.has(request.url())) unexpectedNetworkFailures.push(request.url()); });
page.on('request', request => { if (!request.url().startsWith(`http://127.0.0.1:${port}/`) && !request.url().startsWith('data:')) external.push(request.url()); });
const check = (condition, message) => assert.ok(condition, message);
let checks = 0;
async function verify(name, work) { await work(); checks++; console.log(`PASS ${name}`); }
const evaluate = (fn, data) => page.evaluate(fn, data);
const wait = () => page.waitForTimeout(260);
try {
  const inspectedModules = [];
  const inspectModule = response => {
    if (/\.js(?:\?|$)/.test(response.url())) inspectedModules.push(response.text().then(text => text.includes('data-apply-import') || text.includes('com.aceshooting.lyra.looks')).catch(() => false));
  };
  page.on('response', inspectModule);
  await page.goto(`http://127.0.0.1:${port}/iframe.html?id=theming-composable-styles--playground&viewMode=story`);
  await page.locator('[data-style-demo]').waitFor(); await page.waitForTimeout(200);
  page.off('response', inspectModule);
  await verify('ordinary story does not load the builder view or tooling interchange', async () => assert.equal((await Promise.all(inspectedModules)).some(Boolean), false));
  await page.goto(`http://127.0.0.1:${port}/iframe.html?id=theming-theme-builder--editor&viewMode=story`);
  await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder), { timeout: 60000 });
  await wait();
  if (process.env.TMPDIR) await page.screenshot({ path: `${process.env.TMPDIR}/builder-${engine}-desktop.png` });
  const baseline = await evaluate(() => ({ root: document.documentElement.getAttribute('style'), attrs: [...document.documentElement.attributes].map(a => [a.name, a.value]), storage: { ...localStorage } }));
  if (args.includes('--diagnose-layout')) {
    await page.setViewportSize({ width: 320, height: 900 });
    await evaluate(() => { document.documentElement.style.fontSize = '32px'; document.querySelector('.tb-builder').dir = 'rtl'; }); await wait();
    console.log(JSON.stringify(await evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, nodes: [...document.querySelectorAll('*')].map(node => ({ tag: node.tagName, cls: node.className?.toString(), width: node.getBoundingClientRect().width, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, scroll: node.scrollWidth })).filter(node => node.right > innerWidth + 1 || node.left < -1).slice(0, 45) })), null, 2));
    await page.screenshot({ path: process.env.TMPDIR + '/layout-first.png', fullPage: true });
  } else {
  await verify('lazy editor mounted real controls and both previews', async () => {
    const status = await evaluate(() => ({ previews: document.querySelectorAll('[data-preview]').length, fields: document.querySelectorAll('[data-token]').length, rows: document.querySelectorAll('[data-diagnostic]').length, input: !!document.querySelector('lr-input').shadowRoot?.querySelector('input') }));
    assert.equal(status.previews, 2); check(status.fields >= 40, 'advanced fields missing'); check(status.rows > 70, 'diagnostics missing'); check(status.input, 'controls not upgraded');
    assert.equal(await evaluate(() => [...document.querySelectorAll('link[rel="modulepreload"]')].some(link => /\/view-[^/]+\.js$/.test(link.href))), false, 'builder entry redundantly module-preloaded');
  });
  await verify('missing tokens and incomplete palettes remain unknown; transparent marks cannot pass', async () => {
    const result = await evaluate(async url => {
      const { measureBuilderPreview } = await import(url);
      const root = document.createElement('section'); root.dataset.resolvedMode = 'light'; root.style.backgroundColor = 'white'; root.style.color = 'black';
      root.style.setProperty('--lr-theme-color-text-normal', 'initial');
      document.body.append(root);
      const missing = measureBuilderPreview([root], 0).rows.find(row => row.name === 'text-normal / default');
      root.innerHTML = '<svg>' + Array.from({ length: 8 }, () => '<rect data-palette-mark fill="rgba(0,0,0,0)"></rect>').join('') + '</svg>';
      const transparent = measureBuilderPreview([root], 1).rows.filter(row => row.field === 'palette');
      root.querySelector('rect').setAttribute('fill', 'none');
      const incomplete = measureBuilderPreview([root], 2).rows.filter(row => row.state === 'simulation');
      const host = document.createElement('div'); host.dataset.brand = ''; root.append(host); host.attachShadow({ mode: 'open' }).innerHTML = '<button style="font-size:32px;font-weight:400;color:#777;background:white">Large label</button>';
      const large = measureBuilderPreview([root], 3).rows.find(row => row.name === 'rendered brand button');
      host.shadowRoot.querySelector('button').style.fontSize = '16px';
      const regular = measureBuilderPreview([root], 4).rows.find(row => row.name === 'rendered brand button');
      root.remove(); return { missing, transparent, incomplete, large, regular };
    }, diagnosticsRoute);
    assert.equal(result.missing.result, 'unknown');
    assert.equal(result.large.threshold, 3); assert.equal(result.large.result, 'pass');
    assert.equal(result.regular.threshold, 4.5); assert.equal(result.regular.result, 'fail');
    check(result.transparent.every(row => row.result !== 'pass'), 'transparent mark evidence incorrectly passed');
    check(result.incomplete.every(row => row.result === 'unknown'), 'incomplete palette evidence incorrectly passed');
  });
  await verify('built diagnostics reject transparent palette evidence and expose missing colors', async () => {
    const result = await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      c.change({ type: 'group', group: 'palette', tokens: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`--lr-theme-color-chart-${i + 1}`, 'transparent'])) });
      await c.whenSettled();
      const floored = c.measure().rows.filter(row => row.field === 'palette' && row.state === 'rest');
      const retained = Object.values(c.draft.groups.palette).every(value => value === 'transparent');
      // Runtime styles deliberately floor authored chart colors. Exercise actual transparent
      // rendered marks separately so this diagnostic assertion does not contradict that contract.
      document.querySelectorAll('[data-palette-mark]').forEach(mark => mark.setAttribute('fill', 'transparent'));
      const palette = c.measure().rows.filter(row => row.field === 'palette' && row.state !== 'scale');
      const roots = [...document.querySelectorAll('[data-preview]')];
      roots.forEach(root => root.style.setProperty('--lr-theme-color-text-normal', 'initial'));
      const missing = c.measure().rows.filter(row => row.name === 'text-normal / default');
      roots.forEach(root => root.style.removeProperty('--lr-theme-color-text-normal'));
      const button = roots[0].querySelector('[data-brand]').shadowRoot.querySelector('button');
      const originalStyle = button.style.cssText; const textCases = [];
      try { for (const [size, weight] of [[32, 400], [16, 400], [19, 700], [18, 700]]) {
        button.style.cssText = `font-size:${size}px;font-weight:${weight};color:#777;background:white;transition:none!important`;
        const row = c.measure().rows.find(row => row.mode === 'light' && row.name === 'rendered brand button');
        textCases.push([row.threshold, row.result, row.foreground, row.background]);
      }
      } finally { button.style.cssText = originalStyle; }
      c.change({ type: 'reset' }); await c.whenSettled();
      return { palette, missing, floored, retained, textCases };
    });
    assert.deepEqual(result.textCases.map(row => row.slice(0, 2)), [[3, 'pass'], [4.5, 'fail'], [3, 'pass'], [4.5, 'fail']]);
    result.textCases.forEach(row => assert.deepEqual(row.slice(2), ['rgb(119, 119, 119)', 'rgb(255, 255, 255)']));
    check(result.retained, 'authored transparent palette was lost');
    check(result.floored.length === 16 && result.floored.every(row => row.result === 'pass'), 'runtime chart contrast floor missing');
    check(result.palette.every(row => row.result !== 'pass'), `built transparent palette passed: ${JSON.stringify(result.palette)}`);
    check(result.missing.every(row => row.result === 'unknown'), 'built missing tokens were measured');
  });
  await verify('all look × density × surface × resolved-mode cells preserve scoped state', async () => {
    const ids = await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.catalog.looks.map(look => look.id));
    let cells = 0;
    for (const look of ids) for (const density of ['compact', 'comfortable', 'touch']) for (const surface of ['solid', 'glass']) for (const mode of ['light', 'dark']) {
      await evaluate(({ look, density, surface, mode }) => {
        const c = document.querySelector('[data-theme-builder]').themeBuilder;
        c.change({ type: 'look', look: c.catalog.looks.find(item => item.id === look) });
        for (const [name, value] of Object.entries({ density, surface, mode })) c.change({ type: 'axis', name, value });
      }, { look, density, surface, mode });
      await wait();
      const actual = await evaluate(() => {
        const root = document.querySelector('[data-preview="primary"]');
        return { look: root.getAttribute('data-lr-look'), density: root.getAttribute('data-lr-density'), surface: root.getAttribute('data-lr-surface'), mode: root.dataset.resolvedMode, bg: getComputedStyle(root).backgroundColor, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      assert.equal(actual.look, look); assert.equal(actual.density, density); assert.equal(actual.surface, surface); assert.equal(actual.mode, mode); check(actual.bg !== 'rgba(0, 0, 0, 0)', 'preview unpainted'); check(actual.overflow <= 1, 'page overflow'); cells++;
    }
    console.log(`MATRIX ${cells} cells, ${ids.length} looks`);
  });
  await verify('named and custom accents change painted button colors', async () => {
    let prior;
    for (const value of ['emerald', 'peridot', 'topaz', 'ruby', 'tourmaline', 'amethyst', 'aquamarine', 'sapphire', 'hematite', '#ffee44', { brand: { light: '#eeeeee', dark: '#101010' }, danger: '#663355' }]) {
      await evaluate(value => document.querySelector('[data-theme-builder]').themeBuilder.change({ type: 'axis', name: 'accent', value }), value); await wait();
      const fill = await evaluate(() => getComputedStyle(document.querySelector('[data-preview] [data-brand]').shadowRoot.querySelector('button')).backgroundColor);
      check(fill && fill !== 'rgba(0, 0, 0, 0)', 'accent not painted'); if (typeof value === 'string' && prior) check(fill !== prior, `accent ${value} did not change`); prior = fill;
    }
  });
  await verify('every option group reaches rendered targets and reset removes stale writes', async () => {
    const result = await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      c.change({ type: 'reset' });
      c.change({ type: 'group', group: 'shape', tokens: c.catalog.shape.rounded });
      c.change({ type: 'group', group: 'typography', tokens: { '--lr-theme-font-family-body': 'monospace', '--lr-theme-font-size-m': '1.25rem', '--lr-theme-font-weight-bold': '900' } });
      c.change({ type: 'group', group: 'motion', tokens: c.catalog.motion.quick });
      c.change({ type: 'group', group: 'elevation', tokens: c.catalog.elevation.raised });
      c.change({ type: 'group', group: 'palette', tokens: { '--lr-theme-color-chart-1': '#112233' } });
      await new Promise(r => setTimeout(r, 300));
      const root = document.querySelector('[data-preview]');
      const before = { fontSize: parseFloat(getComputedStyle(root.querySelector('[data-sample-body]')).fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize), weight: getComputedStyle(root.querySelector('[data-sample-heading]')).fontWeight, font: getComputedStyle(root).fontFamily, radius: getComputedStyle(root).borderRadius, chart: getComputedStyle(root.querySelector('[data-palette-mark]')).fill, duration: getComputedStyle(root.querySelector('[data-brand]')).getPropertyValue('--lr-duration-fast').trim(), shadow: getComputedStyle(root.querySelector('lr-card').shadowRoot.querySelector('[part~="base"]')).boxShadow };
      c.change({ type: 'reset' }); await new Promise(r => setTimeout(r, 300));
      return { before, overrides: c.model.overrides(c.draft), font: getComputedStyle(root).fontFamily };
    });
    assert.equal(result.before.fontSize, 1.25); assert.equal(result.before.weight, '900'); check(result.before.font.includes('monospace'), 'font pair ineffective'); assert.equal(result.before.chart, 'rgb(17, 34, 51)'); check(result.before.radius !== '0px', 'radius ineffective'); check(result.before.shadow !== 'none', 'shadow ineffective'); check(parseFloat(result.before.duration) < 1, 'OS motion reduction bypassed'); assert.deepEqual(result.overrides, {}); check(!result.font.includes('monospace'), 'reset stale font');
  });
  await verify('keyboard field editing preserves the focused input and rejects invalid CSS', async () => {
    await page.locator('[data-group="typography"]').evaluate(element => element.show());
    const field = page.locator('[data-token="--lr-theme-font-size-m"]').locator('input');
    await field.press('Tab');
    await field.press('Shift+Tab');
    await field.fill('1.3rem'); await wait();
    const focused = await evaluate(() => {
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active === document.querySelector('[data-token="--lr-theme-font-size-m"]').shadowRoot.querySelector('input');
    });
    check(focused, 'editing lost focus');
    await field.fill('banana'); await wait();
    assert.equal(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.model.overrides(document.querySelector('[data-theme-builder]').themeBuilder.draft)['--lr-theme-font-size-m']), '1.3rem');
    await field.fill('1.2rem'); await wait();
    assert.equal(await page.locator('[data-token="--lr-theme-font-size-m"]').evaluate(element => element.errorText), '');
  });
  await verify('real hover, keyboard focus and press produce state-labelled measurements', async () => {
    const button = page.locator('[data-preview="primary"] [data-brand]').locator('button');
    await button.hover(); await page.waitForTimeout(300);
    check(await page.locator('[data-diagnostics]').textContent().then(text => text.includes('Rendered brand button · Hover')), 'hover not measured');
    await button.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(300);
    check(await page.locator('[data-diagnostics]').textContent().then(text => text.includes('Rendered brand button · Focus')), 'focus not measured');
    await button.hover(); await page.mouse.down(); await page.waitForTimeout(100);
    check(await page.locator('[data-diagnostics]').textContent().then(text => text.includes('Rendered brand button · Pressed')), 'pressed not measured');
    await page.mouse.up();
  });
  await verify('canvas and SVG use the same palette colors and expose non-color data', async () => {
    const actual = await evaluate(() => {
      const root = document.querySelector('[data-preview]');
      return { pixels: [...root.querySelector('canvas').getContext('2d').getImageData(10, 90, 1, 1).data], fill: getComputedStyle(root.querySelector('[data-palette-mark]')).fill, rows: root.querySelectorAll('tbody tr').length, cues: root.querySelectorAll('.tb-series-cues span').length };
    });
    assert.equal(actual.fill, `rgb(${actual.pixels.slice(0, 3).join(', ')})`); assert.equal(actual.rows, 8); assert.equal(actual.cues, 8);
  });
  await verify('browser color validation rejects invalid accent and reference colors atomically', async () => {
    const result = await evaluate(() => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      const before = c.draft;
      const accent = c.change({ type: 'axis', name: 'accent', value: 'notacolor' });
      const background = c.change({ type: 'axis', name: 'accentBackground', value: { dark: 'notacolor' } });
      return { accent, background, same: c.draft === before };
    });
    assert.deepEqual(result, { accent: false, background: false, same: true });
    await page.locator('[data-action="import"]').click();
    await page.locator('[data-control="import-format"]').evaluate(element => { element.value = 'style-record'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    const input = page.locator('[data-import-text]').locator('textarea');
    for (const invalid of [{ accent: 'notacolor' }, { surface: { dark: 'notacolor' } }, { accent: { brand: { light: 'notacolor' } } }]) {
      await input.fill(JSON.stringify({ version: 2, ...invalid }));
      check(await page.locator('[data-apply-import]').getAttribute('disabled') !== null, 'invalid color import accepted');
    }
    await page.locator('[data-control="import-format"]').evaluate(element => { element.value = 'look'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    await page.locator('[data-action="import"]').click();
  });
  await verify('UI import rejects unsafe data then recovers atomically', async () => {
    await page.locator('[data-action="import"]').click();
    const input = page.locator('[data-import-text]').locator('textarea');
    await input.fill('{"id":"imported","tokens":{"--lr-theme-unknown":"url(https://example.test/never)"}}');
    await check(await page.locator('[data-apply-import]').getAttribute('disabled') !== null, 'invalid import applied');
    await input.fill('{"id":"imported","tokens":{"--lr-theme-font-family-body":"monospace"}}');
    await page.locator('[data-apply-import]').click(); await wait();
    const font = await evaluate(() => getComputedStyle(document.querySelector('[data-preview]')).fontFamily); check(font.includes('monospace'), 'valid import did not recover');
  });
  await verify('real file import, download, clipboard failure and reset undo preserve the draft', async () => {
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'reset' }); await c.whenSettled(); });
    await page.locator('[data-action="import"]').click();
    const file = page.locator('.tb-transfer input[type="file"]');
    await file.setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.alloc(262145, 32) });
    check(await page.locator('[data-apply-import]').getAttribute('disabled') !== null, 'oversized file accepted');
    const authored = { id: 'from-file', tokens: { '--lr-theme-font-family-body': 'monospace', '--lr-theme-border-radius-m': '0.75rem' } };
    await file.setInputFiles({ name: 'look.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(authored)) });
    await page.locator('[data-apply-import]').click(); await wait();
    assert.equal(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.draft.look.id), 'from-file');
    await page.locator('[data-action="export"]').click();
    await page.locator('[data-control="export-format"]').evaluate(element => { element.value = 'look'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    const expected = await page.locator('[data-export-text]').evaluate(element => element.value);
    const downloadPending = page.waitForEvent('download');
    await page.locator('.tb-transfer').getByRole('button', { name: 'Download', exact: true }).click();
    const download = await downloadPending; const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), expected);
    assert.deepEqual(JSON.parse(expected).tokens, authored.tokens);
    await evaluate(() => { globalThis.builderClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard'); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Private clipboard detail'); } } }); });
    try {
      await page.locator('.tb-transfer').getByRole('button', { name: 'Copy', exact: true }).click();
      check((await page.locator('.tb-status').textContent()).includes('Copy failed.'), 'clipboard failure lacks recovery');
      check(!(await page.locator('.tb-status').textContent()).includes('Private'), 'raw error escaped');
    } finally {
      await evaluate(() => { if (globalThis.builderClipboardDescriptor) Object.defineProperty(navigator, 'clipboard', globalThis.builderClipboardDescriptor); else delete navigator.clipboard; delete globalThis.builderClipboardDescriptor; });
    }
    await page.locator('[data-action="export"]').click();
    await page.locator('[data-action="reset"]').click(); await wait();
    assert.equal(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.draft.look.id), 'lyra');
    await page.locator('[data-action="undo"]').click(); await wait();
    assert.equal(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.draft.look.id), 'from-file');
  });
  await verify('runtime/CSS export paints identical light/dark token values', async () => {
    const result = await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      const output = c.model.exportDraft(c.draft, 'css', 'portable-example');
      const style = document.createElement('style'); style.textContent = output.text; document.head.append(style);
      const comparisons = [];
      for (const root of document.querySelectorAll('[data-preview]')) {
        const probe = document.createElement('section'); probe.setAttribute('data-lr-look', 'portable-example'); probe.setAttribute('data-lr-mode', root.dataset.resolvedMode); probe.style.fontFamily = 'var(--lr-theme-font-family-body)'; root.parentElement.append(probe);
        comparisons.push([getComputedStyle(root).fontFamily, getComputedStyle(probe).fontFamily]); probe.remove();
      }
      style.remove(); return comparisons;
    });
    result.forEach(([runtime, css]) => assert.equal(runtime, css));
  });
  await verify('all authored looks export equivalent paired CSS and runtime colors/geometry', async () => {
    const failures = await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      const failures = [];
      for (const look of c.catalog.looks) {
        const imported = c.model.parseImport(JSON.stringify(look), 'look', c.catalog);
        c.change({ type: 'reset' }); c.change({ type: 'import', value: imported.value });
        c.change({ type: 'group', group: 'shape', tokens: c.catalog.shape.rounded });
        c.change({ type: 'group', group: 'elevation', tokens: c.catalog.elevation.raised });
        await c.whenSettled();
        const output = c.model.exportDraft(c.draft, 'css', 'css-parity');
        const sheet = document.createElement('style'); sheet.textContent = output.text; document.head.append(sheet);
        for (const root of document.querySelectorAll('[data-preview]')) {
          const probe = document.createElement('section'); probe.dataset.lrLook = 'css-parity'; probe.dataset.lrMode = root.dataset.resolvedMode;
          const button = document.createElement('lr-button'); button.variant = 'brand'; button.textContent = 'Parity'; probe.append(button); root.parentElement.append(probe); await button.updateComplete;
          const runtimeButton = root.querySelector('[data-brand]').shadowRoot.querySelector('button');
          const cssButton = button.shadowRoot.querySelector('button');
          for (const property of ['color', 'backgroundColor', 'borderRadius', 'fontFamily']) {
            const actual = getComputedStyle(runtimeButton)[property]; const expected = getComputedStyle(cssButton)[property];
            if (actual !== expected) failures.push({ look: look.id, mode: root.dataset.resolvedMode, property, actual, expected });
          }
          probe.remove();
        }
        sheet.remove();
      }
      c.change({ type: 'reset' }); return failures;
    });
    assert.deepEqual(failures, []);
  });
  await verify('custom-accent server CSS honestly paints the documented base-look fallback', async () => {
    const result = await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      c.change({ type: 'reset' }); await c.whenSettled();
      const base = getComputedStyle(document.querySelector('[data-preview="primary"] [data-brand]').shadowRoot.querySelector('button')).backgroundColor;
      c.change({ type: 'axis', name: 'accent', value: '#f00088' }); await c.whenSettled();
      const custom = getComputedStyle(document.querySelector('[data-preview="primary"] [data-brand]').shadowRoot.querySelector('button')).backgroundColor;
      const sheet = document.createElement('style'); sheet.textContent = c.model.exportDraft(c.draft, 'css', 'server-fallback').text; document.head.append(sheet);
      const scope = document.createElement('section'); scope.dataset.lrLook = 'server-fallback'; scope.dataset.lrMode = 'light'; scope.dataset.lrAccent = 'custom'; scope.dataset.lrSurface = 'solid'; scope.dataset.lrDensity = 'comfortable';
      const button = document.createElement('lr-button'); button.variant = 'brand'; button.textContent = 'SSR'; scope.append(button); document.querySelector('.tb-preview-pair').append(scope); await button.updateComplete;
      const fallback = getComputedStyle(button.shadowRoot.querySelector('button')).backgroundColor;
      scope.remove(); sheet.remove(); c.change({ type: 'reset' }); await c.whenSettled();
      return { base, custom, fallback };
    });
    assert.equal(result.fallback, result.base); assert.notEqual(result.custom, result.fallback);
  });
  await verify('script font pairing preserves local fallbacks and rendered line metrics', async () => {
    const failures = await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder; const failures = [];
      for (const [script, tokens] of Object.entries(c.catalog.typography)) {
        c.change({ type: 'group', group: 'typography', tokens }); await c.whenSettled();
        const root = document.querySelector('[data-preview]'); const actual = getComputedStyle(root);
        const expectedFirst = tokens['--lr-theme-font-family-body'].split(',')[0].replace(/['\"]/g, '');
        if (!actual.fontFamily.includes(expectedFirst)) failures.push({ script, font: actual.fontFamily, expectedFirst });
        if (!(parseFloat(actual.lineHeight) >= parseFloat(actual.fontSize))) failures.push({ script, lineHeight: actual.lineHeight });
      }
      c.change({ type: 'reset' }); return failures;
    });
    assert.deepEqual(failures, []);
  });
  await verify('increased contrast, explicit reduction and OS settings remain independent', async () => {
    await context.clearPermissions();
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark', forcedColors: 'active' });
    await evaluate(() => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'axis', name: 'mode', value: 'system' }); c.change({ type: 'preferences', value: { motion: 'reduce', contrast: 'more' } }); }); await wait();
    const current = await evaluate(() => { const root = document.querySelector('[data-preview]'); return { mode: root.dataset.resolvedMode, motion: root.getAttribute('data-lr-motion'), contrast: root.getAttribute('data-lr-contrast'), duration: getComputedStyle(root.querySelector('[data-brand]')).getPropertyValue('--lr-duration-fast').trim() }; });
    assert.equal(current.mode, 'dark'); assert.equal(current.motion, 'reduce'); assert.equal(current.contrast, 'more'); check(parseFloat(current.duration) < 1, 'explicit reduction ignored');
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light', forcedColors: 'none' });
    await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.change({ type: 'reset' })); await wait();
  });
  await verify('motion replay honors zero, replaces prior work and cancels when reduction changes', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'group', group: 'motion', tokens: { '--lr-theme-duration-normal': '0ms' } }); await c.whenSettled(); });
    await page.locator('[data-replay]').click();
    assert.equal(await evaluate(() => document.querySelector('[data-preview] [data-brand]').getAnimations().filter(a => a.playState === 'running').length), 0);
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'group', group: 'motion', tokens: { '--lr-theme-duration-normal': 'calc(1s + 1s)' } }); await c.whenSettled(); });
    await page.locator('[data-replay]').click();
    assert.equal(await evaluate(() => document.querySelector('[data-preview] [data-brand]').getAnimations()[0].effect.getTiming().duration), 2000);
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'group', group: 'motion', tokens: { '--lr-theme-duration-normal': '60s' } }); await c.whenSettled(); });
    await page.locator('[data-replay]').click(); await page.locator('[data-replay]').click();
    assert.equal(await evaluate(() => document.querySelector('[data-preview] [data-brand]').getAnimations()[0].effect.getTiming().duration), 5000);
    assert.equal(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.draft.groups.motion['--lr-theme-duration-normal']), '60s');
    assert.equal(await evaluate(() => document.querySelector('[data-preview] [data-brand]').getAnimations().filter(a => a.playState === 'running').length), 1);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await wait();
    assert.equal(await evaluate(() => document.querySelector('[data-preview] [data-brand]').getAnimations().filter(a => a.playState === 'running').length), 0);
    await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.change({ type: 'reset' })); await wait();
  });
  await verify('320px, RTL and doubled text keep page allocation without changing editor scope', async () => {
    await page.setViewportSize({ width: 320, height: 900 });
    await evaluate(() => { document.documentElement.style.fontSize = '32px'; document.querySelector('.tb-builder').dir = 'rtl'; }); await wait();
    if (process.env.TMPDIR) {
      await page.screenshot({ path: `${process.env.TMPDIR}/builder-${engine}-narrow.png` });
      const height = await evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0, part = 1; y < height; y += 12000, part++) await page.screenshot({ path: `${process.env.TMPDIR}/builder-${engine}-narrow-part${part}.png`, fullPage: true, clip: { x: 0, y, width: 320, height: Math.min(12000, height - y) } });
    }
    const overflow = await evaluate(() => document.documentElement.scrollWidth - innerWidth); check(overflow <= 1, `overflow ${overflow}`);
    await evaluate(() => { document.documentElement.style.removeProperty('font-size'); document.querySelector('.tb-builder').dir = 'ltr'; });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await verify('a lazy locale failure keeps the same draft and blocked storage cannot authorize reload', async () => {
    await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      c.change({ type: 'token', name: '--lr-theme-border-radius-m', value: '0.9rem' }); await c.whenSettled();
      globalThis.builderDraftBeforeLocale = c.draft;
    });
    failLocale = true;
    await page.locator('[data-control="locale"]').evaluate(element => { element.value = 'ur'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    await page.locator('[data-action="recover-locale"]').waitFor();
    check(localeFailureRequests.length > 0, 'selected locale was already eager; failure fixture never reached its lazy chunk');
    check(await evaluate(() => document.querySelector('[data-theme-builder]')?.themeBuilder?.draft === globalThis.builderDraftBeforeLocale), 'locale failure reloaded or replaced the active draft');
    assert.equal(await page.locator('[data-preview]').first().getAttribute('lang'), 'en');
    check((await page.locator('.tb-builder').textContent()).includes('This catalog could not load.'), 'locale failure lacks localized recovery');
    await evaluate(() => { globalThis.builderStorageSet = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
    try {
      await page.locator('[data-action="recover-locale"]').click(); await wait();
      check(await evaluate(() => document.querySelector('[data-theme-builder]')?.themeBuilder?.draft === globalThis.builderDraftBeforeLocale), 'failed snapshot changed document or draft');
      check((await page.locator('.tb-builder').textContent()).includes('Export'), 'storage failure omitted export fallback');
      assert.equal(await evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('lyra-docs-builder-recovery:')).length), 0);
    } finally { await evaluate(() => { Storage.prototype.setItem = globalThis.builderStorageSet; delete globalThis.builderStorageSet; }); }
    const original = page.url();
    try {
      await evaluate(() => { const url = new URL(location.href); url.searchParams.set('id', 'theming-theme-builder--rtl'); history.replaceState(null, '', url); });
      await page.locator('[data-action="recover-locale"]').click(); await wait();
      check(await evaluate(() => document.querySelector('[data-theme-builder]')?.themeBuilder?.draft === globalThis.builderDraftBeforeLocale), 'stale-story recovery navigated or replaced draft');
      assert.equal(await evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('lyra-docs-builder-recovery:')).length), 0, 'stale-story recovery wrote storage');
    } finally { await evaluate(url => history.replaceState(null, '', url), original); }
  });
  let capturedRecovery;
  await verify('explicit recovery captures later edits, full private metadata and undo without an outage reload loop', async () => {
    // Restore a previously loaded translation separately from the failed requested locale.
    await page.locator('[data-control="locale"]').evaluate(element => { element.value = 'ar'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    await page.waitForFunction(() => document.querySelector('[data-preview]')?.lang === 'ar');
    // Build an undo target, then a different anonymous runtime look with independently owned groups.
    await page.locator('[data-action="reset"]').click(); await wait();
    await evaluate(async () => {
      const c = document.querySelector('[data-theme-builder]').themeBuilder;
      const imported = c.model.parseImport(JSON.stringify({ version: 2, tokens: { '--lr-theme-border-radius-m': '1.2rem' } }), 'style-record', c.catalog);
      c.change({ type: 'import', value: imported.value });
      c.change({ type: 'group', group: 'shape', tokens: { '--lr-theme-border-radius-m': '1rem' } });
      c.change({ type: 'token', name: '--lr-theme-border-radius-m', value: '1.7rem' });
      c.change({ type: 'preferences', value: { motion: 'reduce', contrast: 'more' } });
      const set = (id, value) => { const element = document.querySelector(`[data-control="${id}"]`); element.value = value; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); };
      set('preset-typography', 'arabic'); set('font-pair', 'serif-sans'); set('branch', 'dark'); set('direction', 'ltr');
      await c.whenSettled();
      for (const id of ['typography', 'shape']) document.querySelector(`[data-group="${id}"]`).open = true;
      const field = document.querySelector('[data-token="--lr-theme-font-size-m"]'); field.value = 'unfinished('; field.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true }));
    });
    // Reset cleared notices; select the failed catalog again to request explicit recovery.
    await page.locator('[data-control="locale"]').evaluate(element => { element.value = 'ur'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    await page.locator('[data-action="recover-locale"]').waitFor();
    await page.locator('[data-action="import"]').click();
    await page.locator('[data-import-text]').evaluate(element => { element.value = '{unfinished JSON'; element.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true })); });
    capturedRecovery = await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.recoverySnapshot());
    assert.equal(capturedRecovery.draft.storedLook, 'custom'); check(capturedRecovery.undo !== null, 'undo snapshot missing');
    let navigations = 0; const navigation = request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; }; page.on('request', navigation);
    try {
      const navigated = page.waitForEvent('domcontentloaded'); await page.locator('[data-action="recover-locale"]').click(); await navigated;
      await page.locator('[data-action="recover-locale"]').waitFor(); await page.waitForTimeout(500);
      assert.equal(navigations, 1, 'repeated outage caused an automatic reload loop');
      assert.deepEqual(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.recoverySnapshot()), capturedRecovery);
      assert.equal(await evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('lyra-docs-builder-recovery:')).length), 0, 'snapshot was not consumed once');
      check(await page.locator('[data-token="--lr-theme-font-size-m"]').evaluate(element => Boolean(element.errorText)), 'inert raw error was not recomputed');
    } finally { page.off('request', navigation); }
  });
  await verify('healthy explicit recovery restores exact values, loaded locale, group precedence and undo', async () => {
    failLocale = false;
    const navigated = page.waitForEvent('domcontentloaded'); await page.locator('[data-action="recover-locale"]').click(); await navigated;
    await page.waitForFunction(() => document.querySelector('[data-preview]')?.lang === 'ur');
    const restored = await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.recoverySnapshot());
    assert.deepEqual(restored, { ...capturedRecovery, ui: { ...capturedRecovery.ui, locale: 'ur' } });
    assert.equal(await page.locator('[data-preview]').first().getAttribute('dir'), 'ltr', 'explicit direction lost on locale restoration');
    assert.equal(await evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('lyra-docs-builder-recovery:')).length), 0);
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'group', group: 'shape', tokens: {} }); await c.whenSettled(); });
    assert.equal(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.model.overrides(document.querySelector('[data-theme-builder]').themeBuilder.draft)['--lr-theme-border-radius-m']), '1.7rem');
    await page.locator('[data-action="undo"]').click(); await wait();
    assert.deepEqual(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.draft), capturedRecovery.undo.draft);
    intentionalFailures.clear();
    await page.goto(`http://127.0.0.1:${port}/iframe.html?id=theming-theme-builder--editor&viewMode=story`);
    await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
  });
  await verify('expired, wrong-context and malformed recovery applies nothing and retains only a bounded download', async () => {
    for (const failure of ['expired', 'context', 'json', 'semantic', 'undo-semantic']) {
      const raw = await evaluate(({ failure, captured }) => {
        const context = JSON.stringify([location.origin, location.pathname, new URL(location.href).searchParams.get('id')]);
        const envelope = { version: 1, context, createdAt: Date.now(), payload: captured };
        if (failure === 'expired') envelope.createdAt -= 300001;
        if (failure === 'context') envelope.context += '-wrong';
        if (failure === 'semantic') envelope.payload.draft.groups.manual['--lr-theme-color-chart-1'] = 'notacolor';
        if (failure === 'undo-semantic') envelope.payload.undo.draft.groups.manual['--lr-theme-color-chart-1'] = 'notacolor';
        const raw = failure === 'json' ? '{' : JSON.stringify(envelope);
        sessionStorage.setItem(`lyra-docs-builder-recovery:v1:${context}`, raw); return raw;
      }, { failure, captured: capturedRecovery });
      await page.reload();
      await page.locator('[data-action="download-recovery"]').waitFor();
      const result = await evaluate(() => { const c = document.querySelector('[data-theme-builder]').themeBuilder; return { draft: c.draft, expected: c.model.createDraft(c.catalog), keys: Object.keys(sessionStorage).filter(key => key.startsWith('lyra-docs-builder-recovery:')) }; });
      assert.deepEqual(result.draft, result.expected, `${failure} partially applied`); assert.deepEqual(result.keys, []);
      const downloading = page.waitForEvent('download'); await page.locator('[data-action="download-recovery"]').click();
      const download = await downloading; assert.equal(await readFile(await download.path(), 'utf8'), raw);
      await page.reload(); await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
      assert.equal(await page.locator('[data-action="download-recovery"]').count(), 0, 'invalid snapshot retained beyond one mount');
    }
  });
  await verify('a detached pending story never consumes recovery before the live canvas mounts', async () => {
    const raw = await evaluate(captured => {
      const context = JSON.stringify([location.origin, location.pathname, new URL(location.href).searchParams.get('id')]);
      const raw = JSON.stringify({ version: 1, context, createdAt: Date.now(), payload: captured });
      sessionStorage.setItem(`lyra-docs-builder-recovery:v1:${context}`, raw); return raw;
    }, capturedRecovery);
    delayBuilderModule = true;
    try {
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('[data-theme-builder]').waitFor();
      const deadline = Date.now() + 10000;
      while (!delayedBuilder.length && Date.now() < deadline) await page.waitForTimeout(20);
      check(delayedBuilder.length > 0, 'view module was not held before mounting');
      await evaluate(() => { globalThis.builderDetachedHost = document.querySelector('[data-theme-builder]'); globalThis.builderDetachedHost.replaceWith(document.createElement('div')); });
      delayBuilderModule = false; delayedBuilder.splice(0).forEach(resolve => resolve());
      await evaluate(async url => { await import(url); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, delayedBuilderUrl);
      const detached = await evaluate(() => ({ mounted: Boolean(globalThis.builderDetachedHost.themeBuilder), raw: Object.entries(sessionStorage).find(([key]) => key.startsWith('lyra-docs-builder-recovery:'))?.[1] }));
      assert.equal(detached.mounted, false, 'detached story mounted a controller'); assert.equal(detached.raw, raw, 'detached story consumed recovery');
    } finally { delayBuilderModule = false; delayedBuilder.splice(0).forEach(resolve => resolve()); }
    await page.reload(); await page.waitForFunction(() => document.querySelector('[data-preview]')?.lang === 'ur');
    assert.deepEqual(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.recoverySnapshot()), { ...capturedRecovery, ui: { ...capturedRecovery.ui, locale: 'ur' } });
    await page.reload(); await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
  });
  await verify('a newer locale choice supersedes the in-flight restored locale chain', async () => {
    await evaluate(captured => {
      const context = JSON.stringify([location.origin, location.pathname, new URL(location.href).searchParams.get('id')]);
      sessionStorage.setItem(`lyra-docs-builder-recovery:v1:${context}`, JSON.stringify({ version: 1, context, createdAt: Date.now(), payload: captured }));
    }, capturedRecovery);
    delayArabic = true; failLocale = true; const previousFailures = localeFailureRequests.length;
    try {
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
      const deadline = Date.now() + 10000;
      while (!releaseArabic && Date.now() < deadline) await page.waitForTimeout(20);
      check(Boolean(releaseArabic), 'restored previous locale did not request a deferred Arabic module');
      await page.locator('[data-control="locale"]').evaluate(element => { element.value = 'en'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
      await wait(); delayArabic = false; releaseArabic(); releaseArabic = undefined; await page.waitForTimeout(500);
      assert.equal(await page.locator('[data-preview]').first().getAttribute('lang'), 'en');
      assert.equal(localeFailureRequests.length, previousFailures, 'superseded restore still requested failed Urdu');
      assert.equal(await page.locator('[data-action="recover-locale"]').count(), 0);
      assert.deepEqual(await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.draft), capturedRecovery.draft);
    } finally { delayArabic = false; releaseArabic?.(); releaseArabic = undefined; failLocale = false; }
    await page.reload(); await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
  });
  await verify('locale discovery distinguishes English source from reviewed translations and scopes a lazy selection', async () => {
    const sourceText = await page.locator('.tb-locale-status').textContent();
    check(sourceText.includes('Built-in source:') && !sourceText.includes('Review tier:'), 'English falsely represented as a zero-coverage translation');
    await page.locator('[data-control="locale"]').evaluate(element => { element.value = 'ar'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    await page.waitForFunction(() => document.querySelector('[data-preview]').lang === 'ar');
    const translated = await page.locator('.tb-locale-status').textContent();
    check(translated.includes('AI-assisted') && translated.includes('Approved'), 'actual review metadata missing');
    assert.equal(await page.locator('[data-preview]').first().getAttribute('dir'), 'rtl');
    await page.locator('[data-control="locale"]').evaluate(element => { element.value = 'en'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); });
    await page.waitForFunction(() => document.querySelector('[data-preview]').lang === 'en');
  });
  await verify('editor and populated open dialog pass the documented accessibility checks', async () => {
    await evaluate(() => document.querySelector('[data-theme-builder]').themeBuilder.change({ type: 'reset' })); await wait();
    await page.addScriptTag({ content: axe.source });
    const audit = () => evaluate(async () => (await globalThis.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })));
    assert.deepEqual(await audit(), []);
    await page.locator('[data-preview="primary"] lr-dialog').evaluate(dialog => dialog.show()); await wait();
    assert.deepEqual(await audit(), []);
    await page.keyboard.press('Escape'); await wait();
  });
  await verify('editor leaves global styles and persistent selections untouched', async () => {
    const after = await evaluate(() => ({ root: document.documentElement.getAttribute('style'), attrs: [...document.documentElement.attributes].filter(a => a.name !== 'style').map(a => [a.name, a.value]), storage: { ...localStorage } }));
    assert.deepEqual(after.storage, baseline.storage);
    assert.deepEqual(after.attrs, baseline.attrs.filter(([name]) => name !== 'style'));
    check(after.root === baseline.root || (after.root === '' && baseline.root === null), 'global style changed');
  });
  await verify('unset mode reports the actual inherited editor mode independently of OS mode', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'axis', name: 'mode', value: 'unset' }); await c.whenSettled(); });
    const modes = await page.locator('[data-preview]').evaluateAll(roots => roots.map(root => ({ resolved: root.dataset.resolvedMode, background: getComputedStyle(root).backgroundColor })));
    assert.equal(modes[0].resolved, 'light'); assert.equal(modes[1].resolved, 'dark');
    check(modes[0].background !== modes[1].background, 'comparison lost opposite inherited mode');
    await page.emulateMedia({ colorScheme: 'light' });
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'reset' }); await c.whenSettled(); });
  });
  await verify('reset undo and typography reset restore matching specimen and control state', async () => {
    await page.locator('[data-control="preset-typography"]').evaluate(element => { element.value = 'arabic'; element.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true })); }); await wait();
    await page.locator('[data-action="reset"]').click(); await wait();
    await page.locator('[data-action="undo"]').click(); await wait();
    assert.equal(await page.locator('[data-control="preset-typography"]').evaluate(element => element.value), 'arabic');
    assert.equal(await page.locator('[data-sample-body]').first().getAttribute('lang'), 'ar');
    await page.locator('[data-group="typography"]').evaluate(element => element.show());
    await page.locator('[data-group="typography"]').getByRole('button', { name: 'Reset this group', exact: true }).click(); await wait();
    assert.equal(await page.locator('[data-sample-body]').first().getAttribute('lang'), 'en');
    assert.equal(await page.locator('[data-control="font-pair"]').evaluate(element => element.value), 'system');
  });
  await verify('closing an in-flight file import invalidates its result', async () => {
    await page.locator('[data-action="import"]').click();
    const before = await page.locator('[data-import-text]').evaluate(element => element.value);
    await evaluate(() => { globalThis.builderFileText = File.prototype.text; File.prototype.text = () => new Promise(resolve => { globalThis.builderResolveFile = resolve; }); });
    try {
      await page.locator('.tb-transfer input[type="file"]').setInputFiles({ name: 'pending.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
      await page.locator('[data-action="import"]').click();
      await page.locator('[data-action="import"]').click();
      await evaluate(() => globalThis.builderResolveFile('{"id":"late","tokens":{}}')); await wait();
      assert.equal(await page.locator('[data-import-text]').evaluate(element => element.value), before);
    } finally {
      await evaluate(() => { File.prototype.text = globalThis.builderFileText; delete globalThis.builderFileText; delete globalThis.builderResolveFile; });
      await page.locator('[data-action="import"]').click();
    }
  });
  await verify('keyboard diagnostic navigation opens the target group and focuses its control', async () => {
    await page.locator('[data-group="palette"]').evaluate(element => element.hide());
    const diagnostic = page.locator('[data-diagnostics]').getByRole('button', { name: 'protanopia · Simulation', exact: true }).first();
    await diagnostic.focus(); await page.keyboard.press('Enter'); await wait();
    const target = await evaluate(() => { const group = document.querySelector('[data-group="palette"]'); return { open: group.open, focused: group.contains(document.activeElement) }; });
    assert.deepEqual(target, { open: true, focused: true });
  });
  await verify('disconnect cancels replay and releases owned preview work', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await evaluate(async () => { const c = document.querySelector('[data-theme-builder]').themeBuilder; c.change({ type: 'group', group: 'motion', tokens: { '--lr-theme-duration-normal': '5s' } }); await c.whenSettled(); });
    await page.locator('[data-replay]').click();
    const active = await evaluate(() => { const host = document.querySelector('[data-theme-builder]'); const button = host.querySelector('[data-preview] [data-brand]'); host.themeBuilder.dispose(); return button.getAnimations().filter(a => a.playState === 'running').length; });
    assert.equal(active, 0);
  });
  await verify('a failed initial lazy module exposes recovery and retries in a fresh frame', async () => {
    assert.equal(await evaluate(() => sessionStorage.getItem('lr-docs-reloaded-after-preload-error')), null);
    const cssDocuments = []; const cssRequests = new WeakMap();
    const watchCss = request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame() && failBuilderModule) {
        let finish;
        const ready = new Promise(resolve => { finish = resolve; });
        builderFaultCss = { ready, finish }; cssDocuments.push(builderFaultCss);
      } else if (failBuilderModule && builderFaultCss && /\/assets\/view-[^/]+\.css$/.test(request.url())) {
        cssRequests.set(request, builderFaultCss);
      }
    };
    const finishCss = async request => {
      const document = cssRequests.get(request);
      if (document) { document.result = { url: request.url(), status: (await request.response())?.status() }; document.finish(document.result); }
    };
    page.on('request', watchCss); page.on('requestfinished', finishCss);
    failBuilderModule = true;
    try {
      await page.goto(`http://127.0.0.1:${port}/iframe.html?id=theming-theme-builder--editor&viewMode=story`);
      await page.waitForFunction(() => performance.getEntriesByType('navigation')[0]?.type === 'reload' && sessionStorage.getItem('lr-docs-reloaded-after-preload-error') === '1' && Boolean(document.querySelector('[data-theme-builder] [role="alert"]')));
      await page.locator('[data-theme-builder] [role="alert"]').waitFor();
      check((await page.locator('[data-theme-builder]').textContent()).includes('The editor could not load.'), 'load failure lacks localized recovery');
      failBuilderModule = false;
      const navigated = page.waitForEvent('domcontentloaded');
      await page.locator('[data-theme-builder]').getByRole('button', { name: 'Try again', exact: true }).click();
      await navigated;
      await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
      assert.equal(await page.locator('[data-preview]').count(), 2);
      assert.equal(cssDocuments.length, 2, 'expected initial and automatic-reload fault documents');
      for (const document of cssDocuments) assert.equal(document.result?.status, 200);
      const cssUrl = cssDocuments[1].result.url;
      assert.equal(cssDocuments[0].result.url, cssUrl);
      assert.deepEqual(await evaluate(url => ({
        stylesheet: [...document.styleSheets].some(sheet => sheet.href === url && sheet.cssRules.length > 0),
        layout: getComputedStyle(document.querySelector('.tb-layout')).display
      }), cssUrl), { stylesheet: true, layout: 'grid' });
      check(intentionalFailures.size > 0, 'lazy-module failure was not injected');
      intentionalFailures.clear();
    } finally {
      failBuilderModule = false;
      page.off('request', watchCss); page.off('requestfinished', finishCss);
      for (const document of cssDocuments) document.finish(undefined);
      builderFaultCss = undefined;
    }
  });
  await verify('RTL and expanded-label stories remount at narrow doubled-text allocation', async () => {
    for (const story of ['rtl', 'long-labels']) {
      await page.goto(`http://127.0.0.1:${port}/iframe.html?id=theming-theme-builder--${story}&viewMode=story`);
      await page.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
      await page.setViewportSize({ width: 320, height: 900 });
      await evaluate(() => { document.documentElement.style.fontSize = '32px'; }); await wait();
      if (story === 'rtl') assert.equal(await page.locator('.tb-builder').getAttribute('dir'), 'rtl');
      else check((await page.locator('.tb-builder h1').textContent()).includes('expanded labels'), 'message overrides missing');
      const overflow = await evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(overflow <= 1, `${story} overflow ${overflow}`);
    }
  });
  await verify('real manager navigation releases the old canvas and revisits with one fresh controller', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
    await page.addInitScript(() => {
      // Repeated initialization in one realm must not wrap or reset existing instrumentation.
      if (globalThis.builderRestoreMedia) return;
      const add = MediaQueryList.prototype.addEventListener; const remove = MediaQueryList.prototype.removeEventListener;
      globalThis.builderMediaRows = [];
      MediaQueryList.prototype.addEventListener = function(type, listener, ...rest) {
        if (type === 'change' && new Error().stack.includes('/view-')) globalThis.builderMediaRows.push({ target: this, listener, removed: false });
        return add.call(this, type, listener, ...rest);
      };
      MediaQueryList.prototype.removeEventListener = function(type, listener, ...rest) {
        for (const row of globalThis.builderMediaRows) if (row.target === this && row.listener === listener) row.removed = true;
        return remove.call(this, type, listener, ...rest);
      };
      globalThis.builderRestoreMedia = () => { MediaQueryList.prototype.addEventListener = add; MediaQueryList.prototype.removeEventListener = remove; };
    });
    await page.goto(`http://127.0.0.1:${port}/?path=/story/theming-theme-builder--editor`);
    const iframe = page.frameLocator('#storybook-preview-iframe'); await iframe.locator('[data-theme-builder]').waitFor();
    const frame = page.frames().find(frame => frame.url().includes('/iframe.html'));
    await frame.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
    let documents = 0; const navigation = request => { if (request.isNavigationRequest() && request.frame() === frame) documents++; }; page.on('request', navigation);
    try {
      await frame.evaluate(async () => {
        const host = document.querySelector('[data-theme-builder]'); const controller = host.themeBuilder;
        globalThis.builderOld = { host, controller, root: host.querySelector('[data-preview]'), disposed: 0 };
        const dispose = controller.dispose; controller.dispose = function() { globalThis.builderOld.disposed++; return dispose.call(this); };
        controller.change({ type: 'group', group: 'motion', tokens: { '--lr-theme-duration-normal': '5s' } }); await controller.whenSettled();
      });
      await iframe.locator('[data-replay]').click();
      const before = await frame.evaluate(() => { globalThis.builderOld.animation = globalThis.builderOld.root.querySelector('[data-brand]').getAnimations()[0]; return { media: globalThis.builderMediaRows.filter(row => !row.removed).length, playing: globalThis.builderOld.animation?.playState }; });
      assert.deepEqual(before, { media: 4, playing: 'running' });
      await page.locator('#theming-composable-styles').click();
      await page.locator('a[href="/?path=/story/theming-composable-styles--playground"]').click(); await iframe.locator('[data-style-demo]').waitFor();
      await frame.waitForFunction(() => globalThis.builderOld.disposed === 1);
      const after = await frame.evaluate(() => ({ disposed: globalThis.builderOld.disposed, connected: globalThis.builderOld.host.isConnected, article: Boolean(globalThis.builderOld.host.querySelector('.tb-builder')), media: globalThis.builderMediaRows.filter(row => !row.removed).length, playing: globalThis.builderOld.animation.playState, attachedController: Boolean(globalThis.builderOld.host.themeBuilder) }));
      assert.deepEqual(after, { disposed: 1, connected: false, article: false, media: 0, playing: 'idle', attachedController: false });
      await frame.evaluate(() => globalThis.builderOld.root.removeAttribute('data-lr-mode'));
      await page.emulateMedia({ colorScheme: 'dark' }); await wait();
      assert.equal(await frame.evaluate(() => globalThis.builderOld.root.getAttribute('data-lr-mode')), null, 'disposed canvas reacted to later media changes');
      const editor = page.locator('a[href="/?path=/story/theming-theme-builder--editor"]');
      if (!await editor.isVisible()) await page.locator('#theming-theme-builder').click();
      await editor.click(); await frame.waitForFunction(() => Boolean(document.querySelector('[data-theme-builder]')?.themeBuilder));
      const revisit = await frame.evaluate(() => ({ fresh: document.querySelector('[data-theme-builder]').themeBuilder !== globalThis.builderOld.controller, oldDisposed: globalThis.builderOld.disposed, media: globalThis.builderMediaRows.filter(row => !row.removed).length }));
      assert.deepEqual(revisit, { fresh: true, oldDisposed: 1, media: 4 }); assert.equal(documents, 0, 'manager transition reloaded its document');
    } finally {
      page.off('request', navigation);
      await frame.evaluate(() => globalThis.builderRestoreMedia()); await evaluate(() => globalThis.builderRestoreMedia());
    }
  });
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(unexpectedNetworkFailures, []);
  console.log(JSON.stringify({ engine, checks, errors, external, intentionalModuleFailures: injectedModuleFailures, intentionalLocaleFailures: localeFailureRequests.length, expectedConsole, pages: 1, elapsedMs: Date.now() - started }));
  }
} finally { await browser.close(); await new Promise(done => server.close(done)); }
