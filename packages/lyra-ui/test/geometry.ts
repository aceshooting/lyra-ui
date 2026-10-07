/** Returns the center of an element's rendered box. */
export function centerOf(target: Element): [number, number] {
  const rect = target.getBoundingClientRect();
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

/** Measures the first rendered occurrence of text under a root. */
export function glyphRect(root: Node, needle: string): DOMRect {
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const index = (node as Text).data.indexOf(needle);
    if (index === -1) continue;
    const range = doc.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + needle.length);
    return range.getClientRects()[0] ?? range.getBoundingClientRect();
  }
  throw new Error(`text ${JSON.stringify(needle)} not rendered`);
}
