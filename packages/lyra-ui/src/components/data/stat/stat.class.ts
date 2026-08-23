import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { safeLinkHref } from '../../../internal/safe-url.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraFrame, LyraVariant } from '../../../internal/variants.js';
import { styles } from './stat.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_statTrendAnnouncement, LYRA_DEFAULT_statTrendBad, LYRA_DEFAULT_statTrendDecreased, LYRA_DEFAULT_statTrendGood, LYRA_DEFAULT_statTrendIncreased, LYRA_DEFAULT_trendUnchanged } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type StatGoodDirection = 'up' | 'down';
export type StatOrientation = 'vertical' | 'horizontal';
export interface StatRow {
  readonly label: string;
  readonly value: string;
  /** Exact value shown as a hover/focus tooltip on this row's `row-value` (mirrors the headline
   *  `exactValue`/`exact-value` behavior). Also makes this row's `[part='row-value']`
   *  keyboard-focusable so the tooltip is reachable without a pointer. */
  readonly exactValue?: string;
}

const MAX_STAT_ROWS = 10_000;

const NESTED_CONTROL_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'audio[controls]',
  'video[controls]',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(',');

function isElementNode(value: EventTarget | undefined): value is Element {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { nodeType?: unknown }).nodeType === 1 &&
    typeof (value as { matches?: unknown }).matches === 'function'
  );
}

/**
 * `<lr-stat>` — a KPI/stat card. First-party invention consolidating the
 * "metric row" / "KPI card" pattern common to dashboard UIs.
 *
 * @customElement lr-stat
 * @slot start - Leading icon. Takes precedence over the legacy default slot when both are filled.
 * @slot - Legacy leading-icon alias, retained as the fallback for `start`.
 * @slot caption - Rich caption content (overrides the `caption` attribute).
 * @slot spark - A sparkline (e.g. `<lr-sparkline>`) or other compact trend
 *   visual. `lr-stat` only reserves the slot; it doesn't render one itself.
 * @slot sub - Rich sub-line content (overrides the `sub` attribute).
 * When linked, every consumer slot remains a sibling of the stretched anchor so an interactive
 * slotted descendant is never nested inside the whole-card link.
 * @csspart base - The component's root wrapper (`<div>`, or a stretched real `<a>` when `href` is safe).
 * @csspart icon - Container for the leading icon slot.
 * @csspart label - The label text. Hidden (and collapsed) whenever `label` is empty, so a
 *   label-less stat doesn't leave a blank line above the value.
 * @csspart value-row - Wrapper around the value and unit.
 * @csspart value - The value text. Accessibly labelled by the `label` part (via
 *   `aria-labelledby`) whenever `label` is set, so tabbing directly to this
 *   (focusable when `exactValue` is set) control still announces which metric and visible unit it is.
 * @csspart unit - The unit text.
 * @csspart trend - The trend pill.
 * @csspart sub - Container for the `sub` attribute/slot.
 * @csspart spark - Container for the `spark` slot.
 * @csspart caption - Container for the caption attribute/slot.
 * @csspart rows - Container for the `rows` breakdown list.
 * @csspart row - A single breakdown row (one per `rows` entry).
 * @csspart row-label - The label text of a breakdown row.
 * @csspart row-value - The value text of a breakdown row. Shows the row's `exactValue` (if any) as
 *   a hover/focus tooltip, same as the headline `value`, and is accessibly labelled by its
 *   `row-label` (via `aria-labelledby`) the same way the headline `value` is.
 * @cssprop [--lr-stat-trend-good-color=var(--lr-color-success)] - Text color of the trend pill
 *   when its polarity is "good". Independent of the headline value's `variant="success"` tint,
 *   which reads the shared `--lr-color-success` token directly.
 * @cssprop [--lr-stat-trend-good-bg=color-mix(in srgb, var(--lr-color-success) 8%, transparent)] -
 *   Background of the trend pill when its polarity is "good".
 * @cssprop [--lr-stat-trend-bad-color=var(--lr-color-danger)] - Text color of the trend pill when
 *   its polarity is "bad". Independent of the headline value's `variant="danger"` tint, which
 *   reads the shared `--lr-color-danger` token directly.
 * @cssprop [--lr-stat-trend-bad-bg=color-mix(in srgb, var(--lr-color-danger) 8%, transparent)] -
 *   Background of the trend pill when its polarity is "bad".
 * @cssprop [--lr-stat-value-brand-color=var(--lr-color-brand)] - Headline value color for the
 *   `brand` variant.
 * @cssprop [--lr-stat-value-success-color=var(--lr-color-success)] - Headline value color for the
 *   `success` variant.
 * @cssprop [--lr-stat-value-warning-color=var(--lr-color-warning)] - Headline value color for the
 *   `warning` variant.
 * @cssprop [--lr-stat-value-danger-color=var(--lr-color-danger)] - Headline value color for the
 *   `danger` variant.
 * @cssprop [--lr-stat-emphasis-border-color=var(--lr-color-brand)] - Accent-edge color when
 *   `emphasis` is set. Independent of the headline's emphasis tint and `brand` variant.
 * @cssprop [--lr-stat-emphasis-value-color=var(--lr-color-brand)] - Headline value color when
 *   `emphasis` is set on a neutral stat. Independent of the accent edge and `brand` variant.
 * @cssprop [--lr-stat-link-hover-border-color=var(--lr-color-brand)] - Linked-card border on hover.
 * @cssprop [--lr-stat-link-hover-shadow=var(--lr-shadow-s)] - Linked-card shadow on hover.
 * @cssprop [--lr-stat-link-active-border-color=var(--lr-stat-link-hover-border-color,var(--lr-color-brand))] - Linked-card border while pressed.
 * @cssprop [--lr-stat-link-active-shadow=var(--lr-stat-link-hover-shadow,var(--lr-shadow-s))] - Linked-card shadow while pressed.
 * @cssprop [--lr-stat-link-active-bg=color-mix(...)] - Linked-card background while pressed.
 * @status stable
 * @since 4.0.0
 */
