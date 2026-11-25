import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatStream, type LyraGenChatOptions } from './chat.js';
import type { LyraGenPartialView } from './partial-view.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = { id: 'chat-test', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
  citation: { tag: 'lr-citation-badge', properties: { sourceId: { type: 'string' }, label: { type: 'string' } },
    required: ['sourceId', 'label'], interactive: true, events: ['lr-citation-activate'] },
  'source-card': { tag: 'lr-source-card', properties: { sourceId: { type: 'string' }, heading: { type: 'string' } },
    required: ['sourceId', 'heading'], children: ['text'] },
} };
function options(extra: Partial<LyraGenChatOptions> = {}): LyraGenChatOptions {
  return { messageId: 'message', surfaceId: 'answer', catalog, strings: {
    loading: 'Loading view', invalid: 'Invalid view', incomplete: 'Retry this view', sourceUnavailable: 'Source unavailable',
  }, ...extra };
}
const ready = 'Intro\n```lyra\n<text id="result">Ready</text>\n```\n';

test('streamed islands use existing data parts, validate before mounting and retain identity through prose deltas', () => {
  const chat = createChatStream(options({ provenance: 'Generated answer' }));
  const pending = chat.push('Intro\n```lyra\n<text id="result">');
  assert.equal(pending.islands[0]?.status, 'loading');
  assert.equal(pending.islands[0]?.document, undefined);
  const first = chat.push('Ready</text>\n```\n');
  assert.equal(first.parts[1]?.type, 'data');
  assert.equal(first.islands[0]?.status, 'ready');
  assert.equal(first.islands[0]?.provenance, 'Generated answer');
  const island = first.islands[0];
  const part = first.parts[1];
  const next = chat.push('A following explanation');
  assert.equal(next.islands[0], island);
  assert.equal(next.parts[1], part);
  assert.equal(chat.islandForPart(part!.id), island);
  assert.equal(chat.finish().status, 'complete');
});

test('an unknown role falls back visibly and never publishes a generated document', () => {
  const chat = createChatStream(options());
  chat.push('```lyra\n<unknown id="bad">Unsafe</unknown>\n```\n');
  const snapshot = chat.finish();
  assert.equal(snapshot.islands[0]?.status, 'error');
  assert.equal(snapshot.islands[0]?.fallback, 'Invalid view');
  assert.equal(snapshot.islands[0]?.document, undefined);
  assert.ok(snapshot.diagnostics.length > 0);
});

test('interruption/resume retains completed islands and never completes a partial control', () => {
  const chat = createChatStream(options());
  chat.push(ready + '```lyra\n<text id="partial">');
  const readyIsland = chat.snapshot.islands[0];
  const interrupted = chat.interrupt(true, 'Connection interrupted');
  assert.equal(interrupted.status, 'interrupted');
  assert.equal(interrupted.islands[0], readyIsland);
  assert.equal(interrupted.islands[1]?.status, 'incomplete');
  assert.equal(interrupted.islands[1]?.document, undefined);
  assert.equal(interrupted.resumable, true);
  assert.equal(chat.push('Ignored while interrupted'), interrupted);
  chat.resume();
  chat.push('Finished</text>\n```\n');
  const complete = chat.finish();
  assert.equal(complete.islands[0], readyIsland);
  assert.deepEqual(complete.islands.map(island => island.status), ['ready', 'ready']);
});

test('permanent cancellation is inert until an explicit retry replaces only the unfinished tail', () => {
  const chat = createChatStream(options());
  chat.push(ready + '```lyra\n<text id="unfinished">Broken');
  const first = chat.snapshot.islands[0];
  const cancelled = chat.cancel();
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.islands[1]?.status, 'incomplete');
  assert.equal(chat.resume(), cancelled);
  assert.equal(chat.push('ignored'), cancelled);
  chat.retry();
  chat.push('```lyra\n<text id="replacement">New answer</text>\n```\n');
  const snapshot = chat.finish();
  assert.equal(snapshot.islands[0], first);
  assert.deepEqual(snapshot.islands.map(island => island.status), ['ready', 'ready']);
  assert.equal(snapshot.islands[1]?.document?.root.id, 'replacement');
});

