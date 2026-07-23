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

it('maps dynamic and named tool parts across pending, running, success, and error states', () => {
  const message = adaptAiSdkMessage({
    id: 'message-tools',
    role: 'assistant',
    parts: [
      {
        type: 'dynamic-tool',
        toolName: 'weather',
        state: 'approval-requested',
        input: null,
      },
      {
        type: 'tool-search',
        toolCallId: 'call-error',
        state: 'output-error',
        input: { query: 'Lyra' },
        errorText: 'Search failed',
      },
      {
        type: 'tool-calculate',
        toolCallId: 'call-running',
        state: 'input-streaming',
        input: { expression: '1 + 1' },
      },
    ],
  });

  expect(message.parts).to.have.lengthOf(4);
  expect(message.parts?.[0]).to.deep.include({
    id: 'message-tools:tool:0:call',
    type: 'tool-call',
    state: 'streaming',
    invocation: {
      id: 'message-tools:tool:0',
      name: 'weather',
      args: {},
      status: 'pending',
    },
  });
  expect(message.parts?.[1]).to.deep.nested.include({
    type: 'tool-call',
    state: 'error',
    'invocation.status': 'error',
    'invocation.error': 'Search failed',
  });
  expect(message.parts?.[2]).to.deep.include({
    type: 'tool-result',
    state: 'error',
    invocationId: 'call-error',
    name: 'search',
    error: 'Search failed',
  });
  expect(message.parts?.[3]).to.deep.nested.include({
    type: 'tool-call',
    state: 'streaming',
    'invocation.status': 'running',
  });
});

it('maps tool outputs, including falsy result values', () => {
  const message = adaptAiSdkMessage({
    id: 'message-output',
    role: 'assistant',
    parts: [
      {
        type: 'dynamic-tool',
        toolName: 'counter',
        toolCallId: 'call-0',
        state: 'output-available',
        input: [],
        output: 0,
      },
    ],
  });

  expect(message.parts).to.have.lengthOf(2);
  expect(message.parts?.[0]).to.deep.nested.include({
    'invocation.name': 'counter',
    'invocation.status': 'success',
    'invocation.args': {},
  });
  expect(message.parts?.[1]).to.deep.include({
    type: 'tool-result',
    invocationId: 'call-0',
    result: 0,
  });
});

it('maps source and file parts with documented identifier and label fallbacks', () => {
  const message = adaptAiSdkMessage({
    id: 'message-documents',
    role: 'system',
    parts: [
      { type: 'source-url', url: 'https://example.com/source' },
      { type: 'source-document', id: 'source-part', filename: 'report.pdf' },
      {
        type: 'file',
        id: 'attachment-1',
        filename: 'image.png',
        mediaType: 'image/png',
        url: 'blob:preview',
        state: 'done',
      },
      { type: 'file', id: 'attachment-2', name: 'notes.txt' },
    ],
  });

  expect(message.role).to.equal('system');
  expect(message.parts?.[0]).to.deep.nested.include({
    type: 'citation',
    'citation.sourceId': 'message-documents:part:0',
    'citation.label': 'https://example.com/source',
  });
  expect(message.parts?.[1]).to.deep.nested.include({
    'citation.sourceId': 'source-part',
    'citation.label': 'report.pdf',
  });
  expect(message.parts?.[2]).to.deep.include({
    type: 'attachment',
    state: 'complete',
    document: {
      id: 'attachment-1',
      name: 'image.png',
      mimeType: 'image/png',
      uri: 'blob:preview',
    },
  });
  expect(message.parts?.[3]).to.deep.include({
    type: 'attachment',
    state: 'streaming',
    document: {
      id: 'attachment-2',
      name: 'notes.txt',
    },
  });
});

it('drops unknown parts and applies safe fallbacks without disturbing valid neighbors', () => {
  const message = adaptAiSdkMessage({
    id: 'message-mixed',
    role: 'user',
    parts: [
      {},
      { type: 42 },
      { type: 'unknown', value: 'ignored' },
      { type: 'dynamic-tool' },
      { type: 'file' },
      { type: 'text', id: 'valid-text', text: 'Kept', state: 'output-error' },
    ],
  });

  expect(message.role).to.equal('user');
  expect(message.parts).to.have.lengthOf(3);
  expect(message.parts?.map((part) => part.type)).to.deep.equal(['tool-call', 'attachment', 'text']);
  expect(message.parts?.[0]).to.deep.nested.include({
    'invocation.id': 'message-mixed:tool:3',
    'invocation.name': 'tool',
  });
  expect(message.parts?.[1]).to.deep.nested.include({
    'document.id': 'message-mixed:part:4',
    'document.name': 'message-mixed:part:4',
  });
  expect(message.parts?.[2]).to.deep.include({
    id: 'valid-text',
    text: 'Kept',
    state: 'error',
  });
});
