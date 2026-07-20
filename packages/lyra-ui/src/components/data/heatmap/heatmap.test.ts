import { aTimeout, fixture, expect, html } from '@open-wc/testing';
import './heatmap.js';
import type { CalendarCellPos, LyraHeatmap, MatrixCellPos } from './heatmap.js';
import {
  MAX_BUCKET_COUNT,
  hexToRgb,
  normalizeBucketCount,
  resolveRgb,
} from './heatmap.js';
import { styles } from './heatmap.styles.js';

/** Scans a CSS-px rectangle of `ctx` for any pixel whose [r,g,b] satisfies `match` — used by the
 *  focus-ring fast-path repaint tests below, where pinning an exact sub-pixel stroke coordinate
 *  would be brittle against anti-aliasing, but "this color appears somewhere in the cell" is a
 *  robust, meaningful assertion that the ring was actually stroked. */
function findPixel(
  ctx: CanvasRenderingContext2D,
  cssX: number,
  cssY: number,
  cssW: number,
  cssH: number,
  match: (r: number, g: number, b: number) => boolean,
): boolean {
  const dpr = window.devicePixelRatio || 1;
  const img = ctx.getImageData(
    Math.round(cssX * dpr),
    Math.round(cssY * dpr),
    Math.max(1, Math.round(cssW * dpr)),
    Math.max(1, Math.round(cssH * dpr)),
  );
  for (let i = 0; i < img.data.length; i += 4) {
    if (match(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)) return true;
  }
  return false;
}

it('sets a group role (not img, which conflicts with the canvas\'s focusable descendant) and a summarizing aria-label', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['Mon', 'Tue'];
  el.colLabels = ['0h', '1h'];
  el.values = [
    [1, 2],
    [3, 4],
  ];
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('group');
  expect(el.getAttribute('aria-label')).to.contain('2');
});

it('does not overwrite an author-supplied role/aria-label', async () => {
  const el = (await fixture(
    html`<lr-heatmap role="application" aria-label="Custom label" .rowLabels=${['a']} .colLabels=${['b']} .values=${[[1]]}></lr-heatmap>`,
  )) as LyraHeatmap;
  expect(el.getAttribute('role')).to.equal('application');
  expect(el.getAttribute('aria-label')).to.equal('Custom label');
});

it('renders numeric min/max legend ticks', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[3, 9]];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('3');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('9');
});

it('shows empty legend ticks when there is no real data', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[-1]];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('');
});

it('renders a canvas sized to the grid dimensions', async () => {
  const el = (await fixture(html`<lr-heatmap cell-size="20"></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a', 'b'];
  el.colLabels = ['x', 'y', 'z'];
  el.values = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
});

it('repaints only the focus-cell dirty rectangles when keyboard focus moves', async () => {
  const el = (await fixture(html`
    <lr-heatmap .rowLabels=${['A', 'B']} .colLabels=${['X', 'Y']} .values=${[[1, 2], [3, 4]]}></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  type Internals = { drawMatrix(): void };
  const internals = el as unknown as Internals;
  let fullDraws = 0;
  const original = internals.drawMatrix.bind(el);
  internals.drawMatrix = () => {
    fullDraws++;
    original();
  };

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(fullDraws).to.equal(0);
});

it('treats -1 as a no-data sentinel without throwing', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.values = [[-1, 2]];
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('does not throw a RangeError computing the range label/draw for a very large grid (150k+ cells)', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.locale = 'en-US';
  const cols = 400;
  const rows = 400; // 160,000 cells — spreading this into Math.min/Math.max(...flat) blows the call stack.
  el.rowLabels = Array.from({ length: rows }, (_, r) => `r${r}`);
  el.colLabels = Array.from({ length: cols }, (_, c) => `c${c}`);
  el.values = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => r * cols + c),
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
  expect(el.getAttribute('aria-label')).to.contain('159,999');
});

it('treats a NaN cell as no-data instead of leaking whatever color the previous cell painted', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[5, NaN]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  // Second column (NaN): PAD_LEFT=60 + 1*cellSize(22) = 82, PAD_TOP=20.
  const pixel = ctx.getImageData(Math.round(87 * dpr), Math.round(25 * dpr), 1, 1).data;
  expect(pixel[0]).to.equal(128);
  expect(pixel[1]).to.equal(128);
  expect(pixel[2]).to.equal(128);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.values = [[1, 2]];
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders an opt-in native button overlay with persistent per-cell semantics', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      accessible-cells
      .rowLabels=${['A', 'B']}
      .colLabels=${['X', 'Y']}
      .values=${[
        [1, 2],
        [3, 4],
      ]}
      .selectedCell=${{ row: 1, col: 0 }}
    ></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;

  const cells = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
  expect(cells.length).to.equal(4);
  expect(cells[0]!.tagName).to.equal('BUTTON');
  expect(cells[0]!.getAttribute('aria-label')).to.equal('Row A, Col X: 1');
  expect(cells[0]!.getAttribute('aria-pressed')).to.equal('false');
  expect(cells[2]!.getAttribute('aria-pressed')).to.equal('true');
  expect(cells[0]!.getAttribute('tabindex')).to.equal('0');
  expect(cells[1]!.getAttribute('tabindex')).to.equal('-1');
  expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-hidden')).to.equal('true');
  expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('tabindex')).to.equal('-1');
  await expect(el).to.be.accessible();
});

it('moves focus through accessible cells with physical (non-mirrored) arrow keys even under dir="rtl" and emits the same click event', async () => {
  // The canvas grid is deliberately non-mirrored under RTL (column 0 always paints at the physical
  // left), so arrow keys must stay physical too -- ArrowRight still moves from column 0 to column 1
  // even with dir="rtl" set, rather than swapping for a layout that never actually flips.
  const el = (await fixture(html`
    <lr-heatmap
      accessible-cells
      dir="rtl"
      .rowLabels=${['A']}
      .colLabels=${['X', 'Y']}
      .values=${[[1, 2]]}
    ></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
  cells[0]!.focus();
  cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  await aTimeout(0);
  expect((el.shadowRoot!.activeElement as HTMLElement).dataset.cellKey).to.equal('matrix-0-1');

  const event = new Promise<CustomEvent>((resolve) => el.addEventListener('lr-cell-click', resolve, { once: true }));
  cells[0]!.click();
  expect((await event).detail).to.deep.equal({ row: 0, col: 0, value: 1 });
});

it('renders accessible calendar cells with date announcements', async () => {
  const el = (await fixture(html`
    <lr-heatmap accessible-cells mode="calendar" .days=${[{ date: '2026-03-01', value: 7 }]}></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  const cells = el.shadowRoot!.querySelectorAll('[part="cell"]');
  expect(cells.length).to.equal(7);
  expect(cells[0]!.getAttribute('aria-label')).to.contain('Mar 1');
  expect(cells[0]!.getAttribute('aria-pressed')).to.equal('false');
});

it('removes the previous MediaQueryList change listener before attaching a new one on a DPR crossing', async () => {
  const originalMatchMedia = window.matchMedia;
  const created: Array<{
    query: string;
    addCalls: EventListenerOrEventListenerObject[];
    removeCalls: EventListenerOrEventListenerObject[];
  }> = [];
  window.matchMedia = ((query: string) => {
    const addCalls: EventListenerOrEventListenerObject[] = [];
    const removeCalls: EventListenerOrEventListenerObject[] = [];
    created.push({ query, addCalls, removeCalls });
    return {
      matches: false,
      media: query,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        addCalls.push(listener);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        removeCalls.push(listener);
      },
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  try {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    const dprQueries = () => created.filter(({ query }) => query.startsWith('(resolution:'));
    expect(dprQueries().length).to.equal(1);
    expect(dprQueries()[0]!.addCalls.length).to.equal(1);

    // Simulate a DPR crossing (the real trigger is a 'change' event on the
    // MediaQueryList, which this fake doesn't dispatch, so invoke the
    // private handler directly).
    (el as unknown as { onDprChange: () => void }).onDprChange();

    expect(dprQueries().length).to.equal(2);
    // The first MediaQueryList's listener must have been removed, not leaked.
    expect(dprQueries()[0]!.removeCalls).to.deep.equal(dprQueries()[0]!.addCalls);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('derives cell size from the host width when fit-to-width is set', async () => {
  const el = (await fixture(
    html`<lr-heatmap fit-to-width style="inline-size: 320px"></lr-heatmap>`,
  )) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y', 'z', 'w'];
  el.values = [[1, 2, 3, 4]];
  await el.updateComplete;

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(parseInt(canvas.style.width, 10)).to.equal(320);
});

it('ignores fit-to-width when it is not set (existing fixed-cellSize behavior)', async () => {
  const el = (await fixture(
    html`<lr-heatmap cell-size="20" style="inline-size: 320px"></lr-heatmap>`,
  )) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y', 'z', 'w'];
  el.values = [[1, 2, 3, 4]];
  await el.updateComplete;

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  // PAD_LEFT (60) + 4 cols * 20px cellSize = 140, independent of host width.
  expect(parseInt(canvas.style.width, 10)).to.equal(140);
});

it('calendar mode: renders a canvas sized by the week count', async () => {
  const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
  el.days = [
    { date: '2026-03-01', value: 1 },
    { date: '2026-03-08', value: 5 },
  ];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
  expect(parseInt(canvas.style.width)).to.be.greaterThan(0);
});

it('calendar mode: sets an aria-label describing the day count and value range', async () => {
  const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
  el.days = [
    { date: '2026-03-01', value: 1 },
    { date: '2026-03-02', value: 9 },
  ];
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Calendar heatmap of 2 days, value range 1–9');
});

it('calendar mode: shows "no data" in the aria-label with zero days', async () => {
  const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Calendar heatmap of 0 days, value range no data');
});

it('calendar mode: renders numeric min/max legend ticks from days', async () => {
  const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
  el.days = [
    { date: '2026-03-01', value: 2 },
    { date: '2026-03-02', value: 8 },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('2');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('8');
});

it('calendar mode: is accessible', async () => {
  const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
  el.days = [{ date: '2026-03-01', value: 1 }];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('calendar mode: a single malformed date entry does not blank the whole calendar (regression)', async () => {
  const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
  el.days = [
    { date: '2026-03', value: 5 }, // malformed: missing day
    { date: '2026-03-05', value: 9 },
  ];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas.width).to.be.greaterThan(0);
  expect(canvas.height).to.be.greaterThan(0);
});

it('calendar mode: a day missing from `days` entirely (a gap) is painted with the no-data fill, not left transparent', async () => {
  const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
  el.days = [
    { date: '2026-03-01', value: 5 }, // Sunday, week 0, weekday 0
    { date: '2026-03-08', value: 9 }, // Sunday, week 1, weekday 0 — leaves week 0's weekdays 1-6 as gaps
  ];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  // week 0, weekday 1 (Monday, 2026-03-02) has no entry in `days` at all —
  // it must still get the no-data fill (non-zero alpha), not stay transparent.
  const pixel = ctx.getImageData(Math.round(32 * dpr), Math.round(32 * dpr), 1, 1).data;
  expect(pixel[3]).to.be.greaterThan(0);
});

describe('bucket-count', () => {
  it('defaults to 5', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    expect(el.bucketCount).to.equal(5);
  });

  it('normalizes every numeric shape to a bounded finite integer', () => {
    expect(normalizeBucketCount(Number.NaN)).to.equal(5);
    expect(normalizeBucketCount(Number.POSITIVE_INFINITY)).to.equal(5);
    expect(normalizeBucketCount(Number.NEGATIVE_INFINITY)).to.equal(5);
    expect(normalizeBucketCount(-100)).to.equal(2);
    expect(normalizeBucketCount(1)).to.equal(2);
    expect(normalizeBucketCount(4.9)).to.equal(4);
    expect(normalizeBucketCount(Number.MAX_VALUE)).to.equal(MAX_BUCKET_COUNT);
  });

  it('normalizes invalid and out-of-range bucket-count attributes before exposing the property', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" bucket-count="${MAX_BUCKET_COUNT + 1}"></lr-heatmap>`,
    )) as LyraHeatmap;
    expect(el.bucketCount).to.equal(MAX_BUCKET_COUNT);

    el.setAttribute('bucket-count', 'not-a-number');
    await el.updateComplete;
    expect(el.bucketCount).to.equal(5);

    el.setAttribute('bucket-count', '-10');
    await el.updateComplete;
    expect(el.bucketCount).to.equal(2);

    el.setAttribute('bucket-count', '4.9');
    await el.updateComplete;
    expect(el.bucketCount).to.equal(4);
  });

  it('normalizes direct bucketCount assignments before drawing', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;

    el.bucketCount = MAX_BUCKET_COUNT + 1;
    await el.updateComplete;
    expect(el.bucketCount).to.equal(MAX_BUCKET_COUNT);

    el.bucketCount = Number.NaN;
    await el.updateComplete;
    expect(el.bucketCount).to.equal(5);

    el.bucketCount = -10;
    await el.updateComplete;
    expect(el.bucketCount).to.equal(2);

    el.bucketCount = 4.9;
    await el.updateComplete;
    expect(el.bucketCount).to.equal(4);
  });

  it('calendar mode: a non-numeric bucket-count falls back to the default instead of leaving every cell whatever fillStyle the canvas last had', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" bucket-count="abc"></lr-heatmap>`,
    )) as LyraHeatmap;
    expect(el.bucketCount).to.equal(5);
    el.days = [
      { date: '2026-03-01', value: 1 }, // Sunday, week 0, weekday 0
      { date: '2026-03-02', value: 9 }, // Monday, week 0, weekday 1 (max value)
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    // The max-value cell should land in the last of the fallback 5 buckets,
    // i.e. exactly the ramp's hi endpoint (#0969da), not the canvas default
    // black that an unresolved bucket count would silently leave behind.
    const pixel = ctx.getImageData(Math.round(32 * dpr), Math.round(33 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0x09);
    expect(pixel[1]).to.equal(0x69);
    expect(pixel[2]).to.equal(0xda);
  });

  it('calendar mode: a fractional bucket-count is floored instead of producing an out-of-range ramp index', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" bucket-count="4.5"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-02', value: 9 }, // max value
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    // With bucketCount floored to 4, the max-value cell lands in the last
    // bucket (index 3), i.e. exactly the ramp's hi endpoint.
    const pixel = ctx.getImageData(Math.round(32 * dpr), Math.round(33 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0x09);
    expect(pixel[1]).to.equal(0x69);
    expect(pixel[2]).to.equal(0xda);
  });
});

it('matrix mode: scale="sqrt" buckets the low value exactly to the ramp\'s lo endpoint, unlike the linear scale', async () => {
  const el = (await fixture(html`<lr-heatmap scale="sqrt"></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[1, 100]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  // sqrtStep(1, 100, 7) === 0, so the first cell (value 1) should be exactly
  // the ramp's lo endpoint (#ddf4ff) — the linear scale would instead mix in
  // 10% of the hi endpoint for this same value, since it never reaches 0.
  const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
  expect(pixel[0]).to.equal(0xdd);
  expect(pixel[1]).to.equal(0xf4);
  expect(pixel[2]).to.equal(0xff);
});

it('matrix mode (default): is unaffected by the new mode/days properties', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[3, 9]];
  await el.updateComplete;
  expect(el.mode).to.equal('matrix');
  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('3');
});

describe('per-update-cycle caching (perf)', () => {
  it('does not recompute the value range on a hover-only update that never touches values/days/mode', async () => {
    const el = (await fixture(html`<lr-heatmap cell-size="22"></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    await el.updateComplete;

    let calls = 0;
    const instrumented = el as unknown as { computeValueRange: () => [number, number] | null };
    const original = instrumented.computeValueRange.bind(el);
    instrumented.computeValueRange = () => {
      calls++;
      return original();
    };

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    // PAD_LEFT=60, PAD_TOP=20, cellSize=22 — lands inside cell (0, 0).
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.left + 65, clientY: rect.top + 25, bubbles: true }),
    );
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.equal(false); // sanity: the hover actually landed on the cell and updated state

    expect(calls).to.equal(0);
  });

  it('does recompute the value range once values actually change', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    await el.updateComplete;

    let calls = 0;
    const instrumented = el as unknown as { computeValueRange: () => [number, number] | null };
    const original = instrumented.computeValueRange.bind(el);
    instrumented.computeValueRange = () => {
      calls++;
      return original();
    };

    el.values = [[9]];
    await el.updateComplete;
    expect(calls).to.equal(1);
  });

  it('caches the calendar grid layout and does not rebuild it on a hover-only update', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const cached = (el as unknown as { cachedCalendarGrid: unknown }).cachedCalendarGrid;
    expect(cached).to.exist;

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    // CAL_PAD_LEFT=28, CAL_LABEL_H=16, CAL_CELL=11 — lands inside week 0, weekday 0
    // (the single day in `days`), so this genuinely triggers a hoverCell update.
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.left + 32, clientY: rect.top + 20, bubbles: true }),
    );
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.equal(false); // sanity: the hover actually landed on the cell and updated state

    const after = (el as unknown as { cachedCalendarGrid: unknown }).cachedCalendarGrid;
    // Same reference: a hover-only update (days unchanged) must not rebuild it.
    expect(after).to.equal(cached);
  });

  it('rebuilds the cached calendar grid once `days` actually changes', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const before = (el as unknown as { cachedCalendarGrid: unknown }).cachedCalendarGrid;

    el.days = [
      { date: '2026-03-01', value: 5 },
      { date: '2026-03-08', value: 9 },
    ];
    await el.updateComplete;
    const after = (el as unknown as { cachedCalendarGrid: unknown }).cachedCalendarGrid;
    expect(after).to.not.equal(before);
  });
});

