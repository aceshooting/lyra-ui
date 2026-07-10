import { expect } from '@open-wc/testing';
import { linearAlpha, sqrtStep } from './heatmap-scale.js';

it('linearAlpha maps the value range to a 0.1-1.0 alpha ramp', () => {
  expect(linearAlpha(0, 0, 10)).to.equal(0.1);
  expect(linearAlpha(10, 0, 10)).to.equal(1);
  expect(linearAlpha(5, 0, 10)).to.be.closeTo(0.55, 0.001);
});

it('linearAlpha handles a zero-span range without dividing by zero', () => {
  expect(linearAlpha(5, 5, 5)).to.equal(0.1);
});

it('sqrtStep returns -1 for no-data or degenerate max', () => {
  expect(sqrtStep(0, 10, 7)).to.equal(-1);
  expect(sqrtStep(5, 0, 7)).to.equal(-1);
});

it('sqrtStep compresses large counts so one outlier does not dominate', () => {
  const stepAtQuarter = sqrtStep(25, 100, 7);
  const stepAtMax = sqrtStep(100, 100, 7);
  expect(stepAtMax).to.equal(6);
  // sqrt(25/100) = 0.5, so this should land roughly mid-scale, not near 0
  expect(stepAtQuarter).to.be.greaterThan(2);
});
