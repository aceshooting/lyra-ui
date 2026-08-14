import { expect } from '@open-wc/testing';
import { parseCellRange, formatCellRange } from './cell-range.js';

describe('parseCellRange', () => {
  it('parses a single cell reference', () => {
    expect(parseCellRange('B7')).to.deep.equal({ startRow: 6, startCol: 1, endRow: 6, endCol: 1 });
  });

  it('parses a range', () => {
    expect(parseCellRange('A1:C3')).to.deep.equal({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });
  });

  it('normalizes a reversed range so start <= end', () => {
    expect(parseCellRange('C3:A1')).to.deep.equal({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });
  });

  it('parses multi-letter (AA+) columns with bijective base-26', () => {
    expect(parseCellRange('AA1')).to.deep.equal({ startRow: 0, startCol: 26, endRow: 0, endCol: 26 });
    expect(parseCellRange('AB1')).to.deep.equal({ startRow: 0, startCol: 27, endRow: 0, endCol: 27 });
  });

  it('strips $ absolute markers', () => {
    expect(parseCellRange('$A$1:$C$3')).to.deep.equal({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });
  });

  it('tolerates lowercase column letters', () => {
    expect(parseCellRange('a1:c3')).to.deep.equal({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });
  });

  it('splits an unquoted sheet-name prefix', () => {
    expect(parseCellRange('Sheet2!A1:B2')).to.deep.equal({
      sheet: 'Sheet2',
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
    });
  });

  it('splits a quoted sheet-name prefix containing a space', () => {
    expect(parseCellRange("'My Sheet'!A1")).to.deep.equal({
      sheet: 'My Sheet',
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0,
    });
  });

  it('returns null for a whole-row reference', () => {
    expect(parseCellRange('3:7')).to.equal(null);
  });

  it('returns null for a whole-column reference', () => {
    expect(parseCellRange('A:A')).to.equal(null);
  });

  it('returns null for garbage input', () => {
    expect(parseCellRange('not a range')).to.equal(null);
    expect(parseCellRange('')).to.equal(null);
    expect(parseCellRange('A1:B2:C3')).to.equal(null);
  });

  it('rejects row zero and coordinates outside the safe-integer domain', () => {
    expect(parseCellRange('A0:A1')).to.equal(null);
    expect(parseCellRange('A9007199254740992')).to.equal(null);
    expect(parseCellRange(`${'Z'.repeat(32)}1`)).to.equal(null);
  });

  it('bounds the complete range and sheet-name input before parsing', () => {
    expect(parseCellRange(`A1${' '.repeat(1024)}`)).to.equal(null);
    expect(parseCellRange(`${'S'.repeat(256)}!A1`)).to.equal(null);
    expect(parseCellRange(`${'S'.repeat(255)}!A1`)).to.deep.equal({
      sheet: 'S'.repeat(255),
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0,
    });
  });
});

describe('formatCellRange', () => {
  it('formats a single-cell range without a colon', () => {
    expect(formatCellRange({ startRow: 6, startCol: 1, endRow: 6, endCol: 1 })).to.equal('B7');
  });

  it('formats a multi-cell range with a colon', () => {
    expect(formatCellRange({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 })).to.equal('A1:C3');
  });

  it('prefixes the sheet name when present', () => {
    expect(formatCellRange({ sheet: 'Sheet2', startRow: 0, startCol: 0, endRow: 1, endCol: 1 })).to.equal(
      'Sheet2!A1:B2',
    );
  });

  it('round-trips through parseCellRange for AA+ columns', () => {
    const parsed = parseCellRange('AB5:AC9')!;
    expect(formatCellRange(parsed)).to.equal('AB5:AC9');
  });

  it('fails closed for non-finite, negative, unsafe, or reversed coordinates', () => {
    expect(
      formatCellRange({
        startRow: 0,
        startCol: Number.POSITIVE_INFINITY,
        endRow: 0,
        endCol: Number.POSITIVE_INFINITY,
      }),
    ).to.equal(null);
    expect(formatCellRange({ startRow: -1, startCol: 0, endRow: 0, endCol: 0 })).to.equal(null);
    expect(
      formatCellRange({
        startRow: Number.MAX_SAFE_INTEGER,
        startCol: 0,
        endRow: Number.MAX_SAFE_INTEGER,
        endCol: 0,
      }),
    ).to.equal(null);
    expect(formatCellRange({ startRow: 2, startCol: 0, endRow: 1, endCol: 0 })).to.equal(null);
  });

  it('fails closed when a sheet name would exceed the parse boundary', () => {
    expect(
      formatCellRange({
        sheet: 'S'.repeat(256),
        startRow: 0,
        startCol: 0,
        endRow: 0,
        endCol: 0,
      }),
    ).to.equal(null);
  });
});
