import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { closeIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { composedContains } from '../../../internal/overlay-manager.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import { getToastRegion } from '../toast/toast-region.js';
import { styles } from './alert.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Shoelace's physical countdown direction. */
export type AlertCountdown = 'rtl' | 'ltr' | undefined;
/** Shoelace's alert tones; `primary` resolves through Lyra's shared brand row. */
export type AlertVariant = Exclude<LyraVariant, 'brand'> | 'primary';

export interface LyraAlertEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-after-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-after-hide': CustomEvent<undefined>;
}

/**
 * `<lr-alert>` — a closed-by-default inline alert that can also move into the shared toast stack.
 * It mirrors the public `<sl-alert>` contract under the `lr-` prefix. `lr-show`/`lr-hide` are
 * cancelable veto points, matching every other Lyra component that emits them; the settled
 * `lr-after-*` notifications are not. Initial `open` markup establishes state without emitting a
 * transition event, so it is never vetoable. The light-DOM host owns `role="alert"`; its slotted
 * message is therefore the one assertive semantic surface for both static and later-open alerts,
 * without a duplicate shadow or shared live region. The optional icon wrapper is hidden from the
 * accessibility tree as decorative chrome.
 *
 * @customElement lr-alert
 * @slot - The alert's main content.
 * @slot icon - Optional leading icon.
 * @event lr-show - The alert is about to open. Cancelable — `preventDefault()` leaves it
 *   closed and the reflected attribute untouched.
 * @event lr-after-show - Emitted after the alert's show motion completes. Noncancelable.
 * @event lr-hide - The alert is about to close, including an auto-hide expiry. Cancelable on
 *   the same terms as `lr-show`.
 * @event lr-after-hide - Emitted after the alert's hide motion completes. Noncancelable.
 * @csspart base - The component's base wrapper.
 * @csspart close-button - The close button.
 * @csspart close-button__base - Compatibility alias for the close button's base part; it is on
 *   the same native button as `close-button`.
 * @csspart icon - The optional icon wrapper.
 * @csspart message - The alert's main-content wrapper.
 * @status stable
 * @since 8.0.0
 */
