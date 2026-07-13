import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.js';
import { styles } from './lite-chart.styles.js';

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

it('uses one roving tab stop, arrow/Home/End navigation, and a data-list alternative', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  const marks = () => [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(marks().filter((mark) => mark.getAttribute('tabindex') === '0')).to.have.length(1);
  expect(marks().filter((mark) => mark.getAttribute('tabindex') === '-1')).to.have.length(5);

  marks()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(marks()[1]!.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('2 of 6');

  marks()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(marks()[5]!.getAttribute('tabindex')).to.equal('0');
  marks()[5]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(marks()[0]!.getAttribute('tabindex')).to.equal('0');

  expect(el.shadowRoot!.querySelectorAll('[part="data-list"] li')).to.have.length(6);
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

it('allows the categorical palette to be rethemed through semantic chart color variables', async () => {
  const el = await mount(html`<lyra-lite-chart
    style="--lyra-chart-color-2: rgb(1 2 3)"
    type="bar"
    .labels=${['only']}
    .datasets=${[
      { label: 'A', data: [1] },
      { label: 'B', data: [1] },
    ]}
  ></lyra-lite-chart>`);
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(styles.cssText).to.match(/--lyra-chart-color-1:\s*var\(--lyra-color-chart-1\)/);
  expect(rects[1].getAttribute('fill')).to.equal('var(--lyra-chart-color-2)');
  expect(getComputedStyle(rects[1]).fill).to.equal('rgb(1, 2, 3)');
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

it('renders the same data again safely when an update has no changed properties', async () => {
  const el = (await fixture(html`<lyra-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
  ></lyra-lite-chart>`)) as LyraLiteChart;
  await el.updateComplete;
  const before = el.shadowRoot!.innerHTML;
  el.requestUpdate();
  await el.updateComplete;
  expect(el.shadowRoot!.innerHTML).to.equal(before);
});

it('re-renders when the tick formatter callback is replaced by reference', async () => {
  const first = (value: number) => `first-${value}`;
  const second = (value: number) => `second-${value}`;
  const el = await mount(html`<lyra-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
    .tickFormat=${first}
  ></lyra-lite-chart>`);

  expect(el.shadowRoot!.textContent).to.include('first-');
  el.tickFormat = second;
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include('second-');
  expect(el.shadowRoot!.textContent).to.not.include('first-');
});

it('re-renders when the bar position callback is replaced by reference', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 'S', data: [10] }]}
    .barX=${() => 40}
  ></lyra-lite-chart>`);

  const before = Number(el.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('x'));
  el.barX = () => 140;
  await el.updateComplete;
  const after = Number(el.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('x'));
  expect(after).to.not.equal(before);
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

// --- layout="scroll" -------------------------------------------------------

it('layout="scroll" gives every bar a fixed width and lets the plot exceed the host width via horizontal scroll', async () => {
  const labels = Array.from({ length: 30 }, (_, i) => `C${i}`);
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    layout="scroll"
    style="width: 120px"
    .labels=${labels}
    .datasets=${[{ label: 'S', data: labels.map((_, i) => i + 1) }]}
  ></lyra-lite-chart>`);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const svgEl = el.shadowRoot!.querySelector('svg')!;
  expect(getComputedStyle(base).overflowX).to.equal('auto');
  const hostWidth = el.getBoundingClientRect().width;
  const svgWidth = svgEl.getBoundingClientRect().width;
  expect(hostWidth).to.be.closeTo(120, 2);
  // 30 categories * the default 32px barWidth alone is already ~960px, far
  // past the 120px host -- proves the plot isn't squeezed to fit.
  expect(svgWidth).to.be.greaterThan(hostWidth + 100);
  const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(bars.length).to.equal(30);
  // Single dataset: bar width = slot(32) * (1 - BAR_GROUP_GAP(0.2)) = 25.6.
  expect(Number(bars[0].getAttribute('width'))).to.be.closeTo(25.6, 0.5);
});

