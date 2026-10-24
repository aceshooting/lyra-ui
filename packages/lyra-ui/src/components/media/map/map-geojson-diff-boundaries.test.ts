import { expect } from '@open-wc/testing';
import { buildGeoJsonPropertyDiff, projectGeoJson } from './map-geojson-diff.js';

function collection(score: number, geometry: unknown = { type: 'Point', coordinates: [1, 2] }) {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'point', geometry, properties: { score } }] };
}
const pointGeometry = () => ({ type: 'Point', coordinates: [1, 2] });
const lineGeometry = (points: number) => ({ type: 'LineString', coordinates: Array.from({ length: points }, (_, index) => [index / 1000, index / 2000]) });
const featureOf = (id: string, geometry: unknown, score = 1) => ({ type: 'Feature', id, geometry, properties: { score } });
const collectionOf = (...features: unknown[]) => ({ type: 'FeatureCollection', features });
const scoreUpdate = (id: string, value: number) => ({ id, addOrUpdateProperties: [{ key: 'score', value }], removeProperties: [] });

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

it('stops projecting a geometry that exceeds the bounded work budget and keeps the property diagnostics', () => {
  const small = projectGeoJson(collection(1, lineGeometry(6_000)));
  const large = projectGeoJson(collection(1, lineGeometry(12_000)));
  expect(small.collection !== undefined).to.equal(true);
  expect(large.collection).to.equal(undefined);
  expect(large.diagnostics.map(feature => feature.id)).to.deep.equal(['point']);
  expect(buildGeoJsonPropertyDiff(collection(1, lineGeometry(6_000)), collection(2, lineGeometry(6_000)))?.update).to.deep.equal([scoreUpdate('point', 2)]);
  expect(buildGeoJsonPropertyDiff(collection(1, lineGeometry(12_000)), collection(2, lineGeometry(12_000)))).to.equal(null);
});

it('rejects geometry records whose prototype does not carry the native Object constructor', () => {
  const prototypes: Record<string, object> = {
    'a prototype without a constructor': Object.create(null) as object,
    'a non-function constructor': Object.create(null, { constructor: { value: 5 } }) as object,
    'an accessor constructor': Object.create(null, { constructor: { get() { return Object; } } }) as object,
  };
  for (const [name, prototype] of Object.entries(prototypes)) {
    const geometry = Object.assign(Object.create(prototype) as object, pointGeometry());
    const projection = projectGeoJson(collection(1, geometry));
    expect(projection.collection, name).to.equal(undefined);
    expect(projection.diagnostics.length, name).to.equal(1);
    expect(buildGeoJsonPropertyDiff(collection(1, geometry), collection(2)), name).to.equal(null);
  }
});

it('compares sparse coordinate arrays slot by slot', () => {
  const sparse = () => ({ type: 'MultiPoint', coordinates: [[1, 2], , [5, 6]] });
  const filled = { type: 'MultiPoint', coordinates: [[1, 2], [3, 4], [5, 6]] };
  expect(projectGeoJson(collection(1, sparse())).collection !== undefined).to.equal(true);
  expect(buildGeoJsonPropertyDiff(collection(1, sparse()), collection(2, sparse()))?.update).to.deep.equal([scoreUpdate('point', 2)]);
  expect(buildGeoJsonPropertyDiff(collection(1, sparse()), collection(1, filled))).to.equal(null);
  expect(buildGeoJsonPropertyDiff(collection(1, filled), collection(1, sparse()))).to.equal(null);
});

it('treats a missing geometry member as an absent geometry', () => {
  const bare = (score: number) => collectionOf({ type: 'Feature', id: 'point', properties: { score } });
  expect(buildGeoJsonPropertyDiff(bare(1), bare(2))?.update).to.deep.equal([scoreUpdate('point', 2)]);
  expect(buildGeoJsonPropertyDiff(bare(1), collection(1))).to.equal(null);
  expect(buildGeoJsonPropertyDiff(collection(1), bare(1))).to.equal(null);
});

it('distinguishes one geometry object shared by features from equal copies', () => {
  const shared = pointGeometry();
  const copies = () => collectionOf(featureOf('a', pointGeometry()), featureOf('b', pointGeometry()));
  const aliased = () => collectionOf(featureOf('a', shared), featureOf('b', shared));
  expect(buildGeoJsonPropertyDiff(copies(), aliased())).to.equal(null);
  expect(buildGeoJsonPropertyDiff(aliased(), copies())).to.equal(null);
  const another = pointGeometry();
  expect(buildGeoJsonPropertyDiff(aliased(), collectionOf(featureOf('a', another, 2), featureOf('b', another)))).to.deep.equal({ update: [scoreUpdate('a', 2)] });
});

it('ignores enumerable members inherited from a foreign realm prototype', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const realm = frame.contentWindow as unknown as typeof globalThis;
    Object.defineProperty(realm.Object.prototype, 'inheritedLabel', { value: 'x', enumerable: true, configurable: true });
    const foreign = Object.assign(new realm.Object(), pointGeometry());
    const enumerated: string[] = [];
    for (const key in foreign) enumerated.push(key);
    expect(enumerated).to.deep.equal(['type', 'coordinates', 'inheritedLabel']);
    expect(projectGeoJson(collection(1, foreign)).collection !== undefined).to.equal(true);
    expect(buildGeoJsonPropertyDiff(collection(1, foreign), collection(2))?.update).to.deep.equal([scoreUpdate('point', 2)]);
  } finally { frame.remove(); }
});
