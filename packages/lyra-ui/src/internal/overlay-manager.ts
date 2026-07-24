const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'audio[controls]',
  'button:not([disabled])',
  'iframe',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'summary',
  'textarea:not([disabled])',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ');

const STACK_PROPERTY = '--lr-overlay-stack-index';
const STACK_BASE = 1000;
const STACK_STEP = 2;

export interface OverlayActivationOptions {
  /** The custom-element host that owns this overlay. */
  host: HTMLElement;
  /** Resolves the current dialog/panel element after each render. */
  panel: () => HTMLElement | null;
  /** Dismisses the overlay with its component-specific Escape reason/event. */
  onEscape: () => void;
  /** Dismisses the overlay with its component-specific backdrop reason/event. */
  onBackdrop?: () => void;
  /** Optional component-specific initial target, such as an intentionally safe default action. */
  preferredInitialFocus?: () => HTMLElement | null;
  /** Override the focus-return target captured when the overlay activates. */
  restoreFocusTo?: HTMLElement | null;
  /** Defaults to true. Nonmodal popups share ordering without inerting the page. */
  modal?: boolean;
  /** Defaults to true. Set false for popups that allow native Tab to leave. */
  trapFocus?: boolean;
  /** Optional non-trapping Tab lifecycle, called without preventing the event. */
  onTab?: () => void;
}

export interface OverlayDeactivateOptions {
  /** Defaults to true. Explicit outside-pointer paths can suppress restoration. */
  restoreFocus?: boolean;
}

export interface OverlayHandle {
  /** Moves focus inside unless focus is already within the current panel. */
  focusInitial(): void;
  /** Replaces the eventual focus-return target without unregistering or reordering the overlay. */
  updateRestoreFocusTo(target: HTMLElement | null): void;
  /** Removes the overlay permanently. Safe to call repeatedly. */
  deactivate(options?: OverlayDeactivateOptions): void;
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
  restoreFocusTo: HTMLElement | null;
  active: boolean;
  registered: boolean;
  wasTopmostOnSuspend: boolean;
  suspendGeneration: number;
  stackOrder: number;
  state: OverlayDocumentState;
  previousStackValue: string;
  previousStackPriority: string;
  handle: OverlayHandle;
}

interface OverlayDocumentState {
  document: Document;
  stack: OverlayEntry[];
  nextStackOrder: number;
  inerted: Map<HTMLElement, boolean>;
  pendingInertWrites: Map<HTMLElement, boolean[]>;
  observer?: MutationObserver;
  observedRoots: Set<Document | ShadowRoot>;
  inertUpdateQueued: boolean;
  onKeyDown: (event: KeyboardEvent) => void;
}

const states = new WeakMap<Document, OverlayDocumentState>();
const hostEntries = new WeakMap<HTMLElement, OverlayEntry>();

/** Returns the deepest focused descendant across open shadow roots. */
export function deepActiveElement(doc: Document = document): Element | null {
  let active: Element | null = doc.activeElement;
  while (active) {
    const inner = active.shadowRoot?.activeElement ?? null;
    if (!inner) break;
    active = inner;
  }
  return active;
}

function isSlot(element: Element): element is HTMLSlotElement {
  return element.localName === 'slot' && typeof (element as HTMLSlotElement).assignedElements === 'function';
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

function hasInertAncestor(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if ((current as HTMLElement).inert) return true;
    current = composedParent(current);
  }
  return false;
}

function isRendered(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true' || hasInertAncestor(element)) return false;
  if (element.ownerDocument.defaultView?.getComputedStyle(element).visibility !== 'visible') return false;
  return element.checkVisibility ? element.checkVisibility() : element.getClientRects().length > 0;
}

function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled')) return false;
  return isRendered(element);
}

function collectFocusable(element: Element, result: HTMLElement[]): void {
  if (element.matches(FOCUSABLE_SELECTOR) && isTabbable(element as HTMLElement)) result.push(element as HTMLElement);
  if (isSlot(element)) {
    const hasAssignedNodes = element.assignedNodes().length > 0;
    const assigned = element
      .assignedNodes({ flatten: true })
      .filter((node): node is Element => node.nodeType === 1);
    const children = hasAssignedNodes ? assigned : Array.from(element.children);
    for (const child of children) collectFocusable(child, result);
    return;
  }
  const container: Element | ShadowRoot = element.shadowRoot ?? element;
  for (const child of Array.from(container.children)) collectFocusable(child, result);
}

