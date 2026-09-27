// Server-rendered output per element, raw and compressed: node probe-ssr.mjs a|b|c|d|e
import { render } from '@lit-labs/ssr';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import { brotliCompressSync, gzipSync } from 'node:zlib';
const variant = process.argv[2];
await import(`./dist-${variant}/components/forms/button/button.js`);
const one = await collectResult(render(html`<lr-button variant="brand">Save</lr-button>`));
const styleBytes = [...one.matchAll(/<style>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + m[1].length, 0);
const pages = {};
for (const n of [1, 10, 100]) {
  const out = await collectResult(render(html`${Array.from({ length: n }, () => html`<lr-button>Save</lr-button>`)}`));
  pages[n] = { raw: out.length, gzip9: gzipSync(out, { level: 9 }).length, brotli: brotliCompressSync(out).length };
}
console.log(JSON.stringify({ variant, oneButtonHtmlBytes: one.length, oneButtonStyleBytes: styleBytes, pages }));
