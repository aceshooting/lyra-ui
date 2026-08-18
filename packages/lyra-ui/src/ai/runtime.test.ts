import { expect } from '@open-wc/testing';
import {
  applySharedStatePatch,
  createAgentStreamState,
  reduceAgentStream,
  reduceAgentStreamEvents,
  type AgentStreamEvent,
} from './runtime.js';

it('reduces an interleaved streaming message without mutating prior state', () => {
  const initial = createAgentStreamState();
  const events: AgentStreamEvent[] = [
    { type: 'run-start', generation: 1, sequence: 1, eventId: '1', runId: 'run-1' },
    {
      type: 'message-start',
      generation: 1,
      sequence: 2,
      eventId: '2',
      message: { id: 'message-1', role: 'assistant', parts: [] },
    },
    {
      type: 'message-part-delta',
      generation: 1,
      sequence: 3,
      eventId: '3',
      messageId: 'message-1',
      partId: 'text-1',
      partType: 'text',
      delta: 'Hello',
    },
    {
      type: 'message-part-delta',
      generation: 1,
      sequence: 4,
      eventId: '4',
      messageId: 'message-1',
      partId: 'text-1',
      partType: 'text',
      delta: ' world',
    },
    { type: 'message-complete', generation: 1, sequence: 5, eventId: '5', messageId: 'message-1' },
  ];

  const result = reduceAgentStreamEvents(initial, events);
  expect(initial.messages).to.deep.equal([]);
  expect(result.runId).to.equal('run-1');
  expect(result.status.kind).to.equal('running');
  expect(result.messages[0]?.parts?.[0]).to.deep.equal({
    id: 'text-1',
    type: 'text',
    text: 'Hello world',
    state: 'complete',
  });
});

it('accepts a delta before message start and ignores a replayed generation cursor', () => {
  const delta: AgentStreamEvent = {
    type: 'message-part-delta',
    generation: 0,
    sequence: 1,
    eventId: 'same-event',
    messageId: 'late-message',
    role: 'assistant',
    partId: 'reasoning-1',
    partType: 'reasoning',
    delta: 'Checking',
  };
  const once = reduceAgentStream(createAgentStreamState(), delta);
  const twice = reduceAgentStream(once, delta);

  expect(twice).to.equal(once);
  expect(twice.messages[0]?.parts?.[0]).to.deep.equal({
    id: 'reasoning-1',
    type: 'reasoning',
    text: 'Checking',
    state: 'streaming',
  });
});

it('upserts tools by invocation id', () => {
  const initial = createAgentStreamState();
  const args = { q: 'Lyra' };
  const running = reduceAgentStream(initial, {
    type: 'tool-upsert',
    generation: 0,
    sequence: 1,
    invocation: { id: 'call-1', name: 'search', args, status: 'running' },
  });
  args.q = 'Mutated by caller';
  const complete = reduceAgentStream(running, {
    type: 'tool-upsert',
    generation: 0,
    sequence: 2,
    invocation: {
      id: 'call-1',
      name: 'search',
      args: { q: 'Lyra' },
      status: 'success',
      result: { hits: 3 },
    },
  });

  expect(complete.tools).to.have.lengthOf(1);
  expect(running.tools[0]?.args).to.deep.equal({ q: 'Lyra' });
  expect(complete.tools[0]?.status).to.equal('success');
  expect(complete.tools[0]?.result).to.deep.equal({ hits: 3 });
});

it('applies safe immutable shared-state patches and rejects prototype paths', () => {
  const snapshot = reduceAgentStream(createAgentStreamState(), {
    type: 'state-snapshot',
    generation: 0,
    sequence: 1,
    snapshot: { filters: { year: 2025 }, selected: [] },
  });
  const patched = reduceAgentStream(snapshot, {
    type: 'state-delta',
    generation: 0,
    sequence: 2,
    patch: [
      { op: 'replace', path: '/filters/year', value: 2026 },
      { op: 'add', path: '/selected/0', value: 'doc-1' },
    ],
  });
  const forbidden = reduceAgentStream(patched, {
    type: 'state-delta',
    generation: 0,
    sequence: 3,
    patch: [{ op: 'add', path: '/__proto__/polluted', value: true }],
  });

  expect(snapshot.sharedState).to.deep.equal({ filters: { year: 2025 }, selected: [] });
  expect(patched.sharedState).to.deep.equal({ filters: { year: 2026 }, selected: ['doc-1'] });
  expect(forbidden.sharedState).to.deep.equal(patched.sharedState);
  expect(forbidden.error?.code).to.equal('invalid_stream_event');
  expect(({} as Record<string, unknown>)['polluted']).to.equal(undefined);
});

