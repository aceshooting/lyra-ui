import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './box-plot.js';
import './lite-chart.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';

const rect = (el: Element, part: string): DOMRect =>
  el.shadowRoot!.querySelector(`[part="${part}"]`)!.getBoundingClientRect();

describe('data-table toggle placement', () => {
  it('lr-box-plot keeps the toggle above its expanded table, below legend and notice', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot with-legend data-table-toggle
      .labels=${Array.from({ length: 1_200 }, (_, index) => `c${index}`)}
      .datasets=${[{ label: 'A', data: Array.from({ length: 1_200 }, () => ({ ...box })) }]}></lr-box-plot>`);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="data-table-toggle"]') !== null, 'toggle');
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="data-table-toggle"]')!;
    toggle.click();
    await el.updateComplete;
    expect(getComputedStyle(toggle).gridRowStart).to.equal('table-toggle');
    expect(rect(el, 'data-table-toggle').bottom).to.be.at.most(rect(el, 'data-table').top + 1);
    expect(rect(el, 'data-table-toggle').top).to.be.at.least(rect(el, 'legend').bottom - 1);
  });

  it('lr-lite-chart keeps the toggle between its legend and its table', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart with-legend data-table-toggle
      .labels=${['a', 'b']} .datasets=${[{ label: 'A', data: [1, 2] }, { label: 'B', data: [3, 4] }]}>
      </lr-lite-chart>`);
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="data-table-toggle"]')!;
    toggle.click();
    await el.updateComplete;
    expect(getComputedStyle(toggle).gridRowStart).to.equal('table-toggle');
    expect(rect(el, 'data-table-toggle').top).to.be.at.least(rect(el, 'legend').bottom - 1);
    expect(rect(el, 'data-table-toggle').bottom).to.be.at.most(rect(el, 'data-table').top + 1);
  });

  it('lr-lite-chart without a toggle keeps its rows unchanged', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart with-legend
      .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lr-lite-chart>`);
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(getComputedStyle(base).gridTemplateAreas).to.not.contain('table-toggle');
  });

  for (const tag of ['lr-box-plot', 'lr-lite-chart'] as const) {
    it(`${tag} toggle hover falls back to the shared chart toggle token`, async () => {
      const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
      const host = await fixture<HTMLElement>(html`<div style="--lr-chart-data-table-toggle-hover-bg: rgb(1, 2, 3)">
        ${tag === 'lr-box-plot'
          ? html`<lr-box-plot data-table-toggle .labels=${['a']} .datasets=${[{ label: 'A', data: [box] }]}></lr-box-plot>`
          : html`<lr-lite-chart data-table-toggle .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lr-lite-chart>`}
      </div>`);
      const el = host.querySelector(tag) as HTMLElement & { updateComplete: Promise<boolean> };
      await waitUntil(() => el.shadowRoot!.querySelector('[part="data-table-toggle"]') !== null, 'toggle');
      const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="data-table-toggle"]')!;
      try {
        await hoverUntilMatched(toggle, `hover the ${tag} toggle`);
        await waitUntil(() => getComputedStyle(toggle).backgroundColor === 'rgb(1, 2, 3)', 'shared hover token');
      } finally {
        await resetMouse();
      }
    });
  }
});
