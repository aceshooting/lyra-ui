import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance, DocxEditorConfig, EditorEvents } from '@docx-editor.dev/core';
import { openEigenpalDocument } from './eigenpal-adapter.js';
import type { DocxEngineEvent } from './engine-port.js';
import { deriveImageInsertionEngine } from './engine-image-insertion-loader.js';
import { normalizeImageInsertion } from './image-insertion-input.js';
import type { DocxResult } from './types.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function harness() {
  let mode = 'view';
  let destroyCount = 0;
  let removed = false;
  let loadCount = 0;
  let modeChanges = 0;
  let focusCalls = 0;
  let executions = 0;
  let created = 0, viewportRemoves = 0;
  let saved = () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
  let creation: DocxEditorConfig | undefined;
  const document = { activeElement: null as unknown, body: {}, createElement: () => created++ === 0 ? child : viewport };
  const child = Object.assign(new EventTarget(), {
    className: '', style: {} as Record<string, string>, inert: false, ownerDocument: document,
    setAttribute() {}, contains: (node: unknown) => node === child,
    remove: () => { removed = true; },
  });
  const viewport = { className: '', style: {} as Record<string, string>, tabIndex: 0,
    attributes: new Map<string, string>(), children: [] as unknown[],
    setAttribute(name: string, value: string) { this.attributes.set(name, value); },
    append(node: unknown) { this.children.push(node); },
    remove() { viewportRemoves++; removed = true; },
  };
  const mount = { ownerDocument: document, append() {} } as unknown as HTMLElement;
  const events = new Map<keyof EditorEvents, Set<(payload?: unknown) => void>>();
  const emit = (event: keyof EditorEvents, payload?: unknown) => {
    for (const listener of events.get(event) ?? []) listener(payload);
  };
  const engine = {
    load() { loadCount++; emit('change', { source: 'load', revision: 0 }); },
    setMode(value: string) { modeChanges++; mode = value; emit('selectionChange'); },
    snapshot: () => ({ isLoading: false, isOpening: false, parseError: null,
      page: { total: 1 }, selection: {}, selectionCollapsed: true, image: null }),
    on(event: keyof EditorEvents, listener: (payload?: unknown) => void) {
      const handlers = events.get(event) ?? new Set();
      handlers.add(listener); events.set(event, handlers);
      return () => { handlers.delete(listener); };
    },
    can: () => ({ ok: mode === 'edit' }), isActive: () => false,
    getSelectionFormatting: () => null,
    findMatches: () => [0, 1].map(start => ({ text: 'a', blockId: 'block', start, length: 1,
      paragraphIndex: 0, runIndex: 0, runOffset: start })),
    selectMatch() { emit('selectionChange'); return { ok: true, changed: false }; },
    exec() { executions++; emit('change', { revision: 1 }); return { ok: true, changed: true }; },
    focus() { focusCalls++; document.activeElement = child; return { ok: true }; },
    retainSelection: () => Symbol(), releaseSelection() {},
    save: () => saved(), destroy() { destroyCount++; },
  } as unknown as DocxEditorInstance;
  const loader = async () => ({ createDocxEditor(config: DocxEditorConfig) {
    creation = config; mode = config.mode ?? 'edit'; return engine;
  } });
  return { mount, child, viewport, viewportRemoves: () => viewportRemoves, document, emit, loader, engine,
    mode: () => mode, destroyCount: () => destroyCount, removed: () => removed,
    loadCount: () => loadCount, creation: () => creation,
    modeChanges: () => modeChanges, focusCalls: () => focusCalls,
    executions: () => executions,
    saveWith: (callback: typeof saved) => { saved = callback; } };
}

test('adapter opens an inert surface and observes changes before enabling native input', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(h.creation()?.mode, 'edit');
  assert.equal(h.child.inert, true);
  const input = new Event('beforeinput', { cancelable: true });
  h.child.dispatchEvent(input);
  assert.equal(input.defaultPrevented, true);
  const events: DocxEngineEvent[] = [];
  const off = opened.value.subscribe(event => { events.push(event); });
  assert.equal(h.mode(), 'edit');
  assert.equal(h.child.inert, false);
  assert.equal(h.modeChanges(), 0);
  assert.deepEqual(events, []);
  opened.value.execute('bold');
  assert.deepEqual(events, ['change', 'state']);
  off();
  assert.equal(h.child.inert, true);
  opened.value.destroy(); opened.value.destroy();
  assert.equal(h.destroyCount(), 1);
  assert.equal(h.removed(), true);
});

test('factory or synchronous load failures destroy only the owned surface and return typed refusals', async () => {
  for (const kind of ['factory', 'load', 'aborted-load']) {
    const h = harness();
    const controller = new AbortController();
    h.engine.load = () => {
      if (kind === 'aborted-load') controller.abort();
      throw new Error('private document diagnostics');
    };
    const loader = kind === 'factory' ? async () => ({ createDocxEditor() {
      throw new Error('private engine factory diagnostics');
    } }) : h.loader;
    const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
      { readOnly: false, signal: controller.signal }, () => true, loader);
    assert.deepEqual(opened, { ok: false, code: kind === 'aborted-load' ? 'aborted' : 'open-failed' });
    assert.equal(h.removed(), true);
    assert.equal(h.child.inert, true);
    assert.equal(h.destroyCount(), kind === 'factory' ? 0 : 1);
  }
});

test('command and replacement observers receive formatting finalized after the change callback', async () => {
  for (const replace of [false, true]) {
    const h = harness();
    let alignment = 'left';
    h.engine.getSelectionFormatting = () => ({ alignment });
    h.engine.exec = () => {
      h.emit('change', { revision: 1 });
      alignment = 'center';
      return { ok: true, changed: true };
    };
    const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
      { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
    assert(opened.ok);
    const port = opened.value;
    let observed = port.inspect().formatting.alignment;
    let changes = 0;
    port.subscribe(event => {
      if (event === 'change') changes++;
      observed = port.inspect().formatting.alignment;
    });
    if (replace) {
      const match = port.find('a', { matchCase: false, wholeWord: false, limit: 1 }).matches[0]!;
      assert.equal(port.replaceMatch(match.token, 'replacement').ok, true);
    } else assert.equal(port.execute({ type: 'alignment', value: 'center' }).ok, true);
    assert.equal(observed, 'center');
    assert.equal(changes, 1);
    port.destroy();
  }
});

test('native changes refresh finalized formatting once per turn and never after destruction', async () => {
  const h = harness();
  let alignment = 'left';
  h.engine.getSelectionFormatting = () => ({ alignment });
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  const port = opened.value;
  let observed = port.inspect().formatting.alignment;
  let states = 0, changes = 0;
  port.subscribe(event => {
    if (event === 'state') states++;
    if (event === 'change') changes++;
    observed = port.inspect().formatting.alignment;
  });
  h.emit('change', { revision: 1 });
  h.emit('change', { revision: 2 });
  alignment = 'right';
  await Promise.resolve();
  assert.equal(observed, 'right');
  assert.equal(changes, 2);
  assert.equal(states, 1);
  h.emit('change', { revision: 3 });
  port.destroy();
  await Promise.resolve();
  assert.equal(states, 1);
});

test('replacement refuses reentrant navigation to another match before writing', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  const port = opened.value;
  let nested = false;
  const matches = port.find('a', { matchCase: false, wholeWord: false, limit: 2 }).matches;
  port.subscribe(event => {
    if (event === 'user-selection' && !nested) { nested = true; port.selectMatch(matches[1]!.token); }
  });
  assert.deepEqual(port.replaceMatch(matches[0]!.token, 'replacement'), { ok: false, code: 'stale-selection' });
  assert.equal(h.executions(), 0);
  port.destroy();
});

