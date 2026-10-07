import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { flattenedThemeParent, THEME_ATTRIBUTES } from './theme-observation.js';

export type LyraThemeRoot = Document | ShadowRoot | Element;

type BrowserRealm = Window & typeof globalThis;
type ThemeSubscriber = (mutationSubject?: unknown) => void;
type ObservedRoot = Document | ShadowRoot;
type MatchMedia = (query: string) => MediaQueryList;

interface RealmPatch {
  target: object;
  key: PropertyKey;
  original: PropertyDescriptor;
  installedValue?: unknown;
  installedSetter?: ((this: unknown, value: unknown) => void) | undefined;
}

interface SharedThemeHub {
  schemaVersion: 1;
  subscribers: Set<ThemeSubscriber>;
  patches: RealmPatch[];
  installed: boolean;
  realm: BrowserRealm;
}

const THEME_HUB_KEY = Symbol.for('@aceshooting/lyra-ui.theme-invalidation.v1');
const fallbackHubs = new WeakMap<object, SharedThemeHub>();
const ELEMENT_NODE = 1;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;
const BASE_MEDIA_QUERIES = [
  '(prefers-color-scheme: dark)',
  '(prefers-contrast: more)',
  '(forced-colors: active)',
];
const OBSERVED_MUTATIONS: MutationObserverInit = {
  attributes: true,
  attributeFilter: [...THEME_ATTRIBUTES, 'media', 'href', 'rel', 'disabled'],
  childList: true,
  characterData: true,
  subtree: true,
};

function realmFor(root?: LyraThemeRoot): BrowserRealm | undefined {
  const fallbackDocument = typeof document === 'undefined' ? undefined : document;
  const ownerDocument = root
    ? root.nodeType === DOCUMENT_NODE
      ? (root as Document)
      : root.ownerDocument
    : fallbackDocument;
  return ownerDocument?.defaultView as BrowserRealm | undefined;
}

function createHub(realm: BrowserRealm): SharedThemeHub {
  return {
    schemaVersion: 1,
    subscribers: new Set(),
    patches: [],
    installed: false,
    realm,
  };
}

function hubFor(realm: BrowserRealm): SharedThemeHub {
  const scope = realm as unknown as Record<PropertyKey, unknown>;
  const existing = scope[THEME_HUB_KEY];
  if (
    existing &&
    typeof existing === 'object' &&
    (existing as Partial<SharedThemeHub>).schemaVersion === 1 &&
    (existing as Partial<SharedThemeHub>).subscribers instanceof Set &&
    Array.isArray((existing as Partial<SharedThemeHub>).patches) &&
    (existing as Partial<SharedThemeHub>).realm === realm
  ) {
    return existing as SharedThemeHub;
  }
  const hub = createHub(realm);
  try {
    Object.defineProperty(scope, THEME_HUB_KEY, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: hub,
    });
    return hub;
  } catch {
    const fallback = fallbackHubs.get(realm);
    if (fallback) return fallback;
    fallbackHubs.set(realm, hub);
    return hub;
  }
}

function notifyHub(hub: SharedThemeHub, mutationSubject?: unknown): void {
  for (const subscriber of [...hub.subscribers]) subscriber(mutationSubject);
}

function findPropertyOwner(start: object | null, key: PropertyKey): object | undefined {
  let current = start;
  while (current) {
    if (Object.prototype.hasOwnProperty.call(current, key)) return current;
    current = Object.getPrototypeOf(current) as object | null;
  }
  return undefined;
}

function patchMethod(hub: SharedThemeHub, target: object, key: PropertyKey, asyncResult = false): void {
  const original = Object.getOwnPropertyDescriptor(target, key);
  if (!original || typeof original.value !== 'function') return;
  const originalMethod = original.value as (...args: unknown[]) => unknown;
  const installedValue = function (this: unknown, ...args: unknown[]): unknown {
    const mutationSubject = this;
    const result = Reflect.apply(originalMethod, this, args);
    if (asyncResult && result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).then(
        () => notifyHub(hub, mutationSubject),
        () => undefined,
      );
    } else {
      notifyHub(hub, mutationSubject);
    }
    return result;
  };
  try {
    Object.defineProperty(target, key, { ...original, value: installedValue });
    hub.patches.push({ target, key, original, installedValue });
  } catch {
    // A locked-down realm may make platform prototypes non-writable. DOM/style-node observation
    // and explicit invalidateLyraTheme() remain available in that environment.
  }
}

