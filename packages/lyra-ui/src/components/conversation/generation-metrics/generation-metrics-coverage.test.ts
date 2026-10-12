import { expect, fixture, html } from '@open-wc/testing';
import './generation-metrics.js';
import type { LyraGenerationMetrics } from './generation-metrics.js';

function elapsedSeconds(el: LyraGenerationMetrics): number {
  const text = el.shadowRoot!.querySelector('[part="elapsed"]')!.textContent!.trim();
  const minutes = text.match(/^(\d+)m (\d+)s$/);
  if (minutes) return Number(minutes[1]) * 60 + Number(minutes[2]);
  const seconds = text.match(/^(\d+(?:\.\d+)?)s$/);
  if (seconds) return Number(seconds[1]);
  throw new Error(`Unexpected elapsed format: ${text}`);
}

it('switches from the fallback clock to a host timestamp that arrives during a running generation', async () => {
  const el = (await fixture(html`<lr-generation-metrics status="running"></lr-generation-metrics>`)) as LyraGenerationMetrics;
  expect(elapsedSeconds(el)).to.be.lessThan(0.5);

  el.startedAt = Date.now() - 5_000;
  await el.updateComplete;
  expect(elapsedSeconds(el)).to.be.closeTo(5, 0.5);
  expect(el.shadowRoot!.querySelector('[part="elapsed"]')!.textContent).not.to.contain('NaN');
});
