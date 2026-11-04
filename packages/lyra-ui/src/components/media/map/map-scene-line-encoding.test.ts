import { expect } from '@open-wc/testing';
import { elevatedLineVertices, type ElevatedSceneLine } from './map-scene-elevated-lines.js';
import { canonicalLongitude, encodeTileVertex, lineWorldShift, TILE_EXTENT } from './map-scene-line-encoding.js';

const line = (coordinates: ElevatedSceneLine['coordinates'], terrain = coordinates.map(() => 0)): ElevatedSceneLine =>
  ({ id: 'l', coordinates, terrain, rgba: [0.1, 0.2, 0.3, 0.5], width: 4 });

describe('map scene line encoding', () => {
  it('canonicalizes longitudes into [-180, 180)', () => {
    expect([180, -180, 181, -181, 540, 0, -0, 359.5].map(canonicalLongitude)).to.deep.equal([-180, -180, -179, 179, -180, 0, 0, -0.5]);
  });

  it('encodes the tile origin corner, center and sea-level altitude exactly', () => {
    expect(encodeTileVertex(-180, 85.0511287798066, 12, { z: 0, x: 0, y: 0 }).map(value => Math.round(value) + 0)).to.deep.equal([0, 0, 12]);
    expect(encodeTileVertex(0, 0, 0, { z: 1, x: 1, y: 1 })).to.deep.equal([0, 0, 0]);
    expect(encodeTileVertex(90, 0, 0, { z: 2, x: 2, y: 2 })).to.deep.equal([TILE_EXTENT, 0, 0]);
  });

  it('keeps an antimeridian crossing continuous in the first vertex world copy', () => {
    const coordinates = [[179, 10, 0], [181, 10, 0]] as const;
    expect(lineWorldShift(179)).to.equal(0);
    expect(lineWorldShift(-181)).to.equal(360);
    const origin = { z: 3, x: 7, y: 3 };
    const [a, b] = coordinates.map(([lng, lat, alt]) => encodeTileVertex(lng, lat, alt, origin));
    // Two degrees of longitude at z3 is 2/360 of eight tiles; the canonical -179 would jump a whole world.
    expect(b![0] - a![0]).to.be.closeTo(2 / 360 * 8 * TILE_EXTENT, 1e-6);
  });

  it('extrudes one six-vertex quad per segment with both endpoints, side and direction', () => {
    const data = elevatedLineVertices(line([[0, 0, 100], [1, 0, 200], [2, 0, 50]]), { z: 0, x: 0, y: 0 }, [0, 0, 0]);
    expect(data.length).to.equal(2 * 6 * 13);
    const vertex = (index: number) => Array.from(data.subarray(index * 13, index * 13 + 13));
    const [first, , third] = [vertex(0), vertex(1), vertex(2)];
    expect(first.slice(6, 8)).to.deep.equal([-1, 1]);
    expect(third.slice(6, 8)).to.deep.equal([-1, -1]);
    expect(first[2]).to.equal(100); expect(first[5]).to.equal(200); expect(third[2]).to.equal(200);
    expect(first.slice(8, 13).map(value => Math.round(value * 10) / 10)).to.deep.equal([0.1, 0.2, 0.3, 0.5, 4]);
  });

  it('adds weighted terrain height to each vertex altitude', () => {
    const data = elevatedLineVertices(line([[0, 0, 100], [1, 0, 100]], [1, 0.5]), { z: 0, x: 0, y: 0 }, [40, 80]);
    expect(data[2]).to.equal(140);
    expect(data[5]).to.equal(140);
    expect(data[13 * 2 + 2]).to.equal(140);
  });

  it('builds no triangles for a single vertex', () => {
    expect(elevatedLineVertices(line([[0, 0, 0]]), { z: 0, x: 0, y: 0 }, [0]).length).to.equal(0);
  });
});
