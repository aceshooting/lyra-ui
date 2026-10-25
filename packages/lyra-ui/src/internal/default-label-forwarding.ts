/** Whether a light-DOM root belongs to a control's unnamed label slot. */
export function isDefaultLabelNode(node: Node): boolean {
  if (node.nodeType !== 1) return true;
  const slotName = (node as Element).getAttribute('slot');
  return slotName === null || slotName === '';
}

/** Forwarding slots below an unnamed light-DOM label root, in document order. */
export function defaultLabelForwardingSlots(host: Element): HTMLSlotElement[] {
  return Array.from(host.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
    let top: Node = slot;
    while (top.parentNode && top.parentNode !== host) top = top.parentNode;
    return top.parentNode === host && isDefaultLabelNode(top);
  });
}
