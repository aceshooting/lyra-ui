import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { createHaystackMemo, foldSearchText, prepareNeedle } from './search-haystack.js';

const text = fc.string({ maxLength: 24 });

describe('search haystack properties', () => {
  it('is idempotent: folding folded text changes nothing', () => {
    fc.assert(fc.property(text, (value) => {
      const once = foldSearchText(value, 'en');
      expect(foldSearchText(once, 'en')).to.equal(once);
    }), propertyRuns());
  });

  it('removes combining marks and case, so an accented query finds its plain text', () => {
    fc.assert(fc.property(fc.constantFrom('é', 'ñ', 'ü', 'å', 'ç'), fc.string({ minLength: 0, maxLength: 6, unit: fc.constantFrom('a', 'b', 'c') }), (accented, rest) => {
      const folded = foldSearchText(`${accented}${rest}`.toUpperCase(), 'en');
      expect(/\p{M}/u.test(folded), 'no combining marks').to.equal(false);
      expect(folded).to.equal(folded.toLowerCase());
    }), propertyRuns());
  });

  it('trims the needle before folding and never throws', () => {
    fc.assert(fc.property(text, fc.constantFrom('', ' ', '\t'), (value, pad) => {
      expect(prepareNeedle(`${pad}${value}${pad}`, 'en')).to.equal(foldSearchText(value.trim(), 'en'));
    }), propertyRuns());
  });

  it('memoizes per array and locale and folds each entry exactly once', () => {
    fc.assert(fc.property(fc.array(text, { maxLength: 12 }), (entries) => {
      let calls = 0;
      const haystack = createHaystackMemo<string>((entry, locale) => { calls++; return foldSearchText(entry, locale); });
      const first = haystack(entries, 'en');
      expect(haystack(entries, 'en'), 'same array and locale reuses the result').to.equal(first);
      expect(calls, 'one fold per entry').to.equal(entries.length);
      expect(first.length).to.equal(entries.length);
    }), propertyRuns());
  });
});
