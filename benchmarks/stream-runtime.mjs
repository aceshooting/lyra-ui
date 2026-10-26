import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Build the library, then run: node benchmarks/stream-runtime.mjs
// An optional first argument selects another built runtime.js for comparison.
const runtimeUrl = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]))
  : new URL('../packages/lyra-ui/dist/ai/runtime.js', import.meta.url);
const { createAgentStreamState, reduceAgentStream } = await import(runtimeUrl.href);
const encoder = new TextEncoder();
const chunks = ['a'.repeat(64), 'é'.repeat(64), '\ud83d', '\ude00'];
const results = [];

function run(operations, retainedCharacters, observeIdentity) {
  let state = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start', generation: 0, sequence: 1,
    message: {
      id: 'message', role: 'assistant', metadata: { retained: 'm'.repeat(retainedCharacters) },
      parts: [
        { id: 'text', type: 'text', text: '', state: 'streaming' },
        { id: 'data', type: 'data', data: { retained: 'd'.repeat(retainedCharacters) } },
      ],
    },
  });
  assert.equal(state.error, undefined);
  const first = state.messages[0];
  let sharedPartCount = 0;
  let sharedMetadataCount = 0;
  const started = performance.now();
  for (let index = 0; index < operations; index += 1) {
    state = reduceAgentStream(state, {
      type: 'message-part-delta', generation: 0, sequence: index + 2,
      messageId: 'message', partId: 'text', partType: 'text', delta: chunks[index % chunks.length],
    });
    if (observeIdentity) {
      sharedPartCount += Number(state.messages[0].parts[1] === first.parts[1]);
      sharedMetadataCount += Number(state.messages[0].metadata === first.metadata);
    }
  }
  const elapsedMs = performance.now() - started;
  const text = state.messages[0].parts[0].text;
  assert.equal(state.error, undefined);
  assert.equal(text, chunks.join('').repeat(operations / chunks.length));
  assert.equal(first.parts[0].text, '');
  return { elapsedMs, sharedPartCount, sharedMetadataCount, utf16Units: text.length, utf8Bytes: encoder.encode(text).byteLength };
}

for (const retainedCharacters of [0, 65_536, 262_144]) {
  for (const operations of [1_000, 2_000, 4_000]) {
    run(operations, retainedCharacters, false);
    const samplesMs = Array.from({ length: 5 }, () => run(operations, retainedCharacters, false).elapsedMs);
    const identity = run(operations, retainedCharacters, true);
    const sorted = [...samplesMs].sort((left, right) => left - right);
    results.push({
      operations,
      retainedCharactersPerField: retainedCharacters,
      samplesMs,
      medianMs: sorted[Math.floor(sorted.length / 2)],
      unchangedPartIdentityRatio: identity.sharedPartCount / operations,
      unchangedMetadataIdentityRatio: identity.sharedMetadataCount / operations,
      utf16Units: identity.utf16Units,
      utf8Bytes: identity.utf8Bytes,
    });
  }
}

console.log(JSON.stringify({
  schemaVersion: 1,
  workload: 'agent-stream-text-deltas',
  nodeVersion: process.version,
  warmups: 1,
  samples: 5,
  note: 'Reducer-only timing; array/map copying and engine string concatenation remain included. Identity is observed separately from timed samples.',
  results,
}, null, 2));
