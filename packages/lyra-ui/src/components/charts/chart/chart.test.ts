import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import './chart.js';
import './doughnut-chart.js';
import type { LyraChart } from './chart.js';
import { styles } from './chart.styles.js';

it('shows a loading skeleton and aria-busy while chart.js loads, then swaps to the canvas', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;

  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized', { timeout: 5000 });

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('renders a canvas and builds a Chart.js instance once chart.js loads', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['Jan', 'Feb', 'Mar'];
  el.datasets = [{ label: 'Revenue', data: [1, 2, 3] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas');
  expect(canvas).to.exist;
});

it('normalizes an invalid HTML `type` attribute before it can reach Chart.js', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.setAttribute('type', 'unregistered-controller');

  expect(el.type).to.equal('line');
  expect((el as any).buildConfig().type).to.equal('line');
});

it('falls back to line when an untyped runtime write assigns an invalid chart type', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  (el as unknown as { type: string }).type = 'unregistered-controller';

  expect((el as any).buildConfig().type).to.equal('line');
});

it('updates in place (same Chart instance) when only data changes', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  el.datasets = [{ label: 'x', data: [3, 4] }];
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('preserves a legend-toggled hidden dataset across an in-place datasets-only update', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [
    { label: 'x', data: [1, 2] },
    { label: 'y', data: [3, 4] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  chart.setDatasetVisibility(1, false); // simulate a user clicking the legend to hide dataset 1

  el.datasets = [
    { label: 'x', data: [5, 6] },
    { label: 'y', data: [7, 8] },
  ];
  await el.updateComplete;

  expect(chart.isDatasetVisible(0)).to.be.true;
  expect(chart.isDatasetVisible(1)).to.be.false;
});

it('repaints after restoring a legend-toggled hidden dataset, not just updating metadata', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [
    { label: 'x', data: [1, 2] },
    { label: 'y', data: [3, 4] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  chart.setDatasetVisibility(1, false); // simulate a user clicking the legend to hide dataset 1

  // Track ordering between the restore-visibility call and update() calls: setDatasetVisibility()
  // only flips internal metadata and does not itself repaint, so the fix must call update() again
  // *after* restoring the hidden flag, not just once before it.
  let updateCallCount = 0;
  let visibilityRestoredAtUpdateCount = -1;
  const originalUpdate = chart.update.bind(chart);
  const originalSetDatasetVisibility = chart.setDatasetVisibility.bind(chart);
  chart.update = (...args: unknown[]) => {
    updateCallCount++;
    return originalUpdate(...args);
  };
  chart.setDatasetVisibility = (datasetIndex: number, visible: boolean) => {
    if (datasetIndex === 1 && visible === false) {
      visibilityRestoredAtUpdateCount = updateCallCount;
    }
    return originalSetDatasetVisibility(datasetIndex, visible);
  };

  el.datasets = [
    { label: 'x', data: [5, 6] },
    { label: 'y', data: [7, 8] },
  ];
  await el.updateComplete;

  expect(visibilityRestoredAtUpdateCount).to.be.greaterThan(-1);
  expect(updateCallCount).to.be.greaterThan(visibilityRestoredAtUpdateCount);
});

it('keeps a newly-added series visible instead of inheriting a stale hidden default', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;

  // Adding a series is the exact regression this covers: mapping the "preserve prior visibility"
  // snapshot over the *new* (longer) dataset list, instead of the chart's own prior dataset count,
  // read isDatasetVisible() for the not-yet-existing series' index, got back its unset default, and
  // then enforced that default via setDatasetVisibility(i, false) -- permanently hiding it.
  el.datasets = [
    { label: 'x', data: [1, 2] },
    { label: 'y', data: [3, 4] },
  ];
  await el.updateComplete;

  expect(chart.isDatasetVisible(0)).to.be.true;
  expect(chart.isDatasetVisible(1)).to.be.true;
});

it('does not restore visibility for a dataset index removed by a shrinking update', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [
    { label: 'x', data: [1, 2] },
    { label: 'y', data: [3, 4] },
    { label: 'z', data: [5, 6] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  chart.setDatasetVisibility(2, false); // simulate a user hiding the series that's about to be removed

  // Removing a series is the mirror-image regression of the "growing" case above: the prior-visibility
  // snapshot is taken against the chart's own PRIOR dataset count, which can be larger than the new,
  // shrunk dataset list -- restoring visibility for an index the shrunk list no longer has would call
  // setDatasetVisibility() for an out-of-range index, which Chart.js fabricates metadata for instead of
  // throwing, rather than silently being a no-op.
  const originalSetDatasetVisibility = chart.setDatasetVisibility.bind(chart);
  const calledIndexes: number[] = [];
  chart.setDatasetVisibility = (datasetIndex: number, visible: boolean) => {
    calledIndexes.push(datasetIndex);
    return originalSetDatasetVisibility(datasetIndex, visible);
  };

  el.datasets = [{ label: 'x', data: [9, 9] }]; // shrink from 3 datasets down to 1
  await el.updateComplete;

  expect(calledIndexes).to.not.include(2);
  expect(calledIndexes).to.not.include(1);
  expect(chart.isDatasetVisible(0)).to.be.true;
});

it('rebuilds (new Chart instance) when type changes', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  el.type = 'bar';
  await el.updateComplete;
  await waitUntil(() => (el as any).chart !== instance);
});

it('exposes role=img with a dataset-label-derived aria-label', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('role')).to.equal('img');
  expect(canvas.getAttribute('aria-label')).to.contain('Revenue');
});

