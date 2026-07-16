let scratchCtx: CanvasRenderingContext2D | null | undefined;

/** A memoized, detached canvas 2D context shared by any component that needs
 *  offscreen canvas measurement/normalization (e.g. measuring rendered text
 *  width for layout, or normalizing a CSS color string) without allocating
 *  its own canvas per call. Created lazily on first use and cached for the
 *  lifetime of the module; `null` if canvas 2D isn't available in this
 *  environment. */
export function getScratchCtx(): CanvasRenderingContext2D | null {
  if (scratchCtx === undefined) {
    scratchCtx = document.createElement('canvas').getContext('2d');
  }
  return scratchCtx;
}
