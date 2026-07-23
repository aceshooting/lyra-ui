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
const INVALID_COLOR_SENTINELS = ['rgb(1, 2, 3)', 'rgb(4, 5, 6)'] as const;

/**
 * Resolves a CSS color expression in the element's live theme scope. Canvas APIs and Chart.js
 * silently retain their previous paint when handed an unresolved `var()` or unsupported color.
 */
export function resolveCanvasColor(scope: Element, color: string, fallback: string): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const normalized = color.trim().toLowerCase();
  if (normalized === 'currentcolor' || normalized === 'inherit' || normalized === 'unset') {
    return getComputedStyle(scope).color || fallback;
  }

  const parent = document.createElement('span');
  const probe = document.createElement('span');
  parent.hidden = true;
  parent.setAttribute('aria-hidden', 'true');
  probe.style.color = color;
  parent.append(probe);
  (scope.shadowRoot ?? scope).append(parent);
  try {
    parent.style.color = INVALID_COLOR_SENTINELS[0];
    const first = getComputedStyle(probe).color;
    if (!first || first !== INVALID_COLOR_SENTINELS[0]) return first || fallback;

    // A second inherited sentinel distinguishes an invalid declaration from a legitimate color
    // whose concrete value happens to equal the first sentinel.
    parent.style.color = INVALID_COLOR_SENTINELS[1];
    const second = getComputedStyle(probe).color;
    return !second || second === INVALID_COLOR_SENTINELS[1] ? fallback : second;
  } finally {
    parent.remove();
  }
}

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
    const color =
      cs.getPropertyValue(`--lr-color-chart-${number}`).trim() ||
      cs.getPropertyValue(`--lr-theme-color-chart-${number}`).trim() ||
      fallback;
    return resolveCanvasColor(target, color, fallback);
  });
}

/**
 * Resolves a translucent area fill through the live theme scope before Chart.js hands it to the
 * canvas. The short-lived probe is necessary because canvas silently ignores unresolved
 * `var()`/unsupported color expressions.
 */
export function translucentAreaColor(scope: Element, color: string): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return color;
  const concrete = resolveCanvasColor(scope, color, color);
  return resolveCanvasColor(
    scope,
    `color-mix(in srgb, ${concrete} ${AREA_FILL_PERCENT}%, transparent)`,
    concrete,
  );
}
