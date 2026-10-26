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
async function snapshots(chunks: UIMessageChunk[]): Promise<UIMessage[]> {
  const stream = new ReadableStream<UIMessageChunk>({ start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk);
    controller.close();
  } });
  const output: UIMessage[] = [];
  for await (const message of readUIMessageStream({ stream, terminateOnError: true })) output.push(message);
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
