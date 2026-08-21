import { AUTOLOADER_MANIFEST, type AutoloaderManifestEntry } from './internal/autoloader-manifest.js';
import { loadAutoloaderConstructor } from './internal/autoloader-loaders.js';
import { AUTOLOADER_TAG_SET, type AutoloadableTagName } from './internal/autoloader-tags.js';
import { registryForRoot } from './internal/definition-registry.js';
import {
  collectRenderedTree,
  nativeElementLocalName,
  renderedTreeTraversalLimits,
  RenderedTreeTraversalError,
  type RenderedTreeTraversalLimit,
  type RenderedTreeTraversalLimits,
  type RenderedTreeTraversalOptions,
  type RenderedTreeTraversalState,
} from './internal/rendered-tree-traversal.js';
import type { LyraDefinitionRoot } from './utilities/defined.js';

export type { AutoloadableTagName } from './internal/autoloader-tags.js';
export type { LyraDefinitionRoot } from './utilities/defined.js';

export const AUTOLOADER_PENDING_ATTRIBUTE = 'data-lr-autoload-pending';

/**
 * Optional-peer components stay excluded unless every package they require is named, or the
 * caller deliberately opts into all of them.
 */
export type AutoloaderOptionalPeers = 'all' | readonly string[] | ReadonlySet<string>;

export interface AutoloaderOptions extends RenderedTreeTraversalOptions {
  /** Explicit package allowlist for optional-peer components, or `'all'` after installing them. */
  readonly optionalPeers?: AutoloaderOptionalPeers;
  /** Emit load and traversal lifecycle events on the caller root. */
  readonly events?: boolean;
  /** Maximum concurrent definition and first-update tasks. Default 16. */
  readonly maxConcurrency?: number;
}

export interface AutoloaderEventDetail {
  readonly tag: AutoloadableTagName;
  readonly optionalPeers: readonly string[];
}

export interface AutoloaderErrorEventDetail extends AutoloaderEventDetail {
  readonly error: unknown;
}

export interface AutoloaderTraversalErrorEventDetail {
  readonly limit: RenderedTreeTraversalLimit;
  readonly maximum: number;
  readonly error: Error;
}

export interface AutoloaderEventMap {
  'lr-autoload-preload': CustomEvent<AutoloaderEventDetail>;
  'lr-autoload-loaded': CustomEvent<AutoloaderEventDetail>;
  'lr-autoload-error': CustomEvent<AutoloaderErrorEventDetail>;
  'lr-autoload-traversal-error': CustomEvent<AutoloaderTraversalErrorEventDetail>;
}

interface NormalizedOptions {
  readonly optionalPeers: 'all' | ReadonlySet<string>;
  readonly events: boolean;
  readonly traversal: RenderedTreeTraversalLimits;
  readonly maxConcurrency: number;
}

interface LoaderContext {
  active: boolean;
  readonly root: LyraDefinitionRoot;
  readonly options: NormalizedOptions;
  readonly markerClaims: Set<PendingMarkerClaim>;
  readonly definitionLoads: WeakMap<CustomElementRegistry, Map<AutoloadableTagName, Promise<void>>>;
  readonly loadedTags: Set<AutoloadableTagName>;
  observer?: MutationObserver;
  readonly observedRoots: Set<LyraDefinitionRoot>;
  discoveryTail: Promise<void>;
}

interface DiscoveryState extends RenderedTreeTraversalState {
  readonly elements: Set<Element>;
  readonly roots: Set<LyraDefinitionRoot>;
}

interface DiscoveryRoot {
  readonly root: LyraDefinitionRoot;
  readonly depth: number;
}

interface UpdateCompleteElement extends Element {
  readonly updateComplete?: Promise<unknown>;
}

interface PendingMarkerClaim {
  readonly context: LoaderContext;
  readonly element: Element;
}

const markerOwners = new Map<Element, Set<PendingMarkerClaim>>();
let activeContext: LoaderContext | undefined;

function defaultRoot(): LyraDefinitionRoot | undefined {
  return typeof document === 'undefined' ? undefined : document;
}

function isReadonlySet(value: unknown): value is ReadonlySet<string> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { has?: unknown; [Symbol.iterator]?: unknown };
  return typeof candidate.has === 'function' && typeof candidate[Symbol.iterator] === 'function';
}

