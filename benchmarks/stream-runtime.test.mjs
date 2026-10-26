import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimeOptions, runWorkload, pairedOrder } from './stream-runtime.mjs';

function referenceRuntime() {
  return {
    createAgentStreamState: () => ({ generation: 0, cursor: 0, messages: [] }),
    reduceAgentStream(state, event) {
      if (event.type === 'message-start') return { ...state, messages: [structuredClone(event.message)], cursor: event.sequence };
      const message = state.messages[0];
      return { ...state, cursor: event.sequence, messages: [{ ...message, parts: [{ ...message.parts[0], text: message.parts[0].text + event.delta }, message.parts[1]] }] };
    },
  };
}

test('runtime CLI keeps the original positional artifact while bounding profiles and samples', () => {
  assert.equal(runtimeOptions(['runtime.js']).candidate.endsWith('/runtime.js'), true);
  assert.equal(runtimeOptions(['--samples=7', '--profile=quick']).samples, 7);
  assert.equal(runtimeOptions(['--baseline=baseline.js']).baseline.endsWith('/baseline.js'), true);
  for (const option of ['--samples=0', '--samples=31', '--samples=2.5', '--profile=unbounded', '--unknown=x']) assert.throws(() => runtimeOptions([option]));
  assert.throws(() => runtimeOptions(['one.js', 'two.js']));
});

test('matched variants alternate per sample without creating a second variant when absent', () => {
  assert.deepEqual(pairedOrder(0, true), ['baseline', 'candidate']);
  assert.deepEqual(pairedOrder(1, true), ['candidate', 'baseline']);
  assert.deepEqual(pairedOrder(1, false), ['candidate']);
});

test('workload independently verifies exact Unicode, original state and sibling payload semantics', () => {
  const result = runWorkload(referenceRuntime(), 7, 32, true);
  assert.equal(result.unchangedPartIdentityRatio, 1);
  assert.equal(result.unchangedMetadataIdentityRatio, 1);
  assert.equal(result.utf16Units, 259);
  assert.equal(result.utf8Bytes, 391);
  const mutating = referenceRuntime();
  const reduce = mutating.reduceAgentStream;
  mutating.reduceAgentStream = (state, event) => {
    const next = reduce(state, event);
    if (event.type === 'message-part-delta') state.messages[0].parts[0].text = next.messages[0].parts[0].text;
    return next;
  };
  assert.throws(() => runWorkload(mutating, 4, 0, false), /Expected values/u);
});
