import { expect } from '@open-wc/testing';
import type { HierarchyCapabilityResult } from './hierarchy-source-controller.js';
import {
  hasHierarchySourceCopy,
  hierarchyCopyScope,
  HierarchySourceCopyController,
  HierarchySourceSearchController,
  type HierarchySourceCopySinks,
  type HierarchySourceSearchOptions,
} from './hierarchy-source-search.js';
import type { CopyOutcome } from './record-copy-feedback.js';

type SearchResult = Awaited<ReturnType<HierarchySourceSearchOptions['control']['search']>>;

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function ready(keys: readonly string[], options: { exhaustive?: boolean; current?: () => boolean } = {}): SearchResult {
  return {
    status: 'ready',
    value: { hits: keys.map((key) => ({ key })), total: keys.length, exhaustive: options.exhaustive ?? true },
    isCurrent: options.current ?? (() => true),
  };
}

function searchFixture(overrides: Partial<HierarchySourceSearchOptions> = {}) {
  const log: string[] = [];
  const state = { query: 'needle', source: {} as unknown, cursor: -1, connected: true, updated: true };
  let next: Promise<SearchResult> = Promise.resolve(ready(['a', 'b', 'c']));
  let reveal: (key: string) => Promise<boolean> = () => Promise.resolve(true);
  const host = {
    get isConnected() { return state.connected; },
    get hasUpdated() { return state.updated; },
    updateComplete: Promise.resolve(true),
  };
  const controller = new HierarchySourceSearchController({
    host,
    control: {
      search: () => { log.push('search'); return next; },
      reveal: (key) => { log.push(`reveal:${key}`); return reveal(key); },
      cancelSearch: () => log.push('cancel'),
    },
    source: () => state.source,
    query: () => state.query,
    cursor: () => state.cursor,
    setCursor: (index) => { state.cursor = index; log.push(`cursor:${index}`); },
    changed: () => log.push('changed'),
    emitChange: () => log.push('emit'),
    ...overrides,
  });
  return {
    controller, log, state,
    respond(result: Promise<SearchResult>) { next = result; },
    revealWith(handler: (key: string) => Promise<boolean>) { reveal = handler; },
  };
}

