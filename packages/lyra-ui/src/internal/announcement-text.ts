import {
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
export function composedAccessibilityText(node: Node, inheritedTextVisible = true): string {
  if (node.nodeType === 3) return inheritedTextVisible ? node.textContent ?? '' : '';
  if (node.nodeType === 11) {
    return Array.from(node.childNodes, (child) =>
      composedAccessibilityText(child, inheritedTextVisible)).join(' ');
  }
  if (node.nodeType !== 1) return '';

  const element = node as Element;
  if (
    isAccessibilitySubtreeExcluded(element) ||
    NON_CONTENT_ELEMENTS.has(element.localName)
  ) {
    return '';
  }

  // Computed visibility already includes inheritance. A descendant can explicitly restore
  // visibility, so this value replaces rather than combines with inheritedTextVisible.
  const ownTextVisible = !isAccessibilityVisibilityHidden(element);
  const label = ownTextVisible ? element.getAttribute('aria-label')?.trim() : '';
  if (label) return label;

  if (ownTextVisible && element.localName === 'img') {
    const alt = element.getAttribute('alt')?.trim();
    if (alt) return alt;
  }

  return renderedChildNodes(element)
    .map((child) => composedAccessibilityText(child, ownTextVisible))
    .join(' ');
}
