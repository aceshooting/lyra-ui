import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { createIslandParser, parseIslands } from './islands.js';

const options = { catalog: { id: 'test', version: '1' }, surfaceId: 'chat', revision: 0 };
test('arbitrary fence and prose chunking preserves source and final semantics', () => {
  fc.assert(fc.property(fc.array(fc.constantFrom('prose\n', '```lyra\n', '```\n', '~~~\n', '<text id="x">🚀</text>\n', '\\```\n', '    ```lyra\n'), { maxLength: 40 }), fc.array(fc.nat({ max: 50 }), { maxLength: 40 }), (lines, widths) => {
    const source = lines.join('');
    const parser = createIslandParser(options);
    let cursor = 0;
    for (const width of widths) { parser.push(source.slice(cursor, cursor + width)); cursor += width; }
    parser.push(source.slice(cursor));
    const result = parser.finish();
    assert.deepEqual(result, parseIslands(source, options));
    assert.equal(result.parts.map(part => part.source).join(''), source);
  }), propertyRuns());
});
