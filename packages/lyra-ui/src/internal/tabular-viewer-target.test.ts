import { expect } from '@open-wc/testing';
import { TabularInputSnapshot, tabularInputLimits } from './tabular-viewer-target.js';

type Grid = string[][];

function snapshots() {
  const copies: number[] = [];
  const input = new TabularInputSnapshot<Grid>({
    snapshot: (value, limits) => {
      copies.push(limits.rows);
      if (value.length > limits.rows) throw new RangeError('too many rows');
      return value.map(row => [...row]);
    },
    invalid: () => [],
  });
  return { copies, input };
}

describe('tabularInputLimits', () => {
  it('applies the documented defaults, ceilings and floor, and keys the triple', () => {
    expect(tabularInputLimits(10000, 1000, 26214400)).to.deep.equal({ rows: 10000, columns: 1000, bytes: 26214400, key: '10000:1000:26214400' });
    expect(tabularInputLimits(Number.NaN, Infinity, -5)).to.deep.include({ rows: 10000, columns: 1000 });
    expect(tabularInputLimits(1e9, 1e9, 1e12)).to.deep.include({ rows: 100000, columns: 10000, bytes: 262144000 });
    expect(tabularInputLimits(0, 0, 0)).to.deep.include({ rows: 1, columns: 1, bytes: 1 });
  });
});

describe('TabularInputSnapshot', () => {
  it('snapshots a write once per source and limits, and skips reassigning the source or its snapshot', () => {
    const { copies, input } = snapshots();
    const limits = tabularInputLimits(5, 5, 100);
    const source: Grid = [['a']];
    expect(input.assign(source, limits)).to.equal(true);
    const held = input.value!;
    expect([held === source, held]).to.deep.equal([false, [['a']]]);
    expect([input.assign(source, limits), input.assign(held, limits)]).to.deep.equal([false, false]);
    expect(input.assign(source, tabularInputLimits(6, 5, 100)), 'new limits re-admit').to.equal(true);
    expect(copies).to.deep.equal([5, 6]);
    expect(input.assign(undefined, limits)).to.equal(true);
    expect(input.value).to.equal(undefined);
    expect(input.assign(undefined, limits)).to.equal(false);
  });

  it('holds the empty value after a rejection and reports it on load until a new write', () => {
    const { input } = snapshots();
    const limits = tabularInputLimits(1, 5, 100);
    expect(input.assign([['a'], ['b']], limits)).to.equal(true);
    expect(input.value).to.deep.equal([]);
    expect(() => input.admitted(limits)).to.throw(RangeError, 'too many rows');
    input.assign([['c']], limits);
    expect(input.admitted(limits)).to.deep.equal([['c']]);
  });

  it('reports a rejection even when the thrown value is falsy', () => {
    const input = new TabularInputSnapshot<Grid>({ snapshot: () => { throw 0; }, invalid: () => [] });
    input.assign([['a']], tabularInputLimits(5, 5, 100));
    let thrown: unknown = 'nothing';
    try { input.admitted(tabularInputLimits(5, 5, 100)); } catch (error) { thrown = error; }
    expect(thrown).to.equal(0);
  });

  it('re-snapshots the held copy once when the limits change before a load', () => {
    const { copies, input } = snapshots();
    expect(input.admitted(tabularInputLimits(5, 5, 100)), 'nothing held').to.equal(undefined);
    input.assign([['a'], ['b']], tabularInputLimits(5, 5, 100));
    const held = input.value;
    expect(input.admitted(tabularInputLimits(5, 5, 100)) === held, 'unchanged limits keep the copy').to.equal(true);
    expect(input.admitted(tabularInputLimits(4, 5, 100))).to.deep.equal([['a'], ['b']]);
    expect(input.admitted(tabularInputLimits(4, 5, 100)) === input.value).to.equal(true);
    expect(copies).to.deep.equal([5, 4]);
    expect(() => input.admitted(tabularInputLimits(1, 5, 100))).to.throw(RangeError);
  });
});
