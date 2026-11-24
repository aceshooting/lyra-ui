/**
 * A framework-free, DOM-free controller for branching scripted (no-model) conversations that drive
 * one generated surface: a validated choice tree, the current path, strictly increasing revisions
 * across every transition, supersession of stale builds and coalesced control edits.
 * `connectScriptedConversation()` optionally binds it to an `lr-gen-view` element.
 */
import { snapshotJson } from './schema.js';
import { applyViewPatch, validateView, type LyraGenPatchOperation, type LyraGenValidationOptions } from './runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenDiagnostic, LyraGenNode, LyraGenResult, LyraGenView } from './types.js';

/** One follow-up a step offers. `copy` is application-owned (localized text or a key) and never read. */
export interface LyraGenScriptedChoice<TCopy = unknown> {
  readonly id: string;
  /** The step this choice leads to. */
  readonly next: string;
  readonly copy?: TCopy;
}
/** One scripted step. A step without choices ends its branch; every other step offers at least two. */
export interface LyraGenScriptedStep<TCopy = unknown> {
  readonly id: string;
  readonly choices: readonly LyraGenScriptedChoice<TCopy>[];
  readonly copy?: TCopy;
}
/** An acyclic choice tree (shared continuations allowed) with every step reachable from `start`. */
export interface LyraGenScriptedTree<TCopy = unknown> {
  readonly start: string;
  readonly steps: Readonly<Record<string, LyraGenScriptedStep<TCopy>>>;
}
/** A resolved path: the choices taken, the steps visited (`start` first) and the current step. */
export interface LyraGenScriptedPath {
  readonly choices: readonly string[];
  readonly steps: readonly string[];
  readonly step: string;
}
export type LyraGenScriptedControls = Readonly<Record<string, JsonValue>>;
/** A complete view body (surface and revision are stamped by the controller) or scoped patch operations against `context.previous`. */
export type LyraGenScriptedBuildResult =
  | (Omit<LyraGenView, 'version' | 'catalog' | 'surfaceId' | 'revision'> & Partial<Pick<LyraGenView, 'version' | 'catalog' | 'surfaceId' | 'revision'>>)
  | { readonly operations: readonly LyraGenPatchOperation[] };
export interface LyraGenScriptedBuildContext {
  /** Aborted when a later transition supersedes this build. */
  readonly signal: AbortSignal;
  /** The revision this build will publish. */
  readonly revision: number;
  /** The last committed view, the base of a patch result. */
  readonly previous?: LyraGenView;
  readonly reason: LyraGenScriptedTransition;
}
export type LyraGenScriptedBuildStep = (path: LyraGenScriptedPath, controls: LyraGenScriptedControls, context: LyraGenScriptedBuildContext) => LyraGenScriptedBuildResult | Promise<LyraGenScriptedBuildResult>;
export type LyraGenScriptedTransition = 'restart' | 'choose' | 'back' | 'goto' | 'retry' | 'controls';
export type LyraGenScriptedStatus = 'idle' | 'building' | 'ready' | 'error' | 'disposed';
export type LyraGenScriptedResult = 'accepted' | 'unknown' | 'unavailable' | 'disposed';
export interface LyraGenScriptedOptions<TCopy = unknown> {
  readonly tree: LyraGenScriptedTree<TCopy>;
  readonly catalog: LyraGenCatalog;
  readonly surfaceId: string;
  readonly buildStep: LyraGenScriptedBuildStep;
  readonly controls?: LyraGenScriptedControls;
  /** The first revision published (default 1); later ones only increase. */
  readonly revisionStart?: number;
  readonly validation?: LyraGenValidationOptions;
}
/** A transcript entry; `copy` is the step's or choice's application-owned copy, passed through untouched. */
export type LyraGenScriptedEntry<TCopy = unknown> =
  | { readonly kind: 'prompt'; readonly id: string; readonly stepId: string; readonly copy?: TCopy }
  | { readonly kind: 'answer'; readonly id: string; readonly stepId: string; readonly choiceId: string; readonly copy?: TCopy };
/**
 * Where the host may restore focus once the committed revision has rendered: the named choice of the
 * current step (after Back, the choice just undone), or the step itself when it has no choices.
 * Absent for control edits, which never move focus.
 */