it('forwards a host aria-label to the canvas and keeps the chart role on that semantic element only', async () => {
  const el = (await fixture(html`
    <lr-chart aria-label="Quarterly revenue" accessible-label="Legacy chart label"></lr-chart>
  `)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('aria-label')).to.equal('Quarterly revenue');
  expect(canvas.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('role')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[role]')).to.have.length(1);
});

it('formats generated summary values with the effective locale', async () => {
  const el = (await fixture(html`<lr-chart locale="de-DE"></lr-chart>`)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1234.5, 2345.75] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const description = el.shadowRoot!.querySelector('[part="description"]')!;
  expect(description.textContent).to.contain('1.234,5');
  expect(description.textContent).to.contain('2.345,75');
});

it('localizes the chart-type name in the generated summary instead of the raw Chart.js identifier', async () => {
  const el = (await fixture(html`<lr-chart type="polarArea"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const description = el.shadowRoot!.querySelector('[part="description"]')!;
  expect(description.textContent).to.contain('Polar area chart');
  expect(description.textContent).to.not.contain('polarArea');
});

it('joins per-series summary sentences with the localizable chartSummarySeparator message', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.strings = { chartSummarySeparator: ' | ' };
  el.labels = ['A'];
  el.datasets = [
    { label: 'Revenue', data: [1] },
    { label: 'Cost', data: [2] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const description = el.shadowRoot!.querySelector('[part="description"]')!;
  expect(description.textContent).to.contain('trend | Cost:');
});

it('exposes a customizable accessible description and a data-table alternative', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.accessibleLabel = 'Revenue history';
  el.accessibleDescription = 'Revenue rises from January through March.';
  el.showDataTable = true;
  el.labels = ['Jan', 'Feb', 'Mar'];
  el.datasets = [{ label: 'Revenue', data: [1, 2, 3] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const canvas = el.shadowRoot!.querySelector('canvas')!;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  const table = el.shadowRoot!.querySelector('[part="data-table"] table') as HTMLTableElement;
  expect(canvas.getAttribute('aria-label')).to.equal('Revenue history');
  expect(canvas.getAttribute('aria-describedby')).to.equal(description.id);
  expect(description.textContent).to.equal('Revenue rises from January through March.');
  expect(table.querySelectorAll('tbody tr')).to.have.length(3);
  expect(table.querySelector('tbody tr td')!.textContent).to.equal('1');
  expect(table.classList.contains('sr-only')).to.be.false;
});

it('exposes part="canvas" on the canvas element, matching the documented @csspart surface', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('part')).to.equal('canvas');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
});

it('can shrink to a 320px allocation with long chart content', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-chart></lr-chart>
    </div>
  `);
  const el = wrapper.querySelector('lr-chart') as LyraChart;
  el.labels = ['A category label that is intentionally very long', 'Another translated category label'];
  el.datasets = [{ label: 'A deliberately long translated revenue series label', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

it('deep-merges the raw `config` passthrough over the generated options, keeping ungiven generated fields', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.config = { options: { animation: false as never } };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  // config.options wins over the generated value for keys it sets...
  expect(config.options.animation).to.equal(false);
  // ...while generated option keys `config.options` doesn't touch survive.
  expect(config.options.responsive).to.equal(true);
  expect(config.options.maintainAspectRatio).to.equal(false);
});

it('redraws when a config callback is replaced even though its surrounding data is unchanged', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'x', data: [1] }];
  const first = () => 'first';
  const second = () => 'second';
  el.config = { options: { plugins: { tooltip: { callbacks: { label: first } } } } } as never;
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  expect((el as any).buildConfig().options.plugins.tooltip.callbacks.label).to.equal(first);

  el.config = { options: { plugins: { tooltip: { callbacks: { label: second } } } } } as never;
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
  expect((el as any).buildConfig().options.plugins.tooltip.callbacks.label).to.equal(second);
});

it('does not serialize circular or BigInt config values while building the Chart.js config', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const circular: Record<string, unknown> = { options: {} };
  circular.self = circular;
  circular.count = 1n;
  el.config = circular as never;

  let config: any;
  expect(() => {
    config = (el as any).buildConfig();
  }).to.not.throw();
  expect(config.self).to.equal(config);
  expect(config.count).to.equal(1n);
});

it('deep-merges the same reused override object independently at each config position', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.type = 'bar';
  el.labels = ['A'];
  el.datasets = [{ label: 'x', data: [1] }];
  // The exact same object reference set at two different config positions -- x and y scales get
  // different Chart.js-generated base configs (categorical vs. linear), so each merge must produce
  // its own independent result rather than the second position reusing the first's cached result.
  const sharedOverride = { grid: { color: 'red' } };
  el.config = { options: { scales: { x: sharedOverride, y: sharedOverride } } } as never;

  const config = (el as any).buildConfig();
  expect(config.options.scales.x).to.not.equal(config.options.scales.y);
  expect(config.options.scales.x.grid.color).to.equal('red');
  expect(config.options.scales.y.grid.color).to.equal('red');
});

