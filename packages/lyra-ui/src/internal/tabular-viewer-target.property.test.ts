import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { tabularInputLimits } from './tabular-viewer-target.js';

const anyNumber = fc.oneof(fc.double(), fc.integer({ min: -10, max: 300000000 }), fc.constantFrom(Number.NaN, Infinity, -Infinity, 0, -0));

it('tabularInputLimits stays within each limit range and keys exactly the effective triple', () => {
  fc.assert(fc.property(anyNumber, anyNumber, anyNumber, (maxRows, maxColumns, maxBytes) => {
    const { rows, columns, bytes, key } = tabularInputLimits(maxRows, maxColumns, maxBytes);
    for (const [value, ceiling] of [[rows, 100000], [columns, 10000], [bytes, 262144000]] as const) {
      expect(Number.isSafeInteger(value) && value >= 1 && value <= ceiling, `${value} within 1..${ceiling}`).to.equal(true);
    }
    const expectedBytes = Number.isFinite(maxBytes) ? Math.max(1, Math.min(262144000, Math.trunc(maxBytes))) : 26214400;
    expect(bytes).to.equal(expectedBytes);
    expect(key).to.equal(`${rows}:${columns}:${bytes}`);
    if (Number.isSafeInteger(maxRows) && maxRows >= 1 && maxRows <= 100000) expect(rows).to.equal(maxRows);
  }), propertyRuns());
});
