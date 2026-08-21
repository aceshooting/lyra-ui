import { expect } from '@open-wc/testing';
import { AgUiStreamAdapter } from './ag-ui.js';
import { createAgentStreamState, reduceAgentStreamEvents } from '../runtime.js';

it('maps AG-UI text lifecycle events into an ordered message', () => {
  const adapter = new AgUiStreamAdapter();
  const events = [
    ...adapter.push({ type: 'RUN_STARTED', eventId: '1', runId: 'run-1' }),
    ...adapter.push({ type: 'TEXT_MESSAGE_START', eventId: '2', messageId: 'm1', role: 'assistant' }),
    ...adapter.push({ type: 'TEXT_MESSAGE_CONTENT', eventId: '3', messageId: 'm1', delta: 'Hello ' }),
    ...adapter.push({ type: 'TEXT_MESSAGE_CONTENT', eventId: '4', messageId: 'm1', delta: 'world' }),
    ...adapter.push({ type: 'TEXT_MESSAGE_END', eventId: '5', messageId: 'm1' }),
    ...adapter.push({ type: 'RUN_FINISHED', eventId: '6', runId: 'run-1' }),
  ];
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);

  expect(state.status.kind).to.equal('done');
  expect(state.messages[0]?.parts?.[0]).to.deep.include({ type: 'text', text: 'Hello world' });
});

it('buffers streamed tool arguments until they form JSON', () => {
  const adapter = new AgUiStreamAdapter();
  const events = [
    ...adapter.push({
      type: 'TOOL_CALL_START',
      eventId: '1',
      toolCallId: 'call-1',
      toolCallName: 'search',
    }),
    ...adapter.push({ type: 'TOOL_CALL_ARGS', eventId: '2', toolCallId: 'call-1', delta: '{\"query\":' }),
    ...adapter.push({ type: 'TOOL_CALL_ARGS', eventId: '3', toolCallId: 'call-1', delta: '\"Lyra\"}' }),
    ...adapter.push({ type: 'TOOL_CALL_END', eventId: '4', toolCallId: 'call-1' }),
    ...adapter.push({ type: 'TOOL_CALL_RESULT', eventId: '5', toolCallId: 'call-1', result: { hits: 3 } }),
  ];
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);

  expect(state.tools[0]?.args).to.deep.equal({ query: 'Lyra' });
  expect(state.tools[0]?.status).to.equal('success');
  expect(state.tools[0]?.result).to.deep.equal({ hits: 3 });
});

it('maps state snapshots and JSON-patch deltas', () => {
  const adapter = new AgUiStreamAdapter();
  const events = [
    ...adapter.push({ type: 'STATE_SNAPSHOT', eventId: '1', snapshot: { count: 1 } }),
    ...adapter.push({
      type: 'STATE_DELTA',
      eventId: '2',
      delta: [{ op: 'replace', path: '/count', value: 2 }],
    }),
  ];
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);
  expect(state.sharedState).to.deep.equal({ count: 2 });
});

it('maps run failures to both error and terminal status events', () => {
  const adapter = new AgUiStreamAdapter();
  expect(adapter.push({
    type: 'RUN_ERROR',
    eventId: 'failure-1',
    runId: 'run-1',
    message: 'Rate limited',
    code: 'rate_limit',
  })).to.deep.equal([
    {
      type: 'error',
      generation: 0,
      sequence: 1,
      eventId: 'failure-1:error',
      message: 'Rate limited',
      code: 'rate_limit',
    },
    {
      type: 'run-status',
      generation: 0,
      sequence: 2,
      eventId: 'failure-1:status',
      runId: 'run-1',
      status: { kind: 'error', message: 'Rate limited' },
    },
  ]);

  const fallback = adapter.push({ type: 'RUN_ERROR' });
  expect(fallback[0]).to.deep.include({
    type: 'error',
    message: 'Agent run failed',
  });
  expect(fallback[0]).not.to.have.property('eventId');
});

it('maps snapshot messages with role and identifier fallbacks while filtering malformed entries', () => {
  const adapter = new AgUiStreamAdapter();
  const events = adapter.push({
    type: 'MESSAGES_SNAPSHOT',
    eventId: 'snapshot-1',
    messages: [
      null,
      [],
      { id: 'user-1', role: 'user', content: 'Question' },
      { role: 'system', content: 'Policy' },
      { id: 'fallback-role', role: 'unexpected', content: 42 },
    ],
  });
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);

  expect(state.messages).to.have.lengthOf(3);
  expect(state.messages.map((message) => message.id)).to.deep.equal([
    'user-1',
    'snapshot-3',
    'fallback-role',
  ]);
  expect(state.messages.map((message) => message.role)).to.deep.equal([
    'user',
    'system',
    'assistant',
  ]);
  expect(state.messages[0]?.parts?.[0]).to.deep.include({ text: 'Question', state: 'complete' });
  expect(state.messages[2]?.parts).to.deep.equal([]);
});