export class LyraAlert extends LyraElement<LyraAlertEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, styles];

  private _open = false;

  /**
   * Whether the alert is visible. The attribute reflects method and property changes.
   * @default false
   */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === this._open) return;
    // The veto point sits in the setter, ahead of the state change, because every path -- `show()`,
    // `hide()`, `toast()`, the close button, the auto-hide timer, the reflected attribute -- funnels
    // through here. Initial declarative `open` markup is state, not a transition, so it emits no
    // lifecycle event and is not vetoable.
    if (this.hasUpdated) {
      if (this.emit(normalized ? 'lr-show' : 'lr-hide', undefined, { cancelable: true }).defaultPrevented) {
        // A veto that arrived through the reflected attribute would otherwise leave the attribute
        // disagreeing with the property.
        this.toggleAttribute('open', this._open);
        return;
      }
    }
    const previous = this._open;
    this._open = normalized;
    this.requestUpdate('open', previous);
    if (this.hasUpdated) this.transitionPromise = this.runTransition(normalized);
  }

  /** Enables the localized close action. */
  @property({ type: Boolean, reflect: true }) closable = false;

  /** Physical direction in which the optional visual countdown empties. */
  @property({ reflect: true }) countdown: AlertCountdown;

  /** Milliseconds before automatic dismissal; `Infinity` disables automatic dismissal. */
  @property({ type: Number }) duration = Infinity;

  /** Semantic alert tone. */
  @property({ reflect: true }) variant: AlertVariant = 'primary';

  // Seeded from real light DOM before the first render, so an initially-slotted icon never waits
  // for `slotchange` and fallback-only/empty content never reserves an icon column.
  private readonly slotPresence = new SlotPresenceController(this);

  private transitionToken = 0;
  private transitionPromise: Promise<void> = Promise.resolve();
  private timer?: number;
  private timerOwner?: Window;
  private countdownAnimation?: Animation;
  private hovering = false;
  private focused = false;
  private toastPromise?: Promise<void>;
  private toastResolve?: () => void;
  private toastAfterHide?: () => void;
  private toastConnectionGeneration = 0;

  constructor() {
    super();
    // Own interaction at the host boundary so hovering slotted content or focusing any composed
    // descendant restarts the same timer instead of depending on which shadow child was hit.
    this.addEventListener('pointerenter', this.onPointerEnter);
    this.addEventListener('pointerleave', this.onPointerLeave);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', (event) => this.onFocusOut(event as FocusEvent));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.toastConnectionGeneration += 1;
    // Keep assertive semantics on the light-DOM owner of the slotted message. A role inside the
    // shadow root would not reliably expose consumer-authored content to every accessibility tree.
    this.setAttribute('role', 'alert');
    if (!this.hasUpdated || !this.open) return;
    this.removeAttribute('data-alert-showing');
    this.removeAttribute('data-alert-hiding');
    const ownerDocument = this.ownerDocument;
    ownerDocument.defaultView?.queueMicrotask(() => {
      if (this.isConnected && this.ownerDocument === ownerDocument && this.open) {
        this.restartAutoHide();
      }
    });
  }

  override disconnectedCallback(): void {
    const toastConnectionGeneration = ++this.toastConnectionGeneration;
    this.transitionToken++;
    this.clearAutoHide();
    this.removeAttribute('data-alert-showing');
    this.removeAttribute('data-alert-hiding');
    this.hovering = false;
    this.focused = false;
    const settleLastingToastDisconnect = (): void => {
      if (
        toastConnectionGeneration === this.toastConnectionGeneration &&
        !this.isConnected &&
        this.toastPromise
      ) {
        this.finishToast();
      }
    };
    const view = this.ownerDocument.defaultView;
    if (view) view.queueMicrotask(settleLastingToastDisconnect);
    else queueMicrotask(settleLastingToastDisconnect);
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    if (this.open) this.restartAutoHide();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (
      this.open &&
      !changed.has('open') &&
      (changed.has('duration') || changed.has('countdown'))
    ) {
      this.restartAutoHide();
    }
  }

  /** Show the alert and resolve after show motion and `lr-after-show` complete. */
  async show() {
    // A method call is an operation, even during the element's first update. Defer until that
    // baseline render exists so it runs the lifecycle instead of being mistaken for silent
    // initial declarative state.
    if (!this.hasUpdated) await this.updateComplete;
    if (!this.open) this.open = true;
    await this.transitionPromise;
  }

  /** Hide the alert and resolve after hide motion and `lr-after-hide` complete. */
  async hide() {
    if (!this.hasUpdated) await this.updateComplete;
    if (this.open) this.open = false;
    await this.transitionPromise;
  }

  /**
   * Move this alert into Lyra's singleton logical top-end toast region. The returned promise
   * resolves after the alert hides and is removed, or after a lasting external disconnect; the
   * same instance can be toasted again later.
   */
  toast() {
    if (this.toastPromise) return this.toastPromise;

    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    this.toastPromise = completion;
    this.toastResolve = resolveCompletion;

    const region = getToastRegion(undefined, this.ownerDocument);
    const onAfterHide = (): void => {
      if (this.parentElement === region) this.remove();
      this.finishToast();
    };
    this.toastAfterHide = onAfterHide;
    this.addEventListener('lr-after-hide', onAfterHide, { once: true });
    region.appendChild(this);

    void this.updateComplete.then(() => {
      if (!this.isConnected || this.toastPromise !== completion) return;
      if (this.open) this.restartAutoHide();
      else void this.show();
    });

    return completion;
  }

  private finishToast(): void {
    if (this.toastAfterHide) {
      this.removeEventListener('lr-after-hide', this.toastAfterHide);
    }
    const resolve = this.toastResolve;
    this.toastAfterHide = undefined;
    this.toastResolve = undefined;
    this.toastPromise = undefined;
    resolve?.();
  }

  private async runTransition(opening: boolean): Promise<void> {
    const token = ++this.transitionToken;
    this.clearAutoHide();

    // `lr-show`/`lr-hide` already fired from the `open` setter, before the state changed, so a
    // listener still has a real veto; only the motion bookkeeping remains here.
    if (opening) {
      this.removeAttribute('data-alert-hiding');
      this.setAttribute('data-alert-showing', '');
    } else {
      const base = this.base;
      if (base) void base.offsetWidth;
      this.removeAttribute('data-alert-showing');
      this.setAttribute('data-alert-hiding', '');
    }

    await this.updateComplete;
    if (!this.isConnected || token !== this.transitionToken) return;

    const base = this.base;
    if (opening) {
      if (base) void base.offsetWidth;
      await this.nextFrame();
      if (!this.isConnected || token !== this.transitionToken) return;
      this.removeAttribute('data-alert-showing');
    }

    await this.waitForMotion(base);
    if (!this.isConnected || token !== this.transitionToken) return;

    if (opening) {
      this.emit('lr-after-show');
      this.restartAutoHide();
    } else {
      this.removeAttribute('data-alert-hiding');
      this.emit('lr-after-hide');
    }
  }

  private get base(): HTMLElement | null {
    return this.shadowRoot?.querySelector<HTMLElement>('[part="base"]') ?? null;
  }

  private nextFrame(): Promise<void> {
    const view = this.ownerDocument.defaultView;
    if (!view || prefersReducedMotion(view)) return Promise.resolve();
    return new Promise((resolve) => view.requestAnimationFrame(() => resolve()));
  }

  private async waitForMotion(base: HTMLElement | null): Promise<void> {
    const view = this.ownerDocument.defaultView;
    if (!base || !view || prefersReducedMotion(view)) return;
    void view.getComputedStyle(base).opacity;
    const animations = base.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  }

  private get safeDuration(): number {
    return this.duration === Infinity ? Infinity : finiteDuration(this.duration, 0, 0);
  }

  private clearAutoHide(): void {
    if (this.timer !== undefined) this.timerOwner?.clearTimeout(this.timer);
    this.timer = undefined;
    this.timerOwner = undefined;
    this.countdownAnimation?.cancel();
    this.countdownAnimation = undefined;
  }

  private restartAutoHide(): void {
    this.clearAutoHide();
    if (!this.open || this.hovering || this.focused) return;

    const duration = this.safeDuration;
    if (duration === Infinity) return;
    if (duration <= 0) {
      const ownerDocument = this.ownerDocument;
      ownerDocument.defaultView?.queueMicrotask(() => {
        if (
          this.isConnected &&
          this.ownerDocument === ownerDocument &&
          this.open &&
          !this.hovering &&
          !this.focused
        ) {
          void this.hide();
        }
      });
      return;
    }

    const view = this.ownerDocument.defaultView;
    if (!view) return;
    this.timerOwner = view;
    this.timer = view.setTimeout(() => {
      this.timer = undefined;
      this.timerOwner = undefined;
      void this.hide();
    }, duration);
    this.startCountdown(duration);
  }

  private startCountdown(duration: number): void {
    const view = this.ownerDocument.defaultView;
    if (
      prefersReducedMotion(view) ||
      (this.countdown !== 'ltr' && this.countdown !== 'rtl')
    ) {
      return;
    }
    const indicator = this.shadowRoot?.querySelector<HTMLElement>('.countdown');
    if (!indicator) return;
    this.countdownAnimation = indicator.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration, easing: 'linear', fill: 'forwards' },
    );
  }

  private onPointerEnter = (): void => {
    this.hovering = true;
    this.clearAutoHide();
  };

  private onPointerLeave = (): void => {
    this.hovering = false;
    if (!this.focused) this.restartAutoHide();
  };

  private onFocusIn = (): void => {
    this.focused = true;
    this.clearAutoHide();
  };

  private onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (
      next !== null &&
      (next as Node).nodeType === 1 &&
      composedContains(this, next as Element)
    ) {
      return;
    }
    this.focused = false;
    if (!this.hovering) this.restartAutoHide();
  };

  private close = (): void => {
    void this.hide();
  };

  override render(): TemplateResult {
    const hasCountdown = this.countdown === 'ltr' || this.countdown === 'rtl';
    const countdownOrigin = this.countdown === 'rtl' ? 'right center' : 'left center';
    return html`
      <div
        part="base"
      >
        <span part="icon" aria-hidden="true" ?hidden=${!this.slotPresence.has('icon')}>
          <slot name="icon"></slot>
        </span>
        <div part="message"><slot></slot></div>
        ${this.closable
          ? html`
              <button
                part="close-button close-button__base"
                type="button"
                aria-label=${this.localize('close')}
                @click=${this.close}
              >
                ${closeIcon()}
              </button>
            `
          : nothing}
        ${hasCountdown
          ? html`<span
              class="countdown"
              aria-hidden="true"
              style=${`transform-origin: ${countdownOrigin}`}
            ></span>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-alert': LyraAlert;
  }
}