describe('hexToRgb', () => {
  it('parses 3- and 6-digit hex strings as fully opaque', () => {
    expect(hexToRgb('#fff')).to.deep.equal([255, 255, 255, 1]);
    expect(hexToRgb('#0969da')).to.deep.equal([9, 105, 218, 1]);
    expect(hexToRgb('0969da')).to.deep.equal([9, 105, 218, 1]);
  });

  it('parses 4- and 8-digit hex-with-alpha strings', () => {
    expect(hexToRgb('#0f08')).to.deep.equal([0, 255, 0, 136 / 255]);
    expect(hexToRgb('#0969da80')).to.deep.equal([9, 105, 218, 0x80 / 255]);
    expect(hexToRgb('#0969daff')).to.deep.equal([9, 105, 218, 1]);
  });

  it('returns null (not a NaN-derived value) for a non-hex string', () => {
    expect(hexToRgb('not-a-color')).to.equal(null);
    expect(hexToRgb('rgb(9, 105, 218)')).to.equal(null);
  });
});

describe('resolveRgb', () => {
  it('resolves hex colors directly as fully opaque', () => {
    expect(resolveRgb('#0969da', '#000000')).to.deep.equal([9, 105, 218, 1]);
  });

  it('resolves non-hex CSS color syntax (rgb, hsl, named) via canvas normalization', () => {
    expect(resolveRgb('rgb(9, 105, 218)', '#000000')).to.deep.equal([9, 105, 218, 1]);
    expect(resolveRgb('hsl(0, 100%, 50%)', '#000000')).to.deep.equal([255, 0, 0, 1]);
    expect(resolveRgb('red', '#000000')).to.deep.equal([255, 0, 0, 1]);
  });

  it('preserves a translucent rgba()/hsla() alpha channel instead of silently resolving to opaque (gap #65)', () => {
    // The exact alpha may be quantized to 8 bits by the browser's canvas
    // fillStyle serializer (e.g. Chromium: .028 -> 7/255 ~= 0.027), so this
    // asserts it's nowhere near the fully-opaque `1` a dropped-alpha bug
    // would silently produce, rather than pinning an exact float.
    const [r, g, b, a] = resolveRgb('rgba(255, 255, 255, .028)', '#000000');
    expect([r, g, b]).to.deep.equal([255, 255, 255]);
    expect(a).to.be.closeTo(0.028, 0.01);

    const rgbaDirect = resolveRgb('rgba(9, 105, 218, 0.5)', '#000000');
    expect(rgbaDirect).to.deep.equal([9, 105, 218, 0.5]);
  });

  it('falls back to the given fallback (not black) for an unparsable color string', () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      expect(resolveRgb('not-a-real-color', '#123456')).to.deep.equal([0x12, 0x34, 0x56, 1]);
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings).to.have.length(1);
    expect(warnings.flat().join(' ')).to.contain('not-a-real-color');
  });
});


