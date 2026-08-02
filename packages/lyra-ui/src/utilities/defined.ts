import { AUTOLOADER_TAG_SET } from '../internal/autoloader-tags.js';
import {
  registryForRoot,
  type LyraDefinitionRoot,
} from '../internal/definition-registry.js';

export type { LyraDefinitionRoot } from '../internal/definition-registry.js';

interface UpdateCompleteElement extends Element {
  readonly updateComplete?: Promise<unknown>;
}

function defaultRoot(): LyraDefinitionRoot | undefined {
  return typeof document === 'undefined' ? undefined : document;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function collectElements(root: LyraDefinitionRoot): Element[] {
  const elements: Element[] = [];
  const seenElements = new Set<Element>();
  const seenRoots = new Set<LyraDefinitionRoot>();

  const visit = (current: LyraDefinitionRoot): void => {
    if (seenRoots.has(current)) return;
    seenRoots.add(current);

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
  return elements;
}

/**
 * Resolves after every currently rendered, known `lr-*` element below `root` is defined.
 *
 * Open shadow roots are traversed recursively. The registry associated with each element's own
 * root is used, so scoped registries and elements in another same-realm document do not fall back
 * to the ambient global registry. Unknown `lr-*` tags are ignored rather than making the promise
 * hang forever. With no browser document (or no registry), this helper resolves immediately.
 */
export async function allDefined(root: LyraDefinitionRoot | undefined = defaultRoot()): Promise<void> {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  const seenElements = new Set<Element>();
  let pass = 0;

  while (true) {
    pass += 1;
    if (pass > 100) {
      throw new Error('allDefined() exceeded 100 nested custom-element upgrade passes');
    }
    const collected = collectElements(root);
    const elements = collected.filter((element) => !seenElements.has(element));
    if (elements.length === 0) return;
    for (const element of elements) seenElements.add(element);

    const definitions = new Map<CustomElementRegistry, Set<string>>();
    const pendingDefinitions: Promise<unknown>[] = [];

    for (const element of elements) {
      if (!AUTOLOADER_TAG_SET.has(element.localName)) continue;
      const registry = registryForRoot(element);
      if (!registry) continue;
      let tags = definitions.get(registry);
      if (!tags) {
        tags = new Set();
        definitions.set(registry, tags);
      }
      if (tags.has(element.localName)) continue;
      tags.add(element.localName);
      pendingDefinitions.push(registry.whenDefined(element.localName));
    }

    await Promise.all(pendingDefinitions);

    const pendingUpdates: Promise<unknown>[] = [];
    for (const element of elements) {
      if (!AUTOLOADER_TAG_SET.has(element.localName)) continue;
      const registry = registryForRoot(element);
      if (!registry?.get(element.localName)) continue;
      const updateComplete = (element as UpdateCompleteElement).updateComplete;
      if (updateComplete && typeof updateComplete.then === 'function') pendingUpdates.push(updateComplete);
    }
    await Promise.all(pendingUpdates);
  }
}
