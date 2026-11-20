import { composedParentElement, isAccessibilityVisible } from './accessibility-visibility.js';
import { THEME_ATTRIBUTES } from './theme-observation.js';
import { readCanvasRgba, resolveCanvasColor, toRgbaString } from './canvas-color.js';
import { finiteRange } from './numbers.js';

/**
 * Attributes whose change on an element or a composed ancestor can hide, inert or reveal it
 * without changing geometry, so no intersection report follows.
 */
export const ENGINE_FENCE_ATTRIBUTES: readonly string[] = /* @__PURE__ */ Object.freeze(['aria-hidden', 'inert', 'hidden', 'style', 'class', 'open']);

/** The media features an engine style reads; a change to any of them must re-resolve it. */
export const ENGINE_STYLE_MEDIA_QUERIES = /* @__PURE__ */ Object.freeze([
  '(prefers-reduced-motion: reduce)',
  '(forced-colors: active)',
  '(prefers-color-scheme: dark)',
] as const);

/** Composed ancestors observed above the starting element. */
const FENCE_DEPTH = 256;

/**
 * Observes `attributes` on `start` and its first 256 composed ancestors (assigned slots and shadow
 * hosts included), in `start`'s owner window. Returns the disposer; no callback runs after it, or
 * while `start` is disconnected.
 */
function observeAncestorAttributes(start: Element, attributes: readonly string[], onChange: () => void): () => void {
  const view = start.ownerDocument.defaultView;
  if (!view?.MutationObserver) return () => {};
  let active = true;
  const observer = new view.MutationObserver(() => { if (active && start.isConnected) onChange(); });
  const init: MutationObserverInit = { attributes: true, attributeFilter: attributes as string[] };
  for (let element: Element | null = start, depth = 0; element && depth <= FENCE_DEPTH; depth++) {
    observer.observe(element, init);
    element = composedParentElement(element);
  }
  return () => { active = false; observer.disconnect(); };
}

/** {@link observeAncestorAttributes} for the {@link ENGINE_FENCE_ATTRIBUTES}. */
export function observeAncestorFences(start: Element, onChange: () => void): () => void {
  return observeAncestorAttributes(start, ENGINE_FENCE_ATTRIBUTES, onChange);
}

export interface EngineAdmissionOptions {
  /** Checked before every admission attempt; `false` keeps waiting for the next report. */
  isReady(): boolean;
  /** Runs once, after every observer is released. It can run before `observeAdmission` returns. */
  onAdmit(): void;
  /** Whether the host is exposed to the user. Defaults to `isAccessibilityVisible(host)`. */
  isExposed?(): boolean;
}

/**
 * Waits until `surface` intersects the viewport and `host` is exposed (not hidden, inert or
 * aria-hidden through any composed ancestor), then calls `onAdmit` once. A fence lifted from an
 * ancestor changes no geometry, so the fences are observed too, only while admission is pending.
 * A window without `IntersectionObserver` never withholds admission. Returns the disposer; a report
 * queued before disposal is ignored.
 */
export function observeAdmission(host: Element, surface: Element, options: EngineAdmissionOptions): () => void {
  let settled = false;
  let intersection: IntersectionObserver | undefined;
  let releaseFences: (() => void) | undefined;
  const view = host.ownerDocument.defaultView;
  const release = (): void => {
    settled = true;
    intersection?.disconnect();
    releaseFences?.();
  };
  const exposed = (): boolean => options.isExposed?.() ?? isAccessibilityVisible(host);
  let intersecting = false;
  const admit = (): void => {
    if (settled || !intersecting || !host.isConnected || !options.isReady() || !exposed()) return;
    release();
    options.onAdmit();
  };
  if (host.isConnected && view?.IntersectionObserver) {
    intersection = new view.IntersectionObserver((entries) => {
      if (settled || !host.isConnected) return;
      // Entries for one target arrive in time order; the last one is current.
      for (const entry of entries) {
        if (entry?.target === surface && typeof entry.isIntersecting === 'boolean') intersecting = entry.isIntersecting;
      }
      admit();
    });
    intersection.observe(surface);
  }
  intersecting = host.isConnected && !intersection;
  releaseFences = observeAncestorFences(host, admit);
  admit();
  return release;
}

/**
 * Calls `onChange` when an engine's resolved style may have changed: a theme attribute
 * on the host or a composed ancestor, or one of the {@link ENGINE_STYLE_MEDIA_QUERIES}. Unrelated
 * attribute changes are not reported. Returns the disposer.
 */
export function watchEngineStyle(host: Element, onChange: () => void): () => void {
  const releaseAncestors = observeAncestorAttributes(host, THEME_ATTRIBUTES, onChange);
  const view = host.ownerDocument.defaultView;
  const lists = view ? ENGINE_STYLE_MEDIA_QUERIES.map((query) => view.matchMedia(query)) : [];
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    releaseAncestors();
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}

/**
 * Plain style values an optional WebGL engine paints with: concrete CSS colour strings and CSS
 * pixels. Owned structurally here so the optional companion's declarations stay out of this
 * library's public type graph.
 */
export interface EngineStyle {
  readonly background: string;
  readonly foreground: string;
  readonly muted: string;
  readonly accent: string;
  readonly focus: string;
  /** Categorical colours, indexed by an item's category. */
  readonly palette: readonly string[];
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly pointSize: number;
  readonly lineWidth: number;
  readonly devicePixelRatio: number;
  readonly reducedMotion: boolean;
  readonly forcedColors: boolean;
}

/** The categorical chart tokens, in palette order. */
export const ENGINE_CHART_PALETTE: readonly string[] = /* @__PURE__ */ Array.from({ length: 8 }, (_, index) => `--lr-color-chart-${index + 1}`);

/** Background, foreground, muted, accent and focus, in that order. */
export const ENGINE_COLOR_TOKENS: readonly string[] = ['--lr-color-surface', '--lr-color-text', '--lr-color-text-quiet', '--lr-color-brand', '--lr-focus-ring-color'];

/**
 * Resolves the theme colours, the `palette` tokens, the host's font, a bounded device pixel ratio
 * and the motion/forced-colour preferences into the plain style an engine paints with. Each colour
 * is resolved in the host's theme context, then read back to `rgba()` when the owner document's
 * canvas can serialize it.
 */
export function engineStyle(host: Element, palette: readonly string[], pointSize: number, lineWidth: number): EngineStyle {
  const view = host.ownerDocument.defaultView!;
  const computed = view.getComputedStyle(host);
  const color = (token: string): string => {
    const css = resolveCanvasColor(host, `var(${token})`, computed.color);
    const rgba = readCanvasRgba(host.ownerDocument, css);
    return rgba ? toRgbaString(rgba) : css;
  };
  return { background: color('--lr-color-surface'), foreground: color('--lr-color-text'), muted: color('--lr-color-text-quiet'),
    accent: color('--lr-color-brand'), focus: color('--lr-focus-ring-color'), palette: palette.map(color),
    fontFamily: computed.fontFamily, fontSize: finiteRange(Number.parseFloat(computed.fontSize), 14, 1, 128), pointSize, lineWidth,
    devicePixelRatio: finiteRange(view.devicePixelRatio, 1, 0.25, 4), reducedMotion: view.matchMedia(ENGINE_STYLE_MEDIA_QUERIES[0]).matches,
    forcedColors: view.matchMedia(ENGINE_STYLE_MEDIA_QUERIES[1]).matches };
}
