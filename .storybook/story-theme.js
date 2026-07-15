const COLOR_PROPERTIES = {
  surface: '--lyra-theme-color-surface-default',
  text: '--lyra-theme-color-text-normal',
  quiet: '--lyra-theme-color-text-quiet',
  border: '--lyra-theme-color-surface-border',
  brand: '--lyra-theme-color-brand-fill-loud',
  brandQuiet: '--lyra-theme-color-brand-fill-quiet',
  onBrand: '--lyra-theme-color-brand-on-loud',
  success: '--lyra-theme-color-success-fill-loud',
  successQuiet: '--lyra-theme-color-success-fill-quiet',
  warning: '--lyra-theme-color-warning-fill-loud',
  warningQuiet: '--lyra-theme-color-warning-fill-quiet',
  danger: '--lyra-theme-color-danger-fill-loud',
  dangerQuiet: '--lyra-theme-color-danger-fill-quiet',
  noData: '--lyra-theme-color-no-data',
  chart1: '--lyra-theme-color-chart-1',
  chart2: '--lyra-theme-color-chart-2',
  chart3: '--lyra-theme-color-chart-3',
  chart4: '--lyra-theme-color-chart-4',
};

/** Resolve a semantic color after the preview decorator has applied a theme. */
export function storyColor(name) {
  const property = COLOR_PROPERTIES[name];
  if (!property || typeof document === 'undefined') return 'currentColor';
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  return value || `var(${property})`;
}
