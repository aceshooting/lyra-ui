import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { mergeSafeAreas, obstacleEdges } from './map-anchor-avoid.js';

const length = fc.integer({ min: 0, max: 400 });
const edge = fc.option(fc.integer({ min: 0, max: 200 }), { nil: undefined });
const area = fc.record({ blockStart: edge, inlineEnd: edge, blockEnd: edge, inlineStart: edge }, { requiredKeys: [] });

describe('anchor obstacle properties', () => {
  it('reserves exactly one edge, no wider than the overlap pushed back to that edge', () => {
    fc.assert(fc.property(length, length, length, length, (x, y, width, height) => {
      const map = new DOMRect(0, 0, 400, 300), obstacle = new DOMRect(x, y, width, height);
      const edges = obstacleEdges(map, obstacle);
      const overlaps = Math.min(400, x + width) > Math.max(0, x) && Math.min(300, y + height) > Math.max(0, y);
      expect(edges === undefined, 'only an overlapping obstacle reserves space').to.equal(!overlaps);
      if (!edges) return;
      const used = Object.values(edges).filter(value => value > 0);
      expect(used.length, 'one edge').to.equal(1);
      expect(used[0]! <= Math.max(400, 300), 'bounded by the map').to.equal(true);
    }), propertyRuns());
  });

  it('merges edge by edge with the larger inset and keeps an invalid authored area for fail-closed placement', () => {
    fc.assert(fc.property(fc.option(area, { nil: undefined }), fc.option(area, { nil: undefined }), (authored, avoid) => {
      const merged = mergeSafeAreas(authored, avoid);
      if (!avoid || !authored) { expect(merged).to.equal(authored ?? avoid); return; }
      for (const key of ['blockStart', 'inlineEnd', 'blockEnd', 'inlineStart'] as const) {
        expect(merged![key], key).to.equal(Math.max(authored[key] ?? 0, avoid[key] ?? 0));
      }
    }), propertyRuns());
    const invalid = { blockStart: -1 }, accessor = Object.defineProperty({}, 'blockEnd', { get: () => 4, enumerable: true });
    expect(mergeSafeAreas(invalid, { blockStart: 3 })).to.equal(invalid);
    expect(mergeSafeAreas(accessor, { blockStart: 3 })).to.equal(accessor);
  });
});