export interface LyraGenScriptedFocusTarget {
  readonly reason: Exclude<LyraGenScriptedTransition, 'controls'>;
  readonly choiceId?: string;
}
export interface LyraGenScriptedSnapshot<TCopy = unknown> {
  readonly surfaceId: string;
  readonly status: LyraGenScriptedStatus;
  /** Increments on every transition; a build or render report from an older generation is ignored. */
  readonly generation: number;
  readonly path: readonly string[];
  readonly steps: readonly string[];
  readonly step: LyraGenScriptedStep<TCopy>;
  readonly choices: readonly LyraGenScriptedChoice<TCopy>[];
  readonly canGoBack: boolean;
  readonly terminal: boolean;
  readonly transcript: readonly LyraGenScriptedEntry<TCopy>[];
  readonly controls: LyraGenScriptedControls;
  /** The last committed, validated view. */
  readonly document?: LyraGenView;
  /** The revision being built, while `status` is `'building'`. */
  readonly pendingRevision?: number;
  /** Whether the host reported `document` rendered (`markRendered`). */
  readonly rendered: boolean;
  /** Present only once `document` is rendered and belongs to the latest navigation. */
  readonly focusTarget?: LyraGenScriptedFocusTarget;
  readonly diagnostics: readonly LyraGenDiagnostic[];
}
export type LyraGenScriptedListener<TCopy> = (snapshot: LyraGenScriptedSnapshot<TCopy>) => void;

const identity = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const MAX_STEPS = 256;
const MAX_CHOICES = 16;
const MAX_DEPTH = 32;
const MAX_CONTROLS = 64;
const issue = (code: string, path: string, message: string): LyraGenDiagnostic => ({ code, path, message, severity: 'error' });
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const freeze = <T>(value: T): T => Object.freeze(value);

/** Validate a scripted choice tree: identities, targets, reachability, acyclicity and size bounds. */
export function validateScriptedTree<TCopy>(input: unknown): LyraGenResult<LyraGenScriptedTree<TCopy>> {
  const diagnostics: LyraGenDiagnostic[] = [];
  if (!record(input) || !record(input['steps']) || typeof input['start'] !== 'string') return { ok: false, diagnostics: [issue('scripted.tree', '', 'Expected a start step and a steps record.')] };
  const steps = input['steps'];
  const ids = Object.keys(steps);
  if (ids.length < 3 || ids.length > MAX_STEPS) diagnostics.push(issue('scripted.size', '/steps', `Expected between 3 and ${MAX_STEPS} steps.`));
  if (!Object.hasOwn(steps, input['start'])) diagnostics.push(issue('scripted.start', '/start', 'The start step is not declared.'));
  for (const id of ids) {
    const step = steps[id];
    const path = `/steps/${id}`;
    if (!record(step) || !Array.isArray(step['choices'])) { diagnostics.push(issue('scripted.tree', path, 'Expected a step with a choices array.')); continue; }
    if (!identity.test(id) || step['id'] !== id) diagnostics.push(issue('scripted.identity', path, 'A step id must be a short identifier equal to its key.'));
    const choices = step['choices'] as unknown[];
    if (choices.length === 1 || choices.length > MAX_CHOICES) diagnostics.push(issue('scripted.choices', path + '/choices', `A continuing step offers between 2 and ${MAX_CHOICES} choices.`));
    const seen = new Set<string>();
    choices.forEach((choice, index) => {
      const at = `${path}/choices/${index}`;
      if (!record(choice) || typeof choice['id'] !== 'string' || typeof choice['next'] !== 'string') { diagnostics.push(issue('scripted.tree', at, 'Expected a choice with an id and a next step.')); return; }
      if (!identity.test(choice['id'])) diagnostics.push(issue('scripted.identity', at + '/id', 'A choice id must be a short identifier.'));
      if (seen.has(choice['id'])) diagnostics.push(issue('scripted.duplicate', at + '/id', 'Choice ids are unique within a step.'));
      seen.add(choice['id']);
      if (!Object.hasOwn(steps, choice['next'])) diagnostics.push(issue('scripted.target', at + '/next', 'A choice leads to an undeclared step.'));
    });
  }
  if (diagnostics.length) return { ok: false, diagnostics: diagnostics.slice(0, 32) };
  const tree = input as unknown as LyraGenScriptedTree<TCopy>;
  // Depth-first walk: a back edge is a cycle; the longest path bounds the transcript.
  const state = new Map<string, 'open' | number>();
  const depth = (id: string): number => {
    const known = state.get(id);
    if (known === 'open') return Infinity;
    if (known !== undefined) return known;
    state.set(id, 'open');
    let deepest = 0;
    for (const choice of tree.steps[id]!.choices) deepest = Math.max(deepest, depth(choice.next) + 1);
    state.set(id, deepest);
    return deepest;
  };
  const longest = depth(tree.start);
  if (longest === Infinity) return { ok: false, diagnostics: [issue('scripted.cycle', '/steps', 'Choices cannot lead back to an earlier step.')] };
  if (longest > MAX_DEPTH) return { ok: false, diagnostics: [issue('scripted.depth', '/steps', `A path takes at most ${MAX_DEPTH} choices.`)] };
  const unreachable = ids.filter(id => !state.has(id));
  if (unreachable.length) return { ok: false, diagnostics: unreachable.slice(0, 32).map(id => issue('scripted.unreachable', `/steps/${id}`, 'The step cannot be reached from the start step.')) };
  return { ok: true, value: tree, diagnostics: [] };
}

