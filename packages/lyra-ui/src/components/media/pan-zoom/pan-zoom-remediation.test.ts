import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './pan-zoom.js';
import type { LyraPanZoom } from './pan-zoom.js';

it('names the viewport from the property or the host aria-label', async () => {
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
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
  el.setAttribute('aria-label', 'Host purpose');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Host purpose');
  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Viewport');
});


it('leaves browser zoom shortcuts with Ctrl, Meta or Alt to the browser', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    for (const key of ['+', '=', '-', '0']) {
      const event = new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true });
      viewport.dispatchEvent(event);
      expect(event.defaultPrevented, `${modifier} ${key}`).to.equal(false);
    }
  }
  expect(el.zoom).to.equal(1);
  const plain = new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true });
  viewport.dispatchEvent(plain);
  expect(plain.defaultPrevented).to.equal(true);
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

const broken = 'data:image/png;base64,AAAA';
const good = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3C/svg%3E';

it('shows localized failure text and emits lr-render-error when the image fails', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom src=${broken}></lr-pan-zoom>`);
  await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') !== null, 'failure text');
  expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('The image failed to load.');
  expect(el.shadowRoot!.querySelector('img') === null).to.equal(true);
});

it('emits lr-render-error once and recovers when src changes', async () => {
  const el = document.createElement('lr-pan-zoom') as LyraPanZoom;
  let errors = 0;
  el.addEventListener('lr-render-error', () => { errors++; });
  const failed = oneEvent(el, 'lr-render-error');
  el.src = broken;
  document.body.append(el);
  await failed;
  expect(errors).to.equal(1);
  el.src = good;
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null && el.shadowRoot!.querySelector('[part="error"]') === null);
  el.remove();
});

it('leaves Alt-modified and composing zoom keys alone', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom src=${good}></lr-pan-zoom>`);
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
  const composing = new KeyboardEvent('keydown', { key: '+', bubbles: true, composed: true, cancelable: true, isComposing: true });
  viewport.dispatchEvent(composing);
  expect(composing.defaultPrevented).to.equal(false);
  expect(el.zoom).to.equal(1);
});

it('eases hover and press paint on the zoom buttons', async () => {
  const el = await fixture<LyraPanZoom>(html`<lr-pan-zoom src=${good}></lr-pan-zoom>`);
  const property = getComputedStyle(el.shadowRoot!.querySelector('[part="zoom-in"]')!).transitionProperty;
  expect(property.includes('color'), property).to.equal(true);
  expect(property.includes('border-color'), property).to.equal(true);
});

it('applies shared icon action tokens to the native toolbar control', async () => {
  const el = await fixture<HTMLElement>(html`<lr-pan-zoom style="--lr-icon-button-border: 3px solid rgb(11, 22, 33); --lr-icon-button-bg: rgb(21, 31, 41); --lr-icon-button-radius: 9px"></lr-pan-zoom>`);
  const style = getComputedStyle(el.shadowRoot!.querySelector('[part="zoom-in"]')!);
  expect(style.borderTopColor).to.equal('rgb(11, 22, 33)');
  expect(style.borderTopWidth).to.equal('3px');
  expect(style.backgroundColor).to.equal('rgb(21, 31, 41)');
  expect(style.borderTopLeftRadius).to.equal('9px');
});
