import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './spinner.styles.js';

export type SpinnerLabelPlacement = 'none' | 'after';

/**
 * `<lr-spinner>` — an indeterminate busy indicator.
 *
 * @customElement lr-spinner
 * @slot - Optional label. `label-placement="after"` renders it and uses its text as the status
 * name; `none` hides it from both rendering and the accessibility tree.
 * @csspart base - Compatibility name for the outer wrapper; use `spinner`.
 * @csspart spinner - The outer wrapper. It is the same node as `base`.
 * @csspart spinner-indicator - The animated indicator inside the wrapper.
 * @csspart label - The accessible/visible label wrapper.
 * @cssprop [--lr-spinner-size=var(--lr-size-1-25rem)] - Outer diameter of the indicator.
 * @cssprop [--lr-spinner-track-width=var(--lr-border-width-medium)] - Thickness of the ring track.
 * @cssprop [--lr-spinner-duration=var(--lr-transition-ambient)] - Duration/easing of one
 * rotation. Not read under
 *   `prefers-reduced-motion: reduce`, where the animation is disabled entirely.
 * @cssprop [--track-width=var(--lr-spinner-track-width)] - Upstream-compatible track width.
 * @cssprop [--track-color=var(--lr-color-brand-quiet)] - Upstream-compatible track color.
 * @cssprop [--indicator-color=var(--lr-color-brand)] - Upstream-compatible indicator color.
 * @cssprop [--speed=var(--lr-spinner-duration)] - Upstream-compatible rotation duration.
 * @status stable
 * @since 4.0.0
 */
export class LyraSpinner extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ attribute: 'label-placement', reflect: true }) labelPlacement: SpinnerLabelPlacement = 'none';
  /** Accessible name for the busy status, forwarded from a host `aria-label`. When unset, a
   *  visible `label-placement="after"` label names it, then the localized "Loading…" fallback. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
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
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot');
    return (
      slot
        ?.assignedNodes({ flatten: true })
        .map((node) => node.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim() ?? ''
    );
  }

  override render(): TemplateResult {
    const label =
      this.accessibleLabel ||
      (this.labelPlacement === 'after' ? this.visibleLabelText : '') ||
      this.localize('loading');
    return html`<span part="base spinner" role="status" aria-label=${label}>
      <span part="spinner-indicator" aria-hidden="true"></span>
      <span part="label" ?hidden=${this.labelPlacement === 'none'}><slot @slotchange=${() => this.requestUpdate()}></slot></span>
    </span>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-spinner': LyraSpinner; } }
