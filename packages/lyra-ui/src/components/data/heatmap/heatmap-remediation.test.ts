import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import './heatmap.js';
import { resolveRgb, type CalendarCellPos, type LyraHeatmap, type MatrixCellPos } from './heatmap.js';

type MatrixData = Extract<LyraHeatmap['data'], { kind: 'matrix' }>;
function pixel(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const dpr = window.devicePixelRatio || 1;
  return [...canvas.getContext('2d')!.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data];
}
/** A resize notification and the draw it schedules each take one frame, so frames (not a sleep) settle the draw loop. */
async function settleFrames(frames = 4): Promise<void> {
  for (let frame = 0; frame < frames; frame++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

let warningAttempt = 0;
it('gates invalid authored color warnings in production without consuming development diagnostics', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'litIssuedWarnings');
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    Object.defineProperty(globalThis, 'litIssuedWarnings', { configurable: true, writable: true, value: undefined });
    const color = `remediation-invalid-authored-color-${warningAttempt++}`;
    expect(resolveRgb(color, '#123456')).to.deep.equal([18, 52, 86, 1]);
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap style=${`--lr-heatmap-scale-lo: ${color}-rendered`}
      .data=${{ kind: 'matrix', rowLabels: ['Row'], colLabels: ['Value'], values: [[1]] }}
    ></lr-heatmap>`);
    await waitUntil(() => element.matrixGeometry !== undefined);
    expect(warnings.length).to.equal(0);
    const reference = await fixture<LyraHeatmap>(html`<lr-heatmap style="--lr-heatmap-scale-lo: #cde2fb" .data=${element.data}></lr-heatmap>`);
    const geometry = element.matrixGeometry!;
    const x = geometry.padLeft + geometry.cellSize / 2;
    const y = geometry.padTop + geometry.cellSize / 2;
    expect(pixel(element.shadowRoot!.querySelector('canvas')!, x, y)).to.deep.equal(pixel(reference.shadowRoot!.querySelector('canvas')!, x, y));
    Object.defineProperty(globalThis, 'litIssuedWarnings', { configurable: true, writable: true, value: new Set<string>() });
    expect(resolveRgb(color, '#123456')).to.deep.equal([18, 52, 86, 1]);
    resolveRgb(color, '#123456');
    expect(warnings.length).to.equal(1);
    expect(warnings[0]?.join(' ')).to.contain(color);
    expect(resolveRgb('rgb(1, 2, 3)', '#123456')).to.deep.equal([1, 2, 3, 1]);
    expect(warnings.length).to.equal(1);
  } finally {
    console.warn = originalWarn;
    if (descriptor) Object.defineProperty(globalThis, 'litIssuedWarnings', descriptor);
    else Reflect.deleteProperty(globalThis, 'litIssuedWarnings');
  }
});

for (const axis of ['domain', 'midpoint'] as const) {
  for (const missing of ['absent', 'undefined', 'null'] as const) {
    it(`preserves ${missing} matrix no-data across live ${axis} changes in paint, text, callbacks and events`, async () => {
      const values: (number | null | undefined)[] = missing === 'absent' ? [] : [missing === 'null' ? null : undefined];
      values[1] = -2;
      const data = { kind: 'matrix', rowLabels: ['Row'], colLabels: ['Missing', 'Negative'], values: [values] } as unknown as MatrixData;
      const callbackValues: number[] = [];
      const element = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${data}
        .cellColor=${(pos: { row?: number; col?: number }, value: number) => { if (pos.col === 0) callbackValues.push(value); return undefined; }}
      ></lr-heatmap>`);
      const canvas = element.shadowRoot!.querySelector('canvas')!;
      await waitUntil(() => element.matrixGeometry !== undefined);
      const geometry = element.matrixGeometry!;
      const sample = () => pixel(canvas, geometry.padLeft + geometry.cellSize / 2, geometry.padTop + geometry.cellSize / 2);
      const initialPixel = sample();
      const cells = () => [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
      expect(cells()[0]!.getAttribute('aria-label')).to.contain('no data');
      expect(callbackValues.at(-1)).to.equal(-1);
      const events: number[] = [];
      element.addEventListener('lr-cell-activate', (event) => events.push((event as CustomEvent<{ value: number }>).detail.value));
      cells()[0]!.click();
      expect(events.at(-1)).to.equal(-1);
      if (axis === 'domain') element.domain = [-5, 5];
      else element.midpoint = 0;
      await element.updateComplete;
      expect(element.data === data).to.equal(true);
      expect(cells()[0]!.getAttribute('aria-label')).to.contain('no data');
      expect(cells()[1]!.getAttribute('aria-label')).to.contain('-2');
      expect(Number.isNaN(callbackValues.at(-1))).to.equal(true);
      // Sample away from the focus ring introduced by the preceding click.
      expect(sample()).to.deep.equal(initialPixel);
      cells()[0]!.click();
      expect(Number.isNaN(events.at(-1))).to.equal(true);
      if (axis === 'domain') element.domain = undefined;
      else element.midpoint = undefined;
      await element.updateComplete;
      expect(cells()[0]!.getAttribute('aria-label')).to.contain('no data');
      expect(callbackValues.at(-1)).to.equal(-1);
      cells()[0]!.click();
      expect(events.at(-1)).to.equal(-1);
    });
  }
}

