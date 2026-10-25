import assert from 'node:assert/strict';
import test from 'node:test';
import { changedVisualRows, snapshotVisualState } from '../dist/core/visual-state.js';
import { state } from './performance-fixture.mjs';

test('owned snapshots distinguish paint membership from label selection order', () => {
  const selected = new Set([1, 2]);
  const first = snapshotVisualState(state({ selected, hover: 3 }), state(), 10);
  selected.clear();
  assert.deepEqual([...first.state.selected], [1, 2]);
  const identical = snapshotVisualState(state({ selected: new Set([1, 2]), hover: 3 }), first.state, 10);
  assert.equal(identical.changed, false); assert.equal(identical.state, first.state);
  const reordered = snapshotVisualState(state({ selected: new Set([2, 1]), hover: 3 }), first.state, 10);
  assert.equal(reordered.changed, true); assert.deepEqual(reordered.rows, []);
  assert.deepEqual([...reordered.state.selected], [2, 1]);
});

test('paint deltas include old and new hover/focus plus membership differences once', () => {
  const previous = state({ hover: 1, focus: 2, selected: new Set([3, 4]), dimmed: new Set([5]) });
  const next = state({ hover: 2, focus: 6, selected: new Set([4, 7]), dimmed: new Set([8, 100]) });
  assert.deepEqual(changedVisualRows(previous, next, 10).sort((a, b) => a - b), [1, 2, 3, 5, 6, 7, 8]);
  const owned = snapshotVisualState(next, previous, 10);
  assert.equal(owned.state.dimmed.has(100), true, 'out-of-range values remain owned for a later data replacement');
});

test('dimmed insertion order does not change an owned visual state', () => {
  const previous = state({ dimmed: new Set([1, 2]) });
  const reordered = snapshotVisualState(state({ dimmed: new Set([2, 1]) }), previous, 10);
  assert.equal(reordered.changed, false);
  assert.equal(reordered.state, previous);
  assert.deepEqual(reordered.rows, []);
});

test('dense row markers require complete valid membership and preserve owned values', () => {
  const selected = new Set([NaN, -1, 0, 1, 2, 3, 4, 5.5, 100]);
  const owned = snapshotVisualState(state({ selected }), state(), 5);
  assert.equal(owned.rows, null, 'null marks every logical paint row without a materialized row list');
  selected.clear();
  assert.equal(owned.state.selected.size, 9);
  assert.equal(owned.state.selected.has(100), true);
  assert.equal(changedVisualRows(owned.state, state(), 5), null);
  const incomplete = snapshotVisualState(state({ selected: new Set([0, 1, 2, 3, 100]) }), state(), 5);
  assert.deepEqual(incomplete.rows, [0, 1, 2, 3], 'set size alone does not prove row coverage');
  assert.deepEqual(snapshotVisualState(state({ selected: new Set([0, 100]) }), state(), 0).rows, []);
  assert.deepEqual(snapshotVisualState(state(), state(), 0).rows, []);
});

test('dense selected and dimmed snapshots keep later sparse and order-only changes narrow', () => {
  const all = new Set([0, 1, 2, 3, 4]);
  const previous = state({ selected: all });
  const sparse = snapshotVisualState(state({ selected: new Set([0, 1, 2, 3]) }), previous, 5);
  assert.deepEqual(sparse.rows, [4]);
  const reordered = snapshotVisualState(state({ selected: new Set([4, 3, 2, 1, 0]) }), previous, 5);
  assert.equal(reordered.changed, true); assert.deepEqual(reordered.rows, []);
  const dimmed = snapshotVisualState(state({ dimmed: all }), state(), 5);
  assert.equal(dimmed.rows, null);
  all.clear(); assert.equal(dimmed.state.dimmed.size, 5);
  assert.equal(changedVisualRows(dimmed.state, state(), 5), null);
});
