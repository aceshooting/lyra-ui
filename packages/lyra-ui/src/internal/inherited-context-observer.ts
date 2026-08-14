import {
  invalidateLyraLocaleCache,
  peekLyraDirection,
  peekLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
} from './localization-runtime.js';

const INHERITED_CONTEXT_ATTRIBUTES = ['locale', 'lang', 'dir', 'class', 'style'] as const;
const STYLE_DIRECTION_PATTERN = /(?:^|[;\s])direction\s*:\s*([^;]+)/i;

interface InheritedContextHost extends Element {
  readonly isConnected: boolean;
  requestUpdate(): unknown;
}

interface RootObservation {
  readonly root: Node;
  readonly observer: MutationObserver;
  readonly localeSubscribers: WeakMap<Element, Set<InheritedContextSubscription>>;
  readonly directionSubscribers: WeakMap<Element, Set<InheritedContextSubscription>>;
  subscriberCount: number;
}

interface RootBinding {
  readonly observation: RootObservation;
  readonly ancestors: readonly Element[];
}

interface InheritedContextSubscription {
  readonly host: InheritedContextHost;
  readonly bindings: readonly RootBinding[];
  active: boolean;
  localeSensitive: boolean;
  directionSensitive: boolean;
  lastLocale?: string;
  lastDirection?: 'ltr' | 'rtl';
  recheckLocale: boolean;
  recheckDirection: boolean;
}

const rootObservations = new WeakMap<Node, RootObservation>();
const hostSubscriptions = new WeakMap<Element, InheritedContextSubscription>();
const pendingSubscriptions = new Set<InheritedContextSubscription>();
let flushQueued = false;

function styleDirectionDeclaration(styleText: string): string | undefined {
  return STYLE_DIRECTION_PATTERN.exec(styleText)?.[1]?.trim();
}

function composedParentElement(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  const candidate = (root as { nodeType?: number; host?: unknown }).host;
  return root.nodeType === 11 && candidate !== null && typeof candidate === 'object' &&
    typeof (candidate as Element).getAttribute === 'function'
    ? candidate as Element
    : null;
}

function observationTarget(root: Node): Node | null {
  if (root.nodeType === 9) return (root as Document).documentElement;
  return root.nodeType === 11 ? root : null;
}

function queueSubscription(
  subscription: InheritedContextSubscription,
  locale: boolean,
  direction: boolean,
): void {
  if (!subscription.active || !subscription.host.isConnected) return;
  subscription.recheckLocale ||= locale;
  subscription.recheckDirection ||= direction;
  pendingSubscriptions.add(subscription);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(flushInheritedContextChanges);
}

function flushInheritedContextChanges(): void {
  flushQueued = false;
  const pending = [...pendingSubscriptions];
  pendingSubscriptions.clear();
  for (const subscription of pending) {
    const checkLocale = subscription.recheckLocale;
    const checkDirection = subscription.recheckDirection;
    subscription.recheckLocale = false;
    subscription.recheckDirection = false;
    if (!subscription.active || !subscription.host.isConnected) continue;

    if (checkLocale) subscription.lastLocale ??= peekLyraLocale(subscription.host);
    if (checkDirection) subscription.lastDirection ??= peekLyraDirection(subscription.host);
    const previousLocale = subscription.lastLocale;
    const previousDirection = subscription.lastDirection;
    if (previousLocale === undefined && previousDirection === undefined) continue;

    invalidateLyraLocaleCache(subscription.host);
    let changed = false;
    if (checkLocale && previousLocale !== undefined) {
      const locale = resolveLyraLocale(subscription.host);
      subscription.lastLocale = locale;
      changed ||= locale !== previousLocale;
    }
    if (checkDirection && previousDirection !== undefined) {
      const direction = resolveLyraDirection(subscription.host);
      subscription.lastDirection = direction;
      changed ||= direction !== previousDirection;
    }
    if (changed) subscription.host.requestUpdate();
  }
}

function subscribersFor(
  map: WeakMap<Element, Set<InheritedContextSubscription>>,
  target: Element,
): ReadonlySet<InheritedContextSubscription> | undefined {
  return map.get(target);
}

function createRootObservation(root: Node, Observer: typeof MutationObserver): RootObservation | undefined {
  const target = observationTarget(root);
  if (!target) return undefined;
  const localeSubscribers = new WeakMap<Element, Set<InheritedContextSubscription>>();
  const directionSubscribers = new WeakMap<Element, Set<InheritedContextSubscription>>();
  const observer = new Observer((records) => {
    for (const record of records) {
      if (
        record.type !== 'attributes' ||
        (record.target as { nodeType?: number }).nodeType !== 1 ||
        typeof (record.target as Element).getAttribute !== 'function'
      ) continue;
      const target = record.target as Element;
      const attribute = record.attributeName;
      if (attribute === 'locale' || attribute === 'lang') {
        for (const subscription of subscribersFor(localeSubscribers, target) ?? []) {
          queueSubscription(subscription, true, false);
        }
      }
      let directionRelevant = attribute === 'dir' || attribute === 'class';
      if (attribute === 'style') {
        directionRelevant = styleDirectionDeclaration(record.oldValue ?? '') !==
          styleDirectionDeclaration(target.getAttribute('style') ?? '');
      }
      if (directionRelevant) {
        for (const subscription of subscribersFor(directionSubscribers, target) ?? []) {
          queueSubscription(subscription, false, true);
        }
      }
    }
  });
  observer.observe(target, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [...INHERITED_CONTEXT_ATTRIBUTES],
  });
  const observation: RootObservation = {
    root,
    observer,
    localeSubscribers,
    directionSubscribers,
    subscriberCount: 0,
  };
  rootObservations.set(root, observation);
  return observation;
}