it('resets buffered tool state and safely handles partial, malformed, and out-of-order tool events', () => {
  const adapter = new AgUiStreamAdapter();
  adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'call-1', toolCallName: 'search' });
  adapter.push({ type: 'TOOL_CALL_ARGS', toolCallId: 'call-1', delta: '{"query":' });
  adapter.push({ type: 'TOOL_CALL_ARGS', toolCallId: 'call-1', delta: '["not-an-object"]}' });
  adapter.reset();

  const afterReset = adapter.push({ type: 'TOOL_CALL_END', toolCallId: 'call-1' });
  expect(afterReset[0]).to.deep.include({
    type: 'tool-upsert',
    invocation: {
      id: 'call-1',
      name: 'tool',
      args: {},
      status: 'running',
    },
  });

  const outOfOrderArgs = adapter.push({
    type: 'TOOL_CALL_ARGS',
    toolCallId: 'call-2',
    delta: '{"query":"Lyra"}',
  });
  expect(outOfOrderArgs[0]).to.deep.include({
    invocation: {
      id: 'call-2',
      name: 'tool',
      args: { query: 'Lyra' },
      status: 'running',
    },
  });

  const nonObjectArgs = adapter.push({
    type: 'TOOL_CALL_ARGS',
    toolCallId: 'call-array',
    delta: '[]',
  });
  expect(nonObjectArgs[0]).to.deep.nested.include({ 'invocation.args': {} });

  const result = adapter.push({ type: 'TOOL_CALL_RESULT', toolCallId: 'call-2', result: 0 });
  expect(result[0]).to.deep.include({
    invocation: {
      id: 'call-2',
      name: 'tool',
      args: { query: 'Lyra' },
      status: 'success',
      result: 0,
    },
  });
});

it('uses safe defaults for message roles and tool names', () => {
  const adapter = new AgUiStreamAdapter();
  const user = adapter.push({ type: 'TEXT_MESSAGE_START', messageId: 'user-1', role: 'user' });
  const system = adapter.push({ type: 'TEXT_MESSAGE_START', messageId: 'system-1', role: 'system' });
  const fallback = adapter.push({ type: 'TEXT_MESSAGE_START', messageId: 'assistant-1', role: 'other' });
  const tool = adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'call-1' });

  expect(user[0]).to.deep.nested.include({ 'message.role': 'user' });
  expect(system[0]).to.deep.nested.include({ 'message.role': 'system' });
  expect(fallback[0]).to.deep.nested.include({ 'message.role': 'assistant' });
  expect(tool[0]).to.deep.nested.include({ 'invocation.name': 'tool' });
});

it('ignores events whose required payload is absent or malformed', () => {
  const adapter = new AgUiStreamAdapter();
  const ignored = [
    { type: 'RUN_STARTED' },
    { type: 'TEXT_MESSAGE_START' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'message-1', delta: 42 },
    { type: 'TEXT_MESSAGE_END' },
    { type: 'TOOL_CALL_START' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call-1', delta: 42 },
    { type: 'TOOL_CALL_END' },
    { type: 'TOOL_CALL_RESULT' },
    { type: 'STATE_DELTA', delta: { op: 'remove', path: '/value' } },
    { type: 'UNKNOWN_EVENT' },
  ];

  for (const event of ignored) expect(adapter.push(event)).to.deep.equal([]);
});

it('validates malformed events and patch operations without throwing', () => {
  const adapter = new AgUiStreamAdapter();
  for (const event of [
    null,
    [],
    'event',
    { type: 42 },
    { type: 'STATE_DELTA', delta: [null] },
    { type: 'STATE_DELTA', delta: [{}] },
    { type: 'STATE_DELTA', delta: [{ op: 'move', path: '/count' }] },
    { type: 'STATE_DELTA', delta: [{ op: 'replace' }] },
  ]) {
    expect(() => adapter.push(event as never)).not.to.throw();
    expect(adapter.push(event as never)).to.deep.equal([]);
  }
});

it('emits explicit generations and monotonic sequences and resets buffers atomically on run start', () => {
  const adapter = new AgUiStreamAdapter();
  const firstStart = adapter.push({ type: 'RUN_STARTED', runId: 'run-1' });
  adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'old', toolCallName: 'old-tool' });
  adapter.push({ type: 'TOOL_CALL_ARGS', toolCallId: 'old', delta: '{"old":true}' });
  const secondStart = adapter.push({ type: 'RUN_STARTED', runId: 'run-2' });
  const lateResult = adapter.push({ type: 'TOOL_CALL_RESULT', toolCallId: 'old', result: 'late' });

  expect(firstStart[0]).to.deep.include({ generation: 1, sequence: 1 });
  expect(secondStart[0]).to.deep.include({ generation: 2, sequence: 1 });
  expect(lateResult[0]).to.deep.nested.include({
    generation: 2,
    sequence: 2,
    'invocation.name': 'tool',
    'invocation.args': {},
  });
});

