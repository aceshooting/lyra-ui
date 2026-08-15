import {
  invalidateLyraLocaleCache,
  peekLyraDirection,
  peekLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
} from './localization-runtime.js';

const INHERITED_CONTEXT_ATTRIBUTES = [
  'locale',
  'lang',
  'dir',
  'class',
  'style',
  'slot',
  'name',
] as const;

type InheritedContextKind = 'locale' | 'direction';

interface InheritedContextHost extends Element {
  readonly isConnected: boolean;
  requestUpdate(): unknown;
}

interface InheritedContextState {
  localeSensitive: boolean;
  directionSensitive: boolean;
  lastLocale?: string;
  lastDirection?: 'ltr' | 'rtl';
  localeMutationSequence: number;
  directionMutationSequence: number;
  lastLocaleReadSequence: number;
  lastDirectionReadSequence: number;
  updateActive: boolean;
  activeUpdateRendered: boolean;
  activeLocale?: string;
  activeDirection?: 'ltr' | 'rtl';
  activeLocaleReadSequence?: number;
  activeDirectionReadSequence?: number;
}

interface RootObservation {
  readonly root: Node;
  readonly observer: MutationObserver;
  readonly localeSubscribers: WeakMap<
    Element,
    Set<InheritedContextSubscription>
  >;
  readonly directionSubscribers: WeakMap<
    Element,
    Set<InheritedContextSubscription>
  >;
  readonly directionSubscriptions: Set<InheritedContextSubscription>;
  readonly slotchange?: EventListener;
  subscriberCount: number;
}

interface RootBinding {
  readonly observation: RootObservation;
  readonly ancestors: readonly Element[];
}

interface InheritedContextSubscription {
  readonly host: InheritedContextHost;
  readonly state: InheritedContextState;
  active: boolean;
  localeBindings: readonly RootBinding[];
  directionBindings: readonly RootBinding[];
  localeBound: boolean;
  directionBound: boolean;
  recheckLocale: boolean;
  recheckDirection: boolean;
  rebindLocale: boolean;
  rebindDirection: boolean;
  pendingLocaleMutationSequence?: number;
  pendingDirectionMutationSequence?: number;
  ownerLifecycle?: OwnerDocumentLifecycle;
}

interface OwnerDocumentLifecycle {
  readonly document: Document;
  readonly view: Window;
  readonly subscriptions: Set<InheritedContextSubscription>;
  readonly pagehide: EventListener;
}

const rootObservations = new WeakMap<Node, RootObservation>();
const ownerDocumentLifecycles = new WeakMap<Document, OwnerDocumentLifecycle>();
const hostStates = new WeakMap<Element, InheritedContextState>();
const hostSubscriptions = new WeakMap<Element, InheritedContextSubscription>();
const pendingSubscriptions = new Set<InheritedContextSubscription>();
let flushQueued = false;

function shadowHost(root: Node): Element | null {
  const candidate = (root as { nodeType?: number; host?: unknown }).host;
  return root.nodeType === 11 &&
    candidate !== null &&
    typeof candidate === 'object' &&
    typeof (candidate as Element).getAttribute === 'function'
    ? (candidate as Element)
    : null;
}

function assignedSlot(element: Element): Element | null {
  const candidate = (element as { assignedSlot?: unknown }).assignedSlot;
  return candidate !== null &&
    typeof candidate === 'object' &&
    typeof (candidate as Element).getAttribute === 'function'
    ? (candidate as Element)
    : null;
}

function localeParentElement(element: Element): Element | null {
  return element.parentElement ?? shadowHost(element.getRootNode());
}

/**
 * CSS inheritance follows the flattened tree: an exposed assigned slot precedes the light-DOM
 * parent. Closed roots intentionally hide `assignedSlot` from their light children, so code
 * outside such a root cannot observe slot-local styling; descendants physically inside either an
 * open or closed root still use the ordinary shadow-host path below.
 */
function directionParentElement(element: Element): Element | null {
  return (
    assignedSlot(element) ??
    element.parentElement ??
    shadowHost(element.getRootNode())
  );
}

function observationTarget(root: Node): Node | null {
  if (root.nodeType === 9) return (root as Document).documentElement;
  return root.nodeType === 11 ? root : null;
}

