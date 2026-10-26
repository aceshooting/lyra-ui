import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { emitMarkup } from './authoring.js';
import { parseMarkup } from './parser.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = { id: 'property', version: '1', components: { text: { tag: 'p', properties: {}, text: true } } };
test('arbitrary admitted text roundtrips without changing identity or adding nodes', () => {
  fc.assert(fc.property(fc.string({ maxLength: 300 }), text => {
    const input = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'text', text } };
    const emitted = emitMarkup(input, catalog);
    if (!emitted.ok) { assert.ok(emitted.diagnostics.length > 0); return; }
    const parsed = parseMarkup(emitted.value, { catalog, surfaceId: 'surface', revision: 0 });
    assert.equal(parsed.status, 'complete');
    assert.deepEqual(parsed.view?.root, input.root);
  }), propertyRuns());
});
