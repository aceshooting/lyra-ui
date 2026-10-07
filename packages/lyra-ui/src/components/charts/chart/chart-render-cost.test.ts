import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './line-chart.js';
import './histogram.js';
import './box-plot.js';
import type { LyraChart } from './chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraHistogram } from './histogram.class.js';
import { ChartTokenCache } from './chart-token-cache.js';

interface RuntimeProbe {
  render(): void;
  getDatasetMeta(index: number): { data: { x: number; y: number }[] };
}
type TooltipFilter = (item: { datasetIndex: number; dataIndex: number }) => boolean;

const labelsOf = (length: number): string[] => Array.from({ length }, (_, index) => `t${index}`);
const seriesOf = (count: number, length: number) =>
  Array.from({ length: count }, (_, series) => ({
    label: `S${series}`,
    data: Array.from({ length }, (_, index) => series * 10 + (index % 7)),
  }));

function peer(el: LyraChart): RuntimeProbe | undefined {
  return (el as unknown as { chart?: RuntimeProbe }).chart;
}

/** Counts own-descriptor reads -- the unit of work of the chart's data projection. */
function countDescriptorReads(body: () => void): number {
  const original = Object.getOwnPropertyDescriptor;
  let count = 0;
  Object.getOwnPropertyDescriptor = ((target: object, key: PropertyKey) => {
    count += 1;
    return original(target, key);
  }) as typeof Object.getOwnPropertyDescriptor;
  try {
    body();
  } finally {
    Object.getOwnPropertyDescriptor = original;
  }
  return count;
}

function countUpdates(runtime: RuntimeProbe): { readonly count: number } {
  const counter = { count: 0 };
  const probe = runtime as unknown as { update(mode?: string): void };
  const original = probe.update.bind(probe);
  probe.update = (mode?: string) => {
    counter.count += 1;
    original(mode);
  };
  return counter;
}

function countRenders(runtime: RuntimeProbe): { readonly count: number } {
  const counter = { count: 0 };
  const original = runtime.render.bind(runtime);
  runtime.render = () => {
    counter.count += 1;
    original();
  };
  return counter;
}