function ownerView(
  host: Element
): (Window & typeof globalThis) | null | undefined {
  try {
    return host.ownerDocument.defaultView;
  } catch {
    return undefined;
  }
}

function queueSubscription(
  subscription: InheritedContextSubscription,
  locale: boolean,
  direction: boolean,
  rebind = false
): void {
  if (!subscription.active || !subscription.host.isConnected) return;
  if (locale && subscription.state.localeSensitive) {
    subscription.state.localeMutationSequence += 1;
    subscription.pendingLocaleMutationSequence =
      subscription.state.localeMutationSequence;
    subscription.recheckLocale = true;
    subscription.rebindLocale ||= rebind;
  }
  if (direction && subscription.state.directionSensitive) {
    subscription.state.directionMutationSequence += 1;
    subscription.pendingDirectionMutationSequence =
      subscription.state.directionMutationSequence;
    subscription.recheckDirection = true;
    subscription.rebindDirection ||= rebind;
  }
  if (!subscription.recheckLocale && !subscription.recheckDirection) return;
  pendingSubscriptions.add(subscription);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flushInheritedContextChanges);
}

function subscribersFor(
  map: WeakMap<Element, Set<InheritedContextSubscription>>,
  target: Element
): ReadonlySet<InheritedContextSubscription> | undefined {
  return map.get(target);
}

function createRootObservation(
  root: Node,
  Observer: typeof MutationObserver
): RootObservation | undefined {
  const target = observationTarget(root);
  if (!target) return undefined;
  const localeSubscribers = new WeakMap<
    Element,
    Set<InheritedContextSubscription>
  >();
  const directionSubscribers = new WeakMap<
    Element,
    Set<InheritedContextSubscription>
  >();
  const directionSubscriptions = new Set<InheritedContextSubscription>();
  let observer: MutationObserver | undefined;
  let slotchange: EventListener | undefined;
  try {
    observer = new Observer((records) => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const subscription of [...directionSubscriptions]) {
            queueSubscription(subscription, false, true, true);
          }
          continue;
        }
        if (
          record.type !== 'attributes' ||
          (record.target as { nodeType?: number }).nodeType !== 1 ||
          typeof (record.target as Element).getAttribute !== 'function'
        )
          continue;
        const mutationTarget = record.target as Element;
        const attribute = record.attributeName;
        if (attribute === 'locale' || attribute === 'lang') {
          for (const subscription of subscribersFor(
            localeSubscribers,
            mutationTarget
          ) ?? []) {
            queueSubscription(subscription, true, false);
          }
        }
        const directionRelevant =
          attribute === 'dir' ||
          attribute === 'class' ||
          attribute === 'style' ||
          attribute === 'locale' ||
          attribute === 'lang';
        const flattenedTreeChanged =
          attribute === 'slot' || attribute === 'name';
        if (directionRelevant || flattenedTreeChanged) {
          for (const subscription of subscribersFor(
            directionSubscribers,
            mutationTarget
          ) ?? []) {
            queueSubscription(subscription, false, true, flattenedTreeChanged);
          }
        }
      }
    });
    observer.observe(target, {
      subtree: true,
      attributes: true,
      childList: root.nodeType === 11,
      attributeFilter: [...INHERITED_CONTEXT_ATTRIBUTES],
    });
    if (root.nodeType === 11) {
      slotchange = () => {
        for (const subscription of [...directionSubscriptions]) {
          queueSubscription(subscription, false, true, true);
        }
      };
      root.addEventListener('slotchange', slotchange);
    }
  } catch {
    try {
      observer?.disconnect();
    } catch {
      // Setup already failed; cleanup must not replace that failure or strand earlier roots.
    }
    if (slotchange) {
      try {
        root.removeEventListener('slotchange', slotchange);
      } catch {
        // A hostile root must not prevent transaction rollback.
      }
    }
    throw new Error('Unable to observe inherited context in the owner realm.');
  }
  const observation: RootObservation = {
    root,
    observer,
    localeSubscribers,
    directionSubscribers,
    directionSubscriptions,
    slotchange,
    subscriberCount: 0,
  };
  rootObservations.set(root, observation);
  return observation;
}

