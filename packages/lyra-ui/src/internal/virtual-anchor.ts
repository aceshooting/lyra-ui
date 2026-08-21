import type { VirtualAnchor } from './positioner.js';

function finiteCoordinate(value: number, label: string, nonnegative = false): number {
  if (!Number.isFinite(value) || (nonnegative && value < 0)) {
    throw new RangeError(
      `${label} must be a ${nonnegative ? 'finite nonnegative' : 'finite'} number`,
    );
  }
  return value;
}

/** Internal lean equivalent of `virtualAnchorFromRect()` for deferred positioner consumers. */
export function createVirtualAnchorFromRect(rect: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  contextElement?: Element;
}): VirtualAnchor {
  const x = finiteCoordinate(rect.x, 'virtualAnchorFromRect() x');
  const y = finiteCoordinate(rect.y, 'virtualAnchorFromRect() y');
  const width = finiteCoordinate(rect.width ?? 0, 'virtualAnchorFromRect() width', true);
  const height = finiteCoordinate(rect.height ?? 0, 'virtualAnchorFromRect() height', true);
  const domRect = new DOMRect(x, y, width, height);
  return { getBoundingClientRect: () => domRect, contextElement: rect.contextElement };
}
