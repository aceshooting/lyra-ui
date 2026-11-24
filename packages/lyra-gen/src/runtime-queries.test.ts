import assert from 'node:assert/strict';
import { test } from 'node:test';
import { subsetCatalog } from './catalog.js';
import { exportCatalogArtifact } from './prompts.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenNode } from './types.js';

const catalog: LyraGenCatalog = {
  id: 'q', version: '1',
  components: {
    stack: { tag: 'div', properties: {}, children: true },
    picker: { tag: 'select', properties: { value: { type: 'string', maxLength: 32 }, label: { type: 'string', maxLength: 64 } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'change', property: 'value' } } },
    total: { tag: 'output', properties: { value: { type: 'number', minimum: 0, maximum: 1e9 } } },
  },
  queries: { revenue: { params: { type: 'object', properties: { region: { type: 'string', enum: ['eu', 'us'] }, days: { type: 'integer', minimum: 1, maximum: 90 } }, required: ['region'], additionalProperties: false }, result: { type: 'object', properties: { total: { type: 'number', minimum: 0, maximum: 1e9 } }, required: ['total'], additionalProperties: false } } },
};
const view = (query: unknown, extra: Partial<LyraGenNode> = {}): unknown => ({ version: '1', catalog: { id: 'q', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'stack', children: [
  { id: 'region', type: 'picker', props: { label: 'Region', value: 'eu' }, bindings: { value: '/region' } },
  { id: 'sum', type: 'total', dataQuery: query, liveReads: { value: '/total' }, ...extra },
] } });
const code = (query: unknown): string | undefined => { const result = validateView(view(query), catalog); return result.ok ? undefined : result.diagnostics[0]!.code; };

test('data queries name declared queries with declared, schema-valid literal and state-read parameters', () => {
  assert.equal(code({ name: 'revenue', params: { days: 30 }, paramReads: { region: '/region' } }), undefined);
  assert.equal(code({ name: 'revenue' }), undefined);
  assert.equal(code('revenue'), 'query.invalid');
  assert.equal(code({ name: 'revenue', sql: 'select 1' }), 'query.invalid');
  assert.equal(code({ name: 'other' }), 'query.unknown');
  assert.equal(code({ name: 'revenue', params: { limit: 5 } }), 'query.param');
  assert.equal(code({ name: 'revenue', params: { days: 500 } }), 'schema.range');
  assert.equal(code({ name: 'revenue', params: { region: 'eu' }, paramReads: { region: '/region' } }), 'query.param');
  assert.equal(code({ name: 'revenue', paramReads: { region: 'region' } }), 'query.pointer');
  assert.equal(code({ name: 'revenue', paramReads: { region: '/unowned' } }), 'query.unowned');
  // A query node is component-local, so isolate mode contains a bad one.
  const isolated = validateView(view({ name: 'other' }), catalog, { recovery: 'isolate' });
  assert.equal(isolated.ok, true);
  if (isolated.ok) assert.deepEqual(isolated.isolated?.map(item => item.nodeId), ['sum']);
});

test('queries survive catalog subsets and reach the model-facing artifact', () => {
  const selected = subsetCatalog(catalog, ['stack', 'total']);
  assert.equal(selected.ok, true);
  if (selected.ok) assert.deepEqual(Object.keys(selected.value.queries ?? {}), ['revenue']);
  assert.deepEqual(Object.keys((exportCatalogArtifact(catalog) as { queries: object }).queries), ['revenue']);
});

const repeatView = (node: Record<string, unknown>): unknown => ({ version: '1', catalog: { id: 'q', version: '1' }, surfaceId: 's', revision: 0, root: { id: 'root', type: 'stack', children: [
  { id: 'region', type: 'picker', props: { label: 'Region', value: 'eu' }, bindings: { value: '/region' } }, node,
] } });
const repeatCode = (node: Record<string, unknown>): string | undefined => { const result = validateView(repeatView(node), catalog); return result.ok ? undefined : result.diagnostics[0]!.code; };

test('repeat needs safe pointers, one template child and a template free of state, actions and queries', () => {
  const template = { id: 'row', type: 'total', itemReads: { value: '/amount' } };
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '/id' }, children: [template] }), undefined);
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '' }, children: [template] }), undefined);
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '/id' }, children: [template, { id: 'x', type: 'total' }] }), 'repeat.invalid');
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '/id', max: 500 }, children: [template] }), 'repeat.invalid');
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '', key: '/id' }, children: [template] }), 'repeat.pointer');
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '/id', from: 'state' }, children: [template] }), 'repeat.unowned');
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '/id' }, children: [{ ...template, dataQuery: { name: 'revenue' } }] }), 'repeat.template');
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '/id' }, children: [{ id: 'nested', type: 'stack', children: [{ id: 'inner', type: 'picker', props: { label: 'X' }, bindings: { value: '/x' } }] }] }), 'repeat.template');
  assert.equal(repeatCode({ id: 'loose', type: 'total', itemReads: { value: '/amount' } }), 'item.outside');
  assert.equal(repeatCode({ id: 'list', type: 'stack', repeat: { items: '/rows', key: '/id' }, children: [{ id: 'row', type: 'total', itemReads: { invented: '/a' } }] }), 'item.unknown');
});
