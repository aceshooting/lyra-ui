import assert from 'node:assert/strict';
import test from 'node:test';
import { tag } from '@aceshooting/lyra-ui/utilities/prefix.js';
import { editor, flush, refusal, session, type Internals } from '../../test/docx-editor-harness.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

/**
 * The editor's failure and race guards, driven in Node on a real, unconnected element. Each test replaces
 * only the collaborators its guard reads and asserts what the guard does: which refusal is reported, what is
 * released, and which focus or announcement is withheld. The browser suites cover the same flows end to end;
 * these cover the refusals they cannot provoke from the outside.
 */

test('a command that rejects settles as an engine failure instead of escaping', async () => {
  const { i } = editor();
  const accepted: DocxResult<unknown> = { ok: true, value: { documentId: 'document', value: 3 } };
  assert.equal(await i.settleCommand(async () => accepted), accepted);
  assert.deepEqual(await i.settleCommand(async () => { throw new Error('private engine diagnostics'); }), refusal('engine-failed'));
  assert.deepEqual(await i.settleCommand(() => Promise.reject(new Error('rejected'))), refusal('engine-failed'));
});

test('the insertion picker opens for a valid, enabled insertion and otherwise cancels without touching the file input', () => {
  const cases: [string, unknown, boolean][] = [
    ['no captured intent', null, true],
    ['a stale intent', { valid: () => false }, true],
    ['insertion unavailable', { valid: () => true }, false],
  ];
  for (const [name, intent, enabled] of cases) {
    const cancels: boolean[] = [];
    const { i, stub } = editor({ insertionPhase: 'idle', insertionIntent: intent, session: session() });
    stub('prepareImageInsertion', () => {});
    stub('canInsertImage', () => ({ enabled }));
    stub('cancelImageInsertion', (returnFocus: boolean) => { cancels.push(returnFocus); });
    i.renderRoot = { querySelector: () => { throw new Error('the file input must not be looked up'); } };
    i.openImageInsertionPicker();
    assert.deepEqual(cancels, [false], name);
    assert.equal(i.insertionPhase, 'idle', name);
  }
  const input = { value: 'previous.png', clicks: 0, click() { this.clicks++; } };
  const { i, stub } = editor({ insertionPhase: 'idle', insertionIntent: { valid: () => true }, session: session() });
  stub('prepareImageInsertion', () => {});
  stub('canInsertImage', () => ({ enabled: true }));
  i.renderRoot = { querySelector: () => input };
  i.openImageInsertionPicker();
  assert.deepEqual([input.value, input.clicks, i.insertionPhase, i.insertionAwaitingPicker], ['', 1, 'reading', true]);
});

test('a cancelled insertion returns focus to its trigger only while the same editor, session and popover remain', async () => {
  const changes = ['none', 'disconnected', 'another session', 'another generation', 'popover reopened'] as const;
  for (const change of changes) {
    const owner = session({ snapshot: () => ({ selection: { version: 1 }, activity: null }) });
    const popover = { open: false, hide: async () => {} };
    const trace = { cancelled: 0, lookups: 0, focused: 0 };
    const focus = { cancelled: false, cancel() { trace.cancelled++; this.cancelled = true; } };
    const trigger = { isConnected: true, updateComplete: Promise.resolve(true), focus: () => { trace.focused++; } };
    const { i, stub } = editor({ insertionPhase: 'reading', insertionIntent: {}, insertionGeneration: 4, session: owner });
    stub('insertionPopover', () => popover);
    stub('resetImageInsertion', () => {});
    stub('beginFocusReturn', () => focus);
    i.renderRoot = { querySelector: () => { trace.lookups++; return trigger; }, contains: () => true };
    i.cancelImageInsertion(true);
    if (change === 'disconnected') i.isConnected = false;
    if (change === 'another session') i.session = session({ snapshot: () => ({ selection: { version: 1 }, activity: null }) });
    if (change === 'another generation') i.insertionGeneration = 5;
    if (change === 'popover reopened') popover.open = true;
    await flush();
    // A changed editor is abandoned before its trigger is even looked up; an unchanged one gets its focus back.
    const unchanged = change === 'none';
    assert.deepEqual(trace, { cancelled: 1, lookups: unchanged ? 1 : 0, focused: unchanged ? 1 : 0 }, change);
  }
});

test('a picked image whose size changes while it is read is refused as over the limit', async () => {
  const limit = 4 * 1024 * 1024;
  const reads: [string, unknown][] = [
    ['emptied', new ArrayBuffer(0)], ['grown past the limit', new ArrayBuffer(limit + 1)], ['not an ArrayBuffer', new Uint8Array(8)],
  ];
  for (const [name, buffer] of reads) {
    const owner = session();
    const refusals: [unknown, unknown, unknown][] = [];
    const { i, stub } = editor({ session: owner, insertionIntent: { valid: () => true }, insertionGeneration: 2,
      insertionAwaitingPicker: true, insertionPhase: 'reading' });
    stub('insertionPopover', () => ({ show: async () => {}, open: true }));
    stub('refuseImageInsertion', (code: DocxRefusalCode, by: unknown, generation: number) => { refusals.push([code, by, generation]); });
    const input = { value: 'photo.png', files: { item: () => ({ size: 1024, arrayBuffer: async () => buffer }) } };
    await i.readImageInsertionFile({ currentTarget: input } as unknown as Event);
    assert.deepEqual(refusals, [['resource-limit', owner, 2]], name);
    assert.equal(input.value, '', `${name}: the input is cleared so the same file can be chosen again`);
  }
});