it('bounds fragmented tool buffers, emits a limit error, and releases terminal buffers', () => {
  const adapter = new AgUiStreamAdapter({ maxBufferedTools: 1, maxToolArgumentBytes: 8 });
  adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'first', toolCallName: 'search' });
  const tooMany = adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'second', toolCallName: 'other' });
  expect(tooMany[0]).to.deep.include({ type: 'error', code: 'stream_limit_exceeded' });
  expect(adapter.bufferedToolCount).to.equal(1);

  const oversized = adapter.push({ type: 'TOOL_CALL_ARGS', toolCallId: 'first', delta: '{"query":"large"}' });
  expect(oversized[0]).to.deep.include({ type: 'error', code: 'stream_limit_exceeded' });
  expect(adapter.bufferedToolCount).to.equal(0);

  adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'terminal', toolCallName: 'search' });
  adapter.push({ type: 'TOOL_CALL_RESULT', toolCallId: 'terminal', result: { hits: 1 } });
  expect(adapter.bufferedToolCount).to.equal(0);

  adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'run-terminal', toolCallName: 'search' });
  adapter.push({ type: 'RUN_FINISHED', runId: 'run-1' });
  expect(adapter.bufferedToolCount).to.equal(0);
});

it('recursively snapshots provider payloads before returning adapted events', () => {
  const adapter = new AgUiStreamAdapter();
  const snapshot = { nested: { value: 'original' } };
  const result = { nested: { value: 'original' } };
  const snapshotEvents = adapter.push({ type: 'STATE_SNAPSHOT', snapshot });
  adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'call', toolCallName: 'search' });
  const resultEvents = adapter.push({ type: 'TOOL_CALL_RESULT', toolCallId: 'call', result });
  snapshot.nested.value = 'mutated';
  result.nested.value = 'mutated';

  expect(snapshotEvents[0]).to.deep.nested.include({ 'snapshot.nested.value': 'original' });
  expect(resultEvents[0]).to.deep.nested.include({ 'invocation.result.nested.value': 'original' });
  expect(adapter.push({ type: 'STATE_SNAPSHOT', snapshot: { callback: () => undefined } })[0]).to.deep.include({
    type: 'error',
    code: 'invalid_provider_event',
  });
});

it('fails closed for hostile event descriptors and configured text limits', () => {
  const adapter = new AgUiStreamAdapter({ maxTextDeltaCharacters: 4 });
  const hostile = new Proxy({ type: 'RUN_STARTED' }, {
    getOwnPropertyDescriptor: () => {
      throw new Error('blocked');
    },
  });

  expect(adapter.push(hostile)).to.deep.equal([]);
  expect(adapter.push({
    type: 'TEXT_MESSAGE_CONTENT',
    messageId: 'message-1',
    delta: 'exceeds',
  })[0]).to.deep.include({ type: 'error', code: 'stream_limit_exceeded' });
});

it('does not allocate an out-of-order argument buffer after reaching the tool limit', () => {
  const adapter = new AgUiStreamAdapter({ maxBufferedTools: 1 });
  adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'first' });

  expect(adapter.push({
    type: 'TOOL_CALL_ARGS',
    toolCallId: 'second',
    delta: '{}',
  })[0]).to.deep.include({ type: 'error', code: 'stream_limit_exceeded' });
  expect(adapter.push({ type: 'STATE_SNAPSHOT' })).to.deep.equal([]);
});

it('maps snapshot-budget failures to stream limits and omits absent optional payloads', () => {
  const limited = new AgUiStreamAdapter({ maxNodes: 1 });
  expect(limited.push({ type: 'RUN_STARTED', runId: 'run-1' })[0]).to.deep.include({
    type: 'error',
    code: 'stream_limit_exceeded',
  });

  const adapter = new AgUiStreamAdapter();
  expect(adapter.push({ type: 'RUN_FINISHED' })[0]).not.to.have.property('runId');
  expect(adapter.push({ type: 'TOOL_CALL_RESULT', toolCallId: 'missing' })[0])
    .not.to.have.nested.property('invocation.result');
  expect(adapter.push({ type: 'MESSAGES_SNAPSHOT' })[0]).to.deep.include({
    type: 'messages-snapshot',
    messages: [],
  });
});

it('rejects an event whose snapshotted type differs from its inspected type', () => {
  const target = { type: 'RUN_STARTED', runId: 'run-1' };
  let typeReads = 0;
  const unstable = new Proxy(target, {
    getOwnPropertyDescriptor(source, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
      if (key !== 'type' || !descriptor) return descriptor;
      typeReads += 1;
      return { ...descriptor, value: typeReads === 1 ? 'RUN_STARTED' : 'RUN_FINISHED' };
    },
  });

  expect(new AgUiStreamAdapter().push(unstable)).to.deep.equal([]);
});
