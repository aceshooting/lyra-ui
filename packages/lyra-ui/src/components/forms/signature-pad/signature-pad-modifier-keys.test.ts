import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraSignaturePad } from './signature-pad.class.js';
import '../../lr-signature-pad.js';

const surface = (el: LyraSignaturePad): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('[part~="surface"]')!;

const press = (target: HTMLElement, key: string, init: KeyboardEventInit = {}): boolean =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init }));

describe('lr-signature-pad keyboard modifiers', () => {
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
    it(`leaves ${modifier} chords to the platform instead of drawing`, async () => {
      const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad label="Signature"></lr-signature-pad>`);
      await focusByKeyboard(surface(el));

      const penHandled = !press(surface(el), ' ', { [modifier]: true });
      const moveHandled = !press(surface(el), 'ArrowRight', { [modifier]: true });
      press(surface(el), 'Enter', { [modifier]: true });

      expect(penHandled, 'the pen chord is not consumed').to.equal(false);
      expect(moveHandled, 'the move chord is not consumed').to.equal(false);
      expect(el.strokes).to.deep.equal([]);
    });
  }
});

describe('lr-signature-pad name', () => {
  it('clears the reflected name when set to null', async () => {
    const el = await fixture<LyraSignaturePad>(html`<lr-signature-pad name="signature"></lr-signature-pad>`);
    expect(el.getAttribute('name')).to.equal('signature');
    el.name = null;
    expect(el.name).to.equal('');
    expect(el.hasAttribute('name')).to.equal(false);
  });
});
