export type Rgb = readonly [number, number, number];

function linearize(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of an sRGB colour whose channels are 0-255. */
export function relativeLuminance(rgb: Rgb): number {
  return linearize(rgb[0]) * 0.2126 + linearize(rgb[1]) * 0.7152 + linearize(rgb[2]) * 0.0722;
}

/** WCAG contrast ratio (1 to 21) between two colours, symmetric in its arguments. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const left = relativeLuminance(a);
  const right = relativeLuminance(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
