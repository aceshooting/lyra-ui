import { expect, fixture, html, waitUntil, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './heatmap.js';
import type { LyraHeatmap, LyraHeatmapMatrixSource, LyraHeatmapTile } from './heatmap.class.js';
import { recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';

it('represents an allocated million-cell matrix and resolves exact middle and final source cells', async () => {
  // The caller builds the aggregation index once; component interaction never scans this array.
  const values = new Float64Array(1_000_000);
  const tiles: LyraHeatmapTile[] = [];
  let fixtureReads = 0, total = 0;
  for (let rowBlock = 0; rowBlock < 2; rowBlock++) for (let columnBlock = 0; columnBlock < 2; columnBlock++) {
    let sum = 0, min = Infinity, max = -Infinity;
    for (let row = rowBlock * 500; row < (rowBlock + 1) * 500; row++) for (let col = columnBlock * 500; col < (columnBlock + 1) * 500; col++) {
      const value = row === 999 && col === 999 ? 1_000_013 : row === 500 && col === 500 ? 34567 : row > 990 && col > 990 ? -3 : 1;
      values[row * 1000 + col] = value;
      fixtureReads++; sum += value; min = Math.min(min, value); max = Math.max(max, value);
    }
    total += sum;
    tiles.push(Object.freeze({ rowStart: rowBlock * 500, rowEnd: (rowBlock + 1) * 500, columnStart: columnBlock * 500, columnEnd: (columnBlock + 1) * 500, count: 250000, validCount: 250000, sum, min, max }));
  }
  let queries = 0, exactReads = 0, tileFields = 0;
  const source: LyraHeatmapMatrixSource = {
    revision: 'allocated-million', rowCount: 1000, columnCount: 1000, domain: { min: -3, max: 1_000_013 },
    query(request) {
      queries++;
      expect(request.maxCells).at.most(10000);
      return tiles.map(tile => new Proxy(tile, { getOwnPropertyDescriptor(target, property) { tileFields++; return Reflect.getOwnPropertyDescriptor(target, property); } }));
    },
    getCell(row, col) { exactReads++; return { value: values[row * 1000 + col]!, rowLabel: String(row), columnLabel: String(col) }; },
  };
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width: 320px" .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => el.exportData('csv').split('\r\n').length === 5);
  expect(queries).equal(1); expect(exactReads).equal(0); expect(tileFields).equal(tiles.length * 9);
  expect(tiles.reduce((sum, tile) => sum + tile.sum, 0)).equal(total);
  expect(tiles.reduce((sum, tile) => sum + tile.count, 0)).equal(1_000_000);
  expect(el.matrixGeometry).equal(undefined);
  expect(await el.revealSourceCell(500, 500)).equal(true);
  const middle = oneEvent(el, 'lr-cell-activate');
  await sendKeys({ press: 'Enter' });
  expect((await middle).detail).deep.equal({ row: 500, col: 500, value: 34567 });
  await sendKeys({ press: 'Control+End' });
  await waitUntil(() => exactReads === 2);
  const last = oneEvent(el, 'lr-cell-activate');
  await sendKeys({ press: 'Enter' });
  expect((await last).detail).deep.equal({ row: 999, col: 999, value: 1_000_013 });
  el.matrixReducer = 'max'; await el.updateComplete;
  expect(queries).equal(1); expect(exactReads).equal(2);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  expect(canvas.width).at.most(16384); expect(canvas.height).at.most(16384);
  expect(canvas.width * canvas.height).at.most(16777216);
  recordScaleMeasurement('lr-heatmap', 'allocated-matrix-source@1000000', {
    allocatedSourceCells: values.length, callerIndexReads: fixtureReads, tileQueries: queries, exactReads,
    normalizedTileFieldReads: tileFields, retainedTiles: tiles.length, representedCells: 1000000,
    canvasWidth: canvas.width, canvasHeight: canvas.height, canvasPixels: canvas.width * canvas.height,
    mountedExactCells: el.shadowRoot!.querySelectorAll('[part="cell"]').length, domNodes: renderedNodeCount(el),
  });
});

it('measures bounded current and pending exact retention through window replacement and cancellation', async () => {
  type Cell = { row: number; col: number; rowLabel: string; columnLabel: string };
  type Retention = { tiles: readonly unknown[]; cells: readonly Cell[]; cursor: Cell | null; selected: Cell | null; window?: { results: Cell[] } };
  const label = 'L'.repeat(1024);
  const observed = new WeakSet<Cell[]>();
  let el: LyraHeatmap | undefined;
  let peakRecords = 0, peakUnits = 0, peakCurrent = 0, peakPending = 0, peakTiles = 0;
  const state = () => (el as unknown as { sourceController: Retention }).sourceController;
  const sample = () => {
    if (!el) return;
    const controller = state();
    const pending = controller.window?.results;
    if (pending && !observed.has(pending)) {
      observed.add(pending);
      Object.defineProperty(pending, 'push', { value: (...cells: Cell[]) => {
        const length = Array.prototype.push.apply(pending, cells); sample(); return length;
      } });
    }
    const records = new Set([...controller.cells, ...(controller.window?.results ?? []), ...(controller.cursor ? [controller.cursor] : []), ...(controller.selected ? [controller.selected] : [])]);
    const units = [...records].reduce((sum, cell) => sum + cell.rowLabel.length + cell.columnLabel.length, 0);
    peakRecords = Math.max(peakRecords, records.size); peakUnits = Math.max(peakUnits, units);
    peakCurrent = Math.max(peakCurrent, controller.cells.length); peakPending = Math.max(peakPending, controller.window?.results.length ?? 0); peakTiles = Math.max(peakTiles, controller.tiles.length);
    expect(records.size).at.most(801); expect(units).at.most(1640448);
    expect(controller.cells.length).at.most(400); expect(controller.window?.results.length ?? 0).at.most(400);
    expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).at.most(400);
  };
  const source: LyraHeatmapMatrixSource = {
    revision: 1, rowCount: 100, columnCount: 100, domain: { min: 0, max: 1 },
    query(request) { const count = (request.rowEnd - request.rowStart) * (request.columnEnd - request.columnStart); return [{ ...request, count, validCount: count, min: 1, max: 1, sum: count }]; },
    getCell() { sample(); return { value: 1, rowLabel: label, columnLabel: label }; },
  };
  el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells style="width:320px" .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => el!.shadowRoot!.querySelectorAll('[part="cell"]').length === 400);
  el.selectedCell = { row: 50, col: 50 };
  await waitUntil(() => Boolean(state().selected));
  expect(await el.revealSourceCell(99, 99)).equal(true);
  sample();
  expect(peakCurrent).equal(400); expect(peakPending).equal(400);
  expect(peakRecords).equal(801); expect(peakUnits).equal(1640448);
  const normal = source.getCell, releases: (() => void)[] = [];
  let paused = true;
  source.getCell = (row, col, request) => paused ? new Promise(resolve => releases.push(() => resolve(normal.call(source, row, col, request)))) : normal.call(source, row, col, request);
  const pending = el.revealSourceCell(0, 0);
  await waitUntil(() => releases.length === 1); releases.shift()!();
  await waitUntil(() => releases.length === 2); releases.shift()!();
  await waitUntil(() => (state().window?.results.length ?? 0) > 0);
  const discarded = state().window!.results;
  expect(await el.revealSourceCell(99, 99)).equal(true);
  expect(await pending).equal(false); expect(discarded.length).equal(0);
  expect(state().window === undefined).equal(true);
  paused = false; releases.splice(0).forEach(release => release());
  await el.updateComplete; sample();
  recordScaleMeasurement('lr-heatmap', 'matrix-source-window-retention', {
    currentExactPeak: peakCurrent, pendingExactPeak: peakPending, retainedExactPeak: peakRecords,
    retainedLabelUnitsPeak: peakUnits, currentTilePeak: peakTiles, discardedPendingRecords: discarded.length,
    mountedExactCells: el.shadowRoot!.querySelectorAll('[part="cell"]').length,
  });
});