function normalizeConcurrency(value: number | undefined): number {
  const resolved = value ?? 16;
  if (!Number.isFinite(resolved) || !Number.isInteger(resolved) || resolved < 1) {
    throw new RangeError('Autoloader maxConcurrency must be an integer >= 1');
  }
  return resolved;
}

function normalizeOptions(options: AutoloaderOptions | undefined): NormalizedOptions {
  const traversal = renderedTreeTraversalLimits(options ?? {}, 'Autoloader');
  const maxConcurrency = normalizeConcurrency(options?.maxConcurrency);
  const common = {
    events: options?.events === true,
    traversal,
    maxConcurrency,
  };
  const policy = options?.optionalPeers;
  if (policy === undefined) return { optionalPeers: new Set(), ...common };
  if (policy === 'all') return { optionalPeers: 'all', ...common };
  if (!Array.isArray(policy) && !isReadonlySet(policy)) {
    throw new TypeError("optionalPeers must be 'all', an array, or a ReadonlySet of package names");
  }
  const peers = [...policy];
  if (peers.some((peer) => typeof peer !== 'string' || peer.length === 0 || peer !== peer.trim())) {
    throw new TypeError('optionalPeers must contain non-empty package names');
  }
  return { optionalPeers: new Set(peers), ...common };
}

function isEligible(entry: AutoloaderManifestEntry, options: NormalizedOptions): boolean {
  const allowedPeers = options.optionalPeers;
  if (entry.optionalPeers.length === 0 || allowedPeers === 'all') return true;
  return entry.optionalPeers.every((peer) => allowedPeers.has(peer));
}

function nativeNodeType(node: Node): number | undefined {
  try {
    const NodeConstructor = typeof Node === 'undefined' ? undefined : Node;
    const getter = NodeConstructor && Object.getOwnPropertyDescriptor(NodeConstructor.prototype, 'nodeType')?.get;
    return (getter?.call(node) as number | undefined) ?? node.nodeType;
  } catch {
    return undefined;
  }
}

