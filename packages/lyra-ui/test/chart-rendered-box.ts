/** Painted box of the first occurrence of text under a chart surface. */
export function renderedChartTextBox(root: Element, needle: string): DOMRect {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const index = node.data.indexOf(needle);
    if (index < 0) continue;
    const range = root.ownerDocument.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + needle.length);
    return range.getBoundingClientRect();
  }
  throw new Error(`"${needle}" is not rendered in ${root.localName}`);
}
