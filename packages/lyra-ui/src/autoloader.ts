import {
  AUTOLOADER_MANIFEST,
  type AutoloaderManifestEntry,
} from './internal/autoloader-manifest.js';
import { loadAutoloaderConstructor } from './internal/autoloader-loaders.js';
import {
  AUTOLOADER_TAG_SET,
  type AutoloadableTagName,
} from './internal/autoloader-tags.js';
import {
  registryForRoot,
} from './internal/definition-registry.js';
import type { LyraDefinitionRoot } from './utilities/defined.js';

export type { AutoloadableTagName } from './internal/autoloader-tags.js';
export type { LyraDefinitionRoot } from './utilities/defined.js';

export const AUTOLOADER_PENDING_ATTRIBUTE = 'data-lr-autoload-pending';

/**
 * Optional-peer components stay excluded unless every package they require is named, or the
 * caller deliberately opts into all of them.
 */
export type AutoloaderOptionalPeers = 'all' | readonly string[] | ReadonlySet<string>;

export interface AutoloaderOptions {
  /** Explicit package allowlist for optional-peer components, or `'all'` after installing them. */
  readonly optionalPeers?: AutoloaderOptionalPeers;
  /** Emit `lr-autoload-preload`, `lr-autoload-loaded`, and `lr-autoload-error` on the caller root. */
  readonly events?: boolean;
}

export interface AutoloaderEventDetail {
  readonly tag: AutoloadableTagName;
  readonly optionalPeers: readonly string[];
}

export interface AutoloaderErrorEventDetail extends AutoloaderEventDetail {
  readonly error: unknown;
}

export interface AutoloaderEventMap {
  'lr-autoload-preload': CustomEvent<AutoloaderEventDetail>;
  'lr-autoload-loaded': CustomEvent<AutoloaderEventDetail>;
  'lr-autoload-error': CustomEvent<AutoloaderErrorEventDetail>;
}

interface NormalizedOptions {
  readonly optionalPeers: 'all' | ReadonlySet<string>;
  readonly events: boolean;
}

interface LoaderContext {
  active: boolean;
  readonly root: LyraDefinitionRoot;
  readonly options: NormalizedOptions;
  readonly markedElements: Set<Element>;
  readonly definitionLoads: WeakMap<CustomElementRegistry, Map<AutoloadableTagName, Promise<void>>>;
  readonly loadedTags: Set<AutoloadableTagName>;
  observer?: MutationObserver;
  readonly observedRoots: Set<LyraDefinitionRoot>;
}

interface UpdateCompleteElement extends Element {
  readonly updateComplete?: Promise<unknown>;
}

const markerOwners = new Map<Element, LoaderContext>();
let activeContext: LoaderContext | undefined;

function defaultRoot(): LyraDefinitionRoot | undefined {
  return typeof document === 'undefined' ? undefined : document;
}

function isReadonlySet(value: unknown): value is ReadonlySet<string> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { has?: unknown; [Symbol.iterator]?: unknown };
  return typeof candidate.has === 'function' && typeof candidate[Symbol.iterator] === 'function';
}

function normalizeOptions(options: AutoloaderOptions | undefined): NormalizedOptions {
  const policy = options?.optionalPeers;
  if (policy === undefined) return { optionalPeers: new Set(), events: options?.events === true };
  if (policy === 'all') return { optionalPeers: 'all', events: options?.events === true };
  if (!Array.isArray(policy) && !isReadonlySet(policy)) {
    throw new TypeError("optionalPeers must be 'all', an array, or a ReadonlySet of package names");
  }
  const peers = [...policy];
  if (peers.some((peer) => typeof peer !== 'string' || peer.length === 0 || peer !== peer.trim())) {
    throw new TypeError('optionalPeers must contain non-empty package names');
  }
  return { optionalPeers: new Set(peers), events: options?.events === true };
}

function isEligible(entry: AutoloaderManifestEntry, options: NormalizedOptions): boolean {
  const allowedPeers = options.optionalPeers;
  if (entry.optionalPeers.length === 0 || allowedPeers === 'all') return true;
  return entry.optionalPeers.every((peer) => allowedPeers.has(peer));
}

function eventConstructor(root: LyraDefinitionRoot): typeof CustomEvent | undefined {
  const ownerDocument = root.nodeType === 9 ? (root as Document) : root.ownerDocument;
  const fromWindow = ownerDocument?.defaultView?.CustomEvent;
  if (fromWindow) return fromWindow;
  return typeof CustomEvent === 'undefined' ? undefined : CustomEvent;
}

type AutoloaderEventDetailFor<Name extends keyof AutoloaderEventMap> =
  AutoloaderEventMap[Name] extends CustomEvent<infer Detail> ? Detail : never;

