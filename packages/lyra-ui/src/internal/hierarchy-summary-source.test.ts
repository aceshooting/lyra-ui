import { expect } from '@open-wc/testing';
import type { LyraHierarchyQuery, LyraHierarchyRow, LyraHierarchySource, LyraHierarchyView, LyraTraceSourceSummary } from '../data-sources.js';
import { captureHierarchySourceEffects, createHierarchySummarySource, traceSourceSummary } from './hierarchy-summary-source.js';

type Row = LyraHierarchyRow<string>;
type Source = LyraHierarchySource<string, LyraHierarchyQuery, LyraTraceSourceSummary>;
const row: Row = { key: 'one', value: 'One', parentKey: null, level: 1, position: 1,
  setSize: 1, childCount: 0, expanded: false, selected: false };

function fixture(rows: LyraHierarchyView<Row> = {
  count: 1, itemAt: () => row, keyAt: () => 'one', indexOfKey: () => 0,
}) {
  const host = { ownerDocument: document, isConnected: true };
  const binding = { version: 0 };
  const accepted: { summary: LyraTraceSourceSummary; current: () => boolean }[] = [];
  const source: Source = { revision: 1, async project() {
    return { state: 'one', total: 1, rows, summary: { startMs: 0, endMs: 10 } };
  } };
  const wrapper = createHierarchySummarySource(host, source, {
    captureBinding: () => { const version = binding.version; return () => binding.version === version; },
    summary: traceSourceSummary,
    accepted: (_rows, summary, current) => { accepted.push({ summary, current }); },
    changedMessage: 'Source changed', rangeChangedMessage: 'Range changed', navigationChangedMessage: 'Navigation changed',
  });
  const project = (signal = new AbortController().signal) => wrapper.project({ revision: 1, locale: 'en', signal,
    query: { search: '', hiddenKinds: [] }, state: null, action: { type: 'reset' } });
  return { host, binding, source, rows, wrapper, project, accepted };
}

