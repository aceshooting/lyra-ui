import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { Lyra3dXrError } from '../dist/xr/types.js';
import { createPointsXrProfile } from '../dist/points/xr-profile.js';
import {
  createPointsXrAllocationAccount, createPointsXrLabelLayout,
  peekPointsXrLabelLayout, finishPointsXrLabelLayout, cancelPointsXrLabelLayout,
} from '../dist/points/xr-label-layout.js';

const unsupported = error => error instanceof Lyra3dXrError && error.code === 'unsupported-scene';
const state = dimmed => ({ selected: new Set(), dimmed: new Set(dimmed), hover: -1, focus: -1 });
const smallMetrics = () => ({ left: 0, right: 4, ascent: 2, descent: 2 });
const near = (actual, expected, epsilon = 1e-12) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);

function trackedAccount() {
  const actual = createPointsXrAllocationAccount(), allocations = [], live = new Set(), attempts = [];
  const account = {
    get limitBytes() { return actual.limitBytes; },
    get usedBytes() { return actual.usedBytes; },
    get peakBytes() { return actual.peakBytes; },
    get transferredBytes() { return actual.transferredBytes; },
    allocate(bytes) {
      attempts.push(bytes);
      const buffer = actual.allocate(bytes);
      assert.equal(buffer.byteLength, bytes); assert.equal(live.has(buffer), false);
      live.add(buffer); allocations.push(buffer);
      assert.ok(actual.usedBytes <= 8388608);
      return buffer;
    },
    release(buffer) {
      assert.equal(live.has(buffer), true, 'release must name an owned backing allocation');
      actual.release(buffer); live.delete(buffer);
    },
    transfer(buffer) {
      assert.equal(live.has(buffer), true, 'transfer must name an owned backing allocation');
      actual.transfer(buffer); live.delete(buffer);
    },
  };
  return { account, allocations, live, attempts };
}

function work(input = {}, styleValues = {}, visualState = state(), tracker = trackedAccount()) {
  const data = admitPointsData({ positions: new Float32Array([0, 0, 0]), labels: ['label'], ...input });
  const style = resolveLyra3dStyle(styleValues), identity = Object.freeze({});
  const owner = createPointsXrLabelLayout(data, style, visualState, identity, tracker.account);
  return { data, style, identity, owner, ...tracker };
}

function checkStep(result, limit) {
  assert.equal(Number.isInteger(result.operations), true);
  assert.ok(result.operations >= 0 && result.operations <= limit);
}

function drain(run, limit = 2048) {
  let calls = 0, operations = 0;
  for (;;) {
    assert.ok(++calls <= 1000000, 'bounded work must eventually finish');
    const result = run(limit); checkStep(result, limit); operations += result.operations;
    assert.equal(typeof result.done, 'boolean');
    if (result.done) return { calls, operations };
  }
}

function groups(context, pass, visit = () => {}, limit = 2048) {
  context.owner.beginGroups(pass);
  let calls = 0, count = 0, yields = 0, operations = 0;
  for (;;) {
    assert.ok(++calls <= 100000, 'group scans must eventually finish');
    const result = context.owner.nextGroup(limit); checkStep(result, limit); operations += result.operations;
    if (result.kind === 'done') break;
    if (result.kind === 'yield') { yields++; continue; }
    assert.equal(result.kind, 'group'); count++;
    visit(result.group, context.owner.text(result.group));
  }
  context.owner.endGroups();
  return { calls, count, yields, operations };
}

function takeGroup(context) {
  for (let calls = 0; calls < 100000; calls++) {
    const result = context.owner.nextGroup(1); checkStep(result, 1);
    if (result.kind === 'group') return result.group;
    assert.equal(result.kind, 'yield', 'expected an unconsumed group');
  }
  assert.fail('group was never produced');
}

function measured(context, metrics = smallMetrics, limit = 2048) {
  drain(value => context.owner.stepIndex(value), limit);
  groups(context, 'fonts', undefined, limit);
  groups(context, 'readiness', undefined, limit);
  groups(context, 'measure', (group, text) => context.owner.acceptMetrics(group, metrics(text)), limit);
}

