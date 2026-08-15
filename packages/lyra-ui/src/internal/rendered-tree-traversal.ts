import type { LyraDefinitionRoot } from './definition-registry.js';

/** Shared ceilings for iterative traversal of a rendered tree, including caller-owned open roots. */
export interface RenderedTreeTraversalOptions {
  /** Maximum retained elements. Default 10,000. */
  readonly maxElements?: number;
  /** Maximum supplied/open-shadow roots. Default 2,000. */
  readonly maxRoots?: number;
  /** Maximum light/shadow nesting depth. Default 256. */
  readonly maxDepth?: number;
  /** Maximum root/element visits. Default 100,000. */
  readonly maxWork?: number;
}

export type RenderedTreeTraversalLimit = keyof RenderedTreeTraversalOptions;

export interface RenderedTreeTraversalLimits {
  readonly maxElements: number;
  readonly maxRoots: number;
  readonly maxDepth: number;
  readonly maxWork: number;
}

export interface RenderedTreeTraversalState {
  work: number;
  /** Optional operation-wide retained-element set shared by repeated scans. */
  readonly elements?: Set<Element>;
  /** Optional operation-wide retained-root set shared by repeated scans. */
  readonly roots?: Set<LyraDefinitionRoot>;
}

export interface RenderedTreeTraversalResult {
  readonly roots: readonly LyraDefinitionRoot[];
  readonly elements: readonly Element[];
  /** Rendered-tree depth for every newly retained root in this scan. */
  readonly rootDepths: ReadonlyMap<LyraDefinitionRoot, number>;
  /** Rendered-tree depth for every newly retained element in this scan. */
  readonly elementDepths: ReadonlyMap<Element, number>;
}

/** A truthful, inspectable failure instead of a partial traversal result. */
export class RenderedTreeTraversalError extends Error {
  override readonly name = 'RenderedTreeTraversalError';

  constructor(readonly operation: string, readonly limit: RenderedTreeTraversalLimit, readonly maximum: number) {
    super(`${operation} exceeded ${limit} (${maximum})`);
  }
}

export const DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS: RenderedTreeTraversalLimits = Object.freeze({
  maxElements: 10_000,
  maxRoots: 2_000,
  maxDepth: 256,
  maxWork: 100_000,
});

function finiteLimit(
  value: number | undefined,
  fallback: number,
  operation: string,
  name: RenderedTreeTraversalLimit,
): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || !Number.isInteger(resolved) || resolved < 0) {
    throw new RangeError(`${operation} ${name} must be an integer >= 0`);
  }
  return resolved;
}

export function renderedTreeTraversalLimits(
  options: RenderedTreeTraversalOptions,
  operation: string,
): RenderedTreeTraversalLimits {
  return {
    maxElements: finiteLimit(
      options.maxElements,
      DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS.maxElements,
      operation,
      'maxElements',
    ),
    maxRoots: finiteLimit(options.maxRoots, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS.maxRoots, operation, 'maxRoots'),
    maxDepth: finiteLimit(options.maxDepth, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS.maxDepth, operation, 'maxDepth'),
    maxWork: finiteLimit(options.maxWork, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS.maxWork, operation, 'maxWork'),
  };
}

interface RootWork {
  readonly root: LyraDefinitionRoot;
  readonly depth: number;
}