test('viewer source registry supplies citation labels; missing and revoked sources become inert visible text', () => {
  const sources = new Map([['authorized', { id: 'authorized', label: 'Reviewed source' }]]);
  const chat = createChatStream(options({ sources }));
  chat.push('```lyra\n<stack id="root"><citation id="yes" sourceId="authorized" label="Model claim" />'
    + '<citation id="no" sourceId="private" label="Pretend verified" /></stack>\n```\n');
  const initial = chat.finish().islands[0]!.document!;
  assert.equal(initial.root.children![0]?.props?.['label'], 'Reviewed source');
  assert.equal(initial.root.children![1]?.type, 'text');
  assert.equal(initial.root.children![1]?.text, 'Source unavailable');
  assert.equal(initial.root.children![1]?.action, undefined);
  assert.equal(chat.resolveCitation(initial.surfaceId, 'yes')?.label, 'Reviewed source');
  assert.equal(chat.resolveCitation(initial.surfaceId, 'no'), undefined);
  sources.delete('authorized');
  assert.equal(chat.resolveCitation(initial.surfaceId, 'yes'), undefined);
  const revoked = chat.refreshSources().islands[0]!.document!;
  assert.equal(revoked.revision, initial.revision + 1);
  assert.equal(revoked.root.children![0]?.type, 'text');
});

test('host-configured ask suggestions dispatch exactly once per activation and honor host permission', async () => {
  let permitted = false;
  const received: unknown[] = [];
  const chat = createChatStream(options({
    suggestions: [{ id: 'ask:details', label: 'More', question: 'Explain the result.', context: { report: 'public' } }],
    canAsk: () => permitted,
    onAsk: request => { received.push(request); },
  }));
  assert.equal(await chat.requestSuggestion('ask:details', 'activation-1'), 'disabled');
  chat.finish();
  assert.equal(await chat.requestSuggestion('ask:details', 'activation-1'), 'disabled');
  permitted = true;
  const one = chat.requestSuggestion('ask:details', 'activation-1');
  const duplicate = chat.requestSuggestion('ask:details', 'activation-1');
  assert.equal(await one, 'accepted');
  assert.equal(await duplicate, 'duplicate');
  assert.equal(received.length, 1);
  assert.equal((received[0] as { question: string }).question, 'Explain the result.');
  assert.deepEqual((received[0] as { context: unknown }).context, { report: 'public' });
  assert.equal(await chat.requestSuggestion('ask:invented', 'activation-2'), 'unknown');
  chat.dispose();
  assert.equal(await chat.requestSuggestion('ask:details', 'activation-2'), 'disabled');
});

test('retry or disposal aborts an outstanding host request and never invokes it twice', async () => {
  let signal: AbortSignal | undefined;
  let settle!: () => void;
  const chat = createChatStream(options({
    suggestions: [{ id: 'ask:details', label: 'More', question: 'More detail' }],
    onAsk: request => { signal = request.signal; return new Promise<void>(resolve => { settle = resolve; }); },
  }));
  chat.finish();
  const pending = chat.requestSuggestion('ask:details', 'activation');
  chat.retry();
  assert.equal(signal?.aborted, true);
  settle();
  assert.equal(await pending, 'disabled');
  assert.equal(await chat.requestSuggestion('ask:details', 'activation'), 'duplicate');
});

test('disposal releases bounded long transport input and cannot resurrect a cancelled scanner', () => {
  const chat = createChatStream(options());
  const chunk = 'A'.repeat(1024);
  for (let index = 0; index < 100; index++) chat.push(chunk);
  assert.equal(chat.retainedSourceCharacters, 102400);
  assert.equal(chat.sourceAvailable, true);
  chat.dispose();
  assert.equal(chat.retainedSourceCharacters, 0);
  assert.equal(chat.sourceAvailable, false);
  assert.deepEqual(chat.snapshot.parts, []);
  assert.deepEqual(chat.snapshot.islands, []);
  chat.push(chunk); chat.resume(); chat.retry();
  assert.equal(chat.retainedSourceCharacters, 0);
  assert.deepEqual(chat.snapshot.parts, []);
});

