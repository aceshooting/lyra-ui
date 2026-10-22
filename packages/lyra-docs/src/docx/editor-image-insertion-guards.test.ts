import assert from 'node:assert/strict';
import test from 'node:test';
import { editor, flush, session, type Internals } from '../../test/docx-editor-harness.js';
import { imageInsertionBytes } from '../../test/corpus.js';
import { DOCX_EDITOR_STRINGS } from './strings.js';
import type { DocxRefusalCode } from './types.js';

/**
 * What becomes of a picked image while the editor, its session or its dialog may change underneath the read.
 * The insertion goes on only while the caret it was started for is still the editor's, is cancelled quietly
 * when the dialog does not open, and is refused with feedback when the selection moved. A continuation that
 * belongs to a replaced document or insertion never touches the newer state.
 */

interface Trace { released: number; shown: number; read: number; focused: number; hidden: unknown[]; announced: string[] }
type Stage = 'picked' | 'rendering' | 'showing';

/** An editor that has just been handed a file by the picker, with every collaborator the continuation touches recorded. */
function pickerEditor(options: {
  files?: 'picked' | 'cancelled' | 'unavailable'; dialog?: 'opens' | 'stays-closed' | 'absent'; image?: Uint8Array; size?: number;
  state?: Partial<Internals>;
} = {}) {
  const { files = 'picked', dialog = 'opens', image, size, state = {} } = options;
  const trace: Trace = { released: 0, shown: 0, read: 0, focused: 0, hidden: [], announced: [] };
  const world = { selectionMoved: false, whileRendering: () => {}, whileShowing: () => {} };
  const owner = session({ snapshot: () => ({ selection: { version: 1 }, activity: null }) });
  const intent = { valid: () => !world.selectionMoved, release: () => { trace.released++; } };
  const popover = {
    open: false,
    show: async () => { trace.shown++; popover.open = dialog === 'opens'; world.whileShowing(); },
    hide: async (hideOptions: unknown) => { trace.hidden.push(hideOptions); },
  };
  const file = {
    size: size ?? image?.length ?? 1024,
    arrayBuffer: async () => { trace.read++; return image ? Uint8Array.from(image).buffer : new ArrayBuffer(16); },
  };
  const input = { value: 'photo.png', files: files === 'unavailable' ? null : { item: () => files === 'picked' ? file : null } };
  const trigger = { isConnected: true, updateComplete: Promise.resolve(true), focus: () => { trace.focused++; } };
  const width = { focused: 0, focus() { this.focused++; } };
  const parts: Record<string, unknown> = {
    '[part="image-insert-dialog"]': dialog === 'absent' ? null : popover,
    '[part="image-insert-trigger"]': trigger,
    '[part="image-insert-file"]': input,
    '[part="image-insert-width"]': width,
  };
  const { i, stub } = editor({
    session: owner, insertionIntent: intent, insertionGeneration: 3, insertionAwaitingPicker: true, insertionPhase: 'reading',
    announcementsArmed: true, assertiveSink: { announce: (message: string) => { trace.announced.push(message); } },
    renderRoot: { querySelector: (selector: string) => parts[selector] ?? null, contains: () => true }, ...state,
  });
  const focus = { cancelled: false, cancel() { this.cancelled = true; } };
  stub('localize', (key: string) => key);
  stub('beginFocusReturn', () => focus);
  Object.defineProperty(i, 'updateComplete', {
    get: () => Promise.resolve().then(() => { world.whileRendering(); return true; }), configurable: true,
  });
  const pick = () => i.readImageInsertionFile({ currentTarget: input } as unknown as Event);
  /** Runs `change` at the given point of the read: before it starts, while the editor re-renders, or while the dialog opens. */
  const alter = (stage: Stage, change: () => void) => {
    if (stage === 'picked') change();
    else if (stage === 'rendering') world.whileRendering = change;
    else world.whileShowing = change;
  };
  return { i, stub, trace, world, owner, intent, input, popover, width, pick, alter };
}

const outcome = ({ i, trace }: Pick<ReturnType<typeof pickerEditor>, 'i' | 'trace'>) =>
  ({ error: i.insertionError, phase: i.insertionPhase, ...trace });

