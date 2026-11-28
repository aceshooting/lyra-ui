import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { chartValueFractionDigits } from '../../../internal/chart-number-format.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { blankNumberConverter } from '../../../internal/converters.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { getListFormat } from '../../../internal/intl-cache.js';
import { specialistTokens } from '../../../internal/specialist-host-tokens.styles.js';
import { LYRA_VARIANT_VALUES } from '../../../internal/variant-values.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { styles } from './category-bar.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_categoryBarMarker, LYRA_DEFAULT_categoryBarRange } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Caller-owned display text for a value on the scale (scale labels, marker, description). */
export type LyraCategoryBarValueFormatter = (value: number) => string;

/** Categorical chart colors available before the palette repeats. */
const PALETTE_SIZE = 8;

interface ResolvedRange {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly width: number;
  readonly color: string;
}

/**
 * `<lr-category-bar>` — one horizontal bar split into consecutive threshold ranges, with an
 * optional marker pointing at a value on the same scale.
 *
 * `values` lists the width of each range, in order from the inline start: `[40, 30, 30]` draws
 * ranges 0 to 40, 40 to 70 and 70 to 100. Non-finite and negative widths count as zero and draw
 * nothing. Each range takes its color from the matching entry of `variants`, otherwise from the
 * categorical chart palette by position. The scale runs from 0 to the sum of `values`; a `marker`
 * outside it is pinned to the nearer end while its text keeps the real value.
 *
 * The host's content is a labeled group whose text is read by assistive technology: with a
 * `marker` it names the value and the range it falls in ("Marker at 62, in range 40 to 70"),
 * otherwise it lists every range. The drawing, the marker and the optional boundary labels
 * (`withLabels`) are decorative (`aria-hidden`). Numbers are formatted for the effective locale
 * unless a host-only `valueFormatter` is supplied; a formatter that throws or returns a
 * non-string falls back to the locale format for that value.
 *
 * `values` and `variants` are owned collections: each assignment is detached into a frozen
 * snapshot, so later caller mutation has no effect until a new array is assigned.
 *
 * @customElement lr-category-bar
 * @csspart base - The labeled group.
 * @csspart bar - The track holding every range.
 * @csspart range - One threshold range.
 * @csspart marker - The value marker, rendered only while `marker` is a finite number.
 * @csspart labels - The row of boundary values shown with `with-labels`.
 * @csspart range-label - One boundary value, at the start of its range or at the scale's end.
 * @csspart description - The visually hidden text that names the marker's range or lists every range.
 * @csspart empty - The localized no-data text shown when no range has a positive width.
 * @cssprop [--lr-category-bar-size=var(--lr-size-0-5rem)] - Block size of the bar.
 * @cssprop [--lr-category-bar-marker-color=var(--lr-color-text)] - Color of the marker.
 * @status experimental
 * @since 33.2.0
 */
