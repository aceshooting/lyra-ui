const COLOR_PROPERTIES = {
  surface: '--wa-color-surface-default',
  text: '--wa-color-text-normal',
  quiet: '--wa-color-text-quiet',
  border: '--wa-color-surface-border',
  brand: '--wa-color-brand-fill-loud',
  brandQuiet: '--wa-color-brand-fill-quiet',
  onBrand: '--wa-color-brand-on-loud',
  success: '--wa-color-success-fill-loud',
  successQuiet: '--wa-color-success-fill-quiet',
  warning: '--wa-color-warning-fill-loud',
  warningQuiet: '--wa-color-warning-fill-quiet',
  danger: '--wa-color-danger-fill-loud',
  dangerQuiet: '--wa-color-danger-fill-quiet',
  noData: '--wa-color-no-data',
  chart1: '--wa-color-chart-1',
  chart2: '--wa-color-chart-2',
  chart3: '--wa-color-chart-3',
  chart4: '--wa-color-chart-4',
};

/** Resolve a semantic color after the preview decorator has applied a theme. */
export function storyColor(name) {
  const property = COLOR_PROPERTIES[name];
  if (!property || typeof document === 'undefined') return 'currentColor';
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return value || `var(${property})`;
}
