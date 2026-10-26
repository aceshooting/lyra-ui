import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, initialCatalog, subsetCatalog } from './catalog.js';
import { exportCatalogSchemaForProfile } from './prompts.js';

test('closed JSON profile exports a single simple leaf without references or composition', () => {
  const selected = subsetCatalog(initialCatalog, ['heading']);
  assert.ok(selected.ok);
  const result = exportCatalogSchemaForProfile(selected.value, 'closed-json-v1');
  assert.ok(result.ok);
  const encoded = JSON.stringify(result.value);
  assert.ok(!encoded.includes('"anyOf"'));
  assert.ok(!encoded.includes('"allOf"'));
  assert.ok(!encoded.includes('"$ref"'));
  assert.ok(encoded.includes('"text"'));
  assert.equal(exportCatalogSchemaForProfile(initialCatalog, 'closed-json-v1').ok, false);
});

test('closed JSON profile diagnoses unsupported schema unions and naming alternatives', () => {
  const button = subsetCatalog(initialCatalog, ['button']);
  assert.ok(button.ok);
  const named = exportCatalogSchemaForProfile(button.value, 'closed-json-v1');
  assert.ok(!named.ok);
  assert.ok(named.diagnostics.some(item => item.path.endsWith('/accessibleName')));
  const nullable = createCatalog({ id: 'nullable', version: '1', components: { text: { tag: 'p', properties: { data: { anyOf: [{ type: 'string' }, { type: 'null' }] } }, text: true } } });
  const result = exportCatalogSchemaForProfile(nullable, 'closed-json-v1');
  assert.ok(!result.ok);
  assert.ok(result.diagnostics.some(item => item.code === 'schema.profile.unsupported'));
});

test('simple object property schemas remain closed when additionalProperties is implicit', () => {
  const catalog = createCatalog({ id: 'object', version: '1', components: { text: { tag: 'p', properties: { data: { type: 'object', properties: { title: { type: 'string' } } } }, text: true } } });
  const result = exportCatalogSchemaForProfile(catalog, 'closed-json-v1');
  assert.ok(result.ok);
  const root = result.value['properties'] as Record<string, unknown>;
  const node = root['root'] as Record<string, unknown>;
  const nodeProperties = node['properties'] as Record<string, unknown>;
  const props = nodeProperties['props'] as Record<string, unknown>;
  const properties = props['properties'] as Record<string, unknown>;
  assert.equal((properties['data'] as Record<string, unknown>)['additionalProperties'], false);
});
