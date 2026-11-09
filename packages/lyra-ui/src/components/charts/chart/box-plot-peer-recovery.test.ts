import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { Chart } from 'chart.js';
import type { LyraBoxPlot } from './box-plot.js';
import './box-plot.js';

const point = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
const runtime = (element: LyraBoxPlot): Chart | undefined => (element as unknown as { chart?: Chart }).chart;
const click = (chart: Chart): void => {
  chart.options.onClick?.call(chart, { type: 'click', x: 50, y: 50, native: new MouseEvent('click') }, [], chart);
};
const hit = (): ReturnType<Chart['getElementsAtEventForMode']> => [{ datasetIndex: 0, index: 0 }] as ReturnType<Chart['getElementsAtEventForMode']>;

async function mount(): Promise<LyraBoxPlot> {
  const element = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['North']}
    .datasets=${[{ label: 'Sales', data: [point] }]}></lr-box-plot>`);
  await waitUntil(() => runtime(element) !== undefined);
  return element;
}

it('contains native hit-testing failures and accepts the next valid box activation', async () => {
  const element = await mount();
  const chart = runtime(element)!;
  const details: unknown[] = [];
  element.addEventListener('lr-point-activate', event => details.push(event.detail));
  const original = chart.getElementsAtEventForMode;
  try {
    chart.getElementsAtEventForMode = () => { throw new Error('Box hit testing unavailable'); };
    expect(() => click(chart)).not.to.throw();
    expect(details).to.deep.equal([]);
    chart.getElementsAtEventForMode = hit;
    click(chart);
    expect(details).to.deep.equal([{ datasetIndex: 0, index: 0, label: 'North', value: point }]);
  } finally { chart.getElementsAtEventForMode = original; }
});

for (const reconnect of [false, true]) for (const phase of ['hit testing', 'datasetIndex', 'index'] as const) {
  it(`rejects a box hit that ${reconnect ? 'reconnects' : 'disconnects'} its owner during ${phase}`, async () => {
    const element = await mount();
    const parent = element.parentNode!;
    const chart = runtime(element)!;
    const activations: string[] = [];
    element.addEventListener('lr-datum-activate', () => activations.push('datum'));
    element.addEventListener('lr-point-activate', () => activations.push('point'));
    const original = chart.getElementsAtEventForMode;
    let retired = false;
    const retire = (): void => {
      if (retired) return;
      retired = true;
      element.remove();
      if (reconnect) parent.append(element);
    };
    chart.getElementsAtEventForMode = () => {
      const result = hit();
      if (phase === 'hit testing') retire();
      else Object.defineProperty(result[0], phase, { get() { retire(); return 0; } });
      return result;
    };
    try {
      click(chart);
      expect(retired).to.equal(true);
      expect(activations).to.deep.equal([]);
    } finally { chart.getElementsAtEventForMode = original; }
    if (!reconnect) parent.append(element);
    await waitUntil(() => runtime(element) !== undefined && runtime(element) !== chart);
    const current = runtime(element)!;
    const currentHitTest = current.getElementsAtEventForMode;
    current.getElementsAtEventForMode = hit;
    try {
      click(current);
      expect(activations).to.deep.equal(['datum', 'point']);
    } finally { current.getElementsAtEventForMode = currentHitTest; }
  });
}

it('ignores a retained callback from a retired box chart before invoking its native hit test', async () => {
  const element = await mount();
  const chart = runtime(element)!;
  const callback = chart.options.onClick;
  const parent = element.parentNode!;
  element.remove(); parent.append(element);
  await waitUntil(() => runtime(element) !== undefined && runtime(element) !== chart);
  let calls = 0;
  const activations: unknown[] = [];
  element.addEventListener('lr-datum-activate', event => activations.push(event.detail));
  const original = chart.getElementsAtEventForMode;
  chart.getElementsAtEventForMode = () => { calls++; return hit(); };
  try {
    callback?.call(chart, { type: 'click', x: 50, y: 50, native: new MouseEvent('click') }, [], chart);
    expect(calls).to.equal(0);
    expect(activations).to.deep.equal([]);
  } finally { chart.getElementsAtEventForMode = original; }
});
