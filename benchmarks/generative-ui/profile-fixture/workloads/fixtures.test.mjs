import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fixtureDefinitions as textDefinitions, ascii, waitForCommit, createFixture as createTextFixture } from './text.js';
import { fixtureDefinitions as chatDefinitions, matchesRenderedTree, chatButtonAction, expectedChatTrees, createRetainedViewport, largeText, retainedFormSource, createFixture as createChatFixture } from './chat.js';

const contextFor = workload => ({ batchIndex: 0, sampleIndex: 0, manifest: { workload, sha256: 'a'.repeat(64) } });
const chatServices = { chatRecording: chatDefinitions.C.recording, loadChatRecording: async () => { throw new Error('Unexpected recording request.'); },
  saveChatArchive: async () => 'archive', loadChatArchive: async () => [], releaseChatArchive: async () => {} };
const fixtureFactory = workload => workload === 'T' ? createTextFixture : createChatFixture;

for (const workload of ['T', 'C', 'L']) test(`${workload} factory and prepare leave production modules unloaded`, async () => {
  let loads = 0;
  const fixture = await fixtureFactory(workload)({ workload, services: chatServices, measurement: { pendingOperations: 0 } },
    { loadProduction: async () => { loads++; return []; } });
  const prepared = await fixture.prepare(contextFor(workload));
  assert.equal(prepared.manifest.workload, workload);
  assert.equal(loads, 0, 'Production imports must begin inside the timed mount trigger.');
  assert.equal((await fixture.dispose()).pendingOperations, 0);
});

test('T loads and constructs its complete transcript only after the timed mount boundary', async () => {
  const events = [];
  class Element extends EventTarget {
    children = []; dataset = {}; style = {};
    constructor(kind) { super(); events.push(kind); }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    querySelectorAll() { return []; }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    scrollToBottom() {}
  }
  const host = new Element('host'); events.length = 0;
  const controller = new AbortController();
  const fixture = createTextFixture({ workload: 'T', host, signal: controller.signal, measurement: { pendingOperations: 0,
    async measureOperation(options) { events.push('clock-start'); await options.trigger({ signal: controller.signal }); return { id: options.operation.id }; } } },
  { loadProduction: async () => { events.push('imports'); return [
    { LyraMessageParts: class extends Element { constructor() { super('parts'); } } },
    { LyraChatViewport: class extends Element { constructor() { super('viewport'); } } },
    { LyraChatMessage: class extends Element { constructor() { super('message'); } } },
  ]; } });
  const prepared = fixture.prepare(contextFor('T'));
  assert.deepEqual(events, []);
  await fixture.runOperation({ operation: prepared.operations[0], generation: prepared.generation });
  assert.deepEqual(events.slice(0, 3), ['clock-start', 'imports', 'viewport']);
  assert.equal(events.filter(event => event === 'message').length, 100);
  assert.equal(events.filter(event => event === 'parts').length, 100);
  await fixture.dispose(); assert.equal(host.children.length, 0);
});

for (const workload of ['T', 'C', 'L']) test(`${workload} late module resolution cannot mount an aborted, disposed or replaced generation`, async () => {
  for (const stop of ['measurement-abort', 'fixture-abort', 'dispose', 'replace-generation']) {
    const outer = new AbortController(), measured = new AbortController();
    let resolveModules, started, moduleReads = 0, appended = 0, pending = 0;
    const loading = new Promise(resolve => { resolveModules = resolve; });
    const importStarted = new Promise(resolve => { started = resolve; });
    const host = { append() { appended++; }, querySelectorAll: () => [] };
    const fixture = fixtureFactory(workload)({ workload, host, signal: outer.signal, services: chatServices, measurement: {
      get pendingOperations() { return pending; },
      async measureOperation(options) { pending++; try { return await options.trigger({ signal: measured.signal }); } finally { pending--; } },
    } }, { loadProduction: () => { started(); return loading; } });
    const prepared = fixture.prepare(contextFor(workload));
    const running = fixture.runOperation({ operation: prepared.operations[0], generation: prepared.generation });
    await importStarted;
    if (stop === 'measurement-abort') measured.abort();
    else if (stop === 'fixture-abort') outer.abort();
    else if (stop === 'dispose') await fixture.dispose();
    else fixture.prepare({ ...contextFor(workload), sampleIndex: 1 });
    resolveModules(new Proxy([], { get(_target, key) { if (key === 'then') return undefined; moduleReads++; throw new Error('Retired fixture accessed loaded modules.'); } }));
    await assert.rejects(running, /Stale or aborted/u, `${workload}: ${stop}`);
    assert.equal(moduleReads, 0, `${workload}: ${stop}`); assert.equal(appended, 0, `${workload}: ${stop}`);
    assert.equal((await fixture.dispose()).pendingOperations, 0);
  }
});

