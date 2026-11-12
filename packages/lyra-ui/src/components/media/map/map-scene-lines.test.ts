import { expect } from '@open-wc/testing';
import { sceneArc, scenePath, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import type { AdmittedSceneObject } from './map-scene-admission.js';
import { buildSceneLineData, sceneArcAltitude, sceneLineDataFrom, sceneLineGrounded, SCENE_ARC_MIN_SEGMENTS,
  tessellateSceneLines, traceSceneLines } from './map-scene-lines.js';
import type { SceneLineObject } from './map-scene-lines.js';

function admit(...objects: unknown[]): readonly AdmittedSceneObject[] {
  const h = sceneSourceHarness();
  try {
    const candidate = stageMapSceneAdmission({ objects }, { request: h.request(), sources: h.sources });
    const admitted = candidate.objects; candidate.dispose(); return admitted;
  } finally { h.sources.dispose(); }
}
function lines(...objects: unknown[]): SceneLineObject[] {
  return admit(...objects).filter((row): row is SceneLineObject => row.kind === 'path' || row.kind === 'arc');
}
const radians = Math.PI / 180;
function unit([longitude, latitude]: readonly number[]): [number, number, number] {
  const lng = longitude! * radians, lat = latitude! * radians;
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
}
function angleDegrees(a: readonly number[], b: readonly number[]): number {
  const u = unit(a), v = unit(b);
  const cross = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  return Math.atan2(cross, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / radians;
}

describe('map scene line geometry', () => {
  it('keeps linear path vertices exactly and carries altitude as the third coordinate', () => {
    const [path] = lines({ ...scenePath(), interpolation: 'linear', positions: [
      { lngLat: [1, 2], altitude: 30 }, { lngLat: [3, 4] }, { lngLat: [5, 6], altitude: -5 }] });
    expect(tessellateSceneLines([path!])).to.deep.equal([[[1, 2, 30], [3, 4, 0], [5, 6, -5]]]);
  });

  it('subdivides great-circle segments into at most one-degree steps between exact endpoints', () => {
    const [path] = lines({ ...scenePath(), positions: [{ lngLat: [-74, 40.7], altitude: 0 }, { lngLat: [2.35, 48.85], altitude: 1000 }] });
    const [coordinates] = tessellateSceneLines([path!])!;
    const total = angleDegrees([-74, 40.7], [2.35, 48.85]);
    expect(coordinates!.length).to.equal(Math.ceil(total) + 1);
    expect(coordinates![0]).to.deep.equal([-74, 40.7, 0]);
    expect(coordinates!.at(-1)).to.deep.equal([2.35, 48.85, 1000]);
    // A great circle between these cities bends north of the straight parallel-space chord.
    const middle = coordinates![Math.floor(coordinates!.length / 2)]!;
    expect(middle[1]).to.be.greaterThan(50);
    for (let index = 1; index < coordinates!.length; index++) {
      expect(angleDegrees(coordinates![index - 1]!, coordinates![index]!)).to.be.at.most(1 + 1e-9);
      expect(coordinates![index]![2]).to.be.at.least(coordinates![index - 1]![2]);
    }
  });

  it('crosses the antimeridian along the shorter direction with continuous longitudes', () => {
    const [linear, great] = lines(
      { ...scenePath('linear'), interpolation: 'linear', positions: [{ lngLat: [170, 10] }, { lngLat: [-170, 10] }] },
      { ...scenePath('great'), positions: [{ lngLat: [170, 10] }, { lngLat: [-170, 10] }] });
    const [first, second] = tessellateSceneLines([linear!, great!])!;
    expect(first).to.deep.equal([[170, 10, 0], [190, 10, 0]]);
    expect(second![0]).to.deep.equal([170, 10, 0]);
    expect(second!.at(-1)).to.deep.equal([190, 10, 0]);
    for (const [longitude] of second!) expect(longitude).to.be.within(170, 190);
  });

  it('samples arcs on their great circle with the documented parabolic height profile', () => {
    const [arc] = lines({ ...sceneArc(), start: { lngLat: [0, 0], altitude: 100 }, end: { lngLat: [1, 0], altitude: 300 }, height: 1000 });
    const [coordinates] = tessellateSceneLines([arc!])!;
    expect(coordinates!.length).to.equal(SCENE_ARC_MIN_SEGMENTS + 1);
    expect(coordinates![0]).to.deep.equal([0, 0, 100]);
    expect(coordinates!.at(-1)).to.deep.equal([1, 0, 300]);
    const middle = coordinates![SCENE_ARC_MIN_SEGMENTS / 2]!;
    expect(middle[0]).to.be.closeTo(0.5, 1e-9); expect(middle[1]).to.be.closeTo(0, 1e-12);
    expect(middle[2]).to.be.closeTo(1200, 1e-9);
    expect(sceneArcAltitude(100, 300, 1000, 0.25)).to.be.closeTo(150 + 750, 1e-9);
    expect([0, 1].map(t => sceneArcAltitude(100, 300, 1000, t))).to.deep.equal([100, 300]);
  });

  for (const crossing of [false, true]) {
    it(`preserves an admitted near-coincident arc's height ${crossing ? 'across the antimeridian' : 'on a short ground track'}`, () => {
      const start = crossing ? 180 - 1e-12 : 20, end = crossing ? -180 + 1e-12 : 20 + 1e-12;
      const [arc] = lines({ ...sceneArc(), start: { lngLat: [start, 30], altitude: 100 },
        end: { lngLat: [end, 30], altitude: 300 }, height: 1000 });
      expect(arc?.kind).to.equal('arc');
      const [coordinates] = tessellateSceneLines([arc!])!;
      expect(coordinates!.length).to.equal(SCENE_ARC_MIN_SEGMENTS + 1);
      expect(coordinates![0]).to.deep.equal([start, 30, 100]);
      expect(coordinates!.at(-1)).to.deep.equal([crossing ? end + 360 : end, 30, 300]);
      const midpoint = coordinates![SCENE_ARC_MIN_SEGMENTS / 2]!;
      expect(midpoint[0]).to.be.closeTo((start + end + (crossing ? 360 : 0)) / 2, 1e-13);
      expect(midpoint[1]).to.equal(30);
      expect(midpoint[2]).to.equal(1200);
      expect(coordinates!.every(vertex => vertex.every(Number.isFinite))).to.equal(true);
      for (let index = 1; index < coordinates!.length; index++) {
        expect(Math.abs(coordinates![index]![0] - coordinates![index - 1]![0])).to.be.below(1e-12);
      }
    });
  }

  it('refuses incomplete retained geometry and colors before assembling a line source', () => {
    const objects = lines(scenePath('route'), sceneArc('link'));
    const geometry = traceSceneLines(objects)!;
    const colors = new Map([['route', 'red'], ['link', 'blue']]);
    expect(sceneLineDataFrom(objects, geometry.slice(0, 1), colors)).to.equal(undefined);
    expect(sceneLineDataFrom(objects, geometry, new Map([['route', 'red']]))).to.equal(undefined);
    const data = sceneLineDataFrom(objects, geometry, colors)!;
    expect(data.features.map(feature => feature.properties.id)).to.deep.equal(['route', 'link']);
    expect(data.features.map(feature => feature.properties.color)).to.deep.equal(['red', 'blue']);
    expect(data.features.map(feature => feature.geometry.coordinates)).to.deep.equal(geometry.map(row => row.coordinates));
  });

  it('reports only geometry a draped flat line reproduces as grounded', () => {
    const [flat, raised, terrainPath, sea, arcFlat, arcRaised] = lines(
      scenePath('flat'),
      { ...scenePath('raised'), positions: [{ lngLat: [0, 0] }, { lngLat: [1, 0], altitude: 10 }] },
      { ...scenePath('terrain'), positions: [{ lngLat: [0, 0], altitudeReference: 'terrain' }, { lngLat: [1, 0], altitudeReference: 'terrain' }] },
      { ...scenePath('sea'), positions: [{ lngLat: [0, 0], altitudeReference: 'sea-level' }, { lngLat: [1, 0] }] },
      { ...sceneArc('arc-flat'), height: 0 },
      sceneArc('arc-raised'));
    expect([flat, raised, terrainPath, sea, arcFlat, arcRaised].map(row => sceneLineGrounded(row!, false)))
      .to.deep.equal([true, false, true, true, true, false]);
    // Displayed terrain lifts a draped line, so only terrain-relative zero altitude stays exact.
    expect([flat, raised, terrainPath, sea, arcFlat, arcRaised].map(row => sceneLineGrounded(row!, true)))
      .to.deep.equal([false, false, true, false, false, false]);
  });

  it('coarsens shared great-circle density to fit the generated vertex budget', () => {
    const objects = lines(...Array.from({ length: 10 }, (_, index) => ({ ...scenePath(`p${index}`),
      positions: [{ lngLat: [-170, -60 + index] }, { lngLat: [20, 50 - index] }, { lngLat: [170, 0] }] })));
    const fine = tessellateSceneLines(objects)!;
    const fineCount = fine.reduce((total, row) => total + row.length, 0);
    const coarse = tessellateSceneLines(objects, 600)!;
    const coarseCount = coarse.reduce((total, row) => total + row.length, 0);
    expect(fineCount).to.be.greaterThan(600);
    expect(coarseCount).to.be.at.most(600);
    for (const [index, row] of coarse.entries()) {
      expect(row[0]!.slice(0, 2)).to.deep.equal(fine[index]![0]!.slice(0, 2));
      expect(row.at(-1)).to.deep.equal(fine[index]!.at(-1));
    }
    expect(tessellateSceneLines(objects, 29)).to.equal(undefined);
  });

  it('builds one owned feature per line with resolved presentation properties', () => {
    const objects = lines({ ...scenePath('route'), width: 4, opacity: 0.5 }, sceneArc('link'));
    const data = buildSceneLineData(objects, new Map([['route', 'rgba(1, 2, 3, 1)'], ['link', 'rgba(4, 5, 6, 0.5)']]))!;
    expect(data.type).to.equal('FeatureCollection');
    expect(data.features.map(feature => feature.properties)).to.deep.equal([
      { id: 'route', kind: 'path', color: 'rgba(1, 2, 3, 1)', width: 4, opacity: 0.5 },
      { id: 'link', kind: 'arc', color: 'rgba(4, 5, 6, 0.5)', width: 2, opacity: 1 },
    ]);
    expect(data.features.every(feature => feature.geometry.type === 'LineString')).to.equal(true);
    expect(Object.isFrozen(data) && Object.isFrozen(data.features) && data.features.every(Object.isFrozen)).to.equal(true);
    expect(buildSceneLineData(objects, new Map([['route', 'red']]))).to.equal(undefined);
  });
});
