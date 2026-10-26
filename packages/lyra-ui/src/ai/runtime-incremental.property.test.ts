import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { createAgentStreamState, reduceAgentStream, type AgentStreamState } from './runtime.js';
import { createProviderSnapshotBudget, snapshotProviderValue } from './snapshot.js';
import type { ChatMessage } from './types.js';

const utf16Chunk = fc.array(fc.oneof(
  fc.integer({ min: 0, max: 0xffff }),
  fc.constantFrom(0xd83d, 0xde00, 0x61),
), { maxLength: 12 }).map(units => String.fromCharCode(...units));

function messageSnapshot(message: ChatMessage, state: AgentStreamState) {
  return snapshotProviderValue<ChatMessage>(message, createProviderSnapshotBudget({
    maxBytes: state.limits.maxSnapshotBytes,
    maxNodes: state.limits.maxSnapshotNodes,
    maxDepth: state.limits.maxSnapshotDepth,
    maxStringCharacters: Math.max(state.limits.maxTextCharactersPerPart, state.limits.maxStatusMessageCharacters),
  }));
}

it('matches a full snapshot byte oracle for arbitrary UTF-16 chunks and budget rejections', () => {
  fc.assert(fc.property(fc.array(utf16Chunk, { minLength: 20, maxLength: 40 }), chunks => {
    let state = reduceAgentStream(createAgentStreamState({ maxSnapshotBytes: 600, maxRetainedBytes: 700 }), {
      type: 'message-start', generation: 0, sequence: 1,
      message: { id: 'answer', role: 'assistant', parts: [
        { id: 'text', type: 'text', text: 'x'.repeat(250), state: 'streaming', metadata: { removed: 'r'.repeat(30) } },
        { id: 'data', type: 'data', data: { rows: [1, 2] } },
      ] },
    });
    state = reduceAgentStream(state, {
      type: 'tool-upsert', generation: 0, sequence: 2,
      invocation: { id: 'tool', name: 'search', args: {}, status: 'running' },
    });
    expect(state.error).to.equal(undefined);
    const tool = snapshotProviderValue(state.tools[0]);
    if (!tool.ok) throw new Error('Invalid oracle tool');
    for (const delta of chunks) {
      const previous = state.messages[0]!;
      const part = previous.parts![0]!;
      if (part.type !== 'text') throw new Error('Invalid oracle text part');
      const candidate: ChatMessage = {
        ...previous,
        parts: [{ id: 'text', type: 'text', text: part.text + delta, state: 'streaming' }, previous.parts![1]!],
      };
      const snapshot = messageSnapshot(candidate, state);
      const admitted = snapshot.ok && snapshot.bytes + tool.bytes <= state.limits.maxRetainedBytes;
      const next = reduceAgentStream(state, {
        type: 'message-part-delta', generation: 0, sequence: state.cursor + 1,
        messageId: 'answer', partId: 'text', partType: 'text', delta,
      });
      expect(next.cursor).to.equal(state.cursor + 1);
      expect(next.messages === state.messages).to.equal(!admitted);
      if (admitted) {
        expect(next.messages[0]).to.deep.equal(candidate);
        expect(next.messages[0]?.parts?.[1] === previous.parts?.[1]).to.equal(true);
      } else {
        expect(next.error?.code).to.equal(snapshot.ok ? 'stream_limit_exceeded' : 'invalid_stream_event');
      }
      state = next;
    }
  }), propertyRuns());
});
