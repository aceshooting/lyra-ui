import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.js';

async function mount(tpl: ReturnType<typeof html>): Promise<LyraLiteChart> {
  const el = (await fixture(tpl)) as LyraLiteChart;
  // Let the ResizeObserver callback (async, fires after connect) settle so
  // plotWidth/plotHeight reflect the real rendered size, not the 400x200
  // pre-measurement fallback — needed for any geometry-dependent assertion.
  await waitUntil(() => el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox') !== '0 0 400 200');
  await el.updateComplete;
  return el;
}

const BAR_LABELS = ['Mon', 'Tue', 'Wed'];
const BAR_DATASETS = [
  { label: 'A', data: [1, 2, 3] },
  { label: 'B', data: [4, 5, 6] },
];

it('renders one bar per label per dataset (grouped, not stacked)', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(6);
});

it('stacked bars still render one rect per (label, dataset) pair, just positioned differently', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    stacked
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(6);
});

it('stacked bar segments sit end-to-end (second segment starts where the first ends)', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    stacked
    .labels=${['only']}
    .datasets=${[
      { label: 'A', data: [10] },
      { label: 'B', data: [20] },
    ]}
  ></lyra-lite-chart>`);
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(rects.length).to.equal(2);
  const [a, b] = rects;
  const aTop = Number(a.getAttribute('y'));
  const aBottom = aTop + Number(a.getAttribute('height'));
  const bTop = Number(b.getAttribute('y'));
  const bBottom = bTop + Number(b.getAttribute('height'));
  // Stacking accumulates from the zero baseline upward in dataset order: A
  // (the first dataset, value 10) occupies the segment nearest the
  // baseline — [0, 10] in value-space, i.e. the *bottom* of the stack — and
  // B (value 20) stacks on top of it, occupying [10, 30]. In pixel-space
  // (y grows downward), that means A's *top* edge (value 10) is where B's
  // *bottom* edge (also value 10) sits — not A's bottom (value 0, the very
  // baseline) meeting B's top (value 30, the very top of the stack).
  expect(aTop).to.be.closeTo(bBottom, 0.5);
  expect(aBottom).to.be.greaterThan(aTop); // sanity: A's rect isn't zero/negative height
  expect(bTop).to.be.lessThan(aTop); // B sits above A
});

it('grouped (non-stacked) bars for the same category do not overlap', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[
      { label: 'A', data: [5] },
      { label: 'B', data: [5] },
    ]}
  ></lyra-lite-chart>`);
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(rects.length).to.equal(2);
  const [a, b] = rects;
  const aLeft = Number(a.getAttribute('x'));
  const aRight = aLeft + Number(a.getAttribute('width'));
  const bLeft = Number(b.getAttribute('x'));
  expect(bLeft).to.be.greaterThan(aLeft);
  expect(aRight).to.be.at.most(bLeft + 0.5);
});

it('renders a line path plus one point per value for type="line"', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="line"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(6);
});

it('skips null values in a line series without throwing, and without a point for them', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="line"
    .labels=${['a', 'b', 'c']}
    .datasets=${[{ label: 'A', data: [1, null, 3] }]}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
});

it('emits lyra-point-click with the right detail on bar click', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  const detailPromise = new Promise<CustomEvent>((resolve) =>
    el.addEventListener('lyra-point-click', (e) => resolve(e as CustomEvent), { once: true }),
  );
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  // Dataset B ('Tue') -> second dataset, index 1.
  rects[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const { detail } = await detailPromise;
  expect(detail).to.deep.equal({ datasetIndex: 1, index: 1, label: 'Tue', value: 5 });
});

