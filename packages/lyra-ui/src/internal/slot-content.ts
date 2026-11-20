import { hasRealContent } from './a11y.js';

/** Realm-neutral slot check: constructor identity is not shared across iframe documents. */
export function isSlotElement(node: Node): node is HTMLSlotElement {
  return (
    node.nodeType === 1 &&
    (node as Element).localName === 'slot' &&
    typeof (node as Partial<HTMLSlotElement>).assignedNodes === 'function'
  );
}

/** Resolves only real assignments through forwarding slots. Native `flatten: true` substitutes an
 * unassigned nested slot's fallback, but that fallback is component chrome rather than consumer
 * content. The active-path set also makes malformed/crafted assignment cycles fail closed. */
function assignedConsumerNodes(slot: HTMLSlotElement, active = new Set<Node>()): Node[] {
  if (active.has(slot)) return [];
  active.add(slot);
  const resolved: Node[] = [];
  for (const node of slot.assignedNodes()) {
    if (isSlotElement(node)) resolved.push(...assignedConsumerNodes(node, active));
    else resolved.push(node);
  }
  active.delete(slot);
  return resolved;
}

/**
 * Whether `host`'s light DOM carries real consumer content for the slot `name` (omit for the
 * default slot). A forwarding `<slot slot=name>` counts only for what is really assigned to it,
 * never for its own fallback children, so a wrapper that forwards an empty slot reads as empty.
 * The one presence predicate behind `SlotPresenceController`; components whose slotchange
 * handler carries other side effects call it directly.
 */
export function hasSlotContent(host: Element, name = ''): boolean {
  return hasRealContent(slotConsumerNodes(host, name));
}

/** No content, content that carries text, or content made only of textless elements (icons, images). */
export type SlotContentKind = 0 | 1 | 2;

/** `hasRealContent` semantics, also telling text-bearing content apart from graphic-only content. */
export function slotContentKindOf(nodes: Iterable<Node>): SlotContentKind {
  let content: SlotContentKind = 0;
  for (const node of nodes) {
    if ((node.textContent ?? '').trim().length > 0) return 1;
    if (node.nodeType === 1) content = 2;
  }
  return content;
}

/** {@link hasSlotContent}, also telling text-bearing content apart from graphic-only content. */
export function slotContentKind(host: Element, name = ''): SlotContentKind {
  return slotContentKindOf(slotConsumerNodes(host, name));
}

/** The consumer nodes assigned to `name`, resolved through forwarding slots. */
function slotConsumerNodes(host: Element, name: string): Node[] {
  if (typeof Node === 'undefined' || !('childNodes' in host)) return [];
  const resolved: Node[] = [];
  for (const node of Array.from(host.childNodes)) {
    const assignedName =
      node.nodeType === Node.ELEMENT_NODE ? ((node as Element).getAttribute('slot') ?? '') : '';
    if (assignedName !== name) continue;
    if (isSlotElement(node)) resolved.push(...assignedConsumerNodes(node));
    else resolved.push(node);
  }
  return resolved;
}