function numeric(context, metrics = smallMetrics, limit = 2048) {
  measured(context, metrics, limit);
  drain(value => context.owner.stepPack(value), limit);
  drain(value => context.owner.stepFill(value), limit);
  return peekPointsXrLabelLayout(context.owner, context.identity);
}

function finish(context, visit = () => {}, limit = 2048) {
  groups(context, 'paint', (group, text) => visit(context.owner.paintRun(group), text), limit);
  return finishPointsXrLabelLayout(context.owner, context.identity);
}

function cleanup(context) {
  cancelPointsXrLabelLayout(context.owner);
  for (const buffer of [...context.live]) context.account.release(buffer);
  assert.equal(context.account.usedBytes, 0);
}

test('point label canonical IDs retain every origin and deduplicate whole runs beyond 256 labels', () => {
  const labels = ['same', '', ...Array.from({ length: 300 }, (_, row) => `p${String(row).padStart(3, '0')}`)];
  const context = work({ positions: new Float32Array(labels.length * 3), labels, axes: [
    { axis: 'x', min: -1, max: 1, label: 'same', ticks: [{ value: -1, label: '' }, { value: 0, label: 'x-middle' }] },
    { axis: 'y', min: -1, max: 1, label: '', ticks: [{ value: 1, label: 'same' }] },
    { axis: 'z', min: -1, max: 1, label: 'z-title', ticks: Array.from({ length: 128 }, (_, row) => ({ value: 0, label: row === 127 ? 'z-last' : '' })) },
  ] });
  try {
    const expected = labels.flatMap((text, row) => text ? [{ text, id: row * 512 }] : []);
    expected.push(
      { text: 'same', id: 302 * 512 + 1 }, { text: 'x-middle', id: 303 * 512 + 3 },
      { text: 'same', id: 304 * 512 + 131 }, { text: 'z-title', id: 305 * 512 + 259 },
      { text: 'z-last', id: 306 * 512 + 387 },
    );
    expected.sort((a, b) => a.text < b.text ? -1 : a.text > b.text ? 1 : a.id - b.id);
    drain(limit => context.owner.stepIndex(limit));
    assert.equal(context.owner.snapshot().indexedRows, 306);
    assert.equal(context.owner.snapshot().distinctRuns, 304);
    assert.deepEqual(expected.map((_, index) => context.owner.canonicalIdAt(index)), expected.map(row => row.id));
    assert.throws(() => context.owner.canonicalIdAt(306), RangeError);
    const fontRuns = [];
    groups(context, 'fonts', (group, text) => {
      fontRuns.push(text);
      assert.equal(group.representativeId, expected[group.start].id);
      assert.ok(group.end > group.start);
      assert.ok(expected.slice(group.start, group.end).every(row => row.text === text));
      if (text === 'same') assert.equal(group.end - group.start, 3);
    });
    assert.equal(fontRuns.length, 304); assert.equal(new Set(fontRuns).size, 304);
    groups(context, 'readiness');
    groups(context, 'measure', group => context.owner.acceptMetrics(group, smallMetrics()));
    drain(limit => context.owner.stepPack(limit)); drain(limit => context.owner.stepFill(limit));
    const layout = peekPointsXrLabelLayout(context.owner, context.identity);
    assert.equal(layout.pointRows, 302); assert.equal(layout.axisRows, 5);
    assert.equal(layout.inkRows, 306); assert.equal(layout.uniqueInkRuns, 304);
    assert.equal(layout.instanceData.length, 307 * 9);
    for (const row of expected) {
      const offset = Math.floor(row.id / 512) * 9;
      assert.ok(layout.instanceData[offset + 2] > layout.instanceData[offset]);
      assert.ok(layout.instanceData[offset + 3] > layout.instanceData[offset + 1]);
    }
    assert.deepEqual([...layout.instanceData.subarray(9, 17)], Array(8).fill(0));
    let painted = 0;
    assert.equal(finish(context, run => { assert.equal(run.ink, true); painted++; }), layout);
    assert.equal(painted, 304);
  } finally { cleanup(context); }
});

