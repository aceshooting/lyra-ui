import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { seriesPalette, translucentAreaColor } from './chart-colors.js';
import { forcedColorsActive } from './chart-forced-colors.js';

/** Color text whose canvas value depends on the live scope rather than on the text alone. */
const SCOPE_DEPENDENT_COLOR = /var\(|currentcolor|inherit|unset/i;
const PALETTE_SIZE = seriesPalette(null).length;

/**
 * Memoizes one chart's canvas color and `rem`/`em` length probes between theme changes. Every
 * probe forces a style recalculation, and a data-only redraw re-reads identical token text, so
 * results are keyed by that text within one context (`color-scheme`, forced colors, host and root
 * font size). Scope-dependent text is always probed; the owner calls `clear()` on a theme change.
 */
export class ChartTokenCache {
  private readonly values = new Map<string, unknown>();
  private context = '';

  constructor(private readonly scope: Element) {}

  clear(): void {
    this.values.clear();
  }

  /** Starts a resolution pass, dropping every entry when the context changed. */
  sync(): CSSStyleDeclaration | undefined {
    const view = this.scope.ownerDocument?.defaultView;
    if (!view?.getComputedStyle) return undefined;
    const computed = view.getComputedStyle(this.scope);
    const root = this.scope.ownerDocument.documentElement;
    const context = `${computed.colorScheme}|${forcedColorsActive(view)}|${computed.fontSize}|${
      root ? view.getComputedStyle(root).fontSize : ''}`;
    if (context !== this.context) {
      this.context = context;
      this.values.clear();
    }
    return computed;
  }

  private memo<T>(key: string, cacheable: boolean, compute: () => T): T {
    if (!cacheable) return compute();
    if (!this.values.has(key)) this.values.set(key, compute());
    return this.values.get(key) as T;
  }

  readonly resolve = (color: string, fallback: string): string =>
    this.memo(`${color}\n${fallback}`, !SCOPE_DEPENDENT_COLOR.test(color), () =>
      resolveCanvasColor(this.scope, color, fallback));

  translucent(color: string): string {
    return this.memo(`\n${color}`, !SCOPE_DEPENDENT_COLOR.test(color), () =>
      translucentAreaColor(this.scope, color));
  }

  /** A probed length in pixels; only `rem`/`em` text, which the context covers, is cached. */
  length(text: string, probe: () => number): number {
    return this.memo(`\n\n\n${text}`, /^[\d.+-]+r?em$/i.test(text), probe);
  }

  palette(): string[] {
    const computed = this.sync();
    if (!computed) return seriesPalette(this.scope);
    let text = '';
    for (let index = 1; index <= PALETTE_SIZE; index += 1) {
      text += `${computed.getPropertyValue(`--lr-color-chart-${index}`).trim() ||
        computed.getPropertyValue(`--lr-theme-color-chart-${index}`).trim()}\n`;
    }
    return [...this.memo(`\n\n${text}`, !SCOPE_DEPENDENT_COLOR.test(text), () => seriesPalette(this.scope))];
  }
}
