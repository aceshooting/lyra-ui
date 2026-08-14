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