test('replacement refuses a save started by a selection observer and keeps its input barrier', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  const port = opened.value;
  const pending = deferred<ArrayBuffer>();
  h.saveWith(() => pending.promise);
  let saving: Promise<Uint8Array> | undefined;
  port.subscribe(event => { if (event === 'user-selection') saving = port.save(new AbortController().signal); });
  const match = port.find('a', { matchCase: false, wholeWord: false, limit: 2 }).matches[0]!;
  assert.deepEqual(port.replaceMatch(match.token, 'replacement'), { ok: false, code: 'busy' });
  assert.equal(h.executions(), 0); assert.equal(h.child.inert, true);
  pending.resolve(new ArrayBuffer(0)); await saving;
  assert.equal(h.child.inert, false);
  port.destroy();
});

test('save suspends native mutation through cancellation until export settles', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  opened.value.subscribe(() => {});
  const pending = deferred<ArrayBuffer>();
  h.saveWith(() => pending.promise);
  const controller = new AbortController();
  const saving = opened.value.save(controller.signal);
  assert.equal(h.child.inert, true);
  for (const type of ['beforeinput', 'input', 'keydown', 'keyup', 'paste', 'cut', 'drop', 'dragstart',
    'pointerdown', 'pointerup', 'pointermove', 'click', 'dblclick', 'compositionstart']) {
    let inputReachedEngine = false;
    h.child.addEventListener(type, () => { inputReachedEngine = true; });
    const input = new Event(type, { cancelable: true });
    h.child.dispatchEvent(input);
    assert.equal(input.defaultPrevented, true, type);
    assert.equal(inputReachedEngine, false, type);
  }
  controller.abort();
  assert.equal(h.child.inert, true);
  pending.resolve(new ArrayBuffer(0));
  await assert.rejects(saving);
  assert.equal(h.mode(), 'edit');
  assert.equal(h.child.inert, false);
  assert.equal(h.modeChanges(), 0);
  opened.value.destroy();
});

test('readonly export never enables input and late save cannot revive destruction', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: true, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  opened.value.subscribe(() => {});
  assert.equal(h.mode(), 'view');
  await opened.value.save(new AbortController().signal);
  assert.equal(h.mode(), 'view');
  assert.equal(h.modeChanges(), 0);
  const pending = deferred<ArrayBuffer>();
  h.saveWith(() => pending.promise);
  const saving = opened.value.save(new AbortController().signal);
  opened.value.destroy();
  pending.resolve(new ArrayBuffer(0));
  await assert.rejects(saving);
  assert.equal(h.mode(), 'view');
  assert.equal(h.destroyCount(), 1);
  assert.equal(h.child.inert, true);
});

test('abort while the lazy module is loading never creates an engine or attaches a surface', async () => {
  const h = harness();
  const pending = deferred<Awaited<ReturnType<typeof h.loader>>>();
  const controller = new AbortController();
  const opening = openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: controller.signal }, () => true, () => pending.promise);
  controller.abort();
  pending.resolve(await h.loader());
  assert.deepEqual(await opening, { ok: false, code: 'aborted' });
  assert.equal(h.loadCount(), 0);
  assert.equal(h.creation(), undefined);
});

test('composition end stays guarded until engine event processing has finished', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  opened.value.subscribe(() => {});
  h.child.dispatchEvent(new Event('compositionstart'));
  assert.equal(opened.value.inspect().composing, true);
  h.child.dispatchEvent(new Event('compositionend'));
  assert.equal(opened.value.inspect().composing, true);
  await Promise.resolve();
  assert.equal(opened.value.inspect().composing, false);
  opened.value.destroy();
});

test('mount ownership lost during lazy loading refuses before allocating an engine', async () => {
  const h = harness();
  const pending = deferred<Awaited<ReturnType<typeof h.loader>>>();
  let owned = true;
  const opening = openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => owned, () => pending.promise);
  owned = false;
  pending.resolve(await h.loader());
  assert.deepEqual(await opening, { ok: false, code: 'invalid-mount' });
  assert.equal(h.loadCount(), 0);
  assert.equal(h.creation(), undefined);
});

test('selection changes caused by toolbar focus preserve the selection lease classification', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  const events: DocxEngineEvent[] = [];
  opened.value.subscribe(event => { events.push(event); });
  h.emit('selectionChange');
  assert.equal(events.at(-1), 'focus-selection');
  h.document.activeElement = h.child;
  h.emit('selectionChange');
  assert.equal(events.at(-1), 'user-selection');
  opened.value.destroy();
});

test('save preserves engine state and focus, restores a lost caret without stealing outside focus', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  const events: DocxEngineEvent[] = [];
  opened.value.subscribe(event => { events.push(event); });
  opened.value.focus();
  await opened.value.save(new AbortController().signal);
  assert.equal(h.document.activeElement === h.child, true);
  assert.equal(h.focusCalls(), 1);
  assert.equal(h.modeChanges(), 0);
  assert.equal(h.loadCount(), 1);
  assert.deepEqual(events, []);

  h.saveWith(async () => { h.document.activeElement = h.document.body; return new ArrayBuffer(0); });
  await opened.value.save(new AbortController().signal);
  assert.equal(h.document.activeElement === h.child, true);
  assert.equal(h.focusCalls(), 2);

  const outside = {};
  h.saveWith(async () => { h.document.activeElement = outside; return new ArrayBuffer(0); });
  await opened.value.save(new AbortController().signal);
  assert.equal(h.document.activeElement === outside, true);
  assert.equal(h.focusCalls(), 2);
  opened.value.destroy();
});

test('save returns the engine committed snapshot without retaining its mutable document', async () => {
  const h = harness();
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  opened.value.subscribe(() => {});
  const documentBytes = new Uint8Array([1, 2, 3]);
  h.saveWith(async () => documentBytes.slice().buffer);
  const exported = await opened.value.save(new AbortController().signal);
  documentBytes.fill(9);
  h.emit('change', { revision: 1 });
  assert.deepEqual([...exported], [1, 2, 3]);
  assert.equal(h.child.inert, false);
  assert.equal(h.modeChanges(), 0);
  opened.value.destroy();
});

async function tableHarness() {
  const h = harness();
  let revision = 0, flushes = 0, capability: (() => void) | null = null, onFlush: (() => void) | null = null;
  const make = (id: string, localName: string, children: unknown[] = []) => ({ id, kind: 'generic', localName,
    namespaceUri: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', attributes: [], namespaceBindings: [], children });
  const paragraph = make('p', 'p'), body = make('b', 'body', [paragraph]), root = make('d', 'document', [body]);
  const part = { root }, pkg = { mainDocumentPart: 'body', parts: new Map([['body', part]]) };
  const surface = { session: { packageRevision: () => revision, part: () => part, currentPackage: () => pkg },
    storyScope: () => ({ kind: 'body' }), state: () => ({ selection: { anchor: { paragraphId: 'p', offset: 0 }, head: { paragraphId: 'p', offset: 0 } }, cellSelection: null }),
    flushPendingInput() { flushes++; onFlush?.(); } };
  Object.defineProperty(h.engine, 'surface', { configurable: true, value: surface });
  Object.defineProperty(h.engine, 'mountGeneration', { configurable: true, value: 0 });
  h.engine.can = () => { capability?.(); return { ok: true }; };
  const loader = async () => ({ ...await h.loader(), tableReaders: {
    findNode: () => paragraph, parentNodeOf: (_part: unknown, id: string) => id === 'p' ? body : id === 'b' ? root : null,
  } } as unknown as Awaited<ReturnType<typeof import('./engine-loader.js')['loadDocxEngine']>>);
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, loader);
  assert.equal(opened.ok, true); if (!opened.ok) throw Error('open');
  const port = opened.value; port.subscribe(() => {});
  return { ...h, port, flushes: () => flushes, duringFlush: (callback: () => void) => { onFlush = callback; },
    duringCan: (callback: () => void) => { capability = callback; }, commit: () => { revision++; h.emit('change', { revision }); } };
}

test('table dispatch suspends native input without blur and rechecks request after settlement', async () => {
  const h = await tableHarness(); let checks = 0;
  h.document.activeElement = h.child;
  h.duringFlush(() => {
    const event = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true); assert.equal(h.child.inert, false);
    assert.equal(h.document.activeElement, h.child);
    assert.deepEqual(h.port.execute({ type: 'insert-table', rows: 1, columns: 1 }, undefined, () => ({ ok: true, value: undefined })), { ok: false, code: 'busy' });
  });
  const result = h.port.execute({ type: 'insert-table', rows: 2, columns: 2 }, undefined, () => { checks++; return { ok: true, value: undefined }; });
  assert.equal(result.ok, true); assert.equal(h.flushes(), 1); assert.equal(checks, 3); assert.equal(h.executions(), 1);
  const input = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(input); assert.equal(input.defaultPrevented, false);
  h.port.destroy();
});

