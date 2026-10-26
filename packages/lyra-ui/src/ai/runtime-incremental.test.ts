import { expect } from '@open-wc/testing';
import { createAgentStreamState, reduceAgentStream, type AgentStreamLimits, type AgentStreamState } from './runtime.js';
import { snapshotProviderValue } from './snapshot.js';
import type { ChatMessage } from './types.js';

function append(state: AgentStreamState, delta: string, partId = 'text'): AgentStreamState {
  return reduceAgentStream(state, {
    type: 'message-part-delta', generation: state.generation, sequence: state.cursor + 1,
    messageId: 'answer', partId, partType: 'text', delta,
  });
}

function start(message: ChatMessage, limits: Partial<AgentStreamLimits> = {}): AgentStreamState {
  return reduceAgentStream(createAgentStreamState(limits), {
    type: 'message-start', generation: 0, sequence: 1, message,
  });
}

function bytes(value: unknown): number {
  const snapshot = snapshotProviderValue(value);
  if (!snapshot.ok) throw new Error('Invalid byte-count fixture');
  return snapshot.bytes;
}

describe('incremental text deltas', () => {
  it('shares untouched parts and message fields while owning incoming provider data', () => {
    const message: ChatMessage = {
      id: 'answer', role: 'assistant', metadata: { context: ['retained'] },
      attachments: [{ id: 'doc', name: 'Reference' }],
      parts: [
        { id: 'text', type: 'text', text: 'Before', metadata: { discarded: true } },
        { id: 'data', type: 'data', data: { rows: [1, 2, 3] } },
      ],
    };
    const initial = start(message);
    const next = append(initial, ' after');
    expect(next.error).to.equal(undefined);
    expect(next.messages === initial.messages).to.equal(false);
    expect(next.messages[0] === initial.messages[0]).to.equal(false);
    expect(next.messages[0]?.parts === initial.messages[0]?.parts).to.equal(false);
    expect(next.messages[0]?.parts?.[1] === initial.messages[0]?.parts?.[1]).to.equal(true);
    expect(next.messages[0]?.metadata === initial.messages[0]?.metadata).to.equal(true);
    expect(next.messages[0]?.attachments === initial.messages[0]?.attachments).to.equal(true);
    expect(next.messages[0]?.metadata === message.metadata).to.equal(false);
    expect(next.messages[0]?.parts?.[0]).to.deep.equal({ id: 'text', type: 'text', text: 'Before after', state: 'streaming' });
    expect(initial.messages[0]?.parts?.[0]).to.deep.include({ text: 'Before', metadata: { discarded: true } });
    expect(next.tools === initial.tools).to.equal(true);
    expect(next.sharedState === initial.sharedState).to.equal(true);
  });

  it('does not encode accumulated text or retained payload while appending deltas', () => {
    const payload = 'retained'.repeat(4_000);
    const initial = start({
      id: 'answer', role: 'assistant', metadata: { payload },
      parts: [{ id: 'text', type: 'text', text: payload }],
    });
    const encode = TextEncoder.prototype.encode;
    let largestEncodedString = 0;
    TextEncoder.prototype.encode = function (this: TextEncoder, value?: string): Uint8Array<ArrayBuffer> {
      largestEncodedString = Math.max(largestEncodedString, value?.length ?? 0);
      return encode.call(this, value);
    };
    let next: AgentStreamState;
    try {
      next = append(append(initial, '\ud83d'), '\ude00');
    } finally {
      TextEncoder.prototype.encode = encode;
    }
    expect(next.error).to.equal(undefined);
    expect(next.messages[0]?.parts?.[0]).to.deep.include({ text: `${payload}😀` });
    expect(largestEncodedString).to.be.lessThan(100);
  });

  it('charges split surrogate pairs exactly and preserves both branches of an older state', () => {
    const message: ChatMessage = {
      id: 'answer', role: 'assistant', parts: [{ id: 'text', type: 'text', text: 'x'.repeat(300), state: 'streaming' }],
    };
    const limit = bytes(message) + 4;
    const initial = append(start({
      ...message, parts: [{ id: 'text', type: 'text', text: 'x'.repeat(150), state: 'streaming' }],
    }, { maxRetainedBytes: limit }), 'x'.repeat(150));
    const high = append(initial, '\ud83d');
    const pair = append(high, '\ude00');
    expect(initial.error).to.equal(undefined);
    expect(high.error).to.equal(undefined);
    expect(pair.error).to.equal(undefined);
    expect(append(pair, 'x').error?.code).to.equal('invalid_stream_event');
    expect(append(high, 'x').error).to.equal(undefined);
    expect(append(initial, 'abcd').error).to.equal(undefined);
    expect(pair.messages[0]?.parts?.[0]).to.deep.include({ text: `${'x'.repeat(300)}😀` });
    expect(high.messages[0]?.parts?.[0]).to.deep.include({ text: `${'x'.repeat(300)}\ud83d` });
  });

  it('retains the UTF-16 ceiling even when split surrogates need fewer UTF-8 bytes', () => {
    const initial = start({ id: 'answer', role: 'assistant', parts: [{ id: 'text', type: 'text', text: '' }] }, {
      maxTextCharactersPerPart: 2,
    });
    const high = append(initial, '\ud83d');
    const pair = append(high, '\ude00');
    expect(pair.error).to.equal(undefined);
    const rejected = append(pair, 'a');
    expect(rejected.error?.code).to.equal('stream_limit_exceeded');
    expect(rejected.messages === pair.messages).to.equal(true);
    expect(rejected.cursor).to.equal(pair.cursor + 1);
  });

  it('checks aggregate nodes and depth when introducing structured parts', () => {
    for (const limits of [{ maxSnapshotNodes: 9 }, { maxSnapshotDepth: 2 }]) {
      const initial = start({ id: 'answer', role: 'assistant', text: 'legacy' }, limits);
      expect(initial.error).to.equal(undefined);
      const next = append(initial, 'new');
      expect(next.error?.code).to.equal('invalid_stream_event');
      expect(next.messages === initial.messages).to.equal(true);
      expect(initial.messages[0]?.parts).to.equal(undefined);
    }
  });

  it('re-owns externally restored messages before trusting incremental metrics', () => {
    const message: ChatMessage = { id: 'answer', role: 'assistant', metadata: { entries: ['original'] }, parts: [] };
    const restored = { ...createAgentStreamState(), messages: [message] };
    const next = append(restored, 'accepted');
    expect(next.error).to.equal(undefined);
    expect(next.messages[0]?.metadata === message.metadata).to.equal(false);
    const invalid = {
      ...createAgentStreamState(),
      messages: [{ ...message, metadata: { value: () => 'unsafe' } }],
    } as unknown as AgentStreamState;
    expect(append(invalid, 'rejected').error?.code).to.equal('invalid_stream_event');
  });

  it('replaces cached accounting after snapshots and upserts, and resets it for a new generation', () => {
    let state = start({ id: 'answer', role: 'assistant', parts: [{ id: 'text', type: 'text', text: '\ud83d' }] });
    state = reduceAgentStream(state, { type: 'messages-snapshot', generation: 0, sequence: 2, messages: [
      { id: 'answer', role: 'assistant', parts: [{ id: 'text', type: 'reasoning', text: 'replacement' }] },
    ] });
    state = append(state, '\ude00');
    expect(state.messages[0]?.parts?.[0]).to.deep.include({ text: 'replacement\ude00', type: 'text' });
    state = reduceAgentStream(state, {
      type: 'message-part-upsert', generation: 0, sequence: state.cursor + 1, messageId: 'answer',
      part: { id: 'text', type: 'text', text: '\ud83d' },
    });
    state = append(state, '\ude00');
    expect(state.messages[0]?.parts?.[0]).to.deep.include({ text: '😀' });
    const restarted = reduceAgentStream(state, { type: 'run-start', generation: 1, sequence: 1, runId: 'next' });
    const fresh = append(restarted, 'new');
    expect(fresh.error).to.equal(undefined);
    expect(fresh.messages[0]?.parts?.[0]).to.deep.include({ text: 'new' });
    expect(reduceAgentStream(fresh, {
      type: 'message-part-delta', generation: 0, sequence: 100, messageId: 'answer', partId: 'text', partType: 'text', delta: 'stale',
    }) === fresh).to.equal(true);
    expect(reduceAgentStream(fresh, {
      type: 'message-part-delta', generation: 1, sequence: fresh.cursor, messageId: 'answer', partId: 'text', partType: 'text', delta: 'replayed',
    }) === fresh).to.equal(true);
  });
});
