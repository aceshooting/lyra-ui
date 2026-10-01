import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

function canvas(el: LyraHeatmap): HTMLCanvasElement {
  return el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
}
function draw(el: LyraHeatmap): void {
  (el as unknown as { drawMatrix(): void }).drawMatrix();
}
const dense = {
  kind: 'matrix' as const,
  rowLabels: Array.from({ length: 20 }, (_, row) => `Row ${row + 1}`),
  colLabels: Array.from({ length: 144 }, (_, col) => `Column ${col + 1}`),
  values: Array.from({ length: 20 }, () => Array.from({ length: 144 }, (_, col) => col + 1)),
};
it('fits 144 columns while retaining independently readable row pitch across resize', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap fit-to-width row-height="28"
    style="inline-size:1500px;max-inline-size:none" .data=${dense}></lr-heatmap>`);
  draw(el);
  expect(el.rowHeight).to.equal(28);
  expect(Number.parseFloat(canvas(el).style.width)).to.equal(1500);
  expect(Number.parseFloat(canvas(el).style.height)).to.equal(580);
  expect(el.matrixGeometry).to.include({ cellSize: 10, rowHeight: 28, cellWidth: 9, cellHeight: 27 });
  expect(el.shadowRoot!.querySelectorAll('[part="grid"]').length).to.equal(0);
  el.style.inlineSize = '320px';
  draw(el);
  expect(el.matrixGeometry).to.include({ cellSize: 4, rowHeight: 28 });
  expect(Number.parseFloat(canvas(el).style.height)).to.equal(580);
});
it('restores square rows when the optional row-height attribute is removed', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="24" row-height="40"
    .data=${{ kind: 'matrix', rowLabels: ['One', 'Two'], colLabels: ['A'], values: [[1], [2]] }}></lr-heatmap>`);
  draw(el);
  expect(Number.parseFloat(canvas(el).style.height)).to.equal(100);
  el.removeAttribute('row-height');
  await el.updateComplete;
  draw(el);
  expect(el.rowHeight).to.equal(undefined);
  expect(el.matrixGeometry).to.deep.equal({ padLeft: 60, padTop: 20, cellSize: 24 });
  expect(Number.parseFloat(canvas(el).style.height)).to.equal(68);
});

