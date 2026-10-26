import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { applyViewPatch, validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = { id: 'property', version: '1', components: {
  row: { tag: 'div', properties: {}, children: true }, text: { tag: 'span', text: true, properties: {} }
} };
test('targeted replacement preserves every unrelated identity and advances exactly one revision', () => {
  fc.assert(fc.property(fc.array(fc.string({ maxLength: 64 }), { minLength: 1, maxLength: 30 }), fc.nat(), (texts, position) => {
    const index = position % texts.length;
    const input: LyraGenView = { version: '1', catalog: { id: 'property', version: '1' }, surfaceId: 'surface', revision: 0,
      root: { id: 'root', type: 'row', children: texts.map((text, child) => ({ id: `item-${child}`, type: 'text', text })) } };
    const admitted = validateView(input, catalog);
    assert.equal(admitted.ok, true); if (!admitted.ok) return;
    const result = applyViewPatch(admitted.value, { surfaceId: 'surface', expectedRevision: 0, operations: [{ op: 'replace', nodeId: `item-${index}`, node: { id: `item-${index}`, type: 'text', text: 'replacement' } }] }, catalog);
    assert.equal(result.ok, true); if (!result.ok) return;
    assert.equal(result.value.revision, 1);
    for (let child = 0; child < texts.length; child++) if (child !== index) assert.equal(result.value.root.children![child], admitted.value.root.children![child]);
    assert.equal(admitted.value.revision, 0);
  }), { seed: 1729, numRuns: 200 });
});