/** Collects rendered focus targets through slots and nested open shadow roots in browser tab order. */
export function collectFocusableElements(root: Element | ShadowRoot): HTMLElement[] {
  const result: HTMLElement[] = [];
  if ('matches' in root) {
    collectFocusable(root as Element, result);
  } else {
    for (const child of Array.from(root.children)) collectFocusable(child, result);
  }
  const radioGroups: Array<{
    name: string;
    form: HTMLFormElement | null;
    root: Node;
    members: HTMLInputElement[];
  }> = [];
  for (const element of result) {
    if (element.localName !== 'input') continue;
    const input = element as HTMLInputElement;
    if (input.type !== 'radio' || input.name === '') continue;
    let group = radioGroups.find(
      (candidate) =>
        candidate.name === input.name && candidate.form === input.form && candidate.root === input.getRootNode(),
    );
    if (!group) {
      group = { name: input.name, form: input.form, root: input.getRootNode(), members: [] };
      radioGroups.push(group);
    }
    group.members.push(input);
  }
  const excludedRadios = new Set<HTMLInputElement>();
  for (const group of radioGroups) {
    const tabStop = group.members.find((radio) => radio.checked) ?? group.members[0];
    for (const radio of group.members) {
      if (radio !== tabStop) excludedRadios.add(radio);
    }
  }

  return result
    .filter((element) => !excludedRadios.has(element as HTMLInputElement))
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const aPositive = a.element.tabIndex > 0;
      const bPositive = b.element.tabIndex > 0;
      if (aPositive !== bPositive) return aPositive ? -1 : 1;
      if (aPositive && a.element.tabIndex !== b.element.tabIndex) return a.element.tabIndex - b.element.tabIndex;
      return a.index - b.index;
    })
    .map(({ element }) => element);
}

function tryFocus(target: HTMLElement | null): boolean {
  if (!target?.isConnected || !isRendered(target) || target.matches(':disabled')) return false;
  target.focus();
  const active = deepActiveElement(target.ownerDocument);
  return active === target || composedContains(target, active);
}

function focusEntry(entry: OverlayEntry, preserveCurrent = true): void {
  const panel = entry.options.panel();
  if (!panel) return;
  const active = deepActiveElement(entry.state.document);
  if (preserveCurrent && composedContains(panel, active)) return;

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
  let needsInertUpdate = false;
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
  if (needsInertUpdate) scheduleInertUpdate(state);
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
  state.document.addEventListener('keydown', state.onKeyDown);
  const Observer = state.document.defaultView?.MutationObserver ?? MutationObserver;
  state.observer = new Observer((records) => handleMutations(state, records));
  observeMutationRoot(state, state.document);
}

function stopState(state: OverlayDocumentState): void {
  state.document.removeEventListener('keydown', state.onKeyDown);
  state.observer?.disconnect();
  state.observer = undefined;
  state.observedRoots.clear();
  state.pendingInertWrites.clear();
}

