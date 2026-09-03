import { expect } from '@open-wc/testing';
import { clampSteppedValue } from './step-value.js';

it('preserves exact endpoints and snap-final-clamps beyond a non-grid boundary', () => {
  expect(clampSteppedValue(1, 0, 1, 0.7)).to.equal(1);
  const endpoint = clampSteppedValue(1.1, 0, 1, 0.7);
  expect(endpoint).to.equal(1);
  expect(clampSteppedValue(endpoint, 0, 1, 0.7)).to.equal(endpoint);
  expect(clampSteppedValue(1.1, 1, 0, 0.7)).to.equal(1);
});

it('keeps malformed raw values and steps finite within sorted bounds', () => {
  expect(clampSteppedValue(Number.NaN, 0, 1, 0.7)).to.equal(0);
  expect(clampSteppedValue(Number.POSITIVE_INFINITY, 0, 1, 0.7)).to.equal(0);
  expect(clampSteppedValue(Number.NEGATIVE_INFINITY, 0, 1, 0.7)).to.equal(0);
  expect(clampSteppedValue(2, 0, 1, 0)).to.equal(1);
  expect(clampSteppedValue(2, 0, 1, Number.POSITIVE_INFINITY)).to.equal(1);
  expect(clampSteppedValue(0.4, 1, 0, Number.NEGATIVE_INFINITY)).to.equal(0.4);
});

it('retains finite extreme candidates when step arithmetic or precision rounding overflows', () => {
  const huge = clampSteppedValue(5e293, 0, 1e300, 5e-15);
  expect(Number.isFinite(huge)).to.be.true;
  expect(huge).to.be.closeTo(5e293, 1e280);
  expect(
    clampSteppedValue(Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE),
  ).to.equal(Number.MAX_VALUE);
  expect(
    clampSteppedValue(-Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE),
  ).to.equal(-Number.MAX_VALUE);
});

it('does not lose high-precision finite grid values when normalization repeats', () => {
  const tiny = clampSteppedValue(1.5e-16, 0, 1e-15, 1e-16);
  expect(tiny).to.equal(2e-16);

  const first = clampSteppedValue(
    12132226.858520877,
    -15285603.003576398,
    45642907.80108422,
    2.912973915446301e-9,
  );
  expect(
    clampSteppedValue(first, -15285603.003576398, 45642907.80108422, 2.912973915446301e-9),
  ).to.equal(first);
});

it('leaves a grid below the finite domain resolution stable across re-clamping', () => {
  const raw = 2295446.3958740234;
  const first = clampSteppedValue(raw, 0, 1e9, 1e-9);
  expect(first).to.equal(raw);
  expect(clampSteppedValue(first, 0, 1e9, 1e-9)).to.equal(first);
});

it('still snaps a locally representable value when the unused upper bound is distant', () => {
  expect(clampSteppedValue(0.1000000004, 0, 1e9, 1e-9)).to.equal(0.1);
});

it('retains low-end precision on positive, negative, and subnormal offset grids', () => {
  // The grid is anchored at `min`, so its fractional precision can exceed the
  // precision implied by `step` alone.
  expect(clampSteppedValue(1.5, 0.5, 10, 1)).to.equal(1.5);
  expect(clampSteppedValue(0.17, 0.07, 1, 0.1)).to.equal(0.17);
  expect(clampSteppedValue(-0.17, -0.93, 1, 0.1)).to.equal(-0.13);
  expect(clampSteppedValue(2.5e-16, 1.5e-16, 1e-15, 1e-16)).to.equal(2.5e-16);
});
