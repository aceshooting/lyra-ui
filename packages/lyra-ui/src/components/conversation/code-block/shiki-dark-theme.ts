import { getScratchCtx } from '../../../internal/canvas.js';
import { flattenedThemeParent, THEME_ATTRIBUTES } from '../../../internal/theme-observation.js';

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
  const ctx = getScratchCtx(ownerDocument);
  if (!ctx) return null;
  // Two distinct sentinels distinguish an invalid assignment from a valid color whose own
  // serialization happens to equal either sentinel. Reading an actual pixel then lets the browser
  // convert modern color spaces (oklch/lab/color(display-p3 ...)) to the canvas' sRGB backing store
  // instead of assuming the fillStyle getter will serialize them as rgb().
  ctx.fillStyle = 'rgb(1, 2, 3)';
  ctx.fillStyle = trimmed;
  const first = ctx.fillStyle;
  ctx.fillStyle = 'rgb(4, 5, 6)';
  ctx.fillStyle = trimmed;
  if (ctx.fillStyle !== first) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = ctx.getImageData(0, 0, 1, 1).data;
  return alpha === 0 ? null : [red!, green!, blue!];
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

/** Re-invokes `onChange` whenever the resolved theme might have changed: an OS-level
 *  prefers-color-scheme flip, or a theme attribute change anywhere in `host`'s flattened ancestor
 *  chain, including slots and shadow hosts. A consumer re-theming via `--lr-theme-*` custom properties
 *  fires no DOM event on its own -- this mirrors qr-code.class.ts's/heatmap.class.ts's/
 *  chart.class.ts's own theme-reactive canvases, the established pattern in this codebase for a
 *  component that can't just let CSS repaint itself. Returns a cleanup function. */
export function watchDarkTheme(
  host: HTMLElement,
  onChange: () => void
): () => void {
  const view = host.ownerDocument.defaultView;
  if (!view || !host.isConnected) return () => {};
  let active = true;
  const update = (): void => {
    if (!active || !host.isConnected || host.ownerDocument.defaultView !== view)
      return;
    onChange();
  };
  let colorSchemeQuery: MediaQueryList | undefined;
  try {
    colorSchemeQuery = view.matchMedia?.('(prefers-color-scheme: dark)');
    colorSchemeQuery?.addEventListener('change', update);
  } catch {
    colorSchemeQuery = undefined;
  }

  let observer: MutationObserver | undefined;
  const Observer = view.MutationObserver;
  if (typeof Observer === 'function') {
    const targets: Element[] = [host];
    let parent = flattenedThemeParent(host);
    while (parent && !targets.includes(parent)) {
      targets.push(parent);
      parent = flattenedThemeParent(parent);
    }
    try {
      observer = new Observer(update);
      for (const target of targets) {
        observer.observe(target, {
          attributes: true,
          attributeFilter: [...THEME_ATTRIBUTES],
        });
      }
    } catch {
      observer?.disconnect();
      observer = undefined;
    }
  }

  return () => {
    if (!active) return;
    active = false;
    colorSchemeQuery?.removeEventListener('change', update);
    observer?.disconnect();
  };
}
