import { getScratchCtx } from '../../../internal/canvas.js';

function parseRgbTriplet(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function parseHexTriplet(value: string): [number, number, number] | null {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1]!;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Normalizes any syntactically valid CSS `<color>` -- hex, `rgb()`/`rgba()`, a named color, etc.
 *  -- to an `[r, g, b]` triple. `getComputedStyle().getPropertyValue()` on a *custom* property (as
 *  opposed to a built-in property like `color`) returns the value in whatever syntax it was
 *  originally authored in, e.g. still `#1a1a1a` rather than browser-normalized `rgb(26, 26, 26)` --
 *  so a regex that only understands `rgb()`/`rgba()` silently misreads every hex/named/hsl/oklch
 *  value as black. Normalizes through the canvas 2D context's own color grammar instead (mirrors
 *  `heatmap.class.ts`'s `resolveRgb()`/`qr-code.class.ts`'s `resolveQrColor()`, this codebase's
 *  established pattern for the same problem), rather than hand-rolling a parser for every CSS color
 *  syntax -- `ctx.fillStyle`'s own getter re-serializes right back to hex for an opaque color (per
 *  the CSS Color serialization algorithm canvas 2D uses), so both forms are tried on either side of
 *  the round-trip. Returns `null` when `value` doesn't parse as a color at all. */
function toRgb(value: string): [number, number, number] | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = parseRgbTriplet(trimmed) ?? parseHexTriplet(trimmed);
  if (direct) return direct;
  const ctx = getScratchCtx();
  if (!ctx) return null;
  const sentinel = 'rgb(1, 2, 3)';
  ctx.fillStyle = sentinel;
  const sentinelNormalized = ctx.fillStyle;
  ctx.fillStyle = trimmed;
  if (ctx.fillStyle === sentinelNormalized && trimmed !== sentinel) return null;
  return parseRgbTriplet(ctx.fillStyle) ?? parseHexTriplet(ctx.fillStyle);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

/** Whether `host`'s currently resolved `--lr-color-*` palette is a dark scheme -- i.e. the active
 *  text color is perceptually lighter than the active surface color. True both when a consumer sets
 *  `--lr-theme-color-*` explicitly and when `tokens.styles.ts`'s own `@media
 *  (prefers-color-scheme: dark)` fallback is what's active, since both arrive through the exact same
 *  `--lr-color-text`/`--lr-color-surface` custom properties every other themed surface reads. */
export function resolveIsDarkTheme(host: Element): boolean {
  const style = getComputedStyle(host);
  const text = toRgb(style.getPropertyValue('--lr-color-text'));
  const surface = toRgb(style.getPropertyValue('--lr-color-surface'));
  if (!text || !surface) return false;
  return relativeLuminance(text) > relativeLuminance(surface);
}

/** Re-invokes `onChange` whenever the resolved theme might have changed: an OS-level
 *  prefers-color-scheme flip, or a class/style/data-theme/data-color-scheme attribute change
 *  anywhere in `host`'s ancestor chain. A consumer re-theming via `--lr-theme-*` custom properties
 *  fires no DOM event on its own -- this mirrors qr-code.class.ts's/heatmap.class.ts's/
 *  chart.class.ts's own theme-reactive canvases, the established pattern in this codebase for a
 *  component that can't just let CSS repaint itself. Returns a cleanup function. */
export function watchDarkTheme(host: HTMLElement, onChange: () => void): () => void {
  const view = host.ownerDocument.defaultView;
  const colorSchemeQuery = view?.matchMedia?.('(prefers-color-scheme: dark)');
  colorSchemeQuery?.addEventListener('change', onChange);

  let observer: MutationObserver | undefined;
  if (typeof MutationObserver !== 'undefined') {
    const targets: Element[] = [host];
    let parent = host.parentElement;
    while (parent) {
      targets.push(parent);
      parent = parent.parentElement;
    }
    observer = new MutationObserver(onChange);
    for (const target of targets) {
      observer.observe(target, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] });
    }
  }

  return () => {
    colorSchemeQuery?.removeEventListener('change', onChange);
    observer?.disconnect();
  };
}
