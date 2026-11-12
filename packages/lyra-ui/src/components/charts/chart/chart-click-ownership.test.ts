import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { Chart } from 'chart.js';
import type { LyraChart } from './chart.class.js';
import './chart.js';

function click(chart: Chart): void {
  chart.options.onClick?.call(chart, { type: 'click', x: 50, y: 50, native: new MouseEvent('click') }, [], chart);
}

for (const replacement of ['labels', 'datasets', 'configuration', 'type'] as const) {
  for (const phase of ['hit testing', 'array admission', 'array revalidation', 'entry admission', 'index admission'] as const) {
    it(`discards a click whose ${replacement} change during ${phase} and accepts a fresh click`, async () => {
      const element = await fixture<LyraChart>(html`<lr-chart without-animation with-data-table
        style="inline-size:500px;block-size:240px" .labels=${['Original']}
        .datasets=${[{ label: 'Series', data: [4] }]}></lr-chart>`);
      await waitUntil(() => element.chart !== undefined, 'initial chart is drawn');
      const chart = element.chart as unknown as Chart;
      const original = chart.getElementsAtEventForMode;
      const activations: unknown[] = [];
      const points: unknown[] = [];
      element.addEventListener('lr-datum-activate', event => activations.push(event.detail));
      element.addEventListener('lr-point-activate', event => points.push(event.detail));
      let replaced = false;
      const replace = (): void => {
        if (replaced) return;
        replaced = true;
        if (replacement === 'labels') element.labels = ['Replacement'];
        else if (replacement === 'datasets') element.datasets = [{ label: 'Series', data: [9] }];
        else if (replacement === 'configuration') element.config = { data: { labels: ['Replacement'], datasets: [{ label: 'Series', data: [9] }] } };
        else element.type = 'line';
      };
      const hit = new Proxy({ datasetIndex: 0, index: 0 }, {
        getOwnPropertyDescriptor(target, key) {
          if (phase === 'index admission' && key === 'index') replace();
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      let lengthReads = 0;
      const hits = new Proxy([hit], {
        getOwnPropertyDescriptor(target, key) {
          if (key === 'length') lengthReads++;
          if ((phase === 'array admission' && key === 'length') || (phase === 'entry admission' && key === '0')) replace();
          if (phase === 'array revalidation' && key === 'length' && lengthReads === 2) replace();
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
      chart.getElementsAtEventForMode = () => {
        if (phase === 'hit testing') replace();
        return hits as ReturnType<Chart['getElementsAtEventForMode']>;
      };
      try {
        expect(() => click(chart)).not.to.throw();
        expect(replaced).to.equal(true);
        expect(activations).to.deep.equal([]);
        expect(points).to.deep.equal([]);
      } finally { chart.getElementsAtEventForMode = original; }

      await element.updateComplete;
      const value = replacement === 'datasets' || replacement === 'configuration' ? 9 : 4;
      const label = replacement === 'labels' || replacement === 'configuration' ? 'Replacement' : 'Original';
      await waitUntil(() => {
        const current = element.chart as unknown as Chart | undefined;
        return current?.data.datasets[0]?.data[0] === value && current.data.labels?.[0] === label &&
          (replacement !== 'type' || current !== chart);
      }, 'replacement chart is drawn');
      const current = element.chart as unknown as Chart;
      const query = current.getElementsAtEventForMode;
      current.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 0 }] as ReturnType<Chart['getElementsAtEventForMode']>;
      try {
        click(current);
        const detail = { datasetIndex: 0, index: 0, label, value };
        expect(activations).to.deep.equal([{ ...detail, kind: replacement === 'type' ? 'segment' : 'bar' }]);
        expect(points).to.deep.equal([detail]);
        expect(element.exportData('csv')).to.include(`${label},${value}`);
      } finally { current.getElementsAtEventForMode = query; }
    });
  }
}

it('preserves a valid click when native hit testing changes only chart presentation', async () => {
  const element = await fixture<LyraChart>(html`<lr-chart without-animation .labels=${['Original']}
    .datasets=${[{ label: 'Series', data: [4] }]}></lr-chart>`);
  await waitUntil(() => element.chart !== undefined, 'initial chart is drawn');
  const chart = element.chart as unknown as Chart;
  const query = chart.getElementsAtEventForMode;
  const activations: unknown[] = [];
  element.addEventListener('lr-datum-activate', event => activations.push(event.detail));
  chart.getElementsAtEventForMode = () => {
    element.withDataTable = true;
    element.height = '16rem';
    return [{ datasetIndex: 0, index: 0 }] as ReturnType<Chart['getElementsAtEventForMode']>;
  };
  try {
    click(chart);
    expect(activations).to.deep.equal([{ datasetIndex: 0, index: 0, label: 'Original', value: 4, kind: 'bar' }]);
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('table')?.textContent).to.include('Original');
    expect(element.exportData('csv')).to.include('Original,4');
  } finally { chart.getElementsAtEventForMode = query; }
});