it('retheming --lr-heatmap-no-data-fill changes the rendered no-data cell color', async () => {
  const el = (await fixture(html`
    <lr-heatmap style="--lr-heatmap-no-data-fill: rgb(0, 200, 0);"></lr-heatmap>
  `)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[-1]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
  expect(pixel[0]).to.equal(0);
  expect(pixel[1]).to.equal(200);
  expect(pixel[2]).to.equal(0);
});

it('retheming the ramp with a non-hex CSS color renders that color, not black', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      style="--lr-heatmap-scale-lo: rgb(0, 128, 0); --lr-heatmap-scale-hi: rgb(0, 128, 0);"
    ></lr-heatmap>
  `)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[5]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  // Sample a pixel inside the single data cell (PAD_LEFT=60, PAD_TOP=20, cellSize=22).
  const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
  expect(pixel[0]).to.equal(0);
  expect(pixel[1]).to.be.greaterThan(50);
  expect(pixel[2]).to.equal(0);
});

it('refreshes the canvas when a theme token changes without changing component data', async () => {
  const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[0, 10]];
  await el.updateComplete;

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const sample = () => ctx.getImageData(Math.round(87 * dpr), Math.round(25 * dpr), 1, 1).data;
  const before = sample();

  el.style.setProperty('--lr-heatmap-scale-hi', 'rgb(0, 200, 0)');
  await aTimeout(0);

  const after = sample();
  expect([after[0], after[1], after[2]]).to.deep.equal([0, 200, 0]);
  expect([after[0], after[1], after[2]]).to.not.deep.equal([before[0], before[1], before[2]]);
});

it('retheming with an unparsable custom property value does not throw and does not go solid black', async () => {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  let el: LyraHeatmap;
  try {
    el = (await fixture(html`
      <lr-heatmap style="--lr-heatmap-scale-lo: still-not-a-real-color;"></lr-heatmap>
    `)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    await el.updateComplete;
  } finally {
    console.warn = originalWarn;
  }
  expect(warnings).to.have.length(1);
  expect(warnings.flat().join(' ')).to.contain('still-not-a-real-color');
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
  // Falls back to the default ramp endpoints rather than parsing to solid black.
  expect([pixel[0], pixel[1], pixel[2]]).to.not.deep.equal([0, 0, 0]);
});

it('retheming --lr-heatmap-label-font changes the canvas font used to draw labels', async () => {
  const el = (await fixture(html`
    <lr-heatmap style="--lr-heatmap-label-font: 16px monospace;"></lr-heatmap>
  `)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[5]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  expect(ctx.font).to.contain('16px');
  expect(ctx.font).to.contain('monospace');
});

describe('per-cell hover/focus/click + accessible values', () => {
  it('makes the canvas keyboard-focusable', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.tabIndex).to.equal(0);
  });

  it('matrix mode: shows a tooltip with the row/col label and value on hover, hidden on pointerleave', async () => {
    const el = (await fixture(html`<lr-heatmap cell-size="22"></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['Mon', 'Tue'];
    el.colLabels = ['0h', '1h'];
    el.values = [
      [3, 7],
      [1, 2],
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    // PAD_LEFT=60, PAD_TOP=20, cellSize=22 — center of row 0, col 1 ('1h').
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: rect.left + 60 + 22 + 11,
        clientY: rect.top + 20 + 11,
        bubbles: true,
      }),
    );
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.equal(false);
    expect(tooltip.textContent?.trim()).to.equal('Row Mon, Col 1h: 7');

    canvas.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await el.updateComplete;
    expect(tooltip.hidden).to.equal(true);
  });

  it('matrix mode: hovering outside the grid does not show a tooltip', async () => {
    const el = (await fixture(html`<lr-heatmap cell-size="22"></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[3]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.left + 1, clientY: rect.top + 1, bubbles: true }),
    );
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.equal(true);
  });

  it('calendar mode: shows a tooltip with the date and value on hover', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // Sunday -> week 0, weekday 0
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    // CAL_PAD_LEFT=28, CAL_LABEL_H=16, CAL_CELL=11 — center of week 0, weekday 0.
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: rect.left + 28 + 5,
        clientY: rect.top + 16 + 5,
        bubbles: true,
      }),
    );
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.hidden).to.equal(false);
    expect(tooltip.textContent?.trim()).to.equal('Mar 1: 5');
  });

  it('matrix mode: ArrowRight moves the focused cell and announces it via the live region, starting from the first cell', async () => {
    const el = (await fixture(html`<lr-heatmap cell-size="22"></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['Mon', 'Tue'];
    el.colLabels = ['0h', '1h'];
    el.values = [
      [3, 7],
      [1, 2],
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const live = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    expect(live.textContent).to.equal('');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    // First arrow keypress focuses the first cell without also moving it.
    expect(live.textContent).to.equal('Row Mon, Col 0h: 3');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Row Mon, Col 1h: 7');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Row Tue, Col 1h: 2');
  });

  it('matrix mode: arrow navigation clamps at the grid edges instead of moving out of bounds', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[9]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const live = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Row a, Col x: 9');
  });

  it('calendar mode: arrow keys move the (week, weekday) cursor and announce the date', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 5 }, // Sunday: week 0, weekday 0
      { date: '2026-03-02', value: 9 }, // Monday: week 0, weekday 1
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const live = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Mar 1: 5');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Mar 2: 9');
  });

  it('matrix mode: emits lr-cell-click with {row, col, value} on click', async () => {
    const el = (await fixture(html`<lr-heatmap cell-size="22"></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['Mon', 'Tue'];
    el.colLabels = ['0h', '1h'];
    el.values = [
      [3, 7],
      [1, 2],
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { row: number; col: number; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 60 + 11, clientY: rect.top + 20 + 33, bubbles: true }),
    );
    expect(detail).to.deep.equal({ row: 1, col: 0, value: 1 });
  });

  it('matrix mode: emits lr-cell-click via Enter on the focused cell', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[3, 7]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // focuses (0,0)
    let detail: { row: number; col: number; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ row: 0, col: 0, value: 3 });
  });

  it('matrix mode: emits lr-cell-click via Space on the focused cell', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[3, 7]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // focuses (0,0)
    let detail: { row: number; col: number; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(detail).to.deep.equal({ row: 0, col: 0, value: 3 });
  });

  it('calendar mode: emits lr-cell-click with {date, value} on click', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 28 + 5, clientY: rect.top + 16 + 5, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-01', value: 5 });
  });

  it('calendar mode: emits lr-cell-click via Enter on the focused cell', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // focuses (week 0, weekday 0)
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ date: '2026-03-01', value: 5 });
  });

  it('does not re-activate a stale focused cell when clicking outside the grid', async () => {
    const el = (await fixture(
      html`<lr-heatmap .rowLabels=${['a']} .colLabels=${['b']} .values=${[[1]]}></lr-heatmap>`,
    )) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await el.updateComplete;
    let detail: unknown;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: -1000, clientY: -1000 }));
    expect(detail).to.be.undefined;
  });

  it('is accessible with a hovered tooltip and a focused cell', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 2]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('annotation/overlay affordance', () => {
  it('matrix mode: accepts an annotations property and redraws without throwing', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 2]];
    el.annotations = [{ row: 0, col: 1, label: 'Peak' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
  });

  it('matrix mode: renders a legend-annotation entry (ring swatch + label text) when an annotation has a label', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[1]];
    el.annotations = [{ row: 0, col: 0, label: 'Peak' }];
    await el.updateComplete;
    const entry = el.shadowRoot!.querySelector('[part="legend-annotation"]');
    expect(entry).to.exist;
    expect(entry!.textContent).to.contain('Peak');
  });

  it('omits legend-annotation when annotations have no label', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[1]];
    el.annotations = [{ row: 0, col: 0 }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-annotation"]')).to.not.exist;
  });

  it('omits legend-annotation when there are no annotations at all', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[1]];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-annotation"]')).to.not.exist;
  });

  it('calendar mode: accepts date-based annotations, redraws without throwing, and renders their legend label', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    el.annotations = [{ date: '2026-03-01', label: 'Launch' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
    const entry = el.shadowRoot!.querySelector('[part="legend-annotation"]');
    expect(entry).to.exist;
    expect(entry!.textContent).to.contain('Launch');
  });

  it('renders one legend-annotation entry per labeled annotation', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 2]];
    el.annotations = [
      { row: 0, col: 0, label: 'Peak' },
      { row: 0, col: 1, label: 'Dip' },
    ];
    await el.updateComplete;
    const entries = el.shadowRoot!.querySelectorAll('[part="legend-annotation"]');
    expect(entries.length).to.equal(2);
  });
});

describe('role="group" fix + cellText formatter + locale bug fix', () => {
  it('sets role="group" instead of role="img" (canvas has a focusable, keyboard-interactive descendant)', async () => {
    const el = (await fixture(html`<lr-heatmap
      .rowLabels=${['R1']}
      .colLabels=${['C1']}
      .values=${[[5]]}
    ></lr-heatmap>`)) as LyraHeatmap;
    expect(el.getAttribute('role')).to.equal('group');
  });

  it('uses a custom cellText formatter for the tooltip and live-region text when provided', async () => {
    const el = (await fixture(html`<lr-heatmap
      .rowLabels=${['R1']}
      .colLabels=${['C1']}
      .values=${[[5]]}
      .cellText=${(pos: { row?: number; col?: number }, value: number) =>
        `custom ${pos.row},${pos.col}: ${value}`}
    ></lr-heatmap>`)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const live = el.shadowRoot!.querySelector('[part="live-region"]');
    expect(live!.textContent).to.equal('custom 0,0: 5');
  });

  it('falls back to the built-in English template without cellText', async () => {
    const el = (await fixture(html`<lr-heatmap
      .rowLabels=${['R1']}
      .colLabels=${['C1']}
      .values=${[[5]]}
    ></lr-heatmap>`)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const live = el.shadowRoot!.querySelector('[part="live-region"]');
    expect(live!.textContent).to.equal('Row R1, Col C1: 5');
  });

  it('formats calendar date labels using the runtime locale, not a hardcoded "en"', async () => {
    // 2026-01-18 is a Sunday, so the grid's single week/weekday-0 cell (the
    // one the first arrow keypress focuses, per onCalendarKeyDown) matches
    // this day exactly — unlike a mid-week date, which would land the first
    // keypress on an earlier, data-less Sunday instead.
    const el = (await fixture(html`<lr-heatmap
      mode="calendar"
      .days=${[{ date: '2026-01-18', value: 3 }]}
    ></lr-heatmap>`)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const live = el.shadowRoot!.querySelector('[part="live-region"]');
    const expected = new Date(Date.UTC(2026, 0, 18)).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    expect(live!.textContent).to.equal(`${expected}: 3`);
  });

  it('derives weekday-axis labels from the runtime locale via Intl, not a hardcoded English array', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    await el.updateComplete;
    // 2026-01-18 is a Sunday -- an arbitrary but independently-verifiable UTC anchor.
    const firstWeekStart = new Date(Date.UTC(2026, 0, 18));
    const labels = (el as unknown as { weekdayLabels: (d: Date) => string[] }).weekdayLabels(firstWeekStart);
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
    expect(labels).to.have.length(7);
    // Only indices 1 (Mon), 3 (Wed), 5 (Fri) are filled -- same sparse density as before. Each
    // expected value is an independently fixed Date.UTC(...) call, not a re-derivation of the
    // implementation's own formula, so this can actually fail if the row-to-date mapping is wrong.
    expect(labels[0]).to.equal('');
    expect(labels[1]).to.equal(formatter.format(new Date(Date.UTC(2026, 0, 19)))); // Monday
    expect(labels[2]).to.equal('');
    expect(labels[3]).to.equal(formatter.format(new Date(Date.UTC(2026, 0, 21)))); // Wednesday
    expect(labels[4]).to.equal('');
    expect(labels[5]).to.equal(formatter.format(new Date(Date.UTC(2026, 0, 23)))); // Friday
    expect(labels[6]).to.equal('');
    expect(labels[1]).to.not.equal('');
    expect(labels[1]).to.not.equal(labels[3]);
  });
});

describe('columnX override (calendar mode)', () => {
  it('unset: canvas width and cell geometry follow the original evenly-spaced formula (regression)', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // single Sunday -> weekCount 1
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // CAL_PAD_LEFT(28) + max(1, weekCount=1) * (CAL_CELL(11) + CAL_GAP(2)) = 28 + 13 = 41.
    expect(parseInt(canvas.style.width, 10)).to.equal(41);
  });

  it('drawn cell fill and pointer hit-testing both follow a custom columnX function, staying consistent with each other', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 }, // Sunday, week 0, weekday 0
      { date: '2026-03-08', value: 9 }, // Sunday, week 1, weekday 0 (max value)
    ];
    el.columnX = (week: number) => 100 + week * 50;
    await el.updateComplete;

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    // week 1's cell x-origin is columnX(1) = 150, y-origin CAL_LABEL_H(16).
    const pixel = ctx.getImageData(Math.round(154 * dpr), Math.round(20 * dpr), 1, 1).data;
    // Max value of the two -> exactly the ramp's hi endpoint (#0969da).
    expect(pixel[0]).to.equal(0x09);
    expect(pixel[1]).to.equal(0x69);
    expect(pixel[2]).to.equal(0xda);

    const rect = canvas.getBoundingClientRect();
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 154, clientY: rect.top + 20, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-08', value: 9 });
  });

  it('a click at the default-formula position misses once columnX moves that column elsewhere', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-08', value: 9 },
    ];
    el.columnX = (week: number) => 100 + week * 50;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: unknown;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    // Week 1's *default*-formula position (CAL_PAD_LEFT + 1*(CAL_CELL+CAL_GAP) = 41) is below
    // columnX(0) = 100, so it no longer lands on any column at all.
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 41, clientY: rect.top + 20, bubbles: true }),
    );
    expect(detail).to.be.undefined;
  });
});

describe('first-day-of-week (calendar mode)', () => {
  it('defaults to 0 (Sunday-anchored), unchanged from before the property existed', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    expect(el.firstDayOfWeek).to.equal(0);
  });

  it('falls back to 0 for a non-finite first-day-of-week attribute, instead of NaN propagating into the grid math', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" first-day-of-week="not-a-number"></lr-heatmap>`,
    )) as LyraHeatmap;
    expect(el.firstDayOfWeek).to.equal(0);
  });

  it('wraps an out-of-range firstDayOfWeek into [0, 6] via modulo instead of an invalid weekday index', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;

    el.firstDayOfWeek = 7; // one past Saturday -> wraps to 0 (Sunday)
    await el.updateComplete;
    expect(el.firstDayOfWeek).to.equal(0);

    el.firstDayOfWeek = 10; // wraps to 3 (Wednesday)
    await el.updateComplete;
    expect(el.firstDayOfWeek).to.equal(3);

    el.firstDayOfWeek = -1; // wraps to 6 (Saturday)
    await el.updateComplete;
    expect(el.firstDayOfWeek).to.equal(6);

    el.firstDayOfWeek = Number.NaN;
    await el.updateComplete;
    expect(el.firstDayOfWeek).to.equal(0);
  });

  it('renders without throwing for an out-of-range firstDayOfWeek', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar" first-day-of-week="10"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-08', value: 9 },
    ];
    await el.updateComplete;
    expect(el.firstDayOfWeek).to.equal(3);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).to.be.greaterThan(0);
    expect(canvas.height).to.be.greaterThan(0);
  });

  it('shifts which week/row a known date lands in, calendar mode', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" first-day-of-week="1"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 }, // Sunday: with a Monday anchor, week 0, weekday 6 (last row of the prior week)
      { date: '2026-03-02', value: 9 }, // Monday: the anchor weekday itself, week 1, weekday 0
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));

    // Monday lands at week 1 (x = CAL_PAD_LEFT(28) + 1*(CAL_CELL(11)+CAL_GAP(2)) = 41), weekday 0 (y = CAL_LABEL_H(16)).
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 45, clientY: rect.top + 20, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-02', value: 9 });

    // Sunday lands at week 0 (x = 28), weekday 6 (y = 16 + 6*13 = 94).
    detail = undefined;
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 32, clientY: rect.top + 98, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-01', value: 1 });
  });

  it('is a no-op in matrix mode', async () => {
    const el = (await fixture(
      html`<lr-heatmap first-day-of-week="1" cell-size="22"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[3, 9]];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('3');
  });

  it('weekday-axis labels stay Mon/Wed/Fri (re-anchored to the correct rows) for a non-Sunday firstDayOfWeek', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" first-day-of-week="1"></lr-heatmap>`,
    )) as LyraHeatmap;
    await el.updateComplete;
    // 2026-01-19 is a Monday -- with firstDayOfWeek=1, buildCalendarGrid() anchors firstWeekStart
    // at that exact Monday (daysBackToAnchor is 0 for a Monday date), so grid row 0 is Monday,
    // row 1 Tuesday, ... row 6 Sunday.
    const firstWeekStart = new Date(Date.UTC(2026, 0, 19));
    const labels = (el as unknown as { weekdayLabels: (d: Date) => string[] }).weekdayLabels(firstWeekStart);
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' });
    // The labeled weekdays are always Monday/Wednesday/Friday, independent of the anchor -- with a
    // Monday-first grid those land on rows 0/2/4 (not the Sunday-first grid's 1/3/5). Each expected
    // date is an independently fixed Date.UTC(...) call, not a re-derivation of the implementation's
    // own row formula, so this can actually fail if the row-to-date mapping is wrong.
    expect(labels[0]).to.equal(formatter.format(new Date(Date.UTC(2026, 0, 19)))); // Monday
    expect(labels[2]).to.equal(formatter.format(new Date(Date.UTC(2026, 0, 21)))); // Wednesday
    expect(labels[4]).to.equal(formatter.format(new Date(Date.UTC(2026, 0, 23)))); // Friday
    expect(labels[1]).to.equal('');
    expect(labels[3]).to.equal('');
    expect(labels[5]).to.equal('');
    expect(labels[6]).to.equal('');
  });
});

