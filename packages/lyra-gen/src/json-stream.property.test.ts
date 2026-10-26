import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { createJsonViewStream, parseJsonView } from './json-stream.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = { id: 'property', version: '1', components: { text: { tag: 'p', properties: {}, text: true } } };

test('generated text has equivalent structured views under arbitrary chunk schedules', () => {
  fc.assert(fc.property(fc.string(), fc.array(fc.integer({ min: 1, max: 17 }), { minLength: 1, maxLength: 20 }), (text, widths) => {
    const source = JSON.stringify({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'text', text } });
    const stream = createJsonViewStream({ catalog });
    let offset = 0;
    let index = 0;
    while (offset < source.length) { const width = widths[index++ % widths.length]!; stream.push(source.slice(offset, offset + width)); offset += width; }
    assert.deepEqual(stream.finish(), parseJsonView(source, { catalog }));
  }), propertyRuns());
});

test('arbitrary input preserves batch failure offsets under character streaming', () => {
  fc.assert(fc.property(fc.string({ maxLength: 300 }), source => {
    const stream = createJsonViewStream({ catalog });
    for (let index = 0; index < source.length; index++) stream.push(source[index]!);
    assert.deepEqual(stream.finish(), parseJsonView(source, { catalog }));
  }), propertyRuns());
});
