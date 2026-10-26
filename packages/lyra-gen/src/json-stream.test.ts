import assert from 'node:assert/strict';
import test from 'node:test';
import { createJsonViewStream, parseJsonView } from './json-stream.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = { id: 'json-test', version: '1', components: { text: { tag: 'p', properties: {}, text: true } } };
const document = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'text', text: 'Hello 😀 "reader"\n' } };
const source = JSON.stringify(document);

test('every chunk split matches batch views, accounting and diagnostics', () => {
  for (const input of [source, source.replace('"revision":0', '"revision":0,"revision":1'), source.slice(0, -1), source + '{}', source.replace('Hello', '\u0001')]) {
    const batch = parseJsonView(input, { catalog });
    for (let index = 0; index <= input.length; index++) {
      const stream = createJsonViewStream({ catalog });
      stream.push(input.slice(0, index));
      stream.push(input.slice(index));
      assert.deepEqual(stream.finish(), batch);
    }
  }
});

test('complete-looking chunks expose no view before explicit validation at finish', () => {
  const stream = createJsonViewStream({ catalog });
  for (const character of source) {
    const partial = stream.push(character);
    assert.equal(partial.status, 'incomplete');
    assert.equal(partial.view, undefined);
  }
  const result = stream.finish();
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.view, document);
  assert.equal(result.receivedCodeUnits, source.length);
  assert.equal(result.receivedBytes, new TextEncoder().encode(source).byteLength);
  assert.equal(stream.finish(), result);
  assert.equal(stream.push('malformed late completion'), result);
});

test('split raw surrogate pairs have the same byte budget as whole input', () => {
  const bytes = new TextEncoder().encode(source).byteLength;
  const pair = source.indexOf('😀');
  const stream = createJsonViewStream({ catalog, limits: { maxBytes: bytes } });
  stream.push(source.slice(0, pair + 1));
  stream.push(source.slice(pair + 1));
  assert.equal(stream.finish().status, 'complete');
  assert.equal(parseJsonView(source, { catalog, limits: { maxBytes: bytes - 1 } }).status, 'error');
});

test('grammar, decoded duplicates, security and source resource limits fail closed', () => {
  for (const input of ['{"a":1,"\\u0061":2}', '{"__proto__":0}', '[1,]', '{"x":}', '{"x" 1}', '{"x":01}', '{"x":truefalse}', '{"x":1e999}', '{"x":"\\x"}', '{"x":"\\uGGGG"}', '{"x":"\n"}', '{"x":1} false']) {
    const result = parseJsonView(input, { catalog });
    assert.equal(result.status, 'error');
    assert.equal(result.view, undefined);
    assert.ok(result.diagnostics[0]?.source);
  }
  assert.equal(parseJsonView('[[[[]]]]', { catalog, limits: { maxDepth: 1 } }).diagnostics[0]?.code, 'limit.depth');
  assert.equal(parseJsonView('[1,2]', { catalog, limits: { maxArrayLength: 1 } }).diagnostics[0]?.code, 'limit.array');
  assert.equal(parseJsonView('{"a":1,"b":2}', { catalog, limits: { maxObjectKeys: 1 } }).diagnostics[0]?.code, 'limit.keys');
  assert.equal(parseJsonView('[1,2]', { catalog, limits: { maxNodes: 2 } }).diagnostics[0]?.code, 'limit.nodes');
  assert.equal(parseJsonView('"long"', { catalog, limits: { maxStringLength: 2 } }).diagnostics[0]?.code, 'limit.string');
});

test('truncation and cancellation cannot activate a previously valid prefix', () => {
  for (const input of ['', ' ', '{', '"text', '[true', '[1e', '{"x":']) {
    assert.equal(parseJsonView(input, { catalog }).status, 'error');
  }
  const stream = createJsonViewStream({ catalog });
  stream.push(source);
  const cancelled = stream.cancel();
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.view, undefined);
  assert.equal(stream.finish(), cancelled);
  assert.equal(stream.push(source), cancelled);
});

test('a syntactically valid JSON document still needs active catalog and view validation', () => {
  assert.equal(parseJsonView('{}', { catalog }).status, 'error');
  assert.equal(parseJsonView(source.replace('"text"', '"unknown"'), { catalog }).status, 'error');
  assert.equal(parseJsonView(source.replace('json-test', 'another-catalog'), { catalog }).status, 'error');
});
