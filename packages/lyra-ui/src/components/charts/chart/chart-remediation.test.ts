import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { Chart } from 'chart.js';
import './chart.js';
import './bar-chart.js';
import './line-chart.js';
import './pie-chart.js';
import './doughnut-chart.js';
import './scatter-chart.js';
import './bubble-chart.js';
import './radar-chart.js';
import './polar-area-chart.js';
import './histogram.js';
import './box-plot.js';
import './lite-chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraHistogram } from './histogram.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraLiteChart, LyraLiteChartSeries } from './lite-chart.class.js';

const chartTags = [
  'lr-chart', 'lr-bar-chart', 'lr-line-chart', 'lr-pie-chart', 'lr-doughnut-chart',
  'lr-scatter-chart', 'lr-bubble-chart', 'lr-radar-chart', 'lr-polar-area-chart',
  'lr-histogram', 'lr-box-plot',
];
const mounted: HTMLElement[] = [];
afterEach(() => { mounted.splice(0).forEach((el) => el.remove()); });
function mountChart(tag: string): LyraChart | LyraBoxPlot {
  const el = document.createElement(tag) as LyraChart | LyraBoxPlot;
  if ('withoutAnimation' in el) el.withoutAnimation = true;
  el.style.cssText = 'inline-size: 600px; block-size: 300px';
  mounted.push(el);
  document.body.append(el);
  return el;
}
function peer(el: LyraChart | LyraBoxPlot): Chart | undefined {
  return (el as unknown as { chart?: Chart }).chart;
}
async function liveChart(el: LyraChart | LyraBoxPlot): Promise<Chart> {
  await waitUntil(() => peer(el) !== undefined, `${el.localName} did not initialize`, { timeout: 5000 });
  await el.updateComplete;
  return peer(el)!;
}
function tooltipLines(chart: Chart): string[] {
  chart.tooltip!.setActiveElements([{ datasetIndex: 0, index: 1 }], { x: 0, y: 0 });
  chart.update('none');
  return chart.tooltip!.body.flatMap((item) => item.lines);
}

for (const tag of ['lr-chart', 'lr-bar-chart', 'lr-histogram']) {
  for (const formatter of ['legacy', 'structured']) {
    for (const orientation of ['vertical', 'horizontal', 'raw-horizontal']) {
      it(`${tag} ${formatter} tooltips format ${orientation} bar values`, async () => {
        const el = mountChart(tag) as LyraChart;
        if (tag === 'lr-chart') el.type = 'bar';
        const expected = tag === 'lr-histogram' ? 4 : 60;
        if (tag === 'lr-histogram') {
          const histogram = el as LyraHistogram;
          histogram.bins = 2;
          histogram.values = [0, 0, 1, 1, 1, 1];
          histogram.seriesLabel = 'Revenue';
        } else {
          el.labels = ['A', 'B'];
          el.datasets = [{ label: 'Revenue', data: [30, 60] }];
        }
        const values: number[] = [];
        if (formatter === 'legacy') el.valueFormatter = (value, surface) => {
          if (surface === 'tooltip') values.push(value);
          return `$${value}`;
        };
        else el.formatter = ({ value, surface }) => {
          if (surface === 'tooltip') values.push(value);
          return `$${value}`;
        };
        if (orientation === 'horizontal') el.indexAxis = 'y';
        if (orientation === 'raw-horizontal') el.config = { options: {
          indexAxis: 'y', scales: { x: { type: 'linear' }, y: { type: 'category' } },
        } };
        await el.updateComplete;
        expect(tooltipLines(await liveChart(el))).to.deep.equal([`Revenue: $${expected}`]);
        expect(values.length).to.be.greaterThan(0);
        expect(values.every((value) => value === expected)).to.be.true;
      });
    }
  }
}
for (const tag of ['lr-pie-chart', 'lr-radar-chart', 'lr-scatter-chart', 'lr-bubble-chart']) {
  it(`${tag} keeps scalar, radial and structured-point tooltip values`, async () => {
    const el = mountChart(tag) as LyraChart;
    el.labels = ['A', 'B'];
    el.datasets = tag === 'lr-scatter-chart' || tag === 'lr-bubble-chart'
      ? [{ label: 'Revenue', points: [{ x: 3, y: 30, r: 4 }, { x: 6, y: 60, r: 5 }] }]
      : [{ label: 'Revenue', data: [30, 60] }];
    el.valueFormatter = (value) => `$${value}`;
    await el.updateComplete;
    expect(tooltipLines(await liveChart(el))).to.deep.equal(['Revenue: $60']);
  });
}

