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

it('ignores run, tool and snapshot events whose optional fields have the wrong type, and maps the well-typed forms', () => {
  const adapter = new AgUiStreamAdapter();
  for (const event of [
    { type: 'RUN_FINISHED', runId: 42 },
    { type: 'RUN_ERROR', message: 42 },
    { type: 'RUN_ERROR', code: 42 },
    { type: 'RUN_ERROR', runId: 42 },
    { type: 'TOOL_CALL_START', toolCallId: 'call-1', toolCallName: 42 },
    { type: 'MESSAGES_SNAPSHOT', messages: 'not an array' },
  ]) {
    expect(adapter.push(event), JSON.stringify(event)).to.deep.equal([]);
  }
  expect(adapter.push({ type: 'RUN_FINISHED', runId: 'run-1' })).to.have.lengthOf(1);
  expect(adapter.push({ type: 'RUN_ERROR', message: 'Failed', code: 'bad', runId: 'run-1' })).to.have.lengthOf(2);
  expect(adapter.push({ type: 'TOOL_CALL_START', toolCallId: 'call-1', toolCallName: 'search' })).to.have.lengthOf(1);
  expect(adapter.push({ type: 'MESSAGES_SNAPSHOT', messages: [] })).to.have.lengthOf(1);
});

it('keeps the previous tool arguments when the parsed argument object exceeds the snapshot budget', () => {
  const wide = `{"items":[${Array.from({ length: 15 }, (_, index) => index).join(',')}]}`;
  const limited = new AgUiStreamAdapter({ maxNodes: 12 });
  limited.push({ type: 'TOOL_CALL_START', toolCallId: 'call-1', toolCallName: 'search' });
  const rejected = limited.push({ type: 'TOOL_CALL_ARGS', toolCallId: 'call-1', delta: wide });
  expect(rejected[0]).to.deep.nested.include({ 'invocation.args': {} });

  const unrestricted = new AgUiStreamAdapter();
  unrestricted.push({ type: 'TOOL_CALL_START', toolCallId: 'call-1', toolCallName: 'search' });
  const accepted = unrestricted.push({ type: 'TOOL_CALL_ARGS', toolCallId: 'call-1', delta: wide });
  const tool = accepted[0];
  expect(tool?.type).to.equal('tool-upsert');
  if (tool?.type !== 'tool-upsert') throw new Error('Expected a tool argument update');
  expect(tool.invocation.args).to.deep.equal({ items: Array.from({ length: 15 }, (_, index) => index) });
});

it('maps visible reasoning into complete reasoning parts without exposing phase or encrypted payloads', () => {
  const adapter = new AgUiStreamAdapter();
  const events = [
    ...adapter.push({ type: 'REASONING_MESSAGE_START', eventId: 'r1', messageId: 'reason-1', role: 'reasoning' }),
    ...adapter.push({ type: 'REASONING_MESSAGE_CONTENT', eventId: 'r2', messageId: 'reason-1', delta: 'Checking ' }),
    ...adapter.push({ type: 'REASONING_MESSAGE_CONTENT', eventId: 'r3', messageId: 'reason-1', delta: 'sources' }),
    ...adapter.push({ type: 'REASONING_MESSAGE_END', eventId: 'r4', messageId: 'reason-1' }),
  ];
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);
  expect(state.messages).to.have.lengthOf(1);
  expect(state.messages[0]).to.deep.include({ id: 'reason-1', role: 'assistant', status: 'sent' });
  expect(state.messages[0]?.parts).to.deep.equal([
    { id: 'reason-1:reasoning', type: 'reasoning', text: 'Checking sources', state: 'complete' },
  ]);
  expect(reduceAgentStreamEvents(state, events)).to.equal(state);
});

