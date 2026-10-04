import type { DocxChartPlacement } from './eigenpal-charts.js';
import type { DocxEngineEvent, DocxEnginePort, DocxEngineImageInsertion, DocxMountOwnership, DocxSessionPort, DocxTableLabels } from './engine-port.js';
import { normalizeImageInsertion, imageInsertionAborted, listenImageInsertionAbort } from './image-insertion-input.js';
import { isDocxImageAction, isDocxTableAction, normalizeDocxAction, normalizeDocxReplacement, normalizeDocxSearch } from './commands.js';
import type {
  DocxAction, DocxCommand, DocxCommandAvailability, DocxRefusalCode, DocxResult, DocxRevision,
  DocxSaveReceipt, DocxSelection, DocxSelectionLease, DocxSession,
  DocxSessionOptions, DocxSnapshot, DocxSource, DocxStatus, DocxFormatting,
  DocxParagraphStyles, DocxFontFamilies, DocxSearchResults, DocxTableAction, DocxTableContext, DocxImageAction, DocxImageContext, DocxImageDescription, DocxImageDirection,
  DocxImageSource, DocxInsertImageOptions
} from './types.js';

const commands: readonly DocxCommand[] = ['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript', 'undo', 'redo'];
// Equal to the export cap, so every package this session saves can be reopened.
const maxInputBytes = 16 * 1024 * 1024;
const maxExportBytes = 16 * 1024 * 1024;
const emptyFormatting: Readonly<DocxFormatting> = Object.freeze({ paragraphStyleId: null, alignment: null,
  fontFamily: null, fontSizePoints: null, color: null, bulletList: false, numberedList: false });
const ok = <T>(value: T): DocxResult<T> => Object.freeze({ ok: true, value });
const refused = <T = never>(code: DocxRefusalCode): DocxResult<T> => Object.freeze({ ok: false, code });
const disabled = (reason: DocxRefusalCode): DocxCommandAvailability => Object.freeze({ enabled: false, reason });
function safely(action: (() => void) | null | undefined) {
  try { action?.(); } catch { /* Continue releasing independently owned handles. */ }
}
function equalRevision(a: DocxRevision | null | undefined, b: DocxRevision | null | undefined) {
  return !!a && !!b && a.documentId === b.documentId && a.value === b.value;
}
function searchRevisionOptions(value: unknown, allowSelection = false): DocxResult<{ expectedRevision?: DocxRevision; selection?: DocxSelectionLease }> {
  try {
    const data = (input: unknown): Record<string, unknown> | null => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) return null;
      const result: Record<string, unknown> = Object.create(null);
      for (const key of Reflect.ownKeys(input)) {
        if (typeof key !== 'string') return null;
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
        result[key] = descriptor.value;
      }
      return result;
    };
    const options = data(value);
    if (!options || Object.keys(options).some(key => key !== 'expectedRevision' && !(allowSelection && key === 'selection'))) return refused('invalid-option');
    if (options.selection !== undefined && (!options.selection || typeof options.selection !== 'object')) return refused('invalid-option');
    const selection = options.selection === undefined ? {} : { selection: options.selection as DocxSelectionLease };
    if (options.expectedRevision === undefined) return ok(selection);
    const revision = data(options.expectedRevision);
    if (!revision || Object.keys(revision).some(key => key !== 'documentId' && key !== 'value') ||
        typeof revision.documentId !== 'string' || !revision.documentId.length || revision.documentId.length > 128 ||
        typeof revision.value !== 'number' || !Number.isSafeInteger(revision.value) || revision.value < 0) return refused('invalid-option');
    return ok({ expectedRevision: { documentId: revision.documentId, value: revision.value }, ...selection });
  } catch { return refused('invalid-option'); }
}
interface Operation {
  kind: 'saving' | 'inserting-image';
  controller: AbortController;
  interruption: Promise<DocxResult<never>>;
  termination: Promise<DocxResult<never>>;
  interrupt(code: DocxRefusalCode): void;
  cleanup(): void;
}
interface ImageInsertionOperation {
  operation: Operation;
  engine: DocxEnginePort;
  armed: boolean;
  committed: DocxRevision | null;
}
interface RetainedSelection {
  lease: DocxSelectionLease;
  token: object;
  revision: DocxRevision;
}

/** Internal constructor; neither the port nor this factory is a package export. */
export function createInternalDocxSession(options: DocxSessionOptions, port: DocxSessionPort): DocxResult<DocxSession> {
  if (!options || typeof options.mount !== 'object' || options.mount === null ||
      (options.readOnly !== undefined && typeof options.readOnly !== 'boolean')) return refused('invalid-option');
  let session: InternalDocxSession | null = null;
  let lost = false;
  let claimed: DocxMountOwnership | null = null;
  try {
    const claim = port.claimMount(options.mount, () => { lost = true; session?.destroy(); });
    if (!claim.ok) return claim;
    claimed = claim.value;
    if (lost || !claim.value.valid()) {
      safely(() => claim.value.release());
      return refused('invalid-mount');
    }
    session = new InternalDocxSession(options.readOnly ?? false, port, claim.value);
    return ok(session);
  } catch { safely(() => claimed?.release()); return refused('invalid-mount'); }
}

