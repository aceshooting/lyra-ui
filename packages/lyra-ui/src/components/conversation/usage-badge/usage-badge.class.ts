import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { place } from '../../../internal/positioner.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { styles } from './usage-badge.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { durationMessageValue } from '../../../internal/duration.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_durationMilliseconds, LYRA_DEFAULT_durationSeconds, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_tokensIn, LYRA_DEFAULT_tokensOut, LYRA_DEFAULT_usageBadgeCostLabel, LYRA_DEFAULT_usageBadgeLabel, LYRA_DEFAULT_usageBadgeLatencyLabel, LYRA_DEFAULT_usageBadgeTokensIn, LYRA_DEFAULT_usageBadgeTokensInLabel, LYRA_DEFAULT_usageBadgeTokensOut, LYRA_DEFAULT_usageBadgeTokensOutLabel, LYRA_DEFAULT_usageBadgeTotalTokensLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-usage-badge>` — a compact, static resource strip for one message or run: tokens in/out,
 * cost, latency, with a hover/focus tooltip breakdown. Purely formatting — this component computes
 * no counts, rates, or prices; every segment is independently optional, and with nothing set,
 * nothing renders at all (not even a focusable/interactive shell).
 *
 * The tooltip reuses `<lr-tool-call-chip>`'s hover/focus/Escape/`aria-describedby` contract
 * wholesale: hover and focus are tracked as independent "keep it open" reasons, so releasing one
 * modality while the other still holds doesn't close it.
 *
 * The built-in latency formatting has no minutes/hours tier (`'{ms}ms'`, or one-decimal seconds
 * above 1000ms) — a host whose latencies commonly exceed a minute sets `formatLatency` to render
 * its own scale instead, in both the visible strip and the tooltip row.
 *
 * An `aria-label` set on the host element (the idiomatic way to name any custom element) wins
 * over the localized default accessible name, same convention as `<lr-tool-call-chip>`'s own
 * `aria-label` precedence.
 *
 * Number abbreviation is `abbreviate`, not `compact`. This badge has no density mode; `compact`
 * (removed in 9.0.0) selected `Intl.NumberFormat`'s `notation: 'compact'` here while meaning
 * visual density on every other component that spells it, so the name was moved to what it
 * actually does. A stale `compact` attribute is inert.
 *
 * @customElement lr-usage-badge
 * @slot summary - Visible summary shown when no built-in segment is set. The `summary` property is
 *   its text fallback. A details-only badge without either form of summary remains non-focusable.
 * @slot details - Extra rows appended below the built-in tooltip breakdown (e.g. cache-read
 *   tokens). Interactive descendants are intentionally inert because this is a tooltip, not a
 *   dialog; their accessible text is mirrored into the trigger's tooltip description.
 * @csspart base - The root inline strip (a focusable non-button `role="group"`, only while at
 *   least one segment, or a visible summary with details, has content).
 * @csspart summary - The visible fallback shown when no built-in segment is set.
 * @csspart tokens-in - The `'{count} in'` segment. Only rendered when `tokensIn` is a finite
 *   number.
 * @csspart tokens-out - The `'{count} out'` segment. Only rendered when `tokensOut` is a finite
 *   number.
 * @csspart cost - The verbatim `costText`. Only rendered when set.
 * @csspart latency - The formatted `latencyMs`. Only rendered when it's a finite number.
 * @csspart tooltip - The floating detail breakdown, only meaningful while open.
 * @status stable
 * @since 4.0.0
 */
