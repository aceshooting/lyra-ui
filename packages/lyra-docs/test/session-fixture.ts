import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { createInternalDocxSession } from '../src/docx/session.js';
import { imageFixture } from './corpus.js';
import type {
  DocxEngineEvent, DocxEngineImageInsertion, DocxEnginePort, DocxSessionPort
} from '../src/docx/engine-port.js';
import type {
  DocxAction, DocxCommandAvailability, DocxFormatting, DocxResult, DocxSelection, DocxSource
} from '../src/docx/types.js';

export const formatting: DocxFormatting = Object.freeze({ paragraphStyleId: null, alignment: null,
  fontFamily: null, fontSizePoints: null, color: null, bulletList: false, numberedList: false });

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function value<T>(result: DocxResult<T>): T {
  if (!result.ok) throw new Error(result.code);
  assert.equal(result.ok, true);
  return result.value;
}
export function refusal<T>(result: DocxResult<T>, code: string) {
  assert.deepEqual(result, { ok: false, code });
}
/** A fake session port and engine whose observable counters and state switches the tests drive. */
export function fixture(readOnly = false) {
  let listener: ((event: DocxEngineEvent) => void) | undefined;
  let lost: (() => void) | undefined;
  const f = {
    mount: {} as HTMLElement,
    valid: true,
    claimed: false,
    claimsReleased: 0,
    subscriptions: 0,
    destroyed: 0,
    retained: 0,
    released: [] as object[],
    selection: 'text' as DocxSelection['kind'],
    composing: false,
    formatting,
    styleReads: 0,
    fontReads: 0,
    searches: 0,
    navigations: 0,
    replacements: [] as string[],
    canCalls: 0,
    executes: 0,
    focuses: 0,
    opens: 0,
    diagnostics: 0,
    output: new Uint8Array([9, 8, 7]),
    source: null as DocxSource | null,
    signal: null as AbortSignal | null,
    changed: true,
    executeThrows: false,
    inspectThrows: false,
    openGate: null as ReturnType<typeof deferred<DocxResult<DocxEnginePort>>> | null,
    saveGate: null as ReturnType<typeof deferred<Uint8Array>> | null,
    availability: { enabled: true, active: false } as DocxCommandAvailability,
    emit(event: DocxEngineEvent) { listener?.(event); },
    detach() { f.valid = false; lost?.(); }
  };
  const engine: DocxEnginePort = {
    inspect() {
      if (f.inspectThrows) throw new Error('private document details');
      return { selection: f.selection, composing: f.composing, formatting: f.formatting };
    },
    subscribe(next) {
      listener = next; f.subscriptions++;
      return () => { listener = undefined; f.subscriptions--; };
    },
    can(_command: DocxAction) { f.canCalls++; return f.availability; },
    paragraphStyles() { f.styleReads++; return Object.freeze({ items: Object.freeze([]), truncated: false }); },
    fontFamilies() { f.fontReads++; return Object.freeze({ items: Object.freeze([]), truncated: false }); },
    find() { f.searches++; return { matches: [{ token: {}, text: 'alpha', before: '', after: ' beta' }], truncated: false }; },
    selectMatch() { f.navigations++; f.emit('user-selection'); return { ok: true, value: undefined }; },
    replaceMatch(_token, text) { f.replacements.push(text); f.emit('user-selection'); f.emit('change'); return { ok: true, value: undefined }; },
    execute() {
      f.executes++;
      if (f.executeThrows) throw new Error('private document details');
      if (f.changed) f.emit('change');
      return { ok: true, value: undefined };
    },
    focus() { f.focuses++; },
    retainSelection() { f.retained++; return {}; },
    releaseSelection(token) { f.released.push(token); },
    save(signal) { f.signal = signal; return f.saveGate?.promise ?? Promise.resolve(f.output); },
    destroy() { f.destroyed++; }
  };
  const port: DocxSessionPort = {
    claimMount(_mount, onLost) {
      if (f.claimed || !f.valid) return { ok: false, code: 'invalid-mount' };
      f.claimed = true; lost = onLost;
      return { ok: true, value: {
        valid: () => f.valid,
        release() { f.claimed = false; lost = undefined; f.claimsReleased++; }
      } };
    },
    open(source, options) {
      f.opens++; f.source = source; f.signal = options.signal;
      assert.equal(options.readOnly, readOnly);
      return f.openGate?.promise ?? Promise.resolve({ ok: true, value: engine });
    },
    subscriberFailed() { f.diagnostics++; }
  };
  const create = () => createInternalDocxSession({ mount: f.mount, readOnly }, port);
  return { f, engine, port, create };
}
export async function opened(readOnly = false, source: DocxSource = { kind: 'docx', bytes: new Uint8Array([1, 2]) }) {
  const context = fixture(readOnly);
  const session = value(context.create());
  const revision = value(await session.open(source));
  return { ...context, session, revision };
}

/** An opened session with a caret and a fake image-insertion capture on its engine. */
export async function insertionFixture(readOnly = false) {
  const h = await opened(readOnly); h.f.selection = 'caret'; h.f.emit('user-selection');
  const state = { epoch: 0, captures: 0, releases: 0, calls: 0, capturedBytes: null as Uint8Array | null,
    gate: null as ReturnType<typeof deferred<void>> | null, commit: true, throwAfterCommit: false,
    onCapture() {}, beforeCommit() {}, afterCommit() {} };
  h.engine.beginImageInsertion = () => {
    const epoch = state.epoch; state.captures++; state.onCapture(); let released = false;
    const handle: DocxEngineImageInsertion = {
      validate: () => released || epoch !== state.epoch ? { ok: false, code: 'stale-selection' } : { ok: true, value: undefined },
      async execute(source, operation) {
        state.calls++; state.capturedBytes = source.bytes;
        if (state.gate) await state.gate.promise;
        const current = operation.validateOriginal(); if (!current.ok) return current;
        state.beforeCommit();
        const armed = operation.armCommit(); if (!armed.ok) return armed;
        if (state.commit) h.f.emit('change');
        state.afterCommit();
        if (state.throwAfterCommit) throw new Error('late failure');
        return { ok: true, value: undefined };
      },
      release() { if (!released) { released = true; state.releases++; } }
    };
    return { ok: true, value: handle };
  };
  const source = () => ({ bytes: Object.entries(unzipSync(imageFixture('image-simple'))).find(([name]) => name.endsWith('.png'))![1], widthPoints: 48, heightPoints: 24 });
  return { ...h, state, source };
}
