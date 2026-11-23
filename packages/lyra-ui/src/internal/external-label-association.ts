/** Structural copy of `form-control-labels.ts`'s subscription contract: importing nothing keeps
 * this module a self-contained lazy chunk instead of splitting its loader's module apart. */
interface AssociationRootSubscription {
  update(labels: readonly HTMLLabelElement[]): void;
  disconnect(): void;
}

/*
 * The indexed external-label association observer. `form-control-labels.ts` loads this module the
 * first time a control in some root has, or may have just gained, an associated `<label>`; until
 * then a root is watched by its much smaller lean observer, which only decides whether a mutation
 * could create an association.
 */

const MAX_ASSOCIATION_CANDIDATES_PER_MUTATION = 2_048;
const MAX_ASSOCIATION_REFRESHES_PER_TASK = 256;

function isLabelElement(node: EventTarget | null): node is HTMLLabelElement {
  return node !== null && (node as Node).nodeType === 1 && (node as Element).localName === 'label';
}

function containingLabel(node: Node): HTMLLabelElement | null {
  const element = node.nodeType === 1 ? node as Element : node.parentElement;
  const label = element?.closest('label') ?? null;
  return isLabelElement(label) ? label : null;
}

interface AssociationSubscription {
  readonly host: HTMLElement;
  readonly listener: () => void;
  id: string;
  implicitLabels: HTMLLabelElement[];
  fallbackGeneration: number;
  active: boolean;
}

interface AssociationRootObservation {
  readonly subscriptions: Set<AssociationSubscription>;
  readonly subscriptionsById: Map<string, Set<AssociationSubscription>>;
  readonly implicitSubscriptionsByLabel: WeakMap<HTMLLabelElement, Set<AssociationSubscription>>;
  readonly subscriptionsByHost: WeakMap<HTMLElement, AssociationSubscription>;
  readonly pending: Set<AssociationSubscription>;
  readonly observer?: MutationObserver;
  readonly ownerWindow: Window | null;
  cancelContinuation?: () => void;
  fallbackIterator?: SetIterator<AssociationSubscription>;
  fallbackGeneration: number;
}

/**
 * One association observer per document/shadow root, shared by every FACE control in that root.
 *
 * `ElementInternals.labels` is live but has no change event. Watching only the labels that are
 * associated *now* cannot discover the first label added later, and cannot see an associated label
 * being removed from its parent. A single root observer closes that platform gap without installing
 * one document-wide observer per control. It wakes subscribers only for mutations that can change
 * label membership or the text of a currently associated label.
 */
const associationRootObservations = new WeakMap<Node, AssociationRootObservation>();

function addSubscriptionById(observation: AssociationRootObservation, subscription: AssociationSubscription): void {
  if (!subscription.id) return;
  const subscribers = observation.subscriptionsById.get(subscription.id) ?? new Set<AssociationSubscription>();
  subscribers.add(subscription);
  observation.subscriptionsById.set(subscription.id, subscribers);
}

function removeSubscriptionById(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
): void {
  if (!subscription.id) return;
  const subscribers = observation.subscriptionsById.get(subscription.id);
  subscribers?.delete(subscription);
  if (subscribers?.size === 0) observation.subscriptionsById.delete(subscription.id);
}

function updateSubscriptionId(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
): void {
  const id = subscription.host.id;
  if (id === subscription.id) return;
  removeSubscriptionById(observation, subscription);
  subscription.id = id;
  addSubscriptionById(observation, subscription);
}

function addImplicitSubscription(
  observation: AssociationRootObservation,
  label: HTMLLabelElement,
  subscription: AssociationSubscription,
): void {
  const subscriptions = observation.implicitSubscriptionsByLabel.get(label) ?? new Set<AssociationSubscription>();
  subscriptions.add(subscription);
  observation.implicitSubscriptionsByLabel.set(label, subscriptions);
}

function removeImplicitSubscription(
  observation: AssociationRootObservation,
  label: HTMLLabelElement,
  subscription: AssociationSubscription,
): void {
  const subscriptions = observation.implicitSubscriptionsByLabel.get(label);
  subscriptions?.delete(subscription);
  if (subscriptions?.size === 0) observation.implicitSubscriptionsByLabel.delete(label);
}

function updateImplicitSubscriptions(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
  labels: readonly HTMLLabelElement[],
): void {
  const next = labels.filter((label) => !label.hasAttribute('for'));
  for (const label of subscription.implicitLabels) {
    if (!next.includes(label)) removeImplicitSubscription(observation, label, subscription);
  }
  for (const label of next) {
    if (!subscription.implicitLabels.includes(label)) {
      addImplicitSubscription(observation, label, subscription);
    }
  }
  subscription.implicitLabels = next;
}

