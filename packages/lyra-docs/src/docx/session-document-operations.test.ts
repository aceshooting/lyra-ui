import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deferred, fixture, opened, refusal, value } from '../../test/session-fixture.js';
import { DOCX_FRAGMENT_LIMITS } from './document-operations.js';
import type { DocxEngineBatchResult, DocxEnginePort } from './engine-port.js';
import type { DocxEngineFragmentReport, DocxEngineFragmentRequest } from './eigenpal-document-inspection.js';

type DocxEngineFragmentBlock = DocxEngineFragmentReport['blocks'][number];
import type { DocxBatchEdit, DocxResult } from './types.js';

const block = (index: number, token: object | null = {}): DocxEngineFragmentBlock => ({
  token, index, kind: token ? 'paragraph' : 'table', styleId: null, headingLevel: null, text: `B${index}`, textTruncated: false,
});
/** An opened session whose engine serves `count` blocks and records fragment requests. */
async function fragmented(count = 3) {
  const h = await opened();
  const requests: DocxEngineFragmentRequest[] = [];
  const tokens = Array.from({ length: count }, () => ({}));
  h.engine.fragment = request => {
    requests.push(request);
    const start = request.token ? tokens.indexOf(request.token) : request.start ?? 0;
    const blocks = tokens.slice(start, start + request.maxBlocks).map((token, offset) => block(start + offset, token));
    return { ok: true, value: { start, blockCount: count, next: start + blocks.length < count ? start + blocks.length : null, truncated: false, blocks } };
  };
  return { ...h, requests, tokens };
}
type BatchCall = { steps: readonly { edit: DocxBatchEdit; target?: object }[]; control: { validate(): DocxResult<void>; arm(): DocxResult<void> } };
/** Installs a batch engine; `run` decides what the armed batch does. */
function batching(engine: DocxEnginePort, run: (call: BatchCall) => Promise<DocxEngineBatchResult> | DocxEngineBatchResult) {
  const calls: BatchCall[] = [];
  engine.executeBatch = async (steps, control) => { const call = { steps, control }; calls.push(call); return run(call); };
  return calls;
}
const armed = (call: BatchCall, effect: () => void, result: DocxEngineBatchResult = { ok: true }): DocxEngineBatchResult => {
  const ready = call.control.arm();
  if (!ready.ok) return { ok: false, code: ready.code, step: null, rolledBack: false };
  effect();
  return result;
};

test('fragments are bounded reads that copy blocks and mint ids only for paragraphs', async () => {
  const h = await fragmented();
  h.engine.fragment = () => ({ ok: true, value: { start: 0, blockCount: 2, next: null, truncated: true,
    blocks: [block(0), { ...block(1, null), headingLevel: 2, textTruncated: true }] } });
  const before = h.session.snapshot();
  const fragment = value(h.session.readFragment());
  assert.deepEqual(fragment.revision, h.revision);
  assert.deepEqual(fragment.blocks.map(({ index, kind, text, headingLevel, textTruncated }) => [index, kind, text, headingLevel, textTruncated]),
    [[0, 'paragraph', 'B0', null, false], [1, 'table', 'B1', 2, true]]);
  assert.equal(typeof fragment.blocks[0]!.id, 'string');
  assert.equal(fragment.blocks[1]!.id, null);
  assert.deepEqual([fragment.blockCount, fragment.next, fragment.truncated], [2, null, true]);
  assert(Object.isFrozen(fragment) && Object.isFrozen(fragment.blocks) && Object.isFrozen(fragment.blocks[0]));
  assert.equal(h.session.snapshot(), before, 'a read publishes nothing');
  assert.equal(h.f.executes, 0);
});

test('fragment requests are validated and passed with their budgets; ids select their block', async () => {
  const h = await fragmented(5);
  refusal(h.session.readFragment({ maxBlocks: 65 }), 'invalid-option');
  refusal(h.session.readFragment({ start: 1, outlineItemId: 'x' }), 'invalid-option');
  assert.equal(h.requests.length, 0);
  const fragment = value(h.session.readFragment({ start: 2, maxBlocks: 2, maxText: 10, expectedRevision: h.revision }));
  assert.deepEqual(h.requests, [{ start: 2, maxBlocks: 2, maxText: 10 }]);
  assert.deepEqual([fragment.start, fragment.next], [2, 4]);
  const selected: object[] = [];
  h.engine.selectDocumentTarget = token => { selected.push(token); return { ok: true, value: undefined }; };
  value(h.session.selectFragmentBlock(fragment.blocks[1]!.id!, { expectedRevision: h.revision }));
  assert.deepEqual(selected, [h.tokens[3]]);
  refusal(h.session.selectFragmentBlock('forged'), 'stale-selection');
  refusal(h.session.selectFragmentBlock(7 as unknown as string), 'invalid-option');
  const earlier = value(h.session.readFragment({ start: 0, maxBlocks: 1 }));
  value(h.session.selectFragmentBlock(fragment.blocks[0]!.id!));
  value(h.session.selectFragmentBlock(earlier.blocks[0]!.id!));
  assert.deepEqual(selected.slice(1), [h.tokens[2], h.tokens[0]], 'ids from several reads at one revision stay usable');
});

