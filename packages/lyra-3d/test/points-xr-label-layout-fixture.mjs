import assert from 'node:assert/strict';
import { admitPointsData } from '../dist/points/data.js';
import { resolveLyra3dStyle } from '../dist/core/style.js';
import { Lyra3dXrError } from '../dist/xr/types.js';
import {
  createPointsXrAllocationAccount, createPointsXrLabelLayout,
  peekPointsXrLabelLayout, finishPointsXrLabelLayout, cancelPointsXrLabelLayout,
} from '../dist/points/xr-label-layout.js';

export const unsupported = error => error instanceof Lyra3dXrError && error.code === 'unsupported-scene';
export const state = dimmed => ({ selected: new Set(), dimmed: new Set(dimmed), hover: -1, focus: -1 });
export const smallMetrics = () => ({ left: 0, right: 4, ascent: 2, descent: 2 });
export const near = (actual, expected, epsilon = 1e-12) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);

export function trackedAccount() {
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

export function work(input = {}, styleValues = {}, visualState = state(), tracker = trackedAccount()) {
  const data = admitPointsData({ positions: new Float32Array([0, 0, 0]), labels: ['label'], ...input });
  const style = resolveLyra3dStyle(styleValues), identity = Object.freeze({});
  const owner = createPointsXrLabelLayout(data, style, visualState, identity, tracker.account);
  return { data, style, identity, owner, ...tracker };
}

export function checkStep(result, limit) {
  assert.equal(Number.isInteger(result.operations), true);
  assert.ok(result.operations >= 0 && result.operations <= limit);
}

export function drain(run, limit = 2048) {
  let calls = 0, operations = 0;
  for (;;) {
    assert.ok(++calls <= 1000000, 'bounded work must eventually finish');
    const result = run(limit); checkStep(result, limit); operations += result.operations;
    assert.equal(typeof result.done, 'boolean');
    if (result.done) return { calls, operations };
  }
}

export function groups(context, pass, visit = () => {}, limit = 2048) {
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

export function takeGroup(context) {
  for (let calls = 0; calls < 100000; calls++) {
    const result = context.owner.nextGroup(1); checkStep(result, 1);
    if (result.kind === 'group') return result.group;
    assert.equal(result.kind, 'yield', 'expected an unconsumed group');
  }
  assert.fail('group was never produced');
}

export function measured(context, metrics = smallMetrics, limit = 2048) {
  drain(value => context.owner.stepIndex(value), limit);
  groups(context, 'fonts', undefined, limit);
  groups(context, 'readiness', undefined, limit);
  groups(context, 'measure', (group, text) => context.owner.acceptMetrics(group, metrics(text)), limit);
}

export function numeric(context, metrics = smallMetrics, limit = 2048) {
  measured(context, metrics, limit);
  drain(value => context.owner.stepPack(value), limit);
  drain(value => context.owner.stepFill(value), limit);
  return peekPointsXrLabelLayout(context.owner, context.identity);
}

export function finish(context, visit = () => {}, limit = 2048) {
  groups(context, 'paint', (group, text) => visit(context.owner.paintRun(group), text), limit);
  return finishPointsXrLabelLayout(context.owner, context.identity);
}

export function cleanup(context) {
  cancelPointsXrLabelLayout(context.owner);
  for (const buffer of [...context.live]) context.account.release(buffer);
  assert.equal(context.account.usedBytes, 0);
}

