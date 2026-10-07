export interface FitBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface FitViewport {
  readonly width: number;
  readonly height: number;
}

export interface FitZoomBounds {
  readonly min: number;
  readonly max: number;
}

/** Options that preserve a caller's existing behavior for undersized viewports. */
export interface FitTransformOptions {
  readonly minimumAvailableSize?: number;
  readonly invalidZoomFallback?: number;
  /** Center with the clamped minimum size, for callers that expand undersized extents. */
  readonly centerWithMinimumExtent?: boolean;
}

/** Fits an axis-aligned world-space extent into a viewport and returns its centered camera. */
export function fitTransform(
  bounds: FitBounds,
  view: FitViewport,
  padding: number,
  zoomBounds: FitZoomBounds,
  options: FitTransformOptions = {},
): Readonly<{ x: number; y: number; zoom: number }> {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const minimumAvailableSize = options.minimumAvailableSize ?? 1;
  const availableWidth = Math.max(minimumAvailableSize, view.width - padding * 2);
  const availableHeight = Math.max(minimumAvailableSize, view.height - padding * 2);
  const requestedZoom = Math.min(availableWidth / width, availableHeight / height);
  const fallback = options.invalidZoomFallback ?? zoomBounds.min;
  const validZoom = Number.isFinite(requestedZoom) && requestedZoom > 0
    ? requestedZoom
    : fallback;
  const zoom = Math.min(zoomBounds.max, Math.max(zoomBounds.min, validZoom));
  const centerX = options.centerWithMinimumExtent
    ? bounds.minX + width / 2
    : (bounds.minX + bounds.maxX) / 2;
  const centerY = options.centerWithMinimumExtent
    ? bounds.minY + height / 2
    : (bounds.minY + bounds.maxY) / 2;
  return Object.freeze({
    x: view.width / 2 - centerX * zoom,
    y: view.height / 2 - centerY * zoom,
    zoom,
  });
}