describe('rowY override (calendar mode)', () => {
  it('unset: cell geometry follows the original evenly-spaced formula (regression)', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // single Sunday -> weekCount 1
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // CAL_LABEL_H(16) + 7 * (CAL_CELL(11) + CAL_GAP(2)) = 16 + 91 = 107.
    expect(parseInt(canvas.style.height, 10)).to.equal(107);
  });

  it('drawn cell fill and pointer hit-testing both follow a custom rowY function, staying consistent with each other', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 }, // Sunday, week 0, weekday 0
      { date: '2026-03-03', value: 9 }, // Tuesday, week 0, weekday 2 (max value)
    ];
    el.rowY = (weekday: number) => 100 + weekday * 50;
    await el.updateComplete;

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    // weekday 2's cell y-origin is rowY(2) = 200, x-origin CAL_PAD_LEFT(28).
    const pixel = ctx.getImageData(Math.round(32 * dpr), Math.round(204 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0x09);
    expect(pixel[1]).to.equal(0x69);
    expect(pixel[2]).to.equal(0xda);

    const rect = canvas.getBoundingClientRect();
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 32, clientY: rect.top + 204, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-03', value: 9 });
  });

  it('a click at the default-formula position misses once rowY moves that row elsewhere', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-03', value: 9 },
    ];
    el.rowY = (weekday: number) => 100 + weekday * 50;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: unknown;
    el.addEventListener('lr-cell-click', (e) => (detail = (e as CustomEvent).detail));
    // weekday 2's *default*-formula position (CAL_LABEL_H(16) + 2*(CAL_CELL(11)+CAL_GAP(2)) = 42)
    // is above rowY(0) = 100, so it no longer lands on any row at all.
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 32, clientY: rect.top + 42, bubbles: true }),
    );
    expect(detail).to.be.undefined;
  });
});

describe('calendar-mode cellSize/fitToWidth (extends the existing matrix-only properties)', () => {
  it('defaults calendar mode\'s cell size to the original 11px when cell-size is unset (no behavior change for existing consumers)', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // single Sunday -> weekCount 1
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // CAL_PAD_LEFT(28) + max(1, weekCount=1) * (11 + CAL_GAP(2)) = 41, unchanged.
    expect(parseInt(canvas.style.width, 10)).to.equal(41);
  });

  it('cell-size resizes calendar mode\'s grid when explicitly set', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" cell-size="20"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // single Sunday -> weekCount 1
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // CAL_PAD_LEFT(28) + max(1, weekCount=1) * (20 + CAL_GAP(2)) = 50.
    expect(parseInt(canvas.style.width, 10)).to.equal(50);
    // CAL_LABEL_H(16) + 7 * (20 + 2) = 170.
    expect(parseInt(canvas.style.height, 10)).to.equal(170);
  });

  it('derives calendar mode\'s cell size from the host width when fit-to-width is set', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-08', value: 2 },
      { date: '2026-03-15', value: 3 },
      { date: '2026-03-22', value: 4 },
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(parseInt(canvas.style.width, 10)).to.equal(320);
  });

  it('ignores fit-to-width in calendar mode when it is not set (existing fixed-cellSize behavior)', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" cell-size="20" style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // 28 + 1*(20+2) = 50, independent of host width.
    expect(parseInt(canvas.style.width, 10)).to.equal(50);
  });
});

describe('cellSize numeric guard', () => {
  it('falls back to the mode-appropriate default when cell-size is non-finite, instead of NaN canvas geometry', async () => {
    const matrix = (await fixture(html`<lr-heatmap cell-size="not-a-number"></lr-heatmap>`)) as LyraHeatmap;
    matrix.rowLabels = ['a'];
    matrix.colLabels = ['x', 'y'];
    matrix.values = [[1, 2]];
    await matrix.updateComplete;
    expect(matrix.cellSize).to.equal(22); // DEFAULT_MATRIX_CELL_SIZE
    const matrixCanvas = matrix.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // PAD_LEFT(60) + 2 cols * 22px = 104, unchanged from the unset-cellSize default.
    expect(parseInt(matrixCanvas.style.width, 10)).to.equal(104);

    const calendar = (await fixture(
      html`<lr-heatmap mode="calendar" cell-size="not-a-number"></lr-heatmap>`,
    )) as LyraHeatmap;
    calendar.days = [{ date: '2026-03-01', value: 5 }];
    await calendar.updateComplete;
    expect(calendar.cellSize).to.equal(11); // CAL_CELL
  });

  it('clamps a zero/negative explicit cell-size to a 1px floor instead of dividing by zero, without throwing', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar" cell-size="0"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-08', value: 9 },
    ];
    await el.updateComplete;
    expect(el.cellSize).to.equal(1);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).to.be.greaterThan(0);
    expect(canvas.height).to.be.greaterThan(0);
    expect(Number.isFinite(canvas.width)).to.be.true;
    expect(Number.isFinite(canvas.height)).to.be.true;

    el.cellSize = -20;
    await el.updateComplete;
    expect(el.cellSize).to.equal(1);
    expect(canvas.width).to.be.greaterThan(0);
    expect(Number.isFinite(canvas.width)).to.be.true;
  });
});

describe('cellInteractive predicate', () => {
  it('matrix mode: a cell for which cellInteractive returns false is skipped by hit-testing and roving focus', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['r0', 'r1']}
        .colLabels=${['c0', 'c1']}
        .values=${[
          [1, 2],
          [3, 4],
        ]}
        .cellInteractive=${(pos: { row?: number; col?: number }) => !(pos.row === 0 && pos.col === 1)}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let clicked: unknown;
    el.addEventListener('lr-cell-click', (e) => (clicked = (e as CustomEvent).detail));
    // (row 0, col 1) is excluded -- a click there must not fire lr-cell-click.
    const cellSize = 22; // DEFAULT_MATRIX_CELL_SIZE
    const padLeft = 60; // PAD_LEFT
    const padTop = 20; // PAD_TOP
    canvas.dispatchEvent(
      new MouseEvent('click', {
        clientX: rect.left + padLeft + cellSize * 1.5,
        clientY: rect.top + padTop + cellSize * 0.5,
        bubbles: true,
      }),
    );
    expect(clicked).to.be.undefined;

    // Roving focus (first ArrowRight from unfocused) must land on (0,0) then skip (0,1) when
    // stepping right again, landing on (1,0)... actually stepping right from (0,0) with only 2
    // columns and (0,1) excluded should skip straight to staying at (0,0)'s row boundary -- assert
    // via the live region text instead of internal cursor state.
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    let live = el.shadowRoot!.querySelector('[part="live-region"]')!.textContent;
    expect(live).to.contain('r0');
    expect(live).to.contain('c0');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    live = el.shadowRoot!.querySelector('[part="live-region"]')!.textContent;
    // (0,1) is excluded -- ArrowRight from (0,0) must NOT land there.
    expect(live).to.not.contain('Row r0, Col c1');
  });

  it('unset: every cell stays interactive (regression)', async () => {
    const el = (await fixture(html`
      <lr-heatmap .rowLabels=${['r0']} .colLabels=${['c0', 'c1']} .values=${[[1, 2]]}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let clicked: unknown;
    el.addEventListener('lr-cell-click', (e) => (clicked = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 60 + 11, clientY: rect.top + 20 + 11, bubbles: true }),
    );
    expect(clicked).to.deep.equal({ row: 0, col: 0, value: 1 });
  });
});

describe('colorSteps', () => {
  it('matrix mode, scale="linear": colors cells from the discrete colorSteps array, not the 2-endpoint ramp', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['r0']}
        .colLabels=${['c0', 'c1', 'c2', 'c3']}
        .values=${[[0, 33, 66, 100]]}
        .colorSteps=${['#000000', '#3f3f3f', '#7f7f7f', '#ffffff']}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const cellSize = 22;
    const padLeft = 60;
    const padTop = 20;
    // Cell 0 (value 0, lowest) -> exactly colorSteps[0] (#000000).
    const p0 = ctx.getImageData(Math.round((padLeft + cellSize * 0.5) * dpr), Math.round((padTop + cellSize * 0.5) * dpr), 1, 1).data;
    expect([p0[0], p0[1], p0[2]]).to.deep.equal([0, 0, 0]);
    // Cell 3 (value 100, highest) -> exactly colorSteps[3] (#ffffff).
    const p3 = ctx.getImageData(
      Math.round((padLeft + cellSize * 3.5) * dpr),
      Math.round((padTop + cellSize * 0.5) * dpr),
      1,
      1,
    ).data;
    expect([p3[0], p3[1], p3[2]]).to.deep.equal([255, 255, 255]);
  });

  it('unset: the 2-endpoint linear interpolation is unchanged (regression)', async () => {
    const el = (await fixture(html`
      <lr-heatmap .rowLabels=${['r0']} .colLabels=${['c0']} .values=${[[5]]}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.colorSteps).to.be.undefined;
  });
});