for (const mode of ['matrix', 'calendar'] as const) {
  it(`restores the neighboring ${mode} fill when native keyboard focus moves`, async () => {
    const data: LyraHeatmap['data'] = mode === 'matrix'
      ? { kind: 'matrix', rowLabels: ['Row'], colLabels: ['First', 'Second'], values: [[1, 2]] }
      : { kind: 'calendar', firstDayOfWeek: 1, days: [{ date: '2026-09-07', value: 1 }, { date: '2026-09-14', value: 2 }] };
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${data}></lr-heatmap>`);
    const canvas = element.shadowRoot!.querySelector('canvas')!;
    await waitUntil(() => (element.matrixGeometry ?? element.calendarGeometry) !== undefined);
    await settleFrames();
    const geometry = element.matrixGeometry;
    const x = mode === 'matrix' ? geometry!.padLeft + geometry!.cellSize - 2 : 38;
    const y = mode === 'matrix' ? geometry!.padTop + geometry!.cellSize / 2 : 21;
    const initial = pixel(canvas, x, y);
    expect(initial[3]).to.equal(255);
    canvas.focus();
    expect(element.shadowRoot!.activeElement?.tagName).to.equal('CANVAS');
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    const afterFocus = pixel(canvas, x, y);
    expect(afterFocus).to.deep.equal(initial);
    element.colorSteps = [...(element.colorSteps ?? [])];
    await element.updateComplete;
    expect(pixel(canvas, x, y)).to.deep.equal(afterFocus);
  });
}

for (const mode of ['matrix', 'calendar'] as const) {
  it(`keeps ${mode} focus restoration bounded to a small neighborhood`, async () => {
    const data: LyraHeatmap['data'] = mode === 'matrix'
      ? { kind: 'matrix', rowLabels: Array.from({ length: 20 }, (_, index) => String(index)), colLabels: Array.from({ length: 20 }, (_, index) => String(index)), values: Array.from({ length: 20 }, () => Array<number>(20).fill(1)) }
      : { kind: 'calendar', firstDayOfWeek: 1, days: [{ date: '2026-09-07', value: 1 }, { date: '2027-06-07', value: 2 }] };
    let fills = 0;
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${data} .cellColor=${() => { fills++; return undefined; }}></lr-heatmap>`);
    await waitUntil(() => fills > 200);
    await settleFrames();
    fills = 0;
    const canvas = element.shadowRoot!.querySelector('canvas')!;
    canvas.focus();
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    await sendKeys({ press: 'ArrowRight' });
    await element.updateComplete;
    expect(fills).to.be.greaterThan(0);
    expect(fills).to.be.lessThan(100);
  });
}

