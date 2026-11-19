import { relativeLuminance } from '../../../internal/color-math.js';
import { getScratchCtx } from '../../../internal/canvas.js';
import { readCanvasRgba } from '../../../internal/canvas-color.js';

function parseRgbTriplet(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Resolves a computed built-in CSS color to an sRGB triple. Most computed colors serialize as
 *  rgb()/rgba(); the canvas pixel fallback converts modern color spaces to its sRGB backing store.
 *  The fallback returns null if the value cannot be parsed or its canvas pixel is transparent. */
function toRgb(
  value: string,
  ownerDocument: Document
): [number, number, number] | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = parseRgbTriplet(trimmed);
  if (direct) return direct;
  const rgba = readCanvasRgba(ownerDocument, trimmed, getScratchCtx(ownerDocument));
  return rgba && rgba[3] > 0 ? [rgba[0], rgba[1], rgba[2]] : null;
}

/** Whether `host`'s currently resolved `--lr-color-*` palette is a dark scheme -- i.e. the active
 *  text color is perceptually lighter than the active surface color. True both when a consumer sets
 *  `--lr-theme-color-*` explicitly and when `tokens.styles.ts`'s own `@media
 *  (prefers-color-scheme: dark)` fallback is what's active, since both arrive through the exact same
 *  `--lr-color-text`/`--lr-color-surface` custom properties every other themed surface reads. */
export function resolveIsDarkTheme(host: Element): boolean {
  const view = host.ownerDocument.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') return false;
  const probe = host.ownerDocument.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  // Set the detached probe's declaration as markup rather than mutating CSSStyleDeclaration.
  // ThemeWatcher instruments live CSSOM setters as invalidation signals; using one from inside
  // the resolver would recursively invalidate the very watcher that called us.
  probe.setAttribute(
    'style',
    [
      'position:fixed',
      'inline-size:0',
      'block-size:0',
      'overflow:hidden',
      'pointer-events:none',
      'color:var(--lr-color-text)',
      'background-color:var(--lr-color-surface)',
    ].join(';')
  );
  try {
    const root = host.shadowRoot ?? host;
    root.append(probe);
    const style = view.getComputedStyle(probe);
    const text = toRgb(style.color, host.ownerDocument);
    const surface = toRgb(style.backgroundColor, host.ownerDocument);
    return Boolean(
      text && surface && relativeLuminance(text) > relativeLuminance(surface)
    );
  } catch {
    return false;
  } finally {
    probe.remove();
  }
}
