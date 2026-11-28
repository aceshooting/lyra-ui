import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { lyraThemeBootstrapPlugin } from '../src/vite/theme-bootstrap.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'lyra-vite-theme-bootstrap-'));
const asset = join(scratch, 'theme-bootstrap.js');
writeFileSync(asset, '(function(){/* bootstrap */})();');
test.after(() => rmSync(scratch, { recursive: true, force: true }));

const page = '<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <title>App</title>\n  </head>\n  <body></body>\n</html>\n';

function configured(options = {}, config = {}) {
  const plugin = lyraThemeBootstrapPlugin({ src: asset, ...options });
  plugin.configResolved({ base: '/', command: 'build', build: {}, ...config });
  return plugin;
}

function serve(plugin, url) {
  let handler;
  plugin.configureServer({ middlewares: { use: (middleware) => { handler = middleware; } } });
  const headers = {};
  let body;
  let passed = false;
  handler({ url }, { setHeader: (name, value) => { headers[name.toLowerCase()] = value; }, end: (value) => { body = value; } }, () => { passed = true; });
  return { headers, body, passed };
}

test('inserts the classic script immediately after the charset declaration', () => {
  const html = configured().transformIndexHtml(page);
  assert.match(html, /<meta charset="UTF-8" \/><script src="\/lyra-theme-bootstrap\.js"><\/script>\n    <title>/);
  assert.doesNotMatch(html, /type=|async|defer/, 'the bootstrap stays a synchronous classic script');
});

test('serializes configuration as escaped data-lr-* attributes', () => {
  const html = configured({ storageKey: 'app"<&>', restore: ['mode', 'accent', 'bogus'], modeAttributes: ['data-app-mode'] })
    .transformIndexHtml(page);
  assert.match(html, /<script src="\/lyra-theme-bootstrap\.js" data-lr-theme-storage-key="app&quot;&lt;&amp;&gt;" data-lr-theme-restore="mode accent" data-lr-theme-attributes="data-app-mode"><\/script>/);
  const unset = configured({ restore: ['bogus'] }).transformIndexHtml(page);
  assert.doesNotMatch(unset, /data-lr-theme-restore/, 'a policy without a known axis keeps the bootstrap default');
  assert.match(configured({ restore: 'mode' }).transformIndexHtml(page), /data-lr-theme-restore="mode"/);
});

test('honours base and a custom file name', () => {
  assert.match(configured({ fileName: 'assets/boot.js' }, { base: '/app/' }).transformIndexHtml(page), /src="\/app\/assets\/boot\.js"/);
  assert.match(configured({}, { base: './' }).transformIndexHtml(page), /src="\.\/lyra-theme-bootstrap\.js"/);
});

test('falls back to the start of head, then to a head-prepend tag, without a charset declaration', () => {
  assert.match(configured().transformIndexHtml('<html><head lang="en"><title>x</title></head></html>'),
    /<head lang="en"><script src="\/lyra-theme-bootstrap\.js"><\/script><title>/);
  const result = configured().transformIndexHtml('<body></body>');
  assert.deepEqual(result.tags, [{ tag: 'script', attrs: { src: '/lyra-theme-bootstrap.js' }, injectTo: 'head-prepend' }]);
});

test('serves the asset in development with a JavaScript content type', () => {
  const plugin = configured({}, { base: '/app/', command: 'serve' });
  const served = serve(plugin, '/app/lyra-theme-bootstrap.js?v=1');
  assert.equal(served.passed, false);
  assert.equal(served.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(served.body, '(function(){/* bootstrap */})();');
  assert.equal(serve(plugin, '/app/other.js').passed, true);
  assert.equal(serve(configured({}, { base: './', command: 'serve' }), '/lyra-theme-bootstrap.js').body,
    '(function(){/* bootstrap */})();', 'a relative base serves from the dev root');
});

test('emits the asset once per client build and never for a server build', () => {
  const emitted = [];
  configured().generateBundle.call({ emitFile: (file) => { emitted.push(file); return 'ref'; } });
  assert.deepEqual(emitted, [{ type: 'asset', fileName: 'lyra-theme-bootstrap.js', source: '(function(){/* bootstrap */})();' }]);
  configured({}, { build: { ssr: true } }).generateBundle.call({ emitFile: () => { throw new Error('SSR builds emit nothing'); } });
});

test('resolves the package\'s own published asset by default', () => {
  const plugin = lyraThemeBootstrapPlugin();
  assert.equal(plugin.name, 'lyra-theme-bootstrap');
  assert.equal(typeof plugin.configResolved, 'function');
  // The default source is resolved lazily, so constructing the plugin never needs a build.
  assert.doesNotThrow(() => lyraThemeBootstrapPlugin({ src: new URL('file:///missing/theme-bootstrap.js') }));
});