function rootBindings(host: InheritedContextHost): RootBinding[] {
  const byRoot = new Map<Node, Element[]>();
  let ancestor = composedParentElement(host);
  while (ancestor) {
    const root = ancestor.getRootNode();
    const group = byRoot.get(root) ?? [];
    group.push(ancestor);
    byRoot.set(root, group);
    ancestor = composedParentElement(ancestor);
  }

  const Observer = host.ownerDocument.defaultView?.MutationObserver;
  if (!Observer) return [];
  const bindings: RootBinding[] = [];
  for (const [root, ancestors] of byRoot) {
    const observation = rootObservations.get(root) ?? createRootObservation(root, Observer);
    if (!observation) continue;
    observation.subscriberCount++;
    bindings.push({ observation, ancestors });
  }
  return bindings;
}

function addToMap(
  map: WeakMap<Element, Set<InheritedContextSubscription>>,
  ancestor: Element,
  subscription: InheritedContextSubscription,
): void {
  const subscribers = map.get(ancestor) ?? new Set<InheritedContextSubscription>();
  subscribers.add(subscription);
  map.set(ancestor, subscribers);
}

function removeFromMap(
  map: WeakMap<Element, Set<InheritedContextSubscription>>,
  ancestor: Element,
  subscription: InheritedContextSubscription,
): void {
  const subscribers = map.get(ancestor);
  subscribers?.delete(subscription);
  if (subscribers?.size === 0) map.delete(ancestor);
}

function activate(
  subscription: InheritedContextSubscription,
  kind: 'locale' | 'direction',
): void {
  const active = kind === 'locale' ? subscription.localeSensitive : subscription.directionSensitive;
  if (active) return;
  if (kind === 'locale') subscription.localeSensitive = true;
  else subscription.directionSensitive = true;
  for (const { observation, ancestors } of subscription.bindings) {
    const map = kind === 'locale' ? observation.localeSubscribers : observation.directionSubscribers;
    for (const ancestor of ancestors) addToMap(map, ancestor, subscription);
  }
}

/**
 * Enrolls one connected Lyra host in the shared per-tree inherited-context observers. Observation
 * stays dormant until the host actually consumes locale or direction, so passive descendants do
 * not turn an unrelated ancestor class mutation into synchronous style reads.
 */
export function observeInheritedContext(host: InheritedContextHost): () => void {
  const previous = hostSubscriptions.get(host);
  if (previous?.active) stopInheritedContextObservation(previous);
  const subscription: InheritedContextSubscription = {
    host,
    bindings: rootBindings(host),
    active: true,
    localeSensitive: false,
    directionSensitive: false,
    recheckLocale: false,
    recheckDirection: false,
  };
  hostSubscriptions.set(host, subscription);
  return () => stopInheritedContextObservation(subscription);
}

function stopInheritedContextObservation(subscription: InheritedContextSubscription): void {
  if (!subscription.active) return;
  subscription.active = false;
  pendingSubscriptions.delete(subscription);
  for (const { observation, ancestors } of subscription.bindings) {
    for (const ancestor of ancestors) {
      removeFromMap(observation.localeSubscribers, ancestor, subscription);
      removeFromMap(observation.directionSubscribers, ancestor, subscription);
    }
    observation.subscriberCount--;
    if (observation.subscriberCount === 0) {
      observation.observer.disconnect();
      rootObservations.delete(observation.root);
    }
  }
  if (hostSubscriptions.get(subscription.host) === subscription) hostSubscriptions.delete(subscription.host);
}

/** Records that a connected host's rendered output consumed inherited locale. */
export function recordInheritedLocaleRead(host: Element, locale: string | undefined): void {
  const subscription = hostSubscriptions.get(host);
  if (!subscription?.active || locale === undefined) return;
  activate(subscription, 'locale');
  subscription.lastLocale = locale;
}

/** Records that a connected host's rendered output consumed inherited CSS direction. */
export function recordInheritedDirectionRead(host: Element, direction: 'ltr' | 'rtl'): void {
  const subscription = hostSubscriptions.get(host);
  if (!subscription?.active) return;
  activate(subscription, 'direction');
  subscription.lastDirection = direction;
}
