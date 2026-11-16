import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanup, numeric, work } from './points-xr-label-layout-fixture.mjs';

for (const [name, extra] of [
  ['explicit segments', { segments: new Uint32Array([0, 1]) }],
  ['an axis', { axes: [{ axis: 'x', min: -1, max: 1, ticks: [] }] }],
]) {
  test(`point label layout protects the line width as padding for ${name}`, () => {
    const base = { positions: new Float32Array([0, 0, 0, 1, 0, 0]), labels: ['a', 'b'] }, lineWidth = 64;
    const plain = work(base, { lineWidth }), lined = work({ ...base, ...extra }, { lineWidth });
    try {
      const without = numeric(plain).padding, padded = numeric(lined).padding;
      assert.ok(without < lineWidth * .001, `${without} comes from label extents alone`);
      assert.ok(padded >= lineWidth * .001, `${padded} covers the drawn line width`);
    } finally { cleanup(plain); cleanup(lined); }
  });
}
