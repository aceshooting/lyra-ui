#!/usr/bin/env node
// RFC 0002 server-rendering gate (run after a build, part of `test:ssr`):
//
// 1. No declarative shadow root, for any inventory component, carries a document-layer declaration
//    outside the host-local set and the preference arms (the same rule as
//    check-host-token-declarations.mjs, applied to the server's actual output).
// 2. A server-rendered `lr-button` stays small: the shared layer is no longer inlined per element.
// 3. A server-rendered page that links theme.css (which carries the layer since 28.0.0), or
//    tokens-root.css alone, paints with resolved tokens with JavaScript DISABLED (Chromium), and a
//    page that links neither does not resolve them: server-rendered pages must link one of the two
//    static copies for a correct first paint.

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import { chromium } from 'playwright';
import { loadSsrFixtureContext, packageDir, renderSsrMatrix } from './ssr-fixture.mjs';
import { shadowSheetViolations } from './check-host-token-declarations.mjs';
import { projectDefaultTokenSource, readCanonicalTokens } from './generate-design-tokens.mjs';
import { layerDeclarations } from './document-token-layer.mjs';

const layerNames = new Set(layerDeclarations(projectDefaultTokenSource(readCanonicalTokens(packageDir), packageDir)).keys());
const styleBlocks = (markup) => [...markup.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]);

const { entries } = await renderSsrMatrix();
const violations = entries.flatMap(({ tag, html: markup }) =>
  styleBlocks(markup).flatMap((css) => shadowSheetViolations(css, layerNames, `<${tag}> declarative shadow root`)));
assert.deepEqual(violations, [], `server-rendered shadow roots carry document-layer declarations:\n${violations.join('\n')}`);

const { elementRenderers } = await loadSsrFixtureContext();
const button = await collectResult(render(html`<lr-button variant="brand">Save</lr-button>`, { elementRenderers }));
// 26.0.0 wrote 52,767 bytes of HTML for one button, ~34 KB of it the shared layer.
assert.ok(button.length < 30_000, `one server-rendered lr-button is ${button.length} bytes of HTML; the shared layer must not be inlined`);

const markup = await collectResult(render(html`
  <lr-button id="brand" variant="brand" appearance="accent">Save</lr-button>
  <lr-card id="card">Card body</lr-card>
`, { elementRenderers }));

const dist = path.join(packageDir, 'dist');
const pages = {
  '/theme.html': `<!doctype html><html><head><link rel="stylesheet" href="/theme.css"></head><body>${markup}</body></html>`,
  '/tokens-root.html': `<!doctype html><html><head><link rel="stylesheet" href="/styles/tokens-root.css"></head><body>${markup}</body></html>`,
  '/unlinked.html': `<!doctype html><html><head></head><body>${markup}</body></html>`,
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (pages[url.pathname]) {
    response.writeHead(200, { 'content-type': 'text/html' }).end(pages[url.pathname]);
    return;
  }
  const file = path.normalize(path.join(dist, url.pathname));
  if (!file.startsWith(dist + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : 'application/octet-stream' }).end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const probe = () => page.evaluate(() => {
    const button = document.getElementById('brand');
    const base = button.shadowRoot?.querySelector('[part~="base"]');
    return {
      shadow: button.shadowRoot !== null,
      root: getComputedStyle(document.documentElement).getPropertyValue('--lr-color-brand').trim(),
      host: getComputedStyle(button).getPropertyValue('--lr-color-brand').trim(),
      space: getComputedStyle(button).getPropertyValue('--lr-space-m').trim(),
      background: base ? getComputedStyle(base).backgroundColor : '',
    };
  });

  const outputs = path.join(tmpdir(), 'lyra-ssr-token-paint');
  await mkdir(outputs, { recursive: true });
  const captures = [];
  for (const [file, label] of [['theme', 'theme.css'], ['tokens-root', 'tokens-root.css']]) {
    await page.goto(`${origin}/${file}.html`);
    const linked = await probe();
    assert.equal(linked.shadow, true, 'the declarative shadow root must attach without JavaScript');
    assert.notEqual(linked.host, '', `with ${label} linked, a server-rendered host resolves the layer before hydration`);
    assert.equal(linked.host, linked.root, 'the host inherits the document layer');
    assert.notEqual(linked.space, '');
    assert.notEqual(linked.background, 'rgba(0, 0, 0, 0)', 'the brand button paints its resolved fill');
    const capture = path.join(outputs, `${file}.png`);
    await writeFile(capture, await page.screenshot({ fullPage: true }));
    captures.push(capture);
  }

  await page.goto(`${origin}/unlinked.html`);
  const unlinked = await probe();
  assert.equal(unlinked.host, '', 'without theme.css or tokens-root.css, and without JavaScript, the layer is absent (the documented requirement)');
  console.log(`SSR token gate passed: no layer in ${entries.length} declarative shadow roots; lr-button ${button.length} bytes; JS-disabled paints captured at ${captures.join(', ')}.`);
} finally {
  await browser.close();
  server.close();
}
