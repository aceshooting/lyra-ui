import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './poll-status.js';
import '../live-region/live-region.js';
import type { LyraPollStatus } from './poll-status.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';

function liveRegionText(el: LyraPollStatus): string {
  const region = el.shadowRoot!.querySelector('lyra-live-region') as LyraLiveRegion;
  return region.shadowRoot!.querySelector('[part="region"]')!.textContent ?? '';
}

describe('lyra-poll-status', () => {
  it('ticks down the countdown display and reaches the due phase, firing lyra-poll-due', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="40"></lyra-poll-status>`)) as LyraPollStatus;
    await oneEvent(el, 'lyra-poll-due');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="countdown"]')!.textContent).to.include('Refreshing');
  });

  it('pauses on the built-in pause button, suppressing lyra-poll-due, and announces the transition', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="10000"></lyra-poll-status>`)) as LyraPollStatus;
    await el.updateComplete;
    const pauseButton = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
    setTimeout(() => pauseButton.click());
    await oneEvent(el, 'lyra-pause-change');
    expect(el.paused).to.be.true;
    await aTimeout(50);
    expect(liveRegionText(el)).to.include('Paused');
  });

  it('does not tick or fire lyra-poll-due while paused', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="40" paused></lyra-poll-status>`)) as LyraPollStatus;
    let fired = false;
    el.addEventListener('lyra-poll-due', () => (fired = true));
    await aTimeout(150);
    expect(fired).to.be.false;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-poll-status next-in-ms="10000"></lyra-poll-status>`)) as LyraPollStatus;
    await expect(el).to.be.accessible();
  });
});
