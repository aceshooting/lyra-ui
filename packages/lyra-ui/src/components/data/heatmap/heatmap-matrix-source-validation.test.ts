import { expect } from '@open-wc/testing';
import { matrixTiles, matrixExactCell, type LyraHeatmapTile } from './heatmap-matrix-source.js';
const viewport = { rowStart: 0, rowEnd: 1000000, columnStart: 0, columnEnd: 1000000 };
const tile = (rowStart = 0, rowEnd = 1000000, columnStart = 0, columnEnd = 1000000): LyraHeatmapTile => ({ rowStart, rowEnd, columnStart, columnEnd, count: (rowEnd - rowStart) * (columnEnd - columnStart), validCount: 0, min: null, max: null, sum: 0 });
it('accepts unsorted huge logical partitions with bounded descriptor work and rejects same-area overlap gaps', () => {
  let reads = 0;
  const wrap = (value: LyraHeatmapTile) => new Proxy(value, { getOwnPropertyDescriptor(target, key) { reads++; return Reflect.getOwnPropertyDescriptor(target, key); } });
  const result = matrixTiles([wrap(tile(500000)), wrap(tile(0, 500000))], viewport, 2, null);
  expect(result.length).equal(2); expect(reads).equal(18); expect(Object.isFrozen(result)).equal(true);
  expect(() => matrixTiles([tile(0, 500000), tile(0, 500000)], viewport, 2, null)).to.throw();
  expect(() => matrixTiles([tile(0, 1000000, 0, 500000), tile(0, 500000, 500000)], viewport, 2, null)).to.throw();
});
it('rejects excess budgets before entries and accessor fields without evaluating getters', () => {
  let read = false;
  const reply = [tile(), tile()];
  Object.defineProperty(reply, '0', { get() { read = true; return tile(); } });
  expect(() => matrixTiles(reply, viewport, 1, null)).to.throw(); expect(read).equal(false);
  const accessor = { ...tile(), get sum() { read = true; return 0; } };
  expect(() => matrixTiles([accessor], viewport, 1, null)).to.throw(); expect(read).equal(false);
});
it('checks extrema, missing data, finite mean and bounded exact labels without overflow', () => {
  const bounds = { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 1 };
  const extreme = { ...bounds, count: 1, validCount: 1, min: Number.MAX_VALUE, max: Number.MAX_VALUE, sum: Number.MAX_VALUE };
  expect(matrixTiles([extreme], bounds, 1, { min: Number.MAX_VALUE, max: Number.MAX_VALUE }).length).equal(1);
  expect(() => matrixTiles([{ ...extreme, sum: 1 }], bounds, 1, { min: Number.MAX_VALUE, max: Number.MAX_VALUE })).to.throw();
  expect(() => matrixTiles([{ ...extreme, validCount: 0 }], bounds, 1, null)).to.throw();
  expect(() => matrixExactCell({ value: 0, rowLabel: 'x'.repeat(1025), columnLabel: '' }, { min: 0, max: 1 })).to.throw();
  expect(matrixExactCell({ value: null, rowLabel: '', columnLabel: '' }, null).value).equal(null);
});