test('image navigation clears a stale error, announces an empty document politely once armed, and reports other refusals', () => {
  for (const armed of [false, true]) {
    const trace: string[] = [];
    const { i, stub } = editor({ announcementsArmed: armed, editError: 'stale-selection',
      politeSink: { announce: (message: string) => { trace.push(`announce:${message}`); } } });
    let next: DocxResult<void> = { ok: true, value: undefined };
    stub('selectImage', () => next);
    stub('localize', (key: string) => `[${key}]`);
    stub('reportEditRefusal', (code: DocxRefusalCode) => { trace.push(`refuse:${code}`); });
    i.navigateImage('next');
    assert.deepEqual([i.imageNavigationEmpty, i.editError, trace], [false, null, []], 'a selected image');
    next = refusal('no-selection');
    i.navigateImage('previous');
    assert.deepEqual([i.imageNavigationEmpty, trace], [true, armed ? ['announce:[docxEditorNoImage]'] : []], armed ? 'armed' : 'not armed');
    trace.length = 0;
    next = refusal('busy');
    i.navigateImage('next');
    assert.deepEqual([i.imageNavigationEmpty, trace], [false, ['refuse:busy']], 'another refusal is reported, never announced as empty');
  }
});

test('the description dialog is refused, and its image intent released, when the description cannot be read', () => {
  const calls: string[] = [];
  const { i, stub } = editor({ session: session(), imageIntent: { valid: () => true, description: () => refusal('unsupported') } });
  stub('releaseImageIntent', () => { calls.push('release'); });
  stub('reportEditRefusal', (code: DocxRefusalCode) => { calls.push(`refuse:${code}`); });
  i.openImageDialog({ preventDefault: () => { calls.push('prevent'); } } as unknown as Event, 'description');
  assert.deepEqual(calls, ['prevent', 'release', 'refuse:unsupported']);
});

test('the image dialogs do not open for a missing or stale image intent, and the intent is released', () => {
  for (const kind of ['resize', 'description'] as const) {
    for (const [name, stale] of [['no intent was captured', false], ['the intent went stale', true]] as const) {
      const calls: string[] = [];
      const intent = stale ? { valid: () => false, release: () => { calls.push('release'); } } : null;
      const { i } = editor({ session: session(), imageIntent: intent, imageDialog: null, imageDialogGeneration: 4 });
      i.openImageDialog({ preventDefault: () => { calls.push('prevent'); } } as unknown as Event, kind);
      // The dialog stays closed: the popover is told not to open and no dialog generation is started.
      assert.deepEqual([calls, i.imageIntent, i.imageDialog, i.imageDialogGeneration], [stale ? ['prevent', 'release'] : ['prevent'], null, null, 4], `${kind}: ${name}`);
    }
  }
});

test('an image edit without a captured intent is refused as stale, once', async () => {
  for (const fromDialog of [false, true]) {
    const calls: string[] = [];
    const { i, stub } = editor({ session: session(), sourceReadSequence: 7, imageDialogGeneration: 2, imageIntent: null });
    stub('syncSession', () => { calls.push('sync'); });
    stub('reportEditRefusal', (code: DocxRefusalCode) => { calls.push(`refuse:${code}`); });
    stub('releaseImageIntent', () => { calls.push('release'); });
    stub('closeImageDialog', () => { calls.push('close'); });
    stub('focusEditor', () => { calls.push('focus'); });
    await i.runImageEdit({ type: 'delete-image' }, fromDialog);
    assert.deepEqual(calls, fromDialog ? ['sync', 'refuse:stale-selection'] : ['sync', 'refuse:stale-selection', 'release'], String(fromDialog));
  }
});

test('a refused image edit reports the refusal, keeps focus where it was and drops a toolbar intent', async () => {
  for (const fromDialog of [false, true]) {
    const calls: string[] = [];
    const owner = session();
    const intent = { execute: async () => refusal('stale-selection') };
    const { i, stub } = editor({ session: owner, sourceReadSequence: 7, imageDialogGeneration: 2, imageIntent: intent });
    stub('syncSession', () => { calls.push('sync'); });
    stub('reportEditRefusal', (code: DocxRefusalCode) => { calls.push(`refuse:${code}`); });
    stub('releaseImageIntent', () => { calls.push('release'); i.imageIntent = null; });
    stub('closeImageDialog', () => { calls.push('close'); });
    stub('focusEditor', () => { calls.push('focus'); });
    await i.runImageEdit({ type: 'delete-image' }, fromDialog);
    assert.deepEqual(calls, fromDialog ? ['sync', 'refuse:stale-selection'] : ['sync', 'refuse:stale-selection', 'release'], String(fromDialog));
  }
});

