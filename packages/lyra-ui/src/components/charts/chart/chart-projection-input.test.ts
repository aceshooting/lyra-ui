import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import { projectChartSeries, type LyraChart } from './chart.class.js';

describe('lr-chart annotation entries', () => {
  it('describes only well-formed annotations: a known axis, a text label and a known tone', async () => {
    const el = await fixture<LyraChart>(html`<lr-chart></lr-chart>`);
    el.labels = ['a', 'b'];
    el.datasets = [{ label: 'series', data: [1, 2] }];
    el.annotations = [
      null, 'text', 3, [],
      { axis: 'z', value: 1, label: 'Unknown axis' },
      { axis: 'y', value: 2, label: 7 },
      { axis: 'y', value: 3, label: 'Unknown tone', tone: 'fuchsia' },
      { axis: 'y', value: 4, label: 'Non-text tone', tone: 5 },
      { axis: 'y', value: 5, label: 'Valid threshold', tone: 'danger' },
      { from: 9, to: 2, label: 'Valid band' },
    ] as unknown as LyraChart['annotations'];
    await el.updateComplete;
    const description = () => el.shadowRoot!.querySelector('[part="description"]')?.textContent ?? '';
    await waitUntil(() => description().includes('Valid threshold'), 'the accessible description never listed the annotation', { timeout: 5000 });
    expect(description()).to.contain('Valid band');
    for (const dropped of ['Unknown axis', 'Unknown tone', 'Non-text tone']) {
      expect(description(), dropped).not.to.contain(dropped);
    }
  });
});

describe('chart series projection', () => {
  it('declines a value that is not a record and reuses a series it already projected', () => {
    for (const value of [null, undefined, 5, 'series', [1, 2]]) {
      expect(projectChartSeries(value), String(value)).to.equal(undefined);
    }
    const projected = projectChartSeries({ label: 'Load', data: [1, 2, 3] });
    expect(projected).to.include({ label: 'Load' });
    expect(projectChartSeries(projected) === projected).to.equal(true);
  });
});
