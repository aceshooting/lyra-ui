import assert from 'node:assert/strict';

/** Exercise the real adapter at the serialized-to-component boundary, without trusting a cast. */
export function verifyTableAdapter(component, validateSchema) {
  assert.equal(typeof component.prepareProperties, 'function', 'The table requires its trusted adapter.');
  const keys = component.properties.columns.items.properties.key.enum;
  const formats = [undefined, { kind: 'number', maximumFractionDigits: 0 },
    { kind: 'number', maximumFractionDigits: 20 }, { kind: 'date', timeZone: 'UTC' },
    { kind: 'datetime', timeZone: 'UTC' }];
  let cases = 0;
  for (const locale of ['en', 'fr', 'ar']) for (const format of formats) {
    const columns = keys.map((key, index) => ({ key, label: `Column ${index}`, sortable: index % 2 === 0,
      ...(format ? { format } : {}),
    }));
    const rows = [null, '', 'Text', true, false, 0, -1234.5, '2026-01-02', '2026-01-02T03:04:05Z']
      .map(value => Object.fromEntries(keys.map(key => [key, value])));
    rows.push({});
    const props = { caption: 'Records', columns, rows };
    const before = structuredClone(props);
    for (const [key, value] of Object.entries(props)) assert.equal(validateSchema(value, component.properties[key]).ok, true);
    const prepared = component.prepareProperties(props, { locale });
    assert.deepEqual(props, before, 'The adapter must not mutate serialized input.');
    assert.deepEqual(Object.keys(prepared).sort(), Object.keys(props).sort(), 'Only declared component properties are assigned.');
    assert.deepEqual(prepared.rows, rows, 'The adapter preserves row values.');
    assert.equal(prepared.caption, props.caption);
    assert.equal(prepared.columns.length, columns.length);
    for (const [index, column] of prepared.columns.entries()) {
      assert.deepEqual(Object.keys(column).sort(), ['cell', 'key', 'label', 'sortable'], 'Serialized format metadata cannot reach the component.');
      assert.equal(column.key, columns[index].key);
      assert.equal(column.label, columns[index].label);
      assert.equal(column.sortable, columns[index].sortable);
      assert.equal(typeof column.cell, 'function', 'Every ordinary column requires a cell callback.');
      for (const row of rows) assert.equal(typeof column.cell(row), 'string', 'The prepared callback returns text.');
      assert.equal(column.cell({}), '');
      const inherited = Object.create({ [column.key]: 'Inherited value' });
      assert.equal(column.cell(inherited), '', 'Callbacks only read own row values.');
      const accessor = Object.defineProperty({}, column.key, { get() { throw new Error('A row getter must not execute.'); } });
      assert.equal(column.cell(accessor), '', 'Callbacks do not invoke row accessors.');
    }
    cases++;
  }
  return { cases, locales: 3, formats: formats.length, columnKeys: keys.length, rowCases: 10 };
}