it('applies root, object, and array patch operations without mutating the input', () => {
  const original = {
    keep: true,
    nested: {
      values: [1, 2],
    },
  };

  const patched = applySharedStatePatch(original, [
    { op: 'add', path: '/nested/values/-', value: 3 },
    { op: 'replace', path: '/nested/values/0', value: 9 },
    { op: 'remove', path: '/nested/values/1' },
    { op: 'add', path: '/nested/extra', value: { enabled: true } },
    { op: 'remove', path: '/keep' },
  ]);

  expect(original).to.deep.equal({ keep: true, nested: { values: [1, 2] } });
  expect(patched).to.deep.equal({
    nested: {
      values: [9, 3],
      extra: { enabled: true },
    },
  });
  expect(applySharedStatePatch(original, [{ op: 'replace', path: '', value: ['root'] }])).to.deep.equal(['root']);
  expect(applySharedStatePatch(original, [{ op: 'remove', path: '' }])).to.equal(null);
});

it('ignores malformed, forbidden, and out-of-range patch paths', () => {
  const original = {
    list: ['first'],
    nested: { value: 1 },
    primitive: 'text',
  };
  const patched = applySharedStatePatch(original, [
    { op: 'replace', path: 'nested/value', value: 2 },
    { op: 'replace', path: '/missing/value', value: 2 },
    { op: 'replace', path: '/primitive/value', value: 2 },
    { op: 'replace', path: '/primitive/value/deeper', value: 2 },
    { op: 'replace', path: '/list/not-an-index', value: 2 },
    { op: 'replace', path: '/list/not-an-index/value', value: 2 },
    { op: 'replace', path: '/list/-1', value: 2 },
    { op: 'replace', path: '/list/9', value: 2 },
    { op: 'replace', path: '/list/9/value', value: 2 },
    { op: 'add', path: '/list/9', value: 2 },
    { op: 'remove', path: '/list/9' },
    { op: 'add', path: '/nested/constructor/polluted', value: true },
  ]);

  expect(patched).to.deep.equal(original);
  expect(({} as Record<string, unknown>)['polluted']).to.equal(undefined);
});

it('decodes escaped JSON Pointer segments and safely rejects non-cloneable values', () => {
  const patched = applySharedStatePatch(
    { 'a/b': { 'c~d': 1 } },
    [{ op: 'replace', path: '/a~1b/c~0d', value: 2 }],
  );
  expect(patched).to.deep.equal({ 'a/b': { 'c~d': 2 } });

  const state = reduceAgentStream(createAgentStreamState(), {
    type: 'state-snapshot',
    generation: 0,
    sequence: 1,
    snapshot: () => 'not cloneable',
  });
  expect(state.sharedState).to.equal(null);
});

it('handles snapshots, status updates, message replacement, and part upserts immutably', () => {
  const snapshotMessage = {
    id: 'message-1',
    role: 'user' as const,
    status: 'sent' as const,
    parts: [{ id: 'part-1', type: 'text' as const, text: 'Initial', state: 'complete' as const }],
  };
  const snapshotted = reduceAgentStream(createAgentStreamState(), {
    type: 'messages-snapshot',
    generation: 0,
    sequence: 1,
    messages: [snapshotMessage],
  });
  snapshotMessage.parts[0]!.text = 'Mutated by caller';
  expect(snapshotted.messages[0]?.parts?.[0]).to.deep.include({ text: 'Initial' });

  const status = reduceAgentStream(
    { ...snapshotted, runId: 'existing-run' },
    { type: 'run-status', generation: 0, sequence: 2, status: { kind: 'done' } },
  );
  expect(status.runId).to.equal('existing-run');
  expect(status.status.kind).to.equal('done');

  const replaced = reduceAgentStream(status, {
    type: 'message-start',
    generation: 0,
    sequence: 3,
    message: { id: 'message-1', role: 'assistant' },
  });
  expect(replaced.messages).to.have.lengthOf(1);
  expect(replaced.messages[0]?.role).to.equal('assistant');
  expect(replaced.messages[0]?.parts?.[0]).to.deep.include({ text: 'Initial' });

  const incomingPart = { id: 'part-2', type: 'text' as const, text: 'Created', state: 'streaming' as const };
  const addedPart = reduceAgentStream(replaced, {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 4,
    messageId: 'message-2',
    role: 'system',
    part: incomingPart,
  });
  incomingPart.text = 'Mutated by caller';
  expect(addedPart.messages[1]?.parts?.[0]).to.deep.include({ text: 'Created' });
  const updatedPart = reduceAgentStream(addedPart, {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 5,
    messageId: 'message-2',
    part: { id: 'part-2', type: 'text', text: 'Updated', state: 'complete' },
  });
  expect(updatedPart.messages[1]).to.deep.include({
    id: 'message-2',
    role: 'system',
    status: 'streaming',
  });
  expect(updatedPart.messages[1]?.parts?.[0]).to.deep.include({ text: 'Updated', state: 'complete' });
});

