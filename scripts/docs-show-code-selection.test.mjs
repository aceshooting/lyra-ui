import assert from 'node:assert/strict';
import test from 'node:test';
import { parseShowCodeSelectionOptions, selectShowCodeDocs } from './docs-show-code-selection.mjs';

const docs = ['z', 'a', 'm', 'b', 'q'].map(id => ({ id, title: id, importPath: `${id}.stories.ts` }));
const ids = selection => selection.selected.map(doc => doc.id);

test('Show Code shards cover each docs entry once, independent of index insertion order', () => {
  const first = selectShowCodeDocs(docs, { shardIndex: '1', shardTotal: '2' });
  const second = selectShowCodeDocs([...docs].reverse(), { shardIndex: '2', shardTotal: '2' });
  assert.deepEqual(ids(first), ['a', 'm', 'z']);
  assert.deepEqual(ids(second), ['b', 'q']);
  assert.deepEqual(first.inventoryIds, second.inventoryIds);
  assert.deepEqual([...ids(first), ...ids(second)].sort(), docs.map(doc => doc.id).sort());
  assert.equal(new Set([...ids(first), ...ids(second)]).size, docs.length);
  assert.deepEqual(first.shard, { index: 1, total: 2 });
  assert.equal(first.range, null);
  assert.deepEqual(docs.map(doc => doc.id), ['z', 'a', 'm', 'b', 'q'], 'selection does not sort the input in place');
});

test('an unsharded Show Code run is complete and manual ranges retain index order', () => {
  assert.deepEqual(ids(selectShowCodeDocs(docs)), ['z', 'a', 'm', 'b', 'q']);
  const sliced = selectShowCodeDocs(docs, { start: '1', end: '3' });
  assert.deepEqual(ids(sliced), ['a', 'm', 'b']);
  assert.deepEqual(sliced.range, [1, 3]);
  assert.equal(sliced.shard, null);
  assert.deepEqual(ids(selectShowCodeDocs(docs, { start: '3' })), ['b', 'q']);
  assert.deepEqual(ids(selectShowCodeDocs(docs, { end: '0' })), ['z']);
});

test('Show Code rejects malformed, incomplete or conflicting coordinates', () => {
  for (const value of ['', ' ', '1.5', 'NaN', 'Infinity', '01', '+1', '-1', '1e0', '0x1', '9007199254740992', NaN, Infinity, 1.5, null, true]) {
    assert.throws(() => parseShowCodeSelectionOptions({ shardIndex: value, shardTotal: '2' }), /integer/u, String(value));
    assert.throws(() => parseShowCodeSelectionOptions({ shardIndex: '1', shardTotal: value }), /integer/u, String(value));
    assert.throws(() => parseShowCodeSelectionOptions({ start: value }), /integer/u, String(value));
    assert.throws(() => parseShowCodeSelectionOptions({ end: value }), /integer/u, String(value));
  }
  for (const options of [{ shardIndex: '1' }, { shardTotal: '2' }]) {
    assert.throws(() => parseShowCodeSelectionOptions(options), /together/u);
  }
  for (const options of [{ shardIndex: '0', shardTotal: '2' }, { shardIndex: '1', shardTotal: '0' }]) {
    assert.throws(() => parseShowCodeSelectionOptions(options), /integer/u);
  }
  assert.throws(() => parseShowCodeSelectionOptions({ shardIndex: '3', shardTotal: '2' }), /exceed/u);
  assert.throws(() => parseShowCodeSelectionOptions({ start: '3', end: '1' }), /before/u);
  for (const range of [{ start: '0' }, { end: '1' }, { start: '0', end: '1' }]) {
    assert.throws(() => parseShowCodeSelectionOptions({ shardIndex: '1', shardTotal: '2', ...range }), /combined/u);
  }
});

test('Show Code rejects inventories and ranges that could silently skip coverage', () => {
  assert.throws(() => selectShowCodeDocs([]), /empty/u);
  assert.throws(() => selectShowCodeDocs([docs[0], docs[0]]), /Duplicate/u);
  assert.throws(() => selectShowCodeDocs([docs[0], docs[0]], { start: '0', end: '0' }), /Duplicate/u);
  for (const doc of [null, {}, { id: '' }, { id: 1 }]) {
    assert.throws(() => selectShowCodeDocs([doc]), /nonempty string/u);
  }
  assert.throws(() => selectShowCodeDocs(docs, { start: '5' }), /outside/u);
  assert.throws(() => selectShowCodeDocs(docs, { end: '5' }), /outside/u);
  assert.throws(() => selectShowCodeDocs(docs, { shardIndex: '1', shardTotal: '6' }), /empty shard/u);
  assert.throws(() => selectShowCodeDocs(docs, { shardIndex: '6', shardTotal: '6' }), /empty shard/u);
});
