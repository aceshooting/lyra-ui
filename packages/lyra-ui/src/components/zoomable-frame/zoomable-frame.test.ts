import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './zoomable-frame.js';
import type { LyraZoomableFrame } from './zoomable-frame.js';

it('renders a zoomable frame with bounded controls', async () => {
  const el = (await fixture(html`
    <lyra-zoomable-frame zoom="2" aria-label="Map preview">
      <div style="inline-size: 20rem; block-size: 10rem;">Map</div>
    </lyra-zoomable-frame>
  `)) as LyraZoomableFrame;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-zoom')).to.equal('2');
  expect(el.shadowRoot!.querySelector('[part="zoom-out"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="zoom-in"]')).to.exist;
});

it('emits a zoom change and keeps the public value controlled by the component', async () => {
  const el = (await fixture(html`<lyra-zoomable-frame></lyra-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lyra-zoom-change');
  button.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ zoom: 1.25 });
  expect(el.zoom).to.equal(1.25);
});

it('is accessible and resets with the keyboard shortcut', async () => {
  const el = (await fixture(html`<lyra-zoomable-frame zoom="2" aria-label="Preview"></lyra-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
  await el.updateComplete;
  expect(el.zoom).to.equal(1);
  await expect(el).to.be.accessible();
});

it('renders a safe image src as-is', async () => {
  const el = (await fixture(
    html`<lyra-zoomable-frame src="https://example.test/a.png" alt="A map"></lyra-zoomable-frame>`,
  )) as LyraZoomableFrame;
  await el.updateComplete;
  const img = el.shadowRoot!.querySelector('[part="content"] img') as HTMLImageElement;
  expect(img.getAttribute('src')).to.equal('https://example.test/a.png');
});

it('rejects an unsafe image src instead of passing it straight to the DOM', async () => {
  const el = (await fixture(
    html`<lyra-zoomable-frame src="javascript:alert(1)" alt="A map"></lyra-zoomable-frame>`,
  )) as LyraZoomableFrame;
  await el.updateComplete;
  const img = el.shadowRoot!.querySelector('[part="content"] img') as HTMLImageElement;
  expect(img.getAttribute('src')).to.equal('');
});

it('renders the reset button\'s visible zoom percentage through localize (unchanged English default)', async () => {
  const el = (await fixture(html`<lyra-zoomable-frame></lyra-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
  expect(reset.textContent?.trim()).to.equal('100%');
});

it('localizes the reset button\'s visible zoom percentage via .strings', async () => {
  const el = (await fixture(
    html`<lyra-zoomable-frame .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lyra-zoomable-frame>`,
  )) as LyraZoomableFrame;
  await el.updateComplete;
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
  expect(reset.textContent?.trim()).to.equal('100 pourcent');
});