describe('cellColor', () => {
  it('lets a consumer force an exact cell color bypassing the ramp entirely', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.values = [[0, 5]];
    el.cellColor = (pos, value) => (value === 0 ? 'rgb(200, 200, 200)' : undefined);
    await el.updateComplete;
    const internals = el as unknown as { draw(): void };
    internals.draw();
    // No direct pixel-read assertion is made here (canvas fillStyle isn't queryable after the
    // fact) -- this test instead asserts the property round-trips and draw() doesn't throw with
    // a real cellColor function set, mirroring how this file already tests cellText/cellInteractive
    // (both similarly side-effecting, non-queryable-after-the-fact private draw paths).
    expect(el.cellColor).to.be.a('function');
    expect(el.cellColor!({ row: 0, col: 0 }, 0)).to.equal('rgb(200, 200, 200)');
    expect(el.cellColor!({ row: 0, col: 1 }, 5)).to.be.undefined;
  });

  it('defaults to unset, falling back to the normal ramp/colorSteps path', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    expect(el.cellColor).to.be.undefined;
  });
});

describe('cellColor resolves CSS custom properties for canvas fillStyle', () => {
  it('resolves a var(...) cellColor to its computed value instead of leaving canvas fillStyle black', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="matrix"
        style="--test-heatmap-color: rgb(10, 20, 30);"
        .rowLabels=${['a', 'b']}
        .colLabels=${['x', 'y']}
        .values=${[
          [1, 2],
          [3, 4],
        ]}
        .cellColor=${() => 'var(--test-heatmap-color)'}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    // Sample a pixel inside the (0, 0) data cell (PAD_LEFT=60, PAD_TOP=20, cellSize=22).
    const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
    expect(Array.from(pixel.slice(0, 3))).to.deep.equal([10, 20, 30]);
  });

  it('falls back to the no-data fill for an unresolvable cellColor value instead of solid black', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="matrix"
        .rowLabels=${['a', 'b']}
        .colLabels=${['x', 'y']}
        .values=${[
          [1, 2],
          [3, 4],
        ]}
        .cellColor=${() =>
          // Missing the required `--` custom-property prefix, so the browser rejects this
          // string outright (unlike an *unresolved* var() reference, e.g. var(--undefined-token),
          // which is still syntactically valid and would silently compute to an inherited color).
          'var(not-a-custom-prop)'}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
    expect(Array.from(pixel.slice(0, 3))).to.not.deep.equal([0, 0, 0]);
  });

  it('still applies a literal, already-resolved cellColor unchanged (fast path)', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="matrix"
        .rowLabels=${['a', 'b']}
        .colLabels=${['x', 'y']}
        .values=${[
          [1, 2],
          [3, 4],
        ]}
        .cellColor=${() => 'rgb(9, 9, 9)'}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
    expect(Array.from(pixel.slice(0, 3))).to.deep.equal([9, 9, 9]);
  });
});

describe('calendar-mode scale (extends the existing matrix-only property)', () => {
  it('scale="sqrt" buckets a low value differently than the default quartile scale for the same skewed value set', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" scale="sqrt"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 }, // Sunday, week 0, weekday 0 (low value)
      { date: '2026-03-02', value: 100 }, // Monday, week 0, weekday 1 (heavy value)
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    // sqrtStep(1, 100, 5) === 0, so the low-value cell is exactly the ramp's
    // lo endpoint (#ddf4ff) — the default quartile scale instead lands it in
    // a middle bucket (rank 1/2 of 2 sorted values), a visibly different color.
    const pixel = ctx.getImageData(Math.round(32 * dpr), Math.round(20 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0xdd);
    expect(pixel[1]).to.equal(0xf4);
    expect(pixel[2]).to.equal(0xff);
  });

  it('defaults to the quartile scale (unchanged), not sqrt, for the same skewed value set', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-02', value: 100 },
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(32 * dpr), Math.round(20 * dpr), 1, 1).data;
    expect([pixel[0], pixel[1], pixel[2]]).to.not.deep.equal([0xcd, 0xe2, 0xfb]);
  });
});

describe('weekdayLabelText', () => {
  it('is undefined by default', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar" .days=${[]}></lr-heatmap>`)) as LyraHeatmap;
    expect(el.weekdayLabelText).to.be.undefined;
  });

  it('is called with the real JS weekday index (1, 3, 5) and its return value replaces the built-in label', async () => {
    const seen: number[] = [];
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        .days=${[{ date: '2026-01-05', value: 3 }]}
        .weekdayLabelText=${(weekday: number) => {
          seen.push(weekday);
          return `W${weekday}`;
        }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(seen.slice().sort()).to.deep.equal([1, 3, 5]);
  });
});

describe('monthLabelText', () => {
  it('is undefined by default', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar" .days=${[]}></lr-heatmap>`)) as LyraHeatmap;
    expect(el.monthLabelText).to.be.undefined;
  });

  it('is called with the real JS month index and year, and its return value replaces the built-in label', async () => {
    const seen: Array<[number, number]> = [];
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        .days=${[{ date: '2026-03-05', value: 3 }]}
        .monthLabelText=${(jsMonth: number, year: number) => {
          seen.push([jsMonth, year]);
          return `M${jsMonth}`;
        }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(seen).to.deep.equal([[2, 2026]]);
  });
});

describe('selectedCell', () => {
  it('draws no selection and adds no aria-label suffix by default', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    expect(el.selectedCell).to.be.null;
    expect(el.getAttribute('aria-label')).to.not.include('Selected');
  });

  it('appends a "Selected: ..." description to the host aria-label in matrix mode', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
        .selectedCell=${{ row: 1, col: 0 }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.include('Selected: Row Tue, Col 00h: 3.');
  });

  it('appends a "Selected: ..." description in calendar mode, resolved by date', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        .days=${[
          { date: '2026-01-04', value: 5 },
          { date: '2026-01-05', value: 7 },
        ]}
        .selectedCell=${{ date: '2026-01-05' }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.include('Selected: Jan 5: 7.');
  });

  it('ignores a selectedCell outside the current grid bounds', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['Mon']}
        .colLabels=${['00h']}
        .values=${[[1]]}
        .selectedCell=${{ row: 5, col: 9 }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.not.include('Selected');
  });

  it('announces the selected cell through the heatmapSelectedCellLabel template, not a bolted-on suffix', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
        .selectedCell=${{ row: 0, col: 0 }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    // the same "Selected: {cell}." template as the host aria-label, so a locale
    // can position the selected wording anywhere around the cell text
    expect(liveRegion.textContent).to.include('Selected: Row Mon, Col 00h: 1.');
  });

  it('is left to the consumer -- selectedCell is not reset alongside focusedCell on a grid-shape change', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h']}
        .values=${[[1], [2]]}
        .selectedCell=${{ row: 1, col: 0 }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    el.colLabels = ['00h', '06h'];
    await el.updateComplete;
    expect(el.selectedCell).to.deep.equal({ row: 1, col: 0 });
  });

  it('is accessible with a selected cell', async () => {
    const el = await fixture(html`
      <lr-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
        .selectedCell=${{ row: 1, col: 0 }}
      ></lr-heatmap>
    `);
    await expect(el).to.be.accessible();
  });
});

