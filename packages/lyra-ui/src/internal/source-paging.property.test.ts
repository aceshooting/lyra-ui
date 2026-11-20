import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { displayedSourcePage, normalizeSourcePage, normalizeSourcePageSize, sourcePageOfRecord, SourceQueryInputs } from './source-paging.js';

const anyNumber = fc.oneof(fc.double(), fc.integer(), fc.constantFrom(Number.MAX_SAFE_INTEGER, -0, Infinity, -Infinity, NaN));

it('normalizes a page size to a whole number from 1 to 500', () => {
  fc.assert(fc.property(anyNumber, value => {
    const size = normalizeSourcePageSize(value);
    expect(Number.isInteger(size) && size >= 1 && size <= 500).to.equal(true);
    if (!Number.isFinite(value)) expect(size).to.equal(100);
  }), propertyRuns());
});

it('keeps the first record offset of a normalized page a safe integer', () => {
  fc.assert(fc.property(anyNumber, anyNumber, (page, pageSize) => {
    const normalized = normalizeSourcePage(page, pageSize);
    expect(Number.isInteger(normalized) && normalized >= 0).to.equal(true);
    expect(Number.isSafeInteger(normalized * normalizeSourcePageSize(pageSize))).to.equal(true);
  }), propertyRuns());
});

it('shows a safe one-based page and locates a record on the page that contains it', () => {
  fc.assert(fc.property(anyNumber, fc.nat(), anyNumber, (page, index, pageSize) => {
    const shown = displayedSourcePage(page);
    expect(Number.isSafeInteger(shown) && shown >= 1).to.equal(true);
    const size = normalizeSourcePageSize(pageSize);
    const located = sourcePageOfRecord(index, pageSize);
    expect(located * size <= index && index < (located + 1) * size).to.equal(true);
  }), propertyRuns());
});

it('reports a query change only after a previous request with different inputs', () => {
  fc.assert(fc.property(fc.array(fc.array(fc.constantFrom<unknown>('a', 'b', 1, null)), { minLength: 1, maxLength: 6 }), sequence => {
    const tracker = new SourceQueryInputs();
    sequence.forEach((inputs, index) => {
      const previous = sequence[index - 1];
      const expected = previous !== undefined && (previous.length !== inputs.length || inputs.some((value, at) => value !== previous[at]));
      expect(tracker.changed(inputs)).to.equal(expected);
    });
    tracker.clear();
    expect(tracker.changed(['other'])).to.equal(false);
  }), propertyRuns());
});