function openShadowRoot(element: Element | null): Node | null {
  if (!element) return null;
  const candidate = (element as { shadowRoot?: unknown }).shadowRoot;
  return candidate !== null &&
    typeof candidate === 'object' &&
    (candidate as { nodeType?: number }).nodeType === 11
    ? (candidate as Node)
    : null;
}

function groupedAncestors(
  host: InheritedContextHost,
  kind: InheritedContextKind
): Map<Node, Element[]> {
  const byRoot = new Map<Node, Element[]>();
  const visited = new Set<Element>();
  const addChain = (
    first: Element | null,
    parent: (element: Element) => Element | null
  ): void => {
    let ancestor = first;
    while (ancestor && !visited.has(ancestor)) {
      visited.add(ancestor);
      const root = ancestor.getRootNode();
      const group = byRoot.get(root) ?? [];
      group.push(ancestor);
      byRoot.set(root, group);
      ancestor = parent(ancestor);
    }
  };
  if (kind === 'locale') {
    addChain(localeParentElement(host), localeParentElement);
  } else {
    addChain(directionParentElement(host), directionParentElement);
    // `:lang()` matching for a slotted host follows its DOM language ancestry, even though CSS
    // property inheritance follows its assigned slot. Observe both paths so a light-parent lang
    // change cannot leave a direction declaration selected by `:lang()` stale.
    addChain(localeParentElement(host), localeParentElement);
  }

  // An unassigned light child cannot yet expose its eventual slot in the flattened-parent walk.
  // When the parent has an open root, share one root-level slotchange listener so later slot
  // insertion/name changes can rebind it. Closed roots deliberately expose no equivalent handle.
  if (kind === 'direction' && !assignedSlot(host)) {
    const prospectiveSlotRoot = openShadowRoot(host.parentElement);
    if (prospectiveSlotRoot && !byRoot.has(prospectiveSlotRoot))
      byRoot.set(prospectiveSlotRoot, []);
  }
  return byRoot;
}

function releaseObservationReference(observation: RootObservation): void {
  observation.subscriberCount -= 1;
  if (observation.subscriberCount !== 0) return;
  try {
    observation.observer.disconnect();
  } catch {
    // The registry must still forget an unusable hostile observer.
  }
  if (observation.slotchange) {
    try {
      observation.root.removeEventListener(
        'slotchange',
        observation.slotchange
      );
    } catch {
      // The root registry cleanup below remains authoritative.
    }
  }
  rootObservations.delete(observation.root);
}

function releaseUnattachedBindings(bindings: readonly RootBinding[]): void {
  for (const { observation } of bindings)
    releaseObservationReference(observation);
}

function releaseOwnerLifecycle(
  subscription: InheritedContextSubscription
): void {
  const lifecycle = subscription.ownerLifecycle;
  if (!lifecycle) return;
  subscription.ownerLifecycle = undefined;
  lifecycle.subscriptions.delete(subscription);
  if (lifecycle.subscriptions.size !== 0) return;
  try {
    lifecycle.view.removeEventListener('pagehide', lifecycle.pagehide);
  } catch {
    // A discarded/hostile owner window must not strand the weak registry entry.
  }
  ownerDocumentLifecycles.delete(lifecycle.document);
}

function ensureOwnerLifecycle(
  subscription: InheritedContextSubscription
): void {
  const ownerDocument = subscription.host.ownerDocument;
  if (subscription.ownerLifecycle?.document === ownerDocument) return;
  releaseOwnerLifecycle(subscription);
  const view = ownerView(subscription.host);
  if (!view) return;
  let lifecycle = ownerDocumentLifecycles.get(ownerDocument);
  if (!lifecycle) {
    const subscriptions = new Set<InheritedContextSubscription>();
    const pagehide: EventListener = (event) => {
      // A persisted page remains live in the back-forward cache and must resume with its bindings.
      if ((event as Event & { persisted?: boolean }).persisted === true) return;
      for (const active of [...subscriptions])
        stopInheritedContextObservation(active);
    };
    lifecycle = { document: ownerDocument, view, subscriptions, pagehide };
    try {
      view.addEventListener('pagehide', pagehide);
    } catch {
      return;
    }
    ownerDocumentLifecycles.set(ownerDocument, lifecycle);
  }
  lifecycle.subscriptions.add(subscription);
  subscription.ownerLifecycle = lifecycle;
}

