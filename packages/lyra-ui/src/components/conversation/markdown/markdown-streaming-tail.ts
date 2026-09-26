import { noChange, type ChildPart } from 'lit';
import { directive, Directive, PartType, type PartInfo } from 'lit/directive.js';

/** Appends to a stable Text node so native ranges keep their existing offsets during streaming. */
class StreamingTailText extends Directive {
  private node?: Text;
  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.CHILD) throw new Error('Streaming text requires a child part.');
  }
  render(text: string): string { return text; }
  override update(part: ChildPart, [text]: [string]): Text | typeof noChange {
    super.update(part, [text]);
    const node = this.node;
    if (!node || node.parentNode !== part.parentNode || node.previousSibling !== part.startNode || node.nextSibling !== part.endNode) {
      this.node = part.parentNode.ownerDocument!.createTextNode(text);
      return this.node;
    }
    if (text.startsWith(node.data)) node.appendData(text.slice(node.length));
    else if (node.data !== text) node.data = text;
    return noChange;
  }
}

export const streamingTailText = directive(StreamingTailText);
