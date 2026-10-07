import { expect } from '@open-wc/testing';
import { commonAffix, computeLineDiff, pairOpsForSplit, type LyraDiffOp } from './diff-line-diff.js';

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

  it('finds a lone new-side line inside a longer old document', () => {
    const ops = computeLineDiff(['before', 'keep', 'after'], ['keep']);
    expect(ops).to.deep.equal([
      { type: 'remove', text: 'before' },
      { type: 'equal', text: 'keep' },
      { type: 'remove', text: 'after' },
    ]);
  });

  it('keeps a lone unmatched new-side line as an addition', () => {
    const ops = computeLineDiff(['before', 'after'], ['new']);
    expect(ops).to.deep.equal([
      { type: 'remove', text: 'before' },
      { type: 'remove', text: 'after' },
      { type: 'add', text: 'new' },
    ]);
  });
});

describe('commonAffix', () => {
  it('measures the identical leading and trailing runs without letting them overlap', () => {
    expect(commonAffix(['a', 'b', 'x', 'c'], ['a', 'b', 'y', 'c'])).to.deep.equal([2, 1]);
    expect(commonAffix(['a', 'a'], ['a'])).to.deep.equal([1, 0]);
    expect(commonAffix([], ['a'])).to.deep.equal([0, 0]);
  });

  it('keeps the head and tail as equal lines around the changed middle', () => {
    expect(computeLineDiff(['a', 'b', 'x', 'c'], ['a', 'b', 'y', 'c'])).to.deep.equal([
      { type: 'equal', text: 'a' },
      { type: 'equal', text: 'b' },
      { type: 'remove', text: 'x' },
      { type: 'add', text: 'y' },
      { type: 'equal', text: 'c' },
    ]);
    expect(computeLineDiff(['a', 'a'], ['a'])).to.deep.equal([
      { type: 'equal', text: 'a' },
      { type: 'remove', text: 'a' },
    ]);
  });
});

describe('pairOpsForSplit', () => {
  it('pairs a pure-remove hunk against empty placeholders on the right', () => {
    const ops: LyraDiffOp[] = [
      { type: 'remove', text: 'a' },
      { type: 'remove', text: 'b' },
    ];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: { type: 'remove', text: 'a' }, right: null },
      { left: { type: 'remove', text: 'b' }, right: null },
    ]);
  });

  it('pairs a pure-add hunk against empty placeholders on the left', () => {
    const ops: LyraDiffOp[] = [
      { type: 'add', text: 'x' },
      { type: 'add', text: 'y' },
    ];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: null, right: { type: 'add', text: 'x' } },
      { left: null, right: { type: 'add', text: 'y' } },
    ]);
  });

  it('pairs an unbalanced 3-remove/1-add replace with placeholders on the shorter side', () => {
    const ops: LyraDiffOp[] = [
      { type: 'remove', text: 'a' },
      { type: 'remove', text: 'b' },
      { type: 'remove', text: 'c' },
      { type: 'add', text: 'x' },
    ];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: { type: 'remove', text: 'a' }, right: { type: 'add', text: 'x' } },
      { left: { type: 'remove', text: 'b' }, right: null },
      { left: { type: 'remove', text: 'c' }, right: null },
    ]);
  });

  it('renders the same text on both sides for an equal op', () => {
    const ops: LyraDiffOp[] = [{ type: 'equal', text: 'same' }];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: { type: 'equal', text: 'same' }, right: { type: 'equal', text: 'same' } },
    ]);
  });

  it('flushes a hunk before an equal row and starts a fresh hunk after it', () => {
    const ops: LyraDiffOp[] = [
      { type: 'remove', text: 'a' },
      { type: 'equal', text: 'b' },
      { type: 'add', text: 'c' },
    ];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: { type: 'remove', text: 'a' }, right: null },
      { left: { type: 'equal', text: 'b' }, right: { type: 'equal', text: 'b' } },
      { left: null, right: { type: 'add', text: 'c' } },
    ]);
  });
});