for (const mode of ['matrix', 'calendar'] as const) {
  it(`matches full ${mode} repaint after native focus with fractional cell sizes and overlays`, async () => {
    const data: LyraHeatmap['data'] = mode === 'matrix'
      ? { kind: 'matrix', rowLabels: ['a', 'b', 'c'], colLabels: ['a', 'b', 'c'], values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }
      : { kind: 'calendar', firstDayOfWeek: 1, days: Array.from({ length: 14 }, (_, index) => ({ date: `2026-09-${String(7 + index).padStart(2, '0')}`, value: index })) };
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="4.5" .data=${data}
      .annotations=${mode === 'matrix' ? [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }] : [{ date: '2026-09-08' }]}
      .selectedCell=${mode === 'matrix' ? { row: 1, col: 1 } : { date: '2026-09-09' }}
    ></lr-heatmap>`);
    await compareFocusWithFullRepaint(element);
  });
}

for (const decoration of ['annotation', 'selection'] as const) {
  for (const cellSize of [1, 12]) {
    it(`omits ${decoration} rings on absent calendar records during ${cellSize}px focus repaint`, async () => {
      const element = await fixture<LyraHeatmap>(html`<lr-heatmap .cellSize=${cellSize}
        .data=${{ kind: 'calendar', firstDayOfWeek: 1, days: [{ date: '2026-09-07', value: 1 }, { date: '2026-09-14', value: 2 }] }}
        .annotations=${decoration === 'annotation' ? [{ date: '2026-09-08' }] : []}
        .selectedCell=${decoration === 'selection' ? { date: '2026-09-08' } : undefined}
      ></lr-heatmap>`);
      await compareFocusWithFullRepaint(element);
    });
  }
}

/**
 * Regression: the internal grid/canvas `aria-label` used `||` instead of a presence check, so an
 * author deliberately writing `aria-label=""` to suppress the generated label had it silently
 * replaced by `generatedAriaLabel` anyway (an empty string is falsy).
 */
it('keeps an explicit empty aria-label on the internal grid, in accessible-cells mode', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      accessible-cells
      aria-label=""
      .data=${{ kind: 'matrix', rowLabels: ['A'], colLabels: ['B'], values: [[1]] }}
    ></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('[role="grid"]')!;
  expect(grid.getAttribute('aria-label')).to.equal('');
});

it('keeps an explicit empty aria-label on the internal canvas, in canvas mode', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      aria-label=""
      .data=${{ kind: 'matrix', rowLabels: ['A'], colLabels: ['B'], values: [[1]] }}
    ></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.getAttribute('aria-label')).to.equal('');
});

/**
 * Regression: the canvas/cell hover ring used the generic `--lr-size-1px` token instead of the
 * documented `--lr-border-width-thin` retheme input, so retuning
 * `--lr-theme-border-width-thin` silently left the hover ring's thickness unchanged.
 */
it('tracks --lr-theme-border-width-thin for the canvas hover ring', async () => {
  const el = (await fixture(html`
    <lr-heatmap
      style="--lr-theme-border-width-thin: 4px"
      .data=${{ kind: 'matrix', rowLabels: ['A'], colLabels: ['B'], values: [[1]] }}
    ></lr-heatmap>
  `)) as LyraHeatmap;
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  try {
    await hoverUntilMatched(canvas, 'heatmap canvas is hovered');
    await waitUntil(
      () => getComputedStyle(canvas).outlineWidth === '4px',
      'canvas hover outline never tracked the retuned border-width token',
    );
  } finally {
    await resetMouse();
  }
});

async function compareFocusWithFullRepaint(element: LyraHeatmap): Promise<void> {
  const canvas = element.shadowRoot!.querySelector('canvas')!;
  await waitUntil(() => (element.matrixGeometry ?? element.calendarGeometry) !== undefined);
  await settleFrames();
  canvas.focus();
  await sendKeys({ press: 'ArrowRight' });
  await element.updateComplete;
  await sendKeys({ press: 'ArrowRight' });
  await element.updateComplete;
  const context = canvas.getContext('2d')!;
  const partial = context.getImageData(0, 0, canvas.width, canvas.height).data;
  element.colorSteps = [...(element.colorSteps ?? [])];
  await element.updateComplete;
  const full = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let differingPixels = 0;
  for (let index = 0; index < partial.length; index += 4) {
    if (partial.slice(index, index + 4).some((value, channel) => value !== full[index + channel])) differingPixels++;
  }
  expect(differingPixels).to.equal(0);
}

function yearOfDays(): { date: string; value: number }[] {
  return Array.from({ length: 365 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
    value: index % 9,
  }));
}

/** Counts the calls of one canvas context method made while `run` executes. */
async function countCanvasCalls(method: 'measureText' | 'fillText', run: () => unknown): Promise<number> {
  const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  const original = proto[method]!;
  let calls = 0;
  proto[method] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    calls++;
    return original.apply(this, args);
  };
  try {
    await run();
  } finally {
    proto[method] = original;
  }
  return calls;
}

function keydown(target: HTMLElement, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

function paintedAt(canvas: HTMLCanvasElement, cssX: number, cssY: number): number[] {
  const scale = canvas.width / Number.parseFloat(canvas.style.width);
  return [...canvas.getContext('2d')!.getImageData(Math.floor(cssX * scale), Math.floor(cssY * scale), 1, 1).data];
}

function expectBoundedBackingStore(canvas: HTMLCanvasElement): void {
  expect(canvas.width, 'backing width').to.be.within(1, 16_384);
  expect(canvas.height, 'backing height').to.be.within(1, 16_384);
  expect(canvas.width * canvas.height, 'backing pixels').to.be.at.most(16_777_216);
}

describe('oversized backing stores', () => {
  it('bounds a matrix wider than engine canvas limits, its frozen band and its PNG export, and still paints it', async () => {
    const cols = 1500;
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="40" sticky-labels="both"
      .cellColor=${() => 'rgb(10, 200, 30)'}
      .data=${{ kind: 'matrix', rowLabels: ['Row'], colLabels: Array.from({ length: cols }, (_, index) => String(index)), values: [Array<number>(cols).fill(1)] }}
    ></lr-heatmap>`);
    await waitUntil(() => element.matrixGeometry !== undefined);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    expectBoundedBackingStore(canvas);
    expectBoundedBackingStore(element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="col-labels"]')!);
    const { padLeft, padTop, cellSize } = element.matrixGeometry!;
    expect(paintedAt(canvas, padLeft + cellSize / 2, padTop + cellSize / 2)).to.deep.equal([10, 200, 30, 255]);
    expect(element.exportData('png')).to.match(/^data:image\/png;base64,/);
  });

  it('bounds a calendar whose backing store would exceed the pixel budget and still paints it', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="300"
      .cellColor=${() => 'rgb(10, 200, 30)'}
      .data=${{ kind: 'calendar', days: [{ date: '2026-01-01', value: 1 }, { date: '2026-12-31', value: 2 }] }}
    ></lr-heatmap>`);
    await waitUntil(() => element.calendarGeometry !== undefined);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    expectBoundedBackingStore(canvas);
    const { padLeft, padTop, cellSize } = element.calendarGeometry!;
    expect(paintedAt(canvas, padLeft + cellSize / 2, padTop + cellSize / 2)).to.deep.equal([10, 200, 30, 255]);
  });
});

describe('accessible calendar overlay', () => {
  async function accessibleCalendar(): Promise<LyraHeatmap> {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${{ kind: 'calendar', days: yearOfDays() }}></lr-heatmap>`);
    await waitUntil(() => element.calendarGeometry !== undefined);
    await settleFrames();
    return element;
  }

  function hover(element: LyraHeatmap, week: number, weekday: number): void {
    const { padLeft, padTop, cellSize, cellGapX, cellGapY } = element.calendarGeometry!;
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: rect.left + padLeft + week * (cellSize + cellGapX) + cellSize / 2,
      clientY: rect.top + padTop + weekday * (cellSize + cellGapY) + cellSize / 2,
    }));
  }

  it('formats cell dates through the shared formatter cache, not one new formatter per button', async () => {
    const original = Date.prototype.toLocaleString;
    let formatted = 0;
    Date.prototype.toLocaleString = function (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      if (options?.day !== undefined) formatted++;
      return original.call(this, locales, options);
    };
    try {
      await accessibleCalendar();
    } finally {
      Date.prototype.toLocaleString = original;
    }
    expect(formatted).to.equal(0);
  });

  it('leaves every accessible cell alone while only the hovered cell changes', async () => {
    const element = await accessibleCalendar();
    const internals = element as unknown as { isSelectedPos(pos: unknown): boolean };
    const realSelected = internals.isSelectedPos.bind(element);
    let buttonsRendered = 0;
    internals.isSelectedPos = (pos) => {
      buttonsRendered++;
      return realSelected(pos);
    };
    for (const [week, weekday] of [[2, 3], [3, 3], [3, 4]] as const) {
      hover(element, week, weekday);
      await element.updateComplete;
    }
    expect(element.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.hidden).to.equal(false);
    expect(buttonsRendered).to.equal(0);
  });

  it('does not rewrite the host role and name on a hover-only update', async () => {
    const element = await accessibleCalendar();
    let records = 0;
    const observer = new MutationObserver((list) => {
      records += list.length;
    });
    observer.observe(element, { attributes: true, attributeFilter: ['role', 'aria-label'] });
    try {
      hover(element, 2, 3);
      await element.updateComplete;
      hover(element, 3, 3);
      await element.updateComplete;
      records += observer.takeRecords().length;
    } finally {
      observer.disconnect();
    }
    expect(records).to.equal(0);
  });

  it('resolves calendar spacing once per overlay render, not once per button', async () => {
    const element = await accessibleCalendar();
    const internals = element as unknown as { calendarSpacing(): unknown };
    const realSpacing = internals.calendarSpacing.bind(element);
    let resolutions = 0;
    internals.calendarSpacing = () => {
      resolutions++;
      return realSpacing();
    };
    element.cellText = (pos) => ('date' in pos ? pos.date : '');
    await element.updateComplete;
    expect(resolutions).to.be.at.most(12);
  });
});