it('emits lyra-point-click on Enter and Space while a bar is focused, not on other keys', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[{ label: 'A', data: [7] }]}
  ></lyra-lite-chart>`);
  const bar = el.shadowRoot!.querySelector('[part="bar"]')! as SVGRectElement;
  let count = 0;
  el.addEventListener('lyra-point-click', () => count++);

  bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  expect(count).to.equal(0);

  bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(count).to.equal(1);

  bar.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(count).to.equal(2);
});

it('emits lyra-point-click for a line point too, with the same detail shape', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="line"
    .labels=${['x']}
    .datasets=${[{ label: 'Series', data: [42] }]}
  ></lyra-lite-chart>`);
  const detailPromise = new Promise<CustomEvent>((resolve) =>
    el.addEventListener('lyra-point-click', (e) => resolve(e as CustomEvent), { once: true }),
  );
  el.shadowRoot!.querySelector('[part="point"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const { detail } = await detailPromise;
  expect(detail).to.deep.equal({ datasetIndex: 0, index: 0, label: 'x', value: 42 });
});

it('renders no legend by default, and one legend-item per dataset when legend is set', async () => {
  const el = await mount(html`<lyra-lite-chart
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelector('[part="legend"]')).to.not.exist;

  el.legend = true;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[part="legend-item"]');
  expect(items.length).to.equal(2);
  expect(items[0].textContent).to.contain('A');
  expect(items[1].textContent).to.contain('B');
});

it('uses a series-provided color for its bar fill, and a default palette color otherwise', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[
      { label: 'Custom', data: [1], color: '#ff0000' },
      { label: 'Default', data: [1] },
    ]}
  ></lyra-lite-chart>`);
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(rects[0].getAttribute('fill')).to.equal('#ff0000');
  expect(rects[1].getAttribute('fill')).to.be.a('string').and.not.equal('#ff0000');
});

it('draws a gridline at the y=0 baseline when beginAtZero is true (the default)', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[{ label: 'A', data: [100] }]}
  ></lyra-lite-chart>`);
  // beginAtZero pulls 0 into the domain even though every value is positive
  // and far from 0 — the nice-tick set should therefore include 0.
  const labels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"]')]
    .map((t) => t.textContent)
    .filter((t) => /^-?\d+(\.\d+)?$/.test(t ?? ''));
  expect(labels).to.include('0');
});

it('renders x/y axis titles only when xLabel/yLabel are set', async () => {
  const bare = await mount(html`<lyra-lite-chart
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(bare.shadowRoot!.querySelectorAll('[part="axis-title"]').length).to.equal(0);

  const labeled = await mount(html`<lyra-lite-chart
    x-label="Day"
    y-label="Count"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  const titles = [...labeled.shadowRoot!.querySelectorAll('[part="axis-title"]')].map((t) => t.textContent);
  expect(titles).to.include('Day');
  expect(titles).to.include('Count');
});

it('handles empty labels/datasets without throwing', async () => {
  const el = await mount(html`<lyra-lite-chart></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelector('svg')).to.exist;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(0);
});

it('sets an aria-label on the svg from the dataset labels (role=group, not img, since bars/points inside are independently focusable)', async () => {
  const el = await mount(html`<lyra-lite-chart
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  const svg = el.shadowRoot!.querySelector('svg')!;
  expect(svg.getAttribute('role')).to.equal('group');
  expect(svg.getAttribute('aria-label')).to.equal('A, B');
});

it('is accessible', async () => {
  const el = await mount(html`<lyra-lite-chart
    legend
    x-label="Day"
    y-label="Count"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  await expect(el).to.be.accessible();
});

it('uses tickFormat for y-axis labels when provided', async () => {
  const el = (await fixture(html`<lyra-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
    .tickFormat=${(v: number) => `$${v.toFixed(2)}`}
  ></lyra-lite-chart>`)) as LyraLiteChart;
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="axis-label"]')).map(
    (n) => n.textContent,
  );
  expect(labels.some((t) => t?.startsWith('$'))).to.be.true;
});

it('falls back to the default nice-number formatter without tickFormat', async () => {
  const el = (await fixture(html`<lyra-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
  ></lyra-lite-chart>`)) as LyraLiteChart;
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="axis-label"]')).map(
    (n) => n.textContent,
  );
  expect(labels.some((t) => t?.startsWith('$'))).to.be.false;
});

