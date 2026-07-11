import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './box-plot.js';
import type { LyraBoxPlot } from './box-plot.js';
import { styles } from './box-plot.styles.js';

// Deliberately the first test in the file: `loadBoxPlotPlugin()`/`loadChartJs()`
// memoize their resolved promise at module scope, so once any other test in
// this file has driven a `<lyra-box-plot>` through a full load, later
// `connectedCallback()`s resolve near-instantly and the initial "still
// loading" render can no longer be observed.
it('shows a loading skeleton and aria-busy while chart.js/the boxplot plugin loads, then swaps to the canvas', async () => {
  const el = (await fixture(html`<lyra-box-plot></lyra-box-plot>`)) as LyraBoxPlot;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;

  // `waitUntil`'s own default timeout (1000ms) is tighter than this codebase's
  // established budget for async-peer-dep-loader races under concurrent-test
  // resource contention (see graph.test.ts's NODE_COUNT_TIMEOUT = 5000, same
  // root cause: Chromium tab throttling when many test files run in parallel).
  await waitUntil(() => (el as any).chart != null, undefined, { timeout: 5000 });

  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('builds a boxplot Chart.js instance once both chart.js and the boxplot plugin load', async () => {
  const el = (await fixture(html`<lyra-box-plot></lyra-box-plot>`)) as LyraBoxPlot;
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
  const el = (await fixture(html`<lyra-box-plot></lyra-box-plot>`)) as LyraBoxPlot;
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
  const el = (await fixture(html`<lyra-box-plot></lyra-box-plot>`)) as LyraBoxPlot;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  const instance = (el as any).chart;

  el.height = '400px';
  await el.updateComplete;
  expect((el as any).chart).to.equal(instance);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-box-plot></lyra-box-plot>`)) as LyraBoxPlot;
  el.boxes = [{ label: 'x', data: [{ min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  await expect(el).to.be.accessible();
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
  const el = document.createElement('lyra-box-plot') as LyraBoxPlot;

  // Drive the same async handler `connectedCallback()` wires up, but with the
  // `null` resolution `loadBoxPlotPlugin()` produces on a partial failure —
  // asserting it never sets `chartJsModule` nor constructs a `Chart` with the
  // unregistered `'boxplot'` controller type.
  await (el as any).onBoxPlotPluginLoaded(null);

  expect((el as any).chartJsModule).to.equal(undefined);
  expect((el as any).chart).to.equal(undefined);
});

it('does not bundle lyra-chart\'s unused reset-zoom-button styles', () => {
  expect(styles.cssText).to.not.contain('reset-zoom-button');
});

it('connectedCallback() routes the resolved boxplot-plugin module into the loaded handler instead of ignoring it', async () => {
  // Guards the wiring itself (as opposed to the handler-in-isolation test
  // above): a regression back to the old bug — `connectedCallback()`
  // discarding the value `loadBoxPlotPlugin()` resolved to — would leave this
  // handler uncalled, since the old code never referenced it at all.
  const el = document.createElement('lyra-box-plot') as LyraBoxPlot;
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
