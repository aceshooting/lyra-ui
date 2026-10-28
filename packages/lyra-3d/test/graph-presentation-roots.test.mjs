import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Object3D, Scene, Vector3 } from 'three';
import { createGraphPresentationRoots, createGraphPresentationSlots, prepareGraphPresentationSwap, commitGraphPresentationSwap } from '../dist/graph/presentation-roots.js';

const names = ['world', 'pick', 'overlay'];
function fixture() {
  const parents = { world: new Group(), pick: new Group(), overlay: new Scene() };
  parents.world.scale.y = -1; parents.pick.scale.y = -1;
  const slots = createGraphPresentationSlots(parents);
  return { parents, slots };
}
function current(slots, roots) {
  assert.equal(slots.current, roots);
  for (const name of names) {
    assert.equal(slots[name].children.length, roots ? 1 : 0);
    if (roots) { assert.equal(slots[name].children[0], roots[name]); assert.equal(roots[name].parent, slots[name]); }
  }
}

test('one stable set of wrappers atomically replaces render, pick and overlay roots without Three events', () => {
  const { parents, slots } = fixture(), first = createGraphPresentationRoots(), next = createGraphPresentationRoots();
  assert.equal(slots.current, null);
  for (const name of names) { assert.equal(slots[name].parent, parents[name]); assert.equal(slots[name].children.length, 0); }
  const stableWrappers = names.map(name => slots[name]);
  const firstSwap = prepareGraphPresentationSwap(slots, first);
  current(slots, null);
  assert.equal(commitGraphPresentationSwap(firstSwap), null);
  current(slots, first);
  let events = 0;
  for (const roots of [first, next, slots]) for (const name of names) for (const event of ['added', 'removed', 'childadded', 'childremoved']) {
    roots[name].addEventListener(event, () => { events++; });
  }
  const nextSwap = prepareGraphPresentationSwap(slots, next);
  current(slots, first);
  assert.equal(commitGraphPresentationSwap(nextSwap), first);
  current(slots, next);
  for (const name of names) assert.equal(first[name].parent, null);
  assert.deepEqual(names.map(name => slots[name]), stableWrappers);
  assert.equal(events, 0, 'commit invokes no added/removed notifications');
  assert.throws(() => commitGraphPresentationSwap(nextSwap), { name: 'InvalidStateError' });
});

test('world and pick retain exactly one inherited y inversion; overlays retain their own coordinates', () => {
  const { parents, slots } = fixture(), roots = createGraphPresentationRoots();
  commitGraphPresentationSwap(prepareGraphPresentationSwap(slots, roots));
  for (const name of names) {
    parents[name].updateMatrixWorld(true);
    const point = roots[name].localToWorld(new Vector3(2, 3, 4));
    assert.deepEqual(point.toArray(), name === 'overlay' ? [2, 3, 4] : [2, -3, 4]);
  }
});

test('prepared swaps refuse obsolete slot state and roots already owned by another slot', () => {
  const a = fixture(), b = fixture(), first = createGraphPresentationRoots(), second = createGraphPresentationRoots();
  const stale = prepareGraphPresentationSwap(a.slots, second);
  commitGraphPresentationSwap(prepareGraphPresentationSwap(a.slots, first));
  assert.throws(() => commitGraphPresentationSwap(stale), { name: 'InvalidStateError' });
  current(a.slots, first);
  assert.throws(() => prepareGraphPresentationSwap(b.slots, first), { name: 'InvalidStateError' });
  current(b.slots, null);
  assert.throws(() => prepareGraphPresentationSwap(a.slots, { world: new Group(), pick: new Group(), overlay: new Group() }), TypeError);
});

test('one candidate cannot be prepared twice, self-installed or reused after retirement', () => {
  const a = fixture(), b = fixture(), first = createGraphPresentationRoots(), second = createGraphPresentationRoots();
  const initial = prepareGraphPresentationSwap(a.slots, first);
  assert.throws(() => prepareGraphPresentationSwap(b.slots, first), { name: 'InvalidStateError' });
  commitGraphPresentationSwap(initial);
  assert.throws(() => prepareGraphPresentationSwap(a.slots, first), { name: 'InvalidStateError' });
  const pending = prepareGraphPresentationSwap(a.slots, second);
  const replacement = createGraphPresentationRoots();
  commitGraphPresentationSwap(prepareGraphPresentationSwap(a.slots, replacement));
  assert.throws(() => prepareGraphPresentationSwap(a.slots, first), { name: 'InvalidStateError' });
  assert.throws(() => commitGraphPresentationSwap(pending), { name: 'InvalidStateError' });
  assert.throws(() => prepareGraphPresentationSwap(b.slots, second), { name: 'InvalidStateError' });
  current(a.slots, replacement); current(b.slots, null);
});