/** Component-only localization bridge; deliberately absent from the public package barrels. */
export function refreshInternalDocxTableLabels(session: DocxSession, labels: DocxTableLabels): boolean {
  return session instanceof InternalDocxSession && session.refreshTableLabels(labels);
}

/** Component-only chart bridge; absent from the public package barrels. */
export function internalDocxCharts(session: DocxSession | null): readonly DocxChartPlacement[] {
  return session instanceof InternalDocxSession ? session.charts() : [];
}

/** Component-only zoom bridge; absent from the public package barrels. */
export function setInternalDocxZoom(session: DocxSession | null, zoom: number | 'fit'): boolean {
  return session instanceof InternalDocxSession && session.setZoom(zoom);
}

/** Component-only painted-image bridge for resize handles; absent from the public package barrels. */
export function internalDocxSelectedImageElement(session: DocxSession | null): HTMLElement | null {
  return session instanceof InternalDocxSession ? session.selectedImageElement() : null;
}

class InternalDocxSession implements DocxSession {
  private status: DocxStatus = 'idle';
  private revision: DocxRevision | null = null;
  private dirty = false;
  private composing = false;
  private selectionKind: DocxSelection['kind'] = 'none';
  private selectionVersion = 0;
  private formatting = emptyFormatting;
  private table: Readonly<DocxTableContext> | null = null;
  private image: Readonly<DocxImageContext> | null = null;
  private commandOwner: object | null = null;
  private searchVersion = 0;
  private readonly matches = new Map<string, { token: object; revision: DocxRevision }>();
  private imageReady = false;
  private publishedImageReady = false;
  private error: DocxRefusalCode | null = null;
  private engine: DocxEnginePort | null = null;
  private unsubscribeEngine: (() => void) | null = null;
  private operation: Operation | null = null;
  private imageInsertion: ImageInsertionOperation | null = null;
  private lease: RetainedSelection | null = null;
  private receipt: DocxSaveReceipt | null = null;
  private readonly destroyedEngines = new WeakSet<DocxEnginePort>();
  private readonly listeners = new Set<() => void>();
  private cached!: Readonly<DocxSnapshot>;

  constructor(
    private readonly readOnly: boolean,
    private port: DocxSessionPort | null,
    private ownership: DocxMountOwnership | null
  ) { this.publish(); }