function patchAdoptedStyleSheets(hub: SharedThemeHub, prototype: object | undefined): void {
  if (!prototype) return;
  const target = findPropertyOwner(prototype, 'adoptedStyleSheets');
  if (!target) return;
  const original = Object.getOwnPropertyDescriptor(target, 'adoptedStyleSheets');
  if (!original?.set) return;
  const originalSetter = original.set;
  const installedSetter = function (this: unknown, value: unknown): void {
    Reflect.apply(originalSetter, this, [value]);
    notifyHub(hub, this);
  };
  try {
    Object.defineProperty(target, 'adoptedStyleSheets', { ...original, set: installedSetter });
    hub.patches.push({
      target,
      key: 'adoptedStyleSheets',
      original,
      installedSetter,
    });
  } catch {
    // See patchMethod(): the explicit API remains the fallback for sealed platform prototypes.
  }
}

function patchSetter(hub: SharedThemeHub, prototype: object | undefined, key: PropertyKey): void {
  if (!prototype) return;
  const target = findPropertyOwner(prototype, key);
  if (!target) return;
  const original = Object.getOwnPropertyDescriptor(target, key);
  if (!original?.set) return;
  const originalSetter = original.set;
  const installedSetter = function (this: unknown, value: unknown): void {
    Reflect.apply(originalSetter, this, [value]);
    notifyHub(hub, this);
  };
  try {
    Object.defineProperty(target, key, { ...original, set: installedSetter });
    hub.patches.push({ target, key, original, installedSetter });
  } catch {
    // See patchMethod(): the explicit API remains the fallback for sealed platform prototypes.
  }
}

function installRealmInstrumentation(hub: SharedThemeHub): void {
  if (hub.installed) return;
  hub.installed = true;
  const sheetPrototype = hub.realm.CSSStyleSheet?.prototype;
  if (sheetPrototype) {
    for (const method of ['insertRule', 'deleteRule', 'replaceSync', 'addRule', 'removeRule']) {
      patchMethod(hub, sheetPrototype, method);
    }
    patchMethod(hub, sheetPrototype, 'replace', true);
    patchSetter(hub, sheetPrototype, 'disabled');
  }
  const groupingPrototype = (
    hub.realm as unknown as { CSSGroupingRule?: { prototype: object } }
  ).CSSGroupingRule?.prototype;
  if (groupingPrototype) {
    patchMethod(hub, groupingPrototype, 'insertRule');
    patchMethod(hub, groupingPrototype, 'deleteRule');
  }
  const declarationPrototype = hub.realm.CSSStyleDeclaration?.prototype;
  if (declarationPrototype) {
    patchMethod(hub, declarationPrototype, 'setProperty');
    patchMethod(hub, declarationPrototype, 'removeProperty');
    patchSetter(hub, declarationPrototype, 'cssText');
  }
  const mediaListPrototype = hub.realm.MediaList?.prototype;
  if (mediaListPrototype) {
    patchMethod(hub, mediaListPrototype, 'appendMedium');
    patchMethod(hub, mediaListPrototype, 'deleteMedium');
    patchSetter(hub, mediaListPrototype, 'mediaText');
  }
  patchAdoptedStyleSheets(hub, hub.realm.Document?.prototype);
  patchAdoptedStyleSheets(hub, hub.realm.ShadowRoot?.prototype);
}

function uninstallRealmInstrumentation(hub: SharedThemeHub): void {
  if (!hub.installed) return;
  for (const patch of hub.patches.reverse()) {
    const current = Object.getOwnPropertyDescriptor(patch.target, patch.key);
    const stillOurs = patch.installedValue
      ? current?.value === patch.installedValue
      : current?.set === patch.installedSetter;
    if (!stillOurs) continue;
    try {
      Object.defineProperty(patch.target, patch.key, patch.original);
    } catch {
      // If another runtime locked a descriptor after installation, leaving the shared wrapper in
      // place is safe: it only reads the now-empty subscriber set and retains no document/sheet.
    }
  }
  hub.patches = [];
  hub.installed = false;
}

