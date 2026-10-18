import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraIndexedView, LyraRangeSource } from '../data-sources.js';
import { SourceWindowController } from './source-window-controller.js';

type Row = { key: string; text: string };
const row = (index: number): Row => ({ key: `key-${index}`, text: `Row ${index}` });
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(pageSize = 100, maxRows = 500, maxPages = 5) {
  const controllers = new Set<ReactiveController>();
  let paints = 0;
  let explicitRefresh = 0;
  const host = Object.assign(document.createElement('div'), {
    addController: (c: ReactiveController) => controllers.add(c),
    removeController: (c: ReactiveController) => controllers.delete(c),
    requestUpdate: (name?: PropertyKey) => { if (name === undefined) explicitRefresh++; },
    updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new SourceWindowController<Row>(host, {
    pageSize, maxRows, maxPages, maxConcurrent: 2, keyOf: value => value.key,
    normalize: value => {
      if (typeof value !== 'object' || value === null || typeof (value as Row).key !== 'string') throw new TypeError('Invalid row');
      return value as Row;
    },
    onChange: () => { paints++; host.requestUpdate('windowVersion'); },
  });
  const owner = {};
  return { host, control, owner, paints: () => paints, explicitRefresh: () => explicitRefresh,
    bind: (view: LyraIndexedView<Row>, epoch = 0) => control.bind({ owner, revision: 1, epoch, locale: 'en', view }),
    disconnect: () => { host.remove(); controllers.forEach(c => c.hostDisconnected?.()); },
    reconnect: () => { document.body.append(host); controllers.forEach(c => c.hostConnected?.()); } };
}

function range(reads: number[]): LyraRangeSource<Row> {
  return { count: 1_000_000, read: async ({ offset, limit }) => {
    reads.push(offset);
    return Array.from({ length: limit }, (_, i) => row(offset + i));
  }, indexOfKey: async key => Number(key.slice(4)) };
}

describe('SourceWindowController', () => {

  it('retains overlapping wanted pages when the first demanded page is missing', async () => {
    const test = setup(100, 400, 4);
    const reads: number[] = [];
    test.bind(range(reads));
    const pages = (test.control as unknown as { pages: Map<number, unknown> }).pages;
    try {
      for (const index of [200, 300, 400, 0]) {
        expect(await test.control.ensure(index)).to.equal(true);
      }
      expect([...pages.keys()]).to.deep.equal([200, 300, 400, 0]);
      const retained = new Map([200, 300, 400].map(index => [index, pages.get(index)]));
      reads.length = 0;
      test.control.requestRange(100, 500);
      for (const index of [100, 200, 300, 400]) {
        expect(await test.control.ensure(index)).to.equal(true);
      }
      expect(reads, 'only the missing page requires a provider read').to.deep.equal([100]);
      expect([...pages.keys()].sort((a, b) => a - b)).to.deep.equal([100, 200, 300, 400]);
      for (const [index, page] of retained) {
        expect(pages.get(index) === page, `wanted page ${index} keeps its retained rows`).to.equal(true);
      }
      expect(test.control.source.indexOfKey!('key-0')).to.equal(-1);
    } finally { test.disconnect(); }
  });
  it('bounds indexed and ranged keys in UTF-16 units, including direct unallocated keys', async () => {
    const exact = `k${'😀'.repeat(32_767)}x`;
    const oversized = `k${'😀'.repeat(32_768)}`;
    expect(exact.length).to.equal(65_536);
    expect(oversized.length).to.equal(65_537);
    for (const indexed of [true, false]) {
      const test = setup(1, 3, 3);
      let reads = 0;
      const itemAt = (index: number) => { reads++; return { key: index === 0 ? exact : oversized, text: 'Row' }; };
      test.bind(indexed ? { count: 2, itemAt, keyAt: index => index === 0 ? exact : oversized }
        : { count: 2, read: async ({ offset }) => [itemAt(offset)] });
      if (indexed) {
        expect(test.control.source.keyAt!(0) === exact).to.equal(true);
        expect(test.control.source.keyAt!(1) === 1).to.equal(true);
        expect(reads).to.equal(0);
      }
      expect(await test.control.ensure(0)).to.equal(true);
      expect(await test.control.ensure(1)).to.equal(false);
      expect(test.control.source.itemAt(1).state).to.equal('error');
      test.disconnect();
    }
  });

  it('rejects oversized lookup keys before dispatch or cache searches', async () => {
    for (const indexed of [true, false]) {
      const test = setup(1, 3, 3);
      let lookups = 0;
      test.bind(indexed
        ? { count: 1, itemAt: row, indexOfKey: () => { lookups++; return 0; } }
        : { count: 1, read: async () => [row(0)], indexOfKey: async () => { lookups++; return 0; } });
      const oversized = 'x'.repeat(65_537);
      expect(test.control.source.indexOfKey!(oversized)).to.equal(-1);
      expect(await test.control.resolveKey(oversized)).to.equal(null);
      expect(lookups).to.equal(0);
      expect(await test.control.resolveKey('x'.repeat(65_536))).to.equal(0);
      expect(lookups).to.equal(1);
      test.disconnect();
    }
  });

  it('evicts local rows by aggregate key units and releases the budget on replacement', async () => {
    const test = setup(1, 100, 5);
    let reads = 0;
    const key = (index: number) => String(index).padEnd(40_000, 'x');
    const view = { count: 100, itemAt: (index: number) => { reads++; return { key: key(index), text: 'Row' }; } };
    test.bind(view);
    for (let index = 0; index < 50; index++) expect(await test.control.ensure(index)).to.equal(true);
    expect(test.control.source.indexOfKey!(key(0))).to.equal(0);
    expect(await test.control.ensure(50)).to.equal(true);
    expect(test.control.source.indexOfKey!(key(0))).to.equal(-1);
    expect(test.control.source.indexOfKey!(key(50))).to.equal(50);
    expect(await test.control.ensure(0)).to.equal(true);
    expect(reads).to.equal(52);
    test.bind(view, 1);
    for (let index = 0; index < 50; index++) expect(await test.control.ensure(index)).to.equal(true);
    expect(test.control.source.indexOfKey!(key(0))).to.equal(0);
    test.disconnect();
  });

  it('rejects an over-budget exact range atomically and permits retry at the boundary', async () => {
    const test = setup(100, 200, 2);
    let units = 40_000;
    let entriesRead = 0;
    const key = (index: number) => String(index).padEnd(units, 'x');
    test.bind({ count: 200, read: async ({ offset, limit }) => new Proxy(
      Array.from({ length: limit }, (_, i) => ({ key: key(offset + i), text: 'Row' })), {
        get(target, property, receiver) {
          if (typeof property === 'string' && /^\d+$/.test(property)) entriesRead++;
          return Reflect.get(target, property, receiver);
        },
      },
    ) });
    expect(await test.control.ensure(0)).to.equal(false);
    expect(entriesRead).to.equal(51);
    expect(test.control.source.itemAt(0).state).to.equal('error');
    expect(test.control.source.indexOfKey!(key(0))).to.equal(-1);
    expect(test.control.source.keyAt!(0)).to.equal(0);
    units = 20_000;
    expect(await test.control.ensure(0)).to.equal(true);
    expect(test.control.source.indexOfKey!(key(0))).to.equal(0);
    test.disconnect();
  });

  it('evicts ranged pages by combined key units across concurrent completions', async () => {
    const test = setup(25, 100, 4);
    const key = (index: number) => String(index).padEnd(40_000, 'x');
    const reads: number[] = [];
    test.bind({ count: 100, read: async ({ offset, limit }) => {
      reads.push(offset);
      return Array.from({ length: limit }, (_, i) => ({ key: key(offset + i), text: 'Row' }));
    } });
    test.control.requestRange(0, 75);
    await tick();
    expect(reads).to.deep.equal([0, 25, 50]);
    expect(test.control.source.indexOfKey!(key(0))).to.equal(-1);
    expect(test.control.source.indexOfKey!(key(25))).to.equal(25);
    expect(test.control.source.indexOfKey!(key(50))).to.equal(50);
    expect(await test.control.ensure(0)).to.equal(true);
    expect(reads).to.deep.equal([0, 25, 50, 0]);
    expect(test.control.source.indexOfKey!(key(25))).to.equal(-1);
    test.disconnect();
  });

  it('preserves a newer same-source viewport requested by an eviction abort callback', async () => {
    for (const operation of ['range', 'ensure', 'item']) {
      const test = setup(1, 1, 1);
      const reads: number[] = [];
      let release!: (rows: Row[]) => void;
      test.bind({ count: 10, read: ({ offset, signal }) => {
        reads.push(offset);
        if (offset !== 0) return Promise.resolve([row(offset)]);
        signal.addEventListener('abort', () => test.control.requestRange(2, 3));
        return new Promise<Row[]>(resolve => { release = resolve; });
      } });
      test.control.requestRange(0, 1);
      await tick();
      if (operation === 'range') test.control.requestRange(1, 2);
      else if (operation === 'ensure') expect(await test.control.ensure(1)).to.equal(false);
      else test.control.source.itemAt(1);
      await tick();
      expect(reads).to.deep.equal([0, 2]);
      release([row(0)]);
      await tick();
      expect(test.control.source.itemAt(2).state).to.equal('ready');
      test.disconnect();
    }
  });

  it('does not queue an obsolete viewport after a read abort listener replaces the source', async () => {
    const test = setup(1, 3, 3);
    const replacementReads: number[] = [];
    let release!: (rows: Row[]) => void;
    const replacement: LyraRangeSource<Row> = { count: 10, read: async ({ offset }) => { replacementReads.push(offset); return [row(offset)]; } };
    test.bind({ count: 1_000_000, read: ({ signal }) => {
      signal.addEventListener('abort', () => test.bind(replacement, 1));
      return new Promise<Row[]>(resolve => { release = resolve; });
    } });
    test.control.requestRange(0, 1);
    await tick();
    test.control.requestRange(999_999, 1_000_000);
    await tick();
    expect(replacementReads).to.deep.equal([]);
    release([row(0)]);
    await tick();
    expect(await test.control.ensure(0)).to.equal(true);
    expect(replacementReads).to.deep.equal([0]);
    test.disconnect();
  });

  it('rejects synchronous cached key resolutions after rebind or disconnect', () => {
    for (const change of ['rebind', 'disconnect']) {
      const test = setup(1, 3, 3);
      test.bind({ count: 10, itemAt: row, indexOfKey: () => {
        if (change === 'rebind') test.bind({ count: 10, itemAt: row }, 1);
        else test.disconnect();
        return 5;
      } });
      expect(test.control.source.indexOfKey!('key-5')).to.equal(-1);
      test.disconnect();
    }
  });

  it('does not pair an old view with authority created by an abort listener rebind', async () => {
    const test = setup(1, 3, 3);
    let calls = 0;
    let release!: (index: number) => void;
    const replacement = { count: 10, itemAt: row, indexOfKey: () => 8 };
    test.bind({ count: 10, read: async ({ offset }) => [row(offset)], indexOfKey: (_key: string, context) => {
      calls++;
      if (calls === 1) {
        context.signal.addEventListener('abort', () => test.bind(replacement, 1));
        return new Promise<number>(resolve => { release = resolve; });
      }
      return Promise.resolve(3);
    } });
    const first = test.control.resolveKey('key-1');
    await tick();
    const second = test.control.resolveKey('key-3');
    await tick();
    release(1);
    expect(await second).to.equal(null);
    expect(await first).to.equal(null);
    expect(calls).to.equal(1);
    test.disconnect();
  });

  it('bounds physical key lookups and promptly settles superseded and disconnected callers', async () => {
    const test = setup(1, 3, 3);
    const pending: { key: string; resolve: (index: number) => void }[] = [];
    test.bind({ count: 1_000_000, read: async ({ offset }) => [row(offset)],
      indexOfKey: (key: string) => new Promise<number>(resolve => pending.push({ key, resolve })) });
    let firstSettled = false;
    const first = test.control.resolveKey('key-0').then(index => { firstSettled = index === null; });
    await tick();
    let revoked = 0;
    for (let i = 1; i < 100; i++) void test.control.resolveKey(`key-${i}`).then(index => { if (index === null) revoked++; });
    await tick();
    expect(pending.length).to.equal(1);
    expect(firstSettled).to.equal(true);
    expect(revoked).to.equal(98);
    pending[0]!.resolve(0);
    await tick();
    expect(pending.length).to.equal(2);
    expect(pending[1]!.key).to.equal('key-99');
    test.disconnect();
    await tick();
    expect(revoked).to.equal(99);
    pending[1]!.resolve(99);
    await first;
    await tick();
    test.reconnect();
    const last = test.control.resolveKey('key-100');
    await tick();
    expect(pending.length).to.equal(3);
    pending[2]!.resolve(100);
    expect(await last).to.equal(100);
    test.disconnect();
  });

  it('reloads and repaints the bounded last viewport on reconnect without a manual ensure', async () => {
    const test = setup(100, 500, 5);
    const reads: number[] = [];
    let version = 'before';
    test.bind({ count: 1_000_000, read: async ({ offset, limit }) => {
      reads.push(offset);
      return Array.from({ length: limit }, (_, i) => ({ key: `key-${offset + i}`, text: version }));
    } });
    test.control.requestRange(500_000, 500_200);
    await tick();
    expect(reads).to.deep.equal([500_000, 500_100]);
    test.disconnect();
    const paints = test.paints();
    version = 'after';
    test.reconnect();
    await tick();
    expect(reads).to.deep.equal([500_000, 500_100, 500_000, 500_100]);
    expect(test.paints()).to.be.greaterThan(paints);
    const slot = test.control.source.itemAt(500_000);
    expect(slot.state === 'ready' ? slot.value.text : '').to.equal('after');
    expect(test.explicitRefresh()).to.equal(0);
    test.disconnect();
  });

  it('preserves indexed keys before row allocation and bounds local LRU reads', async () => {
    const test = setup(1, 3, 3);
    let reads = 0;
    test.bind({ count: 1_000_000, itemAt: index => { reads++; return row(index); }, keyAt: index => `key-${index}` });
    expect(test.control.source.keyAt!(999_999)).to.equal('key-999999');
    expect(reads).to.equal(0);
    for (const index of [0, 1, 2, 3, 0]) await test.control.ensure(index);
    expect(reads).to.equal(5);
    test.disconnect();
  });

  it('does not commit a synchronous row callback after it replaces its own source', () => {
    const test = setup(1, 3, 3);
    const replacement = { count: 1, itemAt: () => ({ key: 'replacement', text: 'New source' }) };
    test.bind({ count: 1, itemAt: () => { test.bind(replacement, 1); return row(0); } });
    const stale = test.control.source.itemAt(0);
    expect(stale.state === 'ready' ? stale.value.key : '').not.to.equal('key-0');
    const current = test.control.source.itemAt(0);
    expect(current.state === 'ready' ? current.value.key : '').to.equal('replacement');
    test.disconnect();
  });

  it('invalidates pending lookup and range work on adoption without repainting old rows', async () => {
    const test = setup(1, 3, 3);
    let releaseRead!: (rows: Row[]) => void;
    let releaseLookup!: (index: number) => void;
    test.bind({ count: 1, read: () => new Promise(resolve => { releaseRead = resolve; }),
      indexOfKey: () => new Promise<number>(resolve => { releaseLookup = resolve; }) });
    const pending = test.control.ensure(0);
    const lookup = test.control.resolveKey('key-0');
    await tick();
    const other = document.implementation.createHTMLDocument();
    other.body.append(other.adoptNode(test.host));
    test.control.adopted();
    const paints = test.paints();
    releaseRead([row(0)]);
    releaseLookup(0);
    expect(await pending).to.equal(false);
    expect(await lookup).to.equal(null);
    await tick();
    expect(test.paints()).to.equal(paints);
    test.disconnect();
  });

  it('reads first, middle and final million-source rows without materializing the source', async () => {
    const test = setup();
    const reads: number[] = [];
    test.bind(range(reads));
    expect(test.control.source.count).to.equal(1_000_000);
    for (const index of [0, 500_000, 999_999]) {
      expect(await test.control.ensure(index)).to.equal(true);
      const slot = test.control.source.itemAt(index);
      expect(slot.state === 'ready' ? slot.value.key : '').to.equal(`key-${index}`);
    }
    expect(reads).to.deep.equal([0, 500_000, 999_900]);
    expect(await test.control.resolveKey('key-999999')).to.equal(999_999);
    expect(test.explicitRefresh()).to.equal(0);
    test.disconnect();
  });

  it('caps huge range queues before enumeration and rejects invalid metadata and ranges', async () => {
    const test = setup();
    const reads: number[] = [];
    test.bind(range(reads));
    test.control.requestRange(0, 1_000_000);
    await tick();
    expect(reads.length).to.be.at.most(5);
    expect(reads.every(offset => offset < 500)).to.equal(true);
    expect(() => test.control.requestRange(Number.NaN, 20)).to.throw();
    expect(() => test.control.requestRange(-1, 20)).to.throw();
    expect(() => test.bind({ count: Infinity, itemAt: row })).to.throw();
    expect(test.control.source.count).to.equal(0);
    test.disconnect();
  });

  it('deduplicates concurrent loads and limits physical in-flight work when abort is ignored', async () => {
    const test = setup();
    const pending: { offset: number; limit: number; resolve: (rows: Row[]) => void; signal: AbortSignal }[] = [];
    test.bind({ count: 1_000_000, read: request => new Promise(resolve => pending.push({ ...request, resolve })) });
    const first = test.control.ensure(5);
    const duplicate = test.control.ensure(7);
    test.control.requestRange(0, 500);
    await tick();
    expect(pending.length).to.equal(2);
    test.control.requestRange(900_000, 1_000_000);
    await tick();
    expect(pending.length).to.equal(2);
    expect(pending[0]!.signal.aborted).to.equal(true);
    expect(await first).to.equal(false);
    expect(await duplicate).to.equal(false);
    for (const item of pending.slice()) item.resolve(Array.from({ length: item.limit }, (_, i) => row(item.offset + i)));
    await tick();
    expect(pending.length).to.equal(4);
    test.disconnect();
    for (const item of pending.slice(2)) item.resolve(Array.from({ length: item.limit }, (_, i) => row(item.offset + i)));
    await tick();
  });

  it('evicts bounded pages and retries failed or malformed exact-range replies', async () => {
    const test = setup(2, 4, 2);
    const reads: number[] = [];
    let malformed = true;
    test.bind({ count: 20, read: async ({ offset, limit }) => {
      reads.push(offset);
      return malformed ? [] : Array.from({ length: limit }, (_, i) => row(offset + i));
    } });
    expect(await test.control.ensure(0)).to.equal(false);
    expect(test.control.source.itemAt(0).state).to.equal('error');
    malformed = false;
    expect(await test.control.ensure(0)).to.equal(true);
    await test.control.ensure(4);
    await test.control.ensure(8);
    await test.control.ensure(0);
    expect(reads).to.deep.equal([0, 0, 4, 8, 0]);
    test.disconnect();
  });

  it('checks response length before touching an oversized response and rejects duplicate keys', async () => {
    const test = setup(2, 4, 2);
    let accessed = 0;
    const oversized = new Proxy(new Array<Row>(1_000_000), { get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) accessed++;
      return Reflect.get(target, key, receiver);
    } });
    test.bind({ count: 1_000_000, read: async () => oversized });
    expect(await test.control.ensure(0)).to.equal(false);
    expect(accessed).to.equal(0);
    test.bind({ count: 2, read: async () => [row(0), row(0)] }, 1);
    expect(await test.control.ensure(0)).to.equal(false);
    test.disconnect();
  });

  it('drops stale completions and callbacks across refresh, disconnect and reconnect', async () => {
    const test = setup(1, 3, 3);
    let release!: (rows: Row[]) => void;
    test.bind({ count: 1, read: () => new Promise(resolve => { release = resolve; }) });
    const old = test.control.ensure(0);
    await tick();
    test.bind({ count: 1, itemAt: () => ({ key: 'new', text: 'New' }) }, 1);
    expect(await old).to.equal(false);
    release([row(0)]);
    await tick();
    const slot = test.control.source.itemAt(0);
    expect(slot.state === 'ready' ? slot.value.key : '').to.equal('new');
    test.disconnect();
    const paints = test.paints();
    await tick();
    expect(test.paints()).to.equal(paints);
    expect(await test.control.ensure(0)).to.equal(false);
    test.reconnect();
    expect(await test.control.ensure(0)).to.equal(true);
    test.disconnect();
  });

  it('supports count/read-only gallery sources with three slots and optional lookup', async () => {
    const test = setup(1, 3, 3);
    const reads: number[] = [];
    const view = range(reads);
    delete view.indexOfKey;
    test.bind(view);
    test.control.requestRange(999_997, 1_000_000);
    await tick();
    expect(reads).to.deep.equal([999_997, 999_998, 999_999]);
    expect(await test.control.resolveKey('key-50')).to.equal(null);
    expect(test.explicitRefresh()).to.equal(0);
    test.disconnect();
  });

  it('keeps local indexed getters lazy and invalidates mutable views only at explicit binding epochs', async () => {
    const test = setup(1, 3, 3);
    let reads = 0;
    let reverse = false;
    const view = { count: 1_000_000, itemAt: (index: number) => { reads++; return row(reverse ? 999_999 - index : index); },
      keyAt: (index: number) => `key-${reverse ? 999_999 - index : index}`,
      indexOfKey: (key: string | number) => reverse ? 999_999 - Number(String(key).slice(4)) : Number(String(key).slice(4)) };
    test.bind(view);
    for (const index of [0, 500_000, 999_999]) await test.control.ensure(index);
    expect(reads).to.equal(3);
    test.host.requestUpdate('selection');
    test.host.requestUpdate('viewport');
    test.bind(view);
    await test.control.ensure(999_999);
    expect(reads).to.equal(3);
    reverse = true;
    test.bind(view, 1);
    expect(await test.control.resolveKey('key-0')).to.equal(999_999);
    await test.control.ensure(999_999);
    const slot = test.control.source.itemAt(999_999);
    expect(slot.state === 'ready' ? slot.value.key : '').to.equal('key-0');
    expect(reads).to.equal(4);
    test.disconnect();
  });
});