test('an image edit that finishes after the document or intent changed reports nothing', async () => {
  const changes = ['document replaced', 'intent replaced', 'dialog reopened'] as const;
  for (const phase of ['while the command runs', 'while the session synchronizes'] as const) {
    for (const change of changes) {
      const calls: string[] = [];
      const intent = { execute: async () => refusal('stale-selection') };
      const { i, stub } = editor({ session: session(), sourceReadSequence: 1, imageDialogGeneration: 0, imageIntent: intent });
      const alter = () => {
        if (change === 'document replaced') i.sourceReadSequence++;
        if (change === 'intent replaced') i.imageIntent = {};
        if (change === 'dialog reopened') i.imageDialogGeneration++;
      };
      stub('syncSession', () => { calls.push('sync'); if (phase === 'while the session synchronizes') alter(); });
      stub('reportEditRefusal', (code: DocxRefusalCode) => { calls.push(`refuse:${code}`); });
      stub('releaseImageIntent', () => { calls.push('release'); });
      const pending = i.runImageEdit({ type: 'delete-image' });
      if (phase === 'while the command runs') alter();
      await pending;
      // The session only synchronizes for an edit that still belongs to the current document.
      assert.deepEqual(calls, phase === 'while the command runs' ? [] : ['sync'], `${change} ${phase}`);
    }
  }
});

test('a refused drag resize reports the refusal once and leaves focus where it was', async () => {
  const calls: string[] = [];
  const intent = {
    image: { widthPoints: 100, heightPoints: 50 },
    execute: async () => refusal('stale-revision'),
    release: () => { calls.push('release'); },
  };
  const { i, stub } = editor({ session: session(), sourceReadSequence: 1, imageDrag: { pointerId: 5, intent },
    imagePreview: { widthPoints: 200, heightPoints: 100 } });
  stub('syncSession', () => { calls.push('sync'); });
  stub('reportEditRefusal', (code: DocxRefusalCode) => { calls.push(`refuse:${code}`); });
  stub('focusEditor', () => { calls.push('focus'); });
  await i.endImageDrag({ pointerId: 5, preventDefault: () => { calls.push('prevent'); } } as unknown as PointerEvent);
  assert.deepEqual(calls, ['prevent', 'sync', 'refuse:stale-revision']);
  assert.equal(i.imageDrag, null);
  assert.equal(i.imagePreview, null);
});

test('a drag that ends without a preview or back at the original size releases its intent and runs no command', async () => {
  const original = { widthPoints: 100, heightPoints: 50 };
  const box = { left: 0, top: 0, width: 40, height: 20 };
  const cases: [string, unknown][] = [
    ['without a preview', null],
    ['at the original size', { ...box, ...original }],
    // Sizes are stored in whole EMUs, so a difference below one EMU is no change at all.
    ['within the same stored size', { ...box, widthPoints: 100.00001, heightPoints: 50.00001 }],
  ];
  for (const [name, preview] of cases) {
    const calls: string[] = [];
    const intent = { image: original, execute: async () => { calls.push('execute'); return refusal('stale-revision'); }, release: () => { calls.push('release'); } };
    const { i, stub } = editor({ session: session(), sourceReadSequence: 1, imageDrag: { pointerId: 5, intent }, imagePreview: preview });
    stub('syncSession', () => { calls.push('sync'); });
    stub('reportEditRefusal', (code: DocxRefusalCode) => { calls.push(`refuse:${code}`); });
    stub('focusEditor', () => { calls.push('focus'); });
    await i.endImageDrag({ pointerId: 5, preventDefault: () => { calls.push('prevent'); } } as unknown as PointerEvent);
    assert.deepEqual(calls, ['prevent', 'release'], name);
    assert.deepEqual([i.imageDrag, i.imagePreview], [null, null], name);
  }
});

test('only history commands stay available without a text selection', () => {
  const snapshot = { status: 'ready', readOnly: false, activity: null, composing: false };
  for (const lease of [null, {}]) {
    const { i, stub } = editor({ currentSnapshot: snapshot, openInProgress: false, commandIntent: { lease } });
    stub('commandIntentValid', () => true);
    stub('can', () => ({ enabled: true }));
    const availability = (action: string) => i.commandAvailability({ action });
    assert.deepEqual(availability('bold'), lease ? { enabled: true } : { enabled: false, reason: 'no-selection' }, `bold with${lease ? '' : 'out'} a selection`);
    assert.deepEqual(availability('undo'), { enabled: true });
    assert.deepEqual(availability('redo'), { enabled: true });
  }
});

test('commands are held back while a document opens or an operation runs, and while text is composed', () => {
  const ready = { status: 'ready', readOnly: false, activity: null, composing: false };
  const busy = { enabled: false, reason: 'busy' }, composing = { enabled: false, reason: 'composing' };
  const cases: [string, Record<string, unknown>, boolean, boolean, unknown, unknown][] = [
    // name, snapshot, document opening, selection still current, command, expected availability
    ['a document is opening', ready, true, true, { action: 'bold' }, busy],
    ['an operation is running', { ...ready, activity: 'saving' }, false, true, { action: 'bold' }, busy],
    ['text is being composed', { ...ready, composing: true }, false, true, { action: 'bold' }, composing],
    ['an operation outranks composition', { ...ready, activity: 'saving', composing: true }, false, true, { action: 'bold' }, busy],
    ['New waits for the operation too', { ...ready, activity: 'saving' }, false, true, { intent: 'new' }, busy],
    ['Open waits for composition', { ...ready, composing: true }, false, true, { intent: 'open' }, composing],
    ['a moved selection outranks both', { ...ready, activity: 'saving', composing: true }, true, false, { action: 'bold' }, { enabled: false, reason: 'stale-selection' }],
    ['an idle editor offers New', ready, false, true, { intent: 'new' }, { enabled: true }],
  ];
  for (const [name, snapshot, openInProgress, current, item, expected] of cases) {
    let consulted = 0;
    const { i, stub } = editor({ currentSnapshot: snapshot, openInProgress });
    stub('commandIntentValid', () => current);
    stub('can', () => { consulted++; return { enabled: true }; });
    assert.deepEqual(i.commandAvailability(item), expected, name);
    assert.equal(consulted, 0, `${name}: the document is not asked`);
  }
});

