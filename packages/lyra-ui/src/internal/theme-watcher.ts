import type { ReactiveController, ReactiveControllerHost } from 'lit';

export type LyraThemeRoot = Document | ShadowRoot | Element;

type BrowserRealm = Window & typeof globalThis;
type ThemeSubscriber = () => void;

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

function notifyHub(hub: SharedThemeHub): void {
  for (const subscriber of [...hub.subscribers]) subscriber();
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
    const result = Reflect.apply(originalMethod, this, args);
    if (asyncResult && result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).then(
        () => notifyHub(hub),
        () => undefined,
      );
    } else {
      notifyHub(hub);
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
    notifyHub(hub);
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
    notifyHub(hub);
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

function isComposedAncestor(candidate: Element, descendant: Element): boolean {
  let current: Element | null = descendant;
  while (current) {
    if (current === candidate) return true;
    if (current.parentElement) {
      current = current.parentElement;
      continue;
    }
    const root = current.getRootNode();
    current = root.nodeType === DOCUMENT_FRAGMENT_NODE && 'host' in root
      ? (root as ShadowRoot).host
      : null;
  }
  return false;
}

function observationRoots(host: Element): Array<Document | ShadowRoot> {
  const roots = new Set<Document | ShadowRoot>([host.ownerDocument]);
  let current: Element | null = host;
  while (current) {
    const root = current.getRootNode();
    if (root.nodeType !== DOCUMENT_FRAGMENT_NODE || !('host' in root)) break;
    const shadowRoot = root as ShadowRoot;
    roots.add(shadowRoot);
    current = shadowRoot.host;
  }
  return [...roots];
}

function sheetsForRoot(root: Document | ShadowRoot): CSSStyleSheet[] {
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

/**
 * Watches every platform signal that can change token values without a Lit property update:
 * theme attributes, stylesheet DOM/CSSOM/adoption changes, and media-query result changes.
 * Canvas consumers opt in so DOM/SVG components keep relying on the CSS cascade directly.
 */
export class ThemeWatcher implements ReactiveController {
  private observer?: MutationObserver;
  private unsubscribeRealm?: () => void;
  private readonly mediaQueries = new Map<string, MediaQueryList>();
  private roots: Array<Document | ShadowRoot> = [];
  private realm?: BrowserRealm;
  private queued = false;
  private mediaQueriesDirty = false;
  private generation = 0;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    /** Invoked once per microtask when the effective theme may have changed. */
    private readonly onChange: () => void,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.teardown();
    this.generation += 1;
    const realm = this.host.ownerDocument.defaultView as BrowserRealm | null;
    if (!realm) return;
    this.realm = realm;
    this.roots = observationRoots(this.host);
    this.unsubscribeRealm = subscribeRealm(realm, this.onStylesheetMutation);
    this.installObserver();
    for (const root of this.roots) root.addEventListener('load', this.onStylesheetLoad, true);
    this.refreshMediaQueries();
  }

  hostDisconnected(): void {
    this.generation += 1;
    this.teardown();
  }

  private teardown(): void {
    for (const root of this.roots) root.removeEventListener('load', this.onStylesheetLoad, true);
    this.unsubscribeRealm?.();
    this.unsubscribeRealm = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
    for (const query of this.mediaQueries.values()) {
      query.removeEventListener('change', this.onMediaQueryChange);
    }
    this.mediaQueries.clear();
    this.roots = [];
    this.realm = undefined;
    this.queued = false;
    this.mediaQueriesDirty = false;
  }

  private installObserver(): void {
    const Observer = this.realm?.MutationObserver;
    if (!Observer) return;
    this.observer = new Observer(this.onMutations);
    for (const root of this.roots) {
      const target = root.nodeType === DOCUMENT_NODE ? (root as Document).documentElement : root;
      if (!target) continue;
      this.observer.observe(target, {
        attributes: true,
        attributeFilter: [
          'class',
          'style',
          // The library's own light/dark switch. Both palette.styles.ts and tokens.styles.ts key
          // their dark grids off :host([data-lr-theme='dark']) and an ancestor
          // [data-lr-theme='dark'], so toggling it changes every resolved token value with no Lit
          // property update and no stylesheet mutation to observe. Omitting it left a canvas
          // component painted in the previous mode until something else invalidated the watcher.
          'data-lr-theme',
          'data-theme',
          'data-color-scheme',
          'media',
          'href',
          'rel',
          'disabled',
        ],
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }

  private onMutations = (records: MutationRecord[]): void => {
    let relevant = false;
    let stylesheet = false;
    for (const record of records) {
      if (record.type === 'attributes') {
        const target = record.target as Element;
        if (isStyleCarrier(target)) {
          relevant = true;
          stylesheet = true;
        } else if (isComposedAncestor(target, this.host)) {
          relevant = true;
        }
        continue;
      }
      if (record.type === 'characterData') {
        const parent = record.target.parentElement;
        if (parent?.closest('style')) {
          relevant = true;
          stylesheet = true;
        }
        continue;
      }
      if (
        isStyleCarrier(record.target) ||
        [...record.addedNodes, ...record.removedNodes].some(containsStyleCarrier)
      ) {
        relevant = true;
        stylesheet = true;
      }
    }
    if (relevant) this.queueChange(stylesheet);
  };

  private onStylesheetLoad = (event: Event): void => {
    if (
      event.target &&
      'nodeType' in event.target &&
      isStyleCarrier(event.target as Node) &&
      (event.target as Element).localName === 'link'
    ) {
      this.queueChange(true);
    }
  };

  private onStylesheetMutation = (): void => {
    this.queueChange(true);
  };

  private onMediaQueryChange = (): void => {
    this.queueChange(false);
  };

  private refreshMediaQueries(): void {
    const realm = this.realm;
    if (!realm?.matchMedia) return;
    const queries = new Set<string>([
      '(prefers-color-scheme: dark)',
      '(prefers-contrast: more)',
      '(forced-colors: active)',
    ]);
    for (const root of this.roots) {
      for (const sheet of sheetsForRoot(root)) {
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
    }
    for (const [text, query] of this.mediaQueries) {
      if (queries.has(text)) continue;
      query.removeEventListener('change', this.onMediaQueryChange);
      this.mediaQueries.delete(text);
    }
    for (const text of queries) {
      if (this.mediaQueries.has(text)) continue;
      const query = realm.matchMedia(text);
      query.addEventListener('change', this.onMediaQueryChange);
      this.mediaQueries.set(text, query);
    }
  }

  private queueChange(refreshMediaQueries: boolean): void {
    this.mediaQueriesDirty ||= refreshMediaQueries;
    if (this.queued) return;
    this.queued = true;
    const generation = this.generation;
    queueMicrotask(() => {
      if (generation !== this.generation) return;
      this.queued = false;
      if (this.mediaQueriesDirty) {
        this.mediaQueriesDirty = false;
        this.refreshMediaQueries();
      }
      if (this.host.isConnected) this.onChange();
    });
  }
}