describe('HierarchySourceSearchController', () => {
  it('cancels the provider search for an empty query and reports it once the host has rendered', async () => {
    const fixture = searchFixture();
    fixture.state.query = '';
    fixture.controller.schedule();
    expect(fixture.controller.dirty).to.equal(false);
    expect(await fixture.controller.task).to.equal(0);
    fixture.state.updated = false;
    fixture.controller.invalidate();
    fixture.controller.schedule();
    await fixture.controller.task;
    expect(fixture.log).to.deep.equal(['cancel', 'emit', 'cancel']);
  });

  it('retains current hits, their exactness and the cursor match, and starts only when dirty', async () => {
    const fixture = searchFixture();
    fixture.respond(Promise.resolve(ready(['a', 'b'], { exhaustive: false })));
    fixture.controller.schedule();
    const task = fixture.controller.task;
    fixture.controller.schedule();
    expect(fixture.controller.task === task).to.equal(true);
    expect(await task).to.equal(2);
    expect(fixture.log).to.deep.equal(['search', 'changed', 'emit']);
    expect(fixture.controller.count).to.equal(2);
    expect(fixture.controller.exact).to.equal(false);
    expect(fixture.controller.unavailable).to.equal(false);
    expect([fixture.controller.isMatch('a'), fixture.controller.isMatch('z')]).to.deep.equal([true, false]);
    fixture.state.cursor = 1;
    expect([fixture.controller.isActive('b'), fixture.controller.isActive('a')]).to.deep.equal([true, false]);
    const generation = fixture.controller.generation;
    fixture.controller.invalidate();
    expect(fixture.controller.generation).to.equal(generation + 1);
  });

  it('records an unavailable provider search without hits', async () => {
    const fixture = searchFixture();
    fixture.respond(Promise.resolve({ status: 'unavailable' }));
    fixture.controller.schedule();
    expect(await fixture.controller.task).to.equal(0);
    expect([fixture.controller.unavailable, fixture.controller.exact, fixture.controller.isMatch('a')]).to.deep.equal([true, false, false]);
  });

  it('moves the cursor to and reveals the first hit when asked, or clears it when nothing matched', async () => {
    const fixture = searchFixture({ revealFirst: true });
    fixture.controller.schedule();
    expect(await fixture.controller.task).to.equal(3);
    expect(fixture.log).to.deep.equal(['search', 'cursor:0', 'changed', 'emit', 'reveal:a']);
    fixture.log.length = 0;
    fixture.respond(Promise.resolve(ready([])));
    fixture.controller.invalidate();
    fixture.controller.schedule();
    expect(await fixture.controller.task).to.equal(0);
    expect(fixture.log).to.deep.equal(['search', 'cursor:-1', 'changed', 'emit']);
  });

  it('drops a search superseded by invalidation, a provider change, disconnection or a stale projection', async () => {
    const outcomes: [string, (fixture: ReturnType<typeof searchFixture>) => SearchResult][] = [
      ['invalidated', (fixture) => { fixture.controller.invalidate(); return ready(['a']); }],
      ['rebound', (fixture) => { fixture.state.source = {}; return ready(['a']); }],
      ['disconnected', (fixture) => { fixture.state.connected = false; return ready(['a']); }],
      ['stale', () => ({ status: 'stale' })],
      ['superseded projection', () => ready(['a'], { current: () => false })],
    ];
    for (const [label, settle] of outcomes) {
      const fixture = searchFixture();
      const pending = deferred<SearchResult>();
      fixture.respond(pending.promise);
      fixture.controller.schedule();
      pending.resolve(settle(fixture));
      expect(await fixture.controller.task, label).to.equal(0);
      expect(fixture.controller.count, label).to.equal(0);
      expect(fixture.log, label).to.deep.equal(['search']);
    }
  });

  it('reports no count when a search is superseded while the host renders it', async () => {
    const fixture = searchFixture({ changed: () => fixture.controller.invalidate() });
    fixture.controller.schedule();
    expect(await fixture.controller.task).to.equal(0);
  });

  it('steps through current hits with wrapping, starting at either end', async () => {
    const fixture = searchFixture({ beforeStep: () => fixture.log.push('before') });
    expect(await fixture.controller.step(1)).to.equal(false);
    fixture.controller.schedule();
    await fixture.controller.task;
    fixture.log.length = 0;
    expect(await fixture.controller.step(-1)).to.equal(true);
    expect(await fixture.controller.step(1)).to.equal(true);
    expect(await fixture.controller.step(1)).to.equal(true);
    fixture.state.cursor = -1;
    expect(await fixture.controller.step(1)).to.equal(true);
    expect(fixture.log.filter((entry) => entry.startsWith('reveal'))).to.deep.equal(['reveal:c', 'reveal:a', 'reveal:b', 'reveal:a']);
    expect(fixture.log.filter((entry) => entry === 'before').length).to.equal(5 - 1);
  });

  it('reports a step only while its reveal stays current', async () => {
    const fixture = searchFixture();
    let current = true;
    fixture.respond(Promise.resolve(ready(['a', 'b'], { current: () => current })));
    fixture.controller.schedule();
    await fixture.controller.task;
    const cases: [string, () => Promise<boolean>][] = [
      ['not found', () => Promise.resolve(false)],
      ['superseded step', () => { fixture.controller.supersedeSteps(); return Promise.resolve(true); }],
      ['stale projection', () => { current = false; return Promise.resolve(true); }],
    ];
    for (const [label, reveal] of cases) {
      fixture.revealWith(reveal);
      fixture.log.length = 0;
      expect(await fixture.controller.step(1), label).to.equal(false);
      expect(fixture.log.includes('emit'), label).to.equal(false);
      current = true;
    }
    fixture.revealWith(() => { fixture.controller.invalidate(); return Promise.resolve(true); });
    expect(await fixture.controller.step(1)).to.equal(false);
    expect(await fixture.controller.step(1), 'no hits remain after invalidation').to.equal(false);
  });
});

function copyFixture() {
  const log: string[] = [];
  const events: { name: string; detail?: CopyOutcome }[] = [];
  const state = { source: {} as unknown, connected: true, epoch: 1 };
  let clipboard: unknown = { writeText: (text: string) => { log.push(`write:${text}`); return Promise.resolve(); } };
  const ownerDocument = { defaultView: { navigator: { get clipboard() { return clipboard; } } } } as unknown as Document;
  const host = { get isConnected() { return state.connected; }, ownerDocument };
  let result: Promise<HierarchyCapabilityResult<string>> = Promise.resolve({ status: 'ready', value: 'copied text', isCurrent: () => true });
  const sinks: HierarchySourceCopySinks = {
    clearFeedback: () => log.push('clear'),
    feedback: (key, ok) => log.push(`feedback:${key}:${ok}`),
    message: (ok) => { log.push(`message:${ok}`); return ok ? 'Copied' : 'Copy failed'; },
    announce: (text) => log.push(`announce:${text}`),
    emit: (name, detail) => { events.push({ name, detail }); log.push(`emit:${name}`); },
  };
  const controller = new HierarchySourceCopyController({
    host,
    control: { get epoch() { return state.epoch; }, copy: (key, scope, maxBytes) => { log.push(`copy:${key}:${scope}:${maxBytes}`); return result; } },
    source: () => state.source,
    sinks,
  });
  return {
    controller, log, events, state, sinks,
    respond(next: HierarchyCapabilityResult<string>) { result = Promise.resolve(next); },
    useClipboard(next: unknown) { clipboard = next; },
  };
}