test('a refused New returns focus to the New button, an accepted one to the document, a superseded one to neither', async () => {
  const outcomes: [string, DocxResult<unknown>, number, string[]][] = [
    ['refused', refusal('open-failed'), 1, ['[part="new-button"]']],
    ['accepted', { ok: true, value: { documentId: 'document', value: 0 } }, 1, ['editor']],
    ['superseded', refusal('open-failed'), 2, []],
  ];
  for (const [name, result, reads, focused] of outcomes) {
    const calls: string[] = [];
    const { i, stub } = editor({ sourceReadSequence: 0 });
    stub('newDocument', async () => { i.sourceReadSequence += reads; return result; });
    stub('focusEditor', () => { calls.push('editor'); });
    i.renderRoot = { querySelector: (selector: string) => ({ focus: () => { calls.push(selector); } }) };
    i.newFromToolbar();
    await flush();
    assert.deepEqual(calls, focused, name);
  }
});

test('a selection lease taken for an image that cannot be replaced is released at once, and a usable one is kept', () => {
  const cases: [string, { image: unknown; enabled: boolean; leased: boolean }, 'kept' | 'released' | 'none'][] = [
    ['no image selected', { image: null, enabled: true, leased: true }, 'released'],
    ['replacement unavailable', { image: {}, enabled: false, leased: true }, 'released'],
    ['no lease granted', { image: {}, enabled: true, leased: false }, 'none'],
    ['replaceable image', { image: {}, enabled: true, leased: true }, 'kept'],
  ];
  for (const [name, { image, enabled, leased }, outcome] of cases) {
    let released = 0;
    const lease = { release: () => { released++; } };
    const owner = session({
      retainSelection: () => leased ? { ok: true, value: lease } : refusal('no-selection'),
      snapshot: () => ({ image, revision: { documentId: 'document', value: 1 }, selection: { version: 3 } }),
    });
    const { i, stub } = editor({ session: owner, imageReplacementIntent: null });
    stub('intentValid', () => false);
    stub('resetImageReplacement', () => {});
    stub('releaseToolbarSelection', () => {});
    stub('canReplaceImage', () => ({ enabled }));
    i.prepareImageReplacement();
    assert.equal(released, outcome === 'released' ? 1 : 0, name);
    assert.equal(i.imageReplacementIntent !== null, outcome === 'kept', name);
    if (outcome === 'kept') assert.equal((i.imageReplacementIntent as { lease: unknown }).lease, lease, name);
  }
});

test('replacement feedback names limit, invalid and unsupported causes, and otherwise a stale or generic refusal', () => {
  const { i, stub } = editor();
  stub('localize', (key: string) => key);
  const expected: [DocxRefusalCode, string][] = [
    ['stale-selection', 'docxEditorReplaceImageStale'], ['stale-revision', 'docxEditorReplaceImageStale'],
    ['resource-limit', 'docxEditorImageInsertLimit'], ['invalid-document', 'docxEditorImageInsertInvalid'],
    ['unsupported', 'docxEditorImageInsertUnsupported'],
    ['engine-failed', 'docxEditorReplaceImageRefused'], ['busy', 'docxEditorReplaceImageRefused'],
  ];
  assert.deepEqual(expected.map(([code]) => i.replacementFeedback(code)), expected.map(([, key]) => key));
});

// --- Keyboard and toolbar event handlers -------------------------------------------------------------
//
// These handlers read DOM classes and nodes. The doubles below stand in for exactly the surface each handler
// touches, and the page globals they rely on are installed for one test and restored afterwards.

class DoubleNode {}
class DoubleElement extends DoubleNode {
  constructor(readonly attributes: Record<string, string> = {}, readonly localName = 'div') { super(); }
  getAttribute(name: string): string | null { return this.attributes[name] ?? null; }
  hasAttribute(name: string): boolean { return name in this.attributes; }
  contains(node: unknown): boolean { return node === this; }
}

function withPageGlobals(context: { after(callback: () => void): void }) {
  const names = ['Node', 'HTMLElement'] as const;
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  Object.defineProperty(globalThis, 'Node', { value: DoubleNode, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'HTMLElement', { value: DoubleElement, configurable: true, writable: true });
  context.after(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as Record<string, unknown>)[name];
    }
  });
}

interface KeyInit {
  key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean;
  isComposing?: boolean; keyCode?: number; defaultPrevented?: boolean;
}

