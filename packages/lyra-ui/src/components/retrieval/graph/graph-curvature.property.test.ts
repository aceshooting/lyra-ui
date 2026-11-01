import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { graphCurveExtrema, graphCurvePoint, normalizeGraphCurvature } from './graph-curvature.js';

const position = fc.record({ x: fc.integer({ min: -10_000_000, max: 10_000_000 }),
  y: fc.integer({ min: -10_000_000, max: 10_000_000 }), z: fc.integer({ min: -10_000_000, max: 10_000_000 }) });

describe('graph curve properties', () => {
  it('retains endpoints and finite unclamped geometry within analytic extrema', () => {
    fc.assert(fc.property(position, position, fc.integer({ min: -100, max: 100 }), fc.integer({ min: 0, max: 1000 }), (a, b, raw, step) => {
      const curvature = normalizeGraphCurvature(raw / 100), t = step / 1000;
      expect(graphCurvePoint(a, b, curvature, 0)).to.deep.equal(a);
      expect(graphCurvePoint(a, b, curvature, 1)).to.deep.equal(b);
      const point = graphCurvePoint(a, b, curvature, t), extrema = graphCurveExtrema(a, b, curvature);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(Number.isFinite(point[axis])).to.equal(true);
        expect(point[axis]).to.be.at.least(Math.min(...extrema.map(value => value[axis])) - 1e-7);
        expect(point[axis]).to.be.at.most(Math.max(...extrema.map(value => value[axis])) + 1e-7);
      }
    }), propertyRuns());
  });
});
