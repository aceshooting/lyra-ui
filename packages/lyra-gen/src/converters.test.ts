import assert from 'node:assert/strict';
import test from 'node:test';
import { chartToView, tableToView, viewToChart, viewToTable } from './converters.js';
import type { LyraGenStructuredTable } from './converters.js';

const table: LyraGenStructuredTable = {
  caption: 'Inventory', columns: [
    { key: 'item', label: 'Item', type: 'string' },
    { key: 'count', label: 'Count', type: 'number', nullable: true },
    { key: 'available', label: 'Available', type: 'boolean' },
  ], rows: [{ item: '<script>plain text</script>', count: 2.5, available: false }, { item: '', count: null, available: true }],
};

test('table conversion preserves numeric, boolean, empty string and null values across JSON transport', () => {
  const encoded = tableToView(table, { surfaceId: 'inventory', nodeId: 'inventory-table' });
  assert.ok(encoded.ok);
  assert.equal(encoded.value.view.root.type, 'table');
  assert.deepEqual(encoded.value.view.root.props?.['columns'], [{ key: 'c0', label: 'Item' }, { key: 'c1', label: 'Count' }, { key: 'c2', label: 'Available' }]);
  const decoded = viewToTable(JSON.parse(JSON.stringify(encoded.value)));
  assert.ok(decoded.ok);
  assert.deepEqual(decoded.value, table);
});

test('table conversion refuses coercion, dropped fields, duplicate columns and resource overflow', () => {
  assert.equal(tableToView({ ...table, rows: [{ item: 'A', count: '2', available: true }] }).ok, false);
  assert.equal(tableToView({ ...table, rows: [{ item: 'A', count: 2 }] }).ok, false);
  assert.equal(tableToView({ ...table, rows: [{ item: 'A', count: 2, available: true, extra: 'x' }] }).ok, false);
  assert.equal(tableToView({ ...table, columns: [table.columns[0], table.columns[0]] }).ok, false);
  assert.equal(tableToView({ ...table, rows: Array.from({ length: 201 }, () => table.rows[0]) }).ok, false);
  assert.equal(tableToView({ ...table, rows: [{ item: 'A', count: Infinity, available: true }] }).ok, false);
});

test('reverse table conversion rejects tampered cells and metadata', () => {
  const encoded = tableToView(table);
  assert.ok(encoded.ok);
  const artifact = JSON.parse(JSON.stringify(encoded.value));
  artifact.view.root.props.rows[0].c1 = '2';
  assert.equal(viewToTable(artifact).ok, false);
  artifact.view.root.props.rows[0].c1 = 2;
  artifact.columns[0].label = 'Changed';
  assert.equal(viewToTable(artifact).ok, false);
});

test('chart conversion produces real numeric datasets with aligned null observations', () => {
  const chart = { label: 'Orders', type: 'line', labels: ['Mon', 'Tue', 'Wed'], series: [{ label: 'Orders', values: [0, null, 4.5] }] };
  const encoded = chartToView(chart);
  assert.ok(encoded.ok);
  assert.deepEqual(encoded.value.root.props?.['datasets'], [{ label: 'Orders', data: [0, null, 4.5] }]);
  const decoded = viewToChart(JSON.parse(JSON.stringify(encoded.value)));
  assert.ok(decoded.ok);
  assert.deepEqual(decoded.value, chart);
  assert.equal(chartToView({ ...chart, series: [{ label: 'Bad', values: [1] }] }).ok, false);
  assert.equal(chartToView({ ...chart, type: 'pie' }).ok, false);
  assert.equal(chartToView({ ...chart, series: [{ label: 'Bad', values: [1, '2', 3] }] }).ok, false);
});

test('converter output always respects view identities and accessible names', () => {
  assert.equal(tableToView(table, { surfaceId: 'has spaces' }).ok, false);
  assert.equal(tableToView(table, { nodeId: 'has spaces' }).ok, false);
  assert.equal(tableToView({ ...table, caption: '   ' }).ok, false);
});

test('converters refuse accessors without evaluating them', () => {
  let calls = 0;
  const input = { get caption() { calls++; return 'Oops'; }, columns: [], rows: [] };
  assert.equal(tableToView(input).ok, false);
  assert.equal(calls, 0);
});
