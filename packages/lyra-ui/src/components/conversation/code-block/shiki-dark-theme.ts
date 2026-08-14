import { getScratchCtx } from "../../../internal/canvas.js";

function parseRgbTriplet(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function parseHexTriplet(value: string): [number, number, number] | null {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1]!;
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
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
function toRgb(
  value: string,
  ownerDocument: Document
): [number, number, number] | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = parseRgbTriplet(trimmed) ?? parseHexTriplet(trimmed);
  if (direct) return direct;
  const ctx = getScratchCtx(ownerDocument);
  if (!ctx) return null;
  // Two distinct sentinels distinguish an invalid assignment from a valid color whose own
  // serialization happens to equal either sentinel. Reading an actual pixel then lets the browser
  // convert modern color spaces (oklch/lab/color(display-p3 ...)) to the canvas' sRGB backing store
  // instead of assuming the fillStyle getter will serialize them as rgb().
  ctx.fillStyle = "rgb(1, 2, 3)";
  ctx.fillStyle = trimmed;
  const first = ctx.fillStyle;
  ctx.fillStyle = "rgb(4, 5, 6)";
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
  if (!view || typeof view.getComputedStyle !== "function") return false;
  const probe = host.ownerDocument.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  // Set the detached probe's declaration as markup rather than mutating CSSStyleDeclaration.
  // ThemeWatcher instruments live CSSOM setters as invalidation signals; using one from inside
  // the resolver would recursively invalidate the very watcher that called us.
  probe.setAttribute(
    "style",
    [
      "position:fixed",
      "inline-size:0",
      "block-size:0",
      "overflow:hidden",
      "pointer-events:none",
      "color:var(--lr-color-text)",
      "background-color:var(--lr-color-surface)",
    ].join(";")
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
 *  prefers-color-scheme flip, or a class/style/data-theme/data-color-scheme attribute change
 *  anywhere in `host`'s ancestor chain. A consumer re-theming via `--lr-theme-*` custom properties
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
    colorSchemeQuery = view.matchMedia?.("(prefers-color-scheme: dark)");
    colorSchemeQuery?.addEventListener("change", update);
  } catch {
    colorSchemeQuery = undefined;
  }

  let observer: MutationObserver | undefined;
  const Observer = view.MutationObserver;
  if (typeof Observer === "function") {
    const targets: Element[] = [host];
    let parent = host.parentElement;
    while (parent) {
      targets.push(parent);
      parent = parent.parentElement;
    }
    try {
      observer = new Observer(update);
      for (const target of targets) {
        observer.observe(target, {
          attributes: true,
          attributeFilter: [
            "class",
            "style",
            "data-theme",
            "data-color-scheme",
          ],
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
    colorSchemeQuery?.removeEventListener("change", update);
    observer?.disconnect();
  };
}