describe('HierarchySourceCopyController', () => {
  it('writes the provider text through the owner clipboard and reports success', async () => {
    const fixture = copyFixture();
    await fixture.controller.copy('node-1', 'subtree', 64, 'node-1');
    expect(fixture.log).to.deep.equal(['clear', 'copy:node-1:subtree:64', 'write:copied text', 'feedback:node-1:true',
      'message:true', 'announce:Copied', 'emit:lr-copy']);
    expect(fixture.events[0]!.detail).to.deep.equal({ ok: true, text: 'copied text' });
  });

  it('reports a provider failure with feedback and an announcement but no copy events', async () => {
    const fixture = copyFixture();
    fixture.respond({ status: 'error' });
    await fixture.controller.copy(null, 'document', 64, 'toolbar');
    expect(fixture.log).to.deep.equal(['clear', 'copy:null:document:64', 'feedback:toolbar:false', 'message:false', 'announce:Copy failed']);
    const superseded = copyFixture();
    superseded.respond({ status: 'unavailable' });
    superseded.sinks.message = (ok) => { superseded.controller.invalidate(); return String(ok); };
    await superseded.controller.copy(null, 'document', 64, 'toolbar');
    expect(superseded.log.some((entry) => entry.startsWith('announce'))).to.equal(false);
  });

  it('classifies clipboard failures and emits lr-error before lr-copy-error', async () => {
    const denied = copyFixture();
    denied.useClipboard({ writeText: () => Promise.reject(new DOMException('blocked', 'NotAllowedError')) });
    await denied.controller.copy('k', 'node', 64, 'k');
    expect(denied.events.map(({ name }) => name)).to.deep.equal(['lr-error', 'lr-copy-error']);
    expect(denied.events[1]!.detail).to.include({ ok: false, reason: 'denied' });
    const missing = copyFixture();
    missing.useClipboard(undefined);
    await missing.controller.copy('k', 'node', 64, 'k');
    expect(missing.events[1]!.detail).to.include({ ok: false, reason: 'unsupported' });
    expect(missing.log).to.include('feedback:k:false');
  });

  it('drops a copy superseded before the provider settles, while reading the clipboard or while writing', async () => {
    const stale = copyFixture();
    stale.respond({ status: 'stale' });
    await stale.controller.copy('k', 'node', 64, 'k');
    const replaced = copyFixture();
    const copying = replaced.controller.copy('k', 'node', 64, 'k');
    replaced.state.source = {};
    await copying;
    const outdated = copyFixture();
    outdated.respond({ status: 'ready', value: 'text', isCurrent: () => false });
    await outdated.controller.copy('k', 'node', 64, 'k');
    const reading = copyFixture();
    reading.useClipboard({ get writeText() { reading.state.epoch++; return () => Promise.resolve(); } });
    await reading.controller.copy('k', 'node', 64, 'k');
    const writing = copyFixture();
    writing.useClipboard({ writeText: () => { writing.state.connected = false; return Promise.resolve(); } });
    await writing.controller.copy('k', 'node', 64, 'k');
    for (const fixture of [stale, replaced, outdated, reading, writing]) {
      expect(fixture.log.some((entry) => /^(feedback|announce|emit)/.test(entry))).to.equal(false);
    }
  });

  it('stops announcing and emitting once a listener supersedes the copy', async () => {
    const fixture = copyFixture();
    fixture.sinks.message = () => { fixture.controller.invalidate(); return 'Copied'; };
    await fixture.controller.copy('k', 'node', 64, 'k');
    expect(fixture.log).to.deep.equal(['clear', 'copy:k:node:64', 'write:copied text', 'feedback:k:true']);
  });
});

describe('hierarchy copy helpers', () => {
  it('maps inspection kinds to copy scopes', () => {
    expect(['object', 'array', 'element', 'scalar', 'text', undefined].map((kind) => hierarchyCopyScope(kind)))
      .to.deep.equal(['subtree', 'subtree', 'subtree', 'node', 'node', 'document']);
  });

  it('offers copy only for a stable provider with a copy method', () => {
    const provider = { copy: () => undefined };
    expect(hasHierarchySourceCopy(() => provider)).to.equal(true);
    expect(hasHierarchySourceCopy(() => undefined)).to.equal(false);
    expect(hasHierarchySourceCopy(() => ({}))).to.equal(false);
    let bound: { readonly copy?: unknown } = { get copy() { bound = {}; return () => undefined; } };
    expect(hasHierarchySourceCopy(() => bound)).to.equal(false);
    expect(hasHierarchySourceCopy(() => ({ get copy(): unknown { throw new Error('revoked'); } }))).to.equal(false);
  });
});
