import { expect } from '@open-wc/testing';
import { computeLineDiff } from './diff-line-diff.js';

describe('computeLineDiff', () => {
  it('produces a real interleaved diff for a one-line change inside a longer block, not all-removed-then-all-added', () => {
    const oldLines = ['a', 'b', 'c', 'd', 'e'];
    const newLines = ['a', 'b', 'X', 'd', 'e'];
    const ops = computeLineDiff(oldLines, newLines);
    expect(ops).to.deep.equal([
      { type: 'equal', text: 'a' },
      { type: 'equal', text: 'b' },
      { type: 'remove', text: 'c' },
      { type: 'add', text: 'X' },
      { type: 'equal', text: 'd' },
      { type: 'equal', text: 'e' },
    ]);
  });

  it('returns all equal for identical input', () => {
    const ops = computeLineDiff(['a', 'b'], ['a', 'b']);
    expect(ops.every((op) => op.type === 'equal')).to.be.true;
  });

  it('returns all add for an empty old side', () => {
    const ops = computeLineDiff([], ['a', 'b']);
    expect(ops).to.deep.equal([
      { type: 'add', text: 'a' },
      { type: 'add', text: 'b' },
    ]);
  });

  it('returns all remove for an empty new side', () => {
    const ops = computeLineDiff(['a', 'b'], []);
    expect(ops).to.deep.equal([
      { type: 'remove', text: 'a' },
      { type: 'remove', text: 'b' },
    ]);
  });
});