test('table command rejects postsettlement facade changes and post-capability core changes', async () => {
  for (const mode of ['settled', 'second-check', 'third-check', 'revision', 'selection', 'destroy', 'throw']) {
    const h = await tableHarness(); let checks = 0;
    if (mode === 'revision') h.duringCan(h.commit);
    if (mode === 'selection') h.duringCan(() => { h.emit('selectionChange'); h.emit('selectionChange'); });
    if (mode === 'destroy') h.duringCan(() => h.port.destroy());
    if (mode === 'throw') h.duringCan(() => { throw Error('failure'); });
    const execute = () => h.port.execute({ type: 'insert-table', rows: 2, columns: 2 }, undefined, () => {
      checks++; return checks === (mode === 'settled' ? 1 : mode === 'second-check' ? 2 : mode === 'third-check' ? 3 : -1)
        ? { ok: false, code: 'stale-revision' } : { ok: true, value: undefined };
    });
    if (mode === 'throw') assert.throws(execute); else assert.equal(execute().ok, false, mode);
    assert.equal(h.executions(), 0, mode);
    const input = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(input);
    if (mode !== 'destroy') assert.equal(input.defaultPrevented, false);
    h.port.destroy();
  }
});

test('table validation and missing request guard refuse before flushing', async () => {
  const h = await tableHarness();
  assert.deepEqual(h.port.execute({ type: 'insert-table', rows: 0, columns: 2 }), { ok: false, code: 'invalid-option' });
  assert.deepEqual(h.port.execute({ type: 'delete-table' }), { ok: false, code: 'unsupported' });
  assert.deepEqual(h.port.execute({ type: 'delete-table' }, {}, () => ({ ok: true, value: undefined })), { ok: false, code: 'stale-selection' });
  assert.equal(h.flushes(), 0); assert.equal(h.executions(), 0);
  h.port.destroy();
});

async function waitForNativeSettlement(port: Awaited<ReturnType<typeof tableHarness>>['port']) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (port.can('bold').enabled) return;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  throw Error('Native settlement did not finish');
}

test('native settling suppresses legacy capability polling until the core input task drains', async () => {
  const h = await tableHarness(); let capabilityCalls = 0;
  h.duringCan(() => { capabilityCalls++; });
  h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
  assert.deepEqual(h.port.can('bold'), { enabled: false, reason: 'busy' });
  assert.equal(h.port.can({ type: 'insert-table', rows: 1, columns: 1 }).enabled, true);
  assert.equal(capabilityCalls, 0);
  h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
  await waitForNativeSettlement(h.port);
  assert.equal(capabilityCalls, 1);
  h.port.destroy();
});

test('table mutation during native dispatch refuses, but same-stack postdispatch settlement works', async () => {
  const h = await tableHarness(); let during: unknown;
  const action = { type: 'insert-table', rows: 1, columns: 1 } as const;
  h.child.addEventListener('beforeinput', () => {
    during = h.port.execute(action, undefined, () => ({ ok: true, value: undefined }));
  });
  // Node EventTarget does not model DOM eventPhase; the browser suite also uses native DOM dispatch.
  let dispatching = true;
  const event = new Event('beforeinput', { cancelable: true });
  Object.defineProperty(event, 'eventPhase', { get: () => dispatching ? Event.AT_TARGET : Event.NONE });
  h.child.dispatchEvent(event); dispatching = false;
  assert.deepEqual(during, { ok: false, code: 'busy' }); assert.equal(h.flushes(), 0); assert.equal(h.executions(), 0);
  assert.equal(h.port.execute(action, undefined, () => ({ ok: true, value: undefined })).ok, true);
  assert.equal(h.flushes(), 1); assert.equal(h.executions(), 1);
  await new Promise(resolve => setTimeout(resolve, 20));
  h.port.destroy();
});

test('destroy clears native settlement before its microtask or release timer publishes state', async () => {
  for (const afterMicrotask of [false, true]) {
    const h = await tableHarness(); let events = 0; h.port.subscribe(() => { events++; });
    h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
    if (afterMicrotask) await Promise.resolve();
    h.port.destroy(); await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(events, 0); assert.equal(h.destroyCount(), 1);
  }
});

test('nested native event tracking stays bounded and fails closed until settlement', async () => {
  const h = await tableHarness(); let depth = 0, result: unknown;
  const action = { type: 'insert-table', rows: 1, columns: 1 } as const;
  const dispatch = () => {
    let active = true; const event = new Event('beforeinput', { cancelable: true });
    Object.defineProperty(event, 'eventPhase', { get: () => active ? Event.AT_TARGET : Event.NONE });
    h.child.dispatchEvent(event); active = false;
  };
  h.child.addEventListener('beforeinput', () => {
    if (++depth < 70) dispatch();
    result = h.port.execute(action, undefined, () => ({ ok: true, value: undefined }));
  });
  dispatch();
  assert.deepEqual(result, { ok: false, code: 'busy' }); assert.equal(h.executions(), 0);
  assert.deepEqual(h.port.execute(action, undefined, () => ({ ok: true, value: undefined })), { ok: false, code: 'busy' });
  await waitForNativeSettlement(h.port);
  assert.equal(h.port.execute(action, undefined, () => ({ ok: true, value: undefined })).ok, true);
  h.port.destroy();
});


test('table labels update through the public editor without inspection or mutation', async () => {
  const h = harness();
  const resolvers: ((key: 'table.insertRowBelow' | 'table.insertColumnRight') => string)[] = [];
  h.engine.setTableInteractionLabel = resolver => { resolvers.push(resolver); };
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert.equal(opened.ok, true); if (!opened.ok) return;
  opened.value.subscribe(() => {});
  const labels = { insertRowBelow: 'Below', insertColumnRight: 'Right' };
  h.engine.snapshot = () => { throw Error('labels must not inspect layout'); };
  assert.equal(opened.value.refreshTableLabels?.(labels), true);
  labels.insertRowBelow = 'Changed caller copy';
  assert.equal(resolvers[0]!('table.insertRowBelow'), 'Below');
  assert.equal(resolvers[0]!('table.insertColumnRight'), 'Right');
  assert.equal(h.executions(), 0);
  opened.value.destroy();
  assert.equal(opened.value.refreshTableLabels?.(labels), false);
});