test('text inventory retains the full transcript and final-required-chunk append', () => {
  const definition = textDefinitions.T;
  assert.equal(definition.sizes.initialMessages, 100);
  assert.equal(definition.sizes.initialCharacters, 102400);
  const messages = Array.from({ length: 101 }, (_, index) => ascii(index));
  assert.equal(new Set(messages).size, 101);
  assert.equal(messages.every(text => text.length === 1024 && /^[\x00-\x7f]+$/u.test(text)), true);
  assert.equal(definition.sizes.chunks * definition.sizes.charactersPerChunk, 1024);
  assert.deepEqual(definition.operations.map(item => item.id), ['mount', 'release-reader', 'append', 'jump-to-end']);
  assert.deepEqual(JSON.parse(definition.operations[2].expectedFingerprint), { phase: 'append', messages: 101, characters: 103424, following: false });
  assert.equal(JSON.parse(definition.operations[3].expectedFingerprint).following, true);
});

test('chat recording identity and cadence match the untouched authored fixture', async () => {
  const bytes = await readFile(new URL('../../../../packages/lyra-gen/examples/recordings/chat-review.v1.json', import.meta.url));
  const recording = JSON.parse(bytes);
  for (const definition of Object.values(chatDefinitions)) {
    assert.equal(createHash('sha256').update(bytes).digest('hex'), definition.recording.sha256);
    assert.deepEqual(recording.chunks.map(chunk => chunk.atMs), definition.recording.offsetsMs);
  }
  assert.equal(recording.text.length, 379);
  assert.equal(recording.chunks.length, 9);
  assert.equal(recording.chunks.map(chunk => chunk.text).join(''), recording.text);
  assert.equal(recording.chunks[3].text.includes('id="note"'), true);
  assert.equal(recording.chunks[4].text, '</stack>\n```\n');
});

test('C declares distinct interrupt/resume, required-chunk readiness, native edit and panel operations', () => {
  const operations = chatDefinitions.C.operations;
  assert.deepEqual(operations.map(item => item.id), ['mount', 'interrupt', 'resume', 'first-ready', 'final-ready', 'edit', 'open-panel', 'return-panel', 'reject-tail']);
  assert.equal(operations.find(item => item.id === 'resume').native.action, 'click');
  assert.deepEqual(operations.filter(item => item.kind === 'ready').map(item => item.id), ['mount', 'first-ready', 'final-ready']);
  assert.equal(JSON.parse(operations.find(item => item.id === 'first-ready').expectedFingerprint).islands, 1);
  assert.equal(JSON.parse(operations.at(-1).expectedFingerprint).islands, 2);
  assert.equal(JSON.parse(operations.at(-1).expectedFingerprint).status, 'complete');
});

test('C selects only the review-island panel action when both completed islands have open buttons', () => {
  const button = (surfaceId, id) => ({ textContent: 'Open generated content in panel', closest: () => ({
    querySelector: () => ({ document: { surfaceId, root: { id } } }),
  }) });
  const buttons = [button('chat-answer:island-0', 'answer'), button('chat-answer:island-1', 'detail')];
  const descriptor = chatDefinitions.C.operations.find(operation => operation.id === 'open-panel').native;
  const action = /data-chat-action="([^"]+)"/u.exec(descriptor.selector)[1];
  const selected = buttons.filter(item => chatButtonAction(item) === action);
  assert.deepEqual(selected, [buttons[0]]);
  assert.equal(buttons.filter(item => item.textContent === 'Open generated content in panel').length, 2,
    'Matching only the common button label would select both real islands.');
  assert.equal(chatButtonAction(button('another-answer:island-0', 'answer')), undefined);
  assert.equal(chatButtonAction({ textContent: 'Return to conversation' }), 'return');
});

