import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotA2uiData } from './a2ui-state.js';

test('protocol snapshot preserves gaps and undefined while producing a separate JSON projection', () => {
  const input = { values: ['first', undefined, , 'last'], absent: undefined };
  const result = snapshotA2uiData(input); assert.equal(result.ok, true);
  if (!result.ok) return;
  const data = result.value.data as typeof input;
  assert.equal(Object.hasOwn(data.values, 1), true); assert.equal(Object.hasOwn(data.values, 2), false);
  assert.equal(data.values[1], undefined); assert.equal(Object.isFrozen(data.values), true);
  assert.deepEqual(result.value.json, { values: ['first', null, null, 'last'] });
  input.values[0] = 'mutated'; assert.equal(data.values[0], 'first');
});

test('protocol snapshot rejects unbounded state and accessor/prototype/cycle inputs', () => {
  let calls = 0;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { calls++; return undefined; } });
  const cycle: { self?: unknown } = {}; cycle.self = cycle;
  for (const input of [accessor, cycle, new Date(), NaN, JSON.parse('{"__proto__":{}}')]) assert.equal(snapshotA2uiData(input).ok, false);
  assert.equal(calls, 0);
  assert.equal(snapshotA2uiData(new Array(11), { maxArrayLength: 10 }).ok, false);
  assert.equal(snapshotA2uiData(new Array(11), { maxNodes: 10 }).ok, false);
  assert.equal(snapshotA2uiData({ long: 'a'.repeat(30) }, { maxBytes: 10 }).ok, false);
});
