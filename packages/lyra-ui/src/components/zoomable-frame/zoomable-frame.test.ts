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
