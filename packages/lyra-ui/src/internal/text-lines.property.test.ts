import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { countLines, splitLines } from './text-lines.js';

const text = fc.string({ unit: fc.constantFrom('a', 'b', ' ', '\n', '\r'), maxLength: 40 });

describe('text-lines properties', () => {
  it('matches split(/\\r\\n|\\r|\\n/) and countLines', () => {
    fc.assert(
      fc.property(text, (s) => {
        const expected = s.split(/\r\n|\r|\n/);
        expect(splitLines(s)).to.deep.equal(expected);
        expect(countLines(s)).to.equal(expected.length);
      }),
      propertyRuns(),
    );
  });
  it('a limit returns a prefix of the full split', () => {
    fc.assert(
      fc.property(text, fc.integer({ min: 1, max: 10 }), (s, limit) => {
        expect(splitLines(s, limit)).to.deep.equal(splitLines(s).slice(0, limit));
      }),
      propertyRuns(),
    );
  });
});