const small = {
  kind: 'matrix' as const, rowLabels: ['First row', 'Last row'], colLabels: ['First column', 'Last column'],
  values: [[1, 2], [3, -1]],
};
async function rectangular(width: number, height: number): Promise<LyraHeatmap> {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size=${width} row-height=${height}
    .data=${small} .cellColor=${() => 'rgb(20,100,180)'}></lr-heatmap>`);
  draw(el);
  return el;
}
function click(el: LyraHeatmap, x: number, y: number): void {
  const target = canvas(el);
  const box = target.getBoundingClientRect();
  target.dispatchEvent(new MouseEvent('click', { clientX: box.left + x, clientY: box.top + y, bubbles: true }));
}
function alpha(el: LyraHeatmap, x: number, y: number): number {
  const target = canvas(el);
  const dpr = target.width / Number.parseFloat(target.style.width);
  return target.getContext('2d')!.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data[3]!;
}
for (const direction of ['ltr', 'rtl']) {
  for (const [width, height] of [[10, 48], [60, 12]]) {
    it(`keeps ${width}×${height} painted cells, tooltip anchors and pointer targets aligned in ${direction}`, async () => {
      const el = await rectangular(width!, height!);
      el.dir = direction;
      el.cellGapX = 3;
      el.cellGapY = 4;
      el.cellRadius = 2;
      el.cellInteractive = (_pos, value) => value >= 0;
      await el.updateComplete;
      draw(el);
      expect(el.matrixGeometry).to.include({ cellSize: width, rowHeight: height, cellWidth: width! - 3, cellHeight: height! - 4, cellRadius: 2 });
      expect(alpha(el, 63, 23)).to.equal(255);
      expect(alpha(el, 60 + width! - 2, 23)).to.equal(0);
      expect(alpha(el, 63, 20 + height! - 2)).to.equal(0);
      const activations: unknown[] = [];
      el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
      click(el, 63, 23);
      click(el, 60 + width! + 3, 23);
      click(el, 63, 20 + height! + 3);
      click(el, 60 + width! + 3, 20 + height! + 3);
      click(el, 60 + width! - 2, 23);
      click(el, 63, 20 + height! - 2);
      expect(activations).to.deep.equal([
        { row: 0, col: 0, value: 1 }, { row: 0, col: 1, value: 2 }, { row: 1, col: 0, value: 3 },
      ]);
      const box = canvas(el).getBoundingClientRect();
      canvas(el).dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + 63, clientY: box.top + 20 + height! + 3 }));
      await el.updateComplete;
      const tooltip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
      expect(tooltip.hidden).to.equal(false);
      expect(Number.parseFloat(tooltip.style.top)).to.equal(20 + height!);
      expect(tooltip.textContent).to.include('Last row');
      el.data = { kind: 'matrix', rowLabels: ['Only'], colLabels: ['Only'], values: [[8]] };
      await el.updateComplete;
      draw(el);
      expect(Number.parseFloat(canvas(el).style.height)).to.equal(20 + height!);
      expect(el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.hidden).to.equal(true);
    });
  }
}
it('keeps square defaults and equal explicit row height byte-identical and normalizes optional values', async () => {
  const el = await rectangular(24, 24);
  const square = canvas(el).toDataURL();
  expect(el.matrixGeometry).to.deep.equal({ padLeft: 60, padTop: 20, cellSize: 24 });
  for (const value of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    el.rowHeight = value;
    await el.updateComplete;
    draw(el);
    expect(el.rowHeight).to.equal(undefined);
    expect(el.matrixGeometry).to.deep.equal({ padLeft: 60, padTop: 20, cellSize: 24 });
    expect(canvas(el).toDataURL() === square).to.equal(true);
  }
  for (const value of [0, -1, -100]) {
    el.rowHeight = value;
    await el.updateComplete;
    draw(el);
    expect(el.rowHeight).to.equal(1);
    expect(el.matrixGeometry).to.include({ rowHeight: 1, cellHeight: 1 });
    expect(Number.parseFloat(canvas(el).style.height)).to.equal(22);
  }
  el.rowHeight = 28.5;
  await el.updateComplete;
  draw(el);
  expect(el.matrixGeometry).to.include({ rowHeight: 28.5, cellHeight: 27.5 });
  for (const attribute of ['', ' ', 'NaN', 'Infinity', 'auto', 'garbage']) {
    el.setAttribute('row-height', attribute);
    await el.updateComplete;
    draw(el);
    expect(el.rowHeight).to.equal(undefined);
    expect(canvas(el).toDataURL() === square).to.equal(true);
  }
});
it('ignores row height in calendar mode and restores it on a matrix mode switch', async () => {
  const el = await rectangular(24, 48);
  el.data = { kind: 'calendar', days: [{ date: '2026-09-07', value: 1 }] };
  await el.updateComplete;
  const drawCalendar = () => (el as unknown as { drawCalendar(): void }).drawCalendar();
  drawCalendar();
  const original = canvas(el).toDataURL();
  const geometry = el.calendarGeometry;
  el.rowHeight = 80;
  await el.updateComplete;
  drawCalendar();
  expect(canvas(el).toDataURL() === original).to.equal(true);
  expect(el.calendarGeometry === geometry).to.equal(true);
  el.data = small;
  await el.updateComplete;
  draw(el);
  expect(el.matrixGeometry).to.include({ rowHeight: 80 });
});
it('defers geometry changes until painting and keeps frozen snapshot/event identities stable', async () => {
  const el = await rectangular(24, 48);
  const previous = el.matrixGeometry;
  const internals = el as unknown as { canvasVisible: boolean };
  internals.canvasVisible = false;
  const events: unknown[] = [];
  el.addEventListener('lr-matrix-geometry-change', event => events.push(event.detail));
  el.rowHeight = 64;
  await el.updateComplete;
  expect(el.matrixGeometry === previous).to.equal(true);
  expect(Number.parseFloat(canvas(el).style.height)).to.equal(116);
  expect(events.length).to.equal(0);
  draw(el);
  expect(events.length).to.equal(1);
  expect(events[0] === el.matrixGeometry).to.equal(true);
  expect(Object.isFrozen(events[0])).to.equal(true);
  draw(el);
  expect(events.length).to.equal(1);
  internals.canvasVisible = true;
});

for (const [width, height] of [[4, 60], [60, 4]]) {
  it(`keeps partial focus painting equal to a full repaint for ${width}×${height} cells`, async () => {
    const el = await rectangular(width!, height!);
    el.cellGapX = 1;
    el.cellGapY = 2;
    el.cellRadius = 2;
    el.selectedCell = { row: 0, col: 0 };
    el.annotations = [{ row: 1, col: 1, label: 'Check' }];
    await el.updateComplete;
    const internals = el as unknown as {
      focusedCell: { row: number; col: number } | null;
      repaintMatrixFocusCell(pos: { row: number; col: number }): void;
    };
    internals.focusedCell = { row: 0, col: 0 };
    draw(el);
    internals.focusedCell = { row: 1, col: 1 };
    internals.repaintMatrixFocusCell({ row: 0, col: 0 });
    internals.repaintMatrixFocusCell({ row: 1, col: 1 });
    const partial = canvas(el).getContext('2d')!.getImageData(0, 0, canvas(el).width, canvas(el).height).data;
    draw(el);
    const full = canvas(el).getContext('2d')!.getImageData(0, 0, canvas(el).width, canvas(el).height).data;
    const changed: number[][] = [];
    for (let index = 0; index < partial.length; index += 4) {
      if ([0, 1, 2, 3].some(channel => partial[index + channel] !== full[index + channel]))
        changed.push([index / 4 % canvas(el).width, Math.floor(index / 4 / canvas(el).width), ...partial.slice(index, index + 4), ...full.slice(index, index + 4)]);
    }
    expect(changed.slice(0, 12)).to.deep.equal([]);
  });
}
it('honors independent accessible target floors with reachable semantic cells and frozen painted bounds', async () => {
  const el = await rectangular(10, 100);
  el.style.setProperty('--lr-icon-button-size', '40px');
  el.accessibleCells = true;
  el.cellGapY = 10;
  el.stickyLabels = 'both';
  await el.updateComplete;
  draw(el);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 4);
  await el.updateComplete;
  expect(el.matrixGeometry).to.include({ cellSize: 41, rowHeight: 100, cellWidth: 40, cellHeight: 90 });
  const cells = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
  const first = cells[0]!.getBoundingClientRect();
  const last = cells[3]!.getBoundingClientRect();
  expect(first.width).to.equal(40);
  expect(first.height).to.equal(90);
  expect(last.top - first.top).to.equal(100);
  expect(last.left - first.left).to.equal(41);
  await focusByKeyboard(cells[0]!);
  cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('data-cell-key') === 'matrix-1-0');
  expect(el.shadowRoot!.activeElement?.getAttribute('data-cell-key')).to.equal('matrix-1-0');
  await expect(el).to.be.accessible();
  const internals = el as unknown as { canvasVisible: boolean };
  internals.canvasVisible = false;
  el.rowHeight = 48;
  await el.updateComplete;
  expect(cells[0]!.getBoundingClientRect().height).to.equal(90);
  draw(el);
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cell"]')!.getBoundingClientRect().height === 40);
  expect(el.matrixGeometry).to.include({ cellSize: 41, rowHeight: 50, cellHeight: 40 });
  internals.canvasVisible = true;
});
it('keeps vertical keyboard reveal and row/column selection aligned with rectangular cells', async () => {
  const el = await rectangular(10, 60);
  el.data = {
    kind: 'matrix', rowLabels: ['A', 'B', 'C', 'D'], colLabels: ['First', 'Last'],
    values: [[1, 2], [3, 4], [5, 6], [7, 8]],
  };
  el.stickyLabels = 'both';
  el.multiple = true;
  el.style.setProperty('--lr-heatmap-grid-max-block-size', '100px');
  await el.updateComplete;
  draw(el);
  const rowBand = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="row-labels"]')!;
  const colBand = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="col-labels"]')!;
  expect(Number.parseFloat(rowBand.style.height)).to.equal(260);
  expect(Number.parseFloat(colBand.style.width)).to.equal(80);
  await focusByKeyboard(canvas(el));
  const key = (value: string, options: KeyboardEventInit = {}) =>
    canvas(el).dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, ...options }));
  key('ArrowDown');
  key('ArrowDown');
  key('ArrowDown');
  key('ArrowDown');
  await el.updateComplete;
  const port = el.shadowRoot!.querySelector<HTMLElement>('[part="grid"]')!;
  expect(port.scrollTop).to.be.greaterThan(100);
  const proposed: Array<{ selectedCells: readonly unknown[]; source: string }> = [];
  el.addEventListener('lr-selection-change', event => proposed.push(event.detail));
  key(' ', { shiftKey: true });
  expect(proposed[0]).to.deep.equal({ source: 'row', selectedCells: [{ row: 3, col: 0 }, { row: 3, col: 1 }] });
  key(' ', { ctrlKey: true });
  expect(proposed[1]).to.deep.equal({ source: 'column', selectedCells: [
    { row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 },
  ] });
});
it('exports rectangular painted cells and frozen labels with the same PNG dimensions and data CSV', async () => {
  const el = await rectangular(10, 48);
  const csv = el.exportData('csv');
  el.stickyLabels = 'both';
  await el.updateComplete;
  draw(el);
  const png = el.exportData('png');
  const decoded = new Image();
  const loaded = new Promise<void>((resolve, reject) => { decoded.onload = () => resolve(); decoded.onerror = reject; });
  decoded.src = png;
  await loaded;
  expect(decoded.width).to.equal(canvas(el).width);
  expect(decoded.height).to.equal(canvas(el).height);
  const probe = document.createElement('canvas');
  probe.width = decoded.width;
  probe.height = decoded.height;
  const context = probe.getContext('2d')!;
  context.drawImage(decoded, 0, 0);
  const dpr = decoded.width / Number.parseFloat(canvas(el).style.width);
  const exported = context.getImageData(0, 0, decoded.width, decoded.height).data;
  const painted = canvas(el).getContext('2d')!.getImageData(0, 0, decoded.width, decoded.height).data;
  // The frozen bands add an opaque backdrop; compare all grid pixels, outside those bands.
  let maxDifference = 0;
  for (let y = Math.ceil(20 * dpr); y < decoded.height; y++) {
    for (let x = Math.ceil(60 * dpr); x < decoded.width; x++) {
      const index = (y * decoded.width + x) * 4;
      for (let channel = 0; channel < 4; channel++)
        maxDifference = Math.max(maxDifference, Math.abs(exported[index + channel]! - painted[index + channel]!));
    }
  }
  expect(maxDifference).to.be.at.most(2);
  expect(el.exportData('csv')).to.equal(csv);
});
it('uses painted rectangular geometry for deferred pointer and keyboard changes', async () => {
  const el = await rectangular(24, 48);
  const internals = el as unknown as { canvasVisible: boolean };
  internals.canvasVisible = false;
  el.rowHeight = 80;
  await el.updateComplete;
  const pixels = canvas(el).toDataURL();
  const activations: unknown[] = [];
  el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
  click(el, 63, 71);
  await el.updateComplete;
  expect(activations).to.deep.equal([{ row: 1, col: 0, value: 3 }]);
  expect(canvas(el).toDataURL() === pixels).to.equal(true);
  expect(el.matrixGeometry).to.include({ rowHeight: 48 });
  draw(el);
  expect(el.matrixGeometry).to.include({ rowHeight: 80 });
  internals.canvasVisible = true;
});
it('bounds enormous finite row heights and paints a complete small matrix', async () => {
  const el = await rectangular(24, 48);
  el.rowHeight = Number.MAX_VALUE;
  await el.updateComplete;
  draw(el);
  expect(el.rowHeight).to.equal(4096);
  expect(el.matrixGeometry).to.include({ rowHeight: 4096, cellHeight: 4095 });
  expect(Number.parseFloat(canvas(el).style.height)).to.equal(8212);
  expect(canvas(el).height).to.equal(Math.floor(8212 * (window.devicePixelRatio || 1)));
  expect(alpha(el, 63, 23)).to.equal(255);
  expect(alpha(el, 63, 4120)).to.equal(255);
  expect(el.exportData('png')).to.match(/^data:image\/png;base64,.+/);
});
it('keeps the default calendar square size when row height is supplied', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap row-height="28" .data=${{
    kind: 'calendar', days: [{ date: '2026-09-07', value: 1 }],
  }}></lr-heatmap>`);
  const drawCalendar = () => (el as unknown as { drawCalendar(): void }).drawCalendar();
  drawCalendar();
  expect(el.cellSize).to.equal(11);
  expect(el.calendarGeometry).to.include({ cellWidth: 11, cellHeight: 11 });
  const original = canvas(el).toDataURL();
  el.removeAttribute('row-height');
  await el.updateComplete;
  drawCalendar();
  expect(canvas(el).toDataURL() === original).to.equal(true);
});
