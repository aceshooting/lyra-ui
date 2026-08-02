import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './pan-zoom.js';
import type { LyraPanZoom } from './pan-zoom.js';

it('preserves the former zoomable-frame slotted pan/zoom contract under lr-pan-zoom', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom zoom="2" aria-label="Map preview">
      <div style="inline-size: 20rem; block-size: 10rem;">Map</div>
    </lr-pan-zoom>
  `);

  expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-zoom')).to.equal('2');
  expect(el.shadowRoot!.querySelectorAll('[part="zoom-out"]').length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[part="zoom-in"]').length).to.equal(1);
});

it('preserves image source safety and an absent src attribute for rejected URLs', async () => {
  const safe = await fixture<LyraPanZoom>(
    html`<lr-pan-zoom src="https://example.test/a.png" alt="A map"></lr-pan-zoom>`,
  );
  expect(safe.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal('https://example.test/a.png');

  const unsafe = await fixture<LyraPanZoom>(
    html`<lr-pan-zoom src="javascript:alert(1)" alt="A map"></lr-pan-zoom>`,
  );
  const image = unsafe.shadowRoot!.querySelector('img') as HTMLImageElement;
  expect(image.hasAttribute('src')).to.be.false;
  expect(image.src).to.equal('');
});

it('keeps zoom methods, reset semantics, and lr-zoom-change', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  const scrollCalls: ScrollToOptions[] = [];
  viewport.scrollTo = ((options: ScrollToOptions) => scrollCalls.push(options)) as typeof viewport.scrollTo;

  const changed = oneEvent(el, 'lr-zoom-change');
  el.zoomIn();
  expect((await changed).detail).to.deep.equal({ zoom: 1.25 });
  el.resetZoom();
  await el.updateComplete;
  expect(el.zoom).to.equal(1);
  expect(scrollCalls).to.deep.equal([]);

  el.resetView();
  expect(scrollCalls).to.deep.equal([{ left: 0, top: 0 }]);
});

it('keeps keyboard zoom while leaving slotted editors alone', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom><input value="10" /></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.zoom).to.equal(1.25);

  const input = el.querySelector('input')!;
  const key = new KeyboardEvent('keydown', { key: '+', bubbles: true, composed: true, cancelable: true });
  input.dispatchEvent(key);
  await el.updateComplete;
  expect(el.zoom).to.equal(1.25);
  expect(key.defaultPrevented).to.be.false;
});

it('normalizes malformed zoom configuration to finite usable values', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom zoom="NaN" min-zoom="NaN" max-zoom="Infinity" zoom-step="-1"></lr-pan-zoom>
  `);
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
  expect(Number.isFinite(Number(content.dataset['zoom']))).to.be.true;
  const before = Number(content.dataset['zoom']);
  el.zoomIn();
  await el.updateComplete;
  expect(Number.isFinite(el.zoom)).to.be.true;
  expect(el.zoom).to.be.greaterThan(before);
});

it('forwards aria-label to the focusable viewport and localizes visible zoom output', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="Map preview" .strings=${{ pdfViewerCurrentZoom: '{percent} pourcent' }}></lr-pan-zoom>
  `);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(viewport.getAttribute('aria-label')).to.equal('Map preview');
  expect(el.shadowRoot!.querySelector('[part="reset"]')!.textContent?.trim()).to.equal('100 pourcent');
});

it('keeps the pan/zoom surface accessible in populated state', async () => {
  const el = await fixture<LyraPanZoom>(html`
    <lr-pan-zoom aria-label="Diagram preview"><div>Diagram</div></lr-pan-zoom>
  `);
  await expect(el).to.be.accessible();
});
