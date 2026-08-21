import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import './box-plot.js';
import type { LyraBoxPlot } from './box-plot.js';
import { loadBoxPlotAndRegister, LyraBoxPlot as LyraBoxPlotClass } from './box-plot.class.js';
import type { ChartJsModule } from './chart-core-loader.js';
import { styles } from './box-plot.styles.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import type { LyraSkeleton } from '../../overlays/skeleton/skeleton.class.js';

function assertiveSink(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`);
}

function assertiveTexts(doc: Document = document): string[] {
  const sink = assertiveSink(doc);
  return sink ? Array.from(sink.children).map((child) => child.textContent ?? '') : [];
}

function politeSink(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`);
}

function politeTexts(doc: Document = document): string[] {
  const sink = politeSink(doc);
  return sink ? Array.from(sink.children).map((child) => child.textContent ?? '') : [];
}

function fakeChartModule(register: (...items: unknown[]) => void): ChartJsModule {
  class FakeChart {
    static register(...items: unknown[]): void { register(...items); }
    constructor(_item: HTMLCanvasElement, _configuration: unknown) {}
  }
  return { Chart: FakeChart } as unknown as ChartJsModule;
}

function fakeBoxPlotModule() {
  return {
    BoxPlotController: class {},
    BoxAndWiskers: class {},
  };
}

// Deliberately the first test in the file: `loadBoxPlotPlugin()`/`loadChartJs()`
// memoize their resolved promise at module scope, so once any other test in
// this file has driven a `<lr-box-plot>` through a full load, later
// `connectedCallback()`s resolve near-instantly and the initial "still
// loading" render can no longer be observed.
it('shows a loading skeleton and aria-busy while chart.js/the boxplot plugin loads, then swaps to the canvas', async () => {
  const el = (await fixture(html`
    <lr-box-plot .strings=${{ loading: 'Boxplot wird geladen' }}></lr-box-plot>
  `)) as LyraBoxPlot;
  const skeleton = el.shadowRoot!.querySelector('lr-skeleton') as LyraSkeleton;
  await skeleton.updateComplete;

  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(skeleton.announce).to.be.false;
  expect(skeleton.hasAttribute('role')).to.be.false;
  expect(skeleton.shadowRoot!.querySelectorAll('.sr-only').length).to.equal(0);
  expect(
    el.shadowRoot!.querySelectorAll(
      '[role="status"], [role="alert"], [aria-live]:not([aria-live="off"])',
    ).length,
  ).to.equal(0);
  const loadingLabel = el.shadowRoot!.querySelector('.sr-only') as HTMLElement | null;
  expect(loadingLabel !== null, 'the parent must retain a non-live loading label').to.be.true;
  expect(loadingLabel!.textContent).to.equal('Boxplot wird geladen');
  expect(loadingLabel!.hasAttribute('role')).to.be.false;
  expect(loadingLabel!.hasAttribute('aria-live')).to.be.false;
  expect((el.shadowRoot!.querySelector('canvas')) == null).to.equal(true);

  // `waitUntil`'s own default timeout (1000ms) is tighter than this codebase's
  // established budget for async-peer-dep-loader races under concurrent-test
  // resource contention (see graph.test.ts's NODE_COUNT_TIMEOUT = 5000, same
  // root cause: Chromium tab throttling when many test files run in parallel).
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  expect(el.getAttribute('aria-busy')).to.equal('false');
  expect((el.shadowRoot!.querySelector('lr-skeleton')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('canvas')) != null).to.equal(true);
  const sink = assertiveSink();
  expect(sink !== null, 'a connected box plot must acquire its sink before a peer failure').to.be
    .true;
  expect(sink!.getRootNode() === document, 'the alert sink must live in document light DOM').to.be
    .true;
  expect(assertiveTexts(), 'a successful initial mount must not announce an error').to.deep.equal([]);
  expect(() => (
    el as unknown as { syncAnnouncementSinks(): void }
  ).syncAnnouncementSinks()).to.not.throw();
});

