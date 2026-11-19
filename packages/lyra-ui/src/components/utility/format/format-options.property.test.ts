import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { byteUnitIndex, resolveDateSource } from './format-options.js';

it('preserves native TimeClip semantics for numeric and Date inputs without sharing mutable dates', () => {
  fc.assert(fc.property(fc.oneof(
    fc.integer({ min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }),
    fc.constantFrom(0, -0, 0.75, -0.75, 8.64e15, -8.64e15, 8.64e15 + 1, -8.64e15 - 1, NaN, Infinity, -Infinity),
  ), epoch => {
    const source = new Date(epoch);
    const expected = source.getTime();
    for (const input of [epoch, source]) {
      const resolved = resolveDateSource(input);
      if (Number.isNaN(expected)) {
        expect(resolved === undefined).to.equal(true);
      } else {
        expect(resolved?.getTime()).to.equal(expected);
        expect(resolved !== source).to.equal(true);
        resolved!.setTime(123);
        expect(source.getTime()).to.equal(expected);
      }
    }
  }), propertyRuns());
});

it('selects each byte unit at its power boundary in either direction from zero', () => {
  fc.assert(fc.property(
    fc.integer({ min: 2, max: 4096 }),
    fc.integer({ min: 1, max: 5 }),
    fc.constantFrom(1, -1),
    (step, rung, sign) => {
      const boundary = step ** rung;
      const below = boundary - boundary * Number.EPSILON;
      expect(byteUnitIndex(sign * boundary, step), `step ${step}, rung ${rung}`).to.equal(rung);
      expect(byteUnitIndex(sign * below, step), `below step ${step}, rung ${rung}`).to.equal(rung - 1);
    },
  ), propertyRuns());
});
