import assert from 'node:assert/strict';
import test from 'node:test';
import { expandTemplate } from './templates.js';
import { createSurfaceState, reconcileSurfaceState, setSurfaceState, validateView } from './runtime.js';
import { readPointer } from './references.js';
import type { LyraGenTemplate } from './templates.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'templates', version: '1', components: {
    row: { tag: 'section', properties: {}, children: true },
    text: { tag: 'p', properties: {}, text: true },
    input: { tag: 'input', properties: { value: { type: 'string' } }, bindings: { value: { event: 'input', property: 'value' } } },
    button: { tag: 'button', properties: {}, text: true, events: ['click'] }
  }, actions: { save: { payload: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] }, confirm: true } }
};
const template: LyraGenTemplate = {
  id: 'people', key: '/key', root: {
    id: 'person', type: 'row', children: [
      { id: 'name', type: 'text' }, { id: 'field', type: 'input', props: { value: '' }, bindings: { value: '/value' } }
    ]
  }, values: { name: { text: '/name' }, field: { props: { value: '/name' } } }
};

test('explicit keys preserve unaffected identities and scoped state on reorder and removal', () => {
  const first = expandTemplate(template, [{ key: 'a', name: 'Alice' }, { key: 'b', name: 'Bob' }], catalog);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const reordered = expandTemplate(template, [{ key: 'b', name: 'Bob' }, { key: 'a', name: 'Alice' }], catalog, { previous: first.value });
  assert.equal(reordered.ok, true);
  if (!reordered.ok) return;
  assert.equal(reordered.value.nodes[0], first.value.nodes[1]);
  assert.equal(reordered.value.nodes[1], first.value.nodes[0]);
  const initial = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'row', children: first.value.nodes } }, catalog);
  const next = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 1, root: { id: 'root', type: 'row', children: reordered.value.nodes } }, catalog);
  assert.equal(initial.ok && next.ok, true);
  if (!initial.ok || !next.ok) return;
  const pointer = first.value.nodes[0]!.children![1]!.bindings!['value']!;
  const edited = setSurfaceState(createSurfaceState(initial.value), pointer, 'Edited');
  assert.equal(edited.ok, true);
  if (!edited.ok) return;
  const retained = reconcileSurfaceState(edited.value, initial.value, next.value);
  assert.equal(retained.ok, true);
  if (retained.ok) assert.deepEqual(readPointer(retained.value.values, pointer), { ok: true, value: 'Edited', diagnostics: [] });
  const removed = expandTemplate(template, [{ key: 'b', name: 'Bob' }], catalog, { previous: reordered.value });
  assert.equal(removed.ok, true);
  if (removed.ok) {
    assert.equal(removed.value.nodes[0], first.value.nodes[1]);
    assert.ok(removed.value.removedNodeIds.includes(first.value.nodes[0]!.id));
    assert.equal(removed.value.removedNodeIds.length, 3);
  }
});

test('changed data replaces only its keyed instance and failed expansions leave prior output intact', () => {
  const first = expandTemplate(template, [{ key: 'a', name: 'Alice' }, { key: 'b', name: 'Bob' }], catalog);
  if (!first.ok) assert.fail('Initial expansion failed.');
  const changed = expandTemplate(template, [{ key: 'a', name: 'Alicia' }, { key: 'b', name: 'Bob' }], catalog, { previous: first.value });
  if (!changed.ok) assert.fail('Updated expansion failed.');
  assert.notEqual(changed.value.nodes[0], first.value.nodes[0]);
  assert.equal(changed.value.nodes[0]!.id, first.value.nodes[0]!.id);
  assert.equal(changed.value.nodes[1], first.value.nodes[1]);
  for (const rows of [[{ key: 'a', name: 'Alice' }, { key: 'a', name: 'Other' }], [{ name: 'Missing key' }], [{ key: 'a' }], [{ key: '', name: 'Empty key' }], [{ key: 1.5, name: 'Fractional key' }]]) {
    assert.equal(expandTemplate(template, rows, catalog, { previous: first.value }).ok, false);
    assert.equal(first.value.nodes[0]!.children![0]!.text, 'Alice');
  }
});

test('string and numeric keys have distinct collision-resistant identities', () => {
  const result = expandTemplate(template, [{ key: 1, name: 'Number' }, { key: '1', name: 'String' }, { key: '\ud800', name: 'High' }, { key: '\ud801', name: 'Other high' }], catalog);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(new Set(result.value.nodes.map(node => node.id)).size, 4);
});

test('template values cannot substitute actions, bindings, identity or unregistered properties', () => {
  const button: LyraGenTemplate = { id: 'buttons', key: '/key', root: { id: 'save', type: 'button', text: 'Save', action: { name: 'save', payload: { target: 'host-defined' } } } };
  const result = expandTemplate(button, [{ key: 'a', action: { name: 'delete' }, payload: { target: 'other' }, $ref: '@data:private' }], catalog);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.nodes[0]!.action, button.root.action);
  assert.equal(expandTemplate({ ...button, values: { save: { props: { onclick: '/key' } } } }, [{ key: 'a' }], catalog).ok, false);
  assert.equal(expandTemplate({ ...template, key: '/constructor' }, [], catalog).ok, false);
  assert.equal(expandTemplate({ ...template, root: { id: 'root', type: 'unknown' } }, [], catalog).ok, false);
});

test('resource ceilings, missing mappings and forged prior expansions reject atomically', () => {
  assert.equal(expandTemplate(template, [{ key: 'a', name: 'Alice' }, { key: 'b', name: 'Bob' }], catalog, { limits: { maxArrayLength: 1 } }).ok, false);
  assert.equal(expandTemplate(template, [{ key: 'a'.repeat(25), name: 'Alice' }], catalog).ok, false);
  assert.equal(expandTemplate({ ...template, values: { unknown: { text: '/name' } } }, [], catalog).ok, false);
  assert.equal(expandTemplate(template, [], catalog, { previous: { templateId: template.id, keys: [], nodes: [], removedNodeIds: [] } }).ok, false);
  assert.equal(expandTemplate(template, [], catalog).ok, true);
});