it('measures partition sweep work and overview draw calls independently of logical area', async () => {
  const { matrixTiles } = await import('./heatmap-matrix-source.js');
  const rectangle = { rowStart: 0, rowEnd: 1000000, columnStart: 0, columnEnd: 1000000 };
  const tiles = Array.from({ length: 16 }, (_, index) => ({
    rowStart: Math.floor(index / 4) * 250000, rowEnd: (Math.floor(index / 4) + 1) * 250000,
    columnStart: index % 4 * 250000, columnEnd: (index % 4 + 1) * 250000,
    count: 62500000000, validCount: 62500000000, min: 1, max: 1, sum: 62500000000,
  }));
  let treeArrays = 0, treeUpdates = 0, boundaryLookups = 0;
  const TypedArray = globalThis.Int32Array, mapGet = Map.prototype.get;
  globalThis.Int32Array = new Proxy(TypedArray, { construct(target, argumentsList) {
    const array = Reflect.construct(target, argumentsList) as Int32Array, ordinal = treeArrays++;
    return new Proxy(array, { set(target, key, value) { if (ordinal === 0) treeUpdates++; return Reflect.set(target, key, value); } });
  } });
  Map.prototype.get = function(key: unknown) { boundaryLookups++; return mapGet.call(this, key); };
  try { expect(matrixTiles(tiles, rectangle, 16, { min: 1, max: 1 }).length).equal(16); }
  finally { globalThis.Int32Array = TypedArray; Map.prototype.get = mapGet; }
  expect(treeArrays).equal(3); expect(boundaryLookups).equal(64); expect(treeUpdates).equal(96);
  const fill = CanvasRenderingContext2D.prototype.fillRect;
  let draws = 0;
  CanvasRenderingContext2D.prototype.fillRect = function(...args) { if (this.canvas.hasAttribute('data-source-entry')) draws++; return fill.apply(this, args); };
  let el!: LyraHeatmap;
  try {
    const source: LyraHeatmapMatrixSource = { revision: 1, rowCount: 1000000, columnCount: 1000000, domain: { min: 1, max: 1 }, query: () => tiles, getCell: () => ({ value: 1, rowLabel: 'row', columnLabel: 'column' }) };
    el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px" .matrixSource=${source}></lr-heatmap>`);
    await waitUntil(() => el.exportData('csv') !== ''); await el.updateComplete;
    expect(draws).at.least(16); expect(draws % 16).equal(0);
  } finally { CanvasRenderingContext2D.prototype.fillRect = fill; }
  recordScaleMeasurement('lr-heatmap', 'matrix-source-partition-work@1000000000000', {
    logicalSourceCells: 1000000000000, tiles: tiles.length, sweepEvents: boundaryLookups / 2,
    treeUpdates, treeArrays, sourceTileDraws: draws, drawsPerPaint: 16,
    canvasPixels: el.shadowRoot!.querySelector('canvas')!.width * el.shadowRoot!.querySelector('canvas')!.height,
  });
});