describe('label truncation and focus repaint cost', () => {
  it('finds the cut point of a long label with a logarithmic number of measurements', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap></lr-heatmap>`);
    const context = document.createElement('canvas').getContext('2d')!;
    const ellipsize = (element as unknown as {
      ellipsize(ctx: CanvasRenderingContext2D, label: string, maxWidth: number): string;
    }).ellipsize.bind(element);
    const label = 'W'.repeat(512);
    let shown = '';
    const measurements = await countCanvasCalls('measureText', () => {
      shown = ellipsize(context, label, 80);
    });
    let kept = 0;
    while (kept < label.length && context.measureText(`${label.slice(0, kept + 1)}…`).width <= 80) kept++;
    expect(shown).to.equal(`${label.slice(0, kept)}…`);
    expect(measurements).to.be.at.most(14);
  });

  it('repaints only the row labels beside the focused matrix cell', async () => {
    const rows = 300;
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${{
      kind: 'matrix',
      rowLabels: Array.from({ length: rows }, (_, index) => `A fairly long row label number ${index}`),
      colLabels: ['v'],
      values: Array.from({ length: rows }, () => [1]),
    }}></lr-heatmap>`);
    await waitUntil(() => element.matrixGeometry !== undefined);
    await settleFrames();
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const painted = await countCanvasCalls('fillText', async () => {
      keydown(canvas, 'ArrowDown');
      await element.updateComplete;
    });
    expect(painted).to.be.lessThan(10);
  });

  it('repaints no calendar axis label for a focus move that touches neither axis', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${{ kind: 'calendar', days: yearOfDays() }}></lr-heatmap>`);
    await waitUntil(() => element.calendarGeometry !== undefined);
    await settleFrames();
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const press = async (key: string): Promise<void> => {
      keydown(canvas, key);
      await element.updateComplete;
    };
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) await press(key);
    expect(await countCanvasCalls('fillText', () => press('ArrowRight'))).to.equal(0);
  });
});

describe('horizontal matrix column labels', () => {
  it('keeps every label inside its own column and inside the canvas', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${{
      kind: 'matrix',
      rowLabels: ['r'],
      colLabels: ['Monday', 'Tuesday', 'Wednesday'],
      values: [[1, 2, 3]],
    }}></lr-heatmap>`);
    await waitUntil(() => element.matrixGeometry !== undefined);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const context = canvas.getContext('2d')!;
    const original = context.fillText;
    const labels: { x: number; end: number }[] = [];
    context.fillText = ((text: string, x: number, y: number) => {
      if (y < element.matrixGeometry!.padTop) labels.push({ x, end: x + context.measureText(text).width });
      original.call(context, text, x, y);
    }) as typeof context.fillText;
    try {
      (element as unknown as { drawMatrix(): void }).drawMatrix();
    } finally {
      context.fillText = original;
    }
    expect(labels.length).to.be.greaterThan(0);
    labels.forEach((label, index) => {
      expect(label.end).to.be.at.most(labels[index + 1]?.x ?? Number.parseFloat(canvas.style.width));
    });
  });
});

