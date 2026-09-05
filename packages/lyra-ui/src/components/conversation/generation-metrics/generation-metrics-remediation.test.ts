import { fixture, expect, aTimeout, waitUntil } from '@open-wc/testing';
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
    await aTimeout(1150);
    expect(status.tokenCount).to.equal(stopped);
  });
});
