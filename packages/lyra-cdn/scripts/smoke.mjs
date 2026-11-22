// Smoke test for this package's `dist/`: a page with ONE script tag, no import map and no build step must
// upgrade an `lr-button`, lazy-load only what the page uses, and honour the opt-out attribute.
// Run after `pnpm run build`: `pnpm test`.
import assert from 'node:assert/strict';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
assert.ok(existsSync(join(root, 'lyra-ui.loader.js')), 'dist/lyra-ui.loader.js is missing; run the build first');

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.wasm': 'application/wasm' };
const pages = {
  '/default.html': '<!doctype html><lr-button class="lr-cloak" id="b">Go</lr-button><script type="module" src="/lyra-ui.loader.js"></script>',
  '/optout.html': '<!doctype html><lr-button id="b">Go</lr-button><script type="module" src="/lyra-ui.loader.js" data-lyra-autoload="false"></script>',
  '/cloak-timeout.html': '<!doctype html><div id="c" lr-cloak></div><script type="module" src="/lyra-ui.loader.js" data-lyra-cloak-timeout="0"></script>',
  '/late.html': '<!doctype html><script type="module" src="/lyra-ui.loader.js"></script><script>document.addEventListener("DOMContentLoaded",()=>document.body.append(document.createElement("lr-badge")))</script>',
};
const requested = [];
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  requested.push(path);
  if (pages[path]) {
    response.writeHead(200, { 'content-type': types['.html'] }).end(pages[path]);
    return;
  }
  const file = join(root, normalize(path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const open = async (path) => {
    const page = await browser.newPage();
    const failures = [];
    page.on('pageerror', (error) => failures.push(String(error)));
    page.on('requestfailed', (request) => failures.push(`request failed: ${request.url()}`));
    await page.goto(`${origin}${path}`);
    return { page, failures };
  };

  requested.length = 0;
  const first = await open('/default.html');
  await first.page.waitForFunction(() => customElements.get('lr-button') !== undefined, undefined, { timeout: 15000 });
  assert.equal(await first.page.evaluate(() => document.getElementById('b').shadowRoot !== null), true, 'lr-button must render a shadow root');
  await first.page.waitForFunction(() => !document.getElementById('b').classList.contains('lr-cloak'), undefined, { timeout: 5000 });
  assert.deepEqual(first.failures, [], 'a bare-specifier or missing-chunk failure means the build is not self-contained');
  assert.equal(await first.page.evaluate(() => customElements.get('lr-table') === undefined), true, 'components the page does not use stay unloaded');
  const loaded = requested.filter((path) => path.endsWith('.js')).length;
  assert.ok(loaded < 100, `only the used component's chunks may load (loaded ${loaded})`);

  const out = await open('/optout.html');
  await out.page.waitForTimeout(500);
  assert.equal(await out.page.evaluate(() => customElements.get('lr-button') === undefined), true, 'data-lyra-autoload="false" must leave the page unstarted');

  const quick = await open('/cloak-timeout.html');
  await quick.page.waitForFunction(() => !document.getElementById('c').hasAttribute('lr-cloak'), undefined, { timeout: 5000 });

  const late = await open('/late.html');
  await late.page.waitForFunction(() => customElements.get('lr-badge') !== undefined, undefined, { timeout: 15000 });
  assert.deepEqual(late.failures, []);
  console.log(`CDN smoke test passed (${loaded} scripts fetched for lr-button, no import map).`);
} finally {
  await browser.close();
  server.close();
}