  refreshTableLabels(labels: DocxTableLabels): boolean {
    if (this.gate() || !this.engine) return false;
    try { return this.engine.refreshTableLabels?.(Object.freeze({ ...labels })) ?? false; }
    catch { return false; }
  }
  charts(): readonly DocxChartPlacement[] {
    if (!this.owned() || this.status !== 'ready' || !this.engine) return [];
    try { return this.engine.charts?.() ?? []; }
    catch { return []; }
  }
  setZoom(zoom: number | 'fit'): boolean {
    if (!this.owned() || this.status !== 'ready' || !this.engine) return false;
    if (zoom !== 'fit' && !(Number.isFinite(zoom) && zoom >= 0.25 && zoom <= 4)) return false;
    try { return this.engine.setZoom?.(zoom) ?? false; }
    catch { return false; }
  }
  selectedImageElement(): HTMLElement | null {
    if (this.gate() || !this.engine || !this.image || !this.imageReady) return null;
    try { return this.engine.selectedImageElement?.() ?? null; }
    catch { return null; }
  }
  snapshot() { return this.cached; }
  canInsertImage(): DocxCommandAvailability {
    if (this.status === 'destroyed') return disabled('destroyed');
    if (this.operation || this.commandOwner) return disabled('busy');
    if (this.status !== 'ready' || !this.engine) return disabled('not-ready');
    if (this.composing) return disabled('composing');
    if (this.readOnly) return disabled('read-only');
    if (this.selectionKind !== 'caret' || this.table || !this.engine.beginImageInsertion) return disabled('unsupported');
    return Object.freeze({ enabled: true });
  }
  async insertImage(source: DocxImageSource, options: DocxInsertImageOptions = {}): Promise<DocxResult<DocxRevision>> {
    const gate = this.gate(); if (gate) return refused(gate);
    const available = this.canInsertImage(); if (!available.enabled) return refused(available.reason ?? 'unsupported');
    const engine = this.engine!, revision = this.revision!, selection = this.selectionVersion, entryLease = this.lease;
    const operation = this.begin(undefined, 'inserting-image');
    const state: ImageInsertionOperation = { operation, engine, armed: false, committed: null };
    this.imageInsertion = state;
    let handle: DocxEngineImageInsertion | null = null, supplied = false, optionsAccepted = false;
    let removeAbort: (() => void) | null = null, released = false;
    const initialCleanup = operation.cleanup;
    operation.cleanup = () => {
      if (released) return;
      released = true;
      safely(removeAbort); safely(initialCleanup); safely(() => handle?.release());
      if (supplied && this.lease === entryLease) this.releaseLease();
      if (this.imageInsertion === state) this.imageInsertion = null;
    };
    const validate = (): DocxResult<void> => {
      if (this.status === 'destroyed') return refused('destroyed');
      if (this.ownership?.check && !this.ownership.check()) return refused('destroyed');
      if (this.status !== 'ready' || this.engine !== engine) return refused(this.error ?? 'stale-revision');
      if (this.operation !== operation || released) return refused('busy');
      if (this.revision !== revision) return refused('stale-revision');
      if (this.composing) return refused('composing');
      if (selection !== this.selectionVersion || ((!optionsAccepted || supplied) && this.lease !== entryLease)) return refused('stale-selection');
      if (!state.armed && operation.controller.signal.aborted) return refused('aborted');
      return handle?.validate(supplied ? entryLease?.token : undefined) ?? ok(undefined);
    };
    const finish = (result: DocxResult<DocxRevision>): DocxResult<DocxRevision> => {
      this.end(operation);
      this.publish();
      return state.committed ? ok(state.committed) : result;
    };
    try {
      const captured = engine.beginImageInsertion!();
      if (!captured.ok) return finish(captured);
      handle = captured.value;
      if (released) safely(() => handle?.release());
      const original = validate(); if (!original.ok) return finish(original);
      const normalized = normalizeImageInsertion(source, options, validate, checked => {
        if (checked.expectedRevision && !equalRevision(checked.expectedRevision, revision)) return refused('stale-revision');
        const requested = checked.selection !== undefined;
        if (requested && (!entryLease || checked.selection !== entryLease.lease || !equalRevision(entryLease.revision, revision))) return refused('stale-selection');
        supplied = requested;
        optionsAccepted = true;
        if (checked.signal) {
          removeAbort = listenImageInsertionAbort(checked.signal, () => { if (!state.armed) operation.controller.abort(); });
          if (imageInsertionAborted(checked.signal)) operation.controller.abort();
        }
        return validate();
      });
      if (!normalized.ok) return finish(normalized);
      this.publish();
      const published = validate(); if (!published.ok) return finish(published);
      const task = handle.execute(normalized.value.source, {
        ...(supplied ? { retainedSelection: entryLease!.token } : {}), signal: operation.controller.signal,
        validateOriginal: validate,
        armCommit: () => {
          const valid = validate(); if (!valid.ok) return valid;
          if (state.armed) return refused('busy');
          state.armed = true;
          return ok(undefined);
        }
      }).catch(() => refused('engine-failed'));
      const result = await Promise.race([task, operation.termination]);
      if (state.committed) return finish(ok(state.committed));
      const current = validate();
      if (!current.ok) return finish(current);
      if (result.ok) { this.failEngine(); return finish(refused('engine-failed')); }
      return finish(result);
    } catch {
      if (state.committed) return finish(ok(state.committed));
      const current = validate();
      return finish(current.ok ? refused('engine-failed') : current);
    }
  }
  subscribe(listener: () => void) {
    if (this.status === 'destroyed') return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private owned() {
    if (this.ownership) {
      try { if (!this.ownership.valid()) this.destroy(); }
      catch { this.destroy(); }
    }
    return this.status !== 'destroyed';
  }
  private gate(): DocxRefusalCode | null {
    if (!this.owned()) return 'destroyed';
    if (this.operation || this.commandOwner) return 'busy';
    if (this.status !== 'ready') return 'not-ready';
    return null;
  }
  private availability(command: DocxAction): DocxCommandAvailability {
    if (this.status === 'destroyed') return disabled('destroyed');
    if (this.operation || this.commandOwner) return disabled('busy');
    if (this.status !== 'ready' || !this.engine) return disabled('not-ready');
    if (this.composing) return disabled('composing');
    if (this.readOnly) return disabled('read-only');
    if (isDocxTableAction(command) && this.selectionKind !== 'caret') return disabled('unsupported');
    try {
      const engine = this.engine;
      const result = engine.can(command);
      if (this.engine !== engine || this.status !== 'ready') return disabled(this.completionFailure() ?? 'not-ready');
      if (this.operation || this.commandOwner) return disabled('busy');
      if (this.composing) return disabled('composing');
      if (!result.enabled) return disabled(result.reason ?? 'unsupported');
      return Object.freeze({ enabled: true,
        ...((command === 'undo' || command === 'redo' || result.active === undefined) ? {} : { active: result.active }) });
    } catch { return disabled(this.completionFailure() ?? 'unsupported'); }
  }
  can(command: DocxAction) {
    const normalized = normalizeDocxAction(command);
    if (!normalized.ok) return disabled(normalized.code);
    this.owned();
    return this.availability(normalized.value);
  }
  private publish() {
    const previous = this.cached;
    const available = Object.fromEntries(commands.map(command => [command, this.availability(command)])) as Record<DocxCommand, DocxCommandAvailability>;
    // An engine capability hook may have caused a nested terminal publication.
    if (this.cached !== previous) return;
    const activity = this.status === 'ready' && this.operation ? this.operation.kind : null;
    if (previous && previous.status === this.status && previous.activity === activity &&
        previous.revision === this.revision && previous.dirty === this.dirty && previous.composing === this.composing &&
        previous.formatting === this.formatting && previous.table === this.table && previous.image === this.image &&
        this.publishedImageReady === this.imageReady &&
        previous.selection.kind === this.selectionKind && previous.selection.version === this.selectionVersion &&
        previous.error?.code === (this.error ?? undefined) && commands.every(command => {
          const a = previous.commands[command], b = available[command];
          return a.enabled === b.enabled && a.reason === b.reason && a.active === b.active;
        })) return;
    this.cached = Object.freeze({ status: this.status, activity, revision: this.revision, dirty: this.dirty,
      readOnly: this.readOnly, composing: this.composing,
      formatting: this.formatting, table: this.table, image: this.image,
      selection: Object.freeze({ version: this.selectionVersion, kind: this.selectionKind }),
      commands: Object.freeze(available), error: this.error ? Object.freeze({ code: this.error }) : null });
    this.publishedImageReady = this.imageReady;
    const published = this.cached;
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try { listener(); } catch { safely(() => this.port?.subscriberFailed?.()); }
      // A reentrant transition has already notified its own subscriber snapshot.
      if (this.cached !== published) break;
    }
  }
  private begin(signal?: AbortSignal, kind: Operation['kind'] = 'saving'): Operation {
    const controller = new AbortController();
    let interrupt!: (code: DocxRefusalCode) => void;
    const interruption = new Promise<DocxResult<never>>(resolve => { interrupt = code => resolve(refused(code)); });
    let terminate!: (code: DocxRefusalCode) => void;
    const termination = new Promise<DocxResult<never>>(resolve => { terminate = code => resolve(refused(code)); });
    const aborted = () => { controller.abort(); interrupt('aborted'); };
    signal?.addEventListener('abort', aborted, { once: true });
    const operation = { kind, controller, interruption, termination,
      interrupt: (code: DocxRefusalCode) => { interrupt(code); if (code !== 'aborted') terminate(code); },
      cleanup: () => { signal?.removeEventListener('abort', aborted); } };
    this.operation = operation;
    return operation;
  }
  private end(operation: Operation) {
    operation.cleanup();
    if (this.operation === operation) this.operation = null;
  }
  private current(operation: Operation) { return this.operation === operation; }
  private destroyed() { return this.status === 'destroyed'; }
  private completionFailure(): DocxRefusalCode | null {
    if (this.destroyed()) return 'destroyed';
    return this.status === 'error' ? this.error ?? 'engine-failed' : null;
  }
  private disposeEngine(engine: DocxEnginePort) {
    if (this.destroyedEngines.has(engine)) return;
    this.destroyedEngines.add(engine);
    safely(() => engine.destroy());
  }
  private releaseLease() {
    const lease = this.lease;
    this.lease = null;
    if (lease && this.engine) safely(() => this.engine?.releaseSelection(lease.token));
  }
  private cleanupEngine() {
    this.clearSearch();
    this.formatting = emptyFormatting;
    this.table = null; this.image = null; this.imageReady = false;
    this.releaseLease();
    const off = this.unsubscribeEngine;
    this.unsubscribeEngine = null;
    safely(off);
    const engine = this.engine;
    this.engine = null;
    if (engine) this.disposeEngine(engine);
    const ownership = this.ownership;
    this.ownership = null;
    safely(() => ownership?.release());
    this.receipt = null;
  }
  private failOpen(operation: Operation, code: DocxRefusalCode) {
    if (this.destroyed()) return refused<DocxRevision>('destroyed');
    this.end(operation);
    this.status = 'error'; this.error = code;
    this.cleanupEngine(); this.port = null;
    this.publish();
    return this.destroyed() ? refused<DocxRevision>('destroyed') : refused<DocxRevision>(code);
  }
  async open(source: DocxSource, options: { signal?: AbortSignal } = {}): Promise<DocxResult<DocxRevision>> {
    if (!this.owned()) return refused('destroyed');
    if (this.operation) return refused('busy');
    if (this.status !== 'idle') return refused('already-open');
    if (options.signal?.aborted) return refused('aborted');
    if (!source || (source.kind !== 'blank' && source.kind !== 'docx') ||
        (source.kind === 'docx' && !(source.bytes instanceof Uint8Array))) return refused('invalid-option');
    if (source.kind === 'docx' && source.bytes.byteLength > maxInputBytes) return refused('resource-limit');
    const copy: DocxSource = source.kind === 'blank' ? { kind: 'blank' } : { kind: 'docx', bytes: new Uint8Array(source.bytes) };
    const operation = this.begin(options.signal);
    this.status = 'opening'; this.publish();
    if (!this.owned() || !this.current(operation)) return refused('destroyed');
    if (operation.controller.signal.aborted) return this.failOpen(operation, 'aborted');
    let incoming: Promise<DocxResult<DocxEnginePort>>;
    try {
      incoming = this.port!.open(copy, { readOnly: this.readOnly, signal: operation.controller.signal });
    } catch { return this.failOpen(operation, 'open-failed'); }
    const guarded = incoming.then(result => {
      if (!this.current(operation) || operation.controller.signal.aborted || !this.owned()) {
        if (result.ok) this.disposeEngine(result.value);
        return refused<DocxEnginePort>(this.status === 'destroyed' ? 'destroyed' : 'aborted');
      }
      return result;
    }, () => refused<DocxEnginePort>('open-failed'));
    const result = await Promise.race([guarded, operation.interruption]);
    if (!this.owned() || !this.current(operation)) {
      if (result.ok) this.disposeEngine(result.value);
      return refused('destroyed');
    }
    if (operation.controller.signal.aborted) {
      if (result.ok) this.disposeEngine(result.value);
      return this.failOpen(operation, 'aborted');
    }
    if (!result.ok) return this.failOpen(operation, result.code);
    const engine = result.value;
    this.engine = engine;
    try {
      const off = engine.subscribe(event => this.engineEvent(engine, event));
      if (!this.owned() || !this.current(operation)) { safely(off); return refused('destroyed'); }
      this.unsubscribeEngine = off;
      if (operation.controller.signal.aborted) return this.failOpen(operation, 'aborted');
      const state = engine.inspect();
      if (!this.owned() || !this.current(operation)) return refused('destroyed');
      if (operation.controller.signal.aborted) return this.failOpen(operation, 'aborted');
      this.selectionKind = state.selection; this.composing = state.composing;
      this.updateFormatting(state.formatting);
      this.updateTable(state.table ?? null);
      this.updateImage(state.image ?? null, state.imageReady ?? false);
      this.revision = Object.freeze({ documentId: globalThis.crypto.randomUUID(), value: 0 });
    } catch { return this.failOpen(operation, 'open-failed'); }
    this.end(operation);
    // A fresh blank document has nothing to lose; it becomes dirty on its first committed change.
    this.dirty = false;
    this.status = 'ready'; this.publish();
    const failure = this.completionFailure();
    return failure ? refused(failure) : ok(this.revision!);
  }
  private engineEvent(emitter: DocxEnginePort, event: DocxEngineEvent) {
    if (this.status !== 'ready' || this.engine !== emitter) return;
    // Record the committed change even when its subsequent inspection fails.
    if (event === 'change') {
      this.revision = Object.freeze({ documentId: this.revision!.documentId, value: this.revision!.value + 1 });
      this.dirty = true;
      // A receipt for an older revision can never be acknowledged; release its bytes now.
      this.receipt = null;
      const insertion = this.imageInsertion;
      if (insertion?.armed && insertion.engine === emitter && insertion.operation === this.operation && !insertion.committed) {
        insertion.committed = this.revision;
      }
      this.clearSearch();
    }
    if (!this.owned()) return;
    if (event === 'change' || event === 'user-selection' || event === 'composition') this.releaseLease();
    if (!this.owned() || !this.engine || this.status !== 'ready') return;
    let state;
    try { state = this.engine.inspect(); }
    catch { this.failEngine(); return; }
    if (!this.owned() || this.status !== 'ready') return;
    if (event === 'user-selection' || state.selection !== this.selectionKind) this.selectionVersion++;
    this.selectionKind = state.selection; this.composing = state.composing;
    this.updateFormatting(state.formatting);
      this.updateTable(state.table ?? null);
      this.updateImage(state.image ?? null, state.imageReady ?? false);
    this.publish();
  }
  private failEngine() {
    if (this.destroyed()) return;
    this.status = 'error'; this.error = 'engine-failed';
    const operation = this.operation;
    this.operation = null;
    operation?.interrupt('engine-failed');
    operation?.controller.abort();
    safely(() => operation?.cleanup());
    this.cleanupEngine(); this.port = null;
    this.composing = false; this.selectionKind = 'none';
    this.publish();
  }
  retainSelection(): DocxResult<DocxSelectionLease> {
    const gate = this.gate();
    if (gate) return refused(gate);
    if (this.composing) return refused('composing');
    if (this.selectionKind === 'none') return refused('no-selection');
    this.releaseLease();
    const invalid = this.completionFailure() ?? this.gate();
    if (invalid) return refused(invalid);
    const engine = this.engine!;
    const revision = this.revision!;
    const selectionVersion = this.selectionVersion;
    try {
      const token = engine.retainSelection();
      const failure = this.completionFailure() ?? this.gate() ??
        (this.composing ? 'composing' : null) ??
        ((!equalRevision(revision, this.revision) || selectionVersion !== this.selectionVersion) ? 'stale-selection' : null);
      if (failure || this.engine !== engine) {
        safely(() => engine.releaseSelection(token));
        return refused(this.completionFailure() ?? failure ?? 'stale-selection');
      }
      const lease: DocxSelectionLease = Object.freeze({ release: () => {
        if (this.lease?.lease === lease) this.releaseLease();
      } });
      this.lease = { lease, token, revision };
      return ok(lease);
    } catch { return refused(this.completionFailure() ?? 'no-selection'); }
  }
  execute(command: DocxAction, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease } = {}): DocxResult<DocxRevision> {
    if (this.operation?.kind === 'inserting-image') return refused('busy');
    const checkedOptions = searchRevisionOptions(options, true);
    if (!checkedOptions.ok) return checkedOptions;
    options = checkedOptions.value;
    const checkedAction = normalizeDocxAction(command);
    if (!checkedAction.ok) return checkedAction;
    command = checkedAction.value;
    const initialSnapshot = this.cached;
    let result: DocxResult<DocxRevision>;
    try {
      result = this.executeCommand(command, options);
    } catch { result = refused(this.completionFailure() ?? 'unsupported'); }
    if (options.selection && this.lease?.lease === options.selection) this.releaseLease();
    this.owned();
    const failure = this.completionFailure();
    return failure && this.cached !== initialSnapshot ? refused(failure) : result.ok ? ok(this.revision!) : result;
  }
  private executeCommand(command: DocxAction, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease }): DocxResult<DocxRevision> {
    const gate = this.gate();
    if (gate) return refused(gate);
    const normalized = normalizeDocxAction(command);
    if (!normalized.ok) return normalized;
    if (options.expectedRevision && !equalRevision(options.expectedRevision, this.revision)) return refused('stale-revision');
    const supplied = options.selection;
    if (supplied && (this.lease?.lease !== supplied || !equalRevision(this.lease.revision, this.revision))) return refused('stale-selection');
    if (isDocxImageAction(normalized.value)) return this.executeImage(normalized.value, options);
    if (isDocxTableAction(normalized.value)) return this.executeTable(normalized.value, options);
    const before = this.revision;
    const available = this.can(normalized.value);
    if (!available.enabled) return refused(available.reason ?? 'unsupported');
    if (!equalRevision(before, this.revision)) return refused('stale-revision');
    if (supplied && this.lease?.lease !== supplied) return refused('stale-selection');
    const result = this.engine!.execute(normalized.value, supplied ? this.lease!.token : undefined);
    return result.ok ? ok(this.revision!) : result;
  }
  private executeTable(command: DocxTableAction, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease }): DocxResult<DocxRevision> {
    if (this.composing) return refused('composing');
    if (this.readOnly) return refused('read-only');
    const engine = this.engine!, owner = {}, supplied = options.selection;
    this.commandOwner = owner;
    let settledRevision: DocxRevision | null = null;
    let settledSelection = 0;
    const validate = (): DocxResult<void> => {
      if (!this.owned()) return refused('destroyed');
      const failure = this.completionFailure();
      if (failure) return refused(failure);
      if (this.commandOwner !== owner || this.engine !== engine || this.operation) return refused('busy');
      if (this.composing) return refused('composing');
      if (this.selectionKind !== 'caret') return refused(settledRevision ? 'stale-selection' : 'unsupported');
      if (options.expectedRevision && !equalRevision(options.expectedRevision, this.revision)) return refused('stale-revision');
      if (supplied && (this.lease?.lease !== supplied || !equalRevision(this.lease.revision, this.revision))) return refused('stale-selection');
      if (settledRevision && !equalRevision(settledRevision, this.revision)) return refused('stale-revision');
      if (settledRevision && settledSelection !== this.selectionVersion) return refused('stale-selection');
      settledRevision = this.revision;
      settledSelection = this.selectionVersion;
      return ok(undefined);
    };
    try {
      const result = engine.execute(command, supplied ? this.lease!.token : undefined, validate);
      return result.ok ? ok(this.revision!) : result;
    } finally {
      if (this.commandOwner === owner) this.commandOwner = null;
      this.publish();
    }
  }
  private executeImage(command: DocxImageAction, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease }): DocxResult<DocxRevision> {
    if (this.composing) return refused('composing');
    if (this.readOnly) return refused('read-only');
    if (!this.image) return refused('no-selection');
    const engine = this.engine!, owner = {}, supplied = options.selection;
    const revision = this.revision, selection = this.selectionVersion;
    const token = supplied ? this.lease!.token : undefined;
    this.commandOwner = owner;
    const validate = (): DocxResult<void> => {
      if (!this.owned()) return refused('destroyed');
      const failure = this.completionFailure();
      if (failure) return refused(failure);
      if (this.commandOwner !== owner || this.engine !== engine || this.operation) return refused('busy');
      if (this.composing) return refused('composing');
      if (!equalRevision(revision, this.revision)) return refused('stale-revision');
      if (selection !== this.selectionVersion || !this.image ||
        (supplied && this.lease?.lease !== supplied)) return refused('stale-selection');
      return ok(undefined);
    };
    try {
      const result = engine.execute(command, token, validate);
      return result.ok ? ok(this.revision!) : result;
    } finally {
      if (this.commandOwner === owner) this.commandOwner = null;
      this.publish();
    }
  }
  imageDescription(): DocxResult<Readonly<DocxImageDescription>> {
    const gate = this.gate();
    if (gate) return refused(gate);
    if (this.composing) return refused('composing');
    const engine = this.engine!, revision = this.revision, selection = this.selectionVersion;
    try {
      const result = engine.imageDescription?.() ?? refused('unsupported');
      const failure = this.completionFailure() ?? this.gate();
      if (failure) return refused(failure);
      if (engine !== this.engine || !equalRevision(revision, this.revision) || selection !== this.selectionVersion) return refused('stale-selection');
      return result.ok ? ok(Object.freeze({ title: result.value.title, description: result.value.description })) : result;
    } catch { return refused(this.completionFailure() ?? 'unsupported'); }
  }
  private updateImage(value: Readonly<DocxImageContext> | null, ready: boolean) {
    this.imageReady = !!value && ready;
    if (value && this.image && value.widthPoints === this.image.widthPoints && value.heightPoints === this.image.heightPoints) return;
    this.image = value ? Object.freeze({ widthPoints: value.widthPoints, heightPoints: value.heightPoints }) : null;
  }
  private updateTable(value: Readonly<DocxTableContext> | null) {
    if (value && this.table && value.rows === this.table.rows && value.columns === this.table.columns &&
      value.rowIndex === this.table.rowIndex && value.columnIndex === this.table.columnIndex) return;
    this.table = value ? Object.freeze({ ...value }) : null;
  }
  private updateFormatting(value: Readonly<DocxFormatting>) {
    if ((Object.keys(emptyFormatting) as (keyof DocxFormatting)[]).every(key => this.formatting[key] === value[key])) return;
    this.formatting = Object.freeze({ ...value });
  }
  private clearSearch() { this.searchVersion++; this.matches.clear(); }
  private readFailure(engine: DocxEnginePort, revision: DocxRevision): DocxRefusalCode | null {
    const failure = this.completionFailure() ?? this.gate();
    if (failure) return failure;
    if (this.engine !== engine || !equalRevision(revision, this.revision)) return 'stale-revision';
    return null;
  }
  private catalog<T>(read: (engine: DocxEnginePort) => T): DocxResult<T> {
    const gate = this.gate();
    if (gate) return refused(gate);
    const engine = this.engine!, revision = this.revision!;
    try {
      const result = read(engine);
      const failure = this.readFailure(engine, revision);
      return failure ? refused(failure) : ok(result);
    } catch { return refused(this.completionFailure() ?? 'unsupported'); }
  }
  paragraphStyles(): DocxResult<DocxParagraphStyles> { return this.catalog(engine => engine.paragraphStyles()); }
  fontFamilies(): DocxResult<DocxFontFamilies> { return this.catalog(engine => engine.fontFamilies()); }
  find(query: string, options: { matchCase?: boolean; wholeWord?: boolean; limit?: number } = {}): DocxResult<DocxSearchResults> {
    const gate = this.gate();
    if (gate) return refused(gate);
    if (this.composing) return refused('composing');
    const normalized = normalizeDocxSearch(query, options);
    if (!normalized.ok) return normalized;
    this.clearSearch();
    const generation = this.searchVersion, engine = this.engine!, revision = this.revision!;
    try {
      const result = engine.find(normalized.value.query, normalized.value);
      const failure = this.readFailure(engine, revision);
      if (failure) return refused(failure);
      if (generation !== this.searchVersion) return refused('stale-search');
      const matches = result.matches.map(match => {
        const id = globalThis.crypto.randomUUID();
        this.matches.set(id, { token: match.token, revision });
        return Object.freeze({ id, text: match.text, before: match.before, after: match.after });
      });
      return ok(Object.freeze({ revision, matches: Object.freeze(matches), truncated: result.truncated }));
    } catch { return refused(this.completionFailure() ?? 'unsupported'); }
  }
  private searched(id: string, expectedRevision?: DocxRevision): DocxResult<{ token: object; revision: DocxRevision }> {
    const gate = this.gate();
    if (gate) return refused(gate);
    if (this.composing) return refused('composing');
    if (expectedRevision && !equalRevision(expectedRevision, this.revision)) return refused('stale-revision');
    if (typeof id !== 'string') return refused('invalid-option');
    const match = this.matches.get(id);
    return match && equalRevision(match.revision, this.revision) ? ok(match) : refused('stale-search');
  }
  selectImage(direction: DocxImageDirection): DocxResult<void> {
    if (this.operation?.kind === 'inserting-image') return refused('busy');
    if (direction !== 'next' && direction !== 'previous') return refused('invalid-option');
    const gate = this.gate();
    if (gate) return refused(gate);
    if (this.composing) return refused('composing');
    const engine = this.engine!, revision = this.revision!, owner = {};
    if (!engine.selectImage) return refused('unsupported');
    this.commandOwner = owner;
    try {
      const result = engine.selectImage(direction);
      const failure = this.completionFailure();
      if (failure) return refused(failure);
      if (!this.owned()) return refused('destroyed');
      if (this.engine !== engine || !equalRevision(revision, this.revision)) return refused('stale-revision');
      if (this.composing) return refused('composing');
      return result;
    } catch { return refused(this.completionFailure() ?? 'unsupported'); }
    finally {
      if (this.commandOwner === owner) this.commandOwner = null;
      this.publish();
    }
  }
  selectMatch(id: string, options: { expectedRevision?: DocxRevision } = {}): DocxResult<void> {
    if (this.operation?.kind === 'inserting-image') return refused('busy');
    const normalized = searchRevisionOptions(options);
    if (!normalized.ok) return normalized;
    const match = this.searched(id, normalized.value.expectedRevision);
    if (!match.ok) return match;
    const engine = this.engine!;
    this.releaseLease();
    const before = this.readFailure(engine, match.value.revision);
    if (before) return refused(before);
    const retained = this.searched(id, normalized.value.expectedRevision);
    if (!retained.ok) return retained;
    try {
      const result = engine.selectMatch(match.value.token);
      const failure = this.readFailure(engine, match.value.revision);
      return failure ? refused(failure) : result;
    } catch { return refused(this.completionFailure() ?? 'unsupported'); }
  }
  replaceMatch(id: string, text: string, options: { expectedRevision?: DocxRevision } = {}): DocxResult<DocxRevision> {
    if (this.operation?.kind === 'inserting-image') return refused('busy');
    const checkedOptions = searchRevisionOptions(options);
    if (!checkedOptions.ok) return checkedOptions;
    const match = this.searched(id, checkedOptions.value.expectedRevision);
    if (!match.ok) return match;
    if (this.readOnly) return refused('read-only');
    const normalized = normalizeDocxReplacement(text);
    if (!normalized.ok) return normalized;
    const engine = this.engine!;
    this.releaseLease();
    const before = this.readFailure(engine, match.value.revision);
    if (before) return refused(before);
    const retained = this.searched(id, checkedOptions.value.expectedRevision);
    if (!retained.ok) return retained;
    try {
      const result = engine.replaceMatch(match.value.token, normalized.value);
      this.owned();
      const failure = this.completionFailure();
      return failure ? refused(failure) : result.ok ? ok(this.revision!) : result;
    } catch { return refused(this.completionFailure() ?? 'unsupported'); }
  }
  focus(): DocxResult<void> {
    const gate = this.gate();
    if (gate) return refused(gate);
    try {
      this.engine!.focus(); this.owned();
      const failure = this.completionFailure();
      return failure ? refused(failure) : ok(undefined);
    } catch { return refused(this.completionFailure() ?? 'unsupported'); }
  }
  async save(options: { signal?: AbortSignal; expectedRevision?: DocxRevision } = {}): Promise<DocxResult<DocxSaveReceipt>> {
    const gate = this.gate();
    if (gate) return refused(gate);
    if (this.composing) return refused('composing');
    if (options.signal?.aborted) return refused('aborted');
    if (options.expectedRevision && !equalRevision(options.expectedRevision, this.revision)) return refused('stale-revision');
    this.receipt = null;
    const revision = this.revision!;
    const operation = this.begin(options.signal);
    this.publish();
    if (!this.owned() || this.operation !== operation) return refused(this.completionFailure() ?? 'destroyed');
    if (operation.controller.signal.aborted) {
      this.end(operation); this.publish();
      return refused(this.completionFailure() ?? 'aborted');
    }
    // Caller cancellation keeps busy until the port has released its barrier.
    // Destruction is terminal and can settle promptly without enabling more work.
    let result: DocxResult<Uint8Array>;
    try {
      result = await Promise.race([this.engine!.save(operation.controller.signal).then(ok), operation.termination]);
    } catch { result = refused('save-failed'); }
    if (!this.owned() || this.operation !== operation) return refused(this.completionFailure() ?? 'destroyed');
    if (operation.controller.signal.aborted) result = refused('aborted');
    else if (!equalRevision(revision, this.revision)) result = refused('stale-revision');
    else if (result.ok && (!(result.value instanceof Uint8Array) || result.value.byteLength > maxExportBytes)) result = refused('resource-limit');
    this.end(operation);
    if (!result.ok) { this.publish(); const failure = this.completionFailure(); return failure ? refused(failure) : result; }
    const receipt = Object.freeze({ revision, bytes: new Uint8Array(result.value) });
    this.receipt = receipt;
    this.publish();
    const failure = this.completionFailure();
    return failure ? refused(failure) : ok(receipt);
  }
  acknowledgeSaved(receipt: DocxSaveReceipt): DocxResult<void> {
    if (!this.owned()) return refused('destroyed');
    if (this.operation?.kind === 'inserting-image') return refused('busy');
    if (!receipt || this.receipt !== receipt || !equalRevision(receipt.revision, this.revision)) return refused('stale-save');
    this.dirty = false;
    this.publish();
    const failure = this.completionFailure();
    return failure ? refused(failure) : ok(undefined);
  }
  destroy() {
    if (this.status === 'destroyed') return;
    this.status = 'destroyed';
    const operation = this.operation;
    this.operation = null;
    operation?.interrupt('destroyed');
    operation?.controller.abort();
    safely(() => operation?.cleanup());
    this.cleanupEngine(); this.port = null;
    this.composing = false; this.selectionKind = 'none'; this.error = null;
    this.publish();
    this.listeners.clear();
  }
}
