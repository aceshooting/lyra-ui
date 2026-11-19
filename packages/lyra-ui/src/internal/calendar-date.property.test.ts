import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { formatIsoDate, isValidIsoDate, parseIsoDate, utcDate } from './calendar-date.js';

describe('calendar-date ISO properties', () => {
  it('format/parse round trips every real day', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 31 }), (y, m, d) => {
        const real = utcDate(y, m - 1, d);
        const exists = real.getUTCFullYear() === y && real.getUTCMonth() === m - 1 && real.getUTCDate() === d;
        const text = formatIsoDate(y, m, d);
        expect(isValidIsoDate(text), text).to.equal(exists);
        if (exists) expect(parseIsoDate(text)).to.deep.equal({ y, m, d });
      }),
      propertyRuns(),
    );
  });
  it('never throws on arbitrary strings and only accepts the canonical form', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const parsed = parseIsoDate(s);
        if (parsed) expect(formatIsoDate(parsed.y, parsed.m, parsed.d)).to.equal(s);
      }),
      propertyRuns(),
    );
  });
});
