import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse } from '../../../../test/wtr-mouse.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import './command-palette.js';
import type { LyraCommandPalette } from './command-palette.js';

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
}

describe('command-palette native modal interoperability', () => {
  for (const nativeOpen of [false, true]) {
    it(`accepts pointer, focus and Escape ${nativeOpen ? 'above a native modal' : 'on the ordinary path'}`, async () => {
      const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Open</button></dialog><lr-command-palette></lr-command-palette></div>`);
      const native = wrapper.querySelector('dialog')!;
      const opener = native.querySelector('button')!;
      const overlay = wrapper.querySelector('lr-command-palette') as LyraCommandPalette;
      overlay.commands = [{ commandId: 'apply', label: 'Apply' }];
      let clicks = 0;
      try {
        if (nativeOpen) native.showModal();
        overlay.openPalette();
        await overlay.updateComplete;
        const action = overlay.shadowRoot!.querySelector<HTMLElement>('[part="input"]')!;
        action.addEventListener('click', (event) => { event.stopImmediatePropagation(); clicks++; }, { capture: true });
        await click(action);
        expect(clicks, 'the visible control receives the real pointer').to.equal(1);
        expect(deepActiveElement(document) === action, 'the control receives focus').to.equal(true);
        expect(overlay.shadowRoot!.querySelectorAll('dialog:modal').length).to.equal(nativeOpen ? 1 : 0);
        expect(overlay.parentNode === wrapper).to.equal(true);
        const veto = (event: Event) => event.preventDefault();
        overlay.addEventListener('lr-close-request', veto);
        await sendKeys({ press: 'Escape' });
        expect(overlay.open, 'the close veto preserves the surface').to.equal(true);
        expect(native.open).to.equal(nativeOpen);
        overlay.removeEventListener('lr-close-request', veto);
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
