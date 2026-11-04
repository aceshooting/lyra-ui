import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { sceneArcAltitude, tessellateSceneLines } from './map-scene-lines.js';
import type { SceneLineObject } from './map-scene-lines.js';

const radians = Math.PI / 180;
type Point = readonly [number, number];
function unit([longitude, latitude]: Point): [number, number, number] {
  const lng = longitude * radians, lat = latitude * radians;
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
}
function cross(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
}
const position = (lngLat: Point, altitude = 0) => Object.freeze({ lngLat, altitude, altitudeReference: 'sea-level' as const });
const point = fc.tuple(fc.integer({ min: -179_000, max: 179_000 }), fc.integer({ min: -80_000, max: 80_000 }))
  .map(([lng, lat]) => [lng / 1000, lat / 1000] as const);
/** Endpoints well apart from each other and from each other's antipode, as admission requires. */
const pair = fc.tuple(point, point).filter(([a, b]) => {
  const u = unit(a), v = unit(b), dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return dot < 0.9999 && dot > -0.9999;
});
function path(points: readonly Point[], interpolation: 'linear' | 'great-circle'): SceneLineObject {
  return Object.freeze({ kind: 'path', id: 'p', label: 'p', opacity: 1, interactive: true, showLabel: false,
    positions: Object.freeze(points.map(value => position(value))), interpolation, width: 2 });
}

describe('map scene line geometry properties', () => {
  it('keeps great-circle vertices finite, continuous and on the plane of their endpoints', () => {
    fc.assert(fc.property(pair, ([a, b]) => {
      const [coordinates] = tessellateSceneLines([path([a, b], 'great-circle')])!;
      const normal = cross(unit(a), unit(b)), length = Math.hypot(...normal);
      expect(coordinates!.length).to.be.at.least(2);
      expect(coordinates![0]!.slice(0, 2)).to.deep.equal([a[0] === 0 ? 0 : a[0], a[1] === 0 ? 0 : a[1]]);
      const last = coordinates!.at(-1)!;
      const turns = (last[0] - b[0]) / 360;
      expect(Math.abs(turns - Math.round(turns))).to.be.below(1e-12);
      expect(last[1]).to.equal(b[1] === 0 ? 0 : b[1]);
      for (let index = 0; index < coordinates!.length; index++) {
        const vertex = coordinates![index]!;
        expect(vertex.every(Number.isFinite)).to.equal(true);
        const v = unit([vertex[0], vertex[1]]);
        expect(Math.abs(v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2]) / length).to.be.below(1e-9);
        if (index > 0) expect(Math.abs(vertex[0] - coordinates![index - 1]![0])).to.be.at.most(180);
      }
    }), propertyRuns());
  });

  it('never generates more vertices than the shared limit allows', () => {
    fc.assert(fc.property(fc.array(pair, { minLength: 1, maxLength: 20 }), fc.integer({ min: 0, max: 2000 }), (pairs, extra) => {
      const objects = pairs.map(([a, b], index) => ({ ...path([a, b], index % 3 ? 'great-circle' : 'linear'), id: `p${index}` }));
      const floor = objects.length * 2, limit = floor + extra;
      const generated = tessellateSceneLines(objects, limit);
      expect(generated !== undefined).to.equal(true);
      expect(generated!.reduce((total, row) => total + row.length, 0)).to.be.at.most(limit);
      expect(tessellateSceneLines(objects, floor - 1)).to.equal(undefined);
    }), propertyRuns());
  });

  it('places a nonnegative arc height above the chord between its endpoint altitudes', () => {
    fc.assert(fc.property(fc.integer({ min: -12000, max: 100000 }), fc.integer({ min: -12000, max: 100000 }),
      fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 1000 }), (start, end, height, step) => {
        const t = step / 1000, chord = start + (end - start) * t, value = sceneArcAltitude(start, end, height, t);
        expect(value).to.be.at.least(chord - 1e-6 * Math.max(1, Math.abs(chord)));
        expect(value - chord).to.be.at.most(height + 1e-6 * Math.max(1, height));
        expect(sceneArcAltitude(start, end, height, 0.5)).to.be.closeTo((start + end) / 2 + height, 1e-6);
      }), propertyRuns());
  });
});
