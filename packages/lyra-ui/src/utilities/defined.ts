import {
  normalizeAllDefinedArguments,
  type AllDefinedWaitOptions,
} from '../internal/all-defined-arguments.js';
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
export type { AllDefinedWaitOptions } from '../internal/all-defined-arguments.js';

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
export function allDefined(
  root?: LyraDefinitionRoot | undefined,
  options?: AllDefinedOptions,
): Promise<void>;
/**
 * Options form: `allDefined({ match, additionalElements, root, timeout })`. Without `match` it
 * waits for the rendered known `lr-*` tags exactly like the root form; with `match` it waits for
 * every currently undefined element under `root` whose lowercase tag name the function accepts.
 * `additionalElements` names tags that may not be on the page yet. After `timeout` milliseconds
 * (default 2000, `Infinity` to disable) a console warning lists the tags still undefined and the
 * promise resolves anyway. The root form never times out.
 */
export function allDefined(options: AllDefinedWaitOptions): Promise<void>;
export async function allDefined(
  first?: LyraDefinitionRoot | AllDefinedWaitOptions,
  second?: AllDefinedOptions,
): Promise<void> {
  const normalized = normalizeAllDefinedArguments(first, second, defaultRoot);
  if (normalized.mode === 'options') return allDefinedWithOptions(normalized);
  return allDefinedRoot(normalized.root, (normalized.options ?? {}) as AllDefinedOptions);
}

async function allDefinedWithOptions(
  opts: Extract<ReturnType<typeof normalizeAllDefinedArguments>, { mode: 'options' }>,
): Promise<void> {
  const root = opts.root;
  const registry = (root && registryForRoot(root)) ?? (typeof customElements === 'undefined' ? undefined : customElements);
  const tags = new Set<string>(opts.additionalElements);
  const known = (tag: string): boolean => (registry ? isDefined(registry, tag) : true);
  if (root && opts.match) {
    const match = opts.match;
    for (const element of root.querySelectorAll(':not(:defined)')) {
      const tag = nativeElementLocalName(element);
      if (tag && tag.includes('-') && match(tag)) tags.add(tag);
    }
  }
  const work = (async () => {
    if (!opts.match) await allDefinedRoot(root, {});
    if (registry) await Promise.all([...tags].map((tag) => whenDefined(registry, tag) ?? Promise.resolve()));
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<void>((resolve) => {
    if (opts.timeout === Infinity) return;
    timer = setTimeout(() => {
      const pending = [...tags].filter((tag) => !known(tag));
      console.warn(`allDefined() timed out after ${opts.timeout}ms waiting for: ${pending.join(', ')}`);
      resolve();
    }, opts.timeout);
  });
  try {
    await Promise.race([work, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function allDefinedRoot(
  root: LyraDefinitionRoot | undefined,
  options: AllDefinedOptions,
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
