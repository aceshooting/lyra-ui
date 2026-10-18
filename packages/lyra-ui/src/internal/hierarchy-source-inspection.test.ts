import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraSourceSearchResult } from '../data-sources.js';
import { HierarchySourceController, type HierarchySourceOptions } from './hierarchy-source-controller.js';

type Source = LyraHierarchySource<string, LyraHierarchyQuery>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
function row(index: number, value = 'value'): LyraHierarchyRow<string> {
  return { key: `k${index}`, value, parentKey: null, level: 1, position: index + 1,
    setSize: 1_000_000, childCount: 0, expanded: false, selected: false };
}
function provider(): Source {
  return { revision: 1, async project() { return { state: 'state', total: 1_000_000,
    rows: { count: 1_000_000, keyAt: i => `k${i}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)), itemAt: row } }; } };
}
const fixtures: Array<() => void> = [];
function setup(payload?: HierarchySourceOptions<string>['payload']) {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (value: ReactiveController) => controllers.add(value),
    removeController: (value: ReactiveController) => controllers.delete(value),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new HierarchySourceController(host, { normalize: value => {
    if (typeof value !== 'string') throw new TypeError('Expected string');
    return value;
  }, onChange: () => {}, accepted: () => {}, ...(payload ? { payload } : {}) });
  const disconnect = () => { host.remove(); controllers.forEach(c => c.hostDisconnected?.()); };
  fixtures.push(disconnect);
  return { control, host, disconnect };
}
afterEach(() => { fixtures.splice(0).forEach(disconnect => disconnect()); });
const empty = () => ({ hits: [], total: 0, exhaustive: true });

describe('hierarchy inspection authority', () => {
  it('snapshots immutable semantic queries and preserves them through refresh', async () => {
    const { control } = setup();
    const source = provider();
    const calls: LyraHierarchyQuery[] = [];
    const project = source.project;
    source.project = async request => { calls.push(request.query); return project(request); };
    const query = { search: 'needle', hiddenKinds: ['text', 'comment', 'text'] };
    control.update(source, 'en', false, query);
    query.search = 'mutated'; query.hiddenKinds.push('attribute');
    expect(await control.whenReady()).to.equal(true);
    expect(calls[0]!.search).to.equal('needle');
    expect([...calls[0]!.hiddenKinds].sort()).to.deep.equal(['comment', 'text']);
    expect(Object.isFrozen(calls[0]) && Object.isFrozen(calls[0]!.hiddenKinds)).to.equal(true);
    control.update(source, 'en', false, { search: 'needle', hiddenKinds: ['comment', 'text'] });
    await Promise.resolve();
    expect(calls.length).to.equal(1);
    control.refresh();
    expect(await control.whenReady()).to.equal(true);
    expect(calls.length).to.equal(2);
    expect(calls[1]).to.deep.equal(calls[0]);
  });

  it('keeps the default empty query and rejects accessor or oversized query data without invoking it', async () => {
    const { control } = setup();
    const source = provider();
    const project = source.project;
    let calls = 0;
    source.project = async request => { calls++; expect(request.query).to.deep.equal({ search: '', hiddenKinds: [] }); return project(request); };
    control.update(source, 'en'); await control.whenReady();
    let getters = 0;
    const invalid = { get search() { getters++; return ''; }, hiddenKinds: [] };
    for (const query of [invalid, { search: 'x'.repeat(4097), hiddenKinds: [] }, { search: '', hiddenKinds: ['x'.repeat(65)] }]) {
      control.update(source, 'en', false, query);
      expect(control.error).to.equal(true);
      expect(control.projection === undefined).to.equal(true);
    }
    expect(getters).to.equal(0); expect(calls).to.equal(1);
  });

  it('searches globally with the captured query and bounded limit without reading projected rows', async () => {
    for (const ranged of [false, true]) {
      const { control } = setup(); const source = provider(); let reads = 0;
      source.project = async () => ({ state: 'state', total: 1_000_000, rows: ranged
        ? { count: 1_000_000, indexOfKey: async () => 999_999, read: async () => { reads++; return []; } }
        : { count: 1_000_000, keyAt: i => `k${i}`, indexOfKey: () => 999_999, itemAt: i => { reads++; return row(i); } } });
      source.search = async request => { expect(request.query).to.equal('last'); expect(request.limit).to.equal(10_000);
        return { hits: [{ key: 'k999999' }], total: 1, exhaustive: true }; };
      control.update(source, 'en', false, { search: 'last', hiddenKinds: [] }); await control.whenReady();
      for (const index of [0, 500_000, 999_999]) { control.adapter.itemAt(index); control.adapter.keyAt!(index); }
      const result = await control.search();
      expect(result.status).to.equal('ready');
      if (result.status === 'ready') {
        expect(result.value.hits).to.deep.equal([{ key: 'k999999' }]);
        expect(Object.isFrozen(result.value) && Object.isFrozen(result.value.hits) && Object.isFrozen(result.value.hits[0])).to.equal(true);
        expect(result.isCurrent()).to.equal(true);
        control.cancelSearch(); expect(result.isCurrent()).to.equal(false);
      }
      expect(reads).to.equal(0);
    }
  });

  it('distinguishes unavailable, empty, partial and unknown search outcomes', async () => {
    const { control } = setup(); const source = provider(); control.update(source, 'en'); await control.whenReady();
    expect((await control.search()).status).to.equal('unavailable');
    for (const value of [empty(), { hits: [{ key: 'a' }], total: 2, exhaustive: false }, { hits: [{ key: 'a' }], total: null, exhaustive: false }, { hits: [{ key: 'a' }], total: null, exhaustive: true }]) {
      source.search = async () => value;
      expect((await control.search()).status).to.equal('ready');
    }
  });

  it('rejects malformed and over-budget search replies as whole results without executing getters', async () => {
    const { control } = setup(); const source = provider(); control.update(source, 'en'); await control.whenReady();
    let getters = 0;
    const accessor = { get key() { getters++; return 'a'; } };
    const malformed = [
      { hits: Array.from({ length: 10_001 }, (_, i) => ({ key: `k${i}` })), total: 10_001, exhaustive: true },
      { hits: [{ key: 'x'.repeat(65_537) }], total: 1, exhaustive: true },
      { hits: Array.from({ length: 31 }, (_, i) => ({ key: String(i).padEnd(65_000, 'x') })), total: 31, exhaustive: true },
      { hits: [{ key: 'a' }, { key: 'a' }], total: 2, exhaustive: true },
      { hits: [accessor], total: 1, exhaustive: true },
      { hits: [{ key: 'a' }], total: 2, exhaustive: true },
      { hits: [{ key: 'a' }], total: 0, exhaustive: false },
      { hits: [], total: Number.NaN, exhaustive: false },
    ];
    for (const value of malformed) { source.search = async () => value; expect((await control.search()).status).to.equal('error'); }
    expect(getters).to.equal(0);
  });

  it('settles obsolete search promptly while keeping one physical call and only the latest queued intent', async () => {
    const { control } = setup(); const source = provider();
    const releases: Array<ReturnType<typeof deferred<LyraSourceSearchResult<{ key: string }>>>> = [];
    source.search = () => { const next = deferred<LyraSourceSearchResult<{ key: string }>>(); releases.push(next); return next.promise; };
    control.update(source, 'en'); await control.whenReady();
    const first = control.search(); await waitUntil(() => releases.length === 1);
    const middle = control.search(); const last = control.search();
    expect((await first).status).to.equal('stale'); expect((await middle).status).to.equal('stale');
    expect(releases.length).to.equal(1);
    releases[0]!.resolve(empty()); await waitUntil(() => releases.length === 2);
    releases[1]!.resolve(empty()); expect((await last).status).to.equal('ready');
    expect(releases.length).to.equal(2);
  });

  it('cancels capabilities before an initial projection completes without cancelling that required reset', async () => {
    const { control } = setup(); const source = provider(); const pending = deferred<Awaited<ReturnType<Source['project']>>>();
    const project = source.project; source.project = () => pending.promise;
    const search = deferred<LyraSourceSearchResult<{ key: string }>>(); source.search = () => search.promise;
    const copy = deferred<string>(); source.copy = () => copy.promise;
    control.update(source, 'en'); const ready = control.whenReady();
    const searching = control.search(); const copying = control.copy(null, 'document', 10);
    control.cancelSearch();
    expect((await searching).status).to.equal('stale'); expect((await copying).status).to.equal('stale');
    pending.resolve(await project({ query: { search: '', hiddenKinds: [] }, state: null, action: { type: 'reset' }, revision: 1, locale: 'en', signal: new AbortController().signal }));
    expect(await ready).to.equal(true); search.resolve(empty()); copy.resolve('text');
  });

  it('uses complete copy requests and exact UTF-8 byte budgets including lone surrogates', async () => {
    const { control } = setup(); const source = provider(); control.update(source, 'en'); await control.whenReady();
    expect((await control.copy(null, 'document', 10)).status).to.equal('unavailable');
    for (const [key, scope] of [[null, 'document'], ['k2', 'node'], ['k3', 'subtree']] as const) {
      source.copy = async request => { expect(request.key).to.equal(key); expect(request.scope).to.equal(scope); expect(request.maxBytes).to.equal(10); return 'complete'; };
      expect((await control.copy(key, scope, 10)).status).to.equal('ready');
    }
    for (const text of ['é', '😀', '\ud800', '\udc00', 'a😀é\ud800']) {
      const size = new TextEncoder().encode(text).byteLength; source.copy = async () => text;
      const exact = await control.copy(null, 'document', size); expect(exact.status).to.equal('ready');
      if (exact.status === 'ready') expect(exact.value).to.equal(text);
      expect((await control.copy(null, 'document', size - 1)).status).to.equal('error');
    }
    let calls = 0; source.copy = async () => { calls++; return 'x'; };
    for (const [key, scope, bytes] of [['k0', 'document', 10], [null, 'node', 10], ['', 'node', 10], [null, 'document', NaN], [null, 'document', 1.5]] as const)
      expect((await control.copy(key, scope, bytes)).status).to.equal('error');
    expect(calls).to.equal(0);
  });

  it('revokes successful copy effect predicates on every new authority and search intent', async () => {
    for (const revoke of ['search', 'cancel', 'query', 'locale', 'refresh', 'unset', 'disconnect', 'adoption']) {
      const { control, host, disconnect } = setup(); const source = provider(); source.copy = async () => 'text'; source.search = async () => empty();
      control.update(source, 'en'); await control.whenReady(); const result = await control.copy(null, 'document', 4);
      expect(result.status).to.equal('ready'); if (result.status !== 'ready') continue;
      expect(result.isCurrent()).to.equal(true);
      if (revoke === 'search') await control.search();
      else if (revoke === 'cancel') control.cancelSearch();
      else if (revoke === 'query') control.update(source, 'en', false, { search: 'next', hiddenKinds: [] });
      else if (revoke === 'locale') control.update(source, 'fr');
      else if (revoke === 'refresh') control.refresh();
      else if (revoke === 'unset') control.update(undefined, 'en');
      else if (revoke === 'disconnect') disconnect();
      else { const target = document.implementation.createHTMLDocument(); target.body.append(target.adoptNode(host)); control.adopted(); }
      expect(result.isCurrent(), revoke).to.equal(false);
    }
  });

  it('cancels cooperative UTF-8 validation before handing a large copy to its caller', async () => {
    const { control } = setup(); const source = provider(); source.copy = async () => '😀'.repeat(1_000_000);
    control.update(source, 'en'); await control.whenReady();
    const scheduler = Object.getOwnPropertyDescriptor(window, 'scheduler');
    let yields = 0;
    Object.defineProperty(window, 'scheduler', { configurable: true, value: { yield: async () => {
      yields++; await Promise.resolve(); control.cancelSearch();
    } } });
    try {
      expect((await control.copy(null, 'document', 4_000_000)).status).to.equal('stale');
      expect(yields).to.equal(1);
    } finally {
      if (scheduler) Object.defineProperty(window, 'scheduler', scheduler);
      else Reflect.deleteProperty(window, 'scheduler');
    }
  });

  it('charges row keys, focused snapshots and the fixed state reserve against payload admission', async () => {
    // 65,536 state units + 20 focused-row units leave exactly 24 cache units.
    const { control } = setup({ maxUnits: 65_580, maxRowUnits: 20, unitsOf: value => value.length });
    const source = provider(); let reads = 0;
    source.project = async () => ({ state: 's'.repeat(65_536), total: 10,
      rows: { count: 10, keyAt: i => `k${i}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)), itemAt: i => { reads++; return row(i, 'x'.repeat(10)); } } });
    control.update(source, 'en'); await control.whenReady();
    const first = control.slot(0); expect(first.state).to.equal('ready');
    if (first.state !== 'ready') return; control.focusRow(0, first.value);
    expect(control.slot(1).state).to.equal('ready'); expect(control.slot(2).state).to.equal('ready');
    const before = reads;
    expect(control.slot(0).state).to.equal('ready'); expect(reads).to.equal(before);
    // The focused snapshot is independent of cache eviction; an evicted nonfocused row is read again.
    control.slot(1); control.slot(3);
    const afterNewRow = reads; control.slot(2);
    expect(reads).to.equal(afterNewRow + 1);
  });

  it('preserves a reentrant query update from project getters and capability abort callbacks', async () => {
    for (const trigger of ['getter', 'abort']) {
      const { control } = setup(); const source = provider(); const project = source.project;
      const seen: string[] = []; let armed = false;
      const next = { search: 'newest', hiddenKinds: [] };
      const invoke: Source['project'] = async request => { seen.push(request.query.search); return project(request); };
      if (trigger === 'getter') Object.defineProperty(source, 'project', { get() {
        if (armed) { armed = false; control.update(source, 'en', false, next); }
        return invoke;
      } });
      else source.project = invoke;
      const pending = deferred<LyraSourceSearchResult<{ key: string }>>();
      source.search = request => {
        request.signal.addEventListener('abort', () => {
          if (armed) { armed = false; control.update(source, 'en', false, next); }
        }, { once: true });
        return pending.promise;
      };
      control.update(source, 'en'); await control.whenReady();
      if (trigger === 'abort') { void control.search(); await Promise.resolve(); await Promise.resolve(); }
      armed = true;
      control.update(source, 'en', true, { search: 'outer', hiddenKinds: [] });
      await waitUntil(() => seen.includes('newest'));
      expect(await control.whenReady()).to.equal(true);
      expect(seen[seen.length - 1]).to.equal('newest');
      pending.resolve(empty());
    }
  });


  it('cannot retain four hundred individually valid 65,536-unit display values', async () => {
    const { control } = setup({ maxUnits: 2_000_000, maxRowUnits: 65_540, unitsOf: value => value.length });
    const source = provider(); let reads = 0;
    source.project = async () => ({ state: 'state', total: 400, rows: { count: 400,
      keyAt: i => `k${i}`, indexOfKey: (key: string | number) => Number(String(key).slice(1)),
      itemAt: i => { reads++; return row(i, 'x'.repeat(65_536)); } } });
    control.update(source, 'en'); await control.whenReady();
    for (let i = 0; i < 400; i++) expect(control.slot(i).state).to.equal('ready');
    expect(reads).to.equal(400);
    expect(control.slot(0).state).to.equal('ready');
    expect(reads).to.equal(401);
  });

  it('admits an exact row payload and rejects a one-unit overflow including parent identity', async () => {
    for (const extra of [0, 1]) {
      const { control } = setup({ maxUnits: 65_568, maxRowUnits: 16, unitsOf: value => value.length });
      const source = provider();
      source.project = async () => ({ state: 's'.repeat(65_536), total: 1,
        rows: { count: 1, keyAt: () => 'k0', indexOfKey: () => 0,
          itemAt: () => ({ ...row(0, 'x'.repeat(10 + extra)), parentKey: 'root' }) } });
      control.update(source, 'en'); expect(await control.whenReady()).to.equal(true);
      expect(control.slot(0).state).to.equal(extra ? 'error' : 'ready');
    }
  });

  it('settles pending searches and copies stale on replacement, locale, disconnect and adoption', async () => {
    for (const revoke of ['replacement', 'locale', 'disconnect', 'adoption']) {
      const { control, host, disconnect } = setup(); const source = provider();
      const searching = deferred<LyraSourceSearchResult<{ key: string }>>(); const copying = deferred<string>();
      let calls = 0;
      source.search = () => { calls++; return searching.promise; };
      source.copy = () => { calls++; return copying.promise; };
      control.update(source, 'en'); await control.whenReady();
      const search = control.search(); const copy = control.copy(null, 'document', 4);
      await waitUntil(() => calls === 2);
      if (revoke === 'replacement') control.update(provider(), 'en');
      else if (revoke === 'locale') control.update(source, 'fr');
      else if (revoke === 'disconnect') disconnect();
      else { const target = document.implementation.createHTMLDocument(); target.body.append(target.adoptNode(host)); control.adopted(); }
      expect((await search).status, revoke).to.equal('stale');
      expect((await copy).status, revoke).to.equal('stale');
      searching.resolve(empty()); copying.resolve('late');
    }
  });


  it('bounds ignored-abort copy calls and rejects non-string or rejected provider results', async () => {
    const { control } = setup(); const source = provider();
    const releases: Array<ReturnType<typeof deferred<string>>> = [];
    source.copy = () => { const next = deferred<string>(); releases.push(next); return next.promise; };
    control.update(source, 'en'); await control.whenReady();
    const first = control.copy(null, 'document', 4); await waitUntil(() => releases.length === 1);
    const middle = control.copy('k1', 'node', 4); const last = control.copy('k2', 'subtree', 4);
    expect((await first).status).to.equal('stale'); expect((await middle).status).to.equal('stale');
    expect(releases.length).to.equal(1);
    releases[0]!.resolve('old'); await waitUntil(() => releases.length === 2);
    releases[1]!.resolve('new'); expect((await last).status).to.equal('ready');
    Reflect.set(source, 'copy', async () => 42);
    expect((await control.copy(null, 'document', 4)).status).to.equal('error');
    source.copy = async () => { throw new Error('Provider detail'); };
    expect(await control.copy(null, 'document', 4)).to.deep.equal({ status: 'error' });
  });


  it('preserves a valid reentrant replacement from abort when an outer query is invalid', async () => {
    const { control } = setup(); const source = provider(); const next = provider();
    const pending = deferred<LyraSourceSearchResult<{ key: string }>>(); let started = false;
    source.search = request => {
      started = true;
      request.signal.addEventListener('abort', () => {
        control.update(next, 'fr', false, { search: 'newest', hiddenKinds: [] });
      }, { once: true });
      return pending.promise;
    };
    let query = '';
    const project = next.project;
    next.project = async request => { query = request.query.search; return project(request); };
    control.update(source, 'en'); await control.whenReady();
    const search = control.search(); await waitUntil(() => started);
    control.update(source, 'en', false, { search: 'x'.repeat(4097), hiddenKinds: [] });
    expect((await search).status).to.equal('stale');
    expect(await control.whenReady()).to.equal(true);
    expect(query).to.equal('newest'); expect(control.error).to.equal(false);
    expect(control.projection !== undefined).to.equal(true);
    pending.resolve(empty());
  });

});