class HeldIntersectionObserver implements IntersectionObserver {
  static instances: HeldIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds = [0];
  target?: Element;
  constructor(private readonly callback: IntersectionObserverCallback) {
    HeldIntersectionObserver.instances.push(this);
  }
  observe(target: Element): void { this.target = target; }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  deliver(visible?: boolean): void {
    const target = this.target!;
    const rect = target.getBoundingClientRect();
    this.callback(visible === undefined ? [] : [{
      target, time: performance.now(), isIntersecting: visible,
      intersectionRatio: visible ? 1 : 0,
      boundingClientRect: rect, intersectionRect: rect, rootBounds: null,
    }], this);
  }
}
for (const tag of chartTags) {
  it(`${tag} waits for observer delivery on first mount and reconnect`, async () => {
    const original = window.IntersectionObserver;
    HeldIntersectionObserver.instances = [];
    window.IntersectionObserver = HeldIntersectionObserver;
    let el: LyraChart | LyraBoxPlot | undefined;
    try {
      el = mountChart(tag);
      const current = el;
      const ready = () => (current as unknown as { chartJsModule?: unknown }).chartJsModule !== undefined;
      await waitUntil(ready, `${tag} peer did not load`, { timeout: 5000 });
      await current.updateComplete;
      expect(peer(current) === undefined, 'no construction before the first visibility decision').to.be.true;
      const observer = HeldIntersectionObserver.instances.find((item) => item.target === current)!;
      observer.deliver(false);
      current.requestUpdate();
      await current.updateComplete;
      expect(peer(current) === undefined, 'offscreen chart stays unconstructed').to.be.true;
      observer.deliver(true);
      await liveChart(current);
      current.remove();
      document.body.append(current);
      await waitUntil(ready, `${tag} peer did not reload`, { timeout: 5000 });
      await current.updateComplete;
      observer.deliver(true);
      expect(peer(current) === undefined, 'stale delivery cannot draw a reconnected chart').to.be.true;
      HeldIntersectionObserver.instances.filter((item) => item.target === current).at(-1)!.deliver();
      await liveChart(current);
    } finally {
      el?.remove();
      window.IntersectionObserver = original;
    }
  });
}
for (const tag of ['lr-chart', 'lr-box-plot']) {
  it(`${tag} draws immediately without IntersectionObserver`, async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver')!;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    let el: LyraChart | LyraBoxPlot | undefined;
    try { el = mountChart(tag); await liveChart(el); }
    finally { el?.remove(); Object.defineProperty(window, 'IntersectionObserver', original); }
  });
}

for (const tag of ['lr-chart', 'lr-line-chart']) {
  for (const rowCount of [10, 1001, 2001]) {
    for (const palette of [[], ['red'], ['red', 'blue', 'green']]) {
      it(`${tag} preserves ${palette.length} cyclic colors across ${rowCount} source rows`, async () => {
        const el = mountChart(tag) as LyraChart;
        if (tag === 'lr-chart') el.type = 'line';
        el.labels = Array.from({ length: rowCount }, (_, index) => String(index));
        el.datasets = [{ label: 'Series', data: el.labels.map((_, index) => index), segmentColors: palette }];
        await el.updateComplete;
        const chart = await liveChart(el);
        if (!palette.length) {
          expect(Object.hasOwn(chart.data.datasets[0]!, 'segment')).to.be.false;
          return;
        }
        const line = chart.getDatasetMeta(0).dataset as unknown as {
          segments: { start: number; end: number; style: { borderColor: string } }[];
        };
        const ctx = document.createElement('canvas').getContext('2d')!;
        const colors = palette.map((color) => { ctx.fillStyle = color; return ctx.fillStyle; });
        expect(line.segments.length).to.be.greaterThan(0);
        let represented = 0;
        for (const segment of line.segments) {
          for (let index = segment.start; index < segment.end; index++) {
            const source = Number(chart.data.labels![index]);
            ctx.fillStyle = segment.style.borderColor;
            expect(ctx.fillStyle, `segment from source row ${source}`).to.equal(colors[source % colors.length]);
            represented += 1;
          }
        }
        expect(represented).to.equal(chart.data.labels!.length - 1);
      });
    }
  }
}