function acquireRootBindings(
  host: InheritedContextHost,
  kind: InheritedContextKind
): RootBinding[] | undefined {
  const view = ownerView(host);
  if (view === undefined) return undefined;
  if (view === null) return [];
  let Observer: typeof MutationObserver | undefined;
  try {
    Observer = view.MutationObserver;
  } catch {
    return undefined;
  }
  if (!Observer) return undefined;
  const bindings: RootBinding[] = [];
  try {
    for (const [root, ancestors] of groupedAncestors(host, kind)) {
      const observation =
        rootObservations.get(root) ?? createRootObservation(root, Observer);
      if (!observation) continue;
      observation.subscriberCount += 1;
      bindings.push({ observation, ancestors });
    }
    return bindings;
  } catch {
    releaseUnattachedBindings(bindings);
    return undefined;
  }
}

function addToMap(
  map: WeakMap<Element, Set<InheritedContextSubscription>>,
  ancestor: Element,
  subscription: InheritedContextSubscription
): void {
  const subscribers =
    map.get(ancestor) ?? new Set<InheritedContextSubscription>();
  subscribers.add(subscription);
  map.set(ancestor, subscribers);
}

function removeFromMap(
  map: WeakMap<Element, Set<InheritedContextSubscription>>,
  ancestor: Element,
  subscription: InheritedContextSubscription
): void {
  const subscribers = map.get(ancestor);
  subscribers?.delete(subscription);
  if (subscribers?.size === 0) map.delete(ancestor);
}

function attachBindings(
  subscription: InheritedContextSubscription,
  kind: InheritedContextKind,
  bindings: readonly RootBinding[]
): void {
  for (const { observation, ancestors } of bindings) {
    const map =
      kind === 'locale'
        ? observation.localeSubscribers
        : observation.directionSubscribers;
    for (const ancestor of ancestors) addToMap(map, ancestor, subscription);
    if (kind === 'direction')
      observation.directionSubscriptions.add(subscription);
  }
}

function detachBindings(
  subscription: InheritedContextSubscription,
  kind: InheritedContextKind,
  bindings: readonly RootBinding[]
): void {
  for (const { observation, ancestors } of bindings) {
    const map =
      kind === 'locale'
        ? observation.localeSubscribers
        : observation.directionSubscribers;
    for (const ancestor of ancestors)
      removeFromMap(map, ancestor, subscription);
    if (kind === 'direction')
      observation.directionSubscriptions.delete(subscription);
  }
}

function currentBindings(
  subscription: InheritedContextSubscription,
  kind: InheritedContextKind
): readonly RootBinding[] {
  return kind === 'locale'
    ? subscription.localeBindings
    : subscription.directionBindings;
}

function setCurrentBindings(
  subscription: InheritedContextSubscription,
  kind: InheritedContextKind,
  bindings: readonly RootBinding[]
): void {
  if (kind === 'locale') {
    subscription.localeBindings = bindings;
    subscription.localeBound = true;
  } else {
    subscription.directionBindings = bindings;
    subscription.directionBound = true;
  }
}

function bind(
  subscription: InheritedContextSubscription,
  kind: InheritedContextKind
): boolean {
  ensureOwnerLifecycle(subscription);
  const bindings = acquireRootBindings(subscription.host, kind);
  if (!bindings) return false;
  attachBindings(subscription, kind, bindings);
  setCurrentBindings(subscription, kind, bindings);
  return true;
}

function rebind(
  subscription: InheritedContextSubscription,
  kind: InheritedContextKind
): boolean {
  ensureOwnerLifecycle(subscription);
  const next = acquireRootBindings(subscription.host, kind);
  if (!next) return false;
  const previous = currentBindings(subscription, kind);
  detachBindings(subscription, kind, previous);
  releaseUnattachedBindings(previous);
  attachBindings(subscription, kind, next);
  setCurrentBindings(subscription, kind, next);
  return true;
}

