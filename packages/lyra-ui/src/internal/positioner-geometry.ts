/** A synthetic anchor accepted by the Floating UI-backed positioning runtime. */
export interface VirtualAnchor {
  getBoundingClientRect(): DOMRect;
  /** A real element that supplies scale, direction, and scroll-ancestor context. */
  contextElement?: Element;
}

export class PositionerGeometryError extends RangeError {}

export function finiteGeometry(value: number, label: string, nonnegative = false): number {
  if (!Number.isFinite(value) || (nonnegative && value < 0)) {
    throw new PositionerGeometryError(
      `${label} must be a ${nonnegative ? 'finite nonnegative' : 'finite'} number`,
    );
  }
  return value;
}

export function validatedClientRect(rect: DOMRect, label: string): DOMRect {
  finiteGeometry(rect.x, `${label}.x`);
  finiteGeometry(rect.y, `${label}.y`);
  finiteGeometry(rect.width, `${label}.width`, true);
  finiteGeometry(rect.height, `${label}.height`, true);
  finiteGeometry(rect.top, `${label}.top`);
  finiteGeometry(rect.right, `${label}.right`);
  finiteGeometry(rect.bottom, `${label}.bottom`);
  finiteGeometry(rect.left, `${label}.left`);
  return rect;
}

/**
 * Builds a virtual anchor without loading the positioning engine. Coordinates must be finite and
 * dimensions must be finite and nonnegative; omitted dimensions describe a point.
 */
export function virtualAnchorFromRect(rect: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  contextElement?: Element;
}): VirtualAnchor {
  const x = finiteGeometry(rect.x, 'virtualAnchorFromRect() x');
  const y = finiteGeometry(rect.y, 'virtualAnchorFromRect() y');
  const width = finiteGeometry(rect.width ?? 0, 'virtualAnchorFromRect() width', true);
  const height = finiteGeometry(rect.height ?? 0, 'virtualAnchorFromRect() height', true);
  const domRect = new DOMRect(x, y, width, height);
  return { getBoundingClientRect: () => domRect, contextElement: rect.contextElement };
}
