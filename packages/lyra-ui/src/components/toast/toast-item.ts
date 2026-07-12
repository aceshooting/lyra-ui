import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { closeIcon } from '../../internal/icons.js';
import { styles } from './toast-item.styles.js';

export type ToastVariant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
export type ToastSize = 'xs' | 's' | 'm' | 'l' | 'xl';

// Must stay in sync with --lyra-transition-base's 180ms fallback
// (internal/tokens.styles.ts) — toast-item.styles.ts derives
// --show-duration/--hide-duration from that same token. Kept as a literal
// here rather than read via getComputedStyle() because the token's value is
// a full transition shorthand ("180ms ease-out"), not a bare duration, and
// parsing that back out in JS for a single setTimeout would be more fragile
// than this documented literal.
const ANIM_MS = 180;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// toast-item.styles.ts already collapses the CSS transition itself to ~0 under
// reduced motion; this keeps the lyra-after-show/lyra-after-hide events (and
// the DOM removal in hide()) from still waiting out the full duration of an
// animation nothing is visibly playing.
function animMs(): number {
  return prefersReducedMotion() ? 0 : ANIM_MS;
}

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
  private elapsedMs = 0;
  private startedAt = 0;
  private timerStarted = false;
  private showRafId?: number;
  private showAnimTimer?: number;
  private hideAnimTimer?: number;
  private hovering = false;
  private focused = false;
  @state() private hiding = false;

  protected updated(changed: PropertyValues): void {
    if (changed.has('variant')) {
      // Assertive for actionable severities, polite otherwise. Re-evaluated
      // on every `variant` change (not just the first render) so a toast
      // reassigned to `danger`/`warning` after creation is announced as an
      // interruption instead of keeping its original, now-stale role.
      this.setAttribute('role', this.variant === 'danger' || this.variant === 'warning' ? 'alert' : 'status');
    }
    // `elapsedMs`/`duration` are re-read fresh every time the timer is
    // (re)scheduled, so a `duration` change while paused (hovering/focused)
    // or before the timer has ever started needs no action here -- the next
    // resumeTimer()/startTimer() call already picks up the new value. Only a
    // timer that's actively counting down right now is running against a
    // setTimeout scheduled for the *old* duration, so that's the one case
    // that needs an explicit reschedule.
    if (changed.has('duration') && this.timerStarted && this.timer !== undefined) {
      this.pauseTimer();
      this.resumeTimer();
    }
  }

  firstUpdated(): void {
    this.showRafId = requestAnimationFrame(() => {
      this.showRafId = undefined;
      this.setAttribute('data-visible', '');
      this.emit('lyra-show');
      this.showAnimTimer = window.setTimeout(() => {
        this.showAnimTimer = undefined;
        this.emit('lyra-after-show');
      }, animMs());
      this.startTimer();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.showRafId !== undefined) {
      cancelAnimationFrame(this.showRafId);
      this.showRafId = undefined;
    }
    if (this.showAnimTimer !== undefined) {
      clearTimeout(this.showAnimTimer);
      this.showAnimTimer = undefined;
    }
    if (this.hideAnimTimer !== undefined) {
      clearTimeout(this.hideAnimTimer);
      this.hideAnimTimer = undefined;
    }
    this.clearTimer();
  }

  private startTimer(): void {
    this.timerStarted = true;
    this.elapsedMs = 0;
    this.resumeTimer();
  }

  private resumeTimer = (): void => {
    // Guard against an interleaved pointer+focus pause/resume sequence
    // calling resumeTimer() twice without a pauseTimer() in between --
    // without clearing here, the earlier setTimeout is orphaned (not
    // tracked by `this.timer` anymore) and still fires on its own
    // schedule, auto-dismissing the toast early even after it's paused
    // again.
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!isFinite(this.duration) || this.duration <= 0) return;
    const remaining = this.duration - this.elapsedMs;
    if (remaining <= 0) return;
    this.startedAt = performance.now();
    this.timer = window.setTimeout(() => this.hide(), remaining);
  };

  private pauseTimer = (): void => {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.elapsedMs += performance.now() - this.startedAt;
    }
  };

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  // Hover and focus are tracked as independent pause reasons so that
  // releasing one (e.g. Shift-Tabbing focus away) only resumes the timer
  // once *neither* modality still holds the toast paused -- otherwise a
  // pointer resting on the toast would see it auto-dismiss out from under
  // it the moment focus alone moved away, or vice versa.
  private onPointerEnter = (): void => {
    this.hovering = true;
    this.pauseTimer();
  };

  private onPointerLeave = (): void => {
    this.hovering = false;
    if (!this.focused) this.resumeTimer();
  };

  private onFocusIn = (): void => {
    this.focused = true;
    this.pauseTimer();
  };

  private onFocusOut = (): void => {
    this.focused = false;
    if (!this.hovering) this.resumeTimer();
  };

  // A stack of several simultaneously-open toasts otherwise gives every
  // close button the same bare "Close" label, so screen-reader/switch-access
  // users can't tell which toast a given button dismisses without first
  // activating it. Deriving the label from the toast's own message content
  // mirrors combobox's per-item "Remove X" labeling for the same reason.
  //
  // Only direct Text-node children are considered -- the message is always
  // assigned as plain text (`create()` sets `textContent`), whereas anything
  // else appended to the host (an action `<button>`, a `slot="icon"` element
  // and its own descendant text) is a sibling *element*, not a top-level text
  // node, so it's excluded without needing to know about those features here.
  private get closeLabel(): string {
    const text = Array.from(this.childNodes)
      .filter((node): node is Text => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join('')
      .trim()
      .replace(/\s+/g, ' ');
    if (!text) return 'Close';
    const snippet = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    return `Close: ${snippet}`;
  }

  /** Hide with animation, then remove from the DOM. */
  async hide(): Promise<void> {
    if (this.hiding) return;
    this.hiding = true;
    this.clearTimer();
    this.emit('lyra-hide');
    this.removeAttribute('data-visible');
    await new Promise<void>((resolve) => {
      this.hideAnimTimer = window.setTimeout(() => {
        this.hideAnimTimer = undefined;
        resolve();
      }, animMs());
    });
    this.emit('lyra-after-hide');
    this.remove();
  }

  render(): TemplateResult {
    return html`
      <div
        part="toast-item"
        @pointerenter=${this.onPointerEnter}
        @pointerleave=${this.onPointerLeave}
        @focusin=${this.onFocusIn}
        @focusout=${this.onFocusOut}
      >
        <span part="accent" aria-hidden="true"></span>
        ${this.withIcon ? html`<span part="icon"><slot name="icon"></slot></span>` : ''}
        <div part="content"><slot></slot></div>
        <button
          part="close-button"
          type="button"
          aria-label=${this.closeLabel}
          aria-disabled=${this.hiding ? 'true' : 'false'}
          @click=${(e: Event) => {
            // Reflect the disabled state on the DOM node synchronously, not
            // just via the reactive binding above -- Lit's re-render from
            // `this.hiding = true` (inside hide()) lands on the next
            // microtask, which is too late for a screen reader (or a second
            // rapid click) that inspects the attribute right after this
            // handler returns.
            (e.currentTarget as HTMLElement).setAttribute('aria-disabled', 'true');
            void this.hide();
          }}
        >
          ${closeIcon()}
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
