import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { ifDefined } from 'lit/directives/if-defined.js';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.js';

const LABELS = ['Mon', 'Tue'];
const DATASETS = [{ label: 'North', data: [3, 5] }, { label: 'South', data: [4, 2] }];

async function mount(position: string | undefined, direction: 'ltr' | 'rtl' = 'ltr'): Promise<LyraLiteChart> {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart with-legend dir=${direction}
    legend-position=${ifDefined(position)} style="inline-size:640px"
    .labels=${LABELS} .datasets=${DATASETS}></lr-lite-chart>`);
  await waitUntil(() => {
    const plot = el.shadowRoot?.querySelector('svg')?.getBoundingClientRect();
    const legend = el.shadowRoot?.querySelector('[part="legend"]')?.getBoundingClientRect();
    return !!plot && !!legend && plot.width > 0 && plot.height > 0 && legend.width > 0 && legend.height > 0;
  }, 'plot and legend were not laid out', { timeout: 5000 });
  return el;
}

function rects(el: LyraLiteChart): { plot: DOMRect; legend: DOMRect; placement: string | null } {
  return {
    plot: el.shadowRoot!.querySelector('svg')!.getBoundingClientRect(),
    legend: el.shadowRoot!.querySelector('[part="legend"]')!.getBoundingClientRect(),
    placement: el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('data-legend-position'),
  };
}

describe('lr-lite-chart legend position', () => {
  it('places the legend below the plot by default and for an unknown value', async () => {
    for (const position of [undefined, 'sideways', '']) {
      const { plot, legend, placement } = rects(await mount(position));
      expect(placement, String(position)).to.equal('bottom');
      expect(legend.top, String(position)).to.be.at.least(plot.bottom - 1);
    }
  });

  it('places the legend above the plot', async () => {
    const { plot, legend, placement } = rects(await mount('top'));
    expect(placement).to.equal('top');
    expect(legend.bottom).to.be.at.most(plot.top + 1);
  });

  it('resolves start and end against the reading direction', async () => {
    const start = rects(await mount('start'));
    expect(start.placement).to.equal('inline-start');
    expect(start.legend.right).to.be.at.most(start.plot.left + 1);
    const end = rects(await mount('end'));
    expect(end.placement).to.equal('inline-end');
    expect(end.legend.left).to.be.at.least(end.plot.right - 1);
    const mirroredStart = rects(await mount('start', 'rtl'));
    expect(mirroredStart.placement).to.equal('inline-start');
    expect(mirroredStart.legend.left).to.be.at.least(mirroredStart.plot.right - 1);
    const mirroredEnd = rects(await mount('end', 'rtl'));
    expect(mirroredEnd.legend.right).to.be.at.most(mirroredEnd.plot.left + 1);
  });

  it('normalizes an invalid assigned position and leaves the placement unset without a legend', async () => {
    const el = await mount('top');
    el.legendPosition = { x: 1 } as unknown as LyraLiteChart['legendPosition'];
    await el.updateComplete;
    expect(rects(el).placement).to.equal('bottom');
    el.legendPosition = 'end';
    el.withLegend = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('data-legend-position')).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="legend"]').length).to.equal(0);
  });
});