it('rebuilds when `config.type` overrides the effective type even though the `type` prop is unchanged', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  expect(instance.config.type).to.equal('line');

  // `type` prop stays 'line', but `config.type` overrides the effective
  // Chart.js type — draw() must rebuild rather than mutate-in-place, since
  // the previously built chart is a 'line' chart and the new effective type
  // is 'bar'.
  el.config = { type: 'bar' as never };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart !== instance);
  expect((el as any).chart.config.type).to.equal('bar');
});

it('updates in place when neither `type` nor the effective `config.type` changes', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.config = { type: 'line' as never };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;
  el.datasets = [{ label: 'x', data: [5, 6] }];
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('gives reset-zoom-button a hover state and inherits the surrounding font', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='reset-zoom-button'\][^{]*\{[^}]*font:\s*inherit/);
  expect(css).to.match(/\[part='reset-zoom-button'\]:hover/);
});

it('lets `config.data` override generated data while the Chart instance picks up the override', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.config = { data: { labels: ['Override'] as never } };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.data.labels).to.deep.equal(['Override']);
  expect((el as any).chart.data.labels).to.deep.equal(['Override']);
});

it('deep-merges a nested `config.options` key without clobbering the rest of the generated sibling object', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.yLabel = 'Revenue';
  el.datasets = [{ label: 'x', data: [1, 2] }];
  // Only sets `scales.y.min` — the rest of the generated `y` axis config
  // (`beginAtZero`, `title`) must survive, and the generated `x`/`plugins`
  // config must be untouched.
  el.config = { options: { scales: { y: { min: 0 as never } } } };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.y.min).to.equal(0);
  expect(config.options.scales.y.beginAtZero).to.equal(true);
  expect(config.options.scales.y.title.display).to.equal(true);
  expect(config.options.scales.y.title.text).to.equal('Revenue');
  expect(config.options.scales.x.type).to.equal('category');
});

it('gives a scatter chart a linear (not categorical) x scale', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'scatter';
  el.datasets = [{ label: 'x', points: [{ x: 10, y: 20 }, { x: 15, y: 10 }, { x: 20, y: 30 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.x.type).to.equal('linear');
});

it('gives a bubble chart a linear (not categorical) x scale, matching its numeric {x,y,r} points', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bubble';
  el.datasets = [{ label: 'x', points: [{ x: 10, y: 20 }, { x: 15, y: 10 }, { x: 20, y: 30 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.x.type).to.equal('linear');
});

it('omits the scales block for a pie chart (no cartesian or radial axis applies)', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'pie';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales).to.deep.equal({});
});

it('omits the scales block for a doughnut chart (no cartesian or radial axis applies)', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'doughnut';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales).to.deep.equal({});
});

it('builds a radial `r` scale (not cartesian x/y) for a radar chart', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'radar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.r).to.exist;
  expect(config.options.scales.x).to.not.exist;
  expect(config.options.scales.y).to.not.exist;
});

it('builds a radial `r` scale (not cartesian x/y) for a polarArea chart', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'polarArea';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.r).to.exist;
  expect(config.options.scales.x).to.not.exist;
  expect(config.options.scales.y).to.not.exist;
});

