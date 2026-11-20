import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { WHEEL_NOTCH_PX, wheelZoomDelta, wheelZoomFactor } from './wheel-zoom.js';

const wheel = (deltaY: number, deltaMode: number, deltaX = 0): WheelEvent => ({ deltaY, deltaMode, deltaX }) as WheelEvent;

it('bounds every delta and zooms in the direction and proportion of the vertical motion', () => {
  fc.assert(fc.property(fc.double(), fc.constantFrom(0, 1, 2), fc.double(), (deltaY, deltaMode, pageSize) => {
    const delta = wheelZoomDelta(wheel(deltaY, deltaMode), pageSize);
    expect(Number.isFinite(delta) && Math.abs(delta) <= 300, 'bounded').to.equal(true);
    const factor = wheelZoomFactor(delta);
    expect(Number.isFinite(factor) && factor > 0, 'positive factor').to.equal(true);
    if (delta < 0) expect(factor, 'wheel up never zooms out').to.be.at.least(1);
    if (delta > 0) expect(factor, 'wheel down never zooms in').to.be.at.most(1);
  }), propertyRuns());
});

it('treats a horizontal swipe as no zoom, normalizes line deltas, and matches one notch to one zoom step', () => {
  expect(wheelZoomDelta(wheel(0, 0, 40), 600)).to.equal(0);
  expect(wheelZoomFactor(0)).to.equal(1);
  expect(wheelZoomDelta(wheel(3, 1), 600)).to.equal(48);
  expect(wheelZoomDelta(wheel(-1, 2), 200)).to.equal(-200);
  expect(wheelZoomFactor(-WHEEL_NOTCH_PX)).to.be.closeTo(1.2, 1e-9);
  expect(wheelZoomFactor(-2)).to.be.closeTo(1.0036, 1e-4);
});
