import { expect } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { collectionSupport, snapshotPublicCollection, publicCollectionTruncation, collectionTruncationWarningKey } from './collection-snapshot.js';
import { tag } from './prefix.js';

class BoundedCollections extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override ownedCollectionProperties = ['rows', 'items', 'registry'];
  protected static override identityCollectionProperties = ['items', 'registry'];
  protected static appendOrderedCollectionProperties = ['items'];
  protected static readonly ownedCollectionLimits = {
    rows: { entries: 2 }, items: { entries: 2 }, registry: { entries: 2 },
  };
  static override properties = { rows: { attribute: false }, items: { attribute: false }, registry: { attribute: false } };
  declare rows: readonly unknown[];
  declare items: readonly unknown[];
  declare registry: ReadonlyMap<number, object>;
}
customElements.define(tag('bounded-collections-test'), BoundedCollections);

class SmallerCollections extends BoundedCollections {
  protected static override readonly ownedCollectionLimits = {
    rows: { entries: 1 }, items: { entries: 1 }, registry: { entries: 1 },
  };
}
customElements.define(tag('smaller-collections-test'), SmallerCollections);
const warnings = (globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
for (const element of ['bounded-collections-test', 'smaller-collections-test'])
  for (const name of ['rows', 'items', 'registry'])
    warnings?.add(collectionTruncationWarningKey(tag(element), name));

it('applies declared ceilings before cloning and retains the enrolled end', () => {
  const el = new BoundedCollections();
  el.rows = [1, 2, 3];
  expect(el.rows).to.deep.equal([1, 2]);
  el.items = [1, 2, 3];
  expect(el.items).to.deep.equal([2, 3]);
  expect(publicCollectionTruncation(el, 'items')).to.deep.equal({ kept: 'newest', retained: 2, source: 3 });
  el.registry = new Map([[1, {}], [2, {}], [3, {}]]);
  expect(el.registry.size).to.equal(2);
});

it('constructs detached records and arrays without per-entry defineProperty calls', () => {
  const original = Object.defineProperty;
  let calls = 0;
  let result: unknown;
  const el = new BoundedCollections();
  try {
    Object.defineProperty = ((...args: Parameters<typeof Object.defineProperty>) => {
      calls += 1;
      return original(...args);
    }) as typeof Object.defineProperty;
    result = snapshotPublicCollection([{ label: 'one' }, { label: 'two' }]);
    el.items = [{ label: 'one' }, { label: 'two' }];
  } finally {
    Object.defineProperty = original;
  }
  expect(calls).to.equal(0);
  expect(result).to.deep.equal([{ label: 'one' }, { label: 'two' }]);
});

it('tracks assigned source objects weakly', () => {
  const original = globalThis.WeakRef;
  const source = [1];
  let sourceReferences = 0;
  try {
    globalThis.WeakRef = class<T extends WeakKey> extends original<T> {
      constructor(value: T) {
        super(value);
        if (value === source) sourceReferences += 1;
      }
    };
    new BoundedCollections().rows = source;
  } finally {
    globalThis.WeakRef = original;
  }
  expect(sourceReferences).to.equal(1);
});

it('does not invoke array accessors or species during identity admission', () => {
  const el = new BoundedCollections();
  let reads = 0;
  const source = [1, 2];
  Object.defineProperty(source, '0', { get() { reads += 1; return 3; } });
  Object.defineProperty(source, 'constructor', { get() { reads += 1; return Array; } });
  el.items = source;
  expect(reads).to.equal(0);
  expect(Object.hasOwn(el.items, 0)).to.equal(false);
  expect(el.items[1]).to.equal(2);
});

it('admits changed nested records on a fresh appended array even with a shared prefix', () => {
  const record = { nested: { value: 1 } };
  const first = snapshotPublicCollection([record]) as typeof record[];
  record.nested.value = 2;
  const next = snapshotPublicCollection([record, { nested: { value: 3 } }]) as typeof record[];
  expect(first[0]!.nested.value).to.equal(1);
  expect(next[0]!.nested.value).to.equal(2);
});

it('keeps prototype-named fields as frozen own data properties', () => {
  const source = JSON.parse('{"__proto__":{"value":1},"constructor":2}');
  const result = snapshotPublicCollection([source]) as Record<string, unknown>[];
  expect(Object.hasOwn(result[0]!, '__proto__')).to.equal(true);
  expect(result[0]!['__proto__']).to.deep.equal({ value: 1 });
  expect(Object.getPrototypeOf(result[0])).to.equal(Object.prototype);
  expect(Object.isFrozen(result[0])).to.equal(true);
  expect(Object.isFrozen(result)).to.equal(true);
});

it('uses subclass limits for inherited accessors without changing base admission', () => {
  const base = new BoundedCollections();
  const child = new SmallerCollections();
  base.rows = [1, 2, 3];
  child.rows = [1, 2, 3];
  child.items = [1, 2, 3];
  expect(base.rows).to.deep.equal([1, 2]);
  expect(child.rows).to.deep.equal([1]);
  expect(child.items).to.deep.equal([3]);
});
