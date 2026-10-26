import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { A2uiProcessor, createA2uiCatalog } from './a2ui.js';

const catalog = createA2uiCatalog({ id: 'property-catalog', version: '1', components: { text: { tag: 'span', properties: {}, text: true } } });
const context = { ownerId: 'owner' };
function processor(): A2uiProcessor {
  const p = new A2uiProcessor({ catalogs: [catalog] });
  assert.equal(p.process({ version: 'v0.9.1', createSurface: { surfaceId: 's', catalogId: catalog.id } }, context).ok, true);
  return p;
}

test('arbitrary protocol input never throws or mutates a previously committed surface on failure', () => {
  fc.assert(fc.property(fc.jsonValue(), input => {
    const p = processor(); const before = p.getSurface('s');
    const result = p.process(input, context);
    if (!result.ok) assert.deepEqual(p.getSurface('s'), before);
    assert.ok(result.ok || result.diagnostics.length > 0);
  }), propertyRuns());
});

test('escaped pointer segments round-trip independent string keys', () => {
  fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 30 }).filter(key => !['__proto__', 'constructor', 'prototype'].includes(key)), fc.string(), (key, value) => {
    const p = processor(); const path = `/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    const update = p.process({ version: 'v0.9.1', updateDataModel: { surfaceId: 's', path, value } }, context);
    assert.equal(update.ok, true, JSON.stringify(update.diagnostics));
    assert.deepEqual(p.getSurface('s')!.data, { [key]: value });
  }), propertyRuns());
});

test('incremental component replacement agrees with the last accepted definition', () => {
  fc.assert(fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 20 }), values => {
    const p = processor();
    for (const value of values) assert.equal(p.process({ version: 'v0.9.1', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'text', text: value }] } }, context).ok, true);
    const view = p.toView('s'); assert.equal(view.ok, true);
    if (view.ok) { assert.equal(view.value.root.text, values.at(-1)); assert.equal(view.value.revision, values.length); }
  }), propertyRuns());
});

test('rendered instance identities stay bounded and stable without copying arbitrary source component IDs', () => {
  const profile = createA2uiCatalog({ id: 'identity-catalog', version: '1', components: {
    text: { tag: 'p', properties: {}, text: true }, stack: { tag: 'div', properties: {}, children: true },
  } });
  fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 256 }).filter(id => !['root', '__proto__', 'constructor', 'prototype'].includes(id)), id => {
    const p = new A2uiProcessor({ catalogs: [profile] });
    assert.equal(p.process({ version: 'v0.9.1', createSurface: { surfaceId: 's', catalogId: profile.id } }, context).ok, true);
    const update = (children: string[]): void => {
      assert.equal(p.process({ version: 'v0.9.1', updateComponents: { surfaceId: 's', components: [
        { id: 'root', component: 'stack', children }, { id, component: 'text', text: 'Content' },
      ] } }, context).ok, true);
    };
    const childId = (): string => {
      const view = p.toView('s'); assert.equal(view.ok, true);
      if (!view.ok) throw new Error('Expected a view');
      const child = view.value.root.children![0]!;
      assert.match(child.id, /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u);
      return child.id;
    };
    update([id]); const initial = childId();
    update([id]); assert.equal(childId(), initial);
    update([]); update([id]); assert.notEqual(childId(), initial);
  }), propertyRuns());
});
