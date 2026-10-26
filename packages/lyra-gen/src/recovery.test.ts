import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeJsonView } from './recovery.js';
import { parseJson } from './schema.js';
import { parseMarkup } from './parser.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = { id: 'test', version: '1', components: {
  row: { tag: 'div', children: true, properties: {} },
  text: { tag: 'p', text: true, properties: {} },
  field: { tag: 'input', properties: { value: { type: 'string' }, enabled: { type: 'boolean' }, size: { type: 'string', enum: ['small', 'large'] } } }
} };
const view: LyraGenView = { version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'text', text: 'Literal } [ <tag> text' } };
const source = JSON.stringify(view);
const optIn = { policy: 'close-envelope-eof' as const };

test('strict default rejects missing delimiters; one explicit EOF envelope brace preserves every value', () => {
  const truncated = source.slice(0, -1);
  assert.equal(parseJson(truncated).ok, false);
  assert.equal(completeJsonView(truncated, catalog).ok, false);
  const completed = completeJsonView(truncated, catalog, optIn);
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.value.source, source);
  assert.equal(completed.value.completion, 'closed-envelope');
  assert.deepEqual(completed.value.view, view);
  assert.equal(Object.isFrozen(completed.value.view.root), true);
  assert.equal(completed.diagnostics[0]?.code, 'recovery.envelope-closed');
  assert.deepEqual(completed.diagnostics[0]?.source, { start: truncated.length, end: truncated.length });
  const strict = completeJsonView(source, catalog, optIn);
  assert.equal(strict.ok, true);
  if (strict.ok) assert.equal(strict.value.completion, 'none');
});

test('only a final top-level brace after an already completed container is eligible', () => {
  for (let end = 0; end < source.length - 1; end++) assert.equal(completeJsonView(source.slice(0, end), catalog, optIn).ok, false, `Unexpected completion at ${end}`);
  for (const text of [source + '}', source + ',', source.slice(0, -2), '{"root":', '{"root":null', '{"revision":0', '{"revision":true'.slice(0, -1), '{"root":{"id":"unfinished', '[{}', source.slice(0, -1) + ',', '<text id="x">Hello', '<text id="x">Hello</text']) {
    assert.equal(completeJsonView(text, catalog, optIn).ok, false);
  }
  assert.equal(parseMarkup('<text id="x">Hello', { catalog, surfaceId: 'surface', revision: 0 }).status, 'incomplete');
  const trailing = completeJsonView(source.slice(0, -1) + '\n ', catalog, optIn);
  assert.equal(trailing.ok, true);
  if (trailing.ok) assert.equal(trailing.value.source, source.slice(0, -1) + '\n }');
});

test('completion never coerces properties, guesses enum values, creates members or renames identities', () => {
  const bad = [
    { ...view, root: { id: 'root', type: 'field', props: { value: 1 } } },
    { ...view, root: { id: 'root', type: 'field', props: { enabled: 'true' } } },
    { ...view, root: { id: 'root', type: 'field', props: { size: 'small'.slice(0, -1) } } },
    { ...view, root: { type: 'text', text: 'Missing id' } },
    { ...view, root: { id: 'root', type: 'row', children: [{ id: 'same', type: 'text' }, { id: 'same', type: 'text' }] } },
    { ...view, root: { id: 'root', type: 'unknown' } },
    { ...view, catalog: { id: 'test', version: 'wrong' } },
    { ...view, root: { id: 'root', type: 'text', action: { name: 'unapproved' } } }
  ];
  for (const value of bad) {
    assert.equal(completeJsonView(JSON.stringify(value), catalog, optIn).ok, false);
    assert.equal(completeJsonView(JSON.stringify(value).slice(0, -1), catalog, optIn).ok, false);
  }
});

test('duplicate keys, prototype keys and original or completed byte/depth budgets reject their boundary', () => {
  for (const text of [source.replace('"revision":0', '"revision":1,"revision":0').slice(0, -1), source.replace('"revision":0', '"__proto__":{},"revision":0').slice(0, -1)]) {
    const result = completeJsonView(text, catalog, optIn);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics.some(item => ['json.duplicate-key', 'json.key'].includes(item.code)), true);
  }
  for (const limits of [{ maxBytes: source.length - 2 }, { maxBytes: source.length - 1 }, { maxDepth: 1 }, { maxNodes: 3 }]) {
    const result = completeJsonView(source.slice(0, -1), catalog, { ...optIn, limits });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics.some(item => item.code.startsWith('limit.')), true);
  }
});
