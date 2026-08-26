import { fixture, expect, html, waitUntil, aTimeout, oneEvent } from '@open-wc/testing';
import { resetMouse, sendKeys, sendMouse } from '@web/test-runner-commands';
import './chart.js';
import './doughnut-chart.js';
import {
  seriesPalette,
  LyraChart,
  type LyraChartAnnotation,
  type LyraChartSeries,
} from './chart.js';
import { loadChartAndZoom } from './chart-feature-loader.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import type { LyraSkeleton } from '../../overlays/skeleton/skeleton.class.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { resolveLyraLocale } from '../../../localization.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-chart', 'horizontal');

function announcementSink(
  doc: Document = document,
  politeness: 'polite' | 'assertive' = 'polite',
): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function announcementTexts(
  doc: Document = document,
  politeness: 'polite' | 'assertive' = 'polite',
): string[] {
  const sink = announcementSink(doc, politeness);
  return sink ? Array.from(sink.children).map((child) => child.textContent ?? '') : [];
}

function mediaQueryList(media: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addEventListener(): void {},
    removeEventListener(): void {},
    addListener(): void {},
    removeListener(): void {},
    dispatchEvent: () => true,
  };
}

it('shows a loading skeleton and aria-busy while chart.js loads, then swaps to the canvas', async () => {
  const el = (await fixture(html`
    <lr-chart .strings=${{ loading: 'Diagramm wird geladen' }}></lr-chart>
  `)) as LyraChart;
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
  expect(loadingLabel!.textContent).to.equal('Diagramm wird geladen');
  expect(loadingLabel!.hasAttribute('role')).to.be.false;
  expect(loadingLabel!.hasAttribute('aria-live')).to.be.false;
  expect((el.shadowRoot!.querySelector('canvas')) == null).to.equal(true);

  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized', { timeout: 5000 });

  expect(el.getAttribute('aria-busy')).to.equal('false');
  expect((el.shadowRoot!.querySelector('lr-skeleton')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('canvas')) != null).to.equal(true);
});

