import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraPageRequest, LyraPageResult, LyraPageSource, LyraSourceRecord } from '../data-sources.js';
import { SourcePageController, type SourcePageOptions } from './source-page-controller.js';
import { setSourcePageScope } from './source-page-scope.js';

type Row = { id: string; text: string };
type Query = { search: string; tags?: readonly string[] };
const tick = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const record = (index: number): LyraSourceRecord<Row> => ({ key: `key-${index}`, order: index, value: { id: `key-${index}`, text: `Row ${index}` } });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function provider(total = 1_000_000): LyraPageSource<Row, Query> {
  return { revision: 1, query: async ({ page, pageSize }) => ({ total, rows: Array.from({ length: Math.min(pageSize, Math.max(0, total - page * pageSize)) }, (_, i) => record(page * pageSize + i)) }),
    lookup: async keys => keys.map(key => record(Number(key.slice(4)))), locate: async key => Number(key.slice(4)) };
}
function setup<S = undefined>(extra: Partial<SourcePageOptions<Row, Query, S>> = {}, scopeOwner?: object) {
  const controllers = new Set<ReactiveController>();
  let paints = 0;
  let refreshes = 0;
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: (name?: PropertyKey) => { if (name === undefined) refreshes++; },
    updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  if (scopeOwner) setSourcePageScope(host, scopeOwner);
  const control = new SourcePageController<Row, Query, S>(host, {
    normalizeRecord: value => {
      const row = value.value as Row;
      if (!row || row.id !== value.key || typeof row.text !== 'string') throw new TypeError('Invalid row');
      return { key: value.key, order: value.order, value: { id: row.id, text: row.text } };
    }, validateMetadata: () => {}, onChange: () => { paints++; host.requestUpdate('sourceVersion'); }, ...extra,
  });
  const bind = (source: LyraPageSource<Row, Query, S>, epoch = 0, locale = 'en') => control.bind({ source, revision: source.revision, epoch, locale });
  return { host, control, bind, paints: () => paints, refreshes: () => refreshes,
    disconnect: () => { host.remove(); controllers.forEach(c => c.hostDisconnected?.()); },
    reconnect: () => { document.body.append(host); controllers.forEach(c => c.hostConnected?.()); } };
}

