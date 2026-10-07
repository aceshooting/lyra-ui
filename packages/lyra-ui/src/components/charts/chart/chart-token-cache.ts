import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { seriesPalette, translucentAreaColor } from './chart-colors.js';
import { forcedColorsActive } from './chart-forced-colors.js';

/** Color text whose canvas value depends on the live scope rather than on the text alone. */
const SCOPE_DEPENDENT_COLOR = /var\(|currentcolor|inherit|unset/i;
const PALETTE_SIZE = seriesPalette(null).length;
const THEME_TOKENS = [
  '--grid-color', '--lr-chart-grid-color', '--_lr-chart-grid-color',
  '--lr-chart-tick-color', '--_lr-chart-tick-color',
  '--lr-chart-legend-color', '--_lr-chart-legend-color',
  '--lr-chart-tooltip-bg', '--_lr-chart-tooltip-bg',
  '--lr-chart-tooltip-color', '--_lr-chart-tooltip-color',
  '--lr-chart-tick-font-size', '--_lr-chart-tick-font-size',
  '--lr-color-surface', '--lr-radius', '--lr-border-width-thin',
  '--lr-border-width-medium', '--lr-space-2xs',
  '--border-radius', '--border-width', '--grid-border-width',
  '--line-border-width', '--point-radius',
  '--lr-box-plot-border-width', '--lr-box-plot-item-radius',
] as const;
const CSS_VARIABLE_REFERENCE = /var\(\s*(--[\w-]+)/gi;

/**
 * Memoizes one chart's canvas color and `rem`/`em` length probes between theme changes. Every
 * probe forces a style recalculation, and a data-only redraw re-reads identical token text, so
 * results are keyed by that text within one context (`color-scheme`, forced colors, host and root
 * font size). Scope-dependent text is always probed; the owner calls `clear()` on a theme change.
 */
export class ChartTokenCache {
  private readonly values = new Map<string, unknown>();
  private context = '';
  private themeSnapshot?: string;
  private colorVariables = new Set<string>();
  private readonly drawColorVariables = new Set<string>();

  constructor(private readonly scope: Element) {}

  clear(): void {
    this.values.clear();
  }

  /** Skips ThemeWatcher redraws when the canvas inputs did not change. */
  hasThemeChanged(): boolean {
    const current = this.themeFingerprint();
    return current === undefined || this.themeSnapshot === undefined || current !== this.themeSnapshot;
  }

  /** Starts dependency collection for a new canvas draw. */
  beginThemeDraw(): void {
    this.drawColorVariables.clear();
  }

  /** Records only the inputs used by a successful canvas draw. */
  rememberTheme(): void {
    this.colorVariables = new Set(this.drawColorVariables);
    this.themeSnapshot = this.themeFingerprint();
  }

  private themeFingerprint(): string | undefined {
    const view = this.scope.ownerDocument?.defaultView;
    if (!view?.getComputedStyle) return undefined;
    const computed = view.getComputedStyle(this.scope);
    const root = this.scope.ownerDocument.documentElement;
    const names = [...THEME_TOKENS, ...this.colorVariables];
    const values = names.map(name => computed.getPropertyValue(name));
    for (let index = 1; index <= PALETTE_SIZE; index += 1) {
      values.push(computed.getPropertyValue(`--lr-color-chart-${index}`));
      values.push(computed.getPropertyValue(`--lr-theme-color-chart-${index}`));
      values.push(computed.getPropertyValue(`--lr-box-plot-border-color-${index}`));
      values.push(computed.getPropertyValue(`--lr-box-plot-fill-color-${index}`));
      if (index <= 6) {
        values.push(computed.getPropertyValue(`--border-color-${index}`));
        values.push(computed.getPropertyValue(`--fill-color-${index}`));
      }
    }
    return JSON.stringify([
      computed.color, computed.colorScheme, computed.fontSize,
      root ? view.getComputedStyle(root).fontSize : '',
      forcedColorsActive(view),
      view.matchMedia?.('(prefers-contrast: more)').matches ?? false,
      values,
    ]);
  }

  private trackColorVariables(color: string): void {
    for (const match of color.matchAll(CSS_VARIABLE_REFERENCE)) {
      this.drawColorVariables.add(match[1]!);
    }
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

  readonly resolve = (color: string, fallback: string): string => {
    this.trackColorVariables(color);
    return this.memo(`${color}\n${fallback}`, !SCOPE_DEPENDENT_COLOR.test(color), () =>
      resolveCanvasColor(this.scope, color, fallback));
  };

  translucent(color: string): string {
    this.trackColorVariables(color);
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