test('a fragment can start at a current outline item; stale, forged and foreign starts are refused', async () => {
  const h = await fragmented(4);
  h.engine.outline = () => ({ ok: true, value: { items: [{ token: h.tokens[2]!, level: 1, text: 'Two', textTruncated: false }], truncated: false } });
  const outline = value(h.session.outline());
  const fragment = value(h.session.readFragment({ outlineItemId: outline.items[0]!.id, maxBlocks: 8 }));
  assert.deepEqual([fragment.start, fragment.blocks.map(item => item.text)], [2, ['B2', 'B3']]);
  assert.deepEqual(h.requests.at(-1), { token: h.tokens[2], maxBlocks: 8, maxText: DOCX_FRAGMENT_LIMITS.defaultText });
  refusal(h.session.readFragment({ outlineItemId: 'forged' }), 'stale-selection');
  refusal(h.session.readFragment({ expectedRevision: { documentId: h.revision.documentId, value: 99 } }), 'stale-revision');
  h.f.emit('change');
  refusal(h.session.readFragment({ outlineItemId: outline.items[0]!.id }), 'stale-revision');
  refusal(h.session.selectFragmentBlock(fragment.blocks[0]!.id!), 'stale-revision');
});

test('fragment reads are refused while busy, composing, unsupported or closed, and engine refusals pass through', async () => {
  const unopened = value(fixture().create());
  refusal(unopened.readFragment(), 'not-ready');
  const h = await opened();
  refusal(h.session.readFragment(), 'unsupported');
  h.engine.fragment = () => ({ ok: false, code: 'resource-limit' });
  refusal(h.session.readFragment(), 'resource-limit');
  h.engine.fragment = () => { throw new Error('private engine detail'); };
  refusal(h.session.readFragment(), 'unsupported');
  h.f.composing = true; h.f.emit('composition');
  refusal(h.session.readFragment(), 'composing');
  h.f.composing = false; h.f.emit('composition');
  h.f.saveGate = deferred();
  const saving = h.session.save();
  refusal(h.session.readFragment(), 'busy');
  h.f.saveGate.resolve(h.f.output); await saving;
  h.session.destroy();
  refusal(h.session.readFragment(), 'destroyed');
});

test('retained fragment ids are bounded per revision', async () => {
  const h = await fragmented(DOCX_FRAGMENT_LIMITS.ids);
  const first = value(h.session.readFragment({ start: 0, maxBlocks: 64 }));
  for (let start = 64; start < DOCX_FRAGMENT_LIMITS.ids; start += 64) value(h.session.readFragment({ start, maxBlocks: 64 }));
  h.engine.selectDocumentTarget = () => ({ ok: true, value: undefined });
  value(h.session.selectFragmentBlock(first.blocks[0]!.id!));
  value(h.session.readFragment({ start: 0, maxBlocks: 1 }));
  refusal(h.session.selectFragmentBlock(first.blocks[0]!.id!), 'stale-selection');
});

test('a committed batch becomes exactly one revision, however many engine changes it made', async () => {
  const h = await fragmented();
  const fragment = value(h.session.readFragment());
  const calls = batching(h.engine, call => armed(call, () => { h.f.emit('change'); h.f.emit('change'); h.f.emit('change'); }));
  let published = 0;
  h.session.subscribe(() => { published++; });
  const result = await h.session.applyEdits([{ edit: 'bold' }, { edit: { type: 'alignment', value: 'center' }, target: fragment.blocks[1]!.id! }],
    { expectedRevision: h.revision });
  assert.deepEqual(result, { ok: true, value: { documentId: h.revision.documentId, value: h.revision.value + 1 } });
  assert.deepEqual(calls[0]!.steps, [{ edit: 'bold' }, { edit: { type: 'alignment', value: 'center' }, target: h.tokens[1] }]);
  const snapshot = h.session.snapshot();
  assert.deepEqual([snapshot.revision, snapshot.dirty], [result.ok ? result.value : null, true]);
  assert.ok(published >= 1);
  refusal(h.session.selectFragmentBlock(fragment.blocks[0]!.id!), 'stale-selection');
  const retried = await h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision });
  assert.deepEqual(retried, { ok: false, code: 'stale-revision', step: null }, 'a retried batch is never applied twice');
  assert.equal(calls.length, 1);
});

test('a batch that changes nothing keeps the revision and the clean state', async () => {
  const h = await opened();
  batching(h.engine, call => armed(call, () => {}));
  assert.deepEqual(await h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision }), { ok: true, value: h.revision });
  assert.equal(h.session.snapshot().dirty, false);
});