test('L preserves fifty full messages, ten eight-node forms, and the exact appended presentation on restore', () => {
  const definition = chatDefinitions.L;
  assert.deepEqual([definition.sizes.initialMessages, definition.sizes.charactersPerMessage, definition.sizes.initialCharacters], [50, 1024, 51200]);
  assert.deepEqual([definition.sizes.generatedForms, definition.sizes.inputsPerForm, definition.sizes.nodesPerForm], [10, 5, 8]);
  assert.deepEqual(definition.operations.map(item => item.id), ['mount', 'edit-middle', 'release-reader', 'append', 'open-panel', 'return-panel', 'release-source', 'restore']);
  const appended = JSON.parse(definition.operations.find(item => item.id === 'append').expectedFingerprint);
  const restored = JSON.parse(definition.operations.at(-1).expectedFingerprint);
  assert.deepEqual([appended.messages, restored.messages, restored.islands], [51, 51, 12]);
  assert.equal(restored.value, 'Keep this reviewed answer');
  assert.equal(restored.sourcesReleased, true);
  assert.equal(restored.actions, 0);
  for (const fixture of [textDefinitions.T, ...Object.values(chatDefinitions)]) {
    assert.equal(new Set(fixture.operations.map(item => item.id)).size, fixture.operations.length);
    for (const item of fixture.operations) assert.equal(item.trigger === 'event', Boolean(item.native));
  }
});

test('restored reader follow state is configured before viewport connection', () => {
  class Viewport { follow = true; dataset = {}; style = {}; }
  const restored = createRetainedViewport(Viewport, false);
  const firstConnectedState = restored.follow;
  assert.equal(firstConnectedState, false, 'A restored reader must never connect in initial follow-to-end mode.');
  assert.equal(createRetainedViewport(Viewport).follow, true, 'A new transcript still initially follows its end.');
});

test('rendered semantic oracle rejects wrong visible text even when the accepted document is unchanged', () => {
  const expected = { id: 'answer', type: 'text', props: {}, text: 'An independently checked answer.' };
  const element = { dataset: { genId: 'answer' }, localName: 'p', textContent: 'An independently checked answer.', children: [] };
  const nodes = [element];
  const view = { status: 'ready', document: { root: { props: {}, type: 'text', id: 'answer', text: 'An independently checked answer.' } },
    shadowRoot: { querySelectorAll: () => nodes } };
  assert.equal(matchesRenderedTree(view, expected), true);
  element.textContent = 'A stale answer.';
  assert.equal(matchesRenderedTree(view, expected), false);
  element.textContent = 'An independently checked answer.';
  nodes.push({ ...element, dataset: { genId: 'unexpected' } });
  assert.equal(matchesRenderedTree(view, expected), false);
  nodes.pop(); view.status = 'loading';
  assert.equal(matchesRenderedTree(view, expected), false);
});

test('C and L expected trees retain the actual optional-props Markup shape', () => {
  assert.deepEqual(expectedChatTrees.review, { id: 'answer', type: 'stack', children: [
    { id: 'title', type: 'heading', text: 'Review the answer' },
    { id: 'summary', type: 'text', text: 'This authored replay contains a working review field.' },
    { id: 'note', type: 'input', props: { label: 'Review note' }, bindings: { value: '/note' } },
  ] });
  assert.deepEqual(expectedChatTrees.form(25), { id: 'form-25', type: 'stack', children: [
    { id: 'heading-25', type: 'heading', text: 'Review answer 25' },
    ...['1', '2', '3', '4', '5'].map((label, index) => ({ id: `field-${index}`, type: 'input',
      props: { label: `Answer 25 field ${label}` }, bindings: { value: `/field${index}` } })),
    { id: 'submit-25', type: 'button', props: { type: 'submit' }, text: 'Submit review' },
  ] });
});

