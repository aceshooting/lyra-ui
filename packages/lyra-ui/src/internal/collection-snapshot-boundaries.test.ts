import { snapshotStructuredData, admitSnapshotArray, projectSnapshotArray } from './structured-snapshot.js';
import { expect, fixture, html } from '@open-wc/testing';
import { property } from 'lit/decorators.js';
import {
  collectionSupport,
  collectionTruncationWarningKey,
  eventCollectionSupport,
  publicCollectionTruncation,
  snapshotPublicCollection,
  type CollectionTruncation,
} from './collection-snapshot.js';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

class TruncationLog extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['entries', 'rows', 'items'];
  protected static override readonly identityCollectionProperties = ['items'];
  protected static readonly appendOrderedCollectionProperties = ['entries', 'items'];

  /** Append-ordered: the newest rows are at the end. */
  @property({ attribute: false }) entries: readonly unknown[] = [];
  /** Ordinary owned collection: keeps its leading rows. */
  @property({ attribute: false }) rows: readonly unknown[] = [];
  /** Append-ordered identity collection. */
  @property({ attribute: false }) items: readonly object[] = [];
}
customElements.define(tag('truncation-log-test'), TruncationLog);

class SnapshotRoundTrip extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['rows', 'registry', 'members'];
  protected static override readonly identityCollectionProperties = ['registry', 'members'];
  protected static override readonly immutableEventDetails = ['lr-round-trip'];

  @property({ attribute: false }) rows: readonly unknown[] = [];
  @property({ attribute: false }) registry: ReadonlyMap<string, object> = new Map();
  @property({ attribute: false }) members: ReadonlySet<object> = new Set();

  emitRows(): CustomEvent<{ rows: readonly unknown[] }> {
    return this.emit('lr-round-trip', { rows: this.rows }) as CustomEvent<{ rows: readonly unknown[] }>;
  }
}
customElements.define(tag('snapshot-round-trip-test'), SnapshotRoundTrip);

