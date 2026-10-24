import { expect } from '@open-wc/testing';
import { createAgentStreamState, reduceAgentStream } from './runtime.js';
import type { TextMessagePart } from './types.js';

it('updates a legacy plain-body message without introducing an undefined parts property', () => {
  const initial = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start', generation: 0, sequence: 1,
    message: { id: 'message', role: 'assistant', text: 'First draft', metadata: { source: 'notes' } },
  });
  expect(initial.error).to.equal(undefined);
  expect(Object.hasOwn(initial.messages[0]!, 'parts')).to.equal(false);

  const updated = reduceAgentStream(initial, {
    type: 'message-start', generation: 0, sequence: 2,
    message: { id: 'message', role: 'assistant', text: 'Revised draft' },
  });
  expect(updated.error).to.equal(undefined);
  expect(updated.messages).to.deep.equal([
    { id: 'message', role: 'assistant', text: 'Revised draft', metadata: { source: 'notes' } },
  ]);
  expect(Object.hasOwn(updated.messages[0]!, 'parts')).to.equal(false);
  expect(updated.cursor).to.equal(2);
  expect(initial.messages[0]?.text).to.equal('First draft');
  expect(initial.cursor).to.equal(1);
});

it('completes a legacy plain-body message without introducing an undefined parts property', () => {
  const initial = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start', generation: 0, sequence: 1,
    message: { id: 'message', role: 'assistant', text: 'Finished answer' },
  });
  expect(initial.error).to.equal(undefined);
  const completed = reduceAgentStream(initial, {
    type: 'message-complete', generation: 0, sequence: 2, messageId: 'message',
  });
  expect(completed.error).to.equal(undefined);
  expect(completed.messages).to.deep.equal([
    { id: 'message', role: 'assistant', text: 'Finished answer', status: 'sent' },
  ]);
  expect(Object.hasOwn(completed.messages[0]!, 'parts')).to.equal(false);
  expect(completed.cursor).to.equal(2);
  expect(initial.messages[0]?.status).to.equal(undefined);
  expect(initial.cursor).to.equal(1);
});

it('replaces explicitly supplied parts with an owned array and preserves an explicit empty clear', () => {
  const initial = reduceAgentStream(createAgentStreamState(), {
    type: 'message-start', generation: 0, sequence: 1,
    message: { id: 'message', role: 'assistant', parts: [{ id: 'old', type: 'text', text: 'Earlier' }] },
  });
  expect(initial.error).to.equal(undefined);
  const parts: TextMessagePart[] = [{ id: 'new', type: 'text', text: 'Replacement' }];
  const replaced = reduceAgentStream(initial, {
    type: 'message-start', generation: 0, sequence: 2,
    message: { id: 'message', role: 'assistant', parts },
  });
  expect(replaced.error).to.equal(undefined);
  parts[0]!.text = 'Caller mutation';
  parts.push({ id: 'extra', type: 'text', text: 'Caller insertion' });
  expect(replaced.messages[0]?.parts).to.deep.equal([{ id: 'new', type: 'text', text: 'Replacement' }]);
  const cleared = reduceAgentStream(replaced, {
    type: 'message-start', generation: 0, sequence: 3,
    message: { id: 'message', role: 'assistant', parts: [] },
  });
  expect(cleared.error).to.equal(undefined);
  expect(cleared.messages[0]?.parts).to.deep.equal([]);
  expect(Object.hasOwn(cleared.messages[0]!, 'parts')).to.equal(true);
  expect(initial.messages[0]?.parts).to.deep.equal([{ id: 'old', type: 'text', text: 'Earlier' }]);
  expect(replaced.messages[0]?.parts).to.deep.equal([{ id: 'new', type: 'text', text: 'Replacement' }]);
});
