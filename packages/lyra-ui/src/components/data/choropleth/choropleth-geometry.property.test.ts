import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { decodeChoroplethGeometry } from './choropleth-geometry.js';

const ring = [[0, 0], [2, 0], [0, 2], [0, 0]];
const triangle = { type: 'Polygon', coordinates: [ring] };
function topology(arcs: unknown, indices: unknown, transform?: unknown) {
  return { type: 'Topology', objects: { country: { type: 'GeometryCollection', geometries: [
    { type: 'Polygon', arcs: [indices], id: 0, properties: { name: 'Island', value: 0 } },
  ] } }, arcs, ...(transform ? { transform } : {}) };
}

describe('decodeChoroplethGeometry', () => {
  it('preserves holes, disconnected polygons, and host metadata', () => {
    const geometry = { type: 'MultiPolygon', coordinates: [[ring, ring], [ring]] };
    const result = decodeChoroplethGeometry({ type: 'Feature', id: 'A', geometry, properties: { title: 'Area', metric: -1 } }, 'metric', 'title');
    expect(result.regions).to.deep.equal([{ id: 'A', label: 'Area', value: -1, polygons: geometry.coordinates }]);
  });

  it('groups all polygonal members of a GeoJSON feature under its own ID and value', () => {
    const geometry = { type: 'GeometryCollection', geometries: [
      triangle, { type: 'MultiPolygon', coordinates: [[ring], [ring]] },
    ] };
    const result = decodeChoroplethGeometry({ type: 'Feature', geometry, id: 'coast', properties: { value: 7 } });
    expect(result.regions).to.deep.equal([{ id: 'coast', label: 'coast', value: 7, polygons: [[ring], [ring], [ring]] }]);
  });

  it('decodes absolute and delta arcs in either direction without duplicating a junction', () => {
    const first = [[0, 0], [2, 0]], second = [[0, 0], [0, 2], [2, 0]];
    const absolute = decodeChoroplethGeometry(topology([first, second], [0, -2]));
    expect(absolute.regions[0]).to.deep.equal({ id: '0', label: 'Island', value: 0, polygons: [[ring]] });
    const transformed = decodeChoroplethGeometry(topology([first, [[0, 0], [0, 2], [2, -2]]], [0, -2], { scale: [2, 3], translate: [1, 1] }));
    expect(transformed.regions[0]?.polygons).to.deep.equal([[[[1, 1], [5, 1], [1, 7], [1, 1]]]]);
  });

  it('fails closed on sparse arrays, malformed coordinates, dangling arcs and accessors', () => {
    let reads = 0;
    const bad = Object.defineProperty({}, 'type', { get() { reads++; return 'Polygon'; } });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const value of [bad, revoked.proxy, { type: 'Polygon', coordinates: [Array(4)] }, { type: 'Polygon', coordinates: [[[1, 0], ...ring]] }, topology([ring], [7])]) {
      expect(decodeChoroplethGeometry(value)).to.deep.equal({ status: 'invalid', regions: [] });
    }
    expect(reads).to.equal(0);
  });

  it('bounds large array declarations and repeated arc expansion', () => {
    expect(decodeChoroplethGeometry({ type: 'FeatureCollection', features: Array(1001) }).status).to.equal('limit');
    const longRing = [ring[0], ...Array.from({ length: 100 }, () => ring[1]), ring[2], ring[0]];
    expect(decodeChoroplethGeometry(topology([longRing], Array(600).fill(0))).status).to.equal('limit');
  });

  it('detaches values and coordinates, and reserves explicit IDs before assigning fallbacks', () => {
    const coordinates = [ring.map(point => [...point])];
    const feature = { type: 'Feature', properties: { value: 4 }, geometry: { type: 'Polygon', coordinates } };
    const features = [feature, { ...feature, id: 'region-1' }, { ...feature, id: 'region-1' }];
    const { regions } = decodeChoroplethGeometry({ type: 'FeatureCollection', features });
    feature.properties.value = 5;
    coordinates[0]![0]![0] = 4;
    expect(regions.map(region => region.id)).to.deep.equal(['region-2', 'region-1', 'region-3']);
    expect(regions[0]?.value).to.equal(4);
    expect(regions[0]?.polygons[0]?.[0]?.[0]).to.deep.equal([0, 0]);
  });

  it('rejects cyclic geometry and discards earlier valid features on failure', () => {
    const geometries: unknown[] = [];
    const collection = { type: 'GeometryCollection', geometries };
    geometries.push(triangle, collection);
    expect(decodeChoroplethGeometry(collection)).to.deep.equal({ status: 'limit', regions: [] });
    const broken = { type: 'GeometryCollection', geometries: [triangle, { type: 'Polygon', coordinates: [[[-181, 0]]] }] };
    expect(decodeChoroplethGeometry(broken)).to.deep.equal({ status: 'invalid', regions: [] });
  });

  it('preserves finite geographic vertices in closed rings', () => {
    fc.assert(fc.property(fc.integer({ min: -175, max: 175 }), fc.integer({ min: -85, max: 85 }), (x, y) => {
      const coordinates = [ring.map(([a, b]) => [x + a!, y + b!])];
      expect(decodeChoroplethGeometry({ ...triangle, coordinates }).regions[0]?.polygons).to.deep.equal([coordinates]);
    }), propertyRuns());
  });
});