test('each first-install failure restores empty wrappers and leaves no attached candidate', () => {
  for (let failAfterWrite = 1; failAfterWrite <= 10; failAfterWrite++) {
    const { slots } = fixture(), next = createGraphPresentationRoots();
    for (const name of names) next[name].matrixWorldNeedsUpdate = false;
    const children = names.map(name => slots[name].children);
    const swap = prepareGraphPresentationSwap(slots, next);
    assert.throws(() => commitGraphPresentationSwap(swap, failAfterWrite), { name: 'OperationError' });
    current(slots, null);
    for (const [index, name] of names.entries()) {
      assert.equal(slots[name].children, children[index]); assert.equal(next[name].parent, null);
      assert.equal(next[name].matrixWorldNeedsUpdate, false);
    }
    assert.throws(() => commitGraphPresentationSwap(swap), { name: 'InvalidStateError' });
  }
});

test('in-place wrapper edits and accessor substitutions refuse before any root changes or callbacks', () => {
  for (const initiallyEmpty of [false, true]) {
    const { slots } = fixture(), first = createGraphPresentationRoots(), next = createGraphPresentationRoots();
    if (!initiallyEmpty) commitGraphPresentationSwap(prepareGraphPresentationSwap(slots, first));
    const prepared = prepareGraphPresentationSwap(slots, next), intruder = new Object3D();
    slots.pick.add(intruder);
    assert.throws(() => commitGraphPresentationSwap(prepared), { name: 'InvalidStateError' });
    assert.equal(slots.current, initiallyEmpty ? null : first);
    assert.equal(intruder.parent, slots.pick); assert.equal(slots.pick.children.at(-1), intruder);
    for (const name of names) assert.equal(next[name].parent, null);
  }
  for (const property of ['parent', 'matrixWorldNeedsUpdate']) {
    const { slots } = fixture(), next = createGraphPresentationRoots(), prepared = prepareGraphPresentationSwap(slots, next);
    let calls = 0;
    Object.defineProperty(next.world, property, { configurable: true, get() { calls++; return null; }, set() { calls++; } });
    assert.throws(() => commitGraphPresentationSwap(prepared), { name: 'InvalidStateError' });
    assert.equal(calls, 0); current(slots, null);
  }
});

test('invalid internal fault indices do not consume a valid prepared swap', () => {
  const { slots } = fixture(), next = createGraphPresentationRoots(), prepared = prepareGraphPresentationSwap(slots, next);
  for (const value of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => commitGraphPresentationSwap(prepared, value), RangeError);
  assert.equal(commitGraphPresentationSwap(prepared), null); current(slots, next);
});

test('every bounded swap failure restores old roots, parent links, dirty flags and current owner', () => {
  // Internal numeric fault injection performs no application callback in the swap barrier.
  for (let failAfterWrite = 1; failAfterWrite <= 13; failAfterWrite++) {
    const { slots } = fixture(), first = createGraphPresentationRoots(), next = createGraphPresentationRoots();
    commitGraphPresentationSwap(prepareGraphPresentationSwap(slots, first));
    for (const name of names) next[name].matrixWorldNeedsUpdate = false;
    const prepared = prepareGraphPresentationSwap(slots, next);
    const oldChildren = names.map(name => slots[name].children);
    assert.throws(() => commitGraphPresentationSwap(prepared, failAfterWrite), { name: 'OperationError' });
    current(slots, first);
    for (const [index, name] of names.entries()) {
      assert.equal(slots[name].children, oldChildren[index], 'rollback restores preowned child arrays');
      assert.equal(next[name].parent, null);
      assert.equal(next[name].matrixWorldNeedsUpdate, false);
    }
    assert.throws(() => commitGraphPresentationSwap(prepared), { name: 'InvalidStateError' });
  }
});

test('root swaps do not traverse or notify descendants at 1 and 100000 scene objects', () => {
  for (const count of [1, 100000]) {
    const { slots } = fixture(), first = createGraphPresentationRoots(), next = createGraphPresentationRoots();
    for (let row = 0; row < count; row++) next.world.add(new Object3D());
    commitGraphPresentationSwap(prepareGraphPresentationSwap(slots, first));
    const prepared = prepareGraphPresentationSwap(slots, next);
    let descendantReads = 0;
    const guarded = [first, next].flatMap(roots => names.map(name => ({ root: roots[name], children: roots[name].children })));
    for (const { root } of guarded) Object.defineProperty(root, 'children', { configurable: true, get() { descendantReads++; throw new Error('Unexpected descendant traversal'); } });
    try {
      // There are exactly 13 owned link/flag/owner writes with an existing scene; point14 is unreachable.
      assert.equal(commitGraphPresentationSwap(prepared, 14), first);
      current(slots, next);
      assert.equal(descendantReads, 0);
    } finally { for (const { root, children } of guarded) Object.defineProperty(root, 'children', { configurable: true, writable: true, value: children }); }
  }
});