test('explicit source release retains admitted presentation and source authorization while disabling source replay', () => {
  const sources = new Map([['report', { id: 'report', label: 'Reviewed report' }]]);
  const chat = createChatStream(options({ sources, provenance: 'Host provenance' }));
  chat.push('Prose\n```lyra\n<citation id="source" sourceId="report" label="Model" />\n```\n');
  const current = chat.finish();
  const document = current.islands[0]!.document;
  const released = chat.releaseSource();
  assert.equal(released.parts, current.parts);
  assert.equal(released.islands[0]!.document, document);
  assert.equal(released.islands[0]!.provenance, 'Host provenance');
  assert.equal(chat.retainedSourceCharacters, 0);
  assert.equal(chat.sourceAvailable, false);
  for (const operation of [() => chat.resume(), () => chat.retry(), () => chat.push('New raw source')]) {
    const rejected = operation();
    assert.equal(rejected.diagnostics.at(-1)?.code, 'chat.source-released');
    assert.equal(rejected.islands[0]!.document, document);
    assert.equal(chat.retainedSourceCharacters, 0);
  }
  sources.clear();
  const revoked = chat.refreshSources();
  assert.equal(revoked.islands[0]!.document?.root.type, 'text');
  assert.equal(revoked.islands[0]!.document?.root.text, 'Source unavailable');
  assert.equal(revoked.islands[0]!.document?.revision, document!.revision + 1);
  assert.equal(chat.retainedSourceCharacters, 0);
});

test('disposal also releases the retained retry prefix after a source-budget rejection', () => {
  const chat = createChatStream(options({ limits: { maxLength: 64 } }));
  chat.push('P'.repeat(32));
  assert.equal(chat.push('Q'.repeat(40)).status, 'error');
  assert.equal(chat.retainedSourceCharacters, 32);
  chat.dispose();
  assert.equal(chat.retainedSourceCharacters, 0);
  assert.equal(chat.sourceAvailable, false);
  assert.deepEqual(chat.snapshot.parts, []);
});

test('a source-budget rejection keeps already completed islands and prose visible', () => {
  const chat = createChatStream(options({ limits: { maxLength: 128 } }));
  const first = chat.push(ready);
  const island = first.islands[0];
  const failed = chat.push('Q'.repeat(200));
  assert.equal(failed.status, 'error');
  assert.equal(failed.diagnostics.some(item => item.code === 'source-length-limit'), true);
  assert.equal(failed.parts.length, first.parts.length);
  assert.equal(failed.islands[0], island);
  assert.equal(failed.parts[0]?.type, 'text');
  assert.equal(chat.retainedSourceCharacters, ready.length);
  const retried = chat.retry();
  assert.equal(retried.islands[0]?.status, 'ready');
});
test('admitting an unchanged tree after a source refresh keeps the document identity', () => {
  const sources = new Map([['a', { id: 'a', label: 'Source A' }]]);
  const chat = createChatStream(options({ sources }));
  chat.push('```lyra\n<citation id="c" sourceId="a" label="x" />\n```\n');
  const document = chat.finish().islands[0]?.document;
  assert.equal(chat.refreshSources().islands[0]?.document, document);
  sources.set('a', { id: 'a', label: 'Renamed' });
  assert.equal(chat.refreshSources().islands[0]?.document?.revision, document!.revision + 1);
});

const streamedIsland = 'Intro\n```lyra\n<stack id="answer">\n<text id="one">First</text>\n<text id="two">Second</text>\n'
  + '<text id="three">Third</text>\n</stack>\n```\nAfter';
