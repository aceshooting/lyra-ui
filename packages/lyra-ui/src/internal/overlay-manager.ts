import { deepActiveElementIn } from './active-element.js';
import {
  collectComposedAutofocusElements,
  collectComposedFocusTargets,
  isComposedFocusAvailable,
} from './focus-navigation.js';
import { isHtmlElement } from './dom-guards.js';
import { RenderedStateController } from './rendered-state.js';
import { lockScroll } from './scroll-lock.js';
import {
  leaseInlineStyleProperty,
  type InlineStylePropertyLease,
} from './style-property-lease.js';

const STACK_PROPERTY = '--lr-overlay-stack-index';
const STACK_BASE = 1000;
const STACK_STEP = 2;

/** A fixed return target or a live target resolved after modal resources have been released. */
export type OverlayRestoreFocusTarget = HTMLElement | null | (() => HTMLElement | null);

export interface OverlayActivationOptions {
  /** The custom-element host that owns this overlay. */
  host: HTMLElement;
  /** Resolves the current dialog/panel element after each render. */
  panel: () => HTMLElement | null;
  /**
   * Resolves the subtree that remains interactive while this entry is modal. Defaults to `host`.
   * Use this when the stack-owning host also contains application siblings outside the panel.
   */
  modalRoot?: () => HTMLElement | null;
  /** Dismisses the overlay with its component-specific Escape reason/event. */
  onEscape: () => void;
  /** Dismisses the overlay with its component-specific backdrop reason/event. */
  onBackdrop?: () => void;
  /** Optional component-specific initial target, such as an intentionally safe default action. */
  preferredInitialFocus?: () => HTMLElement | null;
  /** One-shot veto immediately before the manager's first automatic focus movement. */
  beforeInitialFocus?: () => boolean;
  /** Override the captured focus-return target with a fixed element or post-cleanup resolver. */
  restoreFocusTo?: OverlayRestoreFocusTarget;
  /** Defaults to true. Nonmodal popups share ordering without inerting the page. */
  modal?: boolean;
  /** Defaults to true. Set false for popups that allow native Tab to leave. */
  trapFocus?: boolean;
  /** Optional non-trapping Tab lifecycle, called without preventing the event. */
  onTab?: () => void;
  /** Temporarily releases stack ownership while the resolved panel generates no layout box. */
  suspendWhenUnrendered?: boolean;
  /** Ref-counts a document scroll lock for exactly as long as this entry is registered. */
  lockScroll?: boolean;
}

export interface OverlayDeactivateOptions {
  /** Defaults to true. Explicit outside-pointer paths can suppress restoration. */
  restoreFocus?: boolean;
  /** Defaults to false. Skips releasing this entry's scroll lock as part of deactivation and
   *  returns the release function instead, so a component with a visible exit animation can hold
   *  the lock until that animation actually finishes rather than the instant it starts closing.
   *  Ignored (returns `undefined`) when this entry never requested `lockScroll`. */
  deferScrollLockRelease?: boolean;
}

export interface OverlayHandle {
  /** Moves focus inside unless focus is already within the current panel. */
  focusInitial(): void;
  /** Moves focus only when the panel contains an `[autofocus]` target. Returns whether it did, so
   *  a nonmodal overlay that deliberately leaves focus alone can still honour an explicit
   *  `autofocus` in its content without stealing focus in every other case. */
  focusAutofocus(): boolean;
  /** Replaces the eventual focus-return target without unregistering or reordering the overlay. */
  updateRestoreFocusTo(target: OverlayRestoreFocusTarget): void;
  /** Removes the overlay permanently. Safe to call repeatedly. Returns the deferred scroll-lock
   *  release function when `deferScrollLockRelease` was requested and a lock was actually held. */
  deactivate(options?: OverlayDeactivateOptions): (() => void) | undefined;
  /** Temporarily unregisters during disconnect, preserving the original return target. */
  suspend(): void;
  /** Re-registers a suspended overlay in its current `ownerDocument`. */
  resume(): void;
  /** Whether this overlay currently owns Escape, Tab, and backdrop dismissal. */
  isTopmost(): boolean;
  /** Whether this handle still represents an active or temporarily suspended overlay. */
  isActive(): boolean;
  /** Runs the backdrop callback only when this overlay is topmost. */
  dismissBackdrop(): boolean;
}

