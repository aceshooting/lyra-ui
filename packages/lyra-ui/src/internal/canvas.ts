const scratchContexts = new WeakMap<Document, CanvasRenderingContext2D | null>();

/** A memoized, detached canvas 2D context shared by any component that needs
 *  offscreen canvas measurement/normalization (e.g. measuring rendered text
 *  width for layout, or normalizing a CSS color string) without allocating
 *  its own canvas per call. Created lazily on first use and cached per
 *  `Document`, so an element adopted into another browsing context never
 *  keeps parsing colors or measuring text through its former realm. Returns
 *  `null` when there is no document or canvas 2D isn't available. */
export function getScratchCtx(
  ownerDocument: Document | null = typeof document === 'undefined' ? null : document,
): CanvasRenderingContext2D | null {
  if (!ownerDocument) return null;
  if (!scratchContexts.has(ownerDocument)) {
    scratchContexts.set(ownerDocument, ownerDocument.createElement('canvas').getContext('2d'));
  }
  return scratchContexts.get(ownerDocument) ?? null;
}
