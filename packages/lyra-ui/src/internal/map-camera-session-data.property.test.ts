import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { admitMapViewpoint, admitMapCameraTour, sampleMapCameraTour } from './map-camera-session-data.js';

const finite = fc.double({ noNaN: true, noDefaultInfinity: true });
const position = fc.tuple(fc.double({ min: -180, max: 180, noNaN: true }), fc.double({ min: -90, max: 90, noNaN: true }));
const viewpoint = fc.record({ center: position, zoom: finite, bearing: finite, pitch: fc.double({ min: 0, max: 85, noNaN: true }) });

describe('camera session data properties', () => {
  it('normalizes every finite bearing into the half-open range without changing admitted position or zoom', () => {
    fc.assert(fc.property(viewpoint, input => {
      const result = admitMapViewpoint(input);
      expect(result.bearing >= -180 && result.bearing < 180).to.equal(true);
      expect(result.center).to.deep.equal(input.center); expect(result.zoom).to.equal(input.zoom);
      expect(admitMapViewpoint(result)).to.deep.equal(result);
    }), propertyRuns());
  });

  it('samples a finite convex zoom and bounded position for every admitted endpoint pair', () => {
    fc.assert(fc.property(viewpoint, viewpoint, fc.double({ min: 0, max: 1, noNaN: true }), (first, last, ratio) => {
      const admitted = admitMapCameraTour({ keyframes: [{ instant: 0, view: first }, { instant: 1000, view: last }] });
      const result = sampleMapCameraTour(admitted, ratio * 1000);
      expect(Number.isFinite(result.zoom)).to.equal(true);
      expect(result.zoom >= Math.min(first.zoom, last.zoom) && result.zoom <= Math.max(first.zoom, last.zoom)).to.equal(true);
      expect(result.center[0] >= -180 && result.center[0] <= 180).to.equal(true);
      expect(result.center[1] >= -90 && result.center[1] <= 90).to.equal(true);
      expect(result.bearing >= -180 && result.bearing < 180).to.equal(true);
      expect(result.pitch >= 0 && result.pitch <= 85).to.equal(true);
      expect(Object.isFrozen(result) && Object.isFrozen(result.center)).to.equal(true);
    }), propertyRuns());
  });

  it('holds lower keyframes under reduced motion and preserves exact keyframes', () => {
    fc.assert(fc.property(viewpoint, viewpoint, fc.integer({ min: 1, max: 999 }), (first, last, instant) => {
      const admitted = admitMapCameraTour({ keyframes: [{ instant: 0, view: first }, { instant: 1000, view: last }] });
      expect(sampleMapCameraTour(admitted, instant, { reducedMotion: true })).to.deep.equal(admitted.keyframes[0]!.view);
      expect(sampleMapCameraTour(admitted, 1000, { reducedMotion: true })).to.deep.equal(admitted.keyframes[1]!.view);
    }), propertyRuns());
  });
});
