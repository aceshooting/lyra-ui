import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { pageSizeChoices, remapPageForSize } from './page-size.js';

const sizeLike = fc.oneof(fc.integer({ min: -5, max: 500 }), fc.double(), fc.constant(Number.NaN), fc.string());

it('lists unique ascending positive integers that include the applied size', () => {
  fc.assert(fc.property(fc.array(sizeLike), fc.integer({ min: -5, max: 500 }), (options, current) => {
    const choices = pageSizeChoices(options, current);
    expect(new Set(choices).size).to.equal(choices.length);
    choices.forEach((size, index) => {
      expect(Number.isInteger(size) && size > 0).to.equal(true);
      if (index > 0) expect(size).to.be.greaterThan(choices[index - 1]!);
    });
    if (current > 0) expect(choices.includes(current)).to.equal(true);
  }), propertyRuns());
});

it('lands on the page holding the old first item, within the new page count', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 1000 }),
    fc.integer({ min: 1, max: 200 }),
    fc.integer({ min: 1, max: 200 }),
    fc.integer({ min: 0, max: 50000 }),
    (page, fromSize, toSize, total) => {
      const next = remapPageForSize(page, fromSize, toSize, total);
      expect(next).to.be.greaterThanOrEqual(1);
      if (total > 0) expect(next).to.be.lessThanOrEqual(Math.max(1, Math.ceil(total / toSize)));
      const firstItem = (page - 1) * fromSize;
      if (total === 0 || firstItem < total) {
        expect(next).to.equal(Math.floor(firstItem / toSize) + 1);
      }
    },
  ), propertyRuns());
});

it('falls back to page 1 for an unusable size and skips the clamp without a known total', () => {
  expect(remapPageForSize(4, 10, 0)).to.equal(1);
  expect(remapPageForSize(4, 10, Number.NaN, 95)).to.equal(1);
  expect(remapPageForSize(4, 10, 20)).to.equal(2);
  expect(remapPageForSize(4, 10, 20, 0)).to.equal(2);
  expect(remapPageForSize(9, 10, 50, 95)).to.equal(2);
});