function subscribeRealm(realm: BrowserRealm, subscriber: ThemeSubscriber): () => void {
  const hub = hubFor(realm);
  if (hub.subscribers.size === 0) installRealmInstrumentation(hub);
  hub.subscribers.add(subscriber);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    hub.subscribers.delete(subscriber);
    if (hub.subscribers.size === 0) uninstallRealmInstrumentation(hub);
  };
}

/**
 * Explicitly invalidates computed Lyra theme values in a document realm. This is useful after a
 * host application's theme system mutates styling through a mechanism the platform cannot
 * observe. It is a no-op during server rendering.
 */
export function invalidateLyraTheme(root?: LyraThemeRoot): void {
  const realm = realmFor(root);
  if (!realm) return;
  notifyHub(hubFor(realm));
}

function isStyleCarrier(node: Node): node is HTMLStyleElement | HTMLLinkElement {
  return node.nodeType === ELEMENT_NODE &&
    ((node as Element).localName === 'style' || (node as Element).localName === 'link');
}

function containsStyleCarrier(node: Node): boolean {
  if (isStyleCarrier(node)) return true;
  return node.nodeType === ELEMENT_NODE && Boolean((node as Element).querySelector('style, link'));
}

function containsSlot(node: Node): boolean {
  return node.nodeType === ELEMENT_NODE &&
    ((node as Element).localName === 'slot' || Boolean((node as Element).querySelector('slot')));
}

function someNode(nodes: NodeList, predicate: (node: Node) => boolean): boolean {
  for (let index = 0; index < nodes.length; index += 1) if (predicate(nodes[index]!)) return true;
  return false;
}

function sameNodes(left: readonly object[], right: readonly object[]): boolean {
  return left.length === right.length && left.every((node, index) => node === right[index]);
}

/**
 * The host's flattened ancestry (the host first) and every root whose styles or theme attributes
 * can reach it: the document, the host's own shadow root (its `:host` rules and adopted sheets),
 * and each shadow root that contains an element of that ancestry.
 */
function flattenedPath(host: Element): [Element[], ObservedRoot[]] {
  const chain: Element[] = [];
  const roots = new Set<ObservedRoot>([host.ownerDocument]);
  if (host.shadowRoot) roots.add(host.shadowRoot);
  const seen = new Set<Element>();
  for (let current: Element | null = host; current && !seen.has(current); current = flattenedThemeParent(current)) {
    seen.add(current);
    chain.push(current);
    const root = current.getRootNode();
    if (root.nodeType === DOCUMENT_FRAGMENT_NODE && 'host' in root) roots.add(root as ShadowRoot);
  }
  return [chain, [...roots]];
}

function sheetsForRoot(root: ObservedRoot): CSSStyleSheet[] {
  const sheets = new Set<CSSStyleSheet>();
  if (root.nodeType === DOCUMENT_NODE) {
    for (const sheet of Array.from((root as Document).styleSheets)) sheets.add(sheet as CSSStyleSheet);
  } else {
    for (const node of Array.from((root as ShadowRoot).querySelectorAll('style, link'))) {
      const sheet = (node as HTMLStyleElement | HTMLLinkElement).sheet;
      if (sheet) sheets.add(sheet as CSSStyleSheet);
    }
  }
  for (const sheet of root.adoptedStyleSheets ?? []) sheets.add(sheet);
  return [...sheets];
}

function collectMediaQueries(rules: CSSRuleList, output: Set<string>): void {
  for (const rule of Array.from(rules)) {
    if ('media' in rule) {
      const mediaText = (rule as CSSMediaRule | CSSImportRule).media?.mediaText?.trim();
      if (mediaText) output.add(mediaText);
    }
    if ('cssRules' in rule) {
      try {
        collectMediaQueries((rule as CSSGroupingRule).cssRules, output);
      } catch {
        // Cross-origin imports expose the parent rule but not their nested rule list.
      }
    }
  }
}

