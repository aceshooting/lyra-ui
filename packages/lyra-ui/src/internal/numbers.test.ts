import { expect } from '@open-wc/testing';
import { MAX_TIMEOUT_MS, finiteCount, finiteDuration, finiteInteger, finiteRange } from './numbers.js';

it('normalizes finite ranges without leaking non-finite input', () => {
  expect(finiteRange(Number.NaN, 5, 0, 10)).to.equal(5);
  expect(finiteRange(Number.POSITIVE_INFINITY, 5, 0, 10)).to.equal(5);
  expect(finiteRange(Number.NEGATIVE_INFINITY, 5, 0, 10)).to.equal(5);
  expect(finiteRange(-4, 5, 0, 10)).to.equal(0);
  expect(finiteRange(99, 5, 0, 10)).to.equal(10);
  expect(finiteRange(3, Number.NaN, 0, 10)).to.equal(3);
});

it('normalizes integer counts and caps huge values', () => {
  expect(finiteInteger(3.9, 0)).to.equal(3);
  expect(finiteInteger(Number.NaN, 7)).to.equal(7);
  expect(finiteCount(-4)).to.equal(0);
  expect(finiteCount(Number.POSITIVE_INFINITY, 2)).to.equal(2);
  expect(finiteCount(Number.MAX_VALUE)).to.equal(Number.MAX_SAFE_INTEGER);
});

it('normalizes durations to finite timer-safe values', () => {
  expect(finiteDuration(Number.NaN, 900)).to.equal(900);
  expect(finiteDuration(Number.POSITIVE_INFINITY, 900)).to.equal(900);
  expect(finiteDuration(-10, 900, 16)).to.equal(16);
  expect(finiteDuration(Number.MAX_VALUE, 900)).to.equal(MAX_TIMEOUT_MS);
});