async function imageHarness(options = { kind: 'image-simple', readOnly: false }) {
  const { readOoxmlPackage } = await import('@docx-editor.dev/core/store');
  const { imageFixture } = await import('../../test/corpus.js');
  const parsed = readOoxmlPackage(imageFixture(options.kind)); assert(parsed.ok);
  const pkg = parsed.package, part = pkg.parts.get(pkg.mainDocumentPart)!;
  const nodes: import('@docx-editor.dev/core/store').OoxmlElement[] = [];
  const collect = (node: import('@docx-editor.dev/core/store').OoxmlNode) => { if (node.kind !== 'textValue') { nodes.push(node); node.children.forEach(collect); } }; collect(part.root);
  const drawing = nodes.find(node => node.localName === 'drawing')!, paragraph = nodes.find(node => node.children.some(run => run.kind !== 'textValue' && run.children.some(child => child === drawing)))!;
  const h = harness();
  const f = { revision: 0, id: drawing.id, paragraphId: paragraph.id, offset: 0, calls: 0, flushes: 0, dispatches: 0, reads: 0, imageReads: 0, saves: 0, packages: 0, version: 0, versionReads: 0, owned: true,
    onFlush() {}, onCan() {}, onPackage() {}, onLayout() {} };
  const image = { id: drawing.id, widthEmu: 1524000, heightEmu: 762000, kind: 'inline', wrap: 'inline', hidden: false, resourceStatus: 'ready', position: null,
    hyperlink: null, rotationDegrees: 0, crop: { left: 0, top: 0, right: 0, bottom: 0 }, locks: { select: false, move: false, resize: false, changeAspect: false }, title: 'Title 1', description: 'Description 1' };
  Object.assign(h.engine, { stateVersion: () => { f.versionReads++; return f.version; }, mountGeneration: 0, surface: {
    state: () => ({ selection: { anchor: { paragraphId: f.paragraphId, offset: f.offset }, head: { paragraphId: f.paragraphId, offset: f.offset } }, cellSelection: null }),
    publishedLayout: () => { f.onLayout(); return { revision: f.revision, pages: [{ fragments: nodes.filter(node => node.localName === 'drawing').map(node => {
      const parent = nodes.find(candidate => candidate.children.some(run => run.kind !== 'textValue' && run.children.some(child => child === node)))!;
      return { kind: 'paragraph', lines: [{ range: { paragraphId: parent.id, start: 0, end: 1 }, spans: [],
        drawings: [{ kind: 'inlineDrawing', drawingNodeId: node.id, paragraphId: parent.id, start: 0, accessibility: { hidden: false } }] }] };
    }) }] }; },
    revealParagraph: () => true, revealPosition: () => true, storyScope: () => ({ kind: 'body' }), drawingSelectionIntent: () => f.id ? { kind: 'pointer', drawingNodeId: f.id } : { kind: 'none' },
    flushPendingInput: () => { f.flushes++; f.onFlush(); },
    session: { part: () => part, currentPackage: () => { f.packages++; f.onPackage(); return pkg; }, packageRevision: () => f.revision },
  }, snapshot: () => { f.reads++; return { isLoading: false, isOpening: false, parseError: null, page: { total: 1 }, selection: {}, selectionCollapsed: true, image: f.id ? image : null }; },
  getSelectedImage: () => { f.imageReads++; return image; },
  can: () => { f.calls++; f.onCan(); return { ok: true }; },
  exec: () => { f.dispatches++; f.revision++; h.emit('change', { revision: f.revision }); return { ok: true }; } });
  h.saveWith(() => { f.saves++; return Promise.resolve(new Uint8Array().buffer); });
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' }, { readOnly: options.readOnly, signal: new AbortController().signal }, () => f.owned, h.loader); assert(opened.ok);
  const port = opened.value;
  port.subscribe(() => { port.inspect(); }); port.inspect();
  return { ...h, port, f, image, nodes };
}

test('image adapter compares identical values before core capability or mutation and returns copied metadata', async () => {
  const h = await imageHarness();
  const before = h.port.inspect(); assert.deepEqual(before.image, { widthPoints: 120, heightPoints: 60 });
  const description = h.port.imageDescription!(); assert(description.ok); assert(Object.isFrozen(description.value));
  for (const action of [{ type: 'resize-image', widthPoints: 120, heightPoints: 60 }, { type: 'image-description', title: 'Title 1', description: 'Description 1' }] as const) {
    assert(h.port.execute(action, undefined, () => ({ ok: true, value: undefined })).ok);
  }
  assert.equal(h.f.dispatches, 0); assert.equal(h.f.calls, 0); assert.equal(h.f.revision, 0);
  assert(h.port.execute({ type: 'resize-image', widthPoints: 144, heightPoints: 72 }, undefined, () => ({ ok: true, value: undefined })).ok);
  assert.equal(h.f.dispatches, 1); assert.equal(h.f.calls, 1); h.port.destroy();
});

test('queued image reads never call layout getters, capability, flush or save', async () => {
  const h = await imageHarness();
  h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
  const reads = h.f.reads;
  assert.deepEqual(h.port.imageDescription!(), { ok: false, code: 'busy' });
  assert.deepEqual(h.port.can({ type: 'delete-image' }), { enabled: false, reason: 'busy' });
  assert.deepEqual(h.port.inspect().image, { widthPoints: 120, heightPoints: 60 });
  assert.equal(h.f.reads, reads); assert.equal(h.f.calls, 0); assert.equal(h.f.flushes, 0); assert.equal(h.f.dispatches, 0);
  assert.equal(h.f.imageReads, 0); assert.equal(h.f.saves, 0); assert.equal(h.f.packages, 0);
  h.port.destroy();
});

test('image adapter rejects original intent changed by settlement, capability observer or released and ABA pins', async () => {
  for (const phase of ['flush', 'can', 'package', 'release', 'aba']) {
    const h = await imageHarness(); const pin = h.port.retainSelection();
    if (phase === 'flush') h.f.onFlush = () => { h.f.revision++; };
    if (phase === 'can') h.f.onCan = () => { h.f.id = 'other'; h.emit('selectionChange'); };
    if (phase === 'package') h.f.onPackage = () => { h.f.revision++; };
    if (phase === 'release') h.port.releaseSelection(pin);
    if (phase === 'aba') { h.f.id = 'other'; h.emit('selectionChange'); h.f.id = h.image.id; h.emit('selectionChange'); }
    assert.equal(h.port.execute({ type: 'delete-image' }, pin, () => ({ ok: true, value: undefined })).ok, false, phase);
    assert.equal(h.f.dispatches, 0, phase); h.port.destroy();
  }
});

test('queued ordinary input is settled then refuses the cached original image without image dispatch', async () => {
  const h = await imageHarness();
  h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
  h.f.id = '';
  h.f.onFlush = () => { h.f.revision++; h.emit('change', { revision: h.f.revision }); };
  assert.equal(h.port.execute({ type: 'delete-image' }, undefined, () => h.f.revision ? { ok: false, code: 'stale-revision' } : { ok: true, value: undefined }).ok, false);
  assert.equal(h.f.flushes, 1); assert.equal(h.f.revision, 1); assert.equal(h.f.dispatches, 0);
  h.port.destroy();
});

test('retaining an image refuses a reentrant focus-selection change during core pin acquisition', async () => {
  const h = await imageHarness(); let releases = 0;
  h.engine.releaseSelection = () => { releases++; };
  h.engine.retainSelection = () => {
    h.f.id = 'another-drawing'; h.image.id = 'another-drawing';
    h.emit('selectionChange');
    return Symbol() as unknown as ReturnType<DocxEditorInstance['retainSelection']>;
  };
  assert.throws(() => h.port.retainSelection());
  assert.equal(releases, 1); assert.equal(h.f.dispatches, 0);
  h.port.destroy();
});


test('image metadata remains available when a committed edit restarts native resource decoding', async () => {
  const h = await imageHarness();
  const action = { type: 'image-description', title: 'Picture & "quoted" 😀', description: 'First line\nSecond line: Café 東京' } as const;
  Object.assign(h.engine, { exec: () => {
    Object.assign(h.image, { title: action.title, description: action.description, resourceStatus: 'pending' });
    h.f.dispatches++; h.f.revision++; h.emit('change', { revision: h.f.revision }); return { ok: true };
  } });
  assert(h.port.execute(action, undefined, () => ({ ok: true, value: undefined })).ok);
  assert.deepEqual(h.port.imageDescription!(), { ok: true, value: { title: action.title, description: action.description } });
  assert.deepEqual(h.port.can({ type: 'delete-image' }), { enabled: false, reason: 'unsupported' });
  assert.deepEqual(h.port.execute({ type: 'delete-image' }, undefined, () => ({ ok: true, value: undefined })), { ok: false, code: 'unsupported' });
  h.image.resourceStatus = 'failed'; h.port.inspect();
  assert.deepEqual(h.port.imageDescription!(), { ok: false, code: 'unsupported' });
  h.port.destroy();
});


