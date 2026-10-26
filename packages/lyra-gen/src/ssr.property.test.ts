import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { initialCatalog } from './catalog.js';
import { createSnapshot } from './runtime.js';
import { renderGenSnapshot } from './ssr.js';
import type { LyraGenSnapshot } from './runtime.js';

test('static snapshot serialization round-trips arbitrary text without HTML or script delimiters', () => {
  fc.assert(fc.property(fc.string({ maxLength: 2000 }), text => {
    const snapshot = createSnapshot({ version: '1', surfaceId: 'serialization', revision: 0, catalog: { id: initialCatalog.id, version: initialCatalog.version }, root: { id: 'text', type: 'text', text } });
    const result = renderGenSnapshot(snapshot, initialCatalog);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.doesNotMatch(result.value.serialized, /[<>&\u2028\u2029]/u);
    const envelope = JSON.parse(result.value.serialized) as { snapshot: LyraGenSnapshot };
    assert.equal(envelope.snapshot.view.root.text, text);
    assert.deepEqual(envelope.snapshot.state, snapshot.state);
  }), { seed: 41202, numRuns: 200 });
});
