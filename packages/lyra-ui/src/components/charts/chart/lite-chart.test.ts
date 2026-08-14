import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.js';
import { styles } from './lite-chart.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

it('provides hover feedback for keyboard-focusable bars and points', () => {
  // Pseudo-class presence is the behavior under test; synthetic pointer events do not
  // activate browser :hover state under Web Test Runner.
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/:where\(\[part='bar'\]\):hover/);
  expect(css).to.match(/:where\(\[part='point'\]\):hover/);
});

async function mount(tpl: ReturnType<typeof html>): Promise<LyraLiteChart> {
  const el = (await fixture(tpl)) as LyraLiteChart;
  // Let the ResizeObserver callback (async, fires after connect) settle so
  // plotWidth/plotHeight reflect the real rendered size before geometry-dependent
  // assertions. A realm without ResizeObserver intentionally retains the legacy
  // 400x200 fallback instead.
  await waitUntil(() => {
    const chart = el as unknown as { plotWidth: number; plotHeight: number };
    return !el.ownerDocument.defaultView?.ResizeObserver || (chart.plotWidth > 0 && chart.plotHeight > 0);
  });
  await el.updateComplete;
  return el;
}

function politeTexts(doc: Document = document): string[] {
  const sink = doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`);
  return sink ? Array.from(sink.children).map((child) => child.textContent ?? '') : [];
}

const BAR_LABELS = ['Mon', 'Tue', 'Wed'];
const BAR_DATASETS = [
  { label: 'A', data: [1, 2, 3] },
  { label: 'B', data: [4, 5, 6] },
];

it('rejects unsafe public height and series paint values while preserving valid ones', async () => {
  const el = await mount(html`<lr-lite-chart
    .height=${'12rem;position:fixed'}
    .legend=${true}
    .labels=${['A']}
    .datasets=${[{ label: 'Series', data: [1], color: 'url("data:image/svg+xml,<svg/>")' }]}
  ></lr-lite-chart>`);
  const bar = el.shadowRoot!.querySelector('[part="bar"]')!;
  const swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
  expect(el.style.getPropertyValue('--lr-chart-height')).to.equal('');
  expect(el.style.getPropertyValue('--_lr-chart-height')).to.equal('');
  expect(el.style.position).to.equal('');
  expect(bar.getAttribute('fill')).to.not.contain('url(');
  expect(swatch.style.background).to.not.contain('url(');

  el.height = 'calc(12rem + 2px)';
  el.datasets = [{ label: 'Series', data: [1], color: 'color-mix(in srgb, red 50%, blue)' }];
  await el.updateComplete;
  expect(el.style.getPropertyValue('--lr-chart-height')).to.equal('');
  expect(el.style.getPropertyValue('--_lr-chart-height')).to.equal('calc(12rem + 2px)');
  expect(el.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('fill')).to.contain('color-mix');
});

it('parses begin-at-zero="false" as false from plain HTML', async () => {
  const el = await mount(html`<lr-lite-chart begin-at-zero="false"></lr-lite-chart>`);
  expect(el.beginAtZero).to.be.false;
});

it('renders one bar per label per dataset (grouped, not stacked)', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(6);
});

it('stacked bars still render one rect per (label, dataset) pair, just positioned differently', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    stacked
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(6);
});

it('stacked bar segments sit end-to-end (second segment starts where the first ends)', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    stacked
    .labels=${['only']}
    .datasets=${[
      { label: 'A', data: [10] },
      { label: 'B', data: [20] },
    ]}
  ></lr-lite-chart>`);
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
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[
      { label: 'A', data: [5] },
      { label: 'B', data: [5] },
    ]}
  ></lr-lite-chart>`);
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
  const el = await mount(html`<lr-lite-chart
    type="line"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(6);
});

it('skips null values in a line series without throwing, and without a point for them', async () => {
  const el = await mount(html`<lr-lite-chart
    type="line"
    .labels=${['a', 'b', 'c']}
    .datasets=${[{ label: 'A', data: [1, null, 3] }]}
  ></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="point"]').length).to.equal(2);
});

it('emits lr-point-click with the right detail on bar click', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  const detailPromise = new Promise<CustomEvent>((resolve) =>
    el.addEventListener('lr-point-click', (e) => resolve(e as CustomEvent), { once: true }),
  );
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  // Dataset B ('Tue') -> second dataset, index 1.
  rects[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const { detail } = await detailPromise;
  expect(detail).to.deep.equal({ datasetIndex: 1, index: 1, label: 'Tue', value: 5 });
});

it('emits lr-point-click on Enter and Space while a bar is focused, not on other keys', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[{ label: 'A', data: [7] }]}
  ></lr-lite-chart>`);
  const bar = el.shadowRoot!.querySelector('[part="bar"]')! as SVGRectElement;
  let count = 0;
  el.addEventListener('lr-point-click', () => count++);

  bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  expect(count).to.equal(0);

  bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(count).to.equal(1);

  bar.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(count).to.equal(2);
});

it('uses one roving tab stop, arrow/Home/End navigation, and a data-table alternative for multi-series', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  const marks = () => [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(marks().filter((mark) => mark.getAttribute('tabindex') === '0')).to.have.length(1);
  expect(marks().filter((mark) => mark.getAttribute('tabindex') === '-1')).to.have.length(5);

  marks()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(marks()[1]!.getAttribute('tabindex')).to.equal('0');
  // `focusMark()` delegates announcement to the resulting native focus event,
  // so the live region receives exactly one update. Wait one frame for that
  // announcement to land before reading it.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement & { shadowRoot: ShadowRoot };
  expect(liveRegion.shadowRoot.querySelector('[part="region"]')!.textContent).to.contain('2 of 6');

  marks()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  expect(marks()[5]!.getAttribute('tabindex')).to.equal('0');
  marks()[5]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  expect(marks()[0]!.getAttribute('tabindex')).to.equal('0');

  // BAR_DATASETS is multi-series, so the screen-reader alternative is the grouped data table
  // (one row per category, one column per series), not the flat single-series data list.
  expect((el.shadowRoot!.querySelector('[part="data-list"]')) == null).to.be.true;
  expect(el.shadowRoot!.querySelectorAll('[part="data-table"] tbody tr')).to.have.length(BAR_LABELS.length);
});

it('leaves the multi-series table unchanged when table formatting and totals are unset', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    stacked
    .labels=${['Q1']}
    .datasets=${[
      { label: 'Revenue', data: [12.5] },
      { label: 'Services', data: [7.5] },
    ]}
  ></lr-lite-chart>`);
  const table = el.shadowRoot!.querySelector('[part="data-table"]')!;
  expect(el.tableCellFormatter).to.equal(undefined);
  expect(el.tableTotals).to.be.false;
  expect([...table.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())).to.deep.equal([
    'Category',
    'Revenue',
    'Services',
  ]);
  const formatter = new Intl.NumberFormat(el.effectiveLocale);
  expect([...table.querySelectorAll('tbody td')].map((cell) => cell.textContent?.trim())).to.deep.equal([
    formatter.format(12.5),
    formatter.format(7.5),
  ]);
});

it('formats every finite multi-series table value with value-cell context', async () => {
  const calls: unknown[] = [];
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['Q1', 'Q2']}
    .datasets=${[
      { label: 'Revenue', data: [12.5, null] },
      { label: 'Services', data: [7.5, Number.NaN] },
    ]}
  ></lr-lite-chart>`);
  el.tableCellFormatter = (value, context) => {
    calls.push({ value, context });
    return `${context.seriesLabel}:${value.toFixed(2)}`;
  };
  await el.updateComplete;

  expect(
    [...el.shadowRoot!.querySelectorAll('[part="data-table"] tbody td')].map((cell) =>
      cell.textContent?.trim(),
    ),
  ).to.deep.equal(['Revenue:12.50', 'Services:7.50', '', '']);
  expect(calls).to.deep.equal([
    {
      value: 12.5,
      context: {
        kind: 'value',
        datasetIndex: 0,
        index: 0,
        label: 'Q1',
        seriesLabel: 'Revenue',
      },
    },
    {
      value: 7.5,
      context: {
        kind: 'value',
        datasetIndex: 1,
        index: 0,
        label: 'Q1',
        seriesLabel: 'Services',
      },
    },
  ]);
});

it('adds localized, formatted row totals only for stacked bar tables when tableTotals is set', async () => {
  const calls: unknown[] = [];
  const el = await mount(html`<lr-lite-chart
    type="bar"
    stacked
    .labels=${['Q1', 'Q2']}
    .datasets=${[
      { label: 'Revenue', data: [12.5, null] },
      { label: 'Services', data: [7.5, null] },
    ]}
    .strings=${{ chartTotal: 'Gesamt' }}
  ></lr-lite-chart>`);
  el.tableTotals = true;
  el.tableCellFormatter = (value, context) => {
    calls.push({ value, context });
    return `${context.kind}:${value.toFixed(2)}`;
  };
  await el.updateComplete;

  const table = el.shadowRoot!.querySelector('[part="data-table"]')!;
  expect([...table.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())).to.deep.equal([
    'Category',
    'Revenue',
    'Services',
    'Gesamt',
  ]);
  expect([...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
  )).to.deep.equal([
    ['value:12.50', 'value:7.50', 'total:20.00'],
    ['', '', ''],
  ]);
  expect(calls).to.deep.include({
    value: 20,
    context: {
      kind: 'total',
      datasetIndex: null,
      index: 0,
      label: 'Q1',
      seriesLabel: null,
    },
  });

  el.type = 'line';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="data-table"] thead th')).to.have.length(3);
});

it('emits lr-point-click for a line point too, with the same detail shape', async () => {
  const el = await mount(html`<lr-lite-chart
    type="line"
    .labels=${['x']}
    .datasets=${[{ label: 'Series', data: [42] }]}
  ></lr-lite-chart>`);
  const detailPromise = new Promise<CustomEvent>((resolve) =>
    el.addEventListener('lr-point-click', (e) => resolve(e as CustomEvent), { once: true }),
  );
  el.shadowRoot!.querySelector('[part="point"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const { detail } = await detailPromise;
  expect(detail).to.deep.equal({ datasetIndex: 0, index: 0, label: 'x', value: 42 });
});

it('renders no legend by default, and one legend-item per dataset when legend is set', async () => {
  const el = await mount(html`<lr-lite-chart
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  expect((el.shadowRoot!.querySelector('[part="legend"]')) == null).to.be.true;

  el.legend = true;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[part="legend-item"]');
  expect(items.length).to.equal(2);
  expect(items[0].textContent).to.contain('A');
  expect(items[1].textContent).to.contain('B');
});

it('uses a series-provided color for its bar fill, and a default palette color otherwise', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[
      { label: 'Custom', data: [1], color: '#ff0000' },
      { label: 'Default', data: [1] },
    ]}
  ></lr-lite-chart>`);
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(rects[0].getAttribute('fill')).to.equal('#ff0000');
  expect(rects[1].getAttribute('fill')).to.be.a('string').and.not.equal('#ff0000');
});

it('carries every mark colour in a computed `color` so the hover/active mix has a base to read', async () => {
  // The hover and pressed rules mix the mark's own colour toward --lr-color-mix-partner, and CSS
  // cannot read the value of a `fill` presentation attribute -- so each mark mirrors its series
  // colour into `color`, and the stylesheet mixes from currentColor. Drop this and both states
  // silently start mixing the inherited host text colour instead, which is invisible to every
  // other assertion in this file.
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[
      { label: 'Custom', data: [1], color: 'rgb(255, 0, 0)' },
      { label: 'Themed', data: [1], color: 'var(--lr-chart-color-3)' },
    ]}
  ></lr-lite-chart>`);
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(rects.length).to.equal(2);
  expect(getComputedStyle(rects[0]!).color).to.equal('rgb(255, 0, 0)');
  // A var()-valued series colour resolves the same way, and differs from the literal above.
  expect(getComputedStyle(rects[1]!).color).to.not.equal('rgb(255, 0, 0)');
  expect(getComputedStyle(rects[1]!).color).to.equal(getComputedStyle(rects[1]!).fill);
});

it('carries a line-chart point colour in `color` too, for the same hover/active mix', async () => {
  const el = await mount(html`<lr-lite-chart
    type="line"
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'Custom', data: [1, 2], color: 'rgb(0, 128, 0)' }]}
  ></lr-lite-chart>`);
  const points = [...el.shadowRoot!.querySelectorAll('[part="point"]')] as SVGCircleElement[];
  expect(points.length).to.equal(2);
  expect(getComputedStyle(points[0]!).color).to.equal('rgb(0, 128, 0)');
});

it('allows the categorical palette to be rethemed through semantic chart color variables', async () => {
  const el = await mount(html`<lr-lite-chart
    style="--lr-chart-color-2: rgb(1 2 3)"
    type="bar"
    .labels=${['only']}
    .datasets=${[
      { label: 'A', data: [1] },
      { label: 'B', data: [1] },
    ]}
  ></lr-lite-chart>`);
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  expect(styles.cssText).to.match(/--lr-chart-color-1:\s*var\(--lr-color-chart-1\)/);
  expect(rects[1].getAttribute('fill')).to.equal('var(--lr-chart-color-2)');
  expect(getComputedStyle(rects[1]).fill).to.equal('rgb(1, 2, 3)');
});

it('draws a gridline at the y=0 baseline when beginAtZero is true (the default)', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['only']}
    .datasets=${[{ label: 'A', data: [100] }]}
  ></lr-lite-chart>`);
  // beginAtZero pulls 0 into the domain even though every value is positive
  // and far from 0 — the nice-tick set should therefore include 0.
  const labels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"]')]
    .map((t) => t.textContent)
    .filter((t) => /^-?\d+(\.\d+)?$/.test(t ?? ''));
  expect(labels).to.include('0');
});