it('completes transport progress while failures remain explicit error parts', () => {
  const state = reduceAgentStream(createAgentStreamState(), {
    type: 'messages-snapshot',
    generation: 0,
    sequence: 1,
    messages: [
      {
        id: 'target',
        role: 'assistant',
        status: 'streaming',
        parts: [
          { id: 'ok', type: 'text', text: 'Ready', state: 'streaming' },
          { id: 'bad', type: 'error', message: 'Failed' },
        ],
      },
      { id: 'other', role: 'user', status: 'sent', parts: [] },
    ],
  });
  const complete = reduceAgentStream(state, {
    type: 'message-complete',
    generation: 0,
    sequence: 2,
    messageId: 'target',
  });

  expect(complete.messages[0]?.status).to.equal('sent');
  expect(complete.messages[0]?.parts?.map((part) => part.state)).to.deep.equal(['complete', 'complete']);
  expect(complete.messages[1]).to.equal(state.messages[1]);
});

it('reduces reset and error events, including optional error codes', () => {
  const running = reduceAgentStream(createAgentStreamState(), {
    type: 'run-start',
    generation: 1,
    sequence: 1,
    runId: 'run-1',
  });
  const failed = reduceAgentStream(running, {
    type: 'error',
    generation: 1,
    sequence: 2,
    eventId: 'error-1',
    message: 'Provider failed',
    code: 'provider_error',
  });
  expect(failed.status).to.deep.equal({ kind: 'error', message: 'Provider failed' });
  expect(failed.error).to.deep.equal({ message: 'Provider failed', code: 'provider_error' });
  expect(failed.cursor).to.equal(2);

  const failedWithoutCode = reduceAgentStream(running, {
    type: 'error',
    generation: 1,
    sequence: 2,
    message: 'Unknown failure',
  });
  expect(failedWithoutCode.error).to.deep.equal({ message: 'Unknown failure' });

  const reset = reduceAgentStream(failed, { type: 'reset', generation: 2, sequence: 1, eventId: 'reset-1' });
  expect(reset.generation).to.equal(2);
  expect(reset.cursor).to.equal(1);
  expect(reset.messages).to.deep.equal([]);
  expect(reset.tools).to.deep.equal([]);
  expect(reset.status).to.deep.equal({ kind: 'idle' });
});

it('uses a generation cursor so replay stays idempotent without an opaque history window', () => {
  const firstRun = reduceAgentStreamEvents(createAgentStreamState(), [
    { type: 'run-start', generation: 1, sequence: 1, runId: 'run-1' },
    {
      type: 'message-part-delta',
      generation: 1,
      sequence: 2,
      messageId: 'message-1',
      partId: 'text-1',
      partType: 'text',
      delta: 'first',
    },
  ] as AgentStreamEvent[]);
  const replayed = reduceAgentStream(firstRun, {
    type: 'message-part-delta',
    generation: 1,
    sequence: 2,
    messageId: 'message-1',
    partId: 'text-1',
    partType: 'text',
    delta: ' duplicate',
  } as AgentStreamEvent);

  expect(replayed).to.equal(firstRun);
  expect(replayed.generation).to.equal(1);
  expect(replayed.cursor).to.equal(2);
  expect(replayed.messages[0]?.parts?.[0]).to.deep.include({ text: 'first' });
  expect(replayed).not.to.have.property('seenEventIds');
});

it('makes a newer run generation an atomic state and replay boundary', () => {
  const oldRun = reduceAgentStreamEvents(createAgentStreamState(), [
    { type: 'run-start', generation: 1, sequence: 1, runId: 'run-1' },
    {
      type: 'messages-snapshot',
      generation: 1,
      sequence: 2,
      messages: [{ id: 'old-message', role: 'assistant', text: 'old' }],
    },
    {
      type: 'tool-upsert',
      generation: 1,
      sequence: 3,
      invocation: { id: 'old-tool', name: 'search', args: {}, status: 'success' },
    },
    { type: 'state-snapshot', generation: 1, sequence: 4, snapshot: { old: true } },
  ] as AgentStreamEvent[]);
  const newRun = reduceAgentStream(oldRun, {
    type: 'run-start',
    generation: 2,
    sequence: 1,
    runId: 'run-2',
  } as AgentStreamEvent);
  const stale = reduceAgentStream(newRun, {
    type: 'message-part-delta',
    generation: 1,
    sequence: 99,
    messageId: 'old-message',
    partId: 'text',
    partType: 'text',
    delta: 'stale',
  } as AgentStreamEvent);

  expect(newRun.runId).to.equal('run-2');
  expect(newRun.messages).to.deep.equal([]);
  expect(newRun.tools).to.deep.equal([]);
  expect(newRun.sharedState).to.equal(null);
  expect(newRun.error).to.equal(undefined);
  expect(stale).to.equal(newRun);
});

