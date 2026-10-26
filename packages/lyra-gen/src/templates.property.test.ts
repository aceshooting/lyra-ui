import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { expandTemplate } from './templates.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = { id: 'template-property', version: '1', components: { text: { tag: 'p', properties: {}, text: true } } };
const template = { id: 'rows', key: '/id', root: { id: 'label', type: 'text' }, values: { label: { text: '/label' } } };

test('permuting explicit integer keys retains identities and correctly paired values', () => {
  fc.assert(fc.property(fc.uniqueArray(fc.integer({ min: -1000, max: 1000 }), { maxLength: 20 }), keys => {
    const rows = keys.map(id => ({ id, label: `Value ${id}` }));
    const first = expandTemplate(template, rows, catalog);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const next = expandTemplate(template, [...rows].reverse(), catalog, { previous: first.value });
    assert.equal(next.ok, true);
    if (!next.ok) return;
    assert.deepEqual(next.value.keys, [...keys].reverse());
    for (let index = 0; index < rows.length; index++) {
      assert.equal(next.value.nodes[index], first.value.nodes[rows.length - index - 1]);
      assert.equal(next.value.nodes[index]!.text, rows[rows.length - index - 1]!.label);
    }
  }), propertyRuns());
});

test('duplicating any explicit key rejects the entire expansion', () => {
  fc.assert(fc.property(fc.integer({ min: -1000, max: 1000 }), key => {
    const result = expandTemplate(template, [{ id: key, label: 'One' }, { id: key, label: 'Two' }], catalog);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0]?.code, 'template.key-duplicate');
  }), propertyRuns());
});