it('still builds the cartesian x/y scales block for a line chart', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.x).to.exist;
  expect(config.options.scales.y).to.exist;
  expect(config.options.scales.r).to.not.exist;
});

it('adds a right-side y2 scale when a dataset uses `axis: "y2"`, labelled by `y2Label`', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.y2Label = 'Secondary';
  el.datasets = [
    { label: 'primary', data: [1, 2] },
    { label: 'secondary', data: [10, 20], axis: 'y2' },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.y2).to.exist;
  expect(config.options.scales.y.position).to.equal('left');
  expect(config.options.scales.y2.position).to.equal('right');
  expect(config.options.scales.y2.grid.drawOnChartArea).to.equal(false);
  expect(config.options.scales.y2.title.display).to.equal(true);
  expect(config.options.scales.y2.title.text).to.equal('Secondary');
  expect(config.data.datasets[1].yAxisID).to.equal('y2');
  expect(config.data.datasets[0].yAxisID).to.equal('y');
});

it('places primary and secondary y axes at logical start/end in RTL', async () => {
  const wrapper = await fixture(html`<div dir="rtl"><lr-chart></lr-chart></div>`);
  const el = wrapper.querySelector('lr-chart') as LyraChart;
  el.datasets = [
    { label: 'primary', data: [1, 2] },
    { label: 'secondary', data: [10, 20], axis: 'y2' },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const config = (el as any).buildConfig();
  expect(config.options.scales.y.position).to.equal('right');
  expect(config.options.scales.y2.position).to.equal('left');
});

it('omits the y2 scale entirely when no dataset uses `axis: "y2"`', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'primary', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.y2).to.not.exist;
});

it('configures the zoom plugin only when `zoom` is true', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect((el as any).buildConfig().options.plugins.zoom).to.equal(undefined);

  el.zoom = true;
  await el.updateComplete;
  const config = (el as any).buildConfig();
  expect(config.options.plugins.zoom.zoom.wheel.enabled).to.equal(true);
  expect(config.options.plugins.zoom.zoom.drag.enabled).to.equal(true);
});

it('renders the reset-zoom-button part and emits `lr-zoom` once `onZoomComplete` fires, then again on `resetZoom()`', async () => {
  const el = (await fixture(html`<lr-chart zoom></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  expect(el.shadowRoot!.querySelector('[part="reset-zoom-button"]')).to.not.exist;

  const onZoomComplete = (el as any).buildConfig().options.plugins.zoom.zoom.onZoomComplete;
  let event: CustomEvent | undefined;
  el.addEventListener('lr-zoom', (e) => (event = e as CustomEvent), { once: true });
  onZoomComplete();
  await el.updateComplete;
  expect(event!.detail).to.deep.equal({ zoomed: true });
  expect(el.shadowRoot!.querySelector('[part="reset-zoom-button"]')).to.exist;

  let resetEvent: CustomEvent | undefined;
  el.addEventListener('lr-zoom', (e) => (resetEvent = e as CustomEvent), { once: true });
  el.resetZoom();
  await el.updateComplete;
  expect(resetEvent!.detail).to.deep.equal({ zoomed: false });
  expect(el.shadowRoot!.querySelector('[part="reset-zoom-button"]')).to.not.exist;
});

it('resets the zoomed flag (and hides the reset-zoom-button) when a type change rebuilds the Chart.js instance while zoomed', async () => {
  const el = (await fixture(html`<lr-chart zoom></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;

  const onZoomComplete = (el as any).buildConfig().options.plugins.zoom.zoom.onZoomComplete;
  onZoomComplete();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="reset-zoom-button"]')).to.exist;

  el.type = 'bar';
  await el.updateComplete;
  await waitUntil(() => (el as any).chart !== instance);
  expect((el as any).zoomed).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="reset-zoom-button"]')).to.not.exist;
});

