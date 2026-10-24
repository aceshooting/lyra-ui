import { expect } from '@open-wc/testing';
import {
  Chart3dRows,
  admitChart3dData,
  chart3dAxisTitle,
  normalizeChart3dAxis,
  normalizeChart3dCamera,
  type LyraChart3dColumns,
} from './chart-3d-data.js';

const columns = () => ({
  ids: ['a', 'b', 'c'],
  x: new Float32Array([0, 2, 4]),
  y: new Float32Array([0, 4, 8]),
  z: new Float32Array([0, 1, 2]),
});

function admitted(value: unknown): LyraChart3dColumns {
  const result = admitChart3dData(value);
  if (!result.ok) throw new Error(`rejected: ${result.issue.code} ${result.issue.column}`);
  return result.columns;
}

const issueOf = (value: unknown) => {
  const result = admitChart3dData(value);
  return result.ok ? null : result.issue;
};

describe('chart-3d data admission', () => {
  it('shares the caller\'s numeric buffers, snapshots strings and freezes only the shell', () => {
    const input = { ...columns(), labels: ['A', 'B', 'C'], category: new Uint16Array([0, 1, 0]), categories: ['first', 'second'] };
    const result = admitChart3dData(input);
    expect(result.ok && result.count).to.equal(3);
    if (!result.ok) return;
    expect(result.columns.x.buffer === input.x.buffer).to.equal(true);
    expect(result.columns.category!.buffer === input.category.buffer).to.equal(true);
    expect(Object.isFrozen(result.columns)).to.equal(true);
    input.ids[0] = 'changed';
    input.labels[0] = 'changed';
    expect([result.columns.ids[0], result.columns.labels![0]]).to.deep.equal(['a', 'A']);
    expect(Object.isFrozen(result.columns.ids)).to.equal(true);
  });

  it('reports the first problem as a typed issue instead of drawing anything', () => {
    const cases: [string, unknown, { code: string; column: string; index?: number }][] = [
      ['missing z', { ...columns(), z: undefined }, { code: 'missing', column: 'z' }],
      ['missing ids', { ...columns(), ids: undefined }, { code: 'missing', column: 'ids' }],
      ['wrong x type', { ...columns(), x: new Float64Array(3) }, { code: 'wrong-type', column: 'x' }],
      ['short y', { ...columns(), y: new Float32Array(2) }, { code: 'length-mismatch', column: 'y' }],
      ['duplicate id', { ...columns(), ids: ['a', 'a', 'c'] }, { code: 'duplicate-id', column: 'ids', index: 1 }],
      ['empty id', { ...columns(), ids: ['a', '', 'c'] }, { code: 'invalid-id', column: 'ids', index: 1 }],
      ['non-finite x', { ...columns(), x: new Float32Array([0, Number.NaN, 2]) }, { code: 'not-finite', column: 'x', index: 1 }],
      ['infinite z', { ...columns(), z: new Float32Array([0, 1, Number.POSITIVE_INFINITY]) }, { code: 'not-finite', column: 'z', index: 2 }],
      ['negative size', { ...columns(), size: new Float32Array([1, -1, 1]) }, { code: 'out-of-range', column: 'size', index: 1 }],
      ['oversized bubble', { ...columns(), size: new Float32Array([1, 2, 1025]) }, { code: 'out-of-range', column: 'size' }],
      ['unknown category', { ...columns(), category: new Uint16Array([0, 2, 0]), categories: ['one', 'two'] }, { code: 'out-of-range', column: 'category', index: 1 }],
      ['short labels', { ...columns(), labels: ['only'] }, { code: 'length-mismatch', column: 'labels' }],
      ['not an object', 7, { code: 'missing', column: 'ids' }],
    ];
    for (const [name, value, expected] of cases) expect(issueOf(value), name).to.deep.equal(expected);
    expect(issueOf(columns())).to.equal(null);
  });

  it('accepts the largest bubble diameter and a category without names', () => {
    expect(issueOf({ ...columns(), size: new Float32Array([0, 512, 1024]) })).to.equal(null);
    expect(issueOf({ ...columns(), category: new Uint16Array([0, 7, 65535]) })).to.equal(null);
  });

  it('rejects more than one million rows before reading them', () => {
    expect(issueOf({ ...columns(), ids: Array(1_000_001) })).to.deep.equal({ code: 'too-many', column: 'ids', limit: 1_000_000 });
    expect(issueOf({ ...columns(), categories: Array(65537).fill('c') })).to.deep.equal({ code: 'too-many', column: 'categories', limit: 65536 });
  });

  it('never invokes shell or indexed accessors and reports hostile objects as invalid', () => {
    let reads = 0;
    const getter = { ...columns(), get x() { reads++; throw new Error('must not run'); } };
    expect(issueOf(getter)).to.not.equal(null);
    expect(reads).to.equal(0);
    expect(issueOf(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } }))).to.not.equal(null);
    const ids = ['a', 'b', 'c'];
    Object.defineProperty(ids, '0', { get() { reads++; return 'a'; } });
    expect(issueOf({ ...columns(), ids })).to.not.equal(null);
    expect(reads).to.equal(0);
  });

  it('does not trust methods shadowed on a caller\'s typed array', () => {
    const size = new Float32Array([1, 2, 2048]);
    Object.defineProperty(size, 'some', { value: () => false });
    expect(issueOf({ ...columns(), size })).to.deep.equal({ code: 'out-of-range', column: 'size' });
  });

  it('admits a million rows, builds the renderer payload and finds an ID within a practical budget', function () {
    this.timeout(60000);
    const count = 1_000_000;
    const ids = Array.from({ length: count }, (_, index) => `p${index}`);
    const x = new Float32Array(count), y = new Float32Array(count), z = new Float32Array(count);
    for (let index = 0; index < count; index++) { x[index] = index % 1000; y[index] = (index / 1000) | 0; z[index] = index % 7; }
    const started = performance.now();
    const result = admitChart3dData({ ids, x, y, z });
    expect(result.ok).to.equal(true);
    if (!result.ok) return;
    const rows = new Chart3dRows(result.columns);
    const data = rows.data('line', [], String);
    expect([rows.count, data.positions.length, data.segments!.length]).to.deep.equal([count, count * 3, (count - 1) * 2]);
    expect(rows.visibleIndex('p999999')).to.equal(count - 1);
    expect(performance.now() - started).to.be.below(10000);
  });
});

