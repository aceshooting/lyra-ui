import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createPointsXrProfile } from '../dist/points/xr-profile.js';
import {
  createPointsXrAllocationAccount, createPointsXrLabelLayout,
  peekPointsXrLabelLayout, finishPointsXrLabelLayout, cancelPointsXrLabelLayout,
} from '../dist/points/xr-label-layout.js';

const words = ['', 'a', 'beta', 'e\u0301', 'مرحبا', '👩‍💻', '漢字', ' '];
const labelIndex = fc.integer({ min: 0, max: words.length - 1 });
const rowArbitrary = fc.record({
  x: fc.integer({ min: -32, max: 32 }), y: fc.integer({ min: -32, max: 32 }), z: fc.integer({ min: -32, max: 32 }),
  label: labelIndex, diameter: fc.integer({ min: 0, max: 20 }), dimmed: fc.boolean(),
});

function drain(run) {
  for (let calls = 0; calls < 100000; calls++) {
    const result = run(17);
    assert.ok(Number.isInteger(result.operations) && result.operations >= 0 && result.operations <= 17);
    if (result.done) return;
  }
  assert.fail('bounded work did not complete');
}

function groups(owner, pass, visit = () => {}) {
  owner.beginGroups(pass);
  for (let calls = 0; calls < 100000; calls++) {
    const result = owner.nextGroup(17);
    assert.ok(Number.isInteger(result.operations) && result.operations >= 0 && result.operations <= 17);
    if (result.kind === 'done') { owner.endGroups(); return; }
    if (result.kind === 'group') visit(result.group, owner.text(result.group));
    else assert.equal(result.kind, 'yield');
  }
  assert.fail('bounded group scan did not complete');
}