async function liteChart(datasets: LyraLiteChartSeries[], options: { gap?: number; scale?: string; floor?: number; stacked?: boolean } = {}) {
  const el = await fixture<LyraLiteChart>(html`<lr-lite-chart
    type="bar" scale=${options.scale ?? 'linear'} .stacked=${options.stacked ?? false}
    .barGapRatio=${options.gap} .minBarHeight=${options.floor}
    style="inline-size: 600px; block-size: 300px"
    .labels=${datasets[0]!.data.map((_, index) => String(index))} .datasets=${datasets}
  ></lr-lite-chart>`);
  await waitUntil(() => (el as unknown as { plotWidth: number }).plotWidth > 0, 'SVG plot was not measured');
  await el.updateComplete;
  return el;
}
function bars(el: LyraLiteChart) {
  return Array.from(el.shadowRoot!.querySelectorAll<SVGRectElement>('[part="bar"]')).map((bar) => ({
    x: bar.x.baseVal.value, y: bar.y.baseVal.value,
    width: bar.width.baseVal.value, height: bar.height.baseVal.value,
  }));
}
for (const [count, gap] of [[4, 0.2], [12, 0.2], [4, 0.8], [40, 0.99], [4, 1]] as const) {
  it(`grouped SVG bars keep width for ${count} series and gap ${gap}`, async () => {
    const el = await liteChart(Array.from({ length: count }, (_, index) => ({ label: String(index), data: [1, 1] })), { gap });
    const marks = bars(el);
    expect(marks.length).to.equal(count * 2);
    for (let index = 0; index < marks.length; index++) {
      const mark = marks[index]!;
      if (gap === 1) expect(mark.width).to.equal(0);
      else expect(mark.width).to.be.greaterThan(0);
      if (index > 0) expect(mark.x).to.be.at.least(marks[index - 1]!.x + marks[index - 1]!.width - 0.001);
    }
    if (gap === 1) return;
    const slot = marks[count]!.x - marks[0]!.x;
    expect(marks[count - 1]!.x + marks[count - 1]!.width - marks[0]!.x).to.be.closeTo(slot * (1 - gap), 0.01);
    if (count === 4 && gap === 0.2) expect(marks[0]!.width).to.be.closeTo(slot * (0.8 - 0.08 * 3) / 4, 0.01);
  });
}
it('logarithmic stacks map positive totals once and partition their extent by raw shares', async () => {
  const el = await liteChart([
    { label: 'First', data: [1, 10] }, { label: 'Second', data: [1, 30] },
    { label: 'Zero', data: [0, 0] }, { label: 'Negative', data: [-2, -20] },
  ], { stacked: true, scale: 'logarithmic' });
  const marks = bars(el);
  const grid = Array.from(el.shadowRoot!.querySelectorAll<SVGLineElement>('[part="grid-line"]')).map((line) => line.y1.baseVal.value);
  const top = Math.min(...grid);
  const baseline = Math.max(...grid);
  expect(el.minBarHeight).to.equal(undefined);
  for (const mark of marks) {
    expect(mark.y).to.be.at.least(top - 0.001);
    expect(mark.y + mark.height).to.be.at.most(baseline + 0.001);
  }
  expect(marks[0]!.height).to.be.greaterThan(0);
  expect(marks[0]!.height).to.be.closeTo(marks[1]!.height, 0.01);
  expect(marks[1]!.y + marks[1]!.height).to.be.closeTo(marks[0]!.y, 0.01);
  expect(marks[4]!.height / marks[5]!.height).to.be.closeTo(1 / 3, 0.001);
  expect(marks[5]!.y).to.be.closeTo(top, 0.01);
  expect(marks[0]!.height + marks[1]!.height).to.be.closeTo((baseline - top) * Math.log(2) / Math.log(40), 0.01);
  for (const index of [2, 3, 6, 7]) expect(marks[index]!.height).to.equal(0);
});
for (const scale of ['linear', 'sqrt', 'logarithmic']) {
  it(`${scale} retains authored minimum-height overflow`, async () => {
    const el = await liteChart([{ label: 'First', data: [1] }, { label: 'Second', data: [10] }], { stacked: true, scale, floor: 1000 });
    const marks = bars(el);
    expect(marks.every((mark) => mark.height >= 999.99)).to.be.true;
    expect(Math.min(...marks.map((mark) => mark.y))).to.be.lessThan(0);
    if (scale !== 'sqrt') expect(marks[1]!.y + marks[1]!.height).to.be.closeTo(marks[0]!.y, 0.01);
  });
}

