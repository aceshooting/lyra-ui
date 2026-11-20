import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-lite-chart.js';
import '../../lr-box-plot.js';
import '../../lr-chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';

const headers = (el: Element, scope: 'col' | 'row'): string[] =>
  Array.from(el.shadowRoot!.querySelectorAll(`table th[scope="${scope}"]`)).map((th) => th.textContent?.trim() ?? '');

describe('blank caller labels in accessible names and headers', () => {
  it('lr-box-plot names its canvas from nonblank series labels and never renders an empty row header', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['', 'b']}
      .datasets=${[{ label: '', data: [box, box] }, { label: 'Sales', data: [box, box] }]}></lr-box-plot>`);
    await waitUntil(() => el.shadowRoot!.querySelector('canvas') !== null, 'canvas', { timeout: 5000 });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).to.equal('Sales');
    expect(headers(el, 'row').filter((text) => text === '')).to.deep.equal([]);
  });

  it('lr-lite-chart names its plot from nonblank series labels and never renders an empty header', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['', 'b']}
      .datasets=${[{ label: '', data: [1, 2] }, { label: 'Sales', data: [3, 4] }]}></lr-lite-chart>`);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg[role="group"]')!.getAttribute('aria-label')).to.equal('Sales');
    expect(headers(el, 'col').filter((text) => text === '')).to.deep.equal([]);
    expect(headers(el, 'row').filter((text) => text === '')).to.deep.equal([]);
  });

  it('names legend toggles, row headers and tables with the fallback for whitespace-only labels', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const plot = await fixture<LyraBoxPlot>(html`<lr-box-plot with-legend .labels=${['   ', 'b']}
      .datasets=${[{ label: '   ', data: [box, box] }, { label: 'Sales', data: [box, box] }]}></lr-box-plot>`);
    await waitUntil(() => plot.shadowRoot!.querySelector('canvas') !== null, 'canvas', { timeout: 5000 });
    await plot.updateComplete;
    expect(headers(plot, 'row').filter((text) => text.trim() === '')).to.deep.equal([]);
    for (const button of plot.shadowRoot!.querySelectorAll('[aria-pressed]')) {
      expect(button.textContent!.trim()).to.not.equal('');
    }
    const lite = await fixture<LyraLiteChart>(html`<lr-lite-chart .labels=${['   ', 'b']}
      .datasets=${[{ label: '   ', data: [1, 2] }, { label: 'Sales', data: [3, 4] }]}></lr-lite-chart>`);
    await lite.updateComplete;
    expect(headers(lite, 'col').filter((text) => text.trim() === '')).to.deep.equal([]);
    expect(headers(lite, 'row').filter((text) => text.trim() === '')).to.deep.equal([]);
    const chart = await fixture<LyraChart>(html`<lr-chart type="bar" .labels=${['   ', 'b']}
      .datasets=${[{ label: '   ', data: [1, 2] }, { label: 'Sales', data: [3, 4] }]}></lr-chart>`);
    await waitUntil(() => chart.shadowRoot!.querySelector('[part~="legend-item"]') !== null, 'legend', { timeout: 5000 });
    for (const item of chart.shadowRoot!.querySelectorAll('[part~="legend-item"]')) {
      expect(item.textContent!.trim()).to.not.equal('');
    }
  });
});
