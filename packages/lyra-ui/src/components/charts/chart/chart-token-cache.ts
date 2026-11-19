import { resolveCanvasColor } from '../../../internal/canvas-color.js';
import { CSS_NUMBER_SOURCE } from '../../../internal/css-number.js';
import { FALLBACK_GRID_COLOR, FALLBACK_TICK_COLOR, FALLBACK_LEGEND_COLOR, FALLBACK_TOOLTIP_BG, FALLBACK_TOOLTIP_TEXT, FALLBACK_TICK_FONT_SIZE, type ChartThemeColors, seriesPalette, translucentAreaColor } from './chart-colors.js';
import { forcedColorsActive } from './chart-forced-colors.js';

/** Color text whose canvas value depends on the live scope rather than on the text alone. */
const SCOPE_DEPENDENT_COLOR = /var\(|currentcolor|inherit|unset/i;
const DIRECT_PIXEL_NUMBER = new RegExp(`^(${CSS_NUMBER_SOURCE})(?:px)?$`, 'i');
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
  private readonly drawCacheKeys = new Set<string>();

  constructor(private readonly scope: HTMLElement) {}

  themeColors(legacyGrid: boolean): ChartThemeColors {
    const cs = this.sync() ?? this.scope.style;
    const grid =
      (legacyGrid && cs.getPropertyValue('--grid-color').trim()) ||
      cs.getPropertyValue('--lr-chart-grid-color').trim() ||
      cs.getPropertyValue('--_lr-chart-grid-color').trim();
    const tick =
      cs.getPropertyValue('--lr-chart-tick-color').trim() ||
      cs.getPropertyValue('--_lr-chart-tick-color').trim();
    const legend =
      cs.getPropertyValue('--lr-chart-legend-color').trim() ||
      cs.getPropertyValue('--_lr-chart-legend-color').trim();
    const tooltipBg =
      cs.getPropertyValue('--lr-chart-tooltip-bg').trim() ||
      cs.getPropertyValue('--_lr-chart-tooltip-bg').trim();
    const tooltipText =
      cs.getPropertyValue('--lr-chart-tooltip-color').trim() ||
      cs.getPropertyValue('--_lr-chart-tooltip-color').trim();
    return {
      grid: this.resolve(grid, FALLBACK_GRID_COLOR),
      tick: this.resolve(tick, FALLBACK_TICK_COLOR),
      tickFontSize: this.styleNumber('--lr-chart-tick-font-size', '--_lr-chart-tick-font-size', FALLBACK_TICK_FONT_SIZE),
      legend: this.resolve(legend, FALLBACK_LEGEND_COLOR),
      tooltipBg: this.resolve(tooltipBg, FALLBACK_TOOLTIP_BG),
      tooltipText: this.resolve(tooltipText, FALLBACK_TOOLTIP_TEXT),
    };
  }

  styleColor(name: string, fallback: string): string {
    const value = (this.scope.ownerDocument?.defaultView?.getComputedStyle(this.scope) ?? this.scope.style).getPropertyValue(name).trim();
    return value ? this.resolve(value, fallback) : fallback;
  }

  styleNumber(name: string, fallbackToken: string | undefined, fallback: number): number {
    const computed = (this.scope.ownerDocument?.defaultView?.getComputedStyle(this.scope) ?? this.scope.style);
    const value =
      computed.getPropertyValue(name).trim() || (fallbackToken ? computed.getPropertyValue(fallbackToken).trim() : '');
    const direct = DIRECT_PIXEL_NUMBER.exec(value);
    if (direct) {
      const resolved = Number.parseFloat(direct[1]!);
      if (Number.isFinite(resolved) && resolved >= 0) return resolved;
    }
    if (!value || !this.scope.ownerDocument?.defaultView) return fallback;

    const resolved = this.length(value, () => {
      const probe = this.scope.ownerDocument.createElement('span');
      probe.hidden = true;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.inlineSize = value;
      (this.scope.shadowRoot ?? this.scope).append(probe);
      try {
        return Number.parseFloat(this.scope.ownerDocument.defaultView!.getComputedStyle(probe).inlineSize);
      } finally {
        probe.remove();
      }
    });
    return Number.isFinite(resolved) && resolved >= 0 ? resolved : fallback;
  }


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
    this.drawCacheKeys.clear();
  }

  /** Records only the inputs used by a successful canvas draw. */
  rememberTheme(): void {
    this.colorVariables = new Set(this.drawColorVariables);
    this.themeSnapshot = this.themeFingerprint();
    for (const key of this.values.keys()) {
      if (!this.drawCacheKeys.has(key)) this.values.delete(key);
    }
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
    this.drawCacheKeys.add(key);
    if (!this.values.has(key)) this.values.set(key, compute());
    return this.values.get(key) as T;
  }

  readonly resolve = (color: string, fallback: string): string => {
    this.trackColorVariables(color);
    return this.memo(`${color}\n${fallback}`, !SCOPE_DEPENDENT_COLOR.test(color), () =>
      resolveCanvasColor(this.scope, color, fallback));
  };

  /** Resolves each distinct batch color once while retaining its live theme dependencies. */
  resolveMany(colors: Iterable<string>, fallback: string): string[] {
    const batch = new Map<string, string>();
    const resolved: string[] = [];
    for (const color of colors) {
      let value = batch.get(color);
      if (value === undefined) {
        value = this.resolve(color, fallback);
        batch.set(color, value);
      }
      resolved.push(value);
    }
    return resolved;
  }

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
