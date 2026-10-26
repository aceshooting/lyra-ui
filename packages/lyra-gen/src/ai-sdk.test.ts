import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUIMessageStream, readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai';
import { adaptAiSdkMessage, type MessagePart } from '@aceshooting/lyra-ui/ai';
import { LyraGenAiSdkBridge } from './ai-sdk.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = { id: 'sdk-answer', version: '1', components: {
  text: { tag: 'p', text: true, properties: {} },
} };
const view = (revision = 0, text = 'Generated answer'): LyraGenView => ({
  version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'answer-view', revision,
  root: { id: 'summary', type: 'text', text },
});
const bridge = (limits?: Parameters<typeof options>[0]) => new LyraGenAiSdkBridge(options(limits));
function options(limits?: { maxBytes?: number }) {
  return { messageId: 'answer', catalog, dataNames: ['view'], toolNames: ['show_view'], ...(limits ? { limits } : {}) };
}
function data(document: unknown, id = 'view-data'): MessagePart { return { id, type: 'data', name: 'view', data: document, state: 'complete' }; }

// The exact ai devDependency builds snapshots from its public UIMessageChunk API.
async function snapshots(chunks: UIMessageChunk[], previous?: UIMessage): Promise<UIMessage[]> {
  const stream = new ReadableStream<UIMessageChunk>({ start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk);
    controller.close();
  } });
  const output: UIMessage[] = [];
  for await (const message of readUIMessageStream({ stream, message: previous, terminateOnError: true })) output.push(message);
  return output;
}
function adapted(message: UIMessage) {
  const output = adaptAiSdkMessage(message);
  assert.notEqual(output, null, 'Official SDK snapshot must pass the adapter boundary');
  return output!;
}

test('the documented SDK writer and reader route produces an admitted generated data answer', async () => {
  const selected = bridge();
  const stream = createUIMessageStream({ execute: ({ writer }) => {
    writer.write({ type: 'start', messageId: 'answer' });
    writer.write({ type: 'data-view', id: 'view-data', data: view() });
    writer.write({ type: 'finish', finishReason: 'stop' });
  } });
  let result: ReturnType<LyraGenAiSdkBridge['resolve']>;
  for await (const message of readUIMessageStream({ stream, terminateOnError: true })) {
    for (const part of adapted(message).parts ?? []) result = selected.resolve(part);
  }
  assert.equal(result?.status, 'ready');
  assert.equal(result?.document?.surfaceId, 'answer-view');
});

test('pinned SDK data snapshots replace by id and retain existing neighboring mappings', async () => {
  const messages = await snapshots([
    { type: 'start', messageId: 'answer' },
    { type: 'text-start', id: 'prose' },
    { type: 'text-delta', id: 'prose', delta: 'Here is the answer.' },
    { type: 'text-end', id: 'prose' },
    { type: 'data-notification', transient: true, data: { status: 'working' } },
    { type: 'data-view', id: 'view-data', data: view() },
    { type: 'data-view', id: 'view-data', data: view(1, 'Updated answer') },
    { type: 'source-url', sourceId: 'reference', url: 'https://example.com/reference', title: 'Reference' },
    { type: 'finish', finishReason: 'stop' },
  ]);
  const selected = bridge();
  const generated = messages.flatMap(message => adapted(message).parts?.map(part => selected.resolve(part)).filter(part => part !== undefined) ?? []);
  assert.equal(generated.every(part => part.status === 'ready'), true);
  const final = adapted(messages.at(-1)!);
  assert.deepEqual(final.parts?.map(part => part.type), ['text', 'data', 'citation']);
  assert.equal(final.parts?.[0]?.type === 'text' && final.parts[0].text, 'Here is the answer.');
  assert.equal(final.parts?.[1]?.id, 'view-data');
  assert.equal(final.parts?.[1]?.state, 'complete');
  assert.equal(generated.at(-1)?.document?.root.text, 'Updated answer');
  assert.equal(adaptAiSdkMessage(messages.at(-1), { maxBytes: 16 }), null);
});

