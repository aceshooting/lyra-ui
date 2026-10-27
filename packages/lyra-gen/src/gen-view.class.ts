import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '@aceshooting/lyra-ui/utilities/lyra-element.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '@aceshooting/lyra-ui/utilities/announcer.js';
import { initialCatalog } from './catalog.js';
import { validateContentProperties } from './content-policy.js';
import { createAction, createSurfaceState, reconcileSurfaceState, setSurfaceState, validateView, restoreSnapshot as validateSnapshot, type LyraGenSnapshot, type LyraGenSurfaceState } from './runtime.js';
import { readPointer } from './references.js';
import { resolveLimits, snapshotJson, validateSchema } from './schema.js';
import { notifyFailureCategories, type LyraGenFailureCallback } from './diagnostics.js';
import { LYRA_GEN_STRINGS } from './localization.js';
import { LYRA_GEN_ISOLATED_TYPE } from './isolation.js';
import { styles } from './gen-view.styles.js';
import type { JsonValue, LyraGenAction, LyraGenCatalog, LyraGenComponent, LyraGenDiagnostic, LyraGenLimits, LyraGenNode, LyraGenRecoveryMode, LyraGenResult, LyraGenView } from './types.js';

export type LyraGenViewStatus = 'empty' | 'loading' | 'ready' | 'error' | 'interrupted';
export interface LyraGenReady { readonly surfaceId: string; readonly revision: number }
export type LyraGenConfirmation = (action: LyraGenAction, signal: AbortSignal) => boolean | Promise<boolean>;
export interface LyraGenStateChange {
  readonly surfaceId: string;
  readonly revision: number;
  readonly nodeId: string;
  readonly values: JsonValue;
  readonly dirty: readonly string[];
}
export interface LyraGenViewEventMap {
  'lr-gen-action': CustomEvent<LyraGenAction>;
  'lr-gen-ready': CustomEvent<LyraGenReady>;
  'lr-gen-state-change': CustomEvent<LyraGenStateChange>;
  'lr-gen-error': CustomEvent<{ readonly diagnostics: readonly LyraGenDiagnostic[] }>;
}
interface RenderedNode {
  node: LyraGenNode;
  definition: LyraGenComponent;
  element: HTMLElement;
  ready: boolean;
  defaults: Map<string, unknown>;
  assigned: Set<string>;
  preparedInputs?: { readonly locale: string; readonly values: Readonly<Record<string, JsonValue>> };
  prepared?: Readonly<Record<string, unknown>>;
  text?: Text;
}
/** `data` marks an error caused by property preparation, which a later document may repair; module failures stay sticky. */
interface LoadState { status: 'loading' | 'ready' | 'error'; generation: number; data?: boolean }
const jsonEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) if (!Object.hasOwn(b, key) || !jsonEqual(a[key], b[key])) return false;
  return true;
};
const sameInputs = (previous: RenderedNode['preparedInputs'], locale: string, values: Readonly<Record<string, JsonValue>>): boolean => {
  if (!previous || previous.locale !== locale) return false;
  const keys = Object.keys(values);
  if (keys.length !== Object.keys(previous.values).length) return false;
  for (const key of keys) if (!Object.hasOwn(previous.values, key) || !jsonEqual(previous.values[key], values[key])) return false;
  return true;
};
interface PreparedNode {
  readonly record: RenderedNode;
  readonly next: RenderedNode;
  readonly loading: LoadState;
  readonly fresh: boolean;
  readonly children: PreparedNode[];
  parent?: PreparedNode;
  canAssemble: boolean;
}
interface RenderPlan {
  readonly root: PreparedNode;
  readonly records: Map<string, RenderedNode>;
  readonly definitions: Set<LyraGenComponent>;
  readonly commits: PreparedNode[];
}

/** Stand-in definition for isolation markers: a plain, non-interactive paragraph with no properties or events. */
const ISOLATED_DEFINITION: LyraGenComponent = Object.freeze({ tag: 'p', properties: Object.freeze({}) }) as LyraGenComponent;

// Cooperative limits: one trusted constructor, adapter or setter cannot be preempted.
const RENDER_SLICE_STEPS = 64;
const RENDER_SLICE_MS = 4;

