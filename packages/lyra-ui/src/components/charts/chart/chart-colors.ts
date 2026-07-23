const FALLBACK_SERIES_PALETTE = [
  '#8250df',
  '#bf3989',
  '#0a7d91',
  '#57606a',
  '#b083f5',
  '#f470b8',
  '#52d6e8',
  '#c9d1d9',
] as const;

const AREA_FILL_PERCENT = 28;

/**
 * Resolves the categorical chart ramp to concrete canvas-safe colors. Passing `null` selects the
 * deterministic fallback directly; omitting the argument reads the document theme.
 */
export function seriesPalette(element?: Element | null): string[] {
  const target =
    element === undefined && typeof document !== 'undefined'
      ? document.documentElement
      : element;
  if (!target || typeof getComputedStyle !== 'function') {
    return [...FALLBACK_SERIES_PALETTE];
  }

  const cs = getComputedStyle(target);
  return FALLBACK_SERIES_PALETTE.map((fallback, index) => {
    const number = index + 1;
    return (
      cs.getPropertyValue(`--lr-color-chart-${number}`).trim() ||
      cs.getPropertyValue(`--lr-theme-color-chart-${number}`).trim() ||
      fallback
    );
  });
}

/**
 * Resolves a translucent area fill through the live theme scope before Chart.js hands it to the
 * canvas. The short-lived probe is necessary because canvas silently ignores unresolved
 * `var()`/unsupported color expressions.
 */
export function translucentAreaColor(scope: Element, color: string): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return color;
  const probe = document.createElement('span');
  probe.hidden = true;
  probe.setAttribute('aria-hidden', 'true');
  probe.style.color = `color-mix(in srgb, ${color} ${AREA_FILL_PERCENT}%, transparent)`;
  const parent = scope.shadowRoot ?? scope;
  parent.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || color;
}
