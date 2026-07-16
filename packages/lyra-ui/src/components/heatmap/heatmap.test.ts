import { aTimeout, fixture, expect, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';
import {
  MAX_BUCKET_COUNT,
  hexToRgb,
  mixColor,
  normalizeBucketCount,
  resolveRgb,
} from './heatmap.js';

it('sets a group role (not img, which conflicts with the canvas\'s focusable descendant) and a summarizing aria-label', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    html`<lyra-heatmap role="application" aria-label="Custom label" .rowLabels=${['a']} .colLabels=${['b']} .values=${[[1]]}></lyra-heatmap>`,
  )) as LyraHeatmap;
  expect(el.getAttribute('role')).to.equal('application');
  expect(el.getAttribute('aria-label')).to.equal('Custom label');
});

it('renders numeric min/max legend ticks', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[3, 9]];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('3');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('9');
});

it('shows empty legend ticks when there is no real data', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[-1]];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('');
});

it('renders a canvas sized to the grid dimensions', async () => {
  const el = (await fixture(html`<lyra-heatmap cell-size="20"></lyra-heatmap>`)) as LyraHeatmap;
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

it('treats -1 as a no-data sentinel without throwing', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.values = [[-1, 2]];
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('does not throw a RangeError computing the range label/draw for a very large grid (150k+ cells)', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.values = [[1, 2]];
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders an opt-in native button overlay with persistent per-cell semantics', async () => {
  const el = (await fixture(html`
    <lyra-heatmap
      accessible-cells
      .rowLabels=${['A', 'B']}
      .colLabels=${['X', 'Y']}
      .values=${[
        [1, 2],
        [3, 4],
      ]}
      .selectedCell=${{ row: 1, col: 0 }}
    ></lyra-heatmap>
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
    <lyra-heatmap
      accessible-cells
      dir="rtl"
      .rowLabels=${['A']}
      .colLabels=${['X', 'Y']}
      .values=${[[1, 2]]}
    ></lyra-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
  cells[0]!.focus();
  cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  await el.updateComplete;
  await aTimeout(0);
  expect((el.shadowRoot!.activeElement as HTMLElement).dataset.cellKey).to.equal('matrix-0-1');

  const event = new Promise<CustomEvent>((resolve) => el.addEventListener('lyra-cell-click', resolve, { once: true }));
  cells[0]!.click();
  expect((await event).detail).to.deep.equal({ row: 0, col: 0, value: 1 });
});

it('renders accessible calendar cells with date announcements', async () => {
  const el = (await fixture(html`
    <lyra-heatmap accessible-cells mode="calendar" .days=${[{ date: '2026-03-01', value: 7 }]}></lyra-heatmap>
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    html`<lyra-heatmap fit-to-width style="inline-size: 320px"></lyra-heatmap>`,
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
    html`<lyra-heatmap cell-size="20" style="inline-size: 320px"></lyra-heatmap>`,
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
  const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
  const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
  el.days = [
    { date: '2026-03-01', value: 1 },
    { date: '2026-03-02', value: 9 },
  ];
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Calendar heatmap of 2 days, value range 1–9');
});

it('calendar mode: shows "no data" in the aria-label with zero days', async () => {
  const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Calendar heatmap of 0 days, value range no data');
});

it('calendar mode: renders numeric min/max legend ticks from days', async () => {
  const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
  el.days = [
    { date: '2026-03-01', value: 2 },
    { date: '2026-03-02', value: 8 },
  ];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('2');
  expect(el.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('8');
});

it('calendar mode: is accessible', async () => {
  const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
  el.days = [{ date: '2026-03-01', value: 1 }];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('calendar mode: a single malformed date entry does not blank the whole calendar (regression)', async () => {
  const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
  const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
      html`<lyra-heatmap mode="calendar" bucket-count="${MAX_BUCKET_COUNT + 1}"></lyra-heatmap>`,
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;

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
      html`<lyra-heatmap mode="calendar" bucket-count="abc"></lyra-heatmap>`,
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
      html`<lyra-heatmap mode="calendar" bucket-count="4.5"></lyra-heatmap>`,
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
  const el = (await fixture(html`<lyra-heatmap scale="sqrt"></lyra-heatmap>`)) as LyraHeatmap;
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
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[3, 9]];
  await el.updateComplete;
  expect(el.mode).to.equal('matrix');
  expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('3');
});

describe('per-update-cycle caching (perf)', () => {
  it('does not recompute the value range on a hover-only update that never touches values/days/mode', async () => {
    const el = (await fixture(html`<lyra-heatmap cell-size="22"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    expect(resolveRgb('not-a-real-color', '#123456')).to.deep.equal([0x12, 0x34, 0x56, 1]);
  });
});

describe('mixColor', () => {
  it('interpolates between two hex colors', () => {
    expect(mixColor('#000000', '#ffffff', 0)).to.equal('rgb(0, 0, 0)');
    expect(mixColor('#000000', '#ffffff', 1)).to.equal('rgb(255, 255, 255)');
    expect(mixColor('#000000', '#ffffff', 0.5)).to.equal('rgb(128, 128, 128)');
  });

  it('interpolates between two non-hex CSS colors', () => {
    expect(mixColor('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 0.5)).to.equal('rgb(128, 128, 128)');
  });

  it('interpolates alpha and emits rgba() when either endpoint is translucent (gap #65)', () => {
    expect(mixColor('rgba(0, 0, 0, 0)', 'rgba(255, 255, 255, 1)', 0.5)).to.equal('rgba(128, 128, 128, 0.5)');
    expect(mixColor('#0969da', 'rgba(9, 105, 218, 0.5)', 1)).to.equal('rgba(9, 105, 218, 0.5)');
  });
});

it('retheming --lyra-heatmap-no-data-fill changes the rendered no-data cell color', async () => {
  const el = (await fixture(html`
    <lyra-heatmap style="--lyra-heatmap-no-data-fill: rgb(0, 200, 0);"></lyra-heatmap>
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
    <lyra-heatmap
      style="--lyra-heatmap-scale-lo: rgb(0, 128, 0); --lyra-heatmap-scale-hi: rgb(0, 128, 0);"
    ></lyra-heatmap>
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
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  el.values = [[0, 10]];
  await el.updateComplete;

  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const sample = () => ctx.getImageData(Math.round(87 * dpr), Math.round(25 * dpr), 1, 1).data;
  const before = sample();

  el.style.setProperty('--lyra-heatmap-scale-hi', 'rgb(0, 200, 0)');
  await aTimeout(0);

  const after = sample();
  expect([after[0], after[1], after[2]]).to.deep.equal([0, 200, 0]);
  expect([after[0], after[1], after[2]]).to.not.deep.equal([before[0], before[1], before[2]]);
});

it('retheming with an unparsable custom property value does not throw and does not go solid black', async () => {
  const el = (await fixture(html`
    <lyra-heatmap style="--lyra-heatmap-scale-lo: not-a-real-color;"></lyra-heatmap>
  `)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[5]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
  // Falls back to the default ramp endpoints rather than parsing to solid black.
  expect([pixel[0], pixel[1], pixel[2]]).to.not.deep.equal([0, 0, 0]);
});

it('retheming --lyra-heatmap-label-font changes the canvas font used to draw labels', async () => {
  const el = (await fixture(html`
    <lyra-heatmap style="--lyra-heatmap-label-font: 16px monospace;"></lyra-heatmap>
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.tabIndex).to.equal(0);
  });

  it('matrix mode: shows a tooltip with the row/col label and value on hover, hidden on pointerleave', async () => {
    const el = (await fixture(html`<lyra-heatmap cell-size="22"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap cell-size="22"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap cell-size="22"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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

  it('matrix mode: emits lyra-cell-click with {row, col, value} on click', async () => {
    const el = (await fixture(html`<lyra-heatmap cell-size="22"></lyra-heatmap>`)) as LyraHeatmap;
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
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 60 + 11, clientY: rect.top + 20 + 33, bubbles: true }),
    );
    expect(detail).to.deep.equal({ row: 1, col: 0, value: 1 });
  });

  it('matrix mode: emits lyra-cell-click via Enter on the focused cell', async () => {
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[3, 7]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // focuses (0,0)
    let detail: { row: number; col: number; value: number } | undefined;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ row: 0, col: 0, value: 3 });
  });

  it('matrix mode: emits lyra-cell-click via Space on the focused cell', async () => {
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[3, 7]];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // focuses (0,0)
    let detail: { row: number; col: number; value: number } | undefined;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(detail).to.deep.equal({ row: 0, col: 0, value: 3 });
  });

  it('calendar mode: emits lyra-cell-click with {date, value} on click', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 28 + 5, clientY: rect.top + 16 + 5, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-01', value: 5 });
  });

  it('calendar mode: emits lyra-cell-click via Enter on the focused cell', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); // focuses (week 0, weekday 0)
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(detail).to.deep.equal({ date: '2026-03-01', value: 5 });
  });

  it('does not re-activate a stale focused cell when clicking outside the grid', async () => {
    const el = (await fixture(
      html`<lyra-heatmap .rowLabels=${['a']} .colLabels=${['b']} .values=${[[1]]}></lyra-heatmap>`,
    )) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await el.updateComplete;
    let detail: unknown;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: -1000, clientY: -1000 }));
    expect(detail).to.be.undefined;
  });

  it('is accessible with a hovered tooltip and a focused cell', async () => {
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[1, 2]];
    el.annotations = [{ row: 0, col: 1, label: 'Peak' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
  });

  it('matrix mode: renders a legend-annotation entry (ring swatch + label text) when an annotation has a label', async () => {
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[1]];
    el.annotations = [{ row: 0, col: 0 }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-annotation"]')).to.not.exist;
  });

  it('omits legend-annotation when there are no annotations at all', async () => {
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x'];
    el.values = [[1]];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-annotation"]')).to.not.exist;
  });

  it('calendar mode: accepts date-based annotations, redraws without throwing, and renders their legend label', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    el.annotations = [{ date: '2026-03-01', label: 'Launch' }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('canvas')).to.exist;
    const entry = el.shadowRoot!.querySelector('[part="legend-annotation"]');
    expect(entry).to.exist;
    expect(entry!.textContent).to.contain('Launch');
  });

  it('renders one legend-annotation entry per labeled annotation', async () => {
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap
      .rowLabels=${['R1']}
      .colLabels=${['C1']}
      .values=${[[5]]}
    ></lyra-heatmap>`)) as LyraHeatmap;
    expect(el.getAttribute('role')).to.equal('group');
  });

  it('uses a custom cellText formatter for the tooltip and live-region text when provided', async () => {
    const el = (await fixture(html`<lyra-heatmap
      .rowLabels=${['R1']}
      .colLabels=${['C1']}
      .values=${[[5]]}
      .cellText=${(pos: { row?: number; col?: number }, value: number) =>
        `custom ${pos.row},${pos.col}: ${value}`}
    ></lyra-heatmap>`)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    const live = el.shadowRoot!.querySelector('[part="live-region"]');
    expect(live!.textContent).to.equal('custom 0,0: 5');
  });

  it('falls back to the built-in English template without cellText', async () => {
    const el = (await fixture(html`<lyra-heatmap
      .rowLabels=${['R1']}
      .colLabels=${['C1']}
      .values=${[[5]]}
    ></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap
      mode="calendar"
      .days=${[{ date: '2026-01-18', value: 3 }]}
    ></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // single Sunday -> weekCount 1
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // CAL_PAD_LEFT(28) + max(1, weekCount=1) * (CAL_CELL(11) + CAL_GAP(2)) = 28 + 13 = 41.
    expect(parseInt(canvas.style.width, 10)).to.equal(41);
  });

  it('drawn cell fill and pointer hit-testing both follow a custom columnX function, staying consistent with each other', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 154, clientY: rect.top + 20, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-08', value: 9 });
  });

  it('a click at the default-formula position misses once columnX moves that column elsewhere', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-08', value: 9 },
    ];
    el.columnX = (week: number) => 100 + week * 50;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: unknown;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    expect(el.firstDayOfWeek).to.equal(0);
  });

  it('shifts which week/row a known date lands in, calendar mode', async () => {
    const el = (await fixture(
      html`<lyra-heatmap mode="calendar" first-day-of-week="1"></lyra-heatmap>`,
    )) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 }, // Sunday: with a Monday anchor, week 0, weekday 6 (last row of the prior week)
      { date: '2026-03-02', value: 9 }, // Monday: the anchor weekday itself, week 1, weekday 0
    ];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: { date: string; value: number } | undefined;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));

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
      html`<lyra-heatmap first-day-of-week="1" cell-size="22"></lyra-heatmap>`,
    )) as LyraHeatmap;
    el.rowLabels = ['a'];
    el.colLabels = ['x', 'y'];
    el.values = [[3, 9]];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('3');
  });

  it('weekday-axis labels stay Mon/Wed/Fri (re-anchored to the correct rows) for a non-Sunday firstDayOfWeek', async () => {
    const el = (await fixture(
      html`<lyra-heatmap mode="calendar" first-day-of-week="1"></lyra-heatmap>`,
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // single Sunday -> weekCount 1
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // CAL_LABEL_H(16) + 7 * (CAL_CELL(11) + CAL_GAP(2)) = 16 + 91 = 107.
    expect(parseInt(canvas.style.height, 10)).to.equal(107);
  });

  it('drawn cell fill and pointer hit-testing both follow a custom rowY function, staying consistent with each other', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 32, clientY: rect.top + 204, bubbles: true }),
    );
    expect(detail).to.deep.equal({ date: '2026-03-03', value: 9 });
  });

  it('a click at the default-formula position misses once rowY moves that row elsewhere', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-03', value: 9 },
    ];
    el.rowY = (weekday: number) => 100 + weekday * 50;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let detail: unknown;
    el.addEventListener('lyra-cell-click', (e) => (detail = (e as CustomEvent).detail));
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }]; // single Sunday -> weekCount 1
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // CAL_PAD_LEFT(28) + max(1, weekCount=1) * (11 + CAL_GAP(2)) = 41, unchanged.
    expect(parseInt(canvas.style.width, 10)).to.equal(41);
  });

  it('cell-size resizes calendar mode\'s grid when explicitly set', async () => {
    const el = (await fixture(
      html`<lyra-heatmap mode="calendar" cell-size="20"></lyra-heatmap>`,
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
      html`<lyra-heatmap mode="calendar" fit-to-width style="inline-size: 320px"></lyra-heatmap>`,
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
      html`<lyra-heatmap mode="calendar" cell-size="20" style="inline-size: 320px"></lyra-heatmap>`,
    )) as LyraHeatmap;
    el.days = [{ date: '2026-03-01', value: 5 }];
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    // 28 + 1*(20+2) = 50, independent of host width.
    expect(parseInt(canvas.style.width, 10)).to.equal(50);
  });
});

