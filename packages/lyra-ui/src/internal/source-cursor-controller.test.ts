import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraCursorRequest, LyraCursorResult, LyraCursorSource } from '../data-sources.js';
import { SourceCursorController, type SourceCursorOptions } from './source-cursor-controller.js';
import { cursorField, cursorText } from './source-cursor-projection.js';
import { setSourcePageScope, shareSourcePageQueries } from './source-page-scope.js';

type Row = { readonly text: string };
type Query = { readonly search: string };
const query = Object.freeze({ search: '' });
const page = (text: string, nextCursor: string | null = null): LyraCursorResult<Row> => ({ rows: [{ key: text, value: { text } }], nextCursor });
const tick = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
function setup(extra: Partial<SourceCursorOptions<Row>> = {}, owner?: object) {
  const controllers = new Set<ReactiveController>();
  let paints = 0;
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  setSourcePageScope(host, owner ?? host);
  shareSourcePageQueries(host);
  const control = new SourceCursorController<Row, Query>(host, {
    normalizeRecord: (_key, value, current) => {
      const text = cursorText(cursorField(value, 'text', current), 65_536);
      return { value: Object.freeze({ text }), textUnits: text.length };
    }, onChange: () => { paints++; }, ...extra,
  });
  const bind = (source: LyraCursorSource<Row, Query>, epoch = 0) =>
    control.bind({ source, revision: source.revision, scope: source.scope, epoch, locale: 'en' });
  const disconnect = () => { host.remove(); for (const controller of controllers) controller.hostDisconnected?.(); };
  return { host, control, bind, disconnect, paints: () => paints };
}

it('captures a provider method once, preserves its receiver and freezes each complete request', async () => {
  const test = setup();
  let reads = 0;
  const source: LyraCursorSource<Row, Query> = {
    revision: 'r1', scope: 'scope',
    get query() {
      reads++;
      return async function (this: unknown, request: LyraCursorRequest<Query>) {
        expect(this === source).to.equal(true);
        expect(Object.isFrozen(request)).to.equal(true);
        expect(request.query === query).to.equal(true);
        return page(request.cursor ?? 'first', request.cursor === null ? ' opaque / token ' : null);
      };
    },
  };
  try {
    test.bind(source);
    expect(await test.control.request(query, 2)).to.equal(true);
    expect(await test.control.next()).to.equal(true);
    expect(reads).to.equal(1);
    expect(test.control.state.rows[0]?.key).to.equal(' opaque / token ');
    expect(Object.isFrozen(test.control.state.navigation)).to.equal(true);
  } finally { test.disconnect(); }
});

it('settles superseded logical work while retaining a physical callback until it resolves', async () => {
  const test = setup(), held = deferred<LyraCursorResult<Row>>();
  const searches: string[] = [];
  const source: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: async request => {
    searches.push(request.query.search);
    return searches.length === 1 ? held.promise : page(request.query.search);
  } };
  try {
    test.bind(source);
    const old = test.control.request(query, 1);
    await tick();
    const middle = test.control.request(Object.freeze({ search: 'middle' }), 1);
    const newest = test.control.request(Object.freeze({ search: 'newest' }), 1);
    expect(await old).to.equal(false);
    expect(await middle).to.equal(false);
    await tick();
    expect(searches).to.deep.equal(['']);
    held.resolve(page('obsolete'));
    expect(await newest).to.equal(true);
    expect(searches).to.deep.equal(['', 'newest']);
    expect(test.control.state.rows.map(row => row.key)).to.deep.equal(['newest']);
  } finally { test.disconnect(); }
});

it('does not read another provider field after a descriptor trap revokes the request', async () => {
  const test = setup();
  const fields: PropertyKey[] = [];
  const source: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: async () =>
    new Proxy(page('obsolete'), { getOwnPropertyDescriptor: (target, key) => {
      fields.push(key); test.control.invalidate(); return Object.getOwnPropertyDescriptor(target, key);
    } }) };
  try {
    test.bind(source);
    expect(await test.control.request(query, 1)).to.equal(false);
    expect(fields).to.deep.equal(['rows']);
    expect(test.control.state.navigation.status).to.equal('idle');
    expect(test.control.state.rows.length).to.equal(0);
  } finally { test.disconnect(); }
});

