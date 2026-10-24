import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraHeatmap } from './heatmap.class.js';
import type { LyraHeatmapMatrixSource, LyraHeatmapMatrixViewport } from './heatmap-matrix-source.js';
import './heatmap.js';

function provider(rows = 60, columns = 4) {
  const reads: Array<readonly [number, number]> = [];
  const queries: LyraHeatmapMatrixViewport[] = [];
  const source: LyraHeatmapMatrixSource = {
    revision: 1, rowCount: rows, columnCount: columns, domain: { min: 0, max: rows * columns },
    query(request) {
      const { rowStart, rowEnd, columnStart, columnEnd } = request;
      const bounds = { rowStart, rowEnd, columnStart, columnEnd };
      queries.push(bounds);
      const count = (rowEnd - rowStart) * (columnEnd - columnStart);
      return [{ ...bounds, count, validCount: count, min: 0, max: rows * columns, sum: count }];
    },
    getCell(row, col) {
      reads.push([row, col]);
      return { value: row * columns + col, rowLabel: `Row ${row}`, columnLabel: `Column ${col}` };
    },
  };
  return { source, reads, queries };
}
async function ready(el: LyraHeatmap): Promise<void> {
  await waitUntil(() => el.exportData('csv') !== '' &&
    el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false');
  await el.updateComplete;
}
function focusedCoordinate(el: LyraHeatmap): string {
  const active = el.shadowRoot!.activeElement;
  return `${active?.getAttribute('data-source-row')}:${active?.getAttribute('data-source-col')}`;
}
async function keyTo(el: LyraHeatmap, key: string, row: number, col: number): Promise<void> {
  await sendKeys({ press: key });
  await waitUntil(() => focusedCoordinate(el) === `${row}:${col}`, `${key} focuses source cell ${row},${col}`);
}

for (const direction of ['ltr', 'rtl']) {
  it(`navigates exact source page and row endpoints with physical horizontal keys in ${direction}`, async () => {
    const input = provider();
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells dir=${direction}
      style="width:320px" .matrixSource=${input.source}></lr-heatmap>`);
    await ready(el);
    expect(await el.revealSourceCell(25, 2)).to.equal(true);
    await keyTo(el, 'PageDown', 45, 2);
    await keyTo(el, 'PageUp', 25, 2);
    await keyTo(el, 'ArrowUp', 24, 2);
    await keyTo(el, 'Home', 24, 0);
    await keyTo(el, 'End', 24, 3);
    await keyTo(el, 'ArrowLeft', 24, 2);
    await keyTo(el, 'ArrowRight', 24, 3);
    await keyTo(el, 'Control+Home', 0, 0);
    expect(el.selectedCell).to.equal(null);
    expect(el.selectedCells).to.deep.equal([]);
    expect(input.queries.length).to.equal(1);
    const activated = oneEvent(el, 'lr-cell-activate');
    await sendKeys({ press: 'Enter' });
    expect((await activated).detail).to.deep.equal({ row: 0, col: 0, value: 0 });
  });
}

it('skips excluded exact cells and leaves focus in place when Home targets an excluded endpoint', async () => {
  const input = provider(2, 4);
  const interactive: NonNullable<LyraHeatmap['cellInteractive']> = position =>
    !('row' in position) || position.col !== 1 && position.col !== 2;
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells style="width:320px"
    .matrixSource=${input.source} .cellInteractive=${interactive}></lr-heatmap>`);
  await ready(el);
  expect(await el.revealSourceCell(0, 0)).to.equal(true);
  await keyTo(el, 'ArrowRight', 0, 3);
  const denied: number[] = [];
  el.cellInteractive = position => {
    if ('row' in position && position.row === 0 && position.col === 0) { denied.push(position.col); return false; }
    return true;
  };
  await el.updateComplete;
  denied.length = 0;
  await sendKeys({ press: 'Home' });
  await waitUntil(() => denied.length > 0);
  await el.updateComplete;
  expect(focusedCoordinate(el)).to.equal('0:3');
  expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-source-row="0"][data-source-col="0"]')?.disabled).to.equal(true);
});

it('bounds a keyboard search through excluded source cells to thirty-two exact candidates', async () => {
  const input = provider(1, 100);
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px" .matrixSource=${input.source}></lr-heatmap>`);
  await ready(el);
  expect(await el.revealSourceCell(0, 0)).to.equal(true);
  const candidates: number[] = [];
  el.cellInteractive = position => { if ('row' in position) candidates.push(position.col); return false; };
  await el.updateComplete;
  input.reads.length = 0;
  await sendKeys({ press: 'ArrowRight' });
  await waitUntil(() => candidates.length >= 32);
  await el.updateComplete;
  expect(candidates).to.deep.equal(Array.from({ length: 32 }, (_, index) => index + 1));
  expect(input.reads).to.deep.equal(Array.from({ length: 32 }, (_, index) => [0, index + 1]));
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('canvas');
  expect(el.selectedCells).to.deep.equal([]);
});

for (const callback of ['cellInteractive', 'cellText'] as const) {
  it(`revokes a reveal when its ${callback} callback replaces the source`, async () => {
    const input = provider(2, 2), replacement = provider(3, 3);
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px" .matrixSource=${input.source}></lr-heatmap>`);
    await ready(el);
    let calls = 0;
    const replace = () => {
      calls++;
      el[callback] = undefined;
      el.matrixSource = replacement.source;
    };
    if (callback === 'cellInteractive') el.cellInteractive = () => { replace(); return true; };
    else el.cellText = () => { replace(); return 'Obsolete label'; };
    expect(await el.revealSourceCell(1, 1)).to.equal(false);
    await ready(el);
    expect(calls).to.equal(1);
    expect(replacement.reads).to.deep.equal([]);
    expect(el.shadowRoot!.textContent).not.to.include('Obsolete label');
    expect(await el.revealSourceCell(2, 2)).to.equal(true);
    expect(replacement.reads).to.deep.equal([[2, 2]]);
  });
}

it('vetoes exact activation through cellInteractive without changing controlled selection', async () => {
  const input = provider(2, 2);
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple style="width:320px" .matrixSource=${input.source}></lr-heatmap>`);
  await ready(el);
  expect(await el.revealSourceCell(0, 1)).to.equal(true);
  let rejected = 0;
  const activations: unknown[] = [], selections: unknown[] = [];
  el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
  el.addEventListener('lr-selection-change', event => selections.push(event.detail));
  el.cellInteractive = () => { rejected++; return false; };
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => rejected > 0);
  await el.updateComplete;
  expect(activations).to.deep.equal([]);
  expect(selections).to.deep.equal([]);
  expect(el.selectedCells).to.deep.equal([]);
  el.cellInteractive = undefined;
  const activated = oneEvent(el, 'lr-cell-activate');
  await sendKeys({ press: 'Enter' });
  await activated;
  expect(activations).to.deep.equal([{ row: 0, col: 1, value: 1 }]);
  expect(selections).to.deep.equal([{ selectedCells: [{ row: 0, col: 1 }], source: 'keyboard' }]);
  expect(el.selectedCells).to.deep.equal([]);
});

it('does not read or focus absent and disconnected sources', async () => {
  const input = provider(2, 2);
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px"></lr-heatmap>`);
  expect(await el.revealSourceCell(0, 0)).to.equal(false);
  el.matrixSource = input.source;
  await ready(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!);
  el.remove();
  expect(await el.revealSourceCell(1, 1)).to.equal(false);
  expect(input.reads).to.deep.equal([]);
});