it('renders x/y axis titles only when xLabel/yLabel are set', async () => {
  const bare = await mount(html`<lr-lite-chart
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  expect(bare.shadowRoot!.querySelectorAll('[part="axis-title"]').length).to.equal(0);

  const labeled = await mount(html`<lr-lite-chart
    x-label="Day"
    y-label="Count"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  const titles = [...labeled.shadowRoot!.querySelectorAll('[part="axis-title"]')].map((t) => t.textContent);
  expect(titles).to.include('Day');
  expect(titles).to.include('Count');
});

it('handles empty labels/datasets without throwing', async () => {
  const el = await mount(html`<lr-lite-chart></lr-lite-chart>`);
  expect((el.shadowRoot!.querySelector('svg')) != null).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(0);
});

it('sets an aria-label on the svg from the dataset labels (role=group, not img, since bars/points inside are independently focusable)', async () => {
  const el = await mount(html`<lr-lite-chart
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  const svg = el.shadowRoot!.querySelector('svg')!;
  expect(svg.getAttribute('role')).to.equal('group');
  expect(svg.getAttribute('aria-label')).to.equal(
    new Intl.ListFormat(el.effectiveLocale, { type: 'conjunction' }).format(['A', 'B']),
  );
});

it('is accessible', async () => {
  const el = await mount(html`<lr-lite-chart
    legend
    x-label="Day"
    y-label="Count"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  await expect(el).to.be.accessible();
});

it('renders the legend with just the label when legendText is unset (unchanged default)', async () => {
  const el = await mount(html`<lr-lite-chart
    legend
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  const items = [...el.shadowRoot!.querySelectorAll('[part="legend-item"]')];
  expect(items.map((i) => i.textContent!.trim())).to.deep.equal(['A', 'B']);
  expect((el.shadowRoot!.querySelector('[part="legend-text"]')) == null).to.be.true;
});

it('appends legendText output next to each series label when set', async () => {
  const el = await mount(html`<lr-lite-chart
    legend
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
    .legendText=${(label: string, datasetIndex: number) => ` (${label}:${datasetIndex})`}
  ></lr-lite-chart>`);
  const texts = [...el.shadowRoot!.querySelectorAll('[part="legend-text"]')].map((n) => n.textContent);
  expect(texts).to.deep.equal([' (A:0)', ' (B:1)']);
});

it('uses tickFormat for y-axis labels when provided', async () => {
  const el = await mount(html`<lr-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
    .tickFormat=${(v: number) => `$${v.toFixed(2)}`}
  ></lr-lite-chart>`);
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="axis-label"]')).map(
    (n) => n.textContent,
  );
  expect(labels.some((t) => t?.startsWith('$'))).to.be.true;
});

it('falls back to the default nice-number formatter without tickFormat', async () => {
  const el = await mount(html`<lr-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
  ></lr-lite-chart>`);
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="axis-label"]')).map(
    (n) => n.textContent,
  );
  expect(labels.some((t) => t?.startsWith('$'))).to.be.false;
});

it('renders the same data again safely when an update has no changed properties', async () => {
  const el = (await fixture(html`<lr-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
  ></lr-lite-chart>`)) as LyraLiteChart;
  await el.updateComplete;
  const before = el.shadowRoot!.innerHTML;
  el.requestUpdate();
  await el.updateComplete;
  expect(el.shadowRoot!.innerHTML).to.equal(before);
});

it('re-renders when the tick formatter callback is replaced by reference', async () => {
  const first = (value: number) => `first-${value}`;
  const second = (value: number) => `second-${value}`;
  const el = await mount(html`<lr-lite-chart
    .labels=${['a', 'b']}
    .datasets=${[{ label: 'S', data: [10, 20] }]}
    .tickFormat=${first}
  ></lr-lite-chart>`);

  expect(el.shadowRoot!.textContent).to.include('first-');
  el.tickFormat = second;
  await el.updateComplete;
  expect(el.shadowRoot!.textContent).to.include('second-');
  expect(el.shadowRoot!.textContent).to.not.include('first-');
});

it('re-renders when the bar position callback is replaced by reference', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 'S', data: [10] }]}
    .barX=${() => 40}
  ></lr-lite-chart>`);

  const before = Number(el.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('x'));
  el.barX = () => 140;
  await el.updateComplete;
  const after = Number(el.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('x'));
  expect(after).to.not.equal(before);
});

it('draws a bar from the axis lo, not the domain zero, when beginAtZero is false', async () => {
  const el = (await fixture(
    // This property binding exercises the same false branch as the explicit
    // `begin-at-zero="false"` attribute covered above.
    html`<lr-lite-chart type="bar" .beginAtZero=${false} .labels=${['a']} .datasets=${[{ label: 's', data: [95] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  el.style.setProperty('--lr-chart-height', '200px');
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
    html`<lr-lite-chart type="bar" .beginAtZero=${false} .labels=${['a']} .datasets=${[{ label: 's', data: [-95] }]}></lr-lite-chart>`,
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
    html`<lr-lite-chart type="bar" .labels=${['x', 'y', 'z']} .datasets=${[{ label: 's', data: [1, 2, 3] }]}></lr-lite-chart>`,
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
    html`<lr-lite-chart type="line" .labels=${['a', 'b', 'c']} .datasets=${[{ label: 's', data: [1, null, 3] }]}></lr-lite-chart>`,
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
    html`<lr-lite-chart
      type="line"
      .labels=${['a', 'b', 'c', 'd', 'e']}
      .datasets=${[{ label: 's', data: [1, null, 3, null, 5] }]}
    ></lr-lite-chart>`,
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
  const el = await mount(
    html`<lr-lite-chart type="line" .labels=${['a']} .datasets=${[{ label: 's', data: [NaN] }]}></lr-lite-chart>`,
  );
  const path = el.shadowRoot!.querySelector('[part="line"]') as SVGPathElement;
  expect(path.getAttribute('d') ?? '').to.not.include('NaN');
});

it('excludes a non-finite (Infinity/NaN) value from the line path and its points, same as null', async () => {
  const el = (await fixture(
    html`<lr-lite-chart
      type="line"
      .labels=${['a', 'b', 'c']}
      .datasets=${[{ label: 's', data: [1, Infinity, 3] }]}
    ></lr-lite-chart>`,
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
    html`<lr-lite-chart
      type="bar"
      .labels=${['a', 'b']}
      .datasets=${[{ label: 's', data: [NaN, 4] }]}
    ></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const rects = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(rects.length).to.equal(1);
});

it('withholds fit-mode geometry until its first ResizeObserver measurement', async () => {
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class FakeResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver;

  try {
    const el = (await fixture(
      html`<lr-lite-chart
        type="bar"
        style="width: 320px"
        .labels=${['a', 'b']}
        .datasets=${[{ label: 's', data: [1, 2] }]}
      ></lr-lite-chart>`,
    )) as LyraLiteChart;
    await el.updateComplete;

    expect(callbacks.length).to.equal(1);
    expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="axis-label"]').length).to.equal(0);

    callbacks[0](
      [{ contentBoxSize: [{ inlineSize: 320, blockSize: 280 }] } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    await el.updateComplete;

    const svg = el.shadowRoot!.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).to.equal('0 0 320 280');
    expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(2);
    expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]').length).to.be.greaterThan(0);
    expect(el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]').length).to.equal(2);
  } finally {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalRO;
  }
});

it('reproduces the SSR fallback before enabling fit measurement during hydration', async () => {
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class FakeResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(callback);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver;

  try {
    const host = (await fixture(html`<div></div>`)) as HTMLDivElement;
    const el = document.createElement('lr-lite-chart') as LyraLiteChart;
    el.labels = ['a', 'b'];
    el.datasets = [{ label: 's', data: [1, 2] }];
    // An already-open shadow root is the parser-visible signal that LyraElement uses for a
    // declarative-shadow-DOM hydration mount.
    el.attachShadow({ mode: 'open' });
    host.append(el);
    await el.updateComplete;

    expect(callbacks.length).to.equal(1);
    expect(el.shadowRoot!.querySelector('svg')?.getAttribute('viewBox')).to.equal('0 0 400 200');
    expect(el.shadowRoot!.querySelectorAll('[part="bar"]')).to.have.length(2);
    expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]')).to.have.length.greaterThan(0);

    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bar"]').length === 0);
    expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]')).to.have.length(0);

    callbacks[0](
      [{ contentBoxSize: [{ inlineSize: 320, blockSize: 280 }] } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('svg')?.getAttribute('viewBox')).to.equal('0 0 320 280');
    expect(el.shadowRoot!.querySelectorAll('[part="bar"]')).to.have.length(2);
  } finally {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalRO;
  }
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
      html`<lr-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`,
    )) as LyraLiteChart;
    const svgEl = el.shadowRoot!.querySelector('svg')!;

    // First mount: connectedCallback() cannot create the observer while svgEl is still absent, so
    // firstUpdated() creates and arms it -- exactly one observe() call, on the real <svg>.
    expect(observeCalls.length).to.equal(1);
    expect((observeCalls[0]) === (svgEl)).to.equal(true);

    const parent = el.parentNode!;
    parent.removeChild(el); // disconnectedCallback() disconnects the old observer
    parent.appendChild(el); // connectedCallback() re-creates + re-observes

    // Re-arming on reconnect: a *second* observe() call, still targeting the
    // same underlying <svg> (Lit's shadow root/DOM survives a disconnect, so
    // svgEl is already populated by the time connectedCallback() runs here --
    // unlike on first mount).
    expect(observeCalls.length).to.equal(2);
    expect((observeCalls[1]) === (svgEl)).to.equal(true);

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

it('armResizeObserver() is a no-op when called again for the same already-armed document/target (e.g. a duplicate connectedCallback)', async () => {
  const el = await mount(html`<lr-lite-chart .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`);
  const priv = el as unknown as { resizeObserver?: ResizeObserver };
  const before = priv.resizeObserver;
  expect(before).to.exist;
  // Still connected, same document, same <svg> target -- connectedCallback() (which calls
  // armResizeObserver()) firing again must recognize the existing observer instead of tearing it
  // down and recreating it.
  el.connectedCallback();
  expect(priv.resizeObserver).to.equal(before);
});

it('tolerates a realm with no ResizeObserver constructor instead of throwing', async () => {
  const OriginalRO = window.ResizeObserver;
  (window as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = undefined;
  try {
    const el = (await fixture(
      html`<lr-lite-chart .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`,
    )) as LyraLiteChart;
    await el.updateComplete;
    expect((el as unknown as { resizeObserver?: ResizeObserver }).resizeObserver).to.be.undefined;
    expect(el.shadowRoot!.querySelector('svg')?.getAttribute('viewBox')).to.equal('0 0 400 200');
    expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(1);
  } finally {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalRO;
  }
});

it('constructs its resize observer in the adopted owner realm and ignores its stale callback', async () => {
  const el = (await fixture(
    html`<lr-lite-chart .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  await el.updateComplete;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalResizeObserver = frameWindow.ResizeObserver;
  let chartCallback: ResizeObserverCallback | undefined;
  let disconnects = 0;
  class OwnerResizeObserver implements ResizeObserver {
    private readonly callback: ResizeObserverCallback;
    private observesChart = false;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; }
    observe(target: Element): void {
      if (target === el.shadowRoot!.querySelector('svg')) {
        this.observesChart = true;
        chartCallback = this.callback;
      }
    }
    unobserve(): void {}
    disconnect(): void { if (this.observesChart) disconnects += 1; }
  }
  frameWindow.ResizeObserver = OwnerResizeObserver;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(chartCallback, 'the adopted owner constructs and arms the chart observer').to.be.a('function');
    const before = el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
    const staleCallback = chartCallback!;

    document.adoptNode(el);
    expect(disconnects, 'adoption disconnects the previous realm observer').to.equal(1);
    staleCallback(
      [{ contentBoxSize: [{ inlineSize: 999, blockSize: 777 }] } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox'),
      'the stale callback cannot update adopted chart geometry',
    ).to.equal(before);
  } finally {
    frameWindow.ResizeObserver = originalResizeObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

// --- layout="scroll" -------------------------------------------------------

it('layout="scroll" gives every bar a fixed width and lets the plot exceed the host width via horizontal scroll', async () => {
  const labels = Array.from({ length: 30 }, (_, i) => `C${i}`);
  const el = await mount(html`<lr-lite-chart
    type="bar"
    layout="scroll"
    style="width: 120px"
    .labels=${labels}
    .datasets=${[{ label: 'S', data: labels.map((_, i) => i + 1) }]}
  ></lr-lite-chart>`);
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
  const el = await mount(html`<lr-lite-chart
    type="bar"
    layout="scroll"
    bar-width="50"
    style="width: 80px"
    .labels=${labels}
    .datasets=${[{ label: 'S', data: labels.map(() => 1) }]}
  ></lr-lite-chart>`);
  const svgEl = el.shadowRoot!.querySelector('svg')!;
  const viewBoxW = Number(svgEl.getAttribute('viewBox')!.split(' ')[2]);
  // w = plotX(36, no yLabel) + n(8)*barWidth(50) + PAD_RIGHT(8) = 444.
  expect(viewBoxW).to.be.closeTo(444, 0.5);
});

it('falls back to the 32px default barWidth when the bar-width attribute is non-finite, instead of a NaN slot width', async () => {
  const labels = ['a', 'b'];
  const el = await mount(html`<lr-lite-chart
    type="bar"
    layout="scroll"
    bar-width="not-a-number"
    style="width: 80px"
    .labels=${labels}
    .datasets=${[{ label: 'S', data: labels.map(() => 1) }]}
  ></lr-lite-chart>`);
  const svgEl = el.shadowRoot!.querySelector('svg')!;
  const viewBoxW = Number(svgEl.getAttribute('viewBox')!.split(' ')[2]);
  // w = plotX(36, no yLabel) + n(2)*barWidth(32, the default fallback) + PAD_RIGHT(8) = 108.
  expect(viewBoxW).to.be.closeTo(108, 0.5);
  expect(svgEl.getAttribute('viewBox')).to.not.contain('NaN');
});

it('clamps a negative barWidth to 0 instead of a negative slot width, without throwing', async () => {
  const labels = ['a', 'b'];
  const el = await mount(html`<lr-lite-chart
    type="bar"
    layout="scroll"
    style="width: 80px"
    .labels=${labels}
    .datasets=${[{ label: 'S', data: labels.map(() => 1) }]}
  ></lr-lite-chart>`);
  el.barWidth = -10;
  await el.updateComplete;
  const svgEl = el.shadowRoot!.querySelector('svg')!;
  const viewBoxW = Number(svgEl.getAttribute('viewBox')!.split(' ')[2]);
  // w = plotX(36) + n(2)*barWidth(clamped to 0) + PAD_RIGHT(8) = 44.
  expect(viewBoxW).to.be.closeTo(44, 0.5);
  const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  for (const bar of bars) {
    expect(Number(bar.getAttribute('width'))).to.be.at.least(0);
    expect(bar.getAttribute('width')).to.not.contain('NaN');
  }
});

it('caps an extreme finite scroll barWidth before it reaches SVG viewBox or inline-size', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    layout="scroll"
    .barWidth=${Number.MAX_VALUE}
    .labels=${['first', 'last']}
    .datasets=${[{ label: 'S', data: [1, 2] }]}
  ></lr-lite-chart>`);
  const svg = el.shadowRoot!.querySelector('svg')!;
  const viewBox = svg.getAttribute('viewBox')!;
  const inlineSize = svg.getAttribute('style')!;
  expect(viewBox).to.not.match(/(?:NaN|Infinity)/);
  expect(inlineSize).to.not.match(/(?:NaN|Infinity)/);
  expect(Number(viewBox.split(' ')[2])).to.be.at.most(1_000_000 + 36 + 8);
});

it('keeps bars and their axis labels aligned in layout="scroll" (no drift between the two width models)', async () => {
  const labels = ['x', 'y', 'z', 'w', 'v'];
  const el = await mount(html`<lr-lite-chart
    type="bar"
    layout="scroll"
    style="width: 60px"
    .labels=${labels}
    .datasets=${[{ label: 's', data: [1, 2, 3, 4, 5] }]}
  ></lr-lite-chart>`);
  const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')] as SVGTextElement[];
  const firstBarCenter = Number(bars[0].getAttribute('x')) + Number(bars[0].getAttribute('width')) / 2;
  const firstLabelX = Number(axisLabels.find((l) => l.textContent === 'x')!.getAttribute('x'));
  expect(Math.abs(firstBarCenter - firstLabelX)).to.be.lessThan(1);
});

it('layout="fit" (the default) leaves the svg without an inline width override and the base container non-scrollable, unchanged from before layout existed', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
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
  const el = await mount(html`<lr-lite-chart
    type="bar"
    max-labels="5"
    .labels=${labels}
    .datasets=${[{ label: 's', data: labels.map((_, i) => i + 1) }]}
  ></lr-lite-chart>`);
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')].map(
    (n) => n.textContent,
  );
  expect(axisLabels.length).to.be.lessThan(labels.length);
  expect(axisLabels).to.include('L0');
  expect(axisLabels).to.include('L19');
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(20);
});

it('maxLabels distributes labels evenly without bunching the final sampled label against the endpoint', async () => {
  const labels = Array.from({ length: 30 }, (_, i) => `L${i}`);
  const el = await mount(html`<lr-lite-chart
    type="line"
    max-labels="10"
    .labels=${labels}
    .datasets=${[{ label: 's', data: labels.map((_, i) => i) }]}
  ></lr-lite-chart>`);
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')].map(
    (node) => node.textContent,
  );
  expect(axisLabels).to.deep.equal(['L0', 'L3', 'L6', 'L10', 'L13', 'L16', 'L19', 'L23', 'L26', 'L29']);
});

it('keeps decimated date labels clear of each other and the y-axis ticks at narrow widths', async () => {
  const labels = Array.from({ length: 30 }, (_, i) => `07-${String(i + 1).padStart(2, '0')}`);
  const el = await mount(html`<lr-lite-chart
    type="line"
    max-labels="10"
    height="260px"
    style="width: 332px"
    .labels=${labels}
    .datasets=${[{ label: 'Filed', data: labels.map((_, i) => i % 5) }]}
  ></lr-lite-chart>`);
  const xLabels = [
    ...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-label"][text-anchor="middle"]'),
  ];
  const yLabels = [
    ...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-label"][text-anchor="end"]'),
  ];
  const overlaps = (left: DOMRect, right: DOMRect) =>
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top;

  for (let index = 0; index < xLabels.length; index++) {
    const rect = xLabels[index]!.getBoundingClientRect();
    expect(
      xLabels.slice(index + 1).some((label) => overlaps(rect, label.getBoundingClientRect())),
      `x-axis label ${xLabels[index]!.textContent} overlaps another x-axis label`,
    ).to.be.false;
    expect(
      yLabels.some((label) => overlaps(rect, label.getBoundingClientRect())),
      `x-axis label ${xLabels[index]!.textContent} overlaps a y-axis tick`,
    ).to.be.false;
  }
});

it('renders every label when maxLabels is unset, even for a long category list (regression)', async () => {
  const labels = Array.from({ length: 20 }, (_, i) => `L${i}`);
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${labels}
    .datasets=${[{ label: 's', data: labels.map((_, i) => i + 1) }]}
  ></lr-lite-chart>`);
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')];
  expect(axisLabels.length).to.equal(20);
});

it('renders every label (no cap) when maxLabels is non-finite, instead of crashing or hiding every label', async () => {
  const labels = Array.from({ length: 20 }, (_, i) => `L${i}`);
  const el = await mount(html`<lr-lite-chart
    type="bar"
    max-labels="not-a-number"
    .labels=${labels}
    .datasets=${[{ label: 's', data: labels.map((_, i) => i + 1) }]}
  ></lr-lite-chart>`);
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')];
  expect(axisLabels.length).to.equal(20);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(20);
});

it('does not crash and still keeps the first/last label for a negative maxLabels', async () => {
  const labels = Array.from({ length: 20 }, (_, i) => `L${i}`);
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${labels}
    .datasets=${[{ label: 's', data: labels.map((_, i) => i + 1) }]}
  ></lr-lite-chart>`);
  el.maxLabels = -5;
  await el.updateComplete;
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')].map(
    (n) => n.textContent,
  );
  expect(axisLabels).to.include('L0');
  expect(axisLabels).to.include('L19');
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(20);
});