it('rejects malformed patch operations without throwing or partially applying the patch', () => {
  const original = { count: 1 };
  const malformed = [
    null,
    {},
    { op: 'move', path: '/count', from: '/other' },
    { op: 'replace' },
    { op: 'remove', path: '/count', value: 2 },
  ] as unknown as Parameters<typeof applySharedStatePatch>[1];

  expect(() => applySharedStatePatch(original, malformed)).not.to.throw();
  expect(applySharedStatePatch(original, malformed)).to.deep.equal(original);
});

it('accepts only canonical decimal array indices and valid append operations', () => {
  const original = { list: ['first', 'second'] };
  for (const path of ['/list/', '/list/00', '/list/+0', '/list/0x0', '/list/0.0']) {
    expect(applySharedStatePatch(original, [{ op: 'replace', path, value: 'changed' }])).to.deep.equal(original);
  }
  expect(applySharedStatePatch(original, [{ op: 'add', path: '/list/-', value: 'third' }])).to.deep.equal({
    list: ['first', 'second', 'third'],
  });
  expect(applySharedStatePatch(original, [{ op: 'replace', path: '/list/-', value: 'changed' }])).to.deep.equal(original);
});

it('fails closed when a provider record cannot be recursively snapshotted', () => {
  const metadata = { nested: { value: 'original' }, callback: () => 'unsafe' };
  const rejected = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'message-1', role: 'assistant', metadata },
  } as AgentStreamEvent);
  expect(rejected.messages).to.deep.equal([]);
  expect(rejected.error?.code).to.equal('invalid_stream_event');

  const accepted = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'message-2', role: 'assistant', metadata: { nested: { value: 'original' } } },
  } as AgentStreamEvent);
  const incoming = { nested: { value: 'original' } };
  const immutable = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'message-3', role: 'assistant', metadata: incoming },
  } as AgentStreamEvent);
  incoming.nested.value = 'mutated';
  expect(accepted.messages).to.have.lengthOf(1);
  expect(immutable.messages[0]?.metadata).to.deep.equal({ nested: { value: 'original' } });
});

it('reports configured resource-limit failures without truncating retained history', () => {
  const initial = createAgentStreamState({ maxDeltaCharacters: 5, maxMessages: 1 });
  const retained = reduceAgentStream(initial, {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'kept', role: 'assistant', text: 'kept' },
  } as AgentStreamEvent);
  const tooMany = reduceAgentStream(retained, {
    type: 'message-start',
    generation: 0,
    sequence: 2,
    message: { id: 'rejected', role: 'assistant' },
  } as AgentStreamEvent);
  const oversized = reduceAgentStream(retained, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 2,
    messageId: 'kept',
    partId: 'text',
    partType: 'text',
    delta: '123456',
  } as AgentStreamEvent);

  expect(tooMany.messages.map((message) => message.id)).to.deep.equal(['kept']);
  expect(tooMany.error?.code).to.equal('stream_limit_exceeded');
  expect(oversized.messages[0]?.parts).to.equal(undefined);
  expect(oversized.error?.code).to.equal('stream_limit_exceeded');
});

it('enforces the aggregate retained-byte budget while preserving the accepted prefix', () => {
  let state = createAgentStreamState({
    maxMessages: 10,
    maxSnapshotBytes: 400,
    maxRetainedBytes: 400,
  });
  for (let index = 0; index < 2; index += 1) {
    state = reduceAgentStream(state, {
      type: 'message-start',
      generation: 0,
      sequence: index + 1,
      message: { id: `message-${index}`, role: 'assistant', text: 'x'.repeat(100) },
    } as AgentStreamEvent);
  }
  expect(state.messages).to.have.lengthOf(2);
  const rejected = reduceAgentStream(state, {
    type: 'message-start',
    generation: 0,
    sequence: 3,
    message: { id: 'message-2', role: 'assistant', text: 'x'.repeat(100) },
  } as AgentStreamEvent);
  expect(rejected.messages.map((message) => message.id)).to.deep.equal(['message-0', 'message-1']);
  expect(rejected.error?.code).to.equal('stream_limit_exceeded');
});

it('clamps a configured snapshot budget down to the retained-byte ceiling', () => {
  const state = createAgentStreamState({ maxSnapshotBytes: 10_000, maxRetainedBytes: 500 });
  expect(state.limits.maxSnapshotBytes).to.equal(500);
  expect(state.limits.maxRetainedBytes).to.equal(500);
});