test('point label metrics classify zero ink before padding and retain valid signed bearings', () => {
  const context = work({ positions: new Float32Array(9), labels: ['   ', 'zero-width', 'signed'] });
  try {
    const layout = numeric(context, text => text === '   '
      ? { left: -8, right: 16, ascent: -3, descent: 3 }
      : text === 'zero-width' ? { left: 2, right: -2, ascent: 4, descent: 2 }
        : { left: -2, right: 8, ascent: -1, descent: 5 });
    assert.equal(layout.inkRows, 1); assert.equal(layout.uniqueInkRuns, 1);
    for (const row of [0, 1]) assert.deepEqual([...layout.instanceData.subarray(row * 9, row * 9 + 8)], Array(8).fill(0));
    assert.deepEqual([...layout.instanceData.subarray(18, 22)], [0, -.001, .010, .007].map(Math.fround));
    finish(context, (run, text) => {
      if (text !== 'signed') {
        assert.equal(run.ink, false);
        assert.deepEqual([run.width, run.height, run.atlasX, run.atlasY, run.originX, run.originY], [0, 0, 0, 0, 0, 0]);
      }
    });
  } finally { cleanup(context); }
  for (const metrics of [
    { left: NaN, right: 2, ascent: 1, descent: 1 }, { left: 0, right: Infinity, ascent: 1, descent: 1 },
    { left: 0, right: 2, ascent: undefined, descent: 1 }, { left: -3, right: 2, ascent: 1, descent: 1 },
    { left: 0, right: 2, ascent: -4, descent: 3 }, { left: Number.MAX_VALUE, right: Number.MAX_VALUE, ascent: 1, descent: 1 },
    { left: 2 ** 31, right: 4 - 2 ** 31, ascent: 1, descent: 1 },
  ]) {
    const invalid = work();
    try { assert.throws(() => measured(invalid, () => metrics), unsupported); }
    finally { cleanup(invalid); }
  }
});

test('point labels preserve complete admitted runs and independently rounded overhang and draw origins', () => {
  for (const text of ['אבג e\u0301 👩‍💻 <b>plain text</b>', 'L'.repeat(256)]) {
    const context = work({ labels: [text] });
    try {
      const seen = [], layout = numeric(context, value => {
        seen.push(value); return { left: 2.25, right: 7.5, ascent: 3.25, descent: 1.5 };
      });
      assert.deepEqual(seen, [text]); assert.equal(seen[0].length, text.length);
      assert.deepEqual([...layout.instanceData.subarray(0, 4)], [-.005, -.006, .010, .004].map(Math.fround));
      assert.deepEqual([...layout.instanceData.subarray(4, 8)], [0, 0, 15 / 1024, 10 / 1024]);
      const originalBuffer = layout.instanceData.buffer;
      assert.equal(peekPointsXrLabelLayout(context.owner, context.identity), layout);
      assert.equal(finish(context, (run, value) => {
        assert.equal(value, text); assert.equal(run.ink, true);
        assert.deepEqual([run.atlasX, run.atlasY, run.width, run.height, run.originX, run.originY], [0, 0, 15, 10, 5, 6]);
      }), layout);
      assert.equal(layout.instanceData.buffer, originalBuffer);
      assert.equal(context.owner.snapshot().sourceRetained, false);
      assert.equal(context.owner.snapshot().ownedBufferBytes, 0);
      assert.throws(() => finishPointsXrLabelLayout(context.owner, context.identity), RangeError);
    } finally { cleanup(context); }
  }
});

test('point label shelf packing accepts exact edges and refuses overflow without alternate packing', () => {
  const dimensions = (width, height) => ({ left: 0, right: width - 4, ascent: 0, descent: height - 4 });
  for (const [count, width, height] of [[2, 512, 1024], [4, 512, 512], [1, 1024, 1024]]) {
    const exact = work({ positions: new Float32Array(count * 3), labels: Array.from({ length: count }, (_, row) => `run-${row}`) });
    try {
      measured(exact, () => dimensions(width, height));
      drain(limit => exact.owner.stepPack(limit));
      assert.equal(exact.owner.snapshot().phase, 'packed');
    } finally { cleanup(exact); }
  }
  for (const [labels, rectangles] of [
    [['a', 'b'], [[512, 1024], [513, 1024]]],
    [['a', 'b', 'c', 'd', 'e'], Array.from({ length: 5 }, () => [512, 512])],
    [['a', 'b', 'c'], [[600, 600], [424, 424], [424, 600]]],
  ]) {
    const context = work({ positions: new Float32Array(labels.length * 3), labels });
    try {
      measured(context, text => dimensions(...rectangles[labels.indexOf(text)]));
      assert.throws(() => drain(limit => context.owner.stepPack(limit)), unsupported);
      assert.throws(() => peekPointsXrLabelLayout(context.owner, context.identity), RangeError);
    } finally { cleanup(context); }
  }
  // The final rejected set fits if c shares a shelf with a and b goes below it.
  assert.equal(600 + 424, 1024); assert.equal(Math.max(600, 600) + 424, 1024);
  for (const [width, height] of [[1025, 8], [8, 1025]]) {
    const tooLarge = work();
    try { assert.throws(() => measured(tooLarge, () => dimensions(width, height)), unsupported); }
    finally { cleanup(tooLarge); }
  }
});

