import { expect, fixture, html, waitUntil } from '@open-wc/testing';
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

it('moves a running ticker between connected documents with one live destination interval', async () => {
  const host = await fixture<HTMLElement>(html`<div><lr-generation-metrics></lr-generation-metrics><iframe></iframe></div>`);
  const metrics = host.querySelector('lr-generation-metrics')!;
  const frame = host.querySelector('iframe')!;
  const foreign = frame.contentDocument!;
  function trackIntervals(view: Window) {
    const set = view.setInterval, clear = view.clearInterval;
    const active = new Set<number>();
    view.setInterval = (handler, timeout, ...args) => {
      const handle = set.call(view, handler, timeout, ...args); active.add(handle); return handle;
    };
    view.clearInterval = handle => { if (handle !== undefined) active.delete(handle); clear.call(view, handle); };
    return { active, restore() { view.setInterval = set; view.clearInterval = clear; } };
  }
  const mainTimers = trackIntervals(window), foreignTimers = trackIntervals(frame.contentWindow!);
  try {
    metrics.status = 'running';
    await metrics.updateComplete;
    expect(mainTimers.active.size).to.equal(1);
    for (const destination of [foreign.body, host]) {
      destination.append(metrics);
      await metrics.updateComplete;
      const inFrame = metrics.ownerDocument === foreign;
      expect(mainTimers.active.size).to.equal(inFrame ? 0 : 1);
      expect(foreignTimers.active.size).to.equal(inFrame ? 1 : 0);
      const before = elapsedSeconds(metrics);
      await waitUntil(() => elapsedSeconds(metrics) > before + 0.5, 'the destination ticker advances elapsed time', { timeout: 5000 });
      expect(metrics.status).to.equal('running');
    }
    metrics.status = 'complete';
    await metrics.updateComplete;
    expect(mainTimers.active.size).to.equal(0);
    expect(foreignTimers.active.size).to.equal(0);
  } finally { metrics.remove(); mainTimers.restore(); foreignTimers.restore(); }
});