interface OverlayEntry {
  options: OverlayActivationOptions;
  restoreFocusTo: OverlayRestoreFocusTarget;
  active: boolean;
  registered: boolean;
  manuallySuspended: boolean;
  rendered: boolean;
  initialFocusDecision?: boolean;
  wasTopmostOnSuspend: boolean;
  suspendGeneration: number;
  stackOrder: number;
  state: OverlayDocumentState;
  stackStyleLease?: InlineStylePropertyLease;
  releaseScrollLock?: () => void;
  /** Set by `unregisterEntry()` when a deferred release was requested, so `deactivateEntry()` can
   *  hand it back to the caller instead of it firing immediately. */
  deferredScrollLockRelease?: () => void;
  renderedState?: RenderedStateController;
  handle: OverlayHandle;
}

interface ExternalModalSuspensionEntry {
  root: HTMLElement;
  active: boolean;
  state: OverlayDocumentState;
}

interface OverlayDocumentState {
  document: Document;
  stack: OverlayEntry[];
  externalModalSuspensions: Set<ExternalModalSuspensionEntry>;
  nextStackOrder: number;
  inerted: Map<HTMLElement, boolean>;
  pendingInertWrites: Map<HTMLElement, boolean[]>;
  observer?: MutationObserver;
  observedRoots: Set<Document | ShadowRoot>;
  inertUpdateQueued: boolean;
  started: boolean;
  onKeyDown: (event: KeyboardEvent) => void;
}

const states = new WeakMap<Document, OverlayDocumentState>();
const hostEntries = new WeakMap<HTMLElement, OverlayEntry>();

function createInactiveOverlayHandle(): OverlayHandle {
  return {
    focusInitial: () => undefined,
    focusAutofocus: () => false,
    updateRestoreFocusTo: () => undefined,
    deactivate: () => undefined,
    suspend: () => undefined,
    resume: () => undefined,
    isTopmost: () => false,
    isActive: () => false,
    dismissBackdrop: () => false,
  };
}

/** Returns the deepest focused descendant across open shadow roots, or `null` when no document
 * exists in the current realm. */
export function deepActiveElement(
  doc: Document | null | undefined = typeof document === 'undefined' ? undefined : document,
): Element | null {
  return deepActiveElementIn(doc);
}

function composedParent(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode() as ShadowRoot;
  return root.host ?? null;
}

export function composedContains(container: Element, candidate: Element | null): boolean {
  let current = candidate;
  while (current) {
    if (current === container) return true;
    current = composedParent(current);
  }
  return false;
}

/** Collects rendered focus targets through slots and nested open shadow roots in browser tab order. */
export function collectFocusableElements(root: Element | ShadowRoot): HTMLElement[] {
  return collectComposedFocusTargets(root).elements;
}

/**
 * Collects every `[autofocus]` element inside `root`, walking slots and nested open shadow roots
 * exactly as the focusable collector does. `autofocus` is a global attribute, so it is honoured on
 * a custom element host as readily as on a native control.
 */
export function collectAutofocusElements(root: Element | ShadowRoot): HTMLElement[] {
  return collectComposedAutofocusElements(root).elements;
}

function tryFocus(target: HTMLElement | null): boolean {
  if (!target || !isComposedFocusAvailable(target)) return false;
  target.focus();
  const active = deepActiveElement(target.ownerDocument);
  return active === target || composedContains(target, active);
}

/**
 * Focuses the first `[autofocus]` target inside `panel`, honouring the author's explicit choice
 * over the "first focusable element" default. A marked custom element that is not itself focusable
 * (no `tabindex`, no `delegatesFocus`) hands focus to its own first focusable descendant, so
 * `<lr-input autofocus>` behaves like `<input autofocus>` rather than doing nothing.
 */
function focusAutofocusTarget(panel: HTMLElement): boolean {
  for (const candidate of collectAutofocusElements(panel)) {
    if (tryFocus(candidate)) return true;
    for (const inner of collectFocusableElements(candidate)) {
      if (tryFocus(inner)) return true;
    }
  }
  return false;
}

