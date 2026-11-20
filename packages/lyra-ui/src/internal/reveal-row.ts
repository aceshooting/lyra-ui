import { layoutScale } from './layout-scale.js';

/** Scrolls only `container` so the band `[top, top + height)` is visible below a sticky `inset`. */
export function revealRange(container: HTMLElement, top: number, height: number, inset = 0): void {
  const bottom = top + height;
  if (top < container.scrollTop + inset || height > container.clientHeight - inset) container.scrollTop = top - inset;
  else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight;
}

/** Reveals `row` by scrolling only `container`, never a page ancestor or focus. Offset geometry
 *  shares `scrollTop`'s local units (including under CSS zoom), so `container` must be a containing
 *  block for `row`. */
export function revealRow(container: HTMLElement, row: HTMLElement, inset = 0): void {
  if (container.clientHeight === 0) return;
  let top = 0;
  let node: HTMLElement | null = row;
  while (node && node !== container) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  if (node === container) revealRange(container, top, row.offsetHeight, inset);
}

/** Alignment of a revealed target inside its scrollport. */
export type RevealAlignment = 'nearest' | 'center';

const scrolls = (overflow: string): boolean => overflow === 'auto' || overflow === 'scroll';

/** The nearest ancestor of `target` inside its own tree (never across a shadow boundary) that
 *  currently scrolls on either axis. */
function ownedScroller(target: Element): HTMLElement | null {
  let node: Node | null = target.parentNode;
  while (node && node.nodeType === 1) {
    const element = node as HTMLElement;
    const style = getComputedStyle(element);
    if ((scrolls(style.overflowY) && element.scrollHeight > element.clientHeight)
      || (scrolls(style.overflowX) && element.scrollWidth > element.clientWidth)) return element;
    node = element.parentNode;
  }
  return null;
}

/** Scroll offset that brings `[start, start + size)` (layout pixels from the scrollport's start
 *  edge) into a `view`-long scrollport currently at `current`. */
function axisOffset(start: number, size: number, view: number, current: number, align: RevealAlignment): number {
  if (align === 'center') return current + start + size / 2 - view / 2;
  if (start < 0 || size > view) return current + start;
  if (start + size > view) return current + start + size - view;
  return current;
}

/**
 * Reveals `target` by scrolling only the scrollport its component owns: the nearest scrolling
 * ancestor inside the same tree. A page or outer scroller never moves. Geometry is measured in
 * visual pixels and divided by the scrollport's own scale, so an ancestor transform or zoom does
 * not skew the offset. With no owned scrollport (an uncapped viewer), it falls back to a
 * `nearest` `scrollIntoView`, which leaves an already visible target in place.
 */
export function revealInOwnScroller(
  target: Element,
  align: RevealAlignment = 'nearest',
  behavior: ScrollBehavior = 'auto',
): void {
  const scroller = ownedScroller(target);
  if (!scroller) {
    target.scrollIntoView?.({ behavior, block: 'nearest', inline: 'nearest' });
    return;
  }
  const box = scroller.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const { x: scaleX, y: scaleY } = layoutScale(scroller);
  const left = axisOffset((rect.left - box.left) / scaleX - scroller.clientLeft, rect.width / scaleX,
    scroller.clientWidth, scroller.scrollLeft, align);
  const top = axisOffset((rect.top - box.top) / scaleY - scroller.clientTop, rect.height / scaleY,
    scroller.clientHeight, scroller.scrollTop, align);
  if (left !== scroller.scrollLeft || top !== scroller.scrollTop) scroller.scrollTo({ left, top, behavior });
}
