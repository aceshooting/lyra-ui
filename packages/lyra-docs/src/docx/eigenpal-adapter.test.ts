import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance, DocxEditorConfig, EditorEvents } from '@docx-editor.dev/core';
import { openEigenpalDocument } from './eigenpal-adapter.js';
import type { DocxEngineEvent } from './engine-port.js';

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
  let saved = () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
  let creation: DocxEditorConfig | undefined;
  const document = { activeElement: null as unknown, body: {}, createElement: () => child };
  const child = Object.assign(new EventTarget(), {
    className: '', inert: false, ownerDocument: document,
    setAttribute() {}, contains: (node: unknown) => node === child,
    remove: () => { removed = true; },
  });
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
  return { mount, child, document, emit, loader, engine,
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
