import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { createPointsXrLabelLayout, peekPointsXrLabelLayout, finishPointsXrLabelLayout,
  cancelPointsXrLabelLayout } from '../dist/points/xr-label-layout.js';
import { unsupported, state, trackedAccount, work, drain, groups, takeGroup, measured, numeric,
  finish, cleanup } from './points-xr-label-layout-fixture.mjs';

for (const limit of [0, -1, 2049, .5, NaN, Infinity, -Infinity, null, '1']) {
  test(`label work rejects invalid slice quota ${String(limit)} without changing the live layout`, () => {
    const context = work(), before = context.owner.snapshot();
    try {
      for (const operation of ['stepIndex', 'nextGroup', 'stepPack', 'stepFill']) {
        assert.throws(() => context.owner[operation](limit), RangeError);
        assert.deepEqual(context.owner.snapshot(), before);
      }
      assert.equal(numeric(context).inkRows, 1);
      assert.equal(finish(context).pointRows, 1);
    } finally { cleanup(context); }
  });
}

test('completed indexing, packing and filling steps are idempotent and consume no further quota', () => {
  const context = work();
  try {
    drain(limit => context.owner.stepIndex(limit));
    assert.deepEqual(context.owner.stepIndex(1), { done: true, operations: 0 });
    measured(context);
    drain(limit => context.owner.stepPack(limit));
    const packed = context.owner.snapshot();
    assert.deepEqual(context.owner.stepPack(1), { done: true, operations: 0 });
    assert.deepEqual(context.owner.snapshot(), packed);
    drain(limit => context.owner.stepFill(limit));
    const ready = peekPointsXrLabelLayout(context.owner, context.identity);
    assert.deepEqual(context.owner.stepFill(1), { done: true, operations: 0 });
    assert.equal(peekPointsXrLabelLayout(context.owner, context.identity), ready);
    assert.equal(finish(context), ready);
  } finally { cleanup(context); }
});

test('out-of-order label work rejects without advancing or releasing the current preparation', () => {
  const context = work();
  try {
    const before = context.owner.snapshot();
    for (const action of [() => context.owner.endGroups(), () => context.owner.stepPack(),
      () => context.owner.stepFill(), () => context.owner.beginGroups('unknown')]) {
      assert.throws(action, RangeError); assert.deepEqual(context.owner.snapshot(), before);
    }
    drain(limit => context.owner.stepIndex(limit)); context.owner.beginGroups('fonts');
    assert.throws(() => context.owner.endGroups(), RangeError, 'a pass cannot end before every group is visited');
    const group = takeGroup(context);
    assert.throws(() => context.owner.paintRun(group), RangeError, 'font readiness does not authorize painting');
    assert.equal(context.owner.text(group), 'label');
    assert.equal(context.owner.nextGroup().kind, 'done'); context.owner.endGroups();
    assert.equal(context.owner.snapshot().phase, 'fonts-done');
  } finally { cleanup(context); }
});

for (const owner of [null, {}, Object.freeze({ snapshot() { throw new Error('foreign owner was invoked'); } })]) {
  test(`foreign label owners cannot peek, finish or cancel a preparation (${owner === null ? 'null' : 'object'})`, () => {
    for (const operation of [peekPointsXrLabelLayout, finishPointsXrLabelLayout, cancelPointsXrLabelLayout]) {
      assert.throws(() => operation(owner, {}), RangeError);
    }
  });
}

for (const [name, override] of [
  ['fractional position row', { positions: new Float32Array(4) }],
  ['too many segments', { segments: new Uint32Array(200002) }],
  ['too many axes', { axes: Array.from({ length: 4 }, () => ({ axis: 'x', min: 0, max: 1, ticks: [] })) }],
  ['too many axis ticks', { axes: [{ axis: 'x', min: 0, max: 1, ticks: Array.from({ length: 129 }, () => ({ value: 0, label: 'tick' })) }] }],
]) {
  test(`label layout rejects ${name} before acquiring any backing allocation`, () => {
    const data = { ...admitPointsData({ positions: new Float32Array(3), mode: '3d' }), ...override };
    const tracker = trackedAccount();
    assert.throws(() => createPointsXrLabelLayout(data, resolveLyra3dStyle(), state(), {}, tracker.account), unsupported);
    assert.equal(tracker.attempts.length, 0); assert.equal(tracker.account.usedBytes, 0);
  });
}

test('a label allocation failure keeps its original cause while attempting every earlier release', () => {
  const tracker = trackedAccount(), allocate = tracker.account.allocate, release = tracker.account.release;
  const failure = new Error('allocation failed'), releases = []; let allocations = 0;
  tracker.account.allocate = bytes => { if (++allocations === 4) throw failure; return allocate(bytes); };
  tracker.account.release = buffer => { releases.push(buffer); release(buffer); throw new Error('release failed'); };
  assert.throws(() => work({}, {}, state(), tracker), error => error === failure);
  assert.equal(releases.length, 3); assert.equal(new Set(releases).size, 3);
  assert.equal(tracker.live.size, 0); assert.equal(tracker.account.usedBytes, 0);
});

test('multiple label finalization release failures preserve the first cause and revoke the output', () => {
  const tracker = trackedAccount(), release = tracker.account.release, first = new Error('first release failed');
  const context = work({}, {}, state(), tracker); numeric(context);
  groups(context, 'paint', group => context.owner.paintRun(group));
  let releases = 0;
  tracker.account.release = buffer => { release(buffer); throw ++releases === 1 ? first : new Error('later release failed'); };
  assert.throws(() => finishPointsXrLabelLayout(context.owner, context.identity), error => error === first);
  assert.equal(releases, 4); assert.equal(tracker.account.usedBytes, 0);
  assert.equal(context.owner.snapshot().phase, 'cancelled');
  assert.equal(context.owner.snapshot().sourceRetained, false);
  assert.throws(() => peekPointsXrLabelLayout(context.owner, context.identity), RangeError);
  cancelPointsXrLabelLayout(context.owner); assert.equal(releases, 4);
});
