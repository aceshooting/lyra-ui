import { expect } from '@open-wc/testing';
import { convexHull, hullPathD, hullCentroidX, hullTopY, type HullPoint } from './graph-hull.js';

function pointInOrOnPolygon(p: HullPoint, poly: HullPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  if (inside) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const len = Math.hypot(xj - xi, yj - yi) || 1;
    const t = Math.max(0, Math.min(1, ((p.x - xi) * (xj - xi) + (p.y - yi) * (yj - yi)) / (len * len)));
    const dist = Math.hypot(p.x - (xi + t * (xj - xi)), p.y - (yi + t * (yj - yi)));
    if (dist < 0.5) return true;
  }
  return false;
}

describe('convexHull', () => {
  it('returns a single point unchanged', () => {
    expect(convexHull([{ x: 5, y: 5 }])).to.deep.equal([{ x: 5, y: 5 }]);
  });

  it('returns two points unchanged (sorted)', () => {
    const hull = convexHull([
      { x: 10, y: 10 },
      { x: 0, y: 0 },
    ]);
    expect(hull).to.deep.equal([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it('drops an interior point from a square', () => {
    const withInterior = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
    ];
    const hull = convexHull(withInterior);
    expect(hull).to.have.length(4);
    expect(hull.some((p) => p.x === 5 && p.y === 5)).to.be.false;
  });

  it('every input point lies inside or on the returned hull', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 5 },
      { x: 15, y: 20 },
      { x: 3, y: 18 },
      { x: 8, y: 8 },
    ];
    const hull = convexHull(points);
    for (const p of points) expect(pointInOrOnPolygon(p, hull), `point (${p.x},${p.y})`).to.be.true;
  });
});

describe('hullPathD', () => {
  it('empty hull returns an empty string (nothing to draw)', () => {
    expect(hullPathD([])).to.equal('');
  });

  it('single point draws a zero-length line (SVG round-dot idiom under a round linecap stroke)', () => {
    expect(hullPathD([{ x: 3, y: 4 }])).to.equal('M 3 4 L 3 4');
  });

  it('two points draw an open segment (a round-cap stroke renders it as a capsule)', () => {
    expect(
      hullPathD([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).to.equal('M 0 0 L 10 0');
  });

  it('three or more points draw a closed polygon', () => {
    const d = hullPathD([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ]);
    expect(d).to.equal('M 0 0 L 10 0 L 5 10 Z');
  });
});

describe('hullCentroidX / hullTopY', () => {
  it('centroid x is the mean of hull point x values', () => {
    expect(
      hullCentroidX([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ]),
    ).to.equal(5);
  });

  it('top y is the minimum hull point y value', () => {
    expect(
      hullTopY([
        { x: 0, y: 5 },
        { x: 10, y: -3 },
        { x: 5, y: 20 },
      ]),
    ).to.equal(-3);
  });

  it('both return 0 for an empty hull', () => {
    expect(hullCentroidX([])).to.equal(0);
    expect(hullTopY([])).to.equal(0);
  });

  it('hullTopY does not throw a call-stack RangeError over a very large hull (regression: must not spread hull points into Math.min)', () => {
    const hull: HullPoint[] = Array.from({ length: 150_000 }, (_, i) => ({ x: i, y: i }));
    expect(hullTopY(hull)).to.equal(0);
  });
});