it('barWidth (attribute "bar-width") sets the fixed per-bar width used by layout="scroll"', async () => {
  const labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    layout="scroll"
    bar-width="50"
    style="width: 80px"
    .labels=${labels}
    .datasets=${[{ label: 'S', data: labels.map(() => 1) }]}
  ></lyra-lite-chart>`);
  const svgEl = el.shadowRoot!.querySelector('svg')!;
  const viewBoxW = Number(svgEl.getAttribute('viewBox')!.split(' ')[2]);
  // w = plotX(36, no yLabel) + n(8)*barWidth(50) + PAD_RIGHT(8) = 444.
  expect(viewBoxW).to.be.closeTo(444, 0.5);
});

it('keeps bars and their axis labels aligned in layout="scroll" (no drift between the two width models)', async () => {
  const labels = ['x', 'y', 'z', 'w', 'v'];
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    layout="scroll"
    style="width: 60px"
    .labels=${labels}
    .datasets=${[{ label: 's', data: [1, 2, 3, 4, 5] }]}
  ></lyra-lite-chart>`);
  const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')] as SVGTextElement[];
  const firstBarCenter = Number(bars[0].getAttribute('x')) + Number(bars[0].getAttribute('width')) / 2;
  const firstLabelX = Number(axisLabels.find((l) => l.textContent === 'x')!.getAttribute('x'));
  expect(Math.abs(firstBarCenter - firstLabelX)).to.be.lessThan(1);
});

it('layout="fit" (the default) leaves the svg without an inline width override and the base container non-scrollable, unchanged from before layout existed', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(el.layout).to.equal('fit');
  expect(el.getAttribute('layout')).to.equal('fit'); // reflected attribute
  const svgEl = el.shadowRoot!.querySelector('svg')!;
  expect(svgEl.hasAttribute('style')).to.be.false;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).overflowX).to.equal('visible');
});

// --- maxLabels ---------------------------------------------------------------

it('maxLabels decimates which axis-label text elements render, always keeping the first and last (bars are never decimated)', async () => {
  const labels = Array.from({ length: 20 }, (_, i) => `L${i}`);
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    max-labels="5"
    .labels=${labels}
    .datasets=${[{ label: 's', data: labels.map((_, i) => i + 1) }]}
  ></lyra-lite-chart>`);
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')].map(
    (n) => n.textContent,
  );
  expect(axisLabels.length).to.be.lessThan(labels.length);
  expect(axisLabels).to.include('L0');
  expect(axisLabels).to.include('L19');
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(20);
});

it('renders every label when maxLabels is unset, even for a long category list (regression)', async () => {
  const labels = Array.from({ length: 20 }, (_, i) => `L${i}`);
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${labels}
    .datasets=${[{ label: 's', data: labels.map((_, i) => i + 1) }]}
  ></lyra-lite-chart>`);
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')];
  expect(axisLabels.length).to.equal(20);
});

// --- barX coordinate override -------------------------------------------------

it('barX overrides the internally computed per-category x-origin for both bars and their labels', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart
      type="bar"
      .labels=${['only']}
      .datasets=${[{ label: 's', data: [5] }]}
      .barX=${() => 500}
    ></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const label = el.shadowRoot!.querySelector('[part="axis-label"][text-anchor="middle"]') as SVGTextElement;
  const x = Number(rect.getAttribute('x'));
  const labelX = Number(label.getAttribute('x'));
  // Without the override, a single category's internal origin would be
  // plotX (36) -- well below 490. The override pins it at 500 instead.
  expect(x).to.be.greaterThan(490);
  const slot = 300 - 36 - 8; // a single category spans the whole plot width
  const groupW = slot * 0.8; // BAR_GROUP_GAP = 0.2, one dataset -> groupCount 1
  expect(x).to.be.closeTo(500 + (slot - groupW) / 2, 0.5);
  expect(labelX).to.be.closeTo(500 + slot / 2, 0.5);
});

it('leaves bar/label x-position at the internal per-category formula when barX is unset (regression)', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart type="bar" .labels=${['x', 'y', 'z']} .datasets=${[{ label: 's', data: [1, 2, 3] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  const firstLabel = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')].find(
    (n) => n.textContent === 'x',
  ) as SVGTextElement;
  const firstBarCenter = Number(bars[0].getAttribute('x')) + Number(bars[0].getAttribute('width')) / 2;
  expect(Math.abs(firstBarCenter - Number(firstLabel.getAttribute('x')))).to.be.lessThan(1);
});

// --- pointText tooltip formatter -----------------------------------------------

it('pointText overrides the per-bar tooltip/aria-label text', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 'S', data: [42] }]}
    .pointText=${(label: string, value: number, datasetIndex: number) => `custom ${label} ${value} ${datasetIndex}`}
  ></lyra-lite-chart>`);
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  expect(rect.querySelector('title')!.textContent).to.equal('custom a 42 0');
  expect(rect.getAttribute('aria-label')).to.equal('custom a 42 0');
});

it('pointText overrides the per-point tooltip/aria-label text for type="line" too', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="line"
    .labels=${['x']}
    .datasets=${[{ label: 'S', data: [7] }]}
    .pointText=${(label: string, value: number, datasetIndex: number) => `pt ${label}:${value}#${datasetIndex}`}
  ></lyra-lite-chart>`);
  const point = el.shadowRoot!.querySelector('[part="point"]') as SVGCircleElement;
  expect(point.querySelector('title')!.textContent).to.equal('pt x:7#0');
  expect(point.getAttribute('aria-label')).to.equal('pt x:7#0');
});

it('falls back to the built-in raw-value tooltip/aria-label text when pointText is unset (regression)', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 'S', data: [42] }]}
  ></lyra-lite-chart>`);
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  expect(rect.querySelector('title')!.textContent).to.equal('S — a: 42');
  expect(rect.getAttribute('aria-label')).to.equal('S, a: 42');
});