it('lets a reentrant method getter install a newer binding without an obsolete query', async () => {
  const test = setup();
  let obsoleteCalls = 0;
  const replacement: LyraCursorSource<Row, Query> = { revision: 2, scope: 'replacement', query: async () => page('new') };
  const original: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', get query() {
    test.bind(replacement);
    return async () => { obsoleteCalls++; return page('old'); };
  } };
  try {
    test.bind(original);
    expect(await test.control.request(query, 1)).to.equal(true);
    expect(test.control.state.rows.map(row => row.key)).to.deep.equal(['new']);
    expect(obsoleteCalls).to.equal(0);
  } finally { test.disconnect(); }
});

it('retains only a bounded error state and retries the exact failed intent after projection rejection', async () => {
  const test = setup();
  let malformed = true;
  const cursors: (string | null)[] = [];
  const source: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: async request => {
    cursors.push(request.cursor);
    if (request.cursor === null) return page('first', 'second');
    return malformed ? { rows: [page('bad').rows[0]!, page('bad').rows[0]!], nextCursor: null } : page('second');
  } };
  try {
    test.bind(source);
    expect(await test.control.request(query, 2)).to.equal(true);
    expect(await test.control.next()).to.equal(false);
    expect(test.control.state.navigation.status).to.equal('error');
    expect(test.control.state.navigation.atEnd).to.equal(false);
    expect(test.control.state.rows.length).to.equal(0);
    malformed = false;
    expect(await test.control.retry()).to.equal(true);
    expect(cursors).to.deep.equal([null, 'second', 'second']);
    expect(test.control.state.navigation.canGoBack).to.equal(true);
  } finally { test.disconnect(); }
});

it('enforces aggregate document text before publishing any rows', async () => {
  const test = setup();
  const source: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: async () => ({
    rows: Array.from({ length: 32 }, (_, index) => ({ key: String(index), value: { text: 'x'.repeat(65_536) } })), nextCursor: null,
  }) };
  try {
    test.bind(source);
    expect(await test.control.request(query, 32)).to.equal(false);
    expect(test.control.state.navigation.status).to.equal('error');
    expect(test.control.state.rows.length).to.equal(0);
  } finally { test.disconnect(); }
});

it('discards rejected binding metadata and exposes no retryable stale request', async () => {
  const test = setup();
  const source: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: async () => page('first') };
  try {
    test.bind(source);
    expect(await test.control.request(query, 1)).to.equal(true);
    test.control.bind({ source, revision: 'r'.repeat(8_193), scope: 'scope', epoch: 1, locale: 'en' });
    expect(test.control.state.navigation.status).to.equal('error');
    expect(test.control.state.rows.length).to.equal(0);
    expect(await test.control.retry()).to.equal(false);
  } finally { test.disconnect(); }
});

it('settles retired composition work immediately while the unfinished callback still blocks its replacement', async () => {
  const owner = {}, first = setup({}, owner), held = deferred<LyraCursorResult<Row>>();
  let signal: AbortSignal | undefined;
  const original: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: request => {
    signal = request.signal;
    return held.promise;
  } };
  first.bind(original);
  const pending = first.control.request(query, 1);
  await tick();
  const second = setup({}, owner);
  let replacementCalls = 0;
  const replacement: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: async () => {
    replacementCalls++; return page('replacement');
  } };
  try {
    expect(await pending).to.equal(false);
    expect(signal?.aborted).to.equal(true);
    expect(first.control.state.navigation.status).to.equal('idle');
    second.bind(replacement);
    const next = second.control.request(query, 1);
    await tick();
    expect(replacementCalls).to.equal(0);
    held.resolve(page('obsolete'));
    expect(await next).to.equal(true);
    expect(replacementCalls).to.equal(1);
    expect(first.control.state.rows.length).to.equal(0);
    expect(second.control.state.rows.map(row => row.key)).to.deep.equal(['replacement']);
  } finally { held.resolve(page('obsolete')); first.disconnect(); second.disconnect(); }
});

it('revokes ready rows and navigation synchronously when their composition host retires', async () => {
  const owner = {}, first = setup({}, owner);
  const source: LyraCursorSource<Row, Query> = { revision: 1, scope: 'scope', query: async () => page('first', 'next') };
  first.bind(source);
  expect(await first.control.request(query, 1)).to.equal(true);
  await tick();
  const second = setup({}, owner);
  try {
    expect(first.control.state.navigation.status).to.equal('idle');
    expect(first.control.state.rows.length).to.equal(0);
    expect(await first.control.next()).to.equal(false);
    expect(await first.control.retry()).to.equal(false);
  } finally { first.disconnect(); second.disconnect(); }
});