function keyEvent(init: KeyInit, path: unknown[] = []) {
  const trace = { prevented: 0, stopped: 0 };
  const event = {
    key: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, keyCode: 0, defaultPrevented: false,
    ...init,
    composedPath: () => path,
    preventDefault() { trace.prevented++; },
    stopPropagation() { trace.stopped++; },
  } as unknown as KeyboardEvent;
  return { event, trace };
}

const idle = { composing: false, activity: null, status: 'ready', readOnly: false };

/** An editor whose commands, find and save entry points only record that they were reached. */
function chordEditor(snapshot: Record<string, unknown> = idle, state: Partial<Internals> = {}) {
  const mount = new DoubleElement();
  const reached: string[] = [];
  const { i, stub } = editor({ currentSnapshot: snapshot, mount, commandsOpen: false,
    renderRoot: { querySelector: () => null, contains: () => false }, ...state });
  stub('ownFocus', () => null);
  stub('openCommands', () => { reached.push('commands'); });
  stub('showFind', () => { reached.push('find'); });
  stub('save', async () => { reached.push('save'); return refusal('busy'); });
  stub('handoffImageInsertion', () => { reached.push('handoff'); });
  const tools = new DoubleElement({ part: 'commands-button' });
  return { i, stub, mount, tools, reached, keydown: (event: KeyboardEvent) => { i.onHostKeyDown(event); } };
}

test('a key that is composing, repeating, modified or already handled never starts a document chord', context => {
  withPageGlobals(context);
  const unfit: [string, KeyInit][] = [
    ['already handled', { defaultPrevented: true }], ['composing', { isComposing: true }], ['IME keycode', { keyCode: 229 }],
    ['auto-repeat', { repeat: true }], ['with Shift', { shiftKey: true }], ['with Alt', { altKey: true }],
    ['with both Control and Meta', { ctrlKey: true, metaKey: true }],
  ];
  for (const key of ['k', 'f', 's']) {
    for (const [name, init] of unfit) {
      const { i, mount, reached, keydown } = chordEditor();
      const { event, trace } = keyEvent({ key, ctrlKey: true, ...init }, [mount]);
      assert.equal(i.commandsOpen, false);
      keydown(event);
      assert.deepEqual([reached, trace], [[], { prevented: 0, stopped: 0 }], `${key} ${name}`);
    }
  }
});

test('Control or Meta+K opens the commands from the document or the commands button, never mid-activity', context => {
  withPageGlobals(context);
  const cases: [string, KeyInit, 'document' | 'button' | 'elsewhere', Record<string, unknown>, boolean][] = [
    ['Control in the document', { ctrlKey: true }, 'document', idle, true],
    ['Meta in the document', { metaKey: true }, 'document', idle, true],
    ['Control on the commands button', { ctrlKey: true }, 'button', idle, true],
    ['Control with upper-case K', { ctrlKey: true, key: 'K' }, 'document', idle, true],
    ['Control outside the editor surface', { ctrlKey: true }, 'elsewhere', idle, false],
    ['Control while an operation runs', { ctrlKey: true }, 'document', { ...idle, activity: 'saving' }, false],
    ['Control while composing text', { ctrlKey: true }, 'document', { ...idle, composing: true }, false],
  ];
  for (const [name, init, origin, snapshot, opens] of cases) {
    const { mount, tools, reached, keydown } = chordEditor(snapshot);
    const path = origin === 'document' ? [new DoubleElement(), mount] : origin === 'button' ? [tools] : [new DoubleElement()];
    const { event, trace } = keyEvent({ key: 'k', ...init }, path);
    keydown(event);
    assert.deepEqual([reached, trace], opens ? [['commands'], { prevented: 1, stopped: 1 }] : [[], { prevented: 0, stopped: 0 }], name);
  }
});

test('Control+F and Control+S act on the document only while the editor is idle and no palette is open', context => {
  withPageGlobals(context);
  const cases: [string, string, 'document' | 'button', Record<string, unknown>, boolean, string[]][] = [
    ['find in the document', 'f', 'document', idle, false, ['find']],
    ['save in the document', 's', 'document', idle, false, ['save']],
    ['find on the commands button', 'f', 'button', idle, false, []],
    ['save on the commands button', 's', 'button', idle, false, []],
    ['find with the palette open', 'f', 'document', idle, true, []],
    ['save with the palette open', 's', 'document', idle, true, []],
    ['find while an operation runs', 'f', 'document', { ...idle, activity: 'saving' }, false, []],
    ['save while composing', 's', 'document', { ...idle, composing: true }, false, []],
    ['save before a document is ready', 's', 'document', { ...idle, status: 'idle' }, false, []],
  ];
  for (const [name, key, origin, snapshot, commandsOpen, expected] of cases) {
    const { mount, tools, reached, keydown } = chordEditor(snapshot, { commandsOpen });
    const { event, trace } = keyEvent({ key, ctrlKey: true }, origin === 'document' ? [mount] : [tools]);
    keydown(event);
    assert.deepEqual([reached, trace], expected.length ? [expected, { prevented: 1, stopped: 1 }] : [[], { prevented: 0, stopped: 0 }], name);
  }
});

