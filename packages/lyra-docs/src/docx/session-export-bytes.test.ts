import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deferred, opened, refusal, value } from '../../test/session-fixture.js';
import type { DocxResult, DocxRevision, DocxSession } from './types.js';

function byteExporter(session: DocxSession) {
  const method = Reflect.get(session, 'exportBytes') as
    (options?: { signal?: AbortSignal; expectedRevision?: DocxRevision }) => Promise<DocxResult<Uint8Array>>;
  assert.equal(typeof method, 'function', 'the public session exposes exportBytes');
  return method.bind(session);
}

test('byte exports return an independent copy and retain the latest real receipt', async () => {
  const { f, session } = await opened();
  const exportBytes = byteExporter(session);
  f.emit('change');
  const receipt = value(await session.save());
  const bytes = value(await exportBytes({ expectedRevision: receipt.revision }));
  assert.deepEqual(bytes, f.output);
  bytes.fill(0);
  assert.deepEqual(receipt.bytes, new Uint8Array([9, 8, 7]));
  assert.deepEqual(f.output, receipt.bytes);
  assert.equal(session.snapshot().dirty, true);
  value(session.acknowledgeSaved(receipt));
  assert.equal(session.snapshot().dirty, false);
});

test('refused and canceled exports preserve the current receipt and hold the serialization barrier until settlement', async () => {
  const { f, session, revision } = await opened();
  const exportBytes = byteExporter(session);
  f.emit('change');
  const receipt = value(await session.save());
  refusal(await exportBytes({ expectedRevision: revision }), 'stale-revision');
  f.saveGate = deferred();
  const aborted = new AbortController();
  const pending = exportBytes({ signal: aborted.signal });
  assert.equal(session.snapshot().activity, 'saving');
  refusal(await session.save(), 'busy');
  aborted.abort();
  refusal(await exportBytes(), 'busy');
  f.saveGate.resolve(f.output);
  refusal(await pending, 'aborted');
  f.saveGate = deferred();
  const failed = exportBytes();
  f.saveGate.reject(new Error('serialization failed'));
  refusal(await failed, 'save-failed');
  assert.equal(session.snapshot().activity, null);
  assert.equal(session.snapshot().dirty, true);
  value(session.acknowledgeSaved(receipt));
});

test('a host can acknowledge its persisted save while a byte export is pending', async () => {
  const { f, session } = await opened();
  const exportBytes = byteExporter(session);
  f.emit('change');
  const receipt = value(await session.save());
  f.saveGate = deferred();
  const pending = exportBytes();
  value(session.acknowledgeSaved(receipt));
  f.saveGate.resolve(f.output);
  assert.deepEqual(value(await pending), f.output);
  assert.equal(session.snapshot().dirty, false);
});