describe('box-plot family-contract regressions', () => {
  it('clones valid summaries for the peer and rejects non-monotonic five-number data', async () => {
    const source = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.datasets = [{
      label: 'S',
      data: [source, { min: 5, q1: 4, median: 3, q3: 2, max: 1 }],
    }];
    const config = (el as unknown as { buildConfig(): any }).buildConfig();
    expect(config.data.datasets[0].data[0]).to.deep.equal(source);
    expect(config.data.datasets[0].data[0]).to.not.equal(source);
    expect(config.data.datasets[0].data[1]).to.equal(null);
    config.data.datasets[0].data[0].whiskerMin = -1;
    expect((source as { whiskerMin?: number }).whiskerMin).to.equal(undefined);
  });

  it('formats CSV summaries and emits the normalized box event before the legacy event', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A'];
    el.datasets = [{ label: 'S', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    el.formatter = ({ value, surface }) => `${surface}:${value}`;
    expect(el.exportData('csv')).to.contain('table:3');
    const order: string[] = [];
    let detail: unknown;
    el.addEventListener('lr-datum-activate', (event) => {
      order.push('datum');
      detail = (event as CustomEvent).detail;
    });
    el.addEventListener('lr-point-click', () => order.push('legacy'));
    (el as unknown as { activateBox(value: unknown): void }).activateBox({
      datasetIndex: 0,
      index: 0,
      label: 'A',
      value: { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
    });
    expect(order).to.deep.equal(['datum', 'legacy']);
    expect(detail).to.deep.include({ kind: 'box', datasetIndex: 0, index: 0 });
  });

  it('formats the tooltip label callback through a per-instance formatter, and skips it for an invalid point', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.formatter = ({ value, surface }) => `${surface}:${value}`;
    el.datasets = [{ label: 'Series', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await el.updateComplete;
    const label = (el as unknown as { buildConfig(): any }).buildConfig().options.plugins.tooltip
      .callbacks.label as (context: { dataset?: { label?: unknown }; raw?: unknown }) => string | undefined;
    expect(typeof label).to.equal('function');
    expect(
      label({ dataset: { label: 'Series' }, raw: { min: 1, q1: 2, median: 3, q3: 4, max: 5 } }),
    ).to.equal('Series: tooltip:3');
    expect(
      label({ dataset: { label: '' }, raw: { min: 1, q1: 2, median: 3, q3: 4, max: 5 } }),
    ).to.equal('tooltip:3');
    expect(label({ dataset: { label: 'Series' }, raw: null })).to.equal(undefined);
    expect(
      label({ dataset: { label: 'Series' }, raw: { min: 5, q1: 4, median: 3, q3: 2, max: 1 } }),
    ).to.equal(undefined);
  });

  it('uses the legacy value formatter when the structured formatter is absent', () => {
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    el.valueFormatter = (value, context) => `${context}:${value}`;
    el.labels = ['A'];
    el.datasets = [{ label: 'Series', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];

    expect(el.exportData('csv')).to.contain('table:3');
    const callback = (el as any).buildConfig().options.plugins.tooltip.callbacks.label;
    expect(callback({ raw: { min: 1, q1: 2, median: 3, q3: 4, max: 5 } })).to.equal(
      'tooltip:3'
    );
  });
});

it('handles empty and stale visibility-observer deliveries deterministically', () => {
  const original = window.IntersectionObserver;
  let callback: IntersectionObserverCallback | undefined;
  class ControlledIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];
    constructor(next: IntersectionObserverCallback) {
      callback = next;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  }
  window.IntersectionObserver = ControlledIntersectionObserver;
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;
  try {
    document.body.append(el);
    expect(callback).to.be.a('function');
    (el as any).visible = false;
    callback!([], {} as IntersectionObserver);
    expect((el as any).visible).to.equal(true);

    el.remove();
    (el as any).visible = false;
    callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect((el as any).visible).to.equal(false);
  } finally {
    el.remove();
    window.IntersectionObserver = original;
  }
});

it('normalizes and validates box-plot constructors before registering them', async () => {
  const registrations: unknown[] = [];
  const chart = fakeChartModule((...items) => registrations.push(...items));
  const fallback = fakeBoxPlotModule();
  expect(
    (await loadBoxPlotAndRegister(
      () => Promise.resolve(chart),
      () => Promise.resolve({ default: fallback }),
    )) === fallback,
  ).to.be.true;

  const named = fakeBoxPlotModule();
  const mixed = Object.assign(named, { default: fallback });
  expect(
    (await loadBoxPlotAndRegister(
      () => Promise.resolve(chart),
      () => Promise.resolve(mixed),
    )) === named,
  ).to.be.true;
  expect(registrations.length).to.equal(4);
  expect(registrations[0] === fallback.BoxPlotController).to.be.true;
  expect(registrations[1] === fallback.BoxAndWiskers).to.be.true;
  expect(registrations[2] === named.BoxPlotController).to.be.true;
  expect(registrations[3] === named.BoxAndWiskers).to.be.true;
});

it('fails closed with a clear Error for malformed named/default box-plot modules', async () => {
  const chart = fakeChartModule(() => {
    throw new Error('malformed capabilities must never be registered');
  });
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    for (const [capability, malformed] of [
      ['BoxPlotController', { BoxPlotController: () => ({}), BoxAndWiskers: class {} }],
      ['BoxAndWiskers', { default: { BoxPlotController: class {}, BoxAndWiskers: null } }],
    ] as const) {
      warnings.length = 0;
      const result = await loadBoxPlotAndRegister(
        () => Promise.resolve(chart),
        () => Promise.resolve(malformed),
      );
      expect(result === null, capability).to.be.true;
      const error = warnings.flat().find((value) => value instanceof Error) as Error | undefined;
      expect(error instanceof Error, capability).to.be.true;
      expect(error!.message, capability).to.contain('@sgratzl/chartjs-chart-boxplot');
      expect(error!.message, capability).to.contain(capability);
    }
  } finally {
    console.warn = originalWarn;
  }
});

it('rejects a completely non-object-like box-plot peer, not just a malformed object shape', async () => {
  const chart = fakeChartModule(() => {
    throw new Error('malformed capabilities must never be registered');
  });
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    for (const nonObjectCandidate of [null, 42, 'not-a-plugin']) {
      warnings.length = 0;
      const result = await loadBoxPlotAndRegister(
        () => Promise.resolve(chart),
        () => Promise.resolve(nonObjectCandidate),
      );
      expect(result === null, String(nonObjectCandidate)).to.be.true;
      const error = warnings.flat().find((value) => value instanceof Error) as Error | undefined;
      expect(error instanceof Error, String(nonObjectCandidate)).to.be.true;
      expect(error!.message, String(nonObjectCandidate)).to.contain('module namespace');
    }
  } finally {
    console.warn = originalWarn;
  }
});

it('resolves null without warning when chart.js itself fails to load, even though the box-plot peer would have loaded fine', async () => {
  const fallback = fakeBoxPlotModule();
  let boxPlotImportCalled = false;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  let result: Awaited<ReturnType<typeof loadBoxPlotAndRegister>>;
  try {
    result = await loadBoxPlotAndRegister(
      () => Promise.resolve(null),
      () => {
        boxPlotImportCalled = true;
        return Promise.resolve(fallback);
      },
    );
  } finally {
    console.warn = originalWarn;
  }
  expect(result).to.equal(null);
  // `Promise.all([loadChart(), importBoxPlot()])` starts both concurrently, so the peer import
  // itself still runs even though its result is discarded once `chartMod` turns out falsy.
  expect(boxPlotImportCalled).to.be.true;
  expect(warnings, 'a falsy chart.js result is not a caught error, so it must not warn').to.deep.equal([]);
});

it('builds a boxplot Chart.js instance once both chart.js and the boxplot plugin load', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['K=2', 'K=3'];
  el.datasets = [
    {
      label: 'Loss',
      data: [
        { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
        { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
      ],
    },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart never initialized', { timeout: 2000 });
  expect((el.shadowRoot!.querySelector('canvas')) != null).to.equal(true);
});

it('applies an initial public hiddenDatasets snapshot when it creates the chart', async () => {
  const el = (await fixture(html`<lr-box-plot
    .hiddenDatasets=${[1]}
    .labels=${['A']}
    .datasets=${[
      { label: 'Visible', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
      { label: 'Hidden', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] },
    ]}
  ></lr-box-plot>`)) as LyraBoxPlot;
  await waitUntil(() => (el as unknown as { chart?: unknown }).chart != null);

  const chart = (el as unknown as {
    chart: { isDatasetVisible(index: number): boolean };
  }).chart;
  expect(chart.isDatasetVisible(0)).to.be.true;
  expect(chart.isDatasetVisible(1)).to.be.false;
});

it('updates in place (same Chart instance) when only datasets/labels change', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;

  el.datasets = [{ label: 'x', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] }];
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('preserves a legend-toggled hidden dataset across an in-place datasets-only update', async () => {
  // Mirrors chart.test.ts's identical box-shaped regression -- `LyraChart.draw()` already
  // snapshots/restores Chart.js's per-dataset visibility metadata around a full `chart.data`
  // reassignment; `LyraBoxPlot.draw()` must do the same, since it reassigns `chart.data` on every
  // in-place `datasets` update exactly like `LyraChart` does.
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [
    { label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
    { label: 'y', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  // The DOM legend is the public state transition: it materializes a controlled snapshot instead
  // of relying on private Chart.js metadata.
  el.legend = true;
  await el.updateComplete;
  (el.shadowRoot!.querySelectorAll('[part~="legend-item"]')[1] as HTMLElement).click();
  await el.updateComplete;
  expect(el.hiddenDatasets).to.deep.equal([1]);

  el.datasets = [
    { label: 'x', data: [{ min: 10, q1: 20, median: 30, q3: 40, max: 50 }] },
    { label: 'y', data: [{ min: 20, q1: 30, median: 40, q3: 50, max: 60 }] },
  ];
  await el.updateComplete;

  expect(chart.isDatasetVisible(0)).to.be.true;
  expect(chart.isDatasetVisible(1)).to.be.false;
});

it('uses the shared cancellable legend visibility contract instead of private Chart.js state', async () => {
  const el = (await fixture(html`<lr-box-plot legend></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [
    { label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
    { label: 'y', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  const button = el.shadowRoot!.querySelectorAll('[part~="legend-item"]')[1] as HTMLElement;
  let commits = 0;
  const veto = (event: Event) => event.preventDefault();
  el.addEventListener('lr-before-legend-visibility-change', veto);
  el.addEventListener('lr-legend-visibility-change', () => commits++);

  button.click();
  await el.updateComplete;
  expect(el.hiddenDatasets).to.equal(undefined);
  expect(chart.isDatasetVisible(1)).to.be.true;
  expect(commits).to.equal(0);

  el.removeEventListener('lr-before-legend-visibility-change', veto);
  button.click();
  await el.updateComplete;
  expect(el.hiddenDatasets).to.deep.equal([1]);
  expect(chart.isDatasetVisible(1)).to.be.false;
  expect(commits).to.equal(1);
});

it('keeps a controlled hidden box series hidden when its show proposal is canceled', async () => {
  const el = (await fixture(html`<lr-box-plot
    legend
    .hiddenDatasets=${[0]}
    .labels=${['A']}
    .datasets=${[
      { label: 'Range', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
    ]}
  ></lr-box-plot>`)) as LyraBoxPlot;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  const button = el.shadowRoot!.querySelector('[part~="legend-item"]') as HTMLElement;
  const proposed: unknown[] = [];
  let commits = 0;
  const veto = (event: Event) => {
    proposed.push((event as CustomEvent).detail);
    event.preventDefault();
  };
  el.addEventListener('lr-before-legend-visibility-change', veto);
  el.addEventListener('lr-legend-visibility-change', () => commits++);

  try {
    button.click();
    await el.updateComplete;

    expect(proposed).to.deep.equal([{ datasetIndex: 0, visible: true, hiddenDatasets: [] }]);
    expect(commits).to.equal(0);
    expect(el.hiddenDatasets).to.deep.equal([0]);
    expect(chart.isDatasetVisible(0)).to.be.false;
    expect(button.getAttribute('aria-pressed')).to.equal('false');
  } finally {
    el.removeEventListener('lr-before-legend-visibility-change', veto);
  }
});

it('renders a newly-added box series as pressed in the DOM legend on its first update', async () => {
  const el = (await fixture(html`<lr-box-plot legend></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [
    { label: 'Existing', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;

  el.datasets = [
    { label: 'Existing', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] },
    { label: 'Appended', data: [{ min: 3, q1: 4, median: 5, q3: 6, max: 7 }] },
  ];
  await el.updateComplete;

  const legendItems = [
    ...el.shadowRoot!.querySelectorAll('[part~="legend-item"]'),
  ];
  expect(chart.isDatasetVisible(1)).to.be.true;
  expect(legendItems.map((item) => item.getAttribute('aria-pressed'))).to.deep.equal([
    'true',
    'true',
  ]);
});

it('updates in place (same Chart instance) across a bare height change, instead of destroying and recreating the chart', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;

  el.height = '400px';
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('uses height as a private fallback without overwriting the public --lr-chart-height hook', async () => {
  const el = (await fixture(html`<lr-box-plot height="500px"></lr-box-plot>`)) as LyraBoxPlot;
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-chart-height').trim()).to.equal('');
  expect(el.style.getPropertyValue('--_lr-chart-height').trim()).to.equal('500px');
  expect(getComputedStyle(el).height).to.equal('500px');

  el.style.setProperty('--lr-chart-height', '420px');
  el.height = '640px';
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-chart-height').trim()).to.equal('420px');
  expect(el.style.getPropertyValue('--_lr-chart-height').trim()).to.equal('640px');
  expect(getComputedStyle(el).height).to.equal('420px');

  el.height = '12rem;position:fixed';
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-chart-height').trim()).to.equal('420px');
  expect(el.style.getPropertyValue('--_lr-chart-height').trim()).to.equal('');
  expect(getComputedStyle(el).height).to.equal('420px');

  el.style.removeProperty('--lr-chart-height');
  expect(getComputedStyle(el).height).to.equal('280px');
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
});

it('removes the deprecated v8 boxes/accessibleLabel/accessibleDescription accessors — datasets/label/description are the only surface', () => {
  const proto = LyraBoxPlotClass.prototype as unknown as Record<string, unknown>;
  expect(Object.getOwnPropertyDescriptor(proto, 'boxes')).to.equal(undefined);
  expect(Object.getOwnPropertyDescriptor(proto, 'accessibleLabel')).to.equal(undefined);
  expect(Object.getOwnPropertyDescriptor(proto, 'accessibleDescription')).to.equal(undefined);
});

it('forwards a host aria-label to the canvas and keeps the chart role on that semantic element only', async () => {
  const el = (await fixture(html`
    <lr-box-plot aria-label="Latency distributions" label="Ignored box plot label"></lr-box-plot>
  `)) as LyraBoxPlot;
  el.datasets = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('aria-label')).to.equal('Latency distributions');
  expect(canvas.getAttribute('role')).to.equal('application');
  expect(el.getAttribute('role')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[role]')).to.have.length(1);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(canvas.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  el.label = '';
  await el.updateComplete;
  expect(canvas.getAttribute('aria-label')).to.equal('');
});

it('parses begin-at-zero="false" as false from plain HTML', async () => {
  const el = (await fixture(html`<lr-box-plot begin-at-zero="false"></lr-box-plot>`)) as LyraBoxPlot;
  expect(el.beginAtZero).to.be.false;
});

it('formats generated median-summary values with the effective locale', async () => {
  const el = (await fixture(html`<lr-box-plot locale="de-DE"></lr-box-plot>`)) as LyraBoxPlot;
  el.datasets = [
    {
      label: 'Latency',
      data: [
        { min: 1000, q1: 1100, median: 1234.5, q3: 1300, max: 1400 },
        { min: 2000, q1: 2100, median: 2345.75, q3: 2400, max: 2500 },
      ],
    },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const description = el.shadowRoot!.querySelector('[part="description"]')!;
  expect(description.textContent).to.contain('1.234,5');
  expect(description.textContent).to.contain('2.345,75');
});

it('positions its y axis at logical start in RTL', async () => {
  const wrapper = await fixture(html`<div dir="rtl"><lr-box-plot></lr-box-plot></div>`);
  const el = wrapper.querySelector('lr-box-plot') as LyraBoxPlot;
  el.datasets = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  expect((el as any).buildConfig().options.scales.y.position).to.equal('right');
});

it('can shrink to a 320px allocation with long chart content', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-box-plot></lr-box-plot>
    </div>
  `);
  const el = wrapper.querySelector('lr-box-plot') as LyraBoxPlot;
  el.labels = ['A category label that is intentionally very long'];
  el.datasets = [
    {
      label: 'A deliberately long translated latency distribution label',
      data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
    },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

it('exposes a customizable accessible description and box-plot data table', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.label = 'Loss distributions';
  el.description = 'Loss medians are stable across the two groups.';
  el.showDataTable = true;
  el.labels = ['K=2', 'K=3'];
  el.datasets = [
    {
      label: 'Loss',
      data: [
        { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
        { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
      ],
    },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  const canvas = el.shadowRoot!.querySelector('canvas')!;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  const table = el.shadowRoot!.querySelector('[part="data-table"] table') as HTMLTableElement;
  expect(canvas.getAttribute('aria-label')).to.equal('Loss distributions');
  expect(canvas.getAttribute('aria-describedby')).to.equal(description.id);
  expect(description.textContent).to.equal('Loss medians are stable across the two groups.');
  expect(table.querySelectorAll('tbody tr')).to.have.length(2);
  expect(table.querySelector('tbody tr td:nth-child(5)')!.textContent).to.equal('3');
  expect(table.classList.contains('sr-only')).to.be.false;
});

it('caps the generated box-plot alternative at 1,000 endpoint-preserving records', async () => {
  const labels = Array.from({ length: 1001 }, (_, index) => `C${index}`);
  const points = labels.map((_, index) => ({
    min: index,
    q1: index + 1,
    median: index + 2,
    q3: index + 3,
    max: index + 4,
  }));
  const el = (await fixture(html`<lr-box-plot
    .strings=${{ chartDataSampled: 'Sampled records; use a custom table.' }}
  ></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = labels;
  el.datasets = [{ label: 'Range', data: points }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const rows = [...el.shadowRoot!.querySelectorAll('[part="data-table"] tbody tr')];
  expect(rows).to.have.length(1000);
  expect(rows[0]!.querySelector('th')?.textContent).to.equal('C0');
  expect(rows.at(-1)!.querySelector('th')?.textContent).to.equal('C1000');
  expect(el.shadowRoot!.querySelector('[part="data-truncation"]')?.textContent).to.contain(
    'Sampled records',
  );
});

it('keeps an initially sampled box plot silent, then announces a later sampling transition', async () => {
  const sampledLabels = Array.from({ length: 1001 }, (_, index) => `C${index}`);
  const sampledBoxes = [{
    label: 'Range',
    data: sampledLabels.map((_, index) => ({
      min: index,
      q1: index + 1,
      median: index + 2,
      q3: index + 3,
      max: index + 4,
    })),
  }];
  const el = (await fixture(html`<lr-box-plot
    .strings=${{ chartDataSampled: 'Sampled records; use a custom table.' }}
    .labels=${sampledLabels}
    .datasets=${sampledBoxes}
  ></lr-box-plot>`)) as LyraBoxPlot;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  expect(politeTexts()).to.deep.equal([]);

  el.labels = ['C0'];
  el.datasets = [{ label: 'Range', data: [{ min: 0, q1: 1, median: 2, q3: 3, max: 4 }] }];
  await el.updateComplete;
  el.labels = sampledLabels;
  el.datasets = sampledBoxes;
  await el.updateComplete;

  expect(politeTexts()).to.deep.equal(['Sampled records; use a custom table.']);
});

it('does not wire up chart.js when the boxplot plugin fails to load, even though chart.js itself loaded fine', async () => {
  // Reproduces the partial-peer-dependency-failure path: chart.js resolves
  // successfully but `@sgratzl/chartjs-chart-boxplot` fails to import, so
  // `loadBoxPlotPlugin()` resolves to `null` without ever registering
  // `BoxPlotController`/`BoxAndWiskers`. The fix must gate on that resolved
  // value instead of unconditionally re-awaiting `loadChartJs()`.
  //
  // Deliberately not using `fixture()` (which connects the element and fires
  // its own real `connectedCallback()`): the other tests in this file already
  // resolve+cache the real `loadBoxPlotPlugin()` promise successfully, and a
  // connected instance's own real callback would race this test's synthetic
  // `null` call for the same instance. Constructing without connecting keeps
  // this a pure test of the async handler `connectedCallback()` wires up.
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;

  // Drive the same async handler `connectedCallback()` wires up, but with the
  // `null` resolution `loadBoxPlotPlugin()` produces on a partial failure —
  // asserting it never sets `chartJsModule` nor constructs a `Chart` with the
  // unregistered `'boxplot'` controller type.
  await (el as any).onBoxPlotPluginLoaded(null);

  expect((el as any).chartJsModule).to.equal(undefined);
  expect((el as any).chart).to.equal(undefined);
});

it('fails closed with static visible error text and one light-DOM alert when the boxplot peer fails', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  // Let the real connectedCallback settle first. Calling the synthetic
  // failure after that avoids racing the module-scoped successful peer
  // promise, while still exercising the connected element's failure render.
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
  await (el as any).onBoxPlotPluginLoaded(null);
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('canvas')) == null).to.equal(true);
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect((error) != null).to.equal(true);
  expect(error.hasAttribute('role'), 'the shadow error must not be a second alert').to.be.false;
  expect(error.hasAttribute('aria-hidden'), 'the visible error must remain discoverable').to.be.false;
  expect(error.textContent!.trim()).to.not.equal('');
  expect(assertiveTexts()).to.deep.equal([error.textContent!.trim()]);

  await (el as any).onBoxPlotPluginLoaded(null);
  await el.updateComplete;
  expect(assertiveTexts(), 'the same settled failure state must not announce twice').to.have.length(1);
});

it('releases and reacquires its alert sink when adopted into another document', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignDocument = frame.contentDocument!;
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;
  document.body.appendChild(el);

  try {
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
    const originalSink = assertiveSink();
    expect(originalSink !== null).to.be.true;

    foreignDocument.adoptNode(el);
    expect(originalSink!.isConnected, 'adoption must release the old document sink').to.be.false;
    foreignDocument.body.appendChild(el);
    await el.updateComplete;

    const adoptedSink = assertiveSink(foreignDocument);
    expect(adoptedSink !== null, 'reconnect must acquire a sink in the adopted document').to.be.true;
    expect(adoptedSink!.ownerDocument === foreignDocument).to.be.true;
    expect(assertiveTexts(foreignDocument), 'reconnect must not announce stale state').to.deep.equal(
      [],
    );

    await (el as any).onBoxPlotPluginLoaded(null);
    await el.updateComplete;
    expect(assertiveTexts(foreignDocument)).to.have.length(1);
    expect(assertiveTexts(), 'nothing may be announced into the old document').to.deep.equal([]);

    el.remove();
    expect(adoptedSink!.isConnected, 'disconnect must release the adopted document sink').to.be
      .false;
  } finally {
    el.remove();
    frame.remove();
  }
});

it('rebinds its visibility observer, motion query, and style reads to its adopted document', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignDocument = frame.contentDocument!;
  const foreignWindow = frame.contentWindow!;
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [
    { label: 'Range', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
  ];
  document.body.appendChild(el);
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  const OriginalIntersectionObserver = foreignWindow.IntersectionObserver;
  const originalMatchMedia = foreignWindow.matchMedia;
  const originalGetComputedStyle = foreignWindow.getComputedStyle;
  let intersectionObservers = 0;
  const mediaQueries: string[] = [];
  let styleReads = 0;

  class RealmIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];
    constructor(_callback: IntersectionObserverCallback) {
      intersectionObservers += 1;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] { return []; }
  }

  (foreignWindow as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    RealmIntersectionObserver as unknown as typeof IntersectionObserver;
  foreignWindow.matchMedia = ((query: string) => {
    mediaQueries.push(query);
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener(): void {},
      removeListener(): void {},
      addEventListener(): void {},
      removeEventListener(): void {},
      dispatchEvent(): boolean { return true; },
    };
  }) as typeof matchMedia;
  foreignWindow.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    styleReads += 1;
    return originalGetComputedStyle.call(foreignWindow, element, pseudo);
  }) as typeof getComputedStyle;

  try {
    foreignDocument.adoptNode(el);
    foreignDocument.body.appendChild(el);
    await el.updateComplete;

    expect(intersectionObservers).to.equal(1);
    (el as unknown as { buildConfig(): unknown }).buildConfig();
    expect(mediaQueries).to.include('(prefers-reduced-motion: reduce)');
    expect(styleReads).to.be.greaterThan(0);
  } finally {
    el.remove();
    (foreignWindow as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
      OriginalIntersectionObserver;
    foreignWindow.matchMedia = originalMatchMedia;
    foreignWindow.getComputedStyle = originalGetComputedStyle;
    frame.remove();
  }
});

it('does not bundle lr-chart\'s unused reset-zoom-button styles', () => {
  expect(styles.cssText).to.not.contain('reset-zoom-button');
});

it('does not construct a Chart.js instance if disconnected before the lazy peer import settles', async () => {
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;
  el.datasets = [{ label: 'a', data: [{ min: 0, q1: 1, median: 2, q3: 3, max: 4 }] }];
  document.body.appendChild(el);
  el.remove();
  await aTimeout(100);
  expect((el as unknown as { chart?: unknown }).chart).to.be.undefined;
});

it('resolves grid/tick/legend colors from custom --lr-chart-* values set on the host', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.legend = true;
  el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  el.style.setProperty('--lr-chart-grid-color', 'rgb(1, 2, 3)');
  el.style.setProperty('--lr-chart-tick-color', 'rgb(4, 5, 6)');
  el.style.setProperty('--lr-chart-legend-color', 'rgb(7, 8, 9)');
  el.style.setProperty('--lr-chart-tooltip-bg', 'rgb(10, 11, 12)');
  el.style.setProperty('--lr-chart-tooltip-text', 'rgb(13, 14, 15)');
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  const config = (el as any).buildConfig();
  expect(config.options.scales.y.grid.color).to.equal('rgb(1, 2, 3)');
  expect(config.options.scales.y.ticks.color).to.equal('rgb(4, 5, 6)');
  expect(config.options.scales.y.title.color).to.equal('rgb(4, 5, 6)');
  expect(config.options.plugins.legend.labels.color).to.equal('rgb(7, 8, 9)');
  expect(config.options.plugins.tooltip.backgroundColor).to.equal('rgb(10, 11, 12)');
  expect(config.options.plugins.tooltip.titleColor).to.equal('rgb(13, 14, 15)');
  expect(config.options.plugins.tooltip.bodyColor).to.equal('rgb(13, 14, 15)');
});

it('replaces invalid canvas theme expressions with concrete fallbacks for every paint route', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  for (const name of [
    '--lr-chart-grid-color',
    '--lr-chart-tick-color',
    '--lr-chart-legend-color',
    '--lr-chart-tooltip-bg',
    '--lr-chart-tooltip-text',
  ]) {
    el.style.setProperty(name, 'url(#missing-paint)');
  }
  await el.updateComplete;

  const config = (el as any).buildConfig();
  expect(config.options.scales.y.grid.color).to.equal('#8a8a90');
  expect(config.options.scales.y.ticks.color).to.equal('#6b7280');
  expect(config.options.scales.y.title.color).to.equal('#6b7280');
  expect(config.options.plugins.legend.labels.color).to.equal('#1a1a1a');
  expect(config.options.plugins.tooltip.backgroundColor).to.equal('#fff');
  expect(config.options.plugins.tooltip.titleColor).to.equal('#1a1a1a');
  expect(config.options.plugins.tooltip.bodyColor).to.equal('#1a1a1a');
});

it('gives uncolored box-plot series concrete themed palette colors', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.style.setProperty('--lr-color-chart-1', 'rgb(130, 80, 220)');
  el.style.setProperty('--lr-color-chart-2', 'rgb(20, 140, 155)');
  el.datasets = [
    { label: 'A', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
    { label: 'B', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] },
  ];
  await el.updateComplete;

  const [a, b] = (el as any).buildConfig().data.datasets;
  expect(a.backgroundColor).to.equal('rgb(130, 80, 220)');
  expect(a.borderColor).to.equal('rgb(130, 80, 220)');
  expect(b.backgroundColor).to.equal('rgb(20, 140, 155)');
  expect(b.borderColor).to.equal('rgb(20, 140, 155)');
});

it('disables Chart.js animation when the user prefers reduced motion', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

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

it('redraws the live chart with the current reduced-motion state when the media query change event fires', async () => {
  let changeListener: (() => void) | undefined;
  const fakeQuery = {
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener(type: string, listener: () => void): void {
      if (type === 'change') changeListener = listener;
    },
    removeEventListener(): void {},
  };
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    query === '(prefers-reduced-motion: reduce)'
      ? (fakeQuery as unknown as MediaQueryList)
      : originalMatchMedia(query)) as typeof window.matchMedia;
  try {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    expect(changeListener, 'armReducedMotionWatcher() must register a change listener').to.be.a(
      'function',
    );
    expect((el as any).chart.options.animation).to.not.equal(false);

    fakeQuery.matches = true;
    changeListener!();
    expect((el as any).chart.options.animation).to.equal(false);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('refreshTheme() forces a redraw that re-reads out-of-band theme changes', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  el.style.setProperty('--lr-chart-tooltip-bg', 'rgb(9, 9, 9)');
  expect((el as any).chart.options.plugins.tooltip?.backgroundColor).to.not.equal('rgb(9, 9, 9)');

  expect((el as any).refreshTheme).to.be.a('function');
  (el as any).refreshTheme();
  expect((el as any).chart.options.plugins.tooltip.backgroundColor).to.equal('rgb(9, 9, 9)');
});

it('skips redrawing when scrolled off-screen', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A', 'B'];
  el.datasets = [
    {
      label: 'x',
      data: [
        { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
        { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
      ],
    },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
  (el as any).visible = false;
  el.labels = ['A', 'B', 'C'];
  await el.updateComplete;
  expect((el as any).chart.data.labels).to.deep.equal(['A', 'B']);
});

it('redraws once when it becomes visible again after being off-screen', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A', 'B'];
  el.datasets = [
    {
      label: 'x',
      data: [
        { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
        { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
      ],
    },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
  (el as any).visible = false;
  el.labels = ['A', 'B', 'C'];
  await el.updateComplete;
  (el as any).visible = true;
  (el as any).draw();
  await el.updateComplete;
  expect((el as any).chart.data.labels).to.deep.equal(['A', 'B', 'C']);
});

it('skips redrawing when the content signature is unchanged', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
  const dataRef = (el as any).chart.data;
  el.requestUpdate();
  await el.updateComplete;
  expect((el as any).chart.data).to.equal(dataRef);
});

describe('box-plot robustness regressions', () => {
  it('suppresses the generated fallback table when custom data-table content is supplied', async () => {
    const el = (await fixture(html`
      <lr-box-plot>
        <table slot="data-table"><tbody><tr><td>Custom distributions</td></tr></tbody></table>
      </lr-box-plot>
    `)) as LyraBoxPlot;
    el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
    await aTimeout(0);

    expect(el.shadowRoot!.querySelectorAll('[part="data-table"] > table')).to.have.length(0);
  });

  it('locale-formats summary counts, row ordinals, and every generated table number', async () => {
    const el = (await fixture(html`<lr-box-plot locale="ar-EG"></lr-box-plot>`)) as LyraBoxPlot;
    el.datasets = [
      {
        label: 'Latency',
        data: [{ min: 1000, q1: 1100, median: 1234.5, q3: 1300, max: 1400 }],
      },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    const formatter = new Intl.NumberFormat(el.effectiveLocale);
    const table = el.shadowRoot!.querySelector('[part="data-table"] table')!;
    expect(table.querySelector('tbody th')?.textContent).to.contain(formatter.format(1));
    expect([...table.querySelectorAll('tbody td')].map((cell) => cell.textContent?.trim())).to.deep.equal([
      'Latency',
      formatter.format(1000),
      formatter.format(1100),
      formatter.format(1234.5),
      formatter.format(1300),
      formatter.format(1400),
    ]);
    expect(el.shadowRoot!.querySelector('[part="description"]')?.textContent).to.contain(
      formatter.format(1),
    );
  });

  it('allows component string overrides to reach its generated summary and caption', async () => {
    const el = (await fixture(html`
      <lr-box-plot
        .strings=${{
          boxPlotSummaryWithData: 'Distributions: {summaries}',
          boxPlotData: 'Distribution table',
        }}
      ></lr-box-plot>
    `)) as LyraBoxPlot;
    el.datasets = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    expect(el.shadowRoot!.querySelector('[part="description"]')?.textContent).to.contain(
      'Distributions:',
    );
    expect(el.shadowRoot!.querySelector('caption')?.textContent).to.equal('Distribution table');
  });

  it('drops malformed five-number points without poisoning valid summaries or table cells', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['Broken', 'Valid'];
    el.datasets = [
      {
        label: 'Latency',
        data: [
          { min: 1, q1: 2, median: NaN, q3: 4, max: 5 },
          { min: 10, q1: 20, median: 30, q3: 40, max: 50 },
        ],
      },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    const text = el.shadowRoot!.textContent ?? '';
    expect(text).to.not.contain('NaN');
    expect(el.shadowRoot!.querySelectorAll('tbody tr')).to.have.length(1);
    expect(el.shadowRoot!.querySelector('tbody th')?.textContent).to.equal('Valid');
    const configured = (el as any).buildConfig().data.datasets[0].data;
    expect(configured[0]).to.equal(null);
    expect(configured[1]).to.include({ min: 10, q1: 20, median: 30, q3: 40, max: 50 });
  });

  it('does not recreate a detached chart from an already scheduled update', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    el.datasets = [{ label: 'x', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] }];
    el.remove();
    await el.updateComplete;
    expect((el as unknown as { chart?: unknown }).chart).to.equal(undefined);
  });

  it('automatically refreshes canvas colors after an ancestor theme mutation', async () => {
    const wrapper = await fixture(html`<div><lr-box-plot></lr-box-plot></div>`);
    const el = wrapper.querySelector('lr-box-plot') as LyraBoxPlot;
    el.datasets = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    let refreshes = 0;
    const refreshTheme = el.refreshTheme.bind(el);
    el.refreshTheme = () => {
      refreshes++;
      refreshTheme();
    };
    wrapper.style.setProperty('--lr-theme-color-surface-default', 'rgb(31, 41, 51)');
    await aTimeout(0);

    expect(refreshes).to.equal(1);
    expect((el as any).chart.options.plugins.tooltip.backgroundColor).to.equal(
      'rgb(31, 41, 51)',
    );
  });

  it('materializes caller-supplied box colors before handing them to canvas', async () => {
    const el = (await fixture(html`
      <lr-box-plot style="--box-color: rgb(12, 34, 56)"></lr-box-plot>
    `)) as LyraBoxPlot;
    el.datasets = [
      {
        label: 'Latency',
        color: 'var(--box-color)',
        data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
      },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
    const dataset = (el as any).buildConfig().data.datasets[0];
    expect(dataset.backgroundColor).to.equal('rgb(12, 34, 56)');
    expect(dataset.borderColor).to.equal('rgb(12, 34, 56)');
  });

  it('styles its public peer-load error as an error state', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
    await (el as any).onBoxPlotPluginLoaded(null);
    await el.updateComplete;

    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    const computed = getComputedStyle(error);
    expect(computed.paddingTop).to.not.equal('0px');
    expect(computed.textAlign).to.equal('center');
  });
});

describe('box-plot context and flow', () => {
  it('redraws for live inherited lang and dir changes without another reactive property change', async () => {
    const wrapper = await fixture(html`<div lang="en-US" dir="ltr"><lr-box-plot></lr-box-plot></div>`);
    const el = wrapper.querySelector('lr-box-plot') as LyraBoxPlot;
    el.datasets = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
    expect((el as any).chart.options.locale).to.equal('en-US');
    expect((el as any).chart.options.scales.y.position).to.equal('left');

    wrapper.setAttribute('lang', 'de-DE');
    wrapper.setAttribute('dir', 'rtl');
    await aTimeout(0);
    await el.updateComplete;

    expect((el as any).chart.options.locale).to.equal('de-DE');
    expect((el as any).chart.options.scales.y.position).to.equal('right');
  });

  it('keeps its visible table and a long wrapping legend in normal document flow', async () => {
    const wrapper = await fixture(html`
      <div style="inline-size: 256px">
        <lr-box-plot show-data-table legend></lr-box-plot>
        <div id="after">After box plot</div>
      </div>
    `);
    const el = wrapper.querySelector('lr-box-plot') as LyraBoxPlot;
    el.labels = ['A'];
    el.datasets = [{
      label: 'A deliberately long translated latency distribution label that must remain visible',
      data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
    }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
    await aTimeout(0);

    const table = el.shadowRoot!.querySelector('[part="data-table"] table') as HTMLTableElement;
    const legendItem = el.shadowRoot!.querySelector('[part~="legend-item"]') as HTMLElement;
    const after = wrapper.querySelector('#after') as HTMLElement;
    expect((legendItem) != null).to.equal(true);
    expect(legendItem.textContent).to.contain('must remain visible');
    expect(legendItem.getBoundingClientRect().right).to.be.at.most(
      el.getBoundingClientRect().right + 0.5,
    );
    expect(table.getBoundingClientRect().bottom).to.be.at.most(
      el.getBoundingClientRect().bottom + 0.5,
    );
    expect(after.getBoundingClientRect().top).to.be.at.least(
      el.getBoundingClientRect().bottom - 0.5,
    );
    expect((el as any).buildConfig().options.plugins.legend.display).to.equal(false);

    legendItem.click();
    await el.updateComplete;
    const hiddenLegendItem = el.shadowRoot!.querySelector<HTMLElement>('[part~="legend-item"]')!;
    expect((el as any).chart.isDatasetVisible(0)).to.equal(false);
    expect(hiddenLegendItem.getAttribute('aria-pressed')).to.equal('false');
    expect(hiddenLegendItem.part.contains('legend-item-hidden')).to.be.true;
    expect(getComputedStyle(hiddenLegendItem).textDecorationLine).to.contain('line-through');
  });

  it('re-resolves a public box color for the DOM legend on theme refresh', async () => {
    const el = (await fixture(html`
      <lr-box-plot legend style="--box-color: rgb(10, 20, 30)"></lr-box-plot>
    `)) as LyraBoxPlot;
    el.datasets = [{
      label: 'Latency',
      color: 'var(--box-color)',
      data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }],
    }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    let swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
    expect(swatch.style.backgroundColor).to.equal('rgb(10, 20, 30)');

    el.style.setProperty('--box-color', 'rgb(40, 50, 60)');
    el.refreshTheme();
    await el.updateComplete;
    swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
    expect(swatch.style.backgroundColor).to.equal('rgb(40, 50, 60)');
  });

  it('wraps long peer-load errors and skips theme redraw while off-screen', async () => {
    const el = (await fixture(html`<lr-box-plot style="inline-size: 180px"></lr-box-plot>`)) as LyraBoxPlot;
    el.datasets = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    el.strings = {
      boxPlotMissingLibrary:
        'A deliberately long translated dependency error that must wrap safely',
    };
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
    const chart = (el as any).chart;
    const data = chart.data;

    (el as any).visible = false;
    el.refreshTheme();
    expect(chart.data).to.equal(data);

    (el as any).loading = false;
    (el as any).loadFailed = true;
    await el.updateComplete;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(getComputedStyle(error).overflowWrap).to.equal('anywhere');
    expect(error.scrollWidth).to.be.at.most(error.clientWidth);
  });
});

it('connectedCallback() routes the resolved boxplot-plugin module into the loaded handler instead of ignoring it', async () => {
  // Guards the wiring itself (as opposed to the handler-in-isolation test
  // above): a regression back to the old bug — `connectedCallback()`
  // discarding the value `loadBoxPlotPlugin()` resolved to — would leave this
  // handler uncalled, since the old code never referenced it at all.
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;
  let receivedArg: unknown = 'not-yet-called';
  const original = (el as any).onBoxPlotPluginLoaded.bind(el);
  (el as any).onBoxPlotPluginLoaded = (boxMod: unknown) => {
    receivedArg = boxMod;
    return original(boxMod);
  };

  document.body.appendChild(el);
  try {
    await waitUntil(() => receivedArg !== 'not-yet-called', 'onBoxPlotPluginLoaded was never called', {
      timeout: 2000,
    });
    // On a normal (fully-installed) run the plugin loads successfully, so the
    // resolved value routed through must be the truthy plugin module — not
    // silently dropped.
    expect(receivedArg).to.not.equal(null);
    expect(receivedArg).to.not.equal(undefined);
  } finally {
    document.body.removeChild(el);
  }
});

// -- Theme-token overrides, empty series, and shrinking dataset counts -------

it('uses explicitly themed chart colors instead of its built-in fallbacks', async () => {
  const el = (await fixture(html`<lr-box-plot legend style="
    --lr-chart-grid-color: rgb(10, 20, 30);
    --lr-chart-tick-color: rgb(40, 50, 60);
    --lr-chart-legend-color: rgb(70, 80, 90);
    --lr-chart-tooltip-bg: rgb(100, 110, 120);
    --lr-chart-tooltip-text: rgb(130, 140, 150);
  "></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [{ label: 'S', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const options = (el as any).chart.options;

  // Every one of these five reads is a `getPropertyValue(...) || FALLBACK` — with the property set,
  // the authored value has to win rather than silently falling through to the built-in constant.
  const serialized = JSON.stringify(options);
  expect(serialized).to.contain('rgb(10, 20, 30)');
  expect(serialized).to.contain('rgb(40, 50, 60)');
  expect(serialized).to.contain('rgb(70, 80, 90)');
  expect(serialized).to.contain('rgb(100, 110, 120)');
  expect(serialized).to.contain('rgb(130, 140, 150)');
});

it('summarizes a series with no points as no-data rather than emitting a range', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [{ label: 'Empty', data: [] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const summary = el.shadowRoot!.textContent ?? '';
  expect(summary).to.contain('Empty');
  expect(summary.toLowerCase()).to.contain('no data');
});

it('describes a falling series distinctly from a rising one', async () => {
  const rising = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  rising.labels = ['A', 'B'];
  rising.datasets = [{
    label: 'Up',
    data: [
      { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
      { min: 5, q1: 6, median: 7, q3: 8, max: 9 },
    ],
  }];
  await rising.updateComplete;
  await waitUntil(() => (rising as any).chart != null);

  const falling = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  falling.labels = ['A', 'B'];
  falling.datasets = [{
    label: 'Down',
    data: [
      { min: 5, q1: 6, median: 7, q3: 8, max: 9 },
      { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
    ],
  }];
  await falling.updateComplete;
  await waitUntil(() => (falling as any).chart != null);

  expect(rising.shadowRoot!.textContent, 'the two trend directions must not read identically')
    .to.not.equal(falling.shadowRoot!.textContent);
});

it('drops rendered datasets when the series count shrinks', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.datasets = [
    { label: 'One', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] },
    { label: 'Two', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] },
    { label: 'Three', data: [{ min: 3, q1: 4, median: 5, q3: 6, max: 7 }] },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect((el as any).chart.data.datasets.length).to.equal(3);

  el.datasets = [{ label: 'One', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  expect((el as any).chart.data.datasets.length, 'removed series are not left behind').to.equal(1);
});

describe('per-box interactivity', () => {
  const twoSeries = () => [
    {
      label: 'Latency',
      data: [
        { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
        { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
      ],
    },
    {
      label: 'Throughput',
      data: [
        { min: 10, q1: 20, median: 30, q3: 40, max: 50 },
        { min: 11, q1: 21, median: 31, q3: 41, max: 51 },
      ],
    },
  ];

  it('exposes the canvas as a keyboard-navigable surface', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A', 'B'];
    el.datasets = twoSeries();
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('tabindex')).to.equal('0');
    expect(canvas.getAttribute('role')).to.equal('application');
  });

  it('announces the focused box summary and walks boxes with Arrow/Home/End', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A', 'B'];
    el.datasets = twoSeries();
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    expect(politeTexts(), 'mounting must not announce an initial box').to.deep.equal([]);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    const first = politeTexts().at(-1) ?? '';
    expect(first).to.contain('Latency');
    expect(first).to.contain('A');
    expect(first, 'the five-number summary is the whole point of a box').to.contain('3');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts().at(-1)).to.not.equal(first);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts().at(-1)).to.contain('Throughput');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts().at(-1)).to.equal(first);
  });

  it('emits lr-point-click carrying the five-number summary on keyboard activation', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A', 'B'];
    el.datasets = twoSeries();
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;

    const details: unknown[] = [];
    el.addEventListener('lr-point-click', (event) => details.push((event as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(details).to.deep.equal([
      {
        datasetIndex: 0,
        index: 0,
        label: 'A',
        value: { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
      },
    ]);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect((details[1] as { index: number }).index).to.equal(1);
  });

  it('emits lr-point-click from the wired pointer handler and stays silent on a miss', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A', 'B'];
    el.datasets = twoSeries();
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const chart = (el as any).chart;
    const original = chart.getElementsAtEventForMode;
    // Stub the mode-specific lookup rather than synthesizing real canvas hit-testing geometry.
    chart.getElementsAtEventForMode = (
      _event: unknown,
      mode: string,
      options: unknown,
      useFinalPosition: unknown,
    ) => {
      expect(mode).to.equal('nearest');
      expect(options).to.deep.equal({ intersect: true });
      expect(useFinalPosition).to.equal(true);
      return [{ datasetIndex: 1, index: 1 }];
    };
    try {
      const onClick = (el as any).buildConfig().options.onClick;
      const details: unknown[] = [];
      el.addEventListener('lr-point-click', (event) => details.push((event as CustomEvent).detail));
      onClick({}, [], chart);
      expect(details).to.deep.equal([
        {
          datasetIndex: 1,
          index: 1,
          label: 'B',
          value: { min: 11, q1: 21, median: 31, q3: 41, max: 51 },
        },
      ]);

      chart.getElementsAtEventForMode = () => [];
      onClick({}, [], chart);
      expect(details).to.have.lengthOf(1);
    } finally {
      chart.getElementsAtEventForMode = original;
    }
  });

  it('keeps the keyboard cursor inside the data after the box count shrinks', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A', 'B'];
    el.datasets = twoSeries();
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;

    el.datasets = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
    el.labels = ['A'];
    await el.updateComplete;

    const details: unknown[] = [];
    el.addEventListener('lr-point-click', (event) => details.push((event as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(details).to.deep.equal([
      { datasetIndex: 0, index: 0, label: 'A', value: { min: 1, q1: 2, median: 3, q3: 4, max: 5 } },
    ]);
  });

  it('ignores focus and keydown when there are no addressable boxes', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

    expect(politeTexts()).to.deep.equal([]);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    expect(politeTexts()).to.deep.equal([]);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts()).to.deep.equal([]);
    expect((el as any).keyboardDatumIndex).to.equal(0);
  });

  it('supports ArrowDown/ArrowUp as forward/backward aliases and ignores an unrecognized key', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A', 'B'];
    el.datasets = twoSeries();
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    const first = politeTexts().at(-1) ?? '';

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    const second = politeTexts().at(-1) ?? '';
    expect(second, 'ArrowDown must move forward, like ArrowRight').to.not.equal(first);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts().at(-1), 'ArrowUp must move backward, like ArrowLeft').to.equal(first);

    const countBeforeIgnoredKey = politeTexts().length;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts().length, 'an unrecognized key must not change the announcement').to.equal(
      countBeforeIgnoredKey,
    );
  });

  it('swaps Arrow key forward/backward semantics under RTL', async () => {
    const wrapper = await fixture(html`<div dir="rtl"><lr-box-plot></lr-box-plot></div>`);
    const el = wrapper.querySelector('lr-box-plot') as LyraBoxPlot;
    el.labels = ['A', 'B'];
    el.datasets = twoSeries();
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    const first = politeTexts().at(-1) ?? '';

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    const second = politeTexts().at(-1) ?? '';
    expect(second, 'ArrowLeft must move forward under RTL, mirroring ArrowRight under LTR').to.not.equal(
      first,
    );

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts().at(-1), 'ArrowRight must move backward under RTL').to.equal(first);
  });

  it('falls back to a localized point-index label when a box has no corresponding labels entry', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A'];
    el.datasets = [
      {
        label: 'Latency',
        data: [
          { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
          { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
        ],
      },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await el.updateComplete;
    expect(politeTexts().at(-1) ?? '').to.contain('Point 2');
  });

  it('skips a non-monotonic point when walking boxes with the keyboard, and excludes it from the total count', async () => {
    const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
    el.labels = ['A', 'B', 'C'];
    el.datasets = [
      {
        label: 'Latency',
        data: [
          { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
          { min: 5, q1: 4, median: 3, q3: 2, max: 1 },
          { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
        ],
      },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    expect(politeTexts().at(-1) ?? '', 'only the 2 valid points are addressable').to.contain('of 2');

    const details: unknown[] = [];
    el.addEventListener('lr-point-click', (event) => details.push((event as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(
      (details[0] as { index: number }).index,
      'the invalid middle point must be skipped entirely, landing on the third data point',
    ).to.equal(2);
  });
});

describe('bounded box-plot fallback paths', () => {
  const point = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };

  it('exports both absent and present PNG snapshots and skips invalid CSV summaries', () => {
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    el.labels = [];
    el.datasets = [
      {
        label: 'Series, quoted',
        data: [point, { min: 5, q1: 4, median: 3, q3: 2, max: 1 }],
      },
    ];
    expect(el.exportData('png')).to.equal('');
    expect(el.exportData('csv').split('\r\n')).to.have.length(2);
    expect(el.exportData('csv')).to.contain('"Series, quoted"');

    (el as unknown as { chart: { toBase64Image(): string } }).chart = {
      toBase64Image: () => 'data:image/png;base64,box',
    };
    expect(el.exportData('png')).to.equal('data:image/png;base64,box');
  });

  it('covers empty palettes, absent summaries, misses, and invalid legend indexes', () => {
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    el.datasets = [{ label: '', data: [point] }];
    expect((el as unknown as {
      seriesColor(index: number, palette: string[]): string;
    }).seriesColor(0, [])).to.equal('transparent');

    const spoken = (el as unknown as {
      boxAnnouncement(
        datum: { datasetIndex: number; index: number; value: null },
        position: number,
        total: number,
      ): string;
    }).boxAnnouncement({ datasetIndex: 99, index: 4, value: null }, 0, 1);
    expect(spoken).to.contain('Series');

    const events: unknown[] = [];
    el.addEventListener('lr-point-click', (event) => events.push((event as CustomEvent).detail));
    const hit = (indexes: unknown[]) => ({
      getElementsAtEventForMode: () => indexes,
    });
    (el as unknown as {
      handlePointClick(event: unknown, chart: unknown): void;
    }).handlePointClick({}, hit([]));
    (el as unknown as {
      handlePointClick(event: unknown, chart: unknown): void;
    }).handlePointClick({}, hit([{ datasetIndex: 99, index: 99 }]));
    expect(events).to.have.length(0);

    expect(() => (el as unknown as { toggleDataset(index: number): void }).toggleDataset(0)).to.not
      .throw();
    (el as unknown as { chart: unknown }).chart = {
      data: { datasets: [{}] },
      update: () => undefined,
      setDatasetVisibility: () => undefined,
    };
    expect(() => (el as unknown as { toggleDataset(index: number): void }).toggleDataset(-1)).to.not
      .throw();
    expect(() => (el as unknown as { toggleDataset(index: number): void }).toggleDataset(1)).to.not
      .throw();

    const invalid = document.createElement('lr-box-plot') as LyraBoxPlot;
    invalid.datasets = [
      { label: 'Broken', data: [{ min: 5, q1: 4, median: 3, q3: 2, max: 1 }] },
    ];
    const invalidEvents: unknown[] = [];
    invalid.addEventListener('lr-point-click', (event) => {
      invalidEvents.push((event as CustomEvent).detail);
    });
    (invalid as unknown as {
      handlePointClick(event: unknown, chart: unknown): void;
    }).handlePointClick({}, hit([{ datasetIndex: 0, index: 0 }]));
    expect(invalidEvents).to.deep.equal([
      { datasetIndex: 0, index: 0, label: undefined, value: null },
    ]);
  });

  it('handles missing Chart.js metadata and source-index fallbacks when applying visibility', () => {
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    expect((el as unknown as { applyDatasetVisibility(): boolean }).applyDatasetVisibility()).to.be
      .false;

    let visibility: [number, boolean] | undefined;
    (el as unknown as { chart: unknown }).chart = {
      data: { datasets: [{}] },
      getDatasetMeta: () => undefined,
      setDatasetVisibility: (index: number, visible: boolean) => {
        visibility = [index, visible];
      },
    };
    expect((el as unknown as { applyDatasetVisibility(): boolean }).applyDatasetVisibility()).to.be
      .true;
    el.datasets = [{ label: 'A', data: [point] }];
    el.hiddenDatasets = [0];
    expect((el as unknown as { applyDatasetVisibility(): boolean }).applyDatasetVisibility()).to.be
      .true;
    expect(visibility).to.deep.equal([0, false]);
  });

  it('reports peer registration failures without retaining a malformed load', async () => {
    const registrationError = new Error('box registration failed');
    const chart = fakeChartModule(() => {
      throw registrationError;
    });
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      expect(
        await loadBoxPlotAndRegister(
          () => Promise.resolve(chart),
          () => Promise.resolve(fakeBoxPlotModule()),
        ),
      ).to.equal(null);
      expect(warnings.flat()).to.contain(registrationError);
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('data-table disclosure', () => {
  async function boxPlotWith(markup: unknown): Promise<LyraBoxPlot> {
    const el = (await fixture(markup as never)) as LyraBoxPlot;
    el.labels = ['K=2', 'K=3'];
    el.datasets = [
      {
        label: 'Loss',
        data: [
          { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
          { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
        ],
      },
    ];
    await el.updateComplete;
    return el;
  }

  function toggleButton(el: LyraBoxPlot): HTMLButtonElement | null {
    return el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]');
  }

  function tableWrapper(el: LyraBoxPlot): HTMLElement {
    return el.shadowRoot!.querySelector<HTMLElement>('[part~="data-table"]')!;
  }

  it('renders no toggle at all while the property is unset', async () => {
    const collapsed = await boxPlotWith(html`<lr-box-plot></lr-box-plot>`);
    expect(toggleButton(collapsed) === null, 'opt-in only').to.be.true;
    expect(tableWrapper(collapsed).hasAttribute('data-visually-hidden')).to.be.true;

    const shown = await boxPlotWith(html`<lr-box-plot show-data-table></lr-box-plot>`);
    expect(
      toggleButton(shown) === null,
      'still opt-in when the table is already visible',
    ).to.be.true;
    expect(tableWrapper(shown).hasAttribute('data-visually-hidden')).to.be.false;
  });

  it('renders a labelled, wired disclosure button when opted in', async () => {
    const el = await boxPlotWith(html`<lr-box-plot data-table-toggle></lr-box-plot>`);
    const button = toggleButton(el)!;

    expect(button, 'the disclosure renders').to.exist;
    expect(button.textContent?.trim(), 'localized, not hard-coded').to.not.equal('');
    expect(button.getAttribute('aria-expanded')).to.equal('false');
    expect(button.getAttribute('aria-controls')).to.equal(tableWrapper(el).id);
    expect(tableWrapper(el).id, 'the wrapper carries a real id').to.not.equal('');
  });

  it('reveals the table on activation and keeps it in the DOM throughout', async () => {
    const el = await boxPlotWith(html`<lr-box-plot data-table-toggle></lr-box-plot>`);
    expect(el.shadowRoot!.querySelector('table'), 'present while collapsed').to.exist;
    expect(tableWrapper(el).hasAttribute('data-visually-hidden')).to.be.true;

    toggleButton(el)!.click();
    await el.updateComplete;

    expect(toggleButton(el)!.getAttribute('aria-expanded')).to.equal('true');
    expect(tableWrapper(el).hasAttribute('data-visually-hidden')).to.be.false;
    expect(el.shadowRoot!.querySelector('table'), 'never left the DOM').to.exist;

    toggleButton(el)!.click();
    await el.updateComplete;
    expect(toggleButton(el)!.getAttribute('aria-expanded')).to.equal('false');
    expect(tableWrapper(el).hasAttribute('data-visually-hidden')).to.be.true;
  });

  it('starts expanded when show-data-table is set alongside the toggle', async () => {
    const el = await boxPlotWith(html`<lr-box-plot show-data-table data-table-toggle></lr-box-plot>`);

    expect(toggleButton(el)!.getAttribute('aria-expanded')).to.equal('true');
    expect(tableWrapper(el).hasAttribute('data-visually-hidden')).to.be.false;
  });

  it('is accessible collapsed and expanded', async () => {
    const el = await boxPlotWith(html`<lr-box-plot data-table-toggle></lr-box-plot>`);
    await expect(el).to.be.accessible();

    toggleButton(el)!.click();
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
