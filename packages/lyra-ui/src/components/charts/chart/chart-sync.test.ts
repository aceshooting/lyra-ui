import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './chart.js';
import './lite-chart.js';
import './histogram.js';
import type { LyraChart } from './chart.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import type { LyraHistogram } from './histogram.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, hoverUntilMatched } from '../../../../test/wtr-mouse.js';

type SyncChart = LyraChart | LyraLiteChart;
function tooltip(chart: SyncChart): string {
  if (chart.localName === 'lr-lite-chart') return chart.shadowRoot!.querySelector('[part="sync-tooltip"]')?.textContent ?? '';
  const runtime = (chart as LyraChart).chart as unknown as {
    options: { plugins: { tooltip: { enabled: boolean } } };
    tooltip?: { title?: string[]; body?: { lines?: string[] }[]; footer?: string[]; getActiveElements(): unknown[] };
  } | undefined;
  if (!runtime?.options.plugins.tooltip.enabled || !runtime.tooltip?.getActiveElements().length) return '';
  return [...(runtime.tooltip.title ?? []), ...(runtime.tooltip.body ?? []).flatMap((body) => body.lines ?? []), ...(runtime.tooltip.footer ?? [])].join('\n');
}
function crosshair(chart: SyncChart): boolean { return !!chart.shadowRoot!.querySelector('[part="sync-crosshair"]'); }
async function ready(chart: SyncChart): Promise<void> {
  await waitUntil(() => chart.shadowRoot!.querySelectorAll('[part="bar"], [part="point"], canvas').length > 0);
  if (chart.localName !== 'lr-lite-chart') await waitUntil(() => !!(chart as LyraChart).chart);
  await chart.updateComplete;
}
async function hoverMark(chart: LyraLiteChart, index: number): Promise<void> {
  const mark = chart.shadowRoot!.querySelector<SVGGraphicsElement>(`[data-index="${index}"]`)!;
  await hoverUntilMatched(mark, 'hover chart mark');
}

