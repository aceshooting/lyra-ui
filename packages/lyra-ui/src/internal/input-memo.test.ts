import { expect } from '@open-wc/testing';
import { createInputMemo } from './input-memo.js';

describe('createInputMemo', () => {
  it('recomputes only when an argument changes by Object.is', () => {
    let calls = 0;
    const memo = createInputMemo((rows: readonly number[], query: string, limit: number) => {
      calls += 1;
      return rows.filter((row) => String(row).includes(query)).slice(0, limit);
    });
    const rows = [1, 12, 21, 3];
    const first = memo(rows, '1', 5);
    expect(memo(rows, '1', 5) === first).to.equal(true);
    expect(calls).to.equal(1);
    expect(memo([...rows], '1', 5)).to.deep.equal(first);
    expect(memo(rows, '2', 5)).to.deep.equal([12, 21]);
    expect(memo(rows, '2', Number.NaN)).to.deep.equal([]);
    expect(memo(rows, '2', Number.NaN)).to.deep.equal([]);
    expect(calls).to.equal(4);
  });

  it('treats a different argument count as a new input', () => {
    let calls = 0;
    const memo = createInputMemo((...values: number[]) => {
      calls += 1;
      return values.length;
    });
    expect(memo(1)).to.equal(1);
    expect(memo(1, 2)).to.equal(2);
    expect(memo(1, 2)).to.equal(2);
    expect(calls).to.equal(2);
  });
});
