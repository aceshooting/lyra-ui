import { html, nothing, svg, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { nextId } from "../../../internal/a11y.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import { finiteNumber, finiteRatio } from "../../../internal/numbers.js";
import { styles } from "./sparkline.styles.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_noData, LYRA_DEFAULT_trendOf } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const VIEW = 100;
const MAX_POINTS = 500;

export type LyraSparklineAppearance = "gradient" | "line" | "solid";
export type LyraSparklineCurve = "linear" | "natural" | "step";
export type LyraSparklineTrend = "positive" | "negative" | "neutral";
export type LyraSparklineType = "line" | "bar" | "area";

function decimate<T>(arr: ReadonlyArray<T>, max: number): T[] {
  if (arr.length <= max) return [...arr];
  const step = (arr.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => arr[Math.round(i * step)]!);
}

function finiteData(value: string): number[] {
  const source = value.trim();
  if (!source) return [];
  return source
    .split(/\s+/u)
    .map(Number)
    .filter((item) => Number.isFinite(item));
}

function normalizeAppearance(value: unknown): LyraSparklineAppearance {
  return value === "gradient" || value === "line" || value === "solid"
    ? value
    : "solid";
}

function normalizeCurve(value: unknown): LyraSparklineCurve {
  return value === "natural" || value === "step" || value === "linear"
    ? value
    : "linear";
}

/**
 * `<lr-sparkline>` — a zero-dependency inline SVG trend chart.
 * Mirrors the Web Awesome `<wa-sparkline>` API under the `lr-` prefix and retains the earlier
 * `values`/`type`/`min`/`max` Lyra surface as an additive programmatic extension.
 *
 * @customElement lr-sparkline
 * @csspart sparkline - The outer SVG wrapper.
 * @csspart base - Deprecated alias for `sparkline` on the same SVG wrapper.
 * @csspart fill - The filled area rendered by `appearance="solid"` and `appearance="gradient"`.
 * @csspart line - The stroked trend path.
 * @csspart area - Compatibility alias for `fill` on the same path.
 * @csspart bar - Each rectangle rendered by the additive `type="bar"` mode.
 * @cssprop [--fill-color=var(--lr-color-brand-quiet)] - Area fill color. A `trend` supplies a
 *   semantic token default, while an authored value always wins.
 * @cssprop [--line-color=var(--lr-color-brand)] - Trend line color. A `trend` supplies a semantic
 *   token default, while an authored value always wins.
 * @cssprop [--line-width=var(--lr-border-width-medium)] - Trend line width.
 * @cssprop [--lr-sparkline-stroke-width=var(--lr-border-width-medium)] - Compatibility alias used
 *   as the fallback for `--line-width`.
 * @status stable
 * @since 4.0.0
 */
export class LyraSparkline extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    noData: LYRA_DEFAULT_noData,
    trendOf: LYRA_DEFAULT_trendOf,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Fill treatment under the trend line. */
  @property({ reflect: true }) appearance: LyraSparklineAppearance = "solid";

  /** Interpolation used to connect adjacent samples. */
  @property({ reflect: true }) curve: LyraSparklineCurve = "linear";

  /** Space-separated finite numeric samples. At least two are required. */
  @property() data = "";

  /** Accessible label applied verbatim to the SVG. */
  @property() label = "";

  /** Semantic default color; public color custom properties take precedence. */
  @property({ reflect: true }) trend?: LyraSparklineTrend;

  /** Compatibility accessible-name override. `label` takes precedence. */
  @property({ attribute: "aria-label" }) accessibleLabel: string | null = null;

  /** Additive programmatic data alias used when `data` is empty. */
  @property({ type: Array }) values: number[] = [];

  /** Additive rendering extension. Omit it to use `appearance`. */
  @property() type?: LyraSparklineType;

  /** Lower bound of the value scale (defaults to the data minimum). */
  @property({ type: Number }) min?: number;

  /** Upper bound of the value scale (defaults to the data maximum). */
  @property({ type: Number }) max?: number;

  private readonly gradientId = nextId("sparkline-gradient");

  private plotValues(): number[] {
    if (this.data.trim()) {
      const parsed = finiteData(this.data);
      return parsed.length >= 2 ? parsed : [];
    }
    return this.values.filter((item): item is number => Number.isFinite(item));
  }

  private points(
    values: readonly number[] = this.plotValues()
  ): ReadonlyArray<readonly [number, number]> {
    let autoLo = values[0] ?? 0;
    let autoHi = values[0] ?? 0;
    if (!Number.isFinite(this.min) || !Number.isFinite(this.max)) {
      for (const value of values) {
        if (value < autoLo) autoLo = value;
        if (value > autoHi) autoHi = value;
      }
    }
    let lo = finiteNumber(this.min ?? autoLo, autoLo);
    let hi = finiteNumber(this.max ?? autoHi, autoHi);
    if (lo > hi) [lo, hi] = [hi, lo];
    const samples =
      values.length > MAX_POINTS ? decimate(values, MAX_POINTS) : [...values];
    return samples.map((value, index) => {
      const forwardX =
        samples.length > 1 ? (index / (samples.length - 1)) * VIEW : VIEW / 2;
      const x = this.effectiveDirection === "rtl" ? VIEW - forwardX : forwardX;
      const y = lo === hi ? VIEW / 2 : VIEW - finiteRatio(value, lo, hi) * VIEW;
      return [x, y] as const;
    });
  }

  private linePath(points: ReadonlyArray<readonly [number, number]>): string {
    const first = points[0];
    if (!first) return "";
    if (points.length === 1)
      return `M${first[0]},${first[1]} L${first[0]},${first[1]}`;

    const curve = normalizeCurve(this.curve);
    if (curve === "step") {
      return points
        .slice(1)
        .reduce(
          (path, point) => `${path} H${point[0]} V${point[1]}`,
          `M${first[0]},${first[1]}`
        );
    }
    if (curve === "natural") {
      let path = `M${first[0]},${first[1]}`;
      for (let index = 0; index < points.length - 1; index++) {
        const before = points[Math.max(0, index - 1)]!;
        const start = points[index]!;
        const end = points[index + 1]!;
        const after = points[Math.min(points.length - 1, index + 2)]!;
        const c1x = start[0] + (end[0] - before[0]) / 6;
        const c1y = start[1] + (end[1] - before[1]) / 6;
        const c2x = end[0] - (after[0] - start[0]) / 6;
        const c2y = end[1] - (after[1] - start[1]) / 6;
        path += ` C${c1x},${c1y} ${c2x},${c2y} ${end[0]},${end[1]}`;
      }
      return path;
    }
    return points
      .map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`)
      .join(" ");
  }

  private accessibleName(values: readonly number[]): string {
    if (this.label) return this.label;
    if (this.accessibleLabel) return this.accessibleLabel;
    if (this.data.trim()) return "";

    const last = values.at(-1);
    if (last === undefined) return this.localize("noData");
    return this.localize("trendOf", undefined, {
      count: getNumberFormat(this.effectiveLocale).format(values.length),
      value: getNumberFormat(this.effectiveLocale, {
        maximumFractionDigits: 2,
      }).format(last),
    });
  }

  private renderBars(
    points: ReadonlyArray<readonly [number, number]>
  ): TemplateResult {
    const slot = VIEW / Math.max(1, points.length);
    const barWidth = Math.min(4, Math.max(1, slot * 0.7));
    return html`${points.map(([x, y]) => {
      const barY = Math.min(VIEW, Math.max(0, y));
      return svg`<rect
        part="bar"
        x="${x - barWidth / 2}"
        y="${barY}"
        width="${barWidth}"
        height="${VIEW - barY}"
      ></rect>`;
    })}`;
  }

  override render(): TemplateResult {
    const values = this.plotValues();
    const points = this.points(values);
    const name = this.accessibleName(values);
    const path = this.linePath(points);
    const appearance =
      this.type === "area"
        ? "solid"
        : this.type === "line"
        ? "line"
        : normalizeAppearance(this.appearance);
    const showFill =
      this.type !== "bar" && appearance !== "line" && points.length > 0;
    const first = points[0];
    const last = points.at(-1);
    const fillPath =
      first && last ? `${path} L${last[0]},${VIEW} L${first[0]},${VIEW} Z` : "";

    return html`<svg
      part="sparkline base"
      viewBox="0 0 ${VIEW} ${VIEW}"
      preserveAspectRatio="none"
      role=${name ? "img" : nothing}
      aria-label=${name || nothing}
    >
      ${showFill && appearance === "gradient"
        ? svg`<defs>
            <linearGradient id=${this.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop class="gradient-start" offset="0%"></stop>
              <stop class="gradient-end" offset="100%"></stop>
            </linearGradient>
          </defs>`
        : nothing}
      ${this.type === "bar"
        ? this.renderBars(points)
        : html`
            ${showFill
              ? svg`<path
                  part="fill area"
                  d=${fillPath}
                  style=${
                    appearance === "gradient"
                      ? `fill: url(#${this.gradientId})`
                      : nothing
                  }
                ></path>`
              : nothing}
            ${path ? svg`<path part="line" d=${path}></path>` : nothing}
          `}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lr-sparkline": LyraSparkline;
  }
}