describe('chart synchronization', () => {
  afterEach(async () => { await resetMouse(); });

  it('renders inherited histogram synchronization with a styled crosshair inside its plot', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-histogram height="8rem" bins="2" sync-group="histogram" without-animation
        style="--lr-chart-sync-crosshair-width:3px;--lr-chart-sync-crosshair-color:rgb(10,20,30)"
        .values=${[0, 1, 2, 3]}></lr-histogram>
      <lr-lite-chart height="8rem" sync-group="histogram" .datasets=${[{ label: 'Peer', data: [11, 22] }]}></lr-lite-chart>
    </div>`);
    const histogram = host.querySelector<LyraHistogram>('lr-histogram')!;
    const peer = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await ready(histogram);
    peer.labels = histogram.labels;
    await ready(peer);
    const canvas = histogram.shadowRoot!.querySelector('canvas')!;
    await focusByKeyboard(canvas);
    await waitUntil(() => tooltip(peer).includes('11'));
    const line = histogram.shadowRoot!.querySelector<HTMLElement>('[part="sync-crosshair"]')!;
    const style = getComputedStyle(line);
    expect(style.position).to.equal('absolute');
    expect(style.borderInlineStartStyle).to.equal('solid');
    expect(style.borderInlineStartWidth).to.equal('3px');
    expect(style.borderInlineStartColor).to.equal('rgb(10, 20, 30)');
    expect(Math.abs(line.getBoundingClientRect().height - histogram.chartArea!.height)).to.be.lessThan(1);
    expect(Math.abs(line.getBoundingClientRect().top - canvas.getBoundingClientRect().top - histogram.chartArea!.top)).to.be.lessThan(1);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !crosshair(peer));
    await hoverMark(peer, 1);
    await waitUntil(() => crosshair(histogram));
    expect(tooltip(histogram)).to.contain(histogram.labels[1]);
  });

  it('clears histogram owner synchronization when derived bucket inputs change', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-histogram height="8rem" bins="2" sync-group="buckets" without-animation .values=${[0, 1, 2, 3]}></lr-histogram>
      <lr-lite-chart height="8rem" sync-group="buckets" .datasets=${[{ label: 'Peer', data: [11, 22] }]}></lr-lite-chart>
    </div>`);
    const histogram = host.querySelector<LyraHistogram>('lr-histogram')!;
    const peer = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await ready(histogram); peer.labels = histogram.labels; await ready(peer);
    await focusByKeyboard(histogram.shadowRoot!.querySelector('canvas')!);
    await waitUntil(() => crosshair(peer));
    histogram.values = [100, 101, 102, 103];
    await histogram.updateComplete;
    await waitUntil(() => !crosshair(peer), 'derived histogram data clears its owned category');
    expect(tooltip(peer)).to.equal('');
  });

  it('shows peer values and a crosshair at its reordered category across lite renderers', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group=" metrics " .labels=${['A', 'B']} .datasets=${[{ label: 'Source', data: [2, 8] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" type="line" sync-group="metrics" .labels=${['B', 'A']} .datasets=${[{ label: 'Peer', data: [70, 30] }, { label: 'Other', data: [40, 20] }]}></lr-lite-chart>
    </div>`);
    const [source, peer] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    await ready(source!); await ready(peer!);
    await hoverMark(source!, 1);
    await waitUntil(() => crosshair(peer!), 'peer crosshair');
    expect(tooltip(peer!)).to.contain('Peer'); expect(tooltip(peer!)).to.contain('70');
    expect(tooltip(peer!)).to.contain('Other'); expect(tooltip(peer!)).to.contain('40');
    const line = peer!.shadowRoot!.querySelector<HTMLElement>('[part="sync-crosshair"]')!;
    const point = peer!.shadowRoot!.querySelector<SVGGraphicsElement>('[data-index="0"]')!;
    expect(Math.abs(line.getBoundingClientRect().x - point.getBoundingClientRect().x - point.getBoundingClientRect().width / 2)).to.be.lessThan(3);
    const axisLabels = [...peer!.shadowRoot!.querySelectorAll('[part="axis-label"]')];
    const lowestLabelTop = Math.max(...axisLabels.map((label) => label.getBoundingClientRect().top));
    expect(line.getBoundingClientRect().bottom).to.be.lessThan(lowestLabelTop);
  });

  it('synchronizes keyboard navigation between core and lite without peer activation or focus', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-chart height="8rem" sync-group="keys" .labels=${['A', 'B']} .datasets=${[{ label: 'Core', data: [2, 8] }]}></lr-chart>
      <lr-lite-chart height="8rem" sync-group="keys" .labels=${['B', 'A']} .datasets=${[{ label: 'Lite', data: [70, 30] }]}></lr-lite-chart>
    </div>`);
    const core = host.querySelector<LyraChart>('lr-chart')!;
    const lite = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await ready(core); await ready(lite);
    let activated = 0; lite.addEventListener('lr-point-activate', () => activated++);
    const canvas = core.shadowRoot!.querySelector('canvas')!;
    await focusByKeyboard(canvas);
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => tooltip(lite).includes('70'));
    expect(crosshair(core)).to.equal(true);
    expect(activated).to.equal(0); expect(lite.selectedIndices).to.deep.equal([]);
    expect(core.shadowRoot!.activeElement === canvas).to.equal(true);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !crosshair(lite));
  });

  it('preserves ungrouped SVG titles and does not publish between ungrouped charts', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" .labels=${['A']} .datasets=${[{ label: 'S', data: [2] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" .labels=${['A']} .datasets=${[{ label: 'P', data: [4] }]}></lr-lite-chart>
    </div>`);
    const [source, peer] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    await ready(source!); await ready(peer!); await hoverMark(source!, 0);
    expect(crosshair(source!)).to.equal(false); expect(crosshair(peer!)).to.equal(false);
    expect(source!.shadowRoot!.querySelectorAll('[part="bar"] title').length).to.equal(1);
  });

  it('synchronizes real pointer interaction core to core and lite to core with recipient formatting', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-chart height="8rem" sync-group="all" .config=${{ options: { animation: false } }} .labels=${['A', 'B']} .datasets=${[{ label: 'Source', data: [2, 8] }]}></lr-chart>
      <lr-chart height="8rem" type="line" sync-group="all" .config=${{ options: { animation: false } }} .labels=${['B', 'A']} .datasets=${[{ label: 'Peer', data: [70, 30] }]}
        .valueFormatter=${(value: number) => `unit ${value}`}></lr-chart>
      <lr-lite-chart height="8rem" sync-group="all" .labels=${['A', 'B']} .datasets=${[{ label: 'Lite', data: [4, 9] }]}></lr-lite-chart>
    </div>`);
    const [source, peer] = [...host.querySelectorAll<LyraChart>('lr-chart')];
    const lite = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await ready(source!); await ready(peer!); await ready(lite);
    const meta = source!.chart!.getDatasetMeta!(0) as unknown as { data: { x: number; y: number; base: number }[] };
    const point = meta.data[1]!;
    const canvas = source!.shadowRoot!.querySelector('canvas')!;
    await hoverUntilMatched(canvas, 'hover core chart mark', (bounds) => [bounds.left + point.x, bounds.top + (point.y + point.base) / 2]);
    await waitUntil(() => tooltip(peer!).includes('unit 70'));
    expect(tooltip(peer!)).to.contain('Peer');
    await hoverMark(lite, 0);
    await waitUntil(() => tooltip(peer!).includes('unit 30'));
    expect(tooltip(source!)).to.contain('2');
  });

  it('honors raw effective data, tooltip callbacks/filter and suppression including title-only tooltips', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="raw" .labels=${['B']} .datasets=${[{ label: 'Source', data: [4] }]}></lr-lite-chart>
      <lr-chart height="8rem" sync-group="raw" .labels=${['ignored']} .datasets=${[{ label: 'Ignored', data: [99] }]}
        .config=${{ type: 'line', data: { labels: ['B'], datasets: [{ label: 'Raw', data: [12] }, { label: 'Filtered', data: [33] }] },
          options: { plugins: { tooltip: { filter: (item: { datasetIndex: number }) => item.datasetIndex === 0,
            callbacks: { title: () => ['First title', 'Second title'], label: () => [], footer: () => ['Footer'] } } } } }}></lr-chart>
      <lr-chart height="8rem" sync-group="raw" without-tooltip .labels=${['B']} .datasets=${[{ label: 'Suppressed', data: [5] }]}></lr-chart>
      <lr-chart height="8rem" sync-group="raw" .labels=${['B']} .datasets=${[{ label: 'Configured', data: [6] }]}
        .config=${{ options: { plugins: { tooltip: { enabled: false } } } }}></lr-chart>
    </div>`);
    const lite = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    const [raw, suppressed, configured] = [...host.querySelectorAll<LyraChart>('lr-chart')];
    for (const chart of [lite, raw!, suppressed!, configured!]) await ready(chart);
    await hoverMark(lite, 0);
    await waitUntil(() => crosshair(raw!));
    expect(tooltip(raw!)).to.contain('First title'); expect(tooltip(raw!)).to.contain('Second title'); expect(tooltip(raw!)).to.contain('Footer');
    expect(tooltip(raw!)).to.not.contain('Ignored'); expect(tooltip(raw!)).to.not.contain('Filtered');
    const model = raw!.chart as unknown as { tooltip: { title: string[] } };
    expect(model.tooltip.title).to.deep.equal(['First title', 'Second title']);
    expect(crosshair(suppressed!)).to.equal(true); expect(tooltip(suppressed!)).to.equal('');
    expect(crosshair(configured!)).to.equal(true); expect(tooltip(configured!)).to.equal('');
  });

  it('uses exact labels, first eligible duplicates and retains the source duplicate', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="duplicates" .labels=${['Same', 'Same', '']} .datasets=${[{ label: 'S', data: [1, 9, 8] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="duplicates" skip-zero .labels=${['Same', 'Same', 'same']} .datasets=${[{ label: 'P', data: [0, 7, 4] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="duplicates" .labels=${['same']} .datasets=${[{ label: 'Case', data: [2] }]}></lr-lite-chart>
    </div>`);
    const [source, peer, mismatch] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    for (const chart of [source!, peer!, mismatch!]) await ready(chart);
    await hoverMark(source!, 1);
    await waitUntil(() => crosshair(peer!));
    expect(tooltip(source!)).to.contain('9'); expect(tooltip(peer!)).to.contain('7');
    expect(crosshair(mismatch!)).to.equal(false);
    expect(source!.shadowRoot!.querySelectorAll('[part="bar"] title').length).to.equal(0);
    await hoverMark(source!, 2);
    await waitUntil(() => !crosshair(peer!));
  });

  it('isolates group names and clears missing/nonfinite categories', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="G" .labels=${['A', 'B']} .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="G" .labels=${['A', 'B']} .datasets=${[{ label: 'P', data: [4, null] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="g" .labels=${['A', 'B']} .datasets=${[{ label: 'O', data: [7, 8] }]}></lr-lite-chart>
    </div>`);
    const [source, peer, other] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    for (const chart of [source!, peer!, other!]) await ready(chart);
    await hoverMark(source!, 0); await waitUntil(() => crosshair(peer!));
    expect(crosshair(other!)).to.equal(false);
    await hoverMark(source!, 1); await waitUntil(() => !crosshair(peer!));
  });

  it('does not admit horizontal, noncategorical or unsupported effective core configurations', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="types" .labels=${['A']} .datasets=${[{ label: 'S', data: [1] }]}></lr-lite-chart>
      <lr-chart height="8rem" sync-group="types" index-axis="y" .labels=${['A']} .datasets=${[{ label: 'H', data: [2] }]}></lr-chart>
      <lr-chart height="8rem" sync-group="types" .config=${{ type: 'pie', data: { labels: ['A'], datasets: [{ label: 'Pie', data: [3] }] } }}></lr-chart>
      <lr-chart height="8rem" sync-group="types" .labels=${['A']} .datasets=${[{ label: 'Linear', data: [4] }]}
        .config=${{ options: { scales: { x: { type: 'linear' } } } }}></lr-chart>
    </div>`);
    const source = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    const peers = [...host.querySelectorAll<LyraChart>('lr-chart')];
    await ready(source); for (const peer of peers) await ready(peer);
    await hoverMark(source, 0); await waitUntil(() => crosshair(source));
    expect(peers.map(crosshair)).to.deep.equal([false, false, false]);
  });

  it('clears owner dataset replacement and immediately recomputes recipient data', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-chart height="8rem" sync-group="data" .labels=${['A']} .datasets=${[{ label: 'Owner', data: [1] }]}></lr-chart>
      <lr-lite-chart height="8rem" sync-group="data" .labels=${['A']} .datasets=${[{ label: 'P', data: [4] }]}></lr-lite-chart>
    </div>`);
    const owner = host.querySelector<LyraChart>('lr-chart')!; const peer = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await ready(owner); await ready(peer);
    await focusByKeyboard(owner.shadowRoot!.querySelector('canvas')!);
    await waitUntil(() => tooltip(peer).includes('4'));
    peer.datasets = [{ label: 'Updated', data: [17] }]; await peer.updateComplete;
    await waitUntil(() => tooltip(peer).includes('17'));
    owner.datasets = [{ label: 'New owner', data: [9] }]; await owner.updateComplete;
    await waitUntil(() => !crosshair(peer));
  });

  it('clears when keyboard navigation reaches a missing category label', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-chart height="8rem" sync-group="missing" .labels=${['A']} .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-chart>
      <lr-lite-chart height="8rem" sync-group="missing" .labels=${['A']} .datasets=${[{ label: 'P', data: [7] }]}></lr-lite-chart>
    </div>`);
    const owner = host.querySelector<LyraChart>('lr-chart')!; const peer = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await ready(owner); await ready(peer); await focusByKeyboard(owner.shadowRoot!.querySelector('canvas')!);
    await waitUntil(() => crosshair(peer)); await sendKeys({ press: 'End' }); await waitUntil(() => !crosshair(peer));
  });

  it('filters hidden core datasets and clears owner state for ineligible keyboard categories', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-chart height="8rem" sync-group="hidden" .labels=${['A', 'B']} .hiddenDatasets=${[1]}
        .datasets=${[{ label: 'Visible', data: [1, null] }, { label: 'Hidden', data: [4, 9] }]}></lr-chart>
      <lr-lite-chart height="8rem" sync-group="hidden" .labels=${['A', 'B']} .datasets=${[{ label: 'P', data: [7, 8] }]}></lr-lite-chart>
    </div>`);
    const owner = host.querySelector<LyraChart>('lr-chart')!; const peer = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await ready(owner); await ready(peer); await focusByKeyboard(owner.shadowRoot!.querySelector('canvas')!);
    await waitUntil(() => tooltip(peer).includes('7'));
    expect(tooltip(owner)).to.not.contain('Hidden');
    await sendKeys({ press: 'End' }); await waitUntil(() => !crosshair(peer));
  });

  it('clears on group removal, restores native titles and resets remote Chart.js active tooltip', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="remove" .labels=${['A']} .datasets=${[{ label: 'Owner', data: [1] }]}></lr-lite-chart>
      <lr-chart height="8rem" sync-group="remove" .labels=${['A']} .datasets=${[{ label: 'P', data: [4] }]}></lr-chart>
    </div>`);
    const owner = host.querySelector<LyraLiteChart>('lr-lite-chart')!; const peer = host.querySelector<LyraChart>('lr-chart')!;
    await ready(owner); await ready(peer); await hoverMark(owner, 0); await waitUntil(() => crosshair(peer));
    peer.removeAttribute('sync-group'); await peer.updateComplete;
    const runtime = peer.chart as unknown as { tooltip: { getActiveElements(): unknown[] } };
    expect(crosshair(peer)).to.equal(false); expect(runtime.tooltip.getActiveElements().length).to.equal(0);
    owner.removeAttribute('sync-group'); await owner.updateComplete;
    expect(crosshair(owner)).to.equal(false); expect(owner.shadowRoot!.querySelectorAll('[part="bar"] title').length).to.equal(1);
  });

  it('preserves a newer owner against stale leaves and clears pointer cancellation', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="owner" .labels=${['A']} .datasets=${[{ label: 'First', data: [1] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="owner" .labels=${['A']} .datasets=${[{ label: 'Second', data: [2] }]}></lr-lite-chart>
    </div>`);
    const [first, second] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    await ready(first!); await ready(second!); await hoverMark(first!, 0); await hoverMark(second!, 0);
    first!.dispatchEvent(new PointerEvent('pointerleave')); await first!.updateComplete;
    expect(crosshair(second!)).to.equal(true);
    second!.dispatchEvent(new PointerEvent('pointercancel')); expect(crosshair(first!)).to.equal(false);
  });

  it('clears when keyboard focus leaves marks for same-chart chrome while marks remain navigable', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="blur" data-table-toggle .labels=${['A', 'B']} .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="blur" .labels=${['A', 'B']} .datasets=${[{ label: 'P', data: [4, 5] }]}></lr-lite-chart>
    </div>`);
    const [owner, peer] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    await ready(owner!); await ready(peer!);
    await focusByKeyboard(owner!.shadowRoot!.querySelector('[data-mark-index="0"]') as unknown as HTMLElement);
    await sendKeys({ press: 'ArrowRight' }); await waitUntil(() => tooltip(peer!).includes('5'));
    await sendKeys({ press: 'Tab' }); await waitUntil(() => !crosshair(peer!));
  });

  it('joins across arbitrary shadow roots and clears scrolling inside a shadow ancestor', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px"><div id="left"></div><div id="right"></div></div>`);
    const left = host.querySelector('#left')!.attachShadow({ mode: 'open' });
    const right = host.querySelector('#right')!.attachShadow({ mode: 'open' });
    const scroller = document.createElement('div'); scroller.style.cssText = 'height:200px;overflow:auto;'; left.append(scroller);
    const source = document.createElement('lr-lite-chart') as LyraLiteChart;
    const peer = document.createElement('lr-lite-chart') as LyraLiteChart;
    for (const chart of [source, peer]) { chart.syncGroup = 'shadow'; chart.labels = ['A']; chart.datasets = [{ label: 'S', data: [4] }]; }
    scroller.append(source); right.append(peer); await ready(source); await ready(peer);
    await focusByKeyboard(source.shadowRoot!.querySelector('[data-mark-index="0"]') as unknown as HTMLElement);
    await waitUntil(() => crosshair(peer));
    scroller.scrollTop = 50; await waitUntil(() => !crosshair(peer));
  });

  it('isolates documents, clears adoption ownership and leaves reconnect transient state empty', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="document" .labels=${['A']} .datasets=${[{ label: 'S', data: [4] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="document" .labels=${['A']} .datasets=${[{ label: 'P', data: [7] }]}></lr-lite-chart><iframe></iframe>
    </div>`);
    const [source, peer] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    await ready(source!); await ready(peer!); await hoverMark(source!, 0); await waitUntil(() => crosshair(peer!));
    const doc = host.querySelector('iframe')!.contentDocument!;
    doc.body.append(doc.adoptNode(source!)); await ready(source!);
    expect(crosshair(peer!)).to.equal(false); expect(crosshair(source!)).to.equal(false);
    await hoverMark(peer!, 0); await waitUntil(() => crosshair(peer!)); expect(crosshair(source!)).to.equal(false);
    source!.remove(); host.prepend(source!); await ready(source!);
    peer!.remove(); await peer!.updateComplete; expect(crosshair(source!)).to.equal(false);
    host.append(peer!); await ready(peer!); expect(crosshair(peer!)).to.equal(false);
  });

  it('reprojects resized recipient geometry and keeps scroll-layout tooltip inside its visible allocation', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="geometry" .labels=${['A', 'B', 'C']} .datasets=${[{ label: 'S', data: [1, 2, 3] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="geometry" .labels=${['A', 'B', 'C']} .datasets=${[{ label: 'P', data: [4, 5, 6] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="geometry" layout="scroll" bar-width="300" .labels=${['A', 'B', 'C']} .datasets=${[{ label: 'Scroll', data: [7, 8, 9] }]}></lr-lite-chart>
    </div>`);
    const [source, peer, scroll] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    for (const chart of [source!, peer!, scroll!]) await ready(chart);
    await focusByKeyboard(source!.shadowRoot!.querySelector('[data-mark-index="2"]') as unknown as HTMLElement);
    await waitUntil(() => crosshair(peer!)); const before = peer!.shadowRoot!.querySelector('[part="sync-crosshair"]')!.getBoundingClientRect().x;
    peer!.style.width = '320px';
    await waitUntil(() => Math.abs(peer!.shadowRoot!.querySelector('[part="sync-crosshair"]')!.getBoundingClientRect().x - before) > 20);
    const mark = peer!.shadowRoot!.querySelector('[data-index="2"]')!.getBoundingClientRect();
    const hair = peer!.shadowRoot!.querySelector('[part="sync-crosshair"]')!.getBoundingClientRect();
    expect(Math.abs(hair.x - mark.x - mark.width / 2)).to.be.lessThan(3);
    const base = scroll!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!; base.scrollLeft = 300;
    await aTimeout(80);
    const tip = scroll!.shadowRoot!.querySelector('[part="sync-tooltip"]')!.getBoundingClientRect();
    const bounds = base.getBoundingClientRect(); expect(tip.left).to.be.at.least(bounds.left - 1); expect(tip.right).to.be.at.most(bounds.right + 1);
  });

  it('preserves RTL keyboard navigation, localized lite formatting and silent peer announcements', async () => {
    const host = await fixture<HTMLDivElement>(html`<div dir="rtl" style="width:600px">
      <lr-lite-chart height="8rem" sync-group="rtl" .labels=${['A', 'B']} .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="rtl" .labels=${['A', 'B']} .datasets=${[{ label: 'P', data: [4, 5] }]}
        .strings=${{ liteChartBarLabel: '{series} custom {label} {value}' }}></lr-lite-chart>
    </div>`);
    const [owner, peer] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
    await ready(owner!); await ready(peer!);
    let announcements = 0;
    const region = peer!.shadowRoot!.querySelector('lr-live-region') as unknown as { announce: (...args: unknown[]) => void };
    const original = region.announce; region.announce = () => { announcements++; };
    try {
      await focusByKeyboard(owner!.shadowRoot!.querySelector('[data-mark-index="0"]') as unknown as HTMLElement);
      await sendKeys({ press: 'ArrowLeft' }); await waitUntil(() => tooltip(peer!).includes('custom B 5'));
      expect(announcements).to.equal(0); expect(peer!.shadowRoot!.activeElement === null).to.equal(true);
    } finally { region.announce = original; }
  });


  it('renders the native animated core tooltip with configured visual callbacks and clears its pixels', async () => {
    let colorCalls = 0;
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="native" .labels=${['A']} .datasets=${[{ label: 'S', data: [1] }]}></lr-lite-chart>
      <lr-chart height="12rem" sync-group="native" .labels=${['A']} .datasets=${[{ label: 'P', data: [7] }]}
        .config=${{ options: { plugins: { tooltip: { backgroundColor: 'rgb(10, 20, 30)', usePointStyle: true,
          bodyFont: { size: 18 }, padding: 10, callbacks: {
            labelColor: () => { colorCalls++; return { backgroundColor: 'rgb(200, 30, 10)', borderColor: 'rgb(30, 10, 200)' }; },
            labelTextColor: () => 'rgb(40, 180, 60)', labelPointStyle: () => ({ pointStyle: 'triangle', rotation: 30 }),
          } } } } }}></lr-chart>
    </div>`);
    const owner = host.querySelector<LyraLiteChart>('lr-lite-chart')!; const peer = host.querySelector<LyraChart>('lr-chart')!;
    await ready(owner); await ready(peer);
    await focusByKeyboard(owner.shadowRoot!.querySelector('[data-mark-index="0"]') as unknown as HTMLElement);
    const runtime = peer.chart as unknown as { tooltip: {
      opacity: number; x: number; y: number; width: number; height: number;
      options: { bodyFont: { size: number }; padding: number };
      labelColors: { backgroundColor: string }[]; labelTextColors: string[]; labelPointStyles: { pointStyle: string }[];
    } };
    await waitUntil(() => runtime.tooltip.opacity > 0.95, 'animated native tooltip becomes visible', { timeout: 2000 });
    expect(colorCalls).to.be.greaterThan(0); expect(runtime.tooltip.options.bodyFont.size).to.equal(18);
    expect(runtime.tooltip.options.padding).to.equal(10); expect(runtime.tooltip.labelColors[0]!.backgroundColor).to.equal('rgb(200, 30, 10)');
    expect(runtime.tooltip.labelTextColors[0]).to.equal('rgb(40, 180, 60)'); expect(runtime.tooltip.labelPointStyles[0]!.pointStyle).to.equal('triangle');
    const canvas = peer.shadowRoot!.querySelector('canvas')!; const ratio = canvas.width / canvas.getBoundingClientRect().width;
    const pixel = () => [...canvas.getContext('2d')!.getImageData(Math.round((runtime.tooltip.x + runtime.tooltip.width / 2) * ratio), Math.round((runtime.tooltip.y + runtime.tooltip.height - 3) * ratio), 1, 1).data].slice(0, 3);
    await waitUntil(() => pixel().join() === '10,20,30', 'native tooltip actually paints the configured background', { timeout: 2000 });
    await sendKeys({ press: 'Escape' }); await waitUntil(() => runtime.tooltip.opacity === 0, 'native tooltip disappears', { timeout: 2000 });
    expect(crosshair(peer)).to.equal(false);
  });


  it('places grouped bar crosshairs at their category centers in both renderers', async () => {
    const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
      <lr-lite-chart height="8rem" sync-group="center" .labels=${['B']} .datasets=${[{ label: 'Source', data: [1] }]}></lr-lite-chart>
      <lr-lite-chart height="8rem" sync-group="center" .labels=${['A', 'B']}
        .datasets=${[{ label: 'One', data: [2, 3] }, { label: 'Two', data: [4, 5] }]}></lr-lite-chart>
      <lr-chart height="8rem" sync-group="center" .labels=${['B', 'A']}
        .config=${{ options: { animation: false } }}
        .datasets=${[{ label: 'One', data: [2, 3] }, { label: 'Two', data: [4, 5] }]}></lr-chart>
    </div>`);
    const [source, lite] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')]; const core = host.querySelector<LyraChart>('lr-chart')!;
    await ready(source!); await ready(lite!); await ready(core); await hoverMark(source!, 0); await waitUntil(() => crosshair(core));
    const label = lite!.shadowRoot!.querySelector<SVGTextElement>('[part="axis-label"][data-full-label="B"]')!;
    const matrix = label.getScreenCTM()!;
    const categoryX = matrix.a * label.x.baseVal[0]!.value + matrix.c * label.y.baseVal[0]!.value + matrix.e;
    const liteHair = lite!.shadowRoot!.querySelector('[part="sync-crosshair"]')!.getBoundingClientRect();
    expect(Math.abs(liteHair.x - categoryX)).to.be.lessThan(3);
    const runtime = core.chart as unknown as { scales: { x: { getPixelForValue(index: number): number } } };
    const coreHair = core.shadowRoot!.querySelector('[part="sync-crosshair"]')!.getBoundingClientRect();
    const canvas = core.shadowRoot!.querySelector('canvas')!.getBoundingClientRect();
    expect(Math.abs(coreHair.x - canvas.x - runtime.scales.x.getPixelForValue(0))).to.be.lessThan(3);
  });

});
