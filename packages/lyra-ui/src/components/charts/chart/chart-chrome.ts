/** Logical legend positions shared by Lyra-original chart surfaces. */
export type LyraChartChromeLegendPosition = 'top' | 'bottom' | 'start' | 'end';

/** Normalizes untyped property/attribute input at the rendering boundary. */
export function normalizeChartChromeLegendPosition(
  value: unknown,
): LyraChartChromeLegendPosition {
  return value === 'top' || value === 'start' || value === 'end' || value === 'bottom'
    ? value
    : 'bottom';
}

export function chartChromeLegendPlacement(
  value: unknown,
): 'top' | 'bottom' | 'inline-start' | 'inline-end' {
  const position = normalizeChartChromeLegendPosition(value);
  if (position === 'start') return 'inline-start';
  if (position === 'end') return 'inline-end';
  return position;
}
