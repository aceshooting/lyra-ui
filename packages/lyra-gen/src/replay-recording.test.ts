import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReplayRecording, replayRecordedChunks } from './replay.js';

function recording() {
  return { version: '1', recordingKind: 'authored-synthetic', source: { kind: 'fixture', id: 'test' }, model: null,
    package: { name: '@aceshooting/lyra-gen', version: '0.1.0' }, catalog: { id: 'test', version: '1' },
    format: 'chat', text: 'a😀b', chunks: [{ atMs: 0, text: 'a\ud83d' }, { atMs: 1, text: '\ude00b' }] };
}

test('recordings preserve original offsets and exact code units across surrogate boundaries', () => {
  const result = parseReplayRecording(recording());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.chunks.map(chunk => chunk.text).join(''), 'a😀b');
  assert.deepEqual(result.value.chunks.map(chunk => chunk.atMs), [0, 1]);
  assert.ok(Object.isFrozen(result.value.chunks));
});

test('recording envelopes refuse unbounded, reordered, mismatched and undeclared provenance', () => {
  for (const changed of [
    { version: '2' }, { model: { provider: 'invented', id: 'invented' } }, { recordingKind: 'provider' },
    { source: { kind: 'provider', id: 'test' } }, { secret: 'undeclared' }, { format: 'html' }, { format: { toString: 'invalid' } },
    { text: 'wrong' }, { text: 'x'.repeat(262145) }, { chunks: [] },
    { chunks: Array.from({ length: 1025 }, () => ({ atMs: 0, text: '' })) },
    { chunks: [{ atMs: -1, text: 'a😀b' }] }, { chunks: [{ atMs: Infinity, text: 'a😀b' }] },
    { chunks: [{ atMs: 60001, text: 'a😀b' }] }, { chunks: [{ atMs: 1, text: 'a' }, { atMs: 0, text: '😀b' }] },
    { chunks: [{ atMs: 0, text: 'a😀b', token: 'undeclared' }] },
  ]) assert.equal(parseReplayRecording({ ...recording(), ...changed }).ok, false);
  let invoked = false;
  const value = recording();
  Object.defineProperty(value, 'text', { enumerable: true, get() { invoked = true; return 'a😀b'; } });
  assert.equal(parseReplayRecording(value).ok, false);
  assert.equal(invoked, false);
});

test('replay delivers the admitted recording in order and never mutates its timestamps', async () => {
  const value = recording();
  const delivered: string[] = [];
  const result = await replayRecordedChunks(value, chunk => { delivered.push(chunk.text); });
  assert.deepEqual(result, { ok: true, value: { status: 'completed', deliveredChunks: 2 }, diagnostics: [] });
  assert.equal(delivered.join(''), value.text);
  assert.deepEqual(value.chunks.map(chunk => chunk.atMs), [0, 1]);
});

test('abort before start and during a pending wait leaves no later chunk callback', async () => {
  const before = new AbortController(); before.abort();
  const delivered: string[] = [];
  const first = await replayRecordedChunks(recording(), chunk => { delivered.push(chunk.text); }, { signal: before.signal });
  assert.equal(first.ok && first.value.deliveredChunks, 0);
  const active = new AbortController();
  const value = recording(); value.chunks[1]!.atMs = 60000;
  const second = await replayRecordedChunks(value, chunk => {
    delivered.push(chunk.text); queueMicrotask(() => active.abort());
  }, { signal: active.signal });
  assert.deepEqual(second, { ok: true, value: { status: 'interrupted', deliveredChunks: 1 }, diagnostics: [] });
  assert.deepEqual(delivered, ['a\ud83d']);
});

test('a callback may abort synchronously and invalid input never dispatches a chunk', async () => {
  const signal = new AbortController();
  const chunks: string[] = [];
  const result = await replayRecordedChunks(recording(), chunk => { chunks.push(chunk.text); signal.abort(); }, { signal: signal.signal });
  assert.equal(result.ok && result.value.status, 'interrupted');
  const invalid = await replayRecordedChunks({}, () => { assert.fail('Invalid recordings cannot run.'); });
  assert.equal(invalid.ok, false);
  assert.equal(chunks.length, 1);
});
