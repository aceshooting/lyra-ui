import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraPageResult, LyraPageSource, LyraSourceRecord } from '../data-sources.js';
import { SourcePageController, type SourcePageOptions } from './source-page-controller.js';
import { setSourcePageScope } from './source-page-scope.js';

type Row = { id: string; text: string };
type Query = { search: string };
const tick = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const record = (index: number): LyraSourceRecord<Row> => ({ key: `key-${index}`, order: index, value: { id: `key-${index}`, text: `Row ${index}` } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}
function provider(total = 100): LyraPageSource<Row, Query> {
  return {
    revision: 1,
    query: async ({ page, pageSize }) => ({
      total,
      rows: Array.from({ length: Math.min(pageSize, Math.max(0, total - page * pageSize)) }, (_, i) => record(page * pageSize + i)),
    }),
    lookup: async (keys) => keys.map((key) => record(Number(key.slice(4)))),
    locate: async (key) => Number(key.slice(4)),
  };
}
function setup(extra: Partial<SourcePageOptions<Row, Query, undefined>> = {}, scopeOwner?: object) {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {},
    updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  if (scopeOwner) setSourcePageScope(host, scopeOwner);
  const control = new SourcePageController<Row, Query>(host, {
    normalizeRecord: (value) => ({ key: value.key, order: value.order, value: value.value as Row }),
    validateMetadata: () => {},
    onChange: () => {},
    ...extra,
  });
  const bind = (source: LyraPageSource<Row, Query>, epoch = 0, locale = 'en') =>
    control.bind({ source, revision: source.revision, epoch, locale });
  return { host, control, bind, disconnect: () => { host.remove(); controllers.forEach((entry) => entry.hostDisconnected?.()); } };
}

describe('SourcePageController source validation and stale work', () => {
  it('rejects a page source that lacks a required capability or a string locale', async () => {
    const test = setup();
    const valid = provider();
    const sources: unknown[] = [{}, null, { query: valid.query }, { query: valid.query, lookup: valid.lookup }, { ...valid, locate: 5 }];
    for (const source of sources) {
      expect(() => test.control.bind({ source: source as never, revision: 1, epoch: 0, locale: 'en' }), String(source)).to.throw(TypeError, 'Invalid page source');
      expect(test.control.state.error).to.be.instanceOf(TypeError);
    }
    expect(() => test.control.bind({ source: valid, revision: 1, epoch: 0, locale: 5 as never })).to.throw(TypeError, 'Invalid page source');
    test.bind(valid);
    expect(await test.control.request({ search: '' }, 0, 2)).to.equal(true);
    expect(test.control.state.error).to.equal(undefined);
    test.disconnect();
  });

  it('keeps the replacement bound while a binding getter is read', async () => {
    const test = setup();
    const replacement = provider(3);
    const obsolete = provider();
    let replacementQueries = 0;
    let obsoleteQueries = 0;
    const replacementQuery = replacement.query;
    replacement.query = (request) => { replacementQueries++; return replacementQuery(request); };
    const obsoleteQuery = obsolete.query;
    obsolete.query = (request) => { obsoleteQueries++; return obsoleteQuery(request); };
    const hostile = { source: obsolete, epoch: 0, locale: 'en', get revision() { test.bind(replacement); return 1; } };
    test.control.bind(hostile);
    expect(await test.control.request({ search: '' }, 0, 3)).to.equal(true);
    expect(test.control.state.result?.total).to.equal(3);
    expect([replacementQueries, obsoleteQueries]).to.deep.equal([1, 0]);
    test.disconnect();
  });

  it('keeps the newest binding when an abort callback rebinds during a source change', async () => {
    const test = setup();
    const pending = deferred<LyraPageResult<Row>>();
    const first = provider();
    const replacement = provider(3);
    const third = provider(7);
    let aborts = 0;
    let thirdQueries = 0;
    const thirdQuery = third.query;
    third.query = (request) => { thirdQueries++; return thirdQuery(request); };
    first.query = (request) => {
      request.signal.addEventListener('abort', () => { aborts++; test.bind(replacement); }, { once: true });
      return pending.promise;
    };
    test.bind(first);
    const inFlight = test.control.request({ search: '' }, 0, 3);
    await tick();
    test.bind(third);
    expect(aborts).to.equal(1);
    expect(await inFlight).to.equal(false);
    // A revoked provider keeps its physical permit until it settles; release it so the lane is free.
    pending.resolve({ total: 100, rows: [] });
    await tick();
    expect(await test.control.request({ search: '' }, 0, 3)).to.equal(true);
    expect(test.control.state.result?.total, 'the callback\'s binding, not the one that triggered it').to.equal(3);
    expect(thirdQueries).to.equal(0);
    test.disconnect();
  });

  it('keeps a newer page started inside the abort callback of the locate it replaces', async () => {
    const test = setup();
    const source = provider();
    const pendingLocate = deferred<number | null>();
    let nested: Promise<boolean> | undefined;
    source.locate = (_key, _query, context) => {
      context.signal.addEventListener('abort', () => { nested = test.control.request({ search: 'nested' }, 0, 2); }, { once: true });
      return pendingLocate.promise;
    };
    test.bind(source);
    expect(await test.control.request({ search: 'first' }, 0, 2)).to.equal(true);
    const located = test.control.locate('key-1');
    await tick();
    const outer = test.control.request({ search: 'outer' }, 0, 2);
    expect(await outer, 'the request that triggered the callback yields to the one the callback started').to.equal(false);
    expect(await nested).to.equal(true);
    expect(test.control.state.result?.rows.map((row) => row.key)).to.deep.equal(['key-0', 'key-1']);
    pendingLocate.resolve(1);
    expect(await located).to.equal(null);
    test.disconnect();
  });

  it('reports no page and clears pending when the controller has no binding', async () => {
    const test = setup();
    expect(await test.control.request({ search: '' }, 0, 10)).to.equal(false);
    expect(test.control.state.pending).to.equal(false);
    expect(test.control.state.error).to.equal(undefined);
    test.disconnect();
  });

  it('settles a queued page when the host leaves before the lane starts', async () => {
    const test = setup();
    let queries = 0;
    const source = provider();
    const query = source.query;
    source.query = (request) => { queries++; return query(request); };
    test.bind(source);
    const pending = test.control.request({ search: '' }, 0, 2);
    test.host.remove();
    expect(await pending).to.equal(false);
    expect(queries).to.equal(0);
    expect(test.control.state.result).to.equal(undefined);
    test.disconnect();
  });

  it('keeps a newer selection started inside the abort callback of the lookup it replaces', async () => {
    const test = setup();
    const source = provider();
    const pendingLookup = deferred<readonly LyraSourceRecord<Row>[]>();
    const lookup = source.lookup;
    let first = true;
    let nested: Promise<readonly LyraSourceRecord<Row>[] | undefined> | undefined;
    source.lookup = (keys, context) => {
      if (!first) return lookup(keys, context);
      first = false;
      context.signal.addEventListener('abort', () => { nested = test.control.resolveSelection(['key-2']); }, { once: true });
      return pendingLookup.promise;
    };
    test.bind(source);
    const stale = test.control.resolveSelection(['key-1']);
    await tick();
    const outer = test.control.resolveSelection(['key-3']);
    expect(await stale).to.equal(undefined);
    expect(await outer).to.equal(undefined);
    // The revoked lookup keeps its physical permit until the provider settles it.
    pendingLookup.resolve([]);
    expect((await nested)?.map((row) => row.key)).to.deep.equal(['key-2']);
    test.disconnect();
  });

  it('keeps a newer selection started while the key collection is being read', async () => {
    const test = setup();
    test.bind(provider());
    let nested: Promise<readonly LyraSourceRecord<Row>[] | undefined> | undefined;
    const keys = new Proxy(['key-1'], {
      getOwnPropertyDescriptor(target, key) {
        nested ??= test.control.resolveSelection(['key-2']);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    expect(await test.control.resolveSelection(keys)).to.equal(undefined);
    expect((await nested)?.map((row) => row.key)).to.deep.equal(['key-2']);
    expect(test.control.state.selectionPending).to.equal(false);
    test.disconnect();
  });

  it('discards a selection whose record normalizer replaces the source mid-projection', async () => {
    let rebind = false;
    const replacement = provider(5);
    const test = setup({
      normalizeRecord: (value) => {
        if (rebind) { rebind = false; test.bind(replacement, 1); }
        return { key: value.key, order: value.order, value: value.value as Row };
      },
    });
    test.bind(provider());
    rebind = true;
    expect(await test.control.resolveSelection(['key-1'])).to.equal(undefined);
    expect(test.control.state.selectionError).to.equal(undefined);
    expect((await test.control.resolveSelection(['key-1']))?.map((row) => row.key)).to.deep.equal(['key-1']);
    test.disconnect();
  });

  it('fails a page whose normalizer changes a record identity', async () => {
    const test = setup({ normalizeRecord: (value) => ({ key: `${value.key}-renamed`, order: value.order, value: value.value as Row }) });
    test.bind(provider());
    expect(await test.control.request({ search: '' }, 0, 1)).to.equal(false);
    const error = test.control.state.error;
    expect(error instanceof TypeError && error.message).to.equal('Source record identity changed');
    test.disconnect();
  });
  it('settles a page granted the shared permit as canceled when its host left the document while it waited', async () => {
    const owner = {};
    const pending = deferred<LyraPageResult<Row>>();
    const calls: string[] = [];
    const source = provider(1);
    source.query = (request) => {
      calls.push(request.query.search);
      return calls.length === 1 ? pending.promise : Promise.resolve({ total: 1, rows: [record(0)] });
    };
    const first = setup({}, owner);
    first.bind(source);
    const old = first.control.request({ search: 'old' }, 0, 1);
    await tick();
    first.disconnect();
    const waiting = setup({}, owner);
    waiting.bind(source);
    const queued = waiting.control.request({ search: 'queued' }, 0, 1);
    await tick();
    // The host leaves without telling its controller: the permit is still granted, then refused.
    waiting.host.remove();
    pending.resolve({ total: 1, rows: [record(0)] });
    expect(await old).to.equal(false);
    expect(await queued).to.equal(false);
    expect(calls, 'the waiting page never reached the provider').to.deep.equal(['old']);
    expect(waiting.control.state.result).to.equal(undefined);
    waiting.disconnect();
  });
});