test('pinned SDK streamed tool input stays inert until input-available and keeps its invocation identity', async () => {
  const document = view();
  const source = JSON.stringify(document);
  const messages = await snapshots([
    { type: 'start', messageId: 'answer' },
    { type: 'tool-input-start', toolCallId: 'view-call', toolName: 'show_view' },
    { type: 'tool-input-delta', toolCallId: 'view-call', inputTextDelta: source.slice(0, 80) },
    { type: 'tool-input-delta', toolCallId: 'view-call', inputTextDelta: source.slice(80) },
    { type: 'tool-input-available', toolCallId: 'view-call', toolName: 'show_view', input: document },
    { type: 'tool-output-available', toolCallId: 'view-call', output: { accepted: true } },
    { type: 'finish', finishReason: 'stop' },
  ]);
  const selected = bridge();
  const calls = messages.map(message => adapted(message).parts?.find(part => part.type === 'tool-call')).filter(part => part !== undefined);
  assert.equal(new Set(calls.map(part => part.id)).size, 1);
  let safe: LyraGenView | undefined;
  for (const call of calls) {
    const result = selected.resolve(call)!;
    if (call.metadata?.['aiSdkInputState'] === 'input-streaming') {
      assert.equal(result.status, 'loading');
      assert.equal(result.document, undefined);
    } else {
      assert.equal(result.status, 'ready');
      if (safe) assert.equal(result.document, safe);
      safe = result.document;
    }
  }
  assert.equal(safe?.root.text, 'Generated answer');
  const firstToolMessage = messages.find(message => message.parts.some(part => part.type === 'tool-show_view'));
  assert.deepEqual(adapted(firstToolMessage!).parts?.map(part => part.type), ['tool-call']);
  const final = adapted(messages.at(-1)!);
  assert.deepEqual(final.parts?.map(part => part.type), ['tool-call', 'tool-result']);
  assert.equal(final.parts?.[1]?.type === 'tool-result' && final.parts[1].invocationId, 'view-call');
});

test('pinned SDK resumes persisted partial JSON tool input without admitting unfinished controls', async () => {
  const document = view();
  const source = JSON.stringify(document);
  for (const dynamic of [false, true]) {
    const selected = bridge();
    const first = await snapshots([
      { type: 'start', messageId: 'answer' },
      { type: 'tool-input-start', toolCallId: 'resumed-view', toolName: 'show_view', dynamic },
      { type: 'tool-input-delta', toolCallId: 'resumed-view', inputTextDelta: source.slice(0, 80) },
    ]);
    const persisted = structuredClone(first.at(-1)!);
    const before = adapted(persisted).parts?.find(part => part.type === 'tool-call');
    assert.notEqual(before, undefined);
    assert.equal(selected.resolve(before!)?.status, 'loading');
    const continued = await snapshots([
      { type: 'tool-input-delta', toolCallId: 'resumed-view', inputTextDelta: source.slice(80) },
      { type: 'tool-input-available', toolCallId: 'resumed-view', toolName: 'show_view', input: document, dynamic },
    ], persisted);
    assert.ok(continued.length > 0, 'The SDK must publish resumed input snapshots');
    let sawStreaming = false;
    let ready = false;
    for (const message of continued) {
      const part = adapted(message).parts?.find(part => part.type === 'tool-call');
      assert.equal(part?.id, before!.id);
      const result = selected.resolve(part!)!;
      if (part?.metadata?.['aiSdkInputState'] === 'input-streaming') {
        sawStreaming = true;
        assert.equal(result.status, 'loading');
        assert.equal(result.document, undefined);
        assert.deepEqual(part.type === 'tool-call' && JSON.parse(JSON.stringify(part.invocation.args)), document);
      } else {
        assert.equal(result.status, 'ready');
        assert.equal(result.document?.surfaceId, document.surfaceId);
        ready = true;
      }
    }
    assert.equal(sawStreaming, true, 'The resumed delta must publish reconstructed streaming input');
    assert.equal(ready, true, 'The complete resumed input must reach the ready state');
  }
});

test('pinned SDK reader separates a new message identity from resumed history', async () => {
  const old = (await snapshots([
    { type: 'start', messageId: 'previous' },
    { type: 'data-view', id: 'old-view', data: view() },
  ])).at(-1)!;
  const nextDocument = { ...view(), surfaceId: 'next-view' };
  const next = await snapshots([
    { type: 'start', messageId: 'next' },
    { type: 'data-view', id: 'next-part', data: nextDocument },
    { type: 'finish', finishReason: 'stop' },
  ], old);
  assert.ok(next.length > 0, 'The SDK must publish the replacement message');
  const message = adapted(next.at(-1)!);
  assert.equal(message.id, 'next');
  assert.deepEqual(message.parts?.map(part => part.id), ['next-part']);
  const selected = new LyraGenAiSdkBridge({ messageId: 'next', catalog, dataNames: ['view'] });
  assert.equal(selected.resolve(message.parts![0]!)?.document?.surfaceId, 'next-view');
});

