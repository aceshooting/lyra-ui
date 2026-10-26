import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { completeJsonView } from './recovery.js';
import type { LyraGenCatalog } from './types.js';
const catalog: LyraGenCatalog = { id: 'test', version: '1', components: { text: { tag: 'p', text: true, properties: {} } } };

test('one explicit envelope completion preserves arbitrary JSON string data exactly', () => {
  fc.assert(fc.property(fc.string({ maxLength: 100 }), text => {
    const view = { version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'text', text } };
    const source = JSON.stringify(view);
    const result = completeJsonView(source.slice(0, -1), catalog, { policy: 'close-envelope-eof' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.value.view, view);
      assert.equal(result.value.source, source);
    }
    assert.equal(completeJsonView(source.slice(0, -1), catalog).ok, false);
  }), propertyRuns());
});

test('arbitrary bounded input never throws or produces a source differing by more than the single permitted brace', () => {
  fc.assert(fc.property(fc.string({ maxLength: 1000 }), source => {
    const result = completeJsonView(source, catalog, { policy: 'close-envelope-eof' });
    if (result.ok) assert.equal(result.value.source, result.value.completion === 'none' ? source : source + '}');
  }), propertyRuns());
});