describe('hierarchy summary source', () => {
  it('captures each projection binding separately and leaves optional capabilities unforwarded', async () => {
    const state = fixture();
    state.source.search = async () => ({ hits: [], total: 0, exhaustive: true });
    await state.project();
    expect(state.accepted[0]!.current()).to.equal(true);
    state.binding.version++;
    expect(state.accepted[0]!.current()).to.equal(false);
    await state.project();
    expect(state.accepted[1]!.current()).to.equal(true);
    expect(state.accepted[1]!.summary).to.deep.equal({ startMs: 0, endMs: 10 });
    expect(Object.keys(state.wrapper)).to.deep.equal(['revision', 'project']);
  });

  it('rechecks ownership after a revision getter and before invoking the provider', async () => {
    const state = fixture();
    let calls = 0;
    const project = state.source.project;
    state.source.project = function (request) { calls++; return project.call(this, request); };
    Object.defineProperty(state.source, 'revision', { get() { state.binding.version++; return 1; } });
    expect(await state.project().then(() => 'accepted', () => 'rejected')).to.equal('rejected');
    expect(calls).to.equal(0);
    expect(state.accepted.length).to.equal(0);
  });

  it('does not invoke a project method returned after binding replacement', async () => {
    const state = fixture();
    let calls = 0;
    Object.defineProperty(state.source, 'project', { get() {
      state.binding.version++;
      return () => { calls++; throw new Error('Obsolete method'); };
    } });
    expect(await state.project().then(() => 'accepted', () => 'rejected')).to.equal('rejected');
    expect(calls).to.equal(0);
  });

  it('stops summary descriptor reads immediately when the binding changes', async () => {
    const state = fixture();
    const fields: PropertyKey[] = [];
    const summary = new Proxy({ startMs: 0, endMs: 10 }, { getOwnPropertyDescriptor(target, key) {
      fields.push(key); state.binding.version++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
    state.source.project = async () => ({ state: 'one', total: 1, rows: state.rows, summary });
    expect(await state.project().then(() => 'accepted', () => 'rejected')).to.equal('rejected');
    expect(fields).to.deep.equal(['startMs']);
    expect(state.accepted.length).to.equal(0);
  });

  it('does not inspect indexed methods after a view has trap changes the binding', async () => {
    const state = fixture();
    let reads = 0;
    const rows = new Proxy(state.rows, {
      has(target, key) { state.binding.version++; return Reflect.has(target, key); },
      get(target, key, receiver) { if (key === 'itemAt') reads++; return Reflect.get(target, key, receiver); },
    });
    state.source.project = async () => ({ state: 'one', total: 1, rows, summary: { startMs: 0, endMs: 10 } });
    expect(await state.project().then(() => 'accepted', () => 'rejected')).to.equal('rejected');
    expect(reads).to.equal(0);
  });

  for (const name of ['itemAt', 'keyAt', 'indexOfKey'] as const) it(`rechecks the ${name} getter before calling its obsolete result`, async () => {
    const state = fixture();
    const projection = await state.project();
    if (!('itemAt' in projection.rows)) throw new Error('Expected indexed view');
    let calls = 0;
    Object.defineProperty(state.rows, name, { get() {
      state.binding.version++;
      return () => { calls++; throw new Error('Obsolete row method'); };
    } });
    const rows = projection.rows;
    expect(() => name === 'indexOfKey' ? rows.indexOfKey('one') : rows[name](0)).to.throw('Source changed');
    expect(calls).to.equal(0);
  });

  for (const operation of ['read', 'indexOfKey'] as const) it(`honors the independent ${operation} signal after method lookup`, async () => {
    const rows: LyraHierarchyView<Row> = { count: 1, async read() { return [row]; }, async indexOfKey() { return 0; } };
    const state = fixture(rows);
    const projection = await state.project();
    if (!('read' in projection.rows)) throw new Error('Expected ranged view');
    const controller = new AbortController();
    let calls = 0;
    Object.defineProperty(rows, operation, { get() {
      controller.abort();
      return () => { calls++; throw new Error('Canceled method'); };
    } });
    const context = { signal: controller.signal, revision: 1, locale: 'en' };
    const response = operation === 'read' ? projection.rows.read({ ...context, offset: 0, limit: 1 }) : projection.rows.indexOfKey('one', context);
    expect(await response.then(() => 'accepted', () => 'rejected')).to.equal('rejected');
    expect(calls).to.equal(0);
    expect(state.accepted[0]!.current()).to.equal(true);
  });

  it('rejects an ignored-abort range response while retaining the project authority', async () => {
    let finish!: (rows: readonly Row[]) => void;
    const state = fixture({ count: 1, read: () => new Promise(resolve => { finish = resolve; }), async indexOfKey() { return 0; } });
    const projection = await state.project();
    if (!('read' in projection.rows)) throw new Error('Expected ranged view');
    const controller = new AbortController();
    const pending = projection.rows.read({ signal: controller.signal, revision: 1, locale: 'en', offset: 0, limit: 1 });
    controller.abort(); finish([row]);
    expect(await pending.then(() => 'accepted', () => 'rejected')).to.equal('rejected');
    expect(state.accepted[0]!.current()).to.equal(true);
  });

  it('accepts no summary when the final projection field changes ownership', async () => {
    const state = fixture();
    state.source.project = async () => ({ state: 'one', total: 1, rows: state.rows, summary: { startMs: 0, endMs: 10 },
      get focusIndex() { state.binding.version++; return 0; },
    });
    expect(await state.project().then(() => 'accepted', () => 'rejected')).to.equal('rejected');
    expect(state.accepted.length).to.equal(0);
  });

  it('revokes accepted views on disconnect, adoption and project cancellation', async () => {
    const state = fixture();
    const controller = new AbortController();
    await state.project(controller.signal);
    const current = state.accepted[0]!.current;
    state.host.isConnected = false; expect(current()).to.equal(false);
    state.host.isConnected = true; expect(current()).to.equal(true);
    state.host.ownerDocument = document.implementation.createHTMLDocument(); expect(current()).to.equal(false);
    state.host.ownerDocument = document; expect(current()).to.equal(true);
    controller.abort(); expect(current()).to.equal(false);
  });
});

it('distinguishes a bound hierarchy effect from the captured rendered status', () => {
  const host = { ownerDocument: document, isConnected: true };
  const control = { epoch: 1, projection: {}, error: false, loading: false, rowError: false, rowsObserved: true };
  let binding = true;
  const snapshot = captureHierarchySourceEffects(host, control, () => binding);
  expect(snapshot.current()).to.equal(true);
  for (const key of ['error', 'loading', 'rowError', 'rowsObserved'] as const) {
    control[key] = !control[key];
    expect(snapshot.bound()).to.equal(true); expect(snapshot.current()).to.equal(false);
    control[key] = !control[key];
  }
  const projection = control.projection;
  control.projection = {}; expect(snapshot.current()).to.equal(false);
  control.projection = projection; expect(snapshot.current()).to.equal(true);
  control.epoch++; expect(snapshot.bound()).to.equal(false); control.epoch--;
  binding = false; expect(snapshot.bound()).to.equal(false); binding = true;
  host.ownerDocument = document.implementation.createHTMLDocument(); expect(snapshot.bound()).to.equal(false);
  host.ownerDocument = document; host.isConnected = false; expect(snapshot.bound()).to.equal(false);
});
