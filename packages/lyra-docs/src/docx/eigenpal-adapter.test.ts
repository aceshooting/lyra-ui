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
    exec() { emit('change', { revision: 1 }); return { ok: true, changed: true }; },
    focus() { focusCalls++; document.activeElement = child; return { ok: true }; },
    retainSelection: () => Symbol(), releaseSelection() {},
    save: () => saved(), destroy() { destroyCount++; },
  } as unknown as DocxEditorInstance;
  const loader = async () => ({ createDocxEditor(config: DocxEditorConfig) {
    creation = config; mode = config.mode ?? 'edit'; return engine;
  } });
  return { mount, child, document, emit, loader,
    mode: () => mode, destroyCount: () => destroyCount, removed: () => removed,
    loadCount: () => loadCount, creation: () => creation,
    modeChanges: () => modeChanges, focusCalls: () => focusCalls,
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
  assert.deepEqual(events, ['change']);
  off();
  assert.equal(h.child.inert, true);
  opened.value.destroy(); opened.value.destroy();
  assert.equal(h.destroyCount(), 1);
  assert.equal(h.removed(), true);
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
