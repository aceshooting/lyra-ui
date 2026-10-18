/** One mutation observer per root, with each subscriber receiving only its requested signals. */
export interface InheritedAttributeSubscription {
  readonly attributes: readonly string[];
  readonly childList?: boolean;
  readonly characterData?: boolean;
  readonly changed: (records: MutationRecord[]) => void;
}

/** Callable teardown with an explicit pending-record delivery boundary. */
export interface InheritedAttributeRelease {
  (): void;
  flush(): void;
}

interface SubscriptionSignals {
  readonly attributes: readonly string[];
  readonly childList: boolean;
  readonly characterData: boolean;
}

interface RootHub {
  readonly observer: MutationObserver;
  readonly subscribers: Map<InheritedAttributeSubscription, SubscriptionSignals>;
  readonly attributeOwners: Map<string, number>;
  childListOwners: number;
  characterDataOwners: number;
  readonly target: Node;
}

const hubs = new WeakMap<Node, RootHub>();

function deliver(hub: RootHub, records: MutationRecord[]): void {
  for (const subscriber of [...hub.subscribers.keys()]) {
    if (!hub.subscribers.has(subscriber)) continue;
    const relevant = records.filter((record) =>
      record.type === 'attributes'
        ? subscriber.attributes.includes(record.attributeName ?? '')
        : record.type === 'childList'
          ? subscriber.childList
          : subscriber.characterData,
    );
    if (relevant.length) subscriber.changed(relevant);
  }
}

/** Only changes to the effective signal union require a native observer reconfiguration. */
function updateSignals(hub: RootHub, signals: SubscriptionSignals, delta: 1 | -1): boolean {
  let changed = false;
  for (const attribute of signals.attributes) {
    const previous = hub.attributeOwners.get(attribute) ?? 0;
    const next = previous + delta;
    if (next === 0) hub.attributeOwners.delete(attribute);
    else hub.attributeOwners.set(attribute, next);
    changed ||= (previous === 0) !== (next === 0);
  }
  if (signals.childList) {
    const previous = hub.childListOwners;
    hub.childListOwners += delta;
    changed ||= (previous === 0) !== (hub.childListOwners === 0);
  }
  if (signals.characterData) {
    const previous = hub.characterDataOwners;
    hub.characterDataOwners += delta;
    changed ||= (previous === 0) !== (hub.characterDataOwners === 0);
  }
  return changed;
}

function configure(hub: RootHub): void {
  if (!hub.subscribers.size) return;
  const attributes = [...hub.attributeOwners.keys()];
  hub.observer.observe(hub.target, {
    subtree: true,
    attributes: attributes.length > 0,
    ...(attributes.length ? { attributeFilter: attributes } : {}),
    childList: hub.childListOwners > 0,
    characterData: hub.characterDataOwners > 0,
  });
}

/** A hostile or torn-down owner realm may throw from any observer call; teardown must still finish. */
function safely(run: () => void): void {
  try {
    run();
  } catch {
    // The hub is being discarded or the realm is gone; there is nothing left to release.
  }
}

/** Returns undefined when the root has no live owner realm or cannot be observed. */
export function subscribeInheritedAttributes(
  root: Node,
  Observer: typeof MutationObserver | undefined,
  subscription: InheritedAttributeSubscription,
): InheritedAttributeRelease | undefined {
  if (!Observer) return undefined;
  const target = root.nodeType === 9 ? (root as Document).documentElement : root;
  if (!target) return undefined;
  let hub = hubs.get(root);
  if (!hub) {
    const subscribers = new Map<InheritedAttributeSubscription, SubscriptionSignals>();
    const created: RootHub = {
      subscribers,
      attributeOwners: new Map(),
      childListOwners: 0,
      characterDataOwners: 0,
      target,
      observer: new Observer((records) => deliver(created, records)),
    };
    hub = created;
    hubs.set(root, hub);
  }
  let signals = hub.subscribers.get(subscription);
  const wasEmpty = hub.subscribers.size === 0;
  let added = false;
  try {
    let changed = false;
    if (!signals) {
      signals = {
        attributes: [...new Set(subscription.attributes)],
        childList: Boolean(subscription.childList),
        characterData: Boolean(subscription.characterData),
      };
      hub.subscribers.set(subscription, signals);
      added = true;
      changed = updateSignals(hub, signals, 1);
    }
    if (changed || wasEmpty) configure(hub);
  } catch {
    if (added && signals) {
      hub.subscribers.delete(subscription);
      updateSignals(hub, signals, -1);
    }
    if (!hub.subscribers.size) {
      const failed = hub;
      safely(() => failed.observer.disconnect());
      if (hubs.get(root) === failed) hubs.delete(root);
    }
    return undefined;
  }
  const release = () => {
    const signals = hub?.subscribers.get(subscription);
    if (!hub || !signals) return;
    const owner = hub;
    owner.subscribers.delete(subscription);
    const changed = updateSignals(owner, signals, -1);
    let pending: MutationRecord[] = [];
    safely(() => { pending = owner.observer.takeRecords(); });
    if (pending.length) deliver(owner, pending);
    if (owner.subscribers.size) {
      if (changed) safely(() => configure(owner));
    }
    else {
      safely(() => owner.observer.disconnect());
      // Pending delivery may have retired this hub and created another one for the same root.
      if (hubs.get(root) === owner) hubs.delete(root);
    }
  };
  return Object.assign(release, {
    flush(): void {
      if (!hub?.subscribers.has(subscription)) return;
      let pending: MutationRecord[] = [];
      safely(() => { pending = hub.observer.takeRecords(); });
      if (pending.length) deliver(hub, pending);
    },
  });
}
