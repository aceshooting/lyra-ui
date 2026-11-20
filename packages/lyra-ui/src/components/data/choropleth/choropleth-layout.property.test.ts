import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import type { ChoroplethPolygon, ChoroplethRegion } from './choropleth-geometry.js';
import { layoutChoropleth } from './choropleth-layout.js';

const box = (x: number, y: number, w: number, h: number): ChoroplethPolygon => [
  [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]],
];
const region = (id: string, polygons: readonly ChoroplethPolygon[], value: number | null = null): ChoroplethRegion =>
  ({ id, label: id, value, polygons });

describe('choropleth layout', () => {
  it('fits rectangles into the viewport preserving their projected aspect ratio', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 75 }), fc.integer({ min: 1, max: 70 }), (w, h) => {
      const [mark] = layoutChoropleth([region('r', [box(0, 0, w, h)])], 200, 100).regions;
      const points = mark!.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
      const xs = points.filter((_, i) => i % 2 === 0);
      const ys = points.filter((_, i) => i % 2 === 1);
      expect(Math.min(...xs)).to.be.at.least(-1e-8);
      expect(Math.max(...xs)).to.be.at.most(200 + 1e-8);
      expect(Math.min(...ys)).to.be.at.least(-1e-8);
      expect(Math.max(...ys)).to.be.at.most(100 + 1e-8);
      expect((Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys))).to.be.closeTo(w / h, 1e-8);
    }), propertyRuns());
  });

  it('retains multipart geometry and places the label inside the largest polygon outside its hole', () => {
    const donut = [...box(0, 0, 10, 10), ...box(2, 2, 6, 6)];
    const result = layoutChoropleth([region('donut', [box(11, 0, 1, 1), donut])], 120, 100);
    const mark = result.regions[0]!;
    expect(mark.path.match(/Z/g)?.length).to.equal(3);
    expect(mark.labelX).to.be.greaterThan(0).and.lessThan(100);
    expect(mark.labelY).to.be.greaterThan(0).and.lessThan(100);
    expect(mark.labelX! > 20 && mark.labelX! < 80 && mark.labelY! > 20 && mark.labelY! < 80).to.equal(false);
  });

  it('keeps short dateline-crossing edges local and clamps Mercator poles', () => {
    const crossing: ChoroplethPolygon = [[[179, 0], [-179, 0], [-179, 20], [179, 20], [179, 0]]];
    const mark = layoutChoropleth([region('a', [crossing])], 100, 100).regions[0]!;
    const xs = mark.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number).filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).to.be.closeTo(10, 1e-8);
    const polar = layoutChoropleth([region('pole', [box(0, -90, 90, 180)])], 120, 100, 'mercator');
    expect(polar.regions[0]!.path).not.to.match(/NaN|Infinity/);
  });

  it('derives stable color positions, legend stops and missing-value states', () => {
    const regions = [-Number.MAX_VALUE, 0, Number.MAX_VALUE, null].map((v, i) => region(String(i), [box(i, 0, 1, 1)], v));
    const result = layoutChoropleth(regions, 200, 100, 'equirectangular', 'diverging');
    expect(result.regions.map(r => r.position)).to.deep.equal([0, 0.5, 1, null]);
    expect(result.stops.map(s => s.value)).to.deep.equal([-Number.MAX_VALUE, 0, Number.MAX_VALUE]);
    expect(layoutChoropleth([regions[0]!]).regions[0]!.position).to.equal(0.5);
    expect(layoutChoropleth([regions[3]!]).domain).to.equal(null);
    expect(layoutChoropleth(regions, Infinity, 1).regions.length).to.equal(0);
  });

  it('preserves a full longitude turn and includes only nondegenerate polygons', () => {
    const short: ChoroplethPolygon = [[[1, 1], [2, 2]]];
    const bad: ChoroplethPolygon = [[[0, 0], [1, NaN], [1, 0]]];
    const outside: ChoroplethPolygon = [[[0, 0], [190, 1], [1, 0]]];
    const line: ChoroplethPolygon = [[[0, 0], [1, 1], [2, 2]]];
    const invalid = [short, bad, outside, line, []];
    const world = region('world', [...invalid, box(-180, -90, 360, 180)], 0);
    const result = layoutChoropleth([region('invalid', invalid, 20), world], 360, 180);
    expect(result.regions.map(r => r.id)).to.deep.equal(['world']);
    const mark = result.regions[0]!;
    expect(mark.path).to.equal('M0,180L360,180L360,0L0,0L0,180Z');
    expect([mark.labelX, mark.labelY]).to.deep.equal([180, 90]);
    expect(layoutChoropleth([region('invalid', invalid)]).regions).to.deep.equal([]);
  });

  it('aligns separate dateline parts and a hole starting on the opposite side', () => {
    const exterior: ChoroplethPolygon = [[[176, 0], [-176, 0], [-176, 8], [176, 8], [176, 0]]];
    const hole: ChoroplethPolygon = [[[-178, 2], [178, 2], [178, 6], [-178, 6], [-178, 2]]];
    const feature = region('islands', [[...exterior, ...hole], box(-175, 0, 1, 1)]);
    const mark = layoutChoropleth([feature], 100, 80).regions[0]!;
    const rings = mark.path.split('Z').filter(Boolean).map(path =>
      path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number).filter((_, i) => i % 2 === 0));
    expect(rings.map(xs => [Math.min(...xs), Math.max(...xs)])).to.deep.equal([[0, 80], [20, 60], [90, 100]]);
    expect(mark.labelX! > 20 && mark.labelX! < 60 && mark.labelY! > 20 && mark.labelY! < 60).to.equal(false);
  });

  it('maps a constant zero to the midpoint in both palettes and preserves a tiny polygon', () => {
    const tiny = region('tiny', [box(125, -40, 1e-9, 1e-9)], 0);
    for (const palette of ['sequential', 'diverging'] as const) {
      const result = layoutChoropleth([tiny], 100, 100, 'equirectangular', palette);
      expect(result.domain).to.deep.equal([0, 0]);
      expect(result.stops).to.deep.equal([{ offset: 0.5, value: 0 }]);
      const mark = result.regions[0]!;
      expect(mark.position).to.equal(0.5);
      expect(mark.labelX).to.be.closeTo(50, 0.002);
      expect(mark.labelY).to.be.closeTo(50, 0.002);
      expect(mark.path).not.to.match(/NaN|Infinity/);
    }
  });
});