it('disables Chart.js animation when the user prefers reduced motion', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;
  try {
    expect((el as any).buildConfig().options.animation).to.equal(false);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('leaves Chart.js animation at its own default when the user has no reduced-motion preference', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;
  try {
    expect((el as any).buildConfig().options.animation).to.equal(undefined);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('does not let a `__proto__` key in the raw `config` passthrough pollute Object.prototype', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  const malicious = JSON.parse('{"options": {"__proto__": {"polluted": true}}}') as Partial<
    LyraChart['config']
  >;
  el.config = malicious as never;
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(({} as any).polluted).to.equal(undefined);
  expect((config.options as any).polluted).to.equal(undefined);
});

it('applies `height` as `--lr-chart-height` on the host, not on the shadow-tree [part=base] div', async () => {
  const el = (await fixture(html`<lr-chart height="500px"></lr-chart>`)) as LyraChart;
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-chart-height').trim()).to.equal('500px');
  expect(getComputedStyle(el).height).to.equal('500px');

  el.height = '640px';
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-chart-height').trim()).to.equal('640px');
  expect(getComputedStyle(el).height).to.equal('640px');
});

it('gives [part=reset-zoom-button] a token-driven :focus-visible outline, like every other interactive control', () => {
  const css = styles.cssText;
  const focusVisibleBlock = /\[part=['"]?reset-zoom-button['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(focusVisibleBlock, 'expected a [part="reset-zoom-button"]:focus-visible rule').to.not.equal(
    null,
  );
  const focusBody = focusVisibleBlock![1];
  expect(focusBody).to.include('var(--lr-focus-ring-width)');
  expect(focusBody).to.include('var(--lr-focus-ring-color)');
  expect(focusBody).to.include('outline-offset: var(--lr-focus-ring-offset)');
});

it('resolves grid/tick/legend/tooltip colors from custom --lr-chart-* values set on the host', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.legend = true;
  el.xLabel = 'X';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.style.setProperty('--lr-chart-grid-color', 'rgb(1, 2, 3)');
  el.style.setProperty('--lr-chart-tick-color', 'rgb(4, 5, 6)');
  el.style.setProperty('--lr-chart-legend-color', 'rgb(7, 8, 9)');
  el.style.setProperty('--lr-chart-tooltip-bg', 'rgb(10, 11, 12)');
  el.style.setProperty('--lr-chart-tooltip-text', 'rgb(13, 14, 15)');
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const config = (el as any).buildConfig();
  expect(config.options.scales.x.grid.color).to.equal('rgb(1, 2, 3)');
  expect(config.options.scales.y.grid.color).to.equal('rgb(1, 2, 3)');
  expect(config.options.scales.x.ticks.color).to.equal('rgb(4, 5, 6)');
  expect(config.options.scales.y.ticks.color).to.equal('rgb(4, 5, 6)');
  expect(config.options.scales.x.title.color).to.equal('rgb(4, 5, 6)');
  expect(config.options.plugins.legend.labels.color).to.equal('rgb(7, 8, 9)');
  expect(config.options.plugins.tooltip.backgroundColor).to.equal('rgb(10, 11, 12)');
  expect(config.options.plugins.tooltip.titleColor).to.equal('rgb(13, 14, 15)');
  expect(config.options.plugins.tooltip.bodyColor).to.equal('rgb(13, 14, 15)');
});

it('defaults a color-less series to the themed categorical palette, keyed by index', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['Q1', 'Q2'];
  el.datasets = [
    { label: 'a', data: [1, 2] },
    { label: 'b', data: [3, 4] },
  ];
  el.style.setProperty('--lr-color-chart-1', 'rgb(1, 1, 1)');
  el.style.setProperty('--lr-color-chart-2', 'rgb(2, 2, 2)');
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const config = (el as any).buildConfig();
  // Neither series set a color, so each takes its palette slot rather than Chart.js's
  // own near-black default (invisible on the dark theme). This is the charts-bar/charts-line
  // dark-mode regression the visual baselines caught.
  expect(config.data.datasets[0].backgroundColor).to.equal('rgb(1, 1, 1)');
  expect(config.data.datasets[0].borderColor).to.equal('rgb(1, 1, 1)');
  expect(config.data.datasets[1].backgroundColor).to.equal('rgb(2, 2, 2)');
  expect(config.data.datasets[1].borderColor).to.equal('rgb(2, 2, 2)');
});

it('lets an explicit series color override the default palette', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['Q1', 'Q2'];
  el.datasets = [{ label: 'a', data: [1, 2], color: 'rgb(9, 9, 9)' }];
  el.style.setProperty('--lr-color-chart-1', 'rgb(1, 1, 1)');
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const config = (el as any).buildConfig();
  expect(config.data.datasets[0].borderColor).to.equal('rgb(9, 9, 9)');
});

it('defaults pie slices to distinct palette colors across the data', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'pie';
  el.labels = ['A', 'B', 'C'];
  el.datasets = [{ label: 'slices', data: [1, 2, 3] }];
  el.style.setProperty('--lr-color-chart-1', 'rgb(1, 1, 1)');
  el.style.setProperty('--lr-color-chart-2', 'rgb(2, 2, 2)');
  el.style.setProperty('--lr-color-chart-3', 'rgb(3, 3, 3)');
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const config = (el as any).buildConfig();
  expect(config.data.datasets[0].backgroundColor).to.deep.equal([
    'rgb(1, 1, 1)',
    'rgb(2, 2, 2)',
    'rgb(3, 3, 3)',
  ]);
});

it('configures a fixed or auto-responsive legend position', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.legend = true;
  el.legendPosition = 'left';
  expect((el as any).buildConfig().options.plugins.legend.position).to.equal('left');

  el.legendPosition = 'auto';
  (el as any).autoLegendPosition = 'bottom';
  expect((el as any).buildConfig().options.plugins.legend.position).to.equal('bottom');
});

