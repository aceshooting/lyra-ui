import { expect } from '@open-wc/testing';
import { MapDrawing, measureDrawing, type LyraMapDrawingPoint } from './map-drawing.js';

const RADIUS = 6_371_008.8;
function draw(mode: 'line' | 'polygon', vertices: readonly LyraMapDrawingPoint[]) {
  const drawing = new MapDrawing(mode);
  for (const vertex of vertices) expect(drawing.add(vertex).accepted).to.equal(true);
  return drawing;
}

describe('MapDrawing', () => {
  it('measures an equatorial quarter-circle line and its arc centroid', () => {
    const result = draw('line', [[0, 0], [90, 0]]).complete();
    expect(result.accepted).to.equal(true);
    expect(result.state.metrics!.length).to.be.closeTo(Math.PI * RADIUS / 2, 0.001);
    expect(result.state.metrics!.area).to.equal(0);
    expect(result.state.metrics!.centroid![0]).to.be.closeTo(45, 1e-9);
    expect(result.state.metrics!.centroid![1]).to.be.closeTo(0, 1e-9);
    expect(result.state.geometry).to.deep.equal({ type: 'LineString', coordinates: [[0, 0], [90, 0]] });
  });

  it('measures an octant polygon and preserves metrics under reversed winding', () => {
    const vertices: LyraMapDrawingPoint[] = [[0, 0], [90, 0], [0, 90]];
    const first = draw('polygon', vertices).complete();
    const reversed = draw('polygon', [...vertices].reverse()).complete();
    expect(first.accepted && reversed.accepted).to.equal(true);
    for (const result of [first, reversed]) {
      expect(result.state.metrics!.length).to.be.closeTo(3 * Math.PI * RADIUS / 2, 0.001);
      expect(result.state.metrics!.area).to.be.closeTo(Math.PI * RADIUS * RADIUS / 2, 0.1);
      expect(result.state.metrics!.centroid![0]).to.be.closeTo(45, 1e-8);
      expect(result.state.metrics!.centroid![1]).to.be.closeTo(Math.atan(1 / Math.sqrt(2)) * 180 / Math.PI, 1e-8);
    }
    expect(first.state.geometry).to.deep.equal({ type: 'Polygon', coordinates: [[[0, 0], [90, 0], [0, 90], [0, 0]]] });
  });

  it('takes the short dateline path and computes a dateline polygon centroid', () => {
    const line = draw('line', [[179, 0], [-179, 0]]).complete().state.metrics!;
    expect(line.length).to.be.closeTo(2 * Math.PI * RADIUS / 180, 0.001);
    expect(Math.abs(line.centroid![0])).to.be.closeTo(180, 1e-8);
    const polygon = draw('polygon', [[179, -1], [-179, -1], [-179, 1], [179, 1]]).complete();
    expect(polygon.accepted).to.equal(true);
    expect(Math.abs(polygon.state.metrics!.centroid![0])).to.be.closeTo(180, 1e-7);
    expect(polygon.state.metrics!.centroid![1]).to.be.closeTo(0, 1e-7);
    expect(polygon.state.metrics!.area).to.be.within(49e9, 50e9);
  });

  it('handles a cap around the pole with a canonical polar centroid', () => {
    const result = draw('polygon', [[0, 80], [120, 80], [-120, 80]]).complete();
    expect(result.accepted).to.equal(true);
    expect(result.state.metrics!.centroid![0]).to.equal(0);
    expect(result.state.metrics!.centroid![1]).to.be.closeTo(90, 1e-7);
    expect(result.state.metrics!.area).to.be.within(1e12, 2e12);
  });

  it('reports no invented centroid for a symmetric full-circle line', () => {
    const result = draw('line', [[0, 0], [90, 0], [180, 0], [-90, 0], [0, 0]]).complete();
    expect(result.accepted).to.equal(true);
    expect(result.state.metrics!.centroid).to.equal(null);
    expect(result.state.metrics!.length).to.be.closeTo(2 * Math.PI * RADIUS, 0.001);
  });

  it('keeps incomplete drawings editable and supports undo before completion', () => {
    const drawing = new MapDrawing('polygon');
    expect(drawing.complete().error).to.equal('too-few-vertices');
    expect(drawing.undo().error).to.equal('empty');
    drawing.add([0, 0]);
    drawing.add([1, 0]);
    expect(drawing.complete().state.phase).to.equal('drawing');
    expect(drawing.undo().state.vertices).to.deep.equal([[0, 0]]);
    drawing.add([1, 0]);
    drawing.add([0, 1]);
    expect(drawing.complete().accepted).to.equal(true);
    expect(drawing.add([2, 2]).error).to.equal('inactive');
    expect(drawing.undo().error).to.equal('inactive');
    expect(drawing.complete().error).to.equal('inactive');
  });

  it('clears and freezes cancelled sessions without affecting earlier snapshots', () => {
    const drawing = new MapDrawing('line');
    const input = [1, 2];
    const previous = drawing.add(input).state;
    input[0] = 99;
    expect(previous.vertices).to.deep.equal([[1, 2]]);
    expect(drawing.cancel().state).to.deep.equal({ mode: 'line', phase: 'cancelled', vertices: [] });
    expect(drawing.cancel().accepted).to.equal(true);
    expect(drawing.add([2, 3]).error).to.equal('inactive');
    expect(Object.isFrozen(previous) && Object.isFrozen(previous.vertices) && Object.isFrozen(previous.vertices[0])).to.equal(true);
  });

  it('rejects invalid coordinates, getters, duplicate points and antipodal edges without mutation', () => {
    const drawing = new MapDrawing('line');
    for (const value of [null, [NaN, 0], [Infinity, 0], [181, 0], [0, -91], ['1', 2], [0]]) {
      expect(drawing.add(value).error).to.equal('invalid-coordinate');
    }
    let reads = 0;
    const accessor = [0, 0];
    Object.defineProperty(accessor, '0', { get: () => { reads += 1; return 0; } });
    expect(drawing.add(accessor).error).to.equal('invalid-coordinate');
    expect(reads).to.equal(0);
    drawing.add([180, 0]);
    expect(drawing.add([-180, 0]).error).to.equal('duplicate-vertex');
    expect(drawing.add([0, 0]).error).to.equal('antipodal-edge');
    expect(drawing.snapshot().vertices).to.deep.equal([[-180, 0]]);
  });

  it('normalizes longitude at a pole and disallows repeated polygon vertices', () => {
    const drawing = new MapDrawing('polygon');
    drawing.add([123, 90]);
    expect(drawing.add([-45, 90]).error).to.equal('duplicate-vertex');
    drawing.add([0, 0]);
    drawing.add([1, 0]);
    expect(drawing.add([123, 90]).error).to.equal('duplicate-vertex');
    expect(drawing.snapshot().vertices[0]).to.deep.equal([0, 90]);
  });

  for (const vertices of [
    [[0, 0], [2, 2], [0, 2], [2, 0]],
    [[0, 0], [3, 0], [2, 0], [2, 2], [0, 2]],
  ] satisfies LyraMapDrawingPoint[][]) {
    it('rejects crossing or retraced polygon arcs at completion and allows repair', () => {
      const drawing = draw('polygon', vertices);
      expect(drawing.complete().error).to.equal('self-intersection');
      expect(drawing.snapshot().phase).to.equal('drawing');
      expect(drawing.undo().accepted).to.equal(true);
    });
  }

  it('rejects collinear/very small polygons and an antipodal closing edge', () => {
    expect(draw('polygon', [[0, 0], [1, 0], [2, 0]]).complete().accepted).to.equal(false);
    expect(draw('polygon', [[0, 0], [0.000001, 0], [0, 0.000001]]).complete().error).to.equal('degenerate');
    expect(draw('polygon', [[0, 0], [90, 30], [180, 0]]).complete().error).to.equal('antipodal-edge');
  });

  it('rejects the ambiguous hemisphere rather than choosing an arbitrary interior', () => {
    const result = draw('polygon', [[0, 0], [90, 0], [180, 0], [-90, 0]]).complete();
    expect(result.error).to.equal('ambiguous-region');
    expect(result.state.phase).to.equal('drawing');
  });

  it('enforces the vertex cap and releases room with undo', () => {
    const drawing = new MapDrawing('line');
    for (let index = 0; index < 512; index += 1) expect(drawing.add([index / 10, 0]).accepted).to.equal(true);
    expect(drawing.add([60, 0]).error).to.equal('vertex-limit');
    expect(drawing.snapshot().vertices.length).to.equal(512);
    drawing.undo();
    expect(drawing.add([60, 0]).accepted).to.equal(true);
  });
  it('replaces an incomplete vertex with detached normalized coordinates without completing', () => {
    const drawing = draw('line', [[0, 0], [20, 0], [30, 0]]), old = drawing.snapshot();
    const input = [10, 0], result = drawing.replace(1, input); input[0] = 99;
    expect(result.accepted).to.equal(true); expect(result.state.phase).to.equal('drawing');
    expect(result.state.vertices).to.deep.equal([[0, 0], [10, 0], [30, 0]]);
    expect(result.state.metrics).to.equal(undefined); expect(result.state.geometry).to.equal(undefined);
    expect(old.vertices[1]).to.deep.equal([20, 0]);
    expect(Object.isFrozen(result.state.vertices) && Object.isFrozen(result.state.vertices[1])).to.equal(true);
  });
  it('remeasures a completed line and preserves earlier completed output', () => {
    const drawing = draw('line', [[0, 0], [90, 0]]), old = drawing.complete().state;
    const result = drawing.replace(1, [45, 0]);
    expect(result.accepted).to.equal(true); expect(result.state.phase).to.equal('completed');
    expect(result.state.metrics!.length).to.be.closeTo(Math.PI * RADIUS / 4, 0.001);
    expect(result.state.metrics!.centroid![0]).to.be.closeTo(22.5, 1e-8);
    expect(result.state.geometry).to.deep.equal({ type: 'LineString', coordinates: [[0, 0], [45, 0]] });
    expect(old.geometry).to.deep.equal({ type: 'LineString', coordinates: [[0, 0], [90, 0]] });
    expect(Object.isFrozen(result.state.geometry) && Object.isFrozen(result.state.metrics)).to.equal(true);
  });
  it('rebuilds completed polygon closure and metrics exactly as fresh completion', () => {
    const drawing = draw('polygon', [[0, 0], [20, 0], [0, 20]]); drawing.complete();
    const result = drawing.replace(0, [-5, 0]);
    const fresh = draw('polygon', [[-5, 0], [20, 0], [0, 20]]).complete();
    expect(result.accepted).to.equal(true); expect(result.state).to.deep.equal(fresh.state);
    expect(result.state.geometry).to.deep.equal({ type: 'Polygon', coordinates: [[[-5, 0], [20, 0], [0, 20], [-5, 0]]] });
    const geometry = result.state.geometry!;
    expect(geometry.type).to.equal('Polygon');
    if (geometry.type === 'Polygon') expect(Object.isFrozen(geometry.coordinates) && Object.isFrozen(geometry.coordinates[0])).to.equal(true);
  });
  it('rejects duplicates and antipodes against either line neighbour without changing snapshot', () => {
    const drawing = draw('line', [[0, 0], [10, 10], [90, 0]]), old = drawing.snapshot();
    for (const point of [[0, 0], [90, 0]]) { expect(drawing.replace(1, point).error).to.equal('duplicate-vertex'); expect(drawing.snapshot()).to.equal(old); }
    for (const point of [[180, 0], [-90, 0]]) { expect(drawing.replace(1, point).error).to.equal('antipodal-edge'); expect(drawing.snapshot()).to.equal(old); }
  });
  it('checks all polygon duplicates and the implicit closing neighbour', () => {
    const drawing = draw('polygon', [[0, 0], [10, 0], [10, 10], [0, 10]]), old = drawing.complete().state;
    expect(drawing.replace(0, [10, 10]).error).to.equal('duplicate-vertex'); expect(drawing.snapshot()).to.equal(old);
    expect(drawing.replace(0, [180, -10]).error).to.equal('antipodal-edge'); expect(drawing.snapshot()).to.equal(old);
  });
  it('rejects completed self-intersection and sub-square-metre edits atomically', () => {
    const drawing = draw('polygon', [[0, 0], [2, 0], [2, 2], [0, 2]]), old = drawing.complete().state;
    expect(drawing.replace(1, [1, 3]).error).to.equal('self-intersection'); expect(drawing.snapshot()).to.equal(old);
    const small = draw('polygon', [[0, 0], [0.000001, 0], [0, 1]]), completed = small.complete().state;
    expect(completed.phase).to.equal('completed'); expect(small.replace(2, [0, 0.000001]).error).to.equal('degenerate'); expect(small.snapshot()).to.equal(completed);
  });
  it('rejects invalid indexes before inspecting hostile point input', () => {
    const drawing = draw('line', [[0, 0], [1, 0]]), old = drawing.snapshot(); let reads = 0;
    const point = new Proxy([2, 0], { getOwnPropertyDescriptor() { reads++; throw new Error('Coordinate sentinel'); } });
    for (const index of [-1, 2, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER]) expect(drawing.replace(index, point).error).to.equal('invalid-index');
    expect(reads).to.equal(0); expect(drawing.snapshot()).to.equal(old);
  });
  it('rejects getters and hostile coordinate traps without invoking getters or changing output', () => {
    const drawing = draw('line', [[0, 0], [1, 0]]), old = drawing.complete().state; let reads = 0;
    const point = Object.defineProperty([2, 0], '0', { get() { reads++; return 2; } });
    for (const value of [point, [Infinity, 0], [181, 0], null, new Proxy([2, 0], { getOwnPropertyDescriptor() { throw new Error('Coordinate sentinel'); } })]) {
      expect(drawing.replace(1, value).error).to.equal('invalid-coordinate'); expect(drawing.snapshot()).to.equal(old);
    }
    expect(reads).to.equal(0);
  });
  it('does not overwrite a newer session edit during coordinate reflection reentry', () => {
    const drawing = draw('line', [[0, 0], [1, 0]]); let newer = drawing.snapshot();
    const point = new Proxy([2, 0], { getOwnPropertyDescriptor(target, key) {
      if (key === '0') newer = drawing.cancel().state;
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    expect(drawing.replace(1, point).error).to.equal('inactive'); expect(drawing.snapshot()).to.equal(newer);
    expect(newer.phase).to.equal('cancelled');
  });
  it('rejects cancelled edits and permits replacement at the unchanged vertex cap', () => {
    const cancelled = draw('line', [[0, 0], [1, 0]]); const old = cancelled.cancel().state;
    expect(cancelled.replace(0, [2, 0]).error).to.equal('inactive'); expect(cancelled.snapshot()).to.equal(old);
    const drawing = new MapDrawing('line');
    for (let index = 0; index < 512; index++) drawing.add([index / 10, 0]);
    expect(drawing.replace(511, [60, 0]).accepted).to.equal(true);
    expect(drawing.snapshot().vertices.length).to.equal(512); expect(drawing.add([61, 0]).error).to.equal('vertex-limit');
  });

});

type Vector = readonly [number, number, number];

/** Steradians of the smaller region a simple spherical polygon bounds, from its interior angles (Girard's theorem). */
function smallerRegion(vertices: readonly LyraMapDrawingPoint[]): number {
  const radians = Math.PI / 180;
  const unit = vertices.map(([longitude, latitude]): Vector => [Math.cos(latitude * radians) * Math.cos(longitude * radians), Math.cos(latitude * radians) * Math.sin(longitude * radians), Math.sin(latitude * radians)]);
  const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const toward = (from: Vector, target: Vector): Vector => {
    const along = dot(target, from), tangent: Vector = [target[0] - along * from[0], target[1] - along * from[1], target[2] - along * from[2]];
    const length = Math.hypot(...tangent);
    return [tangent[0] / length, tangent[1] / length, tangent[2] / length];
  };
  let interior = 0;
  unit.forEach((vertex, index) => {
    const next = toward(vertex, unit[(index + 1) % unit.length]!), previous = toward(vertex, unit[(index + unit.length - 1) % unit.length]!);
    const angle = Math.atan2(dot(vertex, cross(next, previous)), dot(next, previous));
    interior += angle < 0 ? angle + 2 * Math.PI : angle;
  });
  const left = interior - (vertices.length - 2) * Math.PI;
  return Math.min(left, 4 * Math.PI - left);
}

describe('MapDrawing spherical area boundaries', () => {
  for (const [name, vertices] of [
    ['a fan wider than a hemisphere', [[-180, -60], [-180, -30], [45, 30], [-90, 0]]],
    ['a fan wound the other way', [[-180, -60], [-180, -30], [-90, 30], [45, 30]]],
  ] satisfies [string, LyraMapDrawingPoint[]][]) {
    it(`measures the smaller bounded region for ${name} in either winding`, () => {
      const forward = draw('polygon', vertices).complete(), reversed = draw('polygon', [...vertices].reverse()).complete();
      expect(forward.accepted && reversed.accepted).to.equal(true);
      const expected = smallerRegion(vertices) * RADIUS * RADIUS;
      for (const result of [forward, reversed]) expect(result.state.metrics!.area).to.be.closeTo(expected, expected * 1e-9);
    });
  }

  it('rejects a region that is exactly a hemisphere even when its edges do not reveal it', () => {
    const result = draw('polygon', [[-180, -45], [-180, 45], [-45, 0], [45, 0]]).complete();
    expect(result.error).to.equal('ambiguous-region');
    expect(result.state.phase).to.equal('drawing');
    expect(result.state.metrics).to.equal(undefined);
  });

  it('treats a revoked coordinate proxy as an invalid coordinate without poisoning the session', () => {
    const revoked = Proxy.revocable<number[]>([0, 0], {});
    revoked.revoke();
    const drawing = new MapDrawing('line');
    expect(drawing.add(revoked.proxy).error).to.equal('invalid-coordinate');
    expect(drawing.add([0, 0]).accepted).to.equal(true);
  });

  it('refuses to start a session in an unsupported mode', () => {
    expect(() => new MapDrawing('circle' as never)).to.throw(TypeError, 'Unsupported drawing mode.');
  });

  it('measures an invalid polygon ring by segments without an area', () => {
    const bowtie = measureDrawing('polygon', [[0, 0], [2, 2], [0, 2], [2, 0]]);
    expect(bowtie.segments.length).to.equal(3);
    expect(bowtie.closing).to.be.greaterThan(0);
    expect(bowtie.area).to.equal(undefined);
    expect(bowtie.centroid).to.equal(undefined);
    expect(measureDrawing('polygon', [[0, 0], [90, 0], [0, 90]]).area).to.be.closeTo(Math.PI * RADIUS * RADIUS / 2, 0.1);
  });
});
