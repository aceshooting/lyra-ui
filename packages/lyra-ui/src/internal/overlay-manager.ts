import { activateNonmodalOverlay } from './nonmodal-overlay-manager.js';
import { RenderedStateController } from './rendered-state.js';
import { lockScroll } from './scroll-lock.js';
import {
  acquireOverlayRoutingSuspension,
  activateOverlayStack,
  observeOverlayStack,
  type OverlayStackEntrySnapshot,
  type OverlayStackSnapshot,
} from './overlay-stack.js';

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

interface ExternalModalSuspensionEntry {
  root: HTMLElement;
  active: boolean;
  releaseRouting: () => void;
  state: ModalDocumentState;
}

interface ModalDocumentState {
  document: Document;
  snapshot: OverlayStackSnapshot;
  registrations: number;
  externalModalSuspensions: Set<ExternalModalSuspensionEntry>;
  inerted: Map<HTMLElement, boolean>;
  pendingInertWrites: Map<HTMLElement, boolean[]>;
  observer?: MutationObserver;
  observedRoots: Set<Document | ShadowRoot>;
  inertUpdateQueued: boolean;
  started: boolean;
  unsubscribeStack?: () => void;
}

const EMPTY_STACK: OverlayStackSnapshot = {
  entries: [],
};
const modalStates = new WeakMap<Document, ModalDocumentState>();

function modalStateFor(doc: Document): ModalDocumentState {
  const existing = modalStates.get(doc);
  if (existing) return existing;
  const state: ModalDocumentState = {
    document: doc,
    snapshot: EMPTY_STACK,
    registrations: 0,
    externalModalSuspensions: new Set(),
    inerted: new Map(),
    pendingInertWrites: new Map(),
    observedRoots: new Set(),
    inertUpdateQueued: false,
    started: false,
  };
  modalStates.set(doc, state);
  return state;
}

function scheduleInertUpdate(state: ModalDocumentState): void {
  if (state.inertUpdateQueued) return;
  state.inertUpdateQueued = true;
  queueMicrotask(() => {
    state.inertUpdateQueued = false;
    applyTopmostInert(state);
  });
}

function pruneExternalModalSuspensions(state: ModalDocumentState): boolean {
  let changed = false;
  for (const entry of state.externalModalSuspensions) {
    if (entry.root.isConnected && entry.root.ownerDocument === state.document) continue;
    entry.active = false;
    state.externalModalSuspensions.delete(entry);
    entry.releaseRouting();
    changed = true;
  }
  return changed;
}

function handleMutations(state: ModalDocumentState, records: MutationRecord[]): void {
  const prunedExternalModal = pruneExternalModalSuspensions(state);
  let needsInertUpdate = prunedExternalModal;
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!record) continue;
    if (record.type === 'childList') {
      needsInertUpdate = true;
      continue;
    }
    const element = record.target as HTMLElement;
    let nextRecord: MutationRecord | undefined;
    for (let nextIndex = index + 1; nextIndex < records.length; nextIndex++) {
      const candidate = records[nextIndex];
      if (
        candidate?.type === 'attributes' &&
        candidate.attributeName === 'inert' &&
        candidate.target === element
      ) {
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
  stopModalStateIfIdle(state);
}

const mutationObserverOptions: MutationObserverInit = {
  attributeFilter: ['inert'],
  attributeOldValue: true,
  attributes: true,
  childList: true,
  subtree: true,
};

function observeMutationRoot(state: ModalDocumentState, root: Document | ShadowRoot): void {
  if (!state.observer || state.observedRoots.has(root)) return;
  state.observer.observe(
    root === state.document ? state.document.documentElement : root,
    mutationObserverOptions,
  );
  state.observedRoots.add(root);
}

function startModalState(state: ModalDocumentState): void {
  if (state.started) return;
  state.started = true;
  const Observer = state.document.defaultView?.MutationObserver ?? MutationObserver;
  state.observer = new Observer((records) => handleMutations(state, records));
  observeMutationRoot(state, state.document);
  state.unsubscribeStack = observeOverlayStack(state.document, (snapshot) => {
    state.snapshot = snapshot;
    applyTopmostInert(state);
  });
}

function stopModalState(state: ModalDocumentState): void {
  if (!state.started) return;
  state.started = false;
  state.unsubscribeStack?.();
  state.unsubscribeStack = undefined;
  for (const [element, intended] of state.inerted) element.inert = intended;
  state.inerted.clear();
  state.observer?.disconnect();
  state.observer = undefined;
  state.observedRoots.clear();
  state.pendingInertWrites.clear();
  state.snapshot = EMPTY_STACK;
}

function stopModalStateIfIdle(state: ModalDocumentState): void {
  if (state.registrations === 0 && state.externalModalSuspensions.size === 0) {
    stopModalState(state);
  }
}

function retainModalState(doc: Document): () => void {
  const state = modalStateFor(doc);
  state.registrations++;
  startModalState(state);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    state.registrations--;
    stopModalStateIfIdle(state);
  };
}