function focusEntry(entry: OverlayEntry, preserveCurrent = true): void {
  const panel = entry.options.panel();
  if (!panel) return;
  const active = deepActiveElement(entry.state.document);
  if (preserveCurrent && composedContains(panel, active)) return;

  if (entry.initialFocusDecision === undefined) {
    entry.initialFocusDecision = entry.options.beforeInitialFocus?.() !== false;
  }
  if (!entry.initialFocusDecision) return;

  if (focusAutofocusTarget(panel)) return;
  const preferred = entry.options.preferredInitialFocus?.() ?? null;
  if (preferred && composedContains(panel, preferred) && tryFocus(preferred)) return;
  for (const target of collectFocusableElements(panel)) {
    if (tryFocus(target)) return;
  }
  panel.focus();
}

function handleTab(state: OverlayDocumentState, entry: OverlayEntry, event: KeyboardEvent): void {
  const panel = entry.options.panel();
  if (!panel) return;
  const focusable = collectFocusableElements(panel);
  if (focusable.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const active = deepActiveElement(state.document);
  // safe: focusable.length === 0 returns early above, so both ends exist.
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const activeIndex = active ? focusable.indexOf(active as HTMLElement) : -1;
  if (activeIndex === -1) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function scheduleInertUpdate(state: OverlayDocumentState): void {
  if (state.inertUpdateQueued) return;
  state.inertUpdateQueued = true;
  queueMicrotask(() => {
    state.inertUpdateQueued = false;
    applyTopmostInert(state);
  });
}

function handleMutations(state: OverlayDocumentState, records: MutationRecord[]): void {
  const prunedExternalModal = pruneExternalModalSuspensions(state);
  let needsInertUpdate = prunedExternalModal;
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!record) continue;
    if (record.type === 'childList') {
      needsInertUpdate = true;
      continue;
    }
    // No other check needed: mutationObserverOptions below requests only 'childList' (handled
    // above) and 'attributes' records (characterData is unset), and attributeFilter: ['inert']
    // guarantees any 'attributes' record's attributeName is already 'inert'.
    const element = record.target as HTMLElement;
    let nextRecord: MutationRecord | undefined;
    for (let nextIndex = index + 1; nextIndex < records.length; nextIndex++) {
      const candidate = records[nextIndex];
      if (!candidate) continue;
      if (candidate.type === 'attributes' && candidate.attributeName === 'inert' && candidate.target === element) {
        nextRecord = candidate;
        break;
      }
    }
    const newValue = nextRecord ? nextRecord.oldValue !== null : element.hasAttribute('inert');
    const pending = state.pendingInertWrites.get(element);
    if (pending?.[0] === newValue) {
      pending.shift();
      if (pending.length === 0) state.pendingInertWrites.delete(element);
      continue;
    }
    if (state.inerted.has(element)) {
      state.inerted.set(element, newValue);
      needsInertUpdate = true;
    }
  }
  if (needsInertUpdate) {
    if (prunedExternalModal) applyTopmostInert(state);
    else scheduleInertUpdate(state);
  }
  stopStateIfIdle(state);
}

const mutationObserverOptions: MutationObserverInit = {
  attributeFilter: ['inert'],
  attributeOldValue: true,
  attributes: true,
  childList: true,
  subtree: true,
};

function observeMutationRoot(state: OverlayDocumentState, root: Document | ShadowRoot): void {
  if (!state.observer || state.observedRoots.has(root)) return;
  state.observer.observe(root === state.document ? state.document.documentElement : root, mutationObserverOptions);
  state.observedRoots.add(root);
}

function startState(state: OverlayDocumentState): void {
  if (state.started) return;
  state.started = true;
  state.document.addEventListener('keydown', state.onKeyDown);
  const Observer = state.document.defaultView?.MutationObserver ?? MutationObserver;
  state.observer = new Observer((records) => handleMutations(state, records));
  observeMutationRoot(state, state.document);
}