it('applies one valueFormatter to numeric ticks, tooltips, and legend values', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'Revenue', data: [10, 20] }];
  el.legend = true;
  el.valueFormatter = (value, context) => `${context}:${value}`;

  const config = (el as any).buildConfig();
  expect(config.options.scales.y.ticks.callback(10)).to.equal('tick:10');
  expect(config.options.plugins.tooltip.label({ parsed: { y: 20 }, dataset: { label: 'Revenue' } })).to.equal(
    'Revenue: tooltip:20',
  );
  const labels = config.options.plugins.legend.labels.generateLabels({
    data: { datasets: [{ label: 'Revenue', data: [10, 20] }] },
  });
  expect(labels[0].text).to.equal('Revenue: legend:30');
});

it('positions the center slot from chart-area geometry', async () => {
  const el = (await fixture(html`
    <lr-doughnut-chart><span slot="center">Total</span></lr-doughnut-chart>
  `)) as LyraChart;
  (el as any).resolvedChartArea = { left: 20, top: 10, right: 180, bottom: 170, width: 160, height: 160 };
  await el.requestUpdate();
  const center = el.shadowRoot!.querySelector('[part="center"]') as HTMLElement;
  expect(center.style.left).to.equal('100px');
  expect(center.style.top).to.equal('90px');
  expect(el.chartArea?.width).to.equal(160);
});

it('refreshTheme() forces a redraw that re-reads the --lr-chart-* tokens after an out-of-band computed-style change', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  // Out-of-band: mutates the computed style directly, without touching any
  // reactive property, so Lit's own `updated()` has nothing to redraw on —
  // exactly the case a consumer's theme-toggle handler hits.
  el.style.setProperty('--lr-chart-tooltip-bg', 'rgb(9, 9, 9)');
  expect((el as any).chart.options.plugins.tooltip.backgroundColor).to.not.equal('rgb(9, 9, 9)');

  el.refreshTheme();
  expect((el as any).chart.options.plugins.tooltip.backgroundColor).to.equal('rgb(9, 9, 9)');
});

it('emits `lr-point-click` with the resolved point detail when the wired onClick handler fires', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [10, 20] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const chart = (el as any).chart;
  // Stub the mode-specific lookup `handlePointClick()` delegates to, rather
  // than synthesizing real canvas hit-testing geometry for a click event.
  const original = chart.getElementsAtEventForMode;
  chart.getElementsAtEventForMode = (_e: unknown, mode: string, options: unknown, useFinalPosition: unknown) => {
    expect(mode).to.equal('nearest');
    expect(options).to.deep.equal({ intersect: true });
    expect(useFinalPosition).to.equal(true);
    return [{ datasetIndex: 0, index: 1 }];
  };
  try {
    const onClick = (el as any).buildConfig().options.onClick;
    let event: CustomEvent | undefined;
    el.addEventListener('lr-point-click', (e) => (event = e as CustomEvent), { once: true });
    onClick({} as never, [], chart);
    expect(event!.detail).to.deep.equal({ datasetIndex: 0, index: 1, label: 'B', value: 20 });
  } finally {
    chart.getElementsAtEventForMode = original;
  }
});

it('does not emit `lr-point-click` when the click misses every point/segment', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [10, 20] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const chart = (el as any).chart;
  const original = chart.getElementsAtEventForMode;
  chart.getElementsAtEventForMode = () => [];
  try {
    const onClick = (el as any).buildConfig().options.onClick;
    let fired = false;
    el.addEventListener('lr-point-click', () => (fired = true), { once: true });
    onClick({} as never, [], chart);
    expect(fired).to.equal(false);
  } finally {
    chart.getElementsAtEventForMode = original;
  }
});

it('sets `options.indexAxis` to "y" only when `horizontal` is true', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect((el as any).buildConfig().options.indexAxis).to.equal(undefined);

  el.horizontal = true;
  await el.updateComplete;
  expect((el as any).buildConfig().options.indexAxis).to.equal('y');
});

