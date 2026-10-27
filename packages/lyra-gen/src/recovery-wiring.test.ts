import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LyraGenAiSdkBridge } from './ai-sdk.js';
import { createChatStream, type LyraGenChatOptions } from './chat.js';
import { LYRA_GEN_ISOLATED_TYPE } from './index.js';
import { createJsonViewStream, parseJsonView } from './json-stream.js';
import { completeJsonView } from './recovery.js';
import type { LyraGenCatalog, LyraGenView } from './types.js';

const catalog: LyraGenCatalog = { id: 'wire', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
  badge: { tag: 'span', properties: { tone: { type: 'string', enum: ['a', 'b'] } } },
} };
const document = (badTone: unknown): LyraGenView => ({ version: '1', catalog: { id: 'wire', version: '1' }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'stack', children: [
  { id: 'ok', type: 'text', text: 'Fine' }, { id: 'bad', type: 'badge', props: { tone: badTone } }] } } as unknown as LyraGenView);
const bad = document('zzz');
const source = JSON.stringify(bad);
const strings = { loading: 'Loading', invalid: 'Invalid view', incomplete: 'Retry', sourceUnavailable: 'Gone' };
const markup = '```lyra\n<stack id="root"><text id="ok">Fine</text><badge id="bad" tone="zzz"/></stack>\n```\n';
const chatOptions = (extra: Partial<LyraGenChatOptions> = {}): LyraGenChatOptions => ({ messageId: 'm', surfaceId: 's', catalog, strings, ...extra });

test('the isolation marker type is reachable from the root barrel', () => {
  assert.equal(LYRA_GEN_ISOLATED_TYPE, 'lyra-gen:isolated');
});

test('completeJsonView is strict by default and carries isolations on opt-in', () => {
  assert.equal(completeJsonView(source, catalog).ok, false);
  assert.equal(completeJsonView(source, catalog, { recovery: 'strict' }).ok, false);
  const result = completeJsonView(source, catalog, { recovery: 'isolate' });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.value.completion, 'none');
  assert.deepEqual(result.value.isolated?.map(item => item.nodeId), ['bad']);
  assert.equal(result.value.view.root.children?.[1]?.type, LYRA_GEN_ISOLATED_TYPE);
  const good = completeJsonView(JSON.stringify(document('a')), catalog, { recovery: 'isolate' });
  assert.equal(good.ok && good.value.isolated, undefined);
});

test('completeJsonView keeps isolation through an authorized envelope completion', () => {
  const result = completeJsonView(source.slice(0, -1), catalog, { policy: 'close-envelope-eof', recovery: 'isolate' });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.value.completion, 'closed-envelope');
  assert.deepEqual(result.value.isolated?.map(item => item.nodeId), ['bad']);
  assert.ok(result.diagnostics.some(item => item.code === 'recovery.envelope-closed'));
});

test('JSON stream and batch parse stay strict by default and report isolations on opt-in', () => {
  assert.equal(parseJsonView(source, { catalog }).status, 'error');
  const batch = parseJsonView(source, { catalog, recovery: 'isolate' });
  assert.equal(batch.status, 'complete');
  assert.deepEqual(batch.isolated?.map(item => item.nodeId), ['bad']);
  assert.equal(batch.view?.root.children?.[1]?.type, LYRA_GEN_ISOLATED_TYPE);
  const stream = createJsonViewStream({ catalog, recovery: 'isolate' });
  stream.push(source.slice(0, 40)); stream.push(source.slice(40));
  assert.deepEqual(stream.finish(), batch);
  assert.equal(parseJsonView(JSON.stringify(document('a')), { catalog, recovery: 'isolate' }).isolated, undefined);
});

test('chat: strict default shows the invalid fallback; isolate keeps the island ready and surfaces isolations', () => {
  const strict = createChatStream(chatOptions());
  strict.push(markup);
  assert.equal(strict.finish().islands[0]?.status, 'error');
  assert.equal(strict.snapshot.islands[0]?.isolated, undefined);

  const chat = createChatStream(chatOptions({ recovery: 'isolate' }));
  chat.push(markup);
  const island = chat.finish().islands[0]!;
  assert.equal(island.status, 'ready');
  assert.equal(island.fallback, '');
  assert.deepEqual(island.isolated?.map(item => item.nodeId), ['bad']);
  assert.equal(island.document?.root.children?.[1]?.type, LYRA_GEN_ISOLATED_TYPE);
  assert.ok(island.diagnostics.every(item => item.severity === 'warning'));
});

test('chat: isolated islands keep identity through prose and refreshes, without drifting revisions', () => {
  const chat = createChatStream(chatOptions({ recovery: 'isolate' }));
  const first = chat.push(markup).islands[0]!;
  assert.equal(first.status, 'ready');
  const next = chat.push('More prose');
  assert.equal(next.islands[0], first);
  const refreshed = chat.refreshSources().islands[0]!;
  assert.equal(refreshed.status, 'ready');
  assert.equal(refreshed.document?.revision, first.document?.revision);
  assert.equal(refreshed.document, first.document);
  assert.deepEqual(refreshed.isolated?.map(item => item.nodeId), ['bad']);
});

test('chat: a boundary failure still errors in isolate mode', () => {
  const chat = createChatStream(chatOptions({ recovery: 'isolate' }));
  chat.push('```lyra\n<stack id="root"><text id="x">a</text><text id="x">b</text></stack>\n```\n');
  assert.equal(chat.finish().islands[0]?.status, 'error');
});

test('AI SDK bridge validates strictly unless recovery is isolate', () => {
  const part = { id: 'p1', type: 'data', name: 'view', state: 'complete', data: bad } as never;
  assert.equal(new LyraGenAiSdkBridge({ messageId: 'm', catalog, dataNames: ['view'] }).resolve(part)?.status, 'error');
  const resolved = new LyraGenAiSdkBridge({ messageId: 'm', catalog, dataNames: ['view'], recovery: 'isolate' }).resolve(part);
  assert.equal(resolved?.status, 'ready');
  assert.deepEqual(resolved?.isolated?.map(item => item.nodeId), ['bad']);
});