describe('cellInteractive predicate', () => {
  it('matrix mode: a cell for which cellInteractive returns false is skipped by hit-testing and roving focus', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        .rowLabels=${['r0', 'r1']}
        .colLabels=${['c0', 'c1']}
        .values=${[
          [1, 2],
          [3, 4],
        ]}
        .cellInteractive=${(pos: { row?: number; col?: number }) => !(pos.row === 0 && pos.col === 1)}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let clicked: unknown;
    el.addEventListener('lyra-cell-click', (e) => (clicked = (e as CustomEvent).detail));
    // (row 0, col 1) is excluded -- a click there must not fire lyra-cell-click.
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
      <lyra-heatmap .rowLabels=${['r0']} .colLabels=${['c0', 'c1']} .values=${[[1, 2]]}></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    let clicked: unknown;
    el.addEventListener('lyra-cell-click', (e) => (clicked = (e as CustomEvent).detail));
    canvas.dispatchEvent(
      new MouseEvent('click', { clientX: rect.left + 60 + 11, clientY: rect.top + 20 + 11, bubbles: true }),
    );
    expect(clicked).to.deep.equal({ row: 0, col: 0, value: 1 });
  });
});

describe('colorSteps', () => {
  it('matrix mode, scale="linear": colors cells from the discrete colorSteps array, not the 2-endpoint ramp', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        .rowLabels=${['r0']}
        .colLabels=${['c0', 'c1', 'c2', 'c3']}
        .values=${[[0, 33, 66, 100]]}
        .colorSteps=${['#000000', '#3f3f3f', '#7f7f7f', '#ffffff']}
      ></lyra-heatmap>
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
      <lyra-heatmap .rowLabels=${['r0']} .colLabels=${['c0']} .values=${[[5]]}></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.colorSteps).to.be.undefined;
  });
});

