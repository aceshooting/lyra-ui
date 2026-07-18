const COLOR_PROPERTIES = {
  surface: '--lr-theme-color-surface-default',
  text: '--lr-theme-color-text-normal',
  quiet: '--lr-theme-color-text-quiet',
  border: '--lr-theme-color-surface-border',
  brand: '--lr-theme-color-brand-fill-loud',
  brandQuiet: '--lr-theme-color-brand-fill-quiet',
  onBrand: '--lr-theme-color-brand-on-loud',
  success: '--lr-theme-color-success-fill-loud',
  successQuiet: '--lr-theme-color-success-fill-quiet',
  warning: '--lr-theme-color-warning-fill-loud',
  warningQuiet: '--lr-theme-color-warning-fill-quiet',
  danger: '--lr-theme-color-danger-fill-loud',
  dangerQuiet: '--lr-theme-color-danger-fill-quiet',
  noData: '--lr-theme-color-no-data',
  chart1: '--lr-theme-color-chart-1',
  chart2: '--lr-theme-color-chart-2',
  chart3: '--lr-theme-color-chart-3',
  chart4: '--lr-theme-color-chart-4',
};

/** Resolve a semantic color after the preview decorator has applied a theme. */
export function storyColor(name) {
  const property = COLOR_PROPERTIES[name];
  if (!property || typeof document === 'undefined') return 'currentColor';
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return value || `var(${property})`;
}