test('Alt+F10 holds the selection and focuses Bold, else the first enabled tool, else the New button', context => {
  withPageGlobals(context);
  const tool = (key: string, focused: string[]) => ({ getAttribute: () => key, focus: () => { focused.push(key); } });
  const cases: [string, string[], string[], string][] = [
    ['Bold among others', ['italic', 'bold', 'underline'], ['bold'], 'bold'],
    ['no Bold', ['italic', 'underline'], ['italic'], 'italic'],
    ['no enabled tool', [], ['new-button'], 'bold'],
  ];
  for (const [name, keys, focusedExpected, toolbarKey] of cases) {
    const focused: string[] = [];
    const { i, stub, keydown } = chordEditor(idle, { toolbarKey: 'bold' });
    let retained = 0;
    stub('retainToolbarSelection', () => { retained++; });
    stub('enabledToolbarButtons', () => keys.map(key => tool(key, focused)));
    i.renderRoot = { querySelector: () => ({ focus: () => { focused.push('new-button'); } }) };
    const { event, trace } = keyEvent({ key: 'F10', altKey: true });
    keydown(event);
    assert.deepEqual([focused, i.toolbarKey, retained, trace], [focusedExpected, toolbarKey, 1, { prevented: 1, stopped: 1 }], name);
  }
});

test('Alt+F10 on a first tool that has no readable key hands the roving stop to Bold', context => {
  withPageGlobals(context);
  const focused: string[] = [];
  const { i, stub, keydown } = chordEditor(idle, { toolbarKey: 'italic' });
  stub('retainToolbarSelection', () => {});
  stub('enabledToolbarButtons', () => [{ getAttribute: () => null, focus: () => { focused.push('keyless'); } }]);
  const { event, trace } = keyEvent({ key: 'F10', altKey: true });
  keydown(event);
  assert.deepEqual([focused, i.toolbarKey, trace], [['keyless'], 'bold', { prevented: 1, stopped: 1 }]);
});

/** A toolbar tool that records being focused. */
class Tool extends DoubleElement {
  constructor(readonly key: string, private readonly focused: string[]) { super({ 'data-tool-key': key }); }
  focus() { this.focused.push(this.key); }
}

/** A toolbar editor whose focus sits on a tool of its own toolbar, in the given reading direction. */
function toolbarEditor(direction: 'ltr' | 'rtl', enabled: () => unknown[]) {
  const { i, stub, keydown } = chordEditor(idle, { toolbarKey: 'b', renderRoot: { querySelector: () => null, contains: () => true } });
  Object.defineProperty(i, 'effectiveDirection', { value: direction, configurable: true });
  stub('enabledToolbarButtons', enabled);
  return { i, keydown };
}

test('arrow keys, Home and End move focus between the enabled tools, wrap around and mirror under right-to-left', context => {
  withPageGlobals(context);
  const cases: [string, string, 'ltr' | 'rtl', number, string][] = [
    // name, key, reading direction, index of the focused tool, key of the tool that receives focus
    ['ArrowRight moves forward', 'ArrowRight', 'ltr', 1, 'c'],
    ['ArrowLeft moves back', 'ArrowLeft', 'ltr', 1, 'a'],
    ['ArrowRight wraps from the last tool', 'ArrowRight', 'ltr', 2, 'a'],
    ['ArrowLeft wraps from the first tool', 'ArrowLeft', 'ltr', 0, 'c'],
    ['Home goes to the first tool', 'Home', 'ltr', 1, 'a'],
    ['End goes to the last tool', 'End', 'ltr', 1, 'c'],
    ['ArrowLeft moves forward under right-to-left', 'ArrowLeft', 'rtl', 1, 'c'],
    ['ArrowRight moves back under right-to-left', 'ArrowRight', 'rtl', 1, 'a'],
  ];
  for (const [name, key, direction, from, expected] of cases) {
    const focused: string[] = [];
    const tools = ['a', 'b', 'c'].map(toolKey => new Tool(toolKey, focused));
    const { i, keydown } = toolbarEditor(direction, () => tools);
    const { event, trace } = keyEvent({ key }, [tools[from]!]);
    keydown(event);
    assert.deepEqual([focused, i.toolbarKey, trace.prevented], [[expected], expected, 1], name);
  }
});

test('arrow keys on a toolbar tool keep their default action while no tool is enabled', context => {
  withPageGlobals(context);
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    const focused: string[] = [];
    const { i, keydown } = toolbarEditor('ltr', () => []);
    const { event, trace } = keyEvent({ key }, [new Tool('b', focused)]);
    keydown(event);
    assert.deepEqual([focused, i.toolbarKey, trace], [[], 'b', { prevented: 0, stopped: 0 }], key);
  }
});

test('arrow navigation onto a tool without a readable key hands the roving stop to Bold', context => {
  withPageGlobals(context);
  const focused: string[] = [];
  const keyless = { getAttribute: () => null, focus: () => { focused.push('keyless'); } };
  const { i, keydown } = toolbarEditor('ltr', () => [keyless]);
  const { event, trace } = keyEvent({ key: 'ArrowRight' }, [new Tool('italic', focused)]);
  keydown(event);
  assert.deepEqual([focused, i.toolbarKey, trace.prevented], [['keyless'], 'bold', 1]);
});