it('keeps finite saturated logarithmic totals inside the plot with proportional segments', async () => {
  const el = await liteChart([
    { label: 'First', data: [1, Number.MAX_VALUE] },
    { label: 'Second', data: [1, Number.MAX_VALUE / 2] },
  ], { stacked: true, scale: 'logarithmic' });
  const marks = bars(el);
  const grid = Array.from(el.shadowRoot!.querySelectorAll<SVGLineElement>('[part="grid-line"]')).map((line) => line.y1.baseVal.value);
  expect(marks.every((mark) => Number.isFinite(mark.height) && Number.isFinite(mark.y))).to.be.true;
  expect(marks[3]!.y).to.be.closeTo(Math.min(...grid), 0.01);
  expect(marks[2]!.height / marks[3]!.height).to.be.closeTo(2, 0.001);
});

it('logarithmic negative minimum-height segments retain their downward floor and push', async () => {
  const el = await liteChart([
    { label: 'First', data: [-1] }, { label: 'Second', data: [-2] },
    { label: 'Positive', data: [10] },
  ], { stacked: true, scale: 'logarithmic', floor: 1000 });
  const marks = bars(el);
  expect(marks[1]!.y).to.be.closeTo(marks[0]!.y + marks[0]!.height, 0.01);
  expect(marks[0]!.height).to.be.closeTo(1000, 0.01);
  expect(marks[1]!.height).to.be.closeTo(1000, 0.01);
});

it('horizontal structured bar points retain their y-value formatter contract', async () => {
  const el = mountChart('lr-bar-chart') as LyraChart;
  el.indexAxis = 'y';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'Points', points: [{ x: 30, y: 0 }, { x: 60, y: 1 }] }];
  el.valueFormatter = (value) => `$${value}`;
  await el.updateComplete;
  expect(tooltipLines(await liveChart(el))).to.deep.equal(['Points: $1']);
});