function stopState(state: OverlayDocumentState): void {
  if (!state.started) return;
  state.started = false;
  state.document.removeEventListener('keydown', state.onKeyDown);
  state.observer?.disconnect();
  state.observer = undefined;
  state.observedRoots.clear();
  state.pendingInertWrites.clear();
}

function stopStateIfIdle(state: OverlayDocumentState): void {
  if (state.stack.length === 0 && state.externalModalSuspensions.size === 0) stopState(state);
}

function createState(doc: Document): OverlayDocumentState {
  const state = {} as OverlayDocumentState;
  state.document = doc;
  state.stack = [];
  state.externalModalSuspensions = new Set();
  state.nextStackOrder = 0;
  state.inerted = new Map();
  state.pendingInertWrites = new Map();
  state.observedRoots = new Set();
  state.inertUpdateQueued = false;
  state.started = false;
  state.onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (state.externalModalSuspensions.size > 0) return;
    let entry = state.stack[state.stack.length - 1];
    while (entry?.renderedState && !entry.renderedState.check()) {
      entry = state.stack[state.stack.length - 1];
    }
    if (!entry) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      entry.options.onEscape();
    } else if (event.key === 'Tab') {
      if (entry.options.trapFocus === false) entry.options.onTab?.();
      else handleTab(state, entry, event);
    }
  };
  states.set(doc, state);
  return state;
}

function stateFor(doc: Document): OverlayDocumentState {
  return states.get(doc) ?? createState(doc);
}

function setInertByManager(state: OverlayDocumentState, element: HTMLElement, value: boolean): void {
  if (element.inert === value) return;
  if (state.observer && state.observedRoots.has(element.getRootNode() as Document | ShadowRoot)) {
    let pending = state.pendingInertWrites.get(element);
    if (!pending) {
      pending = [];
      state.pendingInertWrites.set(element, pending);
    }
    pending.push(value);
  } else {
    // No mutation record will be delivered for a detached element or for an
    // element in a shadow root outside this state's observed document tree.
    state.pendingInertWrites.delete(element);
  }
  element.inert = value;
}

function inertElement(state: OverlayDocumentState, element: Element, desired: Set<HTMLElement>): void {
  if (!('inert' in element)) return;
  const htmlElement = element as HTMLElement;
  desired.add(htmlElement);
  if (!state.inerted.has(htmlElement)) state.inerted.set(htmlElement, htmlElement.inert);
  setInertByManager(state, htmlElement, true);
}

function pathParent(element: Element): ParentNode | null {
  return element.assignedSlot ?? element.parentNode;
}

function parentPathElement(parent: ParentNode): Element | null {
  if ((parent as Node).nodeType === Node.ELEMENT_NODE) return parent as Element;
  return (parent as ShadowRoot).host ?? null;
}

function composedChildren(parent: ParentNode): Element[] {
  if ((parent as Element).localName === 'slot') {
    return (parent as HTMLSlotElement).assignedElements({ flatten: true });
  }
  return 'children' in parent ? Array.from((parent as ParentNode & { children: HTMLCollectionOf<Element> }).children) : [];
}

function isShadowRoot(node: ParentNode): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node;
}

function addAllowedPath(allowed: Map<ParentNode, Set<Element>>, host: HTMLElement, doc: Document): void {
  let current: Element | null = host;
  while (current && current !== doc.body && current !== doc.documentElement) {
    const parent = pathParent(current);
    if (!parent) break;
    let children = allowed.get(parent);
    if (!children) {
      children = new Set();
      allowed.set(parent, children);
    }
    children.add(current);
    current = parentPathElement(parent);
  }
}

function modalAllowedRoot(entry: OverlayEntry): HTMLElement {
  const explicit = entry.options.modalRoot?.() ?? null;
  return explicit?.isConnected && explicit.ownerDocument === entry.state.document
    ? explicit
    : entry.options.host;
}

function pruneExternalModalSuspensions(state: OverlayDocumentState): boolean {
  let changed = false;
  for (const entry of state.externalModalSuspensions) {
    if (entry.root.isConnected && entry.root.ownerDocument === state.document) continue;
    entry.active = false;
    state.externalModalSuspensions.delete(entry);
    changed = true;
  }
  return changed;
}