it('stacks the x/y (and y2) scale entries for a bar chart when `stacked` is true, and leaves them unstacked by default', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  let config = (el as any).buildConfig();
  expect(config.options.scales.x.stacked).to.equal(false);
  expect(config.options.scales.y.stacked).to.equal(false);

  el.stacked = true;
  await el.updateComplete;
  config = (el as any).buildConfig();
  expect(config.options.scales.x.stacked).to.equal(true);
  expect(config.options.scales.y.stacked).to.equal(true);
});

it('also stacks the y2 scale of a dual-axis line chart when `stacked` is true', async () => {
  const el = (await fixture(html`<lr-chart stacked></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [
    { label: 'primary', data: [1, 2] },
    { label: 'secondary', data: [3, 4], axis: 'y2' },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.y2.stacked).to.equal(true);
});

it('does not stack a scatter chart\'s linear x scale even when `stacked` is true (bar/line types only, per spec)', async () => {
  const el = (await fixture(html`<lr-chart stacked></lr-chart>`)) as LyraChart;
  el.type = 'scatter';
  el.datasets = [{ label: 'x', points: [{ x: 1, y: 2 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  expect(config.options.scales.x.stacked).to.equal(false);
});

it('skips redrawing when scrolled off-screen', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  (el as any).visible = false;
  el.labels = ['A', 'B', 'C'];
  await el.updateComplete;
  expect((el as any).chart.data.labels).to.deep.equal(['A', 'B']);
});

it('redraws once when it becomes visible again after being off-screen', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  (el as any).visible = false;
  el.labels = ['A', 'B', 'C'];
  await el.updateComplete;
  (el as any).visible = true;
  (el as any).draw();
  await el.updateComplete;
  expect((el as any).chart.data.labels).to.deep.equal(['A', 'B', 'C']);
});

it('skips redrawing when the content signature is unchanged', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const dataRef = (el as any).chart.data;
  el.requestUpdate();
  await el.updateComplete;
  expect((el as any).chart.data).to.equal(dataRef);
});

it('refreshTheme() always redraws regardless of the signature gate', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const dataRef = (el as any).chart.data;
  el.refreshTheme();
  expect((el as any).chart.data).to.not.equal(dataRef);
});

it('builds scales for the config-overridden effective type, not the attribute type', async () => {
  const el = (await fixture(
    html`<lr-chart type="line" .datasets=${[{ label: 'a', data: [1, 2] }]} .config=${{ type: 'radar' }}></lr-chart>`,
  )) as LyraChart;
  await aTimeout(50);
  const chart = (el as unknown as { chart?: { options: { scales?: Record<string, unknown> } } }).chart;
  expect(chart?.options.scales?.r).to.exist;
  expect(chart?.options.scales?.x).to.not.exist;
});

it('actually suppresses the tooltip for a noTooltip series via plugin-level filtering', async () => {
  const el = (await fixture(
    html`<lr-chart type="line" .datasets=${[{ label: 'a', data: [1], noTooltip: true }, { label: 'b', data: [2] }]}></lr-chart>`,
  )) as LyraChart;
  await aTimeout(50);
  const chart = (el as unknown as { chart?: { options: { plugins?: { tooltip?: { filter?: (item: { datasetIndex: number }) => boolean } } } } }).chart;
  const filter = chart?.options.plugins?.tooltip?.filter;
  expect(filter?.({ datasetIndex: 0 })).to.be.false;
  expect(filter?.({ datasetIndex: 1 })).to.be.true;
});

it('does not construct a Chart.js instance if disconnected before the lazy chart.js import settles', async () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.datasets = [{ label: 'a', data: [1] }];
  document.body.appendChild(el);
  el.remove();
  await aTimeout(100);
  expect((el as unknown as { chart?: unknown }).chart).to.be.undefined;
});

it('does not leak a Chart instance bound to a detached canvas when zoom turns on and the element disconnects before loadChartJsWithZoom() resolves', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instanceBeforeZoom = (el as any).chart;

  // Turn zoom on and disconnect in the same synchronous tick — before the
  // dynamic import inside loadChartJsWithZoom() (real, un-mocked) can
  // possibly resolve — matching the `connectedCallback()` disconnect-guard
  // test above.
  el.zoom = true;
  el.remove();
  await aTimeout(200);

  // The chart that existed before disconnect must have been torn down by
  // disconnectedCallback() and never replaced by a new instance bound to the
  // now-detached canvas. `instanceBeforeZoom.canvas` itself is nulled out by
  // Chart.js's own `destroy()` (see chart.js's `Chart#destroy()`), so check
  // `config` (untouched by `destroy()`) instead, just to confirm this really
  // was a real, built Chart instance and not e.g. `undefined` all along.
  expect((el as any).chart).to.be.undefined;
  expect(instanceBeforeZoom.config.type).to.equal('line');
});

it('localizes the data table header and per-row fallback label via this.localize()', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = [];
  el.datasets = [{ label: 'Revenue', data: [1, 2] }];
  el.strings = { chartCategory: 'Catégorie', chartPointLabel: 'Point {n}' };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const headerCells = [...el.shadowRoot!.querySelectorAll('table th')];
  expect(headerCells[0].textContent).to.equal('Catégorie');
  const rowHeader = el.shadowRoot!.querySelector('tbody th') as HTMLElement;
  expect(rowHeader.textContent).to.equal('Point 1');
});

it('defaults to English "Category"/"Point N" when no strings override is set', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = [];
  el.datasets = [{ label: 'Revenue', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const headerCells = [...el.shadowRoot!.querySelectorAll('table th')];
  expect(headerCells[0].textContent).to.equal('Category');
  const rowHeader = el.shadowRoot!.querySelector('tbody th') as HTMLElement;
  expect(rowHeader.textContent).to.equal('Point 1');
});

it('localizes the "Reset zoom" button text via this.localize()', async () => {
  const el = (await fixture(html`<lr-chart zoom></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['Jan', 'Feb'];
  el.datasets = [{ label: 'Revenue', data: [1, 2] }];
  el.strings = { resetZoom: 'Réinitialiser le zoom' };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  (el as any).zoomed = true;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="reset-zoom-button"]') as HTMLElement;
  expect(button.textContent!.trim()).to.equal('Réinitialiser le zoom');
});

// A series with no explicit `color` must not fall through to Chart.js's own default fill
// (`rgba(0,0,0,0.1)`), which is a near-transparent black: faint on the light surface and
// effectively invisible on the dark one. Because Chart.js paints to <canvas> it cannot consume a
// CSS `var()`, so the default must also be resolved to a *concrete* color (unlike lite-chart,
// which can hand the SVG a raw `var(--lr-chart-color-N)`).
it('gives an uncolored cartesian series a concrete, themed default color for fill and border', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['Q1', 'Q2', 'Q3'];
  el.datasets = [{ label: 'Revenue', data: [1, 2, 3] }];
  await el.updateComplete;

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(ds.backgroundColor, 'backgroundColor must be set').to.be.a('string').and.not.equal('');
  expect(ds.borderColor, 'borderColor must be set').to.be.a('string').and.not.equal('');
  // Concrete, not an unresolved var() a canvas can't paint, and not Chart.js's transparent-black.
  expect(ds.backgroundColor).to.not.match(/^var\(/);
  expect(ds.backgroundColor).to.not.match(/rgba\(\s*0\s*,\s*0\s*,\s*0/);
});

it('rotates the default palette across uncolored series so they stay distinguishable', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['Jan', 'Feb'];
  el.datasets = [
    { label: 'A', data: [1, 2] },
    { label: 'B', data: [3, 4] },
    { label: 'C', data: [5, 6] },
  ];
  await el.updateComplete;

  const [a, b, c] = (el as any).buildConfig().data.datasets;
  expect(a.borderColor).to.not.equal(b.borderColor);
  expect(b.borderColor).to.not.equal(c.borderColor);
  expect(a.borderColor).to.not.equal(c.borderColor);
});

it('never overrides an explicitly supplied series color with the default palette', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['Q1'];
  el.datasets = [{ label: 'Revenue', data: [1], color: '#123456' }];
  await el.updateComplete;

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(ds.backgroundColor).to.deep.equal(['#123456']);
  expect(ds.borderColor).to.equal('#123456');
});

// pie/doughnut/polarArea color per *slice*, not per dataset: one uncolored series with N points
// must yield an N-length color array so the slices are told apart, not a single flat color.
it('gives an uncolored pie a per-slice default palette so slices are distinguishable', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'pie';
  el.labels = ['A', 'B', 'C'];
  el.datasets = [{ label: 'Share', data: [30, 45, 25] }];
  await el.updateComplete;

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(ds.backgroundColor).to.be.an('array').with.lengthOf(3);
  expect(ds.backgroundColor[0]).to.not.match(/^var\(/);
  expect(ds.backgroundColor[0]).to.not.equal(ds.backgroundColor[1]);
});