test('point label world rectangles keep fixed units and separate point radius axis radius and dim factors', () => {
  for (const forcedColors of [false, true]) {
    const context = work({ positions: new Float32Array([-1, 0, 0, 1, 0, 0, 0, 0, 0]),
      sizes: new Float32Array([4, 20, 0]), labels: ['same', 'same', ''],
      axes: [{ axis: 'x', min: -1, max: 1, label: 'same', ticks: [{ value: 0, label: 'same' }] }],
    }, { forcedColors, devicePixelRatio: forcedColors ? 4 : .25, pointSize: 99, lineWidth: 0 }, state([0]));
    const originalPositions = [...context.data.positions], originalSizes = [...context.data.sizes];
    try {
      const layout = numeric(context, () => ({ left: 2, right: 10, ascent: 4, descent: 2 }));
      const rectangle = [-.004, -.006, .012, .004].map(Math.fround);
      for (const row of [0, 1, 3, 4]) assert.deepEqual([...layout.instanceData.subarray(row * 9, row * 9 + 4)], rectangle);
      assert.equal(layout.instanceData[8], Math.fround(forcedColors ? 1 : .3));
      for (const row of [1, 3, 4]) assert.equal(layout.instanceData[row * 9 + 8], 1);
      assert.deepEqual([...layout.axisAnchors], [1, 0, 0, 0, 0, 0]);
      near(layout.padding, Math.hypot(rectangle[2] + .008 + .020, -rectangle[1]));
      assert.equal(layout.instanceData.buffer === context.data.positions.buffer, false);
      assert.equal(layout.instanceData.buffer === context.data.sizes.buffer, false);
      assert.deepEqual([...context.data.positions], originalPositions); assert.deepEqual([...context.data.sizes], originalSizes);
      finish(context);
    } finally { cleanup(context); }
  }
});

test('point label maximum-row buffers use the aggregate allocator and refuse before exceeding its shared ceiling', () => {
  const input = { positions: new Float32Array(100000 * 3), sizes: new Float32Array(100000).fill(4),
    labels: Array(100000).fill('same'), axes: ['x', 'y', 'z'].map(axis => ({
      axis, min: -1, max: 1, label: 'same', ticks: Array.from({ length: 128 }, () => ({ value: 0, label: 'same' })),
    })),
  };
  const context = work(input);
  try {
    assert.equal(context.allocations.length, 4);
    assert.deepEqual(context.allocations.map(buffer => buffer.byteLength).sort((a, b) => a - b), [4644, 401548, 2409288, 3613932]);
    assert.equal(context.account.usedBytes, 6429412);
    assert.equal(context.allocations.some(buffer => buffer === context.data.positions.buffer || buffer === context.data.sizes.buffer), false);
    const layout = numeric(context);
    assert.equal(layout.pointRows, 100000); assert.equal(layout.axisRows, 387);
    assert.equal(layout.inkRows, 100387); assert.equal(layout.uniqueInkRuns, 1);
    assert.equal(context.owner.snapshot().distinctRuns, 1);
    assert.equal(context.live.has(layout.instanceData.buffer), true); assert.equal(context.live.has(layout.axisAnchors.buffer), true);
    finish(context);
    assert.equal(context.allocations.length, 4, 'finish must reuse final buffers');
    assert.equal(context.account.usedBytes, 3618576); assert.equal(layout.ownedBufferBytes, 3618576);
    assert.equal(context.live.size, 2); assert.equal(context.account.transferredBytes, 0);
    context.account.transfer(layout.instanceData.buffer); context.account.transfer(layout.axisAnchors.buffer);
    assert.equal(context.account.usedBytes, 0); assert.equal(context.account.transferredBytes, 3618576);
    assert.throws(() => context.account.allocate(1), RangeError);
  } finally { cleanup(context); }

  for (const extraByte of [0, 1]) {
    const tracker = trackedAccount(), occupied = tracker.account.allocate(8388608 - 6429412 + extraByte);
    let candidate;
    try {
      if (extraByte === 0) {
        candidate = work(input, {}, state(), tracker);
        assert.equal(tracker.account.usedBytes, 8388608);
        cancelPointsXrLabelLayout(candidate.owner);
      } else {
        assert.throws(() => work(input, {}, state(), tracker), unsupported);
        assert.equal(tracker.live.size, 1, 'partial creation must release its successful allocations');
      }
      assert.equal(tracker.account.usedBytes, occupied.byteLength);
      assert.ok(tracker.account.peakBytes <= 8388608);
    } finally {
      if (candidate) cancelPointsXrLabelLayout(candidate.owner);
      for (const buffer of [...tracker.live]) tracker.account.release(buffer);
    }
  }
});

