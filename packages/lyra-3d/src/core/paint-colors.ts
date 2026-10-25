import { Color, SRGBColorSpace } from 'three';
import type { Lyra3dRgba, ResolvedLyra3dStyle } from './style.js';

export type PaintColors = (value: Lyra3dRgba, target: Color) => Color;

/** Resolve shared style colors lazily for one paint, retaining double precision until buffer writes. */
export function createPaintColors(style: ResolvedLyra3dStyle): PaintColors {
  // Null admits a style color without converting it. Missing keys are authored row colors;
  // they keep their normal conversion path and never grow the cache with the data size.
  const colors = new Map<Lyra3dRgba, Color | null>();
  for (const value of [style.accent, style.focus, style.foreground, style.muted, ...style.palette]) colors.set(value, null);
  return (value, target) => {
    const cached = colors.get(value);
    if (cached) return target.copy(cached);
    target.setRGB(value.r, value.g, value.b, SRGBColorSpace);
    if (cached === null) colors.set(value, new Color().copy(target));
    // Callers may dim the target; no mutable cached Color escapes this invocation.
    return target;
  };
}
