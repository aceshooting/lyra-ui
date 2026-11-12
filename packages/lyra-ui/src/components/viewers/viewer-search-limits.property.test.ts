import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../test/property-options.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from './viewer-search-limits.js';

const asciiText = fc.array(fc.constantFrom('A', 'B', 'C', 'x', 'y', 'z'), { minLength: 1, maxLength: 50 }).map(parts => parts.join(''));

describe('model-viewer search budget properties', () => {
  it('reserves output work after empty fragments consume their own admission work', () => {
    fc.assert(fc.property(asciiText, fc.integer({ min: 1, max: 50 }), (text, emptyCount) => {
      const chunks = [...Array<string>(emptyCount).fill(''), text];
      const needle = text.toLowerCase();
      const completeCost = emptyCount + text.length * 2;
      const short = new ViewerSearchWorkBudget(completeCost - 1);
      expect(short.includesJoined(chunks, needle, 'en'), 'an unfunded folded result must not become a match').to.equal(false);
      expect(short.complete).to.equal(false);
      expect(short.exhausted).to.equal(true);
      expect(short.includes('A', 'a', 'en'), 'later fields cannot spend exhausted work').to.equal(false);

      const exact = new ViewerSearchWorkBudget(completeCost);
      expect(exact.includesJoined(chunks, needle, 'en')).to.equal(true);
      expect(exact.complete).to.equal(true);
      expect(exact.exhausted).to.equal(true);
    }), propertyRuns());
  });

  it('matches across fragment boundaries under a sufficient budget', () => {
    fc.assert(fc.property(fc.array(asciiText, { minLength: 2, maxLength: 10 }), chunks => {
      const joined = chunks.join('');
      const budget = new ViewerSearchWorkBudget(joined.length * 2);
      expect(budget.includesJoined(chunks, joined.toLowerCase(), 'en')).to.equal(true);
      expect(budget.complete).to.equal(true);
      expect(budget.exhausted).to.equal(true);
    }), propertyRuns());
  });

  it('folds queries and joined fields consistently for Turkish and expanding English letters', () => {
    fc.assert(fc.property(
      fc.array(fc.constantFrom('I', '\u0130', '\u0131', 'A'), { minLength: 1, maxLength: 30 }),
      fc.constantFrom('en', 'tr'),
      (chunks, locale) => {
        const text = chunks.join('');
        const query = boundedViewerSearchQuery(text, locale);
        const budget = new ViewerSearchWorkBudget(text.length * 5);
        expect(query.accepted).to.equal(true);
        expect(query.needle).to.equal(text.toLocaleLowerCase(locale));
        expect(budget.includesJoined(chunks, query.needle, locale)).to.equal(true);
        expect(budget.complete).to.equal(true);
      },
    ), propertyRuns());
  });
});