describe('Home and End keys', () => {
  const announced = (element: LyraHeatmap): string | null =>
    element.shadowRoot!.querySelector('[part="live-region"]')!.textContent;

  it('moves along a matrix row skipping excluded cells, and to the first and last cell with Ctrl', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap
      .cellText=${(pos: MatrixCellPos | CalendarCellPos) => ('row' in pos ? `${pos.row},${pos.col}` : pos.date)}
      .cellInteractive=${(pos: MatrixCellPos | CalendarCellPos) =>
        !('row' in pos && pos.row === 1 && (pos.col === 0 || pos.col === 3))}
      .data=${{
        kind: 'matrix',
        rowLabels: ['a', 'b', 'c'],
        colLabels: ['w', 'x', 'y', 'z'],
        values: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]],
      }}
    ></lr-heatmap>`);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const step = async (key: string, init?: KeyboardEventInit): Promise<string | null> => {
      keydown(canvas, key, init);
      await element.updateComplete;
      return announced(element);
    };
    await step('ArrowDown');
    await step('ArrowRight');
    expect(await step('ArrowDown')).to.equal('1,1');
    expect(await step('End')).to.equal('1,2');
    expect(await step('Home')).to.equal('1,1');
    expect(await step('End', { ctrlKey: true })).to.equal('2,3');
    expect(await step('Home', { ctrlKey: true })).to.equal('0,0');
  });

  it('moves along a calendar weekday row and across the whole calendar', async () => {
    const days = Array.from({ length: 30 }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, value: 1 }));
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap
      .cellText=${(pos: MatrixCellPos | CalendarCellPos) => ('date' in pos ? pos.date : '')}
      .data=${{ kind: 'calendar', days }}
    ></lr-heatmap>`);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const step = async (key: string, init?: KeyboardEventInit): Promise<string | null> => {
      keydown(canvas, key, init);
      await element.updateComplete;
      return announced(element);
    };
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) await step(key);
    expect(await step('Home')).to.equal('2026-09-02');
    expect(await step('End')).to.equal('2026-09-30');
    expect(await step('Home', { ctrlKey: true })).to.equal('2026-08-30');
    expect(await step('End', { ctrlKey: true })).to.equal('2026-10-03');
  });

  it('extends a multiple-selection range to the row end with Shift+End', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap multiple .data=${{
      kind: 'matrix',
      rowLabels: ['a', 'b'],
      colLabels: ['w', 'x', 'y'],
      values: [[1, 2, 3], [4, 5, 6]],
    }}></lr-heatmap>`);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const proposals: unknown[] = [];
    element.addEventListener('lr-selection-change', (event) => proposals.push((event as CustomEvent).detail.selectedCells));
    keydown(canvas, 'ArrowDown');
    keydown(canvas, 'End', { shiftKey: true });
    await element.updateComplete;
    expect(proposals.at(-1)).to.deep.equal([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]);
  });

  it('moves between accessible cell buttons too', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${{
      kind: 'matrix',
      rowLabels: ['a', 'b'],
      colLabels: ['w', 'x', 'y'],
      values: [[1, 2, 3], [4, 5, 6]],
    }}></lr-heatmap>`);
    const button = (key: string) => element.shadowRoot!.querySelector<HTMLButtonElement>(`[data-cell-key="${key}"]`)!;
    button('matrix-1-1').focus();
    keydown(button('matrix-1-1'), 'End');
    await waitUntil(() => element.shadowRoot!.activeElement?.getAttribute('data-cell-key') === 'matrix-1-2');
    keydown(button('matrix-1-2'), 'Home', { ctrlKey: true });
    await waitUntil(() => element.shadowRoot!.activeElement?.getAttribute('data-cell-key') === 'matrix-0-0');
  });
});