/** Resolve a choice sequence from the start step; every choice must be offered by the step before it. */
export function resolveScriptedPath(tree: LyraGenScriptedTree<unknown>, choices: readonly string[]): LyraGenResult<LyraGenScriptedPath> {
  const steps = [tree.start];
  if (!Array.isArray(choices) || choices.length > MAX_DEPTH) return { ok: false, diagnostics: [issue('scripted.path', '', 'The path is too long.')] };
  for (const [index, choiceId] of choices.entries()) {
    const choice = tree.steps[steps.at(-1)!]?.choices.find(candidate => candidate.id === choiceId);
    if (!choice) return { ok: false, diagnostics: [issue('scripted.path', `/${index}`, 'The step does not offer this choice.')] };
    steps.push(choice.next);
  }
  return { ok: true, value: freeze({ choices: freeze([...choices]), steps: freeze(steps), step: steps.at(-1)! }), diagnostics: [] };
}

function admitControls(values: unknown): LyraGenScriptedControls {
  const admitted = snapshotJson(values);
  if (!admitted.ok || !record(admitted.value) || Object.keys(admitted.value).length > MAX_CONTROLS) throw new TypeError('Scripted controls must be a bounded plain JSON object.');
  return admitted.value as LyraGenScriptedControls;
}

/** The scripted conversation state machine; create it with `createScriptedConversation()`. */
export class LyraGenScriptedConversation<TCopy = unknown> {
  private readonly tree: LyraGenScriptedTree<TCopy>;
  private readonly options: LyraGenScriptedOptions<TCopy>;
  private readonly listeners = new Set<LyraGenScriptedListener<TCopy>>();
  private path: LyraGenScriptedPath;
  private controls: LyraGenScriptedControls;
  private status: LyraGenScriptedStatus = 'idle';
  private generation = 0;
  private nextRevision: number;
  private document?: LyraGenView;
  private pendingRevision?: number;
  private rendered = false;
  private focus?: LyraGenScriptedFocusTarget;
  private pendingFocus?: LyraGenScriptedFocusTarget;
  private diagnostics: readonly LyraGenDiagnostic[] = [];
  private inFlight?: AbortController;
  private controlsInFlight = false;
  private controlsQueued = false;
  private current: LyraGenScriptedSnapshot<TCopy>;

  constructor(options: LyraGenScriptedOptions<TCopy>) {
    const tree = validateScriptedTree<TCopy>(options.tree);
    if (!tree.ok) throw new TypeError(`Invalid scripted tree (${tree.diagnostics[0]!.code} at ${tree.diagnostics[0]!.path || '/'}).`);
    if (!identity.test(options.surfaceId)) throw new TypeError('The surface id must be a short explicit identifier.');
    if (typeof options.buildStep !== 'function') throw new TypeError('A buildStep function is required.');
    const start = options.revisionStart ?? 1;
    if (!Number.isSafeInteger(start) || start < 0) throw new TypeError('revisionStart must be a non-negative safe integer.');
    this.tree = tree.value;
    this.options = options;
    this.nextRevision = start;
    this.controls = admitControls(options.controls ?? {});
    this.path = (resolveScriptedPath(this.tree, []) as { value: LyraGenScriptedPath }).value;
    this.current = this.project();
  }

