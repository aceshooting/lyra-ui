import { expect, fixture, html } from '@open-wc/testing';
import './poll-status.js';
import type { LyraPollStatus } from './poll-status.js';

describe('lr-poll-status inactive activation race', () => {
  it('ignores pause and refresh activations made before an inactive state re-renders the controls', async () => {
    const el = await fixture<LyraPollStatus>(html`<lr-poll-status with-refresh next-in-ms="60000"></lr-poll-status>`);
    const pause = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="pause-button"]')!;
    const refresh = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="refresh-button"]')!;
    const events: string[] = [];
    el.addEventListener('lr-pause-change', () => events.push('pause'));
    el.addEventListener('lr-poll-due', () => events.push('due'));

    el.active = false;
    // The buttons are still enabled until the pending update renders the inactive state.
    expect(pause.disabled || refresh.disabled).to.equal(false);
    pause.click();
    refresh.click();
    await el.updateComplete;

    expect(events).to.deep.equal([]);
    expect(el.paused).to.equal(false);
    expect(refresh.disabled).to.equal(true);
  });
});