describe('public collection snapshot round trips', () => {
  it('retains readonly Dates across repeated snapshots without exposing native mutation', () => {
    const time = Date.UTC(2026, 0, 2);
    let rows = [{ when: new Date(time), invalid: new Date(NaN) }];
    for (let pass = 0; pass < 3; pass += 1) {
      const results: unknown[] = [];
      rows = snapshotPublicCollection([...rows], undefined, {
        onResult: result => results.push(result),
      }) as typeof rows;
      expect(Object.keys(rows)).to.deep.equal(['0']);
      expect(rows[0]!.when.getTime()).to.equal(time);
      expect(Number.isNaN(rows[0]!.invalid.getTime())).to.equal(true);
      expect(Object.isFrozen(rows[0]!.when)).to.equal(true);
      expect(() => rows[0]!.when.setTime(0)).to.throw(TypeError);
      expect(() => Date.prototype.setTime.call(rows[0]!.when, 0)).to.throw(TypeError);
      expect(results).to.deep.equal([{ invalid: false, truncated: false }]);
    }
  });

  it('retains Map and Set contents, cycles and shared identities on a second snapshot', () => {
    const shared = { when: new Date(123) };
    const map = new Map<unknown, unknown>();
    const set = new Set<unknown>();
    map.set(shared, shared);
    map.set('self', map);
    map.set('set', set);
    set.add(shared);
    set.add(set);
    set.add(map);
    const source = { shared, map, set };
    const first = snapshotPublicCollection(source) as typeof source;
    const second = snapshotPublicCollection({ ...first }) as typeof source;
    expect(second.map.size).to.equal(3);
    expect(second.set.size).to.equal(3);
    expect(second.map.get(second.shared) === second.shared).to.equal(true);
    expect(second.map.get('self') === second.map).to.equal(true);
    expect(second.map.get('set') === second.set).to.equal(true);
    expect(second.set.has(second.shared)).to.equal(true);
    expect(second.set.has(second.set)).to.equal(true);
    expect(second.set.has(second.map)).to.equal(true);
    expect(second.shared.when.getTime()).to.equal(123);
    expect(second.shared === first.shared).to.equal(false);
    expect(Object.isFrozen(second.map)).to.equal(true);
    expect(Object.isFrozen(second.set)).to.equal(true);
    expect('set' in second.map).to.equal(false);
    expect('add' in second.set).to.equal(false);
    expect(() => Map.prototype.set.call(second.map, 'extra', 1)).to.throw(TypeError);
    expect(() => Set.prototype.add.call(second.set, 1)).to.throw(TypeError);
  });

  it('reapplies stricter entry, node and depth budgets to trusted Map and Set snapshots', () => {
    for (const source of [new Map([[0, { a: 1 }], [1, { a: 2 }]]), new Set([{ a: 1 }, { a: 2 }])]) {
      const first = snapshotPublicCollection(source);
      for (const limits of [{ entries: 1 }, { nodes: 2 }]) {
        const losses: CollectionTruncation[] = [];
        const second = snapshotPublicCollection(first, undefined, {
          limits, onTruncate: loss => losses.push(loss),
        }) as ReadonlyMap<unknown, unknown> | ReadonlySet<unknown>;
        expect(second.size).to.equal(1);
        expect(losses).to.deep.equal([{ kept: 'oldest', retained: 1, source: 2 }]);
      }
      const deep = snapshotPublicCollection([first], undefined, { limits: { depth: 1 } });
      expect(deep).to.deep.equal([]);
    }
  });

  it('does not treat caller-frozen records or facade imitations as trusted snapshots', () => {
    const nested = { count: 1 };
    let reads = 0;
    const imitation = Object.freeze({
      nested,
      get size() { reads += 1; return 10; },
      [Symbol.iterator]() { reads += 1; throw new Error('must not iterate'); },
    });
    const copy = snapshotPublicCollection(imitation) as typeof imitation;
    nested.count = 2;
    expect(copy.nested.count).to.equal(1);
    expect(reads).to.equal(0);
    expect(Object.hasOwn(copy, 'size')).to.equal(false);
    expect(Object.isFrozen(copy.nested)).to.equal(true);
  });

  it('reapplies record policy to payloads inside trusted facades', () => {
    const first = snapshotPublicCollection(new Map([['item', { kept: 1, omitted: 2 }]]));
    const second = snapshotPublicCollection(first, undefined, {
      recordKey: key => key === 'omitted' ? 'omit' : 'copy',
    }) as ReadonlyMap<string, object>;
    expect(second.get('item')).to.deep.equal({ kept: 1 });
  });

  it('preserves values through public property, event and property reassignment', async () => {
    const el = await fixture<SnapshotRoundTrip>(html`<lr-snapshot-round-trip-test></lr-snapshot-round-trip-test>`);
    const source = { when: new Date(123), map: new Map([['item', { value: 1 }]]), set: new Set([2]) };
    el.rows = [source];
    el.rows = [...el.rows];
    const event = el.emitRows();
    el.rows = [...event.detail.rows];
    const row = el.rows[0] as typeof source;
    expect(row.when.getTime()).to.equal(123);
    expect(row.map.get('item')).to.deep.equal({ value: 1 });
    expect([...row.set]).to.deep.equal([2]);
    expect(Object.isFrozen(row.map.get('item'))).to.equal(true);
  });

  it('retains identity facade values when reassigning them and detaches them at owned boundaries', async () => {
    const el = await fixture<SnapshotRoundTrip>(html`<lr-snapshot-round-trip-test></lr-snapshot-round-trip-test>`);
    const other = await fixture<SnapshotRoundTrip>(html`<lr-snapshot-round-trip-test></lr-snapshot-round-trip-test>`);
    const item = { value: 1 };
    el.registry = new Map([['item', item]]);
    el.members = new Set([item]);
    other.registry = el.registry;
    other.members = el.members;
    expect(other.registry.get('item') === item).to.equal(true);
    expect(other.members.has(item)).to.equal(true);
    other.rows = [other.registry, other.members];
    item.value = 2;
    const [map, set] = other.rows as [ReadonlyMap<string, typeof item>, ReadonlySet<typeof item>];
    expect(map.get('item')).to.deep.equal({ value: 1 });
    expect([...set]).to.deep.equal([{ value: 1 }]);
    expect(map.get('item') === [...set][0]).to.equal(true);
    expect(Object.isFrozen(item)).to.equal(false);
  });

  it('creates fresh wrappers and payloads in the destination realm', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const view = frame.contentWindow!;
    const realm = view as unknown as { Date: DateConstructor; Object: ObjectConstructor; Array: ArrayConstructor };
    const first = snapshotPublicCollection([{
      when: new Date(123), map: new Map([['item', { value: 1 }]]), set: new Set([{ value: 2 }]),
    }]);
    const second = snapshotPublicCollection(first, view) as Array<{
      when: Date; map: ReadonlyMap<string, object>; set: ReadonlySet<object>;
    }>;
    expect(Object.keys(second)).to.deep.equal(['0']);
    expect(second instanceof realm.Array).to.equal(true);
    expect(second[0]!.when instanceof realm.Date).to.equal(true);
    expect(second[0]!.when.constructor === realm.Date).to.equal(true);
    expect(second[0]!.when.getTime()).to.equal(123);
    expect(second[0]!.map.size).to.equal(1);
    expect(Object.getPrototypeOf(second[0]!.map) === realm.Object.prototype).to.equal(true);
    expect(Object.getPrototypeOf(second[0]!.map.get('item')) === realm.Object.prototype).to.equal(true);
    expect(Object.getPrototypeOf([...second[0]!.set][0]) === realm.Object.prototype).to.equal(true);
    const third = snapshotPublicCollection(second) as typeof second;
    expect(third[0]!.when instanceof Date).to.equal(true);
    expect(third[0]!.map.size).to.equal(1);
  });
});