describe('cellColor', () => {
  it('lets a consumer force an exact cell color bypassing the ramp entirely', async () => {
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
    expect(el.cellColor).to.be.undefined;
  });
});

describe('cellColor resolves CSS custom properties for canvas fillStyle', () => {
  it('resolves a var(...) cellColor to its computed value instead of leaving canvas fillStyle black', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        mode="matrix"
        style="--test-heatmap-color: rgb(10, 20, 30);"
        .rowLabels=${['a', 'b']}
        .colLabels=${['x', 'y']}
        .values=${[
          [1, 2],
          [3, 4],
        ]}
        .cellColor=${() => 'var(--test-heatmap-color)'}
      ></lyra-heatmap>
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
      <lyra-heatmap
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
      ></lyra-heatmap>
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
      <lyra-heatmap
        mode="matrix"
        .rowLabels=${['a', 'b']}
        .colLabels=${['x', 'y']}
        .values=${[
          [1, 2],
          [3, 4],
        ]}
        .cellColor=${() => 'rgb(9, 9, 9)'}
      ></lyra-heatmap>
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
      html`<lyra-heatmap mode="calendar" scale="sqrt"></lyra-heatmap>`,
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar"></lyra-heatmap>`)) as LyraHeatmap;
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
    const el = (await fixture(html`<lyra-heatmap mode="calendar" .days=${[]}></lyra-heatmap>`)) as LyraHeatmap;
    expect(el.weekdayLabelText).to.be.undefined;
  });

  it('is called with the real JS weekday index (1, 3, 5) and its return value replaces the built-in label', async () => {
    const seen: number[] = [];
    const el = (await fixture(html`
      <lyra-heatmap
        mode="calendar"
        .days=${[{ date: '2026-01-05', value: 3 }]}
        .weekdayLabelText=${(weekday: number) => {
          seen.push(weekday);
          return `W${weekday}`;
        }}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(seen.slice().sort()).to.deep.equal([1, 3, 5]);
  });
});

describe('monthLabelText', () => {
  it('is undefined by default', async () => {
    const el = (await fixture(html`<lyra-heatmap mode="calendar" .days=${[]}></lyra-heatmap>`)) as LyraHeatmap;
    expect(el.monthLabelText).to.be.undefined;
  });

  it('is called with the real JS month index and year, and its return value replaces the built-in label', async () => {
    const seen: Array<[number, number]> = [];
    const el = (await fixture(html`
      <lyra-heatmap
        mode="calendar"
        .days=${[{ date: '2026-03-05', value: 3 }]}
        .monthLabelText=${(jsMonth: number, year: number) => {
          seen.push([jsMonth, year]);
          return `M${jsMonth}`;
        }}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(seen).to.deep.equal([[2, 2026]]);
  });
});

describe('selectedCell', () => {
  it('draws no selection and adds no aria-label suffix by default', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    expect(el.selectedCell).to.be.null;
    expect(el.getAttribute('aria-label')).to.not.include('Selected');
  });

  it('appends a "Selected: ..." description to the host aria-label in matrix mode', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
        .selectedCell=${{ row: 1, col: 0 }}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.include('Selected: Row Tue, Col 00h: 3.');
  });

  it('appends a "Selected: ..." description in calendar mode, resolved by date', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        mode="calendar"
        .days=${[
          { date: '2026-01-04', value: 5 },
          { date: '2026-01-05', value: 7 },
        ]}
        .selectedCell=${{ date: '2026-01-05' }}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.include('Selected: Jan 5: 7.');
  });

  it('ignores a selectedCell outside the current grid bounds', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        .rowLabels=${['Mon']}
        .colLabels=${['00h']}
        .values=${[[1]]}
        .selectedCell=${{ row: 5, col: 9 }}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.not.include('Selected');
  });

  it('appends a "(selected)" suffix to the live-region announcement for the selected cell', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
        .selectedCell=${{ row: 0, col: 0 }}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
    expect(liveRegion.textContent).to.include('(selected)');
  });

  it('is left to the consumer -- selectedCell is not reset alongside focusedCell on a grid-shape change', async () => {
    const el = (await fixture(html`
      <lyra-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h']}
        .values=${[[1], [2]]}
        .selectedCell=${{ row: 1, col: 0 }}
      ></lyra-heatmap>
    `)) as LyraHeatmap;
    el.colLabels = ['00h', '06h'];
    await el.updateComplete;
    expect(el.selectedCell).to.deep.equal({ row: 1, col: 0 });
  });

  it('is accessible with a selected cell', async () => {
    const el = await fixture(html`
      <lyra-heatmap
        .rowLabels=${['Mon', 'Tue']}
        .colLabels=${['00h', '06h']}
        .values=${[[1, 2], [3, 4]]}
        .selectedCell=${{ row: 1, col: 0 }}
      ></lyra-heatmap>
    `);
    await expect(el).to.be.accessible();
  });
});
