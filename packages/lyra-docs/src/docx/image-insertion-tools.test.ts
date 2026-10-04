import assert from 'node:assert/strict';
import test from 'node:test';
import { captureImageInsertionIntent, imageInsertionDefaults, imageInsertionDraft } from './image-insertion-tools.js';
import { imageRatioPartner } from './image-tools.js';
import type { DocxImageSource, DocxResult, DocxRevision, DocxSession, DocxSnapshot } from './types.js';

const bytes = Uint8Array.of(1, 2, 3);
function fixture() {
  let snapshot = { status: 'ready', activity: null, readOnly: false, composing: false,
    revision: { documentId: 'doc', value: 0 }, selection: { kind: 'caret', version: 1 } } as unknown as DocxSnapshot;
  let releases = 0, retains = 0, available = true, retain = true;
  let onRetain = () => {}, onInsert = () => {};
  let resolve!: (result: DocxResult<DocxRevision>) => void;
  const promise = new Promise<DocxResult<DocxRevision>>(done => { resolve = done; });
  const lease = { release() { releases++; } };
  const calls: { source: DocxImageSource; options: unknown }[] = [];
  const session = { snapshot: () => snapshot,
    canInsertImage: () => available ? { enabled: true } : { enabled: false, reason: 'read-only' },
    retainSelection: () => { retains++; onRetain(); return retain ? { ok: true, value: lease } : { ok: false, code: 'busy' }; },
    insertImage: (source: DocxImageSource, options: unknown) => { calls.push({ source, options }); onInsert(); return promise; },
  } as unknown as DocxSession;
  return { session, lease, calls, resolve, releases: () => releases, retains: () => retains,
    change(next: Partial<DocxSnapshot>) { snapshot = { ...snapshot, ...next }; },
    unavailable() { available = false; }, refuseRetain() { retain = false; },
    onRetain(callback: () => void) { onRetain = callback; }, onInsert(callback: () => void) { onInsert = callback; } };
}

test('insertion defaults use encoded pixels at 96dpi with full precision', () => {
  const defaults = imageInsertionDefaults(7, 3)!;
  assert.equal(defaults.width, '5.25'); assert.equal(defaults.height, '2.25');
  assert.equal(defaults.ratioAvailable, true);
  assert.equal(Number(imageRatioPartner('8', 'width', defaults.original)), 8 * 3 / 7);
  assert.equal(Object.isFrozen(defaults), true); assert.equal(Object.isFrozen(defaults.original), true);
});

test('insertion default scale respects both lower and upper endpoints independently', () => {
  for (const [width, height, expected] of [
    [1, 1, [1, 1]], [2, 1, [2, 1]], [1, 2, [1, 2]],
    [4096, 2048, [1440, 720]], [2048, 4096, [720, 1440]],
    [1440, 1, [1440, 1]], [1, 1440, [1, 1440]],
  ] as const) {
    const defaults = imageInsertionDefaults(width, height)!;
    assert.deepEqual([Number(defaults.width), Number(defaults.height)], expected);
    assert.equal(defaults.ratioAvailable, true);
  }
});

test('impossible encoded aspect ratios start unset and cannot be replaced by a manual ratio', () => {
  for (const [width, height] of [[8192, 1], [1, 8192], [1920, 1], [1, 1920]]) {
    const defaults = imageInsertionDefaults(width!, height!)!;
    assert.equal(defaults.width, ''); assert.equal(defaults.height, ''); assert.equal(defaults.ratioAvailable, false);
    assert.deepEqual(defaults.original, { widthPoints: width, heightPoints: height });
    assert.ok(imageInsertionDraft(bytes, '12.125', '34.625', '', ''));
  }
  for (const value of [0, -1, NaN, Infinity, 1.5, 8193]) {
    assert.equal(imageInsertionDefaults(value, 1), null); assert.equal(imageInsertionDefaults(1, value), null);
  }
});

test('insertion draft never rounds final dimensions or derives metadata from its source', () => {
  const width = String(12701 / 12700), height = String(182881 / 12700);
  const draft = imageInsertionDraft(bytes, width, height, 'A & B', 'Line\n😀')!;
  assert.deepEqual(draft, { bytes, widthPoints: Number(width), heightPoints: Number(height), title: 'A & B', description: 'Line\n😀' });
  assert.equal(draft.bytes, bytes); assert.equal(Math.round(draft.widthPoints * 12700), 12701);
  assert.equal(Math.round(draft.heightPoints * 12700), 182881);
  assert.deepEqual(imageInsertionDraft(bytes, '1', '1440', '', ''), { bytes, widthPoints: 1, heightPoints: 1440, title: '', description: '' });
});