function createState(doc: Document): OverlayDocumentState {
  const state = {} as OverlayDocumentState;
  state.document = doc;
  state.stack = [];
  state.nextStackOrder = 0;
  state.inerted = new Map();
  state.pendingInertWrites = new Map();
  state.observedRoots = new Set();
  state.inertUpdateQueued = false;
  state.onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
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
  if (modalIndex !== -1) {
    const allowed = new Map<ParentNode, Set<Element>>();
    for (const entry of state.stack.slice(modalIndex)) {
      if (entry.options.host.isConnected) addAllowedPath(allowed, entry.options.host, state.document);
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
  if (entry.previousStackValue) {
    entry.options.host.style.setProperty(STACK_PROPERTY, entry.previousStackValue, entry.previousStackPriority);
  } else {
    entry.options.host.style.removeProperty(STACK_PROPERTY);
  }
}

function updateStackStyles(state: OverlayDocumentState): void {
  state.stack.forEach((entry, index) => {
    entry.options.host.style.setProperty(STACK_PROPERTY, String(STACK_BASE + index * STACK_STEP));
  });
}

function registerEntry(entry: OverlayEntry, state: OverlayDocumentState, preserveStackOrder = false): void {
  if (state.stack.length === 0) startState(state);
  if (!preserveStackOrder || entry.state !== state) entry.stackOrder = state.nextStackOrder++;
  entry.state = state;
  entry.registered = true;
  const nextIndex = state.stack.findIndex((candidate) => candidate.stackOrder > entry.stackOrder);
  if (nextIndex === -1) state.stack.push(entry);
  else state.stack.splice(nextIndex, 0, entry);
  updateStackStyles(state);
  applyTopmostInert(state);
}

function unregisterEntry(entry: OverlayEntry): boolean {
  if (!entry.registered) return entry.wasTopmostOnSuspend;
  const state = entry.state;
  const index = state.stack.indexOf(entry);
  const wasTopmost = index === state.stack.length - 1;
  if (index !== -1) state.stack.splice(index, 1);
  entry.registered = false;
  entry.wasTopmostOnSuspend = wasTopmost;
  restoreStackStyle(entry);
  updateStackStyles(state);
  applyTopmostInert(state);
  if (state.stack.length === 0) stopState(state);
  return wasTopmost;
}

function rebaseReturnTargets(entry: OverlayEntry): void {
  for (const candidate of entry.state.stack) {
    if (candidate === entry || candidate.stackOrder <= entry.stackOrder) continue;
    if (candidate.restoreFocusTo && composedContains(entry.options.host, candidate.restoreFocusTo)) {
      candidate.restoreFocusTo = entry.restoreFocusTo;
    }
  }
}

function restoreEntryFocus(entry: OverlayEntry): void {
  if (tryFocus(entry.restoreFocusTo)) return;
  const next = entry.state.stack[entry.state.stack.length - 1];
  if (next) focusEntry(next, false);
}

function deactivateEntry(entry: OverlayEntry, restoreFocus: boolean): void {
  if (!entry.active) return;
  rebaseReturnTargets(entry);
  const wasTopmost = unregisterEntry(entry);
  entry.active = false;
  entry.suspendGeneration++;
  if (hostEntries.get(entry.options.host) === entry) hostEntries.delete(entry.options.host);
  if (!wasTopmost) return;
  if (restoreFocus) {
    restoreEntryFocus(entry);
    return;
  }
  const next = entry.state.stack[entry.state.stack.length - 1];
  if (next) focusEntry(next);
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

  const doc = options.host.ownerDocument;
  const active = deepActiveElement(doc);
  const captured = active && typeof (active as HTMLElement).focus === 'function' ? (active as HTMLElement) : null;
  const entry = {} as OverlayEntry;
  entry.options = options;
  entry.restoreFocusTo =
    options.restoreFocusTo !== undefined ? options.restoreFocusTo : (inheritedReturnTarget ?? captured);
  entry.active = true;
  entry.registered = false;
  entry.wasTopmostOnSuspend = false;
  entry.suspendGeneration = 0;
  entry.state = stateFor(doc);
  entry.stackOrder = -1;
  entry.previousStackValue = options.host.style.getPropertyValue(STACK_PROPERTY);
  entry.previousStackPriority = options.host.style.getPropertyPriority(STACK_PROPERTY);
  entry.handle = {
    focusInitial: () => {
      if (entry.active && entry.registered && entry.state.stack[entry.state.stack.length - 1] === entry) {
        focusEntry(entry);
      }
    },
    updateRestoreFocusTo: (target) => {
      if (entry.active) entry.restoreFocusTo = target;
    },
    deactivate: (deactivateOptions = {}) => {
      deactivateEntry(entry, deactivateOptions.restoreFocus !== false);
    },
    suspend: () => {
      if (!entry.active || !entry.registered) return;
      unregisterEntry(entry);
      const generation = ++entry.suspendGeneration;
      queueMicrotask(() => {
        if (entry.active && !entry.registered && entry.suspendGeneration === generation && !entry.options.host.isConnected) {
          deactivateEntry(entry, true);
        }
      });
    },
    resume: () => {
      if (!entry.active || entry.registered) return;
      entry.suspendGeneration++;
      const state = stateFor(entry.options.host.ownerDocument);
      registerEntry(entry, state, entry.state === state);
    },
    isTopmost: () =>
      entry.active && entry.registered && entry.state.stack[entry.state.stack.length - 1] === entry,
    isActive: () => entry.active,
    dismissBackdrop: () => {
      if (!entry.handle.isTopmost() || !entry.options.onBackdrop) return false;
      entry.options.onBackdrop();
      return true;
    },
  };

  hostEntries.set(options.host, entry);
  registerEntry(entry, entry.state);
  return entry.handle;
}
