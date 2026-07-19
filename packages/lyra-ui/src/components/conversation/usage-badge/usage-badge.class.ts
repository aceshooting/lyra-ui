import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { place } from '../../../internal/positioner.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { styles } from './usage-badge.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';

interface FormattedDuration {
  key: 'durationMilliseconds' | 'durationSeconds';
  value: string;
}

/** `820` -> `"820ms"`; `1500` -> `"1.5s"`; `2000` -> `"2s"`. Identical algorithm to
 *  `<lr-tool-call-chip>`'s own `formatDuration`, duplicated locally -- two independent,
 *  separately-consumable components. */
function formatDuration(ms: number): FormattedDuration {
  if (!Number.isFinite(ms) || ms < 1000) {
    return { key: 'durationMilliseconds', value: String(Math.round(Math.max(0, ms))) };
  }
  const seconds = ms / 1000;
  const rounded = Math.round(seconds * 10) / 10;
  return { key: 'durationSeconds', value: Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1) };
}

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
 * @customElement lr-usage-badge
 * @slot - Extra rows appended below the built-in tooltip breakdown (e.g. cache-read tokens). The
 *   visible strip itself is prop-driven only.
 * @csspart base - The root inline strip (a focusable non-button `role="group"`, only while at
 *   least one segment or the default slot has content).
 * @csspart tokens-in - The `'{count} in'` segment. Only rendered when `tokensIn` is a finite
 *   number.
 * @csspart tokens-out - The `'{count} out'` segment. Only rendered when `tokensOut` is a finite
 *   number.
 * @csspart cost - The verbatim `costText`. Only rendered when set.
 * @csspart latency - The formatted `latencyMs`. Only rendered when it's a finite number.
 * @csspart tooltip - The floating detail breakdown, only meaningful while open.
 */
export class LyraUsageBadge extends LyraElement {
  static styles = [LyraElement.styles, styles];

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

  /** Overrides the default `formatDuration()` rendering of `latencyMs` (`'{ms}ms'`, or one-decimal
   *  seconds above 1000ms — no minutes/hours tier) in both the visible strip and the tooltip row.
   *  Mirrors `<lr-activity-feed>`'s `formatTimestamp` convention. */
  @property({ attribute: false }) formatLatency?: (ms: number) => string;

  /** Token counts render via `Intl.NumberFormat` `notation: 'compact'` (e.g. `12345 -> "12K"`)
   *  when set; the tooltip always shows full grouped figures regardless. */
  @property({ type: Boolean }) compact = false;

  @state() private tooltipOpen = false;
  @state() private hasDefaultSlot = false;

  private readonly tooltipId = nextId('usage-badge-tooltip');
  private cleanupPositioner?: () => void;
  private hovering = false;
  private focused = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasDefaultSlot = Array.from(this.children).length > 0;
    }
  }

  protected updated(changed: PropertyValues): void {
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

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupPositioner?.();
  }

  private onDefaultSlotChange = (e: Event): void => {
    this.hasDefaultSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
    if (!this.hasDefaultSlot && !this.hasVisibleContent) this.hideTooltip();
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
   *  non-finite (the `latency` segment/tooltip row is omitted entirely). `formatDuration()`
   *  already tolerates a non-finite/negative input defensively, but this is the single source of
   *  truth that decides whether the segment renders at all. */
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
  private get hasTooltipContent(): boolean {
    return this.hasVisibleContent || this.hasDefaultSlot;
  }

  private formatTokenCount(n: number): string {
    return getNumberFormat(this.effectiveLocale, this.compact ? { notation: 'compact' } : {}).format(n);
  }
  private formatTokenCountFull(n: number): string {
    return getNumberFormat(this.effectiveLocale).format(n);
  }
  private localizedDuration(ms: number): string {
    if (this.formatLatency) return this.formatLatency(ms);
    const d = formatDuration(ms);
    return this.localize(d.key, undefined, { value: d.value });
  }

  private showTooltip(): void {
    if (!this.hasTooltipContent || this.tooltipOpen) return;
    this.tooltipOpen = true;
  }
  private hideTooltip(): void {
    if (!this.tooltipOpen) return;
    this.tooltipOpen = false;
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

  render(): TemplateResult {
    if (!this.hasVisibleContent && !this.hasDefaultSlot) {
      // Nothing to show and nothing to describe -- render an inert shell (no tabindex, no
      // role/aria-label) rather than a pointless, empty focus stop. The default slot's own
      // slotchange handler still needs a live <slot> to observe, so it stays in the template.
      return html`<div part="base"><slot @slotchange=${this.onDefaultSlotChange}></slot></div>`;
    }

    const tokensIn = this.hasTokensIn ? finiteCount(this.tokensIn!) : undefined;
    const tokensOut = this.hasTokensOut ? finiteCount(this.tokensOut!) : undefined;
    const hasBoth = tokensIn !== undefined && tokensOut !== undefined;

    return html`
      <div
        part="base"
        role="group"
        tabindex="0"
        aria-label=${this.localize('usageBadgeLabel')}
        aria-describedby=${this.tooltipOpen ? this.tooltipId : nothing}
        @mouseenter=${this.onMouseEnter}
        @mouseleave=${this.onMouseLeave}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
        @keydown=${this.onKeyDown}
      >
        ${tokensIn !== undefined
          ? html`<span part="tokens-in">${this.localize('usageBadgeTokensIn', undefined, { count: this.formatTokenCount(tokensIn) })}</span>`
          : nothing}
        ${tokensOut !== undefined
          ? html`<span part="tokens-out">${this.localize('usageBadgeTokensOut', undefined, { count: this.formatTokenCount(tokensOut) })}</span>`
          : nothing}
        ${this.hasCost ? html`<span part="cost">${this.costText}</span>` : nothing}
        ${this.hasLatency ? html`<span part="latency">${this.localizedDuration(this.validLatencyMs!)}</span>` : nothing}
        <div part="tooltip" id=${this.tooltipId} role="tooltip" ?hidden=${!this.tooltipOpen}>
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
          <slot @slotchange=${this.onDefaultSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-usage-badge': LyraUsageBadge;
  }
}
