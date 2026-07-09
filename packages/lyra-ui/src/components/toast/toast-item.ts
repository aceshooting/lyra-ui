import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './toast-item.styles.js';

export type ToastVariant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
export type ToastSize = 'xs' | 's' | 'm' | 'l' | 'xl';

const ANIM_MS = 250;

/**
 * `<lyra-toast-item>` — a single toast notification.
 * Mirrors the Web Awesome `<wa-toast-item>` API under the `lyra-` prefix.
 *
 * @customElement lyra-toast-item
 * @slot - The message content.
 * @slot icon - Optional icon shown at the start.
 * @event lyra-show - Fired when the item begins showing.
 * @event lyra-after-show - Fired after the show animation completes.
 * @event lyra-hide - Fired when the item begins hiding.
 * @event lyra-after-hide - Fired after the hide animation completes (item then removes itself).
 * @csspart toast-item - The outer container.
 * @csspart accent - The colored accent bar.
 * @csspart icon - The icon wrapper.
 * @csspart content - The message wrapper.
 * @csspart close-button - The dismiss button.
 */
export class LyraToastItem extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Auto-dismiss delay in ms. Set to `Infinity` (or <= 0) to disable. */
  @property({ type: Number }) duration = 5000;

  /** Visual size. */
  @property({ reflect: true }) size: ToastSize = 'm';

  /** Severity/variant. */
  @property({ reflect: true }) variant: ToastVariant = 'neutral';

  /** Show the icon slot. */
  @property({ type: Boolean, attribute: 'with-icon' }) withIcon = false;

  private timer?: number;
  private remaining = 0;
  private startedAt = 0;

  firstUpdated(): void {
    // Assertive for actionable severities, polite otherwise.
    this.setAttribute('role', this.variant === 'danger' || this.variant === 'warning' ? 'alert' : 'status');
    requestAnimationFrame(() => {
      this.setAttribute('data-visible', '');
      this.emit('lyra-show');
      window.setTimeout(() => this.emit('lyra-after-show'), ANIM_MS);
      this.startTimer();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearTimer();
  }

  private startTimer(): void {
    if (!isFinite(this.duration) || this.duration <= 0) return;
    this.remaining = this.duration;
    this.resumeTimer();
  }

  private resumeTimer = (): void => {
    if (!isFinite(this.duration) || this.duration <= 0 || this.remaining <= 0) return;
    this.startedAt = performance.now();
    this.timer = window.setTimeout(() => this.hide(), this.remaining);
  };

  private pauseTimer = (): void => {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.remaining -= performance.now() - this.startedAt;
    }
  };

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Hide with animation, then remove from the DOM. */
  async hide(): Promise<void> {
    this.clearTimer();
    this.emit('lyra-hide');
    this.removeAttribute('data-visible');
    await new Promise((r) => window.setTimeout(r, ANIM_MS));
    this.emit('lyra-after-hide');
    this.remove();
  }

  render(): TemplateResult {
    return html`
      <div
        part="toast-item"
        @pointerenter=${this.pauseTimer}
        @pointerleave=${this.resumeTimer}
        @focusin=${this.pauseTimer}
        @focusout=${this.resumeTimer}
      >
        <span part="accent" aria-hidden="true"></span>
        ${this.withIcon ? html`<span part="icon"><slot name="icon"></slot></span>` : ''}
        <div part="content"><slot></slot></div>
        <button part="close-button" type="button" aria-label="Close" @click=${() => this.hide()}>
          &times;
        </button>
      </div>
    `;
  }
}

defineElement('toast-item', LyraToastItem);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-toast-item': LyraToastItem;
  }
}