it('fails closed on a malformed or oversized event envelope before inspecting its type', () => {
  const state = createAgentStreamState();
  const notARecord = reduceAgentStream(state, null as unknown as AgentStreamEvent);
  expect(notARecord.error?.code).to.equal('invalid_stream_event');
  const notARecordEither = reduceAgentStream(state, [] as unknown as AgentStreamEvent);
  expect(notARecordEither.error?.code).to.equal('invalid_stream_event');

  const missingCursor = reduceAgentStream(state, { type: 'reset' } as unknown as AgentStreamEvent);
  expect(missingCursor.error?.code).to.equal('invalid_stream_event');
  const negativeGeneration = reduceAgentStream(state, {
    type: 'reset',
    generation: -1,
    sequence: 1,
  } as unknown as AgentStreamEvent);
  expect(negativeGeneration.error?.code).to.equal('invalid_stream_event');

  const tinyBudget = createAgentStreamState({ maxSnapshotBytes: 16 });
  const oversized = reduceAgentStream(tinyBudget, {
    type: 'reset',
    generation: 1,
    sequence: 1,
  } as AgentStreamEvent);
  expect(oversized.error?.code).to.equal('stream_limit_exceeded');
});

it('rejects a run-start or run-status event with an invalid shape', () => {
  const state = createAgentStreamState();
  const missingRunId = reduceAgentStream(state, {
    type: 'run-start',
    generation: 1,
    sequence: 1,
  } as AgentStreamEvent);
  expect(missingRunId.error?.code).to.equal('invalid_stream_event');
  // failEvent() always reports the failure through status too, distinct from a run's own
  // 'idle'/'running' progression.
  expect(missingRunId.status.kind).to.equal('error');

  const missingStatusKind = reduceAgentStream(state, {
    type: 'run-status',
    generation: 0,
    sequence: 1,
    status: {},
  } as unknown as AgentStreamEvent);
  expect(missingStatusKind.error?.code).to.equal('invalid_stream_event');

  const invalidRunId = reduceAgentStream(state, {
    type: 'run-status',
    generation: 0,
    sequence: 1,
    status: { kind: 'running' },
    runId: '',
  } as unknown as AgentStreamEvent);
  expect(invalidRunId.error?.code).to.equal('invalid_stream_event');
});

it('rejects a messages-snapshot event that is malformed, too large, or contains an invalid/duplicate entry', () => {
  const tinyCap = createAgentStreamState({ maxMessages: 1 });
  const notAnArray = reduceAgentStream(tinyCap, {
    type: 'messages-snapshot',
    generation: 0,
    sequence: 1,
    messages: 'nope',
  } as unknown as AgentStreamEvent);
  expect(notAnArray.error?.code).to.equal('stream_limit_exceeded');

  const tooMany = reduceAgentStream(tinyCap, {
    type: 'messages-snapshot',
    generation: 0,
    sequence: 1,
    messages: [
      { id: 'a', role: 'user' },
      { id: 'b', role: 'user' },
    ],
  } as AgentStreamEvent);
  expect(tooMany.error?.code).to.equal('stream_limit_exceeded');

  const invalidEntry = reduceAgentStream(createAgentStreamState(), {
    type: 'messages-snapshot',
    generation: 0,
    sequence: 1,
    messages: [{ id: 'a', role: 'not-a-role' }],
  } as unknown as AgentStreamEvent);
  expect(invalidEntry.error?.code).to.equal('invalid_stream_event');

  const duplicateEntry = reduceAgentStream(createAgentStreamState(), {
    type: 'messages-snapshot',
    generation: 0,
    sequence: 1,
    messages: [
      { id: 'dup', role: 'user' },
      { id: 'dup', role: 'assistant' },
    ],
  } as AgentStreamEvent);
  expect(duplicateEntry.error?.code).to.equal('invalid_stream_event');
});

it('rejects a message with an unrecognized role', () => {
  const rejected = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'm1', role: 'bot' },
  } as unknown as AgentStreamEvent);
  expect(rejected.error?.code).to.equal('invalid_stream_event');
  expect(rejected.messages).to.deep.equal([]);
});

it('validates message-level attachments through validDocument, accepting and rejecting appropriately', () => {
  const state = createAgentStreamState();
  const valid = reduceAgentStream(state, {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: {
      id: 'm1',
      role: 'assistant',
      attachments: [{ id: 'doc-1', name: 'spec.pdf', mimeType: 'application/pdf' }],
    },
  } as AgentStreamEvent);
  expect(valid.error).to.equal(undefined);
  expect(valid.messages[0]?.attachments).to.have.lengthOf(1);

  const invalidEntry = reduceAgentStream(state, {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'm2', role: 'assistant', attachments: [{ id: 'doc-1' }] },
  } as unknown as AgentStreamEvent);
  expect(invalidEntry.error?.code).to.equal('invalid_stream_event');

  const notAnArray = reduceAgentStream(state, {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'm3', role: 'assistant', attachments: 'nope' },
  } as unknown as AgentStreamEvent);
  expect(notAnArray.error?.code).to.equal('invalid_stream_event');
});

