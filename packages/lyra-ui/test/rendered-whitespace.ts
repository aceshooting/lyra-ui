/**
 * Finds template-formatting whitespace that actually renders.
 *
 * A Lit template indented for readability puts whitespace-only text between its tags. That text
 * is invisible in a normal flow context, but inside an element whose computed `white-space`
 * preserves breaks (`pre`, `pre-wrap`, `pre-line`, `break-spaces`, by its own rule, by
 * inheritance, or across a shadow boundary) it renders as blank lines and indentation. This
 * helper reads computed style and layout, so it covers inheritance, `::part()` rules and the UA
 * `pre` style without modelling selectors.
 *
 * A `Text` node is reported when all of the following hold:
 *
 * 1. its style parent (the assigned slot for a slotted node, else its parent element, else the
 *    shadow host) preserves breaks or spaces;
 * 2. it is break-shaped: it contains a segment break and is either whitespace-only, or starts or
 *    ends with a run of spaces/tabs around a segment break;
 * 3. it renders (its contents have at least one client rect), which drops the runs flex and grid
 *    containers suppress and anything under `display: none`;
 * 4. it is not a committed value: its previous sibling is not a Lit child-part start marker
 *    (an empty comment, a `?lit$N$` comment, or an SSR `lit-part` comment). Lit inserts every
 *    committed primitive directly after its part's start marker, so bound data whose value starts
 *    or ends with a newline is never reported;
 * 5. `options.allow` does not return `true` for it.
 *
 * Known limits: output inserted through `unsafeHTML`/`unsafeSVG` carries no marker (pass an
 * `allow` predicate such as `inMarkdownCodeBlock`); static text directly after a marker (the
 * first node of a nested template instance, or text after a binding that rendered nothing) is
 * also skipped; only the rendered state under test is checked.
 */

const PRESERVING_COLLAPSE = new Set(['preserve', 'preserve-breaks', 'preserve-spaces', 'break-spaces']);
const PRESERVING_WHITE_SPACE = new Set(['pre', 'pre-wrap', 'pre-line', 'break-spaces']);
const LIT_MARKER = /^\?lit\$\d+\$$/;

function styleParent(text: Text): Element | null {
  if (text.assignedSlot) return text.assignedSlot;
  if (text.parentElement) return text.parentElement;
  const parent = text.parentNode;
  return parent instanceof ShadowRoot ? parent.host : null;
}

function preservesWhiteSpace(element: Element): boolean {
  const style = getComputedStyle(element) as CSSStyleDeclaration & { whiteSpaceCollapse?: string };
  const collapse = style.whiteSpaceCollapse;
  if (typeof collapse === 'string' && collapse !== '') return PRESERVING_COLLAPSE.has(collapse);
  return PRESERVING_WHITE_SPACE.has(style.whiteSpace);
}

function isBreakShaped(data: string): boolean {
  if (!/[\r\n]/.test(data)) return false;
  return /^[\t\n\r ]*$/.test(data) || /^[\t ]*[\r\n]/.test(data) || /[\r\n][\t ]*$/.test(data);
}

function renders(text: Text): boolean {
  const range = document.createRange();
  range.selectNodeContents(text);
  return range.getClientRects().length > 0;
}

function followsLitMarker(text: Text): boolean {
  const previous = text.previousSibling;
  if (!(previous instanceof Comment)) return false;
  const data = previous.data;
  return data === '' || LIT_MARKER.test(data) || data.startsWith('lit-part');
}

function describeParent(element: Element | null): string {
  if (!element) return '#unknown';
  const part = element.getAttribute('part');
  return part ? `${element.localName}[part="${part}"]` : element.localName;
}

function collectTextNodes(root: Node, out: Text[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof Text) out.push(node);
    else if (node instanceof Element && node.shadowRoot) collectTextNodes(node.shadowRoot, out);
    node = walker.nextNode();
  }
}

/**
 * One descriptor per template-formatting whitespace run that renders inside a white-space-
 * preserving context, walking `root` and every open shadow root below it. Descriptors are
 * strings of the form `"\n  " in div[part="content"]`, never DOM nodes, so a failing chai
 * assertion stays cheap to print.
 */
export function renderedTemplateWhitespace(
  root: Node,
  options?: { allow?: (text: Text) => boolean },
): string[] {
  const texts: Text[] = [];
  collectTextNodes(root, texts);
  const found: string[] = [];
  for (const text of texts) {
    const parent = styleParent(text);
    if (!parent || !preservesWhiteSpace(parent)) continue;
    if (!isBreakShaped(text.data)) continue;
    if (!renders(text)) continue;
    if (followsLitMarker(text)) continue;
    if (options?.allow?.(text) === true) continue;
    found.push(`${JSON.stringify(text.data)} in ${describeParent(parent)}`);
  }
  return found;
}

/**
 * `allow` predicate for Markdown's rendered code blocks. The text of `pre[part~="code-block"]`
 * (the plain code renderer, Shiki output, a progressive open-fence preview) is document data that
 * `unsafeHTML` inserted, so it carries no Lit marker.
 */
export function inMarkdownCodeBlock(text: Text): boolean {
  return text.parentElement?.closest('pre[part~="code-block"]') != null;
}