it('caps an enormous finite maxLabels request at the shared 1,000-record ceiling', () => {
  const el = document.createElement('lr-lite-chart') as LyraLiteChart;
  el.maxLabels = 1_000_000;

  const indexes = (el as any).visibleLabelIndexes(1_000_001) as Set<number>;
  expect(indexes.size).to.equal(1_000);
  expect(indexes.has(0)).to.equal(true);
  expect(indexes.has(1_000_000)).to.equal(true);
});

it('keeps the single label of a one-category chart when maxLabels caps it below 2 slots', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    max-labels="0"
    .labels=${['solo']}
    .datasets=${[{ label: 's', data: [1] }]}
  ></lr-lite-chart>`);
  const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]')].map(
    (n) => n.textContent,
  );
  expect(axisLabels).to.deep.equal(['solo']);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(1);
});

// --- barX coordinate override -------------------------------------------------

it('barX overrides the internally computed per-category x-origin for both bars and their labels', async () => {
  const el = (await fixture(
    html`<lr-lite-chart
      type="bar"
      .labels=${['only']}
      .datasets=${[{ label: 's', data: [5] }]}
      .barX=${() => 500}
    ></lr-lite-chart>`,
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
    html`<lr-lite-chart type="bar" .labels=${['x', 'y', 'z']} .datasets=${[{ label: 's', data: [1, 2, 3] }]}></lr-lite-chart>`,
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

it('resolves a stateful barX callback once per rendered category and falls back from non-finite output', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['first', 'last']}
    .datasets=${[
      { label: 'A', data: [1, 2] },
      { label: 'B', data: [3, 4] },
    ]}
  ></lr-lite-chart>`);
  let calls = 0;
  el.barX = (index) => {
    calls++;
    return index === 0 ? Number.POSITIVE_INFINITY : 101;
  };
  await el.updateComplete;

  const bars = [...el.shadowRoot!.querySelectorAll<SVGRectElement>('[part="bar"]')];
  const labels = [...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-label"][text-anchor="middle"]')];
  expect(calls).to.equal(2);
  expect([...bars, ...labels]
    .flatMap((node) => ['x', 'y', 'width', 'height'].map((name) => node.getAttribute(name)))
    .filter((value): value is string => value != null)
    .join(' ')).to.not.match(/(?:NaN|Infinity)/);
  const secondLabel = labels.find((label) => label.textContent === 'last')!;
  const secondBars = bars.filter((bar) => bar.getAttribute('data-index') === '1');
  // `barX` controls the category origin. A grouped category has one bar per series around that
  // origin, so its axis label must align with the group's center rather than either individual bar.
  const secondCenter = secondBars.reduce(
    (sum, bar) => sum + Number(bar.getAttribute('x')) + Number(bar.getAttribute('width')) / 2,
    0,
  ) / secondBars.length;
  expect(Number(secondLabel.getAttribute('x'))).to.be.closeTo(secondCenter, 1);
});

// --- pointText tooltip formatter -----------------------------------------------

it('pointText overrides the per-bar title-derived accessible name', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 'S', data: [42] }]}
    .pointText=${(label: string, value: number, datasetIndex: number) => `custom ${label} ${value} ${datasetIndex}`}
  ></lr-lite-chart>`);
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  expect(rect.querySelector('title')!.textContent).to.equal('custom a 42 0');
  expect(rect.getAttribute('aria-label')).to.equal('custom a 42 0');
});

it('pointText overrides the per-point title-derived accessible name for type="line" too', async () => {
  const el = await mount(html`<lr-lite-chart
    type="line"
    .labels=${['x']}
    .datasets=${[{ label: 'S', data: [7] }]}
    .pointText=${(label: string, value: number, datasetIndex: number) => `pt ${label}:${value}#${datasetIndex}`}
  ></lr-lite-chart>`);
  const point = el.shadowRoot!.querySelector('[part="point"]') as SVGCircleElement;
  expect(point.querySelector('title')!.textContent).to.equal('pt x:7#0');
  expect(point.getAttribute('aria-label')).to.equal('pt x:7#0');
});

it('falls back to the built-in raw-value title when pointText is unset (regression)', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 'S', data: [42] }]}
  ></lr-lite-chart>`);
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  expect(rect.querySelector('title')!.textContent).to.equal('S, a: 42');
  expect(rect.getAttribute('aria-label')).to.equal('S, a: 42');
});

it('formats the built-in bar/point label through localize() and Intl instead of a hard-coded template', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 'S', data: [1234.5] }]}
  ></lr-lite-chart>`);
  const rect = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const expected = `S, a: ${new Intl.NumberFormat(el.effectiveLocale).format(1234.5)}`;
  expect(rect.getAttribute('aria-label')).to.equal(expected);
  expect(rect.querySelector('title')!.textContent).to.equal(expected);
});

// --- roundedBars ----------------------------------------------------------------

it('roundedBars renders each bar as a rounded-corner path instead of a plain rect', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    rounded-bars
    .labels=${['a']}
    .datasets=${[{ label: 's', data: [42] }]}
  ></lr-lite-chart>`);
  const mark = el.shadowRoot!.querySelector('[part="bar"]')!;
  expect(mark.tagName.toLowerCase()).to.equal('path');
  expect(mark.getAttribute('d')).to.include('Q');
  expect((mark.querySelector('title')) != null).to.equal(true);
});

