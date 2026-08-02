/** A DOM root whose currently rendered Lyra elements can be inspected or loaded. */
export type LyraDefinitionRoot = Document | DocumentFragment | Element;

interface RegistryBearingRoot {
  readonly customElements?: CustomElementRegistry;
  readonly customElementRegistry?: CustomElementRegistry;
}

function explicitRegistry(value: unknown): CustomElementRegistry | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as RegistryBearingRoot;
  return candidate.customElementRegistry ?? candidate.customElements;
}

/** Resolves a scoped registry first, then the root's owning-window registry. */
export function registryForRoot(root: LyraDefinitionRoot): CustomElementRegistry | undefined {
  if ('getRootNode' in root && typeof root.getRootNode === 'function') {
    const containingRoot = root.getRootNode();
    const scoped = explicitRegistry(containingRoot);
    if (scoped) return scoped;
  }

  const direct = explicitRegistry(root);
  if (direct) return direct;

  const ownerDocument = root.nodeType === 9 ? (root as Document) : root.ownerDocument;
  return ownerDocument?.defaultView?.customElements;
}