function rulesContainMediaList(rules: CSSRuleList, target: MediaList): boolean {
  for (const rule of Array.from(rules)) {
    if ('media' in rule && (rule as CSSMediaRule | CSSImportRule).media === target) return true;
    if ('cssRules' in rule) {
      try {
        if (rulesContainMediaList((rule as CSSGroupingRule).cssRules, target)) return true;
      } catch {
        // Opaque nested rules cannot expose an identity to match. Explicit invalidation remains
        // the fallback for cross-origin CSSOM changes the browser does not surface.
      }
    }
  }
  return false;
}

/** One connected watcher: its flattened ancestry, observed roots and media-query subscriptions. */
interface ThemeBinding {
  readonly registry: ThemeRegistry;
  readonly host: Element;
  readonly onChange: () => void;
  readonly additionalMediaQueries: readonly string[];
  chain: Element[];
  /** The last ancestry the host rendered under: an unslotted child of a shadow host renders nothing. */
  rendered?: Element[];
  roots: ObservedRoot[];
  readonly media: Map<string, MediaSubscription>;
  queued: boolean;
  mediaQueriesDirty: boolean;
  active: boolean;
}

/** One MutationObserver, load and slotchange listener per root, shared by its watchers. */
interface RootObservation {
  readonly root: ObservedRoot;
  readonly bindings: Set<ThemeBinding>;
  observer?: MutationObserver;
  /** Media queries this root's stylesheets declare; cleared whenever those stylesheets change. */
  mediaQueries?: ReadonlySet<string>;
  rebindQueued: boolean;
  readonly onLoad: (event: Event) => void;
  readonly onSlotChange: () => void;
}

/** One MediaQueryList and change listener per query text, shared by the watchers that need it. */
interface MediaSubscription {
  readonly text: string;
  readonly query: MediaQueryList;
  readonly bindings: Set<ThemeBinding>;
  readonly owner: Map<string, MediaSubscription>;
  readonly onChange: () => void;
}

/**
 * Per-realm observation state. Every platform signal is classified once here and delivered only
 * to the watchers it can reach, so the cost of a page mutation does not grow with the number of
 * theme-aware components.
 */
interface ThemeRegistry {
  readonly realm: BrowserRealm;
  readonly bindings: Set<ThemeBinding>;
  readonly roots: Map<ObservedRoot, RootObservation>;
  /** Flattened-tree ancestor (each host included) -> the watchers whose host it styles. */
  readonly ancestors: WeakMap<Element, Set<ThemeBinding>>;
  /** Keyed by the realm's `matchMedia` so a replaced implementation is never served stale lists. */
  readonly media: WeakMap<MatchMedia, Map<string, MediaSubscription>>;
  unsubscribeHub?: () => void;
}

const registries = new WeakMap<BrowserRealm, ThemeRegistry>();

function registryFor(realm: BrowserRealm): ThemeRegistry {
  let registry = registries.get(realm);
  if (!registry) {
    registry = {
      realm,
      bindings: new Set(),
      roots: new Map(),
      ancestors: new WeakMap(),
      media: new WeakMap(),
    };
    registries.set(realm, registry);
  }
  return registry;
}

function queueChange(binding: ThemeBinding, refreshMedia: boolean): void {
  binding.mediaQueriesDirty ||= refreshMedia;
  if (binding.queued) return;
  binding.queued = true;
  queueMicrotask(() => {
    if (!binding.active) return;
    binding.queued = false;
    if (binding.mediaQueriesDirty) {
      binding.mediaQueriesDirty = false;
      refreshMediaQueries(binding);
    }
    if (binding.host.isConnected) binding.onChange();
  });
}

function invalidateRootStyles(observation: RootObservation): void {
  observation.mediaQueries = undefined;
  for (const binding of observation.bindings) queueChange(binding, true);
}

function invalidateAllRoots(registry: ThemeRegistry): void {
  for (const observation of registry.roots.values()) observation.mediaQueries = undefined;
  for (const binding of registry.bindings) queueChange(binding, true);
}

