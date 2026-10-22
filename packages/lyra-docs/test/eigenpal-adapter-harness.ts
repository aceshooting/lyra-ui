import assert from 'node:assert/strict';
import type { DocxEditorInstance, DocxEditorConfig, EditorEvents } from '@docx-editor.dev/core';
import { openEigenpalDocument } from '../src/docx/eigenpal-adapter.js';
import { deriveImageInsertionEngine } from '../src/docx/engine-image-insertion-loader.js';
import type { DocxEngineModule } from '../src/docx/engine-loader.js';
import type { DocxEnginePort } from '../src/docx/engine-port.js';
import { normalizeImageInsertion, normalizeImageReplacement } from '../src/docx/image-insertion-input.js';
import type { DocxResult } from '../src/docx/types.js';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

/** Waits for a milestone of a running operation; an operation that ends first fails the check instead of leaving the test waiting. */
export async function reached(milestone: Promise<void>, operation: unknown): Promise<boolean> {
  return await Promise.race([milestone.then(() => true), Promise.resolve(operation).then(() => false, () => false)]);
}

export function harness() {
  let mode = 'view';
  let destroyCount = 0;
  let removed = false;
  let loadCount = 0;
  let modeChanges = 0;
  let focusCalls = 0;
  let executions = 0;
  let created = 0, viewportRemoves = 0, revision = 0;
  let flushHook = () => {};
  let saved = () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
  let creation: DocxEditorConfig | undefined;
  const document = { activeElement: null as unknown, body: {}, createElement: () => created++ === 0 ? child : viewport };
  const childStyle: Record<string, string> = {};
  Object.defineProperty(childStyle, 'setProperty', { value(name: string, value: string) { childStyle[name] = value; } });
  const child = Object.assign(new EventTarget(), {
    className: '', style: childStyle, inert: false, ownerDocument: document,
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
  const packageState = {};
  Object.defineProperty(engine, 'surface', { configurable: true, writable: true, value: { session: { packageRevision: () => revision, currentPackage: () => packageState }, flushPendingInput() { flushHook(); } } });
  let prepare = async (_features: readonly string[]) => {};
  const loader = async () => ({ prepareFeatures: (features: readonly string[]) => prepare(features),
    prepareCommandFeatures: (command: Parameters<DocxEditorInstance['exec']>[0]) => prepare([command.type]), createDocxEditor(config: DocxEditorConfig) {
    creation = config; mode = config.mode ?? 'edit'; return engine;
  } });
  return { mount, child, viewport, viewportRemoves: () => viewportRemoves, document, emit, loader, engine,
    mode: () => mode, destroyCount: () => destroyCount, removed: () => removed,
    loadCount: () => loadCount, creation: () => creation,
    modeChanges: () => modeChanges, focusCalls: () => focusCalls,
    executions: () => executions, elementsCreated: () => created,
    onFlush: (callback: () => void) => { flushHook = callback; }, revise: () => { revision++; },
    prepareWith: (callback: typeof prepare) => { prepare = callback; },
    saveWith: (callback: typeof saved) => { saved = callback; } };
}

/** The loaded engine capabilities, mutable so a test can withdraw one after the document opened. */
export type MutableEngineModule = { -readonly [K in keyof DocxEngineModule]: DocxEngineModule[K] };

export const settled = (): DocxResult<void> => ({ ok: true, value: undefined });

/** Opens the fake engine and subscribes, as the facade does before native input is enabled. */
export async function openSubscribed(h: ReturnType<typeof harness>, options: { readOnly?: boolean; owned?: () => boolean } = {}) {
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: options.readOnly ?? false, signal: new AbortController().signal }, options.owned ?? (() => true), h.loader);
  assert(opened.ok);
  opened.value.subscribe(() => {});
  return opened.value;
}

/** The engine reports a failure; an observer that re-inspects a failed engine throws, as the facade's does. */
export function failEngine(h: { emit: (event: 'error') => void }) {
  try { h.emit('error'); } catch (error) { assert.match(String(error), /Engine unavailable/); }
}

