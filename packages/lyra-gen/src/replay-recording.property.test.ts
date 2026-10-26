import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { parseReplayRecording } from './replay.js';

test('every bounded code-unit split reconstructs the exact recorded source', () => {
  fc.assert(fc.property(fc.array(fc.constantFrom('a', '🚀', 'é', '\n', '"'), { maxLength: 60 }), fc.array(fc.nat({ max: 10 }), { maxLength: 30 }), (pieces, widths) => {
    const text = pieces.join('');
    let position = 0;
    const chunks = widths.map((width, index) => { const chunk = { atMs: index, text: text.slice(position, position + width) }; position += width; return chunk; });
    chunks.push({ atMs: chunks.length, text: text.slice(position) });
    const result = parseReplayRecording({ version: '1', recordingKind: 'authored-synthetic', source: { kind: 'fixture', id: 'property' }, model: null,
      package: { name: 'test', version: '1' }, catalog: { id: 'test', version: '1' }, format: 'chat', text, chunks });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.chunks.map(chunk => chunk.text).join(''), text);
  }), propertyRuns());
});