it('validates every documented message-part variant, accepting the valid shape and rejecting the invalid one', () => {
  const cases: Array<{ part: unknown; valid: boolean }> = [
    {
      part: { id: 'p', type: 'tool-call', invocation: { id: 'c1', name: 'search', args: {}, status: 'running' } },
      valid: true,
    },
    {
      part: { id: 'p', type: 'tool-call', invocation: { id: 'c1', name: 'search', args: {}, status: 'bogus' } },
      valid: false,
    },
    { part: { id: 'p', type: 'tool-result', invocationId: 'c1', result: { hits: 1 } }, valid: true },
    { part: { id: 'p', type: 'tool-result', invocationId: 'c1', error: 'failed' }, valid: true },
    { part: { id: 'p', type: 'tool-result', invocationId: 'c1' }, valid: false },
    { part: { id: 'p', type: 'tool-result', result: { hits: 1 } }, valid: false },
    { part: { id: 'p', type: 'citation', citation: { id: 'source-1' } }, valid: true },
    { part: { id: 'p', type: 'citation', citation: {} }, valid: false },
    {
      part: { id: 'p', type: 'attachment', document: { id: 'doc-1', name: 'report.pdf', mimeType: 'application/pdf' } },
      valid: true,
    },
    { part: { id: 'p', type: 'attachment', document: { id: 'doc-1' } }, valid: false },
    { part: { id: 'p', type: 'data', data: { rows: 1 } }, valid: true },
    { part: { id: 'p', type: 'data', widget: 'chart' }, valid: true },
    { part: { id: 'p', type: 'data', data: { rows: 1 }, widget: 'chart' }, valid: false },
    { part: { id: 'p', type: 'data' }, valid: false },
    { part: { id: 'p', type: 'audio', src: 'https://example.com/a.mp3' }, valid: true },
    { part: { id: 'p', type: 'audio', src: 42 }, valid: false },
    { part: { id: 'p', type: 'unrecognized-part-type' }, valid: false },
  ];
  for (const [index, { part, valid }] of cases.entries()) {
    const result = reduceAgentStream(createAgentStreamState(), {
      type: 'message-part-upsert',
      generation: 0,
      sequence: 1,
      messageId: `message-${index}`,
      part,
    } as unknown as AgentStreamEvent);
    if (valid) {
      expect(result.error, JSON.stringify(part)).to.equal(undefined);
      expect(result.messages[0]?.parts?.[0]?.id).to.equal('p');
    } else {
      expect(result.error?.code, JSON.stringify(part)).to.equal('invalid_stream_event');
    }
  }
});

it('rejects and caps a message-part-upsert event', () => {
  const state = createAgentStreamState();
  const invalidTarget = reduceAgentStream(state, {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 1,
    messageId: '',
    part: { id: 'p1', type: 'text', text: 'hi' },
  } as unknown as AgentStreamEvent);
  expect(invalidTarget.error?.code).to.equal('invalid_stream_event');

  const invalidRole = reduceAgentStream(state, {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 1,
    messageId: 'm1',
    role: 'bot',
    part: { id: 'p1', type: 'text', text: 'hi' },
  } as unknown as AgentStreamEvent);
  expect(invalidRole.error?.code).to.equal('invalid_stream_event');

  const capped = createAgentStreamState({ maxMessages: 1 });
  const withOne = reduceAgentStream(capped, {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'existing', role: 'assistant' },
  } as AgentStreamEvent);
  const newMessageRejected = reduceAgentStream(withOne, {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 2,
    messageId: 'brand-new',
    part: { id: 'p1', type: 'text', text: 'hi' },
  } as AgentStreamEvent);
  expect(newMessageRejected.error?.code).to.equal('stream_limit_exceeded');

  const partCapped = createAgentStreamState({ maxPartsPerMessage: 1 });
  const withOnePart = reduceAgentStream(partCapped, {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 1,
    messageId: 'm1',
    part: { id: 'p1', type: 'text', text: 'first' },
  } as AgentStreamEvent);
  const secondPartRejected = reduceAgentStream(withOnePart, {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 2,
    messageId: 'm1',
    part: { id: 'p2', type: 'text', text: 'second' },
  } as AgentStreamEvent);
  expect(secondPartRejected.error?.code).to.equal('stream_limit_exceeded');
  expect(secondPartRejected.messages[0]?.parts).to.have.lengthOf(1);
});

