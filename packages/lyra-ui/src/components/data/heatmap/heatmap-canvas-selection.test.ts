import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import type { HeatmapSelectedCell, LyraHeatmap } from './heatmap.js';
import './heatmap.js';

type Selection = { selectedCells: readonly HeatmapSelectedCell[]; source: string };

function canvas(element: LyraHeatmap): HTMLCanvasElement {
  const target = element.shadowRoot?.querySelector<HTMLCanvasElement>('[part="canvas"]');
  if (!target) throw new Error('Heatmap canvas missing');
  return target;
}

async function matrix(columns = 24, rows = 1): Promise<LyraHeatmap> {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap multiple without-legend
    cell-size="18" row-label-width="0" col-label-height="0" style="inline-size:600px"
    .strings=${{ heatmapSelectedCount: 'Selection {count}' }}
    .data=${{ kind: 'matrix', rowLabels: Array.from({ length: rows }, (_, row) => `R${row}`),
      colLabels: Array.from({ length: columns }, (_, col) => `C${col}`),
      values: Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => row * columns + col + 1)) }}
  ></lr-heatmap>`);
  element.scrollIntoView({ block: 'center' });
  await waitUntil(() => element.matrixGeometry !== undefined && canvas(element).width > 0, 'matrix canvas not painted');
  expect(element.accessibleCells).to.equal(false);
  expect(canvas(element).getAttribute('role')).to.equal('application');
  return element;
}

function matrixPoint(element: LyraHeatmap, row: number, col: number, box = canvas(element).getBoundingClientRect()): [number, number] {
  const geometry = element.matrixGeometry;
  if (!geometry) throw new Error('Matrix geometry missing');
  const x = geometry.padLeft + col * geometry.cellSize + (geometry.cellWidth ?? geometry.cellSize - 1) / 2;
  const y = geometry.padTop + row * (geometry.rowHeight ?? geometry.cellSize) + (geometry.cellHeight ?? (geometry.rowHeight ?? geometry.cellSize) - 1) / 2;
  return [Math.round(box.left + x), Math.round(box.top + y)];
}

function calendarPoint(element: LyraHeatmap, week: number, weekday: number, box = canvas(element).getBoundingClientRect()): [number, number] {
  const geometry = element.calendarGeometry;
  if (!geometry) throw new Error('Calendar geometry missing');
  return [
    Math.round(box.left + geometry.padLeft + week * (geometry.cellWidth + geometry.cellGapX) + geometry.cellWidth / 2),
    Math.round(box.top + geometry.padTop + weekday * (geometry.cellHeight + geometry.cellGapY) + geometry.cellHeight / 2),
  ];
}

function observe(element: LyraHeatmap): { selections: Selection[]; activations: unknown[] } {
  const selections: Selection[] = [], activations: unknown[] = [];
  element.addEventListener('lr-selection-change', event => selections.push((event as CustomEvent<Selection>).detail));
  element.addEventListener('lr-cell-activate', event => activations.push((event as CustomEvent).detail));
  return { selections, activations };
}

async function hoverMatrix(element: LyraHeatmap, row: number, col: number): Promise<void> {
  await hoverUntilMatched(canvas(element), 'matrix canvas receives pointer input', box => matrixPoint(element, row, col, box));
}

afterEach(async () => resetMouse());

describe('heatmap canvas controlled selection', () => {
  it('emits one selection and activation for a short native canvas click, then erases accepted selection', async () => {
    const element = await matrix(3);
    const { selections, activations } = observe(element);
    await hoverMatrix(element, 0, 1);
    await sendMouse({ type: 'click', position: matrixPoint(element, 0, 1) });
    await waitUntil(() => selections.length === 1 && activations.length === 1);
    expect(selections[0]).to.deep.equal({ selectedCells: [{ row: 0, col: 1 }], source: 'pointer' });
    expect(activations).to.deep.equal([{ row: 0, col: 1, value: 2 }]);
    expect(Object.isFrozen(selections[0]!.selectedCells[0])).to.equal(true);
    expect(element.selectedCells).to.deep.equal([]);
    element.selectedCells = selections[0]!.selectedCells;
    await element.updateComplete;
    await hoverMatrix(element, 0, 1);
    await sendMouse({ type: 'click', position: matrixPoint(element, 0, 1) });
    await waitUntil(() => selections.length === 2 && activations.length === 2);
    expect(selections[1]).to.deep.equal({ selectedCells: [], source: 'pointer' });
    expect(element.selectedCells).to.deep.equal([{ row: 0, col: 1 }]);
  });

  it('fills skipped canvas cells across a wide drag while excluding a non-interactive hole', async () => {
    const element = await matrix();
    element.cellInteractive = pos => !('col' in pos) || pos.col !== 12;
    await element.updateComplete;
    const { selections, activations } = observe(element);
    const expected = Array.from({ length: 24 }, (_, col) => ({ row: 0, col })).filter(pos => pos.col !== 12);
    await hoverMatrix(element, 0, 0);
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: matrixPoint(element, 0, 23) });
    await waitUntil(() => element.getAttribute('aria-label')?.includes('Selection 23') === true);
    await settlePointer();
    expect(selections.length).to.equal(0);
    expect(element.selectedCells).to.deep.equal([]);
    await sendMouse({ type: 'up' });
    await waitUntil(() => selections.length === 1);
    expect(selections[0]).to.deep.equal({ selectedCells: expected, source: 'pointer' });
    expect(activations).to.deep.equal([]);
    element.selectedCells = selections[0]!.selectedCells;
    await element.updateComplete;
    await hoverMatrix(element, 0, 0);
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: matrixPoint(element, 0, 23) });
    await sendMouse({ type: 'up' });
    await waitUntil(() => selections.length === 2);
    expect(selections[1]).to.deep.equal({ selectedCells: [], source: 'pointer' });
    expect(element.selectedCells).to.deep.equal(expected);
    expect(activations).to.deep.equal([]);
  });

  it('cancels an in-progress canvas preview when controlled selectedCells is replaced', async () => {
    const element = await matrix(6);
    const { selections, activations } = observe(element);
    await hoverMatrix(element, 0, 0);
    await sendMouse({ type: 'down' });
    await sendMouse({ type: 'move', position: matrixPoint(element, 0, 2) });
    await waitUntil(() => element.getAttribute('aria-label')?.includes('Selection 3') === true);
    element.selectedCells = [{ row: 0, col: 4 }];
    await element.updateComplete;
    await sendMouse({ type: 'up' });
    await settlePointer();
    expect(selections).to.deep.equal([]);
    expect(activations).to.deep.equal([]);
    expect(element.selectedCells).to.deep.equal([{ row: 0, col: 4 }]);
    await hoverMatrix(element, 0, 5);
    await sendMouse({ type: 'click', position: matrixPoint(element, 0, 5) });
    await waitUntil(() => selections.length === 1);
    expect(selections[0]).to.deep.equal({ selectedCells: [{ row: 0, col: 4 }, { row: 0, col: 5 }], source: 'pointer' });
  });

  it('uses calendar date identity for a canvas drag crossing excluded and missing days', async () => {
    const interactive: NonNullable<LyraHeatmap['cellInteractive']> = pos => !('date' in pos) || pos.date !== '2026-01-11';
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap multiple without-legend dir="ltr" style="inline-size:320px"
      .data=${{ kind: 'calendar', days: [{ date: '2026-01-04', value: 1 }, { date: '2026-01-25', value: 4 }] }}
      .cellInteractive=${interactive}
    ></lr-heatmap>`);
    element.scrollIntoView({ block: 'center' });
    await waitUntil(() => element.calendarGeometry?.weekCount === 4 && canvas(element).width > 0);
    const { selections, activations } = observe(element);
    const padding = (): [number, number] => {
      const box = canvas(element).getBoundingClientRect();
      return [Math.round(box.left + 1), Math.round(box.top + 1)];
    };
    await hoverUntilMatched(canvas(element), 'calendar padding receives pointer input', padding);
    await sendMouse({ type: 'click', position: padding() });
    await settlePointer();
    expect(selections).to.deep.equal([]);
    expect(activations).to.deep.equal([]);
    await hoverUntilMatched(canvas(element), 'calendar canvas receives pointer input', box => calendarPoint(element, 0, 0, box));
    await sendMouse({ type: 'down' });
    await settlePointer();
    await sendMouse({ type: 'move', position: calendarPoint(element, 3, 0) });
    await sendMouse({ type: 'up' });
    await waitUntil(() => selections.length === 1);
    expect(selections[0]).to.deep.equal({ selectedCells: [{ date: '2026-01-04' }, { date: '2026-01-18' }, { date: '2026-01-25' }], source: 'pointer' });
    expect(activations).to.deep.equal([]);
    expect(element.selectedCells).to.deep.equal([]);
    await hoverUntilMatched(canvas(element), 'missing calendar day receives pointer input', box => calendarPoint(element, 2, 0, box));
    await sendMouse({ type: 'click', position: calendarPoint(element, 2, 0) });
    await waitUntil(() => activations.length === 1);
    expect(activations).to.deep.equal([{ date: '2026-01-18', value: -1 }]);
    expect(selections.at(-1)).to.deep.equal({ selectedCells: [{ date: '2026-01-18' }], source: 'pointer' });
    await sendKeys({ press: 'Shift+ArrowRight' });
    await waitUntil(() => selections.length === 3);
    expect(selections[2]).to.deep.equal({ selectedCells: [{ date: '2026-01-18' }, { date: '2026-01-25' }], source: 'keyboard' });
  });

  it('extends a native canvas keyboard range through a hole without selecting the excluded cell', async () => {
    const element = await matrix(3, 2);
    element.cellInteractive = pos => !('row' in pos) || pos.row !== 0 || pos.col !== 1;
    await element.updateComplete;
    const { selections, activations } = observe(element);
    await focusByKeyboard(canvas(element));
    await sendKeys({ press: 'ArrowRight' });
    await sendKeys({ press: 'Shift+End' });
    await waitUntil(() => selections.length === 1);
    expect(selections[0]).to.deep.equal({ selectedCells: [{ row: 0, col: 0 }, { row: 0, col: 2 }], source: 'keyboard' });
    expect(element.selectedCells).to.deep.equal([]);
    await sendKeys({ press: 'Escape' });
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => activations.length === 1);
    expect(activations).to.deep.equal([{ row: 0, col: 2, value: 3 }]);
  });

  it('anchors a first Shift+End at the reached cell before extending within its row', async () => {
    const element = await matrix(3, 2);
    const { selections } = observe(element);
    await focusByKeyboard(canvas(element));
    await sendKeys({ press: 'Shift+End' });
    await waitUntil(() => selections.length === 1);
    expect(selections[0]).to.deep.equal({ selectedCells: [{ row: 1, col: 2 }], source: 'keyboard' });
    await sendKeys({ press: 'Shift+Home' });
    await waitUntil(() => selections.length === 2);
    expect(selections[1]).to.deep.equal({ selectedCells: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }], source: 'keyboard' });
    expect(element.selectedCells).to.deep.equal([]);
  });
});
