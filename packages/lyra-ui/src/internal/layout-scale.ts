const IDENTITY = { x: 1, y: 1 } as const;

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * The accumulated ancestor transform scale (`transform: scale()`, CSS `zoom`) of an element:
 * its visual (`getBoundingClientRect`) size over its layout (`offset*`) size. Returns 1 for
 * unscaled, unlaid-out (zero-size), non-HTML or disconnected elements.
 */
export function layoutScale(el: Element): { x: number; y: number } {
  try {
    const layout = el as Partial<HTMLElement>;
    const width = layout.offsetWidth ?? 0;
    const height = layout.offsetHeight ?? 0;
    if (!el.isConnected || width <= 0 || height <= 0) return { ...IDENTITY };
    const rect = el.getBoundingClientRect();
    return { x: positive(rect.width / width), y: positive(rect.height / height) };
  } catch {
    return { ...IDENTITY };
  }
}

/** Converts a visual rect (viewport px) to layout px by dividing out `el`'s scale. */
export function toLayoutRect(el: Element, r: DOMRect): DOMRect {
  const { x, y } = layoutScale(el);
  return new DOMRect(r.x / x, r.y / y, r.width / x, r.height / y);
}