test('the insertion picker leaves an insertion that is already being read, drafted or dispatched alone', () => {
  for (const phase of ['reading', 'draft', 'dispatched']) {
    const trace: string[] = [];
    const { i, stub } = editor({ insertionPhase: phase, insertionIntent: { valid: () => true }, session: session() });
    stub('prepareImageInsertion', () => { trace.push('prepare'); });
    stub('canInsertImage', () => { trace.push('availability'); return { enabled: true }; });
    stub('cancelImageInsertion', (returnFocus: boolean) => { trace.push(`cancel:${returnFocus}`); });
    i.renderRoot = { querySelector: () => { throw new Error('the file input must not be looked up'); } };
    i.openImageInsertionPicker();
    assert.deepEqual([trace, i.insertionPhase, i.insertionAwaitingPicker], [[], phase, false], phase);
  }
});

test('a file change that nothing is waiting for only clears the input', async () => {
  const cases: [string, Partial<Internals>][] = [
    ['no picker was opened by the editor', { insertionAwaitingPicker: false, insertionPhase: 'reading' }],
    ['the insertion is already drafted', { insertionAwaitingPicker: true, insertionPhase: 'draft' }],
    ['the insertion was cancelled', { insertionAwaitingPicker: true, insertionPhase: 'idle' }],
  ];
  for (const [name, state] of cases) {
    const ctx = pickerEditor({ state });
    await ctx.pick();
    assert.deepEqual(outcome(ctx), { error: null, phase: state.insertionPhase, released: 0, shown: 0, read: 0, focused: 0, hidden: [], announced: [] }, name);
    assert.equal(ctx.input.value, '', `${name}: the input is cleared so the same file can be chosen again`);
    assert.equal(ctx.i.insertionAwaitingPicker, state.insertionAwaitingPicker, `${name}: the wait is not consumed`);
    assert.equal(ctx.i.insertionIntent, ctx.intent, `${name}: the captured intent is kept`);
  }
});

test('cancelling the file picker cancels the insertion and returns focus to its trigger', async () => {
  for (const files of ['cancelled', 'unavailable'] as const) {
    const ctx = pickerEditor({ files, dialog: 'stays-closed' });
    await ctx.pick();
    await flush();
    assert.deepEqual(outcome(ctx), { error: null, phase: 'idle', released: 1, shown: 0, read: 0, focused: 1,
      hidden: [{ focusTrigger: false }], announced: [] }, files);
    assert.equal(ctx.i.insertionAwaitingPicker, false, files);
    assert.equal(ctx.i.insertionIntent, null, files);
  }
});

test('a picked image is refused as stale when the selection moved before, while or after the dialog opened', async () => {
  const stages: [string, Stage, number][] = [
    ['before the editor re-rendered', 'picked', 0], ['while the editor re-rendered', 'rendering', 0], ['while the dialog opened', 'showing', 1],
  ];
  for (const [name, stage, shown] of stages) {
    const ctx = pickerEditor();
    ctx.alter(stage, () => { ctx.world.selectionMoved = true; });
    await ctx.pick();
    // The insertion is cancelled without returning focus, and the user is told to choose the caret again.
    assert.deepEqual(outcome(ctx), { error: 'stale-selection', phase: 'idle', released: 1, shown, read: 0, focused: 0,
      hidden: [{ focusTrigger: false }], announced: ['docxEditorImageInsertStale'] }, name);
    assert.equal(ctx.i.insertionIntent, null, name);
    assert.equal(ctx.input.value, '', name);
  }
});

test('an oversized picked file is reported as over the limit unless the selection already moved', async () => {
  const oversized = 5 * 1024 * 1024;
  const cases = [
    ['a stale selection', true, 'stale-selection', 'docxEditorImageInsertStale'],
    ['a current selection', false, 'resource-limit', 'docxEditorImageInsertLimit'],
  ] as const;
  for (const [name, selectionMoved, error, feedback] of cases) {
    const ctx = pickerEditor({ size: oversized });
    ctx.world.selectionMoved = selectionMoved;
    await ctx.pick();
    // Either way the dialog is never shown and the file is never read.
    assert.deepEqual(outcome(ctx), { error, phase: 'idle', released: 1, shown: 0, read: 0, focused: 0,
      hidden: [{ focusTrigger: false }], announced: [feedback] }, name);
  }
});