it('maps activity snapshots and deltas to one named data part and honors replace false', () => {
  const adapter = new AgUiStreamAdapter();
  const events = adapter.push({
    type: 'ACTIVITY_SNAPSHOT', eventId: 'a1', messageId: 'plan-1', activityType: 'PLAN', content: { steps: ['search'] },
  });
  expect(adapter.push({
    type: 'ACTIVITY_SNAPSHOT', messageId: 'plan-1', activityType: 'PLAN', content: { steps: ['ignored'] }, replace: false,
  })).to.deep.equal([]);
  events.push(...adapter.push({
    type: 'ACTIVITY_DELTA', eventId: 'a2', messageId: 'plan-1', activityType: 'PLAN',
    patch: [{ op: 'add', path: '/steps/-', value: 'summarize' }],
  }));
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);
  expect(state.messages).to.have.lengthOf(1);
  expect(state.messages[0]?.parts).to.deep.equal([
    { id: 'plan-1:activity', type: 'data', name: 'PLAN', data: { steps: ['search', 'summarize'] }, state: 'complete' },
  ]);
});

it('does not let provider or emitted activity payloads mutate later activity patches', () => {
  const adapter = new AgUiStreamAdapter();
  const content = { nested: { value: 'original' }, count: 1 };
  const events = adapter.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'a1', activityType: 'PLAN', content });
  content.nested.value = 'provider mutation';
  const first = events[0];
  if (first?.type !== 'message-part-upsert' || first.part.type !== 'data') throw new Error('Expected activity part');
  (first.part.data as typeof content).nested.value = 'consumer mutation';
  const patched = adapter.push({
    type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'PLAN',
    patch: [{ op: 'replace', path: '/count', value: 2 }],
  });
  expect(patched[0]).to.deep.nested.include({ 'part.data.nested.value': 'original', 'part.data.count': 2 });
});

it('rejects malformed activity and reasoning events without consuming a cursor', () => {
  const adapter = new AgUiStreamAdapter();
  for (const event of [
    { type: 'REASONING_MESSAGE_START' },
    { type: 'REASONING_MESSAGE_CONTENT', messageId: 'r1', delta: 1 },
    { type: 'REASONING_MESSAGE_END' },
    { type: 'ACTIVITY_SNAPSHOT', activityType: 'PLAN', content: {} },
    { type: 'ACTIVITY_SNAPSHOT', messageId: 'a1', content: {} },
    { type: 'ACTIVITY_SNAPSHOT', messageId: 'a1', activityType: 'PLAN', content: [] },
    { type: 'ACTIVITY_SNAPSHOT', messageId: 'a1', activityType: 'PLAN', content: {}, replace: 'false' },
    { type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'PLAN', patch: [] },
  ]) expect(adapter.push(event), JSON.stringify(event)).to.deep.equal([]);
  expect(adapter.push({ type: 'TEXT_MESSAGE_START', messageId: 'm1' })[0]).to.include({ sequence: 1 });
});

it('routes custom events only through a host-selected named data part', () => {
  const value = { rows: [{ label: 'original' }], action: 'delete' };
  const adapter = new AgUiStreamAdapter({}, {
    customEventTarget: ({ name }) => name === 'table' ? { messageId: 'answer', partId: 'table-result' } : null,
  });
  const events = [
    ...adapter.push({ type: 'TEXT_MESSAGE_START', messageId: 'answer' }),
    ...adapter.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'answer', delta: 'Results' }),
    ...adapter.push({ type: 'CUSTOM', eventId: 'custom-1', name: 'table', value }),
  ];
  value.rows[0]!.label = 'mutated';
  expect(adapter.push({ type: 'CUSTOM', name: 'unhandled', value: {} })).to.deep.equal([]);
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);
  expect(state.messages).to.have.lengthOf(1);
  expect(state.messages[0]?.parts).to.have.lengthOf(2);
  expect(state.messages[0]?.parts?.[1]).to.deep.equal({
    id: 'table-result', type: 'data', name: 'table',
    data: { rows: [{ label: 'original' }], action: 'delete' }, state: 'complete',
  });
  expect(reduceAgentStreamEvents(state, events)).to.equal(state);
  const replacement = adapter.push({ type: 'CUSTOM', name: 'table', value: null });
  const replaced = reduceAgentStreamEvents(state, replacement);
  expect(replaced.messages[0]?.parts).to.have.lengthOf(2);
  expect(replaced.messages[0]?.parts?.[1]).to.deep.include({ data: null });
});