// Axis titles use the same public strings at every allocation; only their visible text may shorten.
for (const direction of ['ltr', 'rtl']) {
  it(`fits long lite-chart axis titles and preserves their complete names in ${direction}`, async () => {
    const fullTitle = 'Latency in milliseconds, logarithmic scale';
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart
      dir=${direction} height="16rem" x-label="Scenario" y-label=${fullTitle}
      style="inline-size: 352px" scale="logarithmic"
      .labels=${['1 ms', '10 ms', '100 ms', '1,000 ms']}
      .datasets=${[{ label: 'Latency', data: [1, 10, 100, 1000] }]}
    ></lr-lite-chart>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="axis-title"]').length === 2);
    await el.updateComplete;
    const title = el.shadowRoot!.querySelector<SVGTextElement>('[part="axis-title"]')!;
    const svg = el.shadowRoot!.querySelector('svg')!;
    await waitUntil(() => title.getBoundingClientRect().top >= svg.getBoundingClientRect().top - 1);
    expect(title.getBoundingClientRect().bottom).to.be.at.most(svg.getBoundingClientRect().bottom + 1);
    expect(title.textContent).to.match(/…$/u);
    expect(title.getAttribute('aria-label')).to.equal(fullTitle);
    expect(el.yLabel).to.equal(fullTitle);

    el.yLabel = 'Count';
    await el.updateComplete;
    expect(title.textContent).to.equal('Count');
    expect(title.getAttribute('aria-label')).to.equal('Count');
    el.yLabel = '';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="axis-title"]').length).to.equal(1);
  });

  it(`refits wide lite-chart glyphs through font, resize and reconnect changes in ${direction}`, async () => {
    const original = 'W'.repeat(100);
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart
      dir=${direction} height="16rem" x-label=${original} y-label=${original}
      style="inline-size: 192px"
      .labels=${['A', 'B']} .datasets=${[{ label: 'Values', data: [1, 2] }]}
    ></lr-lite-chart>`);
    const titlesFit = (): boolean => {
      const titles = [...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-title"]')];
      if (titles.length !== 2) return false;
      const svg = el.shadowRoot!.querySelector('svg')!.getBoundingClientRect();
      return titles.every((title, index) => {
        const box = title.getBoundingClientRect();
        return index === 0
          ? box.top >= svg.top - 1 && box.bottom <= svg.bottom + 1
          : box.left >= svg.left - 1 && box.right <= svg.right + 1;
      });
    };
    await waitUntil(titlesFit);
    const title = el.shadowRoot!.querySelector<SVGTextElement>('[part="axis-title"]')!;
    const beforeFont = title.textContent!.length;
    el.style.setProperty('--lr-font-size-xs', '24px');
    await waitUntil(() => title.textContent!.length < beforeFont && titlesFit());
    expect(title.getAttribute('aria-label')).to.equal(original);

    const beforeResize = title.textContent!.length;
    el.height = '10rem';
    el.style.inlineSize = '160px';
    await waitUntil(() => title.textContent!.length < beforeResize && titlesFit());
    const beforeReconnect = title.textContent!.length;
    const parent = el.parentElement!;
    el.remove();
    el.style.setProperty('--lr-font-size-xs', '12px');
    parent.append(el);
    await waitUntil(() => title.textContent!.length > beforeReconnect && titlesFit());
    expect(el.xLabel).to.equal(original);
    expect(el.yLabel).to.equal(original);
    expect([...el.shadowRoot!.querySelectorAll('[part="axis-title"]')].map((node) => node.getAttribute('aria-label')))
      .to.deep.equal([original, original]);
  });
}

for (const direction of ['ltr', 'rtl']) {
  it(`refits lite-chart titles after inherited font changes without resizing the SVG in ${direction}`, async () => {
    const original = 'W'.repeat(70);
    const parent = await fixture<HTMLDivElement>(html`<div style="--lr-theme-font-size-xs: 12px"><lr-lite-chart
      dir=${direction} style="inline-size: 220px" height="16rem" x-label=${original} y-label=${original}
      .labels=${['A', 'B']} .datasets=${[{ label: 'Values', data: [1, 2] }]}
    ></lr-lite-chart></div>`);
    const el = parent.querySelector<LyraLiteChart>('lr-lite-chart')!;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="axis-title"]').length === 2);
    const titles = [...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-title"]')];
    const fits = (): boolean => titles.every((title) =>
      title.getComputedTextLength() <= Number(title.getAttribute('data-title-extent')) + 1);
    await waitUntil(fits);
    const before = titles.map((title) => title.textContent!.length);
    const allocation = el.shadowRoot!.querySelector('svg')!.getBoundingClientRect();
    parent.style.setProperty('--lr-theme-font-size-xs', '24px');
    await waitUntil(() => titles.every((title, index) => title.textContent!.length < before[index]!) && fits());
    const after = el.shadowRoot!.querySelector('svg')!.getBoundingClientRect();
    expect(after.width).to.equal(allocation.width);
    expect(after.height).to.equal(allocation.height);
    expect(titles.map((title) => title.getAttribute('aria-label'))).to.deep.equal([original, original]);
  });
}

it('restores an unpainted lite-chart axis title after its inherited font shrinks enough to fit', async () => {
  const original = 'W'.repeat(70);
  const parent = await fixture<HTMLDivElement>(html`<div style="--lr-theme-font-size-xs: 64px"><lr-lite-chart
    style="inline-size: 90px" height="16rem" x-label=${original} y-label=${original}
    .labels=${['A', 'B']} .datasets=${[{ label: 'Values', data: [1, 2] }]}
  ></lr-lite-chart></div>`);
  const el = parent.querySelector<LyraLiteChart>('lr-lite-chart')!;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="axis-title"]').length === 2);
  const title = el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-title"]')[1]!;
  await waitUntil(() => getComputedStyle(title).opacity === '0');
  expect(title.getAttribute('aria-label')).to.equal(original);
  parent.style.setProperty('--lr-theme-font-size-xs', '12px');
  await waitUntil(() => getComputedStyle(title).opacity === '1' &&
    title.getComputedTextLength() <= Number(title.getAttribute('data-title-extent')) + 1);
  expect(title.textContent!.length).to.be.greaterThan(0);
  expect(el.xLabel).to.equal(original);
});

for (const direction of ['ltr', 'rtl']) {
  it(`renders readable positive logarithmic ticks at the original canary allocation in ${direction}`, async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart
      dir=${direction} height="16rem" x-label="Scenario" y-label="Latency in milliseconds, logarithmic scale"
      style="inline-size: 352px" scale="logarithmic"
      .labels=${['1 ms', '10 ms', '100 ms', '1,000 ms']}
      .datasets=${[{ label: 'Latency', data: [1, 10, 100, 1000] }]}
    ></lr-lite-chart>`);
    const ticks = (): SVGTextElement[] => [...el.shadowRoot!.querySelectorAll<SVGTextElement>(
      '[part="axis-label"][dominant-baseline="middle"]')];
    await waitUntil(() => ticks().length > 1 && el.shadowRoot!.querySelectorAll('[part="bar"]').length === 4);
    expect(ticks().map((tick) => tick.textContent!.trim())).to.deep.equal(['1', '10', '100', '1,000']);
    const boxes = ticks().map((tick) => tick.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index]!.top).to.be.greaterThan(boxes[index - 1]!.bottom);
    }
    const grids = [...el.shadowRoot!.querySelectorAll<SVGLineElement>('[part="grid-line"]')];
    const marks = [...el.shadowRoot!.querySelectorAll<SVGRectElement>('[part="bar"]')];
    grids.forEach((grid, index) => expect(grid.y1.baseVal.value).to.be.closeTo(marks[index]!.y.baseVal.value, 0.001));
  });
}