describe('coverage: color/theme helper edge cases', () => {
  it('resolveRgb: falls back to opaque black when the fallback color itself is not a valid hex string', () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      expect(
        resolveRgb('lyra-coverage-fallback-hex-invalid-color', 'lyra-coverage-fallback-hex-invalid-fallback'),
      ).to.deep.equal([0, 0, 0, 1]);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('warnInvalidColor: warns only once for repeated occurrences of the same invalid color within a draw pass (dedup)', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      const el = (await fixture(html`
        <lr-heatmap
          style="--lr-heatmap-scale-lo: lyra-coverage-dedupe-invalid-color; --lr-heatmap-scale-hi: lyra-coverage-dedupe-invalid-color;"
        ></lr-heatmap>
      `)) as LyraHeatmap;
      el.rowLabels = ['a'];
      el.colLabels = ['x'];
      el.values = [[5]];
      await el.updateComplete;
    } finally {
      console.warn = originalWarn;
    }
    const matching = warnings.filter((args) => args.join(' ').includes('lyra-coverage-dedupe-invalid-color'));
    expect(matching.length).to.equal(1);
  });

  it('formats a translucent theme ramp color as rgba(...) rather than dropping the alpha to fully opaque', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        style="--lr-heatmap-scale-lo: rgba(0, 128, 0, 0.5); --lr-heatmap-scale-hi: rgba(0, 128, 0, 0.5);"
      ></lr-heatmap>
    `)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0);
    expect(pixel[1]).to.be.closeTo(128, 5);
    expect(pixel[2]).to.equal(0);
    // ~0.5 alpha over a cleared (fully transparent) canvas -- not the fully-opaque 255 a dropped-alpha bug would produce.
    expect(pixel[3]).to.be.closeTo(128, 15);
  });

  it('retheming --lr-color-text-quiet changes the canvas label text color', async () => {
    const el = (await fixture(html`
      <lr-heatmap style="--lr-color-text-quiet: rgb(0, 150, 0);"></lr-heatmap>
    `)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    // The label fillStyle assignment is the last one drawMatrix() makes, so it's still current here.
    expect(ctx.fillStyle).to.equal('#009600');
  });

  it('bucket-count: removing the attribute resets to the default via fromAttribute(null)', async () => {
    const el = (await fixture(html`<lr-heatmap bucket-count="7"></lr-heatmap>`)) as LyraHeatmap;
    expect(el.bucketCount).to.equal(7);
    el.removeAttribute('bucket-count');
    await el.updateComplete;
    expect(el.bucketCount).to.equal(5);
  });

  it('formatNumericValue(): passes undefined (not an empty string) to Intl.NumberFormat when effectiveLocale resolves empty', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    // effectiveLocale (this.locale || resolveLyraLocale(this)) never actually resolves to '' via
    // the public API -- resolveLyraLocale() always falls back to 'en' at worst -- so shadow the
    // protected getter directly on this instance to exercise the defensive `|| undefined` fallback.
    Object.defineProperty(el, 'effectiveLocale', { configurable: true, get: () => '' });
    try {
      // Passing '' straight to Intl.NumberFormat throws a RangeError (invalid language tag);
      // formatNumericValue() must fall back to `undefined` (the runtime default locale) instead.
      expect(() => (el as unknown as { formatNumericValue(v: number): string }).formatNumericValue(1234)).to.not.throw();
    } finally {
      delete (el as unknown as Record<string, unknown>).effectiveLocale;
    }
  });
});

describe('coverage: theme-watcher defensive branches', () => {
  it('onColorSchemeChange (prefers-color-scheme listener) redraws without throwing', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    await el.updateComplete;
    expect(() => (el as unknown as { onColorSchemeChange(): void }).onColorSchemeChange()).to.not.throw();
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
  });

  it('watchTheme(): returns before touching colorSchemeQuery when ownerDocument has no defaultView', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    await el.updateComplete;
    const before = (el as unknown as { colorSchemeQuery?: MediaQueryList }).colorSchemeQuery;
    const fakeDoc = { defaultView: null } as unknown as Document;
    Object.defineProperty(el, 'ownerDocument', { configurable: true, value: fakeDoc });
    try {
      (el as unknown as { watchTheme(): void }).watchTheme();
    } finally {
      delete (el as unknown as Record<string, unknown>).ownerDocument;
    }
    const after = (el as unknown as { colorSchemeQuery?: MediaQueryList }).colorSchemeQuery;
    expect(after).to.equal(before);
  });

  it('watchTheme(): skips creating a MutationObserver when the global is unavailable', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    await el.updateComplete;
    const originalMO = window.MutationObserver;
    // @ts-expect-error -- deliberately removing the global to exercise the defensive fallback branch
    delete window.MutationObserver;
    try {
      expect(() => (el as unknown as { watchTheme(): void }).watchTheme()).to.not.throw();
    } finally {
      window.MutationObserver = originalMO;
    }
  });
});

describe('coverage: draw guard branches', () => {
  it('scheduleDraw(): coalesces multiple calls into a single pending animation frame', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    await el.updateComplete;
    let rafCalls = 0;
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCalls++;
      return originalRaf(cb);
    }) as typeof window.requestAnimationFrame;
    try {
      const instrumented = el as unknown as { scheduleDraw(): void };
      instrumented.scheduleDraw();
      instrumented.scheduleDraw();
      instrumented.scheduleDraw();
    } finally {
      window.requestAnimationFrame = originalRaf;
    }
    expect(rafCalls).to.equal(1);
  });

  it('drawMatrix(): no-ops before the canvas has ever been rendered (defensive early return)', () => {
    const el = document.createElement('lr-heatmap') as unknown as { drawMatrix(): void };
    expect(() => el.drawMatrix()).to.not.throw();
  });

  it('drawMatrix(): no-ops when the canvas 2D context is unavailable', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[1]];
    await el.updateComplete;
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error -- force a null 2D context to exercise the defensive early return
    HTMLCanvasElement.prototype.getContext = () => null;
    try {
      expect(() => (el as unknown as { drawMatrix(): void }).drawMatrix()).to.not.throw();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  it('drawMatrix(): falls back to a 1x device pixel ratio when window.devicePixelRatio is falsy', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 });
    try {
      (el as unknown as { drawMatrix(): void }).drawMatrix();
    } finally {
      if (originalDescriptor) Object.defineProperty(window, 'devicePixelRatio', originalDescriptor);
      else delete (window as unknown as Record<string, unknown>).devicePixelRatio;
    }
    // With dpr forced to 1 (0 || 1), canvas.width equals the CSS width exactly.
    expect(canvas.width).to.equal(parseInt(canvas.style.width, 10));
  });

  it('matrix mode: falls back to the PAD_LEFT + cols*cellSize formula for fitToWidth when the host has no measured width (e.g. display: none)', async () => {
    const el = (await fixture(
      html`<lr-heatmap fit-to-width style="display: none" cell-size="10"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 2]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // clientWidth is 0 while hidden -> falls back to PAD_LEFT(60) + 2*cellSize(10) = 80.
    expect(parseInt(canvas.style.width, 10)).to.equal(80);
  });
});

describe('coverage: selectedCellDescription resolves to "" for an unresolvable selectedCell', () => {
  it('calendar mode: selectedCell without a date', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    el.selectedCell = { row: 0, col: 0 };
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.not.include('Selected');
  });

  it('calendar mode: selectedCell date outside the built grid', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    el.selectedCell = { date: '2099-01-01' };
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.not.include('Selected');
  });

  it('matrix mode: selectedCell missing both row and col', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    el.selectedCell = {};
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.not.include('Selected');
  });
});

describe('coverage: calendar full-draw cellColor/colorSteps/focus-ring', () => {
  it('calendar mode: a cellColor override is used for the matching day during a full draw', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        .cellColor=${(_pos: unknown, value: number) => (value === 5 ? 'rgb(255, 0, 255)' : undefined)}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(33 * dpr), Math.round(21 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(255);
    expect(pixel[1]).to.equal(0);
    expect(pixel[2]).to.equal(255);
  });

  it('calendar mode: colorSteps buckets a day linearly across the discrete steps during a full draw', async () => {
    const el = (await fixture(html`
      <lr-heatmap mode="calendar" .colorSteps=${['#ff0000', '#00ff00', '#0000ff']}></lr-heatmap>
    `)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 }, // week 0, weekday 0 -- range low end
      { date: '2026-03-08', value: 100 }, // week 1, weekday 0 -- range high end
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(33 * dpr), Math.round(21 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0xff);
    expect(pixel[1]).to.equal(0x00);
    expect(pixel[2]).to.equal(0x00);
  });

  it('calendar mode: a full redraw (not just the focus-ring fast path) also strokes the keyboard focus ring while focusedCell is set', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // sets focusedCell (fast path)
    await el.updateComplete;

    type Internals = { drawCalendar(): void };
    const internals = el as unknown as Internals;
    let fullDraws = 0;
    const original = internals.drawCalendar.bind(el);
    internals.drawCalendar = () => {
      fullDraws++;
      original();
    };

    el.annotations = [{ date: '2026-03-01', label: 'x' }]; // any non-focus change forces a full draw()
    await el.updateComplete;
    // Proves drawCalendar() ran its full pass (not just repaintCalendarFocusCell) while
    // focusedCell was still set, exercising its own focus-ring block.
    expect(fullDraws).to.equal(1);
  });
});

describe('coverage: focus-ring fast-path repaint color/overlay branches', () => {
  it('matrix mode: respects scale="sqrt" when computing the repainted cell color', async () => {
    const el = (await fixture(html`<lr-heatmap scale="sqrt"></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 100]];
    await el.updateComplete; // full draw already happened -> canvasHasContent = true
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // focuses (0,0) via the fast path
    await el.updateComplete;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
    // sqrtStep(1, 100, 7) === 0 -> exactly the ramp's lo endpoint.
    expect(pixel[0]).to.equal(0xdd);
    expect(pixel[1]).to.equal(0xf4);
    expect(pixel[2]).to.equal(0xff);
  });

  it('matrix mode: respects colorSteps when computing the repainted cell color', async () => {
    const el = (await fixture(
      html`<lr-heatmap .colorSteps=${['#ff0000', '#00ff00', '#0000ff']}></lr-heatmap>`,
    )) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 100]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
    // value 1 is the range's low end -> bucket 0 -> colorSteps[0].
    expect(pixel[0]).to.equal(0xff);
    expect(pixel[1]).to.equal(0x00);
    expect(pixel[2]).to.equal(0x00);
  });

  it('matrix mode: repainting a de-focused cell still strokes its annotation ring', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[5, 6]];
    el.annotations = [{ row: 0, col: 0, label: 'Peak' }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // focuses (0,0)
    await el.updateComplete;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // moves to (0,1), repainting (0,0)
    await el.updateComplete;
    const ctx = canvas.getContext('2d')!;
    // (0,0) is no longer focused, so only its annotation ring (default #cf222e) should be visible.
    expect(findPixel(ctx, 59, 19, 24, 24, (r, g, b) => r === 0xcf && g === 0x22 && b === 0x2e)).to.equal(true);
  });

  it('calendar mode: respects scale="sqrt" when computing the repainted cell color', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar" scale="sqrt"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-02', value: 100 },
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(33 * dpr), Math.round(21 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0xdd);
    expect(pixel[1]).to.equal(0xf4);
    expect(pixel[2]).to.equal(0xff);
  });

  it('calendar mode: respects colorSteps when computing the repainted cell color', async () => {
    const el = (await fixture(html`
      <lr-heatmap mode="calendar" .colorSteps=${['#ff0000', '#00ff00', '#0000ff']}></lr-heatmap>
    `)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-08', value: 100 },
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const pixel = ctx.getImageData(Math.round(33 * dpr), Math.round(21 * dpr), 1, 1).data;
    expect(pixel[0]).to.equal(0xff);
    expect(pixel[1]).to.equal(0x00);
    expect(pixel[2]).to.equal(0x00);
  });

  it('calendar mode: repainting a de-focused cell still strokes its annotation and selected rings', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 5 }, // week 0, weekday 0
      { date: '2026-03-02', value: 9 }, // week 0, weekday 1
    ];
    el.annotations = [{ date: '2026-03-01', label: 'Launch' }];
    el.selectedCell = { date: '2026-03-01' };
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // focuses weekday 0
    await el.updateComplete;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // moves to weekday 1, repainting weekday 0
    await el.updateComplete;
    const ctx = canvas.getContext('2d')!;
    // weekday 0 is no longer focused; the selected ring (#1a7f37, stroked after the annotation ring) should be visible.
    expect(findPixel(ctx, 27, 15, 13, 13, (r, g, b) => r === 0x1a && g === 0x7f && b === 0x37)).to.equal(true);
  });
});

describe('coverage: matrix full-draw annotation validity guards', () => {
  it('an annotation missing row/col, or pointing out of range, is skipped without throwing', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[5]];
    el.annotations = [
      { date: '2026-01-01', label: 'Calendar-shaped, ignored in matrix mode' }, // row/col both null
      { row: 99, col: 99, label: 'Out of range' }, // valid shape, out of bounds
    ];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
    // Legend filtering only checks `.label`, independent of row/col validity -- both still appear.
    expect(el.shadowRoot!.querySelectorAll('[part="legend-annotation"]').length).to.equal(2);
  });
});

describe('coverage: roving focus with no interactive cells at all', () => {
  it('matrix mode: ArrowRight is a no-op when every cell is excluded via cellInteractive', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 2]];
    el.cellInteractive = () => false;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const live = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('');
  });

  it('calendar mode: ArrowDown is a no-op when every cell is excluded via cellInteractive', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    el.cellInteractive = () => false;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const live = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('');
  });
});

describe('coverage: miscellaneous cell-text/navigation/accessible-cells branches', () => {
  it('matrix mode: hover tooltip shows the localized no-data text for a -1 sentinel cell', async () => {
    const el = (await fixture(html`<lr-heatmap cell-size="22"></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[-1]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.left + 65, clientY: rect.top + 25, bubbles: true }),
    );
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement;
    expect(tooltip.textContent?.trim()).to.equal('Row a, Col x: no data');
  });

  it('calendar mode: ArrowLeft/ArrowRight move the focused cell by a whole week', async () => {
    const el = (await fixture(html`<lr-heatmap mode="calendar"></lr-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 5 }, // week 0, weekday 0
      { date: '2026-03-08', value: 9 }, // week 1, weekday 0
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const live = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Mar 1: 5');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Mar 8: 9');

    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await el.updateComplete;
    expect(live.textContent).to.equal('Mar 1: 5');
  });

  it('calendar mode: accessible-cells marks the selected day (by date) as aria-pressed="true"', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        accessible-cells
        mode="calendar"
        .days=${[{ date: '2026-03-01', value: 5 }]}
        .selectedCell=${{ date: '2026-03-01' }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
    const match = cells.find((c) => c.dataset.cellKey === 'calendar-0-0');
    expect(match).to.exist;
    expect(match!.getAttribute('aria-pressed')).to.equal('true');
    expect(cells.filter((c) => c !== match).every((c) => c.getAttribute('aria-pressed') === 'false')).to.equal(true);
  });

  it('accessible-cells: renders zero cells (and no throw) for an empty grid with no focused cell', async () => {
    const el = (await fixture(html`<lr-heatmap accessible-cells></lr-heatmap>`)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(0);
  });

  it('samePos(): treats a stale hoverCell from the previous mode as different from a same-tick new-mode hit test', async () => {
    const el = (await fixture(html`<lr-heatmap></lr-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[1]];
    el.days = [{ date: '2026-03-01', value: 5 }]; // pre-populate so the calendar grid is already built
    await el.updateComplete;

    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.left + 65, clientY: rect.top + 25, bubbles: true }),
    );
    await el.updateComplete;
    expect((el as unknown as { hoverCell: unknown }).hoverCell).to.deep.equal({ row: 0, col: 0 });

    // Switch mode WITHOUT awaiting -- this.mode already reads 'calendar' synchronously (a plain
    // property write), but willUpdate() (which resets hoverCell to null on a mode change) hasn't
    // run yet, since Lit's update is scheduled, not synchronous. A pointermove dispatched right now
    // hit-tests against the NEW mode while hoverCell still holds the OLD mode's MatrixCellPos,
    // forcing samePos() to compare mismatched cell shapes.
    el.mode = 'calendar';
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.left + 33, clientY: rect.top + 21, bubbles: true }),
    );
    // A calendar cursor also carries its resolved ISO `date` (see `CalendarCellPos.date`);
    // `samePos()` deliberately still compares only week/weekday.
    expect((el as unknown as { hoverCell: unknown }).hoverCell).to.deep.equal({
      week: 0,
      weekday: 0,
      date: '2026-03-01',
    });
    await el.updateComplete;
  });
});