test('point label profile certificates include padded corners and reject a foreign preparation identity', () => {
  const context = work({ positions: new Float32Array([-2, -1, 0, 2, 1, 0]), sizes: new Float32Array([4, 12]),
    labels: ['small', 'wide'], axes: [{ axis: 'y', min: -3, max: 3, label: 'small', ticks: [{ value: 0, label: 'small' }], grid: false }],
  }, { lineWidth: 2 });
  try {
    const layout = numeric(context, text => ({ left: 1, right: text === 'wide' ? 20 : 5, ascent: 4, descent: 2 }));
    const small = [-.003, -.006, .007, .004].map(Math.fround), wide = [-.003, -.006, .022, .004].map(Math.fround);
    const expectedPadding = Math.hypot(wide[2] + .008 + .012, -wide[1]);
    near(layout.padding, expectedPadding);
    assert.throws(() => peekPointsXrLabelLayout(context.owner, Object.freeze({})), unsupported);
    assert.throws(() => createPointsXrProfile(context.data, context.style), unsupported);
    assert.throws(() => createPointsXrProfile(context.data, context.style,
      { identity: Object.freeze({}), layout, account: context.account }), unsupported);
    const before = context.account.usedBytes;
    const profile = createPointsXrProfile(context.data, context.style, { identity: context.identity, layout, account: context.account });
    assert.equal(context.account.usedBytes, before, 'profile scale scratch must be released');
    assert.equal(context.allocations.at(-1).byteLength, 4);
    assert.deepEqual(profile.min, [-2, -3, 0]); assert.deepEqual(profile.max, [2, 3, 0]);
    assert.deepEqual(profile.center, [0, 0, 0]); near(profile.radius, Math.sqrt(13)); near(profile.padding, expectedPadding);
    assert.ok(profile.scale <= (.749 - expectedPadding) / Math.sqrt(13));
    assert.equal(Math.fround(profile.scale), profile.scale);
    const c = Math.SQRT1_2;
    const bases = [[[1, 0, 0], [0, 1, 0]], [[c, 0, c], [0, 1, 0]], [[.5, c, .5], [-c, 0, c]]];
    const rows = [
      { anchor: [-2, -1, 0], rect: small, radius: .004 }, { anchor: [2, 1, 0], rect: wide, radius: .012 },
      { anchor: [0, 3, 0], rect: small, radius: 0 }, { anchor: [0, 0, 0], rect: small, radius: 0 },
    ];
    for (const [right, up] of bases) for (const row of rows) {
      const anchor = [row.anchor[0] * profile.scale, -row.anchor[1] * profile.scale, row.anchor[2] * profile.scale];
      for (const x of [row.rect[0], row.rect[2]]) for (const y of [row.rect[1], row.rect[3]]) {
        const corner = anchor.map((value, axis) => value + right[axis] * (x + .008 + row.radius) - up[axis] * y);
        assert.ok(Math.hypot(...corner) <= .749 + 1e-12, 'padded corners must fit for every authored eye basis');
      }
    }
    assert.equal(Object.hasOwn(profile, 'layout'), false); assert.equal(Object.hasOwn(profile, 'identity'), false);
  } finally { cleanup(context); }
});

