import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { buildGeoJsonPropertyDiff } from './map-geojson-diff.js';

it('emits exactly the changed score for stable ids and equivalent geometry without changing caller data', () => {
  const inputs = fc.record({
    id: fc.oneof(fc.integer(), fc.string({ maxLength: 40 })),
    beforeScore: fc.integer(),
    candidateScore: fc.integer(),
    unchanged: fc.boolean(),
    longitude: fc.integer({ min: -180, max: 180 }),
    latitude: fc.integer({ min: -90, max: 90 }),
  });
  fc.assert(fc.property(inputs, ({ id, beforeScore, candidateScore, unchanged, longitude, latitude }) => {
    const afterScore = unchanged ? beforeScore : candidateScore;
    const beforeGeometry = { type: 'Point', coordinates: [longitude, latitude] };
    const afterGeometry = { type: 'Point', coordinates: [longitude, latitude] };
    const beforeFeature = { type: 'Feature', id, geometry: beforeGeometry, properties: { score: beforeScore } };
    const afterFeature = { type: 'Feature', id, geometry: afterGeometry, properties: { score: afterScore } };
    const before = { type: 'FeatureCollection', features: [beforeFeature] };
    const after = { type: 'FeatureCollection', features: [afterFeature] };
    const beforeValue = structuredClone(before);
    const afterValue = structuredClone(after);

    const actual = buildGeoJsonPropertyDiff(before, after);
    const expected = {
      update: beforeScore === afterScore ? [] : [{
        id, addOrUpdateProperties: [{ key: 'score', value: afterScore }], removeProperties: [],
      }],
    };
    expect(actual).to.deep.equal(expected);
    expect(before).to.deep.equal(beforeValue);
    expect(after).to.deep.equal(afterValue);
    expect(before.features[0] === beforeFeature).to.equal(true);
    expect(after.features[0] === afterFeature).to.equal(true);
    expect(beforeFeature.geometry === beforeGeometry).to.equal(true);
    expect(afterFeature.geometry === afterGeometry).to.equal(true);
    expect(Object.isFrozen(beforeGeometry)).to.equal(false);
    expect(Object.isFrozen(afterGeometry)).to.equal(false);
  }), propertyRuns());
});