test('owned resource refresh publishes readiness without selection or document changes', async context => {
  const h = await imageHarness();
  context.mock.timers.enable({ apis: ['setTimeout'] });
  h.image.resourceStatus = 'pending'; assert.equal(h.port.inspect().imageReady, false);
  const pin = h.port.retainSelection();
  const events: DocxEngineEvent[] = []; h.port.subscribe(event => { events.push(event); });
  const reads = h.f.reads;
  h.image.resourceStatus = 'ready'; h.f.version++;
  context.mock.timers.tick(20);
  assert.deepEqual(h.port.can({ type: 'delete-image' }), { enabled: true });
  assert.equal(h.f.reads, reads + 1); assert.deepEqual(events, ['state']);
  assert.equal(h.port.inspect().imageReady, true);
  assert.equal(h.f.revision, 0); assert.equal(h.f.dispatches, 0); assert.equal(h.f.flushes, 0);
  assert(h.port.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 60 }, pin, () => ({ ok: true, value: undefined })).ok);
  assert.equal(h.f.dispatches, 0); h.port.destroy();
});

test('resource refresh skips unchanged versions and exhausts without inspection restarting it', async context => {
  const h = await imageHarness();
  context.mock.timers.enable({ apis: ['setTimeout'] });
  h.image.resourceStatus = 'pending'; h.port.inspect();
  const reads = h.f.reads;
  for (let attempt = 0; attempt < 15; attempt++) context.mock.timers.tick(1000);
  assert.equal(h.f.reads, reads);
  const versions = h.f.versionReads;
  assert(versions >= 12 && versions <= 14);
  h.port.inspect();
  const inspectedVersions = h.f.versionReads;
  h.image.resourceStatus = 'ready'; h.f.version++;
  for (let attempt = 0; attempt < 15; attempt++) context.mock.timers.tick(1000);
  assert.equal(h.f.versionReads, inspectedVersions);
  assert.deepEqual(h.port.can({ type: 'delete-image' }), { enabled: false, reason: 'unsupported' });
  h.port.destroy();
});

test('resource refresh performs no layout reads during native input or composition', async context => {
  for (const event of ['beforeinput', 'compositionstart']) {
    const h = await imageHarness();
    context.mock.timers.enable({ apis: ['setTimeout'] });
    let refresh: (() => void) | undefined;
    const original = globalThis.setTimeout;
    const timer = context.mock.method(globalThis, 'setTimeout', (...args: Parameters<typeof setTimeout>) => {
      if (args[1] === 16) refresh = () => args[0]();
      return original(...args);
    });
    h.image.resourceStatus = 'pending'; h.port.inspect();
    assert(refresh);
    let readsDuring = -1, readsAfter = -1;
    h.child.addEventListener(event, () => {
      readsDuring = h.f.reads;
      h.image.resourceStatus = 'ready'; h.f.version++;
      refresh!(); readsAfter = h.f.reads;
    });
    h.child.dispatchEvent(new Event(event, { cancelable: true }));
    assert.equal(readsAfter, readsDuring);
    assert.equal(h.f.flushes, 0); assert.equal(h.f.imageReads, 0); assert.equal(h.f.packages, 0);
    h.port.destroy(); timer.mock.restore(); context.mock.reset();
  }
});

test('stale or destroyed resource refresh does not publish or inspect', async context => {
  for (const stale of ['revision', 'selection', 'destroy', 'ownership', 'fault']) {
    const h = await imageHarness();
    context.mock.timers.enable({ apis: ['setTimeout'] });
    h.image.resourceStatus = 'pending'; h.port.inspect();
    if (stale === 'revision') h.f.revision++;
    if (stale === 'selection') { h.f.id = ''; h.emit('selectionChange'); }
    if (stale === 'destroy') h.port.destroy();
    if (stale === 'ownership') h.f.owned = false;
    if (stale === 'fault') assert.throws(() => h.emit('error'), /Engine unavailable/);
    const reads = h.f.reads;
    h.image.resourceStatus = 'ready'; h.f.version++;
    for (let attempt = 0; attempt < 15; attempt++) context.mock.timers.tick(1000);
    assert.equal(h.f.reads, reads, stale);
    h.port.destroy(); context.mock.timers.reset();
  }
});


test('resource refresh waits through save and cancels after resource failure', async context => {
  const h = await imageHarness();
  context.mock.timers.enable({ apis: ['setTimeout'] });
  h.image.resourceStatus = 'pending'; h.port.inspect();
  const pending = deferred<ArrayBuffer>(); h.saveWith(() => pending.promise);
  const save = h.port.save(new AbortController().signal);
  const reads = h.f.reads;
  h.image.resourceStatus = 'ready'; h.f.version++;
  context.mock.timers.tick(16);
  assert.equal(h.f.reads, reads);
  pending.resolve(new ArrayBuffer(0)); await save;
  context.mock.timers.tick(32);
  assert.equal(h.f.reads, reads + 1);
  assert.deepEqual(h.port.can({ type: 'delete-image' }), { enabled: true });
  h.image.resourceStatus = 'pending'; h.port.inspect();
  h.image.resourceStatus = 'unrenderable'; h.f.version++;
  context.mock.timers.tick(16);
  assert.deepEqual(h.port.imageDescription!(), { ok: false, code: 'unsupported' });
  const failedReads = h.f.reads, versions = h.f.versionReads;
  for (let attempt = 0; attempt < 15; attempt++) context.mock.timers.tick(1000);
  assert.equal(h.f.reads, failedReads); assert.equal(h.f.versionReads, versions);
  h.port.destroy();
});


test('explicit image navigation selects once, focuses and invalidates the original pin without editing', async () => {
  for (const readOnly of [false, true]) {
    const h = await imageHarness({ kind: 'image-simple', readOnly });
    let selections = 0;
    h.engine.surface!.selectDrawing = (id, paragraphId) => {
      assert(id !== h.image.id); assert(paragraphId);
      selections++; h.f.id = id; h.f.paragraphId = paragraphId; h.image.id = id; h.emit('selectionChange'); return true;
    };
    const pin = h.port.retainSelection(), events: DocxEngineEvent[] = [];
    h.port.subscribe(event => { events.push(event); });
    assert.deepEqual(h.port.selectImage?.('next'), { ok: true, value: undefined });
    assert.equal(selections, 1); assert.equal(h.focusCalls(), 1);
    assert.deepEqual(events, ['user-selection']);
    assert.equal(h.f.dispatches, 0); assert.equal(h.f.revision, 0); assert.equal(h.f.flushes, 0); assert.equal(h.f.calls, 0);
    if (!readOnly) assert.deepEqual(h.port.execute({ type: 'delete-image' }, pin, () => ({ ok: true, value: undefined })), { ok: false, code: 'stale-selection' });
    h.port.destroy();
  }
});

test('image navigation refuses reentrant target changes before native selection', async () => {
  for (const phase of ['revision', 'selection', 'generation', 'ownership', 'destroy']) {
    const h = await imageHarness(); let selections = 0;
    h.engine.surface!.selectDrawing = () => { selections++; return true; };
    h.f.onPackage = () => {
      if (phase === 'revision') h.f.revision++;
      if (phase === 'selection') h.emit('selectionChange');
      if (phase === 'generation') Object.assign(h.engine, { mountGeneration: 1 });
      if (phase === 'ownership') h.f.owned = false;
      if (phase === 'destroy') h.port.destroy();
    };
    assert.equal(h.port.selectImage?.('next').ok, false, phase);
    assert.equal(selections, 0); assert.equal(h.f.flushes, 0); h.port.destroy();
  }
});

test('image navigation refuses unsettled input and composition before canonical inspection', async () => {
  for (const event of ['beforeinput', 'compositionstart']) {
    const h = await imageHarness();
    h.child.dispatchEvent(new Event(event, { cancelable: true }));
    const packages = h.f.packages;
    assert.deepEqual(h.port.selectImage?.('next'), { ok: false, code: event === 'beforeinput' ? 'busy' : 'composing' });
    assert.equal(h.f.packages, packages); assert.equal(h.f.flushes, 0);
    h.port.destroy();
  }
});


test('image execution rechecks readiness after settlement even for identical values', async () => {
  for (const action of [{ type: 'delete-image' }, { type: 'resize-image', widthPoints: 120, heightPoints: 60 }] as const) {
    const h = await imageHarness();
    h.f.onFlush = () => { h.image.resourceStatus = 'pending'; };
    assert.deepEqual(h.port.execute(action, undefined, () => ({ ok: true, value: undefined })), { ok: false, code: 'unsupported' });
    assert.equal(h.f.calls, 0); assert.equal(h.f.dispatches, 0); h.port.destroy();
  }
});


