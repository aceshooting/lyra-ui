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