test('a refused step after a verified revert leaves revision, dirty state and save receipt unchanged', async () => {
  const h = await opened();
  const receipt = value(await h.session.save());
  batching(h.engine, call => armed(call, () => { h.f.emit('change'); h.f.emit('change'); },
    { ok: false, code: 'unsupported', step: 1, rolledBack: true }));
  const before = h.session.snapshot();
  const result = await h.session.applyEdits([{ edit: 'bold' }, { edit: 'italic' }], { expectedRevision: h.revision });
  assert.deepEqual(result, { ok: false, code: 'unsupported', step: 1 });
  const after = h.session.snapshot();
  assert.deepEqual([after.revision, after.dirty, after.status], [before.revision, before.dirty, 'ready']);
  assert.notEqual(after.selection.version, before.selection.version, 'the reverted caret move is a new selection');
  value(h.session.acknowledgeSaved(receipt));
});

test('engine failure, or changes without a commit or verified revert, fail the session closed', async () => {
  for (const outcome of ['fault', 'unverified', 'throws'] as const) {
    const h = await opened();
    batching(h.engine, call => {
      if (outcome === 'throws') throw new Error('private detail');
      return armed(call, () => { h.f.emit('change'); },
        outcome === 'fault' ? { ok: false, code: 'engine-failed', step: 0, rolledBack: false } : { ok: false, code: 'unsupported', step: 0, rolledBack: false });
    });
    const result = await h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision });
    assert.deepEqual(result, { ok: false, code: 'engine-failed', step: outcome === 'throws' ? null : 0 }, outcome);
    assert.deepEqual(h.session.snapshot().error, { code: 'engine-failed' }, outcome);
  }
});

test('batches are refused before the engine for invalid input, stale revisions, targets or session state', async () => {
  const h = await fragmented();
  const calls = batching(h.engine, call => armed(call, () => {}));
  const stale = { documentId: h.revision.documentId, value: h.revision.value + 1 };
  assert.deepEqual(await h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: stale }), { ok: false, code: 'stale-revision', step: null });
  assert.deepEqual(await h.session.applyEdits([], { expectedRevision: h.revision }), { ok: false, code: 'invalid-option', step: null });
  assert.deepEqual(await h.session.applyEdits([{ edit: 'bold' }, { edit: { type: 'alignment', value: 'left' }, target: 'forged' }],
    { expectedRevision: h.revision }), { ok: false, code: 'stale-selection', step: 1 });
  const fragment = value(h.session.readFragment());
  h.f.emit('change');
  const current = h.session.snapshot().revision!;
  assert.deepEqual(await h.session.applyEdits([{ edit: { type: 'alignment', value: 'left' }, target: fragment.blocks[0]!.id! }],
    { expectedRevision: current }), { ok: false, code: 'stale-revision', step: 0 }, 'ids from an older revision are stale');
  h.f.composing = true; h.f.emit('composition');
  assert.deepEqual(await h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: current }), { ok: false, code: 'composing', step: null });
  h.f.composing = false; h.f.emit('composition');
  assert.equal(calls.length, 0);
  const readOnly = await opened(true);
  batching(readOnly.engine, call => armed(call, () => {}));
  assert.deepEqual(await readOnly.session.applyEdits([{ edit: 'bold' }], { expectedRevision: readOnly.revision }), { ok: false, code: 'read-only', step: null });
  const unsupported = await opened();
  assert.deepEqual(await unsupported.session.applyEdits([{ edit: 'bold' }], { expectedRevision: unsupported.revision }), { ok: false, code: 'unsupported', step: null });
  const unopened = value(fixture().create());
  assert.deepEqual(await unopened.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision }), { ok: false, code: 'not-ready', step: null });
});

test('a pending batch owns the session, and a change before arming makes it stale', async () => {
  const h = await opened();
  const gate = deferred<void>();
  let armedResult: DocxResult<void> | null = null;
  batching(h.engine, async call => {
    await gate.promise;
    armedResult = call.control.arm();
    return armedResult.ok ? { ok: true } : { ok: false, code: armedResult.code, step: null, rolledBack: false };
  });
  const pending = h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision });
  assert.deepEqual(await h.session.execute('italic'), { ok: false, code: 'busy' });
  refusal(h.session.readFragment(), 'busy');
  assert.deepEqual(await h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision }), { ok: false, code: 'busy', step: null });
  // Pending native input committed before the batch armed is an ordinary change, not part of the batch.
  h.f.emit('change');
  gate.resolve();
  assert.deepEqual(await pending, { ok: false, code: 'stale-revision', step: null });
  assert.deepEqual(armedResult, { ok: false, code: 'stale-revision' });
  assert.equal(h.session.snapshot().revision!.value, h.revision.value + 1);
});

test('destroying the session during a batch settles it as destroyed', async () => {
  const h = await opened();
  const gate = deferred<void>();
  batching(h.engine, async call => { await gate.promise; return armed(call, () => {}); });
  const pending = h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision });
  h.session.destroy();
  gate.resolve();
  assert.deepEqual(await pending, { ok: false, code: 'destroyed', step: null });
});

test('a batch releases a retained host selection, since it moves the caret', async () => {
  const h = await opened();
  const lease = value(h.session.retainSelection());
  batching(h.engine, call => armed(call, () => {}));
  value(await h.session.applyEdits([{ edit: 'bold' }], { expectedRevision: h.revision }) as DocxResult<unknown>);
  assert.equal(h.f.released.length, 1);
  lease.release();
  assert.equal(h.f.released.length, 1);
});
