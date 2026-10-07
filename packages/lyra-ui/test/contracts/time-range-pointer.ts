/** Gives synthetic time-range drags a fixed 200px track and pointer capture. */
export function stubTimeRangePointerGeometry(base: HTMLElement, ...handles: HTMLElement[]): void {
  for (const handle of handles) handle.setPointerCapture = () => {};
  base.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 200,
      bottom: 0,
      width: 200,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}
