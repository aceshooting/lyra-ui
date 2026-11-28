import { readCanvasRgba, resolveCanvasColor } from '../../../internal/canvas-color.js';
import { contrastRatio, type Rgb } from '../../../internal/color-math.js';

/** WCAG AA contrast for normal-size text. */
const READABLE_CONTRAST = 4.5;

/** Foregrounds tried in order: the theme's own pairings first, so a brand-like fill keeps the
 *  library's on-brand text, then the two absolute extremes. */
const FOREGROUND_CANDIDATES = [
  'var(--lr-color-on-brand)',
  'var(--lr-color-text)',
  '#ffffff',
  '#000000',
] as const;

function resolveRgba(scope: Element, css: string): readonly [number, number, number, number] | undefined {
  const resolved = resolveCanvasColor(scope, css, '');
  return resolved ? readCanvasRgba(scope.ownerDocument, resolved) : undefined;
}

/**
 * Picks a readable foreground for an event painted with a caller-supplied fill in the host's live
 * theme: the first candidate reaching 4.5:1, else the highest-contrast one. A translucent fill is
 * composited over `--lr-color-surface` first. Resolutions are memoized per fill string until
 * `clear()` (called on theme changes), since every resolution forces a style recalculation and
 * the month grid re-renders on each roving-focus keystroke. Returns `undefined` when the fill
 * cannot be resolved (detached host, no canvas), leaving the stylesheet default in charge.
 */
export class EventForegroundResolver {
  private readonly memo = new Map<string, string | undefined>();
  private candidates?: readonly (readonly [string, Rgb])[];
  private surface?: Rgb;

  constructor(private readonly scope: Element) {}

  clear(): boolean {
    const had = this.memo.size > 0;
    this.memo.clear();
    this.candidates = undefined;
    this.surface = undefined;
    return had;
  }

  resolve(background: string): string | undefined {
    if (this.memo.has(background)) return this.memo.get(background);
    if (!this.scope.isConnected) return undefined;
    const value = this.derive(background);
    this.memo.set(background, value);
    return value;
  }

  private derive(background: string): string | undefined {
    const fill = resolveRgba(this.scope, background);
    if (!fill) return undefined;
    let rgb: Rgb = [fill[0], fill[1], fill[2]];
    const alpha = fill[3];
    if (alpha < 1) {
      if (!this.surface) {
        const surface = resolveRgba(this.scope, 'var(--lr-color-surface)');
        this.surface = surface ? [surface[0], surface[1], surface[2]] : [255, 255, 255];
      }
      const surface = this.surface;
      rgb = [
        rgb[0] * alpha + surface[0] * (1 - alpha),
        rgb[1] * alpha + surface[1] * (1 - alpha),
        rgb[2] * alpha + surface[2] * (1 - alpha),
      ];
    }
    this.candidates ??= FOREGROUND_CANDIDATES.flatMap((candidate) => {
      const value = resolveRgba(this.scope, candidate);
      return value ? [[candidate, [value[0], value[1], value[2]] as Rgb] as const] : [];
    });
    let best: string | undefined;
    let bestRatio = 0;
    for (const [candidate, value] of this.candidates) {
      const ratio = contrastRatio(rgb, value);
      if (ratio >= READABLE_CONTRAST) return candidate;
      if (ratio > bestRatio) {
        best = candidate;
        bestRatio = ratio;
      }
    }
    return best;
  }
}
