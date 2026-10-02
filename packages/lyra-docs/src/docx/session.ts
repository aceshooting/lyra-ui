import type { DocxEngineEvent, DocxEnginePort, DocxMountOwnership, DocxSessionPort } from './engine-port.js';
import type {
  DocxCommand, DocxCommandAvailability, DocxRefusalCode, DocxResult, DocxRevision,
  DocxSaveReceipt, DocxSelection, DocxSelectionLease, DocxSession,
  DocxSessionOptions, DocxSnapshot, DocxSource, DocxStatus
} from './types.js';

const commands: readonly DocxCommand[] = ['bold', 'italic', 'underline', 'undo', 'redo'];
const maxInputBytes = 4 * 1024 * 1024;
const maxExportBytes = 16 * 1024 * 1024;
const ok = <T>(value: T): DocxResult<T> => Object.freeze({ ok: true, value });
const refused = <T = never>(code: DocxRefusalCode): DocxResult<T> => Object.freeze({ ok: false, code });
const disabled = (reason: DocxRefusalCode): DocxCommandAvailability => Object.freeze({ enabled: false, reason });
function safely(action: (() => void) | null | undefined) {
  try { action?.(); } catch { /* Continue releasing independently owned handles. */ }
}
function equalRevision(a: DocxRevision | null | undefined, b: DocxRevision | null | undefined) {
  return !!a && !!b && a.documentId === b.documentId && a.value === b.value;
}
interface Operation {
  controller: AbortController;
  interruption: Promise<DocxResult<never>>;
  termination: Promise<DocxResult<never>>;
  interrupt(code: DocxRefusalCode): void;
  cleanup(): void;
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

class InternalDocxSession implements DocxSession {
  private status: DocxStatus = 'idle';
  private revision: DocxRevision | null = null;
  private dirty = false;
  private composing = false;
  private selectionKind: DocxSelection['kind'] = 'none';
  private selectionVersion = 0;
  private error: DocxRefusalCode | null = null;
  private engine: DocxEnginePort | null = null;
  private unsubscribeEngine: (() => void) | null = null;
  private operation: Operation | null = null;
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

