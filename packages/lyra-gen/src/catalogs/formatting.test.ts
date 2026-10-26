import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTableValue } from './formatting.js';

test('explicit numeric columns localize without parsing numeric strings or null', () => {
  for (const locale of ['en', 'fr', 'ar']) {
    for (const value of [-123456789.125, 0, 42.5]) assert.equal(formatTableValue(value, { kind: 'number' }, locale), new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value));
    assert.equal(formatTableValue('1234.5', { kind: 'number' }, locale), '1234.5');
    assert.equal(formatTableValue(null, { kind: 'number' }, locale), '');
    assert.equal(formatTableValue(1234.5, undefined, locale), '1234.5');
  }
});
test('ISO calendar and offset datetime columns have explicit UTC semantics and refuse normalized invalid dates', () => {
  for (const locale of ['en', 'fr', 'ar']) {
    assert.equal(formatTableValue('2024-02-29', { kind: 'date', timeZone: 'UTC' }, locale), new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date('2024-02-29T00:00:00Z')));
    assert.equal(formatTableValue('2026-01-01T00:30:00+02:00', { kind: 'datetime', timeZone: 'UTC' }, locale), new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date('2025-12-31T22:30:00Z')));
    assert.equal(formatTableValue('2025-02-29', { kind: 'date', timeZone: 'UTC' }, locale), '2025-02-29');
    for (const value of ['2025-02-29', '2026-13-01', 'Jan 1 2026', '2026-01-01T24:00:00Z', '2026-01-01T12:00:00']) assert.equal(formatTableValue(value, { kind: 'datetime', timeZone: 'UTC' }, locale), value);
  }
});

test('the trusted table adapter removes format metadata and adds locale-aware callbacks without changing rows', async () => {
  const { dataComponents } = await import('./data.js');
  const prepare = dataComponents['table']?.prepareProperties;
  assert.ok(prepare);
  const rows = [{ c0: 1234.5 }];
  const props = { caption: 'Records', columns: [{ key: 'c0', label: 'Amount', format: { kind: 'number' } }], rows };
  const prepared = prepare(props, { locale: 'fr' });
  const columns = prepared['columns'] as readonly Record<string, unknown>[];
  const column = columns[0]!;
  assert.equal(Object.hasOwn(column, 'format'), false);
  const cell = column['cell'];
  assert.ok(typeof cell === 'function');
  assert.equal(cell(rows[0]), new Intl.NumberFormat('fr', { maximumFractionDigits: 3 }).format(1234.5));
  assert.equal(prepared['rows'], rows);
  assert.deepEqual(rows, [{ c0: 1234.5 }]);
});
