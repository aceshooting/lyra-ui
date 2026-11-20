import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import '../../lr-copy-button.js';
import type { LyraCopyButton } from '../../lr-copy-button.js';

describe('lr-copy-button disabled custom trigger', () => {
  it('does not write to the clipboard when a disabled button has its custom trigger activated', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => { writes.push(text); return Promise.resolve(); } },
    });
    try {
      const el = await fixture<LyraCopyButton>(html`<lr-copy-button value="secret" disabled><button id="trigger">Copy</button></lr-copy-button>`);
      const events: string[] = [];
      el.addEventListener('lr-copy', () => events.push('copy'));
      el.addEventListener('lr-copy-error', () => events.push('error'));
      el.querySelector<HTMLButtonElement>('#trigger')!.click();
      await aTimeout(0);
      expect(writes).to.deep.equal([]);
      expect(events).to.deep.equal([]);

      el.disabled = false;
      await el.updateComplete;
      el.querySelector<HTMLButtonElement>('#trigger')!.click();
      await aTimeout(0);
      expect(writes).to.deep.equal(['secret']);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
