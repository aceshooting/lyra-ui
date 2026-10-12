import { expect } from '@open-wc/testing';
import { aggregateValues, matchesFilter, searchRows } from './data-grid-processing.js';
import type { DataGridAggregation, DataGridColumn } from './data-grid-types.js';

it('computes non-median aggregates without sorting their numeric input', () => {
  const values = Object.freeze([8, -4, 4, 0]);
  const operations: DataGridAggregation<unknown>[] = ['sum', 'mean', 'min', 'max', 'extent'];
  const original = Array.prototype.sort;
  let sorts = 0;
  const results: unknown[] = [];
  try {
    Array.prototype.sort = function (compare) {
      sorts += 1;
      return original.call(this, compare);
    };
    for (const operation of operations) results.push(aggregateValues(operation, [], values));
  } finally {
    Array.prototype.sort = original;
  }
  expect(results).to.deep.equal([8, 2, -4, 8, [-4, 8]]);
  expect(sorts).to.equal(0);
  expect(aggregateValues('median', [], values)).to.equal(2);
  expect(values).to.deep.equal([8, -4, 4, 0]);
});

it('preserves first-minimum and last-maximum signed-zero ties and finite coercion', () => {
  for (const values of [[-0, 0], [0, -0]]) {
    expect(Object.is(aggregateValues('min', [], values), values[0])).to.equal(true);
    expect(Object.is(aggregateValues('max', [], values), values[1])).to.equal(true);
    const extent = aggregateValues('extent', [], values) as number[];
    expect(Object.is(extent[0], values[0])).to.equal(true);
    expect(Object.is(extent[1], values[1])).to.equal(true);
  }
  const values = [null, undefined, NaN, Infinity, -Infinity, '', '6', false, -2];
  expect(aggregateValues('min', [], values)).to.equal(-2);
  expect(aggregateValues('max', [], values)).to.equal(6);
  expect(aggregateValues('extent', [], values)).to.deep.equal([-2, 6]);
  expect(aggregateValues('sum', [], [Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE])).to.equal(Number.MAX_VALUE);
  expect(aggregateValues('mean', [], [Number.MAX_VALUE, Number.MAX_VALUE])).to.equal(Number.MAX_VALUE);
  expect(aggregateValues('median', [], [-Number.MAX_VALUE, Number.MAX_VALUE])).to.equal(0);
  expect(aggregateValues('extent', [], [NaN, Infinity])).to.deep.equal([]);
  expect(aggregateValues('min', [], [NaN, Infinity])).to.equal(undefined);
});

it('normalizes the default search needle once while preserving locale and short circuiting', () => {
  const source = [{ id: 1, first: 'ı', second: 'unused' }, { id: 2, first: 'x', second: 'ı' }];
  const visits: string[] = [];
  const columns: DataGridColumn<(typeof source)[number]>[] = [
    { id: 'first', value: (row) => { visits.push(`${row.id}:first`); return row.first; } },
    { id: 'second', value: (row) => { visits.push(`${row.id}:second`); return row.second; } },
  ];
  const original = String.prototype.toLocaleLowerCase;
  let needleNormalizations = 0;
  let result: typeof source;
  try {
    String.prototype.toLocaleLowerCase = function (locale) {
      if (String(this) === 'I') needleNormalizations += 1;
      return original.call(this, locale);
    };
    result = searchRows(source, columns, ' I ', 'tr', null);
  } finally {
    String.prototype.toLocaleLowerCase = original;
  }
  expect(result.map((row) => row.id)).to.deep.equal([1, 2]);
  expect(visits).to.deep.equal(['1:first', '2:first', '2:second']);
  expect(needleNormalizations).to.equal(1);
});

it('passes original-case trimmed search text to custom callbacks without normalizing it', () => {
  const source = [{ value: 'one' }, { value: 'two' }];
  const calls: unknown[] = [];
  const original = String.prototype.toLocaleLowerCase;
  let normalizations = 0;
  let result: typeof source;
  try {
    String.prototype.toLocaleLowerCase = function (locale) {
      normalizations += 1;
      return original.call(this, locale);
    };
    result = searchRows(source, [{ field: 'value' }], ' MiXeD ', 'en', (value, term, row) => {
      calls.push([value, term, row === source[0]]);
      return row === source[0];
    });
  } finally {
    String.prototype.toLocaleLowerCase = original;
  }
  expect(result.map((row) => row.value)).to.deep.equal(['one']);
  expect(calls).to.deep.equal([['one', 'MiXeD', true], ['two', 'MiXeD', false]]);
  expect(normalizations).to.equal(0);
});

it('avoids collator option processing for numeric, date, text and identical set values', () => {
  const original = Object.getOwnPropertyDescriptor;
  let optionReads = 0;
  const results: boolean[] = [];
  try {
    Object.getOwnPropertyDescriptor = function (target, key) {
      if (key === 'sensitivity' && target?.sensitivity === 'base' && target?.numeric === true) optionReads += 1;
      return original(target, key);
    };
    results.push(matchesFilter({ v: 2 }, { field: 'v', filterType: 'number-range' }, [1, 3], 'en'));
    results.push(matchesFilter({ v: '2026-01-02' }, { field: 'v', filterType: 'date-range' }, ['2026-01-01', '2026-01-03'], 'en'));
    results.push(matchesFilter({ v: 'HELLO' }, { field: 'v' }, 'ell', 'en'));
    results.push(matchesFilter({ v: ['same'] }, { field: 'v', filterType: 'set' }, ['same'], 'en'));
  } finally {
    Object.getOwnPropertyDescriptor = original;
  }
  expect(results).to.deep.equal([true, true, true, true]);
  expect(optionReads).to.equal(0);
});

it('retains locale-aware numeric set equality and live value coercion order', () => {
  const calls: string[] = [];
  const candidate = { toJSON() { calls.push('candidate'); return 'item02'; } };
  const needle = { toJSON() { calls.push('needle'); return 'ITEM2'; } };
  expect(matchesFilter({ v: [candidate] }, { field: 'v', filterType: 'includes-all' }, [needle], 'en')).to.equal(true);
  expect(calls).to.deep.equal(['candidate', 'needle']);
  expect(matchesFilter({ v: 'É' }, { field: 'v', filterType: 'equals' }, 'e', 'en')).to.equal(true);
  expect(matchesFilter({ v: 'HELLO' }, { field: 'v' }, 'hello', 'malformed_locale!')).to.equal(true);
});

it('resolves one collator for a multi-candidate set comparison', () => {
  const original = Object.getOwnPropertyDescriptor;
  let optionReads = 0;
  let result: boolean;
  try {
    Object.getOwnPropertyDescriptor = function (target, key) {
      if (key === 'sensitivity' && target?.sensitivity === 'base' && target?.numeric === true) optionReads += 1;
      return original(target, key);
    };
    result = matchesFilter(
      { v: ['z', 'b', 'c', 'item02'] },
      { field: 'v', filterType: 'includes-all' },
      ['ITEM2', 'B'],
      'en',
    );
  } finally {
    Object.getOwnPropertyDescriptor = original;
  }
  expect(result).to.equal(true);
  expect(optionReads).to.equal(1);
});