export class LyraCategoryBar extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    categoryBarMarker: LYRA_DEFAULT_categoryBarMarker,
    categoryBarRange: LYRA_DEFAULT_categoryBarRange,
    chart: LYRA_DEFAULT_chart,
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['values', 'variants']);

  static override styles = [LyraElement.styles, specialistTokens, styles, srOnly];

  /** Width of each consecutive range, from the inline start. Assigned arrays are detached. */
  @property({ attribute: false }) values: readonly number[] = [];

  /** Semantic color of each range, matched by position. Missing or unknown entries use the
   *  categorical chart palette. Assigned arrays are detached. */
  @property({ attribute: false }) variants?: readonly LyraVariant[];

  /** A value on the bar's scale to point at. Unset or non-finite draws no marker. */
  @property({ converter: blankNumberConverter(undefined) }) marker?: number;

  /** Accessible name for the group. A host `aria-label` wins over it; blank falls back to a
   *  localized generic chart name. */
  @property() label = '';

  /** Shows each range's start value, and the scale's end, under the bar. */
  @property({ type: Boolean, reflect: true, attribute: 'with-labels' }) withLabels = false;

  /** Optional display formatter for scale labels, the marker value and the accessible
   *  description. Host-only (no attribute); unset uses the locale's number format. */
  @property({ attribute: false }) valueFormatter?: LyraCategoryBarValueFormatter;

  private resolveRanges(): ResolvedRange[] {
    const values: unknown = this.values;
    if (!Array.isArray(values)) return [];
    const variants: unknown = this.variants;
    const variantList = Array.isArray(variants) ? (variants as readonly unknown[]) : [];
    const ranges: ResolvedRange[] = [];
    let start = 0;
    (values as readonly unknown[]).forEach((value, index) => {
      const width = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
      const variant = variantList[index];
      ranges.push({
        index,
        start,
        end: start + width,
        width,
        color: (LYRA_VARIANT_VALUES as readonly unknown[]).includes(variant)
          ? `var(--lr-color-${variant as LyraVariant}-fill-loud)`
          : `var(--lr-color-chart-${(index % PALETTE_SIZE) + 1})`,
      });
      start += width;
    });
    return ranges;
  }

  private formatValue(value: number): string {
    const formatter = this.valueFormatter;
    if (typeof formatter === 'function') {
      try {
        const formatted: unknown = formatter(value);
        if (typeof formatted === 'string') return formatted;
      } catch {
        // A failing caller formatter falls back to the locale format for this value.
      }
    }
    return this.formatLocaleNumber(value, { maximumFractionDigits: chartValueFractionDigits(value) });
  }

  private rangeText(range: ResolvedRange): string {
    return this.localize('categoryBarRange', undefined, {
      start: this.formatValue(range.start),
      end: this.formatValue(range.end),
    });
  }

  /** The drawn range containing `value`; a value off the scale belongs to the nearer end range. */
  private rangeAt(ranges: readonly ResolvedRange[], value: number): ResolvedRange {
    const drawn = ranges.filter((range) => range.width > 0);
    return drawn.find((range) => value < range.end) ?? drawn[drawn.length - 1]!;
  }

  private percent(value: number, total: number): string {
    return `${Math.min(1, Math.max(0, value / total)) * 100}%`;
  }

  override render(): TemplateResult {
    const ranges = this.resolveRanges();
    const total = ranges.length ? ranges[ranges.length - 1]!.end : 0;
    if (!(total > 0) || !Number.isFinite(total)) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    const drawn = ranges.filter((range) => range.width > 0);
    // Unset stays unset; any other value must be finite to draw a marker.
    const markerInput = this.marker == null ? Number.NaN : Number(this.marker);
    const marker = Number.isFinite(markerInput) ? finiteNumber(markerInput, 0) : null;
    const name = hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('chart');
    let description: string;
    if (marker === null) {
      description = getListFormat(this.effectiveLocale, { style: 'long', type: 'unit' }).format(
        drawn.map((range) => this.rangeText(range)),
      );
    } else {
      const range = this.rangeAt(ranges, marker);
      description = this.localize('categoryBarMarker', undefined, {
        value: this.formatValue(marker),
        start: this.formatValue(range.start),
        end: this.formatValue(range.end),
      });
    }
    return html`<div part="base" role="group" aria-label=${name}>
      <span part="description" class="sr-only">${description}</span>
      <div class="graphic" aria-hidden="true">
        <div part="bar">
          ${drawn.map(
            (range) => html`<span
              part="range"
              data-index=${range.index}
              style=${styleMap({ inlineSize: this.percent(range.width, total), '--_lr-category-bar-color': range.color })}
            ></span>`,
          )}
        </div>
        ${marker === null
          ? nothing
          : html`<span part="marker" style=${styleMap({ insetInlineStart: this.percent(marker, total) })}></span>`}
      </div>
      ${this.withLabels
        ? html`<div part="labels" aria-hidden="true">
            ${drawn.map(
              (range) => html`<span part="range-label" style=${styleMap({ inlineSize: this.percent(range.width, total) })}
                >${this.formatValue(range.start)}</span
              >`,
            )}
            <span part="range-label" data-end>${this.formatValue(total)}</span>
          </div>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-category-bar': LyraCategoryBar;
  }
}