  get snapshot(): LyraGenScriptedSnapshot<TCopy> { return this.current; }
  get catalog(): LyraGenCatalog { return this.options.catalog; }

  /** Listen to every published snapshot; returns the unsubscribe function. */
  subscribe(listener: LyraGenScriptedListener<TCopy>): () => void {
    if (this.status === 'disposed') return () => {};
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Start, or return to the start step; the controls keep their current values. */
  restart(): LyraGenScriptedResult { return this.navigate([], 'restart'); }
  /** Take one of the current step's choices. */
  choose(choiceId: string): LyraGenScriptedResult {
    if (this.status === 'disposed') return 'disposed';
    if (!this.current.choices.some(choice => choice.id === choiceId)) return 'unknown';
    return this.navigate([...this.path.choices, choiceId], 'choose');
  }
  /** Undo the latest choice. */
  back(): LyraGenScriptedResult {
    if (this.status === 'disposed') return 'disposed';
    if (!this.path.choices.length) return 'unavailable';
    return this.navigate(this.path.choices.slice(0, -1), 'back');
  }
  /** Jump to a validated choice sequence, such as one restored from navigation state. */
  goTo(choices: readonly string[]): LyraGenScriptedResult { return this.navigate(choices, 'goto'); }
  /** Rebuild the current step, for example after a failed build. */
  retry(): LyraGenScriptedResult { return this.navigate(this.path.choices, 'retry'); }

  /**
   * Merge new control values. While a control build is in flight no second one starts; the latest
   * values are built once it settles, so a burst of edits costs at most two revisions.
   */
  setControls(values: LyraGenScriptedControls): LyraGenScriptedResult {
    if (this.status === 'disposed') return 'disposed';
    this.controls = admitControls({ ...this.controls, ...admitControls(values) });
    if (this.status === 'idle') { this.publish(); return 'accepted'; }
    if (this.controlsInFlight) { this.controlsQueued = true; this.publish(); return 'accepted'; }
    // A navigation build in flight reads controls when it starts; rebuild once it settles.
    if (this.status === 'building') { this.controlsQueued = true; this.publish(); return 'accepted'; }
    this.run('controls');
    return 'accepted';
  }

  /** Report that `revision` of this surface finished rendering; stale or foreign reports return false. */
  markRendered(surfaceId: string, revision: number): boolean {
    if (this.status === 'disposed' || surfaceId !== this.options.surfaceId || !this.document || this.document.revision !== revision || this.rendered) return false;
    this.rendered = true;
    // A navigation hint is delivered with the first rendered revision after it; control edits add none.
    if (this.pendingFocus) { this.focus = this.pendingFocus; this.pendingFocus = undefined; }
    this.publish();
    return true;
  }

  dispose(): void {
    if (this.status === 'disposed') return;
    this.generation++;
    this.inFlight?.abort();
    this.inFlight = undefined;
    this.status = 'disposed';
    this.publish();
    this.listeners.clear();
  }

  private navigate(choices: readonly string[], reason: Exclude<LyraGenScriptedTransition, 'controls'>): LyraGenScriptedResult {
    if (this.status === 'disposed') return 'disposed';
    const resolved = resolveScriptedPath(this.tree, choices);
    if (!resolved.ok) return 'unknown';
    const undone = reason === 'back' ? this.path.choices.at(-1) : undefined;
    this.path = resolved.value;
    const step = this.tree.steps[this.path.step]!;
    const choiceId = undone !== undefined && step.choices.some(choice => choice.id === undone) ? undone : step.choices[0]?.id;
    this.pendingFocus = freeze(choiceId !== undefined ? { reason, choiceId } : { reason });
    this.controlsQueued = false;
    this.run(reason);
    return 'accepted';
  }

  private run(reason: LyraGenScriptedTransition): void {
    this.inFlight?.abort();
    const task = new AbortController();
    this.inFlight = task;
    const generation = ++this.generation;
    this.controlsInFlight = reason === 'controls';
    this.focus = undefined;
    this.diagnostics = [];
    if (this.nextRevision > Number.MAX_SAFE_INTEGER) { this.fail(generation, [issue('revision.exhausted', '/revision', 'No later revision is available.')]); return; }
    const revision = this.nextRevision++;
    this.status = 'building';
    this.pendingRevision = revision;
    const previous = this.document;
    const path = this.path;
    const controls = this.controls;
    let built: LyraGenScriptedBuildResult | Promise<LyraGenScriptedBuildResult>;
    try { built = this.options.buildStep(path, controls, freeze({ signal: task.signal, revision, reason, ...(previous ? { previous } : {}) })); }
    catch { this.fail(generation, [issue('scripted.build', '', 'The step could not be built.')]); return; }
    this.publish();
    void Promise.resolve(built).then(
      result => { if (generation === this.generation) this.commit(generation, revision, previous, result); },
      () => { this.fail(generation, [issue('scripted.build', '', 'The step could not be built.')]); },
    );
  }

  private commit(generation: number, revision: number, previous: LyraGenView | undefined, result: LyraGenScriptedBuildResult): void {
    const { catalog, surfaceId } = this.options;
    const validation = this.options.validation ?? {};
    let view: LyraGenView;
    if (record(result) && 'operations' in result) {
      if (!previous) { this.fail(generation, [issue('scripted.patch', '/operations', 'A patch needs a committed view.')]); return; }
      const patched = applyViewPatch(previous, { surfaceId, expectedRevision: previous.revision, operations: result.operations }, catalog, validation);
      if (!patched.ok) { this.fail(generation, patched.diagnostics); return; }
      view = { ...patched.value, revision };
    } else if (record(result) && record(result['root'])) {
      view = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId, revision, root: result['root'] as unknown as LyraGenNode };
    } else { this.fail(generation, [issue('scripted.build', '', 'The step returned neither a view nor a patch.')]); return; }
    const admitted = validateView(view, catalog, validation);
    if (!admitted.ok) { this.fail(generation, admitted.diagnostics); return; }
    this.document = admitted.value;
    this.rendered = false;
    this.diagnostics = admitted.diagnostics;
    this.settle(generation, 'ready');
  }

