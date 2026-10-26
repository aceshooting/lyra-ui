import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emitMarkup, escapeMarkupText } from './authoring.js';
import { parseMarkup } from './parser.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = { id: 'authoring', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true, slots: ['', 'label'] },
  text: { tag: 'p', properties: {}, text: true },
  input: { tag: 'lr-input', properties: { value: { type: 'string' }, disabled: { type: 'boolean' } }, bindings: { value: { event: 'lr-input', property: 'value' } } },
  button: { tag: 'lr-button', properties: {}, text: true, events: ['click'] }
}, actions: { save: { payload: { type: 'object', properties: {}, additionalProperties: false } } } };
const view = (root: LyraGenNode): LyraGenView => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 1, root });
const parse = (source: string) => parseMarkup(source, { catalog, surfaceId: 'surface', revision: 1, allowedTags: Object.keys(catalog.components) });
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

test('hostile text escapes exactly and roundtrips as text', () => {
  const input = view({ id: 't', type: 'text', text: '</text><script>alert("x")</script> & \'🚀\'' });
  const result = emitMarkup(input, catalog);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!result.value.includes('<script>'));
  assert.ok(result.value.includes('&lt;script&gt;'));
  assert.deepEqual(plain(parse(result.value).view), input);
});
test('JSON attribute data cannot terminate attributes or introduce actions', () => {
  const input = view({ id: 'i', type: 'input', props: { value: '"/><button id="evil" action={{"name":"erase"}}/>', disabled: false }, bindings: { value: '/name' } });
  const result = emitMarkup(input, catalog);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!result.value.includes('<button'));
  assert.deepEqual(plain(parse(result.value).view), input);
  assert.equal(parse(result.value).view?.root.action, undefined);
});
test('emission ordering is stable across object insertion orders', () => {
  const first = emitMarkup(view({ id: 'i', type: 'input', props: { value: 'x', disabled: false } }), catalog);
  const second = emitMarkup(view({ id: 'i', type: 'input', props: { disabled: false, value: 'x' } }), catalog);
  assert.deepEqual(first, second);
});
test('explicit host actions survive authoring without gaining policy fields', () => {
  const input = view({ id: 'b', type: 'button', text: 'Save', action: { name: 'save', payload: {} } });
  const result = emitMarkup(input, catalog);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(plain(parse(result.value).view), input);
  const invented = emitMarkup(view({ id: 'b', type: 'button', action: { name: 'erase', payload: {} } }), catalog);
  assert.equal(invented.ok, false);
});
test('untrusted extra permissions never enter emitted source', () => {
  const input = { ...view({ id: 't', type: 'text', text: 'Hello' }), permissions: { execute: true } };
  const result = emitMarkup(input, catalog);
  assert.equal(result.ok, false);
});
test('cyclic values and accessor hooks cannot run during emission', () => {
  let called = false;
  const source = { get root() { called = true; return {}; } };
  assert.equal(emitMarkup(source, catalog).ok, false);
  assert.equal(called, false);
  const cycle: Record<string, unknown> = {};
  cycle['root'] = cycle;
  assert.equal(emitMarkup(cycle, catalog).ok, false);
});
test('empty text and named slots survive representation', () => {
  const input = view({ id: 'r', type: 'stack', children: [{ id: 't', type: 'text', text: '', slot: '' }] });
  const result = emitMarkup(input, catalog);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(plain(parse(result.value).view), input);
});
test('source expansion still obeys output limits', () => {
  const result = emitMarkup(view({ id: 't', type: 'text', text: '&&&&&&&&&&&&' }), catalog, { markupLimits: { maxLength: 40 } });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0]?.code, 'source-length-limit');
});
test('escape primitive covers both quotes and markup delimiters', () => {
  assert.equal(escapeMarkupText('&<>"\''), '&amp;&lt;&gt;&quot;&apos;');
});
