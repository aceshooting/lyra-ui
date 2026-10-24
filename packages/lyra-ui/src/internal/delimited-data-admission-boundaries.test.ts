import { expect } from '@open-wc/testing';
import { ownTableValue, parseDelimitedGrid, parseDelimitedRecords, snapshotViewerRows } from './delimited-data.js';
import type { PapaParseApi } from './papaparse-loader.js';
import { LyraResourceLimitError } from './resource-loader.js';

describe('delimited table input admission', () => {
  it('reads only own data properties and rejects non-record input without coercion', () => {
    for (const value of [null, undefined, 1, 'row', true]) {
      expect(() => ownTableValue(value, 'name')).to.throw(TypeError, 'Invalid table input');
    }
    let reads = 0;
    const inherited = { get name() { reads++; return 'inherited'; } };
    const row = Object.create(inherited) as Record<string, unknown>;
    expect(ownTableValue(row, 'name')).to.equal(undefined);
    Object.defineProperty(row, 'name', { get() { reads++; return 'accessor'; }, configurable: true });
    expect(() => ownTableValue(row, 'name')).to.throw(TypeError, 'Table input must use data properties');
    expect(reads).to.equal(0);
    Object.defineProperty(row, 'name', { value: 'owned', enumerable: false });
    expect(ownTableValue(row, 'name')).to.equal('owned');
  });

  it('rejects non-array grids, non-array rows and absent rows instead of inventing table data', () => {
    for (const value of [null, undefined, {}, 'row']) {
      expect(() => snapshotViewerRows(value, 10, 10, 100)).to.throw(TypeError, 'Invalid table rows');
    }
    for (const value of [[null], [{}], new Array<unknown>(1)]) {
      expect(() => snapshotViewerRows(value, 10, 10, 100)).to.throw(TypeError, 'Invalid table row');
    }
  });

  it('retains scalar cells and missing cells in an immutable snapshot without evaluating inherited values', () => {
    let reads = 0;
    const row: unknown[] = ['value', 3, true, null, undefined];
    row.length = 6;
    const prototype = Object.create(Array.prototype) as object;
    Object.defineProperty(prototype, '5', { get() { reads++; return 'inherited'; } });
    Object.setPrototypeOf(row, prototype);
    const result = snapshotViewerRows([row], 1, 6, 100);
    expect(result).to.deep.equal([['value', 3, true, null, undefined, undefined]]);
    expect(reads).to.equal(0);
    expect(Object.isFrozen(result)).to.equal(true);
    expect(Object.isFrozen(result[0])).to.equal(true);
    row[0] = 'changed';
    expect(result[0]![0]).to.equal('value');
  });

  it('rejects structured and executable cell values without converting them to text', () => {
    let coercions = 0;
    const record = { toString() { coercions++; return 'not a scalar'; } };
    for (const value of [record, [], () => 'value', Symbol('cell'), 1n]) {
      expect(() => snapshotViewerRows([[value]], 1, 1, 100)).to.throw(TypeError, 'Table cells must be scalar values');
    }
    expect(coercions).to.equal(0);
  });

  it('checks row, column and encoded byte ceilings before returning a partial snapshot', () => {
    expect(() => snapshotViewerRows([[1], [2]], 1, 2, 100)).to.throw(LyraResourceLimitError);
    expect(() => snapshotViewerRows([[1, 2]], 2, 1, 100)).to.throw(LyraResourceLimitError);
    expect(() => snapshotViewerRows([['long']], 1, 1, 3)).to.throw(LyraResourceLimitError);
    expect(() => snapshotViewerRows([['éé']], 1, 1, 3)).to.throw(LyraResourceLimitError);
    const budget = { cells: 0, bytes: 0 };
    expect(snapshotViewerRows([['é']], 1, 1, 4, budget)).to.deep.equal([['é']]);
    expect(snapshotViewerRows([['é']], 1, 1, 4, budget)).to.deep.equal([['é']]);
    expect(budget).to.deep.equal({ cells: 2, bytes: 4 });
    expect(() => snapshotViewerRows([['x']], 1, 1, 4, budget)).to.throw(LyraResourceLimitError);
  });

  it('retains opaque peer diagnostics while deduplicating a matching structural quote diagnostic', () => {
    const parser: PapaParseApi = { parse(_text, options) {
      const step = options?.['step'] as (result: unknown, handle: { abort(): void }) => void;
      step({ data: ['unfinished'], errors: [null, false, 'diagnostic', { type: 'Quotes', code: 'MissingQuotes' }] }, { abort() { throw new Error('No limit was exceeded'); } });
      return { data: [], errors: [] };
    } };
    const result = parseDelimitedGrid(parser, '"unfinished');
    expect(result.data).to.deep.equal([['unfinished']]);
    expect(result.errors).to.have.length(4);
    expect(result.errors[0]).to.include({ type: 'Quotes', code: 'MissingQuotes' });
    expect(result.errors.slice(1)).to.deep.equal([null, false, 'diagnostic']);
  });

  it('combines structural field and quote diagnostics under one ceiling before invoking the parser', () => {
    let calls = 0;
    const parser: PapaParseApi = { parse() { calls++; return { data: [], errors: [] }; } };
    expect(() => parseDelimitedRecords(parser, 'a,b\n"unfinished', { maxErrors: 1 })).to.throw(LyraResourceLimitError);
    expect(calls).to.equal(0);
  });

  it('enforces diagnostic and field ceilings on the peer final result after valid streamed rows', () => {
    const diagnostics: PapaParseApi = { parse(_text, options) {
      const step = options?.['step'] as (result: unknown, handle: { abort(): void }) => void;
      step({ data: ['a', 'b'], errors: [] }, { abort() {} });
      return { data: [], errors: [{ code: 'first' }, { code: 'second' }] };
    } };
    expect(() => parseDelimitedGrid(diagnostics, 'a,b', { maxErrors: 1 })).to.throw(LyraResourceLimitError);
    const fields: PapaParseApi = { parse(_text, options) {
      const step = options?.['step'] as (result: unknown, handle: { abort(): void }) => void;
      step({ data: { a: '1' }, errors: [] }, { abort() {} });
      return { data: [], errors: [], meta: { fields: ['a', 'b'] } };
    } };
    expect(() => parseDelimitedRecords(fields, 'a\n1', { maxColumns: 1 })).to.throw(LyraResourceLimitError);
  });

  it('aborts a peer whose streamed rows exceed the admitted aggregate cell budget', () => {
    let aborts = 0;
    const parser: PapaParseApi = { parse(_text, options) {
      const step = options?.['step'] as (result: unknown, handle: { abort(): void }) => void;
      const handle = { abort() { aborts++; } };
      step({ data: ['a', 'b'] }, handle);
      step({ data: ['c', 'd'] }, handle);
      return { data: [], errors: [] };
    } };
    expect(() => parseDelimitedGrid(parser, 'a,b', { maxRows: 2, maxColumns: 2, maxCells: 3 })).to.throw(LyraResourceLimitError);
    expect(aborts).to.equal(1);
  });
});
