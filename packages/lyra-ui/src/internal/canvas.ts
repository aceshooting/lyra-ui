const scratchContexts = new WeakMap<
  Document,
  CanvasRenderingContext2D | null
>();

export interface BoundedCanvasAllocationInput {
  readonly cssWidth: unknown;
  readonly cssHeight: unknown;
  readonly desiredScale: unknown;
  readonly maxDimension: number;
  readonly maxPixels: number;
}

export interface BoundedCanvasAllocation {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  /** Uniform requested scale after applying the dimension and pixel-area limits. */
  readonly scale: number;
  /** Exact horizontal backing-store scale after integer pixel rounding. */
  readonly scaleX: number;
  /** Exact vertical backing-store scale after integer pixel rounding. */
  readonly scaleY: number;
}

function positiveFinite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 1;
}

/**
 * Resolves a bounded canvas backing-store allocation without allocating a canvas.
 *
 * The requested scale is reduced uniformly so neither backing dimension nor total pixel count can
 * exceed the supplied limits. Integer rounding can make the two effective axis scales differ
 * slightly, so callers receive both exact values for `CanvasRenderingContext2D.scale()`.
 */
export function resolveBoundedCanvasAllocation(
  input: Readonly<BoundedCanvasAllocationInput>
): Readonly<BoundedCanvasAllocation> {
  const cssWidth = positiveFinite(input.cssWidth);
  const cssHeight = positiveFinite(input.cssHeight);
  const desiredScale = positiveFinite(input.desiredScale);
  const maxDimension = Math.max(
    1,
    Math.floor(positiveFinite(input.maxDimension))
  );
  const maxPixels = Math.max(1, positiveFinite(input.maxPixels));
  const areaScale =
    Math.sqrt(maxPixels) / Math.sqrt(cssWidth) / Math.sqrt(cssHeight);
  const scale = Math.max(
    Number.MIN_VALUE,
    Math.min(
      desiredScale,
      maxDimension / cssWidth,
      maxDimension / cssHeight,
      areaScale
    )
  );
  const pixelWidth = Math.max(
    1,
    Math.min(maxDimension, Math.floor(cssWidth * scale))
  );
  const pixelHeight = Math.max(
    1,
    Math.min(maxDimension, Math.floor(cssHeight * scale))
  );

  return Object.freeze({
    cssWidth,
    cssHeight,
    pixelWidth,
    pixelHeight,
    scale,
    scaleX: pixelWidth / cssWidth,
    scaleY: pixelHeight / cssHeight,
  });
}

/** A memoized, detached canvas 2D context shared by any component that needs
 *  offscreen canvas measurement/normalization (e.g. measuring rendered text
 *  width for layout, or normalizing a CSS color string) without allocating
 *  its own canvas per call. Created lazily on first use and cached per
 *  `Document`, so an element adopted into another browsing context never
 *  keeps parsing colors or measuring text through its former realm. Returns
 *  `null` when there is no document or canvas 2D isn't available. */
export function getScratchCtx(
  ownerDocument: Document | null = typeof document === 'undefined'
    ? null
    : document
): CanvasRenderingContext2D | null {
  if (!ownerDocument) return null;
  if (!scratchContexts.has(ownerDocument)) {
    scratchContexts.set(
      ownerDocument,
      // `willReadFrequently` because this context exists to be READ from -- lr-heatmap's
      // resolveRgb() does a 1x1 getImageData() readback for every colour the canvas normalizes into
      // a form its string parsers do not accept (color-mix(), oklch(), lab()). Without the hint
      // Chrome keeps the surface GPU-backed and warns, on every page carrying a heatmap, that
      // repeated getImageData is faster with it set -- a warning no consumer can act on. A ramp
      // built from color-mix() takes that readback per cell, so it is a real per-frame cost there.
      ownerDocument.createElement('canvas').getContext('2d', { willReadFrequently: true })
    );
  }
  return scratchContexts.get(ownerDocument) ?? null;
}
