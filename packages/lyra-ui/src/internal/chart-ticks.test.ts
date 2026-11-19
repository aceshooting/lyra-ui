import { expect } from '@open-wc/testing';
import { boundedTicks, niceStep } from './chart-ticks.js';

describe('chart-ticks', () => {
  it('picks 1/2/5 steps across decades', () => {
    expect(niceStep(10, 5)).to.equal(2);
    expect(niceStep(1000, 5)).to.equal(200);
    expect(niceStep(0.1, 5)).to.be.closeTo(0.02, 1e-12);
    expect(niceStep(100, 5)).to.equal(20);
  });
  it('returns 1 for degenerate ranges', () => {
    for (const r of [0, -5, NaN, Infinity]) expect(niceStep(r, 5)).to.equal(1);
  });
  it('produces ascending aligned ticks', () => {
    expect(boundedTicks(0, 100, 25)).to.deep.equal([0, 25, 50, 75, 100]);
    expect(boundedTicks(3, 47, 10)).to.deep.equal([10, 20, 30, 40, 50]);
  });
  it('accepts descending endpoints', () => {
    expect(boundedTicks(100, 0, 50)).to.deep.equal([0, 50, 100]);
  });
  it('is bounded and degenerate-safe', () => {
    expect(boundedTicks(0, 1e9, 1).length).to.be.at.most(64);
    expect(boundedTicks(0, 1e9, 1, 5).length).to.equal(5);
    expect(boundedTicks(5, 5, 1)).to.deep.equal([5]);
    expect(boundedTicks(0, 10, 0)).to.deep.equal([0, 10]);
    expect(boundedTicks(0, Number.MAX_VALUE, Number.MAX_VALUE / 4).length).to.be.at.most(64);
    expect(boundedTicks(NaN, 1, 1)).to.deep.equal([]);
  });
});
