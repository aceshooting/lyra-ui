import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LIMITS, HARD_LIMITS, parseJson, resolveLimits, snapshotJson, validateSchema } from './schema.js';
import type { LyraGenSchema } from './types.js';

test('owns and freezes admitted data without invoking getters or serialization hooks', () => {
  const input = { rows: [{ value: 3 }] };
  const result = snapshotJson(input);
  assert.equal(result.ok, true);
  input.rows[0]!.value = 7;
  if (result.ok) {
    assert.deepEqual(result.value, { rows: [{ value: 3 }] });
    assert.equal(Object.isFrozen(result.value), true);
  }
  let calls = 0;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { calls++; return 1; } });
  assert.equal(snapshotJson(accessor).ok, false);
  assert.equal(snapshotJson({ toJSON() { calls++; return {}; } }).ok, false);
  assert.equal(calls, 0);
});

test('rejects dangerous keys, cycles, sparse arrays, symbols and non-JSON values', () => {
  const cycle: Record<string, unknown> = {};
  cycle['self'] = cycle;
  const symbol = { [Symbol('secret')]: 1 };
  for (const value of [cycle, symbol, new Date(), NaN, Infinity, undefined, 1n, new Array(2), { constructor: 1 }, JSON.parse('{"__proto__":1}')]) {
    assert.equal(snapshotJson(value).ok, false);
  }
  const hidden = Object.defineProperty({}, 'secret', { value: 1 });
  assert.equal(snapshotJson(hidden).ok, false);
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.equal(snapshotJson(revoked.proxy).ok, false);
});

test('allows repeated plain references while rejecting circular ancestry', () => {
  const shared = { value: 1 };
  assert.equal(snapshotJson([shared, shared]).ok, true);
});

test('accounts exact serialized UTF-8 size including escaping and surrogate pairs', () => {
  for (const value of ['😀', '\ud800', '\n', 'é', { a: '😀' }, [true, false, null, -0, 1.2]]) {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    assert.equal(snapshotJson(value, { maxBytes: bytes }).ok, true);
    assert.equal(snapshotJson(value, { maxBytes: bytes - 1 }).ok, false);
  }
});

test('enforces every structural budget and immutable hard ceilings', () => {
  assert.equal(snapshotJson({ a: { b: 1 } }, { maxDepth: 1 }).ok, false);
  assert.equal(snapshotJson([1, 2], { maxNodes: 2 }).ok, false);
  assert.equal(snapshotJson('ab', { maxStringLength: 1 }).ok, false);
  assert.equal(snapshotJson([1, 2], { maxArrayLength: 1 }).ok, false);
  assert.equal(snapshotJson({ a: 1, b: 2 }, { maxObjectKeys: 1 }).ok, false);
  assert.equal(resolveLimits({ maxBytes: Number.MAX_SAFE_INTEGER }).maxBytes, HARD_LIMITS.maxBytes);
  assert.equal(resolveLimits({ maxBytes: Infinity }).maxBytes, DEFAULT_LIMITS.maxBytes);
  assert.equal(resolveLimits({ maxBytes: -1 }).maxBytes, DEFAULT_LIMITS.maxBytes);
  assert.equal(Object.isFrozen(resolveLimits()), true);
});

test('JSON parsing rejects duplicate decoded keys, malformed and excessively deep inputs', () => {
  for (const source of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"nested":{"a":1,"a":2}}', '{', '[1,]', '{"__proto__":{}}']) {
    assert.equal(parseJson(source).ok, false);
  }
  assert.equal(parseJson('{"a":{"x":1},"b":{"x":2},"string":"{ \\"x\\": ["}').ok, true);
  assert.equal(parseJson('[[[1]]]', { maxDepth: 1 }).ok, false);
  assert.equal(parseJson('"😀"', { maxBytes: 5 }).ok, false);
});

test('schemas enforce required fields, unknown-property rejection and escaped diagnostic paths', () => {
  const schema: LyraGenSchema = { type: 'object', properties: { 'a/b': { type: 'number', minimum: 0 }, optional: { type: 'boolean' } }, required: ['a/b'] };
  assert.equal(validateSchema({ 'a/b': 3 }, schema).ok, true);
  const result = validateSchema({ 'a/b': -1, extra: 1 }, schema);
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.map(item => item.path), ['/a~1b', '/extra']);
  assert.equal(validateSchema({}, schema).ok, false);
  assert.equal(validateSchema({ 'a/b': '3' }, schema).ok, false);
});

test('schemas validate nested arrays, enum, unions, bounds, integers and null without coercion', () => {
  const schema: LyraGenSchema = { type: 'array', minItems: 1, maxItems: 3, items: { anyOf: [{ type: 'integer', minimum: 0, maximum: 5 }, { type: 'string', minLength: 1, maxLength: 4, enum: ['yes', 'no'] }, { type: 'null' }] } };
  assert.equal(validateSchema([2, 'yes', null], schema).ok, true);
  for (const value of [[], [1, 2, 3, 4], [1.5], ['YES'], [true], [6]]) assert.equal(validateSchema(value, schema).ok, false);
  const limited = validateSchema([false, false], schema, { maxDiagnostics: 1 });
  assert.equal(limited.ok, false);
  assert.equal(limited.diagnostics.length, 1);
});

test('unsupported or malformed schemas reject rather than weakening validation', () => {
  for (const schema of [{ type: 'unknown' }, { type: 'string', pattern: '.*' }, { type: 'object', properties: {}, additionalProperties: true }, { anyOf: [] }, { type: 'number', minimum: 3, maximum: 2 }, { type: 'array' }, { type: 'object', properties: {}, required: ['missing'] }]) {
    const result = validateSchema(null, schema as unknown as LyraGenSchema);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0]?.code, 'schema.invalid');
  }
});

test('later valid union branches discard failed-branch diagnostics', () => {
  const schema: LyraGenSchema = { anyOf: [{ type: 'string' }, { type: 'null' }] };
  const result = validateSchema(null, schema, { maxNodes: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.length, 0);
  assert.equal(validateSchema('😀', { type: 'string', minLength: 1, maxLength: 1 }).ok, true);
});

test('union validation stops before a later valid branch when its work ceiling is exhausted', () => {
  const rejecting: LyraGenSchema = { type: 'array', items: { type: 'number', maximum: 0 } };
  const schema: LyraGenSchema = {
    anyOf: [...Array.from({ length: 15 }, () => rejecting), { type: 'array', items: { type: 'number' } }]
  };
  const result = validateSchema(Array.from({ length: 20 }, () => 1), schema, { maxNodes: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0]?.code, 'limit.validation');
});
