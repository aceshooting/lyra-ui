import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialCatalog } from '../dist/catalog.js';
import { validateSchema } from '../dist/schema.js';
import { verifyTableAdapter } from './catalog-adapter-proof.mjs';

test('real table adapter satisfies its prepared column contract', () => {
  assert.deepEqual(verifyTableAdapter(initialCatalog.components.table, validateSchema),
    { cases: 15, locales: 3, formats: 5, columnKeys: 16, rowCases: 10 });
});

for (const [name, mutate, message] of [
  ['missing callback', column => { delete column.cell; }, /metadata cannot reach/],
  ['leaked format', column => { column.format = { kind: 'number' }; }, /metadata cannot reach/],
  ['changed key', column => { column.key = 'unknown'; }, /unknown/],
  ['non-text callback', column => { column.cell = () => ({}); }, /returns text/],
]) test(`adapter proof rejects ${name}`, () => {
  const component = initialCatalog.components.table;
  assert.throws(() => verifyTableAdapter({ ...component, prepareProperties(props, context) {
    const prepared = component.prepareProperties(props, context);
    mutate(prepared.columns[0]);
    return prepared;
  } }, validateSchema), message);
});
