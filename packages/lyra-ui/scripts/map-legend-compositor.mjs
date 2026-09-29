// Real compositor regression: inspect page PNG pixels, not canvas readPixels (which remains
// opaque when an overlapping scrolling legend punches a transparent hole in the composite).
// Run from packages/lyra-ui: node scripts/map-legend-compositor.mjs
// MAP_LEGEND_BROWSER=firefox|webkit selects another installed engine for diagnostics. A browser
// that cannot paint the WebGL background fails explicitly; it is never counted as a passing test.
// Captures are diagnostic artifacts only. No visual baselines are created or promoted.
import assert from 'node:assert/strict';
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = resolve(packageRoot, '../..');
const output = resolve(process.env.MAP_LEGEND_OUTPUT ?? join(packageRoot, '.visual-diff-output/map-legend-compositor'));
const engine = process.env.MAP_LEGEND_BROWSER ?? 'chromium';
const browserType = { chromium, firefox, webkit }[engine];
assert.ok(browserType, `Unknown MAP_LEGEND_BROWSER: ${engine}`);
await mkdir(output, { recursive: true });
const cacheDir = join(output, `vite-cache-${process.pid}`);
const server = await createServer({
  configFile: false,
  root: packageRoot,
  cacheDir,
  logLevel: 'error',
  resolve: { alias: {
    '#lyra-dev-attributes': join(packageRoot, 'src/internal/dev-mode-attribute-warning.production.ts'),
    '#lyra-dev-warning': join(packageRoot, 'src/internal/dev-warning.production.ts'),
  } },
  // MapLibre's ESM worker must stay beside its published entry, not be moved by prebundling.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: {
    host: '127.0.0.1',
    port: 0,
    fs: { allow: [packageRoot, await realpath(join(repoRoot, 'node_modules'))] },
  },
});
let browser;
let failure;
const receipt = { engine, cases: [] };
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await browserType.launch({
    headless: true,
    // Software GL plus CPU buffer readback keeps WebKit's WebGL surfaces in Linux headless
    // screenshots. Without the readback route even a non-scrolling map can capture transparent.
    env: { ...process.env, LIBGL_ALWAYS_SOFTWARE: '1', WEBKIT_DISABLE_DMABUF_RENDERER: '1' },
    ...(engine === 'chromium' ? { args: ['--enable-unsafe-swiftshader'] } : {}),
  });
  receipt.browserVersion = browser.version();
  for (const mode of ['desktop', 'mobile']) {
    const context = await browser.newContext({
      viewport: mode === 'desktop' ? { width: 900, height: 1000 } : { width: 390, height: 844 },
      deviceScaleFactor: mode === 'desktop' ? 1 : 2,
      hasTouch: mode === 'mobile',
      ...(engine !== 'firefox' ? { isMobile: mode === 'mobile' } : {}),
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      page.on('response', response => {
        if (response.status() >= 400) failures.push(`${response.status()}: ${response.url()}`);
      });
      await context.route('**/*', route => {
        if (new URL(route.request().url()).origin !== new URL(origin).origin) {
          failures.push(`Unexpected external request: ${route.request().url()}`);
          return route.abort();
        }
        return route.continue();
      });
      await page.goto(`${origin}test/fixtures/map-legend-compositor.html`);
      await page.waitForFunction(() => document.querySelector('lr-map')?.map?.isStyleLoaded(), null, { timeout: 30_000 });
      const map = page.locator('lr-map');
      const legend = map.locator('[part="legend"]');
      const disclosure = map.locator('[part="legend-disclosure"]');
      const rows = map.locator('[part~="legend-toggle"]');
      assert.equal(await rows.count(), 12);
      const lightLegendBackground = await legend.evaluate(element => getComputedStyle(element).backgroundColor);

      async function capture(name) {
        // Wait for a fresh map frame and its subsequent compositor frames, not just Lit's update.
        await map.evaluate(element => new Promise((resolveFrame, rejectFrame) => {
          const timeout = setTimeout(() => rejectFrame(new Error('Map compositor frame timed out after 10 seconds')), 10_000);
          element.map.once('render', () => requestAnimationFrame(() => requestAnimationFrame(() => {
            clearTimeout(timeout);
            resolveFrame();
          })));
          element.map.triggerRepaint();
        }));
        const box = await map.boundingBox();
        assert.ok(box);
        const buffer = await page.screenshot({ clip: box, scale: 'css' });
        const filename = `${engine}-${mode}-${name}.png`;
        await writeFile(join(output, filename), buffer);
        const png = PNG.sync.read(buffer);
        let exposedUnderlay = 0;
        let backgroundPixels = 0;
        for (let y = 2; y < png.height - 2; y++) {
          for (let x = 2; x < png.width - 2; x++) {
            const i = (y * png.width + x) * 4;
            const [red, green, blue] = png.data.subarray(i, i + 3);
            if (red === 255 && green === 0 && blue === 255) exposedUnderlay++;
            if (red === 18 && green === 52 && blue === 86) backgroundPixels++;
          }
        }
        const geometry = await legend.evaluate(element => ({
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop,
        }));
        receipt.cases.push({ mode, name, filename, exposedUnderlay, backgroundPixels, geometry });
        assert.ok(backgroundPixels > png.width * png.height * 0.4,
          `${engine}/${mode}/${name}: WebGL background did not paint enough opaque pixels; inspect ${filename}`);
        assert.equal(exposedUnderlay, 0,
          `${engine}/${mode}/${name}: scrolling legend exposed the magenta underlay; inspect ${filename}`);
        assert.ok(geometry.height <= 320.5, 'legend remains bounded');
        assert.ok(geometry.width <= box.width - 12, 'legend remains inside the map');
        assert.deepEqual(failures, [], 'fixture must be network-silent and free of runtime/request errors');
      }

      await capture('expanded');
      assert.ok(await legend.evaluate(element => element.scrollHeight > element.clientHeight));
      const zoom = await map.evaluate(element => element.map.getZoom());
      await legend.hover();
      if (mode === 'mobile' && engine === 'webkit') {
        // Playwright cannot dispatch a wheel in mobile WebKit. Exercise its real scrollport
        // directly; the desktop case separately verifies native wheel routing and map zoom.
        await legend.evaluate(element => element.scrollBy(0, 180));
      } else {
        await page.mouse.wheel(0, 180);
      }
      await page.waitForFunction(() => document.querySelector('lr-map').shadowRoot.querySelector('[part="legend"]').scrollTop > 0);
      await capture('scrolled');
      assert.equal(await map.evaluate(element => element.map.getZoom()), zoom, 'legend wheel must not zoom the map');

      // Tabbing from the disclosure reaches every toggle and scrolls the final one into view.
      await legend.evaluate(element => { element.scrollTop = 0; });
      await disclosure.click();
      await capture('collapsed');
      assert.equal(await rows.first().isVisible(), false);
      await page.keyboard.press('Enter');
      for (let index = 0; index < 12; index++) await page.keyboard.press('Tab');
      assert.equal(await rows.last().evaluate(element => element === element.getRootNode().activeElement), true);
      assert.ok(await legend.evaluate(element => element.scrollTop > 0));
      await capture('keyboard-last-row');

      await map.evaluate(element => {
        element.dir = 'rtl';
        element.setAttribute('data-lr-mode', 'dark');
        element.legend = element.legend.map(entry => ({ ...entry, label: `${entry.label} ${'Long category '.repeat(5)}` }));
        element.style.inlineSize = '320px';
      });
      await page.waitForFunction(() => document.querySelector('lr-map').map.getCanvas().clientWidth === 320);
      assert.equal(await map.evaluate(element => getComputedStyle(element).colorScheme), 'dark');
      assert.notEqual(await legend.evaluate(element => getComputedStyle(element).backgroundColor), lightLegendBackground);
      await capture('rtl-dark-long-labels-320px');
      console.log(`${engine} ${mode}: 5 compositor captures passed`);
    } finally {
      await context.close();
    }
  }
} catch (error) {
  failure = error;
} finally {
  try {
    await writeFile(join(output, `${engine}-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    failure ??= error;
  }
  // A receipt or close failure must not keep the other resources alive. Preserve the first
  // failure, and remove the cache only after both owners have had a chance to close it.
  const cleanupResults = await Promise.allSettled([browser?.close(), server.close()]);
  cleanupResults.push(...await Promise.allSettled([rm(cacheDir, { recursive: true, force: true })]));
  for (const result of cleanupResults) {
    if (result.status === 'rejected') failure ??= result.reason;
  }
}
if (failure) throw failure;
