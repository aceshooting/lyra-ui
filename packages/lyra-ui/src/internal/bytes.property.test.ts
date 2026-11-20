import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { byteFormat, byteUnitIndex, formatByteSize, formatFileSize } from './bytes.js';

it('formatFileSize is the shared byte formatter at a binary step for every finite non-negative size', () => {
  const sizes = fc.oneof(
    fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
    fc.double({ min: 0, max: 1e21, noNaN: true }),
    fc.constantFrom(1023.5, 1024, 1024 ** 2 - 1, 1024 ** 4, 1024 ** 5 + 1),
  );
  fc.assert(fc.property(sizes, (bytes) => {
    expect(formatFileSize(bytes, 'en')).to.equal(formatByteSize(bytes + 0, 'en', { unitStep: 1024 }));
  }), propertyRuns());
});

it('byteFormat picks the rung the magnitude reaches and scales back to the input', () => {
  const values = fc.double({ min: -1e20, max: 1e20, noNaN: true });
  const steps = fc.oneof(fc.constantFrom(1000, 1024, 10), fc.double({ min: 1.01, max: 4096, noNaN: true }));
  fc.assert(fc.property(values, steps, (value, step) => {
    const { index, amount } = byteFormat(value, 'byte', 'short', step, 1);
    const magnitude = Math.abs(value);
    // A magnitude just under a boundary may round up onto the next rung, never further.
    const reached = byteUnitIndex(value, step);
    expect(index === reached || index === reached + 1, 'reached rung or rounded-up neighbour').to.equal(true);
    expect(Math.abs(amount) < step || index === 5, 'amount never displays a full step').to.equal(true);
    expect(Math.abs(amount * step ** index - value) <= magnitude * 1e-12, 'scaled amount').to.equal(true);
  }), propertyRuns());
});