test('point label empty and zero-radius layouts retain protected padding coordinate and scale refusals', () => {
  for (const input of [
    { positions: new Float32Array(), labels: [] },
    { positions: new Float32Array([2, -3, 4]), labels: ['label'], sizes: new Float32Array([0]) },
  ]) {
    const context = work(input);
    try {
      const layout = numeric(context), profile = createPointsXrProfile(context.data, context.style,
        { identity: context.identity, layout, account: context.account });
      assert.equal(profile.radius, 0); assert.equal(profile.scale, 1);
      assert.deepEqual(profile.center, input.labels.length ? [2, -3, 4] : [0, 0, 0]);
      finish(context);
    } finally { cleanup(context); }
  }
  for (const [input, metrics] of [
    [{ sizes: new Float32Array([749]) }, smallMetrics],
    [{}, () => ({ left: 0, right: 740, ascent: 1, descent: 1 })],
    [{ positions: new Float32Array([2 ** -149, 0, 0]) }, () => ({ left: 0, right: 0, ascent: 0, descent: 0 })],
    [{ axes: [{ axis: 'x', min: -1, max: 1, grid: false, ticks: [{ value: 2 ** -149, label: 'tick' }] }] },
      () => ({ left: 0, right: 0, ascent: 0, descent: 0 })],
    [{ positions: new Float32Array([100, 0, 0]) }, smallMetrics],
    [{ positions: new Float32Array([1000000, 0, 0, 1000000.125, 0, 0]), labels: ['a', 'b'] }, smallMetrics],
    [{ positions: new Float32Array([2 ** -126, 0, 0, 2 ** -126 + 2 ** -149, 0, 0]), labels: ['a', 'b'] }, smallMetrics],
  ]) {
    const context = work(input);
    try {
      assert.throws(() => {
        const layout = numeric(context, metrics);
        createPointsXrProfile(context.data, context.style, { identity: context.identity, layout, account: context.account });
      }, unsupported);
      assert.notEqual(context.owner.snapshot().phase, 'paint');
      assert.notEqual(context.owner.snapshot().phase, 'finished');
    } finally { cleanup(context); }
  }
});