test('point label layouts preserve canonical duplicate coverage and independently bounded rectangles and fit', () => {
  fc.assert(fc.property(fc.record({
    rows: fc.array(rowArbitrary, { maxLength: 24 }), axes: fc.boolean(), title: labelIndex, tickA: labelIndex, tickB: labelIndex,
    leftQuarter: fc.integer({ min: -12, max: 12 }), ascentQuarter: fc.integer({ min: -12, max: 12 }),
    inkWidth: fc.integer({ min: 4, max: 20 }), inkHeight: fc.integer({ min: 4, max: 20 }),
    forcedColors: fc.boolean(), lineWidth: fc.integer({ min: 0, max: 10 }),
  }), value => {
    const rows = [
      { x: -40, y: 0, z: 0, label: 1, diameter: 8, dimmed: false },
      { x: 40, y: 0, z: 0, label: 2, diameter: 8, dimmed: true }, ...value.rows,
    ];
    const pointCoordinates = rows.map(row => [row.x / 4, row.y / 4, row.z / 4]);
    const axisEntries = [
      { text: words[value.title], anchor: [12, 0, 0], code: 1 },
      { text: words[value.tickA], anchor: [0, 0, 0], code: 2 },
      { text: words[value.tickB], anchor: [2, 0, 0], code: 3 },
    ];
    const data = admitPointsData({ positions: Float32Array.from(pointCoordinates.flat()),
      sizes: Float32Array.from(rows.map(row => row.diameter)), labels: rows.map(row => words[row.label]),
      axes: value.axes ? [{ axis: 'x', min: -12, max: 12, label: words[value.title], grid: false,
        ticks: [{ value: 0, label: words[value.tickA] }, { value: 2, label: words[value.tickB] }] }] : [],
    });
    const style = resolveLyra3dStyle({ forcedColors: value.forcedColors, lineWidth: value.lineWidth });
    const visualState = { selected: new Set(), dimmed: new Set(rows.flatMap((row, index) => row.dimmed ? [index] : [])), hover: -1, focus: -1 };
    const identity = Object.freeze({}), account = createPointsXrAllocationAccount();
    const owner = createPointsXrLabelLayout(data, style, visualState, identity, account);
    let layout, finished = false;
    try {
      const origins = rows.flatMap((row, index) => words[row.label] ? [{
        text: words[row.label], id: index * 512, output: index, anchor: pointCoordinates[index],
        radius: row.diameter * .001, dim: value.forcedColors || !row.dimmed ? 1 : Math.fround(.3),
      }] : []);
      const expectedAnchors = [];
      if (value.axes) for (const entry of axisEntries) if (entry.text) {
        const output = rows.length + expectedAnchors.length;
        origins.push({ ...entry, id: output * 512 + entry.code, output, radius: 0, dim: 1 });
        expectedAnchors.push(entry.anchor);
      }
      const sorted = [...origins].sort((a, b) => a.text < b.text ? -1 : a.text > b.text ? 1 : a.id - b.id);
      const distinct = [...new Set(sorted.map(row => row.text))];
      const metricFor = text => text === ' ' ? { left: -2, right: 4, ascent: -1, descent: 1 } : {
        left: value.leftQuarter / 4, right: value.inkWidth + text.length - value.leftQuarter / 4,
        ascent: value.ascentQuarter / 4, descent: value.inkHeight - value.ascentQuarter / 4,
      };
      const expectedRects = new Map(distinct.map(text => {
        if (text === ' ') return [text, [0, 0, 0, 0]];
        const left = Math.floor(-value.leftQuarter / 4) - 2;
        const top = Math.floor(-value.ascentQuarter / 4) - 2;
        const right = Math.ceil(value.inkWidth + text.length - value.leftQuarter / 4) + 2;
        const bottom = Math.ceil(value.inkHeight - value.ascentQuarter / 4) + 2;
        return [text, [left, top, right, bottom]];
      }));
      drain(limit => owner.stepIndex(limit));
      assert.deepEqual(sorted.map((_, index) => owner.canonicalIdAt(index)), sorted.map(row => row.id));
      for (const row of sorted) {
        assert.equal(Math.floor(row.id / 512), row.output);
        assert.equal(row.id % 512, row.code ?? 0);
      }
      const requested = [];
      groups(owner, 'fonts', (group, text) => {
        requested.push(text);
        assert.equal(group.representativeId, sorted[group.start].id);
        assert.equal(group.end - group.start, sorted.filter(row => row.text === text).length);
      });
      assert.deepEqual(requested, distinct);
      groups(owner, 'readiness');
      const measured = [];
      groups(owner, 'measure', (group, text) => { measured.push(text); owner.acceptMetrics(group, metricFor(text)); });
      assert.deepEqual(measured, distinct);
      drain(limit => owner.stepPack(limit)); drain(limit => owner.stepFill(limit));
      layout = peekPointsXrLabelLayout(owner, identity);
      assert.equal(layout.identity, identity); assert.equal(layout.pointRows, rows.length);
      assert.equal(layout.axisRows, expectedAnchors.length); assert.deepEqual([...layout.axisAnchors], expectedAnchors.flat());
      assert.equal(layout.inkRows, origins.filter(row => row.text !== ' ').length);
      assert.equal(layout.uniqueInkRuns, distinct.filter(text => text !== ' ').length);

      let padding = Math.max(...rows.map(row => row.diameter), value.axes ? value.lineWidth : 0) * .001;
      const uniqueUvs = new Map();
      for (const row of origins) {
        const pixelRect = expectedRects.get(row.text), expectedWorld = pixelRect.map(number => Math.fround(number * .001));
        const record = [...layout.instanceData.subarray(row.output * 9, row.output * 9 + 9)];
        assert.deepEqual(record.slice(0, 4), expectedWorld); assert.equal(record[8], row.dim);
        if (row.text === ' ') { assert.deepEqual(record.slice(4, 8), [0, 0, 0, 0]); continue; }
        const uv = record.slice(4, 8);
        assert.ok(uv.every(number => Number.isFinite(number) && number >= 0 && number <= 1));
        assert.equal((uv[2] - uv[0]) * 1024, pixelRect[2] - pixelRect[0]);
        assert.equal((uv[3] - uv[1]) * 1024, pixelRect[3] - pixelRect[1]);
        if (uniqueUvs.has(row.text)) assert.deepEqual(uv, uniqueUvs.get(row.text));
        else uniqueUvs.set(row.text, uv);
        const dx = Math.max(Math.abs(expectedWorld[0] + .008 + row.radius), Math.abs(expectedWorld[2] + .008 + row.radius));
        padding = Math.max(padding, Math.hypot(dx, Math.max(Math.abs(expectedWorld[1]), Math.abs(expectedWorld[3]))));
      }
      for (let row = 0; row < rows.length; row++) if (!words[rows[row].label]) {
        assert.deepEqual([...layout.instanceData.subarray(row * 9, row * 9 + 8)], Array(8).fill(0));
      }
      const tiles = [...uniqueUvs.values()];
      for (let a = 0; a < tiles.length; a++) for (let b = a + 1; b < tiles.length; b++) {
        const x = tiles[a], y = tiles[b];
        assert.ok(x[2] <= y[0] || y[2] <= x[0] || x[3] <= y[1] || y[3] <= x[1], 'different complete runs must not share atlas pixels');
      }
      assert.ok(Math.abs(layout.padding - padding) <= 1e-12);
      const endpoints = value.axes ? [...pointCoordinates, [-12, 0, 0], [12, 0, 0]] : pointCoordinates;
      const min = [0, 1, 2].map(axis => Math.min(...endpoints.map(point => point[axis])));
      const max = [0, 1, 2].map(axis => Math.max(...endpoints.map(point => point[axis])));
      const center = min.map((number, axis) => (number + max[axis]) / 2);
      const radius = Math.hypot(...min.map((number, axis) => (max[axis] - number) / 2));
      const profile = createPointsXrProfile(data, style, { identity, layout, account });
      assert.deepEqual(profile.min, min); assert.deepEqual(profile.max, max); assert.deepEqual(profile.center, center);
      assert.ok(Math.abs(profile.padding - padding) <= 1e-12); assert.equal(profile.radius, radius);
      assert.ok(profile.scale <= (.749 - padding) / radius); assert.equal(Math.fround(profile.scale), profile.scale);
      for (const row of origins) if (row.text !== ' ') {
        const rect = expectedRects.get(row.text).map(number => Math.fround(number * .001));
        const anchorDistance = Math.hypot(...row.anchor.map((number, axis) => (number - center[axis]) * profile.scale));
        for (const x of [rect[0], rect[2]]) for (const y of [rect[1], rect[3]]) {
          assert.ok(anchorDistance + Math.hypot(x + .008 + row.radius, y) <= .749 + 1e-12);
        }
      }
      const painted = [];
      groups(owner, 'paint', (group, text) => {
        const run = owner.paintRun(group), rect = expectedRects.get(text);
        assert.equal(run.ink, text !== ' ');
        if (!run.ink) return;
        painted.push(text);
        assert.equal(run.originX, run.atlasX - rect[0]); assert.equal(run.originY, run.atlasY - rect[1]);
        assert.deepEqual([run.width, run.height], [rect[2] - rect[0], rect[3] - rect[1]]);
      });
      assert.deepEqual(painted, distinct.filter(text => text !== ' '));
      assert.equal(finishPointsXrLabelLayout(owner, identity), layout); finished = true;
      assert.equal(owner.snapshot().sourceRetained, false); assert.equal(owner.snapshot().ownedBufferBytes, 0);
      assert.equal(account.usedBytes, layout.instanceData.byteLength + layout.axisAnchors.byteLength);
      assert.ok(account.peakBytes <= 8388608);
      assert.deepEqual([...data.positions], pointCoordinates.flat());
    } finally {
      cancelPointsXrLabelLayout(owner);
      if (finished) { account.release(layout.instanceData.buffer); account.release(layout.axisAnchors.buffer); }
      assert.equal(account.usedBytes, 0);
    }
  }), { seed: 20261029, numRuns: 200, includeErrorInReport: true });
});
