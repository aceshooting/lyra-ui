import assert from 'node:assert/strict';
import test from 'node:test';
import { captureTableToolIntent, tableInsertDraft } from './table-tools.js';
import type { DocxSession, DocxSnapshot } from './types.js';

function fixture() {
  let released = 0;
  const options: unknown[] = [];
  let snapshot = { status: 'ready', revision: { documentId: 'doc', value: 0 },
    selection: { kind: 'caret', version: 1 } } as DocxSnapshot;
  const session = { snapshot: () => snapshot,
    retainSelection: () => ({ ok: true, value: { release() { released++; } } }),
    execute: (_action: unknown, value: unknown) => { options.push(value); return { ok: true, value: snapshot.revision }; },
  } as unknown as DocxSession;
  return { session, options, released: () => released, change(next: Partial<DocxSnapshot>) { snapshot = { ...snapshot, ...next }; } };
}

test('table insertion drafts require complete bounded decimal integers', () => {
  assert.deepEqual(tableInsertDraft('2', '2'), { type: 'insert-table', rows: 2, columns: 2 });
  assert.deepEqual(tableInsertDraft('20', '20'), { type: 'insert-table', rows: 20, columns: 20 });
  for (const value of ['', ' ', '0', '-1', '21', '1.5', '1e1', 'Infinity', ' 2', '2 ']) {
    assert.equal(tableInsertDraft(value, '2'), null);
    assert.equal(tableInsertDraft('2', value), null);
  }
});

test('table intent retains unchanged drafts and consumes exactly one original lease', async () => {
  const f = fixture();
  const intent = captureTableToolIntent(f.session)!;
  assert.equal(intent.valid(f.session), true);
  assert.equal((await intent.execute(f.session, { type: 'delete-table' })).ok, true);
  assert.equal(f.options.length, 1);
  assert.equal(f.released(), 1);
  assert.deepEqual((await intent.execute(f.session, { type: 'delete-table' })), { ok: false, code: 'stale-selection' });
  intent.release();
  assert.equal(f.released(), 1);
});

test('table intent refuses replacement, reselection, revision changes and released intent without live fallback', async () => {
  for (const kind of ['selection', 'revision', 'session', 'release']) {
    const f = fixture();
    const intent = captureTableToolIntent(f.session)!;
    let target = f.session;
    if (kind === 'selection') f.change({ selection: { kind: 'caret', version: 3 } });
    if (kind === 'revision') f.change({ revision: { documentId: 'doc', value: 1 } });
    if (kind === 'session') target = fixture().session;
    if (kind === 'release') intent.release();
    assert.equal(intent.valid(target), false);
    assert.deepEqual((await intent.execute(target, { type: 'delete-table' })), { ok: false, code: 'stale-selection' });
    assert.equal(f.options.length, 0);
    assert.equal(f.released(), 1);
  }
  const f = fixture();
  f.change({ status: 'destroyed' });
  assert.equal(captureTableToolIntent(f.session), null);
  assert.equal(captureTableToolIntent(null), null);
});

test('table intent releases a lease when acquisition synchronously changes the selection', () => {
  const f = fixture(), retain = f.session.retainSelection;
  f.session.retainSelection = () => {
    const result = retain();
    f.change({ selection: { kind: 'caret', version: 2 } });
    return result;
  };
  assert.equal(captureTableToolIntent(f.session), null);
  assert.equal(f.released(), 1);
  assert.equal(f.options.length, 0);
});


test('dispatched selection intent retains its lease across preparation and releases it exactly once', async () => {
  const f = fixture(), intent = captureTableToolIntent(f.session)!;
  let resolve!: (value: Awaited<ReturnType<DocxSession['execute']>>) => void;
  f.session.execute = () => new Promise(done => { resolve = done; });
  const pending = intent.execute(f.session, { type: 'delete-table' });
  intent.release();
  assert.equal(f.released(), 0);
  assert.deepEqual(await intent.execute(f.session, { type: 'delete-table' }), { ok: false, code: 'stale-selection' });
  assert.equal(f.released(), 0);
  resolve({ ok: true, value: f.session.snapshot().revision! });
  assert.equal((await pending).ok, true);
  intent.release(); assert.equal(f.released(), 1);
});
