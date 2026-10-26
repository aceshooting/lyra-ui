import assert from 'node:assert/strict';
import test from 'node:test';
import { createTypedCatalog, typedAction } from './typed-catalog.js';

const catalog = () => createTypedCatalog({ id: 'typed', version: '1', components: { text: { tag: 'p', properties: {}, text: true } }, actions: {
  save: { payload: { type: 'object', properties: { title: { type: 'string', minLength: 1, maxLength: 20 }, count: { type: 'integer', minimum: 0, maximum: 10 } }, required: ['title'], additionalProperties: false } },
} }, { type: 'object', properties: { query: { type: 'string', maxLength: 10 } }, required: ['query'], additionalProperties: false });

test('typed actions retain declared names and return owned validated JSON payloads', () => {
  const typed = catalog();
  const payload = { title: 'Report', count: 3 };
  const result = typedAction(typed, 'save', payload);
  assert.ok(result.ok);
  payload.title = 'Changed';
  assert.equal(result.value.name, 'save');
  assert.equal(result.value.payload.title, 'Report');
  assert.ok(Object.isFrozen(result.value.payload));
});

test('runtime validation still enforces bounds and rejects malformed untyped callers', () => {
  const typed = catalog();
  assert.equal(typed.action('save', { title: '', count: 30 }).ok, false);
  const missing = Reflect.apply(typed.action, undefined, ['missing', null]);
  assert.equal(missing.ok, false);
  const malformed = Reflect.apply(typed.action, undefined, ['save', { title: 'Report', executable: true }]);
  assert.equal(malformed.ok, false);
  assert.equal(typed.parseState({ query: 'longer than ten' }).ok, false);
  assert.equal(typed.parseState({ query: 'hello' }).ok, true);
  assert.equal(createTypedCatalog({ id: 'empty-state', version: '1', components: { text: { tag: 'p', properties: {} } } }).parseState(null).ok, true);
});