// --- roundedBars ----------------------------------------------------------------

it('roundedBars renders each bar as a rounded-corner path instead of a plain rect', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    rounded-bars
    .labels=${['a']}
    .datasets=${[{ label: 's', data: [42] }]}
  ></lyra-lite-chart>`);
  const mark = el.shadowRoot!.querySelector('[part="bar"]')!;
  expect(mark.tagName.toLowerCase()).to.equal('path');
  expect(mark.getAttribute('d')).to.include('Q');
  expect(mark.querySelector('title')).to.exist;
});

it('renders square-cornered rects by default (roundedBars unset, regression)', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 's', data: [42] }]}
  ></lyra-lite-chart>`);
  const mark = el.shadowRoot!.querySelector('[part="bar"]')!;
  expect(mark.tagName.toLowerCase()).to.equal('rect');
});

// --- skipZero ---------------------------------------------------------------------

it('skipZero omits the mark entirely for an exact-zero value, while still rendering non-zero and skipping null/non-finite as before', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    skip-zero
    .labels=${['a', 'b', 'c', 'd']}
    .datasets=${[{ label: 's', data: [0, 5, null, NaN] }]}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(1);
});

it('renders a zero-height but focusable/titled bar for a zero value by default (skipZero unset, regression)', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 's', data: [0] }]}
  ></lyra-lite-chart>`);
  const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(bars.length).to.equal(1);
  expect(bars[0].getAttribute('tabindex')).to.equal('0');
});

// --- padLeft ------------------------------------------------------------------

it('padLeft overrides the default 36px left padding, shifting the plot origin', async () => {
  const defaultEl = (await fixture(
    html`<lyra-lite-chart type="bar" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (defaultEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (defaultEl as unknown as { plotHeight: number }).plotHeight = 150;
  await defaultEl.updateComplete;
  const defaultX = Number((defaultEl.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement).getAttribute('x'));

  const el = (await fixture(
    html`<lyra-lite-chart type="bar" pad-left="80" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const x = Number((el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement).getAttribute('x'));

  expect(x).to.be.greaterThan(defaultX);
  // plotX(80) + (slot - groupW)/2, slot = 300 - 80 - 8 = 212, groupW = slot*0.8 = 169.6
  expect(x).to.be.closeTo(80 + (212 - 212 * 0.8) / 2, 0.5);
});

// --- barGapRatio ----------------------------------------------------------------

it('barGapRatio overrides the default 0.2 gap fraction, changing bar width relative to slot', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart type="bar" bar-gap-ratio="0.5" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const slot = 300 - 36 - 8; // a single category spans the whole plot (default padLeft)
  const expectedWidth = slot * (1 - 0.5); // groupCount 1, no BAR_GAP term
  expect(Number(bar.getAttribute('width'))).to.be.closeTo(expectedWidth, 0.5);
});

it('uses the default 0.2 gap fraction when barGapRatio is unset (regression)', async () => {
  const el = (await fixture(
    html`<lyra-lite-chart type="bar" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const slot = 300 - 36 - 8;
  const expectedWidth = slot * (1 - 0.2);
  expect(Number(bar.getAttribute('width'))).to.be.closeTo(expectedWidth, 0.5);
});

// --- scale (linear vs sqrt) ------------------------------------------------------

it('scale="sqrt" produces a measurably different bar height than scale="linear" for the same non-trivial value (type="bar" only)', async () => {
  const labels = ['tiny', 'small', 'big'];
  const datasets = [{ label: 's', data: [1, 25, 100] }];

  const linearEl = (await fixture(
    html`<lyra-lite-chart type="bar" scale="linear" .labels=${labels} .datasets=${datasets}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (linearEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (linearEl as unknown as { plotHeight: number }).plotHeight = 150;
  await linearEl.updateComplete;
  const linearBars = [...linearEl.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];

  const sqrtEl = (await fixture(
    html`<lyra-lite-chart type="bar" scale="sqrt" .labels=${labels} .datasets=${datasets}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (sqrtEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (sqrtEl as unknown as { plotHeight: number }).plotHeight = 150;
  await sqrtEl.updateComplete;
  const sqrtBars = [...sqrtEl.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];

  // "small" (value 25 out of a domain maxing out at 100) is the "same
  // non-trivial value" compared across scales. Math.sqrt(25/100) = 0.5 vs.
  // the linear fraction 25/100 = 0.25 -- sqrt boosts it well above its linear
  // height (compressing the *range* between it and the dominant 100 value,
  // which is unchanged since sqrt(100/100) === 100/100 === 1 at the max).
  const linearHeight = Number(linearBars[1].getAttribute('height'));
  const sqrtHeight = Number(sqrtBars[1].getAttribute('height'));
  expect(sqrtHeight).to.not.be.closeTo(linearHeight, 0.5);
  expect(sqrtHeight).to.be.greaterThan(linearHeight);

  // The dominant/max value's bar is unaffected either way (both scales
  // saturate to the full plot height at the domain max).
  const linearMaxHeight = Number(linearBars[2].getAttribute('height'));
  const sqrtMaxHeight = Number(sqrtBars[2].getAttribute('height'));
  expect(sqrtMaxHeight).to.be.closeTo(linearMaxHeight, 0.5);
});

it('scale has no effect on type="line" (regression)', async () => {
  const labels = ['tiny', 'small', 'big'];
  const datasets = [{ label: 's', data: [1, 25, 100] }];

  const linearEl = (await fixture(
    html`<lyra-lite-chart type="line" scale="linear" .labels=${labels} .datasets=${datasets}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (linearEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (linearEl as unknown as { plotHeight: number }).plotHeight = 150;
  await linearEl.updateComplete;
  const linearPoints = [...linearEl.shadowRoot!.querySelectorAll('[part="point"]')] as SVGCircleElement[];

  const sqrtEl = (await fixture(
    html`<lyra-lite-chart type="line" scale="sqrt" .labels=${labels} .datasets=${datasets}></lyra-lite-chart>`,
  )) as LyraLiteChart;
  (sqrtEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (sqrtEl as unknown as { plotHeight: number }).plotHeight = 150;
  await sqrtEl.updateComplete;
  const sqrtPoints = [...sqrtEl.shadowRoot!.querySelectorAll('[part="point"]')] as SVGCircleElement[];

  linearPoints.forEach((p, i) => {
    expect(Number(sqrtPoints[i].getAttribute('cy'))).to.be.closeTo(Number(p.getAttribute('cy')), 0.01);
  });
});

// --- hideAxis ---------------------------------------------------------------------

it('hideAxis suppresses gridlines and y-axis tick labels but leaves x-axis category labels alone', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    hide-axis
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="end"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]').length).to.equal(
    BAR_LABELS.length,
  );
});

it('renders gridlines and y-axis tick labels by default (hideAxis unset, regression)', async () => {
  const el = await mount(html`<lyra-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lyra-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]').length).to.be.greaterThan(0);
  expect(el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="end"]').length).to.be.greaterThan(0);
});

// --- minBarHeight -----------------------------------------------------------------

describe('minBarHeight', () => {
  it('floors a tiny nonzero stacked segment to at least minBarHeight px', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart
        type="bar"
        stacked
        min-bar-height="4"
        .labels=${['a']}
        .datasets=${[
          { label: 'big', data: [1000] },
          { label: 'tiny', data: [1] },
        ]}
      ></lyra-lite-chart>
    `)) as LyraLiteChart;
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    expect(bars).to.have.length(2);
    const tinyHeight = Number(bars[1]!.getAttribute('height'));
    expect(tinyHeight).to.be.at.least(4);
  });

  it('leaves bar height untouched when minBarHeight is unset', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart
        type="bar"
        stacked
        .labels=${['a']}
        .datasets=${[
          { label: 'big', data: [1000] },
          { label: 'tiny', data: [1] },
        ]}
      ></lyra-lite-chart>
    `)) as LyraLiteChart;
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    const tinyHeight = Number(bars[1]!.getAttribute('height'));
    expect(tinyHeight).to.be.lessThan(4);
  });

  it('does not let a floored tiny segment get overdrawn by the next stacked segment (z-order/gap check)', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart
        type="bar"
        stacked
        min-bar-height="4"
        .labels=${['a']}
        .datasets=${[
          { label: 'tiny', data: [1] },
          { label: 'big', data: [1000] },
        ]}
      ></lyra-lite-chart>
    `)) as LyraLiteChart;
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    expect(bars).to.have.length(2);
    const tinyTop = Number(bars[0]!.getAttribute('y'));
    const tinyHeight = Number(bars[0]!.getAttribute('height'));
    const tinyBottom = tinyTop + tinyHeight;
    const bigTop = Number(bars[1]!.getAttribute('y'));
    const bigHeight = Number(bars[1]!.getAttribute('height'));
    const bigBottom = bigTop + bigHeight;
    // The floored "tiny" segment (drawn first, bottom of the stack) must occupy a real,
    // unoccluded pixel span -- "big" (painted after/on top) must start no earlier than
    // where "tiny" ends, not overlap into "tiny"'s own floored area.
    expect(tinyHeight).to.be.at.least(4);
    expect(bigBottom).to.be.closeTo(tinyTop, 0.5);
    expect(bigTop).to.be.lessThan(bigBottom);
  });
});

// --- scale="sqrt" stacked proportionality -----------------------------------------

describe('scale="sqrt" stacked proportionality', () => {
  it('sqrt-compresses the bar total, then splits it linearly by each segment share of that bar', async () => {
    // Reproduces the filed bug's exact repro: three categories, one stacked bar, values
    // 10/10/80 (domain max 100) -- segment heights must come out to 10%/10%/80% of the
    // sqrt-compressed bar height, not 31.6%/13.1%/55.3% (today's buggy per-segment-position sqrt).
    const el = (await fixture(html`
      <lyra-lite-chart
        type="bar"
        stacked
        scale="sqrt"
        begin-at-zero
        .labels=${['only']}
        .datasets=${[
          { label: 'A', data: [10] },
          { label: 'B', data: [10] },
          { label: 'C', data: [80] },
        ]}
      ></lyra-lite-chart>
    `)) as LyraLiteChart;
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    expect(bars).to.have.length(3);
    const heights = Array.from(bars).map((b) => Number(b.getAttribute('height')));
    const total = heights.reduce((a, b) => a + b, 0);
    const shares = heights.map((h) => h / total);
    expect(shares[0]).to.be.closeTo(0.1, 0.01);
    expect(shares[1]).to.be.closeTo(0.1, 0.01);
    expect(shares[2]).to.be.closeTo(0.8, 0.01);
  });

  it('non-stacked scale="sqrt" is unaffected (already proportional, single segment per bar)', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart
        type="bar"
        scale="sqrt"
        begin-at-zero
        .labels=${['a', 'b']}
        .datasets=${[{ label: 'A', data: [10, 90] }]}
      ></lyra-lite-chart>
    `)) as LyraLiteChart;
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    const h0 = Number(bars[0]!.getAttribute('height'));
    const h1 = Number(bars[1]!.getAttribute('height'));
    // sqrt(10/90) ≈ 0.333 of h1's height -- same formula as before this task.
    expect(h0 / h1).to.be.closeTo(Math.sqrt(10 / 90), 0.02);
  });
});