export class LyraStat extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    statTrendAnnouncement: LYRA_DEFAULT_statTrendAnnouncement,
    statTrendBad: LYRA_DEFAULT_statTrendBad,
    statTrendDecreased: LYRA_DEFAULT_statTrendDecreased,
    statTrendGood: LYRA_DEFAULT_statTrendGood,
    statTrendIncreased: LYRA_DEFAULT_statTrendIncreased,
    trendUnchanged: LYRA_DEFAULT_trendUnchanged,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  @property() label = '';
  /** Host accessible-name override forwarded to the linked anchor when `href` is safe. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() value = '';
  @property() unit = '';
  @property({ reflect: true }) variant: LyraVariant = 'neutral';
  /** When set to a safe URL, renders the whole stat as a real anchor instead of a static div. */
  @property() href?: string;
  /** Native anchor target, used only while `href` resolves to a link. Setting this to `'_blank'`
   *  (or any other target) automatically derives `rel="noopener noreferrer"` on the rendered
   *  anchor -- there is no separately-settable `rel` property, so a consumer can't forget it and
   *  leave the opened page holding a `window.opener` back-reference (reverse-tabnabbing). Matches
   *  `app-rail-item.class.ts`'s pattern. */
  @property() target?: string;

  private _deltaPercent: number | null = null;
  /** Percentage delta for the trend pill. Null (the JSON-safe default) hides the pill;
   * non-finite input normalizes to null and finite numbers remain unclamped. */
  @property({ type: Number, attribute: 'delta-percent' })
  get deltaPercent(): number | null {
    return this._deltaPercent;
  }
  set deltaPercent(value: number | null) {
    const old = this._deltaPercent;
    this._deltaPercent = value != null && Number.isFinite(value) ? finiteNumber(value, 0) : null;
    this.requestUpdate('deltaPercent', old);
  }

  @property() caption = '';
  /** Which trend direction counts as "good" — inverts arrow/color polarity for
   *  cost/latency/error-rate-style metrics where a decrease is the win. */
  @property({ attribute: 'good-direction' }) goodDirection: StatGoodDirection = 'up';
  private _rows: readonly StatRow[] = [];
  /** Breakdown rows rendered as a simple label/value list beneath the caption. The first 10,000
   * rows are snapshotted and frozen so caller mutation cannot bypass the reactive boundary;
   * reassign the collection to update. */
  @property({ attribute: false })
  get rows(): readonly StatRow[] { return this._rows; }
  set rows(value: readonly StatRow[]) {
    const previous = this._rows;
    const snapshot: StatRow[] = [];
    if (Array.isArray(value)) {
      for (const row of value.slice(0, MAX_STAT_ROWS)) {
        try {
          snapshot.push(Object.freeze({
            label: typeof row?.label === 'string' ? row.label : '',
            value: typeof row?.value === 'string' ? row.value : '',
            ...(typeof row?.exactValue === 'string' ? { exactValue: row.exactValue } : {}),
          }));
        } catch {
          // Retain the safe prefix and later valid rows when an untyped record getter throws.
        }
      }
    }
    this._rows = Object.freeze(snapshot);
    this.requestUpdate('rows', previous);
  }
  /** Visual emphasis (e.g. for a "headline" stat in a group) — orthogonal to
   *  the status `variant`; see the `[part='value']` selector below for how
   *  the two combine. */
  @property({ type: Boolean, reflect: true }) emphasis = false;
  /** Exact value shown as a hover/focus tooltip on the headline `value` (e.g. `value="$1.2K"
   *  exact-value="$1,204.37"`). Also makes `[part='value']` keyboard-focusable so the tooltip is
   *  reachable without a pointer. */
  @property({ attribute: 'exact-value' }) exactValue = '';
  /** A secondary line distinct from `caption` (e.g. a comparison-period label), rendered between the
   *  trend pill and the caption. */
  @property() sub = '';
  /** Renders `value` as smaller/lighter prose (e.g. a loading/status message) instead of the bold
   *  numeric headline style, and hides `unit`. */
  @property({ type: Boolean, reflect: true }) prose = false;
  /** Tighter padding for constrained spaces — same convention as `lr-empty`'s `compact`. */
  @property({ type: Boolean, reflect: true }) compact = false;
  /** Container treatment — the shared `frame` vocabulary, not a fill. `'card'` (the default) keeps
   *  the bordered, filled, padded box that stretches to fill its parent; `'plain'` removes the
   *  border, background, padding, corner radius and the `block-size: 100%` stretch so the stat can
   *  sit inline in prose, a toolbar or a table cell. `plain` wins over `compact` when both are set
   *  (nothing left to tighten), and it also drops `emphasis`'s accent edge — that edge is card
   *  chrome — while `emphasis`'s brand value tint still applies. A `plain` stat with a safe `href`
   *  swaps the card's border-color/lift hover affordance (invisible with no border) for an
   *  underline on `[part='value']`; the `:focus-visible` ring is unchanged.
   *
   *  This was `appearance` before 8.0.0, where `appearance` meant two unrelated things across the
   *  library; it now means "how a control fills itself" everywhere, and the container treatment it
   *  used to double as is `frame`. A clean rename with no alias: `appearance` on `<lr-stat>` is
   *  simply an unknown attribute now. */
  @property({ reflect: true }) frame: LyraFrame = 'card';
  /** Layout axis. `'vertical'` (the default) stacks label, value, trend, sub and caption.
   *  `'horizontal'` lays label, value+unit, trend, sub and caption out on a single wrapping
   *  baseline row; `[part='spark']` and `[part='rows']` have no sensible place on a text baseline
   *  and stay stacked on their own full-width line beneath that row. */
  @property({ reflect: true }) orientation: StatOrientation = 'vertical';

  // Same fix `lr-empty` already established: `[part]:empty` never matches
  // because the part always contains a literal `<slot>` child. Track real
  // slot assignment in JS instead.
  @state() private hasIcon = false;
  @state() private hasCaptionSlot = false;
  @state() private hasSparkSlot = false;
  @state() private hasSubSlot = false;

  // Stable id pairing `[part='label']` with `[part='value']` via
  // aria-labelledby, so a keyboard user tabbing straight to the (focusable,
  // tooltip-bearing) value still gets an accessible name like "Revenue
  // $1.2K" instead of the bare value.
  private readonly labelId = nextId('stat-label');
  private readonly valueId = `${this.labelId}-value`;
  private readonly unitId = `${this.labelId}-unit`;
  // One id per `rows` entry, regenerated only when the `rows` array itself is
  // reassigned (not on every render) so `aria-labelledby` references stay
  // stable across unrelated re-renders.
  @state() private rowLabelIds: string[] = [];

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op today, but keeps any future LyraElement/mixin willUpdate logic wired in
    if (!this.hasUpdated) {
      // Lit's server element shim has no light-DOM `children` collection. Slot assignment is a
      // browser-only refinement, so seed from an empty collection during SSR and let slotchange
      // establish the real browser state after hydration.
      const lightChildren = Array.from(this.children ?? []);
      this.hasIcon = lightChildren.some((el) => {
        const slotName = el.getAttribute('slot');
        return slotName === null || slotName === 'start';
      });
      this.hasCaptionSlot = lightChildren.some((el) => el.getAttribute('slot') === 'caption');
      this.hasSparkSlot = lightChildren.some((el) => el.getAttribute('slot') === 'spark');
      this.hasSubSlot = lightChildren.some((el) => el.getAttribute('slot') === 'sub');
    }
    if (changed.has('rows')) {
      this.rowLabelIds = this.rows.map(() => nextId('stat-row-label'));
    }
  }

  private onIconSlotChange = (): void => {
    const startSlot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="start"]');
    const defaultSlot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    this.hasIcon = Boolean(
      startSlot?.assignedElements({ flatten: true }).length ||
        defaultSlot?.assignedElements({ flatten: true }).length,
    );
  };

  private onCaptionSlotChange = (e: Event): void => {
    this.hasCaptionSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onSparkSlotChange = (e: Event): void => {
    this.hasSparkSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onSubSlotChange = (e: Event): void => {
    this.hasSubSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLinkedContentClick = (event: Event): void => {
    for (const node of event.composedPath()) {
      if (node === event.currentTarget) break;
      if (isElementNode(node) && node.matches(NESTED_CONTROL_SELECTOR)) return;
    }
    this.shadowRoot?.querySelector<HTMLAnchorElement>('[part="base"][href]')?.click();
  };

  /** Activates the real whole-card anchor when this stat is linked. */
  override click(): void {
    const anchor = this.shadowRoot?.querySelector<HTMLAnchorElement>('[part="base"][href]');
    if (anchor) anchor.click();
    else super.click();
  }

  override render(): TemplateResult {
    const href = safeLinkHref(this.href);
    const linked = Boolean(href);
    const hasTrend = this.deltaPercent !== null;
    const effectiveDelta = this.deltaPercent ?? 0;
    const rawDirection = effectiveDelta > 0 ? 'up' : effectiveDelta < 0 ? 'down' : 'flat';
    const isGood = rawDirection === 'flat' ? null : rawDirection === this.goodDirection;
    // The trend pill previously rendered literal ▲/▼ glyphs — font-dependent
    // and inconsistent with the rest of the icon set — swapped for the
    // shared chevronIcon(), rotated per direction via CSS on the wrapping
    // [part='trend'].
    const arrow = rawDirection === 'flat' ? '–' : chevronIcon();
    const hasCaption = this.hasCaptionSlot || this.caption.length > 0;
    const hasSub = this.hasSubSlot || this.sub.length > 0;
    const formattedTrend = getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 20,
    }).format(Math.abs(effectiveDelta) / 100);
    // The visible pill only ever shows the icon rotation + color to convey
    // direction and good/bad polarity; both are invisible to screen readers,
    // so mirror them into a plain-language sr-only announcement.
    const trendAnnouncement =
      rawDirection === 'flat'
        ? this.localize('trendUnchanged')
        : this.localize('statTrendAnnouncement', undefined, {
            trend: this.localize(rawDirection === 'up' ? 'statTrendIncreased' : 'statTrendDecreased', undefined, {
              value: formattedTrend,
            }),
            polarity: this.localize(isGood ? 'statTrendGood' : 'statTrendBad'),
          });

    const content = html`
      <span part="icon" ?hidden=${!this.hasIcon}
        ><slot name="start" @slotchange=${this.onIconSlotChange}
          ><slot @slotchange=${this.onIconSlotChange}></slot></slot
        ></span
      >
      <span part="label" id=${this.labelId} ?hidden=${!this.label}>${this.label}</span>
      <div part="value-row">
        <span
          part="value"
          id=${this.valueId}
          title=${this.exactValue || nothing}
          tabindex=${this.exactValue && !linked ? '0' : nothing}
          aria-labelledby=${this.label || this.unit
            ? [this.label ? this.labelId : '', this.valueId, this.unit ? this.unitId : ''].filter(Boolean).join(' ')
            : nothing}
          >${this.value}</span
        >
        <span part="unit" id=${this.unitId}>${this.unit}</span>
      </div>
      ${hasTrend
        ? html`<span
            part="trend"
            data-direction=${rawDirection}
            data-polarity=${isGood == null ? nothing : isGood ? 'good' : 'bad'}
          >
            <span aria-hidden="true">${arrow} ${formattedTrend}</span>
            <span class="sr-only">${trendAnnouncement}</span>
          </span>`
        : nothing}
      <div part="sub" ?hidden=${!hasSub}>
        <slot name="sub" @slotchange=${this.onSubSlotChange}>${this.sub}</slot>
      </div>
      <div part="spark" ?hidden=${!this.hasSparkSlot}>
        <slot name="spark" @slotchange=${this.onSparkSlotChange}></slot>
      </div>
      <div part="caption" ?hidden=${!hasCaption}>
        <slot name="caption" @slotchange=${this.onCaptionSlotChange}>${this.caption}</slot>
      </div>
      <div part="rows" ?hidden=${this.rows.length === 0}>
        ${this.rows.map((row, i) => {
          const rowLabelId = this.rowLabelIds[i];
          const rowValueId = `${rowLabelId}-value`;
          return html`
            <div part="row">
              <span part="row-label" id=${rowLabelId}>${row.label}</span>
              <span
                part="row-value"
                id=${rowValueId}
                title=${row.exactValue || nothing}
                tabindex=${row.exactValue && !linked ? '0' : nothing}
                aria-labelledby=${row.label ? `${rowLabelId} ${rowValueId}` : nothing}
                >${row.value}</span
              >
            </div>
          `;
        })}
      </div>
    `;
    return href
      ? html`<div class="linked-shell">
          <a
            part="base"
            href=${href}
            target=${this.target || nothing}
            rel=${this.target ? 'noopener noreferrer' : nothing}
            aria-label=${this.accessibleLabel ?? nothing}
            ><span class="sr-only">${[this.label, this.value, this.unit].filter(Boolean).join(' ')}</span></a
          >
          <div class="linked-content" @click=${this.onLinkedContentClick}>${content}</div>
        </div>`
      : html`<div part="base">${content}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-stat': LyraStat;
  }
}
