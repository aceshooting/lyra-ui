import { expect } from '@open-wc/testing';
import { buildGeoJsonPropertyDiff, projectGeoJson } from './map-geojson-diff.js';

function collection(score: number, geometry: unknown = { type: 'Point', coordinates: [1, 2] }) {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'point', geometry, properties: { score } }] };
}

it('rejects revoked GeoJSON roots and feature arrays without poisoning later valid diffs', () => {
  const root = Proxy.revocable(collection(1), {});
  const features = Proxy.revocable(collection(1).features, {});
  root.revoke();
  features.revoke();
  for (const invalid of [root.proxy, { type: 'FeatureCollection', features: features.proxy }]) {
    const projection = projectGeoJson(invalid);
    expect(projection.collection).to.equal(undefined);
    expect(projection.diagnostics).to.deep.equal([]);
    expect(buildGeoJsonPropertyDiff(collection(1), invalid)).to.equal(null);
    expect(buildGeoJsonPropertyDiff(invalid, collection(2))).to.equal(null);
  }
  expect(buildGeoJsonPropertyDiff(collection(1), collection(2))).to.deep.equal({
    update: [{ id: 'point', addOrUpdateProperties: [{ key: 'score', value: 2 }], removeProperties: [] }],
  });
});

it('rejects geometry whose prototype cannot be inspected while retaining safe feature diagnostics', () => {
  let inspections = 0;
  const geometry = new Proxy({ type: 'Point', coordinates: [1, 2] }, {
    getPrototypeOf() { inspections += 1; throw new Error('prototype unavailable'); },
  });
  const invalid = collection(1, geometry);
  const projection = projectGeoJson(invalid);
  expect(inspections).to.equal(1);
  expect(projection.collection).to.equal(undefined);
  expect(projection.diagnostics.map(feature => ({ id: feature.id, index: feature.index, properties: [...feature.properties] }))).to.deep.equal([
    { id: 'point', index: 0, properties: [['score', 1]] },
  ]);
  expect(buildGeoJsonPropertyDiff(invalid, collection(2))).to.equal(null);
  expect(buildGeoJsonPropertyDiff(collection(1), collection(2))?.update).to.have.length(1);
});