describe('theme invalidation', () => {
  async function themed(content: ReturnType<typeof html>): Promise<{ wrapper: HTMLElement; element: LyraHeatmap }> {
    const wrapper = await fixture<HTMLElement>(content);
    const element = wrapper.querySelector('lr-heatmap') as LyraHeatmap;
    await waitUntil(() => element.matrixGeometry !== undefined);
    await settleFrames();
    return { wrapper, element };
  }
  const data = { kind: 'matrix', rowLabels: ['a'], colLabels: ['x', 'y'], values: [[1, 9]] } as const;

  it('redraws only when a theme token the canvas reads changes', async () => {
    const { wrapper, element } = await themed(html`<div><lr-heatmap .data=${data}></lr-heatmap></div>`);
    let draws = 0;
    const internals = element as unknown as { draw(): void };
    const realDraw = internals.draw.bind(element);
    internals.draw = () => {
      draws++;
      realDraw();
    };
    wrapper.style.setProperty('--unrelated-heatmap-test-property', '1');
    await settleFrames();
    expect(draws, 'an unrelated ancestor style write repaints nothing').to.equal(0);
    wrapper.style.setProperty('--lr-heatmap-scale-hi', 'rgb(200, 0, 0)');
    await waitUntil(() => draws > 0, 'a changed ramp token repaints', { timeout: 5000 });
  });

  it('still repaints a cellColor that reads a custom property when an ancestor changes it', async () => {
    const { wrapper, element } = await themed(html`<div style="--test-cell-color: rgb(10, 20, 30)">
      <lr-heatmap .cellColor=${() => 'var(--test-cell-color)'} .data=${data}></lr-heatmap></div>`);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    expect(pixel(canvas, 65, 25).slice(0, 3)).to.deep.equal([10, 20, 30]);
    wrapper.style.setProperty('--test-cell-color', 'rgb(40, 50, 60)');
    await waitUntil(() => pixel(canvas, 65, 25)[0] === 40, 'the theme repaint', { timeout: 5000 });
  });

  it('still repaints colorSteps that reference a custom property when an ancestor changes it', async () => {
    const { wrapper, element } = await themed(html`<div style="--test-step-lo: rgb(10, 20, 30)">
      <lr-heatmap .colorSteps=${['var(--test-step-lo)', 'rgb(250, 250, 250)']} .data=${data}></lr-heatmap></div>`);
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    expect(pixel(canvas, 65, 25).slice(0, 3)).to.deep.equal([10, 20, 30]);
    wrapper.style.setProperty('--test-step-lo', 'rgb(40, 50, 60)');
    await waitUntil(() => pixel(canvas, 65, 25)[0] === 40, 'the theme repaint', { timeout: 5000 });
  });
});

