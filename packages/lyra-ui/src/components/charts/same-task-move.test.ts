import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../lr-chart.js';
import '../lr-box-plot.js';
import '../lr-lite-chart.js';
import '../lr-chart-3d.js';
import type { LyraLiteChart } from './chart/lite-chart.class.js';
import type { LyraPreparedSeriesData } from '../../utilities/data-preparation.js';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 50));
type Drawn = HTMLElement & { chart?: object; updateComplete: Promise<boolean> };

async function moveThenRemove(el: HTMLElement, instance: () => unknown) {
  const host = el.parentElement!;
  const target = host.appendChild(document.createElement('section'));
  const before = instance();
  target.append(el);
  await settle();
  const kept = instance() === before;
  el.remove();
  await settle();
  const released = instance() !== before;
  host.append(el);
  return [kept, released];
}

for (const tag of ['lr-chart', 'lr-box-plot']) {
  it(`${tag} keeps its Chart.js instance across a same-task move and releases it on a real disconnect`, async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:400px"></div>`);
    const el = document.createElement(tag) as Drawn;
    if (tag === 'lr-chart') el.setAttribute('without-animation', '');
    Object.assign(el, tag === 'lr-chart'
      ? { type: 'bar', labels: ['A', 'B'], datasets: [{ label: 'Orders', data: [1, 2] }] }
      : { labels: ['A'], datasets: [{ label: 'Orders', data: [[1, 2, 3, 4, 5]] }] });
    host.append(el);
    await waitUntil(() => el.chart != null, `${tag} never drew`, { timeout: 5000 });
    expect(await moveThenRemove(el, () => el.chart)).to.deep.equal([true, true]);
    await waitUntil(() => el.chart != null, `${tag} did not redraw after reconnecting`, { timeout: 5000 });
  });
}

it('lr-lite-chart keeps a revealed source point across a same-task move and drops it on a real disconnect', async () => {
  const prepared: LyraPreparedSeriesData = { kind: 'series', revision: 'r', getPoint: (ref) => ({ x: ref.sourceIndex, y: 5 }), series: [{
    id: 's', label: 'Signal', counts: { sourceCount: 1000, validCount: 1000, invalidCount: 0 }, xDomain: { min: 0, max: 999 }, yDomain: { min: 0, max: 9 },
    samples: [0, 999].map((index, ordinal) => ({ x: index, y: ordinal * 9, sourceIndex: index, breakBefore: ordinal === 0 })),
  }] };
  const host = await fixture<HTMLDivElement>(html`<div><lr-lite-chart type="line" style="width:600px" .preparedData=${prepared}></lr-lite-chart></div>`);
  const el = host.querySelector<LyraLiteChart & { revealSourcePoint(ref: { seriesId: string; sourceIndex: number }): Promise<boolean> }>('lr-lite-chart')!;
  await waitUntil(() => (el.shadowRoot?.querySelectorAll('[part="point"]').length ?? 0) === 2, 'prepared marks missing');
  expect(await el.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(true);
  await el.updateComplete;
  const count = () => el.shadowRoot!.querySelectorAll('[part="point"]').length;
  expect(count()).to.equal(3);
  host.appendChild(document.createElement('section')).append(el);
  await settle(); await el.updateComplete;
  expect(count(), 'a same-task move keeps the revealed point').to.equal(3);
  el.remove(); await settle(); host.append(el);
  await el.updateComplete;
  await waitUntil(() => count() === 2, 'a real disconnect drops the revealed point');
});

it('lr-chart-3d keeps its renderer generation across a same-task move and retires it on a real disconnect', async () => {
  const host = await fixture<HTMLDivElement>(html`<div><lr-chart-3d .data=${{ ids: ['a', 'b'], x: Float32Array.of(0, 1), y: Float32Array.of(1, 2), z: Float32Array.of(2, 3) }}></lr-chart-3d></div>`);
  const el = host.querySelector('lr-chart-3d')! as HTMLElement & { updateComplete: Promise<boolean> };
  await el.updateComplete;
  const generation = () => (el as unknown as { renderer: { generation: number } }).renderer.generation;
  expect(await moveThenRemove(el, generation)).to.deep.equal([true, true]);
});