test('Escape is claimed by an active image drag, and by the open insertion dialog, before anything else', context => {
  withPageGlobals(context);
  const drag = chordEditor(idle, { imageDrag: { pointerId: 1 } });
  const cancelled: string[] = [];
  drag.stub('cancelImageDrag', () => { cancelled.push('drag'); });
  const dragKey = keyEvent({ key: 'Escape' });
  drag.keydown(dragKey.event);
  assert.deepEqual([cancelled, dragKey.trace], [['drag'], { prevented: 1, stopped: 1 }]);

  for (const phase of ['reading', 'draft']) {
    const dialog = new DoubleElement({ part: 'image-insert-dialog' });
    const insertion = chordEditor(idle, { insertionPhase: phase });
    const returned: boolean[] = [];
    insertion.stub('cancelImageInsertion', (returnFocus: boolean) => { returned.push(returnFocus); });
    const inside = keyEvent({ key: 'Escape' }, [dialog]);
    insertion.keydown(inside.event);
    assert.deepEqual([returned, inside.trace], [[true], { prevented: 1, stopped: 1 }], `${phase} inside the dialog`);
    const outside = keyEvent({ key: 'Escape' }, [new DoubleElement()]);
    returned.length = 0;
    insertion.keydown(outside.event);
    assert.deepEqual(returned, [], `${phase} outside the dialog leaves the insertion open`);
  }

  const idleIntent = chordEditor(idle, { insertionPhase: 'idle', insertionIntent: {} });
  const released: boolean[] = [];
  idleIntent.stub('cancelImageInsertion', (returnFocus: boolean) => { released.push(returnFocus); });
  const quiet = keyEvent({ key: 'Escape' });
  idleIntent.keydown(quiet.event);
  assert.deepEqual([released, quiet.trace], [[false], { prevented: 0, stopped: 0 }], 'a captured but unopened insertion is dropped without claiming the key');
});

test('Enter and Space hand the key to image insertion only when they activate a tool outside composition', context => {
  withPageGlobals(context);
  const cases: [string, KeyInit, string[]][] = [
    ['Enter', { key: 'Enter' }, ['handoff']], ['Space', { key: ' ' }, ['handoff']],
    ['another key', { key: 'a' }, []], ['Tab', { key: 'Tab' }, []],
    ['Enter while composing', { key: 'Enter', isComposing: true }, []],
    ['Enter with the IME keycode', { key: 'Enter', keyCode: 229 }, []],
  ];
  for (const [name, init, expected] of cases) {
    const { reached, keydown } = chordEditor();
    keydown(keyEvent(init).event);
    assert.deepEqual(reached, expected, name);
  }
});

test('the activation key is the same for every tool that prepares an intent', () => {
  const activation: [string, KeyInit, boolean][] = [
    ['Enter', { key: 'Enter', keyCode: 13 }, true], ['Space', { key: ' ', keyCode: 32 }, true],
    ['letter', { key: 'a', keyCode: 65 }, false], ['composing Enter', { key: 'Enter', isComposing: true }, false],
    ['IME Enter', { key: 'Enter', keyCode: 229 }, false],
  ];
  for (const method of ['onImageInsertionKey', 'onImageActivationKey']) {
    for (const [name, init, activates] of activation) {
      const { i, stub } = editor();
      let prepared = 0;
      stub(method === 'onImageInsertionKey' ? 'prepareImageInsertion' : 'prepareImageIntent', () => { prepared++; });
      i[method === 'onImageInsertionKey' ? 'onImageInsertionKey' : 'onImageActivationKey'](keyEvent(init).event);
      assert.equal(prepared, activates ? 1 : 0, `${method} ${name}`);
    }
  }
});

test('scroll and layout changes schedule one frame that refreshes the image frame and charts', () => {
  const frames: (() => void)[] = [];
  const trace: string[] = [];
  const { i, stub } = editor({ ownerDocument: { defaultView: { requestAnimationFrame: (callback: () => void) => frames.push(callback) } } as never });
  stub('syncImageFrame', () => { trace.push('image'); });
  stub('syncCharts', () => { trace.push('charts'); });
  const schedule = () => { i.scheduleImageFrame(); };
  schedule(); schedule(); schedule();
  assert.equal(frames.length, 1, 'repeated requests before the frame coalesce');
  assert.deepEqual(trace, []);
  frames[0]!();
  assert.deepEqual(trace, ['image', 'charts']);
  assert.equal(i.imageFrameRequest, 0, 'the request is released so the next change can schedule again');
  schedule();
  assert.equal(frames.length, 2);
});

test('a detached editor has no window to schedule a frame on', () => {
  const { i } = editor({ ownerDocument: { defaultView: null } } as never);
  i.scheduleImageFrame();
  assert.equal(i.imageFrameRequest, 0);
});

test('choosing a palette command keeps it only while it is known and still available', () => {
  const known = { id: 'bold' };
  for (const [name, command, enabled, selected] of [
    ['available command', 'known', true, known], ['unavailable command', 'known', false, null], ['unknown command', 'other', true, null],
  ] as const) {
    const { i, stub } = editor();
    i.commandSources = new Map([['known', known]]) as never;
    i.selectedCommand = null;
    stub('commandAvailability', () => ({ enabled }));
    let stopped = 0;
    i.onCommandSelected({ stopPropagation: () => { stopped++; }, detail: { command } });
    assert.deepEqual([i.selectedCommand, stopped], [selected, 1], name);
  }
});