it('skips recompute when the content signature is unchanged', async () => {
  const el = (await fixture(html`<lyra-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
  ></lyra-lite-chart>`)) as LyraLiteChart;
  await el.updateComplete;
  const before = (el as unknown as { lastResult?: unknown }).lastResult;
  el.requestUpdate();
  await el.updateComplete;
  const after = (el as unknown as { lastResult?: unknown }).lastResult;
  expect(after).to.equal(before);
});

it('draws a bar from the axis lo, not the domain zero, when beginAtZero is false', async () => {
  const el = (await fixture(
    // NOTE: intentionally NOT `begin-at-zero="false"` as an HTML attribute --
    // Lit's Boolean attribute converter treats *any* attribute presence
    // (including the literal string "false") as `true`; only *omitting* the
    // attribute or setting the JS property directly yields `false`. Using
    // `.beginAtZero=${false}` below is what actually disables begin-at-zero.
    html`<lyra-lite-chart type="bar" .beginAtZero=${false} .labels=${['a']} .datasets=${[{ label: 's', data: [95] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  el.style.setProperty('--lyra-chart-height', '200px');
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 400;
  (el as unknown as { plotHeight: number }).plotHeight = 200;
  await el.updateComplete;
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const y = Number(rect.getAttribute('y'));
  const height = Number(rect.getAttribute('height'));
  // The bar's bottom edge (y + height) must sit at the plot's own bottom
  // edge (the axis lo), not overshoot past it.
  const plotBottom = 8 + (200 - 8 - 20); // PAD_TOP + plotH, mirrors render()'s own math
  expect(y + height).to.be.at.most(plotBottom + 0.5);
});

it('draws a bar from the axis hi, not the domain zero, when beginAtZero is false and every value is negative', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart type="bar" .beginAtZero=${false} .labels=${['a']} .datasets=${[{ label: 's', data: [-95] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 400;
  (el as unknown as { plotHeight: number }).plotHeight = 200;
  await el.updateComplete;
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const y = Number(rect.getAttribute('y'));
  // The bar's top edge (y) must sit at the plot's own top edge (the axis
  // hi, which is negative and close to -95 here), not overshoot above it
  // into negative/off-plot territory the way clamping to a literal 0
  // baseline would (0 is way above this all-negative domain's hi).
  const plotTop = 8; // PAD_TOP, mirrors render()'s own math
  expect(y).to.be.at.least(plotTop - 0.5);
});

it('centers each category label on its own bar group instead of a line-endpoint position', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart type="bar" .labels=${['x', 'y', 'z']} .datasets=${[{ label: 's', data: [1, 2, 3] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bars = Array.from(el.shadowRoot!.querySelectorAll('[part="bar"]')) as SVGRectElement[];
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="axis-label"]')).filter(
    (n) => !n.hasAttribute('y1'), // exclude gridline text reuse if any
  ) as SVGTextElement[];
  const firstBarCenter = Number(bars[0].getAttribute('x')) + Number(bars[0].getAttribute('width')) / 2;
  const firstLabelX = Number(labels.find((l) => l.textContent === 'x')!.getAttribute('x'));
  expect(Math.abs(firstBarCenter - firstLabelX)).to.be.lessThan(1);
});

it('breaks the line at a null value instead of bridging across it', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart type="line" .labels=${['a', 'b', 'c']} .datasets=${[{ label: 's', data: [1, null, 3] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]') as SVGPathElement;
  // Two "M" (moveto) commands means two disjoint segments -- a single M
  // followed by only L commands would mean the null was bridged.
  expect((path.getAttribute('d')!.match(/M/g) ?? []).length).to.equal(2);
});

it('breaks the line at multiple disjoint null gaps, producing one M per segment', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart
      type="line"
      .labels=${['a', 'b', 'c', 'd', 'e']}
      .datasets=${[{ label: 's', data: [1, null, 3, null, 5] }]}
    ></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]') as SVGPathElement;
  // Three disjoint single-point segments -> three M commands, zero L commands
  // (a lone point can't have a line drawn to/from it).
  const d = path.getAttribute('d')!;
  expect((d.match(/M/g) ?? []).length).to.equal(3);
  expect((d.match(/L/g) ?? []).length).to.equal(0);
});

it('renders no invalid/NaN geometry when every value is non-finite', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart type="line" .labels=${['a']} .datasets=${[{ label: 's', data: [NaN] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]') as SVGPathElement;
  expect(path.getAttribute('d') ?? '').to.not.include('NaN');
});

it('excludes a non-finite (Infinity/NaN) value from the line path and its points, same as null', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart
      type="line"
      .labels=${['a', 'b', 'c']}
      .datasets=${[{ label: 's', data: [1, Infinity, 3] }]}
    ></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]') as SVGPathElement;
  const d = path.getAttribute('d')!;
  expect(d).to.not.include('Infinity');
  expect((d.match(/M/g) ?? []).length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
});

it('excludes a non-finite (NaN) bar value, same as null, without throwing', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart
      type="bar"
      .labels=${['a', 'b']}
      .datasets=${[{ label: 's', data: [NaN, 4] }]}
    ></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const rects = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(rects.length).to.equal(1);
});

it('re-arms the ResizeObserver on reconnect after a disconnect, so a resize still triggers a re-render', async () => {
  // A real browser's ResizeObserver notification timing across a
  // synchronous disconnect+reconnect is inherently racy in headless test
  // runs (the entry delivery is scheduled by the UA, not deterministic
  // microtask ordering), so this spies on the real ResizeObserver
  // constructor/observe instead of waiting on real layout timing -- it
  // still exercises the real class (via `extends`), just records calls.
  const observeCalls: Element[] = [];
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class SpyResizeObserver extends OriginalRO {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      callbacks.push(callback);
    }
    override observe(target: Element, options?: ResizeObserverOptions): void {
      observeCalls.push(target);
      super.observe(target, options);
    }
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = SpyResizeObserver;

  try {
    const el = (await fixture(
      html`<lyra-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lyra-lite-chart>`,
    )) as LyraLiteChart;
    const svgEl = el.shadowRoot!.querySelector('svg')!;

    // First mount: connectedCallback() creates the observer, but svgEl isn't
    // rendered yet at that synchronous point, so firstUpdated() is what
    // actually arms it -- exactly one observe() call, on the real <svg>.
    expect(observeCalls.length).to.equal(1);
    expect(observeCalls[0]).to.equal(svgEl);

    const parent = el.parentNode!;
    parent.removeChild(el); // disconnectedCallback() disconnects the old observer
    parent.appendChild(el); // connectedCallback() re-creates + re-observes

    // Re-arming on reconnect: a *second* observe() call, still targeting the
    // same underlying <svg> (Lit's shadow root/DOM survives a disconnect, so
    // svgEl is already populated by the time connectedCallback() runs here --
    // unlike on first mount).
    expect(observeCalls.length).to.equal(2);
    expect(observeCalls[1]).to.equal(svgEl);

    // Prove it's not just "observe() was called" theater: feed the *new*
    // (post-reconnect) observer's callback a synthetic resize entry, the way
    // the browser would after a real layout change, and confirm it actually
    // re-renders (plotWidth/plotHeight update, moving the viewBox).
    const viewBoxBefore = svgEl.getAttribute('viewBox');
    const latestCallback = callbacks[callbacks.length - 1];
    latestCallback(
      [{ contentBoxSize: [{ inlineSize: 321, blockSize: 123 }] } as unknown as ResizeObserverEntry],
      new OriginalRO(() => {}),
    );
    await el.updateComplete;
    const viewBoxAfter = el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
    expect(viewBoxAfter).to.equal('0 0 321 123');
    expect(viewBoxAfter).to.not.equal(viewBoxBefore);
  } finally {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalRO;
  }
});
