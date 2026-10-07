/** One mutation observer per root, with each subscriber receiving only its requested signals. */
export interface InheritedAttributeSubscription {
  readonly attributes: readonly string[];
  readonly childList?: boolean;
  readonly characterData?: boolean;
  readonly changed: (records: MutationRecord[]) => void;
}

interface RootHub {
  readonly observer: MutationObserver;
  readonly subscribers: Set<InheritedAttributeSubscription>;
  readonly target: Node;
}

const hubs = new WeakMap<Node, RootHub>();

function deliver(hub: RootHub, records: MutationRecord[]): void {
  for (const subscriber of [...hub.subscribers]) {
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

function configure(hub: RootHub): void {
  const subscribers = [...hub.subscribers];
  if (!subscribers.length) return;
  const attributes = [...new Set(subscribers.flatMap((item) => item.attributes))];
  hub.observer.observe(hub.target, {
    subtree: true,
    attributes: attributes.length > 0,
    ...(attributes.length ? { attributeFilter: attributes } : {}),
    childList: subscribers.some((item) => item.childList),
    characterData: subscribers.some((item) => item.characterData),
  });
}

/** Returns undefined when the root has no live owner realm or cannot be observed. */
export function subscribeInheritedAttributes(
  root: Node,
  Observer: typeof MutationObserver | undefined,
  subscription: InheritedAttributeSubscription,
): (() => void) | undefined {
  if (!Observer) return undefined;
  const target = root.nodeType === 9 ? (root as Document).documentElement : root;
  if (!target) return undefined;
  let hub = hubs.get(root);
  if (!hub) {
    const subscribers = new Set<InheritedAttributeSubscription>();
    const created: RootHub = {
      subscribers,
      target,
      observer: new Observer((records) => deliver(created, records)),
    };
    hub = created;
    hubs.set(root, hub);
  }
  hub.subscribers.add(subscription);
  try {
    configure(hub);
  } catch {
    hub.subscribers.delete(subscription);
    if (!hub.subscribers.size) {
      hub.observer.disconnect();
      hubs.delete(root);
    }
    return undefined;
  }
  return () => {
    if (!hub?.subscribers.delete(subscription)) return;
    const pending = hub.observer.takeRecords();
    if (pending.length) deliver(hub, pending);
    if (hub.subscribers.size) configure(hub);
    else {
      hub.observer.disconnect();
      hubs.delete(root);
    }
  };
}