describe('lr-chart derived-data reuse', () => {
  it('answers repeated tooltip filter calls without re-projecting the data', async () => {
    const el = await fixture<LyraChart>(html`<lr-line-chart without-animation
      .labels=${labelsOf(600)} .datasets=${seriesOf(3, 600)}></lr-line-chart>`);
    await waitUntil(() => peer(el) !== undefined, 'chart did not initialize', { timeout: 5000 });
    const config = (el as unknown as {
      buildConfig(): { options: { plugins: { tooltip: { filter: TooltipFilter } } } };
    }).buildConfig();
    const filter = config.options.plugins.tooltip.filter;
    filter({ datasetIndex: 0, dataIndex: 0 });
    const reads = countDescriptorReads(() => {
      for (let index = 0; index < 50; index += 1) filter({ datasetIndex: index % 2, dataIndex: index });
    });
    expect(reads).to.be.lessThan(500);
  });

  it('serves repeated keyboard navigation without rebuilding the datum model per key', async () => {
    const el = await fixture<LyraChart>(html`<lr-line-chart without-animation
      .labels=${labelsOf(600)} .datasets=${seriesOf(3, 600)}></lr-line-chart>`);
    await waitUntil(() => peer(el) !== undefined, 'chart did not initialize', { timeout: 5000 });
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const reads = countDescriptorReads(() => {
      for (let index = 0; index < 20; index += 1)
        canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(reads).to.be.lessThan(2_000);
  });
});

/** Counts color/length probe insertions into `root` while `body` runs. */
async function countProbes(root: ShadowRoot, body: () => Promise<void>): Promise<number> {
  let count = 0;
  const original = root.append;
  root.append = function append(this: ShadowRoot, ...nodes: (Node | string)[]) {
    count += 1;
    original.apply(this, nodes);
  };
  try {
    await body();
  } finally {
    delete (root as Partial<ShadowRoot>).append;
  }
  return count;
}

describe('canvas color resolution', () => {
  it('tracks currentColor, authored CSS variables, and root rem context across theme notifications', async () => {
    const scope = await fixture<HTMLElement>(html`<div style="color: rgb(1, 2, 3); --chart-accent: rgb(4, 5, 6)"></div>`);
    const cache = new ChartTokenCache(scope);
    cache.resolve('currentColor', 'transparent');
    cache.resolve('var(--chart-accent)', 'transparent');
    cache.rememberTheme();
    scope.style.setProperty('--unrelated-layout-size', '42px');
    expect(cache.hasThemeChanged()).to.equal(false);

    scope.style.color = 'rgb(7, 8, 9)';
    expect(cache.hasThemeChanged()).to.equal(true);
    cache.rememberTheme();
    scope.style.setProperty('--chart-accent', 'rgb(10, 11, 12)');
    expect(cache.hasThemeChanged()).to.equal(true);
    cache.rememberTheme();

    cache.beginThemeDraw();
    cache.resolve('currentColor', 'transparent');
    cache.rememberTheme();
    scope.style.setProperty('--chart-accent', 'rgb(13, 14, 15)');
    expect(cache.hasThemeChanged(), 'retired color variables leave the draw dependency set').to.equal(false);

    cache.beginThemeDraw();
    cache.resolve('var(--missing-accent, var(--chart-accent))', 'transparent');
    cache.rememberTheme();
    scope.style.setProperty('--chart-accent', 'rgb(16, 17, 18)');
    expect(cache.hasThemeChanged(), 'a fallback variable remains a live dependency').to.equal(true);
    cache.rememberTheme();

    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    try {
      root.style.fontSize = '18px';
      cache.rememberTheme();
      root.style.fontSize = '19px';
      expect(cache.hasThemeChanged()).to.equal(true);
    } finally {
      root.style.fontSize = previousFontSize;
    }
  });

  it('skips a chart rebuild for ancestor style and class writes with unchanged theme inputs', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <style>.retinted lr-line-chart { --lr-chart-tooltip-bg: rgb(9, 8, 7); }</style>
      <lr-line-chart without-animation .labels=${['A', 'B']}
        .datasets=${[{ label: 'x', data: [1, 2] }]}></lr-line-chart>
    </div>`);
    const chart = host.querySelector<LyraChart>('lr-line-chart')!;
    await waitUntil(() => peer(chart) !== undefined, 'chart did not initialize', { timeout: 5000 });
    await aTimeout(0);
    const updates = countUpdates(peer(chart)!);

    host.style.setProperty('--unrelated-layout-size', '42px');
    host.classList.add('unrelated-layout');
    await aTimeout(0);
    expect(updates.count).to.equal(0);

    host.classList.add('retinted');
    await aTimeout(0);
    expect(updates.count).to.equal(1);
    const tooltip = (peer(chart) as unknown as {
      options: { plugins: { tooltip: { backgroundColor: string } } };
    }).options.plugins.tooltip;
    expect(tooltip.backgroundColor).to.equal('rgb(9, 8, 7)');
  });

  it('skips a box-plot rebuild for unrelated ancestor writes but redraws on a theme token', async () => {
    const host = await fixture<HTMLElement>(html`<div>
      <style>.retinted lr-box-plot { --lr-chart-tooltip-bg: rgb(7, 8, 9); }</style>
      <lr-box-plot .datasets=${[{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }]}></lr-box-plot>
    </div>`);
    const plot = host.querySelector<LyraBoxPlot>('lr-box-plot')!;
    const runtime = () => (plot as unknown as { chart?: RuntimeProbe }).chart;
    await waitUntil(() => runtime() !== undefined, 'box plot did not initialize', { timeout: 5000 });
    await aTimeout(0);
    const updates = countUpdates(runtime()!);

    host.style.setProperty('--unrelated-layout-size', '42px');
    host.classList.add('unrelated-layout');
    await aTimeout(0);
    expect(updates.count).to.equal(0);

    host.classList.add('retinted');
    await aTimeout(0);
    expect(updates.count).to.equal(1);
  });

  it('does not re-probe theme colors on a data-only lr-chart redraw', async () => {
    const el = await fixture<LyraChart>(html`<lr-line-chart without-animation area
      .labels=${labelsOf(5)} .datasets=${seriesOf(3, 5)}></lr-line-chart>`);
    await waitUntil(() => peer(el) !== undefined, 'chart did not initialize', { timeout: 5000 });
    await el.updateComplete;
    const runtime = peer(el) as unknown as { data: { labels: unknown[] } };
    const probes = await countProbes(el.shadowRoot!, async () => {
      el.appendData('t5', [1, 2, 3]);
      await el.updateComplete;
      await waitUntil(() => runtime.data.labels.length === 6, 'redraw');
    });
    expect(probes).to.equal(0);
  });

  it('re-resolves a light-dark() token after a theme refresh', async () => {
    const el = await fixture<LyraChart>(html`<lr-line-chart without-animation
      style="color-scheme: light; --lr-chart-grid-color: light-dark(rgb(0, 0, 1), rgb(0, 0, 2))"
      .labels=${labelsOf(3)} .datasets=${seriesOf(1, 3)}></lr-line-chart>`);
    await waitUntil(() => peer(el) !== undefined, 'chart did not initialize', { timeout: 5000 });
    const grid = () => (peer(el) as unknown as { options: { scales: { y: { grid: { color: string } } } } })
      .options.scales.y.grid.color;
    await waitUntil(() => grid() === 'rgb(0, 0, 1)', 'light grid');
    el.style.colorScheme = 'dark';
    el.refreshTheme();
    await waitUntil(() => grid() === 'rgb(0, 0, 2)', 'dark grid');
  });

  it('does not re-probe theme colors on a data-only lr-box-plot redraw', async () => {
    const box = (offset: number) => ({ min: offset, q1: offset + 1, median: offset + 2, q3: offset + 3, max: offset + 4 });
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['a', 'b']}
      .datasets=${[{ label: 'A', data: [box(0), box(1)] }, { label: 'B', data: [box(2), box(3)] }]}></lr-box-plot>`);
    await waitUntil(() => (el as unknown as { chart?: unknown }).chart !== undefined, 'box plot', { timeout: 5000 });
    await el.updateComplete;
    const runtime = (el as unknown as { chart: { data: { labels: unknown[] } } }).chart;
    const probes = await countProbes(el.shadowRoot!, async () => {
      el.labels = ['a', 'b', 'c'];
      el.datasets = [{ label: 'A', data: [box(0), box(1), box(2)] }, { label: 'B', data: [box(2), box(3), box(4)] }];
      await el.updateComplete;
      await waitUntil(() => runtime.data.labels.length === 3, 'redraw');
    });
    expect(probes).to.equal(0);
  });
});

