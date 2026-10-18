import { expect } from '@open-wc/testing';
import { capOptionRows } from './option-selection.js';

describe('bounded option rows', () => {
  const rows = Array.from({ length: 1100 }, (_, index) => ({ index }));
  it('retains preferred identities with a zero prefix and preserves source order', () => {
    const capped = capOptionRows(rows, 0, [rows[999]!, rows[1]!]);
    expect(capped.rows.map(row => row.index)).deep.equal([1, 999]);
    expect(capped.overflow).equal(1098);
  });
  it('prioritizes active identity over an oversized selected set', () => {
    const capped = capOptionRows(rows, 200, [rows[1099]!, ...rows]);
    expect(capped.rows.length).equal(1000);
    expect(capped.rows[999]!.index).equal(1099);
    expect(capped.overflow).equal(100);
  });
  it('bounds invalid, fractional and excessive limits', () => {
    expect(capOptionRows(rows, NaN).rows.length).equal(200);
    expect(capOptionRows(rows, -1).rows.length).equal(0);
    expect(capOptionRows(rows, 2.9).rows.length).equal(2);
    expect(capOptionRows(rows, 10000).rows.length).equal(1000);
  });
});
it('preserves unchanged readonly input identity including fully retained rows', () => {
  const rows = Object.freeze([{ value: 1 }, { value: 2 }]);
  expect(capOptionRows(rows, 200).rows === rows).equal(true);
  expect(capOptionRows(rows, 0, rows).rows === rows).equal(true);
  expect(capOptionRows(rows, 1).rows.map(row => row.value)).deep.equal([1]);
  expect(rows.map(row => row.value)).deep.equal([1, 2]);
});