test('rendered semantic oracle accepts Markup nodes with omitted optional props and still rejects wrong text', () => {
  const expected = { id: 'detail', type: 'text', text: 'A second synthetic detail arrives later.' };
  const element = { dataset: { genId: 'detail' }, localName: 'p', textContent: 'A second synthetic detail arrives later.', children: [] };
  const view = { status: 'ready', document: { root: { id: 'detail', type: 'text', text: 'A second synthetic detail arrives later.' } },
    shadowRoot: { querySelectorAll: () => [element] } };
  assert.equal(matchesRenderedTree(view, expected), true);
  element.textContent = 'A stale detail.';
  assert.equal(matchesRenderedTree(view, expected), false);
});

test('rendered semantic oracle checks native input values and labels independently of document admission', () => {
  const expected = { id: 'note', type: 'input', props: { label: 'Review note' }, bindings: { value: '/note' } };
  const input = { value: 'Kept edit' };
  const field = { dataset: { genId: 'note' }, localName: 'lr-input', label: 'Review note', children: [],
    shadowRoot: { querySelector: () => input, querySelectorAll: selector => selector === 'input' ? [input] : [] } };
  const view = { status: 'ready', document: { root: { id: 'note', type: 'input', props: { label: 'Review note' }, bindings: { value: '/note' } } },
    shadowRoot: { querySelectorAll: () => [field] } };
  assert.equal(matchesRenderedTree(view, expected, { note: 'Kept edit' }), true);
  input.value = 'Lost edit';
  assert.equal(matchesRenderedTree(view, expected, { note: 'Kept edit' }), false);
  input.value = 'Kept edit'; field.label = 'Wrong label';
  assert.equal(matchesRenderedTree(view, expected, { note: 'Kept edit' }), false);
});

test('commit wait observes a non-bubbling scroll target and removes its listeners', async () => {
  class Target extends EventTarget {
    listeners = 0;
    addEventListener(...args) { this.listeners++; super.addEventListener(...args); }
    removeEventListener(...args) { this.listeners--; super.removeEventListener(...args); }
    querySelectorAll() { return []; }
  }
  const host = new Target(); const scroll = new Target(); const controller = new AbortController();
  let committed = false;
  const waiting = waitForCommit(host, () => ({ status: committed ? 'committed' : 'pending' }), controller.signal, [scroll]);
  committed = true; scroll.dispatchEvent(new Event('scroll'));
  await waiting;
  assert.equal(host.listeners, 0); assert.equal(scroll.listeners, 0);
  const aborted = waitForCommit(host, () => ({ status: 'pending' }), controller.signal, [scroll]);
  controller.abort();
  await assert.rejects(aborted, /aborted/u);
  assert.equal(host.listeners, 0); assert.equal(scroll.listeners, 0);
});

test('retained form transport preserves exact authored bytes, newline fences and all ten forms', () => {
  const hash = value => createHash('sha256').update(value).digest('hex');
  const sources = Array.from({ length: 10 }, (_, index) => retainedFormSource(index * 5));
  assert.deepEqual(sources.map(value => Buffer.byteLength(value)), [1561, 1561, 1570, 1570, 1570, 1570, 1570, 1570, 1570, 1570]);
  assert.equal(hash(JSON.stringify(sources)), '9db6bdc78dcb653dee5714cb36cb42be64db8fb9bb0f66b4de321c14ca7c0104');
  assert.equal(hash(sources[0]), 'ee93623ffe740cb64f3ac26eec00bf60821a60d771d4258036d4ac18a3b56d34');
  assert.equal(hash(sources[5]), 'b1e06956b202c83abd6c64e978e6d5e98c220be62b16f8fe4ca36d09528a78a7');
  assert.equal(hash(sources[9]), 'd622f0c627b8e72d5e3430ddf8ce8002bae2fedf14a6b22bdf7c25e7012f1895');
  for (const source of sources) {
    assert.equal(source.length, Buffer.byteLength(source));
    assert.equal(source.slice(1023, 1032), '\n```lyra\n');
    assert.equal(source.endsWith('</stack>\n```\n'), true);
    assert.equal((source.match(/<input /gu) ?? []).length, 5);
    assert.equal((source.match(/bindings=/gu) ?? []).length, 5);
  }
  const text = Array.from({ length: 50 }, (_, index) => largeText(index));
  assert.equal(text.join('').length, 51200);
  assert.equal(text.filter(value => value.endsWith('\n')).length, 10);
  assert.equal(largeText(1), ascii(1));
});