function setInertByManager(state: ModalDocumentState, element: HTMLElement, value: boolean): void {
  if (element.inert === value) return;
  if (state.observer && state.observedRoots.has(element.getRootNode() as Document | ShadowRoot)) {
    let pending = state.pendingInertWrites.get(element);
    if (!pending) {
      pending = [];
      state.pendingInertWrites.set(element, pending);
    }
    pending.push(value);
  } else {
    state.pendingInertWrites.delete(element);
  }
  element.inert = value;
}

function inertElement(state: ModalDocumentState, element: Element, desired: Set<HTMLElement>): void {
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
  return 'children' in parent
    ? Array.from((parent as ParentNode & { children: HTMLCollectionOf<Element> }).children)
    : [];
}

function isShadowRoot(node: ParentNode): node is ShadowRoot {
  return node.nodeType === 11 && 'host' in node;
}

function addAllowedPath(
  allowed: Map<ParentNode, Set<Element>>,
  host: HTMLElement,
  doc: Document,
): void {
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

function modalAllowedRoot(entry: OverlayStackEntrySnapshot, doc: Document): HTMLElement {
  const explicit = entry.modalRoot?.() ?? null;
  return explicit?.isConnected && explicit.ownerDocument === doc ? explicit : entry.host;
}

function applyTopmostInert(state: ModalDocumentState): void {
  let modalIndex = -1;
  for (let index = state.snapshot.entries.length - 1; index >= 0; index--) {
    if (state.snapshot.entries[index]?.modal) {
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
    inertOutsideAllowedPaths(state, allowed, desired);
  } else if (modalIndex !== -1) {
    const allowed = new Map<ParentNode, Set<Element>>();
    for (const entry of state.snapshot.entries.slice(modalIndex)) {
      if (entry.host.isConnected) addAllowedPath(allowed, modalAllowedRoot(entry, state.document), state.document);
    }
    inertOutsideAllowedPaths(state, allowed, desired);
  }
  for (const [element, intended] of state.inerted) {
    if (desired.has(element)) continue;
    setInertByManager(state, element, intended);
    state.inerted.delete(element);
  }
}

function inertOutsideAllowedPaths(
  state: ModalDocumentState,
  allowed: Map<ParentNode, Set<Element>>,
  desired: Set<HTMLElement>,
): void {
  for (const [parent, children] of allowed) {
    if (isShadowRoot(parent)) observeMutationRoot(state, parent);
    for (const child of composedChildren(parent)) {
      if (!children.has(child)) inertElement(state, child, desired);
    }
  }
}

/**
 * Adds an overlay to the document stack. Modal entries load inerting, rendered-state tracking, and
 * optional scroll locking; `modal: false` retains the historical API while using the lean adapter.
 */
export function activateOverlay(options: OverlayActivationOptions): OverlayHandle {
  if (
    options.modal === false &&
    options.trapFocus === false &&
    !options.suspendWhenUnrendered &&
    !options.lockScroll
  ) {
    return activateNonmodalOverlay(options);
  }

  const modal = options.modal !== false;
  let releaseModalState: (() => void) | undefined;
  let releaseScrollLock: (() => void) | undefined;
  let renderedState: RenderedStateController | undefined;
  const coreHandle = activateOverlayStack({
    ...options,
    initiallySuspended: options.suspendWhenUnrendered === true,
    modal,
    trapFocus: options.trapFocus !== false,
    onRegistered: (doc) => {
      if (modal) releaseModalState = retainModalState(doc);
      if (options.lockScroll) releaseScrollLock = lockScroll(doc);
    },
    onUnregistered: (_doc, deferResourceRelease) => {
      const releaseModal = releaseModalState;
      releaseModalState = undefined;
      const release = releaseScrollLock;
      releaseScrollLock = undefined;
      // Clear and settle the lock before modal-state teardown mutates inert attributes. Those DOM
      // writes can synchronously flush a queued custom-element reconnect and acquire fresh
      // resources for this same handle; retaining either old closure until afterward would let the
      // reentrant registration overwrite it.
      const deferredRelease = release && deferResourceRelease ? release : undefined;
      if (release && !deferResourceRelease) release();
      releaseModal?.();
      return deferredRelease;
    },
    onDeactivate: () => renderedState?.stop(),
  });

  // Lit's SSR renderer constructs component instances without a browser-owned `ownerDocument`.
  // The stack returns an inert handle for that environment; do not create a rendered-state
  // controller whose first synchronous check would otherwise dereference the absent document.
  if (!coreHandle.isActive()) return coreHandle;

  if (options.suspendWhenUnrendered) {
    renderedState = new RenderedStateController(options.host, options.panel, (rendered) => {
      if (!coreHandle.isActive()) return;
      if (!rendered) {
        coreHandle.suspend();
        return;
      }
      const wasTopmost = coreHandle.isTopmost();
      coreHandle.resume();
      if (!wasTopmost && coreHandle.isTopmost()) queueMicrotask(() => coreHandle.focusInitial());
    });
    renderedState.start();
  }

  return {
    focusInitial: () => {
      renderedState?.check();
      coreHandle.focusInitial();
    },
    focusAutofocus: () => {
      renderedState?.check();
      return coreHandle.focusAutofocus();
    },
    updateRestoreFocusTo: (target) => coreHandle.updateRestoreFocusTo(target),
    deactivate: (deactivateOptions) => coreHandle.deactivate(deactivateOptions),
    suspend: () => coreHandle.suspend(),
    resume: () => {
      if (renderedState && !renderedState.check()) return;
      coreHandle.resume();
    },
    isTopmost: () => {
      renderedState?.check();
      return coreHandle.isTopmost();
    },
    isActive: () => coreHandle.isActive(),
    dismissBackdrop: () => {
      renderedState?.check();
      return coreHandle.dismissBackdrop();
    },
  };
}

/**
 * Temporarily yields Lyra's modal stack to a third-party modal rooted at `externalModal`.
 * The returned release function is idempotent and scoped to the root's current document.
 */
export function suspendLyraModalsFor(externalModal: HTMLElement): () => void {
  if (!externalModal.isConnected) return () => undefined;
  const state = modalStateFor(externalModal.ownerDocument);
  startModalState(state);
  const entry: ExternalModalSuspensionEntry = {
    root: externalModal,
    active: true,
    releaseRouting: () => undefined,
    state,
  };
  state.externalModalSuspensions.add(entry);
  entry.releaseRouting = acquireOverlayRoutingSuspension(state.document);
  applyTopmostInert(state);

  return () => {
    if (!entry.active) return;
    entry.active = false;
    entry.state.externalModalSuspensions.delete(entry);
    entry.releaseRouting();
    applyTopmostInert(entry.state);
    stopModalStateIfIdle(entry.state);
  };
}

export {
  collectAutofocusElements,
  collectFocusableElements,
  composedContains,
  deepActiveElement,
} from './overlay-stack.js';