test('singleton image navigation is a pure no-op and native refusal preserves selection', async () => {
  const singleton = await imageHarness({ kind: 'image-picture-lock', readOnly: false });
  const last = singleton.nodes.filter(node => node.localName === 'drawing').at(-1)!;
  singleton.f.id = last.id; singleton.image.id = last.id;
  singleton.f.paragraphId = singleton.nodes.find(node => node.children.some(run => run.kind !== 'textValue' && run.children.some(child => child === last)))!.id;
  singleton.port.inspect();
  let selections = 0; singleton.engine.surface!.selectDrawing = () => { selections++; return true; };
  const events: DocxEngineEvent[] = []; singleton.port.subscribe(event => { events.push(event); });
  assert.deepEqual(singleton.port.selectImage!('next'), { ok: true, value: undefined });
  assert.equal(selections, 0); assert.equal(singleton.focusCalls(), 0); assert.deepEqual(events, []);
  singleton.port.destroy();
  const h = await imageHarness(), pin = h.port.retainSelection();
  h.engine.surface!.selectDrawing = () => { selections++; return false; };
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'unsupported' });
  assert.equal(selections, 1); assert.equal(h.focusCalls(), 0);
  assert(h.port.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 60 }, pin, () => ({ ok: true, value: undefined })).ok);
  assert.equal(h.f.dispatches, 0); h.port.destroy();
});

test('image navigation guards save, reentrant commands and invalid directions without extra discovery', async () => {
  const h = await imageHarness();
  assert.deepEqual(h.port.selectImage!('invalid' as 'next'), { ok: false, code: 'invalid-option' });
  assert.equal(h.f.packages, 0);
  const pending = deferred<ArrayBuffer>(); h.saveWith(() => pending.promise);
  const save = h.port.save(new AbortController().signal);
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'busy' });
  assert.equal(h.f.packages, 0);
  pending.resolve(new ArrayBuffer(0)); await save;
  h.engine.surface!.selectDrawing = (id, paragraphId) => {
    assert.deepEqual(h.port.selectImage!('previous'), { ok: false, code: 'busy' });
    assert.deepEqual(h.port.execute({ type: 'delete-image' }), { ok: false, code: 'busy' });
    h.f.id = id; h.f.paragraphId = paragraphId!; h.image.id = id; return true;
  };
  assert.deepEqual(h.port.selectImage!('next'), { ok: true, value: undefined });
  assert.equal(h.f.packages, 1); assert.equal(h.f.dispatches, 0); assert.equal(h.f.flushes, 0);
  h.port.destroy();
});


test('singleton navigation rejects cached identity without a live drawing selection', async () => {
  const h = await imageHarness({ kind: 'image-picture-lock', readOnly: false });
  const last = h.nodes.filter(node => node.localName === 'drawing').at(-1)!;
  h.f.id = last.id; h.image.id = last.id; h.port.inspect();
  h.f.id = 'other';
  let selections = 0; h.engine.surface!.selectDrawing = () => { selections++; return true; };
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'stale-selection' });
  assert.equal(selections, 0); assert.equal(h.focusCalls(), 0); h.port.destroy();
});

test('navigation observers cannot redirect selection then receive success or stolen focus', async () => {
  const h = await imageHarness();
  h.engine.surface!.selectDrawing = id => { h.f.id = id; h.image.id = id; return true; };
  h.port.subscribe(event => { if (event === 'user-selection') h.emit('selectionChange'); });
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'stale-selection' });
  assert.equal(h.focusCalls(), 0); assert.equal(h.f.dispatches, 0); h.port.destroy();
});


test('image navigation reveals exactly the verified nonzero image position after selection and before focus', async () => {
  const h = await imageHarness(), order: string[] = [];
  let target = '';
  h.engine.surface!.selectDrawing = (id, paragraphId) => {
    order.push('select'); target = paragraphId!;
    h.f.id = id; h.f.paragraphId = target; h.f.offset = 37; h.image.id = id; return true;
  };
  h.engine.surface!.revealPosition = paragraphId => {
    assert.deepEqual(paragraphId, { paragraphId: target, offset: 37 }); order.push('reveal'); assert.equal(h.focusCalls(), 0); return true;
  };
  assert.deepEqual(h.port.selectImage!('next'), { ok: true, value: undefined });
  assert.deepEqual(order, ['select', 'reveal']); assert.equal(h.focusCalls(), 1);
  assert.equal(h.f.revision, 0); assert.equal(h.f.dispatches, 0); h.port.destroy();
});

test('failed native image selection never reveals or focuses', async () => {
  const h = await imageHarness(); let reveals = 0;
  h.engine.surface!.selectDrawing = () => false;
  h.engine.surface!.revealPosition = () => { reveals++; return true; };
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'unsupported' });
  assert.equal(reveals, 0); assert.equal(h.focusCalls(), 0); h.port.destroy();
});

test('image navigation revalidates ownership and actual target around reveal without stealing focus', async () => {
  for (const phase of ['observer', 'reveal']) for (const changed of ['drawing', 'paragraph', 'offset', 'revision', 'generation', 'ownership', 'destroy']) {
    const h = await imageHarness(); let reveals = 0;
    h.engine.surface!.selectDrawing = (id, paragraphId) => {
      h.f.id = id; h.f.paragraphId = paragraphId!; h.image.id = id; return true;
    };
    const redirect = () => {
      if (changed === 'drawing') h.f.id = 'other';
      if (changed === 'paragraph') h.f.paragraphId = 'other';
      if (changed === 'offset') h.f.offset++;
      if (changed === 'revision') h.f.revision++;
      if (changed === 'generation') Object.assign(h.engine, { mountGeneration: 1 });
      if (changed === 'ownership') h.f.owned = false;
      if (changed === 'destroy') h.port.destroy();
    };
    h.port.subscribe(event => { if (event === 'user-selection' && phase === 'observer') redirect(); });
    h.engine.surface!.revealPosition = () => { reveals++; if (phase === 'reveal') redirect(); return true; };
    assert.equal(h.port.selectImage!('next').ok, false, `${phase}/${changed}`);
    assert.equal(reveals, phase === 'observer' ? 0 : 1, `${phase}/${changed}`);
    assert.equal(h.focusCalls(), 0, `${phase}/${changed}`); assert.equal(h.f.dispatches, 0); h.port.destroy();
  }
});


test('adapter owns a keyboard-focusable bounded scroll host and removes it without restyling the consumer mount', async () => {
  const h = harness();
  const callerStyle = { overflow: 'visible', maxBlockSize: 'none' };
  Object.assign(h.mount, { className: 'consumer-layout', style: callerStyle });
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
  assert(opened.ok);
  assert.equal(h.child.className, 'docx-editor');
  assert.equal(h.viewport.className, 'docx-editor docx-editor__scroll-container');
  assert.equal(h.viewport.children[0] === h.child, true);
  assert.equal(h.viewport.tabIndex, 0);
  assert.deepEqual(h.creation()?.zoomMode, { type: 'fixed' });
  assert.equal(h.viewport.attributes.has('data-lr-docx-viewport'), true);
  assert.deepEqual(h.child.style, {});
  Object.assign(h.child.style, { width: '816px', height: '1056px' });
  assert.deepEqual(h.viewport.style, { position: 'relative', display: 'block', overflow: 'auto', minInlineSize: '0', maxInlineSize: '100%',
    boxSizing: 'border-box', maxBlockSize: 'var(--lr-docx-editor-document-max-block-size, var(--lr-size-30rem, 30rem))' });
  assert.equal(h.mount.className, 'consumer-layout');
  assert.deepEqual(callerStyle, { overflow: 'visible', maxBlockSize: 'none' });
  opened.value.destroy(); opened.value.destroy();
  assert.equal(h.destroyCount(), 1); assert.equal(h.removed(), true);
  assert.equal(h.viewportRemoves(), 1);
  assert.deepEqual(h.child.style, { width: '816px', height: '1056px' });
  assert.equal(h.mount.className, 'consumer-layout');
  assert.deepEqual(callerStyle, { overflow: 'visible', maxBlockSize: 'none' });
});