function onRootMutations(
  registry: ThemeRegistry,
  observation: RootObservation,
  records: MutationRecord[],
): void {
  let stylesheet = false;
  let slotRemoved = false;
  let targets: Node[] | undefined;
  for (const record of records) {
    if (record.type === 'attributes') {
      if (isStyleCarrier(record.target)) stylesheet = true;
      else (targets ??= []).push(record.target);
    } else if (record.type === 'characterData') {
      // Only a <style> element's own text children are stylesheet text.
      stylesheet ||= record.target.parentElement?.localName === 'style';
    } else {
      stylesheet ||= isStyleCarrier(record.target) ||
        someNode(record.addedNodes, containsStyleCarrier) ||
        someNode(record.removedNodes, containsStyleCarrier);
      // A removed slot reassigns its nodes, but its own slotchange fires outside this root.
      slotRemoved ||= someNode(record.removedNodes, containsSlot);
    }
  }
  if (slotRemoved) queueRootRebind(registry, observation);
  if (stylesheet) invalidateRootStyles(observation);
  for (const target of targets ?? []) {
    const bindings = registry.ancestors.get(target as Element);
    if (bindings) for (const binding of bindings) queueChange(binding, false);
  }
}

function observeRoot(registry: ThemeRegistry, root: ObservedRoot, binding: ThemeBinding): void {
  let observation = registry.roots.get(root);
  if (!observation) {
    const created: RootObservation = {
      root,
      bindings: new Set(),
      rebindQueued: false,
      onLoad: (event) => {
        const target = event.target as Node | null;
        if (target && 'nodeType' in target && isStyleCarrier(target) && target.localName === 'link') {
          invalidateRootStyles(created);
        }
      },
      onSlotChange: () => queueRootRebind(registry, created),
    };
    observation = created;
    registry.roots.set(root, created);
    root.addEventListener('load', created.onLoad, true);
    root.addEventListener('slotchange', created.onSlotChange, true);
  }
  if (!observation.observer) {
    const Observer = registry.realm.MutationObserver;
    const target = root.nodeType === DOCUMENT_NODE ? (root as Document).documentElement : root;
    if (Observer && target) {
      const current = observation;
      observation.observer = new Observer((records) => onRootMutations(registry, current, records));
      observation.observer.observe(target, OBSERVED_MUTATIONS);
    }
  }
  observation.bindings.add(binding);
}

function releaseRoot(registry: ThemeRegistry, root: ObservedRoot, binding: ThemeBinding): void {
  const observation = registry.roots.get(root);
  if (!observation) return;
  observation.bindings.delete(binding);
  if (observation.bindings.size > 0) return;
  observation.observer?.disconnect();
  root.removeEventListener('load', observation.onLoad, true);
  root.removeEventListener('slotchange', observation.onSlotChange, true);
  registry.roots.delete(root);
}

function unindexAncestor(binding: ThemeBinding, element: Element): void {
  const bindings = binding.registry.ancestors.get(element);
  bindings?.delete(binding);
  if (bindings?.size === 0) binding.registry.ancestors.delete(element);
}

/** Re-resolves a watcher's ancestry and roots; returns whether either changed. */
function rebind(binding: ThemeBinding): boolean {
  const { registry } = binding;
  const [chain, roots] = flattenedPath(binding.host);
  if (sameNodes(chain, binding.chain) && sameNodes(roots, binding.roots)) return false;
  const nextChain = new Set(chain);
  for (const element of binding.chain) if (!nextChain.has(element)) unindexAncestor(binding, element);
  for (const element of chain) {
    let bindings = registry.ancestors.get(element);
    if (!bindings) registry.ancestors.set(element, (bindings = new Set()));
    bindings.add(binding);
  }
  const nextRoots = new Set(roots);
  for (const root of binding.roots) if (!nextRoots.has(root)) releaseRoot(registry, root, binding);
  for (const root of roots) observeRoot(registry, root, binding);
  binding.chain = chain;
  binding.roots = roots;
  if (chain.every((element) => element.assignedSlot || !element.parentElement?.shadowRoot)) binding.rendered = chain;
  return true;
}

/**
 * Slot (re)assignment changes what a host inherits without reconnecting it, so watchers whose
 * path crosses a root re-resolve after its slotchange or slot removal. They re-read the theme
 * only when a host that rendered before renders under a different ancestry.
 */
