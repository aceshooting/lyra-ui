import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync } from 'fflate';
import { imageFixture } from '../../test/corpus.js';
import { createInternalDocxSession } from './session.js';
import type { DocxEngineEvent, DocxEnginePort, DocxEngineImageReplacement } from './engine-port.js';
import type { DocxResult, DocxSelection } from './types.js';

const ok = <T>(value: T): DocxResult<T> => ({ ok: true, value });
function value<T>(result: DocxResult<T>): T { if (!result.ok) throw new Error(result.code); return result.value; }
function refuses(result: DocxResult<unknown>, code: string) { assert.deepEqual(result, { ok: false, code }); }
function deferred() { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; }
async function fixture(readOnly = false) {
  let listener: ((event: DocxEngineEvent) => void) | undefined;
  const heading = {}, diagnostic = {}, comment = {}, reply = {};
  const f = { valid: true, selection: 'text' as DocxSelection['kind'], composing: false, image: false,
    calls: [] as object[], queryReads: 0, commands: 0, saves: 0, retained: {} as object,
    beforeRead() {}, beforeMutation() {}, emit(event: DocxEngineEvent) { listener?.(event); } };
  const engine: DocxEnginePort = {
    inspect: () => ({ selection: f.selection, composing: f.composing,
      formatting: { paragraphStyleId: null, alignment: null, fontFamily: null, fontSizePoints: null, color: null, bulletList: false, numberedList: false },
      image: f.image ? { widthPoints: 40, heightPoints: 20 } : null, imageReady: f.image }),
    subscribe(next) { listener = next; return () => { listener = undefined; }; },
    can: () => ({ enabled: true }), execute() { f.commands++; f.emit('change'); return ok(undefined); },
    paragraphStyles: () => ({ items: [], truncated: false }), fontFamilies: () => ({ items: [], truncated: false }),
    find: () => ({ matches: [], truncated: false }), selectMatch: () => ok(undefined), replaceMatch: () => ok(undefined),
    retainSelection: () => f.retained, releaseSelection() {}, focus() {}, save() { f.saves++; return Promise.resolve(new Uint8Array([1])); }, destroy() {},
    outline() { f.queryReads++; f.beforeRead(); return ok({ items: [{ token: heading, level: 1, text: 'Introduction', textTruncated: false }], truncated: false }); },
    inspectDocument() { f.queryReads++; f.beforeRead(); return ok({ scope: 'body',
      diagnostics: [{ rule: 'image-description-missing', data: { number: 1 }, token: diagnostic }],
      capabilities: [{ code: 'inline-image-descriptions', count: 1, preserved: 'unverified', renderable: 'unverified', editable: 'unverified', refused: false }], truncated: false }); },
    selectDocumentTarget(token) { f.calls.push(token); f.emit('user-selection'); return ok(undefined); },
    review() { f.queryReads++; f.beforeRead(); return ok({ items: [
      { token: comment, kind: 'comment', text: 'First', author: 'A', readOnly: false, orphaned: false, navigable: true },
      { token: reply, parentToken: comment, kind: 'comment', text: 'Reply', author: 'B', readOnly: false, orphaned: false, navigable: true }
    ], truncated: false, hasUnsupported: false, trackingSupported: true, enabled: false, author: null }); },
    selectReviewItem(token) { f.calls.push(token); f.emit('user-selection'); return ok(undefined); },
    canReview: () => ({ enabled: true }),
    executeReview(action, token, retained, validate) {
      f.beforeMutation(); const result = validate!(); if (!result.ok) return result;
      if (retained) assert.equal(retained, f.retained);
      f.commands++; if (token) f.calls.push(token);
      f.emit(action.type === 'track-changes' ? 'state' : 'change'); return ok(undefined);
    }
  };
  const session = value(createInternalDocxSession({ mount: {} as HTMLElement, readOnly }, {
    claimMount: () => ok({ check: () => f.valid, valid: () => f.valid, release() {} }), open: async () => ok(engine)
  }));
  value(await session.open({ kind: 'blank' }));
  return { f, engine, session, heading, diagnostic, comment };
}

