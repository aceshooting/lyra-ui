import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './toast.js';
import type { LyraToast } from './toast.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

function deepActive(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

describe('lr-toast-item focus return', () => {
  it('returns focus to the control focus arrived from when the only toast is dismissed', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <button id="origin">Origin</button>
        <lr-toast></lr-toast>
      </div>
    `);
    const region = wrapper.querySelector<LyraToast>('lr-toast')!;
    const origin = wrapper.querySelector<HTMLButtonElement>('#origin')!;
    const item = await region.create({ message: 'Saved', duration: 0 });
    await waitUntil(() => item.hasAttribute('data-visible'), 'toast visible');
    const close = item.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;

    await focusByKeyboard(origin);
    await sendKeys({ press: 'Tab' });
    await waitUntil(() => deepActive() === close, 'Tab reaches the toast close button');

    const hidden = oneEvent(item, 'lr-after-hide');
    await sendKeys({ press: 'Enter' });
    await hidden;

    expect(item.isConnected).to.equal(false);
    expect(document.activeElement === origin).to.equal(true);
  });
});
