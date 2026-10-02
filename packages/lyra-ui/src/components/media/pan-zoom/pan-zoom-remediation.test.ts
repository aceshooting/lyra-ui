import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './pan-zoom.js';
import type { LyraPanZoom } from './pan-zoom.js';

it('names the viewport from a direct property while preserving host naming ownership', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom .strings=${{ zoomableFrameLabel: 'Viewport' }}></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
  el.accessibleLabel = 'Inspection';
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(viewport.getAttribute('aria-label')).to.equal('Inspection');
  el.accessibleLabel = 'Updated inspection';
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Updated inspection');
  el.accessibleLabel = '';
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('');
  el.setAttribute('aria-label', 'Host purpose');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
});


for (const width of [640, 320]) {
  for (const direction of ['ltr', 'rtl']) {
    it(`keeps hidden reset text inside a nested scroller at ${width}px in ${direction}`, async () => {
      const outer = await fixture<HTMLElement>(html`
        <div dir=${direction} style=${`position:relative;inline-size:${width}px;block-size:400px`}>
          <div data-scroller style="block-size:350px;overflow:auto">
            <div style="block-size:800px"></div>
            <lr-pan-zoom zoom="2" .strings=${{
              resetZoom: 'Réinitialiser le niveau de zoom '.repeat(20),
              pdfViewerCurrentZoom: '{percent} pourcent',
            }}><div style="inline-size:80px;block-size:60px">Diagram</div></lr-pan-zoom>
          </div>
        </div>
      `);
      const scroller = outer.querySelector<HTMLElement>('[data-scroller]')!;
      const el = outer.querySelector<LyraPanZoom>('lr-pan-zoom')!;
      await el.updateComplete;
      const reset = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="reset"]')!;
      const label = reset.querySelector<HTMLElement>('.sr-only')!;

      expect(scroller.scrollHeight, 'content remains scrollable inside its allocation').to.be.greaterThan(scroller.clientHeight);
      expect(outer.scrollHeight, 'hidden text must not escape the inner scrollport').to.equal(outer.clientHeight);
      expect(label.offsetParent === reset, 'the hidden action name belongs to its reset button').to.equal(true);
      expect(label.textContent).to.contain('Réinitialiser le niveau de zoom');
      expect(reset.textContent).to.contain('200 pourcent');
      expect(reset.hasAttribute('aria-hidden')).to.equal(false);
      expect(label.hasAttribute('aria-hidden')).to.equal(false);
      expect(getComputedStyle(label).display).to.not.equal('none');

      scroller.scrollTop = scroller.scrollHeight;
      expect(scroller.scrollTop).to.be.greaterThan(0);
      expect(outer.scrollHeight, 'scrolling the inner content cannot grow its outer shell').to.equal(outer.clientHeight);
      await focusByKeyboard(reset);
      expect(el.shadowRoot!.activeElement === reset).to.equal(true);
      expect(getComputedStyle(reset).outlineStyle, 'keyboard focus ring still paints').to.equal('solid');
      const changed = oneEvent(el, 'lr-zoom-change');
      await sendKeys({ press: 'Enter' });
      expect((await changed).detail).to.deep.equal({ zoom: 1 });
      await el.updateComplete;
      expect(reset.textContent).to.contain('100 pourcent');
      expect(label.textContent).to.contain('Réinitialiser le niveau de zoom');
      expect(outer.scrollHeight, 'resetting zoom cannot grow the outer shell').to.equal(outer.clientHeight);
      outer.remove();
    });
  }
}