test('document reports copy, freeze and authenticate every navigation identifier without changing content', async () => {
  const h = await fixture(true), before = h.session.snapshot();
  const outline = value(h.session.outline()), inspection = value(h.session.inspectDocument()), review = value(h.session.review());
  for (const report of [outline, inspection, review]) assert(Object.isFrozen(report));
  assert(Object.isFrozen(outline.items)); assert(Object.isFrozen(outline.items[0]));
  assert(Object.isFrozen(inspection.diagnostics[0]!.data)); assert(Object.isFrozen(inspection.capabilities[0]));
  assert(Object.isFrozen(review.items)); assert(Object.isFrozen(review.items[0]));
  assert.equal(review.items[1]!.parentId, review.items[0]!.id);
  assert(!JSON.stringify([outline, inspection, review]).includes('token'));
  assert.equal(h.session.snapshot(), before); assert.equal(h.f.saves, 0); assert.equal(h.f.commands, 0);
  value(h.session.selectOutlineItem(outline.items[0]!.id));
  value(h.session.selectDiagnostic(inspection.diagnostics[0]!.locationId!));
  value(h.session.selectReviewItem(review.items[0]!.id));
  assert.deepEqual(h.f.calls, [h.heading, h.diagnostic, h.comment]); assert.equal(h.session.snapshot().dirty, false);
  refuses(h.session.selectOutlineItem(review.items[0]!.id), 'stale-selection');
  refuses((await h.session.execute({ type: 'review-decision', id: review.items[0]!.id, decision: 'resolve' })), 'read-only');
});

test('tracking mode has no range target but still refuses document changes during settlement', async () => {
  const h = await fixture();
  h.f.beforeMutation = () => h.f.emit('user-selection');
  assert.equal((await h.session.execute({ type: 'track-changes', enabled: true, author: 'Writer' })).ok, true);
  refuses((await h.session.execute({ type: 'add-comment', text: 'Original range', author: 'Writer' })), 'stale-selection');
  h.f.beforeMutation = () => h.f.emit('change');
  refuses((await h.session.execute({ type: 'track-changes', enabled: false, author: 'Writer' })), 'stale-revision');
  h.session.destroy();
});

test('new queries invalidate their own identifiers while content changes refuse genuine older targets as stale revisions', async () => {
  const h = await fixture(), foreign = await fixture();
  const first = value(h.session.outline()), diagnostics = value(h.session.inspectDocument());
  const second = value(h.session.outline());
  refuses(h.session.selectOutlineItem(first.items[0]!.id), 'stale-selection');
  refuses(foreign.session.selectOutlineItem(second.items[0]!.id), 'stale-selection');
  value(h.session.selectDiagnostic(diagnostics.diagnostics[0]!.locationId!));
  h.f.emit('change');
  refuses(h.session.selectOutlineItem(second.items[0]!.id), 'stale-revision');
  refuses(h.session.selectDiagnostic(diagnostics.diagnostics[0]!.locationId!), 'stale-revision');
  refuses(h.session.selectOutlineItem('forged', { expectedRevision: first.revision }), 'stale-revision');
  assert.equal(h.f.calls.length, 1);
});

test('queries refuse composition, reentrant edits and native changes during a report', async () => {
  const h = await fixture();
  h.f.composing = true; h.f.emit('composition');
  refuses(h.session.outline(), 'composing'); refuses(h.session.inspectDocument(), 'composing'); refuses(h.session.review(), 'composing');
  assert.equal(h.f.queryReads, 0);
  h.f.composing = false; h.f.emit('composition');
  let nested: ReturnType<typeof h.session.execute> | undefined;
  h.f.beforeRead = () => { nested = h.session.execute('bold'); refuses(h.session.review(), 'busy'); };
  value(h.session.outline()); refuses(await nested!, 'busy'); assert.equal(h.f.commands, 0);
  h.f.beforeRead = () => h.f.emit('change'); refuses(h.session.outline(), 'stale-revision');
  h.f.beforeRead = () => h.f.emit('user-selection'); refuses(h.session.inspectDocument(), 'stale-selection');
  h.f.beforeRead = () => { h.f.valid = false; }; refuses(h.session.review(), 'destroyed');
});