/**
 * Render a validated, bounded generated view using a host-owned component catalog.
 * Stable node identities retain control DOM and dirty values across increasing revisions.
 * Model data cannot choose module paths, event listeners, HTML, or action permissions.
 *
 * Native form nodes contain form-associated Lyra controls. Their own validation and reset
 * contracts remain active; this renderer is a form container, not a form-associated control.
 * Submit actions without an explicit payload receive the current bound values.
 *
 * Read-only status and busy describe renderer readiness. The host aria-busy attribute is
 * managed by this component. Ready means encountered modules and generated child updates
 * have settled; it does not certify remote data or media loaded independently by a child.
 * Readiness never moves focus or announces completion automatically.
 *
 * @event {CustomEvent<LyraGenReady>} lr-gen-ready - Once per successfully rendered surface revision, after child updates settle.
 * @event {CustomEvent<LyraGenAction>} lr-gen-action - A validated host action request; no work is executed.
 * @event {CustomEvent<LyraGenStateChange>} lr-gen-state-change - User edit or reset proposal, including complete bound values.
 * @event {CustomEvent<{diagnostics: readonly LyraGenDiagnostic[]}>} lr-gen-error - Validation, loading, or action failure.
 * @csspart surface - Generated content container.
 * @csspart loading - A pending component's localized placeholder.
 * @csspart error - A localized failure message.
 * @csspart empty - Empty-document message.
 * @csspart isolated - Non-interactive fallback that replaces one component contained by `recovery="isolate"`.
 * @cssprop --lr-gen-loading-block-size - Default reserved block size during loading.
 */
export class LyraGenViewElement extends LyraElement<LyraGenViewEventMap> {
  static override styles = [LyraElement.styles, styles];
  /** @internal Scoped English defaults for this companion. */
  protected static readonly defaultStrings = LYRA_GEN_STRINGS;

  /** Optional local observation of coarse failure categories; receives no source or diagnostic details. */
  @property({ attribute: false }) failureCategories?: LyraGenFailureCallback;
  /** Host resource limits; omitted values keep defaults and overrides cannot exceed hard ceilings. */
  @property({ attribute: false }) limits?: Partial<LyraGenLimits>;
  /**
   * Validation recovery. `strict` (default; any other value behaves as strict) rejects the whole view on
   * any error; `isolate` replaces only a component-local defective node by a localized fallback with
   * part `isolated` and keeps every other node, its state, focus and actions.
   * @attr recovery
   */
  @property({ reflect: true }) recovery: LyraGenRecoveryMode = 'strict';
  /** Complete view; publish a higher revision to patch the same surface. */
  @property({ attribute: false }) document?: LyraGenView;
  /** Trusted catalog; only its declared tags, properties, and loaders are used. */
  @property({ attribute: false }) catalog: LyraGenCatalog = initialCatalog;
  /** Initial values, or authoritative values in controlled mode. Reassignment replaces local state. */
  @property({ attribute: false }) bindingState: JsonValue = {};
  /** Emit edit proposals and keep displaying bindingState until the host updates it. */
  @property({ type: Boolean }) controlled = false;
  /** Optional host allowlist that further narrows the catalog's action permissions. */
  @property({ attribute: false }) enabledActions?: readonly string[];
  /** Host-only confirmation callback for catalog actions marked confirm. */
  @property({ attribute: false }) confirmAction?: LyraGenConfirmation;

  /** Current renderer state; a disconnected nonempty view is interrupted. */
  get status(): LyraGenViewStatus {
    if (!this.document) return 'empty';
    if (!this.isConnected) return 'interrupted';
    if (this.document !== this.processedDocument || this.catalog !== this.processedCatalog || this.bindingState !== this.processedBindingState || this.limits !== this.processedLimits) return 'loading';
    return this.readinessStatus;
  }

  /** Whether current document admission, module loading, or child rendering is pending. */
  get busy(): boolean { return this.status === 'loading'; }

  private snapshotRestore?: { readonly snapshot: LyraGenSnapshot; readonly catalog: LyraGenCatalog };
  private processedLimits?: Partial<LyraGenLimits>;
  private get resolvedLimits(): Readonly<LyraGenLimits> { return resolveLimits(this.limits ?? {}); }

