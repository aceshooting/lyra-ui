import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import {
  createAgentStreamState,
  reduceAgentStream,
  reduceAgentStreamEvents,
  type AgentStreamEvent,
} from './runtime.js';

describe('agent stream ownership across accepted events', () => {
  for (const type of ['message-part-upsert', 'message-part-delta'] as const) {
    it(`keeps a legacy plain body when ${type} introduces the first structured part`, () => {
      fc.assert(fc.property(
        fc.string({ maxLength: 40 }), fc.string({ maxLength: 40 }),
        (body, text) => {
          const initial = reduceAgentStream(createAgentStreamState(), {
            type: 'message-start', generation: 0, sequence: 1,
            message: { id: 'message', role: 'assistant', text: body },
          });
          expect(initial.error).to.equal(undefined);
          expect(initial.messages[0]?.parts).to.equal(undefined);
          const event: AgentStreamEvent = type === 'message-part-upsert'
            ? {
                type, generation: 0, sequence: 2, messageId: 'message',
                part: { id: 'part', type: 'text', text, state: 'streaming' },
              }
            : {
                type, generation: 0, sequence: 2, messageId: 'message',
                partId: 'part', partType: 'text', delta: text,
              };
          const next = reduceAgentStream(initial, event);
          expect(next.error).to.equal(undefined);
          expect(next.messages[0]?.text).to.equal(body);
          expect(next.messages[0]?.parts).to.deep.equal([
            { id: 'part', type: 'text', text, state: 'streaming' },
          ]);
          expect(initial.messages[0]?.parts).to.equal(undefined);
          expect(initial.messages[0]?.text).to.equal(body);
        },
      ), propertyRuns());
    });
  }

  it('interrupts and resumes a run containing a plain-body message without adding parts', () => {
    const initial = reduceAgentStreamEvents(createAgentStreamState(), [
      { type: 'run-start', generation: 1, sequence: 1, runId: 'run' },
      {
        type: 'message-start', generation: 1, sequence: 2,
        message: { id: 'message', role: 'assistant', text: 'Earlier response' },
      },
    ]);
    const interrupted = reduceAgentStream(initial, {
      type: 'stream-interrupt', generation: 1, sequence: 3, runId: 'run',
      interruption: { resumable: true, reason: 'Connection paused' },
    });
    expect(interrupted.error).to.equal(undefined);
    expect(interrupted.interruption).to.deep.equal({ resumable: true, reason: 'Connection paused' });
    expect(interrupted.messages).to.deep.equal(initial.messages);
    expect(Object.hasOwn(interrupted.messages[0]!, 'parts')).to.equal(false);
    const resumed = reduceAgentStream(interrupted, {
      type: 'stream-resume', generation: 1, sequence: 4, runId: 'run',
    });
    expect(resumed.error).to.equal(undefined);
    expect(resumed.interruption).to.equal(undefined);
    expect(resumed.messages).to.deep.equal(initial.messages);
    expect(Object.hasOwn(resumed.messages[0]!, 'parts')).to.equal(false);
    expect(initial.cursor).to.equal(2);
  });

  it('ignores an equal-generation reset replay and accepts a later reset in that generation', () => {
    const initial = reduceAgentStream(createAgentStreamState(), {
      type: 'message-start', generation: 0, sequence: 2,
      message: { id: 'message', role: 'assistant', text: 'Retained' },
    });
    expect(initial.error).to.equal(undefined);
    for (const sequence of [1, 2]) {
      expect(reduceAgentStream(initial, { type: 'reset', generation: 0, sequence }) === initial)
        .to.equal(true);
    }
    const reset = reduceAgentStream(initial, { type: 'reset', generation: 0, sequence: 3 });
    expect(reset.cursor).to.equal(3);
    expect(reset.generation).to.equal(0);
    expect(reset.messages).to.deep.equal([]);
    expect(reset.status).to.deep.equal({ kind: 'idle' });
    expect(initial.messages).to.have.length(1);
  });

  it('rejects malformed per-part interruption records without replacing the accepted part', () => {
    fc.assert(fc.property(
      fc.string({ maxLength: 40 }),
      fc.constantFrom(null, {}, { resumable: 'yes' }, { resumable: true, reason: 4 }),
      (text, interruption) => {
        const initial = reduceAgentStream(createAgentStreamState(), {
          type: 'message-part-upsert', generation: 0, sequence: 1, messageId: 'message',
          part: { id: 'part', type: 'text', text, interruption: { resumable: true } },
        });
        expect(initial.error).to.equal(undefined);
        const next = reduceAgentStream(initial, {
          type: 'message-part-upsert', generation: 0, sequence: 2, messageId: 'message',
          part: { id: 'part', type: 'text', text: 'Replacement', interruption },
        } as unknown as AgentStreamEvent);
        expect(next.error?.code).to.equal('invalid_stream_event');
        expect(next.cursor).to.equal(2);
        expect(next.messages === initial.messages).to.equal(true);
        expect(next.messages[0]?.parts?.[0]).to.deep.include({ text });
      },
    ), propertyRuns());
  });

  const payload = 'x'.repeat(600);
  const limits = { maxSnapshotBytes: 1_024 };
  const growthEvents: AgentStreamEvent[] = [
    {
      type: 'message-start', generation: 0, sequence: 2,
      message: { id: 'message', role: 'assistant', text: payload },
    },
    {
      type: 'message-part-upsert', generation: 0, sequence: 2, messageId: 'message',
      part: { id: 'part', type: 'text', text: payload },
    },
    {
      type: 'message-part-delta', generation: 0, sequence: 2, messageId: 'message',
      partId: 'part', partType: 'text', delta: payload,
    },
  ];
  for (const event of growthEvents) {
    it(`rejects ${event.type} atomically when retained metadata and new content exceed one message budget`, () => {
      const initial = reduceAgentStream(createAgentStreamState(limits), {
        type: 'message-start', generation: 0, sequence: 1,
        message: { id: 'message', role: 'assistant', parts: [], metadata: { context: payload } },
      });
      expect(initial.error).to.equal(undefined);
      expect(reduceAgentStream(createAgentStreamState(limits), event).error,
        'the incoming content fits when no earlier metadata is retained').to.equal(undefined);
      const rejected = reduceAgentStream(initial, event);
      expect(rejected.error?.code).to.equal('invalid_stream_event');
      expect(rejected.messages === initial.messages).to.equal(true);
      expect(rejected.messages[0]?.metadata).to.deep.equal({ context: payload });
      expect(rejected.messages[0]?.parts).to.deep.equal([]);
      expect(rejected.cursor).to.equal(2);
      expect(initial.cursor).to.equal(1);
    });
  }

  it('retains an earlier tool result when merging a valid argument update exceeds the snapshot budget', () => {
    const initial = reduceAgentStream(createAgentStreamState(limits), {
      type: 'tool-upsert', generation: 0, sequence: 1,
      invocation: { id: 'tool', name: 'search', args: {}, status: 'success', result: payload },
    });
    expect(initial.error).to.equal(undefined);
    const event: AgentStreamEvent = {
      type: 'tool-upsert', generation: 0, sequence: 2,
      invocation: { id: 'tool', name: 'search', args: { query: payload }, status: 'running' },
    };
    expect(reduceAgentStream(createAgentStreamState(limits), event).error).to.equal(undefined);
    const rejected = reduceAgentStream(initial, event);
    expect(rejected.error?.code).to.equal('invalid_stream_event');
    expect(rejected.tools === initial.tools).to.equal(true);
    expect(rejected.tools[0]?.args).to.deep.equal({});
    expect(rejected.tools[0]?.result).to.equal(payload);
    expect(rejected.cursor).to.equal(2);
  });

  it('keeps the prior shared state when a valid patch grows the aggregate beyond its snapshot budget', () => {
    const initial = reduceAgentStream(createAgentStreamState(limits), {
      type: 'state-snapshot', generation: 0, sequence: 1, snapshot: { first: payload },
    });
    expect(initial.error).to.equal(undefined);
    const event: AgentStreamEvent = {
      type: 'state-delta', generation: 0, sequence: 2,
      patch: [{ op: 'add', path: '/second', value: payload }],
    };
    const empty = reduceAgentStream(createAgentStreamState(limits), {
      type: 'state-snapshot', generation: 0, sequence: 1, snapshot: {},
    });
    const accepted = reduceAgentStream(empty, event);
    expect(accepted.error).to.equal(undefined);
    expect(accepted.sharedState).to.deep.equal({ second: payload });
    const rejected = reduceAgentStream(initial, event);
    expect(rejected.error?.code).to.equal('stream_limit_exceeded');
    expect(rejected.sharedState === initial.sharedState).to.equal(true);
    expect(rejected.sharedState).to.deep.equal({ first: payload });
    expect(rejected.cursor).to.equal(2);
  });

  it('leaves all streaming parts untouched if copying interruption metadata would exceed a message budget', () => {
    const initial = reduceAgentStreamEvents(createAgentStreamState(limits), [
      { type: 'run-start', generation: 1, sequence: 1, runId: 'run' },
      {
        type: 'message-start', generation: 1, sequence: 2,
        message: {
          id: 'message', role: 'assistant',
          parts: Array.from({ length: 4 }, (_, index) => ({
            id: `part-${index}`, type: 'text' as const, text: 'Accumulated response', state: 'streaming' as const,
          })),
        },
      },
    ]);
    expect(initial.error).to.equal(undefined);
    const accepted = reduceAgentStream(initial, {
      type: 'stream-interrupt', generation: 1, sequence: 3, runId: 'run',
      interruption: { resumable: true, reason: 'Paused' },
    });
    expect(accepted.error).to.equal(undefined);
    expect(accepted.messages[0]?.parts?.map(part => part.state)).to.deep.equal(Array(4).fill('interrupted'));
    const rejected = reduceAgentStream(initial, {
      type: 'stream-interrupt', generation: 1, sequence: 3, runId: 'run',
      interruption: { resumable: true, reason: 'p'.repeat(200) },
    });
    expect(rejected.error?.code).to.equal('stream_limit_exceeded');
    expect(rejected.error?.message).to.equal('Interrupted message exceeds the configured limit.');
    expect(rejected.messages === initial.messages).to.equal(true);
    expect(rejected.messages[0]?.parts?.map(part => part.state)).to.deep.equal(Array(4).fill('streaming'));
    expect(rejected.interruption).to.equal(undefined);
    expect(rejected.cursor).to.equal(3);
  });
});