describe('accessible-text-only updates', () => {
  it('updates lr-chart label and description without rebuilding the canvas', async () => {
    const el = await fixture<LyraChart>(html`<lr-line-chart without-animation
      .labels=${labelsOf(5)} .datasets=${seriesOf(2, 5)}></lr-line-chart>`);
    await waitUntil(() => peer(el) !== undefined, 'chart did not initialize', { timeout: 5000 });
    await el.updateComplete;
    const updates = countUpdates(peer(el)!);
    el.label = 'Weekly visits';
    el.description = 'Visits rose all week.';
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('aria-label')).to.contain('Weekly visits');
    expect(el.shadowRoot!.textContent).to.contain('Visits rose all week.');
    expect(updates.count).to.equal(0);
  });

  it('updates lr-box-plot label and description without rebuilding the canvas', async () => {
    const box = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot .labels=${['a']}
      .datasets=${[{ label: 'A', data: [box] }]}></lr-box-plot>`);
    await waitUntil(() => (el as unknown as { chart?: unknown }).chart !== undefined, 'box plot', { timeout: 5000 });
    await el.updateComplete;
    const updates = countUpdates((el as unknown as { chart: RuntimeProbe }).chart);
    el.label = 'Latency';
    el.description = 'Latency is stable.';
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).to.contain('Latency is stable.');
    expect(updates.count).to.equal(0);
  });
});

describe('same-reference rebinds', () => {
  it('ignores rebinding lr-chart hiddenDatums and config to their current values', async () => {
    const el = document.createElement('lr-line-chart') as LyraChart;
    document.body.append(el);
    try {
      const hidden = [1];
      el.hiddenDatums = hidden;
      el.config = { options: { plugins: { title: { display: true, text: 'T' } } } };
      await el.updateComplete;
      el.hiddenDatums = hidden;
      expect(el.isUpdatePending, 'same hiddenDatums source').to.equal(false);
      el.hiddenDatums = el.hiddenDatums;
      expect(el.isUpdatePending, 'hiddenDatums getter round trip').to.equal(false);
      el.config = el.config;
      expect(el.isUpdatePending, 'config getter round trip').to.equal(false);
      el.hiddenDatums = [0];
      expect(el.isUpdatePending, 'a new array still updates').to.equal(true);
    } finally {
      el.remove();
    }
  });
});

describe('lr-histogram derived series', () => {
  it('keeps one labels/datasets identity per bucketing and refreshes on change', () => {
    const el = document.createElement('lr-histogram') as LyraHistogram;
    el.values = [1, 2, 2, 3, 3, 3];
    el.bins = 3;
    const labels = el.labels;
    const datasets = el.datasets;
    expect(el.labels === labels).to.equal(true);
    expect(el.datasets === datasets).to.equal(true);
    expect(Object.isFrozen(datasets[0]!.data)).to.equal(true);
    el.seriesLabel = 'Samples';
    expect(el.datasets === datasets).to.equal(false);
    expect(el.datasets[0]!.label).to.equal('Samples');
    el.values = [1, 2];
    expect(el.labels === labels).to.equal(false);
  });
});

describe('chart synchronization idle cost', () => {
  it('does not repaint idle synchronized canvases on scroll', async () => {
    const host = await fixture<HTMLElement>(html`<div style="inline-size: 480px">
      <lr-line-chart without-animation sync-group="idle" .labels=${labelsOf(5)}
        .datasets=${seriesOf(1, 5)}></lr-line-chart>
      <lr-line-chart without-animation sync-group="idle" .labels=${labelsOf(5)}
        .datasets=${seriesOf(1, 5)}></lr-line-chart>
    </div>`);
    const charts = [...host.querySelectorAll<LyraChart>('lr-line-chart')];
    await waitUntil(() => charts.every((chart) => peer(chart) !== undefined), 'charts', { timeout: 5000 });
    await Promise.all(charts.map((chart) => chart.updateComplete));
    const counters = charts.map((chart) => countRenders(peer(chart)!));
    for (let index = 0; index < 10; index += 1) document.dispatchEvent(new Event('scroll'));
    expect(counters.map((counter) => counter.count)).to.deep.equal([0, 0]);
  });

  it('repaints a recipient once while the pointer stays on one category', async () => {
    const host = await fixture<HTMLElement>(html`<div style="inline-size: 480px">
      <lr-line-chart without-animation sync-group="same" .labels=${labelsOf(5)}
        .datasets=${seriesOf(1, 5)}></lr-line-chart>
      <lr-line-chart without-animation sync-group="same" .labels=${labelsOf(5)}
        .datasets=${seriesOf(1, 5)}></lr-line-chart>
    </div>`);
    const [owner, recipient] = [...host.querySelectorAll<LyraChart>('lr-line-chart')];
    await waitUntil(() => peer(owner!) !== undefined && peer(recipient!) !== undefined, 'charts', {
      timeout: 5000,
    });
    await Promise.all([owner!.updateComplete, recipient!.updateComplete]);
    const point = peer(owner!)!.getDatasetMeta(0).data[2]!;
    const canvas = owner!.shadowRoot!.querySelector('canvas')!;
    const bounds = canvas.getBoundingClientRect();
    const move = () => canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      composed: true,
      clientX: bounds.left + point.x,
      clientY: bounds.top + point.y,
    }));
    move();
    await waitUntil(() => !!recipient!.shadowRoot!.querySelector('[part="sync-crosshair"]'), 'crosshair');
    const counter = countRenders(peer(recipient!)!);
    for (let index = 0; index < 5; index += 1) move();
    expect(counter.count).to.equal(0);
  });
});