function emit<Name extends keyof AutoloaderEventMap>(
  context: LoaderContext,
  name: Name,
  detail: AutoloaderEventDetailFor<Name>,
): void {
  if (!context.options.events || !context.active) return;
  const EventConstructor = eventConstructor(context.root);
  if (!EventConstructor) return;
  context.root.dispatchEvent(
    new EventConstructor(name, {
      bubbles: true,
      composed: true,
      detail,
    }),
  );
}

function markPending(context: LoaderContext, element: Element): void {
  const owner = markerOwners.get(element);
  if (owner === context) return;
  if (owner || element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)) return;
  element.setAttribute(AUTOLOADER_PENDING_ATTRIBUTE, '');
  markerOwners.set(element, context);
  context.markedElements.add(element);
}

function clearPending(context: LoaderContext, element: Element): void {
  if (markerOwners.get(element) !== context) return;
  element.removeAttribute(AUTOLOADER_PENDING_ATTRIBUTE);
  markerOwners.delete(element);
  context.markedElements.delete(element);
}

function clearAllPending(context: LoaderContext): void {
  for (const element of context.markedElements) clearPending(context, element);
}

function definitionMap(
  context: LoaderContext,
  registry: CustomElementRegistry,
): Map<AutoloadableTagName, Promise<void>> {
  let definitions = context.definitionLoads.get(registry);
  if (!definitions) {
    definitions = new Map();
    context.definitionLoads.set(registry, definitions);
  }
  return definitions;
}

async function waitForUpdates(elements: readonly Element[]): Promise<void> {
  const updates: Promise<unknown>[] = [];
  for (const element of elements) {
    const updateComplete = (element as UpdateCompleteElement).updateComplete;
    if (updateComplete && typeof updateComplete.then === 'function') updates.push(updateComplete);
  }
  await Promise.all(updates);
}

