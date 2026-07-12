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
