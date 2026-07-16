import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { closeIcon } from '../../internal/icons.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { styles } from './toast-item.styles.js';

export type ToastVariant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
export type ToastSize = 'xs' | 's' | 'm' | 'l' | 'xl';

function parseTime(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed);
  if (trimmed.endsWith('s')) return Number.parseFloat(trimmed) * 1000;
  return 0;
}

function maxCssTime(value: string): number {
  return Math.max(0, ...value.split(',').map(parseTime).filter(Number.isFinite));
}

export interface LyraToastItemEventMap {
  'lyra-show': CustomEvent<undefined>;
  'lyra-after-show': CustomEvent<undefined>;
  'lyra-hide': CustomEvent<undefined>;
  'lyra-after-hide': CustomEvent<undefined>;
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
export class LyraToastItem extends LyraElement<LyraToastItemEventMap> {
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
  private cancelShowAnimation?: () => void;
  private cancelHideAnimation?: () => void;
  private hovering = false;
  private focused = false;
  @state() private hiding = false;

  protected willUpdate(changed: PropertyValues): void {
    // `elapsedMs`/`duration` are re-read fresh every time the timer is
    // (re)scheduled, so a `duration` change while paused (hovering/focused)
    // or before the timer has ever started needs no action here -- the next
    // resumeTimer()/startTimer() call already picks up the new value.
    // Re-evaluate on any duration change once the show sequence has started,
    // not only while a timer is already actively counting down -- this also
    // covers duration flipping from disabled (0/Infinity) back to a positive
    // value, which previously never had `this.timer !== undefined` to gate on.
    //
    // This runs in willUpdate() (before render), not updated(), because a
    // duration shortened below the already-elapsed time makes resumeTimer()
    // call hide(), which sets the `hiding` state property synchronously --
    // doing that from updated() sets a reactive property after Lit considers
    // the update cycle finished, scheduling a redundant extra render pass.
    // willUpdate() runs before that cycle is considered complete, so the same
    // set just folds into the render already in progress.
    if (changed.has('duration') && this.timerStarted && !this.hovering && !this.focused) {
      this.pauseTimer();
      this.resumeTimer();
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('variant')) {
      // Assertive for actionable severities, polite otherwise. Re-evaluated
      // on every `variant` change (not just the first render) so a toast
      // reassigned to `danger`/`warning` after creation is announced as an
      // interruption instead of keeping its original, now-stale role.
      this.setAttribute('role', this.variant === 'danger' || this.variant === 'warning' ? 'alert' : 'status');
    }
  }

  firstUpdated(): void {
    this.showRafId = requestAnimationFrame(() => {
      this.showRafId = undefined;
      // hide() may have already run synchronously before this frame fired
      // (e.g. a caller creates the toast and immediately dismisses it) --
      // don't resurrect the show sequence on top of an already-hiding item.
      if (this.hiding) return;
      this.setAttribute('data-visible', '');
      this.emit('lyra-show');
      void this.waitForVisualCompletion('show').then(() => {
        if (this.isConnected && !this.hiding) this.emit('lyra-after-show');
      });
      this.startTimer();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.showRafId !== undefined) {
      cancelAnimationFrame(this.showRafId);
      this.showRafId = undefined;
    }
    this.cancelShowAnimation?.();
    this.cancelShowAnimation = undefined;
    this.cancelHideAnimation?.();
    this.cancelHideAnimation = undefined;
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
    // A duration shortened below the already-elapsed time must hide promptly,
    // not silently never schedule anything.
    if (remaining <= 0) {
      void this.hide();
      return;
    }
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

  /**
   * Wait for the actual CSS transition/animation on the toast surface. The
   * computed duration is intentionally read at runtime so a consumer's
   * `--lyra-toast-show-duration`/`--lyra-toast-hide-duration` override keeps
   * lifecycle events and removal in sync with the pixels on screen. A small
   * timeout remains as a safety net for zero-duration transitions, disabled
   * animation, and browsers that do not dispatch an end event.
   */
  private waitForVisualCompletion(kind: 'show' | 'hide'): Promise<void> {
    const previous = kind === 'show' ? this.cancelShowAnimation : this.cancelHideAnimation;
    previous?.();
    const surface = this.shadowRoot?.querySelector<HTMLElement>('[part="toast-item"]');
    if (!surface || prefersReducedMotion()) return Promise.resolve();

    const computed = getComputedStyle(surface);
    const transitionMs = maxCssTime(computed.transitionDuration) + maxCssTime(computed.transitionDelay);
    const animationMs = maxCssTime(computed.animationDuration) + maxCssTime(computed.animationDelay);
    const fallbackMs = Math.max(transitionMs, animationMs);
    if (fallbackMs <= 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let settled = false;
      let timeout: number | undefined;
      const cancelKey = kind === 'show' ? 'cancelShowAnimation' : 'cancelHideAnimation';
      const finish = (): void => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) window.clearTimeout(timeout);
        surface.removeEventListener('transitionend', onEnd);
        surface.removeEventListener('animationend', onEnd);
        if (this[cancelKey] === cancel) this[cancelKey] = undefined;
        resolve();
      };
      const onEnd = (event: Event): void => {
        if (event.target === surface) finish();
      };
      const cancel = (): void => finish();
      surface.addEventListener('transitionend', onEnd);
      surface.addEventListener('animationend', onEnd);
      timeout = window.setTimeout(finish, fallbackMs + 50);
      this[cancelKey] = cancel;
    });
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
    if (!text) return this.localize('close');
    const snippet = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    return this.localize('closeWithContext', undefined, { snippet });
  }

  /** Hide with animation, then remove from the DOM. */
  async hide(): Promise<void> {
    if (this.hiding) return;
    this.hiding = true;
    this.cancelShowAnimation?.();
    this.cancelShowAnimation = undefined;
    this.clearTimer();
    this.emit('lyra-hide');
    this.removeAttribute('data-visible');
    this.setAttribute('data-hiding', '');
    await this.waitForVisualCompletion('hide');
    // A disconnect cancels the visual wait, but it does so without this
    // reaching its normal completion -- guard against emitting a finished
    // event or redundantly removing a node already torn down elsewhere.
    if (!this.isConnected) return;
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


declare global {
  interface HTMLElementTagNameMap {
    'lyra-toast-item': LyraToastItem;
  }
}
