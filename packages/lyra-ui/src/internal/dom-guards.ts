const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const DEFAULT_IMAGE_MAP_LOOKUP_MAX_NODES = 10_000;

function hasElementBrand(value: unknown, namespace: string): value is Element {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  try {
    const candidate = value as Element;
    if (candidate.nodeType !== 1 || candidate.namespaceURI !== namespace) return false;
    const ElementConstructor = candidate.ownerDocument?.defaultView?.Element ??
      (typeof Element === 'undefined' ? undefined : Element);
    if (!ElementConstructor) return false;
    // Web-IDL methods brand-check their receiver's internal Element slots across realms. Unlike an
    // `instanceof ownerDocument.defaultView.Element` check, this remains true after adoption:
    // adoption changes `ownerDocument` but intentionally does not rewrite the node's prototype.
    ElementConstructor.prototype.getAttribute.call(candidate, 'data-lyra-brand-probe');
    return true;
  } catch {
    return false;
  }
}

/** Realm-neutral HTML-element brand check. Hostile and structural lookalikes fail closed. */
export function isHtmlElement(value: unknown): value is HTMLElement {
  return hasElementBrand(value, HTML_NAMESPACE);
}

/** Realm-neutral SVG-element brand check, including elements retained across document adoption. */
export function isSvgElement(value: unknown): value is SVGElement {
  return hasElementBrand(value, SVG_NAMESPACE);
}

/** Returns the rendered image that activates an HTML image-map container or area. */
export function imageMapImageFor(
  element: Element,
  options: { consume?: () => boolean; maxNodes?: number } = {},
): HTMLImageElement | null {
  if (!isHtmlElement(element) || (element.localName !== 'area' && element.localName !== 'map')) {
    return null;
  }
  let localWork = 0;
  const localLimit = Number.isFinite(options.maxNodes)
    ? Math.max(0, Math.floor(options.maxNodes!))
    : DEFAULT_IMAGE_MAP_LOOKUP_MAX_NODES;
  const consume = options.consume ?? (() => {
    if (localWork >= localLimit) return false;
    localWork += 1;
    return true;
  });
  let map: HTMLElement | null = element;
  while (map && map.localName !== 'map') {
    if (!consume()) return null;
    map = map.parentElement;
  }
  if (!map || !isHtmlElement(map)) return null;
  if (!consume()) return null;
  const name = (map as HTMLMapElement).name;
  if (name === '') return null;
  const root = map.getRootNode();
  const walker = map.ownerDocument.createTreeWalker(root, 0x1);
  let candidate = root.nodeType === 1 ? root as Element : walker.nextNode() as Element | null;
  while (candidate) {
    if (!consume()) return null;
    if (
      isHtmlElement(candidate) &&
      candidate.localName === 'img' &&
      (candidate as HTMLImageElement).useMap === `#${name}`
    ) {
      return candidate as HTMLImageElement;
    }
    candidate = walker.nextNode() as Element | null;
  }
  return null;
}

/** Realm-neutral native Date brand check. Invalid Dates are still Dates; callers validate time. */
export function isDateObject(value: unknown): value is Date {
  if (typeof value !== 'object' || value === null) return false;
  try {
    Date.prototype.getTime.call(value);
    return true;
  } catch {
    return false;
  }
}

/** Realm-neutral Element brand check (any namespace). Hostile and structural lookalikes fail closed. */
export function isElementNode(value: unknown): value is Element {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  try {
    const candidate = value as Element;
    if (candidate.nodeType !== 1) return false;
    const ElementConstructor = candidate.ownerDocument?.defaultView?.Element ??
      (typeof Element === 'undefined' ? undefined : Element);
    if (!ElementConstructor) return false;
    ElementConstructor.prototype.getAttribute.call(candidate, 'data-lyra-brand-probe');
    return true;
  } catch {
    return false;
  }
}

/** Realm-neutral ShadowRoot check: a DocumentFragment-branded node whose `host` is an element. */
export function isShadowRoot(value: unknown): value is ShadowRoot {
  if (typeof value !== 'object' || value === null) return false;
  try {
    const candidate = value as ShadowRoot;
    if (candidate.nodeType !== 11) return false;
    const FragmentConstructor = candidate.ownerDocument?.defaultView?.DocumentFragment ??
      (typeof DocumentFragment === 'undefined' ? undefined : DocumentFragment);
    if (!FragmentConstructor) return false;
    FragmentConstructor.prototype.getElementById.call(candidate, '');
    return isElementNode(candidate.host);
  } catch {
    return false;
  }
}

const DEFAULT_SOME_NODE_MAX_NODES = 100_000;

/**
 * True when `predicate` accepts `root` or any light-DOM descendant (document order, iterative so
 * depth cannot overflow the stack, bounded by `maxNodes`). A throwing predicate counts as no match.
 */
export function someNode(
  root: Node,
  predicate: (node: Node) => boolean,
  maxNodes = DEFAULT_SOME_NODE_MAX_NODES,
): boolean {
  const stack: Node[] = [root];
  let visited = 0;
  while (stack.length > 0 && visited < maxNodes) {
    const node = stack.pop()!;
    visited += 1;
    try {
      if (predicate(node)) return true;
      const children = node.childNodes;
      for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]!);
    } catch {
      // A hostile node cannot be inspected; keep scanning its siblings.
    }
  }
  return false;
}

/** True when `element` or a light-DOM descendant is a `<slot>`. */
export function containsSlot(element: Element): boolean {
  return someNode(element, (node) => isElementNode(node) && node.localName === 'slot');
}

/** True when `node` is a `<slot>` or an element whose light-DOM subtree contains one. */
export function nodeContainsSlot(node: Node): boolean {
  return node.nodeType === 1 &&
    ((node as Element).localName === 'slot' || (node as Element).querySelector?.('slot') != null);
}

/** True when `predicate` accepts any node of a `NodeList`/array (the roots only, not descendants). */
export function someListedNode(nodes: ArrayLike<Node>, predicate: (node: Node) => boolean): boolean {
  for (let index = 0; index < nodes.length; index += 1) if (predicate(nodes[index]!)) return true;
  return false;
}