test('review mutations retain original revision and selection through settlement and resolve private targets', async () => {
  for (const invalidation of ['revision', 'selection', 'lease']) {
    const h = await fixture(), report = value(h.session.review()), lease = value(h.session.retainSelection());
    let nested: ReturnType<typeof h.session.execute> | undefined;
    h.f.beforeMutation = () => {
      nested = h.session.execute('bold');
      if (invalidation === 'revision') h.f.emit('change');
      else if (invalidation === 'selection') h.f.emit('user-selection');
      else lease.release();
    };
    refuses((await h.session.execute({ type: 'reply-comment', id: report.items[0]!.id, text: 'Response', author: 'Writer' }, { selection: lease })),
      invalidation === 'revision' ? 'stale-revision' : 'stale-selection');
    refuses(await nested!, 'busy');
    assert.equal(h.f.commands, 0); assert.equal(h.f.calls.length, 0);
  }
  const h = await fixture(), report = value(h.session.review());
  assert.equal(h.session.can({ type: 'review-decision', id: 'forged', decision: 'resolve' }).reason, 'stale-selection');
  value((await h.session.execute({ type: 'review-decision', id: report.items[0]!.id, decision: 'resolve' })));
  assert.deepEqual(h.f.calls, [h.comment]);
  refuses((await h.session.execute({ type: 'review-decision', id: report.items[0]!.id, decision: 'resolve' })), 'stale-revision');
});

test('document queries discard a report when an engine callback destroys the session', async () => {
  for (const query of ['outline', 'inspectDocument', 'review'] as const) {
    const h = await fixture();
    const outline = value(h.session.outline()), review = value(h.session.review());
    h.f.beforeRead = () => h.session.destroy();
    refuses(h.session[query](), 'destroyed');
    refuses(h.session.selectOutlineItem(outline.items[0]!.id), 'destroyed');
    refuses(h.session.selectReviewItem(review.items[0]!.id), 'destroyed');
    assert.equal(h.session.snapshot().status, 'destroyed');
    assert.equal(h.f.commands, 0); assert.equal(h.f.saves, 0); assert.equal(h.f.calls.length, 0);
  }
});

test('tracking mode changes report their existing revision without a dirty or saved-byte transition', async () => {
  const h = await fixture(), before = h.session.snapshot().revision;
  assert.deepEqual(value((await h.session.execute({ type: 'track-changes', enabled: true, author: 'Writer' }))), before);
  assert.equal(h.session.snapshot().dirty, false); assert.equal(h.f.saves, 0);
});

async function replacementFixture() {
  const h = await fixture(); h.f.image = true; h.f.selection = 'other'; h.f.emit('user-selection');
  const state = { releases: 0, captures: 0, copied: null as Uint8Array | null, gate: deferred(), epoch: 0,
    commit: true, afterCommit() {} };
  h.engine.beginImageReplacement = () => {
    state.captures++; const epoch = state.epoch;
    const handle: DocxEngineImageReplacement = {
      validate: () => epoch === state.epoch ? ok(undefined) : { ok: false, code: 'stale-selection' },
      async execute(source, operation) {
        state.copied = source.bytes; await state.gate.promise;
        const current = operation.validateOriginal(); if (!current.ok) return current;
        const armed = operation.armCommit(); if (!armed.ok) return armed;
        if (state.commit) h.f.emit('change'); state.afterCommit(); return ok(undefined);
      }, release() { state.releases++; }
    };
    return ok(handle);
  };
  const bytes = Object.entries(unzipSync(imageFixture('image-simple'))).find(([name]) => name.endsWith('.png'))![1];
  return { ...h, state, bytes };
}