/** A native input event that stays mid-dispatch until released, as inside a browser listener stack. */
export function holdNativeInput(target: EventTarget, type = 'beforeinput'): () => void {
  let dispatching = true;
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'eventPhase', { get: () => dispatching ? Event.AT_TARGET : Event.NONE });
  target.dispatchEvent(event);
  return () => { dispatching = false; };
}

/** What a test needs from any harness to put the session into a state in which it must refuse new work. */
export interface SessionControl {
  readonly port: DocxEnginePort;
  readonly child: EventTarget;
  emit(event: keyof EditorEvents, payload?: unknown): void;
  saveWith(callback: () => Promise<ArrayBuffer>): void;
  prepareWith(callback: (features: readonly string[]) => Promise<void>): void;
  loseOwnership(): void;
}
/** Puts the session into one state and returns how to leave it. */
export type StateArrangement = (h: SessionControl) => Promise<() => Promise<unknown>>;

const idle = async () => {};
const sessionStateTable = {
  'teardown': ['destroyed', async h => { h.port.destroy(); return idle; }],
  'ownership loss': ['destroyed', async h => { h.loseOwnership(); return idle; }],
  'engine failure': ['engine-failed', async h => { failEngine(h); return idle; }],
  'composition': ['composing', async h => { h.child.dispatchEvent(new Event('compositionstart')); return idle; }],
  'native input dispatching': ['busy', async h => { const release = holdNativeInput(h.child); return async () => release(); }],
  'save in flight': ['busy', async h => {
    const pending = deferred<ArrayBuffer>();
    h.saveWith(() => pending.promise);
    const saving = h.port.save(new AbortController().signal);
    return async () => { pending.resolve(new ArrayBuffer(0)); await saving; };
  }],
  'command in flight': ['busy', async h => {
    const gate = deferred<void>(), entered = deferred<void>();
    h.prepareWith(async () => { entered.resolve(); await gate.promise; });
    const running = h.port.execute('bold', undefined, settled);
    assert(await reached(entered.promise, running), 'the command reached its feature preparation');
    return async () => { gate.resolve(); await running; };
  }],
} satisfies Record<string, [code: string, arrange: StateArrangement]>;
type SessionStateName = keyof typeof sessionStateTable;

/** The named states, each with the refusal code the session must give while it lasts. */
export function sessionStates(...names: SessionStateName[]): [name: string, code: string, arrange: StateArrangement][] {
  return names.map(name => [name, sessionStateTable[name][0], sessionStateTable[name][1]]);
}

export async function tableHarness() {
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
  } } as unknown as Awaited<ReturnType<typeof import('../src/docx/engine-loader.js')['loadDocxEngine']>>);
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, loader);
  assert.equal(opened.ok, true); if (!opened.ok) throw Error('open');
  const port = opened.value; port.subscribe(() => {});
  return { ...h, port, flushes: () => flushes, duringFlush: (callback: () => void) => { onFlush = callback; },
    duringCan: (callback: () => void) => { capability = callback; }, commit: () => { revision++; h.emit('change', { revision }); } };
}

export async function imageHarness(options = { kind: 'image-simple', readOnly: false }, imageOperations = false) {
  const store = await import('@docx-editor.dev/core/store');
  const { readOoxmlPackage } = store;
  const { imageFixture } = await import('./corpus.js');
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
  const imageInsertion = imageOperations ? deriveImageInsertionEngine((await import('@docx-editor.dev/core/editor')).blankDocumentBytes, store) : undefined;
  const module: MutableEngineModule = { ...await h.loader(), ...(imageInsertion ? { imageInsertion } : {}) };
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' }, { readOnly: options.readOnly, signal: new AbortController().signal }, () => f.owned,
    async () => module); assert(opened.ok);
  const port = opened.value;
  port.subscribe(() => { port.inspect(); }); port.inspect();
  return { ...h, port, f, image, nodes, module };
}

