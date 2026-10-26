import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultFunctions, LyraGenFunctionRegistry } from './functions.js';
test('named functions reject expressions, invalid locales, overflowing results and malformed arguments', () => {
  const functions = createDefaultFunctions();
  assert.deepEqual(functions.call({ name: 'sum', arguments: [2, 3], locale: 'en' }), { ok: true, value: 5, diagnostics: [] });
  assert.equal(functions.call({ name: 'sum', arguments: [Number.MAX_VALUE, Number.MAX_VALUE], locale: 'en' }).ok, false);
  assert.equal(functions.call({ name: 'sum', arguments: ['2'], locale: 'en' }).ok, false);
  assert.equal(functions.call({ name: 'sum', arguments: [2], locale: '../en' }).ok, false);
  assert.equal(functions.call({ name: 'sum(1,2)', arguments: [], locale: 'en' }).ok, false);
  const throwing = new LyraGenFunctionRegistry(new Map([['broken', { arguments: { type: 'null' as const }, result: { type: 'null' as const }, run: () => { throw new Error('Private detail'); } }]]));
  const result = throwing.call({ name: 'broken', arguments: null, locale: 'en' });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('Private detail'), false);
});
