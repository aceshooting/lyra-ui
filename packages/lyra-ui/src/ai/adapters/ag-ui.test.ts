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