it('renders square-cornered rects by default (roundedBars unset, regression)', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 's', data: [42] }]}
  ></lr-lite-chart>`);
  const mark = el.shadowRoot!.querySelector('[part="bar"]')!;
  expect(mark.tagName.toLowerCase()).to.equal('rect');
});

// --- skipZero ---------------------------------------------------------------------

it('skipZero omits the mark entirely for an exact-zero value, while still rendering non-zero and skipping null/non-finite as before', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    skip-zero
    .labels=${['a', 'b', 'c', 'd']}
    .datasets=${[{ label: 's', data: [0, 5, null, NaN] }]}
  ></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(1);
});

it('renders a zero-height but focusable/titled bar for a zero value by default (skipZero unset, regression)', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${['a']}
    .datasets=${[{ label: 's', data: [0] }]}
  ></lr-lite-chart>`);
  const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(bars.length).to.equal(1);
  expect(bars[0].getAttribute('tabindex')).to.equal('0');
});

// --- padLeft ------------------------------------------------------------------

it('padLeft overrides the default 36px left padding, shifting the plot origin', async () => {
  const defaultEl = (await fixture(
    html`<lr-lite-chart type="bar" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (defaultEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (defaultEl as unknown as { plotHeight: number }).plotHeight = 150;
  await defaultEl.updateComplete;
  const defaultX = Number((defaultEl.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement).getAttribute('x'));

  const el = (await fixture(
    html`<lr-lite-chart type="bar" pad-left="80" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const x = Number((el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement).getAttribute('x'));

  expect(x).to.be.greaterThan(defaultX);
  // plotX(80) + (slot - groupW)/2, slot = 300 - 80 - 8 = 212, groupW = slot*0.8 = 169.6
  expect(x).to.be.closeTo(80 + (212 - 212 * 0.8) / 2, 0.5);
});

it('falls back to the 36px default axis gutter when pad-left is non-finite, instead of a NaN bar position', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="bar" pad-left="not-a-number" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const x = Number(bar.getAttribute('x'));
  // plotX(36, the fallback default) + (slot - groupW)/2, slot = 300 - 36 - 8 = 256, groupW = slot*0.8.
  expect(x).to.be.closeTo(36 + (256 - 256 * 0.8) / 2, 0.5);
  expect(bar.getAttribute('x')).to.not.contain('NaN');
});

it('clamps a negative padLeft to 0 instead of a negative axis gutter, without throwing', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="bar" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  el.padLeft = -50;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const x = Number(bar.getAttribute('x'));
  // plotX(clamped to 0) + (slot - groupW)/2, slot = 300 - 0 - 8 = 292, groupW = slot*0.8.
  expect(x).to.be.closeTo(0 + (292 - 292 * 0.8) / 2, 0.5);
  expect(x).to.be.at.least(0);
});

// --- barGapRatio ----------------------------------------------------------------

it('barGapRatio overrides the default 0.2 gap fraction, changing bar width relative to slot', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="bar" bar-gap-ratio="0.5" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
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
    html`<lr-lite-chart type="bar" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const slot = 300 - 36 - 8;
  const expectedWidth = slot * (1 - 0.2);
  expect(Number(bar.getAttribute('width'))).to.be.closeTo(expectedWidth, 0.5);
});

it('clamps an out-of-range bar-gap-ratio into [0, 1] instead of an inverted/oversized bar, without throwing', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="bar" bar-gap-ratio="5" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  // Clamped to 1 -> groupW = slot * (1 - 1) = 0.
  const width = Number(bar.getAttribute('width'));
  expect(width).to.be.at.least(0);
  expect(width).to.be.closeTo(0, 0.5);
  expect(bar.getAttribute('width')).to.not.contain('NaN');
});

it('falls back to the default 0.2 gap fraction when barGapRatio is non-finite, instead of NaN bar geometry', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="bar" .labels=${['only']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  el.barGapRatio = Number.NaN;
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
    html`<lr-lite-chart type="bar" scale="linear" .labels=${labels} .datasets=${datasets}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (linearEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (linearEl as unknown as { plotHeight: number }).plotHeight = 150;
  await linearEl.updateComplete;
  const linearBars = [...linearEl.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];

  const sqrtEl = (await fixture(
    html`<lr-lite-chart type="bar" scale="sqrt" .labels=${labels} .datasets=${datasets}></lr-lite-chart>`,
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
    html`<lr-lite-chart type="line" scale="linear" .labels=${labels} .datasets=${datasets}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (linearEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (linearEl as unknown as { plotHeight: number }).plotHeight = 150;
  await linearEl.updateComplete;
  const linearPoints = [...linearEl.shadowRoot!.querySelectorAll('[part="point"]')] as SVGCircleElement[];

  const sqrtEl = (await fixture(
    html`<lr-lite-chart type="line" scale="sqrt" .labels=${labels} .datasets=${datasets}></lr-lite-chart>`,
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
  const el = await mount(html`<lr-lite-chart
    type="bar"
    hide-axis
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="end"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="middle"]').length).to.equal(
    BAR_LABELS.length,
  );
});

it('renders gridlines and y-axis tick labels by default (hideAxis unset, regression)', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  expect(el.shadowRoot!.querySelectorAll('[part="grid-line"]').length).to.be.greaterThan(0);
  expect(el.shadowRoot!.querySelectorAll('[part="axis-label"][text-anchor="end"]').length).to.be.greaterThan(0);
});

// --- minBarHeight -----------------------------------------------------------------

describe('minBarHeight', () => {
  it('floors a tiny nonzero stacked segment to at least minBarHeight px', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        stacked
        min-bar-height="4"
        .labels=${['a']}
        .datasets=${[
          { label: 'big', data: [1000] },
          { label: 'tiny', data: [1] },
        ]}
      ></lr-lite-chart>
    `);
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    expect(bars).to.have.length(2);
    const tinyHeight = Number(bars[1]!.getAttribute('height'));
    expect(tinyHeight).to.be.at.least(4);
  });

  it('leaves bar height untouched when minBarHeight is unset', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        stacked
        .labels=${['a']}
        .datasets=${[
          { label: 'big', data: [1000] },
          { label: 'tiny', data: [1] },
        ]}
      ></lr-lite-chart>
    `);
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    const tinyHeight = Number(bars[1]!.getAttribute('height'));
    expect(tinyHeight).to.be.lessThan(4);
  });

  it('treats a non-finite or negative minBarHeight as a no-op floor instead of corrupting bar geometry', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        stacked
        .labels=${['a']}
        .datasets=${[
          { label: 'big', data: [1000] },
          { label: 'tiny', data: [1] },
        ]}
      ></lr-lite-chart>
    `);
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);

    for (const invalid of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      el.minBarHeight = invalid;
      await el.updateComplete;
      await aTimeout(0);
      const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
      expect(bars).to.have.length(2);
      for (const bar of bars) {
        const height = bar.getAttribute('height')!;
        expect(height).to.not.contain('NaN');
        expect(Number(height)).to.be.at.least(0);
      }
    }
  });

  it('caps an enormous finite minBarHeight before stacked cursors can overflow SVG geometry', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        stacked
        .labels=${['a']}
        .datasets=${[
          { label: 'first', data: [1] },
          { label: 'second', data: [1] },
          { label: 'third', data: [1] },
        ]}
      ></lr-lite-chart>
    `);
    el.minBarHeight = Number.MAX_VALUE;
    await el.updateComplete;

    const geometry = [...el.shadowRoot!.querySelectorAll('[x], [y], [width], [height], [d]')]
      .flatMap((node) =>
        ['x', 'y', 'width', 'height', 'd']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });

  it('does not let a floored tiny segment get overdrawn by the next stacked segment (z-order/gap check)', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        stacked
        min-bar-height="4"
        .labels=${['a']}
        .datasets=${[
          { label: 'tiny', data: [1] },
          { label: 'big', data: [1000] },
        ]}
      ></lr-lite-chart>
    `);
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
    // With three categories, one stacked bar, and values 10/10/80 (domain max 100), segment
    // heights must be 10%/10%/80% of the sqrt-compressed bar height, not
    // 31.6%/13.1%/55.3% from applying sqrt to each segment position.
    const el = await mount(html`
      <lr-lite-chart
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
      ></lr-lite-chart>
    `);
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

  it('anchors a negative segment at the zero line, not the plot bottom edge', async () => {
    // A single positive series pinned at the domain max and a single negative series pinned at the
    // domain min is a degenerate/saturating case: each segment occupies its entire available side of
    // the zero line, so scale="sqrt" must render byte-for-byte the same geometry as scale="linear" --
    // any divergence means the sqrt branch is anchoring from the wrong reference point (the plot's
    // bottom edge instead of the real zero line), which pushes the negative segment off the bottom of
    // the plot and the positive segment down into the negative segment's own region.
    const labels = ['only'];
    const datasets = [
      { label: 'A', data: [80] },
      { label: 'B', data: [-20] },
    ];
    const linearEl = (await fixture(html`
      <lr-lite-chart type="bar" stacked scale="linear" begin-at-zero .labels=${labels} .datasets=${datasets}></lr-lite-chart>
    `)) as LyraLiteChart;
    (linearEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
    (linearEl as unknown as { plotHeight: number }).plotHeight = 150;
    await linearEl.updateComplete;
    const sqrtEl = (await fixture(html`
      <lr-lite-chart type="bar" stacked scale="sqrt" begin-at-zero .labels=${labels} .datasets=${datasets}></lr-lite-chart>
    `)) as LyraLiteChart;
    (sqrtEl as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
    (sqrtEl as unknown as { plotHeight: number }).plotHeight = 150;
    await sqrtEl.updateComplete;

    const linearBars = linearEl.shadowRoot!.querySelectorAll('[part="bar"]');
    const sqrtBars = sqrtEl.shadowRoot!.querySelectorAll('[part="bar"]');
    expect(linearBars).to.have.length(2);
    expect(sqrtBars).to.have.length(2);

    for (let i = 0; i < 2; i++) {
      const linearY = Number(linearBars[i]!.getAttribute('y'));
      const linearH = Number(linearBars[i]!.getAttribute('height'));
      const sqrtY = Number(sqrtBars[i]!.getAttribute('y'));
      const sqrtH = Number(sqrtBars[i]!.getAttribute('height'));
      expect(sqrtY).to.be.closeTo(linearY, 0.5);
      expect(sqrtH).to.be.closeTo(linearH, 0.5);
    }

    // The negative bar must not extend past the plot's own bottom edge -- both segments' plot-area
    // bottom edge is the same (the domain's own lo boundary), so the negative segment's rendered
    // bottom edge should match between scale modes too, not overshoot further down under "sqrt".
    const linearBottom = Number(linearBars[1]!.getAttribute('y')) + Number(linearBars[1]!.getAttribute('height'));
    const sqrtBottom = Number(sqrtBars[1]!.getAttribute('y')) + Number(sqrtBars[1]!.getAttribute('height'));
    expect(sqrtBottom).to.be.closeTo(linearBottom, 0.5);
  });

  it('non-stacked scale="sqrt" is unaffected (already proportional, single segment per bar)', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        scale="sqrt"
        begin-at-zero
        .labels=${['a', 'b']}
        .datasets=${[{ label: 'A', data: [10, 90] }]}
      ></lr-lite-chart>
    `);
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
    const h0 = Number(bars[0]!.getAttribute('height'));
    const h1 = Number(bars[1]!.getAttribute('height'));
    // sqrt(10/90) ≈ 0.333 of h1's height, preserving the established scale formula.
    expect(h0 / h1).to.be.closeTo(Math.sqrt(10 / 90), 0.02);
  });
});

// --- accessibleLabel --------------------------------------------------------------------

describe('accessibleLabel', () => {
  it('overrides the auto-derived <svg> aria-label when set', async () => {
    const el = (await fixture(html`
      <lr-lite-chart
        accessible-label="Custom chart description"
        .labels=${['a']}
        .datasets=${[{ label: 'A', data: [1] }]}
      ></lr-lite-chart>
    `)) as LyraLiteChart;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('Custom chart description');
  });

  it('falls back to the auto-derived label (joined dataset labels, or "Chart") when unset', async () => {
    const el = (await fixture(html`
      <lr-lite-chart .labels=${['a']} .datasets=${[{ label: 'A', data: [1] }]}></lr-lite-chart>
    `)) as LyraLiteChart;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal('A');
  });

  it('lets a host aria-label win and forwards it to the semantic SVG without duplicating the group role', async () => {
    const el = (await fixture(html`
      <lr-lite-chart
        aria-label="Quarterly revenue"
        accessible-label="Legacy chart label"
        .labels=${['a']}
        .datasets=${[{ label: 'A', data: [1] }]}
      ></lr-lite-chart>
    `)) as LyraLiteChart;
    await el.updateComplete;

    const svg = el.shadowRoot!.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).to.equal('Quarterly revenue');
    expect(svg.getAttribute('role')).to.equal('group');
    expect(el.getAttribute('role')).to.equal(null);
    expect(el.shadowRoot!.querySelectorAll('svg[role]')).to.have.length(1);
  });
});

