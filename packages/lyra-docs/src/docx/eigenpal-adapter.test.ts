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
