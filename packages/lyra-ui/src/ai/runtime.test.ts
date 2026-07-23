import { expect } from '@open-wc/testing';
import {
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
  const running = reduceAgentStream(initial, {
    type: 'tool-upsert',
    invocation: { id: 'call-1', name: 'search', args: { q: 'Lyra' }, status: 'running' },
  });
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
