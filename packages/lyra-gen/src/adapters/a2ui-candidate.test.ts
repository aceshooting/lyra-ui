import assert from 'node:assert/strict';
import test from 'node:test';
import { initialCatalog } from '../catalog.js';
import type { LyraGenCatalog } from '../types.js';
import { exportA2uiCandidateCatalog } from './a2ui-candidate.js';

const component = { tag: 'div', properties: {} };
const catalog = (components: LyraGenCatalog['components']): LyraGenCatalog => ({ id: 'candidate', version: '1', components });

test('candidate roles use valid deterministic identifiers throughout the exported graph', () => {
  const source = catalog({ 'parent-view': { ...component, children: ['child-view'] }, 'child-view': component });
  const exported = exportA2uiCandidateCatalog(source);
  const components = exported['components'] as Record<string, Record<string, unknown>>;
  assert.deepEqual(Object.keys(components), ['parent_view', 'child_view']);
  assert.deepEqual(components['parent_view']!['allowedChildren'], ['child_view']);
  assert.deepEqual((components['parent_view']!['properties'] as Record<string, unknown>)['component'], { const: 'parent_view' });
  assert.deepEqual(exported['$defs'], { anyComponent: { oneOf: [
    { $ref: '#/components/parent_view' }, { $ref: '#/components/child_view' },
  ] }, anyFunction: { not: {} } });
  assert.deepEqual(exportA2uiCandidateCatalog(source), exported);
  assert.deepEqual(source.components['parent-view']!.children, ['child-view']);
  const names = Object.keys(exportA2uiCandidateCatalog(initialCatalog)['components'] as object);
  assert.equal(names.length, 28);
  assert.ok(names.every(name => /^[\p{XID_Start}_][\p{XID_Continue}]*$/u.test(name)));
});

test('candidate export rejects collisions, invalid properties and dangling child names', () => {
  assert.throws(() => exportA2uiCandidateCatalog(catalog({ 'a-b': component, a_b: component })), /collision/i);
  assert.throws(() => exportA2uiCandidateCatalog(catalog({ 'bad.name': component })), /identifier/i);
  assert.throws(() => exportA2uiCandidateCatalog(catalog({ Surface: component })), /reserved/i);
  assert.throws(() => exportA2uiCandidateCatalog(catalog({ item: { ...component, properties: { 'bad-name': { type: 'string' } } } })), /identifier/i);
  assert.throws(() => exportA2uiCandidateCatalog(catalog({ parent: { ...component, children: ['missing'] } })), /unknown child/i);
});

test('direct candidate export rejects own prototype-related property keys', () => {
  for (const key of ['__proto__', 'constructor', 'prototype', '__PROTO__', 'Constructor', 'PROTOTYPE']) {
    const properties = Object.fromEntries([[key, { type: 'string' as const }]]);
    assert.equal(Object.hasOwn(properties, key), true);
    assert.throws(() => exportA2uiCandidateCatalog(catalog({ item: { ...component, properties } })), /unsafe catalog property/i);
  }
});