test('a picked image is dropped without touching the editor once its editor, document or insertion was replaced', async () => {
  // The read captures its document and insertion when it starts, so only a disconnect can precede it.
  const changes: [string, readonly Stage[], (ctx: ReturnType<typeof pickerEditor>) => void][] = [
    ['the editor was disconnected', ['picked', 'rendering', 'showing'], ctx => { ctx.i.isConnected = false; }],
    ['another document was opened', ['rendering', 'showing'],
      ctx => { ctx.i.session = session({ snapshot: () => ({ selection: { version: 1 }, activity: null }) }); }],
    ['another insertion began', ['rendering', 'showing'], ctx => { ctx.i.insertionGeneration++; }],
  ];
  for (const [name, stages, change] of changes) {
    for (const stage of stages) {
      const ctx = pickerEditor();
      ctx.alter(stage, () => { change(ctx); });
      await ctx.pick();
      // Nothing is reported, hidden or released: the replaced state belongs to whoever replaced it.
      assert.deepEqual(outcome(ctx), { error: null, phase: 'reading', released: 0, shown: stage === 'showing' ? 1 : 0, read: 0, focused: 0,
        hidden: [], announced: [] }, `${name} ${stage}`);
    }
  }
});

test('a picked image is refused as not ready when the insertion dialog is not rendered', async () => {
  const ctx = pickerEditor({ dialog: 'absent' });
  await ctx.pick();
  assert.deepEqual(outcome(ctx), { error: 'not-ready', phase: 'idle', released: 1, shown: 0, read: 0, focused: 0,
    hidden: [], announced: ['docxEditorImageInsertRefused'] });
  assert.equal(ctx.i.insertionIntent, null);
});

test('a valid image opens its draft at the default size and focuses the width field only while focus is in the dialog', async () => {
  const bytes = imageInsertionBytes('png');
  for (const [name, focusInDialog] of [['focus in the dialog', true], ['focus elsewhere', false]] as const) {
    const ctx = pickerEditor({ image: bytes });
    const inDialog = { closest: (selector: string) => selector === '[part="image-insert-dialog"]' ? ctx.popover : null };
    ctx.stub('ownFocus', () => focusInDialog ? inDialog : null);
    await ctx.pick();
    assert.deepEqual(outcome(ctx), { error: null, phase: 'draft', released: 0, shown: 1, read: 1, focused: 0, hidden: [], announced: [] }, name);
    // The 64 by 32 pixel picture is offered at 96 pixels per inch with its own ratio, and nothing else is filled in.
    assert.deepEqual([ctx.i.insertionWidth, ctx.i.insertionHeight, ctx.i.insertionKeepRatio], ['48', '24', true], name);
    assert.deepEqual(Array.from(ctx.i.insertionBytes as Uint8Array), Array.from(bytes), name);
    assert.equal(ctx.i.insertionIntent, ctx.intent, `${name}: the captured intent stays with the draft`);
    assert.equal(ctx.width.focused, focusInDialog ? 1 : 0, name);
  }
});

test('an insertion whose dialog does not open is cancelled without a refusal and without reading the image', async () => {
  const ctx = pickerEditor({ dialog: 'stays-closed' });
  await ctx.pick();
  await flush();
  assert.deepEqual(outcome(ctx), { error: null, phase: 'idle', released: 1, shown: 1, read: 0, focused: 0,
    hidden: [{ focusTrigger: false }], announced: [] });
  assert.equal(ctx.i.insertionIntent, null);
});

test('insertion feedback names the limit, invalid and unsupported causes, then a stale or a generic refusal', () => {
  const { i, stub } = editor();
  stub('localize', (key: string) => key);
  const expected: [DocxRefusalCode, string][] = [
    ['resource-limit', 'docxEditorImageInsertLimit'], ['invalid-document', 'docxEditorImageInsertInvalid'],
    ['unsupported', 'docxEditorImageInsertUnsupported'],
    ['stale-selection', 'docxEditorImageInsertStale'], ['stale-revision', 'docxEditorImageInsertStale'],
    ['not-ready', 'docxEditorImageInsertRefused'], ['engine-failed', 'docxEditorImageInsertRefused'], ['busy', 'docxEditorImageInsertRefused'],
  ];
  assert.deepEqual(expected.map(([code]) => i.insertionFeedback(code)), expected.map(([, key]) => key));
  for (const [code, key] of expected) assert.ok(Object.hasOwn(DOCX_EDITOR_STRINGS, key), `${code}: ${key} has English text`);
});