describe('multi-series screen-reader data table', () => {
  it('renders a data table with series/category headers when there is more than one dataset', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line"></lr-lite-chart>`);
    el.labels = ['Jan', 'Feb'];
    el.datasets = [
      { label: 'Revenue', data: [10, 20] },
      { label: 'Cost', data: [5, 8] },
    ];
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('table[part="data-table"]');
    expect((table) != null).to.equal(true);
    expect((el.shadowRoot!.querySelector('ul[part="data-list"]')) == null).to.be.true;
    const headerCells = table!.querySelectorAll('thead th');
    // The corner cell carries a visible category header (the localized 'chartCategory' string,
    // 'Category' with no locale registered) rather than an empty <th> -- matching the sibling
    // lr-chart/lr-box-plot data tables and satisfying axe's empty-table-header best-practice rule.
    expect([...headerCells].map((c) => c.textContent?.trim())).to.deep.equal(['Category', 'Revenue', 'Cost']);
    const rowHeaders = table!.querySelectorAll('tbody th');
    expect([...rowHeaders].map((c) => c.textContent?.trim())).to.deep.equal(['Jan', 'Feb']);
  });

  it('fills the multi-series table body cells with each series value at each category', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line"></lr-lite-chart>`);
    el.labels = ['Jan', 'Feb'];
    el.datasets = [
      { label: 'Revenue', data: [10, 20] },
      { label: 'Cost', data: [5, 8] },
    ];
    await el.updateComplete;
    const rows = [...el.shadowRoot!.querySelectorAll('table[part="data-table"] tbody tr')];
    const cells = rows.map((row) => [...row.querySelectorAll('td')].map((c) => c.textContent?.trim()));
    expect(cells).to.deep.equal([
      ['10', '5'],
      ['20', '8'],
    ]);
  });

  it('uses the shared chartData caption on the multi-series table', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart
      type="line"
      .strings=${{ chartData: 'Diagrammdaten' }}
    ></lr-lite-chart>`);
    el.labels = ['Jan', 'Feb'];
    el.datasets = [
      { label: 'Revenue', data: [10, 20] },
      { label: 'Cost', data: [5, 8] },
    ];
    await el.updateComplete;
    const caption = el.shadowRoot!.querySelector('table[part="data-table"] caption');
    expect(caption?.textContent?.trim()).to.equal('Diagrammdaten');
  });

  it('keeps the flat list for a single dataset (unset-regression)', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line"></lr-lite-chart>`);
    el.labels = ['Jan', 'Feb'];
    el.datasets = [{ label: 'Revenue', data: [10, 20] }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('ul[part="data-list"]')).to.exist;
    expect((el.shadowRoot!.querySelector('table[part="data-table"]')) == null).to.be.true;
  });

  it('caps generated marks and the single-series alternative at 1,000 endpoint-preserving records', async () => {
    const labels = Array.from({ length: 1001 }, (_, index) => `C${index}`);
    const el = await mount(html`<lr-lite-chart
      type="bar"
      .strings=${{ chartDataSampled: 'Sampled records; provide a custom table.' }}
      .labels=${labels}
      .datasets=${[{ label: 'Revenue', data: labels.map((_, index) => index + 1) }]}
    ></lr-lite-chart>`);
    const bars = [...el.shadowRoot!.querySelectorAll<SVGRectElement>('[part="bar"]')];
    const listItems = el.shadowRoot!.querySelectorAll('[part="data-list"] li');
    expect(bars).to.have.length(1000);
    expect(listItems).to.have.length(1000);
    expect(bars[0]!.getAttribute('data-index')).to.equal('0');
    expect(bars.at(-1)!.getAttribute('data-index')).to.equal('1000');
    expect(el.shadowRoot!.querySelector('[part="data-truncation"]')?.textContent).to.contain(
      'Sampled records',
    );
  });

  it('keeps an initially sampled chart silent, then announces a later sampling transition', async () => {
    const sampledLabels = Array.from({ length: 1001 }, (_, index) => `C${index}`);
    const sampledDatasets = [{ label: 'Revenue', data: sampledLabels.map((_, index) => index) }];
    const el = await mount(html`<lr-lite-chart
      type="bar"
      .strings=${{ chartDataSampled: 'Sampled records; provide a custom table.' }}
      .labels=${sampledLabels}
      .datasets=${sampledDatasets}
    ></lr-lite-chart>`);

    expect(politeTexts()).to.deep.equal([]);

    el.labels = ['C0'];
    el.datasets = [{ label: 'Revenue', data: [0] }];
    await el.updateComplete;
    el.labels = sampledLabels;
    el.datasets = sampledDatasets;
    await el.updateComplete;

    expect(politeTexts()).to.deep.equal(['Sampled records; provide a custom table.']);
  });
});

describe('localized mark summaries', () => {
  it('uses the complete localized template and effective-locale number formatting', async () => {
    const el = (await fixture(html`
      <lr-lite-chart
        locale="de-DE"
        .strings=${{
          liteChartMarkSummary: '{series} – {label}: {value}; Position {index}/{total}',
        }}
        .labels=${['Q1']}
        .datasets=${[{ label: 'Umsatz', data: [1234.5] }]}
      ></lr-lite-chart>
    `)) as LyraLiteChart;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="data-list"] li')!.textContent).to.equal(
      'Umsatz – Q1: 1.234,5; Position 1/1',
    );
  });

  it('preserves the built-in English mark summary with no locale override', async () => {
    const el = (await fixture(html`
      <lr-lite-chart .labels=${['Q1']} .datasets=${[{ label: 'Revenue', data: [12] }]}></lr-lite-chart>
    `)) as LyraLiteChart;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="data-list"] li')!.textContent).to.equal(
      'Revenue, Q1: 12 (1 of 1)',
    );
  });
});

it('positions y-axis labels and title at logical start in RTL', async () => {
  const el = await mount(html`
    <lr-lite-chart
      style="direction: rtl; inline-size: 320px;"
      y-label="Revenue"
      .labels=${['Q1', 'Q2']}
      .datasets=${[{ label: 'Revenue', data: [12, 20] }]}
    ></lr-lite-chart>
  `);

  const gridLine = el.shadowRoot!.querySelector('[part="grid-line"]')!;
  const tick = el.shadowRoot!.querySelector('[part="axis-label"]')!;
  const title = el.shadowRoot!.querySelector('[part="axis-title"]')!;
  expect(Number(tick.getAttribute('x'))).to.be.greaterThan(Number(gridLine.getAttribute('x2')));
  // `text-anchor="end"` in both directions -- SVG's start/end keywords already mirror with the
  // inherited `direction: rtl`, so a conditional here would double-mirror and paint the label back
  // across the gridlines instead of out into the gutter. Assert the actual rendered geometry (not
  // just the attribute) so a regression that flips this again is caught even if some future anchor
  // value happens to still read as a string.
  expect(tick.getAttribute('text-anchor')).to.equal('end');
  const tickBox = (tick as SVGTextElement).getBBox();
  expect(tickBox.x).to.be.greaterThanOrEqual(Number(gridLine.getAttribute('x2')));
  expect(Number(title.getAttribute('x'))).to.be.greaterThan(160);
  expect(title.getAttribute('transform')).to.contain('rotate(90');
});

it('can shrink to a 320px allocation with long chart content', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-lite-chart
        legend
        .labels=${['A category label that is intentionally very long', 'Another translated category label']}
        .datasets=${[{ label: 'A deliberately long translated revenue series label', data: [1, 2] }]}
      ></lr-lite-chart>
    </div>
  `);
  const el = wrapper.querySelector('lr-lite-chart') as LyraLiteChart;
  await el.updateComplete;

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

// --- selectedIndex -------------------------------------------------------------------

describe('selectedIndex', () => {
  it('renders selected bar and point outline color and width from component hooks', async () => {
    for (const type of ['bar', 'line'] as const) {
      const el = await mount(html`
        <lr-lite-chart
          type=${type}
          style="
            --lr-lite-chart-selected-outline-color: rgb(1, 2, 3);
            --lr-lite-chart-selected-outline-width: 7px;
          "
          .labels=${['a']}
          .datasets=${[{ label: 'x', data: [1] }]}
          .selectedIndex=${[0]}
        ></lr-lite-chart>
      `);
      const mark = el.shadowRoot!.querySelector<SVGElement>(`[part="${type === 'bar' ? 'bar' : 'point'}"]`)!;
      const computed = getComputedStyle(mark);
      expect(computed.stroke).to.equal('rgb(1, 2, 3)');
      expect(computed.strokeWidth).to.equal('7px');
    }
  });

  it('reflects data-selected onto every bar at the given category index, across datasets', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        .labels=${['a', 'b']}
        .datasets=${[
          { label: 'x', data: [1, 2] },
          { label: 'y', data: [3, 4] },
        ]}
        .selectedIndex=${[1]}
      ></lr-lite-chart>
    `);
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
    const selected = bars.filter((b) => b.hasAttribute('data-selected'));
    expect(selected).to.have.length(2); // both datasets' bar at category index 1
  });

  it('reflects nothing when selectedIndex is empty (the default)', async () => {
    const el = await mount(html`
      <lr-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 'x', data: [1] }]}></lr-lite-chart>
    `);
    el.style.height = '300px';
    await el.updateComplete;
    await aTimeout(0);
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
    expect(bars.some((b) => b.hasAttribute('data-selected'))).to.be.false;
  });

  it('marks aria-pressed="true" on a selected bar even when roundedBars renders it as a <path> instead of a <rect>', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        rounded-bars
        .labels=${['a', 'b']}
        .datasets=${[{ label: 's', data: [1, 2] }]}
        .selectedIndex=${[1]}
      ></lr-lite-chart>
    `);
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
    expect(bars.map((bar) => bar.tagName.toLowerCase())).to.deep.equal(['path', 'path']);
    expect(bars.map((bar) => bar.getAttribute('aria-pressed'))).to.deep.equal(['false', 'true']);
  });
});

// --- ResizeObserver entry without contentBoxSize (falls back to getBoundingClientRect) --------

it('falls back to getBoundingClientRect() for plotWidth/plotHeight when a ResizeObserver entry has no contentBoxSize', async () => {
  const callbacks: ResizeObserverCallback[] = [];
  const OriginalRO = window.ResizeObserver;
  class SpyResizeObserver extends OriginalRO {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      callbacks.push(callback);
    }
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = SpyResizeObserver;
  try {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      .labels=${['a']}
      .datasets=${[{ label: 's', data: [1] }]}
    ></lr-lite-chart>`);
    const svgEl = el.shadowRoot!.querySelector('svg')!;
    const rectBefore = svgEl.getBoundingClientRect();
    const callback = callbacks[callbacks.length - 1];
    // No `contentBoxSize` on the entry at all -- forces the `box` lookup to be falsy so the
    // callback takes its getBoundingClientRect() fallback branch instead.
    callback([{} as unknown as ResizeObserverEntry], new OriginalRO(() => {}));
    await el.updateComplete;
    expect((el as unknown as { plotWidth: number }).plotWidth).to.be.closeTo(rectBefore.width, 1);
    expect((el as unknown as { plotHeight: number }).plotHeight).to.be.closeTo(rectBefore.height, 1);
  } finally {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = OriginalRO;
  }
});

// --- interactiveMarks() label fallback for a hole in the labels array ---------------------------

it('falls back to an empty label in bar mark data when the labels array has a hole at that index', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    .labels=${[undefined as unknown as string, 'b']}
    .datasets=${[{ label: 'S', data: [1, 2] }]}
  ></lr-lite-chart>`);
  const items = el.shadowRoot!.querySelectorAll('[part="data-list"] li');
  expect(items[0].textContent).to.equal('S, : 1 (1 of 2)');
});

it('falls back to an empty label in line mark data when the labels array has a hole at that index', async () => {
  const el = await mount(html`<lr-lite-chart
    type="line"
    .labels=${[undefined as unknown as string]}
    .datasets=${[{ label: 'S', data: [1, 2] }]}
  ></lr-lite-chart>`);
  const items = el.shadowRoot!.querySelectorAll('[part="data-list"] li');
  expect(items[0].textContent).to.equal('S, : 1 (1 of 2)');
});

// --- markAnnouncement() defensive guards --------------------------------------------------------

it('markAnnouncement returns an empty string for an out-of-range mark index (defensive guard)', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`);
  expect((el as unknown as { markAnnouncement: (i: number) => string }).markAnnouncement(99)).to.equal('');
});

it('markAnnouncement falls back to the localized generic series label when the mark references a dataset index that no longer exists', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`);
  const text = (
    el as unknown as {
      markAnnouncement: (i: number, marks: { datasetIndex: number; index: number; label: string; value: number }[]) => string;
    }
  ).markAnnouncement(0, [{ datasetIndex: 5, index: 0, label: 'a', value: 1 }]);
  expect(text).to.contain('Series');
});

// --- onMarkFocus()/focusMark() defensive guards -------------------------------------------------

it('onMarkFocus is a no-op for an out-of-range mark index (defensive guard)', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`);
  const before = (el as unknown as { activeMarkIndex: number }).activeMarkIndex;
  (el as unknown as { onMarkFocus: (i: number) => void }).onMarkFocus(99);
  expect((el as unknown as { activeMarkIndex: number }).activeMarkIndex).to.equal(before);
});