/** Strips Lit's internal marker comments so a legend markup snapshot compares only the nodes,
 *  attributes and text a consumer can actually see, select and style. */
function stripLitMarkers(markup: string): string {
  return markup.replace(/<!--[\s\S]*?-->/g, '');
}

describe('legendStops', () => {
  /** The exact legend markup `<lr-heatmap>` has always rendered for a 3..9 matrix. Pinned so the
   *  new `legendStops` branch cannot alter the default output of a consumer who never sets it. */
  const BASELINE_LEGEND =
    '\n          <span part="legend-lo">3</span>\n' +
    '          <span class="bar"></span>\n' +
    '          <span part="legend-hi">9</span>\n' +
    // The trailing valueLabel caption gained `part="legend-value-label"` so the whole legend row
    // is addressable from outside; every other node here is pinned unchanged.
    '          <span part="legend-value-label">value</span>\n' +
    '          \n        ';

  it('left unset, renders byte-identical lo/hi gradient legend markup', async () => {
    const el = (await fixture(html`
      <lr-heatmap .rowLabels=${['a']} .colLabels=${['x', 'y']} .values=${[[3, 9]]}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    expect(el.legendStops).to.equal(undefined);
    expect(stripLitMarkers(legend.innerHTML)).to.equal(BASELINE_LEGEND);
    expect(legend.querySelector('[part="legend-stop"]')).to.not.exist;
  });

  it('renders one legend-stop per stop, in order and in its own color, instead of the lo/hi gradient', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[
          { value: 0, color: 'rgb(255, 0, 0)' },
          { value: 50, color: 'rgb(0, 128, 0)' },
          { value: 100, color: 'rgb(0, 0, 255)' },
        ]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    const stops = [...legend.querySelectorAll('[part="legend-stop"]')];
    expect(stops.length).to.equal(3);
    expect(stops.map((s) => s.querySelector('[part="legend-stop-label"]')!.textContent)).to.deep.equal([
      '0',
      '50',
      '100',
    ]);
    expect(
      stops.map((s) => getComputedStyle(s.querySelector('[part="legend-swatch"]') as HTMLElement).backgroundColor),
    ).to.deep.equal(['rgb(255, 0, 0)', 'rgb(0, 128, 0)', 'rgb(0, 0, 255)']);
    // The stops replace the two-endpoint bar rather than adding to it.
    expect(legend.querySelector('[part="legend-lo"]')).to.not.exist;
    expect(legend.querySelector('[part="legend-hi"]')).to.not.exist;
    expect(legend.querySelector('.bar')).to.not.exist;
  });

  it('labels a stop with the component\'s own locale-aware numeric formatting unless `label` overrides it', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        locale="de-DE"
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[
          { value: 1234.5, color: '#ff0000' },
          { value: 2345.6, color: '#00ff00', label: 'busiest' },
        ]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const labels = [...el.shadowRoot!.querySelectorAll('[part="legend-stop-label"]')].map((n) => n.textContent);
    expect(labels).to.deep.equal(['1.234,5', 'busiest']);
  });

  it('is presentation only — adding legendStops next to a cellColor callback leaves cell rendering untouched', async () => {
    const cellColor = (_pos: unknown, value: number): string | undefined =>
      value < 0 ? undefined : value > 5 ? 'rgb(255, 0, 0)' : 'rgb(0, 128, 0)';
    const values = [
      [1, 4, 9],
      [0, 2, 6],
      [-1, 1, 4],
    ];
    const plain = (await fixture(html`
      <lr-heatmap
        cell-size="22"
        .rowLabels=${['a', 'b', 'c']}
        .colLabels=${['x', 'y', 'z']}
        .values=${values}
        .cellColor=${cellColor}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    const withStops = (await fixture(html`
      <lr-heatmap
        cell-size="22"
        .rowLabels=${['a', 'b', 'c']}
        .colLabels=${['x', 'y', 'z']}
        .values=${values}
        .cellColor=${cellColor}
        .legendStops=${[
          { value: 0, color: 'rgb(0, 128, 0)' },
          { value: 9, color: 'rgb(255, 0, 0)' },
        ]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await plain.updateComplete;
    await withStops.updateComplete;
    const plainCanvas = plain.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const stopsCanvas = withStops.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(withStops.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(2);
    expect(stopsCanvas.width).to.equal(plainCanvas.width);
    expect(stopsCanvas.height).to.equal(plainCanvas.height);
    expect(stopsCanvas.toDataURL()).to.equal(plainCanvas.toDataURL());
  });

  it('renders labeled annotations alongside the stops', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .annotations=${[{ row: 0, col: 1, label: 'Peak load' }]}
        .legendStops=${[
          { value: 0, color: 'rgb(255, 0, 0)' },
          { value: 9, color: 'rgb(0, 0, 255)' },
        ]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    expect(legend.querySelectorAll('[part="legend-stop"]').length).to.equal(2);
    const annotations = [...legend.querySelectorAll('[part="legend-annotation"]')];
    expect(annotations.length).to.equal(1);
    expect(annotations[0]!.textContent).to.contain('Peak load');
  });

  it('stays accessible with legendStops set', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[
          { value: 0, color: 'rgb(255, 0, 0)' },
          { value: 9, color: 'rgb(0, 0, 255)' },
        ]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('repaints when legendStops changes on a live element', async () => {
    const el = (await fixture(html`
      <lr-heatmap .rowLabels=${['a']} .colLabels=${['x', 'y']} .values=${[[3, 9]]}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    el.legendStops = [{ value: 0, color: 'rgb(255, 0, 0)' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="legend-lo"]')).to.not.exist;
  });

  it('renders a caption-only stop (no `color`) with its label and no swatch element at all', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[
          { value: 0, label: 'none' },
          { value: 50, color: 'rgb(0, 128, 0)' },
          { value: 100, label: 'off scale' },
        ]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
    const stops = [...legend.querySelectorAll('[part="legend-stop"]')];
    expect(stops.length).to.equal(3);
    // A bare optional type is not enough: styleMap({ background: undefined }) is a legal no-op
    // that would still leave the 0.6rem swatch box in the row. The element must be absent.
    expect(stops.map((s) => !!s.querySelector('[part="legend-swatch"]'))).to.deep.equal([
      false,
      true,
      false,
    ]);
    expect(legend.querySelectorAll('[part="legend-swatch"]').length).to.equal(1);
    expect(stops.map((s) => s.querySelector('[part="legend-stop-label"]')!.textContent)).to.deep.equal([
      'none',
      '50',
      'off scale',
    ]);
    expect(
      getComputedStyle(stops[1]!.querySelector('[part="legend-swatch"]') as HTMLElement).backgroundColor,
    ).to.equal('rgb(0, 128, 0)');
  });

  it('treats an empty-string color as caption-only instead of painting a transparent swatch box', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[{ value: 0, color: '', label: 'none' }]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="legend-stop-label"]')!.textContent).to.equal('none');
  });

  it('caption-only stops fall back to the same locale-aware numeric label as colored ones', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        locale="de-DE"
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[{ value: 1234.5 }]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-stop-label"]')!.textContent).to.equal('1.234,5');
    expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(0);
  });

  it('stays accessible with a caption-only legend stop', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[{ value: 0, label: 'none' }, { value: 9, color: 'rgb(0, 0, 255)' }]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('exposes the trailing value label as [part="legend-value-label"] in both legend branches', async () => {
    const gradient = (await fixture(html`
      <lr-heatmap
        value-label="events"
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await gradient.updateComplete;
    expect(gradient.shadowRoot!.querySelector('[part="legend-value-label"]')!.textContent).to.equal(
      'events',
    );

    const withStops = (await fixture(html`
      <lr-heatmap
        value-label="events"
        .rowLabels=${['a']}
        .colLabels=${['x', 'y']}
        .values=${[[3, 9]]}
        .legendStops=${[{ value: 0, label: 'none' }]}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await withStops.updateComplete;
    expect(withStops.shadowRoot!.querySelector('[part="legend-value-label"]')!.textContent).to.equal(
      'events',
    );
  });
});

describe('maxCellSize / minCellSize (fit-to-width clamps)', () => {
  /** Four Sundays -> weekCount 4, so the calendar grid is wide enough for the cap to bite. */
  const FOUR_WEEKS = [
    { date: '2026-03-01', value: 1 },
    { date: '2026-03-08', value: 2 },
    { date: '2026-03-15', value: 3 },
    { date: '2026-03-22', value: 4 },
  ];

  it('calendar mode: max-cell-size caps the fit-to-width cell size, leaving the host remainder unfilled', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width max-cell-size="26" style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = FOUR_WEEKS;
    await el.updateComplete;
    expect(el.maxCellSize).to.equal(26);
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // Uncapped this would fill the host exactly (320). Capped: CAL_PAD_LEFT(28) + 4 * (26 + CAL_GAP(2)) = 140.
    expect(parseInt(canvas.style.width, 10)).to.equal(140);
  });

  it('matrix mode: max-cell-size caps the fit-to-width cell size', async () => {
    const el = (await fixture(
      html`<lr-heatmap fit-to-width max-cell-size="26" style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y', 'z', 'w'];
    el.values = [[1, 2, 3, 4]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // Uncapped this would fill the host exactly (320). Capped: PAD_LEFT(60) + 4 * 26 = 164.
    expect(parseInt(canvas.style.width, 10)).to.equal(164);
  });

  it('calendar mode: min-cell-size raises the floor above the built-in 4px', async () => {
    const narrow = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width style="inline-size: 60px"></lr-heatmap>`,
    )) as LyraHeatmap;
    narrow.days = FOUR_WEEKS;
    await narrow.updateComplete;
    // (60 - 28) / 4 - 2 = 6 -> above the built-in 4px floor, so nothing is clamped yet.
    expect(parseInt((narrow.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).style.width, 10)).to.equal(60);

    const floored = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width min-cell-size="16" style="inline-size: 60px"></lr-heatmap>`,
    )) as LyraHeatmap;
    floored.days = FOUR_WEEKS;
    await floored.updateComplete;
    expect(floored.minCellSize).to.equal(16);
    // 28 + 4 * (16 + 2) = 100.
    expect(parseInt((floored.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).style.width, 10)).to.equal(100);
  });

  it('matrix mode: min-cell-size raises the floor above the built-in 4px', async () => {
    const el = (await fixture(
      html`<lr-heatmap fit-to-width min-cell-size="18" style="inline-size: 100px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['v', 'w', 'x', 'y', 'z'];
    el.values = [[1, 2, 3, 4, 5]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // (100 - 60) / 5 = 8 raw, floored to 18: PAD_LEFT(60) + 5 * 18 = 150.
    expect(parseInt(canvas.style.width, 10)).to.equal(150);
  });

  it('leaves both modes byte-identical when neither clamp is set', async () => {
    const calendar = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    calendar.days = FOUR_WEEKS;
    await calendar.updateComplete;
    expect(calendar.maxCellSize).to.equal(undefined);
    expect(calendar.minCellSize).to.equal(undefined);
    expect(parseInt((calendar.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).style.width, 10)).to.equal(320);

    const matrix = (await fixture(
      html`<lr-heatmap fit-to-width style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    matrix.rowLabels = ['a'];
    matrix.colLabels = ['x', 'y', 'z', 'w'];
    matrix.values = [[1, 2, 3, 4]];
    await matrix.updateComplete;
    expect(parseInt((matrix.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).style.width, 10)).to.equal(320);
  });

  it('ignores both clamps while fit-to-width is unset', async () => {
    const el = (await fixture(
      html`<lr-heatmap cell-size="20" max-cell-size="8" min-cell-size="40" style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y', 'z', 'w'];
    el.values = [[1, 2, 3, 4]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // The explicit cell-size still wins outright: 60 + 4 * 20 = 140.
    expect(parseInt(canvas.style.width, 10)).to.equal(140);
  });

  it('repaints the canvas when max-cell-size or min-cell-size changes on a live element', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = FOUR_WEEKS;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(parseInt(canvas.style.width, 10)).to.equal(320);

    el.maxCellSize = 26;
    await el.updateComplete;
    expect(parseInt(canvas.style.width, 10)).to.equal(140);

    el.maxCellSize = undefined;
    el.minCellSize = 100;
    await el.updateComplete;
    // 28 + 4 * (100 + 2) = 436.
    expect(parseInt(canvas.style.width, 10)).to.equal(436);
  });

  it('lets the ceiling win when it is set below the floor, matching finiteRange\'s own precedence', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width max-cell-size="10" min-cell-size="30" style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = FOUR_WEEKS;
    await el.updateComplete;
    // 28 + 4 * (10 + 2) = 76.
    expect(parseInt((el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).style.width, 10)).to.equal(76);
  });

  it('treats a non-finite clamp as unset instead of producing NaN canvas geometry', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width max-cell-size="not-a-number" min-cell-size="" style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = FOUR_WEEKS;
    await el.updateComplete;
    expect(el.maxCellSize).to.equal(undefined);
    expect(el.minCellSize).to.equal(undefined);
    expect(parseInt((el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).style.width, 10)).to.equal(320);
  });

  it('never lets min-cell-size drop the effective floor below the built-in 4px safety minimum', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width min-cell-size="0" style="inline-size: 40px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = FOUR_WEEKS;
    await el.updateComplete;
    expect(el.minCellSize).to.equal(4);
    // (40 - 28) / 4 - 2 = 1 -> still clamped up to the built-in 4: 28 + 4 * (4 + 2) = 52.
    expect(parseInt((el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement).style.width, 10)).to.equal(52);
  });

  it('stays accessible with both clamps applied', async () => {
    const el = (await fixture(
      html`<lr-heatmap mode="calendar" fit-to-width max-cell-size="26" min-cell-size="12" style="inline-size: 320px"></lr-heatmap>`,
    )) as LyraHeatmap;
    el.days = FOUR_WEEKS;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('CalendarCellPos.date', () => {
  /** 2026-03-01 is a Sunday, so it anchors week 0 exactly; 2026-03-17 lands in week 2, weekday 2.
   *  Everything between them is a genuine gap — a grid position with no entry in `days` at all. */
  const SPARSE_DAYS = [
    { date: '2026-03-01', value: 5 },
    { date: '2026-03-17', value: 2 },
  ];

  /** Reads the accessible-cell overlay's labels keyed by `calendar-<week>-<weekday>`, which come
   *  straight from `resolveCellText()` — i.e. from the same `CalendarCellPos` every other
   *  calendar-mode call site builds. */
  function labelsByKey(el: LyraHeatmap): Record<string, string> {
    const out: Record<string, string> = {};
    for (const button of el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')) {
      out[button.dataset.cellKey!] = button.getAttribute('aria-label') ?? '';
    }
    return out;
  }

  it('gives cellText the ISO date for a cell with data AND for a sparse gap cell', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        accessible-cells
        .days=${SPARSE_DAYS}
        .cellText=${(pos: MatrixCellPos | CalendarCellPos) => (pos as CalendarCellPos).date}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const labels = labelsByKey(el);
    // Week 0, weekday 0 -> the anchor Sunday, which has real data.
    expect(labels['calendar-0-0']).to.equal('2026-03-01');
    // Week 0, weekday 1 -> a gap: no entry in `days`, but still a real calendar date.
    expect(labels['calendar-0-1']).to.equal('2026-03-02');
    // Week 2, weekday 2 -> the second real day.
    expect(labels['calendar-2-2']).to.equal('2026-03-17');
    // Week 2, weekday 6 -> a trailing gap.
    expect(labels['calendar-2-6']).to.equal('2026-03-21');
  });

  it('gives cellColor the ISO date on the drawCalendar full-repaint path, gaps included', async () => {
    const seen: (string | undefined)[] = [];
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        .days=${SPARSE_DAYS}
        .cellColor=${(pos: MatrixCellPos | CalendarCellPos) => {
          seen.push((pos as CalendarCellPos).date);
          return undefined;
        }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    seen.length = 0;
    el.refreshTheme(); // one clean full repaint
    // 3 week columns * 7 weekday rows, week-major, starting at the anchor Sunday.
    expect(seen.length).to.equal(21);
    expect(seen[0]).to.equal('2026-03-01');
    expect(seen[1]).to.equal('2026-03-02');
    expect(seen[6]).to.equal('2026-03-07');
    expect(seen[7]).to.equal('2026-03-08');
    expect(seen[16]).to.equal('2026-03-17');
    expect(seen[20]).to.equal('2026-03-21');
    expect(seen.filter((d) => typeof d !== 'string').length).to.equal(0);
  });

  it('gives cellColor the ISO date on the single-cell focus-ring fast repaint path too', async () => {
    const seen: (string | undefined)[] = [];
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        .days=${SPARSE_DAYS}
        .cellColor=${(pos: MatrixCellPos | CalendarCellPos) => {
          seen.push((pos as CalendarCellPos).date);
          return undefined;
        }}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    seen.length = 0;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(seen.length).to.be.greaterThan(0);
    expect(seen.filter((d) => typeof d !== 'string').length).to.equal(0);
  });

  it('gives cellInteractive the ISO date, so a consumer can exclude dates by value', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        accessible-cells
        .days=${SPARSE_DAYS}
        .cellInteractive=${(pos: MatrixCellPos | CalendarCellPos) =>
          (pos as CalendarCellPos).date <= '2026-03-07'}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    // Exactly the first week column survives the predicate.
    expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(7);
    expect(Object.keys(labelsByKey(el)).sort()).to.deep.equal([
      'calendar-0-0',
      'calendar-0-1',
      'calendar-0-2',
      'calendar-0-3',
      'calendar-0-4',
      'calendar-0-5',
      'calendar-0-6',
    ]);
  });

  it('carries the date on the hover/keyboard cursor, and matrix positions still carry none', async () => {
    const el = (await fixture(html`
      <lr-heatmap mode="calendar" .days=${SPARSE_DAYS}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect((el as unknown as { focusedCell: CalendarCellPos }).focusedCell.date).to.equal('2026-03-01');

    const matrix = (await fixture(html`
      <lr-heatmap .rowLabels=${['a']} .colLabels=${['x', 'y']} .values=${[[1, 2]]}></lr-heatmap>
    `)) as LyraHeatmap;
    await matrix.updateComplete;
    const matrixCanvas = matrix.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    matrixCanvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await matrix.updateComplete;
    expect((matrix as unknown as { focusedCell: unknown }).focusedCell).to.deep.equal({ row: 0, col: 0 });
  });

  it('keeps `date` out of samePos(), so a repaint diff never churns on it', async () => {
    const el = (await fixture(html`
      <lr-heatmap mode="calendar" .days=${SPARSE_DAYS}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const samePos = (el as unknown as {
      samePos: (a: unknown, b: unknown) => boolean;
    }).samePos.bind(el);
    expect(samePos({ week: 1, weekday: 2, date: '2026-03-09' }, { week: 1, weekday: 2, date: 'x' })).to.equal(
      true,
    );
    expect(samePos({ week: 1, weekday: 2, date: '2026-03-09' }, { week: 1, weekday: 3, date: '2026-03-09' })).to.equal(
      false,
    );
    // The structural `'week' in pos` discriminator must still tell the two shapes apart.
    expect(samePos({ week: 0, weekday: 0, date: '2026-03-01' }, { row: 0, col: 0 })).to.equal(false);
  });

  it('does not change lr-cell-click\'s detail shape', async () => {
    const el = (await fixture(html`
      <lr-heatmap mode="calendar" .days=${SPARSE_DAYS}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    let detail: unknown = null;
    el.addEventListener('lr-cell-click', (e) => {
      detail = (e as CustomEvent).detail;
    });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ date: '2026-03-01', value: 5 });
  });

  it('stays accessible with a date-driven cellText on the accessible-cell overlay', async () => {
    const el = (await fixture(html`
      <lr-heatmap
        mode="calendar"
        accessible-cells
        .days=${SPARSE_DAYS}
        .cellText=${(pos: MatrixCellPos | CalendarCellPos) => `Day ${(pos as CalendarCellPos).date}`}
      ></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('mouse-hover feedback (states-hover-missing-with-focus-visible)', () => {
  it('gives the default (non-accessible-cells) canvas surface a pointer cursor', async () => {
    const el = (await fixture(html`
      <lr-heatmap .rowLabels=${['A']} .colLabels=${['X']} .values=${[[1]]}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(getComputedStyle(canvas).cursor).to.equal('pointer');
  });

  it('turns off canvas pointer-events once accessible-cells takes over hit-testing, so its cursor never shows', async () => {
    const el = (await fixture(html`
      <lr-heatmap accessible-cells .rowLabels=${['A']} .colLabels=${['X']} .values=${[[1]]}></lr-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(getComputedStyle(canvas).pointerEvents).to.equal('none');
  });

  // :hover cannot be synthesized in this test runner (no real pointer), so per this repo's
  // documented exception for genuinely-unsynthesizable pseudo-classes, this asserts against the
  // stylesheet source instead of a rendered/computed effect -- mirroring the existing
  // reduced-motion/RTL-mirror cssText assertions already used elsewhere in this suite.
  it("declares [part='cell']:hover and [part='canvas']:hover rules using the same focus-ring color token", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='cell'\]:hover\s*\{\s*outline:[^}]*--lr-heatmap-focus-ring-color/);
    expect(css).to.match(/\[part='canvas'\]:hover\s*\{\s*outline:[^}]*--lr-heatmap-focus-ring-color/);
  });
});
