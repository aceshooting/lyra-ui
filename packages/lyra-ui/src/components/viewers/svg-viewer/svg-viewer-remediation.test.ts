import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './svg-viewer.js';
import type { LyraSvgViewer } from './svg-viewer.js';

const originalFetch = window.fetch;
afterEach(() => { window.fetch = originalFetch; });

async function svgViewer(width: number, height: number, capped = true, zoomable = false) {
  window.fetch = (() => Promise.resolve(new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" /></svg>`))) as typeof fetch;
  const viewer = await fixture<LyraSvgViewer>(html`<lr-svg-viewer style="inline-size:320px" .maxHeight=${capped ? '160px' : ''}
    .zoomable=${zoomable} src="https://example.test/diagram.svg"></lr-svg-viewer>`);
  await waitUntil(() => viewer.shadowRoot!.querySelector('[part="svg"] svg') !== null);
  return { viewer, svg: viewer.shadowRoot!.querySelector<SVGSVGElement>('[part="svg"] svg')!, body: viewer.shadowRoot!.querySelector<HTMLElement>('[part="body"]')! };
}

for (const [width, height] of [[200, 1000], [1000, 200]]) {
  it(`keeps the capped ${width}×${height} nonzoomable SVG origin and bottom reachable`, async () => {
    const { viewer, svg, body } = await svgViewer(width!, height!);
    expect(viewer.zoomable).to.equal(false);
    body.scrollTop = 0;
    expect(svg.getBoundingClientRect().top).to.be.at.least(body.getBoundingClientRect().top);
    body.scrollTop = body.scrollHeight;
    await waitUntil(() => svg.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1);
  });
}

it('preserves centered fitting SVGs, uncapped height, and the zoom wrapper', async () => {
  const small = await svgViewer(60, 60);
  const body = small.body.getBoundingClientRect();
  const svg = small.svg.getBoundingClientRect();
  expect(svg.top + svg.height / 2).to.be.closeTo(body.top + body.height / 2, 1);
  expect(svg.left + svg.width / 2).to.be.closeTo(body.left + body.width / 2, 1);
  const tall = await svgViewer(200, 1000, false);
  expect(tall.body.clientHeight).to.be.at.least(1000);
  const zoomed = await svgViewer(60, 60, true, true);
  expect(zoomed.viewer.shadowRoot!.querySelectorAll('lr-pan-zoom').length).to.equal(1);
});

it('refuses an SVG whose nested <use> references fan out past the clone ceiling', async () => {
  const fanout = (levels: number): string => {
    let defs = '<g id="g0"><rect width="1" height="1"/></g>';
    for (let level = 1; level <= levels; level++) defs += `<g id="g${level}">${`<use href="#g${level - 1}"/>`.repeat(10)}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><defs>${defs}</defs><use href="#g${levels}"/></svg>`;
  };
  const render = async (markup: string): Promise<LyraSvgViewer> => {
    window.fetch = (() => Promise.resolve(new Response(markup))) as typeof fetch;
    const viewer = await fixture<LyraSvgViewer>(html`<lr-svg-viewer src="https://example.test/fanout.svg"></lr-svg-viewer>`);
    await waitUntil(() => viewer.shadowRoot!.querySelector('[part="error"], [part="svg"] svg') !== null);
    return viewer;
  };
  const modest = await render(fanout(3));
  expect(modest.shadowRoot!.querySelectorAll('[part="svg"] use').length).to.equal(31);
  const exploding = await render(fanout(5));
  expect(exploding.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('This document is too large to preview.');
  expect(exploding.shadowRoot!.querySelector('use') === null).to.be.true;
});
