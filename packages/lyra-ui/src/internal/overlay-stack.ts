import { deepActiveElementIn } from './active-element.js';
import {
  collectComposedAutofocusElements,
  collectComposedFocusTargets,
  isComposedFocusAvailable,
} from './focus-navigation.js';
import { isHtmlElement } from './dom-guards.js';
import {
  leaseInlineStyleProperty,
  type InlineStylePropertyLease,
} from './style-property-lease.js';

const STACK_PROPERTY = '--lr-overlay-stack-index';
const STACK_BASE = 1000;
const STACK_STEP = 2;

type OverlayResourceRelease = () => void;

export type OverlayStackRestoreFocusTarget = HTMLElement | null | (() => HTMLElement | null);

export interface OverlayStackDeactivateOptions {
  restoreFocus?: boolean;
  deferScrollLockRelease?: boolean;
}

export interface OverlayStackHandle {
  focusInitial(): void;
  focusAutofocus(): boolean;
  updateRestoreFocusTo(target: OverlayStackRestoreFocusTarget): void;
  deactivate(options?: OverlayStackDeactivateOptions): (() => void) | undefined;
  suspend(): void;
  resume(): void;
  isTopmost(): boolean;
  isActive(): boolean;
  dismissBackdrop(): boolean;
}

export interface OverlayStackActivationOptions {
  host: HTMLElement;
  panel: () => HTMLElement | null;
  modalRoot?: () => HTMLElement | null;
  onEscape: () => void;
  onBackdrop?: () => void;
  preferredInitialFocus?: () => HTMLElement | null;
  beforeInitialFocus?: () => boolean;
  restoreFocusTo?: OverlayStackRestoreFocusTarget;
  onTab?: () => void;
  initiallySuspended?: boolean;
  modal: boolean;
  trapFocus: boolean;
  onRegistered?: (document: Document) => void;
  onUnregistered?: (
    document: Document,
    deferResourceRelease: boolean,
  ) => OverlayResourceRelease | undefined;
  onDeactivate?: () => void;
}

interface OverlayEntry {
  options: OverlayStackActivationOptions;
  restoreFocusTo: OverlayStackRestoreFocusTarget;
  active: boolean;
  registered: boolean;
  manuallySuspended: boolean;
  initialFocusDecision?: boolean;
  wasTopmostOnSuspend: boolean;
  suspendGeneration: number;
  stackOrder: number;
  state: OverlayDocumentState;
  stackStyleLease?: InlineStylePropertyLease;
  deferredResourceRelease?: OverlayResourceRelease;
  handle: OverlayStackHandle;
}

export interface OverlayStackEntrySnapshot {
  readonly host: HTMLElement;
  readonly modal: boolean;
  readonly modalRoot?: () => HTMLElement | null;
}

export interface OverlayStackSnapshot {
  readonly entries: readonly OverlayStackEntrySnapshot[];
}

type OverlayStackObserver = (snapshot: OverlayStackSnapshot) => void;

interface OverlayDocumentState {
  document: Document;
  stack: OverlayEntry[];
  routingSuspensions: Set<symbol>;
  observers: Set<OverlayStackObserver>;
  nextStackOrder: number;
  started: boolean;
  onKeyDown: (event: KeyboardEvent) => void;
}

const states = new WeakMap<Document, OverlayDocumentState>();
const hostEntries = new WeakMap<HTMLElement, OverlayEntry>();