export async function replacementHarness() {
  const h = await imageHarness(undefined, true), store = await import('@docx-editor.dev/core/store');
  const surface = h.engine.surface!, pkg = surface.session.currentPackage();
  const live = new store.TreePackageStore(pkg, pkg.parts.get(pkg.mainDocumentPart)!);
  const counts = { decodes: 0, dispatches: 0, armed: 0, onDecode: async () => {}, onLive() {} };
  const decodePort = { async decode() { counts.decodes++; await counts.onDecode(); return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 }; } };
  Object.assign(surface, { imageDecodePort: () => decodePort, session: {
    currentPackage: () => live.currentPackage(), part: () => live.currentPackage().parts.get(pkg.mainDocumentPart)!, packageRevision: () => live.packageRevision,
  } });
  surface.replaceImage = async (id, bytes, type, options) => {
    counts.dispatches++; counts.onLive();
    const result = await live.replaceImage({ kind: 'body' }, id, bytes, type, decodePort, options);
    if (result.ok && result.change) h.emit('change', { revision: live.packageRevision });
    return result;
  };
  const { imageInsertionBytes } = await import('./corpus.js');
  const normalized = normalizeImageReplacement(imageInsertionBytes('png'), {}, () => ({ ok: true, value: undefined })); assert(normalized.ok);
  const operation = () => ({ signal: new AbortController().signal, validateOriginal: (): DocxResult<void> => ({ ok: true, value: undefined }),
    armCommit: (): DocxResult<void> => { counts.armed++; return { ok: true, value: undefined }; } });
  return { ...h, live, counts, source: normalized.value.source, operation };
}

export async function documentToolsHarness(readOnly = false) {
  const h = harness(), store = await import('@docx-editor.dev/core/store');
  const { reviewFixture } = await import('./review-fixtures.js');
  const parsed = store.readOoxmlPackage(reviewFixture()); assert(parsed.ok);
  const pkg = parsed.package, part = pkg.parts.get(pkg.mainDocumentPart)!;
  const state = { revision: 0, comments: 0, flushes: 0, navigations: 0, owned: true, rangeEnd: 1, mode: 'editing', onFlush() {} };
  Object.assign(h.engine, { mountGeneration: 0, surface: { session: { currentPackage: () => pkg, part: () => part,
    packageRevision: () => state.revision, storyParts: () => [part] }, flushPendingInput() { state.flushes++; state.onFlush(); },
    state: () => ({ selection: { anchor: { paragraphId: 'paragraph', offset: 0 }, head: { paragraphId: 'paragraph', offset: state.rangeEnd } }, cellSelection: null }) },
    getEditingMode: () => state.mode,
    setAuthor() { h.emit('selectionChange'); },
    exec(command: { type: string; mode?: string }) { if (command.type === 'setEditingMode') { state.mode = command.mode!; return { ok: true, changed: false }; } return { ok: false, reason: 'unsupported' }; },
    addComment() { state.comments++; state.revision++; h.emit('change', { revision: state.revision }); return { ok: true, changed: true }; },
    setActiveReviewItem() { state.navigations++; h.emit('selectionChange'); return { ok: true, changed: false }; },
  });
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' }, { readOnly, signal: new AbortController().signal },
    () => state.owned, async () => ({ ...await h.loader(), review: store })); assert(opened.ok);
  const port = opened.value; port.subscribe(() => {});
  return { ...h, port, state };
}

export async function insertionHarness(readOnly = false) {
  const store = await import('@docx-editor.dev/core/store');
  const { blankDocumentBytes } = await import('@docx-editor.dev/core/editor');
  const { docxFixture } = await import('./admission-fixtures.js');
  const { imageInsertionBytes } = await import('./corpus.js');
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
  const module: MutableEngineModule = { ...await h.loader(), imageInsertion };
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' }, { readOnly, signal: new AbortController().signal },
    () => f.owned, async () => module, () => f.owned); assert(opened.ok);
  const port = opened.value; port.subscribe(() => {}); port.inspect();
  const normalized = normalizeImageInsertion({ bytes: imageInsertionBytes('png'), widthPoints: 48, heightPoints: 24 }, {}, () => ({ ok: true, value: undefined })); assert(normalized.ok);
  const operation = () => ({ signal: new AbortController().signal, validateOriginal: (): DocxResult<void> => ({ ok: true, value: undefined }),
    armCommit: (): DocxResult<void> => { f.armed++; return { ok: true, value: undefined }; } });
  return { ...h, f, port, live, module, source: normalized.value.source, operation };
}
