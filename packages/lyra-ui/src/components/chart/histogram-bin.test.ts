import { expect } from '@open-wc/testing';
import { binValues } from './histogram-bin.js';

it('splits values into equal-width buckets and counts membership', () => {
  const buckets = binValues([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
  expect(buckets.length).to.equal(5);
  expect(buckets.reduce((sum, b) => sum + b.count, 0)).to.equal(11);
});

it('places a value equal to the maximum in the last bucket', () => {
  const buckets = binValues([0, 10], 2);
  expect(buckets[1].count).to.equal(1);
});

it('labels each bucket with its numeric range', () => {
  const buckets = binValues([0, 10], 2);
  expect(buckets[0].label).to.match(/0\.0.*5\.0/);
});

it('returns an empty array for empty input', () => {
  expect(binValues([], 5)).to.deep.equal([]);
});

it('returns an empty array instead of throwing when binCount is 0', () => {
  expect(binValues([1, 2, 3], 0)).to.deep.equal([]);
});

it('returns an empty array instead of throwing when binCount is negative', () => {
  expect(binValues([1, 2, 3], -2)).to.deep.equal([]);
});