function hasAssociationRefreshes(observation: AssociationRootObservation): boolean {
  return observation.pending.size > 0 || observation.fallbackIterator !== undefined;
}

function cancelAssociationContinuation(observation: AssociationRootObservation): void {
  observation.cancelContinuation?.();
  observation.cancelContinuation = undefined;
}

function scheduleAssociationContinuation(observation: AssociationRootObservation): void {
  if (!hasAssociationRefreshes(observation) || observation.cancelContinuation !== undefined) return;
  const callback = () => {
    observation.cancelContinuation = undefined;
    drainAssociationRefreshes(observation);
  };
  if (observation.ownerWindow) {
    const handle = observation.ownerWindow.setTimeout(callback, 0);
    observation.cancelContinuation = () => observation.ownerWindow?.clearTimeout(handle);
  } else {
    const handle = globalThis.setTimeout(callback, 0);
    observation.cancelContinuation = () => globalThis.clearTimeout(handle);
  }
}

function refreshAssociationSubscription(
  observation: AssociationRootObservation,
  subscription: AssociationSubscription,
): void {
  if (!subscription.active) return;
  subscription.listener();
  if (observation.fallbackIterator) {
    subscription.fallbackGeneration = observation.fallbackGeneration;
  }
}

function drainTargetedAssociationRefreshes(observation: AssociationRootObservation): void {
  let remaining = MAX_ASSOCIATION_REFRESHES_PER_TASK;
  for (const subscription of observation.pending) {
    observation.pending.delete(subscription);
    refreshAssociationSubscription(observation, subscription);
    if (--remaining === 0) break;
  }
  scheduleAssociationContinuation(observation);
}

function drainAssociationRefreshes(observation: AssociationRootObservation): void {
  let remaining = MAX_ASSOCIATION_REFRESHES_PER_TASK;
  for (const subscription of observation.pending) {
    observation.pending.delete(subscription);
    refreshAssociationSubscription(observation, subscription);
    if (--remaining === 0) break;
  }
  while (remaining > 0 && observation.fallbackIterator) {
    const next = observation.fallbackIterator.next();
    if (next.done) {
      observation.fallbackIterator = undefined;
      break;
    }
    if (next.value.active && next.value.fallbackGeneration !== observation.fallbackGeneration) {
      next.value.listener();
      next.value.fallbackGeneration = observation.fallbackGeneration;
    }
    remaining--;
  }
  scheduleAssociationContinuation(observation);
}

function notifyAssociationSubscriptions(
  observation: AssociationRootObservation,
  subscriptions: Iterable<AssociationSubscription>,
  fallbackAll = false,
): void {
  if (fallbackAll) {
    const continuationPending = observation.cancelContinuation !== undefined;
    observation.pending.clear();
    observation.fallbackGeneration++;
    observation.fallbackIterator = observation.subscriptions.values();
    for (const subscription of subscriptions) {
      if (subscription.active) observation.pending.add(subscription);
    }
    if (continuationPending) drainTargetedAssociationRefreshes(observation);
    else drainAssociationRefreshes(observation);
    return;
  }
  for (const subscription of subscriptions) {
    if (subscription.active) observation.pending.add(subscription);
  }
  // Mutation observers registered later in the same root must see the refreshed accessible name.
  // A continuation may already be draining a conservative all-control fallback, but a small,
  // precisely indexed mutation remains synchronous and is marked so that fallback will not read
  // the same control twice.
  drainTargetedAssociationRefreshes(observation);
}

interface AssociationCandidates {
  readonly ids: Set<string>;
  readonly implicitLabels: Set<HTMLLabelElement>;
  truncated: boolean;
  work: number;
}

function isLabelableElement(element: Element): boolean {
  if (element.localName === 'input') return (element as HTMLInputElement).type !== 'hidden';
  if (
    element.localName === 'button' ||
    element.localName === 'meter' ||
    element.localName === 'output' ||
    element.localName === 'progress' ||
    element.localName === 'select' ||
    element.localName === 'textarea'
  ) {
    return true;
  }
  return (
    element.localName.includes('-') && (element.constructor as { formAssociated?: boolean }).formAssociated === true
  );
}

function collectAssociationElement(element: Element, result: AssociationCandidates): boolean {
  const id = element.getAttribute('id');
  if (id) result.ids.add(id);
  if (isLabelElement(element) && element.hasAttribute('for')) {
    if (element.htmlFor) result.ids.add(element.htmlFor);
  }
  return isLabelableElement(element);
}

