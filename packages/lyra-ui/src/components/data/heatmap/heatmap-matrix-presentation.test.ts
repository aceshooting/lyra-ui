import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap, LyraHeatmapMatrixGeometryChangeDetail } from './heatmap.js';

type Matrix = Extract<LyraHeatmap['data'], { kind: 'matrix' }>;
const data: Matrix = {
  kind: 'matrix', rowLabels: ['Mon', 'Tue'], colLabels: ['0h', '1h', '2h', '3h'],
  values: [[1, 2, 3, 4], [5, 6, 7, 8]],
};
function canvas(el: LyraHeatmap): HTMLCanvasElement {
  return el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
}
function draw(el: LyraHeatmap): void {
  (el as unknown as { drawMatrix(): void }).drawMatrix();
}
async function matrix(): Promise<LyraHeatmap> {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="24" .data=${data}
    .cellColor=${() => 'rgb(20, 100, 180)'}></lr-heatmap>`);
  draw(el);
  return el;
}
function alpha(el: LyraHeatmap, x: number, y: number): number {
  const target = canvas(el);
  const dpr = target.width / Number.parseFloat(target.style.width);
  return target.getContext('2d')!.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data[3]!;
}
function click(el: LyraHeatmap, x: number, y: number): void {
  const target = canvas(el);
  const rect = target.getBoundingClientRect();
  target.dispatchEvent(new MouseEvent('click', { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
}

it('keeps the default matrix pixels and geometry when presentation controls are unset', async () => {
  const el = await matrix();
  expect([el.cellGapX, el.cellGapY, el.cellRadius, el.colLabelInterval]).to.deep.equal([1, 1, 0, 1]);
  expect(el.matrixGeometry).to.deep.equal({ padLeft: 60, padTop: 20, cellSize: 24 });
  const original = canvas(el).toDataURL();
  el.cellGapX = 1;
  el.cellGapY = 1;
  el.cellRadius = 0;
  el.colLabelInterval = 1;
  await el.updateComplete;
  draw(el);
  expect(canvas(el).toDataURL() === original).to.equal(true);
});

for (const direction of ['ltr', 'rtl']) {
  it(`paints bounded rounded cells and excludes custom gutters from clicks in ${direction}`, async () => {
    const el = await matrix();
    el.dir = direction;
    el.cellGapX = 3;
    el.cellGapY = 5;
    el.cellRadius = 4;
    let lastDetail: LyraHeatmapMatrixGeometryChangeDetail | undefined;
    el.addEventListener('lr-matrix-geometry-change', event => { lastDetail = event.detail; });
    await el.updateComplete;
    draw(el);
    expect(el.matrixGeometry).to.deep.equal({ padLeft: 60, padTop: 20, cellSize: 24, cellWidth: 21, cellHeight: 19, cellRadius: 4 });
    expect(lastDetail === el.matrixGeometry).to.equal(true);
    expect(Object.isFrozen(lastDetail)).to.equal(true);
    expect(alpha(el, 70, 30)).to.equal(255);
    expect(alpha(el, 82, 30)).to.equal(0);
    expect(alpha(el, 70, 41)).to.equal(0);
    expect(alpha(el, 60, 20)).to.be.lessThan(255);
    const clicks: unknown[] = [];
    el.addEventListener('lr-cell-click', event => clicks.push(event.detail));
    click(el, 82, 30);
    click(el, 70, 41);
    expect(clicks.length).to.equal(0);
    click(el, 70, 30);
    expect(clicks).to.deep.equal([{ row: 0, col: 0, value: 1 }]);
  });
}

it('uses custom painted bounds for semantic cells and keeps complete labels with sparse visual columns', async () => {
  const el = await matrix();
  el.cellSize = 60;
  el.cellGapX = 3;
  el.cellGapY = 5;
  el.cellRadius = 4;
  el.colLabelInterval = 2;
  el.accessibleCells = true;
  await el.updateComplete;
  draw(el);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 8);
  await el.updateComplete;
  const cell = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cell"][aria-colindex="2"]')!;
  expect(cell.getAttribute('aria-label')).to.include('1h');
  expect(cell.getBoundingClientRect().width).to.equal(57);
  expect(cell.getBoundingClientRect().height).to.equal(55);
  cell.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('data-cell-key')).to.equal(cell.getAttribute('data-cell-key'));
  expect(el.data).to.deep.equal(data);
  await expect(el).to.be.accessible();
});

it('paints sparse and frozen labels without changing data and exports those same canvas pixels', async () => {
  const el = await matrix();
  el.colLabelInterval = 2;
  el.stickyLabels = 'cols';
  await el.updateComplete;
  draw(el);
  const reference = await matrix();
  reference.data = { ...data, colLabels: ['0h', '', '2h', ''] };
  await reference.updateComplete;
  draw(reference);
  expect(canvas(el).toDataURL() === canvas(reference).toDataURL()).to.equal(true);
  const band = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="col-labels"]')!;
  const ctx = canvas(el).getContext('2d')!;
  const bandPixels = band.getContext('2d')!.getImageData(0, 0, band.width, band.height).data;
  expect(bandPixels.some(value => value > 0)).to.equal(true);
  const exported = new Image();
  const loaded = new Promise<void>((resolve, reject) => { exported.onload = () => resolve(); exported.onerror = reject; });
  exported.src = canvas(el).toDataURL('image/png');
  await loaded;
  const decoded = document.createElement('canvas');
  decoded.width = exported.width;
  decoded.height = exported.height;
  const decodedCtx = decoded.getContext('2d')!;
  decodedCtx.drawImage(exported, 0, 0);
  const exportedPixels = decodedCtx.getImageData(0, 0, decoded.width, decoded.height).data;
  const originalPixels = ctx.getImageData(0, 0, decoded.width, decoded.height).data;
  // Compare premultiplied color: PNG decoding can round low-alpha glyph colors differently
  // across engines even when they composite to the same pixels. Two conversions can each
  // round a channel by one level; geometry/alpha is checked independently below.
  let maxDifference = 0;
  for (let index = 0; index < exportedPixels.length; index += 4) {
    const exportedAlpha = exportedPixels[index + 3]!;
    const originalAlpha = originalPixels[index + 3]!;
    expect(Math.abs(exportedAlpha - originalAlpha)).to.be.at.most(1);
    for (let channel = 0; channel < 3; channel++) {
      maxDifference = Math.max(maxDifference, Math.abs(
        exportedPixels[index + channel]! * exportedAlpha / 255 -
        originalPixels[index + channel]! * originalAlpha / 255
      ));
    }
  }
  expect(maxDifference).to.be.at.most(2);
  expect(el.data).to.deep.equal(data);
});

it('scales a single square cell with its container and bounds invalid presentation values', async () => {
  const el = await matrix();
  el.data = { kind: 'matrix', rowLabels: ['Row'], colLabels: ['Column'], values: [[1]] };
  el.fitToWidth = true;
  el.style.inlineSize = '240px';
  el.cellGapX = 2;
  el.cellGapY = 2;
  el.cellRadius = 2;
  await el.updateComplete;
  draw(el);
  expect(el.matrixGeometry?.cellWidth).to.equal(178);
  expect(el.matrixGeometry?.cellHeight).to.equal(178);
  el.style.inlineSize = '180px';
  draw(el);
  expect(el.matrixGeometry?.cellWidth).to.equal(118);
  for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    el.cellGapX = invalid;
    el.cellGapY = invalid;
    el.cellRadius = invalid;
    el.colLabelInterval = invalid;
    await el.updateComplete;
    draw(el);
    expect(el.matrixGeometry).to.deep.equal({ padLeft: 60, padTop: 20, cellSize: 120 });
  }
  el.cellGapX = -5;
  el.cellGapY = 1e12;
  el.cellRadius = 1e12;
  await el.updateComplete;
  draw(el);
  expect(el.matrixGeometry).to.deep.equal({ padLeft: 60, padTop: 20, cellSize: 120, cellWidth: 120, cellHeight: 1, cellRadius: 0.5 });
});

it('keeps custom focus repainting identical to a full draw, including rounded adjacent cells', async () => {
  const el = await matrix();
  el.cellGapX = 1;
  el.cellGapY = 2;
  el.cellRadius = 2;
  el.selectedCell = { row: 0, col: 0 };
  el.annotations = [{ row: 0, col: 1, label: 'Check' }];
  await el.updateComplete;
  const internal = el as unknown as {
    focusedCell: { row: number; col: number } | null;
    repaintMatrixFocusCell(pos: { row: number; col: number }): void;
  };
  internal.focusedCell = { row: 0, col: 0 };
  draw(el);
  internal.focusedCell = { row: 0, col: 1 };
  internal.repaintMatrixFocusCell({ row: 0, col: 0 });
  internal.repaintMatrixFocusCell({ row: 0, col: 1 });
  const partial = canvas(el).toDataURL();
  draw(el);
  expect(canvas(el).toDataURL() === partial).to.equal(true);
  expect(alpha(el, 70, 42)).to.equal(0);
});

it('keeps custom semantic cell targets separated and frozen until the next painted frame', async () => {
  const el = await matrix();
  el.accessibleCells = true;
  el.cellGapX = 3;
  el.cellGapY = 5;
  await el.updateComplete;
  draw(el);
  await el.updateComplete;
  const cells = () => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]')];
  const first = cells()[0]!.getBoundingClientRect();
  const second = cells()[1]!.getBoundingClientRect();
  expect(first.width).to.be.at.least(40);
  expect(first.height).to.be.at.least(40);
  expect(second.left - first.right).to.equal(3);
  const previous = el.matrixGeometry;
  const internals = el as unknown as { canvasVisible: boolean };
  internals.canvasVisible = false;
  el.cellGapX = 10;
  await el.updateComplete;
  expect(el.matrixGeometry === previous).to.equal(true);
  expect(cells()[0]!.getBoundingClientRect().width).to.equal(first.width);
  draw(el);
  await el.updateComplete;
  expect(el.matrixGeometry === previous).to.equal(false);
  await waitUntil(() => cells()[1]!.getBoundingClientRect().left - cells()[0]!.getBoundingClientRect().right === 10);
  expect(cells()[1]!.getBoundingClientRect().left - cells()[0]!.getBoundingClientRect().right).to.equal(10);
  internals.canvasVisible = true;
});

it('leaves calendar pixels unchanged when matrix presentation properties change', async () => {
  const el = await matrix();
  el.data = { kind: 'calendar', days: [{ date: '2026-09-07', value: 1 }] };
  await el.updateComplete;
  const drawCalendar = () => (el as unknown as { drawCalendar(): void }).drawCalendar();
  drawCalendar();
  const original = canvas(el).toDataURL();
  el.cellGapX = 4;
  el.cellGapY = 7;
  el.cellRadius = 3;
  el.colLabelInterval = 2;
  await el.updateComplete;
  drawCalendar();
  expect(canvas(el).toDataURL() === original).to.equal(true);
  expect(el.matrixGeometry).to.equal(undefined);
});
