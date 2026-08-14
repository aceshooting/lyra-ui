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
}

export interface RenderedTreeTraversalResult {
  readonly roots: readonly LyraDefinitionRoot[];
  readonly elements: readonly Element[];
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
  name: RenderedTreeTraversalLimit
): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || !Number.isInteger(resolved) || resolved < 0) {
    throw new RangeError(`${operation} ${name} must be an integer >= 0`);
  }
  return resolved;
}

export function renderedTreeTraversalLimits(
  options: RenderedTreeTraversalOptions,
  operation: string
): RenderedTreeTraversalLimits {
  return {
    maxElements: finiteLimit(
      options.maxElements,
      DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS.maxElements,
      operation,
      'maxElements'
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

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

/**
 * Iteratively collects a rendered light/open-shadow tree. A limit throws before the candidate is
 * retained, so callers never mistake a partial prefix for complete discovery.
 */
export function collectRenderedTree(
  root: LyraDefinitionRoot,
  limits: RenderedTreeTraversalLimits,
  state: RenderedTreeTraversalState,
  operation: string
): RenderedTreeTraversalResult {
  const roots: LyraDefinitionRoot[] = [];
  const elements: Element[] = [];
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
    if (seenRoots.size >= limits.maxRoots) {
      throw new RenderedTreeTraversalError(operation, 'maxRoots', limits.maxRoots);
    }
    spendWork();
    seenRoots.add(candidate);
    roots.push(candidate);
    rootWork.push({ root: candidate, depth });
  };

  const enqueueElement = (element: Element, depth: number): void => {
    if (seenElements.has(element)) return;
    checkDepth(depth);
    if (seenElements.size >= limits.maxElements) {
      throw new RenderedTreeTraversalError(operation, 'maxElements', limits.maxElements);
    }
    spendWork();
    seenElements.add(element);
    elements.push(element);
    elementWork.push({ element, depth });
  };

  enqueueRoot(root, 0);
  while (rootIndex < rootWork.length || elementIndex < elementWork.length) {
    while (rootIndex < rootWork.length) {
      const current = rootWork[rootIndex++]!;
      if (isElement(current.root)) enqueueElement(current.root, current.depth);
      else {
        for (let child = current.root.firstElementChild; child; child = child.nextElementSibling) {
          enqueueElement(child, current.depth);
        }
      }
    }

    if (elementIndex >= elementWork.length) continue;
    const current = elementWork[elementIndex++]!;
    for (let child = current.element.firstElementChild; child; child = child.nextElementSibling) {
      enqueueElement(child, current.depth + 1);
    }
    if (current.element.shadowRoot) enqueueRoot(current.element.shadowRoot, current.depth + 1);
  }

  return { roots, elements };
}
