import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { ringStyles } from './progress.styles.js';

const DEFAULT_MAX = 100;

/**
 * `<lr-progress-ring>` — a circular determinate or indeterminate progress indicator.
 *
 * @customElement lr-progress-ring
 * @slot - Optional center label whose text names the progressbar unless an explicit accessible
 * label overrides it; live text mutations stay synchronized.
 * @csspart base - Compatibility name for the progress wrapper; use `progress-ring`.
 * @csspart progress-ring - The progress wrapper. It is the same node as `base`.
 * @csspart track - The SVG track.
 * @csspart indicator - The SVG indicator.
 * @csspart label - The center label.
 * @cssprop [--lr-progress-ring-size=var(--lr-size-2-5rem)] - Outer diameter of the ring.
 * @cssprop [--lr-progress-ring-track-width=var(--lr-size-4px)] - Track stroke width.
 * @cssprop [--lr-progress-ring-track-color=var(--lr-color-brand-quiet)] - Track stroke color.
 * @cssprop [--lr-progress-ring-indicator-width=var(--lr-progress-ring-track-width)] - Indicator stroke width.
 * @cssprop [--lr-progress-ring-indicator-color=var(--lr-color-brand)] - Indicator stroke color.
 * @cssprop [--lr-progress-ring-indicator-transition-duration=var(--lr-transition-base)] - Determinate indicator transition.
 * @cssprop [--lr-progress-duration=var(--lr-transition-ambient)] - Indeterminate rotation timing.
 * @cssprop [--size=var(--lr-progress-ring-size)] - Upstream-compatible outer diameter.
 * @cssprop [--track-width=var(--lr-progress-ring-track-width)] - Upstream-compatible track width.
 * @cssprop [--track-color=var(--lr-progress-ring-track-color)] - Upstream-compatible track color.
 * @cssprop [--indicator-width=var(--lr-progress-ring-indicator-width)] - Upstream-compatible indicator width.
 * @cssprop [--indicator-color=var(--lr-progress-ring-indicator-color)] - Upstream-compatible indicator color.
 * @cssprop [--indicator-transition-duration=var(--lr-progress-ring-indicator-transition-duration)] - Upstream-compatible transition duration.
 * @status stable
 * @since 4.0.0
 */
export class LyraProgressRing extends LyraElement {
  static override styles = [LyraElement.styles, ringStyles];
  @property({ type: Number, reflect: true }) value = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  /** Mapped accessible-label property. */
  @property() label = '';
  /** Lyra compatibility alias for `label`. */
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  private labelObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.labelObserver ??= new MutationObserver(() => this.requestUpdate());
    this.labelObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  override disconnectedCallback(): void {
    this.labelObserver?.disconnect();
    super.disconnectedCallback();
  }

  private get visibleLabelText(): string {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    // assignedNodes({flatten:true}) returns the slot's FALLBACK children when nothing is
    // assigned, and this slot's fallback is the formatted percent -- so an unslotted ring would
    // name itself "40%" and the localized 'progress' name (plus any registerLyraLocale override)
    // would be permanently unreachable. Only consumer-assigned content may name the control.
    if (!slot || slot.assignedNodes().length === 0) return '';
    return (
      slot
        ?.assignedNodes({ flatten: true })
        .map((node) => node.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  }

  /** `max`, normalized to a finite number and guarded against `<= 0` — which would otherwise
   *  divide-by-zero in `percent` below — falling back to the property's own default of `100`. */
  private get safeMax(): number {
    const max = finiteRange(this.max, DEFAULT_MAX, 0);
    return max > 0 ? max : DEFAULT_MAX;
  }

  /** `value`, normalized to a finite number clamped to `[0, safeMax]`. */
  private get safeValue(): number {
    return finiteRange(this.value, 0, 0, this.safeMax);
  }

  private get percent(): number {
    return (this.safeValue / this.safeMax) * 100;
  }

  private get formattedPercent(): string {
    return getNumberFormat(this.effectiveLocale, {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(this.percent / 100);
  }

  override render(): TemplateResult {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - this.percent / 100);
    const label =
      this.getAttribute('aria-label') ||
      this.label ||
      this.accessibleLabel ||
      this.visibleLabelText ||
      this.localize('progress');
    return html`<div part="base progress-ring" role="progressbar" aria-label=${label}
      aria-valuemin="0" aria-valuemax=${this.safeMax} aria-valuenow=${this.indeterminate ? nothing : this.safeValue}
      aria-valuetext=${this.indeterminate ? nothing : this.formattedPercent}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle part="track" cx="50" cy="50" r=${radius} stroke-width="10"></circle>
        <circle part="indicator" cx="50" cy="50" r=${radius} stroke-width="10"
          stroke-dasharray=${circumference} stroke-dashoffset=${this.indeterminate ? circumference * 0.65 : offset}></circle>
      </svg>
      <span part="label"><slot @slotchange=${() => this.requestUpdate()}>${this.indeterminate ? '' : this.formattedPercent}</slot></span>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-progress-ring': LyraProgressRing; } }