function applyTopmostInert(state: OverlayDocumentState): void {
  let modalIndex = -1;
  for (let index = state.stack.length - 1; index >= 0; index--) {
    const entry = state.stack[index];
    if (entry && entry.options.modal !== false) {
      modalIndex = index;
      break;
    }
  }
  const desired = new Set<HTMLElement>();
  if (state.externalModalSuspensions.size > 0) {
    const allowed = new Map<ParentNode, Set<Element>>();
    for (const suspension of state.externalModalSuspensions) {
      addAllowedPath(allowed, suspension.root, state.document);
    }
    for (const [parent, children] of allowed) {
      if (isShadowRoot(parent)) observeMutationRoot(state, parent);
      for (const child of composedChildren(parent)) {
        if (!children.has(child)) inertElement(state, child, desired);
      }
    }
  } else if (modalIndex !== -1) {
    const allowed = new Map<ParentNode, Set<Element>>();
    for (const entry of state.stack.slice(modalIndex)) {
      if (entry.options.host.isConnected) addAllowedPath(allowed, modalAllowedRoot(entry), state.document);
    }
    for (const [parent, children] of allowed) {
      if (isShadowRoot(parent)) observeMutationRoot(state, parent);
      for (const child of composedChildren(parent)) {
        if (!children.has(child)) inertElement(state, child, desired);
      }
    }
  }
  for (const [element, intended] of state.inerted) {
    if (desired.has(element)) continue;
    setInertByManager(state, element, intended);
    state.inerted.delete(element);
  }
}

function restoreStackStyle(entry: OverlayEntry): void {
  entry.stackStyleLease?.release();
  entry.stackStyleLease = undefined;
}

function updateStackStyles(state: OverlayDocumentState): void {
  state.stack.forEach((entry, index) => {
    const value = String(STACK_BASE + index * STACK_STEP);
    if (entry.stackStyleLease) entry.stackStyleLease.set(value);
    else entry.stackStyleLease = leaseInlineStyleProperty(entry.options.host, STACK_PROPERTY, value);
  });
}

function registerEntry(entry: OverlayEntry, state: OverlayDocumentState, preserveStackOrder = false): void {
  if (entry.registered) return;
  startState(state);
  if (!preserveStackOrder || entry.state !== state) entry.stackOrder = state.nextStackOrder++;
  entry.state = state;
  entry.registered = true;
  if (entry.options.lockScroll && !entry.releaseScrollLock) {
    entry.releaseScrollLock = lockScroll(state.document);
  }
  const nextIndex = state.stack.findIndex((candidate) => candidate.stackOrder > entry.stackOrder);
  if (nextIndex === -1) state.stack.push(entry);
  else state.stack.splice(nextIndex, 0, entry);
  updateStackStyles(state);
  applyTopmostInert(state);
}

function unregisterEntry(entry: OverlayEntry, deferScrollLockRelease = false): boolean {
  if (!entry.registered) {
    const hasHigherEntry = entry.state.stack.some((candidate) => candidate.stackOrder > entry.stackOrder);
    return entry.state.externalModalSuspensions.size === 0 && entry.wasTopmostOnSuspend && !hasHigherEntry;
  }
  const state = entry.state;
  const index = state.stack.indexOf(entry);
  const wasTopmost = state.externalModalSuspensions.size === 0 && index === state.stack.length - 1;
  if (index !== -1) state.stack.splice(index, 1);
  entry.registered = false;
  entry.wasTopmostOnSuspend = wasTopmost;
  if (deferScrollLockRelease) entry.deferredScrollLockRelease = entry.releaseScrollLock;
  else entry.releaseScrollLock?.();
  entry.releaseScrollLock = undefined;
  restoreStackStyle(entry);
  updateStackStyles(state);
  applyTopmostInert(state);
  stopStateIfIdle(state);
  return wasTopmost;
}

function syncEntryRegistration(entry: OverlayEntry): void {
  if (!entry.active || entry.manuallySuspended || !entry.rendered) {
    unregisterEntry(entry);
    return;
  }
  const state = stateFor(entry.options.host.ownerDocument);
  registerEntry(entry, state, entry.state === state);
}