it('ignores custom events by default and rejects malformed or unsafe routing results', () => {
  expect(new AgUiStreamAdapter().push({ type: 'CUSTOM', name: 'table', value: {} })).to.deep.equal([]);
  const adapter = new AgUiStreamAdapter({}, { customEventTarget: () => ({ messageId: 'm1', partId: 'p1' }) });
  for (const event of [
    { type: 'CUSTOM', value: {} },
    { type: 'CUSTOM', name: '', value: {} },
    { type: 'CUSTOM', name: 'table' },
  ]) expect(adapter.push(event)).to.deep.equal([]);
  const invalid = new AgUiStreamAdapter({}, { customEventTarget: () => ({ messageId: '', partId: 'p1' }) });
  expect(invalid.push({ type: 'CUSTOM', name: 'table', value: {} })).to.deep.equal([]);
  const throwing = new AgUiStreamAdapter({}, { customEventTarget: () => { throw new Error('private detail'); } });
  const failure = throwing.push({ type: 'CUSTOM', name: 'table', value: {} });
  expect(failure[0]).to.include({ type: 'error', code: 'invalid_provider_event', message: 'Custom event routing failed.' });
  const mutated = new AgUiStreamAdapter({}, {
    customEventTarget: (event) => {
      (event.value as Record<string, unknown>)['unsafe'] = () => undefined;
      return { messageId: 'm1', partId: 'p1' };
    },
  });
  expect(mutated.push({ type: 'CUSTOM', name: 'table', value: {} })[0])
    .to.include({ type: 'error', code: 'invalid_provider_event' });
});

it('protects activity identities from text and reasoning collisions in either arrival order', () => {
  const adapter = new AgUiStreamAdapter();
  adapter.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'a1', activityType: 'PLAN', content: {} });
  for (const type of ['TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END',
    'REASONING_MESSAGE_START', 'REASONING_MESSAGE_CONTENT', 'REASONING_MESSAGE_END']) {
    expect(adapter.push({ type, messageId: 'a1', delta: 'collision' }), type).to.deep.equal([]);
  }
  adapter.push({ type: 'TEXT_MESSAGE_START', messageId: 'm1' });
  expect(adapter.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'm1', activityType: 'PLAN', content: {} })).to.deep.equal([]);
  expect(adapter.push({ type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'SEARCH', patch: [] })).to.deep.equal([]);
  expect(adapter.push({ type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'PLAN',
    patch: [{ op: 'add', path: '/__proto__/unsafe', value: true }] })).to.deep.equal([]);
  expect(adapter.push({ type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'PLAN',
    patch: [{ op: 'replace', path: '', value: null }] })).to.deep.equal([]);
});

it('bounds message identities and total retained activity bytes and releases state on every run boundary', () => {
  const limited = new AgUiStreamAdapter({ maxBufferedMessages: 1, maxTextDeltaCharacters: 4 });
  limited.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'a1', activityType: 'PLAN', content: {} });
  expect(limited.push({ type: 'TEXT_MESSAGE_START', messageId: 'm1' })[0])
    .to.include({ type: 'error', code: 'stream_limit_exceeded' });
  limited.reset();
  expect(limited.push({ type: 'TEXT_MESSAGE_START', messageId: 'm1' })[0]).to.include({ generation: 1, sequence: 2 });
  expect(limited.push({ type: 'REASONING_MESSAGE_CONTENT', messageId: 'r1', delta: 'large' })[0])
    .to.include({ type: 'error', code: 'stream_limit_exceeded' });

  const bytes = new AgUiStreamAdapter({ maxBytes: 320 });
  for (const messageId of ['a1', 'a2']) {
    expect(bytes.push({ type: 'ACTIVITY_SNAPSHOT', messageId, activityType: 'PLAN', content: { items: ['x'.repeat(100)] } })[0]?.type)
      .to.equal('message-part-upsert');
  }
  expect(bytes.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'a3', activityType: 'PLAN', content: { items: ['x'.repeat(100)] } })[0])
    .to.include({ type: 'error', code: 'stream_limit_exceeded' });
  for (const boundary of [{ type: 'RUN_FINISHED' }, { type: 'RUN_ERROR' }, { type: 'RUN_STARTED', runId: 'next' }]) {
    bytes.push(boundary);
    expect(bytes.push({ type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'PLAN', patch: [] })).to.deep.equal([]);
    expect(bytes.push({ type: 'ACTIVITY_SNAPSHOT', messageId: 'a1', activityType: 'PLAN', content: {} })).to.have.lengthOf(1);
  }
});

