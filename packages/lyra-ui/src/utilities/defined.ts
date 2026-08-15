import { AUTOLOADER_TAG_SET } from '../internal/autoloader-tags.js';
import { registryForRoot, type LyraDefinitionRoot } from '../internal/definition-registry.js';
import {
  collectRenderedTree,
  nativeElementLocalName,
  renderedTreeTraversalLimits,
  type RenderedTreeTraversalOptions,
  type RenderedTreeTraversalState,
} from '../internal/rendered-tree-traversal.js';

export type { LyraDefinitionRoot } from '../internal/definition-registry.js';

interface UpdateCompleteElement extends Element {
  readonly updateComplete?: Promise<unknown>;
}

/** Resource ceilings for {@link allDefined}. Every limit is a nonnegative integer except
 * `maxPasses`, which must be at least one. Exceeding a ceiling rejects the returned promise. */
export interface AllDefinedOptions extends RenderedTreeTraversalOptions {
  /** Maximum render/upgrade discovery passes. Default 100. */
  readonly maxPasses?: number;
}

function defaultRoot(): LyraDefinitionRoot | undefined {
  return typeof document === 'undefined' ? undefined : document;
}

function maxPasses(value: number | undefined): number {
  const resolved = value ?? 100;
  if (!Number.isFinite(resolved) || !Number.isInteger(resolved) || resolved < 1) {
    throw new RangeError('allDefined() maxPasses must be an integer >= 1');
  }
  return resolved;
}

function whenDefined(registry: CustomElementRegistry, tagName: string): Promise<CustomElementConstructor> | undefined {
  try {
    const method = registry.whenDefined;
    if (typeof method !== 'function') return undefined;
    return method.call(registry, tagName);
  } catch {
    return undefined;
  }
}

function isDefined(registry: CustomElementRegistry, tagName: string): boolean {
  try {
    return typeof registry.get === 'function' && registry.get(tagName) !== undefined;
  } catch {
    return false;
  }
}

function updateCompleteFor(element: Element): Promise<unknown> | undefined {
  try {
    const updateComplete = (element as UpdateCompleteElement).updateComplete;
    return updateComplete && typeof updateComplete.then === 'function' ? updateComplete : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolves after every currently rendered, known `lr-*` element below `root` is defined.
 *
 * Open shadow roots are traversed iteratively. The registry associated with each element's own
 * root is used, so scoped registries and elements in another same-realm document do not fall back
 * to the ambient global registry. Unknown `lr-*` tags are ignored rather than making the promise
 * hang forever. With no browser document (or no registry), this helper resolves immediately.
 * `options` bounds retained elements/roots and total traversal work; exceeding a ceiling rejects
 * rather than returning a partial readiness result. A consumer-owned element whose registry or
 * update-completion accessors throw is treated as unavailable without blocking valid siblings.
 */
export async function allDefined(
  root: LyraDefinitionRoot | undefined = defaultRoot(),
  options: AllDefinedOptions = {},
): Promise<void> {
  const limits = renderedTreeTraversalLimits(options, 'allDefined()');
  const passLimit = maxPasses(options.maxPasses);
  if (!root) return;

  const traversalState: RenderedTreeTraversalState = {
    work: 0,
    elements: new Set(),
    roots: new Set(),
  };
  let pass = 0;

  while (true) {
    const collected = collectRenderedTree(root, limits, traversalState, 'allDefined()');
    const elements = collected.elements;
    if (elements.length === 0) return;
    pass += 1;
    if (pass > passLimit) {
      throw new Error(`allDefined() exceeded maxPasses (${passLimit})`);
    }

    const definitions = new Map<CustomElementRegistry, Set<string>>();
    const pendingDefinitions: Promise<unknown>[] = [];

    for (const element of elements) {
      const tagName = nativeElementLocalName(element);
      if (!tagName || !AUTOLOADER_TAG_SET.has(tagName)) continue;
      const registry = registryForRoot(element);
      if (!registry) continue;
      let tags = definitions.get(registry);
      if (!tags) {
        tags = new Set();
        definitions.set(registry, tags);
      }
      if (tags.has(tagName)) continue;
      tags.add(tagName);
      const pending = whenDefined(registry, tagName);
      if (pending) pendingDefinitions.push(pending);
    }

    await Promise.all(pendingDefinitions);

    const pendingUpdates: Promise<unknown>[] = [];
    for (const element of elements) {
      const tagName = nativeElementLocalName(element);
      if (!tagName || !AUTOLOADER_TAG_SET.has(tagName)) continue;
      const registry = registryForRoot(element);
      if (!registry || !isDefined(registry, tagName)) continue;
      const updateComplete = updateCompleteFor(element);
      if (updateComplete) pendingUpdates.push(updateComplete);
    }
    await Promise.all(pendingUpdates);
  }
}