test('insertion draft refuses incomplete numbers, exact metadata limits, CR and malformed XML', () => {
  for (const value of ['', '.', '1.', '0.9', '1440.01', ' 2', '2 ', '1e2', 'NaN', '-1']) {
    assert.equal(imageInsertionDraft(bytes, value, '2', '', ''), null);
    assert.equal(imageInsertionDraft(bytes, '2', value, '', ''), null);
  }
  assert.ok(imageInsertionDraft(bytes, '2', '3', 'x'.repeat(256), 'x'.repeat(2048)));
  for (const [title, description] of [['x'.repeat(257), ''], ['', 'x'.repeat(2049)], ['\r', ''], ['', '\r\n'], ['\u0000', ''], ['', '\ud800']])
    assert.equal(imageInsertionDraft(bytes, '2', '3', title!, description!), null);
  assert.equal(imageInsertionDraft(new Uint8Array(), '2', '3', '', ''), null);
  assert.equal(imageInsertionDraft(new Uint8Array(4 * 1024 * 1024 + 1), '2', '3', '', ''), null);
});

test('prepared caret intent keeps one authentic lease and idempotent predispatch cancellation', () => {
  const f = fixture(), intent = captureImageInsertionIntent(f.session)!;
  assert.equal(intent.valid(f.session), true); assert.equal(f.retains(), 1);
  intent.release(); intent.release(); assert.equal(f.releases(), 1);
  assert.equal(intent.valid(f.session), false);
});

test('original intent rejects reselection ABA, revision, replacement and release without recapture', async () => {
  for (const change of ['selection', 'revision', 'document', 'session', 'release', 'destroyed']) {
    const f = fixture(), intent = captureImageInsertionIntent(f.session)!; let owner = f.session;
    if (change === 'selection') f.change({ selection: { kind: 'caret', version: 3 } });
    if (change === 'revision') f.change({ revision: { documentId: 'doc', value: 1 } });
    if (change === 'document') f.change({ revision: { documentId: 'new', value: 0 } });
    if (change === 'session') owner = fixture().session;
    if (change === 'release') intent.release();
    if (change === 'destroyed') f.change({ status: 'destroyed' });
    assert.equal(intent.valid(owner), false, change);
    if (change !== 'session') assert.deepEqual(await intent.dispatch({ bytes, widthPoints: 2, heightPoints: 3 }), { ok: false, code: 'stale-selection' });
    intent.release(); assert.equal(f.calls.length, 0); assert.equal(f.retains(), 1); assert.equal(f.releases(), 1);
  }
});

test('capture refuses unavailable and reentrant retention without leaving a live lease', () => {
  assert.equal(captureImageInsertionIntent(null), null);
  const unavailable = fixture(); unavailable.unavailable(); assert.equal(captureImageInsertionIntent(unavailable.session), null); assert.equal(unavailable.retains(), 0);
  const refusal = fixture(); refusal.refuseRetain(); assert.equal(captureImageInsertionIntent(refusal.session), null); assert.equal(refusal.releases(), 0);
  const changed = fixture(); changed.onRetain(() => changed.change({ selection: { kind: 'caret', version: 2 } }));
  assert.equal(captureImageInsertionIntent(changed.session), null); assert.equal(changed.releases(), 1);
});

test('dispatch transfers lease ownership before synchronous notifications and hide cannot release it', async () => {
  const f = fixture(), intent = captureImageInsertionIntent(f.session)!;
  f.onInsert(() => { intent.release(); assert.equal(f.releases(), 0); });
  const source = { bytes, widthPoints: 2, heightPoints: 3 };
  const pending = intent.dispatch(source);
  assert.equal(intent.valid(f.session), false); assert.equal(f.calls.length, 1); assert.equal(f.calls[0]!.source, source);
  assert.deepEqual(f.calls[0]!.options, { expectedRevision: { documentId: 'doc', value: 0 }, selection: f.lease });
  intent.release(); assert.equal(f.releases(), 0);
  assert.deepEqual(await intent.dispatch(source), { ok: false, code: 'stale-selection' });
  assert.equal(f.calls.length, 1);
  f.resolve({ ok: true, value: { documentId: 'doc', value: 1 } });
  assert.deepEqual(await pending, { ok: true, value: { documentId: 'doc', value: 1 } });
  intent.release(); assert.equal(f.releases(), 1);
});

test('a committed original result survives later owner destruction and refusal cleanup remains idempotent', async () => {
  for (const ok of [true, false]) {
    const f = fixture(), intent = captureImageInsertionIntent(f.session)!;
    const pending = intent.dispatch({ bytes, widthPoints: 2, heightPoints: 3 });
    f.change({ status: 'destroyed', revision: null });
    const result: DocxResult<DocxRevision> = ok ? { ok: true, value: { documentId: 'doc', value: 1 } } : { ok: false, code: 'unsupported' };
    f.resolve(result); assert.equal(await pending, result);
    intent.release(); assert.equal(f.releases(), 1);
  }
});
