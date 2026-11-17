import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { mapCanvasAllocation } from './map-canvas-target.js';

const positive = fc.integer({ min: 1, max: 1000 });
const inset = fc.integer({ min: 0, max: 400 });
describe('map canvas allocation geometry', () => {
  it('recovers independently authored local rectangles after translation and positive scaling', () => {
    fc.assert(fc.property(positive, positive, inset, inset, inset, inset,
      fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }),
      fc.constantFrom(0.25, 0.5, 1, 1.5, 2, 4), fc.constantFrom(0.25, 0.5, 1, 1.5, 2, 4),
      (width, height, top, right, bottom, left, x, y, sx, sy) => {
        const host = { left: x + left * sx, top: y + top * sy, width: width * sx, height: height * sy };
        const target = { left: x, top: y, width: (left + width + right) * sx, height: (top + height + bottom) * sy };
        const result = mapCanvasAllocation(host, target, width, height);
        expect(result).to.deep.equal({ left: left ? -left : 0, top: top ? -top : 0, width: left + width + right,
          height: top + height + bottom, padding: { left, top, right, bottom } });
      }), propertyRuns());
  });
  it('refuses a host outside any target edge instead of silently intersecting the usable region', () => {
    fc.assert(fc.property(positive, positive, positive, (width, height, distance) => {
      const target = { left: 0, top: 0, width, height };
      for (const [left, top] of [[-distance, 0], [distance, 0], [0, -distance], [0, distance]]) {
        expect(mapCanvasAllocation({ left: left!, top: top!, width, height }, target, width, height)).to.equal(undefined);
      }
    }), propertyRuns());
  });
  it('never admits nonfinite or empty dimensions', () => {
    fc.assert(fc.property(positive, fc.constantFrom(0, -1, NaN, Infinity, -Infinity), (size, invalid) => {
      const rect = { left: 0, top: 0, width: size, height: size };
      expect(mapCanvasAllocation(rect, rect, invalid, size)).to.equal(undefined);
      expect(mapCanvasAllocation(rect, rect, size, invalid)).to.equal(undefined);
      expect(mapCanvasAllocation({ ...rect, width: invalid }, rect, size, size)).to.equal(undefined);
      expect(mapCanvasAllocation(rect, { ...rect, height: invalid }, size, size)).to.equal(undefined);
    }), propertyRuns());
  });
});