test('ambiguous image layout refuses before native selection and preserves the retained selection', async () => {
  for (const offset of [1592, 311]) {
    const h = await imageHarness(), pin = h.port.retainSelection(); let selections = 0;
    const drawing = h.nodes.filter(node => node.localName === 'drawing')[1]!;
    const paragraph = h.nodes.find(node => node.children.some(run => run.kind !== 'textValue' && run.children.some(child => child === drawing)))!;
    const range = (start: number, end: number) => ({ paragraphId: paragraph.id, start, end });
    h.engine.surface!.publishedLayout = () => ({ revision: h.f.revision, pages: [{ fragments: [{ kind: 'paragraph', lines: [
      { range: range(offset - 16, offset), spans: [], drawings: [] },
      { range: range(offset, offset + 1), spans: [], drawings: [{ kind: 'inlineDrawing', drawingNodeId: drawing.id,
        paragraphId: paragraph.id, start: offset, accessibility: { hidden: false } }] },
    ] }] }] }) as unknown as ReturnType<NonNullable<typeof h.engine.surface>['publishedLayout']>;
    h.engine.surface!.selectDrawing = () => { selections++; return false; };
    assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'unsupported' });
    assert.equal(selections, 0); assert.equal(h.focusCalls(), 0);
    assert(h.port.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 60 }, pin, () => ({ ok: true, value: undefined })).ok);
    h.port.destroy();
  }
});

test('unexpected false native selection publishes its actual moved caret and invalidates the lease', async () => {
  const h = await imageHarness(), pin = h.port.retainSelection(), events: DocxEngineEvent[] = [];
  h.port.subscribe(event => { events.push(event); });
  h.engine.surface!.selectDrawing = () => { h.f.id = ''; h.f.offset = 7; return false; };
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'unsupported' });
  assert.deepEqual(events, ['user-selection']); assert.equal(h.port.inspect().image, null);
  assert.equal(h.port.execute({ type: 'delete-image' }, pin, () => ({ ok: true, value: undefined })).ok, false);
  assert.equal(h.f.dispatches, 0); assert.equal(h.focusCalls(), 0); assert.equal(h.f.offset, 7); h.port.destroy();
});

test('layout observers cannot replace the original owner or selection before image dispatch', async () => {
  for (const change of ['revision', 'selection', 'ownership']) {
    const h = await imageHarness(); let selections = 0;
    h.f.onLayout = () => {
      if (change === 'revision') h.f.revision++;
      if (change === 'selection') h.emit('selectionChange');
      if (change === 'ownership') h.f.owned = false;
    };
    h.engine.surface!.selectDrawing = () => { selections++; return false; };
    assert.equal(h.port.selectImage!('next').ok, false); assert.equal(selections, 0); h.port.destroy();
  }
});


test('image navigation refuses stale published layout without selection or flushing', async () => {
  const h = await imageHarness(); let selections = 0;
  const published = h.engine.surface!.publishedLayout;
  h.engine.surface!.publishedLayout = () => ({ ...published(), revision: h.f.revision - 1 });
  h.engine.surface!.selectDrawing = () => { selections++; return false; };
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'unsupported' });
  assert.equal(selections, 0); assert.equal(h.f.flushes, 0); h.port.destroy();
});

test('false native image selection refuses mount replacement before publishing or focusing', async () => {
  for (const phase of ['select', 'readback']) for (const replacement of ['generation', 'session']) {
    const h = await imageHarness();
    const events: DocxEngineEvent[] = [];
    h.port.subscribe(event => { events.push(event); });
    const state = h.engine.surface!.state;
    const replace = () => {
      if (replacement === 'generation') Object.assign(h.engine, { mountGeneration: 1 });
      else Object.assign(h.engine.surface!, { session: { ...h.engine.surface!.session } });
    };
    let selected = false;
    h.engine.surface!.selectDrawing = () => {
      selected = true;
      if (phase === 'select') replace();
      return false;
    };
    h.engine.surface!.state = () => {
      const value = state();
      if (selected && phase === 'readback') replace();
      return value;
    };
    assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'stale-selection' }, `${phase}/${replacement}`);
    assert.deepEqual(events, [], `${phase}/${replacement}`);
    assert.equal(h.focusCalls(), 0); assert.equal(h.f.dispatches, 0);
    h.port.destroy();
  }
});

async function insertionHarness() {
  const store = await import('@docx-editor.dev/core/store');
  const { blankDocumentBytes } = await import('@docx-editor.dev/core/editor');
  const { docxFixture } = await import('./admission-fixtures.js');
  const { imageInsertionBytes } = await import('../../test/corpus.js');
  const parsed = store.readOoxmlPackage(docxFixture({ 'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body><w:p w14:paraId="00000001" w14:textId="00000001"><w:r><w:t>alpha</w:t></w:r></w:p></w:body></w:document>' })); assert(parsed.ok);
  const pkg = parsed.package, part = pkg.parts.get(pkg.mainDocumentPart)!, body = part.root.children[0]!; assert(body.kind !== 'textValue');
  const paragraph = body.children[0]!, live = new store.TreePackageStore(pkg, part);
  const h = harness();
  const f = { offset: 2, generation: 0, flushes: 0, decodes: 0, dispatches: 0, armed: 0, owned: true,
    onFlush() {}, onState() {}, onDecode: async () => {}, onLive() {} };
  const decodePort = { async decode() { f.decodes++; await f.onDecode(); return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 }; } };
  const surface = { storyScope: () => ({ kind: 'body' as const }), drawingSelectionIntent: () => ({ kind: 'none' as const }),
    state() { f.onState(); return { selection: { anchor: { paragraphId: paragraph.id, offset: f.offset }, head: { paragraphId: paragraph.id, offset: f.offset } }, cellSelection: null }; },
    session: { currentPackage: () => live.currentPackage(), part: () => live.currentPackage().parts.get(pkg.mainDocumentPart)!, packageRevision: () => live.packageRevision },
    imageDecodePort: () => decodePort, flushPendingInput() { f.flushes++; f.onFlush(); },
    async insertImage(input: Omit<Parameters<import('@docx-editor.dev/core/store').TreePackageStore['insertImage']>[1], 'decodePort' | 'actorId'>) {
      f.dispatches++; f.onLive(); const result = await live.insertImage({ kind: 'body' }, { ...input, decodePort });
      if (result.ok && result.change) h.emit('change', { revision: live.packageRevision });
      return result;
    }
  };
  Object.defineProperty(h.engine, 'mountGeneration', { get: () => f.generation }); Object.assign(h.engine, { surface });
  const imageInsertion = deriveImageInsertionEngine(blankDocumentBytes, store); assert(imageInsertion);
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' }, { readOnly: false, signal: new AbortController().signal },
    () => f.owned, async () => ({ ...await h.loader(), imageInsertion }), () => f.owned); assert(opened.ok);
  const port = opened.value; port.subscribe(() => {}); port.inspect();
  const normalized = normalizeImageInsertion({ bytes: imageInsertionBytes('png'), widthPoints: 48, heightPoints: 24 }, {}, () => ({ ok: true, value: undefined })); assert(normalized.ok);
  const operation = () => ({ signal: new AbortController().signal, validateOriginal: (): DocxResult<void> => ({ ok: true, value: undefined }),
    armCommit: (): DocxResult<void> => { f.armed++; return { ok: true, value: undefined }; } });
  return { ...h, f, port, live, source: normalized.value.source, operation };
}