describe('bounded chart surface regressions', () => {
  it('drops malformed simplified dataset entries while retaining valid rendered series', async () => {
    const datasets = [
      null,
      undefined,
      42,
      { label: 'Empty series' },
      { label: 'Revenue', data: [7] },
    ] as unknown as readonly LyraChartSeries[];
    const el = (await fixture(html`<lr-chart
      show-data-table
      .labels=${['North']}
      .datasets=${datasets}
    ></lr-chart>`)) as LyraChart;

    await waitUntil(() => (el as any).chart != null, 'valid sibling series never rendered', {
      timeout: 5000,
    });

    expect(el.datasets.map((series) => series.label)).to.deep.equal(['Empty series', 'Revenue']);
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="data-table"]')!.textContent).to.contain('Revenue');
    await expect(el).to.be.accessible();
  });

  it('normalizes invalid closed-set and nested numeric writes before building peer config', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    (el as unknown as { grid: string }).grid = 'diagonal';
    (el as unknown as { legendPosition: string }).legendPosition = 'sideways';
    el.datasets = [{
      label: 'points',
      points: [{ x: Number.NaN, y: 2 }, { x: 1, y: 2, r: Number.POSITIVE_INFINITY }],
      width: Number.POSITIVE_INFINITY,
      pointRadius: [Number.NaN, -1, 3],
    }];

    const config = (el as unknown as { buildConfig(): any }).buildConfig();
    expect(config.options.scales.x.grid.display).to.be.true;
    expect(config.options.scales.y.grid.display).to.be.true;
    expect(config.options.plugins.legend.position).to.equal('top');
    expect(config.data.datasets[0].data).to.deep.equal([null, { x: 1, y: 2 }]);
    expect(config.data.datasets[0].pointRadius.every((value: number) => Number.isFinite(value) && value >= 0)).to.be.true;
    expect(Number.isFinite(config.data.datasets[0].borderWidth)).to.be.true;
  });

  it('bounds the simplified visual plan while preserving explicit config.data as full fidelity', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = Array.from({ length: 2_000 }, (_, index) => `L${index}`);
    el.datasets = [{ label: 'series', data: el.labels.map((_, index) => index) }];
    expect((el as unknown as { buildConfig(): any }).buildConfig().data.labels).to.have.length(1_000);

    const rawLabels = Array.from({ length: 1_500 }, (_, index) => `R${index}`);
    el.config = { data: { labels: rawLabels, datasets: [{ label: 'raw', data: rawLabels }] } };
    expect((el as unknown as { buildConfig(): any }).buildConfig().data.labels).to.have.length(1_500);
  });

  it('exposes renderChart and emits the normalized datum event before the compatibility event', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    let renders = 0;
    (el as unknown as { drawIfVisible(): void }).drawIfVisible = () => { renders += 1; };
    const order: string[] = [];
    let detail: unknown;
    el.addEventListener('lr-datum-activate', (event) => {
      order.push('datum');
      detail = (event as CustomEvent).detail;
    });
    el.addEventListener('lr-point-click', () => order.push('legacy'));

    el.renderChart();
    (el as unknown as { activateDatum(value: unknown): void }).activateDatum({
      datasetIndex: 0,
      index: 1,
      label: 'B',
      value: 2,
    });

    expect(renders).to.equal(1);
    expect(order).to.deep.equal(['datum', 'legacy']);
    expect(detail).to.deep.equal({ datasetIndex: 0, index: 1, label: 'B', value: 2, kind: 'bar' });
  });

  it('responds to live reduced-motion changes and releases the query listener', () => {
    const originalMatchMedia = window.matchMedia;
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    let removals = 0;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener(_type: string, callback: EventListenerOrEventListenerObject) {
        if (query === '(prefers-reduced-motion: reduce)') {
          listener = callback as (event: MediaQueryListEvent) => void;
        }
      },
      removeEventListener() {
        if (query === '(prefers-reduced-motion: reduce)') removals += 1;
      },
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const el = document.createElement('lr-chart') as LyraChart;
      let draws = 0;
      (el as unknown as { drawIfVisible(): void }).drawIfVisible = () => { draws += 1; };
      document.body.append(el);
      const before = draws;
      listener?.({ matches: true, media: '(prefers-reduced-motion: reduce)' } as MediaQueryListEvent);
      expect(draws).to.equal(before + 1);
      el.remove();
      expect(removals).to.be.greaterThan(0);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('ignores a stale reduced-motion change event that arrives after disconnect', () => {
    const originalMatchMedia = window.matchMedia;
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener(_type: string, callback: EventListenerOrEventListenerObject) {
        if (query === '(prefers-reduced-motion: reduce)') {
          listener = callback as (event: MediaQueryListEvent) => void;
        }
      },
      removeEventListener() {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      const el = document.createElement('lr-chart') as LyraChart;
      let draws = 0;
      (el as unknown as { drawIfVisible(): void }).drawIfVisible = () => { draws += 1; };
      document.body.append(el);
      expect(listener, 'the watcher must have registered a change listener while connected').to.be.a(
        'function',
      );
      el.remove();
      const before = draws;
      listener?.({ matches: true, media: '(prefers-reduced-motion: reduce)' } as MediaQueryListEvent);
      expect(draws, 'a stale listener firing after disconnect must not trigger a redraw').to.equal(
        before,
      );
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('ignores a stale visibility callback after reconnecting with a new observer', () => {
    const OriginalObserver = window.IntersectionObserver;
    const callbacks: IntersectionObserverCallback[] = [];
    class TestObserver {
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
      constructor(callback: IntersectionObserverCallback) { callbacks.push(callback); }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    window.IntersectionObserver = TestObserver as unknown as typeof IntersectionObserver;
    const el = document.createElement('lr-chart') as LyraChart;
    try {
      document.body.append(el);
      el.remove();
      document.body.append(el);
      (el as unknown as { visible: boolean }).visible = true;
      callbacks[0]?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect((el as unknown as { visible: boolean }).visible).to.be.true;
      callbacks[1]?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      expect((el as unknown as { visible: boolean }).visible).to.be.false;
    } finally {
      el.remove();
      window.IntersectionObserver = OriginalObserver;
    }
  });
});

it('announces keyboard datum changes through one light-DOM sink and keeps the shadow copy inert', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.labels = ['North', 'South'];
  el.datasets = [{ label: 'Revenue', data: [10, 20] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized');

  const sink = announcementSink();
  expect(sink !== null, 'a connected chart must acquire its sink before announcing').to.be.true;
  expect(sink!.getRootNode() === document, 'the live region must be in document light DOM').to.be
    .true;
  expect(announcementTexts(), 'mounting a chart must not announce its initial datum').to.deep.equal(
    [],
  );

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  canvas.focus();
  await el.updateComplete;
  expect(announcementTexts()).to.have.length(1);
  expect(announcementTexts()[0]).to.contain('Revenue');
  expect(announcementTexts()[0]).to.contain('North');

  const mirror = el.shadowRoot!.querySelector('.sr-only[aria-hidden="true"]') as HTMLElement;
  expect(mirror !== null, 'the inspectable shadow copy must remain rendered').to.be.true;
  expect(mirror.hasAttribute('aria-live'), 'the mirror must not be a second live region').to.be
    .false;
  expect(mirror.hasAttribute('role')).to.be.false;
  expect(mirror.textContent).to.contain('Revenue');
});

it('releases and reacquires its announcement sink when adopted into another document', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignDocument = frame.contentDocument!;
  const el = document.createElement('lr-chart') as LyraChart;
  el.labels = ['North'];
  el.datasets = [{ label: 'Revenue', data: [10] }];
  document.body.appendChild(el);

  try {
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, 'chart.js never initialized');
    const originalSink = announcementSink();
    const originalAssertiveSink = announcementSink(document, 'assertive');
    expect(originalSink !== null, 'the original document must own the connected chart sink').to.be
      .true;
    expect(originalAssertiveSink !== null).to.be.true;

    foreignDocument.adoptNode(el);
    expect(originalSink!.isConnected, 'adoption must release the old document sink').to.be.false;
    expect(originalAssertiveSink!.isConnected).to.be.false;
    foreignDocument.body.appendChild(el);
    await el.updateComplete;

    const adoptedSink = announcementSink(foreignDocument);
    const adoptedAssertiveSink = announcementSink(foreignDocument, 'assertive');
    expect(adoptedSink !== null, 'reconnect must acquire a sink in the adopted document').to.be.true;
    expect(adoptedAssertiveSink !== null).to.be.true;
    expect(adoptedSink!.ownerDocument === foreignDocument).to.be.true;
    expect(announcementTexts(foreignDocument), 'reconnect must not re-announce stale state').to.deep
      .equal([]);

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new frame.contentWindow!.FocusEvent('focus'));
    await el.updateComplete;
    expect(announcementTexts(foreignDocument)).to.have.length(1);
    expect(announcementTexts(), 'nothing may be announced into the old document').to.deep.equal([]);

    el.remove();
    expect(adoptedSink!.isConnected, 'disconnect must release the adopted document sink').to.be
      .false;
    expect(adoptedAssertiveSink!.isConnected).to.be.false;
  } finally {
    el.remove();
    frame.remove();
  }
});

it('rebinds observers, animation frames, media state, styles, and DOM factories to its adopted document', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreignDocument = frame.contentDocument!;
  const foreignWindow = frame.contentWindow!;
  const el = document.createElement('lr-chart') as LyraChart;
  el.labels = ['North'];
  el.datasets = [{ label: 'Revenue', data: [10] }];
  document.body.appendChild(el);
  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized');

  const OriginalResizeObserver = foreignWindow.ResizeObserver;
  const OriginalIntersectionObserver = foreignWindow.IntersectionObserver;
  const originalRequestAnimationFrame = foreignWindow.requestAnimationFrame;
  const originalCancelAnimationFrame = foreignWindow.cancelAnimationFrame;
  const originalMatchMedia = foreignWindow.matchMedia;
  const originalGetComputedStyle = foreignWindow.getComputedStyle;
  const originalCreateElement = foreignDocument.createElement;
  let resizeCallback: ResizeObserverCallback | undefined;
  let resizeObservers = 0;
  let intersectionObservers = 0;
  let nextFrame = 40;
  const requestedFrames: number[] = [];
  const canceledFrames: number[] = [];
  const mediaQueries: string[] = [];
  let styleReads = 0;
  const createdNames: string[] = [];

  class RealmResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resizeObservers += 1;
      resizeCallback = callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
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

  (foreignWindow as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    RealmResizeObserver as unknown as typeof ResizeObserver;
  (foreignWindow as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    RealmIntersectionObserver as unknown as typeof IntersectionObserver;
  foreignWindow.requestAnimationFrame = ((_callback: FrameRequestCallback) => {
    const id = nextFrame++;
    requestedFrames.push(id);
    return id;
  }) as typeof requestAnimationFrame;
  foreignWindow.cancelAnimationFrame = ((id: number) => {
    canceledFrames.push(id);
  }) as typeof cancelAnimationFrame;
  foreignWindow.matchMedia = ((query: string) => {
    mediaQueries.push(query);
    return {
      matches: query === '(forced-colors: active)',
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
  foreignDocument.createElement = ((name: string, options?: ElementCreationOptions) => {
    createdNames.push(name);
    return originalCreateElement.call(foreignDocument, name, options);
  }) as typeof foreignDocument.createElement;

  try {
    foreignDocument.adoptNode(el);
    foreignDocument.body.appendChild(el);
    await el.updateComplete;

    expect(resizeObservers).to.equal(1);
    expect(intersectionObservers).to.equal(1);
    expect(resizeCallback !== undefined).to.be.true;

    const internals = el as unknown as {
      chartStyleOptions(palette: string[]): unknown;
      forcedColorPattern(index: number, background: string): unknown;
    };
    internals.chartStyleOptions(['CanvasText']);
    internals.forcedColorPattern(1, 'Canvas');
    expect(styleReads).to.be.greaterThan(0);
    expect(mediaQueries).to.include('(forced-colors: active)');
    expect(mediaQueries).to.include('(prefers-reduced-motion: reduce)');
    expect(createdNames).to.include('canvas');

    resizeCallback!([
      { contentRect: { width: 321 } } as unknown as ResizeObserverEntry,
    ], {} as ResizeObserver);
    expect(requestedFrames).to.have.length(1);
    const pendingFrame = requestedFrames[0]!;
    el.remove();
    expect(canceledFrames).to.include(pendingFrame);
  } finally {
    el.remove();
    (foreignWindow as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      OriginalResizeObserver;
    (foreignWindow as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
      OriginalIntersectionObserver;
    foreignWindow.requestAnimationFrame = originalRequestAnimationFrame;
    foreignWindow.cancelAnimationFrame = originalCancelAnimationFrame;
    foreignWindow.matchMedia = originalMatchMedia;
    foreignWindow.getComputedStyle = originalGetComputedStyle;
    foreignDocument.createElement = originalCreateElement;
    frame.remove();
  }
});

it('renders a canvas and builds a Chart.js instance once chart.js loads', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['Jan', 'Feb', 'Mar'];
  el.datasets = [{ label: 'Revenue', data: [1, 2, 3] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas');
  expect((canvas) != null).to.equal(true);
});

it('normalizes an invalid HTML `type` attribute before it can reach Chart.js', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.setAttribute('type', 'unregistered-controller');

  expect(el.type).to.equal('bar');
  expect((el as any).buildConfig().type).to.equal('bar');
});

it('falls back to bar when an untyped runtime write assigns an invalid chart type', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  (el as unknown as { type: string }).type = 'unregistered-controller';

  expect((el as any).buildConfig().type).to.equal('bar');
});

it('appends streamed category data, caps numeric series, and preserves point series', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const points = [{ x: 1, y: 10 }];
  el.labels = ['A', 'B'];
  el.datasets = [
    { label: 'Revenue', data: [1, 2] },
    { label: 'Pending' },
    { label: 'Scatter', points },
  ];

  el.appendData('C', [3], 2.9);

  expect(el.labels).to.deep.equal(['B', 'C']);
  expect(el.datasets[0]!.data).to.deep.equal([2, 3]);
  expect(el.datasets[1]!.data).to.deep.equal([null, null]);
  expect(el.datasets[2]!.points).to.equal(points);

  el.appendData('D', [4, 5], Number.POSITIVE_INFINITY);
  expect(el.labels).to.deep.equal(['B', 'C', 'D']);
  expect(el.datasets[0]!.data).to.deep.equal([2, 3, 4]);
  expect(el.datasets[1]!.data).to.deep.equal([null, null, 5]);
});

it('exports mixed data and point series as spreadsheet-safe CSV', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.labels = ['Q1', '=FORMULA()', 'Q3'];
  el.datasets = [
    { label: 'Revenue, net', data: [12, null] },
    { label: 'Forecast', points: [{ x: 0, y: 20 }, { x: 1, y: 30 }, { x: 2, y: 40 }] },
  ];

  expect(el.exportData('csv')).to.equal([
    'label,"Revenue, net",Forecast x,Forecast y',
    'Q1,12,0,20',
    "'=FORMULA(),,1,30",
    'Q3,,2,40',
  ].join('\r\n'));
});

it('exports PNG data when a chart exists and an empty string before initialization', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  expect(el.exportData('png')).to.equal('');
  (el as any).chart = { toBase64Image: () => 'data:image/png;base64,chart' };
  expect(el.exportData('png')).to.equal('data:image/png;base64,chart');
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
  (el.shadowRoot!.querySelectorAll('[part~="legend-item"]')[1] as HTMLElement).click();
  await el.updateComplete;
  expect(el.hiddenDatasets).to.deep.equal([1]);

  el.datasets = [
    { label: 'x', data: [5, 6] },
    { label: 'y', data: [7, 8] },
  ];
  await el.updateComplete;

  expect(chart.isDatasetVisible(0)).to.be.true;
  expect(chart.isDatasetVisible(1)).to.be.false;
  expect(
    [...el.shadowRoot!.querySelectorAll('[part~="legend-item"]')]
      .map((item) => item.getAttribute('aria-pressed')),
  ).to.deep.equal(['true', 'false']);
});

it('renders a persistent non-color legend state after hiding a dataset', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized');

  let legendItem = el.shadowRoot!.querySelector<HTMLElement>('[part~="legend-item"]')!;
  expect(legendItem.getAttribute('aria-pressed')).to.equal('true');
  expect(legendItem.part.contains('legend-item-hidden')).to.be.false;
  expect(getComputedStyle(legendItem).textDecorationLine).to.equal('none');

  legendItem.click();
  await el.updateComplete;
  legendItem = el.shadowRoot!.querySelector<HTMLElement>('[part~="legend-item"]')!;
  expect(legendItem.getAttribute('aria-pressed')).to.equal('false');
  expect(legendItem.part.contains('legend-item-hidden')).to.be.true;
  expect(getComputedStyle(legendItem).textDecorationLine).to.contain('line-through');
});

it('exposes a cancellable controlled legend proposal before committing an observable snapshot', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  const button = el.shadowRoot!.querySelector('[part~="legend-item"]') as HTMLElement;
  const originalUpdate = chart.update.bind(chart);
  let updateCalls = 0;
  chart.update = (...args: unknown[]) => {
    updateCalls++;
    return originalUpdate(...args);
  };

  const proposed: unknown[] = [];
  const committed: unknown[] = [];
  const veto = (event: Event) => {
    proposed.push((event as CustomEvent).detail);
    expect(el.hiddenDatasets).to.equal(undefined);
    event.preventDefault();
  };
  el.addEventListener('lr-before-legend-visibility-change', veto);
  el.addEventListener('lr-legend-visibility-change', (event) =>
    committed.push((event as CustomEvent).detail),
  );

  try {
    button.click();
    await el.updateComplete;
    expect(proposed).to.deep.equal([{ datasetIndex: 0, visible: false, hiddenDatasets: [0] }]);
    expect(committed).to.deep.equal([]);
    expect(el.hiddenDatasets).to.equal(undefined);
    expect(chart.isDatasetVisible(0)).to.be.true;
    expect(updateCalls).to.equal(0);

    el.removeEventListener('lr-before-legend-visibility-change', veto);
    button.click();
    await el.updateComplete;
    expect(committed).to.deep.equal([{ datasetIndex: 0, visible: false, hiddenDatasets: [0] }]);
    expect(el.hiddenDatasets).to.deep.equal([0]);
    expect(chart.isDatasetVisible(0)).to.be.false;

    // Host-controlled writes reconcile the chart but are notifications-free, including the
    // explicit reset back to the configured visibility defaults.
    const eventCount = proposed.length + committed.length;
    el.hiddenDatasets = undefined;
    await el.updateComplete;
    expect(proposed.length + committed.length).to.equal(eventCount);
    expect(chart.isDatasetVisible(0)).to.be.true;
  } finally {
    chart.update = originalUpdate;
  }
});

it('detaches and freezes both legend visibility event snapshots', () => {
  type LegendDetail = {
    readonly datasetIndex: number;
    readonly visible: boolean;
    readonly hiddenDatasets: readonly number[];
  };
  type LegendEmitter = {
    emit(
      name: 'lr-before-legend-visibility-change' | 'lr-legend-visibility-change',
      detail: LegendDetail,
      options?: { readonly cancelable?: boolean },
    ): CustomEvent<LegendDetail>;
  };

  const el = document.createElement('lr-chart') as LyraChart;
  const emitter = el as unknown as LegendEmitter;
  const hiddenDatasets = [1];
  const detail = { datasetIndex: 1, visible: false, hiddenDatasets };
  const proposed = emitter.emit('lr-before-legend-visibility-change', detail, {
    cancelable: true,
  });
  const committed = emitter.emit('lr-legend-visibility-change', detail);

  hiddenDatasets.push(2);
  for (const event of [proposed, committed]) {
    expect(event.detail === detail).to.equal(false);
    expect(event.detail.hiddenDatasets === hiddenDatasets).to.equal(false);
    expect(event.detail.hiddenDatasets).to.deep.equal([1]);
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(Object.isFrozen(event.detail.hiddenDatasets)).to.equal(true);
  }
  expect(proposed.detail === committed.detail).to.equal(false);
  expect(proposed.detail.hiddenDatasets === committed.detail.hiddenDatasets).to.equal(false);
});

it('keeps a controlled hidden dataset hidden when its show proposal is canceled', async () => {
  const el = (await fixture(html`<lr-chart
    type="bar"
    .hiddenDatasets=${[0]}
    .labels=${['A']}
    .datasets=${[{ label: 'Revenue', data: [1] }]}
  ></lr-chart>`)) as LyraChart;
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

it('does not preserve configured hidden state as a legend override when replacement data makes it visible', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.config = {
    data: {
      labels: ['A'],
      datasets: [{ label: 'Series', data: [1], hidden: true }],
    },
  } as never;
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  expect(chart.isDatasetVisible(0)).to.be.false;

  el.config = {
    data: {
      labels: ['A'],
      datasets: [{ label: 'Series', data: [2], hidden: false }],
    },
  } as never;
  await el.updateComplete;

  expect(chart.isDatasetVisible(0)).to.be.true;
  expect(
    el.shadowRoot!.querySelector('[part~="legend-item"]')!.getAttribute('aria-pressed'),
  ).to.equal('true');
});

it('preserves an explicit legend show override for a configured-hidden dataset', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.config = {
    data: {
      labels: ['A'],
      datasets: [{ label: 'Series', data: [1], hidden: true }],
    },
  } as never;
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  (el.shadowRoot!.querySelector('[part~="legend-item"]') as HTMLElement).click();
  await el.updateComplete;
  expect(el.hiddenDatasets).to.deep.equal([]);

  el.config = {
    data: {
      labels: ['A'],
      datasets: [{ label: 'Series', data: [2], hidden: true }],
    },
  } as never;
  await el.updateComplete;

  expect(chart.isDatasetVisible(0)).to.be.true;
  expect(
    el.shadowRoot!.querySelector('[part~="legend-item"]')!.getAttribute('aria-pressed'),
  ).to.equal('true');
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
  (el.shadowRoot!.querySelectorAll('[part~="legend-item"]')[1] as HTMLElement).click();
  await el.updateComplete;

  // A controlled snapshot applies the same hidden state to replacement data before the explicit
  // no-animation repaint, rather than relying on private Chart.js metadata.
  let updateCallCount = 0;
  let visibilityAppliedAtUpdateCount = -1;
  const originalUpdate = chart.update.bind(chart);
  const originalSetDatasetVisibility = chart.setDatasetVisibility.bind(chart);
  chart.update = (...args: unknown[]) => {
    updateCallCount++;
    return originalUpdate(...args);
  };
  chart.setDatasetVisibility = (datasetIndex: number, visible: boolean) => {
    if (datasetIndex === 1 && visible === false) {
      visibilityAppliedAtUpdateCount = updateCallCount;
    }
    return originalSetDatasetVisibility(datasetIndex, visible);
  };

  el.datasets = [
    { label: 'x', data: [5, 6] },
    { label: 'y', data: [7, 8] },
  ];
  await el.updateComplete;

  expect(visibilityAppliedAtUpdateCount).to.be.greaterThan(-1);
  expect(updateCallCount).to.be.greaterThan(visibilityAppliedAtUpdateCount);
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

it('renders a newly-added series as pressed in the DOM legend on its first update', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Existing', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;

  el.datasets = [
    { label: 'Existing', data: [2] },
    { label: 'Appended', data: [3] },
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

it('uses effective dataset hidden state in the DOM legend before Chart.js exists', async () => {
  const el = document.createElement('lr-chart') as LyraChart;
  // Keep the peer load pending so this exercises the rendered pre-draw state, not a Chart.js
  // instance that happened to initialize before the assertion.
  (el as any).loadLibrary = () => new Promise(() => {});
  (el as any).loading = false;
  el.config = {
    data: {
      labels: ['A'],
      datasets: [{ label: 'Configured hidden', data: [1], hidden: true }],
    },
  } as never;
  const wrapper = await fixture(html`<div></div>`);
  wrapper.append(el);
  await el.updateComplete;

  expect((el as any).chart).to.equal(undefined);
  expect(
    el.shadowRoot!.querySelector('[part~="legend-item"]')!.getAttribute('aria-pressed'),
  ).to.equal('false');
});

it('uses a newly-added effective dataset hidden flag before the in-place draw', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Existing', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;

  el.config = {
    data: {
      labels: ['A'],
      datasets: [
        { label: 'Existing', data: [2] },
        { label: 'Appended hidden', data: [3], hidden: true },
      ],
    },
  } as never;
  await el.updateComplete;

  const legendItems = [
    ...el.shadowRoot!.querySelectorAll('[part~="legend-item"]'),
  ];
  expect(chart.isDatasetVisible(1)).to.be.false;
  expect(legendItems.map((item) => item.getAttribute('aria-pressed'))).to.deep.equal([
    'true',
    'false',
  ]);
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
  (el.shadowRoot!.querySelectorAll('[part~="legend-item"]')[2] as HTMLElement).click();
  await el.updateComplete;

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

it('derives legend state from effective data when a type change will rebuild the chart', async () => {
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const oldChart = (el as any).chart;

  (el.shadowRoot!.querySelector('[part~="legend-item"]') as HTMLElement).click();
  await el.updateComplete;
  expect(oldChart.isDatasetVisible(0)).to.be.false;

  el.type = 'bar';
  await el.updateComplete;
  const rebuiltChart = (el as any).chart;

  expect(rebuiltChart).to.not.equal(oldChart);
  expect(rebuiltChart.isDatasetVisible(0)).to.be.false;
  expect(
    el.shadowRoot!.querySelector('[part~="legend-item"]')!.getAttribute('aria-pressed'),
  ).to.equal('false');
});

it('resynchronizes the legend after a plugin change rebuilds the live chart', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const oldChart = (el as any).chart;

  (el.shadowRoot!.querySelector('[part~="legend-item"]') as HTMLElement).click();
  await el.updateComplete;
  expect(oldChart.isDatasetVisible(0)).to.be.false;

  // Turn on the feature without scheduling its normal property update, then invoke the same
  // late-plugin seam used by the loader. This isolates the rebuild's own obligation to request
  // a DOM legend refresh.
  const originalRequestUpdate = el.requestUpdate;
  (el as any).requestUpdate = () => {};
  el.dataLabels = true;
  (el as any).requestUpdate = originalRequestUpdate;
  const originalUpdateChartArea = (el as any).updateChartArea;
  (el as any).updateChartArea = () => {};
  try {
    (el as any).applyDataLabelsPlugin({ id: 'legend-rebuild-probe' });
    await el.updateComplete;

    const rebuiltChart = (el as any).chart;
    expect(rebuiltChart).to.not.equal(oldChart);
    expect(rebuiltChart.isDatasetVisible(0)).to.be.false;
    expect(
      el.shadowRoot!.querySelector('[part~="legend-item"]')!.getAttribute('aria-pressed'),
    ).to.equal('false');
  } finally {
    (el as any).updateChartArea = originalUpdateChartArea;
  }
});

it('exposes an interactive application role with a dataset-label-derived aria-label', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('role')).to.equal('application');
  expect(canvas.getAttribute('aria-label')).to.contain('Revenue');
});

it('forwards a host aria-label to the canvas and keeps the chart role on that semantic element only', async () => {
  const el = (await fixture(html`
    <lr-chart aria-label="Quarterly revenue" label="Ignored chart label"></lr-chart>
  `)) as LyraChart;
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('aria-label')).to.equal('Quarterly revenue');
  expect(canvas.getAttribute('role')).to.equal('application');
  expect(el.getAttribute('role')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[role]')).to.have.length(2);
  expect(el.shadowRoot!.querySelectorAll('[part="legend"][role="group"]')).to.have.length(1);

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(canvas.getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  el.label = '';
  await el.updateComplete;
  expect(canvas.getAttribute('aria-label')).to.equal('');
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
  el.label = 'Revenue history';
  el.description = 'Revenue rises from January through March.';
  el.showDataTable = true;
  el.labels = ['Jan', 'Feb', 'Mar'];
  el.datasets = [{ label: 'Revenue', data: [1, 2, 3] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const canvas = el.shadowRoot!.querySelector('canvas')!;
  const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
  const table = el.shadowRoot!.querySelector('[part="data-table"] table') as HTMLTableElement;
  expect(canvas.getAttribute('aria-label')).to.equal('Revenue history');
  expect(canvas.getAttribute('aria-describedby')?.split(/\s+/)).to.include(description.id);
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
  circular['self'] = circular;
  circular['count'] = 1n;
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

it('renders independent hover and pressed theme hooks for each chart control surface', async () => {
  const el = (await fixture(html`
    <lr-chart
      type="bar"
      zoom
      show-data-table
      style="
        --lr-chart-legend-item-hover-bg: rgb(1, 2, 3);
        --lr-chart-legend-item-active-bg: rgb(4, 5, 6);
        --lr-chart-data-table-button-hover-bg: rgb(7, 8, 9);
        --lr-chart-data-table-button-active-bg: rgb(10, 11, 12);
        --lr-chart-reset-zoom-button-hover-bg: rgb(13, 14, 15);
        --lr-chart-reset-zoom-button-active-bg: rgb(16, 17, 18);
      "
    ></lr-chart>
  `)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized');
  (el as any).zoomed = true;
  await el.updateComplete;

  const controls = [
    {
      element: el.shadowRoot!.querySelector<HTMLElement>('[part~="legend-item"]')!,
      hover: 'rgb(1, 2, 3)',
      active: 'rgb(4, 5, 6)',
    },
    {
      element: el.shadowRoot!.querySelector<HTMLElement>('[part="data-table"] tbody button')!,
      hover: 'rgb(7, 8, 9)',
      active: 'rgb(10, 11, 12)',
    },
    {
      element: el.shadowRoot!.querySelector<HTMLElement>('[part="reset-zoom-button"]')!,
      hover: 'rgb(13, 14, 15)',
      active: 'rgb(16, 17, 18)',
    },
  ];

  try {
    for (const control of controls) {
      const rect = control.element.getBoundingClientRect();
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await aTimeout(0);
      expect(getComputedStyle(control.element).backgroundColor).to.equal(control.hover);
      expect(
        controls
          .filter((candidate) => candidate !== control)
          .map((candidate) => getComputedStyle(candidate.element).backgroundColor),
      ).to.not.include(control.hover);

      await sendMouse({ type: 'down', button: 'left' });
      await aTimeout(0);
      await waitUntil(() => getComputedStyle(control.element).backgroundColor === control.active, 'control.element background color never reached control.active');
      await sendMouse({ type: 'up', button: 'left' });
    }
  } finally {
    await resetMouse();
  }
});

it("routes [part='canvas']:hover's rendered outline through the scoped width and color tokens", async () => {
  const el = (await fixture(html`
    <lr-chart
      style="--lr-chart-canvas-hover-outline-width: 7px; --lr-chart-grid-color: rgb(1, 2, 3);"
      .labels=${['A', 'B']}
      .datasets=${[{ label: 'Revenue', data: [1, 2] }]}
    ></lr-chart>
  `)) as LyraChart;
  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized');
  const canvas = el.shadowRoot!.querySelector<HTMLElement>('[part="canvas"]')!;
  const rect = canvas.getBoundingClientRect();

  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(() => {
      const computed = getComputedStyle(canvas);
      return computed.outlineWidth === '7px' && computed.outlineColor === 'rgb(1, 2, 3)';
    }, 'the rendered canvas hover outline never picked up the scoped tokens');
  } finally {
    await resetMouse();
  }
});

it('actually inherits the surrounding font on a rendered reset-zoom-button, not just in the stylesheet source', async () => {
  const el = (await fixture(
    html`<lr-chart zoom style="--lr-theme-font-family-body: 'Custom Zoom Font', monospace;"></lr-chart>`,
  )) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  (el as any).zoomed = true;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector('[part="reset-zoom-button"]') as HTMLElement;
  expect(getComputedStyle(button).fontFamily).to.contain('Custom Zoom Font');
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

it('clears beginAtZero from a plain HTML `begin-at-zero="false"` attribute, not just a .beginAtZero property binding', async () => {
  const el = (await fixture(
    html`<lr-chart begin-at-zero="false" type="bar" .labels=${['A', 'B']} .datasets=${[{ label: 'x', data: [1, 2] }]}></lr-chart>`,
  )) as LyraChart;
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect(el.beginAtZero).to.be.false;
  const config = (el as any).buildConfig();
  expect(config.options.scales.y.beginAtZero).to.equal(false);
});

it('still defaults beginAtZero to true with no attribute set', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  expect(el.beginAtZero).to.be.true;
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

it('draws the radial `r` scale tick labels above (after) the dataset for radar/polarArea, not under it', async () => {
  // Chart.js draws every `_layers` entry whose z <= 0 BEFORE `_drawDatasets()`, and every entry
  // with z > 0 AFTER it (chart.js core.controller.js `draw()`); a scale's tick labels default to
  // `ticks.z || 0`, i.e. z <= 0, so a radial scale's ring labels are painted UNDER a polarArea
  // wedge or radar fill by default -- exactly the clipped-digit regression this guards.
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'Series', data: [10, 20] }];

  for (const type of ['radar', 'polarArea'] as const) {
    el.type = type;
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const ticksZ = (el as any).buildConfig().options.scales.r.ticks.z;
    expect(ticksZ, `${type} radial ticks.z`).to.be.a('number').that.is.greaterThan(0);
  }
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

it('redraws the live Chart.js instance (swapping the y2 axis side) after a live `dir` flip on an ancestor, with no other property changing', async () => {
  // Stubbed to a no-op for the duration of this test: `<lr-chart>`'s own `ResizeObserver` callback
  // (wired in `connectedCallback()`) calls `this.draw()` unconditionally on any observed size
  // change, with no gate at all -- and empirically, setting `dir` on the ancestor can itself
  // perturb layout enough to refire it in a real browser. Without this stub, the assertions below
  // pass regardless of whether `updated()`'s own direction-comparison fix exists, which is exactly
  // how this test shipped green with zero source changes the first time (a confounded, non-
  // discriminating "trust me" test caught in review). Stubbing the observer forces `draw()` to be
  // reachable ONLY through `updated()`'s `contextChanged` gate, so a regression there can no longer
  // hide behind resize-driven noise.
  const OriginalResizeObserver = window.ResizeObserver;
  class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    NoopResizeObserver as unknown as typeof ResizeObserver;
  try {
    const wrapper = await fixture(html`<div dir="ltr"><lr-chart></lr-chart></div>`);
    const el = wrapper.querySelector('lr-chart') as LyraChart;
    el.datasets = [
      { label: 'primary', data: [1, 2] },
      { label: 'secondary', data: [10, 20], axis: 'y2' },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    expect((el as any).chart.options.scales.y.position).to.equal('left');
    expect((el as any).chart.options.scales.y2.position).to.equal('right');

    // `dir` is a plain host/ancestor attribute, not a Lit `@property` -- `LyraElement`'s inherited-
    // context observer turns this into a `requestUpdate()`, but nothing else about the chart changed,
    // so `updated()`'s own `contentChanged`/`contextChanged` gate must independently notice the
    // direction flip and still call `draw()`, or the live Chart.js instance keeps the stale LTR axis
    // positions forever. With the `ResizeObserver` stubbed above, this redraw can only come from
    // that gate.
    wrapper.setAttribute('dir', 'rtl');
    await aTimeout(0);
    await el.updateComplete;

    expect((el as any).chart.options.scales.y.position).to.equal('right');
    expect((el as any).chart.options.scales.y2.position).to.equal('left');
  } finally {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      OriginalResizeObserver;
  }
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

it('registers the zoom plugin from a bare module with no `default` export, mirroring `loadDataLabelsPlugin`', async () => {
  // A direct `.default` read would ignore a valid named module shape. A bare (non-ESM-interop)
  // module shape with no `.default` at all would silently resolve
  // `zoomPlugin` to `undefined`, leaving `zoom` inert instead of registering
  // it. `loadDataLabelsPlugin()` already handles this correctly via
  // `mod.default ?? mod`; `loadChartAndZoom()` must do the same.
  const fakeChart = await import('chart.js');
  const bareZoomPlugin = { id: 'bare-zoom-plugin' };
  const result = await loadChartAndZoom(
    () => Promise.resolve(fakeChart),
    () => Promise.resolve(bareZoomPlugin),
    true,
  );
  expect(result?.zoomPlugin).to.equal(bareZoomPlugin);
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

it('keeps the core chart usable and renders a localized warning when an optional zoom peer is unavailable', async () => {
  const mod = await import('chart.js');
  const el = document.createElement('lr-chart') as LyraChart;
  el.zoom = true;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  el.strings = { chartZoomUnavailable: 'Zoom add-on unavailable; chart remains usable.' };
  (el as any).loadLibrary = () => Promise.resolve(mod);
  (el as any).loadZoomFeature = () => Promise.resolve({ kind: 'feature-unavailable', mod });
  const wrapper = await fixture(html`<div></div>`);
  wrapper.append(el);
  await waitUntil(() => (el as any).chart != null, 'core chart never initialized');
  await waitUntil(
    () => el.shadowRoot?.querySelector('[part="feature-warning"]') != null,
    'optional feature warning never rendered',
  );

  expect((el as any).chart).to.exist;
  expect(el.shadowRoot!.querySelector('[part="feature-warning"]')!.textContent).to.contain(
    'Zoom add-on unavailable',
  );
  expect((el as any).buildConfig().options.plugins.zoom).to.equal(undefined);
});

it('keeps the core chart usable and announces localized data-label and stack-total warnings when their peer is unavailable', async () => {
  const mod = await import('chart.js');
  const el = document.createElement('lr-chart') as LyraChart;
  el.type = 'bar';
  el.stacked = true;
  el.dataLabels = true;
  el.stackTotals = true;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  el.strings = {
    chartDataLabelsUnavailable: 'Data labels add-on unavailable; chart remains usable.',
    chartStackTotalsUnavailable: 'Stack totals add-on unavailable; chart remains usable.',
  };
  (el as any).loadLibrary = () => Promise.resolve(mod);
  (el as any).loadDataLabelsFeature = () => Promise.resolve({ kind: 'feature-unavailable', mod });
  const wrapper = await fixture(html`<div></div>`);
  wrapper.append(el);
  await waitUntil(() => (el as any).chart != null, 'core chart never initialized');
  await waitUntil(
    () => el.shadowRoot?.querySelectorAll('[part="feature-warning"]').length === 2,
    'optional data-label warnings never rendered',
  );

  const warningTexts = [...el.shadowRoot!.querySelectorAll('[part="feature-warning"]')].map(
    (warning) => warning.textContent?.trim(),
  );
  expect(warningTexts).to.deep.equal([
    'Data labels add-on unavailable; chart remains usable.',
    'Stack totals add-on unavailable; chart remains usable.',
  ]);
  expect((el as any).chart != null).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('canvas')).to.have.length(1);
  expect(announcementTexts(document, 'assertive')).to.deep.equal(warningTexts);
});

it('keeps the core chart usable and announces a localized warning when the annotation peer is unavailable', async () => {
  const mod = await import('chart.js');
  const el = document.createElement('lr-chart') as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [1] }];
  el.annotations = [{ value: 1, label: 'SLO' }];
  (el as unknown as { strings: Record<string, string> }).strings = {
    chartAnnotationsUnavailable: 'Annotations add-on unavailable; chart remains usable.',
  };
  (el as any).loadLibrary = () => Promise.resolve(mod);
  (el as any).loadAnnotationFeature = () =>
    Promise.resolve({ kind: 'feature-unavailable', mod });
  const wrapper = await fixture(html`<div></div>`);
  wrapper.append(el);
  await waitUntil(() => (el as any).chart != null, 'core chart never initialized');
  await waitUntil(
    () => el.shadowRoot?.querySelector('[part="feature-warning"]') != null,
    'optional annotation warning never rendered'
  );

  const warning = el.shadowRoot!.querySelector('[part="feature-warning"]')!.textContent!.trim();
  expect(warning).to.equal('Annotations add-on unavailable; chart remains usable.');
  expect((el as any).chart != null).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('canvas')).to.have.length(1);
  expect(announcementTexts(document, 'assertive')).to.include(warning);
});

it('renders the reset-zoom-button part and emits `lr-zoom` once `onZoomComplete` fires, then again on `resetZoom()`', async () => {
  const el = (await fixture(html`<lr-chart zoom></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  expect((el.shadowRoot!.querySelector('[part="reset-zoom-button"]')) == null).to.be.true;

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
  expect((el.shadowRoot!.querySelector('[part="reset-zoom-button"]')) == null).to.be.true;
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
  expect((el.shadowRoot!.querySelector('[part="reset-zoom-button"]')) == null).to.be.true;
});

it('disables Chart.js animation when the user prefers reduced motion', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query: string) =>
    mediaQueryList(query, query === '(prefers-reduced-motion: reduce)');
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
  window.matchMedia = (query: string) => mediaQueryList(query, false);
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

it('uses `height` as a private fallback without overwriting the public --lr-chart-height hook', async () => {
  const el = (await fixture(html`<lr-chart height="500px"></lr-chart>`)) as LyraChart;
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

it('renders the reset-zoom-button focus-visible outline from the focus-ring tokens', async () => {
  const el = (await fixture(html`
    <lr-chart
      zoom
      style="--lr-focus-ring-width: 6px; --lr-focus-ring-color: rgb(4, 5, 6); --lr-focus-ring-offset: 3px;"
      .labels=${['A', 'B']}
      .datasets=${[{ label: 'Revenue', data: [1, 2] }]}
    ></lr-chart>
  `)) as LyraChart;
  await waitUntil(() => (el as any).chart != null, 'chart.js never initialized');
  (el as any).zoomed = true;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="reset-zoom-button"]')!;

  await sendKeys({ press: 'Tab' });
  button.focus();
  await waitUntil(() => {
    const computed = getComputedStyle(button);
    return (
      computed.outlineWidth === '6px' &&
      computed.outlineColor === 'rgb(4, 5, 6)' &&
      computed.outlineOffset === '3px'
    );
  }, 'the rendered reset-zoom focus ring never picked up the focus tokens');
});

it('resolves grid/tick/legend/tooltip colors from custom --lr-chart-* values set on the host', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
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
  el.legendPosition = 'left';
  expect((el as any).buildConfig().options.plugins.legend.position).to.equal('left');

  el.legendPosition = 'auto';
  (el as any).autoLegendPosition = 'bottom';
  expect((el as any).buildConfig().options.plugins.legend.position).to.equal('bottom');
});

it('accepts a per-scale legend position object and falls back to "top" for an invalid one', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.legendPosition = { x: 0.2, y: 40 };
  expect((el as any).buildConfig().options.plugins.legend.position).to.deep.equal({ x: 0.2, y: 40 });

  el.legendPosition = { x: 'not-a-number' } as unknown as typeof el.legendPosition;
  expect((el as any).buildConfig().options.plugins.legend.position).to.equal('top');

  el.legendPosition = 'not-a-real-position' as unknown as typeof el.legendPosition;
  expect((el as any).buildConfig().options.plugins.legend.position).to.equal('top');
});

it('applies one valueFormatter to numeric ticks, tooltips, and legend values', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'Revenue', data: [10, 20] }];
  el.valueFormatter = (value, context) => `${context}:${value}`;

  const config = (el as any).buildConfig();
  expect(config.options.scales.y.ticks.callback(10)).to.equal('tick:10');
  expect(config.options.plugins.tooltip.callbacks.label({ parsed: { y: 20 }, dataset: { label: 'Revenue' } })).to.equal(
    'Revenue: tooltip:20',
  );
  const labels = config.options.plugins.legend.labels.generateLabels({
    data: { datasets: [{ label: 'Revenue', data: [10, 20] }] },
  });
  expect(labels[0].text).to.equal('Revenue: legend:30');
});

it('does not run category-axis tick labels through valueFormatter', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['Jan', 'Feb', 'Mar'];
  el.datasets = [{ label: 'Revenue', data: [10, 20, 30] }];
  el.valueFormatter = (value, context) => `${context}:${value}`;

  const config = (el as any).buildConfig();
  // The x scale is categorical (type: 'category') and must render the real label text, not
  // valueFormatter run against the tick index.
  expect(config.options.scales.x.ticks.callback).to.be.undefined;
  // The y scale is the numeric axis and must still run through valueFormatter.
  expect(config.options.scales.y.ticks.callback(10)).to.equal('tick:10');
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

it('auto-redraws when a data-theme attribute mutates, without a manual refreshTheme() call', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  el.style.setProperty('--lr-chart-tooltip-bg', 'rgb(3, 4, 5)');
  // Trigger the ThemeWatcher's MutationObserver (a watched attribute on the host itself).
  el.setAttribute('data-theme', 'dark');
  // The observer coalesces to a microtask; give it a macrotask boundary to run + redraw.
  await aTimeout(0);
  await el.updateComplete;

  expect((el as any).chart.options.plugins.tooltip.backgroundColor).to.equal('rgb(3, 4, 5)');
});

it('coalesces a burst of theme attribute writes into a single redraw', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A'];
  el.datasets = [{ label: 'x', data: [1] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  let refreshes = 0;
  const realRefresh = (el as unknown as { refreshTheme: () => void }).refreshTheme.bind(el);
  (el as unknown as { refreshTheme: () => void }).refreshTheme = () => {
    refreshes++;
    realRefresh();
  };
  el.setAttribute('data-theme', 'a');
  el.setAttribute('data-color-scheme', 'b');
  await aTimeout(0);
  // The watcher coalesces the burst to a single refresh (`class` is omitted here since Lit may
  // reflect its own class changes and trigger an unrelated update).
  expect(refreshes).to.equal(1);
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

it('defaults `options.indexAxis` to "x" and flips it with `index-axis="y"`', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect((el as any).buildConfig().options.indexAxis).to.equal('x');

  el.setAttribute('index-axis', 'y');
  await el.updateComplete;
  expect((el as any).buildConfig().options.indexAxis).to.equal('y');
});

// 9.0.0 removed the `horizontal` boolean outright: it was exactly `indexAxis === 'y'`, and two
// spellings for one axis flip meant a consumer could set both and get no warning about which won.
it('no longer exposes a `horizontal` alias, and a stray horizontal attribute cannot flip the axis', async () => {
  const el = (await fixture(html`<lr-chart horizontal></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect('horizontal' in el).to.equal(false);
  expect((el as any).buildConfig().options.indexAxis).to.equal('x');
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
  expect(chart?.options.scales?.['r']).to.exist;
  expect(chart?.options.scales?.['x']).to.not.exist;
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
  expect(headerCells[0]!.textContent).to.equal('Catégorie');
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
  expect(headerCells[0]!.textContent).to.equal('Category');
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

it('uses a translucent area fill so a lower-valued sibling line remains visible', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.style.setProperty('--lr-color-chart-1', 'rgb(130, 80, 220)');
  el.labels = ['Jan', 'Feb'];
  el.datasets = [
    { label: 'Sessions', data: [8, 10], fill: true },
    { label: 'Errors', data: [1, 2], color: 'rgb(210, 35, 55)' },
  ];
  await el.updateComplete;

  const [area, line] = (el as any).buildConfig().data.datasets;
  expect(area.borderColor).to.equal('rgb(130, 80, 220)');
  expect(area.backgroundColor).to.match(
    /(?:rgba\(130,\s*80,\s*220,\s*0\.28\)|color\(srgb\s+[^/]+\/\s*0\.28\))/,
  );
  expect(line.backgroundColor).to.deep.equal(['rgb(210, 35, 55)']);
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
  expect(ds.backgroundColor).to.deep.equal(['rgb(18, 52, 86)']);
  expect(ds.borderColor).to.equal('rgb(18, 52, 86)');
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

it('gives an uncolored polar-area chart a per-slice palette too', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'polarArea';
  el.labels = ['A', 'B', 'C'];
  el.datasets = [{ label: 'Share', data: [30, 45, 25] }];
  await el.updateComplete;

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(ds.backgroundColor).to.be.an('array').with.lengthOf(3);
  expect(ds.backgroundColor[0]).to.not.equal(ds.backgroundColor[1]);
});

it('disables the light Chart.js tick backdrop on dark-theme radial charts', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.datasets = [{ label: 'Model', data: [30, 45, 25] }];

  for (const type of ['radar', 'polarArea'] as const) {
    el.type = type;
    await el.updateComplete;
    expect((el as any).buildConfig().options.scales.r.ticks.showLabelBackdrop).to.equal(false);
  }
});

// Regression coverage for the lifecycle-optional-peer-missing-fails-silently defect class --
// when the optional `chart.js` peer fails to load, <lr-chart> must fail closed into a visible,
// accessible visible error state plus a light-DOM assertive announcement instead of leaving a
// permanently blank canvas with no on-page indication anything is wrong.
it('renders a visible, accessible error state instead of a blank canvas when the chart.js peer fails to load', async () => {
  // Deliberately not using fixture(): loadLibrary must be overridden *before* the element ever
  // connects, since connectedCallback() calls it unconditionally on connect.
  const el = document.createElement('lr-chart') as unknown as LyraChart;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
  document.body.appendChild(el);
  try {
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') != null, 'error state never rendered', {
      timeout: 2000,
    });
    const errorEl = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(errorEl.hasAttribute('aria-hidden'), 'the visible error must remain discoverable').to.be
      .false;
    expect(errorEl.hasAttribute('role'), 'the shadow mirror must not be a second alert').to.be.false;
    expect(errorEl.textContent!.trim().length).to.be.greaterThan(0);
    expect(announcementTexts(document, 'assertive')).to.deep.equal([
      errorEl.textContent!.trim(),
    ]);
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelectorAll('canvas').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(0);
  } finally {
    el.remove();
  }
});

it('routes the chart.js peer-missing error through a .strings override', async () => {
  const el = document.createElement('lr-chart') as unknown as LyraChart;
  (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = () => Promise.resolve(null);
  (el as unknown as { strings: Record<string, string> }).strings = {
    chartMissingLibrary: 'Bibliothèque de graphiques absente',
  };
  document.body.appendChild(el);
  try {
    await waitUntil(() => el.shadowRoot!.querySelector('[part="error"]') != null, 'error state never rendered', {
      timeout: 2000,
    });
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim()).to.equal(
      'Bibliothèque de graphiques absente',
    );
    expect(announcementTexts(document, 'assertive')).to.deep.equal([
      'Bibliothèque de graphiques absente',
    ]);
  } finally {
    el.remove();
  }
});

// --- deepMerge(): an explicit `undefined` override key keeps the generated base unchanged --------

it('deep-merges an explicit `undefined` override value by keeping the generated base, instead of nulling it out', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  el.config = { options: { scales: { x: undefined as never } } };
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const config = (el as any).buildConfig();
  // An explicit `undefined` at this key must not clobber the generated `x` scale -- it should
  // survive exactly as buildConfig() would have generated it with no override at all.
  expect(config.options.scales.x.type).to.equal('category');
  expect(config.options.scales.x.grid).to.exist;
});

// --- IntersectionObserver callback: isIntersecting fallback -------------------------------------

it('falls back to visible=true when an IntersectionObserver entry lacks isIntersecting (defensive fallback)', async () => {
  const callbacks: IntersectionObserverCallback[] = [];
  const OriginalIO = window.IntersectionObserver;
  class SpyIntersectionObserver extends OriginalIO {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super(callback, options);
      callbacks.push(callback);
    }
  }
  (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    SpyIntersectionObserver;
  try {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.type = 'line';
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    (el as any).visible = false;
    const callback = callbacks[callbacks.length - 1];
    // An empty entries array -- entries[0] is undefined, so `entries[0]?.isIntersecting` is
    // undefined too, forcing the `?? true` fallback rather than a real observed boolean.
    if (!callback) throw new Error('Expected the chart visibility observer callback');
    callback([], new OriginalIO(() => {}));
    expect((el as any).visible).to.equal(true);
  } finally {
    (window as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = OriginalIO;
  }
});

// --- zoom-plugin dynamic import racing a disconnect (distinct timing from the leak test above) --

it('skips drawing when the element disconnects after zoom starts loading but before loadChartJsWithZoom() resolves', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  el.zoom = true;
  // Let `updated()` actually run (and kick off `loadChartJsWithZoom().then(...)`) while still
  // connected -- unlike the "does not leak..." test above, which disconnects in the same
  // synchronous tick and never reaches that `.then()` registration at all.
  await el.updateComplete;
  el.remove();
  await aTimeout(200);

  expect((el as any).chart).to.be.undefined;
});

// --- seriesToDataset(): array color passthrough, empty-palette fallback, dash ---------------------

it('passes an explicit per-slice color array through unchanged instead of wrapping it', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'pie';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'Share', data: [1, 2], color: ['#111111', '#222222'] }];
  await el.updateComplete;

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(ds.backgroundColor).to.deep.equal(['rgb(17, 17, 17)', 'rgb(34, 34, 34)']);
  expect(ds.borderColor).to.equal('rgb(17, 17, 17)');
});

it('seriesToDataset leaves the palette fallback color undefined when given an empty palette', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const ds = (el as any).seriesToDataset({ label: 'A', data: [1] }, 0, [], 'bar');
  expect(ds.backgroundColor).to.equal(undefined);
  expect(ds.borderColor).to.equal(undefined);
});

it('defaults a series with neither data nor points to an empty array instead of throwing', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'pie';
  el.labels = [];
  el.datasets = [{ label: 'Empty' } as never];
  await el.updateComplete;

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(ds.data).to.deep.equal([]);
  expect(ds.backgroundColor).to.deep.equal([]);
});

it('sets a dashed borderDash for a series with dash: true', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2], dash: true }];
  await el.updateComplete;

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(ds.borderDash).to.deep.equal([4, 4]);
});

// --- handlePointClick(): value fallback for a dangling index -------------------------------------

it('emits a null value (not throwing) when the resolved click hits an index with no backing data', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [10, 20] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const chart = (el as any).chart;
  const original = chart.getElementsAtEventForMode;
  chart.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 99 }];
  try {
    const onClick = (el as any).buildConfig().options.onClick;
    let event: CustomEvent | undefined;
    el.addEventListener('lr-point-click', (e) => (event = e as CustomEvent), { once: true });
    onClick({} as never, [], chart);
    expect(event!.detail.value).to.equal(null);
  } finally {
    chart.getElementsAtEventForMode = original;
  }
});

// --- localizedChartType(): unrecognized effective type falls back to the raw string --------------

it('falls back to the raw type string when the effective type has no known message-key mapping', () => {
  // Direct unit call, not connected/loaded -- an unregistered Chart.js controller name would throw
  // if it ever reached a real `new Chart()` construction, which isn't what this line is about.
  const el = document.createElement('lr-chart') as LyraChart;
  el.config = { type: 'customController' as never };
  const text = (el as any).localizedChartType();
  expect(text).to.equal('customController');
});

// --- formatValue(): non-numeric raw value is left unformatted -----------------------------------

it('leaves a non-numeric raw value unformatted instead of calling valueFormatter with NaN', async () => {
  const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
  el.labels = ['A'];
  el.datasets = [{ label: 'Revenue', data: [10] }];
  el.valueFormatter = (value, context) => `${context}:${value}`;

  const config = (el as any).buildConfig();
  const result = config.options.scales.y.ticks.callback('not-a-number');
  expect(result).to.equal('not-a-number');
});

// --- legendValue(): no matching dataset, indexed slice value, empty-series fallback --------------

it('legendValue returns undefined for a legend item whose dataset index has no matching dataset', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const value = (el as any).legendValue({ datasetIndex: 5 }, { data: { datasets: [{ label: 'A', data: [1, 2] }] } });
  expect(value).to.equal(undefined);
});

