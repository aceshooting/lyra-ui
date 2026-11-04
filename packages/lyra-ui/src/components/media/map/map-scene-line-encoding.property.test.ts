import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { canonicalLongitude, decodeTileVertex, encodeTileVertex, lineWorldShift, MERCATOR_LATITUDE_LIMIT,
  TILE_EXTENT } from './map-scene-line-encoding.js';
import { traceSceneLines, type SceneLineObject } from './map-scene-lines.js';

const longitude = fc.double({ min: -540, max: 540, noNaN: true });
const latitude = fc.double({ min: -85, max: 85, noNaN: true });
const altitude = fc.double({ min: -12_000, max: 1e7, noNaN: true });
const tile = fc.integer({ min: 0, max: 22 }).chain(z => fc.record({
  z: fc.constant(z), x: fc.integer({ min: 0, max: 2 ** z - 1 }), y: fc.integer({ min: 0, max: 2 ** z - 1 }) }));
/** Mercator oracle written independently: the y formula uses the log-tan form. */
const mercatorY = (lat: number): number => (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2;

describe('map scene line encoding properties', () => {
  it('round-trips longitude, latitude and altitude through tile-local coordinates', () => {
    fc.assert(fc.property(longitude, latitude, altitude, tile, (lng, lat, alt, origin) => {
      const [x, y, z] = encodeTileVertex(lng, lat, alt, origin);
      const [backLng, backLat, backAlt] = decodeTileVertex(x, y, z, origin);
      expect(Math.abs(backLng - lng)).to.be.below(1e-7);
      expect(Math.abs(backLat - lat)).to.be.below(1e-7);
      expect(backAlt).to.equal(alt);
    }), propertyRuns());
  });

  it('matches an independent Web Mercator formulation for every tile origin', () => {
    fc.assert(fc.property(longitude, latitude, tile, (lng, lat, origin) => {
      const size = 2 ** origin.z, [x, y] = encodeTileVertex(lng, lat, 0, origin);
      const expectedX = ((lng + 180) / 360 * size - origin.x) * TILE_EXTENT;
      const expectedY = (mercatorY(lat) * size - origin.y) * TILE_EXTENT;
      expect(Math.abs(x - expectedX)).to.be.below(1e-6 * Math.max(1, Math.abs(expectedX)));
      expect(Math.abs(y - expectedY)).to.be.below(1e-6 * Math.max(1, Math.abs(expectedY)));
    }), propertyRuns());
  });

  it('keeps an unwrapped longitude continuous: a 360 degree shift moves exactly one world width', () => {
    fc.assert(fc.property(longitude, latitude, tile, (lng, lat, origin) => {
      const [x] = encodeTileVertex(lng, lat, 0, origin), [shifted] = encodeTileVertex(lng + 360, lat, 0, origin);
      const world = 2 ** origin.z * TILE_EXTENT;
      expect(Math.abs(shifted - x - world)).to.be.below(1e-6 * world);
    }), propertyRuns());
  });

  it('shifts a line by whole worlds so its first vertex is canonical', () => {
    fc.assert(fc.property(longitude, lng => {
      const shift = lineWorldShift(lng), canonical = lng + shift;
      expect(Number.isInteger(Math.round(shift / 360))).to.equal(true);
      expect(Math.abs(shift / 360 - Math.round(shift / 360))).to.be.below(1e-9);
      expect(canonical >= -180 - 1e-9 && canonical < 180 + 1e-9).to.equal(true);
      expect(Math.abs(canonicalLongitude(lng) - canonical)).to.be.below(1e-9);
    }), propertyRuns());
  });

  it('interpolates terrain weights between segment endpoints and keeps them inside [0, 1]', () => {
    const reference = fc.constantFrom('sea-level' as const, 'terrain' as const);
    const position = fc.tuple(fc.integer({ min: -179, max: 179 }), fc.integer({ min: -80, max: 80 }), reference)
      .map(([lng, lat, altitudeReference]) => Object.freeze({ lngLat: [lng, lat] as const, altitude: 100, altitudeReference }));
    fc.assert(fc.property(fc.array(position, { minLength: 2, maxLength: 6 }), positions => {
      const object: SceneLineObject = Object.freeze({ kind: 'path', id: 'p', label: 'p', opacity: 1, interactive: true,
        showLabel: false, positions: Object.freeze(positions), interpolation: 'linear', width: 2 });
      const [geometry] = traceSceneLines([object])!;
      expect(geometry!.terrain.length).to.equal(geometry!.coordinates.length);
      expect(geometry!.terrain.every(weight => weight >= 0 && weight <= 1)).to.equal(true);
      expect(geometry!.terrain[0]).to.equal(positions[0]!.altitudeReference === 'terrain' ? 1 : 0);
      expect(geometry!.terrain.at(-1)).to.equal(positions.at(-1)!.altitudeReference === 'terrain' ? 1 : 0);
    }), propertyRuns());
  });

  it('clamps polar latitude to the Mercator limit', () => {
    fc.assert(fc.property(fc.double({ min: MERCATOR_LATITUDE_LIMIT, max: 90, noNaN: true }), lat => {
      const origin = { z: 0, x: 0, y: 0 };
      expect(encodeTileVertex(0, lat, 0, origin)[1]).to.equal(encodeTileVertex(0, MERCATOR_LATITUDE_LIMIT, 0, origin)[1]);
      expect(encodeTileVertex(0, -lat, 0, origin)[1]).to.equal(encodeTileVertex(0, -MERCATOR_LATITUDE_LIMIT, 0, origin)[1]);
    }), propertyRuns());
  });
});
