import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { admitMapTerrain, normalizeMapProjection, snapshotMapSceneBaseline } from './map-scene-configuration.js';

describe('map scene configuration properties', () => {
  it('preserves every admitted finite nonnegative terrain exaggeration', () => {
    fc.assert(fc.property(fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }), (exaggeration) => {
      expect(admitMapTerrain({ source: 'dem', exaggeration })).to.deep.equal({ source: 'dem', exaggeration });
    }), propertyRuns());
  });

  it('never accepts an unrelated projection shorthand', () => {
    fc.assert(fc.property(fc.string(), (value) => {
      expect(normalizeMapProjection(value)).to.equal(value === 'globe' || value === 'mercator' ? value : undefined);
    }), propertyRuns());
  });

  it('detaches and preserves bounded transition metadata', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 100000 }), (duration) => {
      const input = { type: 'globe', transition: { duration } };
      const result = snapshotMapSceneBaseline(input, null);
      input.transition.duration = duration + 1;
      expect(result.projection).to.deep.equal({ type: 'globe', transition: { duration } });
    }), propertyRuns());
  });
});
