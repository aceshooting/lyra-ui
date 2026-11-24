import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import type { JsonObject, LyraGenCatalog } from '../types.js';
import { A2uiV1Processor, createA2uiV1Catalog } from './a2ui-v1.js';

const viewCatalog: LyraGenCatalog = { id: 'v1-property', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'span', properties: {}, text: true },
} };
const catalog = createA2uiV1Catalog(viewCatalog, { catalogId: 'https://example.com/v1-property' });
const context = { ownerId: 'owner' };
const codes = ['VALIDATION_FAILED', 'UNALLOWED_PARENT', 'UNALLOWED_CHILD', 'INTEGRITY_ERROR', 'INVALID_FUNCTION_CALL'];
function processor(): A2uiV1Processor {
  const p = new A2uiV1Processor({ viewCatalog, catalogs: [catalog] });
  assert.equal(p.process({ version: '1.0', createSurface: { surfaceId: 's', catalogId: catalog.catalogId, components: [
    { id: 'root', component: 'stack', children: ['t'] }, { id: 't', component: 'text', text: { '@path': '/label' } },
  ], dataModel: { label: 'Ready' } } }, context).ok, true);
  return p;
}

test('arbitrary input never throws, always codes a failure and never mutates committed state', () => {
  const operation = fc.constantFrom('createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'callRendererFunction');
  const message = fc.oneof(fc.jsonValue(), fc.tuple(operation, fc.jsonValue()).map(([kind, body]) => ({ version: '1.0', [kind]: body })));
  fc.assert(fc.property(message, input => {
    const p = processor();
    const before = JSON.stringify(p.getSurface('s'));
    const result = p.process(input, context);
    if (!result.ok) {
      assert.ok(codes.includes(result.error.error.code));
      assert.equal(result.error.version, '1.0');
      assert.equal(JSON.stringify(p.getSurface('s')), before);
    }
  }), propertyRuns());
});

test('string data updates round-trip through bindings and keep the bound node identity', () => {
  fc.assert(fc.property(fc.string({ maxLength: 40 }), value => {
    const p = processor();
    const first = p.toView('s');
    assert.ok(first.ok);
    const update = p.process({ version: '1.0', updateDataModel: { surfaceId: 's', path: '/label', value } }, context);
    assert.equal(update.ok, true);
    const next = p.toView('s');
    assert.ok(next.ok);
    const child = next.value.root.children?.[0] as JsonObject | undefined;
    assert.equal(child?.['id'], first.value.root.children?.[0]?.id);
    assert.equal(child?.['text'], value);
  }), propertyRuns());
});