test('point label work yields bounded slices and cancellation revokes each preparation phase', () => {
  const duplicate = work({ positions: new Float32Array(3000 * 3), labels: Array(3000).fill('same') });
  try {
    assert.throws(() => duplicate.owner.beginGroups('fonts'), RangeError);
    assert.throws(() => finishPointsXrLabelLayout(duplicate.owner, duplicate.identity), RangeError);
    const indexed = drain(limit => duplicate.owner.stepIndex(limit), 2);
    assert.ok(indexed.operations >= 3000, 'enumeration must account for every source row');
    const scan = groups(duplicate, 'fonts', group => assert.equal(group.end - group.start, 3000), 2);
    assert.equal(scan.count, 1); assert.ok(scan.yields > 100);
    assert.ok(scan.operations >= 2999, 'a duplicate group scan must account for adjacent comparisons');
  } finally { cleanup(duplicate); }

  const authority = work({ positions: new Float32Array(9), labels: ['b', 'a', 'b'] });
  try {
    let done = false, operations = 0, calls = 0;
    while (!done) {
      let remaining = 7, used = 0;
      while (remaining > 0 && !done) {
        assert.ok(++calls < 100000);
        const requested = Math.min(2, remaining), result = authority.owner.stepIndex(requested);
        checkStep(result, requested); remaining -= result.operations; used += result.operations;
        operations += result.operations; done = result.done;
      }
      assert.ok(used <= 7, 'all work calls share one slice allowance');
    }
    assert.ok(operations >= 3);
    authority.owner.beginGroups('fonts');
    const first = takeGroup(authority);
    assert.equal(authority.owner.text(first), 'a');
    assert.throws(() => authority.owner.text({ ...first }), RangeError);
    const result = authority.owner.nextGroup(1); checkStep(result, 1);
    assert.throws(() => authority.owner.text(first), RangeError, 'advancing revokes a group even when it yields');
    let fontDrainCalls = 0;
    for (;;) {
      assert.ok(++fontDrainCalls <= 100000, 'font group drain must eventually finish');
      const next = authority.owner.nextGroup(1); checkStep(next, 1);
      if (next.kind === 'done') break;
    }
    authority.owner.endGroups(); authority.owner.beginGroups('readiness');
    const current = takeGroup(authority);
    assert.throws(() => authority.owner.text(first), RangeError, 'a new pass cannot revive a prior group');
    cancelPointsXrLabelLayout(authority.owner);
    assert.throws(() => authority.owner.text(current), RangeError);
    assert.throws(() => authority.owner.acceptMetrics(current, smallMetrics()), RangeError);
    assert.throws(() => authority.owner.paintRun(current), RangeError);
  } finally { cleanup(authority); }

  for (const failure of ['fabricated', 'missing', 'duplicate', 'stale']) {
    const context = work({ positions: new Float32Array(6), labels: ['a', 'b'] });
    try {
      drain(limit => context.owner.stepIndex(limit)); groups(context, 'fonts'); groups(context, 'readiness');
      context.owner.beginGroups('measure'); const current = takeGroup(context);
      if (failure === 'fabricated') assert.throws(() => context.owner.acceptMetrics({ ...current }, smallMetrics()), RangeError);
      else if (failure === 'missing') assert.throws(() => context.owner.nextGroup(1), RangeError);
      else {
        context.owner.acceptMetrics(current, smallMetrics());
        if (failure === 'stale') takeGroup(context);
        assert.throws(() => context.owner.acceptMetrics(current, smallMetrics()), RangeError);
      }
    } finally { cleanup(context); }
  }

  const painted = work({ positions: new Float32Array(6), labels: ['a', 'b'] });
  try {
    numeric(painted); painted.owner.beginGroups('paint'); const current = takeGroup(painted);
    assert.equal(painted.owner.paintRun(current).ink, true);
    assert.throws(() => painted.owner.paintRun({ ...current }), RangeError);
    painted.owner.nextGroup(1);
    assert.throws(() => painted.owner.paintRun(current), RangeError);
  } finally { cleanup(painted); }

  for (const phase of ['indexing', 'fonts', 'readiness', 'measure', 'packing', 'filling', 'paint']) {
    const context = work({ positions: new Float32Array(9), labels: ['b', 'a', 'b'] });
    try {
      if (phase === 'indexing') checkStep(context.owner.stepIndex(1), 1);
      else {
        drain(limit => context.owner.stepIndex(limit), 1);
        if (phase === 'fonts') context.owner.beginGroups('fonts');
        else {
          groups(context, 'fonts', undefined, 1);
          if (phase === 'readiness') context.owner.beginGroups('readiness');
          else {
            groups(context, 'readiness', undefined, 1);
            if (phase === 'measure') context.owner.beginGroups('measure');
            else {
              groups(context, 'measure', group => context.owner.acceptMetrics(group, smallMetrics()), 1);
              if (phase === 'packing') checkStep(context.owner.stepPack(1), 1);
              else {
                drain(limit => context.owner.stepPack(limit), 1);
                if (phase === 'filling') checkStep(context.owner.stepFill(1), 1);
                else {
                  const filled = drain(limit => context.owner.stepFill(limit), 1);
                  assert.ok(filled.operations >= 3, 'each output row fill consumes work');
                  context.owner.beginGroups('paint');
                }
              }
            }
          }
        }
      }
      assert.equal(context.owner.snapshot().phase, phase);
      cancelPointsXrLabelLayout(context.owner); cancelPointsXrLabelLayout(context.owner);
      assert.equal(context.owner.snapshot().phase, 'cancelled'); assert.equal(context.owner.snapshot().sourceRetained, false);
      assert.equal(context.owner.snapshot().ownedBufferBytes, 0); assert.equal(context.live.size, 0);
      assert.throws(() => context.owner.stepIndex(1), RangeError);
      assert.throws(() => context.owner.nextGroup(1), RangeError);
      assert.throws(() => context.owner.canonicalIdAt(0), RangeError);
      assert.throws(() => peekPointsXrLabelLayout(context.owner, context.identity), RangeError);
    } finally { cleanup(context); }
  }
});
