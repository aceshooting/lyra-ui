import { expect, fixture, html } from '@open-wc/testing';
import './heatmap.js';
import type { HeatmapLegendStop, LyraHeatmap } from './heatmap.js';

async function mount(): Promise<LyraHeatmap> {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap></lr-heatmap>`);
  el.data = { kind: 'matrix', rowLabels: ['r'], colLabels: ['a', 'b'], values: [[1, 9]] };
  await el.updateComplete;
  return el;
}

function legendEnds(el: LyraHeatmap): (string | undefined)[] {
  return ['legend-lo', 'legend-hi'].map((name) => el.shadowRoot!.querySelector(`[part="${name}"]`)?.textContent?.trim());
}

describe('lr-heatmap pinned domain', () => {
  it('orders a reversed pinned domain and ignores a degenerate or non-finite one', async () => {
    const el = await mount();
    expect(legendEnds(el)).to.deep.equal(['1', '9']);
    el.domain = [0, 10];
    await el.updateComplete;
    expect(legendEnds(el)).to.deep.equal(['0', '10']);
    el.domain = [10, 0];
    await el.updateComplete;
    expect(legendEnds(el)).to.deep.equal(['0', '10']);
    for (const domain of [[5, 5], [0, Number.POSITIVE_INFINITY], [Number.NaN, 3]] as [number, number][]) {
      el.domain = domain;
      await el.updateComplete;
      expect(legendEnds(el), String(domain)).to.deep.equal(['1', '9']);
    }
  });
});

describe('lr-heatmap legend stops reassignment', () => {
  it('schedules no update when the unset stops are assigned again', async () => {
    const el = await mount();
    expect(el.legendStops).to.equal(undefined);
    el.legendStops = undefined;
    expect(el.isUpdatePending).to.equal(false);
  });

  it('schedules no update for a recreated list of equal stops and updates for any field that differs', async () => {
    const el = await mount();
    const stops = () => [{ value: 1, color: 'red', label: 'Low' }, { value: 9, color: 'blue', label: 'High' }];
    el.legendStops = stops();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(2);
    el.legendStops = stops();
    expect(el.isUpdatePending, 'equal stops').to.equal(false);
    const changed = stops();
    changed[1] = { value: 9, color: 'green', label: 'High' };
    el.legendStops = changed;
    expect(el.isUpdatePending, 'a different color').to.equal(true);
    await el.updateComplete;
    el.legendStops = changed.slice(0, 1);
    expect(el.isUpdatePending, 'fewer stops').to.equal(true);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(1);
    el.legendStops = undefined;
    expect(el.isUpdatePending, 'cleared stops').to.equal(true);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(0);
  });

  it('reads a skipped position and an explicitly empty one as different lists', async () => {
    const el = await mount();
    const stop = { value: 1, color: 'red', label: 'Low' };
    const skipped: unknown[] = [stop];
    skipped.length = 2;
    el.legendStops = [stop, undefined] as unknown as HeatmapLegendStop[];
    await el.updateComplete;
    el.legendStops = skipped as unknown as HeatmapLegendStop[];
    expect(el.isUpdatePending, 'a hole where an undefined entry stood').to.equal(true);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(1);
    el.legendStops = [stop, { value: 9, color: 'blue' }];
    expect(el.isUpdatePending, 'a real stop where an entry was missing').to.equal(true);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(2);
  });
});
