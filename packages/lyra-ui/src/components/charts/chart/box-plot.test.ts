import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import './box-plot.js';
import type { LyraBoxPlot } from './box-plot.js';
import { styles } from './box-plot.styles.js';

// Deliberately the first test in the file: `loadBoxPlotPlugin()`/`loadChartJs()`
// memoize their resolved promise at module scope, so once any other test in
// this file has driven a `<lr-box-plot>` through a full load, later
// `connectedCallback()`s resolve near-instantly and the initial "still
// loading" render can no longer be observed.
it('shows a loading skeleton and aria-busy while chart.js/the boxplot plugin loads, then swaps to the canvas', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;

  // `waitUntil`'s own default timeout (1000ms) is tighter than this codebase's
  // established budget for async-peer-dep-loader races under concurrent-test
  // resource contention (see graph.test.ts's NODE_COUNT_TIMEOUT = 5000, same
  // root cause: Chromium tab throttling when many test files run in parallel).
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('builds a boxplot Chart.js instance once both chart.js and the boxplot plugin load', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['K=2', 'K=3'];
  el.boxes = [
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
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('updates in place (same Chart instance) when only boxes/labels change', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.labels = ['A'];
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;

  el.boxes = [{ label: 'x', data: [{ min: 2, q1: 3, median: 4, q3: 5, max: 6 }] }];
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('updates in place (same Chart instance) across a bare height change, instead of destroying and recreating the chart', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;

  el.height = '400px';
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
});

it('forwards a host aria-label to the canvas and keeps the chart role on that semantic element only', async () => {
  const el = (await fixture(html`
    <lr-box-plot aria-label="Latency distributions" accessible-label="Legacy box plot label"></lr-box-plot>
  `)) as LyraBoxPlot;
  el.boxes = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('aria-label')).to.equal('Latency distributions');
  expect(canvas.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('role')).to.equal(null);
  expect(el.shadowRoot!.querySelectorAll('[role]')).to.have.length(1);
});

it('formats generated median-summary values with the effective locale', async () => {
  const el = (await fixture(html`<lr-box-plot locale="de-DE"></lr-box-plot>`)) as LyraBoxPlot;
  el.boxes = [
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
  el.boxes = [{ label: 'Latency', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
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
  el.boxes = [
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
  el.accessibleLabel = 'Loss distributions';
  el.accessibleDescription = 'Loss medians are stable across the two groups.';
  el.showDataTable = true;
  el.labels = ['K=2', 'K=3'];
  el.boxes = [
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

it('does not bundle lr-chart\'s unused reset-zoom-button styles', () => {
  expect(styles.cssText).to.not.contain('reset-zoom-button');
});

it('does not construct a Chart.js instance if disconnected before the lazy peer import settles', async () => {
  const el = document.createElement('lr-box-plot') as LyraBoxPlot;
  el.boxes = [{ label: 'a', data: [{ min: 0, q1: 1, median: 2, q3: 3, max: 4 }] }];
  document.body.appendChild(el);
  el.remove();
  await aTimeout(100);
  expect((el as unknown as { chart?: unknown }).chart).to.be.undefined;
});

it('resolves grid/tick/legend colors from custom --lr-chart-* values set on the host', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.legend = true;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
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

it('disables Chart.js animation when the user prefers reduced motion', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
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

it('refreshTheme() forces a redraw that re-reads out-of-band theme changes', async () => {
  const el = (await fixture(html`<lr-box-plot></lr-box-plot>`)) as LyraBoxPlot;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
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
  el.boxes = [
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
  el.boxes = [
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
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });
  const dataRef = (el as any).chart.data;
  el.requestUpdate();
  await el.updateComplete;
  expect((el as any).chart.data).to.equal(dataRef);
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