interface ElementWork {
  readonly element: Element;
  readonly depth: number;
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

function isElement(node: Node): node is Element {
  return nativeNodeType(node) === 1;
}

function ownerDocumentFor(node: Node): Document | undefined {
  if (nativeNodeType(node) === 9) return node as Document;
  try {
    const ambientGetter =
      typeof Node === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(Node.prototype, 'ownerDocument')?.get;
    return (ambientGetter?.call(node) as Document | null | undefined) ?? node.ownerDocument ?? undefined;
  } catch {
    return undefined;
  }
}

/** Uses the owner realm's native accessor so an own consumer getter cannot abort sibling work. */
export function nativeElementLocalName(element: Element): string | undefined {
  try {
    const ownerWindow = ownerDocumentFor(element)?.defaultView;
    const ElementConstructor = ownerWindow?.Element ?? (typeof Element === 'undefined' ? undefined : Element);
    const getter =
      ElementConstructor && Object.getOwnPropertyDescriptor(ElementConstructor.prototype, 'localName')?.get;
    const localName = getter?.call(element) as unknown;
    return typeof localName === 'string' ? localName : undefined;
  } catch {
    return undefined;
  }
}

/** Uses the owner realm's native accessors so hostile own getters cannot block valid siblings. */
function childElements(node: Node): readonly Element[] {
  try {
    const ownerWindow = ownerDocumentFor(node)?.defaultView;
    const NodeConstructor = ownerWindow?.Node ?? (typeof Node === 'undefined' ? undefined : Node);
    const getter = NodeConstructor && Object.getOwnPropertyDescriptor(NodeConstructor.prototype, 'childNodes')?.get;
    const childNodes = (getter?.call(node) ?? node.childNodes) as NodeListOf<ChildNode>;
    const elements: Element[] = [];
    for (let index = 0; index < childNodes.length; index += 1) {
      const child = childNodes.item(index);
      if (child && isElement(child)) elements.push(child);
    }
    return elements;
  } catch {
    return [];
  }
}

/** Returns only an open shadow root and fails soft for consumer-shadowed native accessors. */
function openShadowRoot(element: Element): ShadowRoot | undefined {
  try {
    const ownerWindow = ownerDocumentFor(element)?.defaultView;
    const ElementConstructor = ownerWindow?.Element ?? (typeof Element === 'undefined' ? undefined : Element);
    const getter =
      ElementConstructor && Object.getOwnPropertyDescriptor(ElementConstructor.prototype, 'shadowRoot')?.get;
    return (getter?.call(element) as ShadowRoot | null | undefined) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Iteratively collects a rendered light/open-shadow tree. A limit throws before the candidate is
 * retained, so callers never mistake a partial prefix for complete discovery.
 */
export function collectRenderedTree(
  root: LyraDefinitionRoot,
  limits: RenderedTreeTraversalLimits,
  state: RenderedTreeTraversalState,
  operation: string,
  initialDepth = 0,
): RenderedTreeTraversalResult {
  const roots: LyraDefinitionRoot[] = [];
  const elements: Element[] = [];
  const rootDepths = new Map<LyraDefinitionRoot, number>();
  const elementDepths = new Map<Element, number>();
  const seenRoots = new Set<LyraDefinitionRoot>();
  const seenElements = new Set<Element>();
  const rootWork: RootWork[] = [];
  const elementWork: ElementWork[] = [];
  let rootIndex = 0;
  let elementIndex = 0;

  const spendWork = (): void => {
    if (state.work >= limits.maxWork) {
      throw new RenderedTreeTraversalError(operation, 'maxWork', limits.maxWork);
    }
    state.work += 1;
  };

  const checkDepth = (depth: number): void => {
    if (depth > limits.maxDepth) {
      throw new RenderedTreeTraversalError(operation, 'maxDepth', limits.maxDepth);
    }
  };

  const enqueueRoot = (candidate: LyraDefinitionRoot, depth: number): void => {
    if (seenRoots.has(candidate)) return;
    checkDepth(depth);
    const retainedRoots = state.roots ?? seenRoots;
    const isNew = !retainedRoots.has(candidate);
    if (isNew && retainedRoots.size >= limits.maxRoots) {
      throw new RenderedTreeTraversalError(operation, 'maxRoots', limits.maxRoots);
    }
    spendWork();
    seenRoots.add(candidate);
    rootWork.push({ root: candidate, depth });
    if (isNew) {
      retainedRoots.add(candidate);
      roots.push(candidate);
      rootDepths.set(candidate, depth);
    }
  };

  const enqueueElement = (element: Element, depth: number): void => {
    if (seenElements.has(element)) return;
    checkDepth(depth);
    const retainedElements = state.elements ?? seenElements;
    const isNew = !retainedElements.has(element);
    if (isNew && retainedElements.size >= limits.maxElements) {
      throw new RenderedTreeTraversalError(operation, 'maxElements', limits.maxElements);
    }
    spendWork();
    seenElements.add(element);
    elementWork.push({ element, depth });
    if (isNew) {
      retainedElements.add(element);
      elements.push(element);
      elementDepths.set(element, depth);
    }
  };

  enqueueRoot(root, initialDepth);
  while (rootIndex < rootWork.length || elementIndex < elementWork.length) {
    while (rootIndex < rootWork.length) {
      const current = rootWork[rootIndex++]!;
      if (isElement(current.root)) enqueueElement(current.root, current.depth);
      else {
        for (const child of childElements(current.root)) enqueueElement(child, current.depth);
      }
    }

    if (elementIndex >= elementWork.length) continue;
    const current = elementWork[elementIndex++]!;
    for (const child of childElements(current.element)) enqueueElement(child, current.depth + 1);
    const shadowRoot = openShadowRoot(current.element);
    if (shadowRoot) enqueueRoot(shadowRoot, current.depth + 1);
  }

  return { roots, elements, rootDepths, elementDepths };
}