describe('chart-3d row view', () => {
  it('keeps source identity and original indices while hidden categories leave the view', () => {
    const rows = new Chart3dRows(admitted({ ...columns(), category: new Uint16Array([0, 1, 0]), categories: ['first', 'second'] }), new Set([1]));
    expect(rows.count).to.equal(2);
    expect([rows.row(0)!.id, rows.row(0)!.index, rows.row(1)!.id, rows.row(1)!.index]).to.deep.equal(['a', 0, 'c', 2]);
    expect(rows.row(1)!.category).to.equal('first');
    expect([rows.visibleIndex('b'), rows.visibleIndex('c'), rows.visibleIndex(''), rows.visibleIndex('missing')]).to.deep.equal([-1, 1, -1, -1]);
    expect([rows.row(2), rows.row(-1), rows.row(0.5), rows.row(Number.NaN)]).to.deep.equal([undefined, undefined, undefined, undefined]);
  });

  it('names rows by label, then ID, and categories by name, then index', () => {
    const named = new Chart3dRows(admitted({ ...columns(), labels: ['One', 'Two', 'Three'], category: new Uint16Array([0, 1, 0]), categories: ['zero', 'one'] }));
    expect(named.row(0)).to.deep.equal({ id: 'a', index: 0, label: 'One', x: 0, y: 0, z: 0, size: undefined, category: 'zero' });
    expect(new Chart3dRows(admitted({ ...columns(), category: new Uint16Array([0, 1, 5]) })).row(2)!.category).to.equal('5');
    expect(new Chart3dRows(admitted(columns())).row(1)!.label).to.equal('b');
  });

  it('uses bubble diameters only for bubble charts and joins adjacent source rows for lines', () => {
    const rows = new Chart3dRows(admitted({ ...columns(), size: new Float32Array([2, 4, 6]), category: new Uint16Array([0, 1, 0]) }));
    expect(Array.from(rows.data('bubble', [], String).sizes!)).to.deep.equal([2, 4, 6]);
    expect(rows.data('scatter', [], String).sizes).to.equal(undefined);
    expect(rows.data('scatter', [], String).segments).to.equal(undefined);
    expect(Array.from(rows.data('line', [], String).segments!)).to.deep.equal([0, 1, 1, 2]);
    expect(Array.from(rows.data('scatter', [], String).categories!)).to.deep.equal([0, 1, 0]);
  });

  it('breaks a line at a hidden row instead of bridging it', () => {
    const rows = new Chart3dRows(admitted({ ...columns(), category: new Uint16Array([0, 1, 0]) }), new Set([1]));
    expect(rows.data('line', [], String).segments!.length).to.equal(0);
    const four = admitted({ ids: ['a', 'b', 'c', 'd'], x: new Float32Array(4), y: new Float32Array(4), z: new Float32Array(4), category: new Uint16Array([0, 0, 1, 0]) });
    // Hiding category 1 removes only row c: a-b stay joined and b-d, no longer adjacent, are not.
    expect(Array.from(new Chart3dRows(four, new Set([1])).data('line', [], String).segments!)).to.deep.equal([0, 1]);
    expect(Array.from(new Chart3dRows(four, new Set([0])).data('line', [], String).segments!)).to.deep.equal([]);
  });

  it('normalizes extremes uniformly with Y inverted and formats five source ticks with the axis unit', () => {
    const data = new Chart3dRows(admitted(columns())).data('scatter', [{ label: 'Distance', unit: 'km' }, {}, {}], (value) => `n${value}`);
    expect(Array.from(data.positions.slice(0, 3))).to.deep.equal([-0.5, 1, -0.25]);
    expect(Array.from(data.positions.slice(6, 9))).to.deep.equal([0.5, -1, 0.25]);
    expect(data.axes.map((axis) => axis.axis)).to.deep.equal(['x', 'y', 'z']);
    expect(data.axes[0]!.label).to.equal('Distance (km)');
    expect(data.axes[0]!.ticks.map((tick) => tick.label)).to.deep.equal(['n0', 'n1', 'n2', 'n3', 'n4']);
    expect(data.axes[0]!.ticks.map((tick) => tick.value)).to.deep.equal([-0.5, -0.25, 0, 0.25, 0.5]);
    expect([data.axes[1]!.min, data.axes[1]!.max]).to.deep.equal([-1, 1]);
    expect(data.axes[1]!.ticks[0]!.value).to.equal(1);
    expect(data.axes.every((axis) => axis.grid && axis.ticks.every((tick) => tick.value >= axis.min && tick.value <= axis.max))).to.equal(true);
  });

  it('collapses a constant axis to one tick and keeps opposite finite extremes finite', () => {
    const flat = new Chart3dRows(admitted({ ids: ['a', 'b'], x: new Float32Array([5, 5]), y: new Float32Array([1, 2]), z: new Float32Array([0, 0]) }));
    const data = flat.data('scatter', [], String);
    expect(data.axes.map((axis) => axis.ticks.length)).to.deep.equal([1, 5, 1]);
    expect([data.positions[0], data.positions[3]]).to.deep.equal([0, 0]);
    const extreme = new Chart3dRows(admitted({ ids: ['a', 'b'], x: new Float32Array([-3.4e38, 3.4e38]), y: new Float32Array(2), z: new Float32Array(2) }));
    const normalized = Array.from(extreme.data('scatter', [], String).positions);
    expect(normalized.every((value) => Number.isFinite(value) && Math.abs(value) <= 1)).to.equal(true);
    expect([normalized[0], normalized[3]]).to.deep.equal([-1, 1]);
  });

  it('builds a valid empty payload when every row is hidden', () => {
    const rows = new Chart3dRows(admitted({ ...columns(), category: new Uint16Array([1, 1, 1]) }), new Set([1]));
    const data = rows.data('line', [], String);
    expect([rows.count, data.positions.length, data.segments!.length]).to.deep.equal([0, 0, 0]);
    expect(data.axes.map((axis) => [axis.min, axis.max, axis.ticks.length, axis.ticks[0]!.value])).to.deep.equal([[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]]);
    expect([rows.position(0), rows.row(0)]).to.deep.equal([null, undefined]);
    expect(rows.fitCamera(400, 300)).to.deep.equal(normalizeChart3dCamera(undefined));
  });

  it('fits and focuses normalized coordinates without any renderer', () => {
    const rows = new Chart3dRows(admitted(columns()));
    expect(rows.position(0)).to.deep.equal({ x: -0.5, y: 1, z: -0.25 });
    expect(rows.position(3)).to.equal(null);
    expect(rows.fitCamera(1, 400).distance).to.be.above(rows.fitCamera(400, 400).distance);
    expect(rows.fitCamera(Number.NaN, Number.POSITIVE_INFINITY).distance).to.be.above(0);
    expect(rows.fitCamera(400, 400).target).to.deep.equal({ x: 0, y: 0, z: 0 });
  });
});