/** Returns the next node in a subtree without allocating a walker or a descendant array. */
function nextAssociationNode(root: Node, current: Node): Node | null {
  if (current.firstChild) return current.firstChild;
  let cursor: Node | null = current;
  while (cursor && cursor !== root) {
    if (cursor.nextSibling) return cursor.nextSibling;
    cursor = cursor.parentNode;
  }
  return null;
}

function collectAssociationCandidates(node: Node, result: AssociationCandidates): boolean {
  let containsLabelable = false;
  let current: Node | null = node;
  while (current) {
    if (result.work >= MAX_ASSOCIATION_CANDIDATES_PER_MUTATION) {
      result.truncated = true;
      break;
    }
    result.work++;
    if (current.nodeType === 1) {
      containsLabelable = collectAssociationElement(current as Element, result) || containsLabelable;
    }
    current = nextAssociationNode(node, current);
  }
  return containsLabelable;
}

function containingImplicitLabel(node: Node): HTMLLabelElement | null {
  const label = containingLabel(node);
  return label && !label.hasAttribute('for') ? label : null;
}

function collectFirstImplicitSubscription(
  observation: AssociationRootObservation,
  label: HTMLLabelElement,
  candidates: AssociationCandidates,
  affected: Set<AssociationSubscription>,
): void {
  let current: Node | null = label.firstChild;
  while (current) {
    if (candidates.work >= MAX_ASSOCIATION_CANDIDATES_PER_MUTATION) {
      candidates.truncated = true;
      return;
    }
    candidates.work++;
    if (
      current.nodeType === 1 &&
      (isLabelableElement(current as Element) ||
        observation.subscriptionsByHost.has(current as HTMLElement))
    ) {
      const subscription = observation.subscriptionsByHost.get(current as HTMLElement);
      if (subscription) affected.add(subscription);
      return;
    }
    current = nextAssociationNode(label, current);
  }
}

function affectedAssociationSubscriptions(
  observation: AssociationRootObservation,
  mutations: readonly MutationRecord[],
): { readonly subscriptions: Set<AssociationSubscription>; readonly fallbackAll: boolean } {
  const affected = new Set<AssociationSubscription>();
  const candidates: AssociationCandidates = {
    ids: new Set<string>(),
    implicitLabels: new Set<HTMLLabelElement>(),
    truncated: false,
    work: 0,
  };

  const addIndexedCandidates = (): void => {
    for (const id of candidates.ids) {
      for (const subscription of observation.subscriptionsById.get(id) ?? []) affected.add(subscription);
    }
    for (const label of candidates.implicitLabels) {
      for (const subscription of observation.implicitSubscriptionsByLabel.get(label) ?? []) {
        affected.add(subscription);
      }
    }
  };

  for (const mutation of mutations) {
    if (candidates.work >= MAX_ASSOCIATION_CANDIDATES_PER_MUTATION) {
      candidates.truncated = true;
      break;
    }
    candidates.work++;
    const label = containingLabel(mutation.target);
    if (label) {
      if (label.hasAttribute('for')) {
        if (label.htmlFor) candidates.ids.add(label.htmlFor);
      } else {
        candidates.implicitLabels.add(label);
      }
    }
    if (mutation.type === 'characterData') continue;
    if (mutation.type === 'attributes') {
      const target = mutation.target as Element;
      if (mutation.attributeName === 'id') {
        const oldId = mutation.oldValue ?? '';
        const id = target.getAttribute('id') ?? '';
        if (oldId) candidates.ids.add(oldId);
        if (id) candidates.ids.add(id);
        const hostSubscription = observation.subscriptionsByHost.get(target as HTMLElement);
        if (hostSubscription) {
          affected.add(hostSubscription);
          updateSubscriptionId(observation, hostSubscription);
        }
      } else if (mutation.attributeName === 'for' && isLabelElement(target)) {
        const oldFor = mutation.oldValue;
        if (oldFor) candidates.ids.add(oldFor);
        if (target.htmlFor) candidates.ids.add(target.htmlFor);
        for (const subscription of observation.implicitSubscriptionsByLabel.get(target) ?? []) {
          affected.add(subscription);
        }
        if (!target.hasAttribute('for')) candidates.implicitLabels.add(target);
      } else if (mutation.attributeName === 'type' && target.localName === 'input') {
        const label = containingImplicitLabel(target);
        if (label) candidates.implicitLabels.add(label);
      }
      continue;
    }
    let changedLabelableShape = false;
    for (const node of mutation.addedNodes) {
      changedLabelableShape = collectAssociationCandidates(node, candidates) || changedLabelableShape;
      if (candidates.truncated) break;
    }
    if (!candidates.truncated) {
      for (const node of mutation.removedNodes) {
        changedLabelableShape = collectAssociationCandidates(node, candidates) || changedLabelableShape;
        if (candidates.truncated) break;
      }
    }
    if (changedLabelableShape) {
      const label = containingImplicitLabel(mutation.target);
      if (label) candidates.implicitLabels.add(label);
    }
    if (candidates.truncated) break;
  }

  addIndexedCandidates();
  if (candidates.truncated) return { subscriptions: affected, fallbackAll: true };
  for (const label of candidates.implicitLabels) {
    collectFirstImplicitSubscription(observation, label, candidates, affected);
    if (candidates.truncated) return { subscriptions: affected, fallbackAll: true };
  }
  return { subscriptions: affected, fallbackAll: false };
}