function validRestoreFocusElement(value: unknown, doc: Document): HTMLElement | null {
  return isHtmlElement(value) && value.ownerDocument === doc ? value : null;
}

function resolveRestoreFocusTarget(entry: OverlayEntry): HTMLElement | null {
  const source = entry.restoreFocusTo;
  if (typeof source !== 'function') return validRestoreFocusElement(source, entry.state.document);
  try {
    return validRestoreFocusElement(source(), entry.state.document);
  } catch {
    // A consumer resolver must not interrupt overlay cleanup or strand the surviving stack.
    return null;
  }
}

function rebaseReturnTargets(entry: OverlayEntry): void {
  for (const candidate of entry.state.stack) {
    if (candidate === entry || candidate.stackOrder <= entry.stackOrder) continue;
    // Do not invoke a live resolver while modal inerting is still active. Explicit live resolvers
    // already own their structural fallback; ordinary captured/fixed targets retain legacy rebase
    // behavior and can inherit this entry's resolver for evaluation after final cleanup.
    const candidateTarget = typeof candidate.restoreFocusTo === 'function'
      ? null
      : validRestoreFocusElement(candidate.restoreFocusTo, entry.state.document);
    if (candidateTarget && composedContains(entry.options.host, candidateTarget)) {
      candidate.restoreFocusTo = entry.restoreFocusTo;
    }
  }
}

function restoreEntryFocus(entry: OverlayEntry): void {
  if (tryFocus(resolveRestoreFocusTarget(entry))) return;
  const next = entry.state.stack[entry.state.stack.length - 1];
  if (next) focusEntry(next, false);
}

function deactivateEntry(
  entry: OverlayEntry,
  restoreFocus: boolean,
  deferScrollLockRelease = false,
): (() => void) | undefined {
  if (!entry.active) return undefined;
  entry.renderedState?.stop();
  rebaseReturnTargets(entry);
  const wasTopmost = unregisterEntry(entry, deferScrollLockRelease);
  const deferredScrollLockRelease = entry.deferredScrollLockRelease;
  entry.deferredScrollLockRelease = undefined;
  entry.active = false;
  entry.manuallySuspended = false;
  entry.suspendGeneration++;
  if (hostEntries.get(entry.options.host) === entry) hostEntries.delete(entry.options.host);
  if (!wasTopmost) return deferredScrollLockRelease;
  if (restoreFocus) {
    restoreEntryFocus(entry);
    return deferredScrollLockRelease;
  }
  const next = entry.state.stack[entry.state.stack.length - 1];
  if (next) focusEntry(next);
  return deferredScrollLockRelease;
}

/**
 * Adds an overlay to a stack scoped to its own `ownerDocument`. One document
 * listener routes Escape and Tab only to the top entry, while modal inerting,
 * visual stack depth, and focus return are recomputed as entries move.
 */