test('an open tool panel silences its trigger tooltips, and closing it forgets the trigger', context => {
  withPageGlobals(context);
  const popover = tag('popover');
  const panel = (id: string | null, localName = popover) => ({ localName, querySelector: () => id === null ? null : { id } });
  const tooltips = (open: boolean[], hidden: number[]) => open.map((isOpen, index) => ({ open: isOpen, hide: async () => { hidden.push(index); } }));
  const hidden: number[] = [];
  const { i } = editor({ renderRoot: { querySelectorAll: () => tooltips([true, false, true], hidden) } });
  const show = (event: unknown) => { i.onToolbarPanelShow(event); };
  const hide = (event: unknown) => { i.onToolbarPanelHidden(event); };

  show({ target: panel('tool-text-color'), defaultPrevented: true });
  show({ target: panel('tool-text-color', 'div'), defaultPrevented: false });
  show({ target: null, defaultPrevented: false });
  assert.deepEqual([i.openPanelTrigger, hidden], [null, []], 'foreign, null and refused panels change nothing');

  show({ target: panel('tool-text-color'), defaultPrevented: false });
  assert.deepEqual([i.openPanelTrigger, hidden], ['tool-text-color', [0, 2]], 'only open tooltips are hidden');
  show({ target: panel(null), defaultPrevented: false });
  assert.equal(i.openPanelTrigger, null, 'a panel without a trigger records none');

  i.openPanelTrigger = 'tool-text-color';
  hide({ target: panel('tool-highlight') });
  hide({ target: panel('tool-text-color', 'div') });
  assert.equal(i.openPanelTrigger, 'tool-text-color', 'another panel closing keeps the recorded trigger');
  hide({ target: panel('tool-text-color') });
  assert.equal(i.openPanelTrigger, null);
});

test('focus entering the toolbar remembers the focused tool for the roving tab stop', context => {
  withPageGlobals(context);
  const inside = new DoubleElement({ 'data-tool-key': 'italic' });
  const outside = new DoubleElement({ 'data-tool-key': 'underline' });
  const plain = new DoubleElement();
  const { i } = editor({ toolbarKey: 'bold', renderRoot: { contains: (node: unknown) => node !== outside } });
  const focusIn = (event: unknown) => { i.onToolbarFocusIn(event); };
  focusIn({ composedPath: () => [plain, inside] });
  assert.equal(i.toolbarKey, 'italic', 'the first tool in the path inside the toolbar wins');
  focusIn({ composedPath: () => [plain] });
  focusIn({ composedPath: () => [outside] });
  assert.equal(i.toolbarKey, 'italic', 'focus on a non-tool or on a tool outside this toolbar keeps the stop');
});

test('focus entering a tool whose key cannot be read hands the roving stop to Bold', context => {
  withPageGlobals(context);
  // Tools are found by their key attribute; this one claims the attribute but has no value to read.
  class UnreadableTool extends DoubleElement {
    override hasAttribute(): boolean { return true; }
    override getAttribute(): string | null { return null; }
  }
  const { i } = editor({ toolbarKey: 'italic', renderRoot: { contains: () => true } });
  i.onToolbarFocusIn({ composedPath: () => [new UnreadableTool()] });
  assert.equal(i.toolbarKey, 'bold');
});

test('a picked document file opens once, then focuses the document or the Open button, unless superseded', async () => {
  const outcomes: [string, DocxResult<unknown>, number, string[]][] = [
    ['accepted', { ok: true, value: { documentId: 'document', value: 0 } }, 0, ['editor']],
    ['refused', refusal('invalid-document'), 0, ['[part="open-button"]']],
    ['superseded', refusal('invalid-document'), 1, []],
  ];
  for (const [name, result, supersededBy, focused] of outcomes) {
    const calls: unknown[] = [];
    const file = { name: 'report.docx' };
    const { i, stub } = editor({ sourceReadSequence: 0 });
    // Opening a file always starts a new source read; a superseded one is followed by yet another.
    stub('open', async (picked: unknown) => { calls.push(picked); i.sourceReadSequence += 1 + supersededBy; return result; });
    stub('focusEditor', () => { calls.push('editor'); });
    i.renderRoot = { querySelector: (selector: string) => ({ focus: () => { calls.push(selector); } }) };
    const input = { value: 'C:\\fakepath\\report.docx', files: { item: () => file } };
    i.onFileSelected({ currentTarget: input });
    assert.equal(input.value, '', `${name}: the input is cleared so the same file can be picked again`);
    await flush();
    assert.deepEqual(calls, [file, ...focused], name);
  }
  const none = editor({ sourceReadSequence: 0 });
  let opened = 0;
  none.stub('open', async () => { opened++; return refusal('invalid-option'); });
  const cancelled = { value: 'x', files: { item: () => null } };
  none.i.onFileSelected({ currentTarget: cancelled });
  await flush();
  assert.deepEqual([opened, cancelled.value], [0, ''], 'cancelling the picker opens nothing');
});