for (const scale of ['linear', 'sqrt']) {
  it(`preserves the established ${scale} tick values`, async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart scale=${scale} style="inline-size: 352px" height="16rem"
      .labels=${['A', 'B', 'C', 'D']} .datasets=${[{ label: 'Values', data: [1, 10, 100, 1000] }]}
    ></lr-lite-chart>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="grid-line"]').length > 1);
    expect([...el.shadowRoot!.querySelectorAll('[part="axis-label"][dominant-baseline="middle"]')]
      .map((tick) => tick.textContent!.trim())).to.deep.equal(['0', '200', '400', '600', '800', '1,000']);
  });
}

for (const values of [[1, 11], [7, 10], [0.01, 0.1, 1], [Number.MIN_VALUE, Number.MAX_VALUE], [-10, 0, 1, 100]]) {
  it(`bounds positive logarithmic ticks and preserves formatter values for ${values.join(',')}`, async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart scale="logarithmic" style="inline-size: 352px" height="16rem"
      .labels=${values.map((_, index) => String(index))} .datasets=${[{ label: 'Values', data: values }]}
      .tickFormat=${(value: number) => `Value ${value}`}
    ></lr-lite-chart>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="grid-line"]').length > 1);
    const ticks = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][dominant-baseline="middle"]')]
      .map((tick) => Number(tick.textContent!.trim().slice('Value '.length)));
    expect(ticks.length).to.be.at.most(7);
    expect(ticks.every((value, index) => Number.isFinite(value) && value > 0 &&
      (index === 0 || value > ticks[index - 1]!))).to.equal(true);
    const grids = [...el.shadowRoot!.querySelectorAll<SVGLineElement>('[part="grid-line"]')];
    expect(grids.every((grid) => Number.isFinite(grid.y1.baseVal.value))).to.equal(true);
    const tops = grids.map((grid) => grid.y1.baseVal.value);
    expect(Math.min(...tops)).to.equal(8);
  });
}
