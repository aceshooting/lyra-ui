import { expect } from '@open-wc/testing';
import { snapshotPublicCollection } from './collection-snapshot.js';

describe('public collection snapshots at hostile input boundaries', () => {
  it('discards a record whose property enumeration fails without discarding later rows', () => {
    const hostile = new Proxy({ label: 'unreadable' }, {
      ownKeys() { throw new Error('unreadable record'); },
    });
    const snapshot = snapshotPublicCollection([hostile, { label: 'safe' }]) as unknown[];
    expect(snapshot.length).to.equal(2);
    expect(0 in snapshot).to.equal(false);
    expect(snapshot[1]).to.deep.equal({ label: 'safe' });
    expect(Object.isFrozen(snapshot)).to.equal(true);
  });

  it('fails closed when an array proxy cannot reveal its length descriptor', () => {
    const source = new Proxy([1, 2], {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'length') throw new Error('unreadable length');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(snapshotPublicCollection(source)).to.deep.equal([]);
    const nested = snapshotPublicCollection([source, 'safe']) as unknown[];
    expect(0 in nested).to.equal(false);
    expect(nested[1]).to.equal('safe');
  });

  it('keeps bounded prefix snapshots for Map and Set values that exceed the node budget', () => {
    const values = Array.from({ length: 10_000 }, (_, index) => ({
      index, first: 1, second: 2, third: 3, fourth: 4,
    }));
    const map = snapshotPublicCollection(new Map(values.map(value => [value.index, value]))) as ReadonlyMap<number, typeof values[number]>;
    const set = snapshotPublicCollection(new Set(values)) as ReadonlySet<typeof values[number]>;
    for (const snapshot of [map, set]) {
      expect(snapshot.size).to.be.greaterThan(0);
      expect(snapshot.size).to.be.lessThan(values.length);
      expect(Object.isFrozen(snapshot)).to.equal(true);
    }
    expect(map.get(0)).to.deep.equal(values[0]);
    expect(map.get(0) === values[0]).to.equal(false);
    expect([...set][0] === values[0]).to.equal(false);
  });

  it('rejects a nested oversized Map or Set transaction instead of exposing partial nested data', () => {
    const largeRecord = Object.fromEntries(Array.from({ length: 49_998 }, (_, i) => [`field${i}`, i]));
    for (const collection of [new Map([[0, largeRecord], [1, {}]]), new Set([largeRecord, {}])]) {
      const snapshot = snapshotPublicCollection([collection, 'later']) as unknown[];
      expect(snapshot).to.deep.equal([]);
      expect(Object.isFrozen(snapshot)).to.equal(true);
    }
  });

  it('retains a complete first entry when it exactly fills the root Map or Set node budget', () => {
    const record = Object.fromEntries(Array.from({ length: 49_999 }, (_, i) => [`field${i}`, i]));
    const map = snapshotPublicCollection(new Map([[0, record], [1, {}]])) as ReadonlyMap<number, Record<string, number>>;
    const set = snapshotPublicCollection(new Set([record, {}])) as ReadonlySet<Record<string, number>>;
    expect(map.size).to.equal(1);
    expect(set.size).to.equal(1);
    expect(Object.keys(map.get(0)!)).to.have.length(49_999);
    expect(Object.keys([...set][0]!)).to.have.length(49_999);
    expect(Object.isFrozen(map.get(0))).to.equal(true);
    expect(Object.isFrozen([...set][0])).to.equal(true);
  });

  it('bounds work when repeated rejected rows expose large accessor-only records', () => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < 10_000; i += 1) Object.defineProperty(record, `field${i}`, {
      enumerable: true,
      get() { throw new Error('accessor must never run'); },
    });
    const source = Array.from({ length: 30 }, () => new Proxy(record, {
      ownKeys(target) { return Reflect.ownKeys(target); },
    }));
    const snapshot = snapshotPublicCollection(source) as unknown[];
    expect(snapshot.length).to.be.lessThan(source.length);
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(snapshot.filter(Boolean).every(row => row !== null && typeof row === 'object' && Object.keys(row).length === 0)).to.equal(true);
  });
});
