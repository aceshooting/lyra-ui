import { expect } from '@open-wc/testing';
import { computeLineDiff, pairOpsForSplit, type DiffOp } from './diff-line-diff.js';

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

describe('pairOpsForSplit', () => {
  it('pairs a pure-remove hunk against empty placeholders on the right', () => {
    const ops: DiffOp[] = [
      { type: 'remove', text: 'a' },
      { type: 'remove', text: 'b' },
    ];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: { type: 'remove', text: 'a' }, right: null },
      { left: { type: 'remove', text: 'b' }, right: null },
    ]);
  });

  it('pairs a pure-add hunk against empty placeholders on the left', () => {
    const ops: DiffOp[] = [
      { type: 'add', text: 'x' },
      { type: 'add', text: 'y' },
    ];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: null, right: { type: 'add', text: 'x' } },
      { left: null, right: { type: 'add', text: 'y' } },
    ]);
  });

  it('pairs an unbalanced 3-remove/1-add replace with placeholders on the shorter side', () => {
    const ops: DiffOp[] = [
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
    const ops: DiffOp[] = [{ type: 'equal', text: 'same' }];
    expect(pairOpsForSplit(ops)).to.deep.equal([
      { left: { type: 'equal', text: 'same' }, right: { type: 'equal', text: 'same' } },
    ]);
  });

  it('flushes a hunk before an equal row and starts a fresh hunk after it', () => {
    const ops: DiffOp[] = [
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
