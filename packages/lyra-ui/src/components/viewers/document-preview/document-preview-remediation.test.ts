import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './document-preview.js';
import type { LyraDocumentPreview } from './document-preview.js';

const originalFetch = window.fetch;
afterEach(() => { window.fetch = originalFetch; });

for (const mime of ['application/json; charset=utf-8', '  APPLICATION/JSON ; Charset=UTF-8  ']) {
  it(`renders parameterized JSON MIME ${mime} as text`, async () => {
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve(new Response('{"value":42}')); }) as typeof fetch;
    const viewer = await fixture<LyraDocumentPreview>(html`<lr-document-preview src="https://example.test/document" mime-type=${mime}></lr-document-preview>`);
    await waitUntil(() => viewer.shadowRoot!.querySelector('pre') !== null, 'parameterized JSON did not render as text');
    expect(viewer.shadowRoot!.querySelector('pre')!.textContent).to.equal('{"value":42}');
    expect(viewer.mimeType).to.equal(mime);
    expect(calls).to.equal(1);
  });
}

it('treats removed mime-type as absent without changing null readback and recovers on later assignment', async () => {
  let calls = 0;
  window.fetch = (() => { calls++; return Promise.resolve(new Response('Recovered text')); }) as typeof fetch;
  const viewer = await fixture<LyraDocumentPreview>(html`<lr-document-preview src="https://example.test/document" mime-type="application/pdf"></lr-document-preview>`);
  viewer.removeAttribute('mime-type');
  await viewer.updateComplete;
  expect(viewer.mimeType).to.equal(null);
  expect(viewer.shadowRoot!.querySelectorAll('[part="download-link"]').length).to.equal(1);
  expect(calls).to.equal(0);
  viewer.setAttribute('mime-type', '');
  await viewer.updateComplete;
  expect(viewer.mimeType).to.equal('');
  expect(calls).to.equal(0);
  viewer.setAttribute('mime-type', 'text/plain');
  await waitUntil(() => viewer.shadowRoot!.querySelector('pre')?.textContent === 'Recovered text');
});

function imageSource(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
}

async function imagePreview(height: number, capped = true, zoomable = false) {
  const viewer = await fixture<LyraDocumentPreview>(html`<lr-document-preview style="inline-size:320px"
    .maxHeight=${capped ? '160px' : ''} .zoomable=${zoomable}
    mime-type="image/png" src=${imageSource(height === 60 ? 60 : 200, height)}></lr-document-preview>`);
  const image = viewer.shadowRoot!.querySelector<HTMLImageElement>('img')!;
  await image.decode();
  await viewer.updateComplete;
  return { viewer, image, body: viewer.shadowRoot!.querySelector<HTMLElement>('[part="body"]')! };
}

it('keeps the tall capped nonzoomable image origin and bottom reachable using the body scroll range', async () => {
  const { viewer, image, body } = await imagePreview(1000);
  expect(viewer.zoomable).to.equal(false);
  body.scrollTop = 0;
  expect(image.getBoundingClientRect().top).to.be.at.least(body.getBoundingClientRect().top);
  body.scrollTop = body.scrollHeight;
  await waitUntil(() => image.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1);
});

it('preserves centered fitting content, uncapped content, and the zoom wrapper', async () => {
  const small = await imagePreview(60);
  const bodyRect = small.body.getBoundingClientRect();
  const imageRect = small.image.getBoundingClientRect();
  expect(imageRect.top + imageRect.height / 2).to.be.closeTo(bodyRect.top + bodyRect.height / 2, 1);
  expect(imageRect.left + imageRect.width / 2).to.be.closeTo(bodyRect.left + bodyRect.width / 2, 1);
  const tall = await imagePreview(1000, false);
  expect(tall.body.clientHeight).to.be.at.least(1000);
  const zoomed = await imagePreview(60, true, true);
  expect(zoomed.viewer.shadowRoot!.querySelectorAll('lr-pan-zoom').length).to.equal(1);
});
