import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.class.js';
import type { LyraHeatmapMatrixSource } from './heatmap-matrix-source.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const matrix = { kind: 'matrix' as const, rowLabels: ['A', 'B'], colLabels: ['X', 'Y'], values: [[0.0004, 2], [3, 4]] };
const canvasOf = (el: LyraHeatmap) => el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
const key = (target: HTMLElement, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('heatmap keyboard guards', () => {
  it('leaves modified and composing grid keys to the browser', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${matrix}></lr-heatmap>`);
    const canvas = canvasOf(el);
    await focusByKeyboard(canvas);
    const modified: KeyboardEventInit[] = [
      { key: 'ArrowRight', altKey: true },
      { key: 'ArrowRight', ctrlKey: true },
      { key: 'Enter', metaKey: true },
      { key: 'ArrowDown', isComposing: true },
    ];
    expect(modified.map((init) => key(canvas, init).defaultPrevented).every((value) => value === false)).to.equal(true);
    expect(key(canvas, { key: 'ArrowRight' }).defaultPrevented).to.equal(true);
  });
});

describe('heatmap values and labels', () => {
  it('keeps the significant digits of a small cell value in its accessible name', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap .accessibleCells=${true} .data=${matrix}></lr-heatmap>`);
    const names = [...el.shadowRoot!.querySelectorAll('[part="cell"]')].map((cell) => cell.getAttribute('aria-label') ?? '');
    expect(names.some((name) => name.includes('0.0004'))).to.equal(true);
  });

  it('labels calendar cells with Gregorian month names whatever the locale default calendar', async () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-01-${String(i + 4).padStart(2, '0')}`, value: i + 1 }));
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap locale="en-US-u-ca-islamic" .accessibleCells=${true} .data=${{ kind: 'calendar', days }}></lr-heatmap>`);
    const expected = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', calendar: 'gregory', timeZone: 'UTC' })
      .format(new Date('2026-01-04T00:00:00Z'));
    const names = [...el.shadowRoot!.querySelectorAll('[part="cell"]')].map((cell) => cell.getAttribute('aria-label') ?? '');
    expect(names.some((name) => name.includes(expected))).to.equal(true);
  });
});

describe('heatmap matrix-source tooltip', () => {
  it('opens beside the pointer instead of the base corner', async () => {
    const source: LyraHeatmapMatrixSource = {
      revision: 1, rowCount: 50, columnCount: 40, domain: { min: 0.0004, max: 0.0004 },
      query(request) {
        const { rowStart, rowEnd, columnStart, columnEnd } = request;
        const count = (rowEnd - rowStart) * (columnEnd - columnStart);
        return [{ rowStart, rowEnd, columnStart, columnEnd, count, validCount: count, min: 0.0004, max: 0.0004, sum: count * 0.0004 }];
      },
      getCell: (row, column) => ({ value: 0.0004, rowLabel: `R${row}`, columnLabel: `C${column}` }),
    };
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px" .matrixSource=${source}></lr-heatmap>`);
    await waitUntil(() => el.shadowRoot?.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
    const canvas = canvasOf(el);
    const bounds = canvas.getBoundingClientRect();
    const x = bounds.left + bounds.width * 0.75;
    const y = bounds.top + bounds.height * 0.75;
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
    await waitUntil(() => el.shadowRoot!.querySelector('[part="tooltip"]') !== null);
    const tip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
    expect(tip.textContent).to.contain('0.0004');
    const tooltipBounds = tip.getBoundingClientRect();
    expect(Math.abs(tooltipBounds.left + tooltipBounds.width / 2 - x) < 4).to.equal(true);
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: bounds.right + 10, clientY: y }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]') === null).to.equal(true);
  });
});

it('leaves modified keys to the browser on accessible cells', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .accessibleCells=${true} .data=${matrix}></lr-heatmap>`);
  const cell = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cell"]')!;
  await focusByKeyboard(cell);
  expect(key(cell, { key: 'ArrowRight', altKey: true }).defaultPrevented).to.equal(false);
  expect(el.shadowRoot!.activeElement === cell).to.equal(true);
});

it('dismisses a matrix hover tooltip on Escape without moving focus', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${matrix}></lr-heatmap>`);
  const canvas = canvasOf(el);
  await focusByKeyboard(canvas);
  await waitUntil(() => canvas.width > 1);
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + box.width - 8, clientY: box.top + box.height - 8 }));
  const tooltip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
  await waitUntil(() => !tooltip.hidden, 'hover tooltip did not open');
  key(canvas, { key: 'Escape' });
  await el.updateComplete;
  expect(tooltip.hidden).to.equal(true);
  expect(el.shadowRoot!.activeElement === canvas).to.equal(true);
});

it('keeps data paint visible in forced colors', async () => {
  await setForcedColors('active');
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-heatmap .data=${matrix} .legendStops=${[{ label: 'Critical', color: 'rgb(25, 70, 140)' }]}></lr-heatmap></div>`);
    const el = wrapper.firstElementChild!;
    const swatch = getComputedStyle(el.shadowRoot!.querySelector('[part="legend-swatch"]')!);
    expect(swatch.backgroundColor).to.equal('rgb(25, 70, 140)');
    expect(swatch.outlineStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});

it('removes the drawn focus ring on blur and redraws it on refocus', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-heatmap cell-size="30" .data=${matrix}></lr-heatmap><button type="button">Other</button>
  </div>`);
  const el = wrapper.querySelector('lr-heatmap')!;
  const canvas = canvasOf(el);
  await focusByKeyboard(canvas);
  await waitUntil(() => el.exportData('png') !== '');
  const initial = el.exportData('png');
  key(canvas, { key: 'ArrowRight' });
  await waitUntil(() => el.exportData('png') !== initial);
  const focused = el.exportData('png');
  expect(focused.length).to.be.greaterThan(0);
  await focusByKeyboard(wrapper.querySelector('button')!);
  await waitUntil(() => el.exportData('png') !== focused);
  expect(el.exportData('png').length).to.be.greaterThan(0);
  await focusByKeyboard(canvas);
  await waitUntil(() => el.exportData('png') === focused);
});
