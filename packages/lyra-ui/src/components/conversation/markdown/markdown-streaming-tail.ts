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


import { insertPart, removePart, setChildPartValue, setCommittedValue } from 'lit/directive-helpers.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

/** Stable committed groups update only from the session's first changed block. */
class ProgressiveMarkdownBlocks extends Directive {
  private parts: ChildPart[] = [];
  private revision?: number;
  private blocks?: readonly { html: string }[];
  render(blocks: readonly { html: string }[], _revision: number, _start: number): unknown {
    return blocks.map(block => unsafeHTML(block.html));
  }
  override update(part: ChildPart, [blocks, revision, start]: [readonly { html: string }[], number, number]): typeof noChange {
    if (this.blocks === blocks && this.revision === revision) return noChange;
    const from = this.blocks === blocks ? start : 0;
    this.blocks = blocks; this.revision = revision;
    while (this.parts.length > blocks.length) removePart(this.parts.pop()!);
    for (let index = from; index < blocks.length; index++) {
      const child = this.parts[index] ??= insertPart(part);
      setChildPartValue(child, unsafeHTML(blocks[index]!.html));
    }
    setCommittedValue(part, this.parts);
    return noChange;
  }
}
export const progressiveMarkdownBlocks = directive(ProgressiveMarkdownBlocks);