function ownerDocumentForNode(node: Node): Document | undefined {
  if (nativeNodeType(node) === 9) return node as Document;
  try {
    const NodeConstructor = typeof Node === 'undefined' ? undefined : Node;
    const getter = NodeConstructor && Object.getOwnPropertyDescriptor(NodeConstructor.prototype, 'ownerDocument')?.get;
    return (getter?.call(node) as Document | null | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

function eventConstructor(root: LyraDefinitionRoot): typeof CustomEvent | undefined {
  const ownerDocument = ownerDocumentForNode(root);
  const fromWindow = ownerDocument?.defaultView?.CustomEvent;
  if (fromWindow) return fromWindow;
  return typeof CustomEvent === 'undefined' ? undefined : CustomEvent;
}

type AutoloaderEventDetailFor<Name extends keyof AutoloaderEventMap> = AutoloaderEventMap[Name] extends CustomEvent<
  infer Detail
>
  ? Detail
  : never;

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

function markPending(context: LoaderContext, element: Element): PendingMarkerClaim | undefined {
  let owners = markerOwners.get(element);
  if (!owners) {
    // An untracked marker belongs to the caller. Never claim or remove it.
    if (element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)) return undefined;
    owners = new Set();
    markerOwners.set(element, owners);
  }
  const claim = { context, element } satisfies PendingMarkerClaim;
  owners.add(claim);
  context.markerClaims.add(claim);
  if (!element.hasAttribute(AUTOLOADER_PENDING_ATTRIBUTE)) {
    element.setAttribute(AUTOLOADER_PENDING_ATTRIBUTE, '');
  }
  return claim;
}

function clearPending(claim: PendingMarkerClaim): void {
  if (!claim.context.markerClaims.delete(claim)) return;
  const owners = markerOwners.get(claim.element);
  if (!owners?.delete(claim)) return;
  if (owners.size > 0) return;
  claim.element.removeAttribute(AUTOLOADER_PENDING_ATTRIBUTE);
  markerOwners.delete(claim.element);
}

function clearAllPending(context: LoaderContext): void {
  for (const claim of [...context.markerClaims]) clearPending(claim);
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

async function waitForUpdate(element: Element): Promise<void> {
  try {
    const updateComplete = (element as UpdateCompleteElement).updateComplete;
    if (updateComplete && typeof updateComplete.then === 'function') await updateComplete;
  } catch {
    // A consumer-owned accessor or thenable must not prevent valid sibling elements from loading.
  }
}

async function runBounded<Item>(
  items: readonly Item[],
  concurrency: number,
  task: (item: Item) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failed = false;
  let failure: unknown;
  const worker = async (): Promise<void> => {
    while (!failed) {
      const index = next;
      if (index >= items.length) return;
      next += 1;
      try {
        await task(items[index]!);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  if (failed) throw failure;
}

async function withWorkSlot<Result>(context: LoaderContext, task: () => Promise<Result>): Promise<Result | undefined> {
  if (!context.active) return undefined;
  return task();
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
    emit(context, 'lr-autoload-preload', {
      tag,
      optionalPeers: entry.optionalPeers,
    });
    try {
      const constructor = await loadAutoloaderConstructor(tag);
      if (!context.active) return;
      if (!registry.get(tag)) registry.define(tag, constructor);
      await registry.whenDefined(tag);
      if (!context.active) return;
      context.loadedTags.add(tag);
      emit(context, 'lr-autoload-loaded', {
        tag,
        optionalPeers: entry.optionalPeers,
      });
    } catch (error) {
      emit(context, 'lr-autoload-error', {
        tag,
        optionalPeers: entry.optionalPeers,
        error,
      });
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

function newDiscoveryState(): DiscoveryState {
  return { work: 0, elements: new Set(), roots: new Set() };
}

function collectDiscoveryBatch(
  context: LoaderContext,
  requestedRoots: readonly DiscoveryRoot[],
  state: DiscoveryState,
): {
  readonly roots: readonly LyraDefinitionRoot[];
  readonly elements: readonly Element[];
  readonly rootDepths: ReadonlyMap<LyraDefinitionRoot, number>;
  readonly elementDepths: ReadonlyMap<Element, number>;
} {
  const batchRoots: LyraDefinitionRoot[] = [];
  const batchElements: Element[] = [];
  const rootDepths = new Map<LyraDefinitionRoot, number>();
  const elementDepths = new Map<Element, number>();
  const seenRequests = new Set<LyraDefinitionRoot>();
  for (const request of requestedRoots) {
    if (seenRequests.has(request.root)) continue;
    seenRequests.add(request.root);
    const result = collectRenderedTree(
      request.root,
      context.options.traversal,
      state,
      'Autoloader discovery',
      request.depth,
    );
    for (const discoveredRoot of result.roots) {
      batchRoots.push(discoveredRoot);
      rootDepths.set(discoveredRoot, result.rootDepths.get(discoveredRoot) ?? request.depth);
    }
    for (const element of result.elements) {
      batchElements.push(element);
      elementDepths.set(element, result.elementDepths.get(element) ?? request.depth);
    }
  }
  return {
    roots: batchRoots,
    elements: batchElements,
    rootDepths,
    elementDepths,
  };
}

function isElement(node: Node): node is Element {
  return nativeNodeType(node) === 1;
}

function observerConstructor(root: LyraDefinitionRoot): typeof MutationObserver | undefined {
  const ownerDocument = ownerDocumentForNode(root);
  const fromWindow = ownerDocument?.defaultView?.MutationObserver;
  if (fromWindow) return fromWindow;
  return typeof MutationObserver === 'undefined' ? undefined : MutationObserver;
}

function nativeParentNode(node: Node): Node | null {
  try {
    const ownerWindow = ownerDocumentForNode(node)?.defaultView;
    const NodeConstructor = ownerWindow?.Node ?? (typeof Node === 'undefined' ? undefined : Node);
    const getter = NodeConstructor && Object.getOwnPropertyDescriptor(NodeConstructor.prototype, 'parentNode')?.get;
    return (getter?.call(node) as Node | null | undefined) ?? null;
  } catch {
    return null;
  }
}

function parentAcrossOpenShadowBoundary(node: Node): Node | null {
  const parent = nativeParentNode(node);
  if (parent) return parent;
  if (nativeNodeType(node) !== 11 || !('host' in node)) return null;
  try {
    const ownerWindow = ownerDocumentForNode(node)?.defaultView;
    const ShadowRootConstructor =
      ownerWindow?.ShadowRoot ?? (typeof ShadowRoot === 'undefined' ? undefined : ShadowRoot);
    const getter =
      ShadowRootConstructor && Object.getOwnPropertyDescriptor(ShadowRootConstructor.prototype, 'host')?.get;
    const host = (getter?.call(node) as Element | undefined) ?? undefined;
    return host && isElement(host) ? host : null;
  } catch {
    return null;
  }
}

function spendAncestryWork(state: DiscoveryState, maximum: number): void {
  if (state.work >= maximum) {
    throw new RenderedTreeTraversalError('Autoloader discovery', 'maxWork', maximum);
  }
  state.work += 1;
}

function renderedDepthFromRoot(
  root: LyraDefinitionRoot,
  node: Node,
  state: DiscoveryState,
  maximumWork: number,
): number | undefined {
  let current: Node | null = node;
  let depth = 0;
  const seen = new Set<Node>();
  while (current && !seen.has(current)) {
    spendAncestryWork(state, maximumWork);
    if (current === root) return depth;
    seen.add(current);
    if (nativeNodeType(current) === 11 && 'host' in current) {
      const host = parentAcrossOpenShadowBoundary(current);
      if (!host) return undefined;
      depth += 1;
      current = host;
      continue;
    }
    const parent = parentAcrossOpenShadowBoundary(current);
    if (!parent) return undefined;
    if (isElement(parent)) depth += 1;
    current = parent;
  }
  return undefined;
}

function isReachableFromRoot(
  root: LyraDefinitionRoot,
  node: Node,
  state: DiscoveryState,
  maximumWork: number,
): boolean {
  let current: Node | null = node;
  const seen = new Set<Node>();
  while (current && !seen.has(current)) {
    spendAncestryWork(state, maximumWork);
    if (current === root) return true;
    seen.add(current);
    current = parentAcrossOpenShadowBoundary(current);
  }
  return false;
}

function observeRoot(context: LoaderContext, root: LyraDefinitionRoot): void {
  if (!context.observer || context.observedRoots.has(root)) return;
  context.observer.observe(root, { childList: true, subtree: true });
  context.observedRoots.add(root);
}

function pruneDetachedObservedRoots(context: LoaderContext, state: DiscoveryState): void {
  const observer = context.observer;
  if (!observer) return;
  const reachableRoots = [...context.observedRoots].filter((root) =>
    isReachableFromRoot(context.root, root, state, context.options.traversal.maxWork),
  );
  if (reachableRoots.length === context.observedRoots.size) return;

  // MutationObserver has no per-target unobserve operation. Reconnect the shared observer to the
  // roots that still belong to the caller's tree so removed hosts and their shadow subtrees are
  // no longer retained or able to enqueue discovery work.
  observer.disconnect();
  context.observedRoots.clear();
  for (const root of reachableRoots) observeRoot(context, root);
}

function openShadowRootFor(element: Element): ShadowRoot | undefined {
  try {
    const ownerWindow = element.ownerDocument?.defaultView;
    const ElementConstructor = ownerWindow?.Element ?? (typeof Element === 'undefined' ? undefined : Element);
    const getter =
      ElementConstructor && Object.getOwnPropertyDescriptor(ElementConstructor.prototype, 'shadowRoot')?.get;
    return (getter?.call(element) as ShadowRoot | null | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

async function finishDiscoveredElement(context: LoaderContext, element: Element): Promise<ShadowRoot | undefined> {
  await waitForUpdate(element);
  if (!context.active) return undefined;
  return openShadowRootFor(element);
}

interface DefinitionWork {
  readonly registry: CustomElementRegistry;
  readonly tag: AutoloadableTagName;
}

interface ElementFinishWork {
  readonly element: Element;
  readonly depth: number;
  readonly markerClaim?: PendingMarkerClaim;
  readonly definition?: DefinitionWork;
}

interface PreparedDiscoveryBatch {
  readonly definitions: readonly DefinitionWork[];
  readonly elementsToFinish: readonly ElementFinishWork[];
  readonly state: DiscoveryState;
}

function prepareDiscoveryBatch(
  context: LoaderContext,
  requestedRoots: readonly DiscoveryRoot[],
  state: DiscoveryState,
): PreparedDiscoveryBatch | undefined {
  if (!context.active || requestedRoots.length === 0) return undefined;
  const { roots, elements, elementDepths } = collectDiscoveryBatch(context, requestedRoots, state);
  for (const discoveredRoot of roots) observeRoot(context, discoveredRoot);

  const grouped = new Map<CustomElementRegistry, Map<AutoloadableTagName, Element[]>>();
  const definedElements: ElementFinishWork[] = [];
  const markerClaims = new Map<Element, PendingMarkerClaim | undefined>();
  for (const element of elements) {
    const tag = nativeElementLocalName(element);
    if (!tag) continue;
    if (!AUTOLOADER_TAG_SET.has(tag)) continue;
    const typedTag = tag as AutoloadableTagName;
    const entry = AUTOLOADER_MANIFEST[typedTag];
    const registry = registryForRoot(element);
    if (!registry) {
      continue;
    }
    let alreadyDefined = false;
    try {
      alreadyDefined = typeof registry.get === 'function' && registry.get(typedTag) !== undefined;
    } catch {
      continue;
    }
    if (alreadyDefined) {
      const markerClaim = markPending(context, element);
      definedElements.push({ element, depth: elementDepths.get(element) ?? 0, markerClaim });
      continue;
    }
    if (!isEligible(entry, context.options)) continue;
    markerClaims.set(element, markPending(context, element));
    let tags = grouped.get(registry);
    if (!tags) {
      tags = new Map();
      grouped.set(registry, tags);
    }
    const matches = tags.get(typedTag) ?? [];
    matches.push(element);
    tags.set(typedTag, matches);
  }

  const definitions: DefinitionWork[] = [];
  const elementsToFinish = [...definedElements];
  for (const [registry, tags] of grouped) {
    for (const [tag, matches] of tags) {
      const definition = { registry, tag } satisfies DefinitionWork;
      definitions.push(definition);
      elementsToFinish.push(
        ...matches.map((element) => ({
          element,
          depth: elementDepths.get(element) ?? 0,
          markerClaim: markerClaims.get(element),
          definition,
        })),
      );
    }
  }

  return { definitions, elementsToFinish, state };
}

async function executeDiscoveryBatch(context: LoaderContext, prepared: PreparedDiscoveryBatch): Promise<void> {
  const { definitions, elementsToFinish, state } = prepared;
  try {
    let hasDefinitionFailure = false;
    let firstDefinitionFailure: unknown;
    const failedDefinitions = new Set<DefinitionWork>();
    await runBounded(definitions, context.options.maxConcurrency, async (definition) => {
      try {
        await withWorkSlot(context, () => defineTag(context, definition.registry, definition.tag));
      } catch (error) {
        failedDefinitions.add(definition);
        if (!hasDefinitionFailure) {
          hasDefinitionFailure = true;
          firstDefinitionFailure = error;
        }
      }
    });
    if (!context.active) return;

    const postUpdateRoots = new Map<ShadowRoot, number>();
    await runBounded(elementsToFinish, context.options.maxConcurrency, async (work) => {
      try {
        if (work.definition && failedDefinitions.has(work.definition)) return;
        const shadowRoot = await withWorkSlot(context, () => finishDiscoveredElement(context, work.element));
        if (shadowRoot) postUpdateRoots.set(shadowRoot, work.depth + 1);
      } finally {
        if (work.markerClaim) clearPending(work.markerClaim);
      }
    });
    if (context.active && postUpdateRoots.size > 0) {
      await processDiscoveryBatch(
        context,
        [...postUpdateRoots].map(([root, depth]) => ({ root, depth })),
        state,
      );
    }
    if (hasDefinitionFailure) throw firstDefinitionFailure;
  } finally {
    // Definition/update failures and stop() paths still clear every loader-owned marker.
    for (const { markerClaim } of elementsToFinish) {
      if (markerClaim) clearPending(markerClaim);
    }
  }
}

async function processDiscoveryBatch(
  context: LoaderContext,
  requestedRoots: readonly DiscoveryRoot[],
  state: DiscoveryState,
  queuedClaims: readonly PendingMarkerClaim[] = [],
): Promise<void> {
  const prepared = prepareDiscoveryBatch(context, requestedRoots, state);
  // Batch claims are established before queued claims are released, so the marker never flickers
  // between a serialized insertion and its actual definition/first-update work.
  for (const claim of queuedClaims) clearPending(claim);
  if (prepared) await executeDiscoveryBatch(context, prepared);
}

async function discoverRootsWithContext(
  context: LoaderContext,
  roots: readonly LyraDefinitionRoot[],
): Promise<readonly AutoloadableTagName[]> {
  if (!context.active) return [];
  const before = new Set(context.loadedTags);
  await processDiscoveryBatch(
    context,
    roots.map((root) => ({ root, depth: 0 })),
    newDiscoveryState(),
  );
  return [...context.loadedTags].filter((tag) => !before.has(tag));
}

function queueObservedDiscovery(
  context: LoaderContext,
  roots: readonly DiscoveryRoot[],
  state: DiscoveryState,
): Promise<void> {
  const queuedClaims: PendingMarkerClaim[] = [];
  for (const { root } of roots) {
    if (!isElement(root)) continue;
    const localName = nativeElementLocalName(root);
    if (!localName || !AUTOLOADER_TAG_SET.has(localName)) continue;
    const tag = localName as AutoloadableTagName;
    const registry = registryForRoot(root);
    if (!registry) continue;
    let alreadyDefined = false;
    try {
      alreadyDefined = typeof registry.get === 'function' && registry.get(tag) !== undefined;
    } catch {
      continue;
    }
    if (!alreadyDefined && !isEligible(AUTOLOADER_MANIFEST[tag], context.options)) continue;
    const claim = markPending(context, root);
    if (claim) queuedClaims.push(claim);
  }
  const queued = context.discoveryTail.then(() => processDiscoveryBatch(context, roots, state, queuedClaims));
  context.discoveryTail = queued.then(
    () => undefined,
    () => undefined,
  );
  return queued.finally(() => {
    for (const claim of queuedClaims) clearPending(claim);
  });
}

function createContext(root: LyraDefinitionRoot, options: AutoloaderOptions | undefined): LoaderContext {
  return {
    active: true,
    root,
    options: normalizeOptions(options),
    markerClaims: new Set(),
    definitionLoads: new WeakMap(),
    loadedTags: new Set(),
    observedRoots: new Set(),
    discoveryTail: Promise.resolve(),
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
    return await discoverRootsWithContext(context, [root]);
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
      const state = newDiscoveryState();
      const addedRoots = new Map<LyraDefinitionRoot, number>();
      try {
        if (records.some((record) => record.removedNodes.length > 0)) {
          pruneDetachedObservedRoots(context, state);
        }
        for (const record of records) {
          if (!isReachableFromRoot(context.root, record.target, state, context.options.traversal.maxWork)) continue;
          for (const node of record.addedNodes) {
            const nodeType = nativeNodeType(node);
            if (nodeType !== 1 && nodeType !== 11) continue;
            const depth = renderedDepthFromRoot(context.root, node, state, context.options.traversal.maxWork);
            if (depth !== undefined) addedRoots.set(node as LyraDefinitionRoot, depth);
          }
        }
      } catch (error) {
        if (error instanceof RenderedTreeTraversalError) {
          emit(context, 'lr-autoload-traversal-error', {
            limit: error.limit,
            maximum: error.maximum,
            error,
          });
        }
        return;
      }
      if (addedRoots.size === 0) return;
      void queueObservedDiscovery(
        context,
        [...addedRoots].map(([discoveredRoot, depth]) => ({
          root: discoveredRoot,
          depth,
        })),
        state,
      ).catch((error: unknown) => {
        if (error instanceof RenderedTreeTraversalError) {
          emit(context, 'lr-autoload-traversal-error', {
            limit: error.limit,
            maximum: error.maximum,
            error,
          });
        }
        // Import failures already emit lr-autoload-error. A later DOM insertion or explicit
        // discover() call is allowed to retry rejected imports or a bounded traversal.
      });
    });
  }
  try {
    const initialDiscovery = discoverRootsWithContext(context, [root]);
    context.discoveryTail = initialDiscovery.then(
      () => undefined,
      () => undefined,
    );
    return await initialDiscovery;
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