function queueRootRebind(registry: ThemeRegistry, observation: RootObservation): void {
  if (observation.rebindQueued) return;
  observation.rebindQueued = true;
  queueMicrotask(() => {
    observation.rebindQueued = false;
    if (registry.roots.get(observation.root) !== observation) return;
    for (const binding of [...observation.bindings]) {
      const { rendered } = binding;
      if (!binding.active || !rebind(binding)) continue;
      refreshMediaQueries(binding);
      if (rendered && !sameNodes(rendered, binding.rendered!)) queueChange(binding, false);
    }
  });
}

function rootMediaQueries(observation: RootObservation): ReadonlySet<string> {
  if (observation.mediaQueries) return observation.mediaQueries;
  const queries = new Set<string>();
  for (const sheet of sheetsForRoot(observation.root)) {
    const owner = sheet.ownerNode;
    if (owner?.nodeType === ELEMENT_NODE) {
      const media = (owner as Element).getAttribute('media')?.trim();
      if (media) queries.add(media);
    }
    try {
      collectMediaQueries(sheet.cssRules, queries);
    } catch {
      // A cross-origin sheet can affect tokens but cannot expose its rule list. Its owner
      // element's media attribute and load event remain observable.
    }
  }
  observation.mediaQueries = queries;
  return queries;
}

function subscribeMedia(registry: ThemeRegistry, matchMedia: MatchMedia, text: string): MediaSubscription {
  let byText = registry.media.get(matchMedia);
  if (!byText) registry.media.set(matchMedia, (byText = new Map()));
  let subscription = byText.get(text);
  if (!subscription) {
    const bindings = new Set<ThemeBinding>();
    const onChange = (): void => {
      for (const binding of bindings) queueChange(binding, false);
    };
    const query = matchMedia.call(registry.realm, text);
    query.addEventListener('change', onChange);
    subscription = { text, query, bindings, owner: byText, onChange };
    byText.set(text, subscription);
  }
  return subscription;
}

function releaseMedia(subscription: MediaSubscription, binding: ThemeBinding): void {
  subscription.bindings.delete(binding);
  if (subscription.bindings.size > 0) return;
  subscription.query.removeEventListener('change', subscription.onChange);
  subscription.owner.delete(subscription.text);
}

function refreshMediaQueries(binding: ThemeBinding): void {
  const { registry } = binding;
  const matchMedia = registry.realm.matchMedia as MatchMedia | undefined;
  if (!matchMedia) return;
  const queries = new Set<string>([...BASE_MEDIA_QUERIES, ...binding.additionalMediaQueries]);
  for (const root of binding.roots) {
    const observation = registry.roots.get(root);
    if (observation) for (const text of rootMediaQueries(observation)) queries.add(text);
  }
  for (const [text, subscription] of binding.media) {
    if (queries.has(text)) continue;
    releaseMedia(subscription, binding);
    binding.media.delete(text);
  }
  for (const text of queries) {
    if (binding.media.has(text)) continue;
    const subscription = subscribeMedia(registry, matchMedia, text);
    subscription.bindings.add(binding);
    binding.media.set(text, subscription);
  }
}

function sheetChanged(registry: ThemeRegistry, changed: CSSStyleSheet | null | undefined): void {
  let sheet = changed;
  // An @import-ed sheet styles the roots of the top-level sheet that imports it.
  for (let depth = 0; sheet?.ownerRule?.parentStyleSheet && depth < 64; depth += 1) {
    sheet = sheet.ownerRule.parentStyleSheet;
  }
  if (!sheet) return;
  const owner = sheet.ownerNode;
  if (owner) {
    const observation = registry.roots.get(owner.getRootNode() as ObservedRoot);
    if (observation) invalidateRootStyles(observation);
    return;
  }
  for (const observation of registry.roots.values()) {
    if (observation.root.adoptedStyleSheets?.includes(sheet)) invalidateRootStyles(observation);
  }
}

function mediaListChanged(registry: ThemeRegistry, list: MediaList): void {
  for (const observation of registry.roots.values()) {
    for (const sheet of sheetsForRoot(observation.root)) {
      let found = sheet.media === list;
      try {
        found ||= rulesContainMediaList(sheet.cssRules, list);
      } catch {
        // A relevant cross-origin sheet is intentionally treated as opaque. Its DOM load/media
        // signals and invalidateLyraTheme() remain the conservative invalidation paths.
      }
      if (found) {
        invalidateRootStyles(observation);
        break;
      }
    }
  }
}