describe('drag selection', () => {
  it('previews a drag incrementally: one preview map, no full redraw per crossed cell, the pixels of a full draw', async () => {
    const labels = Array.from({ length: 10 }, (_, index) => String(index));
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap multiple .data=${{
      kind: 'matrix',
      rowLabels: labels,
      colLabels: labels,
      values: labels.map(() => labels.map(() => 1)),
    }}></lr-heatmap>`);
    await waitUntil(() => element.matrixGeometry !== undefined);
    await settleFrames();
    const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const { padLeft, padTop, cellSize } = element.matrixGeometry!;
    const rect = canvas.getBoundingClientRect();
    const pointer = (type: string, col: number): void => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        isPrimary: true,
        pointerId: 7,
        pointerType: 'mouse',
        clientX: rect.left + padLeft + col * cellSize + cellSize / 2,
        clientY: rect.top + padTop + cellSize / 2,
      }));
    };
    pointer('pointerdown', 0);
    await element.updateComplete;
    await settleFrames();
    const internals = element as unknown as { drawMatrix(): void; selectionPreview?: ReadonlyMap<string, unknown> };
    const realDraw = internals.drawMatrix.bind(element);
    let draws = 0;
    internals.drawMatrix = () => {
      draws++;
      realDraw();
    };
    const previews = new Set<unknown>();
    for (let col = 1; col <= 5; col++) {
      pointer('pointermove', col);
      await element.updateComplete;
      previews.add(internals.selectionPreview);
    }
    expect(previews.size, 'one preview map for the whole drag').to.equal(1);
    expect(draws, 'no full redraw per crossed cell').to.equal(0);
    const context = canvas.getContext('2d')!;
    const incremental = context.getImageData(0, 0, canvas.width, canvas.height).data;
    realDraw();
    const full = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let differing = 0;
    for (let index = 0; index < full.length; index += 4) {
      if (incremental.slice(index, index + 4).some((value, channel) => value !== full[index + channel])) differing++;
    }
    expect(differing).to.equal(0);
    pointer('pointerup', 5);
  });
});

describe('PNG export while a redraw is pending', () => {
  it('returns no image for a heatmap whose redraw is waiting for visibility', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${{ kind: 'matrix', rowLabels: ['a'], colLabels: ['x'], values: [[1]] }}></lr-heatmap>`);
    await waitUntil(() => element.matrixGeometry !== undefined);
    expect(element.exportData('png')).to.match(/^data:image\/png;base64,/);
    const internals = element as unknown as { canvasVisible: boolean };
    internals.canvasVisible = false;
    element.data = { kind: 'matrix', rowLabels: ['a'], colLabels: ['x'], values: [[2]] };
    await element.updateComplete;
    expect(element.exportData('png')).to.equal('');
    internals.canvasVisible = true;
    element.refreshTheme();
    expect(element.exportData('png')).to.match(/^data:image\/png;base64,/);
  });
});

describe('owner-window computed style', () => {
  it('measures an auto label gutter through the window that owns the heatmap', async () => {
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap row-label-width="auto" col-label-height="auto" .data=${{ kind: 'matrix', rowLabels: ['a'], colLabels: ['x'], values: [[1]] }}></lr-heatmap>`);
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const original = window.getComputedStyle;
    let calls = 0;
    try {
      iframe.contentDocument!.adoptNode(element);
      iframe.contentDocument!.body.append(element);
      await element.updateComplete;
      window.getComputedStyle = ((...args: Parameters<typeof original>) => {
        calls++;
        return original.apply(window, args);
      }) as typeof original;
      (element as unknown as { drawMatrix(): void }).drawMatrix();
    } finally {
      window.getComputedStyle = original;
      iframe.remove();
    }
    expect(calls).to.equal(0);
  });
});
