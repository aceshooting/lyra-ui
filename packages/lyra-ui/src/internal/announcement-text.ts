import {
  composedParentElement,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisibilityHidden,
} from './accessibility-visibility.js';

const NON_CONTENT_ELEMENTS = new Set(['script', 'style', 'template']);

function renderedChildNodes(element: Element): Node[] {
  const slot = element as Element & {
    assignedNodes?: (options?: AssignedNodesOptions) => Node[];
  };
  if (element.localName === 'slot' && typeof slot.assignedNodes === 'function') {
    // Flattened assignment includes fallback nodes when nothing is assigned. Check direct
    // assignment first so an assigned but accessibility-hidden branch never leaks fallback text.
    return slot.assignedNodes().length > 0
      ? slot.assignedNodes({ flatten: true })
      : Array.from(element.childNodes);
  }

  if (element.localName === 'details' && !element.hasAttribute('open')) {
    const summary = Array.from(element.children).find((child) => child.localName === 'summary');
    return summary ? [summary] : [];
  }

  // Raw light-DOM children of a shadow host can include named-slot content that is not rendered.
  // An open root exposes the actual composed branch; its slots resolve the rendered assignments.
  if (element.shadowRoot) return Array.from(element.shadowRoot.childNodes);

  return Array.from(element.childNodes);
}

/**
 * Extracts the text exposed by a rendered composed subtree for a live announcement.
 *
 * The returned value intentionally preserves source whitespace. Announcement producers can apply
 * their own normalization and context punctuation after combining multiple roots.
 */
const MAX_ACCESSIBILITY_TEXT_NODES = 10_000;

type AccessibilityTextContext = {
  labelReferenceRoots: Set<Document | ShadowRoot>;
  remaining: number;
  referencedElements: Set<Element>;
  visited: Set<Node>;
};

export type ComposedAccessibilityTextResult = {
  labelReferenceRoots: ReadonlySet<Document | ShadowRoot>;
  text: string;
  referencedElements: ReadonlySet<Element>;
};

function hasExcludedComposedAncestor(element: Element): boolean {
  let current: Element | null = element;
  while (current) {
    if (isAccessibilitySubtreeExcluded(current)) return true;
    current = composedParentElement(current);
  }
  return false;
}

function addLabelReferenceRoot(context: AccessibilityTextContext, node: Node): void {
  const root = node.getRootNode();
  if (root.nodeType === 9 || (root.nodeType === 11 && 'host' in root)) {
    context.labelReferenceRoots.add(root as Document | ShadowRoot);
  }
}

function labelledByElements(element: Element, context: AccessibilityTextContext): Element[] {
  const reflected = (element as Element & { ariaLabelledByElements?: readonly Element[] | null })
    .ariaLabelledByElements;
  if (reflected?.length) {
    for (const reference of reflected) addLabelReferenceRoot(context, reference);
    return [...reflected];
  }
  const ids = element.getAttribute('aria-labelledby')?.trim().split(/\s+/).filter(Boolean) ?? [];
  const root = element.getRootNode() as Document | ShadowRoot;
  // Enroll the identity root even while every id is unresolved. Insertion, replacement, removal,
  // or an id-only transfer can then trigger a fresh bounded traversal without requiring the
  // referencing element itself to mutate.
  if (ids.length > 0) addLabelReferenceRoot(context, element);
  return ids.flatMap((id) => root.getElementById?.(id) ?? []);
}

function accessibilityText(
  node: Node,
  inheritedTextVisible: boolean,
  context: AccessibilityTextContext,
  referenced = false,
): string {
  if (context.remaining-- <= 0 || context.visited.has(node)) return '';
  context.visited.add(node);
  if (node.nodeType === 3) return inheritedTextVisible ? node.textContent ?? '' : '';
  if (node.nodeType === 11) {
    return Array.from(node.childNodes, (child) =>
      accessibilityText(child, inheritedTextVisible, context, referenced)).join(' ');
  }
  if (node.nodeType !== 1) return '';

  const element = node as Element;
  if (
    (!referenced && hasExcludedComposedAncestor(element)) ||
    NON_CONTENT_ELEMENTS.has(element.localName)
  ) {
    return '';
  }

  // Computed visibility already includes inheritance. A descendant can explicitly restore
  // visibility, so this value replaces rather than combines with inheritedTextVisible.
  // A hidden subtree explicitly reached through aria-labelledby still participates in the
  // accessible-name traversal. Keep that referenced state for the complete subtree rather than
  // applying ordinary rendered-text visibility to its descendants.
  const ownTextVisible = referenced || !isAccessibilityVisibilityHidden(element);
  const labelledBy = ownTextVisible ? labelledByElements(element, context) : [];
  if (labelledBy.length > 0) {
    for (const label of labelledBy) context.referencedElements.add(label);
    return labelledBy
      .map((label) => accessibilityText(label, true, context, true))
      .join(' ');
  }
  const label = ownTextVisible ? element.getAttribute('aria-label')?.trim() : '';
  if (label) return label;

  if (ownTextVisible && element.localName === 'img') {
    const alt = element.getAttribute('alt')?.trim();
    if (alt) return alt;
  }

  return renderedChildNodes(element)
    .map((child) => accessibilityText(child, ownTextVisible, context, referenced))
    .join(' ');
}

export function composedAccessibilityTextResult(
  node: Node,
  inheritedTextVisible = true,
): ComposedAccessibilityTextResult {
  const context: AccessibilityTextContext = {
    labelReferenceRoots: new Set<Document | ShadowRoot>(),
    remaining: MAX_ACCESSIBILITY_TEXT_NODES,
    referencedElements: new Set<Element>(),
    visited: new Set<Node>(),
  };
  return {
    labelReferenceRoots: context.labelReferenceRoots,
    text: accessibilityText(node, inheritedTextVisible, context),
    referencedElements: context.referencedElements,
  };
}

export function composedAccessibilityText(node: Node, inheritedTextVisible = true): string {
  return composedAccessibilityTextResult(node, inheritedTextVisible).text;
}