function activate(
  subscription: InheritedContextSubscription,
  kind: InheritedContextKind
): void {
  if (kind === 'locale') {
    subscription.state.localeSensitive = true;
    if (!subscription.localeBound) bind(subscription, kind);
  } else {
    subscription.state.directionSensitive = true;
    if (!subscription.directionBound) bind(subscription, kind);
  }
}

function flushInheritedContextChanges(): void {
  flushQueued = false;
  const pending = [...pendingSubscriptions];
  pendingSubscriptions.clear();
  for (const subscription of pending) {
    const checkLocale = subscription.recheckLocale;
    const checkDirection = subscription.recheckDirection;
    const rebindLocale = subscription.rebindLocale;
    const rebindDirection = subscription.rebindDirection;
    const pendingLocaleMutationSequence =
      subscription.pendingLocaleMutationSequence;
    const pendingDirectionMutationSequence =
      subscription.pendingDirectionMutationSequence;
    subscription.recheckLocale = false;
    subscription.recheckDirection = false;
    subscription.rebindLocale = false;
    subscription.rebindDirection = false;
    subscription.pendingLocaleMutationSequence = undefined;
    subscription.pendingDirectionMutationSequence = undefined;
    if (!subscription.active || !subscription.host.isConnected) continue;

    if (rebindLocale) rebind(subscription, 'locale');
    if (rebindDirection) rebind(subscription, 'direction');
    invalidateLyraLocaleCache(subscription.host);
    let changed = false;
    const localeAlreadyRendered =
      pendingLocaleMutationSequence !== undefined &&
      subscription.state.lastLocaleReadSequence >=
        pendingLocaleMutationSequence;
    const directionAlreadyRendered =
      pendingDirectionMutationSequence !== undefined &&
      subscription.state.lastDirectionReadSequence >=
        pendingDirectionMutationSequence;
    if (
      checkLocale &&
      pendingLocaleMutationSequence !== undefined &&
      !localeAlreadyRendered
    ) {
      try {
        const previousLocale =
          subscription.state.lastLocale ?? peekLyraLocale(subscription.host);
        const locale = resolveLyraLocale(subscription.host);
        changed ||= previousLocale !== undefined && locale !== previousLocale;
      } catch {
        // A hostile owner document must not turn observer delivery into an uncaught microtask.
      }
    }
    if (
      checkDirection &&
      pendingDirectionMutationSequence !== undefined &&
      !directionAlreadyRendered
    ) {
      try {
        const previousDirection =
          subscription.state.lastDirection ??
          peekLyraDirection(subscription.host);
        const direction = resolveLyraDirection(subscription.host);
        changed ||=
          previousDirection !== undefined && direction !== previousDirection;
      } catch {
        // Keep the previous rendered baseline so a later mutation can retry.
      }
    }
    if (changed) subscription.host.requestUpdate();
  }
}

/**
 * Enrolls one connected Lyra host in shared owner-realm observers. Roots are acquired lazily only
 * after the host consumes locale or direction. Sensitivity and the last rendered baselines live
 * in a weak per-host state so disconnect/reconnect, reparenting and adoption can compare the new
 * tree without keeping a detached host alive.
 */
export function observeInheritedContext(
  host: InheritedContextHost
): () => void {
  const previous = hostSubscriptions.get(host);
  if (previous?.active) stopInheritedContextObservation(previous);
  const state = hostStates.get(host) ?? {
    localeSensitive: false,
    directionSensitive: false,
    localeMutationSequence: 0,
    directionMutationSequence: 0,
    lastLocaleReadSequence: 0,
    lastDirectionReadSequence: 0,
    updateActive: false,
    activeUpdateRendered: false,
  };
  hostStates.set(host, state);
  const subscription: InheritedContextSubscription = {
    host,
    state,
    active: true,
    localeBindings: [],
    directionBindings: [],
    localeBound: false,
    directionBound: false,
    recheckLocale: false,
    recheckDirection: false,
    rebindLocale: false,
    rebindDirection: false,
  };
  hostSubscriptions.set(host, subscription);
  if (state.localeSensitive) {
    activate(subscription, 'locale');
    queueSubscription(subscription, true, false);
  }
  if (state.directionSensitive) {
    activate(subscription, 'direction');
    queueSubscription(subscription, false, true);
  }
  return () => stopInheritedContextObservation(subscription);
}