  private readinessStatus: LyraGenViewStatus = 'empty';
  private processedDocument?: LyraGenView;
  private processedCatalog?: LyraGenCatalog;
  private processedBindingState?: JsonValue;
  private readinessTask?: AbortController;
  private emittedReady?: LyraGenReady;
  private readinessErrorGeneration?: number;
  private accepted?: LyraGenView;
  private acceptedSource?: LyraGenView;
  private acceptedCatalog?: LyraGenCatalog;
  private localState?: LyraGenSurfaceState;
  private invalid = false;
  private nodes = new Map<string, RenderedNode>();
  private renderTask?: AbortController;
  private renderComplete: Promise<void> = Promise.resolve();
  private committedSource?: LyraGenView;
  private readonly loads = new Map<LyraGenComponent, LoadState>();
  private readonly confirmations = new Map<string, AbortController>();
  private generation = 0;
  private announcement?: AnnouncementSink;
  private frame?: number;
  private finishFrame?: () => void;
  private frameWindow?: Window;
  private mounted = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcement = acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
    this.setReadiness(this.document ? 'loading' : 'empty');
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.generation++;
    this.renderTask?.abort();
    this.renderTask = undefined;
    this.readinessTask?.abort();
    this.readinessTask = undefined;
    this.setReadiness(this.document ? 'interrupted' : 'empty');
    this.cancelConfirmations();
    this.announcement?.release();
    this.announcement = undefined;
    for (const [definition, state] of this.loads) if (state.status === 'loading') this.loads.delete(definition);
    if (this.frame !== undefined) this.frameWindow?.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.finishFrame?.();
    this.finishFrame = undefined;
  }

  /** Coalesce property bursts into one paint without leaving disconnected updates pending. */
  protected override async scheduleUpdate(): Promise<void> {
    const win = this.ownerDocument.defaultView;
    if (this.isConnected && win) {
      await new Promise<void>(resolve => {
        this.finishFrame = resolve;
        this.frameWindow = win;
        this.frame = win.requestAnimationFrame(() => {
          this.frame = undefined;
          this.finishFrame = undefined;
          resolve();
        });
      });
    }
    await super.scheduleUpdate();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.renderTask?.abort();
    this.renderTask = undefined;
    this.readinessTask?.abort();
    this.readinessTask = undefined;
    this.processedDocument = this.document;
    this.processedCatalog = this.catalog;
    this.processedBindingState = this.bindingState;
    this.processedLimits = this.limits;
    this.setReadiness(this.document ? 'loading' : 'empty');
    if (changed.has('document') || changed.has('catalog') || changed.has('limits') || changed.has('recovery')) {
      this.generation++;
      this.cancelConfirmations();
      for (const state of this.loads.values()) if (state.status === 'error' && state.data) { state.status = 'ready'; state.data = false; }
      if (changed.has('catalog')) { this.loads.clear(); this.nodes.clear(); }
      if (!this.document) { this.accepted = undefined; this.localState = undefined; this.invalid = false; return; }
      const result = validateView(this.document, this.catalog, { limits: this.resolvedLimits, recovery: this.recovery === 'isolate' ? 'isolate' : 'strict' });
      if (!result.ok) { this.rejectView(result.diagnostics); return; }
      if (result.isolated?.length && result.diagnostics.length) this.emitError(result.diagnostics);
      const previous = this.accepted;
      if (previous && previous.surfaceId === result.value.surfaceId && (result.value.revision < previous.revision || (result.value.revision === previous.revision && !jsonEqual(result.value, previous)))) {
        this.rejectView([{ code: 'revision.conflict', path: '/revision', message: 'A view revision cannot move backwards.', severity: 'error' }]);
        return;
      }
      try {
        const stateInput = snapshotJson(this.bindingState, this.resolvedLimits);
        if (!stateInput.ok) { this.rejectView(stateInput.diagnostics); return; }
        if (previous && this.localState && previous.surfaceId === result.value.surfaceId && result.value.revision > previous.revision && !changed.has('bindingState') && !this.controlled) {
          const reconciled = reconcileSurfaceState(this.localState, previous, result.value);
          if (!reconciled.ok) { this.rejectView(reconciled.diagnostics); return; }
          this.localState = reconciled.value;
        } else if (!previous || previous.surfaceId !== result.value.surfaceId || changed.has('bindingState') || this.controlled || changed.has('catalog')) {
          this.localState = createSurfaceState(result.value, stateInput.value);
        }
        if (previous?.surfaceId !== result.value.surfaceId) this.nodes.clear();
        if (this.snapshotRestore?.snapshot.view === this.document && this.snapshotRestore.catalog === this.catalog) this.localState = this.snapshotRestore.snapshot.state;
        this.snapshotRestore = undefined;
        this.accepted = result.value;
        this.acceptedSource = this.document;
        this.acceptedCatalog = this.catalog;
        this.retainLoads(result.value.root);
        this.invalid = false;
        this.validateState();
      } catch { this.rejectView([{ code: 'state.invalid', path: '', message: 'Initial state could not be admitted.', severity: 'error' }]); }
    } else if ((changed.has('bindingState') || changed.has('controlled')) && this.accepted) {
      this.cancelConfirmations();
      const supplied = snapshotJson(this.bindingState, this.resolvedLimits);
      if (!supplied.ok) { this.rejectView(supplied.diagnostics); return; }
      try { this.localState = createSurfaceState(this.accepted, supplied.value); this.invalid = false; this.validateState(); }
      catch { this.rejectView([{ code: 'state.invalid', path: '', message: 'Initial state could not be admitted.', severity: 'error' }]); }
    }
    if (changed.has('enabledActions') || changed.has('confirmAction')) this.cancelConfirmations();
  }

  protected override render() { return html`<div part="surface"></div>`; }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const surface = this.renderRoot.querySelector<HTMLElement>('[part="surface"]');
    if (!surface || !this.isConnected) return;
    if (this.invalid || !this.accepted) {
      const message = this.ownerDocument.createElement('p');
      message.setAttribute('part', this.invalid ? 'error' : 'empty');
      message.textContent = this.message(this.invalid ? 'genViewInvalid' : 'genViewEmpty');
      surface.replaceChildren(message);
      this.nodes.clear();
      this.setReadiness(this.invalid ? 'error' : 'empty');
    } else {
      const task = new AbortController();
      this.renderTask = task;
      this.renderComplete = this.renderInSlices(surface, task);
    }
    this.mounted = true;
  }

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    const rendered = this.renderComplete;
    await rendered;
    return complete && rendered === this.renderComplete;
  }

  private async renderInSlices(surface: HTMLElement, task: AbortController): Promise<void> {
    const accepted = this.accepted!;
    const source = this.document;
    const catalog = this.catalog;
    const state = this.localState;
    const bindings = this.bindingState;
    const limits = this.limits;
    const locale = this.effectiveLocale;
    const current = (): boolean => this.effectiveLocale === locale && !task.signal.aborted && this.isConnected && !this.invalid && this.accepted === accepted && this.document === source && this.catalog === catalog && this.localState === state && this.bindingState === bindings && this.limits === limits;
    const preparation = this.prepareTree(accepted.root);
    try {
      while (current()) {
        const started = performance.now();
        let step: IteratorResult<void, RenderPlan>;
        let work = 0;
        do {
          step = preparation.next();
          if (!current()) return;
          if (step.done) {
            this.commitRender(surface, step.value);
            if (!current()) return;
            this.committedSource = source;
            this.renderTask = undefined;
            this.checkReadiness();
            return;
          }
        } while (++work < RENDER_SLICE_STEPS && performance.now() - started < RENDER_SLICE_MS);
        await this.nextRenderFrame(task.signal);
      }
    } catch {
      if (!current()) return;
      this.readinessErrorGeneration = this.generation;
      this.setReadiness('error');
      this.report('genViewLoadFailed', 'component.properties');
    } finally {
      if (this.renderTask === task) this.renderTask = undefined;
    }
  }

  private nextRenderFrame(signal: AbortSignal): Promise<void> {
    const win = this.ownerDocument.defaultView;
    if (!win || signal.aborted) return Promise.resolve();
    return new Promise(resolve => {
      const finish = (): void => { signal.removeEventListener('abort', cancel); resolve(); };
      const frame = win.requestAnimationFrame(finish);
      const cancel = (): void => { win.cancelAnimationFrame(frame); finish(); };
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  private *prepareTree(root: LyraGenNode): Generator<void, RenderPlan> {
    const records = new Map<string, RenderedNode>();
    const definitions = new Set<LyraGenComponent>();
    const ordered: PreparedNode[] = [];
    const pending: { nodes: readonly LyraGenNode[]; index: number; parent?: PreparedNode }[] = [{ nodes: [root], index: 0 }];
    while (pending.length) {
      const entry = pending[pending.length - 1]!;
      if (entry.index === entry.nodes.length) { pending.pop(); continue; }
      const node = entry.nodes[entry.index++]!;
      const prepared = this.prepareNode(node);
      prepared.parent = entry.parent;
      entry.parent?.children.push(prepared);
      ordered.push(prepared);
      records.set(node.id, prepared.record);
      definitions.add(prepared.next.definition);
      if (prepared.next.ready && node.children?.length) pending.push({ nodes: node.children, index: 0, parent: prepared });
      yield;
    }
    const commits: PreparedNode[] = [];
    for (let index = ordered.length - 1; index >= 0; index--) {
      const prepared = ordered[index]!;
      if (prepared.canAssemble) {
        for (const child of prepared.children) {
          prepared.next.element.appendChild(child.next.element);
          yield;
        }
      } else {
        commits.push(prepared);
        if (prepared.parent) prepared.parent.canAssemble = false;
      }
      yield;
    }
    return { root: ordered[0]!, records, definitions, commits };
  }

  private commitRender(surface: HTMLElement, plan: RenderPlan): void {
    let focused = this.ownerDocument.activeElement === this ? this.ownerDocument.activeElement : null;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
    for (const prepared of plan.commits) {
      this.applyPrepared(prepared);
      if (prepared.record.ready) this.placeChildren(prepared.record.element, [
        ...(prepared.record.text && prepared.record.node.text !== undefined ? [prepared.record.text] : []),
        ...prepared.children.map(child => child.record.element),
      ]);
    }
    this.placeChildren(surface, [plan.root.record.element]);
    this.nodes = plan.records;
    for (const definition of this.loads.keys()) if (!plan.definitions.has(definition)) this.loads.delete(definition);
    if (focused instanceof HTMLElement && focused.isConnected && this.ownerDocument.activeElement !== this && focused.getRootNode() instanceof ShadowRoot) {
      // A real reorder may detach a focused subtree; same-position patches never move it.
      focused.focus({ preventScroll: true });
    }
  }

  private setReadiness(status: LyraGenViewStatus): void {
    const connectedStatus = !this.isConnected && this.document ? 'interrupted' : status;
    this.readinessStatus = connectedStatus;
    this.setAttribute('aria-busy', connectedStatus === 'loading' ? 'true' : 'false');
  }

  private checkReadiness(): void {
    if (!this.accepted || this.invalid || !this.isConnected) return;
    if (this.readinessErrorGeneration === this.generation || [...this.loads.values()].some(state => state.status === 'error')) {
      this.setReadiness('error');
      return;
    }
    if ([...this.nodes.values()].some(record => !record.ready)) {
      this.setReadiness('loading');
      return;
    }
    const task = new AbortController();
    this.readinessTask = task;
    const generation = this.generation;
    const accepted = this.accepted;
    const source = this.document;
    const catalog = this.catalog;
    const bindingState = this.bindingState;
    const limits = this.limits;
    const records = [...this.nodes.values()];
    const current = (): boolean => !task.signal.aborted && this.isConnected && this.generation === generation && this.accepted === accepted && this.document === source && this.catalog === catalog && this.bindingState === bindingState && this.limits === limits && !this.invalid;
    const settled = Promise.all(records.map(async record => {
      try { await this.settleChild(record.element, task.signal); }
      catch (error: unknown) {
        if (current()) {
          const load = this.loads.get(record.definition);
          if (load) load.status = 'error';
        }
        throw error;
      }
    }));
    void settled.then(() => {
      if (!current()) return;
      this.setReadiness('ready');
      if (this.emittedReady?.surfaceId === accepted.surfaceId && this.emittedReady.revision === accepted.revision) return;
      const detail = { surfaceId: accepted.surfaceId, revision: accepted.revision };
      this.emittedReady = detail;
      this.emit('lr-gen-ready', detail);
    }).catch(() => {
      if (!current()) return;
      this.readinessErrorGeneration = generation;
      this.setReadiness('error');
      this.report('genViewLoadFailed', 'component.update');
      this.requestUpdate();
    }).finally(() => {
      if (this.readinessTask === task) this.readinessTask = undefined;
    });
  }

  private async settleChild(element: HTMLElement, signal: AbortSignal): Promise<void> {
    const child = element as HTMLElement & { readonly updateComplete?: Promise<unknown>; readonly isUpdatePending?: boolean };
    for (let cycle = 0; cycle < 32 && !signal.aborted; cycle++) {
      const pending = child.updateComplete;
      if (!pending || typeof pending.then !== 'function') return;
      let abort: () => void = () => {};
      const interrupted = new Promise<void>(resolve => { abort = resolve; signal.addEventListener('abort', abort, { once: true }); });
      let result: unknown;
      try { result = await Promise.race([pending, interrupted]); }
      finally { signal.removeEventListener('abort', abort); }
      if (signal.aborted || (result !== false && child.isUpdatePending !== true)) return;
    }
    if (!signal.aborted) throw new Error('Child update did not settle within the render budget.');
  }

  private message(key: keyof typeof LYRA_GEN_STRINGS): string {
    return this.localize(key);
  }

  private validateState(): void {
    if (!this.localState || !this.accepted) return;
    const admitted = snapshotJson(this.localState.values, this.resolvedLimits);
    if (!admitted.ok) { this.rejectView(admitted.diagnostics); return; }
    for (const [pointer, owner] of Object.entries(this.localState.owners)) {
      const value = readPointer(this.localState.values, pointer);
      const schema = this.catalog.components[owner.type]?.properties[owner.property];
      if (value.ok && (!schema || !validateSchema(value.value, schema, this.resolvedLimits).ok)) {
        this.rejectView([{ code: 'state.schema', path: pointer, message: 'A bound value violates its component schema.', severity: 'error' }]);
        return;
      }
    }
  }

  private emitError(diagnostics: readonly LyraGenDiagnostic[]): void {
    notifyFailureCategories(diagnostics, this.failureCategories);
    this.emit('lr-gen-error', { diagnostics });
  }

  private rejectView(diagnostics: readonly LyraGenDiagnostic[]): void {
    this.invalid = true;
    this.setReadiness('error');
    this.emitError(diagnostics);
    if (this.mounted) this.announcement?.announce(this.message('genViewInvalid'));
  }

  private report(key: keyof typeof LYRA_GEN_STRINGS, code: string): void {
    const message = this.message(key);
    this.emitError([{ code, path: '', message, severity: 'error' }]);
    if (this.mounted) this.announcement?.announce(message);
  }

  private retainLoads(root: LyraGenNode): void {
    const definitions = new Set<LyraGenComponent>();
    const visit = (node: LyraGenNode): void => {
      definitions.add(this.definitionOf(node));
      node.children?.forEach(visit);
    };
    visit(root);
    for (const definition of this.loads.keys()) if (!definitions.has(definition)) this.loads.delete(definition);
  }

  private load(definition: LyraGenComponent): LoadState {
    const previous = this.loads.get(definition);
    if (previous) return previous;
    const state: LoadState = { status: definition.load ? 'loading' : 'ready', generation: this.generation };
    this.loads.set(definition, state);
    if (definition.load) {
      const catalog = this.catalog;
      void Promise.resolve().then(() => definition.load!()).then(() => {
        if (!this.isConnected || this.catalog !== catalog || this.loads.get(definition) !== state) return;
        if (definition.tag.includes('-') && !this.ownerDocument.defaultView?.customElements.get(definition.tag)) throw new Error('Missing component registration.');
        state.status = 'ready';
        if (!this.invalid && this.document === this.acceptedSource) this.requestUpdate();
      }).catch(() => {
        if (!this.isConnected || this.catalog !== catalog || this.loads.get(definition) !== state) return;
        state.status = 'error';
        if (this.invalid || this.document !== this.acceptedSource) return;
        this.setReadiness('error');
        this.report('genViewLoadFailed', 'component.load');
        this.requestUpdate();
      });
    }
    return state;
  }

  private definitionOf(node: LyraGenNode): LyraGenComponent {
    return node.type === LYRA_GEN_ISOLATED_TYPE ? ISOLATED_DEFINITION : this.catalog.components[node.type]!;
  }

  private prepareNode(node: LyraGenNode): PreparedNode {
    const isolated = node.type === LYRA_GEN_ISOLATED_TYPE;
    const definition = this.definitionOf(node);
    const loading = this.load(definition);
    const previous = this.nodes.get(node.id);
    const ready = loading.status === 'ready';
    const fresh = !previous || previous.node.type !== node.type || previous.definition !== definition || previous.ready !== ready;
    const record: RenderedNode = fresh
      ? { node, definition, element: this.ownerDocument.createElement(ready ? definition.tag : 'p'), ready, defaults: new Map(), assigned: new Set() }
      : previous;
    const next: RenderedNode = { ...record, node, defaults: new Map(record.defaults), assigned: new Set(record.assigned) };
    const prepared: PreparedNode = { record, next, loading, fresh, children: [], canAssemble: fresh };
    if (fresh) {
      record.element.dataset['genId'] = node.id;
      if (ready && !isolated) this.installEvents(record);
    }
    if (isolated) { if (fresh) this.applyPrepared(prepared); return prepared; }
    if (!ready) {
      if (fresh) this.applyPrepared(prepared);
      return prepared;
    }
    const target = record.element as unknown as Record<string, unknown>;
    const values: Record<string, JsonValue> = { ...node.props };
    for (const propertyName of Object.keys(node.bindings ?? {})) if (!next.defaults.has(propertyName)) next.defaults.set(propertyName, target[propertyName]);
    for (const [propertyName, pointer] of Object.entries(node.bindings ?? {})) {
      const value = readPointer(this.localState?.values ?? {}, pointer);
      if (value.ok) values[propertyName] = value.value;
      else if (!Object.hasOwn(values, propertyName)) {
        const fallback = snapshotJson(next.defaults.get(propertyName));
        if (fallback.ok) values[propertyName] = fallback.value;
      }
    }
    const locale = this.effectiveLocale;
    if (!sameInputs(next.preparedInputs, locale, values)) {
      for (const [propertyName, value] of Object.entries(values)) {
        const schema = definition.properties[propertyName];
        if (!schema || !validateSchema(value, schema, this.resolvedLimits).ok) {
          loading.status = 'error';
          loading.data = true;
          this.setReadiness('error');
          this.report('genViewInvalidState', 'state.schema');
          return this.prepareNode(node);
        }
      }
      try {
        const adapted = definition.prepareProperties ? definition.prepareProperties(Object.freeze(values), { locale: this.effectiveLocale }) : values;
        next.prepared = Object.freeze({ ...adapted });
        const diagnostics = validateContentProperties(next.prepared, definition);
        if (diagnostics.length) {
          loading.status = 'error';
          loading.data = true;
          this.setReadiness('error');
          this.emitError(diagnostics);
          if (this.mounted) this.announcement?.announce(this.message('genViewInvalidState'));
          return this.prepareNode(node);
        }
        next.preparedInputs = { locale, values };
      } catch {
        loading.status = 'error';
        loading.data = true;
        this.setReadiness('error');
        this.report('genViewLoadFailed', 'component.properties');
        return this.prepareNode(node);
      }
    }
    if (node.text !== undefined) next.text ??= this.ownerDocument.createTextNode(node.text);
    if (fresh) this.applyPrepared(prepared);
    return prepared;
  }

  private applyPrepared(prepared: PreparedNode): void {
    const { record, next, loading } = prepared;
    Object.assign(record, next);
    const { element, node, definition } = record;
    element.slot = node.slot ?? '';
    if (node.type === LYRA_GEN_ISOLATED_TYPE) {
      element.setAttribute('part', 'isolated');
      element.setAttribute('role', 'group');
      element.dataset['genType'] = node.type;
      const text = this.message('genViewInvalid');
      if (element.textContent !== text) element.textContent = text;
      return;
    }
    if (!record.ready) {
      element.setAttribute('part', loading.status === 'error' ? 'error' : 'loading');
      element.setAttribute('aria-busy', loading.status === 'loading' ? 'true' : 'false');
      element.textContent = this.message(loading.status === 'error' ? 'genViewLoadFailed' : 'genViewLoading');
      if (definition.minimumBlockSize) element.style.minBlockSize = definition.minimumBlockSize;
      return;
    }
    element.dataset['genType'] = node.type;
    const target = element as unknown as Record<string, unknown>;
    const values = record.prepared ?? {};
    for (const propertyName of record.assigned) if (!Object.hasOwn(values, propertyName)) {
      target[propertyName] = record.defaults.get(propertyName);
      record.assigned.delete(propertyName);
    }
    for (const [propertyName, value] of Object.entries(values)) {
      if (!Object.hasOwn(definition.properties, propertyName)) continue;
      if (!record.defaults.has(propertyName)) record.defaults.set(propertyName, target[propertyName]);
      if (!Object.is(target[propertyName], value)) target[propertyName] = value;
      record.assigned.add(propertyName);
    }
    if (record.text && node.text !== undefined) {
      if (record.text.data !== node.text) record.text.data = node.text;
      if (prepared.fresh) element.appendChild(record.text);
    }
  }

  private placeChildren(parent: Node, children: readonly Node[]): void {
    let cursor = parent.firstChild;
    for (const child of children) {
      if (cursor === child) cursor = cursor.nextSibling;
      else parent.insertBefore(child, cursor);
    }
    while (cursor) { const next = cursor.nextSibling; parent.removeChild(cursor); cursor = next; }
  }

  private installEvents(record: RenderedNode): void {
    const events = new Set([...(record.definition.events ?? []), ...Object.values(record.definition.bindings ?? {}).map(binding => binding.event)]);
    if (record.definition.tag === 'form') events.add('reset');
    for (const name of events) record.element.addEventListener(name, event => {
      if (event.target !== record.element || this.nodes.get(record.node.id) !== record || !this.accepted || this.invalid || !this.isConnected || this.catalog !== this.acceptedCatalog) return;
      const target = record.element as unknown as Record<string, unknown>;
      if (target['disabled'] === true || target['effectiveDisabled'] === true || record.element.closest('[inert]')) return;
      if ((name === 'reset' || name === 'submit') && (this.renderTask || this.committedSource !== this.document)) { event.preventDefault(); return; }
      if (name === 'reset') { queueMicrotask(() => { if (!event.defaultPrevented) this.resetState(record.node.id); }); return; }
      if (name === 'submit') {
        event.preventDefault();
        if (!(record.element as HTMLFormElement).reportValidity()) return;
      }
      for (const [propertyName, binding] of Object.entries(record.definition.bindings ?? {})) {
        const pointer = record.node.bindings?.[propertyName];
        const owner = pointer === undefined ? undefined : this.localState?.owners[pointer];
        if (owner?.nodeId !== record.node.id || owner.property !== propertyName || owner.type !== record.node.type) continue;
        if (pointer === undefined || binding.event !== name || !this.localState || target['readonly'] === true) continue;
        const schema = record.definition.properties[propertyName];
        const value = schema ? validateSchema(target[binding.property], schema, this.resolvedLimits) : undefined;
        if (!value?.ok) { this.report('genViewInvalidState', 'state.schema'); this.requestUpdate(); continue; }
        const next = setSurfaceState(this.localState, pointer, value.value);
        if (next.ok && snapshotJson(next.value.values, this.resolvedLimits).ok) {
          if (!this.controlled) { this.localState = next.value; this.cancelConfirmations(); }
          this.emitState(record.node.id, next.value);
          this.requestUpdate();
        } else {
          this.report('genViewInvalidState', 'state.limit');
          this.requestUpdate();
        }
      }
      if (!this.renderTask && this.committedSource === this.document && record.node.action && record.definition.events?.includes(name)) void this.requestAction(record, name === 'submit');
    });
  }

  private emitState(nodeId: string, state: LyraGenSurfaceState): void {
    this.emit('lr-gen-state-change', { surfaceId: state.surfaceId, revision: state.revision, nodeId, values: state.values, dirty: state.dirty });
  }

  private async requestAction(record: RenderedNode, submit: boolean): Promise<void> {
    const view = this.accepted;
    const sourceDocument = this.document;
    const sourceCatalog = this.catalog;
    const sourceConfirmation = this.confirmAction;
    const sourceActions = this.enabledActions;
    const sourceState = this.bindingState;
    const sourceLocalState = this.localState;
    const name = record.node.action?.name;
    if (!view || this.document !== this.acceptedSource || this.catalog !== this.acceptedCatalog || !name || (this.enabledActions && !this.enabledActions.includes(name))) { this.report('genViewActionDenied', 'action.denied'); return; }
    let payload: JsonValue | undefined;
    if (submit && record.node.action?.payload === undefined) {
      let complete = true;
      const included = (node: LyraGenNode): LyraGenNode => {
        const rendered = this.nodes.get(node.id);
        if (!rendered?.ready) complete = false;
        const control = rendered?.element as unknown as Record<string, unknown> | undefined;
        const disabled = control?.['disabled'] === true || control?.['effectiveDisabled'] === true;
        return { ...node, bindings: disabled ? {} : node.bindings, children: node.children?.map(included) };
      };
      const root = included(record.node);
      if (!complete) { this.report('genViewActionDenied', 'action.incomplete'); return; }
      payload = createSurfaceState({ ...view, root }, this.localState?.values).values;
    }
    const action = createAction(view, record.node.id, this.catalog, payload);
    if (!action.ok) { this.emitError(action.diagnostics); return; }
    if (this.catalog.actions?.[name]?.confirm) {
      if (!this.confirmAction) { this.report('genViewConfirmationRequired', 'action.confirmation'); return; }
      this.confirmations.get(record.node.id)?.abort();
      const controller = new AbortController();
      this.confirmations.set(record.node.id, controller);
      try {
        const confirmed = await this.confirmAction(action.value, controller.signal);
        if (confirmed !== true || controller.signal.aborted || !this.isConnected || this.accepted !== view || this.document !== sourceDocument || this.catalog !== sourceCatalog || this.confirmAction !== sourceConfirmation || this.enabledActions !== sourceActions || this.bindingState !== sourceState || this.localState !== sourceLocalState || (this.enabledActions && !this.enabledActions.includes(name))) { controller.abort(); return; }
      } catch { if (!controller.signal.aborted) this.report('genViewActionDenied', 'action.denied'); return; }
      finally { if (this.confirmations.get(record.node.id) === controller) this.confirmations.delete(record.node.id); }
    }
    this.emit('lr-gen-action', action.value);
  }

  private cancelConfirmations(): void {
    for (const controller of this.confirmations.values()) controller.abort();
    this.confirmations.clear();
  }

  private resetState(nodeId: string): void {
    if (!this.accepted || !this.isConnected) return;
    try {
      const fresh = createSurfaceState(this.accepted, this.bindingState);
      const form = this.nodes.get(nodeId);
      if (!form || !this.localState) return;
      const resetIds = new Set<string>();
      const visit = (node: LyraGenNode): void => { resetIds.add(node.id); node.children?.forEach(visit); };
      visit(form.node);
      let next = this.localState;
      const paths = new Set<string>();
      for (const [pointer, owner] of Object.entries(fresh.owners)) {
        if (!resetIds.has(owner.nodeId)) continue;
        paths.add(pointer);
        const value = readPointer(fresh.values, pointer);
        const fallback = snapshotJson(this.nodes.get(owner.nodeId)?.defaults.get(owner.property));
        if (!value.ok && !fallback.ok) continue;
        const changed = setSurfaceState(next, pointer, value.ok ? value.value : fallback.ok ? fallback.value : null);
        if (changed.ok) next = changed.value;
      }
      next = Object.freeze({ ...next, dirty: Object.freeze(next.dirty.filter(pointer => !paths.has(pointer))) });
      if (!this.controlled) { this.localState = next; this.cancelConfirmations(); }
      this.emitState(nodeId, next);
      this.requestUpdate();
    } catch { this.report('genViewInvalidState', 'state.invalid'); }
  }

  /** Restore a validated view and its dirty binding ownership silently; no action is replayed. */
  restoreSnapshot(input: unknown): LyraGenResult<LyraGenSnapshot> {
    const restored = validateSnapshot(input, this.catalog, { limits: this.resolvedLimits });
    if (!restored.ok) return restored;
    const previous = this.accepted;
    const next = restored.value.view;
    if (previous && previous.surfaceId === next.surfaceId && (next.revision < previous.revision || (next.revision === previous.revision && !jsonEqual(next, previous)))) return { ok: false, diagnostics: [{ code: 'revision.conflict', path: '/revision', message: 'A snapshot cannot replace an existing revision with different content.', severity: 'error' }] };
    this.snapshotRestore = { snapshot: restored.value, catalog: this.catalog };
    this.document = restored.value.view;
    this.bindingState = restored.value.state.values;
    this.requestUpdate();
    return restored;
  }

  /** Reset generated native forms to their accepted defaults and publish state proposals. */
  reset(): void {
    for (const record of this.nodes.values()) if (record.ready && record.definition.tag === 'form') (record.element as HTMLFormElement).reset();
  }
}

declare global {
  interface HTMLElementTagNameMap { 'lr-gen-view': LyraGenViewElement }
}
