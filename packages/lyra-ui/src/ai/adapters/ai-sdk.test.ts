import { expect } from '@open-wc/testing';
import { adaptAiSdkMessage } from './ai-sdk.js';

it('maps AI SDK-style ordered parts without requiring the vendor package', () => {
  const message = adaptAiSdkMessage({
    id: 'message-1',
    role: 'assistant',
    metadata: { model: 'example-model' },
    parts: [
      { type: 'reasoning', text: 'Checking the report', state: 'done' },
      { type: 'text', text: 'Revenue increased.' },
      {
        type: 'tool-search',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { query: 'revenue' },
        output: { hits: 2 },
      },
      { type: 'source-document', sourceId: 'doc-1', title: 'Annual report', filename: 'report.pdf' },
      { type: 'data-chart', data: { values: [1, 2, 3] } },
    ],
  });

  expect(message.parts).to.have.lengthOf(6);
  expect(message.parts?.map((part) => part.type)).to.deep.equal([
    'reasoning',
    'text',
    'tool-call',
    'tool-result',
    'citation',
    'data',
  ]);
  expect(message.parts?.[2]).to.deep.include({ type: 'tool-call', state: 'complete' });
  expect(message.metadata).to.deep.equal({ model: 'example-model' });
});

it('falls back safely for malformed roles and part values', () => {
  const message = adaptAiSdkMessage({
    id: 'message-2',
    role: 'unexpected',
    parts: [{ type: 'text', text: 42 }, null, 'bad'],
  });
  expect(message.role).to.equal('assistant');
  expect(message.parts).to.deep.equal([]);
});