function stopInheritedContextObservation(
  subscription: InheritedContextSubscription
): void {
  if (!subscription.active) return;
  subscription.active = false;
  pendingSubscriptions.delete(subscription);
  detachBindings(subscription, 'locale', subscription.localeBindings);
  releaseUnattachedBindings(subscription.localeBindings);
  detachBindings(subscription, 'direction', subscription.directionBindings);
  releaseUnattachedBindings(subscription.directionBindings);
  subscription.localeBindings = [];
  subscription.directionBindings = [];
  subscription.localeBound = false;
  subscription.directionBound = false;
  releaseOwnerLifecycle(subscription);
  if (hostSubscriptions.get(subscription.host) === subscription)
    hostSubscriptions.delete(subscription.host);
}

/** Records that a connected host's rendered output consumed inherited locale. */
export function recordInheritedLocaleRead(
  host: Element,
  locale: string | undefined
): void {
  const subscription = hostSubscriptions.get(host);
  if (!subscription?.active || locale === undefined) return;
  activate(subscription, 'locale');
  if (
    subscription.state.updateActive &&
    !subscription.state.activeUpdateRendered
  ) {
    subscription.state.activeLocale = locale;
    subscription.state.activeLocaleReadSequence =
      subscription.state.localeMutationSequence;
  } else {
    subscription.state.lastLocale ??= locale;
  }
}

/** Records that a connected host's rendered output consumed inherited CSS direction. */
export function recordInheritedDirectionRead(
  host: Element,
  direction: 'ltr' | 'rtl'
): void {
  const subscription = hostSubscriptions.get(host);
  if (!subscription?.active) return;
  activate(subscription, 'direction');
  if (
    subscription.state.updateActive &&
    !subscription.state.activeUpdateRendered
  ) {
    subscription.state.activeDirection = direction;
    subscription.state.activeDirectionReadSequence =
      subscription.state.directionMutationSequence;
  } else {
    subscription.state.lastDirection ??= direction;
  }
}

/** Begins one Lit update epoch so observer delivery can recognize context already rendered. */
export function beginInheritedContextUpdate(host: Element): void {
  const state = hostStates.get(host);
  if (!state || state.updateActive) return;
  state.updateActive = true;
  state.activeUpdateRendered = false;
  state.activeLocale = undefined;
  state.activeDirection = undefined;
  state.activeLocaleReadSequence = undefined;
  state.activeDirectionReadSequence = undefined;
}

/** Records that the active update reached Lit's DOM commit rather than being skipped. */
export function markInheritedContextUpdateRendered(host: Element): void {
  const state = hostStates.get(host);
  if (state?.updateActive) state.activeUpdateRendered = true;
}

/** Commits or discards reads staged during one Lit update epoch. */
export function finishInheritedContextUpdate(host: Element): void {
  const state = hostStates.get(host);
  if (!state?.updateActive) return;
  if (state.activeUpdateRendered) {
    if (
      state.activeLocale !== undefined &&
      state.activeLocaleReadSequence !== undefined
    ) {
      state.lastLocale = state.activeLocale;
      state.lastLocaleReadSequence = state.activeLocaleReadSequence;
    }
    if (
      state.activeDirection !== undefined &&
      state.activeDirectionReadSequence !== undefined
    ) {
      state.lastDirection = state.activeDirection;
      state.lastDirectionReadSequence = state.activeDirectionReadSequence;
    }
  }
  state.updateActive = false;
  state.activeUpdateRendered = false;
  state.activeLocale = undefined;
  state.activeDirection = undefined;
  state.activeLocaleReadSequence = undefined;
  state.activeDirectionReadSequence = undefined;
}

/**
 * Captures a direction-sensitive host's rendered baseline before a synchronous host attribute
 * callback invalidates its cache. `slot` additionally changes the flattened ancestor chain.
 */
export function queueInheritedDirectionChange(
  host: Element,
  flattenedTreeChanged = false
): void {
  const subscription = hostSubscriptions.get(host);
  if (!subscription?.active) return;
  queueSubscription(subscription, false, true, flattenedTreeChanged);
}
