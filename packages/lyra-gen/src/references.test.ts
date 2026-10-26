import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePointer, readPointer, resolveReferences } from './references.js';

test('pointers decode escapes, own keys and canonical array indices only', () => {
  assert.deepEqual(readPointer({ 'a/b': { '~key': [4] } }, '/a~1b/~0key/0'), { ok: true, value: 4, diagnostics: [] });
  for (const pointer of ['/constructor', '/__proto__/x', '/x~2', 'x']) assert.equal(parsePointer(pointer).ok, false);
  assert.equal(readPointer([4], '/00').ok, false);
  assert.equal(readPointer({}, '/missing').ok, false);
});
test('references use host maps, enforce freshness and budgets, and never interpret returned data', () => {
  const context = { data: new Map([['sales', { value: { rows: [1, 2], nested: { $ref: '@tool:secret' } }, revision: 2 }]]) };
  assert.deepEqual(resolveReferences({ value: { $ref: '@data:sales#/rows' } }, context), { ok: true, value: { value: [1, 2] }, diagnostics: [] });
  assert.equal(resolveReferences({ $ref: 'https://example.invalid' }, context).ok, false);
  assert.equal(resolveReferences({ $ref: '@tool:secret' }, context).ok, false);
  assert.equal(resolveReferences({ $ref: '@data:sales' }, { ...context, expectedRevisions: new Map([['@data:sales', 3]]) }).ok, false);
  assert.equal(resolveReferences({ $ref: '@data:sales' }, { ...context, limits: { maxArrayLength: 1 } }).ok, false);
  assert.deepEqual(resolveReferences({ $ref: '@data:sales#/nested' }, context), { ok: true, value: { $ref: '@tool:secret' }, diagnostics: [] });
  assert.equal(resolveReferences(Array.from({ length: 10 }, () => ({ $ref: '@data:item' })), { data: new Map([['item', { value: 'x'.repeat(100) }]]), limits: { maxBytes: 500 } }).ok, false);
});