/** Captures dev diagnostics for the duration of `run` (they are this suite's subject). */
function captureWarnings(run: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    run();
  } finally {
    console.warn = original;
  }
  return warnings;
}

describe('public collection truncation is reported and can keep the newest rows', () => {
  it('keeps the trailing entries of an over-limit array when asked to retain the newest', () => {
    const source = Array.from({ length: 12_000 }, (_, index) => index);
    const reports: CollectionTruncation[] = [];
    const snapshot = snapshotPublicCollection(source, undefined, {
      retain: 'newest',
      onTruncate: (truncation) => reports.push(truncation),
    }) as readonly number[];
    expect(snapshot.length).to.equal(10_000);
    expect(snapshot[0]).to.equal(2_000);
    expect(snapshot[snapshot.length - 1]).to.equal(11_999);
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(reports).to.deep.equal([{ kept: 'newest', retained: 10_000, source: 12_000 }]);
  });

  it('keeps the newest contiguous rows that fit the retained-value budget', () => {
    const source = Array.from({ length: 10_000 }, (_, index) => ({ index, a: 1, b: 2, c: 3, d: 4 }));
    const reports: CollectionTruncation[] = [];
    const snapshot = snapshotPublicCollection(source, undefined, {
      retain: 'newest',
      onTruncate: (truncation) => reports.push(truncation),
    }) as readonly { index: number }[];
    expect(snapshot.length).to.be.greaterThan(0);
    expect(snapshot.length).to.be.lessThan(source.length);
    expect(snapshot[snapshot.length - 1]!.index, 'the newest row survives').to.equal(9_999);
    expect(snapshot[0]!.index, 'the retained rows are one contiguous run').to.equal(10_000 - snapshot.length);
    expect(reports).to.have.length(1);
    expect(reports[0]).to.deep.equal({ kept: 'newest', retained: snapshot.length, source: 10_000 });
  });

  it('reports the default leading truncation, and stays quiet when nothing is dropped', () => {
    const reports: CollectionTruncation[] = [];
    const onTruncate = (truncation: CollectionTruncation) => reports.push(truncation);
    const kept = snapshotPublicCollection(Array.from({ length: 10_001 }, (_, index) => index), undefined, { onTruncate }) as
      readonly number[];
    expect(kept[0]).to.equal(0);
    expect(kept.length).to.equal(10_000);
    expect(reports).to.deep.equal([{ kept: 'oldest', retained: 10_000, source: 10_001 }]);

    reports.length = 0;
    snapshotPublicCollection(Array.from({ length: 10_000 }, (_, index) => index), undefined, { onTruncate });
    snapshotPublicCollection([{ label: 'small' }], undefined, { onTruncate });
    expect(reports).to.deep.equal([]);
  });

  it('counts rows the boundary cannot own as dropped', () => {
    const reports: CollectionTruncation[] = [];
    const snapshot = snapshotPublicCollection([{ label: 'kept' }, new URL('https://example.test/'), 'kept'], undefined, {
      onTruncate: (truncation) => reports.push(truncation),
    }) as readonly unknown[];
    expect(snapshot.length).to.equal(3);
    expect(reports).to.deep.equal([{ kept: 'oldest', retained: 2, source: 3 }]);
  });

  it('applies the append-ordered policy at an enrolled accessor and warns once per property', async () => {
    const el = await fixture<TruncationLog>(html`<lr-truncation-log-test></lr-truncation-log-test>`);
    const source = Array.from({ length: 10_500 }, (_, index) => ({ index }));
    const warnings = captureWarnings(() => {
      el.entries = source;
      el.entries = [...source];
    });
    expect((el.entries[0] as { index: number }).index).to.equal(500);
    expect((el.entries[el.entries.length - 1] as { index: number }).index).to.equal(10_499);
    expect(publicCollectionTruncation(el, 'entries')).to.deep.equal({
      kept: 'newest',
      retained: 10_000,
      source: 10_500,
    });
    expect(warnings).to.have.length(1);
    expect(warnings[0]).to.contain('<lr-truncation-log-test>');
    expect(warnings[0]).to.contain('entries');
    expect(warnings[0]).to.contain('10000 of 10500');
    const issued = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
    expect(issued?.has(collectionTruncationWarningKey('lr-truncation-log-test', 'entries')), 'seedable key')
      .to.equal(true);

    el.entries = source.slice(0, 3);
    expect(publicCollectionTruncation(el, 'entries'), 'a later complete assignment clears the record').to.equal(undefined);
  });

  it('keeps the leading rows of an ordinary owned property and reports them', async () => {
    const el = await fixture<TruncationLog>(html`<lr-truncation-log-test></lr-truncation-log-test>`);
    const warnings = captureWarnings(() => {
      el.rows = Array.from({ length: 10_002 }, (_, index) => index);
    });
    expect(el.rows[0]).to.equal(0);
    expect(publicCollectionTruncation(el, 'rows')).to.deep.equal({ kept: 'oldest', retained: 10_000, source: 10_002 });
    expect(warnings.filter((warning) => warning.includes('rows'))).to.have.length(1);
  });

  it('keeps the newest item identities of an append-ordered identity collection', async () => {
    const el = await fixture<TruncationLog>(html`<lr-truncation-log-test></lr-truncation-log-test>`);
    const source = Array.from({ length: 10_003 }, (_, index) => ({ index }));
    captureWarnings(() => {
      el.items = source;
    });
    expect(el.items.length).to.equal(10_000);
    expect(el.items[0] === source[3], 'item identity is retained').to.equal(true);
    expect(el.items[el.items.length - 1] === source[10_002]).to.equal(true);
    expect(publicCollectionTruncation(el, 'items')).to.deep.equal({ kept: 'newest', retained: 10_000, source: 10_003 });
  });
});