/** Subscribes one control to the shared, root-indexed external-label association observer. */
export function observeIndexedLabelAssociations(
  host: HTMLElement,
  listener: () => void,
): AssociationRootSubscription {
  const root = host.getRootNode();
  let observation = associationRootObservations.get(root);
  if (!observation) {
    const Observer = host.ownerDocument.defaultView?.MutationObserver;
    const subscriptions = new Set<AssociationSubscription>();
    const subscriptionsById = new Map<string, Set<AssociationSubscription>>();
    const implicitSubscriptionsByLabel = new WeakMap<HTMLLabelElement, Set<AssociationSubscription>>();
    const subscriptionsByHost = new WeakMap<HTMLElement, AssociationSubscription>();
    const pending = new Set<AssociationSubscription>();
    const holder: { observation?: AssociationRootObservation } = {};
    const observer = Observer === undefined
      ? undefined
      : new Observer((mutations) => {
          const current = holder.observation;
          if (!current) return;
          const affected = affectedAssociationSubscriptions(current, mutations);
          notifyAssociationSubscriptions(current, affected.subscriptions, affected.fallbackAll);
        });
    observer?.observe(root, {
      attributes: true,
      attributeFilter: ['for', 'id', 'type'],
      attributeOldValue: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    observation = {
      subscriptions,
      subscriptionsById,
      implicitSubscriptionsByLabel,
      subscriptionsByHost,
      pending,
      observer,
      ownerWindow: host.ownerDocument.defaultView,
      fallbackGeneration: 0,
    };
    holder.observation = observation;
    associationRootObservations.set(root, observation);
  }
  const subscription: AssociationSubscription = {
    host,
    listener,
    id: host.id,
    implicitLabels: [],
    fallbackGeneration: -1,
    active: true,
  };
  observation.subscriptions.add(subscription);
  observation.subscriptionsByHost.set(host, subscription);
  addSubscriptionById(observation, subscription);
  return {
    update(labels) {
      if (!subscription.active) return;
      updateSubscriptionId(observation!, subscription);
      updateImplicitSubscriptions(observation!, subscription, labels);
    },
    disconnect() {
      if (!subscription.active) return;
      subscription.active = false;
      observation!.pending.delete(subscription);
      observation!.subscriptions.delete(subscription);
      observation!.subscriptionsByHost.delete(host);
      for (const label of subscription.implicitLabels) {
        removeImplicitSubscription(observation!, label, subscription);
      }
      subscription.implicitLabels = [];
      removeSubscriptionById(observation!, subscription);
      const current = associationRootObservations.get(root);
      if (!current || current.subscriptions.size > 0) return;
      current.observer?.disconnect();
      cancelAssociationContinuation(current);
      current.pending.clear();
      current.fallbackIterator = undefined;
      associationRootObservations.delete(root);
    },
  };
}

/**
 * Replays the records a root's lean observer collected while this module loaded, through the same
 * targeted refresh an indexed root performs for a live mutation batch. `overflow` means records
 * were dropped beyond the lean buffer bound, so every control in the root is refreshed instead.
 */
export function replayIndexedLabelAssociations(
  root: Node,
  records: readonly MutationRecord[],
  overflow: boolean,
): void {
  const observation = associationRootObservations.get(root);
  if (!observation || (records.length === 0 && !overflow)) return;
  const affected = affectedAssociationSubscriptions(observation, records);
  notifyAssociationSubscriptions(observation, affected.subscriptions, affected.fallbackAll || overflow);
}
