import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { createMarkupParser, parseMarkup } from './parser.js';
import type { MarkupOptions } from './parser.js';

const options: MarkupOptions = { catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0 };

test('arbitrary bounded input never throws and agrees across arbitrary chunking', () => {
  fc.assert(fc.property(fc.string({ maxLength: 2000 }), fc.array(fc.nat({ max: 100 }), { maxLength: 100 }), (source, widths) => {
    const parser = createMarkupParser(options);
    let cursor = 0;
    for (const width of widths) { parser.push(source.slice(cursor, cursor + width)); cursor += width; }
    parser.push(source.slice(cursor));
    assert.deepEqual(parser.finish(), parseMarkup(source, options));
  }), propertyRuns());
});
test('quoted JSON scalar strings roundtrip as data without becoming markup', () => {
  fc.assert(fc.property(fc.string({ maxLength: 300 }), value => {
    const source = `<text id="x" value={${JSON.stringify(value)}}/>`;
    const result = parseMarkup(source, options);
    if (result.status === 'complete') assert.equal(result.view?.root.props?.['value'], value);
    else assert.ok(['invalid-json-unicode', 'invalid-unicode'].includes(result.diagnostics[0]!.code));
  }), propertyRuns());
});
test('every code-unit chunk yields batch semantics, including surrogate boundaries', () => {
  fc.assert(fc.property(fc.array(fc.constantFrom('a', '🚀', '&amp;', '\n', 'é'), { maxLength: 80 }), pieces => {
    const source = `<text id="x">${pieces.join('')}</text>`;
    const parser = createMarkupParser(options);
    for (let index = 0; index < source.length; index++) parser.push(source[index]!);
    assert.deepEqual(parser.finish(), parseMarkup(source, options));
  }), propertyRuns());
});