it('rejects and caps a message-part-delta event across its validation and limit checks', () => {
  const state = createAgentStreamState();
  const invalidShape = reduceAgentStream(state, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 1,
    messageId: 'm1',
    partId: 'p1',
    partType: 'markdown',
    delta: 'x',
  } as unknown as AgentStreamEvent);
  expect(invalidShape.error?.code).to.equal('invalid_stream_event');

  const capped = createAgentStreamState({ maxMessages: 1 });
  const withOne = reduceAgentStream(capped, {
    type: 'message-start',
    generation: 0,
    sequence: 1,
    message: { id: 'existing', role: 'assistant' },
  } as AgentStreamEvent);
  const newMessageRejected = reduceAgentStream(withOne, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 2,
    messageId: 'brand-new',
    partId: 'p1',
    partType: 'text',
    delta: 'x',
  } as AgentStreamEvent);
  expect(newMessageRejected.error?.code).to.equal('stream_limit_exceeded');

  const withToolPart = reduceAgentStream(createAgentStreamState(), {
    type: 'message-part-upsert',
    generation: 0,
    sequence: 1,
    messageId: 'm1',
    part: {
      id: 'call-1',
      type: 'tool-call',
      invocation: { id: 'call-1', name: 'search', args: {}, status: 'running' },
    },
  } as AgentStreamEvent);
  const nonTextTarget = reduceAgentStream(withToolPart, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 2,
    messageId: 'm1',
    partId: 'call-1',
    partType: 'text',
    delta: 'oops',
  } as AgentStreamEvent);
  expect(nonTextTarget.error?.code).to.equal('invalid_stream_event');

  const partCapped = createAgentStreamState({ maxPartsPerMessage: 1 });
  const withOnePart = reduceAgentStream(partCapped, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 1,
    messageId: 'm1',
    partId: 'p1',
    partType: 'text',
    delta: 'first',
  } as AgentStreamEvent);
  const secondPartRejected = reduceAgentStream(withOnePart, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 2,
    messageId: 'm1',
    partId: 'p2',
    partType: 'text',
    delta: 'second',
  } as AgentStreamEvent);
  expect(secondPartRejected.error?.code).to.equal('stream_limit_exceeded');

  const textCapped = createAgentStreamState({ maxTextCharactersPerPart: 5 });
  const started = reduceAgentStream(textCapped, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 1,
    messageId: 'm1',
    partId: 'p1',
    partType: 'text',
    delta: 'hello',
  } as AgentStreamEvent);
  const overflow = reduceAgentStream(started, {
    type: 'message-part-delta',
    generation: 0,
    sequence: 2,
    messageId: 'm1',
    partId: 'p1',
    partType: 'text',
    delta: '!',
  } as AgentStreamEvent);
  expect(overflow.error?.code).to.equal('stream_limit_exceeded');
});

it('rejects a message-complete event with an invalid target id', () => {
  const invalid = reduceAgentStream(createAgentStreamState(), {
    type: 'message-complete',
    generation: 0,
    sequence: 1,
    messageId: '',
  } as unknown as AgentStreamEvent);
  expect(invalid.error?.code).to.equal('invalid_stream_event');
});

it('rejects and caps a tool-upsert event', () => {
  const invalidShape = reduceAgentStream(createAgentStreamState(), {
    type: 'tool-upsert',
    generation: 0,
    sequence: 1,
    invocation: { id: 'call-1', name: 'search', args: {}, status: 'not-a-status' },
  } as unknown as AgentStreamEvent);
  expect(invalidShape.error?.code).to.equal('invalid_stream_event');

  const capped = createAgentStreamState({ maxTools: 1 });
  const withOne = reduceAgentStream(capped, {
    type: 'tool-upsert',
    generation: 0,
    sequence: 1,
    invocation: { id: 'call-1', name: 'search', args: {}, status: 'running' },
  } as AgentStreamEvent);
  const secondRejected = reduceAgentStream(withOne, {
    type: 'tool-upsert',
    generation: 0,
    sequence: 2,
    invocation: { id: 'call-2', name: 'search', args: {}, status: 'running' },
  } as AgentStreamEvent);
  expect(secondRejected.error?.code).to.equal('stream_limit_exceeded');
  expect(secondRejected.tools).to.have.lengthOf(1);
});

it('rejects an error event with an invalid shape', () => {
  const state = createAgentStreamState({ maxStatusMessageCharacters: 5 });
  const missingMessage = reduceAgentStream(state, {
    type: 'error',
    generation: 0,
    sequence: 1,
  } as unknown as AgentStreamEvent);
  expect(missingMessage.error?.code).to.equal('invalid_stream_event');

  const tooLong = reduceAgentStream(state, {
    type: 'error',
    generation: 0,
    sequence: 1,
    message: 'too long for the configured limit',
  } as AgentStreamEvent);
  expect(tooLong.error?.code).to.equal('invalid_stream_event');
});

it('fails closed on an unrecognized event type', () => {
  const rejected = reduceAgentStream(createAgentStreamState(), {
    type: 'agent-thinking-really-hard',
    generation: 0,
    sequence: 1,
  } as unknown as AgentStreamEvent);
  expect(rejected.error?.code).to.equal('invalid_stream_event');
});

