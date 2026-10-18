import { expect } from '@open-wc/testing';
import { indexByKey, positionIndex } from './keyed-index.js';

describe('keyed indexes', () => {
  it('indexes once per collection and selector identity preserving find semantics', () => {
    const entries = [{ id: 1 }, { id: 1 }, { id: 2 }];
    let calls = 0;
    const key = (entry: { id: number }) => { calls++; return entry.id; };
    const first = indexByKey(entries, key);
    expect(first.get(1)).to.equal(entries[0]);
    expect(indexByKey(entries, key)).to.equal(first);
    expect(calls).to.equal(3);
    expect(indexByKey([...entries], key)).not.to.equal(first);
    expect(indexByKey(entries, entry => entry.id)).not.to.equal(first);
  });
  it('memoizes positions preserving indexOf first occurrence semantics', () => {
    const entry = {};
    const entries = [entry, {}, entry];
    expect(positionIndex(entries).get(entry)).to.equal(0);
    expect(positionIndex(entries)).to.equal(positionIndex(entries));
    expect(positionIndex([...entries])).not.to.equal(positionIndex(entries));
    expect(positionIndex(entries).get({})).to.equal(undefined);
  });
});