it('maps reasoning and activity history and replaces the activity patch baseline on message snapshots', () => {
  const adapter = new AgUiStreamAdapter();
  const events = adapter.push({ type: 'MESSAGES_SNAPSHOT', messages: [
    { id: 'r1', role: 'reasoning', content: 'Summary' },
    { id: 'a1', role: 'activity', activityType: 'PLAN', content: { count: 1 } },
    { id: 'invalid', role: 'activity', activityType: 'PLAN', content: [] },
  ] });
  events.push(...adapter.push({ type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'PLAN',
    patch: [{ op: 'replace', path: '/count', value: 2 }] }));
  const state = reduceAgentStreamEvents(createAgentStreamState(), events);
  expect(state.messages).to.have.lengthOf(2);
  expect(state.messages[0]?.parts?.[0]).to.include({ type: 'reasoning', text: 'Summary' });
  expect(state.messages[1]?.parts?.[0]).to.deep.include({ type: 'data', name: 'PLAN', data: { count: 2 } });
  adapter.push({ type: 'MESSAGES_SNAPSHOT', messages: [] });
  expect(adapter.push({ type: 'ACTIVITY_DELTA', messageId: 'a1', activityType: 'PLAN', patch: [] })).to.deep.equal([]);
});

it('explicitly ignores protocol events without a neutral rendering contract and keeps cursors unchanged', () => {
  const adapter = new AgUiStreamAdapter();
  const ignored = [
    { type: 'REASONING_START', messageId: 'r1' },
    { type: 'REASONING_END', messageId: 'r1' },
    { type: 'REASONING_ENCRYPTED_VALUE', subtype: 'message', entityId: 'r1', encryptedValue: 'opaque' },
    { type: 'RAW', event: { payload: true }, source: 'provider' },
    { type: 'STEP_STARTED', stepName: 'search' },
    { type: 'STEP_FINISHED', stepName: 'search' },
    { type: 'SUBAGENT_STARTED', subagentRunId: 's1', name: 'research' },
    { type: 'SUBAGENT_FINISHED', subagentRunId: 's1' },
    { type: 'SUBAGENT_ERROR', subagentRunId: 's1', message: 'Failed' },
    { type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'Expand upstream' },
    { type: 'REASONING_MESSAGE_CHUNK', messageId: 'r1', delta: 'Expand upstream' },
    { type: 'TOOL_CALL_CHUNK', toolCallId: 't1', toolCallName: 'search', delta: '{}' },
    ...['THINKING_START', 'THINKING_END', 'THINKING_TEXT_MESSAGE_START',
      'THINKING_TEXT_MESSAGE_CONTENT', 'THINKING_TEXT_MESSAGE_END'].map((type) => ({ type, messageId: 'r1', delta: 'old' })),
    { type: 'CUSTOM', name: 'not-opted-in', value: {} },
    { type: 'UNKNOWN_EVENT', value: {} },
  ];
  for (const event of ignored) expect(adapter.push(event), event.type).to.deep.equal([]);
  expect(adapter.push({ type: 'TEXT_MESSAGE_START', messageId: 'm1' })[0]).to.include({ sequence: 1 });
});