  snapshot() { return this.cached; }
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
    if (this.operation) return 'busy';
    if (this.status !== 'ready') return 'not-ready';
    return null;
  }
  private availability(command: DocxCommand): DocxCommandAvailability {
    if (this.status === 'destroyed') return disabled('destroyed');
    if (this.operation) return disabled('busy');
    if (this.status !== 'ready' || !this.engine) return disabled('not-ready');
    if (this.composing) return disabled('composing');
    if (this.readOnly) return disabled('read-only');
    try {
      const engine = this.engine;
      const result = engine.can(command);
      if (this.engine !== engine || this.status !== 'ready') return disabled(this.completionFailure() ?? 'not-ready');
      if (this.operation) return disabled('busy');
      if (this.composing) return disabled('composing');
      if (!result.enabled) return disabled(result.reason ?? 'unsupported');
      return Object.freeze({ enabled: true,
        ...((command === 'undo' || command === 'redo' || result.active === undefined) ? {} : { active: result.active }) });
    } catch { return disabled(this.completionFailure() ?? 'unsupported'); }
  }
  can(command: DocxCommand) {
    if (!commands.includes(command)) return disabled('unsupported');
    this.owned();
    return this.availability(command);
  }
  private publish() {
    const previous = this.cached;
    const available = Object.fromEntries(commands.map(command => [command, this.availability(command)])) as Record<DocxCommand, DocxCommandAvailability>;
    // An engine capability hook may have caused a nested terminal publication.
    if (this.cached !== previous) return;
    const activity = this.status === 'ready' && this.operation ? 'saving' : null;
    if (previous && previous.status === this.status && previous.activity === activity &&
        previous.revision === this.revision && previous.dirty === this.dirty && previous.composing === this.composing &&
        previous.selection.kind === this.selectionKind && previous.selection.version === this.selectionVersion &&
        previous.error?.code === (this.error ?? undefined) && commands.every(command => {
          const a = previous.commands[command], b = available[command];
          return a.enabled === b.enabled && a.reason === b.reason && a.active === b.active;
        })) return;
    this.cached = Object.freeze({ status: this.status, activity, revision: this.revision, dirty: this.dirty,
      readOnly: this.readOnly, composing: this.composing,
      selection: Object.freeze({ version: this.selectionVersion, kind: this.selectionKind }),
      commands: Object.freeze(available), error: this.error ? Object.freeze({ code: this.error }) : null });
    const published = this.cached;
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try { listener(); } catch { safely(() => this.port?.subscriberFailed?.()); }
      // A reentrant transition has already notified its own subscriber snapshot.
      if (this.cached !== published) break;
    }
  }
  private begin(signal?: AbortSignal): Operation {
    const controller = new AbortController();
    let interrupt!: (code: DocxRefusalCode) => void;
    const interruption = new Promise<DocxResult<never>>(resolve => { interrupt = code => resolve(refused(code)); });
    let terminate!: (code: DocxRefusalCode) => void;
    const termination = new Promise<DocxResult<never>>(resolve => { terminate = code => resolve(refused(code)); });
    const aborted = () => { controller.abort(); interrupt('aborted'); };
    signal?.addEventListener('abort', aborted, { once: true });
    const operation = { controller, interruption, termination,
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
      const off = engine.subscribe(event => this.engineEvent(event));
      if (!this.owned() || !this.current(operation)) { safely(off); return refused('destroyed'); }
      this.unsubscribeEngine = off;
      if (operation.controller.signal.aborted) return this.failOpen(operation, 'aborted');
      const state = engine.inspect();
      if (!this.owned() || !this.current(operation)) return refused('destroyed');
      if (operation.controller.signal.aborted) return this.failOpen(operation, 'aborted');
      this.selectionKind = state.selection; this.composing = state.composing;
      this.revision = Object.freeze({ documentId: globalThis.crypto.randomUUID(), value: 0 });
    } catch { return this.failOpen(operation, 'open-failed'); }
    this.end(operation);
    this.dirty = copy.kind === 'blank';
    this.status = 'ready'; this.publish();
    const failure = this.completionFailure();
    return failure ? refused(failure) : ok(this.revision!);
  }
  private engineEvent(event: DocxEngineEvent) {
    if (this.status !== 'ready' || !this.engine || !this.owned()) return;
    // Record the committed change even when its subsequent inspection fails.
    if (event === 'change') {
      this.revision = Object.freeze({ documentId: this.revision!.documentId, value: this.revision!.value + 1 });
      this.dirty = true;
    }
    if (event === 'change' || event === 'user-selection' || event === 'composition') this.releaseLease();
    if (!this.owned() || !this.engine || this.status !== 'ready') return;
    let state;
    try { state = this.engine.inspect(); }
    catch { this.failEngine(); return; }
    if (!this.owned() || this.status !== 'ready') return;
    if (event === 'user-selection' || state.selection !== this.selectionKind) this.selectionVersion++;
    this.selectionKind = state.selection; this.composing = state.composing;
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
  execute(command: DocxCommand, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease } = {}): DocxResult<DocxRevision> {
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
  private executeCommand(command: DocxCommand, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease }): DocxResult<DocxRevision> {
    const gate = this.gate();
    if (gate) return refused(gate);
    if (options.expectedRevision && !equalRevision(options.expectedRevision, this.revision)) return refused('stale-revision');
    const supplied = options.selection;
    if (supplied && (this.lease?.lease !== supplied || !equalRevision(this.lease.revision, this.revision))) return refused('stale-selection');
    const available = this.can(command);
    if (!available.enabled) return refused(available.reason ?? 'unsupported');
    const result = this.engine!.execute(command, supplied ? this.lease!.token : undefined);
    return result.ok ? ok(this.revision!) : result;
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