describe('chart-3d untrusted values', () => {
  it('normalizes cameras without running accessors and clamps every field', () => {
    const value = normalizeChart3dCamera({ yaw: Number.POSITIVE_INFINITY, pitch: 10, distance: -1, target: { x: Number.NaN, y: 5, z: 1e20 } });
    expect(value.yaw).to.equal(0);
    expect(value.pitch).to.be.below(Math.PI / 2);
    expect(value.distance).to.be.above(0);
    expect([value.target.x, value.target.y, value.target.z]).to.deep.equal([0, 5, 1e7]);
    let reads = 0;
    const accessor = { get yaw() { reads++; return 1; }, pitch: 0.5, distance: 3, target: { x: 1, y: 2, z: 3 } };
    expect(normalizeChart3dCamera(accessor).yaw).to.equal(0);
    expect(reads).to.equal(0);
    expect(normalizeChart3dCamera(null)).to.deep.equal({ yaw: 0, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } });
    expect(Object.isFrozen(value) && Object.isFrozen(value.target)).to.equal(true);
  });

  it('normalizes axes to bounded own strings and titles them with the unit', () => {
    expect(normalizeChart3dAxis({ label: 'L'.repeat(200), unit: 'u'.repeat(100) })).to.deep.equal({ label: 'L'.repeat(128), unit: 'u'.repeat(64) });
    expect(normalizeChart3dAxis({ label: 5, unit: null })).to.deep.equal({ label: '', unit: '' });
    expect(normalizeChart3dAxis(undefined)).to.deep.equal({ label: '', unit: '' });
    expect(normalizeChart3dAxis(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } }))).to.deep.equal({});
    expect([chart3dAxisTitle({ label: 'Height', unit: 'm' }), chart3dAxisTitle({ label: 'Height' }), chart3dAxisTitle({})]).to.deep.equal(['Height (m)', 'Height', '']);
  });
});

describe('chart-3d hostile input shapes', () => {
  it('reports a string column whose length is not a safe count as unusable input', () => {
    const ids = new Proxy(['a', 'b', 'c'], {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'length') return { value: '3', writable: true, enumerable: false, configurable: false };
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(issueOf({ ...columns(), ids })).to.deep.equal({ code: 'not-an-object', column: '' });
  });

  it('falls back to the default camera when reading the camera input throws', () => {
    const hostile = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } });
    expect(normalizeChart3dCamera(hostile)).to.deep.equal({ yaw: 0, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } });
  });

  it('frames a single point at the default distance instead of collapsing onto it', () => {
    const rows = new Chart3dRows(admitted({ ids: ['only'], x: new Float32Array([4]), y: new Float32Array([5]), z: new Float32Array([6]) }));
    const camera = rows.fitCamera(300, 200);
    expect([camera.yaw, camera.pitch, camera.distance]).to.deep.equal([0, 0, 5]);
    expect(camera.target).to.deep.equal({ x: 0, y: 0, z: 0 });
  });
});
