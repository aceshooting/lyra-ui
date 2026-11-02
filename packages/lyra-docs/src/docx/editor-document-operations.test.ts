import assert from 'node:assert/strict';
import test from 'node:test';
import { editor, refusal, session } from '../../test/docx-editor-harness.js';
import type { DocxBatchResult, DocxBatchStep, DocxResult } from './types.js';

type Operations = {
  readFragment(request?: object): DocxResult<unknown>;
  selectFragmentBlock(id: string, options?: object): DocxResult<void>;
  applyEdits(steps: readonly DocxBatchStep[], options: object): Promise<DocxBatchResult>;
};
const revision = { documentId: 'doc', value: 1 };

test('document operations are not ready without a session', async () => {
  const { i } = editor();
  const element = i as unknown as Operations;
  assert.deepEqual(element.readFragment(), refusal('not-ready'));
  assert.deepEqual(element.selectFragmentBlock('id'), refusal('not-ready'));
  assert.deepEqual(await element.applyEdits([{ edit: 'bold' }], { expectedRevision: revision }), { ok: false, code: 'not-ready', step: null });
});

test('document operations delegate to the session and refresh the element state', async () => {
  const calls: unknown[][] = [];
  let syncs = 0;
  const owner = session({
    readFragment: (request: object) => { calls.push(['read', request]); return { ok: true, value: 'fragment' }; },
    selectFragmentBlock: (id: string, options: object) => { calls.push(['select', id, options]); return { ok: true, value: undefined }; },
    applyEdits: async (steps: unknown, options: object) => { calls.push(['apply', steps, options]); return { ok: true, value: revision }; },
  });
  const { i, stub } = editor({ session: owner });
  stub('syncSession', () => { syncs++; });
  const element = i as unknown as Operations;
  assert.deepEqual(element.readFragment({ start: 2 }), { ok: true, value: 'fragment' });
  assert.deepEqual(element.selectFragmentBlock('id', { expectedRevision: revision }), { ok: true, value: undefined });
  assert.deepEqual(await element.applyEdits([{ edit: 'bold' }], { expectedRevision: revision }), { ok: true, value: revision });
  assert.deepEqual(calls, [['read', { start: 2 }], ['select', 'id', { expectedRevision: revision }], ['apply', [{ edit: 'bold' }], { expectedRevision: revision }]]);
  assert.equal(syncs, 2, 'navigation and the settled batch refresh the element');
});

test('a batch that rejects settles as an engine failure, and a superseded one does not refresh', async () => {
  let syncs = 0;
  const failing = session({ applyEdits: async () => { throw new Error('private engine detail'); } });
  const { i, stub } = editor({ session: failing });
  stub('syncSession', () => { syncs++; });
  const element = i as unknown as Operations;
  assert.deepEqual(await element.applyEdits([{ edit: 'bold' }], { expectedRevision: revision }), { ok: false, code: 'engine-failed', step: null });
  assert.equal(syncs, 1);
  let release!: () => void;
  const pending = session({ applyEdits: () => new Promise<DocxBatchResult>(resolve => { release = () => resolve({ ok: true, value: revision }); }) });
  const superseded = editor({ session: pending });
  let refreshed = 0;
  superseded.stub('syncSession', () => { refreshed++; });
  const result = (superseded.i as unknown as Operations).applyEdits([{ edit: 'bold' }], { expectedRevision: revision });
  superseded.i.sourceReadSequence++;
  release();
  assert.deepEqual(await result, { ok: true, value: revision });
  assert.equal(refreshed, 0);
});