export class LyraUsageBadge extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    durationMilliseconds: LYRA_DEFAULT_durationMilliseconds,
    durationSeconds: LYRA_DEFAULT_durationSeconds,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    tokensIn: LYRA_DEFAULT_tokensIn,
    tokensOut: LYRA_DEFAULT_tokensOut,
    usageBadgeCostLabel: LYRA_DEFAULT_usageBadgeCostLabel,
    usageBadgeLabel: LYRA_DEFAULT_usageBadgeLabel,
    usageBadgeLatencyLabel: LYRA_DEFAULT_usageBadgeLatencyLabel,
    usageBadgeTokensIn: LYRA_DEFAULT_usageBadgeTokensIn,
    usageBadgeTokensInLabel: LYRA_DEFAULT_usageBadgeTokensInLabel,
    usageBadgeTokensOut: LYRA_DEFAULT_usageBadgeTokensOut,
    usageBadgeTokensOutLabel: LYRA_DEFAULT_usageBadgeTokensOutLabel,
    usageBadgeTotalTokensLabel: LYRA_DEFAULT_usageBadgeTotalTokensLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Input tokens. Normalized to a non-negative integer, locale-formatted. Segment omitted
   *  entirely while unset or non-finite. */
  @property({ type: Number, attribute: 'tokens-in' }) tokensIn?: number;

  /** Output tokens. Same rules as `tokensIn`. */
  @property({ type: Number, attribute: 'tokens-out' }) tokensOut?: number;

  /** Pre-formatted cost (e.g. `"$0.012"`), rendered verbatim. Currency formatting is host domain. */
  @property({ attribute: 'cost-text' }) costText = '';

  /** Latency in milliseconds, formatted with the shared duration algorithm (or `formatLatency`,
   *  when set). */
  @property({ type: Number, attribute: 'latency-ms' }) latencyMs?: number;

  /** Visible text used when there are no built-in token/cost/latency segments. Required to make a
   *  details-only badge into a discoverable tooltip trigger; the `summary` slot takes precedence. */
  @property() summary = '';

  /** Overrides the shared short-duration rendering of `latencyMs` (`'{ms}ms'`, or one-decimal
   *  seconds above 1000ms — no minutes/hours tier) in both the visible strip and the tooltip row.
   *  Mirrors `<lr-activity-feed>`'s `formatTimestamp` convention. */
  @property({ attribute: false }) formatLatency?: (ms: number) => string;

  /** Token counts render via `Intl.NumberFormat` `notation: 'compact'` (e.g. `12345 -> "12K"`)
   *  when set; the tooltip always shows full grouped figures regardless. Named for the number
   *  formatting it selects, not for density: `compact` means visual density on twenty other
   *  components in this library, and this one has no density mode at all. */
  @property({ type: Boolean, reflect: true }) abbreviate = false;

  @state() private tooltipOpen = false;
  @state() private hasDetailsSlot = false;
  @state() private hasSummarySlot = false;
  @state() private detailsText = '';

  private readonly tooltipId = nextId('usage-badge-tooltip');
  private cleanupPositioner?: () => void;
  private hovering = false;
  private focused = false;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // A server render sees no light-DOM children at all, so a hydrating badge reproduces the
    // server's slot-less rendering first and picks the slotted content up one update later.
    this.seedFirstRenderState(() => {
      const children = Array.from(this.children);
      this.hasDetailsSlot = children.some((child) => child.getAttribute('slot') === 'details');
      this.hasSummarySlot = children.some((child) => child.getAttribute('slot') === 'summary');
    });
    if (
      this.hasUpdated &&
      (changed.has('tokensIn') ||
        changed.has('tokensOut') ||
        changed.has('costText') ||
        changed.has('latencyMs') ||
        changed.has('summary')) &&
      !this.hasInteractiveTooltip
    ) {
      this.closeTooltipLifecycle();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('tooltipOpen')) {
      this.cleanupPositioner?.();
      this.cleanupPositioner = undefined;
      if (this.tooltipOpen) {
        const anchor = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
        const tooltip = this.renderRoot.querySelector('[part="tooltip"]') as HTMLElement | null;
        if (anchor && tooltip) this.cleanupPositioner = place(anchor, tooltip, { placement: 'top-start' });
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    // Reset so a reconnect (e.g. a drag-drop reparent or a list re-render that detaches and
    // reattaches this node) re-triggers `updated()`'s `tooltipOpen`-driven branch -- without
    // this, `tooltipOpen` stays `true` across the disconnect/reconnect and
    // `changed.has('tooltipOpen')` never fires again, leaving the tooltip rendered open at a
    // stale, frozen position with no live positioner attached. Mirrors `<lr-tool-call-chip>`'s
    // own disconnectedCallback.
    this.tooltipOpen = false;
    this.hovering = false;
    this.focused = false;
  }

  private onDetailsSlotChange = (e: Event): void => {
    const assigned = (e.target as HTMLSlotElement).assignedElements({ flatten: true });
    this.hasDetailsSlot = assigned.length > 0;
    // `innerText` mirrors the rendered detail rows (omitting display:none descendants) even though
    // their wrapper is deliberately inert. Bound both breadth and output so arbitrary light-DOM
    // content cannot turn a compact badge update into unbounded accessibility work.
    this.detailsText = assigned
      .slice(0, 64)
      .map((element) => {
        const renderedText = (element as Element & { innerText?: unknown }).innerText;
        return typeof renderedText === 'string' ? renderedText : (element.textContent ?? '');
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4096);
    if (!this.hasInteractiveTooltip) this.closeTooltipLifecycle();
  };

  private onSummarySlotChange = (e: Event): void => {
    this.hasSummarySlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    if (!this.hasInteractiveTooltip) this.closeTooltipLifecycle();
  };

  private get hasTokensIn(): boolean {
    return this.tokensIn != null && Number.isFinite(this.tokensIn);
  }
  private get hasTokensOut(): boolean {
    return this.tokensOut != null && Number.isFinite(this.tokensOut);
  }
  private get hasCost(): boolean {
    return this.costText.length > 0;
  }
  /** `latencyMs` normalized to a finite, non-negative duration -- `undefined` while unset or
   *  non-finite (the `latency` segment/tooltip row is omitted entirely). */
  private get validLatencyMs(): number | undefined {
    if (this.latencyMs == null || !Number.isFinite(this.latencyMs)) return undefined;
    return finiteRange(this.latencyMs, this.latencyMs, 0);
  }

  private get hasLatency(): boolean {
    return this.validLatencyMs !== undefined;
  }
  private get hasVisibleContent(): boolean {
    return this.hasTokensIn || this.hasTokensOut || this.hasCost || this.hasLatency;
  }
  private get hasVisibleSummary(): boolean {
    return this.summary.length > 0 || this.hasSummarySlot;
  }
  private get hasDisplayContent(): boolean {
    return this.hasVisibleContent || this.hasVisibleSummary;
  }
  private get hasTooltipContent(): boolean {
    return this.hasVisibleContent || this.hasDetailsSlot;
  }
  private get hasInteractiveTooltip(): boolean {
    return this.hasDisplayContent && this.hasTooltipContent;
  }

  private formatTokenCount(n: number): string {
    return getNumberFormat(this.effectiveLocale, this.abbreviate ? { notation: 'compact' } : {}).format(n);
  }
  private formatTokenCountFull(n: number): string {
    return getNumberFormat(this.effectiveLocale).format(n);
  }
  private localizedDuration(ms: number): string {
    if (this.formatLatency) return this.formatLatency(ms);
    const duration = durationMessageValue(ms);
    const value = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: duration.key === 'durationMilliseconds' ? 0 : 1,
    }).format(duration.value);
    return this.localize(duration.key, undefined, { value });
  }

  private showTooltip(): void {
    if (!this.hasInteractiveTooltip || this.tooltipOpen) return;
    this.tooltipOpen = true;
  }
  private hideTooltip(): void {
    if (!this.tooltipOpen) return;
    this.tooltipOpen = false;
  }

  private closeTooltipLifecycle(): void {
    this.tooltipOpen = false;
    this.hovering = false;
    this.focused = false;
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
  }

  private onMouseEnter = (): void => {
    this.hovering = true;
    this.showTooltip();
  };
  private onMouseLeave = (): void => {
    this.hovering = false;
    if (this.focused) return;
    this.hideTooltip();
  };
  private onFocus = (): void => {
    this.focused = true;
    this.showTooltip();
  };
  private onBlur = (): void => {
    this.focused = false;
    if (this.hovering) return;
    this.hideTooltip();
  };
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.tooltipOpen) {
      e.stopPropagation();
      this.hideTooltip();
    }
  };

  override render(): TemplateResult {
    // Nothing to show or describe remains an inert shell (no tabindex, role, or aria-label), while
    // the named slots remain mounted so later light-DOM additions are observed. A details-only
    // badge also stays out of the tab order until the host supplies its required visible summary.
    const interactive = this.hasInteractiveTooltip;
    const tokensIn = this.hasTokensIn ? finiteCount(this.tokensIn!) : undefined;
    const tokensOut = this.hasTokensOut ? finiteCount(this.tokensOut!) : undefined;
    const hasBoth = tokensIn !== undefined && tokensOut !== undefined;

    return html`
      <div
        part="base"
        role=${interactive ? 'group' : nothing}
        tabindex=${interactive ? '0' : nothing}
        aria-label=${!interactive
          ? nothing
          : this.getAttribute('aria-label') ?? this.localize('usageBadgeLabel')}
        aria-describedby=${interactive && this.tooltipOpen ? this.tooltipId : nothing}
        @mouseenter=${this.onMouseEnter}
        @mouseleave=${this.onMouseLeave}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
        @keydown=${this.onKeyDown}
      >
        ${this.renderBadgeContent(tokensIn, tokensOut, hasBoth)}
      </div>
    `;
  }

  private renderBadgeContent(
    tokensIn: number | undefined,
    tokensOut: number | undefined,
    hasBoth: boolean,
  ): TemplateResult {
    return html`
        ${tokensIn !== undefined
          ? html`<span part="tokens-in">${this.localize('usageBadgeTokensIn', undefined, { count: this.formatTokenCount(tokensIn) })}</span>`
          : nothing}
        ${tokensOut !== undefined
          ? html`<span part="tokens-out">${this.localize('usageBadgeTokensOut', undefined, { count: this.formatTokenCount(tokensOut) })}</span>`
          : nothing}
        ${this.hasCost ? html`<span part="cost">${this.costText}</span>` : nothing}
        ${this.hasLatency ? html`<span part="latency">${this.localizedDuration(this.validLatencyMs!)}</span>` : nothing}
        <span part="summary" ?hidden=${this.hasVisibleContent}>
          <slot name="summary" @slotchange=${this.onSummarySlotChange}>${this.summary}</slot>
        </span>
        ${this.hasTooltipContent
          ? html`<div part="tooltip" id=${this.tooltipId} role="tooltip" ?hidden=${!this.tooltipOpen}>
          ${tokensIn !== undefined
            ? html`<div class="row"><span>${this.localize('usageBadgeTokensInLabel')}</span><span>${this.formatTokenCountFull(tokensIn)}</span></div>`
            : nothing}
          ${tokensOut !== undefined
            ? html`<div class="row"><span>${this.localize('usageBadgeTokensOutLabel')}</span><span>${this.formatTokenCountFull(tokensOut)}</span></div>`
            : nothing}
          ${hasBoth
            ? html`<div class="row"><span>${this.localize('usageBadgeTotalTokensLabel')}</span><span>${this.formatTokenCountFull(tokensIn! + tokensOut!)}</span></div>`
            : nothing}
          ${this.hasCost
            ? html`<div class="row"><span>${this.localize('usageBadgeCostLabel')}</span><span>${this.costText}</span></div>`
            : nothing}
          ${this.hasLatency
            ? html`<div class="row"><span>${this.localize('usageBadgeLatencyLabel')}</span><span>${this.localizedDuration(this.validLatencyMs!)}</span></div>`
            : nothing}
          <span class="slot-content" inert>
            <slot name="details" @slotchange=${this.onDetailsSlotChange}></slot>
          </span>
          ${this.detailsText ? html`<span class="sr-only">${this.detailsText}</span>` : nothing}
        </div>`
          : html`<span hidden><slot name="details" @slotchange=${this.onDetailsSlotChange}></slot></span>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-usage-badge': LyraUsageBadge;
  }
}