describe('public collection snapshots at hostile input boundaries', () => {
  it('exposes repeatable Map entry iterators over detached keys and values', () => {
    const key = { id: 'original' };
    const value = { count: 1 };
    const source = new Map([[key, value]]);
    const snapshot = snapshotPublicCollection(source) as ReadonlyMap<typeof key, typeof value>;
    key.id = 'changed';
    value.count = 2;
    source.clear();
    const first = [...snapshot.entries()];
    const second = [...snapshot.entries()];
    expect(first).to.deep.equal([[{ id: 'original' }, { count: 1 }]]);
    expect(second).to.deep.equal(first);
    expect(first[0]![0] === key).to.equal(false);
    expect(first[0]![1] === value).to.equal(false);
    expect(Object.isFrozen(first[0]![0])).to.equal(true);
    expect(Object.isFrozen(first[0]![1])).to.equal(true);
  });

  it('reports omitted own data keys without dropping the surrounding record', () => {
    const source = { kept: { value: 1 }, rejected: new URL('https://example.test/') };
    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const losses: CollectionTruncation[] = [];
    const snapshot = snapshotPublicCollection(source, undefined, {
      recordKey: (key) => key === 'rejected' ? 'omit' : 'copy',
      onResult: (result) => results.push(result),
      onTruncate: (loss) => losses.push(loss),
    }) as { kept: { value: number } };
    expect(snapshot).to.deep.equal({ kept: { value: 1 } });
    expect(snapshot.kept === source.kept).to.equal(false);
    expect(Object.isFrozen(snapshot.kept)).to.equal(true);
    expect(results).to.deep.equal([{ invalid: true, truncated: false }]);
    expect(losses).to.deep.equal([]);
  });

  it('rejects a row whose prototype becomes unreadable after classification and retains later rows', () => {
    let prototypeReads = 0;
    const hostile = new Proxy({ label: 'unreadable' }, {
      getPrototypeOf(target) {
        prototypeReads += 1;
        if (prototypeReads > 1) throw new Error('prototype access revoked');
        return Reflect.getPrototypeOf(target);
      },
    });
    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const losses: CollectionTruncation[] = [];
    const snapshot = snapshotPublicCollection([hostile, { label: 'safe' }], undefined, {
      onResult: (result) => results.push(result),
      onTruncate: (loss) => losses.push(loss),
    }) as unknown[];
    expect(prototypeReads).to.equal(2);
    expect(snapshot.length).to.equal(2);
    expect(0 in snapshot).to.equal(false);
    expect(snapshot[1]).to.deep.equal({ label: 'safe' });
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(results).to.deep.equal([{ invalid: true, truncated: true }]);
    expect(losses).to.deep.equal([{ kept: 'oldest', retained: 1, source: 2 }]);
  });

  it('contains failed loss-count enumeration after a root record exhausts its node allowance', () => {
    let enumerations = 0;
    const source = new Proxy({ first: 1, second: 2 }, {
      ownKeys(target) {
        enumerations += 1;
        if (enumerations > 1) throw new Error('enumeration access revoked');
        return Reflect.ownKeys(target);
      },
    });
    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const losses: CollectionTruncation[] = [];
    const snapshot = snapshotPublicCollection(source, undefined, {
      limits: { nodes: 1 },
      onResult: (result) => results.push(result),
      onTruncate: (loss) => losses.push(loss),
    });
    expect(enumerations).to.equal(2);
    expect(snapshot).to.deep.equal({});
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(results).to.deep.equal([{ invalid: false, truncated: true }]);
    expect(losses, 'an unavailable source count must not produce a guessed loss report').to.deep.equal([]);
  });

  it('keeps a bounded nested prefix only for callers that opt in', () => {
    const source = [{ data: Array.from({ length: 5 }, (_, index) => index) }, { data: [9] }];
    const ordinary = snapshotPublicCollection(source, undefined, { limits: { entries: 3 } }) as unknown[];
    expect(ordinary).to.deep.equal([]);

    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const retained = snapshotPublicCollection(source, undefined, {
      limits: { entries: 3 },
      nestedArrayPrefix: true,
      onResult: (result) => results.push(result),
    }) as Array<{ data: readonly number[] }>;
    expect(retained[0]?.data).to.deep.equal([0, 1, 2]);
    expect(retained[1]).to.deep.equal({ data: [9] });
    expect(Object.isFrozen(retained[0]?.data)).to.equal(true);
    expect(results).to.deep.equal([{ invalid: false, truncated: true }]);
  });

  it('supports bounded structural policy without invoking an accessor', () => {
    let reads = 0;
    const value: Record<string, unknown> = { safe: 1, opaque: new URL('https://example.test/') };
    Object.defineProperty(value, 'danger', { enumerable: true, get() { reads += 1; return 3; } });
    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const snapshot = snapshotPublicCollection(value, undefined, {
      recordKey: (key) => key === 'opaque' ? 'preserve' : 'copy',
      onResult: (result) => results.push(result),
    }) as Record<string, unknown>;
    expect(snapshot['safe']).to.equal(1);
    expect(snapshot['opaque']).to.equal(value['opaque']);
    expect('danger' in snapshot).to.equal(false);
    expect(reads).to.equal(0);
    expect(results).to.deep.equal([{ invalid: true, truncated: false }]);
  });

  it('reports a tighter depth ceiling without changing the ordinary default', () => {
    const source = [{ nested: { deeper: { value: 1 } } }, { value: 2 }];
    const results: Array<{ invalid: boolean; truncated: boolean }> = [];
    const limited = snapshotPublicCollection(source, undefined, {
      limits: { depth: 2 },
      onResult: (result) => results.push(result),
    }) as unknown[];
    expect(limited).to.deep.equal([]);
    expect(results).to.deep.equal([{ invalid: false, truncated: true }]);
    expect(snapshotPublicCollection(source)).to.deep.equal(source);
  });

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

class EventOnlyEmitter extends LyraElement<{ 'lr-event-only': CustomEvent<{ rows: { id: number }[] }> }> {
  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = ['lr-event-only'];

  fire(rows: { id: number }[]): CustomEvent<{ rows: { id: number }[] }> {
    return this.emit('lr-event-only', { rows });
  }
}
customElements.define(tag('event-only-emitter-test'), EventOnlyEmitter);

describe('event-only collection support', () => {
  it('detaches and freezes enrolled event details exactly like the full support', async () => {
    const el = await fixture<EventOnlyEmitter>(html`<lr-event-only-emitter-test></lr-event-only-emitter-test>`);
    const rows = [{ id: 1 }];
    const event = el.fire(rows);
    expect(event.detail.rows === rows, 'the detail is a detached copy').to.equal(false);
    expect(Object.isFrozen(event.detail.rows)).to.equal(true);
    expect(event.detail.rows.map((row) => row.id)).to.deep.equal([1]);
  });

  it('reports a class that owns collection properties but declared the event-only support', () => {
    class Misenrolled extends LyraElement {
      protected static override collectionSupport = eventCollectionSupport;
      protected static override readonly ownedCollectionProperties = ['rows'];
      @property({ attribute: false }) rows: readonly unknown[] = [];
    }
    const warnings = captureWarnings(() => {
      customElements.define(tag('misenrolled-collection-test'), Misenrolled);
    });
    expect(warnings).to.have.length(1);
    expect(warnings[0]).to.contain('collectionSupport');
  });
});


describe('structured collection policies', () => {
  it('shares JSON value ownership while reporting omitted and bounded branches independently', () => {
    const source = { safe: { nested: [1, 2] }, invalid: () => undefined, long: new Array(10_001) };
    const result = snapshotStructuredData(source, { profile: 'form', structure: { shape: 'record', depth: 0 } });
    const snapshot = result.value as typeof source;
    expect(result.invalid).to.equal(true);
    expect(result.truncated).to.equal(true);
    expect(Object.hasOwn(snapshot, 'invalid')).to.equal(false);
    expect(snapshot.long.length).to.equal(10_000);
    expect(snapshot.safe === source.safe).to.equal(false);
    expect(Object.isFrozen(snapshot.safe.nested)).to.equal(true);
  });

  it('keeps the schema sparse-array policy separate from the public array ceiling', () => {
    const source: unknown[] = new Array(50_001);
    source[49_999] = { type: 'string' };
    const schema = snapshotStructuredData(source, { profile: 'schema' }).value as unknown[];
    const collection = snapshotPublicCollection(source) as unknown[];
    expect(schema.length).to.equal(50_000);
    expect(49_999 in schema).to.equal(true);
    expect(0 in schema).to.equal(false);
    expect(collection.length).to.equal(10_000);
  });

  it('reclaims aliases from failed branches without revisiting a retained sibling', () => {
    const shared = { value: 'before' };
    const failed = new Proxy({ shared, broken: true }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'broken') {
          shared.value = 'after';
          throw new Error('unreadable descriptor');
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const result = snapshotStructuredData({ failed, shared }, { profile: 'form' });
    const snapshot = result.value as { shared: { value: string } };
    expect(result.invalid).to.equal(true);
    expect(Object.hasOwn(snapshot, 'failed')).to.equal(false);
    expect(snapshot.shared.value).to.equal('after');
    expect(Object.isFrozen(snapshot.shared)).to.equal(true);
  });

  it('contains revocation during array admission and never calls an entry accessor', () => {
    let revoke: () => void;
    const revocable = Proxy.revocable(['value'], {
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        if (key === 'length') revoke();
        return descriptor;
      },
    });
    revoke = revocable.revoke;
    const admitted = admitSnapshotArray(revocable.proxy);
    expect(projectSnapshotArray(admitted, value => value, { missing: null })).to.equal(undefined);
    let reads = 0;
    const source = Object.defineProperty([0], '0', { get: () => { reads += 1; return 1; } });
    expect(projectSnapshotArray(admitSnapshotArray(source), value => value, { missing: null })).to.deep.equal([null]);
    expect(reads).to.equal(0);
  });
});


it('treats a same-source identity collection assignment as a no-op and a new array as the update', () => {
  const el = document.createElement(tag('truncation-log-test')) as TruncationLog;
  const source = [{ label: 'Before' }];
  el.items = source;
  const first = el.items;
  source[0]!.label = 'After';
  el.items = source;
  expect(el.items === first).to.equal(true);
  el.items = first;
  expect(el.items === first).to.equal(true);
  el.items = [...source];
  expect(el.items === first).to.equal(false);
  expect(el.items[0] === source[0]).to.equal(true);
  expect((el.items[0] as { label: string }).label).to.equal('After');
});