export function activateOverlay(options: OverlayActivationOptions): OverlayHandle {
  const previous = hostEntries.get(options.host);
  const inheritedReturnTarget = previous?.active ? previous.restoreFocusTo : undefined;
  if (previous?.active) previous.handle.deactivate({ restoreFocus: false });

  const doc = (options.host as unknown as { readonly ownerDocument?: Document | null }).ownerDocument;
  if (!doc) return createInactiveOverlayHandle();
  const active = deepActiveElement(doc);
  const captured = active && typeof (active as HTMLElement).focus === 'function' ? (active as HTMLElement) : null;
  const entry = {} as OverlayEntry;
  entry.options = options;
  entry.restoreFocusTo =
    options.restoreFocusTo !== undefined ? options.restoreFocusTo : (inheritedReturnTarget ?? captured);
  entry.active = true;
  entry.registered = false;
  entry.manuallySuspended = false;
  entry.rendered = true;
  entry.initialFocusDecision = undefined;
  entry.wasTopmostOnSuspend = false;
  entry.suspendGeneration = 0;
  entry.state = stateFor(doc);
  // Reserve order at logical activation time, even when the panel begins unrendered and therefore
  // cannot join the live stack yet. Otherwise multiple lifecycle-controlled entries all carry the
  // same sentinel order and a restored lower entry can incorrectly jump above a newer overlay.
  entry.stackOrder = entry.state.nextStackOrder++;
  entry.handle = {
    focusInitial: () => {
      entry.renderedState?.check();
      if (
        entry.active &&
        entry.registered &&
        entry.state.externalModalSuspensions.size === 0 &&
        entry.state.stack[entry.state.stack.length - 1] === entry
      ) {
        focusEntry(entry);
      }
    },
    focusAutofocus: () => {
      entry.renderedState?.check();
      if (!entry.active || !entry.registered || entry.state.externalModalSuspensions.size > 0) return false;
      const panel = entry.options.panel();
      if (!panel) return false;
      const active = deepActiveElement(entry.state.document);
      if (composedContains(panel, active)) return false;
      return focusAutofocusTarget(panel);
    },
    updateRestoreFocusTo: (target) => {
      if (entry.active) entry.restoreFocusTo = target;
    },
    deactivate: (deactivateOptions = {}) =>
      deactivateEntry(
        entry,
        deactivateOptions.restoreFocus !== false,
        deactivateOptions.deferScrollLockRelease === true,
      ),
    suspend: () => {
      if (!entry.active || entry.manuallySuspended) return;
      entry.manuallySuspended = true;
      syncEntryRegistration(entry);
      const generation = ++entry.suspendGeneration;
      queueMicrotask(() => {
        if (entry.active && !entry.registered && entry.suspendGeneration === generation && !entry.options.host.isConnected) {
          deactivateEntry(entry, true);
        }
      });
    },
    resume: () => {
      if (!entry.active || !entry.manuallySuspended) return;
      entry.suspendGeneration++;
      entry.manuallySuspended = false;
      entry.renderedState?.check();
      syncEntryRegistration(entry);
    },
    isTopmost: () => {
      entry.renderedState?.check();
      return (
        entry.active &&
        entry.registered &&
        entry.state.externalModalSuspensions.size === 0 &&
        entry.state.stack[entry.state.stack.length - 1] === entry
      );
    },
    isActive: () => entry.active,
    dismissBackdrop: () => {
      if (!entry.handle.isTopmost() || !entry.options.onBackdrop) return false;
      entry.options.onBackdrop();
      return true;
    },
  };

  hostEntries.set(options.host, entry);
  if (options.suspendWhenUnrendered) {
    entry.renderedState = new RenderedStateController(options.host, options.panel, (rendered) => {
      if (!entry.active || entry.rendered === rendered) return;
      const wasRegistered = entry.registered;
      entry.rendered = rendered;
      syncEntryRegistration(entry);
      if (rendered && !wasRegistered && entry.registered) {
        queueMicrotask(() => entry.handle.focusInitial());
      }
    });
    // Seed false so the controller's mandatory initial report always owns the first registration
    // decision, including a panel that already has a box at activation time.
    entry.rendered = false;
    entry.renderedState.start();
  } else {
    registerEntry(entry, entry.state, true);
  }
  return entry.handle;
}

/**
 * Temporarily yields Lyra's modal stack to a third-party modal rooted at `externalModal`.
 *
 * The returned release function is idempotent. Suspensions are scoped to the element's current
 * document and nest independently; while at least one is active, Lyra does not route Escape or
 * Tab and only the external modal paths remain non-inert. Disconnecting or adopting the root into
 * another document releases its suspension automatically.
 */
export function suspendLyraModalsFor(externalModal: HTMLElement): () => void {
  if (!externalModal.isConnected) return () => undefined;
  const state = stateFor(externalModal.ownerDocument);
  const entry: ExternalModalSuspensionEntry = {
    root: externalModal,
    active: true,
    state,
  };
  state.externalModalSuspensions.add(entry);
  startState(state);
  applyTopmostInert(state);

  return () => {
    if (!entry.active) return;
    entry.active = false;
    entry.state.externalModalSuspensions.delete(entry);
    applyTopmostInert(entry.state);
    stopStateIfIdle(entry.state);
  };
}
