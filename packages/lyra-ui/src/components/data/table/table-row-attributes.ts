import { noChange } from 'lit';
import { Directive, directive, PartType, type ElementPart, type PartInfo } from 'lit/directive.js';

/** Writes an already-validated attribute map onto one row element and removes every name it wrote
 *  on the previous render that the new map no longer carries, so a row reused by `repeat()` never
 *  keeps a stale consumer attribute. Attributes it never wrote are left alone. */
class RowAttributesDirective extends Directive {
  private applied = new Set<string>();

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.ELEMENT) throw new Error('rowAttributes() belongs on an element');
  }

  render(_attributes: ReadonlyMap<string, string> | undefined): typeof noChange {
    return noChange;
  }

  override update(part: ElementPart, [attributes]: [ReadonlyMap<string, string> | undefined]): typeof noChange {
    const element = part.element;
    for (const name of this.applied) if (!attributes?.has(name)) element.removeAttribute(name);
    const applied = new Set<string>();
    for (const [name, value] of attributes ?? []) {
      if (element.getAttribute(name) !== value) element.setAttribute(name, value);
      applied.add(name);
    }
    this.applied = applied;
    return noChange;
  }
}

export const rowAttributes = directive(RowAttributesDirective);