test('pinned SDK string tool input is rejected instead of being reparsed as a generated view', async () => {
  const messages = await snapshots([
    { type: 'start', messageId: 'answer' },
    { type: 'tool-input-available', toolCallId: 'string-view', toolName: 'show_view', input: JSON.stringify(view()) },
  ]);
  assert.ok(messages.length > 0);
  const call = adapted(messages.at(-1)!).parts?.find(part => part.type === 'tool-call');
  assert.notEqual(call, undefined);
  const result = bridge().resolve(call!)!;
  assert.equal(result.status, 'error');
  assert.equal(result.document, undefined);
});

test('pinned dynamic tool snapshots preserve denied and error outcomes without activating input', async () => {
  for (const terminal of [
    { type: 'tool-output-denied' as const, toolCallId: 'dynamic' },
    { type: 'tool-output-error' as const, toolCallId: 'dynamic', errorText: 'Not available' },
  ]) {
    const messages = await snapshots([
      { type: 'start', messageId: 'answer' },
      { type: 'tool-input-start', toolCallId: 'dynamic', toolName: 'show_view', dynamic: true },
      { type: 'tool-input-available', toolCallId: 'dynamic', toolName: 'show_view', input: view(), dynamic: true },
      terminal,
    ]);
    const final = adapted(messages.at(-1)!);
    const call = final.parts?.find(part => part.type === 'tool-call');
    assert.notEqual(call, undefined);
    assert.equal(bridge().resolve(call!)?.status, 'error');
  }
});

test('default selection and unknown neighbors delegate; selected invalid views fail closed', () => {
  const selected = bridge();
  assert.equal(new LyraGenAiSdkBridge({ messageId: 'answer', catalog }).resolve(data(view())), undefined);
  assert.equal(selected.resolve({ id: 'prose', type: 'text', text: 'Keep me' }), undefined);
  assert.equal(selected.resolve({ id: 'other', type: 'data', name: 'unknown', data: view() }), undefined);
  assert.equal(selected.resolve({ id: 'widget', type: 'data', name: 'view', widget: {} }), undefined);
  for (const document of [null, { ...view(), catalog: { id: 'unknown', version: '1' } },
    { ...view(), root: { id: 'script', type: 'script', text: 'unsafe' } },
    JSON.parse('{"__proto__":{"unsafe":true}}')]) {
    const result = selected.resolve(data(document));
    assert.equal(result?.status, 'error');
    assert.equal(result?.document, undefined);
    assert.ok(result!.diagnostics.length > 0);
  }
});

test('unchanged snapshots share validated identity; revisions and interruption retain safe boundaries', () => {
  const selected = bridge();
  const source = view();
  const ready = selected.resolve(data(source))!;
  assert.equal(ready.status, 'ready');
  assert.equal(selected.resolve(data(structuredClone(source)))?.document, ready.document);
  assert.equal(selected.resolve(data(source, 'duplicate-part'))?.diagnostics[0]?.code, 'identity.conflict');
  assert.equal(selected.resolve(data(view(0, 'Conflicting content')))?.status, 'error');
  assert.equal(selected.resolve(data({ ...view(1), surfaceId: 'different' }))?.status, 'error');
  const interrupted = selected.resolve({ ...data(view()), state: 'interrupted', interruption: { resumable: true, reason: 'Reconnect' } });
  assert.equal(interrupted?.status, 'interrupted');
  assert.equal(interrupted?.resumable, true);
  assert.equal(interrupted?.document, ready.document);
  assert.equal(selected.resolve(data(view(1, 'New revision')))?.document?.revision, 1);
  assert.equal(selected.resolve(data(view()))?.status, 'error');
  selected.reset();
  assert.equal(selected.resolve({ ...data(view()), state: 'interrupted' })?.document, undefined);
  assert.equal(selected.resolve(data(view()))?.status, 'ready');
});

test('combined retained content stays bounded and a rejected part cannot displace an admitted one', () => {
  const selected = bridge({ maxBytes: 512 });
  const first = selected.resolve(data(view(0, 'x'.repeat(140)), 'first'));
  assert.equal(first?.status, 'ready');
  const second = selected.resolve(data({ ...view(0, 'y'.repeat(140)), surfaceId: 'second-view' }, 'second'));
  assert.equal(second?.status, 'error');
  assert.equal(second?.diagnostics[0]?.code, 'limit.bytes');
  assert.equal(selected.resolve(data(view(0, 'x'.repeat(140)), 'first'))?.document, first?.document);
});
