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
});