function previewsOf(chat: ReturnType<typeof createChatStream>, source: string, width: number) {
  const previews: LyraGenPartialView[] = [];
  for (let offset = 0; offset < source.length; offset += width) {
    const island = chat.push(source.slice(offset, offset + width)).islands[0];
    if (island?.status === 'loading' && island.partial && island.partial !== previews.at(-1)) previews.push(island.partial);
    if (island && island.status !== 'loading') assert.equal(island.partial, undefined);
  }
  return previews;
}

test('progressive chat islands publish growing previews, then the committed document of the same surface and revision', () => {
  const chat = createChatStream(options({ progressive: { minCodeUnits: 0 } }));
  const previews = previewsOf(chat, streamedIsland, 5);
  assert.ok(previews.length >= 2);
  const shown = (view: { root: { id: string; children?: readonly { id: string }[] } }) => [view.root.id, ...(view.root.children ?? []).map(child => child.id)];
  for (let index = 1; index < previews.length; index++) {
    const before = shown(previews[index - 1]!.view);
    assert.deepEqual(shown(previews[index]!.view).slice(0, before.length), before);
  }
  const done = chat.finish().islands[0]!;
  assert.equal(done.status, 'ready');
  assert.equal(done.partial, undefined);
  assert.equal(done.document?.surfaceId, previews.at(-1)!.view.surfaceId);
  assert.equal(done.document?.revision, previews.at(-1)!.view.revision);
  const plain = createChatStream(options());
  plain.push(streamedIsland);
  assert.deepEqual(plain.finish().islands[0]?.document, done.document);
});

test('chat islands carry no preview unless progressive mode is opted in', () => {
  const chat = createChatStream(options());
  assert.equal(previewsOf(chat, streamedIsland, 5).length, 0);
  assert.equal(chat.push('').islands[0]?.status, 'ready');
});

test('cancel clears the preview and keeps the incomplete fallback; interruption hides it until resume', () => {
  const head = streamedIsland.slice(0, 70);
  const cancelled = createChatStream(options({ progressive: { minCodeUnits: 0 } }));
  assert.ok(previewsOf(cancelled, head, 4).length > 0);
  const after = cancelled.cancel().islands[0]!;
  assert.equal(after.status, 'incomplete');
  assert.equal(after.partial, undefined);
  assert.equal(after.document, undefined);
  assert.equal(after.fallback, 'Retry this view');
  const paused = createChatStream(options({ progressive: { minCodeUnits: 0 } }));
  const previews = previewsOf(paused, head, 4);
  assert.equal(paused.interrupt(true).islands[0]?.partial, undefined);
  assert.equal(paused.resume().islands[0]?.partial, previews.at(-1));
});

test('a malformed progressive island ends in the invalid fallback without a preview', () => {
  const chat = createChatStream(options({ progressive: { minCodeUnits: 0 } }));
  const source = '```lyra\n<stack id="s">\n<text id="t">Real</text>\n<script id="x">bad</script>\n</stack>\n```\n';
  for (const preview of previewsOf(chat, source, 3)) assert.equal(JSON.stringify(preview.view).includes('script'), false);
  const island = chat.finish().islands[0]!;
  assert.equal(island.status, 'error');
  assert.equal(island.partial, undefined);
  assert.equal(island.document, undefined);
});

test('previews apply host source authorization before a generated label can appear', () => {
  const chat = createChatStream(options({ progressive: { minCodeUnits: 0 }, sources: new Map([['a', { id: 'a', label: 'Host label' }]]) }));
  const previews = previewsOf(chat, '```lyra\n<stack id="s">\n<citation id="c" sourceId="a" label="Model label" />\n'
    + '<citation id="d" sourceId="forged" label="Forged label" />\n<text id="t">More</text>\n', 6);
  assert.ok(previews.length > 0);
  for (const preview of previews) assert.equal(JSON.stringify(preview.view).includes('Model label') || JSON.stringify(preview.view).includes('Forged label'), false);
  const children = previews.at(-1)!.view.root.children!;
  assert.equal(children[0]?.props?.['label'], 'Host label');
  assert.equal(children[1]?.text, 'Source unavailable');
});
