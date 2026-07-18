import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './zoomable-frame.js';
import type { LyraZoomableFrame } from './zoomable-frame.js';

it('renders a zoomable frame with bounded controls', async () => {
  const el = (await fixture(html`
    <lr-zoomable-frame zoom="2" aria-label="Map preview">
      <div style="inline-size: 20rem; block-size: 10rem;">Map</div>
    </lr-zoomable-frame>
  `)) as LyraZoomableFrame;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-zoom')).to.equal('2');
  expect(el.shadowRoot!.querySelector('[part="zoom-out"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="zoom-in"]')).to.exist;
});

it('emits a zoom change and keeps the public value controlled by the component', async () => {
  const el = (await fixture(html`<lr-zoomable-frame></lr-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lr-zoom-change');
  button.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ zoom: 1.25 });
  expect(el.zoom).to.equal(1.25);
});

it('is accessible and resets with the keyboard shortcut', async () => {
  const el = (await fixture(html`<lr-zoomable-frame zoom="2" aria-label="Preview"></lr-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));
  await el.updateComplete;
  expect(el.zoom).to.equal(1);
  await expect(el).to.be.accessible();
});

it('renders a safe image src as-is', async () => {
  const el = (await fixture(
    html`<lr-zoomable-frame src="https://example.test/a.png" alt="A map"></lr-zoomable-frame>`,
  )) as LyraZoomableFrame;
  await el.updateComplete;
  const img = el.shadowRoot!.querySelector('[part="content"] img') as HTMLImageElement;
  expect(img.getAttribute('src')).to.equal('https://example.test/a.png');
});

it('rejects an unsafe image src instead of passing it straight to the DOM', async () => {
  const el = (await fixture(
    html`<lr-zoomable-frame src="javascript:alert(1)" alt="A map"></lr-zoomable-frame>`,
  )) as LyraZoomableFrame;
  await el.updateComplete;
  const img = el.shadowRoot!.querySelector('[part="content"] img') as HTMLImageElement;
  expect(img.getAttribute('src')).to.equal('');
});

it('renders the reset button\'s visible zoom percentage through localize (unchanged English default)', async () => {
  const el = (await fixture(html`<lr-zoomable-frame></lr-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
  expect(reset.textContent?.trim()).to.equal('100%');
});

it('localizes the reset button\'s visible zoom percentage via .strings', async () => {
  const el = (await fixture(
    html`<lr-zoomable-frame .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lr-zoomable-frame>`,
  )) as LyraZoomableFrame;
  await el.updateComplete;
  const reset = el.shadowRoot!.querySelector('[part="reset"]') as HTMLButtonElement;
  expect(reset.textContent?.trim()).to.equal('100 pourcent');
});

it('names the focusable viewport with role="group", forwarding a host aria-label', async () => {
  const el = (await fixture(html`<lr-zoomable-frame></lr-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(viewport.getAttribute('tabindex')).to.equal('0');
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(viewport.getAttribute('aria-label')).to.equal('Zoomable content');

  el.setAttribute('aria-label', 'Map preview');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Map preview');
});

// Regression coverage for the shared finite-number normalization layer (`src/internal/numbers.ts`)
// -- this component previously hand-rolled its own Number.isFinite guards instead of using it;
// a non-finite/negative min-zoom, max-zoom, zoom-step, or zoom used to be able to flow straight
// into the stepped-zoom clamp and produce NaN geometry/CSS instead of a sane default.
it('normalizes a non-finite zoom to a clamped, finite value instead of NaN', async () => {
  const el = (await fixture(html`<lr-zoomable-frame zoom="NaN"></lr-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  expect(content.getAttribute('data-zoom')).to.not.match(/NaN/);
  expect(Number.isFinite(Number(content.getAttribute('data-zoom')))).to.be.true;
});

it('normalizes non-finite min-zoom/max-zoom to finite fallback bounds so controls stay usable', async () => {
  const el = (await fixture(
    html`<lr-zoomable-frame min-zoom="NaN" max-zoom="Infinity"></lr-zoomable-frame>`,
  )) as LyraZoomableFrame;
  await el.updateComplete;
  const zoomOut = el.shadowRoot!.querySelector('[part="zoom-out"]') as HTMLButtonElement;
  const zoomIn = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
  // Both bounds fell back to their finite defaults (0.5/4), so the default zoom of 1 sits
  // strictly inside the range and neither control is stuck disabled.
  expect(zoomIn.disabled).to.be.false;
  expect(zoomOut.disabled).to.be.false;
});

it('clamps max-zoom below min-zoom to a collapsed-but-finite range instead of NaN', async () => {
  const el = (await fixture(html`<lr-zoomable-frame max-zoom="0.1"></lr-zoomable-frame>`)) as LyraZoomableFrame;
  await el.updateComplete;
  // max-zoom (0.1) is below the default min-zoom (0.5) -- the range collapses to a single point
  // at min-zoom instead of inverting or producing NaN, so the default zoom (1) clamps down to it.
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  expect(content.getAttribute('data-zoom')).to.equal('0.5');
  const zoomOut = el.shadowRoot!.querySelector('[part="zoom-out"]') as HTMLButtonElement;
  const zoomIn = el.shadowRoot!.querySelector('[part="zoom-in"]') as HTMLButtonElement;
  expect(zoomIn.disabled).to.be.true;
  expect(zoomOut.disabled).to.be.true;
});

it('clamps a non-finite/negative zoom-step to a positive floor so zoomIn/zoomOut keep making progress', async () => {
  const el = (await fixture(html`<lr-zoomable-frame zoom-step="-1"></lr-zoomable-frame>`)) as LyraZoomableFrame;
  const before = el.zoom;
  el.zoomIn();
  await el.updateComplete;
  expect(el.zoom).to.be.greaterThan(before);

  el.zoomStep = Number.NaN;
  await el.updateComplete;
  const afterFirstZoomIn = el.zoom;
  el.zoomIn();
  await el.updateComplete;
  expect(el.zoom).to.be.greaterThan(afterFirstZoomIn);
});
