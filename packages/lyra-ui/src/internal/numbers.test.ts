import { expect } from '@open-wc/testing';
import {
  MAX_TIMEOUT_MS,
  finiteCount,
  finiteDuration,
  finiteInteger,
  finiteRange,
  isArrowKey,
  isSliderKey,
  decimalPlaces,
} from './numbers.js';

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

it('identifies arrow keys and the broader slider key set', () => {
  expect(isArrowKey('ArrowLeft')).to.be.true;
  expect(isArrowKey('ArrowRight')).to.be.true;
  expect(isArrowKey('ArrowUp')).to.be.true;
  expect(isArrowKey('ArrowDown')).to.be.true;
  expect(isArrowKey('Enter')).to.be.false;

  expect(isSliderKey('ArrowLeft')).to.be.true;
  expect(isSliderKey('Home')).to.be.true;
  expect(isSliderKey('End')).to.be.true;
  expect(isSliderKey('PageUp')).to.be.true;
  expect(isSliderKey('PageDown')).to.be.true;
  expect(isSliderKey('Enter')).to.be.false;
});

it('counts decimal places, including exponential-notation input', () => {
  expect(decimalPlaces(5)).to.equal(0);
  expect(decimalPlaces(0.1)).to.equal(1);
  expect(decimalPlaces(0.123)).to.equal(3);
  expect(decimalPlaces(0)).to.equal(0);
  expect(decimalPlaces(Number.NaN)).to.equal(0);
  // Regression: a naive `n.toString().indexOf('.')` approach returns -1 (and
  // thus 0) for exponential-notation numbers like 1e-7, which previously
  // rounded a stepped value to the wrong precision.
  expect(decimalPlaces(1e-7)).to.equal(7);
  expect(decimalPlaces(1.5e-3)).to.equal(4);
});