describe('SourcePageController', () => {
  it('rejects missing page fields and non-array row collections without retaining an earlier page', async () => {
    const test = setup();
    const source = provider(1);
    test.bind(source);
    expect(await test.control.request({ search: '' }, 0, 1)).to.equal(true);
    const malformed: unknown[] = [null, 1, {}, { total: 1, rows: {} }, { total: 1, rows: [{ key: 'key-0', order: 0 }] }];
    for (const raw of malformed) {
      source.query = async () => raw as LyraPageResult<Row>;
      expect(await test.control.request({ search: '' }, 0, 1)).to.equal(false);
      expect(test.control.state.result).to.equal(undefined);
      expect(test.control.state.pending).to.equal(false);
      expect(test.control.state.error).to.be.instanceOf(TypeError);
    }
    test.disconnect();
  });

  it('rejects selected records with duplicate global orders without caching the failed lookup', async () => {
    const test = setup();
    const source = provider(2);
    let calls = 0;
    source.lookup = async () => {
      calls += 1;
      return calls === 1 ? [record(0), { ...record(1), order: 0 }] : [record(0), record(1)];
    };
    test.bind(source);
    expect(await test.control.resolveSelection(['key-0', 'key-1'])).to.equal(undefined);
    expect(test.control.state.selectionError).to.be.instanceOf(TypeError);
    expect(test.control.state.selectionPending).to.equal(false);
    expect((await test.control.resolveSelection(['key-0', 'key-1']))?.map(row => row.order)).to.deep.equal([0, 1]);
    expect(calls).to.equal(2);
    expect(test.control.state.selectionError).to.equal(undefined);
    test.disconnect();
  });

  it('rejects facets that are both available and unavailable, or whose total is smaller than their values', async () => {
    const test = setup();
    const source = provider(1);
    test.bind(source);
    const values = [{ key: 'tag', label: 'Tag' }];
    for (const tags of [
      { total: 1, values, unavailableSelected: ['tag'] },
      { total: 0, values, unavailableSelected: [] },
    ]) {
      source.query = async () => ({ total: 1, rows: [record(0)], tags });
      expect(await test.control.request({ search: '' }, 0, 1)).to.equal(false);
      expect(test.control.state.result).to.equal(undefined);
      expect(test.control.state.error).to.be.instanceOf(Error);
    }
    test.disconnect();
  });

  it('does not locate without an active page intent and rejects empty keys before calling the provider', async () => {
    const test = setup();
    const source = provider(1);
    let calls = 0;
    source.locate = async () => { calls += 1; return 1; };
    expect(await test.control.locate('key-0')).to.equal(null);
    test.bind(source);
    expect(await test.control.locate('key-0')).to.equal(null);
    expect(await test.control.request({ search: '' }, 0, 1)).to.equal(true);
    expect(await test.control.locate('')).to.equal(null);
    expect(calls).to.equal(0);
    expect(await test.control.locate('key-1')).to.equal(null);
    expect(calls).to.equal(1);
    expect(test.control.state.error).to.equal(undefined);
    expect(test.control.state.result?.total).to.equal(1);
    test.disconnect();
  });

  it('does not commit a page whose summary projection or metadata validation replaces its source', async () => {
    for (const stage of ['summary', 'metadata'] as const) {
      const source = { ...provider(1), query: async () => ({ total: 1, rows: [record(0)], summary: { count: 1 } }) };
      const replacement = { ...provider(1), query: async () => ({ total: 1, rows: [record(0)], summary: { count: 2 } }) };
      const test = setup<{ count: number }>({
        normalizeSummary: () => {
          if (stage === 'summary') test.bind(replacement);
          return { count: 1 };
        },
        validateMetadata: () => {
          if (stage === 'metadata') test.bind(replacement);
        },
      });
      test.bind(source);
      expect(await test.control.request({ search: '' }, 0, 1)).to.equal(false);
      expect(test.control.state.result).to.equal(undefined);
      expect(test.control.state.pending).to.equal(false);
      test.disconnect();
    }
  });

  it('loads first, middle and final logical pages with bounded row projection', async () => {
    let projections = 0;
    const test = setup({ normalizeRecord: value => { projections++; return { ...value, value: value.value as Row }; } });
    test.bind(provider());
    for (const page of [0, 5000, 9999]) {
      expect(await test.control.request({ search: '' }, page, 100)).to.equal(true);
      expect(test.control.state.result?.rows[0]?.order).to.equal(page * 100);
      expect(test.control.state.result?.rows[99]?.order).to.equal(page * 100 + 99);
      expect(test.control.state.result?.total).to.equal(1_000_000);
    }
    expect(projections).to.equal(300);
    expect(test.refreshes()).to.equal(0);
    test.disconnect();
  });

  it('bounds physical page requests, settles superseded callers and preserves latest query', async () => {
    const pending = deferred<LyraPageResult<Row>>();
    const calls: LyraPageRequest<Query>[] = [];
    const source = provider();
    source.query = request => { calls.push(request); return calls.length === 1 ? pending.promise : Promise.resolve({ total: 1, rows: [record(9)] }); };
    const test = setup(); test.bind(source);
    const old = test.control.request({ search: 'old' }, 0, 1); await tick();
    const replacements = Array.from({ length: 100 }, (_, i) => test.control.request({ search: `new-${i}` }, 0, 1));
    expect(await old).to.equal(false);
    expect(await Promise.all(replacements.slice(0, -1))).to.deep.equal(Array(99).fill(false));
    expect(calls.length).to.equal(1); expect(calls[0]?.signal.aborted).to.equal(true);
    expect(test.control.state.result).to.equal(undefined);
    pending.resolve({ total: 1, rows: [record(0)] });
    expect(await replacements[99]).to.equal(true);
    expect(calls.length).to.equal(2); expect(calls[1]?.query.search).to.equal('new-99');
    expect(test.control.state.result?.rows[0]?.key).to.equal('key-9'); test.disconnect();
  });

  it('corrects an obsolete page once and rejects a second inconsistent total', async () => {
    const test = setup(); const source = provider(123); const pages: number[] = [];
    const query = source.query; source.query = request => { pages.push(request.page); return query(request); };
    test.bind(source);
    expect(await test.control.request({ search: '' }, 9000, 100)).to.equal(true);
    expect(pages).to.deep.equal([9000, 1]); expect(test.control.state.page).to.equal(1);
    source.query = async request => ({ total: request.page === 9000 ? 123 : 0, rows: [] });
    expect(await test.control.request({ search: '' }, 9000, 100)).to.equal(false);
    expect(test.control.state.error).to.be.instanceOf(Error); test.disconnect();
  });

  it('rejects oversized or accessor page arrays before reading elements and fails invalid records closed', async () => {
    const test = setup(); const source = provider(); test.bind(source);
    let reads = 0;
    const rows = new Array<LyraSourceRecord<Row>>(1_000_000);
    Object.defineProperty(rows, 0, { get: () => { reads++; return record(0); } });
    source.query = async () => ({ total: 1_000_000, rows });
    expect(await test.control.request({ search: '' }, 0, 100)).to.equal(false); expect(reads).to.equal(0);
    const accessor = [record(0)]; Object.defineProperty(accessor, 0, { get: () => { reads++; return record(0); } });
    source.query = async () => ({ total: 1, rows: accessor });
    expect(await test.control.request({ search: '' }, 0, 1)).to.equal(false); expect(reads).to.equal(0);
    for (const bad of [{ ...record(0), order: -1 }, { ...record(0), key: 'x'.repeat(65_537) }, { ...record(0), value: { id: 'wrong', text: '' } }]) {
      source.query = async () => ({ total: 1, rows: [bad] });
      expect(await test.control.request({ search: '' }, 0, 1)).to.equal(false);
    }
    expect(test.control.state.error).to.be.instanceOf(Error); test.disconnect();
  });

  it('copies closed global facets/groups and rejects malformed metadata before domain validation', async () => {
    let validations = 0;
    const test = setup({ validateMetadata: (result, query) => {
      validations++;
      if (result.tags?.unavailableSelected.some(key => !query.tags?.includes(key))) throw new TypeError('Invalid selected facet');
    } });
    const source = provider();
    const tags = { total: 900, values: [{ key: 'off-page', label: 'Other', count: 700 }], unavailableSelected: ['missing'] };
    const groups = [{ key: 'group', label: 'Global', startIndex: 0, itemCount: 1000 }];
    source.query = async () => ({ total: 1_000_000, rows: [record(500)], tags, groups }); test.bind(source);
    expect(await test.control.request({ search: '', tags: ['missing'] }, 500, 1)).to.equal(true);
    tags.values[0]!.label = 'changed'; groups[0]!.label = 'changed';
    expect(test.control.state.result?.tags?.values[0]?.label).to.equal('Other');
    expect(test.control.state.result?.groups?.[0]?.label).to.equal('Global');
    tags.unavailableSelected = Array(501).fill('missing');
    expect(await test.control.request({ search: '' }, 500, 1)).to.equal(false); expect(validations).to.equal(1);
    test.disconnect();
  });

  it('projects summaries only through an explicit bounded summary normalizer', async () => {
    const test = setup<{ count: number }>({ normalizeSummary: value => {
      if (!value || typeof (value as { count: unknown }).count !== 'number') throw new TypeError('Missing summary');
      return Object.freeze({ count: (value as { count: number }).count });
    } });
    const summary = { count: 7, privateDetail: new Array(1000) };
    const source = { ...provider(), query: async () => ({ total: 1, rows: [record(0)], summary }) };
    test.bind(source); expect(await test.control.request({ search: '' }, 0, 1)).to.equal(true);
    expect(test.control.state.result?.summary).to.deep.equal({ count: 7 }); expect(test.control.state.result?.summary).not.to.equal(summary);
    test.disconnect();
    const unprojected = setup(); unprojected.bind(provider());
    const raw = { ...provider(), query: async () => ({ total: 1, rows: [record(0)], summary }) };
    Reflect.apply(unprojected.bind, undefined, [raw]);
    expect(await unprojected.control.request({ search: '' }, 0, 1)).to.equal(false); unprojected.disconnect();
  });

  it('resolves all 10000 selected keys in twenty bounded batches and reuses cache across queries', async () => {
    const source = provider(); const sizes: number[] = [];
    source.lookup = async keys => { sizes.push(keys.length); return [...keys].reverse().map(key => record(Number(key.slice(4)))); };
    const test = setup(); test.bind(source);
    const keys = Array.from({ length: 10_000 }, (_, i) => `key-${9999 - i}`);
    const rows = await test.control.resolveSelection(keys);
    expect(rows?.length).to.equal(10_000); expect(rows?.[0]?.order).to.equal(0); expect(rows?.[9999]?.order).to.equal(9999);
    expect(sizes).to.deep.equal(Array(20).fill(500));
    await test.control.request({ search: 'changed' }, 0, 100);
    expect((await test.control.resolveSelection(keys))?.length).to.equal(10_000); expect(sizes.length).to.equal(20);
    test.disconnect();
  });

  it('keeps selection authority/state independent from page failure and accepts only globally proven absence', async () => {
    const lookup = deferred<readonly LyraSourceRecord<Row>[]>(); const source = provider(); let signal: AbortSignal | undefined;
    source.lookup = (_keys, context) => { signal = context.signal; return lookup.promise; };
    source.query = async () => { throw new Error('Page failed'); };
    const test = setup(); test.bind(source);
    const selection = test.control.resolveSelection(['key-1', 'key-2']); await tick();
    expect(await test.control.request({ search: 'new' }, 0, 100)).to.equal(false);
    expect(signal?.aborted).to.equal(false); expect(test.control.state.selectionPending).to.equal(true);
    expect(test.control.state.selectionError).to.equal(undefined);
    lookup.resolve([record(2)]);
    expect((await selection)?.map(value => value.key)).to.deep.equal(['key-2']);
    expect(test.control.state.selectionPending).to.equal(false); expect(test.control.state.error).to.be.instanceOf(Error);
    test.disconnect();
  });

  it('bounds lookup dispatch, rejects foreign keys and keeps selection errors across page success', async () => {
    const source = provider(); const old = deferred<readonly LyraSourceRecord<Row>[]>(); let calls = 0;
    source.lookup = async () => { calls++; return calls === 1 ? old.promise : [record(999)]; };
    const test = setup(); test.bind(source);
    const first = test.control.resolveSelection(['key-0']); await tick();
    const next = Array.from({ length: 100 }, (_, i) => test.control.resolveSelection([`key-${i + 1}`]));
    expect(await first).to.equal(undefined); expect(await Promise.all(next.slice(0, -1))).to.deep.equal(Array(99).fill(undefined));
    expect(calls).to.equal(1); old.resolve([record(0)]);
    expect(await next[99]).to.equal(undefined); expect(calls).to.equal(2);
    expect(test.control.state.selectionError).to.be.instanceOf(Error);
    expect(await test.control.request({ search: '' }, 0, 1)).to.equal(true);
    expect(test.control.state.selectionError).to.be.instanceOf(Error); test.disconnect();
  });

  it('cancels locate with page intent but preserves selected cache, and bounds physical locate calls', async () => {
    const source = provider(); const old = deferred<number | null>(); let calls = 0; let lookups = 0;
    source.locate = () => { calls++; return calls === 1 ? old.promise : Promise.resolve(9); };
    source.lookup = async keys => { lookups++; return keys.map(key => record(Number(key.slice(4)))); };
    const test = setup(); test.bind(source); await test.control.request({ search: '' }, 0, 1);
    await test.control.resolveSelection(['key-2']);
    const first = test.control.locate('key-8'); await tick();
    await test.control.request({ search: 'new' }, 0, 1); expect(await first).to.equal(null);
    const latest = test.control.locate('key-9'); await tick(); expect(calls).to.equal(1);
    old.resolve(8); expect(await latest).to.equal(9);
    await test.control.resolveSelection(['key-2']); expect(lookups).to.equal(1); test.disconnect();
  });

  it('reconnects latest bounded intents and does not repaint or commit old-document work', async () => {
    const test = setup(); const source = provider(); let calls = 0; const query = source.query;
    source.query = request => { calls++; return query(request); }; test.bind(source);
    await test.control.request({ search: '' }, 5000, 1); test.disconnect(); test.reconnect(); await tick();
    expect(calls).to.equal(2); expect(test.control.state.result?.rows[0]?.order).to.equal(5000);
    const deferredPage = deferred<LyraPageResult<Row>>(); source.query = () => deferredPage.promise;
    const pending = test.control.request({ search: 'old' }, 0, 1); await tick();
    const oldPaints = test.paints(); document.implementation.createHTMLDocument().adoptNode(test.host); test.control.adopted();
    expect(await pending).to.equal(false); deferredPage.resolve({ total: 1, rows: [record(0)] }); await tick();
    expect(test.paints()).to.equal(oldPaints); expect(test.control.state.result).to.equal(undefined); test.disconnect();
  });

  it('preserves the latest source and page intent during synchronous abort reentry', async () => {
    const test = setup(); const source = provider(); const pending = deferred<LyraPageResult<Row>>();
    const calls: string[] = [];
    source.query = request => {
      calls.push(request.query.search);
      if (request.query.search !== 'old') return Promise.resolve({ total: 1, rows: [record(2)] });
      request.signal.addEventListener('abort', () => { void test.control.request({ search: 'nested' }, 0, 1); });
      return pending.promise;
    };
    test.bind(source); const first = test.control.request({ search: 'old' }, 0, 1); await tick();
    const outer = test.control.request({ search: 'outer' }, 0, 1);
    expect(await first).to.equal(false); expect(await outer).to.equal(false);
    pending.resolve({ total: 1, rows: [record(0)] }); await tick();
    expect(calls).to.deep.equal(['old', 'nested']); expect(test.control.state.result?.rows[0]?.order).to.equal(2);
    test.disconnect();
  });
  it('uses bounded own-data array lengths without invoking proxy element or length reads', async () => {
    const test = setup(); const source = provider(); let reads = 0;
    const rows = new Proxy([record(0)], { get: () => { reads++; throw new Error('Unexpected array get'); } });
    source.query = async () => ({ total: 1, rows }); test.bind(source);
    expect(await test.control.request({ search: '' }, 0, 1)).to.equal(true);
    expect(reads).to.equal(0); test.disconnect();
  });

  it('rejects malformed counts, offsets, duplicate metadata and aggregate strings without stale results', async () => {
    const test = setup(); const source = provider(); test.bind(source);
    for (const [page, size] of [[-1, 1], [0, 0], [0, 501], [Number.MAX_SAFE_INTEGER, 2]]) {
      expect(await test.control.request({ search: '' }, page!, size!)).to.equal(false);
      expect(test.control.state.error).to.be.instanceOf(Error);
    }
    const malformed: unknown[] = [
      { total: NaN, rows: [] }, { total: 2, rows: [record(0), record(0)] },
      { total: 2, rows: [record(0), { ...record(1), order: 0 }] },
      { total: 2, rows: [record(0), record(1)], tags: { total: 2, values: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A' }], unavailableSelected: [] } },
      { total: 2, rows: [record(0), record(1)], groups: [{ key: 'g', label: 'G', startIndex: 3, itemCount: 1 }] },
      { total: 2, rows: [record(0), record(1)], tags: { total: 40, values: Array.from({ length: 40 }, (_, i) => ({ key: `tag-${i}`, label: 'x'.repeat(60_000) })), unavailableSelected: [] } },
    ];
    for (const result of malformed) {
      source.query = () => Promise.resolve(result as LyraPageResult<Row>);
      expect(await test.control.request({ search: '' }, 0, 2)).to.equal(false);
      expect(test.control.state.result).to.equal(undefined); expect(test.control.state.error).to.be.instanceOf(Error);
    }
    expect(await test.control.resolveSelection(Array(10_001).fill('key-0'))).to.equal(undefined);
    expect(test.control.state.selectionError).to.be.instanceOf(Error); test.disconnect();
  });

  it('preserves raw selected cache across locale changes but revokes everything on explicit source epochs', async () => {
    const test = setup(); const source = provider(); let calls = 0;
    const lookup = source.lookup; source.lookup = (keys, context) => { calls++; return lookup(keys, context); };
    test.bind(source); await test.control.resolveSelection(['key-1']);
    test.bind(source, 0, 'fr'); await test.control.resolveSelection(['key-1']); expect(calls).to.equal(1);
    test.bind(source, 1, 'fr'); await test.control.resolveSelection(['key-1']); expect(calls).to.equal(2);
    const pending = deferred<readonly LyraSourceRecord<Row>[]>(); let signal: AbortSignal | undefined;
    source.lookup = (_keys, context) => { signal = context.signal; return pending.promise; };
    const selection = test.control.resolveSelection(['key-2']); await tick();
    test.bind(provider(), 2); expect(await selection).to.equal(undefined); expect(signal?.aborted).to.equal(true);
    pending.resolve([record(2)]); await tick();
    expect(test.control.state.selectionError).to.equal(undefined); expect(test.control.state.selectionPending).to.equal(false);
    test.disconnect();
  });

  it('does not commit projections whose normalizer synchronously replaces source authority', async () => {
    let rebind = () => {};
    const test = setup({ normalizeRecord: value => { rebind(); return { ...value, value: value.value as Row }; } });
    test.bind(provider()); rebind = () => test.bind(provider(), 1);
    expect(await test.control.request({ search: '' }, 0, 1)).to.equal(false);
    expect(test.control.state.result).to.equal(undefined); expect(test.control.state.error).to.equal(undefined);
    rebind = () => {}; expect(await test.control.request({ search: 'new' }, 0, 1)).to.equal(true);
    test.disconnect();
  });

  it('preserves a newer locate started inside the previous page abort callback', async () => {
    const test = setup(); const source = provider(); const pending = deferred<LyraPageResult<Row>>();
    let nested: Promise<number | null> | undefined;
    source.query = request => {
      if (request.query.search !== 'old') return Promise.resolve({ total: 100, rows: [record(0)] });
      request.signal.addEventListener('abort', () => { nested = test.control.locate('key-2'); });
      return pending.promise;
    };
    test.bind(source); const first = test.control.request({ search: 'old' }, 0, 1); await tick();
    const latest = test.control.request({ search: 'new' }, 0, 1);
    expect(await first).to.equal(false); expect(await nested).to.equal(2);
    pending.resolve({ total: 100, rows: [record(0)] }); expect(await latest).to.equal(true);
    test.disconnect();
  });

  it('preserves a newer page started inside a locate abort callback during locale change', async () => {
    const test = setup(); const source = provider(); const pending = deferred<number | null>();
    let nested: Promise<boolean> | undefined;
    source.locate = (_key, _query, context) => {
      context.signal.addEventListener('abort', () => { nested = test.control.request({ search: 'nested' }, 9, 1); });
      return pending.promise;
    };
    test.bind(source); await test.control.request({ search: '' }, 0, 1);
    const old = test.control.locate('key-2'); await tick();
    test.bind(source, 0, 'fr'); expect(await old).to.equal(null);
    expect(await nested).to.equal(true); expect(test.control.state.result?.rows[0]?.order).to.equal(9);
    pending.resolve(2); test.disconnect();
  });

});

for (const capability of ['query', 'lookup', 'locate'] as const) {
  it(`does not invoke ${capability} after its getter replaces the source`, async () => {
    const test = setup(); const source = provider(); const next = provider(5);
    test.bind(source);
    if (capability === 'locate') await test.control.request({ search: '' }, 0, 1);
    let calls = 0;
    const original = source[capability];
    Object.defineProperty(source, capability, { configurable: true, get() {
      test.bind(next, 1);
      return (...args: unknown[]) => { calls++; return Reflect.apply(original, source, args); };
    } });
    const result = capability === 'query' ? await test.control.request({ search: '' }, 0, 1)
      : capability === 'lookup' ? await test.control.resolveSelection(['key-0']) : await test.control.locate('key-0');
    expect(calls).to.equal(0);
    expect(result).to.equal(capability === 'query' ? false : capability === 'lookup' ? undefined : null);
    expect(await test.control.request({ search: 'current' }, 0, 1)).to.equal(true);
    expect(test.control.state.result?.total).to.equal(5);
    test.disconnect();
  });
}

for (const channel of ['page', 'selection'] as const) {
  it(`passes originating ${channel} authority through descriptor capture independently of the other lane`, async () => {
    let navigate = () => {}; let laterReads = 0; let changed = false;
    const row = new Proxy({ id: 'key-0', text: 'Original' }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'id' && !changed) { changed = true; navigate(); }
        else if (key === 'text') laterReads++;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const test = setup({ normalizeRecord: (entry, current = () => true): LyraSourceRecord<Row> => {
      if (!current()) throw new Error('Revoked projection');
      const id = Object.getOwnPropertyDescriptor(entry.value, 'id')!.value as string;
      if (!current()) throw new Error('Revoked projection');
      const text = Object.getOwnPropertyDescriptor(entry.value, 'text')!.value as string;
      if (!current()) throw new Error('Revoked projection');
      return { key: entry.key, order: entry.order, value: { id, text } };
    } });
    const source = provider(2);
    source.query = async ({ page }) => ({ total: 2, rows: [page === 0 ? { key: 'key-0', order: 0, value: row } : record(1)] });
    source.lookup = async () => [{ key: 'key-0', order: 0, value: row }];
    test.bind(source);
    let nextPage: Promise<boolean> | undefined;
    navigate = () => { nextPage = test.control.request({ search: 'next' }, 1, 1); };
    try {
      if (channel === 'page') {
        expect(await test.control.request({ search: 'first' }, 0, 1)).to.equal(false);
        expect(laterReads).to.equal(0);
      } else {
        expect((await test.control.resolveSelection(['key-0']))?.map(value => value.key)).to.deep.equal(['key-0']);
        expect(laterReads).to.equal(1); expect(test.control.state.selectionError).to.equal(undefined);
      }
      expect(await nextPage).to.equal(true); expect(test.control.state.result?.rows[0]?.key).to.equal('key-1');
    } finally { test.disconnect(); }
  });
}

for (const lane of ['page', 'selection', 'locate'] as const) {
  it(`shares a composition's physical ${lane} permit across remounted hosts`, async () => {
    const owner = {}; const pending = deferred<void>(); const source = provider(1);
    let calls = 0; let active = 0; let peak = 0;
    const enter = async () => { calls++; active++; peak = Math.max(peak, active); if (calls === 1) await pending.promise; active--; };
    if (lane === 'page') source.query = async function () { expect(this === source).to.equal(true); await enter(); return { total: 1, rows: [record(0)] }; };
    if (lane === 'selection') source.lookup = async function () { expect(this === source).to.equal(true); await enter(); return [record(0)]; };
    if (lane === 'locate') source.locate = async function () { expect(this === source).to.equal(true); await enter(); return 0; };
    const first = setup({}, owner); first.bind(source);
    if (lane === 'locate') await first.control.request({ search: '' }, 0, 1);
    const run = (test: { control: SourcePageController<Row, Query> }) => lane === 'page' ? test.control.request({ search: '' }, 0, 1)
      : lane === 'selection' ? test.control.resolveSelection(['key-0']) : test.control.locate('key-0');
    const old = run(first); await tick(); expect(calls).to.equal(1);
    first.disconnect();
    const current = setup({}, owner); current.bind(source);
    try {
      if (lane === 'locate') await current.control.request({ search: '' }, 0, 1);
      const latest = run(current); await tick();
      expect(calls).to.equal(1); expect(peak).to.equal(1);
      pending.resolve();
      expect(await old).to.equal(lane === 'page' ? false : lane === 'selection' ? undefined : null);
      const result = await latest;
      expect(lane === 'selection' ? Array.isArray(result) : result).to.equal(lane === 'locate' ? 0 : true);
      expect(calls).to.equal(2); expect(peak).to.equal(1);
    } finally { pending.resolve(); first.disconnect(); current.disconnect(); }
  });
}

it('drops abandoned queued hosts and runs only the latest remounted intent', async () => {
  const owner = {}; const pending = deferred<LyraPageResult<Row>>(); const source = provider(1); const calls: string[] = [];
  source.query = request => { calls.push(request.query.search); return calls.length === 1 ? pending.promise : Promise.resolve({ total: 1, rows: [record(0)] }); };
  const first = setup({}, owner); first.bind(source);
  const old = first.control.request({ search: 'old' }, 0, 1); await tick(); first.disconnect();
  for (let i = 0; i < 20; i++) {
    const abandoned = setup({}, owner); abandoned.bind(source);
    const queued = abandoned.control.request({ search: `abandoned-${i}` }, 0, 1); await tick();
    abandoned.disconnect(); expect(await queued).to.equal(false);
  }
  const current = setup({}, owner); current.bind(source);
  try {
    const latest = current.control.request({ search: 'latest' }, 0, 1); await tick();
    expect(calls).to.deep.equal(['old']);
    pending.resolve({ total: 1, rows: [record(0)] });
    expect(await old).to.equal(false); expect(await latest).to.equal(true);
    expect(calls).to.deep.equal(['old', 'latest']);
  } finally { pending.resolve({ total: 1, rows: [record(0)] }); current.disconnect(); }
});

it('revokes an older queued scope assignment even before its host disconnects', async () => {
  const owner = {}; const pending = deferred<LyraPageResult<Row>>(); const source = provider(1); let calls = 0;
  source.query = () => ++calls === 1 ? pending.promise : Promise.resolve({ total: 1, rows: [record(0)] });
  const first = setup({}, owner); first.bind(source);
  void first.control.request({ search: 'old' }, 0, 1); await tick(); first.disconnect();
  const replaced = setup({}, owner); replaced.bind(source);
  const canceled = replaced.control.request({ search: 'replaced' }, 0, 1); await tick();
  const current = setup({}, owner); current.bind(source);
  try {
    expect(await canceled).to.equal(false);
    const latest = current.control.request({ search: 'current' }, 0, 1); await tick();
    expect(calls).to.equal(1);
    pending.resolve({ total: 1, rows: [record(0)] });
    expect(await latest).to.equal(true); expect(calls).to.equal(2);
    expect(replaced.control.state.result).to.equal(undefined);
  } finally { pending.resolve({ total: 1, rows: [record(0)] }); replaced.disconnect(); current.disconnect(); }
});

it('does not serialize distinct providers within the composition', async () => {
  const owner = {}; const pending = deferred<LyraPageResult<Row>>(); const source = provider(1); let oldCalls = 0;
  source.query = () => { oldCalls++; return pending.promise; };
  const first = setup({}, owner); first.bind(source);
  const old = first.control.request({ search: '' }, 0, 1); await tick(); first.disconnect();
  const current = setup({}, owner); current.bind(provider(2));
  try {
    expect(await current.control.request({ search: '' }, 0, 1)).to.equal(true);
    expect(oldCalls).to.equal(1); expect(current.control.state.result?.total).to.equal(2);
    expect(await old).to.equal(false);
  } finally { pending.resolve({ total: 1, rows: [record(0)] }); current.disconnect(); }
});

for (const scoped of [false, true]) {
  it(`keeps ${scoped ? 'distinct composition owners' : 'standalone hosts'} independent for the same provider`, async () => {
    const pending = deferred<LyraPageResult<Row>>(); const source = provider(1); let calls = 0;
    source.query = () => { calls++; return pending.promise; };
    const first = setup({}, scoped ? {} : undefined); const second = setup({}, scoped ? {} : undefined);
    first.bind(source); second.bind(source);
    try {
      const a = first.control.request({ search: '' }, 0, 1); const b = second.control.request({ search: '' }, 0, 1); await tick();
      expect(calls).to.equal(2);
      pending.resolve({ total: 1, rows: [record(0)] });
      expect(await a).to.equal(true); expect(await b).to.equal(true);
    } finally { pending.resolve({ total: 1, rows: [record(0)] }); first.disconnect(); second.disconnect(); }
  });
}

it('keeps repeated same-host registration inert and releases a failed physical operation', async () => {
  const owner = {}; const pending = deferred<LyraPageResult<Row>>(); const source = provider(1); let calls = 0;
  source.query = () => ++calls === 1 ? pending.promise : Promise.resolve({ total: 1, rows: [record(0)] });
  const first = setup({}, owner); first.bind(source);
  const old = first.control.request({ search: '' }, 0, 1); await tick();
  setSourcePageScope(first.host, owner); setSourcePageScope(first.host, owner);
  first.disconnect();
  const current = setup({}, owner); current.bind(source);
  try {
    const latest = current.control.request({ search: '' }, 0, 1); await tick(); expect(calls).to.equal(1);
    pending.reject(new Error('Old failure'));
    expect(await old).to.equal(false); expect(await latest).to.equal(true);
    expect(current.control.state.error).to.equal(undefined);
  } finally { pending.resolve({ total: 1, rows: [record(0)] }); current.disconnect(); }
});

it('rechecks authority after waiting before a reentrant method getter can dispatch', async () => {
  const owner = {}; const pending = deferred<LyraPageResult<Row>>(); const source = provider(1); let calls = 0;
  source.query = () => { calls++; return pending.promise; };
  const first = setup({}, owner); first.bind(source);
  void first.control.request({ search: '' }, 0, 1); await tick(); first.disconnect();
  const current = setup({}, owner); current.bind(source);
  let newer: Promise<boolean> | undefined; let staleCalls = 0;
  try {
    const obsolete = current.control.request({ search: 'waiting' }, 0, 1); await tick(); expect(calls).to.equal(1);
    Object.defineProperty(source, 'query', { configurable: true, get() {
      current.bind(provider(2), 1);
      newer = current.control.request({ search: 'newer' }, 0, 1);
      return async () => { staleCalls++; return { total: 1, rows: [record(0)] }; };
    } });
    pending.resolve({ total: 1, rows: [record(0)] });
    expect(await obsolete).to.equal(false); await tick();
    expect(await newer).to.equal(true); expect(staleCalls).to.equal(0);
    expect(current.control.state.result?.total).to.equal(2);
  } finally { pending.resolve({ total: 1, rows: [record(0)] }); current.disconnect(); }
});

it('does not revoke current work when the active host registers the same scope again', async () => {
  const owner = {}; const pending = deferred<LyraPageResult<Row>>(); const source = provider(1); let signal: AbortSignal | undefined;
  source.query = request => { signal = request.signal; return pending.promise; };
  const test = setup({}, owner); test.bind(source);
  try {
    const current = test.control.request({ search: '' }, 0, 1); await tick();
    setSourcePageScope(test.host, owner); setSourcePageScope(test.host, owner);
    expect(signal?.aborted).to.equal(false);
    pending.resolve({ total: 1, rows: [record(0)] });
    expect(await current).to.equal(true); expect(test.control.state.result?.rows[0]?.key).to.equal('key-0');
  } finally { pending.resolve({ total: 1, rows: [record(0)] }); test.disconnect(); }
});


it('cancels queued work when its existing host moves to another composition owner', async () => {
  const owner = {}; const movedOwner = {}; const pending = deferred<LyraPageResult<Row>>();
  const source = provider(1); const calls: string[] = [];
  source.query = request => {
    calls.push(request.query.search);
    return calls.length === 1 ? pending.promise : Promise.resolve({ total: 1, rows: [record(0)] });
  };
  const first = setup({}, owner); first.bind(source);
  const held = first.control.request({ search: 'held' }, 0, 1);
  await tick(); first.disconnect();
  const moved = setup({}, owner); moved.bind(source);
  let disconnectSuccessor: (() => void) | undefined;
  try {
    const canceled = moved.control.request({ search: 'obsolete' }, 0, 1);
    await tick(); expect(calls).to.deep.equal(['held']);
    setSourcePageScope(moved.host, movedOwner);
    expect(await canceled).to.equal(false);
    expect(moved.control.state.result).to.equal(undefined);
    expect(await moved.control.request({ search: 'moved' }, 0, 1)).to.equal(true);
    const successor = setup({}, owner); disconnectSuccessor = successor.disconnect; successor.bind(source);
    const latest = successor.control.request({ search: 'successor' }, 0, 1);
    await tick(); expect(calls).to.deep.equal(['held', 'moved']);
    pending.resolve({ total: 1, rows: [record(0)] });
    expect(await held).to.equal(false);
    expect(await latest).to.equal(true);
    expect(calls).to.deep.equal(['held', 'moved', 'successor']);
    expect(successor.control.state.result?.rows[0]?.key).to.equal('key-0');
  } finally { pending.resolve({ total: 1, rows: [record(0)] }); first.disconnect(); moved.disconnect(); disconnectSuccessor?.(); }
});

it('settles a scope revoked before its queued page starts without calling the provider', async () => {
  const owner = {}; const source = provider(1); let calls = 0;
  source.query = async () => { calls++; return { total: 1, rows: [record(0)] }; };
  const obsolete = setup({}, owner); obsolete.bind(source);
  const canceled = obsolete.control.request({ search: 'obsolete' }, 0, 1);
  const current = setup({}, owner); current.bind(source);
  try {
    expect(await canceled).to.equal(false);
    expect(calls).to.equal(0);
    expect(obsolete.control.state.result).to.equal(undefined);
    expect(obsolete.control.state.error).to.equal(undefined);
    expect(await current.control.request({ search: 'current' }, 0, 1)).to.equal(true);
    expect(calls).to.equal(1);
    expect(current.control.state.result?.rows[0]?.key).to.equal('key-0');
  } finally { obsolete.disconnect(); current.disconnect(); }
});
