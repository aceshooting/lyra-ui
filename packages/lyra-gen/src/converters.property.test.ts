import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { chartToView, tableToView, viewToChart, viewToTable } from './converters.js';

const options = { seed: 42017, numRuns: 200 };

test('typed nullable table records survive canonical field mapping and JSON transport', () => {
  fc.assert(fc.property(fc.array(fc.record({ s: fc.string({ maxLength: 24 }), n: fc.option(fc.integer({ min: -10000, max: 10000 }), { nil: null }), b: fc.boolean() }), { maxLength: 30 }), rows => {
    const input = { caption: 'Records', columns: [{ key: 's', label: 'Text', type: 'string' }, { key: 'n', label: 'Number', type: 'number', nullable: true }, { key: 'b', label: 'Boolean', type: 'boolean' }], rows };
    const converted = tableToView(input);
    assert.ok(converted.ok);
    const restored = viewToTable(JSON.parse(JSON.stringify(converted.value)));
    assert.ok(restored.ok);
    assert.deepEqual(restored.value, JSON.parse(JSON.stringify(input)));
  }), options);
});

test('aligned numeric chart series retain null gaps and numeric values', () => {
  fc.assert(fc.property(fc.array(fc.option(fc.integer({ min: -10000, max: 10000 }), { nil: null }), { maxLength: 30 }), values => {
    const input = { label: 'Measurements', type: 'bar', labels: values.map((_, index) => String(index)), series: [{ label: 'Value', values }] };
    const converted = chartToView(input);
    assert.ok(converted.ok);
    const restored = viewToChart(JSON.parse(JSON.stringify(converted.value)));
    assert.ok(restored.ok);
    assert.deepEqual(restored.value, input);
  }), options);
});
