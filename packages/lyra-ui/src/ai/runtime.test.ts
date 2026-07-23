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
    { type: 'run-start', eventId: '1', runId: 'run-1' },
    {
      type: 'message-start',
      eventId: '2',
      message: { id: 'message-1', role: 'assistant', parts: [] },
    },
    {
      type: 'message-part-delta',
      eventId: '3',
      messageId: 'message-1',
      partId: 'text-1',
      partType: 'text',
      delta: 'Hello',
    },
    {
      type: 'message-part-delta',
      eventId: '4',
      messageId: 'message-1',
      partId: 'text-1',
      partType: 'text',
      delta: ' world',
    },
    { type: 'message-complete', eventId: '5', messageId: 'message-1' },
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

it('accepts an out-of-order delta and ignores a duplicated event id', () => {
  const delta: AgentStreamEvent = {
    type: 'message-part-delta',
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
    invocation: { id: 'call-1', name: 'search', args, status: 'running' },
  });
  args.q = 'Mutated by caller';
  const complete = reduceAgentStream(running, {
    type: 'tool-upsert',
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
    snapshot: { filters: { year: 2025 }, selected: [] },
  });
  const patched = reduceAgentStream(snapshot, {
    type: 'state-delta',
    patch: [
      { op: 'replace', path: '/filters/year', value: 2026 },
      { op: 'add', path: '/selected/0', value: 'doc-1' },
      { op: 'add', path: '/__proto__/polluted', value: true },
    ],
  });

  expect(snapshot.sharedState).to.deep.equal({ filters: { year: 2025 }, selected: [] });
  expect(patched.sharedState).to.deep.equal({ filters: { year: 2026 }, selected: ['doc-1'] });
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
    messages: [snapshotMessage],
  });
  snapshotMessage.parts[0]!.text = 'Mutated by caller';
  expect(snapshotted.messages[0]?.parts?.[0]).to.deep.include({ text: 'Initial' });

  const status = reduceAgentStream(
    { ...snapshotted, runId: 'existing-run' },
    { type: 'run-status', status: { kind: 'done' } },
  );
  expect(status.runId).to.equal('existing-run');
  expect(status.status.kind).to.equal('done');

  const replaced = reduceAgentStream(status, {
    type: 'message-start',
    message: { id: 'message-1', role: 'assistant' },
  });
  expect(replaced.messages).to.have.lengthOf(1);
  expect(replaced.messages[0]?.role).to.equal('assistant');
  expect(replaced.messages[0]?.parts?.[0]).to.deep.include({ text: 'Initial' });

  const incomingPart = { id: 'part-2', type: 'text' as const, text: 'Created', state: 'streaming' as const };
  const addedPart = reduceAgentStream(replaced, {
    type: 'message-part-upsert',
    messageId: 'message-2',
    role: 'system',
    part: incomingPart,
  });
  incomingPart.text = 'Mutated by caller';
  expect(addedPart.messages[1]?.parts?.[0]).to.deep.include({ text: 'Created' });
  const updatedPart = reduceAgentStream(addedPart, {
    type: 'message-part-upsert',
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

it('preserves errored parts while completing a message', () => {
  const state = reduceAgentStream(createAgentStreamState(), {
    type: 'messages-snapshot',
    messages: [
      {
        id: 'target',
        role: 'assistant',
        status: 'streaming',
        parts: [
          { id: 'ok', type: 'text', text: 'Ready', state: 'streaming' },
          { id: 'bad', type: 'text', text: 'Failed', state: 'error' },
        ],
      },
      { id: 'other', role: 'user', status: 'sent', parts: [] },
    ],
  });
  const complete = reduceAgentStream(state, { type: 'message-complete', messageId: 'target' });

  expect(complete.messages[0]?.status).to.equal('sent');
  expect(complete.messages[0]?.parts?.map((part) => part.state)).to.deep.equal(['complete', 'error']);
  expect(complete.messages[1]).to.equal(state.messages[1]);
});

it('reduces reset and error events, including optional error codes', () => {
  const running = reduceAgentStream(createAgentStreamState(), {
    type: 'run-start',
    runId: 'run-1',
  });
  const failed = reduceAgentStream(running, {
    type: 'error',
    eventId: 'error-1',
    message: 'Provider failed',
    code: 'provider_error',
  });
  expect(failed.status).to.deep.equal({ kind: 'error', message: 'Provider failed' });
  expect(failed.error).to.deep.equal({ message: 'Provider failed', code: 'provider_error' });
  expect(failed.seenEventIds).to.deep.equal(['error-1']);

  const failedWithoutCode = reduceAgentStream(running, {
    type: 'error',
    message: 'Unknown failure',
  });
  expect(failedWithoutCode.error).to.deep.equal({ message: 'Unknown failure' });

  const reset = reduceAgentStream(failed, { type: 'reset', eventId: 'reset-1' });
  expect(reset).to.deep.equal({
    ...createAgentStreamState(),
    seenEventIds: ['reset-1'],
  });
});

it('bounds replay history to the most recent transport event ids', () => {
  const events: AgentStreamEvent[] = Array.from({ length: 2050 }, (_, index) => ({
    type: 'run-status',
    eventId: `event-${index}`,
    status: { kind: 'running' },
  }));
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);

  expect(state.seenEventIds).to.have.lengthOf(2048);
  expect(state.seenEventIds[0]).to.equal('event-2');
  expect(state.seenEventIds.at(-1)).to.equal('event-2049');
});
