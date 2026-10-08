import { fixture, expect, aTimeout, waitUntil, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './generation-metrics.js';
import { LiveDerivedThroughput } from './generation-metrics.stories.js';
import type { LyraGenerationMetrics } from './generation-metrics.js';

describe('generation metrics live example', () => {
  it('starts on mount, honors the first Stop, and restarts repeatedly without old timers', async () => {
    const root = await fixture<HTMLElement>(LiveDerivedThroughput.render!({}, null as never));
    const status = root.querySelector<LyraGenerationMetrics>('lr-generation-metrics')!;
    try {
      await waitUntil(() => (status.tokenCount ?? 0) > 0, 'initial streaming tokens', { timeout: 1800 });
      status.shadowRoot!.querySelector<HTMLButtonElement>('[part="stop-button"]')!.click();
      expect(status.status).to.equal('complete');
      const stopped = status.tokenCount;
      // wait-reason: asserts no token updates after Stop for longer than one ticker interval
      await aTimeout(1150);
      expect(status.tokenCount).to.equal(stopped);
      for (let cycle = 0; cycle < 2; cycle++) {
        root.querySelector<HTMLButtonElement>('[data-restart]')!.click();
        await status.updateComplete;
        expect(status.status).to.equal('running');
        expect(status.tokenCount).to.equal(0);
        await waitUntil(() => (status.tokenCount ?? 0) > 0, 'restarted streaming tokens', { timeout: 1800 });
        expect(status.tokenCount).to.equal(6);
        status.shadowRoot!.querySelector<HTMLButtonElement>('[part="stop-button"]')!.click();
        expect(status.status).to.equal('complete');
      }
    } finally { root.remove(); }
  });

  it('retires streaming token updates after disconnect', async () => {
    const root = await fixture<HTMLElement>(LiveDerivedThroughput.render!({}, null as never));
    const status = root.querySelector<LyraGenerationMetrics>('lr-generation-metrics')!;
    await waitUntil(() => (status.tokenCount ?? 0) > 0, 'initial streaming tokens', { timeout: 1800 });
    root.remove();
    const stopped = status.tokenCount;
    // wait-reason: asserts no token updates after disconnect for longer than one ticker interval
    await aTimeout(1150);
    expect(status.tokenCount).to.equal(stopped);
  });
});

it('derives throughput from the current elapsed time between ticks', async () => {
  const el = await fixture<LyraGenerationMetrics>(html`<lr-generation-metrics
    status="running" token-count="50" .startedAt=${Date.now() - 1000}
  ></lr-generation-metrics>`);
  // wait-reason: real elapsed time between ticks drives the derived throughput
  await aTimeout(500);
  el.tokenCount = 75;
  await el.updateComplete;
  const rate = Number.parseFloat(el.shadowRoot!.querySelector('[part="throughput"]')!.textContent!);
  expect(rate).to.be.below(60);
});

it('moves focus from Stop to the readout when the run ends', async () => {
  const el = await fixture<LyraGenerationMetrics>(html`<lr-generation-metrics status="running"></lr-generation-metrics>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="stop-button"]')!);
  el.status = 'complete';
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});