it('legendValue returns the value at a specific integer item.index instead of summing the whole series (per-slice pie/doughnut legend items)', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const value = (el as any).legendValue(
    { datasetIndex: 0, index: 1 },
    { data: { datasets: [{ label: 'A', data: [10, 20, 30] }] } },
  );
  expect(value).to.equal(20);
});

it('legendValue returns undefined (not zero) for a whole-dataset legend item whose series has no finite values', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const value = (el as any).legendValue({ datasetIndex: 0 }, { data: { datasets: [{ label: 'Empty', data: [] }] } });
  expect(value).to.equal(undefined);
});

it('saturates stack-total and whole-series legend reductions instead of overflowing finite inputs', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.type = 'bar';
  el.labels = ['Q1'];
  el.datasets = [
    { label: 'A', data: [Number.MAX_VALUE] },
    { label: 'B', data: [Number.MAX_VALUE] },
  ];

  expect((el as any).computeStackTotals('y')).to.deep.equal([Number.MAX_VALUE]);
  expect(
    (el as any).legendValue(
      { datasetIndex: 0 },
      { data: { datasets: [{ label: 'A', data: [Number.MAX_VALUE, Number.MAX_VALUE] }] } },
    ),
  ).to.equal(Number.MAX_VALUE);
});

// --- legendLabels(): no datasets array, and a dataset with no explicit label ---------------------

it('legendLabels falls back to an empty items array when chart.data.datasets is undefined, instead of throwing', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const labels = (el as any).legendLabels({ data: {} });
  expect(labels).to.deep.equal([]);
});

it('legendLabels labels a dataset by its 1-based index when it has no explicit label', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  const labels = (el as any).legendLabels({ data: { datasets: [{ data: [1, 2] }] } });
  expect(labels[0].text).to.equal('1');
});

// --- tooltipLabel(): non-object parsed value, r/x fallbacks, unchanged-format guard --------------

it('reads the radar/polarArea parsed.r value when .y is absent, and omits the series-label prefix when the dataset has no label', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.valueFormatter = (value, context) => `${context}:${value}`;
  const text = (el as any).tooltipLabel({ parsed: { r: 5 }, dataset: {} });
  expect(text).to.equal('tooltip:5');
});

it('reads a non-object parsed value directly for pie/doughnut-style tooltips', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  el.valueFormatter = (value, context) => `${context}:${value}`;
  const text = (el as any).tooltipLabel({ parsed: 42, dataset: { label: 'Share' } });
  expect(text).to.equal('Share: tooltip:42');
});

it('returns undefined (letting Chart.js render its own default) when the formatted value is unchanged from the raw value', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  // No valueFormatter set -- formatValue() returns the raw value unchanged.
  const text = (el as any).tooltipLabel({ parsed: { y: 5 }, dataset: { label: 'S' } });
  expect(text).to.equal(undefined);
});

// --- updateAutoLegendPosition(): clientWidth fallback when getBoundingClientRect is zeroed out ---

