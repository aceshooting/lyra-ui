import { toast } from '../../overlays/toast/toaster.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import './lightbox.js';
import type { LyraLightbox } from './lightbox.js';

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
}

describe('lightbox native modal interoperability', () => {
  for (const nativeOpen of [false, true]) {
    it(`accepts pointer, focus and Escape ${nativeOpen ? 'above a native modal' : 'on the ordinary path'}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Open</button></dialog><lr-lightbox></lr-lightbox></div>`);
      const native = wrapper.querySelector('dialog')!;
      const opener = native.querySelector('button')!;
      const overlay = wrapper.querySelector('lr-lightbox') as LyraLightbox;
      
      let clicks = 0;
      try {
        if (nativeOpen) native.showModal();
        await overlay.show();
        await overlay.updateComplete;
        const action = overlay.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
        action.addEventListener('click', (event) => { event.stopImmediatePropagation(); clicks++; }, { capture: true });
        await click(action);
        expect(clicks, 'the visible control receives the real pointer').to.equal(1);
        expect(deepActiveElement(document) === action, 'the control receives focus').to.equal(true);
        expect(overlay.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(nativeOpen ? 1 : 0);
        expect(overlay.parentNode === wrapper).to.equal(true);
        const veto = (event: Event) => event.preventDefault();
        overlay.addEventListener('lr-hide', veto);
        await sendKeys({ press: 'Escape' });
        expect(overlay.open, 'the close veto preserves the surface').to.equal(true);
        expect(native.open).to.equal(nativeOpen);
        overlay.removeEventListener('lr-hide', veto);
        if (nativeOpen) {
          overlay.remove();
          wrapper.append(overlay);
          await overlay.updateComplete;
          await waitUntil(() => overlay.shadowRoot!.querySelectorAll('dialog:modal').length === 1);
          await click(action);
          expect(clicks, 'reconnecting restores pointer interaction').to.equal(2);
        }
        await sendKeys({ press: 'Escape' });
        await waitUntil(() => !overlay.open, 'Escape dismisses the Lyra surface');
        expect(native.open).to.equal(nativeOpen);
        if (nativeOpen) await waitUntil(() => deepActiveElement(document) === opener, 'focus returns to the native opener');
      } finally {
        overlay.remove();
        native.close();
      }
    });
  }
});

describe('lightbox native modal helper content', () => {
  it('keeps toast actions and announcements in its native modal subtree', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Open</button></dialog><lr-lightbox></lr-lightbox></div>`);
    const native = wrapper.querySelector('dialog')!;
    const lightbox = wrapper.querySelector('lr-lightbox') as LyraLightbox;
    try {
      native.showModal();
      await lightbox.show();
      let invoked = false;
      const item = await toast({ message: 'Saved image', duration: 0, action: {
        label: 'Undo', onClick: () => { invoked = true; },
      } }).item;
      expect(lightbox.contains(item)).to.equal(true);
      expect(item.getRootNode() === document).to.equal(true);
      await waitUntil(() => getComputedStyle(item.shadowRoot!.querySelector('[part="toast-item"]')!).opacity === '1');
      const action = item.querySelector<HTMLButtonElement>('button')!;
      for (let index = 0; index < 12 && deepActiveElement(document) !== action; index++) {
        await sendKeys({ press: 'Tab' });
      }
      expect(deepActiveElement(document) === action, 'the modal focus scope includes the helper action').to.equal(true);
      await click(action);
      expect(invoked, 'the toast action accepts a native pointer').to.equal(true);
      await waitUntil(() => lightbox.querySelector('[data-lr-live-region="polite"]')?.textContent?.includes('Saved image') === true);
      expect(lightbox.open).to.equal(true);
      expect(native.open).to.equal(true);
    } finally {
      lightbox.remove();
      native.close();
    }
  });
});