test('insertion adapter captures without settlement and owns the native barrier through candidate and live decode', async () => {
  const h = await insertionHarness(), before = structuredClone(h.live.currentPackage()), captured = h.port.beginImageInsertion!(); assert(captured.ok);
  assert.equal(h.f.flushes, 0); assert.equal(h.f.decodes, 0); assert.equal(h.child.inert, false);
  const blocked = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(blocked); assert.equal(blocked.defaultPrevented, true);
  const operation = h.operation();
  h.f.onDecode = async () => { const input = new Event('pointerdown', { cancelable: true }); h.child.dispatchEvent(input); assert(input.defaultPrevented); };
  assert.deepEqual(await captured.value.execute(h.source, operation), { ok: true, value: undefined });
  assert.equal(h.f.flushes, 1); assert.equal(h.f.decodes, 2); assert.equal(h.f.dispatches, 1); assert.equal(h.f.armed, 1);
  assert.equal(h.live.packageRevision, 1); assert.notDeepEqual(h.live.currentPackage(), before);
  captured.value.release(); captured.value.release();
  const input = new Event('pointerdown', { cancelable: true }); h.child.dispatchEvent(input); assert.equal(input.defaultPrevented, false); h.port.destroy();
});

test('insertion adapter refuses original intent drift during capture, flush, candidate and live decode', async () => {
  for (const phase of ['capture', 'flush', 'candidate', 'live', 'ownership']) {
    const h = await insertionHarness();
    const drift = () => { h.f.offset = 3; h.emit('selectionChange'); h.f.offset = 2; h.emit('selectionChange'); };
    if (phase === 'capture') h.f.onState = () => { h.f.onState = () => {}; drift(); };
    const captured = h.port.beginImageInsertion!();
    if (phase === 'capture') { assert(!captured.ok); assert.equal(h.f.flushes, 0); h.port.destroy(); continue; }
    assert(captured.ok);
    if (phase === 'flush') h.f.onFlush = drift;
    if (phase === 'candidate' || phase === 'live') h.f.onDecode = async () => { if (h.f.decodes === (phase === 'candidate' ? 1 : 2)) drift(); };
    if (phase === 'ownership') h.f.owned = false;
    assert.equal((await captured.value.execute(h.source, h.operation())).ok, false, phase);
    assert.equal(h.live.packageRevision, 0, phase); assert.equal(h.f.dispatches, phase === 'live' ? 1 : 0, phase);
    captured.value.release(); h.port.destroy();
  }
});

test('insertion handle release is terminal and cannot release a newer native barrier', async () => {
  const h = await insertionHarness(), first = h.port.beginImageInsertion!(); assert(first.ok); first.value.release();
  const second = h.port.beginImageInsertion!(); assert(second.ok); first.value.release();
  const event = new Event('keydown', { cancelable: true }); h.child.dispatchEvent(event); assert(event.defaultPrevented);
  assert.equal(first.value.validate().ok, false); assert.equal((await first.value.execute(h.source, h.operation())).ok, false);
  second.value.release(); h.port.destroy();
});

test('insertion candidate cancellation and destroy retain the barrier until terminal release', async () => {
  for (const terminal of ['abort', 'destroy']) {
    const h = await insertionHarness(), captured = h.port.beginImageInsertion!(); assert(captured.ok);
    const wait = deferred<void>(), entered = deferred<void>(), controller = new AbortController();
    h.f.onDecode = async () => { entered.resolve(); await wait.promise; };
    const pending = captured.value.execute(h.source, { ...h.operation(), signal: controller.signal });
    await entered.promise;
    if (terminal === 'abort') controller.abort(); else h.port.destroy();
    assert.equal(h.f.dispatches, 0); assert.equal(h.live.packageRevision, 0);
    if (terminal === 'abort') {
      const input = new Event('pointerdown', { cancelable: true }); h.child.dispatchEvent(input); assert(input.defaultPrevented);
    } else { assert.equal(h.removed(), true); assert.equal(h.child.inert, true); assert.equal(captured.value.validate().ok, false); }
    wait.resolve();
    assert.deepEqual(await pending, { ok: false, code: terminal === 'abort' ? 'aborted' : 'destroyed' });
    assert.equal(h.f.dispatches, 0); assert.equal(h.f.armed, 0);
    captured.value.release(); h.port.destroy();
  }
});

test('insertion ignores late caller abort after arming but refuses invalid original pins and package ownership', async () => {
  const h = await insertionHarness(), pin = h.port.retainSelection(), captured = h.port.beginImageInsertion!(); assert(captured.ok);
  const controller = new AbortController(); h.f.onLive = () => controller.abort();
  assert.deepEqual(await captured.value.execute(h.source, { ...h.operation(), retainedSelection: pin, signal: controller.signal }), { ok: true, value: undefined });
  assert.equal(h.live.packageRevision, 1); assert.equal(h.f.armed, 1); captured.value.release(); h.port.destroy();
  for (const mutation of ['released-pin', 'foreign-pin', 'generation', 'session']) {
    const h = await insertionHarness(), pin = h.port.retainSelection(), captured = h.port.beginImageInsertion!(); assert(captured.ok);
    if (mutation === 'released-pin') h.port.releaseSelection(pin);
    if (mutation === 'generation') h.f.generation++;
    if (mutation === 'session') Object.assign(h.engine.surface!, { session: { ...h.engine.surface!.session } });
    assert.equal((await captured.value.execute(h.source, { ...h.operation(), retainedSelection: mutation === 'foreign-pin' ? {} : pin })).ok, false, mutation);
    assert.equal(h.f.flushes, 0); assert.equal(h.f.decodes, 0); assert.equal(h.f.dispatches, 0);
    captured.value.release(); h.port.destroy();
  }
});

test('insertion maps second native decode rejection to invalid document without committing', async () => {
  const h = await insertionHarness(), captured = h.port.beginImageInsertion!(); assert(captured.ok);
  h.f.onDecode = async () => { if (h.f.decodes === 2) throw new Error('native decode rejected'); };
  assert.deepEqual(await captured.value.execute(h.source, h.operation()), { ok: false, code: 'invalid-document' });
  assert.equal(h.f.decodes, 2); assert.equal(h.f.dispatches, 1); assert.equal(h.f.armed, 1); assert.equal(h.live.packageRevision, 0);
  captured.value.release(); h.port.destroy();
});

test('insertion capture refuses non-body, range, cell and drawing contexts before settlement and releases its barrier', async () => {
  for (const kind of ['story', 'range', 'cell', 'drawing', 'offset']) {
    const h = await insertionHarness(), surface = h.engine.surface!, original = surface.state;
    if (kind === 'story') surface.storyScope = () => ({ kind: 'headerFooter', rId: 'header1' });
    if (kind === 'drawing') surface.drawingSelectionIntent = () => ({ kind: 'programmatic' });
    if (kind === 'offset') h.f.offset = 0.5;
    surface.state = () => {
      const value = original();
      if (kind === 'range') return { ...value, selection: { ...value.selection, head: { ...value.selection.head, offset: 4 } } };
      if (kind === 'cell') return { ...value, cellSelection: {} as NonNullable<typeof value.cellSelection> };
      return value;
    };
    assert.deepEqual(h.port.beginImageInsertion!(), { ok: false, code: 'unsupported' }, kind);
    assert.equal(h.f.flushes, 0); assert.equal(h.f.decodes, 0);
    const input = new Event('pointerdown', { cancelable: true }); h.child.dispatchEvent(input); assert.equal(input.defaultPrevented, false);
    h.port.destroy();
  }
});

test('insertion capture and live exceptions release authority without masking original selection changes', async () => {
  const capture = await insertionHarness(); capture.f.onState = () => { throw new Error('state unavailable'); };
  assert.deepEqual(capture.port.beginImageInsertion!(), { ok: false, code: 'engine-failed' });
  const input = new Event('pointerdown', { cancelable: true }); capture.child.dispatchEvent(input); assert.equal(input.defaultPrevented, false); capture.port.destroy();
  for (const stale of [false, true]) {
    const h = await insertionHarness(), captured = h.port.beginImageInsertion!(); assert(captured.ok);
    h.engine.surface!.insertImage = () => { if (stale) h.emit('selectionChange'); throw new Error('live dispatch unavailable'); };
    assert.deepEqual(await captured.value.execute(h.source, h.operation()), { ok: false, code: stale ? 'stale-selection' : 'engine-failed' });
    assert.equal(h.live.packageRevision, 0); captured.value.release(); h.port.destroy();
  }
});