it('focusMark is a no-op for an out-of-range mark index (defensive guard)', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`);
  const before = (el as unknown as { activeMarkIndex: number }).activeMarkIndex;
  (el as unknown as { focusMark: (i: number) => void }).focusMark(99);
  await el.updateComplete;
  expect((el as unknown as { activeMarkIndex: number }).activeMarkIndex).to.equal(before);
});

it('focusMark tolerates the addressed mark disappearing before its scheduled re-focus resolves (defensive guard)', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" .labels=${['a', 'b']} .datasets=${[{ label: 's', data: [1, 2] }]}></lr-lite-chart>`);
  const priv = el as unknown as { focusMark: (i: number) => void };
  priv.focusMark(1); // valid index -- schedules a re-focus once the pending update resolves
  el.datasets = [{ label: 's', data: [1] }]; // synchronously shrinks marks to 1 before that resolves
  await el.updateComplete;
  await aTimeout(0);
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]')).to.have.length(1);
});

it('re-announces via onMarkFocus() instead of a redundant .focus() when the addressed mark is already the active element', async () => {
  const el = await mount(html`
    <lr-lite-chart
      .labels=${['A', 'B']}
      .datasets=${[{ label: 'Revenue', data: [1, 2] }]}
    ></lr-lite-chart>
  `);
  const marks = () => [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGGraphicsElement[];
  marks()[0]!.focus(); // real focus (unlike the synthetic-dispatch tests elsewhere in this file)
  expect((el.shadowRoot!.activeElement) === (marks()[0])).to.equal(true);

  const liveRegion = el.shadowRoot!.querySelector('lr-live-region') as any;
  const original = liveRegion.announce.bind(liveRegion);
  let announcements = 0;
  liveRegion.announce = (...args: unknown[]) => {
    announcements++;
    return original(...args);
  };

  // ArrowLeft at the first mark clamps back to the same index -- focusMark() still runs, but since
  // the target is already the real active element, calling .focus() on it again would be a no-op
  // that fires no native 'focus' event (and thus no announcement); the code must instead call
  // onMarkFocus() directly to keep the roving-focus announcement working at the boundary.
  marks()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  await aTimeout(0);

  expect(announcements).to.equal(1);
  expect((el.shadowRoot!.activeElement) === (marks()[0])).to.equal(true);
});

// --- barValueToY() scale="sqrt" domainMax fallback for a non-positive hi ------------------------

it('scale="sqrt" falls back to a domainMax of 1 instead of dividing by a non-positive hi, for an all-negative domain', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="bar" scale="sqrt" .beginAtZero=${false} .labels=${['a']} .datasets=${[{ label: 's', data: [-50] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  await el.updateComplete;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  expect(bar.getAttribute('height')).to.not.contain('NaN');
  expect(bar.getAttribute('height')).to.not.contain('Infinity');
});

// --- roundedBarPath() zero-height degrades to a plain rect path ---------------------------------

it('roundedBars degrades to a plain rectangle path for a zero-height bar instead of self-intersecting', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" rounded-bars .labels=${['a']} .datasets=${[{ label: 's', data: [0] }]}></lr-lite-chart>`);
  const mark = el.shadowRoot!.querySelector('[part="bar"]')!;
  expect(mark.tagName.toLowerCase()).to.equal('path');
  expect(mark.getAttribute('d')).to.not.include('Q');
});

// --- domain() stacked extent skips null/non-finite values ---------------------------------------

it('skips a null/non-finite value when computing the stacked domain extent, without throwing', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    stacked
    .labels=${['a']}
    .datasets=${[
      { label: 'A', data: [null] },
      { label: 'B', data: [10] },
    ]}
  ></lr-lite-chart>`);
  const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(bars.length).to.equal(1);
  expect(bars[0].getAttribute('height')).to.not.contain('NaN');
});

// --- emitPoint() value fallback for a dangling index -----------------------------------------

it('emits null (not undefined, and without throwing) for a point-click index that has no backing data value', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" .labels=${['a', 'b']} .datasets=${[{ label: 's', data: [1, 2] }]}></lr-lite-chart>`);
  const detailPromise = new Promise<CustomEvent>((resolve) =>
    el.addEventListener('lr-point-click', (e) => resolve(e as CustomEvent), { once: true }),
  );
  (el as unknown as { emitPoint: (di: number, i: number) => void }).emitPoint(0, 99);
  const { detail } = await detailPromise;
  expect(detail.value).to.equal(null);
});

// --- onPointKeyDown() empty-marks guard ----------------------------------------------------------

it('onPointKeyDown is a no-op when there are no interactive marks at all', async () => {
  const el = await mount(html`<lr-lite-chart type="bar"></lr-lite-chart>`);
  expect(() =>
    (
      el as unknown as { onPointKeyDown: (e: KeyboardEvent, di: number, i: number, mi: number) => void }
    ).onPointKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }), 0, 0, 0),
  ).to.not.throw();
});

// --- RTL forward/backward key swap + ArrowUp/ArrowDown ------------------------------------------

it('swaps ArrowLeft/ArrowRight semantics under RTL so "forward" still advances to the next mark visually', async () => {
  const el = await mount(html`<lr-lite-chart
    style="direction: rtl"
    type="bar"
    .labels=${BAR_LABELS}
    .datasets=${BAR_DATASETS}
  ></lr-lite-chart>`);
  const marks = () => [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  marks()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(marks()[1]!.getAttribute('tabindex')).to.equal('0');
});

it('moves to the previous mark on ArrowUp and the next mark on ArrowDown (vertical-axis key aliases)', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" .labels=${BAR_LABELS} .datasets=${BAR_DATASETS}></lr-lite-chart>`);
  const marks = () => [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGRectElement[];
  marks()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(marks()[1]!.getAttribute('tabindex')).to.equal('0');
  marks()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(marks()[0]!.getAttribute('tabindex')).to.equal('0');
});

// --- degenerate lo===hi domain: span fallback in renderGrid()/renderBars()/barValueToY() --------

it('falls back to a span of 1 instead of dividing by zero when the resolved domain lo equals hi (defensive floor around niceDomain\'s own invariant)', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="bar" .labels=${['a']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  // domain() itself can never actually produce lo === hi (niceDomain() guarantees a nonzero span) --
  // monkeypatch it directly to exercise the defensive `|| 1` fallbacks in renderGrid()/renderBars()/
  // barValueToY() that guard against that invariant ever being violated.
  (el as unknown as { domain: () => { lo: number; hi: number; ticks: number[] } }).domain = () => ({
    lo: 5,
    hi: 5,
    ticks: [5],
  });
  el.requestUpdate();
  await el.updateComplete;
  const gridLine = el.shadowRoot!.querySelector('[part="grid-line"]') as SVGLineElement;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  expect(gridLine.getAttribute('y1')).to.not.contain('NaN');
  expect(gridLine.getAttribute('y1')).to.not.contain('Infinity');
  expect(bar.getAttribute('y')).to.not.contain('NaN');
  expect(bar.getAttribute('height')).to.not.contain('NaN');
  expect(bar.getAttribute('height')).to.not.contain('Infinity');
});

it('falls back to a span of 1 for type="line" too, when the resolved domain lo equals hi', async () => {
  const el = (await fixture(
    html`<lr-lite-chart type="line" .labels=${['a']} .datasets=${[{ label: 's', data: [5] }]}></lr-lite-chart>`,
  )) as LyraLiteChart;
  (el as unknown as { plotWidth: number; plotHeight: number }).plotWidth = 300;
  (el as unknown as { plotHeight: number }).plotHeight = 150;
  (el as unknown as { domain: () => { lo: number; hi: number; ticks: number[] } }).domain = () => ({
    lo: 5,
    hi: 5,
    ticks: [5],
  });
  el.requestUpdate();
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]') as SVGPathElement;
  expect(path.getAttribute('d') ?? '').to.not.include('NaN');
  expect(path.getAttribute('d') ?? '').to.not.include('Infinity');
});

// --- stacked + scale="sqrt": totals pre-pass skips null/skip-zero values, and a zero-only ------
// --- category's share falls back to 0 instead of dividing by a zero total ----------------------

it('excludes null and skip-zero values from the stacked+sqrt per-category totals pre-pass, without throwing', async () => {
  const el = await mount(html`<lr-lite-chart
    type="bar"
    stacked
    scale="sqrt"
    skip-zero
    .labels=${['a']}
    .datasets=${[
      { label: 'A', data: [null] },
      { label: 'B', data: [0] },
      { label: 'C', data: [50] },
    ]}
  ></lr-lite-chart>`);
  const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(bars.length).to.equal(1);
  expect(bars[0].getAttribute('height')).to.not.contain('NaN');
});

it('handles a stacked+sqrt category whose only positive-side value is exactly zero without dividing by zero', async () => {
  const el = await mount(html`
    <lr-lite-chart type="bar" stacked scale="sqrt" .labels=${['a']} .datasets=${[{ label: 's', data: [0] }]}></lr-lite-chart>
  `);
  el.style.height = '300px';
  await el.updateComplete;
  await aTimeout(0);
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  expect((bar) != null).to.equal(true);
  expect(bar.getAttribute('height')).to.not.contain('NaN');
  expect(Number(bar.getAttribute('height'))).to.equal(0);
});

// --- minBarHeight: negative-side plain-stacked floor, and the separate non-stacked path ---------

it('floors a tiny negative stacked segment to at least minBarHeight px too (mirrors the positive-side floor)', async () => {
  const el = await mount(html`
    <lr-lite-chart
      type="bar"
      stacked
      min-bar-height="4"
      .labels=${['a']}
      .datasets=${[
        { label: 'big', data: [-1000] },
        { label: 'tiny', data: [-1] },
      ]}
    ></lr-lite-chart>
  `);
  el.style.height = '300px';
  await el.updateComplete;
  await aTimeout(0);
  const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(bars).to.have.length(2);
  const bigHeight = Number(bars[0]!.getAttribute('height'));
  const tinyHeight = Number(bars[1]!.getAttribute('height'));
  expect(tinyHeight).to.be.at.least(4);
  expect(bigHeight).to.be.greaterThan(tinyHeight);
});

it('floors a tiny non-stacked bar to at least minBarHeight px (separate code path from the plain-stacked floor above)', async () => {
  const el = await mount(html`
    <lr-lite-chart type="bar" min-bar-height="40" .labels=${['tiny', 'big']} .datasets=${[{ label: 's', data: [1, 1000] }]}></lr-lite-chart>
  `);
  el.style.height = '300px';
  await el.updateComplete;
  await aTimeout(0);
  const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
  expect(bars).to.have.length(2);
  const tinyHeight = Number(bars[0]!.getAttribute('height'));
  const bigHeight = Number(bars[1]!.getAttribute('height'));
  expect(tinyHeight).to.be.at.least(40);
  expect(bigHeight).to.be.greaterThan(tinyHeight);
});

// --- roundedBars: only the active mark carries tabindex=0 among several marks --------------------