  private fail(generation: number, diagnostics: readonly LyraGenDiagnostic[]): void {
    if (generation !== this.generation || this.status === 'disposed') return;
    this.diagnostics = freeze([...diagnostics]);
    this.settle(generation, 'error');
  }

  private settle(generation: number, status: 'ready' | 'error'): void {
    this.inFlight = undefined;
    this.pendingRevision = undefined;
    this.status = status;
    this.controlsInFlight = false;
    if (this.controlsQueued && generation === this.generation) {
      this.controlsQueued = false;
      this.publish();
      this.run('controls');
      return;
    }
    this.publish();
  }

  private project(): LyraGenScriptedSnapshot<TCopy> {
    const step = this.tree.steps[this.path.step]!;
    const transcript: LyraGenScriptedEntry<TCopy>[] = [];
    this.path.steps.forEach((stepId, index) => {
      const visited = this.tree.steps[stepId]!;
      transcript.push(freeze({ kind: 'prompt' as const, id: `prompt:${index}:${stepId}`, stepId, ...(visited.copy !== undefined ? { copy: visited.copy } : {}) }));
      const choiceId = this.path.choices[index];
      const choice = choiceId === undefined ? undefined : visited.choices.find(candidate => candidate.id === choiceId);
      if (choice) transcript.push(freeze({ kind: 'answer' as const, id: `answer:${index}:${choice.id}`, stepId, choiceId: choice.id, ...(choice.copy !== undefined ? { copy: choice.copy } : {}) }));
    });
    return freeze({
      surfaceId: this.options.surfaceId,
      status: this.status,
      generation: this.generation,
      path: this.path.choices,
      steps: this.path.steps,
      step,
      choices: step.choices,
      canGoBack: this.path.choices.length > 0,
      terminal: step.choices.length === 0,
      transcript: freeze(transcript),
      controls: this.controls,
      ...(this.document ? { document: this.document } : {}),
      ...(this.pendingRevision !== undefined ? { pendingRevision: this.pendingRevision } : {}),
      rendered: this.rendered,
      ...(this.focus ? { focusTarget: this.focus } : {}),
      diagnostics: this.diagnostics,
    });
  }