function createInactiveOverlayHandle(): OverlayStackHandle {
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

function snapshotFor(state: OverlayDocumentState): OverlayStackSnapshot {
  return {
    entries: state.stack.map((entry) => ({
      host: entry.options.host,
      modal: entry.options.modal,
      modalRoot: entry.options.modalRoot,
    })),
  };
}

function notifyStackObservers(state: OverlayDocumentState): void {
  if (state.observers.size === 0) return;
  const snapshot = snapshotFor(state);
  for (const observer of state.observers) observer(snapshot);
}

function startState(state: OverlayDocumentState): void {
  if (state.started) return;
  state.started = true;
  state.document.addEventListener('keydown', state.onKeyDown);
}

function stopState(state: OverlayDocumentState): void {
  if (!state.started) return;
  state.started = false;
  state.document.removeEventListener('keydown', state.onKeyDown);
}

function stopStateIfIdle(state: OverlayDocumentState): void {
  if (state.stack.length === 0) stopState(state);
}

function createState(doc: Document): OverlayDocumentState {
  const state = {} as OverlayDocumentState;
  state.document = doc;
  state.stack = [];
  state.routingSuspensions = new Set();
  state.observers = new Set();
  state.nextStackOrder = 0;
  state.started = false;
  state.onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || state.routingSuspensions.size > 0) return;
    const entry = state.stack[state.stack.length - 1];
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

/** Observes the shared stack without making modal machinery part of a nonmodal import graph. */
export function observeOverlayStack(
  doc: Document,
  observer: OverlayStackObserver,
): () => void {
  const state = stateFor(doc);
  state.observers.add(observer);
  observer(snapshotFor(state));
  return () => {
    state.observers.delete(observer);
  };
}

/** Suspends Escape/Tab ownership while an external modal owns the document. */
export function acquireOverlayRoutingSuspension(doc: Document): () => void {
  const state = stateFor(doc);
  const token = Symbol();
  let active = true;
  state.routingSuspensions.add(token);
  return () => {
    if (!active) return;
    active = false;
    state.routingSuspensions.delete(token);
  };
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
  entry.options.onRegistered?.(state.document);
  const nextIndex = state.stack.findIndex((candidate) => candidate.stackOrder > entry.stackOrder);
  if (nextIndex === -1) state.stack.push(entry);
  else state.stack.splice(nextIndex, 0, entry);
  updateStackStyles(state);
  notifyStackObservers(state);
}

function unregisterEntry(entry: OverlayEntry, deferResourceRelease = false): boolean {
  if (!entry.registered) {
    const hasHigherEntry = entry.state.stack.some((candidate) => candidate.stackOrder > entry.stackOrder);
    return entry.state.routingSuspensions.size === 0 && entry.wasTopmostOnSuspend && !hasHigherEntry;
  }
  const state = entry.state;
  const index = state.stack.indexOf(entry);
  const wasTopmost = state.routingSuspensions.size === 0 && index === state.stack.length - 1;
  if (index !== -1) state.stack.splice(index, 1);
  entry.registered = false;
  entry.wasTopmostOnSuspend = wasTopmost;
  // Release resources before any DOM-facing work. Restoring the stack style or notifying an
  // observer can synchronously flush a custom element's queued reconnect callback and re-register
  // this entry. Running the old release afterward would then overwrite or release the new
  // registration's resource handle instead of the one being removed.
  entry.deferredResourceRelease = entry.options.onUnregistered?.(state.document, deferResourceRelease);
  restoreStackStyle(entry);
  updateStackStyles(state);
  notifyStackObservers(state);
  stopStateIfIdle(state);
  return wasTopmost;
}

function syncEntryRegistration(entry: OverlayEntry): void {
  if (!entry.active || entry.manuallySuspended) {
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
    // Do not invoke a live resolver while overlay resources are still active. Explicit live resolvers
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
  deferResourceRelease = false,
): (() => void) | undefined {
  if (!entry.active) return undefined;
  rebaseReturnTargets(entry);
  const wasTopmost = unregisterEntry(entry, deferResourceRelease);
  const deferredResourceRelease = entry.deferredResourceRelease;
  entry.deferredResourceRelease = undefined;
  entry.active = false;
  entry.manuallySuspended = false;
  entry.suspendGeneration++;
  entry.options.onDeactivate?.();
  if (hostEntries.get(entry.options.host) === entry) hostEntries.delete(entry.options.host);
  if (!wasTopmost) return deferredResourceRelease;
  if (restoreFocus) {
    restoreEntryFocus(entry);
    return deferredResourceRelease;
  }
  const next = entry.state.stack[entry.state.stack.length - 1];
  if (next) focusEntry(next);
  return deferredResourceRelease;
}

/**
 * Adds an overlay to a stack scoped to its own `ownerDocument`. One document
 * listener routes Escape and Tab only to the top entry, while modal inerting,
 * visual stack depth, and focus return are recomputed as entries move.
 */
export function activateOverlayStack(options: OverlayStackActivationOptions): OverlayStackHandle {
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
  entry.manuallySuspended = options.initiallySuspended === true;
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
      if (
        entry.active &&
        entry.registered &&
        entry.state.routingSuspensions.size === 0 &&
        entry.state.stack[entry.state.stack.length - 1] === entry
      ) {
        focusEntry(entry);
      }
    },
    focusAutofocus: () => {
      if (!entry.active || !entry.registered || entry.state.routingSuspensions.size > 0) return false;
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
      syncEntryRegistration(entry);
    },
    isTopmost: () => {
      return (
        entry.active &&
        entry.registered &&
        entry.state.routingSuspensions.size === 0 &&
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
  if (!entry.manuallySuspended) {
    registerEntry(entry, entry.state, true);
  }
  return entry.handle;
}