describe('lite-chart robustness regressions', () => {
  it('locale-formats default ticks, mark positions, and multi-series table cells', async () => {
    const el = await mount(html`
      <lr-lite-chart
        locale="ar-EG"
        type="line"
        .labels=${['Q1']}
        .datasets=${[
          { label: 'Revenue', data: [1234.5] },
          { label: 'Cost', data: [12.5] },
        ]}
      ></lr-lite-chart>
    `);
    const formatter = new Intl.NumberFormat(el.effectiveLocale, { maximumFractionDigits: 6 });
    const axisLabels = [...el.shadowRoot!.querySelectorAll('[part="axis-label"]')].map(
      (node) => node.textContent?.trim(),
    );
    expect(axisLabels).to.include(formatter.format(0));
    const cells = [...el.shadowRoot!.querySelectorAll('[part="data-table"] tbody td')].map(
      (node) => node.textContent?.trim(),
    );
    expect(cells).to.deep.equal([formatter.format(1234.5), formatter.format(12.5)]);
  });

  it('transfers focus to a surviving mark when focused data shrinks', async () => {
    const el = await mount(html`
      <lr-lite-chart
        .labels=${['A', 'B', 'C']}
        .datasets=${[{ label: 'Revenue', data: [1, 2, 3] }]}
      ></lr-lite-chart>
    `);
    const marks = () =>
      [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGGraphicsElement[];
    marks()[2]!.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('data-index')).to.equal('2');

    el.labels = ['A', 'B'];
    el.datasets = [{ label: 'Revenue', data: [1, 2] }];
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('data-index')).to.equal('1');
    expect(marks().filter((mark) => mark.getAttribute('tabindex') === '0')).to.have.length(1);
  });

  it('keeps the same focused mark by (dataset, index) identity -- not just its array position -- when marks shift around it', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        skip-zero
        .labels=${['A', 'B', 'C']}
        .datasets=${[{ label: 'Revenue', data: [1, 0, 3] }]}
      ></lr-lite-chart>
    `);
    const marks = () => [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGGraphicsElement[];
    // "B" (index 1) is skipped (value 0, skipZero), so only 2 marks render: "A" (index 0) at array
    // position 0, and "C" (index 2) at array position 1.
    expect(marks()).to.have.length(2);
    marks()[1]!.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('data-index')).to.equal('2');
    expect(el.shadowRoot!.activeElement?.getAttribute('data-mark-index')).to.equal('1');

    // Un-skip "B" by giving it a nonzero value: all 3 marks now render, so "C" moves from array
    // position 1 to array position 2 -- a plain clamp of the old array position (1) would instead
    // land back on "B". The (dataset, index) identity match must follow "C" to its new position.
    el.datasets = [{ label: 'Revenue', data: [1, 5, 3] }];
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('data-index')).to.equal('2');
    expect(marks()).to.have.length(3);
    expect(marks().filter((mark) => mark.getAttribute('tabindex') === '0')).to.have.length(1);
    expect(marks()[2]!.getAttribute('tabindex')).to.equal('0');
  });

  it('transfers focus to the chart group when the last focused mark disappears', async () => {
    const el = await mount(html`
      <lr-lite-chart
        .labels=${['A']}
        .datasets=${[{ label: 'Revenue', data: [1] }]}
      ></lr-lite-chart>
    `);
    const mark = el.shadowRoot!.querySelector('[part="bar"]') as SVGGraphicsElement;
    mark.focus();
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('bar');

    el.labels = [];
    el.datasets = [];
    await el.updateComplete;

    const svg = el.shadowRoot!.querySelector('svg')!;
    expect(svg.getAttribute('tabindex')).to.equal('0');
    expect(el.shadowRoot!.activeElement?.localName).to.equal('svg');
  });

  it('keeps selected state explicit for every bar and point', async () => {
    const bar = await mount(html`
      <lr-lite-chart
        .labels=${['A', 'B']}
        .datasets=${[{ label: 'Revenue', data: [1, 2] }]}
        .selectedIndex=${[1]}
      ></lr-lite-chart>
    `);
    expect(
      [...bar.shadowRoot!.querySelectorAll('[part="bar"]')].map((mark) =>
        mark.getAttribute('aria-pressed'),
      ),
    ).to.deep.equal(['false', 'true']);

    const line = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['A', 'B']}
        .datasets=${[{ label: 'Revenue', data: [1, 2] }]}
        .selectedIndex=${[1]}
      ></lr-lite-chart>
    `);
    const points = [...line.shadowRoot!.querySelectorAll('[part="point"]')];
    expect(points.map((point) => point.getAttribute('aria-pressed'))).to.deep.equal([
      'false',
      'true',
    ]);
    expect(points.map((point) => point.hasAttribute('data-selected'))).to.deep.equal([false, true]);
  });

  it('renders transparent pointer hit geometry around line points and zero-height bars', async () => {
    const line = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['A']}
        .datasets=${[{ label: 'Revenue', data: [1] }]}
      ></lr-lite-chart>
    `);
    const pointHit = line.shadowRoot!.querySelector('[data-mark-hit-target="point"]')!;
    expect(Number(pointHit.getAttribute('r')) * 2).to.be.at.least(24);
    let detail: unknown;
    line.addEventListener('lr-point-click', (event) => {
      detail = (event as CustomEvent).detail;
    }, { once: true });
    pointHit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail).to.deep.equal({ datasetIndex: 0, index: 0, label: 'A', value: 1 });

    const bars = await mount(html`
      <lr-lite-chart
        .labels=${['A']}
        .datasets=${[{ label: 'Revenue', data: [0] }]}
      ></lr-lite-chart>
    `);
    const barHit = bars.shadowRoot!.querySelector('[data-mark-hit-target="bar"]')!;
    expect(Number(barHit.getAttribute('height'))).to.be.at.least(24);
    expect(Number(barHit.getAttribute('width'))).to.be.at.least(24);
  });

  it('shows keyboard focus across the compliant hit geometry of tiny and zero-height marks', async () => {
    const line = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['A']}
        .datasets=${[{ label: 'Revenue', data: [1] }]}
      ></lr-lite-chart>
    `);
    const point = line.shadowRoot!.querySelector('[part="point"]') as SVGGraphicsElement;
    const pointHit = line.shadowRoot!.querySelector(
      '[data-mark-hit-target="point"]',
    ) as SVGGraphicsElement;
    point.focus();
    expect(getComputedStyle(pointHit).stroke).to.not.equal('none');

    const bars = await mount(html`
      <lr-lite-chart
        .labels=${['A']}
        .datasets=${[{ label: 'Revenue', data: [0] }]}
      ></lr-lite-chart>
    `);
    const bar = bars.shadowRoot!.querySelector('[part="bar"]') as SVGGraphicsElement;
    const barHit = bars.shadowRoot!.querySelector(
      '[data-mark-hit-target="bar"]',
    ) as SVGGraphicsElement;
    bar.focus();
    expect(getComputedStyle(barHit).stroke).to.not.equal('none');
  });

  it('localizes custom mark announcement positions without appending fixed punctuation', async () => {
    const el = await mount(html`
      <lr-lite-chart
        locale="ar-EG"
        .labels=${['A', 'B']}
        .datasets=${[{ label: 'Revenue', data: [1, 2] }]}
        .pointText=${(label: string) => `Custom ${label}`}
        .strings=${{ liteChartCustomMarkSummary: '{content} [{index}/{total}]' }}
      ></lr-lite-chart>
    `);
    const marks = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGGraphicsElement[];
    marks[1]!.focus();

    const formatter = new Intl.NumberFormat(el.effectiveLocale);
    const region = el.shadowRoot!
      .querySelector('lr-live-region')!
      .shadowRoot!.querySelector('[part="region"]');
    expect(region?.textContent).to.equal(
      `Custom B [${formatter.format(2)}/${formatter.format(2)}]`,
    );
  });

  it('contains the non-scrolling axis when horizontal chart scrolling is enabled', async () => {
    const el = await mount(html`
      <lr-lite-chart
        layout="scroll"
        .labels=${Array.from({ length: 20 }, (_, index) => String(index))}
        .datasets=${[{ label: 'Revenue', data: Array.from({ length: 20 }, () => 1) }]}
      ></lr-lite-chart>
    `);
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(getComputedStyle(base).overflowX).to.equal('auto');
    expect(getComputedStyle(base).overflowY).to.equal('hidden');
  });

  it('bounds extreme finite domains without throwing or generating non-finite geometry', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['Low', 'High']}
        .datasets=${[{ label: 'Range', data: [-Number.MAX_VALUE, Number.MAX_VALUE] }]}
      ></lr-lite-chart>
    `);
    const geometry = [...el.shadowRoot!.querySelectorAll('[d], [cx], [cy], [x1], [x2], [y1], [y2]')]
      .flatMap((node) =>
        ['d', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });

  it('caps a stacked category total at +/-Number.MAX_VALUE instead of overflowing to Infinity when segments sum past it', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="bar"
        stacked
        .labels=${['x']}
        .datasets=${[
          { label: 'p1', data: [Number.MAX_VALUE] },
          { label: 'p2', data: [Number.MAX_VALUE] },
          { label: 'n1', data: [-Number.MAX_VALUE] },
          { label: 'n2', data: [-Number.MAX_VALUE] },
        ]}
      ></lr-lite-chart>
    `);
    const geometry = [...el.shadowRoot!.querySelectorAll('[x], [y], [width], [height], [d]')]
      .flatMap((node) =>
        ['x', 'y', 'width', 'height', 'd']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });

  it('widens a single-point domain near +Number.MAX_VALUE by halving toward zero instead of overflowing on the usual +/-1 widening', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="line"
        .beginAtZero=${false}
        .labels=${['only']}
        .datasets=${[{ label: 's', data: [Number.MAX_VALUE] }]}
      ></lr-lite-chart>
    `);
    const geometry = [...el.shadowRoot!.querySelectorAll('[d], [cx], [cy], [x1], [x2], [y1], [y2]')]
      .flatMap((node) =>
        ['d', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });

  it('widens a single-point domain near -Number.MAX_VALUE the same way, on the negative side', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="line"
        .beginAtZero=${false}
        .labels=${['only']}
        .datasets=${[{ label: 's', data: [-Number.MAX_VALUE] }]}
      ></lr-lite-chart>
    `);
    const geometry = [...el.shadowRoot!.querySelectorAll('[d], [cx], [cy], [x1], [x2], [y1], [y2]')]
      .flatMap((node) =>
        ['d', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });

  it('degrades gracefully when the data span underflows to a zero nice-step (denormalized values near Number.MIN_VALUE)', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['Low', 'High']}
        .datasets=${[{ label: 's', data: [0, Number.MIN_VALUE] }]}
      ></lr-lite-chart>
    `);
    const geometry = [...el.shadowRoot!.querySelectorAll('[d], [cx], [cy], [x1], [x2], [y1], [y2]')]
      .flatMap((node) =>
        ['d', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });

  it('falls back to unrounded nice-domain ticks when a huge asymmetric span rounds to more than 100 slots', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['Low', 'High']}
        .datasets=${[{ label: 's', data: [-1, Number.MAX_VALUE] }]}
      ></lr-lite-chart>
    `);
    const geometry = [...el.shadowRoot!.querySelectorAll('[d], [cx], [cy], [x1], [x2], [y1], [y2]')]
      .flatMap((node) =>
        ['d', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });

  it('appends the exact domain ceiling as a final tick when the last rounded step falls short of it', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['Low', 'High']}
        .datasets=${[{ label: 's', data: [0, Number.MAX_VALUE] }]}
      ></lr-lite-chart>
    `);
    const ticks = [...el.shadowRoot!.querySelectorAll('[part="axis-label"]')].map((node) =>
      node.textContent?.trim(),
    );
    // The domain's own upper bound must appear as a tick even though the regular step-multiple
    // sequence (lo, lo+step, lo+2*step, ...) lands short of it -- niceDomain() pushes it explicitly.
    expect(ticks.length).to.be.greaterThan(0);
    const geometry = [...el.shadowRoot!.querySelectorAll('[d], [cx], [cy], [x1], [x2], [y1], [y2]')]
      .flatMap((node) =>
        ['d', 'cx', 'cy', 'x1', 'x2', 'y1', 'y2']
          .map((name) => node.getAttribute(name))
          .filter((value): value is string => value != null),
      )
      .join(' ');
    expect(geometry).to.not.match(/(?:NaN|Infinity)/);
  });
});

describe('lite-chart semantics and geometry', () => {
  it('keeps each native SVG tooltip and explicit cross-engine command name in sync', async () => {
    const bars = await mount(html`
      <lr-lite-chart
        .labels=${['A']}
        .datasets=${[{ label: 'Revenue', data: [1] }]}
      ></lr-lite-chart>
    `);
    const bar = bars.shadowRoot!.querySelector('[part="bar"]')!;
    expect(bar.querySelector('title')?.textContent).to.equal('Revenue, A: 1');
    expect(bar.getAttribute('aria-label')).to.equal('Revenue, A: 1');

    const lines = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['A']}
        .datasets=${[{ label: 'Revenue', data: [1] }]}
      ></lr-lite-chart>
    `);
    const point = lines.shadowRoot!.querySelector('[part="point"]')!;
    expect(point.querySelector('title')?.textContent).to.equal('Revenue, A: 1');
    expect(point.getAttribute('aria-label')).to.equal('Revenue, A: 1');
  });

  it('announces a roving-keyboard move exactly once', async () => {
    const el = await mount(html`
      <lr-lite-chart
        .labels=${['A', 'B']}
        .datasets=${[{ label: 'Revenue', data: [1, 2] }]}
      ></lr-lite-chart>
    `);
    const liveRegion = el.shadowRoot!.querySelector('lr-live-region') as any;
    const original = liveRegion.announce.bind(liveRegion);
    let announcements = 0;
    liveRegion.announce = (...args: unknown[]) => {
      announcements++;
      return original(...args);
    };

    const marks = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
    marks[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    await aTimeout(0);

    expect(announcements).to.equal(1);
  });

  it('clips dense pointer geometry at the midpoint so adjacent marks never overlap', async () => {
    const line = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['A', 'B', 'C', 'D']}
        .datasets=${[{ label: 'Revenue', data: [1, 1, 1, 1] }]}
      ></lr-lite-chart>
    `);
    (line as any).plotWidth = 60;
    (line as any).plotHeight = 120;
    await line.updateComplete;
    const pointHits = [
      ...line.shadowRoot!.querySelectorAll<SVGCircleElement>('[data-mark-hit-target="point"]'),
    ];
    for (let index = 1; index < pointHits.length; index++) {
      const previous = pointHits[index - 1]!;
      const current = pointHits[index]!;
      const distance = Number(current.getAttribute('cx')) - Number(previous.getAttribute('cx'));
      expect(Number(previous.getAttribute('r')) + Number(current.getAttribute('r'))).to.be.at.most(
        distance + 0.001,
      );
    }

    const bars = await mount(html`
      <lr-lite-chart
        .labels=${['A', 'B', 'C', 'D']}
        .datasets=${[{ label: 'Revenue', data: [1, 1, 1, 1] }]}
      ></lr-lite-chart>
    `);
    (bars as any).plotWidth = 60;
    (bars as any).plotHeight = 120;
    await bars.updateComplete;
    const barHits = [
      ...bars.shadowRoot!.querySelectorAll<SVGRectElement>('[data-mark-hit-target="bar"]'),
    ];
    for (let index = 1; index < barHits.length; index++) {
      const previous = barHits[index - 1]!;
      const current = barHits[index]!;
      const previousRight =
        Number(previous.getAttribute('x')) + Number(previous.getAttribute('width'));
      expect(previousRight).to.be.at.most(Number(current.getAttribute('x')));
    }
  });

  it('arbitrates overlapping same-category line hit areas by two-dimensional distance', async () => {
    const line = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['Low', 'Target', 'High']}
        .datasets=${[
          { label: 'Earlier', data: [0, 40, 100] },
          { label: 'Later', data: [0, 44, 100] },
        ]}
      ></lr-lite-chart>
    `);
    const earlierPoint = line.shadowRoot!.querySelector<SVGCircleElement>(
      '[part="point"][data-dataset-index="0"][data-index="1"]',
    )!;
    const pointEvents: CustomEvent[] = [];
    line.addEventListener('lr-point-click', (event) => pointEvents.push(event as CustomEvent));
    const rect = earlierPoint.getBoundingClientRect();

    try {
      await sendMouse({
        type: 'click',
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
    } finally {
      await resetMouse();
    }

    expect(pointEvents).to.have.length(1);
    expect(pointEvents[0]!.detail).to.deep.equal({
      datasetIndex: 0,
      index: 1,
      label: 'Target',
      value: 40,
    });
  });

  it('keeps the actual later-painted point when coincident marks are equally near the click', async () => {
    const line = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['Target']}
        .datasets=${[
          { label: 'Earlier', data: [40] },
          { label: 'Later', data: [40] },
        ]}
      ></lr-lite-chart>
    `);
    const laterPoint = line.shadowRoot!.querySelector<SVGCircleElement>(
      '[part="point"][data-dataset-index="1"][data-index="0"]',
    )!;
    const pointEvents: CustomEvent[] = [];
    line.addEventListener('lr-point-click', (event) => pointEvents.push(event as CustomEvent));
    const rect = laterPoint.getBoundingClientRect();

    try {
      await sendMouse({
        type: 'click',
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
    } finally {
      await resetMouse();
    }

    expect(pointEvents).to.have.length(1);
    expect(pointEvents[0]!.detail).to.deep.equal({
      datasetIndex: 1,
      index: 0,
      label: 'Target',
      value: 40,
    });
  });

  it('emitNearestLinePoint falls back to the addressed dataset/index when the current target is not an SVGElement (defensive guard)', async () => {
    const el = await mount(html`<lr-lite-chart type="line" .labels=${['a']} .datasets=${[{ label: 's', data: [1] }]}></lr-lite-chart>`);
    const priv = el as unknown as {
      emitNearestLinePoint: (
        event: MouseEvent,
        points: { datasetIndex: number; index: number; x: number; y: number }[],
        fallbackDatasetIndex: number,
        fallbackIndex: number,
      ) => void;
    };
    const detailPromise = new Promise<CustomEvent>((resolve) =>
      el.addEventListener('lr-point-click', (e) => resolve(e as CustomEvent), { once: true }),
    );
    // A synthetic event whose currentTarget isn't part of any SVG at all -- e.g. a hand-rolled
    // event object, as opposed to a real click dispatched on one of the rendered <circle>s.
    const fakeEvent = { currentTarget: document.createElement('div'), detail: 0, clientX: 0, clientY: 0 } as unknown as MouseEvent;
    priv.emitNearestLinePoint(fakeEvent, [], 3, 7);
    const detail = (await detailPromise).detail as { datasetIndex: number; index: number };
    expect(detail.datasetIndex).to.equal(3);
    expect(detail.index).to.equal(7);
  });

  it('arbitrates to the nearest supplied hit point even when the initially-addressed dataset/index matches none of them (defensive guard)', async () => {
    const el = await mount(html`
      <lr-lite-chart
        type="line"
        .labels=${['A', 'B']}
        .datasets=${[{ label: 's', data: [1, 2] }]}
      ></lr-lite-chart>
    `);
    const circles = [...el.shadowRoot!.querySelectorAll<SVGCircleElement>('[part="point"]')];
    expect(circles).to.have.length(2);
    const target = circles[0]!;
    const points = circles.map((circle, index) => ({
      datasetIndex: 0,
      index,
      x: Number(circle.getAttribute('cx')),
      y: Number(circle.getAttribute('cy')),
    }));
    const rect = target.getBoundingClientRect();
    const priv = el as unknown as {
      emitNearestLinePoint: (
        event: MouseEvent,
        points: typeof points,
        fallbackDatasetIndex: number,
        fallbackIndex: number,
      ) => void;
    };
    const detailPromise = new Promise<CustomEvent>((resolve) =>
      el.addEventListener('lr-point-click', (e) => resolve(e as CustomEvent), { once: true }),
    );
    // A real click (detail > 0) on the real first point's circle, but addressed at a
    // dataset/index pair (99, 99) absent from `points` entirely -- the initial exact-identity
    // lookup can't find it, so distance-based arbitration must still land on the closest real
    // point rather than leaving `selected` undefined.
    const fakeEvent = {
      currentTarget: target,
      detail: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    } as unknown as MouseEvent;
    priv.emitNearestLinePoint(fakeEvent, points, 99, 99);
    const detail = (await detailPromise).detail as { datasetIndex: number; index: number };
    expect(detail.datasetIndex).to.equal(0);
    expect(detail.index).to.equal(0);
  });

  it('ellipsizes long narrow-axis labels, preserves their full title, and contains SVG paint', async () => {
    const labels = [
      'A deliberately long translated first category label',
      'A deliberately long translated second category label',
      'A deliberately long translated third category label',
    ];
    const el = await mount(html`
      <lr-lite-chart
        style="inline-size: 256px"
        .labels=${labels}
        .datasets=${[{ label: 'Revenue', data: [1, 2, 3] }]}
      ></lr-lite-chart>
    `);
    (el as any).plotWidth = 256;
    (el as any).plotHeight = 200;
    await el.updateComplete;

    const svg = el.shadowRoot!.querySelector('svg')!;
    const axisLabels = [
      ...el.shadowRoot!.querySelectorAll<SVGTextElement>(
        '[part="axis-label"][text-anchor="middle"]',
      ),
    ];
    expect(axisLabels[0]!.textContent).to.not.equal(labels[0]);
    expect(axisLabels[0]!.textContent).to.contain('…');
    expect(axisLabels[0]!.getAttribute('aria-label')).to.equal(labels[0]);
    expect(getComputedStyle(svg).overflow).to.equal('hidden');

    const svgRect = svg.getBoundingClientRect();
    const labelRects = axisLabels.map((label) => label.getBoundingClientRect());
    for (const rect of labelRects) {
      expect(rect.left).to.be.at.least(svgRect.left - 0.5);
      expect(rect.right).to.be.at.most(svgRect.right + 0.5);
    }
    for (let index = 1; index < labelRects.length; index++) {
      expect(labelRects[index - 1]!.right).to.be.at.most(labelRects[index]!.left + 0.5);
    }
  });
});

it('gives only the active mark tabindex=0 among multiple roundedBars marks, the rest tabindex=-1', async () => {
  const el = await mount(html`<lr-lite-chart type="bar" rounded-bars .labels=${['a', 'b']} .datasets=${[{ label: 's', data: [1, 2] }]}></lr-lite-chart>`);
  const marks = [...el.shadowRoot!.querySelectorAll('[part="bar"]')] as SVGPathElement[];
  expect(marks).to.have.length(2);
  expect(marks.filter((m) => m.getAttribute('tabindex') === '0')).to.have.length(1);
  expect(marks.filter((m) => m.getAttribute('tabindex') === '-1')).to.have.length(1);
});

// -- appendData / exportData ------------------------------------------------

describe('appendData', () => {
  const chart = (): Promise<LyraLiteChart> =>
    mount(html`<lr-lite-chart .labels=${[...BAR_LABELS]} .datasets=${BAR_DATASETS.map((d) => ({ ...d, data: [...d.data] }))}></lr-lite-chart>`);

  it('appends one category across every series', async () => {
    const el = await chart();
    el.appendData('Thu', [7, 8]);
    await el.updateComplete;
    expect(el.labels).to.deep.equal(['Mon', 'Tue', 'Wed', 'Thu']);
    expect(el.datasets.map((s) => s.data)).to.deep.equal([[1, 2, 3, 7], [4, 5, 6, 8]]);
  });

  it('null-fills a series with no supplied value rather than shifting alignment', async () => {
    const el = await chart();
    el.appendData('Thu', [7]);
    await el.updateComplete;
    expect(el.datasets[1]!.data).to.deep.equal([4, 5, 6, null]);
  });

  it('keeps only the newest categories when maxPoints is set', async () => {
    const el = await chart();
    el.appendData('Thu', [7, 8], 2);
    await el.updateComplete;
    expect(el.labels).to.deep.equal(['Wed', 'Thu']);
    expect(el.datasets.map((s) => s.data)).to.deep.equal([[3, 7], [6, 8]]);
  });

  it('treats a non-finite maxPoints as unbounded', async () => {
    const el = await chart();
    el.appendData('Thu', [7, 8], Number.NaN);
    await el.updateComplete;
    expect(el.labels).to.have.lengthOf(4);
  });
});

describe('exportData', () => {
  const chart = (): Promise<LyraLiteChart> =>
    mount(html`<lr-lite-chart .labels=${[...BAR_LABELS]} .datasets=${BAR_DATASETS.map((d) => ({ ...d, data: [...d.data] }))}></lr-lite-chart>`);

  it('emits CSV with a header row and CRLF line endings', async () => {
    const el = await chart();
    const csv = el.exportData('csv');
    expect(csv.split('\r\n')).to.deep.equal(['label,A,B', 'Mon,1,4', 'Tue,2,5', 'Wed,3,6']);
  });

  it('escapes fields that would otherwise break the CSV grid', async () => {
    const el = await mount(html`<lr-lite-chart
      .labels=${['Q1, 2026']}
      .datasets=${[{ label: 'Say "hi"', data: [1] }]}
    ></lr-lite-chart>`);
    const csv = el.exportData('csv');
    expect(csv).to.include('"Q1, 2026"');
    expect(csv).to.include('"Say ""hi"""');
  });

  it('leaves a gap empty rather than writing undefined', async () => {
    const el = await mount(html`<lr-lite-chart
      .labels=${['Mon', 'Tue']}
      .datasets=${[{ label: 'A', data: [1] }]}
    ></lr-lite-chart>`);
    expect(el.exportData('csv').split('\r\n').at(-1)).to.equal('Tue,');
  });

  it('serializes the rendered SVG for the svg format', async () => {
    const el = await chart();
    const svg = el.exportData('svg');
    expect(svg.startsWith('<svg')).to.be.true;
    expect(svg).to.include('viewBox');
  });

  it('returns an empty string for the svg format when the owner realm has no XMLSerializer constructor', async () => {
    const el = await chart();
    const descriptor = Object.getOwnPropertyDescriptor(window, 'XMLSerializer');
    try {
      Object.defineProperty(window, 'XMLSerializer', { configurable: true, value: undefined });
      expect(el.exportData('svg')).to.equal('');
    } finally {
      if (descriptor) Object.defineProperty(window, 'XMLSerializer', descriptor);
      else delete (window as Window & { XMLSerializer?: typeof XMLSerializer }).XMLSerializer;
    }
  });

  it('serializes SVG with the current owner-document realm after adoption', async () => {
    const el = await chart();
    el.remove();
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameWindow = frame.contentWindow!;
    const ambientDescriptor = Object.getOwnPropertyDescriptor(window, 'XMLSerializer');
    const ownerDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'XMLSerializer');
    const OwnerXMLSerializer = frameWindow.XMLSerializer;
    let ambientConstructions = 0;
    let ownerConstructions = 0;

    try {
      Object.defineProperty(window, 'XMLSerializer', {
        configurable: true,
        value: class AmbientSerializerTrap {
          constructor() {
            ambientConstructions += 1;
            throw new Error('ambient serializer must not handle an adopted chart');
          }
        },
      });
      Object.defineProperty(frameWindow, 'XMLSerializer', {
        configurable: true,
        value: class OwnerSerializer extends OwnerXMLSerializer {
          constructor() {
            super();
            ownerConstructions += 1;
          }
        },
      });
      frame.contentDocument!.body.append(frame.contentDocument!.adoptNode(el));
      await el.updateComplete;

      const exported = el.exportData('svg');
      expect(exported.startsWith('<svg')).to.be.true;
      expect(exported).to.include('viewBox');
      expect(ownerConstructions).to.equal(1);
      expect(ambientConstructions).to.equal(0);
    } finally {
      el.remove();
      if (ambientDescriptor) Object.defineProperty(window, 'XMLSerializer', ambientDescriptor);
      else delete (window as Window & { XMLSerializer?: typeof XMLSerializer }).XMLSerializer;
      if (ownerDescriptor) Object.defineProperty(frameWindow, 'XMLSerializer', ownerDescriptor);
      else delete (frameWindow as Window & { XMLSerializer?: typeof XMLSerializer }).XMLSerializer;
      frame.remove();
    }
  });
});
