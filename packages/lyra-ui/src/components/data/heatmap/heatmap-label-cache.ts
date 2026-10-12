const MAX_ENTRIES = 1024;
const MAX_TEXT_UNITS = 65_536;

/** Bounded text work shared by label sizing and painting during one synchronous paint only. */
export class HeatmapLabelCache {
  private readonly widths = new Map<string, number>();
  private readonly clipped = new Map<string, string>();
  private entries = 0;
  private textUnits = 0;

  private key(ctx: CanvasRenderingContext2D, text: string, width?: number): string | undefined {
    // Bound raw inputs before serialization can expand escaped characters or copy a large label.
    if (typeof text !== 'string' || text.length > MAX_TEXT_UNITS) return undefined;
    const values = [
      ctx.font, ctx.direction, ctx.fontKerning, ctx.fontStretch, ctx.fontVariantCaps,
      ctx.letterSpacing, ctx.wordSpacing, ctx.textRendering, text, width,
    ];
    let units = 0;
    for (const value of values) {
      if (typeof value === 'string') units += value.length;
      if (units > MAX_TEXT_UNITS) return undefined;
    }
    return JSON.stringify(values);
  }

  private remember<T>(map: Map<string, T>, key: string, value: T, units = key.length): void {
    if (this.entries >= MAX_ENTRIES || this.textUnits + units > MAX_TEXT_UNITS) return;
    map.set(key, value);
    this.entries += 1;
    this.textUnits += units;
  }

  width(ctx: CanvasRenderingContext2D, text: string): number {
    const key = this.key(ctx, text);
    if (key === undefined) return ctx.measureText(text).width;
    const cached = this.widths.get(key);
    if (cached !== undefined) return cached;
    const width = ctx.measureText(text).width;
    this.remember(this.widths, key, width);
    return width;
  }

  clip(ctx: CanvasRenderingContext2D, text: string, width: number, compute: () => string): string {
    const key = this.key(ctx, text, width);
    if (key === undefined) return compute();
    const cached = this.clipped.get(key);
    if (cached !== undefined) return cached;
    const result = compute();
    this.remember(this.clipped, key, result, key.length + result.length);
    return result;
  }
}