// --- chartLabel --------------------------------------------------------------------

describe('chartLabel', () => {
  it('overrides the auto-derived <svg> aria-label when set', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart
        chart-label="Custom chart description"
        .labels=${['a']}
        .datasets=${[{ label: 'A', data: [1] }]}
      ></lyra-lite-chart>
    `)) as LyraLiteChart;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Custom chart description');
  });

  it('falls back to the auto-derived label (joined dataset labels, or "Chart") when unset', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lyra-lite-chart>
    `)) as LyraLiteChart;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('A');
  });
});

// --- selectedIndex -------------------------------------------------------------------

describe('selectedIndex', () => {
  it('reflects data-selected onto every bar at the given category index, across datasets', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart
        type="bar"
        .labels=${['a', 'b']}
        .datasets=${[
          { label: 'x', data: [1, 2] },
          { label: 'y', data: [3, 4] },
        ]}
        .selectedIndex=${[1]}
      ></lyra-lite-chart>
    `)) as LyraLiteChart;
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
    const selected = bars.filter((b) => b.hasAttribute('data-selected'));
    expect(selected).to.have.length(2); // both datasets' bar at category index 1
  });

  it('reflects nothing when selectedIndex is empty (the default)', async () => {
    const el = (await fixture(html`
      <lyra-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 'x', data: [1] }]}></lyra-lite-chart>
    `)) as LyraLiteChart;
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
    expect(bars.some((b) => b.hasAttribute('data-selected'))).to.be.false;
  });
});
