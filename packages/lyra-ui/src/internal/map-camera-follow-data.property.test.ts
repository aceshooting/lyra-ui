import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { admitMapCameraFollowProfile, createMapCameraFollowAttempt, observeMapCameraFollowAttempt } from './map-camera-follow-data.js';

function facts() {
  return {
    latitude: 0, zoom: 8, pitch: 60, width: 640, height: 480, projectionTransition: 1,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    explicitBounds: false, explicitZoomLimits: false, nativeBounds: false, nativeMinZoom: -2, nativeMaxZoom: 22,
    terrain: false, canPan: true, canObserveMotion: true, canStop: true, moving: false, hasProjection: true,
  };
}
const allocation = fc.integer({ min: 64, max: 4096 });
const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
const latitude = fc.double({ min: -80, max: 80, noNaN: true });
const globeAdjustment = (value: number) => Math.log2(Math.cos(Math.min(Math.abs(value), 85.051129) * Math.PI / 180));

describe('camera follow pure data properties', () => {
  it('admits inward normalized globe domains across latitude and positive transitions', () => {
    fc.assert(fc.property(latitude, fc.double({ min: 4.1, max: 19.9, noNaN: true }),
      fc.double({ min: 0.001, max: 1, noNaN: true }), (latitude, normalizedZoom, projectionTransition) => {
        const input = { ...facts(), latitude, zoom: normalizedZoom + globeAdjustment(latitude), projectionTransition };
        expect(admitMapCameraFollowProfile(input)).to.deep.equal({ status: 'admitted', helper: 'globe' });
      }), propertyRuns());
  });

  it('refuses raw-in-range cameras outside the normalized globe domain', () => {
    fc.assert(fc.property(latitude, fc.boolean(), (latitude, upper) => {
      const normalizedZoom = upper ? 20.25 : 3.75;
      const input = { ...facts(), latitude, zoom: normalizedZoom + globeAdjustment(latitude) };
      expect(admitMapCameraFollowProfile(input)).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
    }), propertyRuns());
  });

  it('uses raw mercator zoom while independently enforcing allocation, pitch and conditional stop capability', () => {
    fc.assert(fc.property(latitude, fc.double({ min: 4.1, max: 19.9, noNaN: true }), allocation, allocation,
      fc.double({ min: 0, max: 60, noNaN: true }), (latitude, zoom, width, height, pitch) => {
        const input = { ...facts(), latitude, zoom, width, height, pitch, projectionTransition: 0, canStop: false };
        expect(admitMapCameraFollowProfile(input)).to.deep.equal({ status: 'admitted', helper: 'mercator' });
        expect(admitMapCameraFollowProfile({ ...input, moving: true })).to.deep.equal({ status: 'unavailable', reason: 'camera-capability' });
        expect(admitMapCameraFollowProfile({ ...input, zoom: 3.75 })).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
        expect(admitMapCameraFollowProfile({ ...input, zoom: 20.25 })).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
      }), propertyRuns());
  });

  it('never emits a nonfinite or over-budget pixel correction for finite projected points', () => {
    fc.assert(fc.property(finite, finite, allocation, allocation, (x, y, width, height) => {
      const attempt = createMapCameraFollowAttempt();
      const result = observeMapCameraFollowAttempt(attempt, { frame: 0, point: [x, y], width, height });
      expect(Object.isFrozen(result.attempt)).to.equal(true);
      expect(attempt.corrections).to.equal(0);
      if (result.correction) {
        expect(Number.isFinite(result.correction[0]) && Number.isFinite(result.correction[1])).to.equal(true);
        expect(Math.abs(result.correction[0]) <= width / 2).to.equal(true);
        expect(Math.abs(result.correction[1]) <= height / 2).to.equal(true);
        expect(Object.isFrozen(result.correction)).to.equal(true);
        expect(result.attempt.corrections).to.equal(1);
      } else {
        expect(result.status).to.equal('centered');
        expect(Math.hypot(x - width / 2, y - height / 2) <= 2).to.equal(true);
      }
    }), propertyRuns());
  });

  it('does not consume correction or nonimprovement budget on duplicate and older frames', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1000000 }), allocation, allocation, (frame, width, height) => {
      const first = observeMapCameraFollowAttempt(createMapCameraFollowAttempt(), {
        frame, point: [width, height], width, height,
      });
      for (const ignoredFrame of [frame, frame - 1]) {
        const result = observeMapCameraFollowAttempt(first.attempt, { frame: ignoredFrame, point: [width / 2, height / 2], width, height });
        expect(result.correction).to.equal(undefined);
        expect(result.attempt.corrections).to.equal(first.attempt.corrections);
        expect(result.attempt.nonImproving).to.equal(first.attempt.nonImproving);
        expect(result.attempt.lastFrame).to.equal(frame);
        expect(result.status).to.equal(first.status);
      }
    }), propertyRuns());
  });

  it('caps improving attempts at four corrections or one reduced-motion correction and stays terminal', () => {
    fc.assert(fc.property(fc.boolean(), allocation, allocation, (reducedMotion, width, height) => {
      let attempt = createMapCameraFollowAttempt({ reducedMotion });
      const maximum = reducedMotion ? 1 : 4;
      let emitted = 0;
      for (let frame = 0; frame < 7; frame++) {
        const before = attempt;
        const result = observeMapCameraFollowAttempt(attempt, {
          frame, point: [width / 2 + width / (2 * (frame + 1)), height / 2], width, height,
        });
        if (result.correction) emitted++;
        attempt = result.attempt;
        expect(attempt.corrections <= maximum).to.equal(true);
        expect(Object.isFrozen(before) && Object.isFrozen(attempt)).to.equal(true);
      }
      expect(emitted).to.equal(maximum);
      expect(attempt.status).to.equal('limited');
      const terminal = observeMapCameraFollowAttempt(attempt, { frame: 100, point: [width / 2, height / 2], width, height });
      expect(terminal.status).to.equal('limited'); expect(terminal.correction).to.equal(undefined);
      expect(terminal.attempt.corrections).to.equal(maximum);
    }), propertyRuns());
  });

  it('terminates two consecutive nonimprovements and never restarts a centered attempt', () => {
    fc.assert(fc.property(allocation, allocation, (width, height) => {
      let attempt = createMapCameraFollowAttempt();
      for (let frame = 0; frame < 3; frame++) {
        attempt = observeMapCameraFollowAttempt(attempt, { frame, point: [width, height], width, height }).attempt;
      }
      expect(attempt.status).to.equal('limited'); expect(attempt.corrections).to.equal(2);
      expect(attempt.nonImproving).to.equal(2);
      const centered = observeMapCameraFollowAttempt(createMapCameraFollowAttempt(), { frame: 0, point: [width / 2, height / 2], width, height });
      expect(centered.status).to.equal('centered');
      const later = observeMapCameraFollowAttempt(centered.attempt, { frame: 1, point: [width, height], width, height });
      expect(later.status).to.equal('centered'); expect(later.correction).to.equal(undefined); expect(later.attempt.corrections).to.equal(0);
    }), propertyRuns());
  });
});
