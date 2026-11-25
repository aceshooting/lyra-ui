import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { bdi } from '../../../internal/bidi.js';
import { chartValueFractionDigits } from '../../../internal/chart-number-format.js';
import { collectionSupport } from '../../../internal/collection-snapshot.js';
import { blankNumberConverter } from '../../../internal/converters.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { isSafeNonArrayObject } from '../../../internal/object-guards.js';
import { LYRA_VARIANT_VALUES } from '../../../internal/variant-values.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { styles } from './bar-list.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chart, LYRA_DEFAULT_noData } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** One ranked row of a bar list. */
export interface LyraBarListItem {
  /** Row name, rendered as real text over the bar. Caller-owned copy. */
  readonly label: string;
  /** The measured value. Non-finite input renders the localized no-data text and an empty bar. */
  readonly value: number;
  /** Semantic fill for this row's bar. Omitted rows use the shared bar color. */
  readonly variant?: LyraVariant;
}

/** Row ordering: largest first, smallest first, or the caller's own order. */
export type LyraBarListSort = 'descending' | 'ascending' | 'none';

/** Formats a row value for display; receives the item's finite value. */
export type LyraBarListValueFormatter = (value: number) => string;

const SORT_VALUES: readonly LyraBarListSort[] = ['descending', 'ascending', 'none'];

interface ResolvedRow {
  readonly label: string;
  /** `null` when the item's value is missing or non-finite. */
  readonly value: number | null;
  readonly variant: LyraVariant | undefined;
}

function validRows(value: unknown): ResolvedRow[] {
  if (!Array.isArray(value)) return [];
  const rows: ResolvedRow[] = [];
  for (const entry of value as readonly unknown[]) {
    if (!isSafeNonArrayObject(entry)) continue;
    const { label, value: rowValue, variant } = entry as Partial<Record<keyof LyraBarListItem, unknown>>;
    if (typeof label !== 'string') continue;
    rows.push({
      label,
      value: typeof rowValue === 'number' && Number.isFinite(rowValue) ? rowValue : null,
      variant: (LYRA_VARIANT_VALUES as readonly unknown[]).includes(variant) ? (variant as LyraVariant) : undefined,
    });
  }
  return rows;
}

/** Stable value ordering; rows without a value always sort last. */
function sortRows(rows: ResolvedRow[], sort: LyraBarListSort): ResolvedRow[] {
  if (sort === 'none') return rows;
  const direction = sort === 'ascending' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (a.row.value === null || b.row.value === null) {
        if (a.row.value === b.row.value) return a.index - b.index;
        return a.row.value === null ? 1 : -1;
      }
      return (a.row.value - b.row.value) * direction || a.index - b.index;
    })
    .map(({ row }) => row);
}

/**
 * `<lr-bar-list>` — a ranked list of horizontal bars rendered as plain DOM, each row carrying its
 * real label over the bar and its formatted value at the row's end.
 *
 * The rows are a labeled list, so every row is read as its own text — "label value" — while the
 * bars themselves are decorative (`aria-hidden`). Bars are measured against `max` when it is a
 * positive finite number, otherwise against the largest value in `items`. Values above the scale
 * fill the track without spilling; zero, negative and missing values render an empty bar.
 *
 * Values are formatted with `Intl.NumberFormat` for the component's effective locale unless a
 * host-only `valueFormatter` is supplied; a formatter that throws or returns a non-string falls
 * back to the locale format for that row. A missing or non-finite value renders the localized
 * no-data text and always sorts last.
 *
 * `items` is an owned collection: each assignment is detached into a frozen snapshot of at most
 * the first 10,000 entries, so later caller mutation has no effect until a new array is assigned.
 * Entries that are not records, or that have no string `label`, are skipped.
 *
 * An empty list renders the localized no-data text in `[part="empty"]` and no list.
 *
 * @customElement lr-bar-list
 * @csspart base - The container element.
 * @csspart list - The labeled list of rows.
 * @csspart row - One ranked row; its text is the row's label followed by its value.
 * @csspart bar - A row's decorative bar, drawn behind its label.
 * @csspart label - A row's name.
 * @csspart value - A row's formatted value.
 * @csspart empty - The localized no-data text shown when there are no rows.
 * @cssprop [--lr-bar-list-bar-color=var(--lr-color-brand-fill-quiet)] - Fill of every bar whose row
 *   has no `variant`.
 * @cssprop [--lr-bar-list-bar-size=var(--lr-size-2rem)] - Block size of each row's bar.
 * @status experimental
 * @since unreleased
 */
export class LyraBarList extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chart: LYRA_DEFAULT_chart,
    noData: LYRA_DEFAULT_noData,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['items']);

  static override styles = [LyraElement.styles, styles];

  /** The rows to rank. Assigned arrays are detached; assign a new array to publish a change. */
  @property({ attribute: false }) items: readonly LyraBarListItem[] = [];

  /** Accessible name for the list of rows. A host `aria-label` wins over it; blank falls back to a
   *  localized generic chart name. */
  @property() label = '';

  /** The value a full-length bar represents. Unset, non-finite or non-positive uses the largest
   *  value in `items`. */
  @property({ converter: blankNumberConverter(undefined) }) max?: number;

  /** Row order: `descending` (largest first, the default), `ascending`, or `none` to keep the order
   *  of `items`. Rows without a value always come last when sorting. */
  @property({ reflect: true }) sort: LyraBarListSort = 'descending';

  /** Optional display formatter for row values. Host-only (no attribute); unset uses the locale's
   *  number format. */
  @property({ attribute: false }) valueFormatter?: LyraBarListValueFormatter;

  private get effectiveSort(): LyraBarListSort {
    return SORT_VALUES.includes(this.sort) ? this.sort : 'descending';
  }

  private formatValue(value: number): string {
    const formatter = this.valueFormatter;
    if (typeof formatter === 'function') {
      try {
        const formatted: unknown = formatter(value);
        if (typeof formatted === 'string') return formatted;
      } catch {
        // A failing caller formatter falls back to the locale format for this row.
      }
    }
    return this.formatLocaleNumber(value, { maximumFractionDigits: chartValueFractionDigits(value) });
  }

  private scaleMax(rows: readonly ResolvedRow[]): number {
    const max = finiteNumber(Number(this.max), 0);
    if (max > 0) return max;
    let largest = 0;
    for (const row of rows) if (row.value !== null && row.value > largest) largest = row.value;
    return largest;
  }

  private barLength(value: number | null, scale: number): string {
    if (value === null || scale <= 0 || value <= 0) return '0%';
    return `${Math.min(1, value / scale) * 100}%`;
  }

  override render(): TemplateResult {
    const rows = sortRows(validRows(this.items), this.effectiveSort);
    if (rows.length === 0) {
      return html`<div part="base"><p part="empty">${this.localize('noData')}</p></div>`;
    }
    const scale = this.scaleMax(rows);
    const name = hostAriaLabel(this) ?? normalizeLabel(this.label) ?? this.localize('chart');
    return html`<div part="base">
      <ul part="list" role="list" aria-label=${name}>
        ${rows.map(
          (row) => html`<li part="row">
            <span
              part="bar"
              aria-hidden="true"
              data-variant=${row.variant ?? nothing}
              style=${styleMap({ inlineSize: this.barLength(row.value, scale) })}
            ></span>
            <span part="label">${bdi(row.label)}</span>
            <span part="value">${row.value === null ? this.localize('noData') : this.formatValue(row.value)}</span>
          </li>`,
        )}
      </ul>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-bar-list': LyraBarList;
  }
}