async function defineTag(
  context: LoaderContext,
  registry: CustomElementRegistry,
  tag: AutoloadableTagName,
): Promise<void> {
  if (registry.get(tag)) return;
  const definitions = definitionMap(context, registry);
  const existing = definitions.get(tag);
  if (existing) return existing;

  const entry = AUTOLOADER_MANIFEST[tag];
  const pending = (async () => {
    emit(context, 'lr-autoload-preload', { tag, optionalPeers: entry.optionalPeers });
    try {
      const constructor = await loadAutoloaderConstructor(tag);
      if (!context.active) return;
      if (!registry.get(tag)) registry.define(tag, constructor);
      await registry.whenDefined(tag);
      if (!context.active) return;
      context.loadedTags.add(tag);
      emit(context, 'lr-autoload-loaded', { tag, optionalPeers: entry.optionalPeers });
    } catch (error) {
      emit(context, 'lr-autoload-error', { tag, optionalPeers: entry.optionalPeers, error });
      throw error;
    }
  })();
  definitions.set(tag, pending);
  const clearDefinition = (): void => {
    if (definitions.get(tag) === pending) definitions.delete(tag);
  };
  void pending.then(clearDefinition, clearDefinition);
  return pending;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function collect(
  root: LyraDefinitionRoot,
): { roots: LyraDefinitionRoot[]; elements: Element[] } {
  const roots: LyraDefinitionRoot[] = [];
  const elements: Element[] = [];
  const seenRoots = new Set<LyraDefinitionRoot>();
  const seenElements = new Set<Element>();

  const visit = (current: LyraDefinitionRoot): void => {
    if (seenRoots.has(current)) return;
    seenRoots.add(current);
    roots.push(current);
    const candidates = [
      ...(isElement(current) ? [current] : []),
      ...current.querySelectorAll('*'),
    ];
    for (const element of candidates) {
      if (!seenElements.has(element)) {
        seenElements.add(element);
        elements.push(element);
      }
      if (element.shadowRoot) visit(element.shadowRoot);
    }
  };

  visit(root);
  return { roots, elements };
}

function observerConstructor(root: LyraDefinitionRoot): typeof MutationObserver | undefined {
  const ownerDocument = root.nodeType === 9 ? (root as Document) : root.ownerDocument;
  const fromWindow = ownerDocument?.defaultView?.MutationObserver;
  if (fromWindow) return fromWindow;
  return typeof MutationObserver === 'undefined' ? undefined : MutationObserver;
}

function observeRoot(context: LoaderContext, root: LyraDefinitionRoot): void {
  if (!context.observer || context.observedRoots.has(root)) return;
  context.observer.observe(root, { childList: true, subtree: true });
  context.observedRoots.add(root);
}

async function discoverOpenShadowRoots(context: LoaderContext, elements: readonly Element[]): Promise<void> {
  const discoveries: Promise<unknown>[] = [];
  for (const element of elements) {
    if (!element.shadowRoot) continue;
    observeRoot(context, element.shadowRoot);
    discoveries.push(discoverWithContext(context, element.shadowRoot));
  }
  await Promise.all(discoveries);
}

async function finishDiscoveredElement(context: LoaderContext, element: Element): Promise<void> {
  try {
    await waitForUpdates([element]);
    if (!context.active) return;
    const shadowDiscovery = discoverOpenShadowRoots(context, [element]);
    clearPending(context, element);
    await shadowDiscovery;
  } finally {
    clearPending(context, element);
  }
}

async function discoverWithContext(
  context: LoaderContext,
  root: LyraDefinitionRoot,
): Promise<readonly AutoloadableTagName[]> {
  if (!context.active) return [];
  const before = new Set(context.loadedTags);
  const { roots, elements } = collect(root);
  for (const discoveredRoot of roots) observeRoot(context, discoveredRoot);

  const grouped = new Map<
    CustomElementRegistry,
    Map<AutoloadableTagName, Element[]>
  >();
  const definedElements: Element[] = [];
  for (const element of elements) {
    const tag = element.localName;
    if (!AUTOLOADER_TAG_SET.has(tag)) continue;
    const typedTag = tag as AutoloadableTagName;
    const entry = AUTOLOADER_MANIFEST[typedTag];
    const registry = registryForRoot(element);
    if (!registry) {
      continue;
    }
    if (registry.get(typedTag)) {
      markPending(context, element);
      definedElements.push(element);
      continue;
    }
    if (!isEligible(entry, context.options)) continue;
    markPending(context, element);
    let tags = grouped.get(registry);
    if (!tags) {
      tags = new Map();
      grouped.set(registry, tags);
    }
    const matches = tags.get(typedTag) ?? [];
    matches.push(element);
    tags.set(typedTag, matches);
  }

  const definitions: Promise<void>[] = definedElements.map((element) =>
    finishDiscoveredElement(context, element),
  );
  for (const [registry, tags] of grouped) {
    for (const [tag, matches] of tags) {
      definitions.push(
        (async () => {
          try {
            await defineTag(context, registry, tag);
            if (!context.active) return;
            await Promise.all(matches.map((element) => finishDiscoveredElement(context, element)));
          } finally {
            // Definition failures and stop() paths still clear every loader-owned marker.
            for (const element of matches) clearPending(context, element);
          }
        })(),
      );
    }
  }
  await Promise.all(definitions);
  return [...context.loadedTags].filter((tag) => !before.has(tag));
}

function createContext(root: LyraDefinitionRoot, options: AutoloaderOptions | undefined): LoaderContext {
  return {
    active: true,
    root,
    options: normalizeOptions(options),
    markedElements: new Set(),
    definitionLoads: new WeakMap(),
    loadedTags: new Set(),
    observedRoots: new Set(),
  };
}

/** Loads and defines the known Lyra tags currently rendered below `root`. */
export async function discover(
  root: LyraDefinitionRoot | undefined = defaultRoot(),
  options?: AutoloaderOptions,
): Promise<readonly AutoloadableTagName[]> {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const context = createContext(root, options);
  try {
    return await discoverWithContext(context, root);
  } finally {
    context.active = false;
    clearAllPending(context);
  }
}

/**
 * Discovers the existing tree and watches additions below the caller-provided document or open
 * root. Calling `start()` again first stops the previous observer and invalidates its pending work.
 */
export async function start(
  root: LyraDefinitionRoot | undefined = defaultRoot(),
  options?: AutoloaderOptions,
): Promise<readonly AutoloadableTagName[]> {
  stop();
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const context = createContext(root, options);
  activeContext = context;
  const Observer = observerConstructor(root);
  if (Observer) {
    context.observer = new Observer((records) => {
      if (!context.active) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1 && node.nodeType !== 11) continue;
          void discoverWithContext(context, node as LyraDefinitionRoot).catch(() => {
            // The opt-in lr-autoload-error event reports observer-driven failures. A later DOM
            // insertion or explicit discover() call is allowed to retry rejected imports.
          });
        }
      }
    });
  }
  try {
    return await discoverWithContext(context, root);
  } catch (error) {
    if (activeContext === context) stop();
    throw error;
  }
}

/** Disconnects every active observer, invalidates pending work, and removes loader-owned markers. */
export function stop(): void {
  const context = activeContext;
  if (!context) return;
  activeContext = undefined;
  context.active = false;
  context.observer?.disconnect();
  context.observedRoots.clear();
  clearAllPending(context);
}
