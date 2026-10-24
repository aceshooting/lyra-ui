import { expect } from '@open-wc/testing';
import { matrixDomain, matrixExactCell, matrixRectangle, matrixTiles, type LyraHeatmapTile } from './heatmap-matrix-source.js';
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

it('rejects rectangles that are not records, are empty or are too large to count exactly', () => {
  expect(() => matrixRectangle(null)).to.throw(TypeError, 'Invalid matrix record');
  expect(() => matrixRectangle(5)).to.throw(TypeError, 'Invalid matrix record');
  expect(() => matrixRectangle({ rowStart: 2, rowEnd: 2, columnStart: 0, columnEnd: 1 })).to.throw(RangeError, 'Invalid matrix rectangle');
  expect(() => matrixRectangle({ rowStart: 0, rowEnd: 1, columnStart: 3, columnEnd: 2 })).to.throw(RangeError, 'Invalid matrix rectangle');
  expect(() => matrixRectangle({ rowStart: 0, rowEnd: 2 ** 30, columnStart: 0, columnEnd: 2 ** 30 })).to.throw(RangeError, 'Invalid matrix rectangle');
  expect(matrixRectangle({ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 })).to.deep.equal({ rowStart: 1, rowEnd: 3, columnStart: 0, columnEnd: 2 });
});

it('rejects domains and exact values that are not finite numbers in order', () => {
  expect(matrixDomain(null)).to.equal(null);
  expect(matrixDomain({ min: 0, max: 1 })).to.deep.equal({ min: 0, max: 1 });
  expect(() => matrixDomain({ min: 2, max: 1 })).to.throw(RangeError, 'Invalid matrix domain');
  expect(() => matrixDomain({ min: 'a', max: 1 })).to.throw(TypeError, 'Invalid matrix number');
  expect(() => matrixDomain({ min: 0, max: Number.POSITIVE_INFINITY })).to.throw(TypeError, 'Invalid matrix number');
  expect(() => matrixExactCell({ value: Number.NaN, rowLabel: '', columnLabel: '' }, { min: 0, max: 1 })).to.throw(TypeError, 'Invalid matrix number');
});

it('rejects tile replies that are not arrays or whose tiles contradict the requested rectangle and domain', () => {
  const area = { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 };
  const valid = { ...area, count: 4, validCount: 4, min: 0, max: 8, sum: 16 };
  const domain = { min: 0, max: 10 };
  expect(matrixTiles([valid], area, 1, domain).length).equal(1);
  expect(() => matrixTiles('tiles', area, 1, domain)).to.throw(TypeError, 'Invalid matrix tiles');
  expect(() => matrixTiles([{ ...valid, rowEnd: 3, count: 6 }], area, 1, domain)).to.throw(RangeError, 'Invalid matrix tile counts');
  expect(() => matrixTiles([{ ...valid, count: 5 }], area, 1, domain)).to.throw(RangeError, 'Invalid matrix tile counts');
  expect(() => matrixTiles([{ ...valid, validCount: 5 }], area, 1, domain)).to.throw(RangeError, 'Invalid matrix tile counts');
  expect(() => matrixTiles([valid], area, 1, null)).to.throw(RangeError, 'Invalid matrix tile extrema');
  for (const patch of [{ min: null }, { max: null }, { min: 9, max: 8 }, { min: -1 }, { max: 11 }]) {
    expect(() => matrixTiles([{ ...valid, ...patch }], area, 1, domain), JSON.stringify(patch)).to.throw(RangeError, 'Invalid matrix tile extrema');
  }
});

it('rejects a reply that leaves the last rows of the rectangle uncovered', () => {
  const area = { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 };
  const top = { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 2, count: 2, validCount: 2, min: 0, max: 8, sum: 8 };
  expect(() => matrixTiles([top], area, 1, { min: 0, max: 10 })).to.throw(RangeError, 'Incomplete matrix partition');
});