test('replacement copies visible bytes before notification and owns every navigation/query/mutation while pending', async () => {
  const h = await replacementFixture(), original = h.bytes.slice();
  h.session.subscribe(() => { if (h.session.snapshot().activity === 'replacing-image') h.bytes.fill(0); });
  const pending = h.session.replaceImage(h.bytes);
  assert.equal(h.session.snapshot().activity, 'replacing-image'); assert.deepEqual(h.state.copied, original);
  refuses(h.session.outline(), 'busy'); refuses(h.session.review(), 'busy'); refuses(h.session.inspectDocument(), 'busy');
  refuses(h.session.selectOutlineItem('forged'), 'busy'); refuses((await h.session.execute('bold')), 'busy');
  refuses(await h.session.save(), 'busy'); refuses(h.session.focus(), 'busy'); refuses(h.session.retainSelection(), 'busy');
  assert.deepEqual(h.session.canReplaceImage(), { enabled: false, reason: 'busy' });
  h.state.gate.resolve(); assert.equal(value(await pending).value, 1); assert.equal(h.state.releases, 1);
});

test('replacement rejects original lease, native image and revision invalidation without retargeting', async () => {
  for (const kind of ['lease', 'image', 'revision', 'abort']) {
    const h = await replacementFixture(), lease = value(h.session.retainSelection()), abort = new AbortController();
    const pending = h.session.replaceImage(h.bytes, { selection: lease, signal: abort.signal });
    if (kind === 'lease') lease.release();
    if (kind === 'image') { h.state.epoch++; h.f.emit('focus-selection'); }
    if (kind === 'revision') h.f.emit('change');
    if (kind === 'abort') abort.abort();
    h.state.gate.resolve();
    refuses(await pending, kind === 'revision' ? 'stale-revision' : kind === 'abort' ? 'aborted' : 'stale-selection');
    assert.equal(h.state.releases, 1);
  }
});

test('replacement committed receipt survives reentrant destruction and cannot invent success without a commit', async () => {
  const h = await replacementFixture(); h.state.afterCommit = () => { h.session.destroy(); throw new Error('late'); };
  const pending = h.session.replaceImage(h.bytes); h.state.gate.resolve(); assert.equal(value(await pending).value, 1);
  const failed = await replacementFixture(); failed.state.commit = false;
  const missing = failed.session.replaceImage(failed.bytes); failed.state.gate.resolve(); refuses(await missing, 'engine-failed');
});


test('review action reflection cannot silently retarget an original text selection', async () => {
  const h = await fixture();
  const action = new Proxy({ type: 'add-comment' as const, text: 'Note', author: 'Writer' }, {
    ownKeys(target) { h.f.emit('user-selection'); return Reflect.ownKeys(target); }
  });
  refuses((await h.session.execute(action)), 'stale-selection'); assert.equal(h.f.commands, 0);
});

test('navigation completion cannot return success after its final ready notification destroys the session', async () => {
  const h = await fixture(), outline = value(h.session.outline());
  h.session.subscribe(() => {
    const snapshot = h.session.snapshot();
    if (snapshot.selection.version > 0 && snapshot.commands.bold.enabled) h.session.destroy();
  });
  refuses(h.session.selectOutlineItem(outline.items[0]!.id), 'destroyed');
});

test('destroying a pending replacement settles promptly and late preparation cannot commit', async () => {
  const h = await replacementFixture(), revision = h.session.snapshot().revision;
  const pending = h.session.replaceImage(h.bytes); h.session.destroy();
  refuses(await pending, 'destroyed'); assert.equal(h.state.releases, 1);
  h.state.gate.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(h.session.snapshot().revision, revision); assert.equal(h.session.snapshot().dirty, false);
  assert.equal(h.state.releases, 1);
});

test('replacement copies only a visible byte range and late cancellation keeps a committed receipt truthful', async () => {
  const h = await replacementFixture(), abort = new AbortController(), expected = h.bytes.slice();
  const backing = new Uint8Array(h.bytes.length + 8); backing.fill(255); backing.set(h.bytes, 4);
  const visible = backing.subarray(4, backing.length - 4);
  h.state.afterCommit = () => abort.abort();
  const pending = h.session.replaceImage(visible, { signal: abort.signal });
  backing.fill(0); assert.deepEqual(h.state.copied, expected);
  h.state.gate.resolve(); assert.equal(value(await pending).value, 1); assert.equal(h.state.releases, 1);
});