  private publish(): void {
    this.current = this.project();
    for (const listener of [...this.listeners]) listener(this.current);
  }
}

/** Create a scripted conversation controller; throws `TypeError` for an invalid tree or options. */
export function createScriptedConversation<TCopy = unknown>(options: LyraGenScriptedOptions<TCopy>): LyraGenScriptedConversation<TCopy> {
  return new LyraGenScriptedConversation(options);
}

/** The slice of `lr-gen-view` the DOM helper uses, so the core module never imports the element. */
export interface LyraGenScriptedViewTarget extends EventTarget {
  document?: LyraGenView;
  catalog: LyraGenCatalog;
}
export interface LyraGenScriptedConnectOptions<TCopy = unknown> {
  /** Called once per rendered navigation revision with the focus hint. */
  readonly onReady?: (snapshot: LyraGenScriptedSnapshot<TCopy>) => void;
  /**
   * Opt in to focus restoration: return the element for the hint (usually the host's choice button).
   * Focus moves only when it was lost (on the body) or sits inside the view or `focusScope`.
   */
  readonly resolveFocus?: (target: LyraGenScriptedFocusTarget, snapshot: LyraGenScriptedSnapshot<TCopy>) => HTMLElement | null | undefined;
  readonly focusScope?: Element;
}
export interface LyraGenScriptedConnection { disconnect(): void }

/**
 * Bind a controller to an `lr-gen-view`: assign each committed document, report the view's
 * `lr-gen-ready` for exactly that revision back to the controller (late events for superseded
 * revisions are ignored) and hand the focus hint to the host.
 */
export function connectScriptedConversation<TCopy>(conversation: LyraGenScriptedConversation<TCopy>, view: LyraGenScriptedViewTarget, options: LyraGenScriptedConnectOptions<TCopy> = {}): LyraGenScriptedConnection {
  let connected = true;
  let assigned: { readonly generation: number; readonly revision: number } | undefined;
  let announced: LyraGenScriptedFocusTarget | undefined;
  const sync = (snapshot: LyraGenScriptedSnapshot<TCopy>): void => {
    if (!connected) return;
    if (view.catalog !== conversation.catalog) view.catalog = conversation.catalog;
    if (snapshot.document && view.document !== snapshot.document) {
      assigned = { generation: snapshot.generation, revision: snapshot.document.revision };
      view.document = snapshot.document;
    }
    if (!snapshot.rendered || !snapshot.focusTarget || announced === snapshot.focusTarget) return;
    announced = snapshot.focusTarget;
    options.onReady?.(snapshot);
    const element = options.resolveFocus?.(snapshot.focusTarget, snapshot);
    if (!element) return;
    const owner = element.ownerDocument;
    const active = owner.activeElement;
    const lost = !active || active === owner.body || !active.isConnected;
    const inside = active instanceof Node && ((view instanceof Node && view.contains(active)) || !!options.focusScope?.contains(active));
    if (lost || inside) element.focus({ preventScroll: true });
  };
  const ready = (event: Event): void => {
    const detail = (event as CustomEvent<{ readonly surfaceId: string; readonly revision: number }>).detail;
    const snapshot = conversation.snapshot;
    // The run token: the revision assigned for the current generation, never an older one.
    if (!connected || !assigned || !detail || detail.revision !== assigned.revision || snapshot.document?.revision !== assigned.revision || assigned.generation !== snapshot.generation) return;
    conversation.markRendered(detail.surfaceId, detail.revision);
  };
  view.addEventListener('lr-gen-ready', ready);
  const unsubscribe = conversation.subscribe(sync);
  sync(conversation.snapshot);
  return {
    disconnect() {
      if (!connected) return;
      connected = false;
      unsubscribe();
      view.removeEventListener('lr-gen-ready', ready);
    },
  };
}