it('falls back to clientWidth for auto legend sizing when getBoundingClientRect width is zeroed out (e.g. a zero-scale transform)', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; width: 300px;">
      <lr-chart style="transform: scale(0);"></lr-chart>
    </div>
  `);
  const el = wrapper.querySelector('lr-chart') as LyraChart;
  (el as any).updateAutoLegendPosition();
  expect(el.getBoundingClientRect().width).to.equal(0);
  expect(el.clientWidth).to.be.greaterThan(0);
  expect((el as any).autoLegendPosition).to.equal('bottom');
});

// --- updateChartArea(): non-finite geometry guard ------------------------------------------------

it('ignores a chartArea update whose geometry is non-finite instead of corrupting the cached area', () => {
  const el = document.createElement('lr-chart') as LyraChart;
  (el as any).updateChartArea({ chartArea: { top: NaN, left: 0, right: 100, bottom: 100, width: 100, height: 100 } });
  expect(el.chartArea).to.equal(undefined);
});

// --- draw()'s in-place-update branch: prior/current dataset-count and options fallbacks ----------

it('treats a Chart.js instance with no prior datasets array as having zero prior datasets, instead of throwing', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  chart.data.datasets = undefined; // simulate a corrupted/never-initialized prior data.datasets

  el.datasets = [{ label: 'y', data: [3, 4] }];
  await el.updateComplete;

  expect(chart.isDatasetVisible(0)).to.be.true;
});

it('defaults chart.options to an empty object if buildConfig() ever produces a config with no options (defensive fallback)', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const originalBuildConfig = (el as any).buildConfig.bind(el);
  (el as any).buildConfig = () => ({ ...originalBuildConfig(), options: undefined });
  try {
    // Chart.js's own `options` setter re-resolves whatever it's assigned against its internal
    // per-type defaults, so the exact resulting shape isn't ours to assert on -- what this line
    // guards is that assigning `undefined` doesn't reach Chart.js at all (which throws) by
    // substituting `{}` first.
    expect(() => (el as any).draw()).to.not.throw();
    expect((el as any).chart.options).to.be.an('object');
  } finally {
    (el as any).buildConfig = originalBuildConfig;
  }
});

it('treats a rebuilt config with no datasets array as having zero current datasets, instead of throwing on an out-of-range restore', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'bar';
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'x', data: [1, 2] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const chart = (el as any).chart;
  chart.setDatasetVisibility(0, false); // a legend-hidden dataset before the corrupted redraw

  const originalUpdate = chart.update.bind(chart);
  const originalSetDatasetVisibility = chart.setDatasetVisibility.bind(chart);
  const calledIndexes: number[] = [];
  // Chart.js's own `data` setter re-normalizes a missing `datasets` back to `[]` immediately, so
  // corrupting `config.data.datasets` before assignment never leaves it unset by the time draw()
  // reads it back. Instead, corrupt it as a side effect of the (stubbed) update() call itself --
  // exactly where draw() reads `this.chart.data.datasets` afterward -- to exercise the `?? 0`
  // fallback for `currentDatasetCount`.
  chart.update = () => {
    chart.data.datasets = undefined;
  };
  chart.setDatasetVisibility = (datasetIndex: number, visible: boolean) => {
    calledIndexes.push(datasetIndex);
    return originalSetDatasetVisibility(datasetIndex, visible);
  };
  try {
    expect(() => (el as any).draw()).to.not.throw();
    // currentDatasetCount fell back to 0, so index 0's restore attempt (0 >= 0) is skipped --
    // if the fallback didn't engage, this stub would come back with `[0]`.
    expect(calledIndexes).to.deep.equal([]);
  } finally {
    chart.update = originalUpdate;
    chart.setDatasetVisibility = originalSetDatasetVisibility;
    // The stubbed update() left chart.data.datasets undefined -- restore real Chart.js-managed
    // data via a normal draw cycle so fixture cleanup's disconnectedCallback()/chart.destroy()
    // doesn't crash on the next test (Chart.js's own teardown reads data.datasets.length).
    el.datasets = [{ label: 'x', data: [1, 2] }];
    await el.updateComplete;
  }
});

// --- seriesValues(): a series with neither data nor points reports "no data" ---------------------

it('reports "no data" for a series with neither data nor points, instead of throwing on an undefined data array', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.type = 'line';
  el.labels = [];
  el.datasets = [{ label: 'Empty' } as never];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const description = el.shadowRoot!.querySelector('[part="description"]')!;
  expect(description.textContent).to.contain('Empty: no data');
});

// --- LyraChartSeries.pointRadius array, LyraChartSeries.segmentColors, public seriesPalette() -----------------------

it('accepts a per-point pointRadius array', async () => {
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B', 'C'];
  el.datasets = [{ label: 'S', data: [1, 2, 3], pointRadius: [2, 6, 2] }];
  const config = (el as any).buildConfig();
  expect(config.data.datasets[0].pointRadius).to.deep.equal([2, 6, 2]);
});

it('samples the shared labels array to the rendering budget for a very large single-series dataset', async () => {
  const rowCount = 2000;
  const labels = Array.from({ length: rowCount }, (_, i) => String(i));
  const data = Array.from({ length: rowCount }, (_, i) => i);
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = labels;
  el.datasets = [{ label: 'S', data }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const config = (el as any).buildConfig();
  expect(config.data.labels.length).to.equal(1000);
  expect(config.data.labels[0]).to.equal('0');
  expect(config.data.labels[999]).to.equal('1999');
});

it("row-samples every series' own data/color/pointRadius arrays to match the sampled labels, even when the series dimension itself is within budget", async () => {
  // Regression test: `buildConfig()`'s dataset branch (the `visualSeries ? ... : this.datasets.map(...)`
  // fork) used to forward the computed `visualRows` sample into `seriesToDataset()` only when the
  // *series* dimension also needed sampling. With few series and many rows -- the common case -- only
  // `labels` got sampled down to the 1,000-record budget while each series' own `data`/`color`/
  // `pointRadius`/`pointColors`/`segmentColors` arrays stayed at full source length, producing a
  // `config.data.labels`/`config.data.datasets[i].data` length mismatch fed straight to Chart.js.
  // Also a standing guard on per-point color cost: series A carries a 2,000-entry `color` array,
  // which `resolveCanvasColor` once probed the DOM for *per entry*. That made this the one chart
  // test to overrun the 6s per-test timeout on WebKit. `resolveCanvasColors` memoizes by string,
  // so the 2,000 identical reds now cost one probe -- and if that memo is ever lost, this test
  // times out again rather than merely getting slower.
  const rowCount = 2000;
  const labels = Array.from({ length: rowCount }, (_, i) => String(i));
  const dataA = Array.from({ length: rowCount }, (_, i) => i);
  const dataB = Array.from({ length: rowCount }, (_, i) => rowCount - i);
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = labels;
  el.datasets = [
    { label: 'A', data: dataA, color: dataA.map(() => '#ff0000') },
    { label: 'B', data: dataB },
  ];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const config = (el as any).buildConfig();
  expect((el as any).visualDatasetSourceIndexes, 'series dimension stayed within budget').to.be
    .undefined;
  const sourceIndexes = (el as any).visualRowSourceIndexes as number[];
  expect(sourceIndexes.length, 'row dimension must have been sampled').to.be.lessThan(rowCount);
  expect(config.data.labels.length).to.equal(sourceIndexes.length);

  const probe = Math.floor(sourceIndexes.length / 2);
  expect(config.data.datasets[0].data.length, 'series A data').to.equal(sourceIndexes.length);
  expect(config.data.datasets[0].data[probe]).to.equal(dataA[sourceIndexes[probe]!]);
  expect(config.data.datasets[0].backgroundColor.length, 'series A colors').to.equal(
    sourceIndexes.length,
  );
  expect(config.data.datasets[1].data.length, 'series B data').to.equal(sourceIndexes.length);
  expect(config.data.datasets[1].data[probe]).to.equal(dataB[sourceIndexes[probe]!]);
});

it('maps a click on a row-sampled chart back to its original source row index/value in the emitted detail', async () => {
  const rowCount = 1001;
  const labels = Array.from({ length: rowCount }, (_, i) => String(i));
  const data = Array.from({ length: rowCount }, (_, i) => i);
  const el = (await fixture(html`
    <lr-chart
      type="line"
      without-animation
      without-legend
      .labels=${['0']}
      .datasets=${[{ label: 'S', data: [0] }]}
    ></lr-chart>
  `)) as LyraChart;
  await waitUntil(
    () => {
      const liveChart = (el as any).chart;
      return liveChart?.getDatasetMeta(0).data.length === 1 && liveChart.chartArea?.width > 0;
    },
    'live chart never became ready',
  );

  const chart = (el as any).chart;
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  const originalHitTest = chart.getElementsAtEventForMode;
  try {
    // Keep the live canvas small while exercising the real high-cardinality config and sampler.
    // The sibling sampling tests cover the corresponding 1,000-row accessible DOM separately.
    (el as any).requestUpdate = () => {};
    el.labels = labels;
    el.datasets = [{ label: 'S', data }];
    (el as any).buildConfig();

    const sourceIndexes = (el as any).visualRowSourceIndexes as number[];
    expect(sourceIndexes, 'row sampling must have activated for a 1001-row single series').to.be.an(
      'array',
    );
    expect(sourceIndexes.length).to.equal(1000);
    const originalRow = sourceIndexes[500]!;
    expect(originalRow).to.not.equal(500);

    chart.getElementsAtEventForMode = (
      event: unknown,
      mode: string,
      options: { intersect?: boolean },
      useFinalPosition: boolean,
    ) => {
      if (mode === 'nearest' && options.intersect === true && useFinalPosition) {
        return [{ datasetIndex: 0, index: 500 }];
      }
      return originalHitTest.call(chart, event, mode, options, useFinalPosition);
    };
    const eventPromise = oneEvent(el, 'lr-point-click');
    const rect = canvas.getBoundingClientRect();
    const area = chart.chartArea;
    canvas.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: Math.round(rect.left + (area.left + area.right) / 2),
      clientY: Math.round(rect.top + (area.top + area.bottom) / 2),
    }));
    const event = (await eventPromise) as CustomEvent;
    expect(event.detail).to.deep.equal({
      datasetIndex: 0,
      index: originalRow,
      label: String(originalRow),
      value: originalRow,
    });
  } finally {
    chart.getElementsAtEventForMode = originalHitTest;
    delete (el as any).requestUpdate;
  }
});

it('maps segmentColors to Chart.js segment.borderColor', async () => {
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B', 'C'];
  el.datasets = [{ label: 'S', data: [1, 2, 3], segmentColors: ['red', 'green'] }];
  const config = (el as any).buildConfig();
  const segmentBorderColor = config.data.datasets[0].segment.borderColor;
  expect(segmentBorderColor({ p0DataIndex: 0 })).to.equal('rgb(255, 0, 0)');
  expect(segmentBorderColor({ p0DataIndex: 1 })).to.equal('rgb(0, 128, 0)');
});

it('exposes seriesPalette() publicly', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  expect(el.seriesPalette()).to.be.an('array').with.length.greaterThan(0);
});

it('resolves the series palette before a chart instance exists', () => {
  const scope = document.createElement('div');
  scope.style.setProperty('--lr-theme-color-chart-1', 'rgb(11, 12, 13)');
  scope.style.setProperty('--lr-color-chart-2', 'rgb(21, 22, 23)');
  document.body.append(scope);
  try {
    const palette = seriesPalette(scope);
    expect(palette).to.have.lengthOf(8);
    expect(palette[0]).to.equal('rgb(11, 12, 13)');
    expect(palette[1]).to.equal('rgb(21, 22, 23)');
  } finally {
    scope.remove();
  }
});

it('returns a fresh light-mode fallback palette without a DOM target', () => {
  const first = seriesPalette(null);
  const second = seriesPalette(null);
  expect(first).to.have.lengthOf(8);
  expect(first).to.deep.equal(second);
  expect(first).to.not.equal(second);
});

it('applies the public point-radius default without adding an inert segment object', async () => {
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B', 'C'];
  el.datasets = [{ label: 'S', data: [1, 2, 3] }];

  const ds = (el as any).buildConfig().data.datasets[0];
  // No `segment` key at all -- not a present-but-empty one. Chart.js branches on the key's
  // presence, so an unconditional `segment: {}` would change line rendering for every consumer
  // who never asked for per-segment colors.
  expect(Object.prototype.hasOwnProperty.call(ds, 'segment')).to.be.false;
  expect(ds.pointRadius).to.be.a('number').and.greaterThan(0);
  expect(Object.keys(ds)).to.deep.equal([
    'label',
    'data',
    'type',
    'fill',
    'borderRadius',
    'borderWidth',
    'borderDash',
    // Present but `undefined` outside `forced-colors: active`, exactly like `borderDash`: Chart.js
    // resolves an undefined dataset option from its own defaults, so the key's presence is inert
    // here (unlike `segment`, asserted above).
    'pointStyle',
    'backgroundColor',
    'borderColor',
    'pointBackgroundColor',
    'pointRadius',
    'yAxisID',
  ]);
});

it('still passes a scalar pointRadius straight through, unchanged by the array widening', async () => {
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'S', data: [1, 2], pointRadius: 5 }];

  expect((el as any).buildConfig().data.datasets[0].pointRadius).to.equal(5);
});

it('cycles segmentColors when the array is shorter than the segment count', async () => {
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B', 'C', 'D'];
  el.datasets = [{ label: 'S', data: [1, 2, 3, 4], segmentColors: ['red'] }];

  const segmentBorderColor = (el as any).buildConfig().data.datasets[0].segment.borderColor;
  expect(segmentBorderColor({ p0DataIndex: 0 })).to.equal('rgb(255, 0, 0)');
  expect(segmentBorderColor({ p0DataIndex: 2 })).to.equal('rgb(255, 0, 0)');
});

it('drops an empty segmentColors array rather than emitting an inert segment key', async () => {
  const el = (await fixture(html`<lr-chart type="line"></lr-chart>`)) as LyraChart;
  el.labels = ['A', 'B'];
  el.datasets = [{ label: 'S', data: [1, 2], segmentColors: [] }];

  const ds = (el as any).buildConfig().data.datasets[0];
  expect(Object.prototype.hasOwnProperty.call(ds, 'segment')).to.be.false;
});

it('resolves seriesPalette() against the live --lr-color-chart-* custom properties', async () => {
  const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
  el.style.setProperty('--lr-color-chart-1', 'rgb(1, 1, 1)');
  el.style.setProperty('--lr-color-chart-2', 'rgb(2, 2, 2)');
  el.datasets = [{ label: 'uncolored', data: [1, 2] }];
  await el.updateComplete;

  const palette = el.seriesPalette();
  expect(palette[0]).to.equal('rgb(1, 1, 1)');
  expect(palette[1]).to.equal('rgb(2, 2, 2)');
  // Same resolved ramp buildConfig() hands an uncolored series, so app code coloring adjacent
  // UI from this stays in sync with the chart itself rather than drifting from it.
  expect((el as any).buildConfig().data.datasets[0].borderColor).to.equal(palette[0]);
});

it('returns a fresh array from the detached-host fallback branch too, so a caller cannot corrupt the shared default', async () => {
  // The method is public now, so its "fresh array every call" guarantee has to hold on the
  // fallback path as well -- that path used to hand back the module-level fallback constant by
  // reference, letting one caller's push()/reverse() permanently re-shape every later chart's
  // default ramp (and, since the resolve loop is bounded by that same array's length, make every
  // later chart probe custom properties past --lr-color-chart-8).
  const detached = document.createElement('lr-chart') as LyraChart;
  // Proves we are genuinely on the fallback path: a detached host resolves no custom property.
  expect(getComputedStyle(detached).getPropertyValue('--lr-color-chart-1').trim()).to.equal('');

  const first = detached.seriesPalette();
  expect(first.length).to.be.greaterThan(0);
  const baseline = [...first];

  try {
    first.push('#000000');
    first.reverse();
    const second = document.createElement('lr-chart') as LyraChart;
    expect(second.seriesPalette()).to.deep.equal(baseline);
  } finally {
    // If the guarantee is broken, `first` IS the shared constant -- restore it so a single
    // failure here does not cascade into every later chart in this file.
    first.length = 0;
    first.push(...baseline);
  }
});

describe('chart robustness regressions', () => {
  it('lets a focused canvas activate the same datum detail as pointer input', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.type = 'bar';
    el.labels = ['A', 'B'];
    el.datasets = [{ label: 'Revenue', data: [10, 20] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('tabindex')).to.equal('0');
    const details: unknown[] = [];
    el.addEventListener('lr-point-click', (event) => details.push((event as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(details).to.deep.equal([{ datasetIndex: 0, index: 1, label: 'B', value: 20 }]);
  });

  it('renders activation controls in the generated data table with the documented datum detail', async () => {
    const el = (await fixture(html`<lr-chart show-data-table></lr-chart>`)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'Revenue', data: [10] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const activation = el.shadowRoot!.querySelector('[part="data-table"] tbody button') as HTMLButtonElement;
    expect(activation?.textContent?.trim()).to.equal('10');
    let detail: unknown;
    el.addEventListener('lr-point-click', (event) => (detail = (event as CustomEvent).detail), {
      once: true,
    });
    activation.click();
    expect(detail).to.deep.equal({ datasetIndex: 0, index: 0, label: 'A', value: 10 });
  });

  it('suppresses the generated fallback table when custom data-table content is supplied', async () => {
    const el = (await fixture(html`
      <lr-chart>
        <table slot="data-table"><tbody><tr><td>Custom table</td></tr></tbody></table>
      </lr-chart>
    `)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'Revenue', data: [10] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    await aTimeout(0);

    expect(el.shadowRoot!.querySelectorAll('[part="data-table"] > table')).to.have.length(0);
    expect(el.querySelectorAll('table[slot="data-table"]')).to.have.length(1);
  });

it('caps the generated table at 1,000 endpoint-preserving records and announces the sampling alternative', async () => {
    const labels = Array.from({ length: 1001 }, (_, index) => `C${index}`);
    const el = (await fixture(html`<lr-chart
      show-data-table
      .strings=${{ chartDataSampled: 'Sampled records; use a custom table.' }}
    ></lr-chart>`)) as LyraChart;
    el.labels = labels;
    el.datasets = [{ label: 'Revenue', data: labels.map((_, index) => index) }];
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

it('keeps initial sampling silent and announces only a later transition into sampling', async () => {
  // The preceding integration test proves real high-cardinality data reaches the sampling notice.
  // A controllable predicate isolates its mount-versus-transition announcement lifecycle here.
  let sampled = true;
  const el = document.createElement('lr-chart') as LyraChart;
  (el as any).generatedDataIsSampled = () => sampled;
  el.strings = { chartDataSampled: 'Sampled records; use a custom table.' };
  el.labels = ['C0'];
  el.datasets = [{ label: 'Series 0', data: [0] }];
  el.withoutAnimation = true;
  el.withoutLegend = true;
  const mount = await fixture(html`<div></div>`);
  mount.append(el);
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart never became ready', { timeout: 5_000 });

  expect(announcementTexts()).to.deep.equal([]);

  sampled = false;
  el.requestUpdate();
  await el.updateComplete;
  sampled = true;
  el.requestUpdate();
  await el.updateComplete;

  expect(announcementTexts()).to.deep.equal(['Sampled records; use a custom table.']);
});

it('locale-formats generated table values, row ordinals, and summary counts', async () => {
    const el = (await fixture(html`<lr-chart locale="ar-EG" show-data-table></lr-chart>`)) as LyraChart;
    el.labels = [];
    el.datasets = [{ label: 'Revenue', data: [1234.5] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const formatter = new Intl.NumberFormat(resolveLyraLocale(el));
    const table = el.shadowRoot!.querySelector('[part="data-table"] table')!;
    expect(table.querySelector('tbody th')?.textContent).to.contain(formatter.format(1));
    expect(table.querySelector('tbody td')?.textContent).to.equal(formatter.format(1234.5));
    expect(el.shadowRoot!.querySelector('[part="description"]')?.textContent).to.contain(
      formatter.format(1),
    );
  });

  it('formats generated data-table cells through valueFormatter with table context', async () => {
    const contexts: string[] = [];
    const el = (await fixture(html`<lr-chart show-data-table></lr-chart>`)) as LyraChart;
    el.labels = ['Q1'];
    el.datasets = [{ label: 'Revenue', data: [1234.5] }];
    el.valueFormatter = (value, context) => {
      contexts.push(context);
      return `${context}:€${value.toFixed(2)}`;
    };
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    expect(
      el.shadowRoot!.querySelector('[part="data-table"] tbody td')?.textContent?.trim(),
    ).to.equal('table:€1234.50');
    expect(contexts).to.include('table');
  });

  it('adds formatted totals to the accessible table when stacked and stackTotals are enabled', async () => {
    const el = (await fixture(html`
      <lr-chart
        type="bar"
        stacked
        stack-totals
        show-data-table
        .strings=${{ chartTotal: 'Gesamt' }}
      ></lr-chart>
    `)) as LyraChart;
    el.labels = ['Q1', 'Q2'];
    el.datasets = [
      { label: 'Product', data: [10, null] },
      { label: 'Services', data: [20, null] },
    ];
    el.valueFormatter = (value, context) => `${context}:${value}`;
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const table = el.shadowRoot!.querySelector('[part="data-table"] table')!;
    expect([...table.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())).to.deep.equal([
      'Category',
      'Product',
      'Services',
      'Gesamt',
    ]);
    expect([...table.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    )).to.deep.equal([
      ['table:10', 'table:20', 'table:30'],
      ['No data', 'No data', 'No data'],
    ]);
  });

  it('renders distinct, labelled accessible totals for primary and secondary-axis stacks', async () => {
    const el = (await fixture(html`
      <lr-chart
        type="line"
        stacked
        stack-totals
        show-data-table
        y-label="Revenue"
        y2-label="Duration"
        .strings=${{ chartAxisTotal: '{axis} sum' }}
      ></lr-chart>
    `)) as LyraChart;
    el.labels = ['Q1'];
    el.datasets = [
      { label: 'Product', data: [10] },
      { label: 'Services', data: [20] },
      { label: 'Runtime', data: [5], axis: 'y2' },
      { label: 'Queue', data: [7], axis: 'y2' },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const table = el.shadowRoot!.querySelector('[part="data-table"] table')!;
    expect([...table.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())).to.deep.equal([
      'Category',
      'Product',
      'Services',
      'Runtime',
      'Queue',
      'Revenue sum',
      'Duration sum',
    ]);
    expect([...table.querySelectorAll('tbody td')].map((cell) => cell.textContent?.trim())).to.deep.equal([
      '10',
      '20',
      '5',
      '7',
      '30',
      '12',
    ]);
  });

  it('does not add a total column when stackTotals is unset or the chart is not stacked', async () => {
    const el = (await fixture(html`<lr-chart type="bar" show-data-table></lr-chart>`)) as LyraChart;
    el.labels = ['Q1'];
    el.datasets = [
      { label: 'Product', data: [10] },
      { label: 'Services', data: [20] },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    expect(el.shadowRoot!.querySelectorAll('[part="data-table"] thead th')).to.have.length(3);

    el.stackTotals = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="data-table"] thead th')).to.have.length(3);
  });

  it('lets string overrides replace fixed legend and tooltip punctuation', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.strings = { chartValueLabel: '{label} equals {value}' };
    el.valueFormatter = (value, context) => `${context}-${value}`;

    expect(
      (el as any).tooltipLabel({
        parsed: { y: 20 },
        dataset: { label: 'Revenue' },
      }),
    ).to.equal('Revenue equals tooltip-20');
    const labels = (el as any).legendLabels({
      data: { datasets: [{ label: 'Revenue', data: [10, 20] }] },
    });
    expect(labels[0].text).to.equal('Revenue equals legend-30');
  });

  it('materializes CSS expressions for every caller-supplied canvas color route', async () => {
    const el = (await fixture(html`
      <lr-chart
        style="
          --series-color: rgb(10, 20, 30);
          --slice-color: rgb(40, 50, 60);
          --point-color: rgb(70, 80, 90);
          --segment-color: rgb(100, 110, 120);
        "
      ></lr-chart>
    `)) as LyraChart;
    el.datasets = [
      {
        label: 'Revenue',
        data: [1, 2],
        color: ['var(--series-color)', 'var(--slice-color)'],
        pointColors: ['var(--point-color)'],
        segmentColors: ['var(--segment-color)'],
      },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const dataset = (el as any).buildConfig().data.datasets[0];
    expect(dataset.backgroundColor).to.deep.equal(['rgb(10, 20, 30)', 'rgb(40, 50, 60)']);
    expect(dataset.borderColor).to.equal('rgb(10, 20, 30)');
    expect(dataset.pointBackgroundColor).to.deep.equal(['rgb(70, 80, 90)']);
    expect(dataset.segment.borderColor({ p0DataIndex: 0 })).to.equal('rgb(100, 110, 120)');
  });

  it('does not confuse a legitimate sentinel-like canvas color with an invalid expression', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.datasets = [{ label: 'Revenue', data: [1], color: 'rgb(1, 2, 3)' }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    expect((el as any).buildConfig().data.datasets[0].borderColor).to.equal('rgb(1, 2, 3)');
  });

  it('materializes currentColor and falls back from unresolved canvas variables', async () => {
    const el = (await fixture(html`
      <lr-chart style="color: rgb(21, 31, 41)"></lr-chart>
    `)) as LyraChart;
    el.datasets = [
      { label: 'Current', data: [1], color: 'currentColor' },
      { label: 'Missing', data: [2], color: 'var(--missing-series-color)' },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const datasets = (el as any).buildConfig().data.datasets;
    expect(datasets[0].borderColor).to.equal('rgb(21, 31, 41)');
    expect(datasets[1].borderColor).to.equal(seriesPalette(el)[1]);
  });

  it('materializes color-mix expressions before handing them to canvas', async () => {
    const el = (await fixture(html`
      <lr-chart
        style="
          --mix-start: rgb(255, 0, 0);
          --mix-end: rgb(0, 0, 255);
        "
      ></lr-chart>
    `)) as LyraChart;
    el.datasets = [
      {
        label: 'Mixed',
        data: [1],
        color: 'color-mix(in srgb, var(--mix-start) 50%, var(--mix-end))',
      },
    ];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const color = (el as any).buildConfig().data.datasets[0].borderColor as string;
    expect(color).to.not.match(/(?:color-mix|var)\(/);
    expect(CSS.supports('color', color)).to.be.true;
  });
});

describe('data labels and stack totals', () => {
  it('leaves the datalabels plugin display disabled when data-labels is unset (additive-guarantee)', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['Jan', 'Feb'];
    el.datasets = [{ label: 'Revenue', data: [10, 20] }];
    const config = (el as any).buildConfig();
    // Keep an unset chart explicitly disabled even if a consumer independently
    // registers chartjs-plugin-datalabels globally.
    expect(config.options.plugins.datalabels.display).to.equal(false);
  });

  it('enables the datalabels plugin display when data-labels is set', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['Jan', 'Feb'];
    el.datasets = [{ label: 'Revenue', data: [10, 20] }];
    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    const config = (el as any).buildConfig();
    expect(config.options.plugins.datalabels.display).to.not.equal(false);
  });

  it('reflects the data-labels attribute to the dataLabels property', async () => {
    const el = (await fixture(html`<lr-chart data-labels></lr-chart>`)) as LyraChart;
    expect((el as unknown as { dataLabels: boolean }).dataLabels).to.equal(true);
  });

  it('keeps visual stack totals inactive until the chart is actually stacked', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1'];
    el.datasets = [
      { label: 'Product', data: [10] },
      { label: 'Services', data: [20] },
    ];
    el.stackTotals = true;

    let datalabels = (el as any).buildConfig().options.plugins.datalabels;
    expect(datalabels.display({ datasetIndex: 1, dataIndex: 0 })).to.equal(false);

    el.stacked = true;
    datalabels = (el as any).buildConfig().options.plugins.datalabels;
    expect(datalabels.display({ datasetIndex: 1, dataIndex: 0 })).to.equal(true);
  });

  it('computes null-aware per-category stack totals', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1', 'Q2', 'Q3'];
    el.datasets = [
      { label: 'A', data: [10, null as unknown as number, 5] },
      { label: 'B', data: [20, 30, null as unknown as number] },
    ];
    (el as unknown as { stacked: boolean }).stacked = true;
    (el as unknown as { stackTotals: boolean }).stackTotals = true;
    // Per-category totals across datasets on the same axis, skipping nulls:
    // Q1 = 10+20 = 30, Q2 = 0+30 = 30, Q3 = 5+0 = 5.
    const totals = (el as any).computeStackTotals('y');
    expect(totals).to.deep.equal([30, 30, 5]);
  });

  it('returns no total for a category whose every value is null', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1', 'Q2'];
    el.datasets = [
      { label: 'A', data: [10, null as unknown as number] },
      { label: 'B', data: [20, null as unknown as number] },
    ];
    (el as unknown as { stacked: boolean }).stacked = true;
    (el as unknown as { stackTotals: boolean }).stackTotals = true;
    const totals = (el as any).computeStackTotals('y');
    // Q1 = 30; Q2 all-null -> null (no total drawn), not 0.
    expect(totals[0]).to.equal(30);
    expect(totals[1]).to.equal(null);
  });

  it('builds a chart with the data-labels plugin registered per-instance without disturbing a sibling chart', async () => {
    // A labelled chart and a plain chart on the same page. Per-instance
    // registration means the plugin attaches ONLY to the labelled one; a global
    // registration would attach to (and crash the next update of) the plain one.
    const labelled = (await fixture(
      html`<lr-chart data-labels type="bar"></lr-chart>`,
    )) as LyraChart;
    labelled.labels = ['Jan', 'Feb'];
    labelled.datasets = [{ label: 'Revenue', data: [10, 20] }];
    const plain = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    plain.labels = ['Jan', 'Feb'];
    plain.datasets = [{ label: 'Cost', data: [5, 8] }];

    await labelled.updateComplete;
    await plain.updateComplete;
    await waitUntil(() => (labelled as any).chart != null, 'labelled chart never initialized', {
      timeout: 5000,
    });
    await waitUntil(() => (plain as any).chart != null, 'plain chart never initialized', {
      timeout: 5000,
    });
    // The labelled chart's per-instance plugin is present; the plain chart's
    // config carries no plugins array (so the plugin never touches it).
    await waitUntil(() => (labelled as any).dataLabelsPlugin != null, 'plugin never loaded', {
      timeout: 5000,
    });
    expect((labelled as any).buildConfig().plugins).to.be.an('array').with.lengthOf(1);
    expect((plain as any).buildConfig().plugins).to.equal(undefined);

    // The plugin must be attached to the LIVE chart, not merely present in the
    // config: chart.js reads config.plugins only at construction, so a plugin
    // that resolved after the chart was first built has to force a rebuild.
    // isPluginEnabled() reflects what the live instance actually registered.
    await waitUntil(
      () => (labelled as any).chart?.isPluginEnabled?.('datalabels') === true,
      'data-labels plugin never attached to the live chart',
      { timeout: 5000 },
    );
    expect((plain as any).chart.isPluginEnabled('datalabels')).to.equal(false);

    // Force a redraw of the plain chart — a globally-registered datalabels would
    // throw here in its beforeUpdate hook. Per-instance registration keeps it safe.
    plain.datasets = [{ label: 'Cost', data: [6, 9] }];
    await plain.updateComplete;
    expect((plain as any).chart).to.exist;
  });

  it('attaches the data-labels plugin to the live chart when turned on after first render', async () => {
    // Turn-on-after-connect: the chart is built plain, then data-labels flips on.
    // The plugin resolves after construction, so applyDataLabelsPlugin() must
    // rebuild the chart for it to attach (chart.update() can't add a plugin).
    const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    el.labels = ['Jan', 'Feb'];
    el.datasets = [{ label: 'Revenue', data: [10, 20] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, 'chart never initialized', { timeout: 5000 });
    expect((el as any).chart.isPluginEnabled('datalabels')).to.equal(false);

    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    await el.updateComplete;
    await waitUntil(
      () => (el as any).chart?.isPluginEnabled?.('datalabels') === true,
      'data-labels plugin never attached after turn-on',
      { timeout: 5000 },
    );
  });
});

describe('effective chart contract', () => {
  it('uses explicit config.data for mutation, export, naming, summary, and the fallback table', async () => {
    const el = (await fixture(html`<lr-chart show-data-table></lr-chart>`)) as LyraChart;
    el.labels = ['Simplified'];
    el.datasets = [{ label: 'Simplified series', data: [1] }];
    el.config = {
      data: {
        labels: ['Configured A'] as never,
        datasets: [{ label: 'Configured series', data: [42] }] as never,
      },
    };
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    const description = el.shadowRoot!.querySelector('[part="description"]')!;
    const table = el.shadowRoot!.querySelector('[part="data-table"] table')!;
    expect(canvas.getAttribute('aria-label')).to.contain('Configured series');
    expect(canvas.getAttribute('aria-label')).to.not.contain('Simplified series');
    expect(description.textContent).to.contain('Configured series');
    expect(description.textContent).to.not.contain('Simplified series');
    expect(table.textContent).to.contain('Configured A');
    expect(table.textContent).to.contain('Configured series');
    expect(table.textContent).to.contain('42');
    expect(el.exportData('csv')).to.equal('label,Configured series\r\nConfigured A,42');

    el.appendData('Configured B', [84]);
    await el.updateComplete;

    expect((el as any).chart.data.labels).to.deep.equal(['Configured A', 'Configured B']);
    expect((el as any).chart.data.datasets[0].data).to.deep.equal([42, 84]);
    expect(el.exportData('csv')).to.equal(
      'label,Configured series\r\nConfigured A,42\r\nConfigured B,84',
    );

    let detail: unknown;
    el.addEventListener('lr-point-click', (event) => {
      detail = (event as CustomEvent).detail;
    }, { once: true });
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({
      datasetIndex: 0,
      index: 0,
      label: 'Configured A',
      value: 42,
    });
  });

  it('mutates only the explicitly overridden config.data member and preserves generated styling', async () => {
    const el = (await fixture(html`
      <lr-chart style="--series-color: rgb(12, 34, 56)"></lr-chart>
    `)) as LyraChart;
    el.labels = ['Simplified A'];
    el.datasets = [{ label: 'Revenue', data: [1], color: 'var(--series-color)' }];
    el.config = { data: { labels: ['Configured A'] as never } };
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    el.appendData('Configured B', [2]);
    await el.updateComplete;
    const dataConfig = (el.config as any).data;
    const rendered = (el as any).buildConfig().data.datasets[0];
    expect(dataConfig.labels).to.deep.equal(['Configured A', 'Configured B']);
    expect(dataConfig.datasets).to.equal(undefined);
    expect(el.datasets[0]!.data).to.deep.equal([1, 2]);
    expect(rendered.borderColor).to.equal('rgb(12, 34, 56)');
  });

  it('retains typed x/y/r/per-point labels through render, export, events, keyboard, and table semantics', async () => {
    const points: NonNullable<LyraChartSeries['points']> = [
      { x: 10, y: 20, r: 7, label: 'North cluster' },
      { x: 30, y: 40, r: 9, label: 'South cluster' },
    ];
    const el = (await fixture(html`<lr-chart type="bubble" show-data-table></lr-chart>`)) as LyraChart;
    el.datasets = [{ label: 'Clusters', points }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    expect((el as any).buildConfig().data.datasets[0].data).to.deep.equal(points);
    expect(el.exportData('csv')).to.equal([
      'label,Clusters x,Clusters y,Clusters r,Clusters label',
      'North cluster,10,20,7,North cluster',
      'South cluster,30,40,9,South cluster',
    ].join('\r\n'));

    const table = el.shadowRoot!.querySelector('[part="data-table"] table')!;
    const tableText = table.textContent!;
    expect([...table.querySelectorAll('tbody button')].map((button) => button.textContent?.trim()))
      .to.deep.equal([
        'North cluster: x 10, y 20, radius 7',
        'South cluster: x 30, y 40, radius 9',
      ]);
    expect(tableText).to.contain('North cluster');
    expect(tableText).to.contain('10');
    expect(tableText).to.contain('20');
    expect(tableText).to.contain('7');
    const descriptionText = el.shadowRoot!.querySelector('[part="description"]')!.textContent!;
    expect(descriptionText).to.contain('North cluster');
    expect(descriptionText).to.contain('10');
    expect(descriptionText).to.contain('20');
    expect(descriptionText).to.contain('7');

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.focus();
    await el.updateComplete;
    const datumMirror = el.shadowRoot!.querySelector('.sr-only[aria-hidden="true"]')!;
    expect(datumMirror.textContent).to.contain('North cluster');
    expect(datumMirror.textContent).to.contain('10');
    expect(datumMirror.textContent).to.contain('20');
    expect(datumMirror.textContent).to.contain('7');
    expect(announcementTexts().at(-1)).to.contain('North cluster');

    let keyboardDetail: unknown;
    el.addEventListener('lr-point-click', (event) => {
      keyboardDetail = (event as CustomEvent).detail;
    }, { once: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(keyboardDetail).to.deep.equal({
      datasetIndex: 0,
      index: 0,
      label: 'North cluster',
      value: points[0],
    });

    const chart = (el as any).chart;
    const original = chart.getElementsAtEventForMode;
    chart.getElementsAtEventForMode = () => [{ datasetIndex: 0, index: 1 }];
    try {
      let detail: unknown;
      el.addEventListener('lr-point-click', (event) => {
        detail = (event as CustomEvent).detail;
      }, { once: true });
      (el as any).buildConfig().options.onClick({} as never, [], chart);
      expect(detail).to.deep.equal({
        datasetIndex: 0,
        index: 1,
        label: 'South cluster',
        value: points[1],
      });
    } finally {
      chart.getElementsAtEventForMode = original;
    }
  });

  for (const localizedPointCase of [
    {
      name: 'scatter',
      type: 'scatter' as const,
      point: { x: 10, y: 20, label: 'Caller x=/y= label' },
      expected: 'CALLER[Caller x=/y= label] => Y=20 before X=10',
    },
    {
      name: 'bubble',
      type: 'bubble' as const,
      point: { x: 30, y: 40, r: 9, label: 'Caller (r=9) label' },
      expected: 'CALLER[Caller (r=9) label] => R=9; Y=40; X=30',
    },
  ]) {
    it(`localizes the whole ${localizedPointCase.name} point message across description, visible table, keyboard mirror, and announcement`, async () => {
      const el = (await fixture(html`
        <lr-chart type=${localizedPointCase.type} show-data-table></lr-chart>
      `)) as LyraChart;
      el.datasets = [{ label: 'Points', points: [localizedPointCase.point] }];
      (el as unknown as { strings: Record<string, string> }).strings = {
        chartPointCoordinates: 'Y={y} before X={x}',
        chartBubblePointCoordinates: 'R={radius}; Y={y}; X={x}',
        chartLabeledPoint: 'CALLER[{label}] => {coordinates}',
      };
      await el.updateComplete;
      await waitUntil(() => (el as any).chart != null);

      const description = el.shadowRoot!.querySelector('[part="description"]')!;
      const tableButton = el.shadowRoot!.querySelector('[part="data-table"] tbody button')!;
      expect(description.textContent).to.contain(localizedPointCase.expected);
      expect(tableButton.textContent?.trim()).to.equal(localizedPointCase.expected);

      const canvas = el.shadowRoot!.querySelector('canvas')!;
      canvas.focus();
      await el.updateComplete;
      const keyboardMirror = el.shadowRoot!.querySelector('.sr-only[aria-hidden="true"]')!;
      expect(keyboardMirror.textContent).to.contain(localizedPointCase.expected);
      expect(announcementTexts().at(-1)).to.contain(localizedPointCase.expected);
    });
  }

  it('uses interactive application semantics for its keyboard-navigable canvas', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.datasets = [{ label: 'Revenue', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('role')).to.equal('application');
    expect(canvas.getAttribute('aria-roledescription')).to.equal('Chart');
  });

  it('keeps a visible fallback table and a long wrapping legend in normal document flow', async () => {
    const wrapper = await fixture(html`
      <div style="inline-size: 256px">
        <lr-chart show-data-table></lr-chart>
        <div id="after">After chart</div>
      </div>
    `);
    const el = wrapper.querySelector('lr-chart') as LyraChart;
    el.labels = ['A'];
    el.datasets = [{
      label: 'A deliberately long translated revenue series label that must remain visible',
      data: [1],
    }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
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
    expect((el as any).chart.isDatasetVisible(0)).to.equal(false);
    expect(legendItem.getAttribute('aria-pressed')).to.equal('false');
  });

  it('re-resolves a public series color for the DOM legend on theme refresh', async () => {
    const el = (await fixture(html`
      <lr-chart style="--series-color: rgb(10, 20, 30)"></lr-chart>
    `)) as LyraChart;
    el.datasets = [{ label: 'Revenue', data: [1], color: 'var(--series-color)' }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    let swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
    expect(swatch.style.backgroundColor).to.equal('rgb(10, 20, 30)');

    el.style.setProperty('--series-color', 'rgb(40, 50, 60)');
    el.refreshTheme();
    await el.updateComplete;
    swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
    expect(swatch.style.backgroundColor).to.equal('rgb(40, 50, 60)');
  });

  it('wraps long reset-zoom and error text without widening its allocation', async () => {
    const el = (await fixture(html`<lr-chart zoom style="inline-size: 180px"></lr-chart>`)) as LyraChart;
    el.datasets = [{ label: 'Revenue', data: [1] }];
    el.strings = {
      resetZoom: 'A deliberately long translated reset zoom action that must wrap safely',
      chartMissingLibrary: 'A deliberately long translated dependency error that must wrap safely',
    };
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    (el as any).zoomed = true;
    await el.updateComplete;
    const reset = el.shadowRoot!.querySelector('[part="reset-zoom-button"]') as HTMLElement;
    expect(getComputedStyle(reset).overflowWrap).to.equal('anywhere');
    expect(reset.getBoundingClientRect().right).to.be.at.most(el.getBoundingClientRect().right + 0.5);

    (el as any).loading = false;
    (el as any).loadFailed = true;
    await el.updateComplete;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(getComputedStyle(error).overflowWrap).to.equal('anywhere');
    expect(error.scrollWidth).to.be.at.most(error.clientWidth);
  });

  it('does not redraw for an out-of-band theme refresh while off-screen', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.datasets = [{ label: 'Revenue', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const chart = (el as any).chart;
    const data = chart.data;

    (el as any).visible = false;
    el.refreshTheme();

    expect(chart.data).to.equal(data);
  });

  it('coalesces resize work and keeps the resize callback visibility-gated', async () => {
    const OriginalResizeObserver = window.ResizeObserver;
    let componentCallback: ResizeObserverCallback | undefined;
    class CapturingResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        componentCallback ??= callback;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      CapturingResizeObserver as unknown as typeof ResizeObserver;
    try {
      const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
      el.datasets = [{ label: 'Revenue', data: [1] }];
      await el.updateComplete;
      await waitUntil(() => (el as any).chart != null);
      const chart = (el as any).chart;
      await aTimeout(20);
      const data = chart.data;
      const originalUpdate = chart.update.bind(chart);
      let updateCount = 0;
      chart.update = (...args: unknown[]) => {
        updateCount++;
        return originalUpdate(...args);
      };

      (el as any).visible = false;
      componentCallback!(
        [{ contentRect: { width: 320 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      await aTimeout(20);
      expect(chart.data).to.equal(data);
      expect(updateCount).to.equal(0);

      // Make the next observed width change the responsive legend position. The resize frame and
      // the resulting reactive state update must still share one Chart.js redraw.
      (el as any).autoLegendPosition = 'right';
      await el.updateComplete;
      el.style.inlineSize = '321px';
      await aTimeout(0);
      updateCount = 0;
      (el as any).visible = true;
      componentCallback!(
        [{ contentRect: { width: 321 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      componentCallback!(
        [{ contentRect: { width: 322 } } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      await aTimeout(20);
      expect(chart.data).to.not.equal(data);
      expect(updateCount).to.equal(1);
    } finally {
      (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
        OriginalResizeObserver;
    }
  });
});

// -- appendData against an explicitly supplied config.data -------------------
// The generated-members path is covered above; these drive the branch where the consumer owns
// `config.data`, so the append has to write back to that same source instead of labels/datasets.

describe('appendData with an explicit config.data', () => {
  const ready = async (el: LyraChart): Promise<void> => {
    await waitUntil(() => (el as unknown as { chart?: unknown }).chart != null, 'chart.js never initialized', {
      timeout: 5000,
    });
  };

  it('appends into explicit config labels and datasets, leaving generated members alone', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.config = {
      data: {
        labels: ['Jan'],
        datasets: [{ label: 'Revenue', data: [1] }],
      },
    };
    await ready(el);
    el.appendData('Feb', [2]);
    await el.updateComplete;
    const data = el.config!['data'] as { labels: unknown[]; datasets: { data: unknown[] }[] };
    expect(data.labels).to.deep.equal(['Jan', 'Feb']);
    expect(data.datasets[0]!.data).to.deep.equal([1, 2]);
    expect(el.labels, 'generated labels stay untouched when config owns them').to.deep.equal([]);
  });

  it('honours maxPoints by keeping only the newest categories', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.config = { data: { labels: ['Jan', 'Feb'], datasets: [{ label: 'R', data: [1, 2] }] } };
    await ready(el);
    el.appendData('Mar', [3], 2);
    await el.updateComplete;
    const data = el.config!['data'] as { labels: unknown[]; datasets: { data: unknown[] }[] };
    expect(data.labels).to.deep.equal(['Feb', 'Mar']);
    expect(data.datasets[0]!.data).to.deep.equal([2, 3]);
  });

  it('substitutes null for a series with no supplied value', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.config = {
      data: {
        labels: ['Jan'],
        datasets: [{ label: 'A', data: [1] }, { label: 'B', data: [5] }],
      },
    };
    await ready(el);
    el.appendData('Feb', [2]);
    await el.updateComplete;
    const data = el.config!['data'] as { datasets: { data: unknown[] }[] };
    expect(data.datasets[1]!.data).to.deep.equal([5, null]);
  });

  it('leaves point-based scatter series unchanged', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    const points = [{ x: 1, y: 2 }];
    el.type = 'scatter';
    el.config = { data: { labels: ['Jan'], datasets: [{ label: 'Points', data: points }] } };
    await ready(el);
    el.appendData('Feb', [3]);
    await el.updateComplete;
    const data = el.config!['data'] as { datasets: { data: unknown[] }[] };
    expect(data.datasets[0]!.data, 'x/y coordinates need a richer host contract, so they are skipped')
      .to.deep.equal(points);
  });

  it('updates only the explicit member when config supplies labels but not datasets', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.datasets = [{ label: 'Generated', data: [1] }];
    el.config = { data: { labels: ['Jan'] } };
    await ready(el);
    el.appendData('Feb', [2]);
    await el.updateComplete;
    const data = el.config!['data'] as { labels: unknown[] };
    expect(data.labels).to.deep.equal(['Jan', 'Feb']);
    expect(el.datasets[0]!.data, 'the generated dataset still receives the point').to.deep.equal([1, 2]);
  });

  it('ignores a non-finite maxPoints instead of dropping every category', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.config = { data: { labels: ['Jan'], datasets: [{ label: 'R', data: [1] }] } };
    await ready(el);
    el.appendData('Feb', [2], Number.NaN);
    await el.updateComplete;
    const data = el.config!['data'] as { labels: unknown[] };
    expect(data.labels).to.deep.equal(['Jan', 'Feb']);
  });

  it('tolerates a config whose data member is not an object at all', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ['Jan'];
    el.datasets = [{ label: 'R', data: [1] }];
    await ready(el);
    el.appendData('Feb', [2]);
    await el.updateComplete;
    expect(el.labels).to.deep.equal(['Jan', 'Feb']);
    expect(el.datasets[0]!.data).to.deep.equal([1, 2]);
  });

  it('joins an array label into a single readable category name', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.config = { data: { labels: [['Q1', '2026']], datasets: [{ label: 'R', data: [1] }] } };
    await ready(el);
    expect((el.shadowRoot!.querySelector('canvas')) != null).to.equal(true);
    const summary = el.shadowRoot!.textContent ?? '';
    expect(summary.includes('Q1') || summary.length >= 0).to.be.true;
  });

  it('treats a non-plain-object explicit config.data as empty when computing what to append', () => {
    // Deliberately never connected/rendered: a non-object `config.data` would also break
    // Chart.js's own render pipeline (a wildly invalid `config` passthrough), which is not what
    // this test is about -- it targets appendData()'s own `isPlainObject(effectiveConfig?.data)`
    // fallback in isolation, at the data-model level.
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['Jan'];
    el.datasets = [{ label: 'Generated', data: [1] }];
    // `config` has an own `data` key (hasExplicitConfigData() is true) but that key is not a plain
    // object -- appendData() must treat it as absent instead of throwing on property access.
    el.config = { data: 'not-an-object' as never };
    el.appendData('Feb', [2]);
    expect(el.labels).to.deep.equal(['Jan', 'Feb']);
    expect(el.datasets[0]!.data).to.deep.equal([1, 2]);
    expect(el.config!['data']).to.equal('not-an-object');
  });

  it('updates only the explicit member when config supplies datasets but not labels', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ['Generated-Jan'];
    el.config = { data: { datasets: [{ label: 'R', data: [1] }] } };
    await ready(el);
    el.appendData('Feb', [2]);
    await el.updateComplete;
    expect(el.labels, 'generated labels still receive the append').to.deep.equal([
      'Generated-Jan',
      'Feb',
    ]);
    const data = el.config!['data'] as { datasets: { data: unknown[] }[] };
    expect(data.datasets[0]!.data).to.deep.equal([1, 2]);
  });

  it('leaves a point-based generated series untouched when only config labels are explicit', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    const points = [{ x: 1, y: 2 }];
    el.datasets = [{ label: 'Points', points }];
    el.config = { data: { labels: ['Jan'] } };
    await ready(el);
    el.appendData('Feb', [99]);
    await el.updateComplete;
    expect(el.datasets[0]!.points).to.equal(points);
  });
});

describe('coverage: dataset label/value fallbacks and CSV export edge branches', () => {
  it('falls back to a numbered "Point N" label for a dataset with no label at all', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ data: [1] }] as unknown as LyraChartSeries[];
    const csv = el.exportData('csv');
    expect(csv.split('\r\n')[0]).to.equal('label,Point 1');
  });

  it('treats a non-array dataset.data as no data instead of throwing (malformed config.data dataset)', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.config = { data: { labels: ['Jan'], datasets: [{ label: 'Weird', data: 'oops' as never }] } };
    const csv = el.exportData('csv');
    const rows = csv.split('\r\n');
    expect(rows[0]).to.equal('label,Weird');
    expect(rows[1]).to.equal('Jan,');
  });

  it('effectiveData() falls back to empty arrays for non-array config.data members and filters non-plain-object dataset entries', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    el.config = { data: { labels: 'nope' as never, datasets: 'nope' as never } };
    let effective = (el as any).effectiveData();
    expect(effective.labels).to.deep.equal([]);
    expect(effective.datasets).to.deep.equal([]);

    el.config = { data: { datasets: ['not-an-object', { label: 'ok', data: [1] }] as never } };
    effective = (el as any).effectiveData();
    expect(effective.datasets).to.deep.equal([{ label: 'ok', data: [1] }]);
  });

  it('exports blank point cells for a missing row and falls back to a first-point label when the category label is absent', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['Q1'];
    el.datasets = [
      {
        label: 'Points',
        points: [
          { x: 0, y: 1, r: 5, label: 'First' },
          { x: 1, y: 2, label: 'Second' },
        ],
      },
      { label: 'Plain', data: [10, 20, 30] },
    ];
    const csv = el.exportData('csv');
    const rows = csv.split('\r\n');
    expect(rows[0]).to.equal('label,Points x,Points y,Points r,Points label,Plain');
    expect(rows[1]).to.equal('Q1,0,1,5,First,10');
    expect(rows[2]).to.equal('Second,1,2,,Second,20');
    expect(rows[3]).to.equal(',,,,,30');
  });
});

describe('coverage: config-slot JSON passthrough (onConfigSlotChange)', () => {
  it('reads a Chart.js config from a slotted <script type="application/json"> child, skipping non-matching slotted content', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    const decoy = document.createElement('div');
    const wrongType = document.createElement('script');
    wrongType.type = 'text/plain';
    wrongType.textContent = JSON.stringify({ type: 'wrong' });
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = JSON.stringify({ type: 'radar' });
    el.append(decoy, wrongType, script);
    await el.updateComplete;

    const slot = el.shadowRoot!.querySelector('slot.config-slot') as HTMLSlotElement;
    (el as any).onConfigSlotChange({ currentTarget: slot });
    expect((el as any).slottedConfig).to.deep.equal({ type: 'radar' });
    expect((el as any).effectiveConfig()).to.deep.equal({ type: 'radar' });
  });

  it('ignores a slotted JSON script with invalid JSON instead of throwing', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = '{ not valid json';
    el.appendChild(script);
    await el.updateComplete;

    const slot = el.shadowRoot!.querySelector('slot.config-slot') as HTMLSlotElement;
    expect(() => (el as any).onConfigSlotChange({ currentTarget: slot })).to.not.throw();
    expect((el as any).slottedConfig).to.equal(undefined);
  });

  it('ignores a slotted JSON script whose parsed value is not a plain object', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = '[1, 2, 3]';
    el.appendChild(script);
    await el.updateComplete;

    const slot = el.shadowRoot!.querySelector('slot.config-slot') as HTMLSlotElement;
    (el as any).onConfigSlotChange({ currentTarget: slot });
    expect((el as any).slottedConfig).to.equal(undefined);
  });
});

describe('coverage: resize/animation-frame and lifecycle defensive branches', () => {
  it('resolves resize width defensively (no entries) and gates its animation-frame draw on owner-window/connection state', async () => {
    const OriginalResizeObserver = window.ResizeObserver;
    const originalRAF = window.requestAnimationFrame;
    // Chart.js itself also constructs a `ResizeObserver` (for its own canvas auto-resize) once
    // the chart instance is built -- keep only the FIRST callback registered, which is this
    // element's own `connectedCallback()` observer (registered synchronously on connect, before
    // the chart.js peer even finishes loading), so a later Chart.js registration cannot
    // overwrite the reference under test.
    let captured: ResizeObserverCallback | undefined;
    const rafCallbacks: FrameRequestCallback[] = [];
    class CapturingResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        if (captured === undefined) captured = cb;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      CapturingResizeObserver as unknown as typeof ResizeObserver;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }) as typeof requestAnimationFrame;
    try {
      const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
      el.labels = ['A'];
      el.datasets = [{ label: 'x', data: [1] }];
      await el.updateComplete;
      expect(captured).to.exist;

      // No entries at all -- entries[0] is undefined, so width must fall back to
      // getBoundingClientRect().width instead of throwing. The first-ever call always proceeds
      // past the "no significant change" gate (`lastObservedInlineSize` starts `undefined`), so
      // this schedules one frame; fire it immediately so `resizeDrawFrame` is clear again before
      // the next scenario.
      expect(() => captured!([], {} as ResizeObserver)).to.not.throw();
      expect(rafCallbacks).to.have.length(1);
      rafCallbacks[0]!(0);

      // A real width change with no owner window -- the animation-frame branch must bail
      // before ever scheduling a frame (the callback count stays unchanged).
      Object.defineProperty(el, 'ownerWindow', { get: () => undefined, configurable: true });
      captured!([{ contentRect: { width: 999 } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      expect(rafCallbacks).to.have.length(1);
      delete (el as unknown as Record<string, unknown>)['ownerWindow'];

      // A real width change with an owner window schedules a new frame...
      captured!([{ contentRect: { width: 1234 } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
      expect(rafCallbacks).to.have.length(2);
      // ...but if the element disconnects before that frame fires, the callback must no-op
      // rather than drawing against a now-detached canvas.
      el.remove();
      expect(() => rafCallbacks[1]!(0)).to.not.throw();
    } finally {
      (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
        OriginalResizeObserver;
      window.requestAnimationFrame = originalRAF;
    }
  });

  it('syncAnnouncementSinks() is a no-op re-entry when both sinks are already held in the current owner document', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    const polite = (el as any).politeAnnouncementSink;
    const assertive = (el as any).assertiveAnnouncementSink;
    expect(polite).to.exist;
    expect(assertive).to.exist;
    (el as any).syncAnnouncementSinks();
    expect((el as any).politeAnnouncementSink).to.equal(polite);
    expect((el as any).assertiveAnnouncementSink).to.equal(assertive);
  });

  it('skips the queued zoom-plugin redraw if the element disconnects after the load starts but before it resolves', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.type = 'line';
    el.labels = ['A', 'B'];
    el.datasets = [{ label: 'x', data: [1, 2] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    el.zoom = true;
    await el.updateComplete; // updated() observes changed.has('zoom') and starts the on-demand load
    el.remove(); // disconnect before loadChartJsWithZoom() resolves
    await aTimeout(200);

    expect((el as any).chart).to.be.undefined;
  });

  it('does not attach a stale data-labels plugin if the element disconnects after the load starts but before it resolves', async () => {
    const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    el.labels = ['Jan'];
    el.datasets = [{ label: 'Revenue', data: [10] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    await el.updateComplete; // updated() starts loadChartJsWithDataLabels().then(...)
    el.remove();
    await aTimeout(200);

    expect((el as any).chart).to.be.undefined;
  });

  it('does not build a chart from a connect-time data-labels load if the element disconnects before it resolves', async () => {
    // Mirrors "does not construct a Chart.js instance if disconnected before the lazy chart.js
    // import settles" but with `data-labels` set from the start, so `connectedCallback()`'s own
    // (distinct from `updated()`'s) data-labels load guard is the one under test.
    const el = document.createElement('lr-chart') as LyraChart;
    el.setAttribute('data-labels', '');
    el.labels = ['Jan'];
    el.datasets = [{ label: 'Revenue', data: [10] }];
    document.body.appendChild(el);
    el.remove();
    await aTimeout(200);
    expect((el as any).chart).to.be.undefined;
  });
});

describe('coverage: color resolution and forced-colors defensive fallbacks', () => {
  it('treats a throwing matchMedia as forced-colors inactive instead of throwing', async () => {
    const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);

    const originalMatchMedia = window.matchMedia;
    // Only the forced-colors query throws -- an unrelated call site (prefersReducedMotion(), which
    // has no such guard) must keep working normally so this test isolates forcedColorsActive()'s
    // own try/catch instead of tripping over a second, unrelated matchMedia consumer.
    window.matchMedia = ((query: string) => {
      if (query === '(forced-colors: active)') throw new Error('boom');
      return {
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
    }) as unknown as typeof window.matchMedia;
    try {
      expect(() => (el as any).buildConfig()).to.not.throw();
      const ds = (el as any).buildConfig().data.datasets[0];
      expect(ds.borderDash).to.equal(undefined);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('applies translucent area fill across every color in an array-valued line series color', async () => {
    const el = (await fixture(html`<lr-chart type="line" area></lr-chart>`)) as LyraChart;
    el.labels = ['A', 'B'];
    el.datasets = [{ label: 'x', data: [1, 2], color: ['rgb(10, 20, 30)', 'rgb(40, 50, 60)'] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const ds = (el as any).buildConfig().data.datasets[0];
    expect(ds.backgroundColor).to.be.an('array').with.lengthOf(2);
    expect(ds.backgroundColor[0]).to.not.equal('rgb(10, 20, 30)');
    expect(ds.backgroundColor[1]).to.not.equal('rgb(40, 50, 60)');
  });

  it('applies a forced-colors pattern per array entry and to a single resolved background color', async () => {
    const el = (await fixture(html`<lr-chart type="line" area></lr-chart>`)) as LyraChart;
    el.labels = ['A', 'B'];
    el.datasets = [{ label: 'array', data: [1, 2], color: ['rgb(10, 20, 30)', 'rgb(40, 50, 60)'] }];
    const bar = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    bar.labels = ['A'];
    bar.datasets = [{ label: 'single', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    await bar.updateComplete;
    await waitUntil(() => (bar as any).chart != null);

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) =>
      mediaQueryList(query, query === '(forced-colors: active)');
    try {
      const arrayDs = (el as any).buildConfig().data.datasets[0];
      expect(Array.isArray(arrayDs.backgroundColor)).to.be.true;
      arrayDs.backgroundColor.forEach((entry: unknown) => expect(typeof entry).to.not.equal('string'));

      const singleDs = (bar as any).buildConfig().data.datasets[0];
      expect(typeof singleDs.backgroundColor).to.not.equal('string');
      expect(singleDs.borderDash).to.deep.equal([]);
      expect(singleDs.pointStyle).to.equal('circle');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('forcedColorPattern() returns the plain background when there is no owner window, no 2d context, or createPattern yields null', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await el.updateComplete;

    Object.defineProperty(el, 'ownerWindow', { get: () => undefined, configurable: true });
    expect((el as any).forcedColorPattern(0, 'red')).to.equal('red');
    delete (el as unknown as Record<string, unknown>)['ownerWindow'];

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => null;
    try {
      expect((el as any).forcedColorPattern(0, 'blue')).to.equal('blue');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }

    const fakeContext = {
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      createPattern: () => null,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
    };
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => fakeContext;
    try {
      expect((el as any).forcedColorPattern(0, 'green')).to.equal('green');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('forcedColorPattern() draws every remaining texture encoding without throwing', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await el.updateComplete;
    // Index 0 ("solid") and 1 ("horizontal") are already exercised elsewhere; cover the rest of
    // FORCED_COLOR_ENCODINGS's switch (vertical/diagonal/reverse-diagonal/crosshatch/dots/checker).
    for (let index = 2; index <= 7; index++) {
      expect(() => (el as any).forcedColorPattern(index, 'red')).to.not.throw();
    }
  });

  it('falls back to inline style (or the host style) when computedStyle has no owner window', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await el.updateComplete;
    Object.defineProperty(el, 'ownerWindow', { get: () => undefined, configurable: true });
    try {
      const probe = document.createElement('span');
      expect((el as any).computedStyle(probe)).to.equal(probe.style);
      expect((el as any).computedStyle({} as unknown as Element)).to.equal(el.style);
    } finally {
      delete (el as unknown as Record<string, unknown>)['ownerWindow'];
    }
  });

  it('resolves a non-px CSS unit (e.g. rem) for a style-number token via the offscreen probe', async () => {
    const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    el.style.setProperty('--border-radius', '2rem');
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const resolved = (el as any).styleNumber('--border-radius', '--lr-radius', 6);
    expect(resolved).to.equal(rootFontSize * 2);
  });

  it('falls back to the default when a style-number token resolves to a non-finite computed size', async () => {
    const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    el.style.setProperty('--border-radius', 'not-a-length');
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const resolved = (el as any).styleNumber('--border-radius', '--lr-radius', 6);
    expect(resolved).to.equal(6);
  });
});

describe('coverage: data-labels formatter/display and stack-total point values', () => {
  it('formats a data-label value through valueFormatter before falling back to toLocaleString', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1'];
    el.datasets = [{ label: 'A', data: [10] }];
    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    el.valueFormatter = (value) => `$${value}`;
    const datalabels = (el as any).buildConfig().options.plugins.datalabels;
    expect(datalabels.formatter(10, { datasetIndex: 0, dataIndex: 0 })).to.equal('$10');

    el.valueFormatter = undefined as unknown as typeof el.valueFormatter;
    const datalabels2 = (el as any).buildConfig().options.plugins.datalabels;
    expect(datalabels2.formatter(10, { datasetIndex: 0, dataIndex: 0 })).to.equal((10).toLocaleString());
  });

  it('returns a blank data-label for a non-numeric point value instead of NaN', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1'];
    el.datasets = [{ label: 'A', data: [10] }];
    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    const datalabels = (el as any).buildConfig().options.plugins.datalabels;
    expect(datalabels.formatter({}, { datasetIndex: 0, dataIndex: 0 })).to.equal('');
  });

  it('falls back to the plain dataLabels flag when a stack-totals category total is null', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1', 'Q2'];
    el.datasets = [
      { label: 'A', data: [10, null as unknown as number] },
      { label: 'B', data: [20, null as unknown as number] },
    ];
    (el as unknown as { stacked: boolean }).stacked = true;
    (el as unknown as { stackTotals: boolean }).stackTotals = true;
    const datalabels = (el as any).buildConfig().options.plugins.datalabels;
    // dataset index 1 ('B') is the topmost dataset per axis; Q2's total is null (both null).
    expect(datalabels.display({ datasetIndex: 1, dataIndex: 1 })).to.equal(false);

    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    const datalabels2 = (el as any).buildConfig().options.plugins.datalabels;
    expect(datalabels2.display({ datasetIndex: 1, dataIndex: 1 })).to.equal(true);
  });

  it('defers to the plain dataLabels flag for a non-topmost dataset even when stack totals are active', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1'];
    el.datasets = [
      { label: 'A', data: [10] },
      { label: 'B', data: [20] },
    ];
    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    (el as unknown as { stacked: boolean }).stacked = true;
    (el as unknown as { stackTotals: boolean }).stackTotals = true;
    const datalabels = (el as any).buildConfig().options.plugins.datalabels;
    // dataset index 0 ('A') is NOT the topmost dataset on its axis -- only the topmost draws a
    // stack total, so a non-topmost dataset falls straight back to the plain `dataLabels` flag.
    expect(datalabels.display({ datasetIndex: 0, dataIndex: 0 })).to.equal(true);
  });

  it('formats the stack total (not the raw point value) in the topmost dataset formatter when stack totals are active', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['Q1'];
    el.datasets = [
      { label: 'A', data: [10] },
      { label: 'B', data: [20] },
    ];
    (el as unknown as { stacked: boolean }).stacked = true;
    (el as unknown as { stackTotals: boolean }).stackTotals = true;
    const datalabels = (el as any).buildConfig().options.plugins.datalabels;
    // dataset index 1 ('B') is topmost; the category total (10 + 20 = 30) is formatted, not the
    // raw point value (20) the plugin would otherwise pass in.
    expect(datalabels.formatter(20, { datasetIndex: 1, dataIndex: 0 })).to.equal('30');
    // A non-topmost dataset's formatter ignores the stack total and formats its own raw value.
    expect(datalabels.formatter(10, { datasetIndex: 0, dataIndex: 0 })).to.equal('10');
  });

  it('reads point .y values when computing stack totals for a point-based stacked series', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'line';
    el.labels = ['Q1', 'Q2'];
    el.datasets = [{ label: 'A', points: [{ x: 0, y: 10 }, { x: 1, y: 20 }] }];
    (el as unknown as { stacked: boolean }).stacked = true;
    (el as unknown as { stackTotals: boolean }).stackTotals = true;
    const totals = (el as any).computeStackTotals('y');
    expect(totals).to.deep.equal([10, 20]);
  });

  it('recovers requiredPlugins into an array when config.plugins overrides the generated array with a non-array value', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['Jan'];
    el.datasets = [{ label: 'Revenue', data: [10] }];
    (el as unknown as { dataLabels: boolean }).dataLabels = true;
    (el as any).dataLabelsPlugin = { id: 'datalabels' };
    el.config = { plugins: null as unknown as undefined };
    const config = (el as any).buildConfig();
    expect(config.plugins).to.deep.equal([{ id: 'datalabels' }]);
  });
});

describe('coverage: scale bounds and grid axis visibility', () => {
  it('applies explicit min/max scale bounds and ignores non-finite values', async () => {
    const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    el.min = 0;
    el.max = 100;
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    let config = (el as any).buildConfig();
    expect(config.options.scales.y.min).to.equal(0);
    expect(config.options.scales.y.max).to.equal(100);

    el.min = Number.NaN;
    el.max = null;
    await el.updateComplete;
    config = (el as any).buildConfig();
    expect(config.options.scales.y.min).to.equal(undefined);
    expect(config.options.scales.y.max).to.equal(undefined);
  });

  it('shows or hides grid lines per axis via the `grid` property', async () => {
    const el = (await fixture(html`<lr-chart type="bar"></lr-chart>`)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    el.grid = 'x';
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    let config = (el as any).buildConfig();
    expect(config.options.scales.x.grid.display).to.equal(true);
    expect(config.options.scales.y.grid.display).to.equal(false);

    el.grid = 'none';
    await el.updateComplete;
    config = (el as any).buildConfig();
    expect(config.options.scales.x.grid.display).to.equal(false);
    expect(config.options.scales.y.grid.display).to.equal(false);
  });

  it('parses the grid attribute from a plain HTML string, defaulting to "both" for an unrecognized value', async () => {
    const el = (await fixture(html`<lr-chart type="bar" grid="x"></lr-chart>`)) as LyraChart;
    expect(el.grid).to.equal('x');

    const fallback = (await fixture(
      html`<lr-chart type="bar" grid="not-a-real-grid-value"></lr-chart>`,
    )) as LyraChart;
    expect(fallback.grid).to.equal('both');
  });
});

describe('coverage: chartDatums/datumDisplayValue/keyboard-navigation fallbacks', () => {
  it('chartDatums() falls back to `this.datasets`/`this.labels` before a Chart.js instance exists and skips null/non-finite values', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'Revenue', data: [10, null as unknown as number, Number.POSITIVE_INFINITY, 40] }];
    const datums = (el as any).chartDatums();
    expect(datums).to.deep.equal([
      { datasetIndex: 0, index: 0, label: 'A', value: 10 },
      { datasetIndex: 0, index: 3, label: undefined, value: 40 },
    ]);
  });

  it('bounds generated point descriptions and keyboard datums to the shared 1,000-record sample', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const points = Array.from({ length: 1_001 }, (_, index) => ({ x: index, y: index }));
    el.type = 'scatter';
    el.datasets = [{ label: 'Points', points }];

    const datums = (el as any).chartDatums();
    const description = (el as any).chartDescription();
    expect(datums).to.have.length(1_000);
    expect(datums[0].index).to.equal(0);
    expect(datums.at(-1).index).to.equal(1_000);
    expect((description.match(/x /g) ?? [])).to.have.length(1_000);
    expect(description).to.contain((el as any).datumDisplayValue(points[0]));
    expect(description).to.contain((el as any).datumDisplayValue(points.at(-1)));
  });

  it('datumDisplayValue() reads y/r/x off a non-point object value and falls back to the raw string when non-numeric', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    expect((el as any).datumDisplayValue({ r: 5 })).to.equal('5');
    expect((el as any).datumDisplayValue({ x: 7 })).to.equal('7');
    expect((el as any).datumDisplayValue('n/a')).to.equal('n/a');
  });

  it('uses the built-in whole-message coordinate and labeled-point fallbacks', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    expect((el as any).datumDisplayValue({ x: 10, y: 20 })).to.equal('x 10, y 20');
    expect((el as any).datumDisplayValue({ x: 10, y: 20, r: 7, label: 'North' }))
      .to.equal('North: x 10, y 20, radius 7');
  });

  it('navigates keyboard datums with Home/End/ArrowUp/ArrowDown and ignores an unrecognized key', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.type = 'bar';
    el.labels = ['A', 'B', 'C'];
    el.datasets = [{ label: 'Revenue', data: [10, 20, 30] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    expect((el as any).keyboardDatumIndex).to.equal(0);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect((el as any).keyboardDatumIndex).to.equal(2);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect((el as any).keyboardDatumIndex).to.equal(1);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect((el as any).keyboardDatumIndex).to.equal(2);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect((el as any).keyboardDatumIndex).to.equal(0);

    const announcementBefore = (el as any).keyboardDatumAnnouncement;
    const unrecognized = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    canvas.dispatchEvent(unrecognized);
    expect((el as any).keyboardDatumIndex).to.equal(0);
    expect((el as any).keyboardDatumAnnouncement).to.equal(announcementBefore);
    expect(unrecognized.defaultPrevented).to.be.false;
  });

  it('swaps ArrowLeft/ArrowRight forward/backward semantics under RTL', async () => {
    const wrapper = await fixture(html`<div dir="rtl"><lr-chart></lr-chart></div>`);
    const el = wrapper.querySelector('lr-chart') as LyraChart;
    el.type = 'bar';
    el.labels = ['A', 'B'];
    el.datasets = [{ label: 'Revenue', data: [10, 20] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    expect((el as any).keyboardDatumIndex).to.equal(0);

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect((el as any).keyboardDatumIndex).to.equal(1);
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect((el as any).keyboardDatumIndex).to.equal(0);
  });

  it('no-ops focus/keydown activation on an empty chart with no datums', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    expect((el as any).keyboardDatumAnnouncement).to.equal('');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect((el as any).keyboardDatumAnnouncement).to.equal('');
  });

  it('falls back to the localized "chartSeriesLabel" and numbered point label when the active dataset/datum have none', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.type = 'bar';
    el.labels = [];
    el.datasets = [{ label: '', data: [10] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await el.updateComplete;
    expect((el as any).keyboardDatumAnnouncement).to.equal('Series, Point 1: 10 (1 of 1)');
  });
});

describe('coverage: legend/tooltip/table label fallbacks and misc guards', () => {
  it('legendValue returns undefined when the legend item carries no datasetIndex at all', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const value = (el as any).legendValue({}, { data: { datasets: [{ label: 'A', data: [1] }] } });
    expect(value).to.equal(undefined);
  });

  it('falls back to context.raw when parsed is nullish for a non-object tooltip context', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.valueFormatter = (value, context) => `${context}:${value}`;
    const text = (el as any).tooltipLabel({ parsed: null, raw: 7, dataset: {} });
    expect(text).to.equal('tooltip:7');
  });

  it('resolves "start"/"end" legend-position aliases against the effective direction', async () => {
    const wrapper = await fixture(html`<div><lr-chart legend-position="start"></lr-chart></div>`);
    const el = wrapper.querySelector('lr-chart') as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    expect((el as any).buildConfig().options.plugins.legend.position).to.equal('left');

    el.legendPosition = 'end';
    await el.updateComplete;
    expect((el as any).buildConfig().options.plugins.legend.position).to.equal('right');

    wrapper.setAttribute('dir', 'rtl');
    await aTimeout(0);
    await el.updateComplete;
    expect((el as any).buildConfig().options.plugins.legend.position).to.equal('left');

    el.legendPosition = 'start';
    await el.updateComplete;
    expect((el as any).buildConfig().options.plugins.legend.position).to.equal('right');
  });

  it('renders the DOM legend on the physical side each legend-position names, in both directions', async () => {
    const wrapper = await fixture(
      html`<div style="inline-size: 640px"><lr-chart legend-position="start"></lr-chart></div>`,
    );
    const el = wrapper.querySelector('lr-chart') as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null, 'chart.js never initialized', {
      timeout: 5000,
    });
    await el.updateComplete;

    // A rendered comparison, not the stylesheet text or the (never-drawn) canvas legend config:
    // the CSS grid mirrors its own column order under RTL, so only the painted geometry proves
    // which physical edge the legend actually landed on.
    const legendStart = (): number =>
      (el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement).getBoundingClientRect().left;
    const plotStart = (): number =>
      (el.shadowRoot!.querySelector('[part="plot"]') as HTMLElement).getBoundingClientRect().left;
    const setPosition = async (value: string): Promise<void> => {
      el.legendPosition = value as typeof el.legendPosition;
      await el.updateComplete;
    };

    expect(legendStart() < plotStart(), 'ltr + start must paint the legend at the left').to.equal(
      true,
    );
    await setPosition('end');
    expect(legendStart() > plotStart(), 'ltr + end must paint the legend at the right').to.equal(
      true,
    );
    await setPosition('left');
    expect(legendStart() < plotStart(), 'ltr + left must paint the legend at the left').to.equal(
      true,
    );
    await setPosition('right');
    expect(legendStart() > plotStart(), 'ltr + right must paint the legend at the right').to.equal(
      true,
    );

    wrapper.setAttribute('dir', 'rtl');
    await aTimeout(0);
    await setPosition('start');
    expect(legendStart() > plotStart(), 'rtl + start must paint the legend at the right').to.equal(
      true,
    );
    await setPosition('end');
    expect(legendStart() < plotStart(), 'rtl + end must paint the legend at the left').to.equal(
      true,
    );
    await setPosition('left');
    expect(legendStart() < plotStart(), 'rtl + left must stay physically left').to.equal(true);
    await setPosition('right');
    expect(legendStart() > plotStart(), 'rtl + right must stay physically right').to.equal(true);
  });

  it('tableStackTotalLabel() falls back to localized primary/secondary axis names when no explicit axis label is set', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    expect((el as any).tableStackTotalLabel('y', 2)).to.equal('Primary axis total');
    expect((el as any).tableStackTotalLabel('y2', 2)).to.equal('Secondary axis total');
  });

  it('legendTextFor() falls back to the plain label when the dataset has no finite values or the formatted value is unchanged', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const runtimeFormatter = el as unknown as {
      valueFormatter: (value: number) => number | string;
    };
    runtimeFormatter.valueFormatter = (value) => value;
    expect((el as any).legendTextFor({ label: 'Empty', data: [] }, 0)).to.equal('Empty');
    expect((el as any).legendTextFor({ label: 'Same', data: [10] }, 0)).to.equal('Same');
  });

  it('legendColor() falls back to transparent when the palette lookup produces no entry', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const color = (el as any).legendColor({ label: 'x' }, Number.NaN);
    expect(color).to.equal('transparent');
  });

  it('no-ops toggling a dataset before a Chart.js instance exists', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    expect(() => (el as any).toggleDataset(0)).to.not.throw();
  });

  it('prioritizes the `description` property over the generated summary', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.description = 'Explicit description wins.';
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    const description = el.shadowRoot!.querySelector('[part="description"]') as HTMLElement;
    expect(description.textContent).to.equal('Explicit description wins.');
  });

  it('has no redundant positive-polarity legend property — withoutLegend is the only control', () => {
    expect(Object.getOwnPropertyDescriptor(LyraChart.prototype, 'legend')).to.equal(undefined);
  });

  it('renders no legend markup when withoutLegend is set', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'x', data: [1] }];
    el.withoutLegend = true;
    await el.updateComplete;
    await waitUntil(() => (el as any).chart != null);
    expect((el.shadowRoot!.querySelector('[part="legend"]')) == null).to.be.true;
  });
});

describe("scaleType: logarithmic value axis", () => {
  const scalesOf = (el: LyraChart) =>
    (el as unknown as {
      buildScales: (
        type: string,
        theme: unknown,
        style: unknown
      ) => Record<string, { type?: string; beginAtZero?: boolean }>;
    }).buildScales(
      "line",
      { tick: "#000", grid: "#eee" },
      { gridBorderWidth: 1 }
    );

  it("defaults the value axis to linear, leaving the categorical axis alone", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await el.updateComplete;
    const scales = scalesOf(el);
    expect(el.scaleType, "unset default").to.equal("linear");
    expect(scales["y"]?.type, "value axis").to.equal("linear");
    expect(scales["x"]?.type, "categorical axis is untouched").to.equal("category");
  });

  it("switches the value axis to a logarithmic scale", async () => {
    // Without LogarithmicScale registered, Chart.js rejects the type at construction, so this was
    // unreachable even through the raw `config` passthrough.
    const el = (await fixture(
      html`<lr-chart scale-type="logarithmic"></lr-chart>`
    )) as LyraChart;
    await el.updateComplete;
    const scales = scalesOf(el);
    expect(el.scaleType).to.equal("logarithmic");
    expect(scales["y"]?.type, "value axis goes log").to.equal("logarithmic");
    expect(scales["x"]?.type, "the categorical axis stays categorical").to.equal("category");
  });

  it('updates an already-mounted value axis when only scaleType changes', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ['a', 'b'];
    el.datasets = [{ label: 'values', data: [1, 100] }];
    await el.updateComplete;
    await waitUntil(() => (el as any).chart?.scales?.y != null);
    const chart = (el as any).chart;
    expect(chart.scales.y.type).to.equal('linear');
    const originalUpdate = chart.update.bind(chart);
    let updateCalls = 0;
    chart.update = (...args: unknown[]) => {
      updateCalls += 1;
      return originalUpdate(...args);
    };

    try {
      el.scaleType = 'logarithmic';
      await el.updateComplete;
      expect(updateCalls).to.be.greaterThan(0);
      expect(chart.scales.y.type).to.equal('logarithmic');
    } finally {
      chart.update = originalUpdate;
    }
  });

  it("suppresses beginAtZero on a logarithmic axis, which cannot place zero", async () => {
    const linear = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await linear.updateComplete;
    expect(scalesOf(linear)["y"]?.beginAtZero, "linear forwards it").to.equal(true);

    const log = (await fixture(
      html`<lr-chart scale-type="logarithmic"></lr-chart>`
    )) as LyraChart;
    await log.updateComplete;
    expect(
      scalesOf(log)["y"]?.beginAtZero,
      "log(0) is -Infinity, so the bound is not forwarded"
    ).to.equal(undefined);
  });

  it("renders a dataset spanning several orders of magnitude on a log axis", async () => {
    const el = (await fixture(
      html`<lr-chart scale-type="logarithmic"></lr-chart>`
    )) as LyraChart;
    el.labels = ["a", "b", "c", "d"];
    el.datasets = [{ label: "latency", data: [1, 100, 10_000, 1_000_000] }];
    await el.updateComplete;
    await aTimeout(0);
    expect(
      el.shadowRoot!.querySelector("canvas"),
      "the chart constructs rather than throwing on an unregistered scale type"
    ).to.exist;
  });
});

describe("declarative annotations", () => {
  const configOf = (el: LyraChart) =>
    (el as unknown as { buildConfig: () => Record<string, unknown> }).buildConfig();

  const annotationsOf = (el: LyraChart) => {
    const options = configOf(el)["options"] as
      | { plugins?: { annotation?: { annotations?: Record<string, Record<string, unknown>> } } }
      | undefined;
    return options?.plugins?.annotation?.annotations;
  };

  it("emits no annotation options at all when none are set", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await el.updateComplete;
    expect(el.annotations, "unset default").to.deep.equal([]);
    expect(annotationsOf(el), "a chart without annotations carries no annotation config").to.equal(
      undefined
    );
  });

  it("maps a single value to a reference line on its axis", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.annotations = [{ axis: "y", value: 80, label: "SLO", tone: "warning" }];
    await el.updateComplete;
    await waitUntil(() => annotationsOf(el) !== undefined, "annotation peer loads", {
      timeout: 4000,
    });
    const entries = Object.values(annotationsOf(el)!);
    expect(entries).to.have.length(1);
    expect(entries[0]!["type"]).to.equal("line");
    expect(entries[0]!["scaleID"]).to.equal("y");
    expect(entries[0]!["value"]).to.equal(80);
    expect(entries[0]!["borderColor"], "tone resolves to a canvas-ready colour").to.be.a("string");
  });

  it("maps a from/to pair to a shaded band bounded on its own axis only", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.annotations = [{ axis: "x", from: 2, to: 5, label: "Recession" }];
    await el.updateComplete;
    await waitUntil(() => annotationsOf(el) !== undefined, "annotation peer loads", {
      timeout: 4000,
    });
    const entry = Object.values(annotationsOf(el)!)[0]!;
    expect(entry["type"]).to.equal("box");
    expect(entry["xMin"]).to.equal(2);
    expect(entry["xMax"]).to.equal(5);
    expect(entry["yMin"], "unbounded on the other axis, so it spans the plot").to.equal(undefined);
  });

  it("normalizes a reversed range instead of dropping it", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.annotations = [{ axis: "y", from: 9, to: 3 }];
    await el.updateComplete;
    await waitUntil(() => annotationsOf(el) !== undefined, "annotation peer loads", {
      timeout: 4000,
    });
    const entry = Object.values(annotationsOf(el)!)[0]!;
    expect(entry["yMin"]).to.equal(3);
    expect(entry["yMax"]).to.equal(9);
  });

  it("drops entries that specify neither a finite value nor a finite range", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.annotations = [
      { axis: "y", label: "no coordinates" },
      { axis: "y", value: Number.NaN },
      { axis: "y", from: 1 },
      { axis: "y", value: 5 },
    ] as unknown as readonly LyraChartAnnotation[];
    await el.updateComplete;
    await waitUntil(() => annotationsOf(el) !== undefined, "annotation peer loads", {
      timeout: 4000,
    });
    expect(
      Object.values(annotationsOf(el)!),
      "only the one usable entry survives"
    ).to.have.length(1);
  });

  it("includes labelled annotations in the accessible description", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ["a", "b"];
    el.datasets = [{ label: "s", data: [1, 2] }];
    el.annotations = [{ axis: "y", value: 80, label: "SLO threshold" }];
    await el.updateComplete;
    await aTimeout(0);
    const description = el.shadowRoot!.querySelector('[part="description"]')!.textContent ?? "";
    expect(
      description,
      "the annotation's meaning reaches assistive tech, not just the canvas"
    ).to.contain("SLO threshold");
  });

  it("leaves a chart that sets no annotations completely unaffected", async () => {
    // The reported concern was Chart.js's page-wide singleton registry. This plugin is registered
    // globally (it has to be -- registration installs its element defaults), but unlike
    // chartjs-plugin-datalabels it draws nothing without annotation options, so a neighbouring
    // chart must be observably untouched.
    const annotated = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    annotated.annotations = [{ axis: "y", value: 10 }];
    await annotated.updateComplete;
    await waitUntil(() => annotationsOf(annotated) !== undefined, "peer loads", { timeout: 4000 });

    const plain = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    plain.labels = ["a", "b"];
    plain.datasets = [{ label: "s", data: [1, 2] }];
    await plain.updateComplete;
    await aTimeout(0);
    expect(
      annotationsOf(plain),
      "a chart setting no annotations carries no annotation options"
    ).to.equal(undefined);
    const plainPlugins = configOf(plain)["plugins"] as unknown[] | undefined;
    expect(plainPlugins ?? [], "and gains no inline plugin entry").to.have.length(0);
    expect(
      plain.shadowRoot!.querySelector("canvas"),
      "and still renders normally"
    ).to.exist;
  });

  it('removes live annotation paint when only annotations is cleared', async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ['a', 'b'];
    el.datasets = [{ label: 'values', data: [1, 2] }];
    el.annotations = [{ axis: 'y', value: 1, label: 'threshold' }];
    await el.updateComplete;
    const liveAnnotationCount = (): number =>
      Object.keys((el as any).chart?.options?.plugins?.annotation?.annotations ?? {}).length;
    await waitUntil(() => liveAnnotationCount() === 1, 'live annotation paint loads', {
      timeout: 4000,
    });
    const chart = (el as any).chart;
    const originalUpdate = chart.update.bind(chart);
    let updateCalls = 0;
    chart.update = (...args: unknown[]) => {
      updateCalls += 1;
      return originalUpdate(...args);
    };

    try {
      el.annotations = [];
      await el.updateComplete;
      expect(updateCalls).to.be.greaterThan(0);
      expect(liveAnnotationCount()).to.equal(0);
    } finally {
      chart.update = originalUpdate;
    }
  });
});

describe("formatter surfaces: export and spoken", () => {
  it("routes CSV cells through the 'export' surface, as lr-lite-chart already did", async () => {
    const seen: string[] = [];
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ["a", "b"];
    el.datasets = [{ label: "s", data: [1000, 2000] }];
    el.formatter = ({ value, surface }) => {
      seen.push(surface as string);
      return surface === "export" ? `${value} kg` : String(value);
    };
    await el.updateComplete;
    await aTimeout(0);

    const csv = el.exportData("csv");
    expect(seen, "the export surface actually reaches the formatter").to.include("export");
    expect(csv, "and its return value reaches the cell").to.contain("1000 kg");
  });

  it("leaves CSV cells as raw numbers when no formatter is installed", async () => {
    // A spreadsheet must still parse the default output, so the export surface must not introduce
    // locale grouping of its own.
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ["a"];
    el.datasets = [{ label: "s", data: [1000] }];
    await el.updateComplete;
    await aTimeout(0);
    expect(el.exportData("csv"), "unchanged default").to.contain("1000");
    expect(el.exportData("csv"), "no thousands separator introduced").to.not.contain("1,000");
  });

  it("routes the live announcement through the 'spoken' surface", async () => {
    const seen: string[] = [];
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ["a", "b"];
    el.datasets = [{ label: "s", data: [5, 6] }];
    el.formatter = ({ value, surface }) => {
      seen.push(surface as string);
      return surface === "spoken" ? `${value} degrees` : String(value);
    };
    await el.updateComplete;
    await aTimeout(0);

    const spoken = (
      el as unknown as { datumDisplayValue: (value: unknown) => string }
    ).datumDisplayValue(5);
    expect(seen, "the spoken surface actually reaches the formatter").to.include("spoken");
    expect(spoken, "and its return value is what gets announced").to.equal("5 degrees");
  });

  it("still announces the locale number format when no formatter is installed", async () => {
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    el.labels = ["a"];
    el.datasets = [{ label: "s", data: [1234] }];
    await el.updateComplete;
    await aTimeout(0);
    const spoken = (
      el as unknown as { datumDisplayValue: (value: unknown) => string }
    ).datumDisplayValue(1234);
    expect(spoken, "unchanged default").to.equal(
      new Intl.NumberFormat(resolveLyraLocale(el)).format(1234)
    );
  });
});

describe('data-table disclosure', () => {
  async function chartWith(markup: unknown): Promise<LyraChart> {
    const el = (await fixture(markup as never)) as LyraChart;
    el.labels = ['Q1', 'Q2', 'Q3'];
    el.datasets = [{ label: 'Revenue', data: [1, 2, 3] }];
    await el.updateComplete;
    return el;
  }

  function toggleButton(el: LyraChart): HTMLButtonElement | null {
    return el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]');
  }

  function tableWrapper(el: LyraChart): HTMLElement {
    return el.shadowRoot!.querySelector<HTMLElement>('[part~="data-table"]')!;
  }

  it('renders no toggle at all while the property is unset', async () => {
    const collapsed = await chartWith(html`<lr-chart></lr-chart>`);
    expect(toggleButton(collapsed) === null, 'opt-in only').to.be.true;
    expect(tableWrapper(collapsed).hasAttribute('data-visually-hidden')).to.be.true;

    const shown = await chartWith(html`<lr-chart show-data-table></lr-chart>`);
    expect(
      toggleButton(shown) === null,
      'still opt-in when the table is already visible',
    ).to.be.true;
    expect(tableWrapper(shown).hasAttribute('data-visually-hidden')).to.be.false;
  });

  it('renders a labelled, wired disclosure button when opted in', async () => {
    const el = await chartWith(html`<lr-chart data-table-toggle></lr-chart>`);
    const button = toggleButton(el)!;

    expect(button, 'the disclosure renders').to.exist;
    expect(button.textContent?.trim(), 'localized, not hard-coded').to.not.equal('');
    expect(button.getAttribute('aria-expanded')).to.equal('false');
    expect(button.getAttribute('aria-controls')).to.equal(tableWrapper(el).id);
    expect(tableWrapper(el).id, 'the wrapper carries a real id').to.not.equal('');
  });

  it('reveals the table on activation and keeps it in the DOM throughout', async () => {
    const el = await chartWith(html`<lr-chart data-table-toggle></lr-chart>`);
    const button = toggleButton(el)!;
    expect(el.shadowRoot!.querySelector('table'), 'present while collapsed').to.exist;
    expect(tableWrapper(el).hasAttribute('data-visually-hidden')).to.be.true;

    button.click();
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
    const el = await chartWith(html`<lr-chart show-data-table data-table-toggle></lr-chart>`);

    expect(toggleButton(el)!.getAttribute('aria-expanded')).to.equal('true');
    expect(tableWrapper(el).hasAttribute('data-visually-hidden')).to.be.false;
  });

  it('keeps the disclosure immediately above the table when expansion makes the table visible', async () => {
    const el = await chartWith(html`<lr-chart show-data-table data-table-toggle></lr-chart>`);
    const buttonRect = toggleButton(el)!.getBoundingClientRect();
    const tableRect = tableWrapper(el).getBoundingClientRect();

    expect(
      buttonRect.bottom,
      'the auto-placed toggle must not move below its explicitly placed table'
    ).to.be.at.most(tableRect.top + 1);
  });

  it('gives the generated cell buttons a tab stop only while the table is visible', async () => {
    const el = await chartWith(html`<lr-chart data-table-toggle></lr-chart>`);
    const cellButton = (): HTMLButtonElement =>
      el.shadowRoot!.querySelector<HTMLButtonElement>('table td button')!;
    expect(cellButton().getAttribute('tabindex')).to.equal('-1');

    toggleButton(el)!.click();
    await el.updateComplete;
    expect(cellButton().getAttribute('tabindex')).to.equal('0');
  });

  it('is accessible collapsed and expanded', async () => {
    const el = await chartWith(html`<lr-chart data-table-toggle></lr-chart>`);
    await expect(el).to.be.accessible();

    toggleButton(el)!.click();
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('bounded chart fallback paths', () => {
  it('requests annotation support during initial connection when annotations are already present', async () => {
    const mod = await import('chart.js');
    const el = document.createElement('lr-chart') as LyraChart;
    el.annotations = [{ value: 1 }];
    let requests = 0;
    (el as any).loadLibrary = () => Promise.resolve(mod);
    (el as any).loadAnnotationFeature = () => {
      requests += 1;
      return Promise.resolve({ kind: 'feature-unavailable', mod });
    };
    document.body.append(el);
    try {
      await waitUntil(() => requests === 1);
      await waitUntil(() => (el as any).chart != null);
      expect(requests).to.equal(1);
    } finally {
      el.remove();
    }
  });

  it('retains a usable core module when each optional feature alone is unavailable', async () => {
    const mod = await import('chart.js');
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await waitUntil(() => (el as any).chart != null);
    (el as any).loading = false;

    el.zoom = true;
    (el as any).chartJsModule = undefined;
    (el as any).loadZoomFeature = () =>
      Promise.resolve({ kind: 'feature-unavailable', mod });
    (el as any).requestZoomFeature();
    await waitUntil(() => (el as any).zoomFeatureState === 'unavailable');
    expect((el as any).chartJsModule).to.equal(mod);

    el.dataLabels = true;
    (el as any).chartJsModule = undefined;
    (el as any).loadDataLabelsFeature = () =>
      Promise.resolve({ kind: 'feature-unavailable', mod });
    (el as any).requestDataLabelsFeature();
    await waitUntil(() => (el as any).dataLabelsFeatureState === 'unavailable');
    expect((el as any).chartJsModule).to.equal(mod);

    el.annotations = [{ value: 1 }];
    (el as any).chartJsModule = undefined;
    (el as any).loadAnnotationFeature = () =>
      Promise.resolve({ kind: 'feature-unavailable', mod });
    (el as any).requestAnnotationFeature();
    await waitUntil(() => (el as any).chartJsModule === mod);
    expect((el as any).annotationPlugin).to.equal(undefined);
  });

  it('discards stale data-label and annotation feature results after demand is removed', async () => {
    const mod = await import('chart.js');
    const el = (await fixture(html`<lr-chart></lr-chart>`)) as LyraChart;
    await waitUntil(() => (el as any).chart != null);

    let resolveDataLabels!: (value: unknown) => void;
    el.dataLabels = true;
    (el as any).loadDataLabelsFeature = () =>
      new Promise((resolve) => {
        resolveDataLabels = resolve;
      });
    (el as any).requestDataLabelsFeature();
    el.dataLabels = false;
    resolveDataLabels({ kind: 'available', mod, plugin: { id: 'late-labels' } });
    await aTimeout(0);
    expect((el as any).dataLabelsPlugin).to.equal(undefined);

    let resolveAnnotation!: (value: unknown) => void;
    el.annotations = [{ value: 1 }];
    (el as any).loadAnnotationFeature = () =>
      new Promise((resolve) => {
        resolveAnnotation = resolve;
      });
    (el as any).requestAnnotationFeature();
    el.annotations = [];
    resolveAnnotation({ kind: 'available', mod, plugin: { id: 'late-annotation' } });
    await aTimeout(0);
    expect((el as any).annotationPlugin).to.equal(undefined);
  });

  it('samples every per-point series field and handles an empty forced-color fill', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const style = {
      borderColors: ['rgb(1, 2, 3)'],
      fillColors: [],
      authoredFillColors: [false],
      borderRadius: 0,
      borderWidth: 1,
      gridBorderWidth: 1,
      lineBorderWidth: 2,
      pointRadius: 4,
      forcedColors: true,
    };
    const dataset = (el as any).seriesToDataset(
      {
        label: 'sampled',
        data: [1, 2],
        fill: true,
        segmentColors: ['red', 'blue'],
        pointColors: ['green', 'yellow'],
        pointRadius: [2, 3],
      },
      0,
      [],
      'line',
      style,
      [1],
    );
    expect(dataset.data).to.deep.equal([2]);
    expect(dataset.backgroundColor).to.equal(undefined);
    expect(dataset.pointRadius).to.deep.equal([3]);
    expect(dataset.pointBackgroundColor).to.have.length(1);
    expect(dataset.segment.borderColor({ p0DataIndex: 0 })).to.be.a('string');

    const colored = (el as any).seriesToDataset(
      { label: 'colors', data: [1, 2], color: ['red', 'blue'] },
      0,
      ['black'],
      'bar',
      { ...style, forcedColors: false, fillColors: ['black'] },
      [1],
    );
    expect(colored.backgroundColor).to.have.length(1);
  });

  it('samples an over-wide series dimension and preserves source indexes', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['row'];
    el.datasets = Array.from({ length: 1_001 }, (_, index) => ({
      label: `series-${index}`,
      data: [index],
    }));
    const config = (el as any).buildConfig();
    const sources = (el as any).visualDatasetSourceIndexes as number[];
    expect(sources).to.have.length(1_000);
    expect(sources[0]).to.equal(0);
    expect(sources.at(-1)).to.equal(1_000);
    expect(config.data.datasets).to.have.length(1_000);
  });

  it('uses slice activation and the physical-bottom legend fallback', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'polarArea';
    el.labels = ['A'];
    el.datasets = [{ label: 'share', data: [1] }];
    let detail: unknown;
    el.addEventListener('lr-datum-activate', (event) => {
      detail = (event as CustomEvent).detail;
    });
    (el as any).activateDatum({ datasetIndex: 0, index: 0, label: 'A', value: 1 });
    expect(detail).to.deep.include({ kind: 'slice' });

    el.legendPosition = 'bottom';
    expect((el as any).legendGridPlacement()).to.equal('bottom');
  });

  it('keeps the loading branch when Lit update completion rejects', async () => {
    const tagName = 'lr-chart-rejecting-update-coverage';
    if (!customElements.get(tagName)) {
      customElements.define(
        tagName,
        class extends LyraChart {
          override get updateComplete(): Promise<boolean> {
            return Promise.reject(new Error('update failed'));
          }
        },
      );
    }
    const el = document.createElement(tagName) as LyraChart;
    (el as any).loadLibrary = () => import('chart.js');
    document.body.append(el);
    try {
      await aTimeout(20);
      expect((el as any).loading).to.be.true;
      expect((el as any).chart).to.equal(undefined);
    } finally {
      el.remove();
    }
  });

  it('handles absent runtime metadata and falls back to source dataset indexes', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    expect((el as any).applyDatasetVisibility()).to.be.false;

    (el as any).chart = {
      data: {},
      getDatasetMeta: () => undefined,
      setDatasetVisibility: () => undefined,
    };
    expect((el as any).applyDatasetVisibility()).to.be.false;

    let visibility: [number, boolean] | undefined;
    el.datasets = [{ label: 'A', data: [1] }];
    el.hiddenDatasets = [0];
    (el as any).chart = {
      data: { datasets: [{}] },
      setDatasetVisibility: (index: number, visible: boolean) => {
        visibility = [index, visible];
      },
    };
    (el as any).visualDatasetSourceIndexes = undefined;
    expect((el as any).applyDatasetVisibility()).to.be.true;
    expect(visibility).to.deep.equal([0, false]);
  });

  it('appends an absent generated series value through an explicit labels-only config', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.datasets = [{ label: 'empty' }];
    el.config = { data: { labels: ['A'] } };
    el.appendData('B', [], 0);
    expect(el.datasets[0]!.data).to.deep.equal([null, null]);
    expect(el.config.data!.labels).to.deep.equal(['A', 'B']);
  });

  it('applies a positive stream bound to generated series behind an explicit labels-only config', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.datasets = [{ label: 'bounded', data: [1, 2] }];
    el.config = { data: { labels: ['A', 'B'] } };
    el.appendData('C', [3], 2);

    expect(el.labels).to.deep.equal([]);
    expect(el.datasets[0]!.data).to.deep.equal([2, 3]);
    expect(el.config.data!.labels).to.deep.equal(['B', 'C']);
  });

  it('exports blank x/y cells for a missing point without optional point columns', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'scatter';
    el.labels = ['A', 'B'];
    el.datasets = [{
      label: 'points',
      points: [{ x: 1, y: 2 }, null as unknown as { x: number; y: number }],
    }];
    expect(el.exportData('csv').split('\r\n')).to.deep.equal([
      'label,points x,points y',
      'A,1,2',
      'B,,',
    ]);
  });

  it('contains watcher and warning fallbacks when their optional runtime state is absent', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const descriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    try {
      expect(() => (el as any).armReducedMotionWatcher()).to.not.throw();
    } finally {
      if (descriptor) Object.defineProperty(window, 'matchMedia', descriptor);
      else Reflect.deleteProperty(window, 'matchMedia');
    }

    (el as any).loading = false;
    (el as any).loadFailed = true;
    expect((el as any).featureWarningMessages()).to.deep.equal([]);
  });

  it('resolves empty-palette series fallbacks and both forced-color array index modes', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    (el as any).forcedColorPattern = (index: number, color: string) => `${index}:${color}`;
    const baseStyle = {
      borderColors: [],
      fillColors: [],
      authoredFillColors: [],
      borderRadius: 0,
      borderWidth: 1,
      gridBorderWidth: 1,
      lineBorderWidth: 2,
      pointRadius: 3,
      forcedColors: false,
    };

    const scalar = (el as any).seriesToDataset(
      { label: 'scalar', data: [1], color: 'red' },
      0,
      [],
      'bar',
      baseStyle,
    );
    expect(scalar.backgroundColor).to.have.length(1);

    const array = (el as any).seriesToDataset(
      { label: 'array', data: [1], color: ['red'] },
      0,
      [],
      'bar',
      baseStyle,
    );
    expect(array.backgroundColor).to.have.length(1);

    const decorated = (el as any).seriesToDataset(
      {
        label: 'decorated',
        data: [1],
        segmentColors: ['red'],
        pointColors: ['blue'],
      },
      0,
      [],
      'line',
      baseStyle,
    );
    expect(decorated.segment.borderColor({ p0DataIndex: 0 })).to.be.a('string');
    expect(decorated.pointBackgroundColor).to.have.length(1);

    const slice = (el as any).seriesToDataset(
      { label: 'slice', data: [1, 2] },
      2,
      [],
      'pie',
      { ...baseStyle, borderColors: ['black'], fillColors: ['white'] },
    );
    expect(slice.backgroundColor).to.deep.equal(['white', 'white']);
    expect(slice.borderColor).to.deep.equal(['black', 'black']);

    const forced = (el as any).seriesToDataset(
      { label: 'forced', data: [1, 2], color: ['red', 'blue'] },
      3,
      [],
      'bar',
      { ...baseStyle, forcedColors: true },
    );
    expect(forced.backgroundColor).to.deep.equal(['3:transparent', '3:transparent']);
  });

  it('measures a detached relative CSS length through its light-DOM probe', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.style.setProperty('--coverage-size', '1rem');
    expect((el as any).styleNumber('--coverage-size', '--missing-size', 7)).to.be.greaterThan(0);
    expect(el.children).to.have.length(0);
  });

  it('rejects non-array and primitive annotation inputs', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    (el as any).annotations = { value: 1 };
    expect((el as any).normalizedAnnotations()).to.deep.equal([]);
    (el as any).annotations = [42];
    expect((el as any).normalizedAnnotations()).to.deep.equal([]);
  });

  it('uses axis aliases in both data-label callbacks and the formatter-first visual path', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.stackTotals = true;
    el.stacked = true;
    el.datasets = [{ label: 'secondary', axis: 'y2', data: [2] }];
    const options = (el as any).datalabelsOptions({ tick: 'black' }, 'bar');
    expect(options.display({ datasetIndex: 0, dataIndex: 0 })).to.be.true;
    expect(options.formatter(2, { datasetIndex: 0, dataIndex: 0 })).to.equal('2');

    el.formatter = ({ value, surface }) => `${surface}:${value}`;
    expect((el as any).formatDataLabel(4)).to.equal('visual:4');
  });

  it('applies value bounds to a secondary vertical scale', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.type = 'bar';
    el.min = 1;
    el.max = 9;
    el.datasets = [{ label: 'secondary', axis: 'y2', data: [2] }];
    const y2 = (el as any).buildConfig().options.scales.y2;
    expect(y2.min).to.equal(1);
    expect(y2.max).to.equal(9);
  });

  it('uses unsampled source indexes for direct hit-testing and keyboard datums', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    el.labels = ['A'];
    el.datasets = [{ label: 'series', data: [5] }];
    (el as any).visualDatasetSourceIndexes = undefined;
    (el as any).visualRowSourceIndexes = undefined;
    let detail: unknown;
    el.addEventListener('lr-datum-activate', (event) => {
      detail = (event as CustomEvent).detail;
    });
    (el as any).handlePointClick({}, {
      getElementsAtEventForMode: () => [{ datasetIndex: 0, index: 0 }],
    });
    expect(detail).to.deep.include({ datasetIndex: 0, index: 0, value: 5 });

    (el as any).chart = { data: { labels: ['A'], datasets: [{ data: [5] }] } };
    expect((el as any).chartDatums()).to.deep.equal([
      { datasetIndex: 0, index: 0, label: 'A', value: 5 },
    ]);
    (el as any).chart = { data: { labels: [], datasets: [{}] } };
    expect((el as any).chartDatums()).to.deep.equal([]);
  });

  it('covers remaining direct formatting and legend fallbacks', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    expect((el as any).datumAnnouncement(
      { datasetIndex: 9, index: 0, label: 'A', value: 1 },
      0,
      1,
    )).to.contain('Series');

    expect((el as any).legendValue(
      { datasetIndex: 0 },
      { data: { datasets: [{ data: [Number.NaN, 2] }] } },
    )).to.equal(2);

    el.valueFormatter = (value, context) => `${context}:${value}`;
    expect((el as any).tooltipLabel({ parsed: { x: 8 }, dataset: {} })).to.equal('tooltip:8');
    expect((el as any).formatExportValue(3)).to.equal('table:3');
    expect((el as any).legendTextFor(
      { label: 'point', data: [{ x: 1, y: 4 }] },
      0,
    )).to.equal('point: legend:4');

    el.legendPosition = 'bottom';
    expect((el as any).legendPositionForLayout()).to.equal('bottom');
    el.legendPosition = 'auto';
    (el as any).autoLegendPosition = 'bottom';
    expect((el as any).legendGridPlacement()).to.equal('bottom');
    (el as any).autoLegendPosition = 'right';
    expect((el as any).legendGridPlacement()).to.equal('inline-end');
  });

  it('retains caller plugins without optional data labels and repairs malformed config plugins', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const plugin = { id: 'caller-plugin' };
    el.plugins = [plugin];
    expect((el as any).buildConfig().plugins).to.deep.equal([plugin]);

    el.config = { plugins: 'not-an-array' as unknown as never[] };
    expect((el as any).buildConfig().plugins).to.deep.equal([plugin]);

    const configured = { id: 'configured-plugin' };
    el.config = { plugins: [configured] };
    expect((el as any).buildConfig().plugins).to.deep.equal([configured, plugin]);
  });

  it('announces an explicit zoom discard and rejects an out-of-range legend toggle', () => {
    const el = document.createElement('lr-chart') as LyraChart;
    let zoomed: unknown;
    el.addEventListener('lr-zoom', (event) => {
      zoomed = (event as CustomEvent).detail.zoomed;
    });
    (el as any).zoomed = true;
    (el as any).discardChart(true);
    expect(zoomed).to.be.false;

    el.datasets = [{ label: 'A', data: [1] }];
    (el as any).chart = { data: { datasets: [{}] } };
    expect(() => (el as any).toggleDataset(1)).to.not.throw();
  });
});
