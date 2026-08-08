const INVALID_COLOR_SENTINELS = ['rgb(1, 2, 3)', 'rgb(4, 5, 6)'] as const;

/**
 * Resolves a CSS color expression in an element's live theme scope. Canvas APIs silently retain
 * their previous paint when assigned an unresolved variable, `currentColor`, or an invalid value,
 * so every canvas-bound color must cross this concrete DOM color probe first.
 */
export function resolveCanvasColor(scope: Element, color: string, fallback: string): string {
  const ownerDocument = scope.ownerDocument;
  const view = ownerDocument.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') return fallback;

  const normalized = color.trim().toLowerCase();
  if (normalized === 'currentcolor' || normalized === 'inherit' || normalized === 'unset') {
    return view.getComputedStyle(scope).color || fallback;
  }

  const parent = ownerDocument.createElement('span');
  const probe = ownerDocument.createElement('span');
  parent.hidden = true;
  parent.setAttribute('aria-hidden', 'true');
  probe.style.color = color;
  parent.append(probe);
  (scope.shadowRoot ?? scope).append(parent);
  try {
    parent.style.color = INVALID_COLOR_SENTINELS[0];
    const first = view.getComputedStyle(probe).color;
    if (!first || first !== INVALID_COLOR_SENTINELS[0]) return first || fallback;

    // A second inherited sentinel distinguishes an invalid declaration from a legitimate color
    // whose concrete value happens to equal the first sentinel.
    parent.style.color = INVALID_COLOR_SENTINELS[1];
    const second = view.getComputedStyle(probe).color;
    return !second || second === INVALID_COLOR_SENTINELS[1] ? fallback : second;
  } finally {
    parent.remove();
  }
}