function onStylesheetMutation(registry: ThemeRegistry, subject?: unknown): void {
  if (subject === undefined) {
    invalidateAllRoots(registry);
    return;
  }
  const { realm } = registry;
  if (realm.CSSStyleDeclaration && subject instanceof realm.CSSStyleDeclaration) {
    // An inline declaration rewrites its element's `style` attribute, which the root observers
    // deliver to exactly the watchers that element styles; a rule declaration names its sheet.
    if (subject.parentRule) sheetChanged(registry, subject.parentRule.parentStyleSheet);
    return;
  }
  if (
    (realm.Document && subject instanceof realm.Document) ||
    (realm.ShadowRoot && subject instanceof realm.ShadowRoot)
  ) {
    const observation = registry.roots.get(subject as ObservedRoot);
    if (observation) invalidateRootStyles(observation);
    return;
  }
  if (realm.CSSStyleSheet && subject instanceof realm.CSSStyleSheet) {
    sheetChanged(registry, subject);
    return;
  }
  const CSSRuleCtor = (realm as unknown as { CSSRule?: typeof CSSRule }).CSSRule;
  if (CSSRuleCtor && subject instanceof CSSRuleCtor) {
    sheetChanged(registry, subject.parentStyleSheet);
    return;
  }
  if (realm.MediaList && subject instanceof realm.MediaList) {
    mediaListChanged(registry, subject);
    return;
  }
  // Unknown platform objects are rare and cannot be scoped safely. Preserve the conservative
  // behavior for those opaque cases; known declarations, sheets and roots above are filtered.
  invalidateAllRoots(registry);
}

function bindWatcher(
  registry: ThemeRegistry,
  host: Element,
  onChange: () => void,
  additionalMediaQueries: readonly string[],
): () => void {
  const binding: ThemeBinding = {
    registry,
    host,
    onChange,
    additionalMediaQueries,
    chain: [],
    roots: [],
    media: new Map(),
    queued: false,
    mediaQueriesDirty: false,
    active: true,
  };
  if (registry.bindings.size === 0) {
    registry.unsubscribeHub = subscribeRealm(registry.realm, (subject) => onStylesheetMutation(registry, subject));
  }
  registry.bindings.add(binding);
  rebind(binding);
  refreshMediaQueries(binding);
  return () => {
    if (!binding.active) return;
    binding.active = false;
    for (const element of binding.chain) unindexAncestor(binding, element);
    for (const root of binding.roots) releaseRoot(registry, root, binding);
    for (const subscription of binding.media.values()) releaseMedia(subscription, binding);
    binding.media.clear();
    binding.chain = [];
    binding.roots = [];
    registry.bindings.delete(binding);
    if (registry.bindings.size === 0) {
      registry.unsubscribeHub?.();
      registry.unsubscribeHub = undefined;
    }
  };
}

/**
 * Watches every platform signal that can change token values without a Lit property update:
 * theme attributes, stylesheet DOM/CSSOM/adoption changes, slot reassignment, and media-query
 * result changes. Canvas consumers opt in so DOM/SVG components keep relying on the CSS cascade
 * directly. All watchers of a realm share one observer per root, one listener per media query
 * and one stylesheet scan per root change.
 */
export class ThemeWatcher implements ReactiveController {
  private unsubscribeRealm?: () => void;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    /** Invoked once per microtask when the effective theme may have changed. */
    private readonly onChange: () => void,
    /** Non-CSS producers can enroll media queries their own rendering depends on. */
    private readonly additionalMediaQueries: readonly string[] = [],
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.hostDisconnected();
    const realm = this.host.ownerDocument.defaultView as BrowserRealm | null;
    if (!realm) return;
    this.unsubscribeRealm = bindWatcher(
      registryFor(realm),
      this.host,
      () => this.onChange(),
      this.additionalMediaQueries,
    );
  }

  hostDisconnected(): void {
    this.unsubscribeRealm?.();
    this.unsubscribeRealm = undefined;
  }
}
