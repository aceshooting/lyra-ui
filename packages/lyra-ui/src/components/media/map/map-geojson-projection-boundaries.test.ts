import { expect } from '@open-wc/testing';
import { buildGeoJsonPropertyDiff, projectAdmittedGeoJson, projectGeoJson } from './map-geojson-diff.js';

function collection(properties: unknown, geometry: unknown = { type: 'Point', coordinates: [1, 2] }) {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'point', properties, geometry }] };
}

describe('map GeoJSON projection boundaries', () => {
  it('treats null and absent properties as empty while retaining later property additions', () => {
    const absent = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'point', geometry: { type: 'Point', coordinates: [1, 2] } }] };
    for (const before of [collection(null), absent]) {
      const projection = projectGeoJson(before);
      expect(projection.collection !== undefined).to.equal(true);
      expect(projection.diagnostics.map(feature => [...feature.properties])).to.deep.equal([[]]);
      expect(buildGeoJsonPropertyDiff(before, collection({ score: 2 }))).to.deep.equal({ update: [
        { id: 'point', addOrUpdateProperties: [{ key: 'score', value: 2 }], removeProperties: [] },
      ] });
    }
  });

  it('rejects non-record and accessor properties without evaluating getters or discarding safe sibling diagnostics', () => {
    let reads = 0;
    const accessorProperties = { get score() { reads += 1; return 1; } };
    const accessorFeature = { type: 'Feature', id: 'point', geometry: null, get properties() { reads += 1; return {}; } };
    for (const bad of [collection([]).features[0], collection(1).features[0],
      collection(accessorProperties).features[0], accessorFeature]) {
      const input = { type: 'FeatureCollection', features: [bad, { ...collection({ safe: true }).features[0], id: 'safe' }] };
      const projection = projectGeoJson(input);
      expect(projection.collection).to.equal(undefined);
      expect(projection.diagnostics.map(feature => ({ id: feature.id, properties: [...feature.properties] }))).to.deep.equal([
        { id: 'safe', properties: [['safe', true]] },
      ]);
      expect(buildGeoJsonPropertyDiff(collection({ score: 1 }), input)).to.equal(null);
    }
    expect(reads).to.equal(0);
  });

  it('ignores inherited properties while preserving own values and their removal diff', () => {
    const properties = Object.assign(Object.create({ inherited: 7 }) as Record<string, unknown>, { score: 1 });
    const before = collection(properties);
    expect(projectGeoJson(before).diagnostics.map(feature => [...feature.properties])).to.deep.equal([[['score', 1]]]);
    expect(buildGeoJsonPropertyDiff(before, collection(null))).to.deep.equal({ update: [
      { id: 'point', addOrUpdateProperties: [], removeProperties: ['score'] },
    ] });
  });

  it('falls back for accessor geometry and coordinates without reading them, retaining safe diagnostics', () => {
    let reads = 0;
    const coordinates = [1, 2];
    Object.defineProperty(coordinates, '0', { enumerable: true, get() { reads += 1; return 1; } });
    const geometries = [
      { type: 'Point', get coordinates() { reads += 1; return [1, 2]; } },
      { type: 'Point', coordinates },
      { type: 'Point', coordinates: [1, 2], extension: () => { reads += 1; } },
      Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, { type: 'Point', coordinates: [1, 2] }),
    ];
    for (const geometry of geometries) {
      const input = collection({ score: 1 }, geometry);
      const projection = projectGeoJson(input);
      expect(projection.collection).to.equal(undefined);
      expect(projection.diagnostics.map(feature => ({ id: feature.id, properties: [...feature.properties] }))).to.deep.equal([
        { id: 'point', properties: [['score', 1]] },
      ]);
      expect(buildGeoJsonPropertyDiff(input, collection({ score: 2 }))).to.equal(null);
    }
    expect(reads).to.equal(0);
    expect(buildGeoJsonPropertyDiff(collection({ score: 1 }), collection({ score: 2 }))?.update).to.have.length(1);
  });

  it('falls back when geometry dimensions, members or member order change even if properties alone could be diffed', () => {
    const before = collection({ score: 1 });
    for (const geometry of [
      { type: 'Point', coordinates: [1, 2, 3] },
      { type: 'Point', coordinates: [1, 2], extension: true },
      { coordinates: [1, 2], type: 'Point' },
    ]) {
      const after = collection({ score: 2 }, geometry);
      expect(projectGeoJson(after).collection !== undefined).to.equal(true);
      expect(buildGeoJsonPropertyDiff(before, after)).to.equal(null);
    }
    expect(buildGeoJsonPropertyDiff(before, collection({ score: 2 }))).to.deep.equal({ update: [
      { id: 'point', addOrUpdateProperties: [{ key: 'score', value: 2 }], removeProperties: [] },
    ] });
  });

  it('rejects excessively nested geometry and non-object admitted roots without affecting a later valid projection', () => {
    let nested: unknown = { type: 'Point', coordinates: [1, 2] };
    for (let depth = 0; depth < 102; depth += 1) nested = { type: 'GeometryCollection', geometries: [nested] };
    const input = collection({ score: 1 }, nested);
    expect(projectGeoJson(input).collection).to.equal(undefined);
    expect(buildGeoJsonPropertyDiff(input, collection({ score: 2 }))).to.equal(null);
    for (const value of [null, undefined, 4, 'geojson']) {
      expect(projectAdmittedGeoJson(value)).to.deep.equal({ diagnostics: [], collection: undefined });
    }
    const valid = projectAdmittedGeoJson(collection({ score: 2 }));
    expect(valid.collection !== undefined).to.equal(true);
    expect(valid.diagnostics.map(feature => [...feature.properties])).to.deep.equal([[['score', 2]]]);
  });
});