it('recomputes retained usage (including tools) for a state object bypassing the cache', () => {
  const limited = createAgentStreamState({ maxRetainedBytes: 400, maxSnapshotBytes: 400 });
  const withTool = reduceAgentStream(limited, {
    type: 'tool-upsert',
    generation: 0,
    sequence: 1,
    invocation: { id: 'call-1', name: 'search', args: { q: 'x'.repeat(100) }, status: 'running' },
  } as AgentStreamEvent);
  expect(withTool.error).to.equal(undefined);

  // A plain object spread produces a state the module's WeakMap cache has never seen, forcing
  // usageFor() to recompute retained usage from scratch on the next reduction -- including its
  // tools loop, which every other test leaves unexercised because commit()/failEvent() always
  // populate the cache for the state objects they themselves return.
  const uncached = { ...withTool };
  const secondTool = reduceAgentStream(uncached, {
    type: 'tool-upsert',
    generation: 0,
    sequence: 2,
    invocation: { id: 'call-2', name: 'search', args: { q: 'y'.repeat(100) }, status: 'running' },
  } as AgentStreamEvent);
  expect(secondTool.tools).to.have.lengthOf(2);

  const thirdTool = reduceAgentStream({ ...secondTool }, {
    type: 'tool-upsert',
    generation: 0,
    sequence: 3,
    invocation: { id: 'call-3', name: 'search', args: { q: 'z'.repeat(100) }, status: 'running' },
  } as AgentStreamEvent);
  expect(thirdTool.error?.code).to.equal('stream_limit_exceeded');
  expect(thirdTool.tools).to.have.lengthOf(2);
});

it('walks through an array element as an intermediate patch-path segment', () => {
  const original = { list: [{ nested: 1 }], primitive: 'text' };

  // Successful descent through a valid, in-range array index to reach a nested object.
  expect(applySharedStatePatch(original, [{ op: 'replace', path: '/list/0/nested', value: 2 }]))
    .to.deep.equal({ list: [{ nested: 2 }], primitive: 'text' });

  // A non-numeric intermediate segment against an array parent is a no-op.
  expect(applySharedStatePatch(original, [{ op: 'replace', path: '/list/not-an-index/nested', value: 2 }]))
    .to.deep.equal(original);

  // An out-of-range intermediate array index is a no-op.
  expect(applySharedStatePatch(original, [{ op: 'replace', path: '/list/9/nested', value: 2 }]))
    .to.deep.equal(original);

  // Descending *through* a primitive (neither array nor record) as a non-final path segment is a
  // no-op -- distinct from targeting a primitive as the final segment, which a sibling test above
  // already covers via '/primitive/value'.
  expect(applySharedStatePatch(original, [{ op: 'replace', path: '/primitive/a/b', value: 2 }]))
    .to.deep.equal(original);
});

it('drops a stale error code when a new run-status error reports a different message', () => {
  const failed = reduceAgentStream(createAgentStreamState(), {
    type: 'error',
    generation: 0,
    sequence: 1,
    message: 'first failure',
    code: 'first_code',
  } as AgentStreamEvent);
  const changedMessage = reduceAgentStream(failed, {
    type: 'run-status',
    generation: 0,
    sequence: 2,
    status: { kind: 'error', message: 'a completely different failure' },
  } as AgentStreamEvent);
  // The new message no longer matches the retained error's message, so its code must not be
  // carried over onto an unrelated failure.
  expect(changedMessage.error).to.deep.equal({ message: 'a completely different failure' });

  const noMessageOrPriorError = reduceAgentStream(createAgentStreamState(), {
    type: 'run-status',
    generation: 0,
    sequence: 1,
    status: { kind: 'error' },
  } as AgentStreamEvent);
  expect(noMessageOrPriorError.error).to.deep.equal({ message: 'Agent run failed' });
});

it('keeps run status and error recovery coherent for every non-error transition', () => {
  const failed = reduceAgentStream(createAgentStreamState(), {
    type: 'error',
    generation: 0,
    sequence: 1,
    message: 'failed',
    code: 'provider_error',
  } as AgentStreamEvent);
  const recoveryKinds = [
    'idle',
    'running',
    'queued',
    'collecting',
    'waiting-input',
    'waiting-approval',
    'done',
    'cancelled',
    'provider-specific',
  ];
  const reaffirmed = reduceAgentStream(failed, {
    type: 'run-status',
    generation: 0,
    sequence: 2,
    status: { kind: 'error', message: 'failed' },
  } as AgentStreamEvent);
  expect(reaffirmed.error).to.deep.equal({ message: 'failed', code: 'provider_error' });
  for (const [index, kind] of recoveryKinds.entries()) {
    const recovered = reduceAgentStream(failed, {
      type: 'run-status',
      generation: 0,
      sequence: index + 2,
      status: { kind },
    } as AgentStreamEvent);
    expect(recovered.status.kind).to.equal(kind);
    expect(recovered.error).to.equal(undefined);
  }

  const statusError = reduceAgentStream(createAgentStreamState(), {
    type: 'run-status',
    generation: 0,
    sequence: 1,
    status: { kind: 'error', message: 'status failed' },
  } as AgentStreamEvent);
  expect(statusError.error).to.deep.equal({ message: 'status failed' });
});
