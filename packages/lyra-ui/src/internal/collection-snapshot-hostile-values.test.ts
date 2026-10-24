import { expect } from '@open-wc/testing';
import { snapshotPublicCollection, type CollectionTruncation } from './collection-snapshot.js';

describe('collection snapshots with rejected nested values', () => {
  it('rejects an entire nested array without invoking an entry accessor', () => {
    let reads = 0;
    const nested = Object.defineProperty([1], '0', {
      get() { reads += 1; return 1; },
    });
    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const snapshot = snapshotPublicCollection([{ nested }, { label: 'safe' }], undefined, {
      onResult: result => results.push(result),
    }) as unknown[];
    expect(reads).to.equal(0);
    expect(snapshot.length).to.equal(2);
    expect(Object.hasOwn(snapshot, 0)).to.equal(false);
    expect(snapshot[1]).to.deep.equal({ label: 'safe' });
    expect(results).to.deep.equal([{ invalid: true, truncated: true }]);
  });

  it('omits a nested array containing an unsupported value and retains the next root row', () => {
    const snapshot = snapshotPublicCollection([
      { nested: [new Uint8Array([1])] }, { label: 'safe' },
    ]) as unknown[];
    expect(snapshot.length).to.equal(2);
    expect(Object.hasOwn(snapshot, 0)).to.equal(false);
    expect(snapshot[1]).to.deep.equal({ label: 'safe' });
  });

  it('omits rejected Map keys and Set members while detaching their valid neighbors', () => {
    const rejected = new Uint8Array([1]);
    const valid = { label: 'safe' };
    const mapResults: Array<{ invalid: boolean; truncated: boolean }> = [];
    const map = snapshotPublicCollection(new Map<unknown, unknown>([
      [rejected, 'rejected'], ['valid', valid],
    ]), undefined, { onResult: result => mapResults.push(result) }) as ReadonlyMap<unknown, unknown>;
    const setResults: Array<{ invalid: boolean; truncated: boolean }> = [];
    const set = snapshotPublicCollection(new Set([rejected, valid]), undefined, {
      onResult: result => setResults.push(result),
    }) as ReadonlySet<unknown>;
    expect([...map.keys()]).to.deep.equal(['valid']);
    expect(map.get('valid')).to.deep.equal(valid);
    expect(map.get('valid') === valid).to.equal(false);
    expect([...set]).to.deep.equal([valid]);
    expect(set.has(valid)).to.equal(false);
    expect(Object.isFrozen(map.get('valid'))).to.equal(true);
    expect(Object.isFrozen([...set][0])).to.equal(true);
    expect(mapResults).to.deep.equal([{ invalid: true, truncated: true }]);
    expect(setResults).to.deep.equal([{ invalid: true, truncated: true }]);
  });

  it('reports entry truncation inside a retained Map or Set without dropping the surrounding record', () => {
    for (const nested of [new Map([[1, 'first'], [2, 'second'], [3, 'third']]), new Set([1, 2, 3])]) {
      const results: Array<{ invalid: boolean; truncated: boolean }> = [];
      const snapshot = snapshotPublicCollection({ nested }, undefined, {
        limits: { entries: 2 },
        onResult: result => results.push(result),
      }) as { nested: ReadonlyMap<number, string> | ReadonlySet<number> };
      expect(snapshot.nested.size).to.equal(2);
      expect([...snapshot.nested]).to.deep.equal([...nested].slice(0, 2));
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(Object.isFrozen(snapshot.nested)).to.equal(true);
      expect(results).to.deep.equal([{ invalid: false, truncated: true }]);
    }
  });

  it('preserves a null prototype when a root record exceeds its node allowance', () => {
    const source = Object.assign(Object.create(null) as Record<string, number>, { first: 1, second: 2, third: 3 });
    const losses: CollectionTruncation[] = [];
    const snapshot = snapshotPublicCollection(source, undefined, {
      limits: { nodes: 1 },
      onTruncate: loss => losses.push(loss),
    }) as object;
    expect(Object.getPrototypeOf(snapshot) === null).to.equal(true);
    expect(Object.keys(snapshot)).to.deep.equal([]);
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(losses).to.deep.equal([{ kept: 'oldest', retained: 0, source: 2 }]);
  });

  it('rejects nonfinite native rectangle coordinates instead of publishing invalid geometry', () => {
    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const snapshot = snapshotPublicCollection([
      new DOMRectReadOnly(Infinity, 0, 1, 1),
      new DOMRectReadOnly(1, 2, 3, 4),
    ], undefined, { onResult: result => results.push(result) }) as unknown[];
    expect(Object.hasOwn(snapshot, 0)).to.equal(false);
    expect(snapshot[1]).to.deep.equal({ x: 1, y: 2, width: 3, height: 4, top: 2, right: 4, bottom: 6, left: 1 });
    expect(Object.isFrozen(snapshot[1])).to.equal(true);
    expect(results).to.deep.equal([{ invalid: true, truncated: true }]);
  });

  it('fails closed for opaque values when optional platform constructors are unavailable', () => {
    const descriptors = new Map<string, PropertyDescriptor>(['Blob', 'DOMRectReadOnly'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)!]));
    let snapshot: unknown;
    try {
      for (const name of descriptors.keys()) Object.defineProperty(globalThis, name, { configurable: true, value: undefined });
      snapshot = snapshotPublicCollection([new URL('https://example.test/'), { label: 'safe' }]);
    } finally {
      for (const [name, descriptor] of descriptors) Object.defineProperty(globalThis, name, descriptor);
    }
    expect((snapshot as unknown[]).length).to.equal(2);
    expect(Object.hasOwn(snapshot as object, 0)).to.equal(false);
    expect((snapshot as unknown[])[1]).to.deep.equal({ label: 'safe' });
  });
});
