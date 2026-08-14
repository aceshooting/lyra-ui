import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { closeIcon } from '../../../internal/icons.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { finiteDuration } from '../../../internal/numbers.js';
import { composedContains, deepActiveElement } from '../../../internal/overlay-manager.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type { LyraVariant } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import { getToastRegion } from '../toast/toast-region.js';
import {
  TOAST_REGION_ENQUEUE,
  TOAST_REGION_EVICT,
  TOAST_REGION_REJECT,
  TOAST_REGION_SET_ACTIVE,
  toastRegionControllerFor,
  type ToastRegionController,
} from '../toast/toast-region-protocol.js';
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

interface AlertTransitionRequest {
  cancelled: boolean;
  readonly completion: Promise<void>;
  readonly target: boolean;
  reject: (reason?: unknown) => void;
  resolve: () => void;
  settled: boolean;
}

function nearestExternalFocusTarget(owner: Element): HTMLElement | null {
  const targets = collectComposedFocusTargets(owner.ownerDocument.documentElement, {
    mode: 'programmatic',
  }).elements;
  const owned = targets
    .map((target, index) => composedContains(owner, target) ? index : -1)
    .filter((index) => index >= 0);
  if (owned.length === 0) return null;
  const first = owned[0]!;
  const last = owned[owned.length - 1]!;
  return targets.slice(last + 1).find((target) => !composedContains(owner, target))
    ?? targets.slice(0, first).reverse().find((target) => !composedContains(owner, target))
    ?? null;
}

/**
 * `<lr-alert>` — a closed-by-default inline alert that can also move into the shared toast stack.
 * It mirrors the public `<sl-alert>` contract under the `lr-` prefix. `lr-show`/`lr-hide` are
 * cancelable veto points, matching every other Lyra component that emits them; the settled
 * `lr-after-*` notifications are not. Initial `open` markup establishes state without emitting a
 * transition event, so it is never vetoable. The light-DOM host owns `role="alert"`; its slotted
 * message is therefore the one assertive semantic surface for both static and later-open alerts,
 * without a duplicate shadow or shared live region. The optional icon wrapper remains visible as
 * decorative chrome while its flattened subtree is inert and hidden from the accessibility tree.
 *
 * @customElement lr-alert
 * @slot - The alert's main content.
 * @slot icon - Optional decorative leading icon. Its flattened subtree remains visible but is
 *   inert and hidden from assistive technology.
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
 * @csspart icon - The optional inert, aria-hidden icon wrapper.
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
    this.requestOpenState(Boolean(next));
  }

  private requestOpenState(normalized: boolean): boolean {
    if (normalized === this._open) return true;
    if (this.openRequest) return this.openRequest.target === normalized;
    const repair = normalized
      ? null
      : captureComposedFocusRepair(this, nearestExternalFocusTarget(this));
    // The veto point sits ahead of the state change because every path -- `show()`, `hide()`,
    // `toast()`, the close button, the auto-hide timer, and reflected-attribute writes -- funnels
    // through this request. Initial declarative `open` markup is state, not a transition, so it
    // emits no lifecycle event and is not vetoable.
    let request: AlertTransitionRequest | undefined;
    if (this.hasUpdated) {
      let resolve!: () => void;
      let reject!: (reason?: unknown) => void;
      const completion = new Promise<void>((resolveCompletion, rejectCompletion) => {
        resolve = resolveCompletion;
        reject = rejectCompletion;
      });
      request = { target: normalized, completion, resolve, reject, settled: false, cancelled: false };
      // Publish the request before dispatch. A listener that calls show()/hide() again therefore
      // observes and awaits this exact request instead of starting a second veto point.
      this.openRequest = request;
      this.transitionPromise = completion;
      if (this.emit(normalized ? 'lr-show' : 'lr-hide', undefined, { cancelable: true }).defaultPrevented) {
        // A veto that arrived through the reflected attribute would otherwise leave the attribute
        // disagreeing with the property.
        this.toggleAttribute('open', this._open);
        if (this.openRequest === request) this.openRequest = undefined;
        this.cancelTransition(request);
        return false;
      }
    }
    if (this.transitionRequest) this.cancelTransition(this.transitionRequest);
    const previous = this._open;
    if (repair) applyComposedFocusRepair(repair);
    this._open = normalized;
    this.requestUpdate('open', previous);
    if (request) {
      if (this.openRequest === request) this.openRequest = undefined;
      this.transitionRequest = request;
      void this.runTransition(request);
    }
    return true;
  }

  /** Enables the localized close action. */
  @property({ type: Boolean, reflect: true }) closable = false;

  /** Physical direction in which the optional visual countdown empties. */
  @property({ reflect: true }) countdown: AlertCountdown;

  /** Milliseconds before automatic dismissal; `Infinity` disables automatic dismissal. */
  @property({ type: Number }) duration: number = Infinity;

  /** Semantic alert tone. */
  @property({ reflect: true }) variant: AlertVariant = 'primary';

  // Seeded from real light DOM before the first render, so an initially-slotted icon never waits
  // for `slotchange` and fallback-only/empty content never reserves an icon column.
  private readonly slotPresence = new SlotPresenceController(this);

  private transitionToken = 0;
  private transitionPromise: Promise<void> = Promise.resolve();
  private openRequest?: AlertTransitionRequest;
  private transitionRequest?: AlertTransitionRequest;
  private timer?: number;
  private timerOwner?: Window;
  private countdownAnimation?: Animation;
  private hovering = false;
  private focused = false;
  private focusReturnTarget?: HTMLElement;
  private pendingFocusRepair?: ComposedFocusRepairSnapshot;
  private toastPromise?: Promise<void>;
  private toastResolve?: () => void;
  private toastAfterHide?: () => void;
  private toastConnectionGeneration = 0;
  private toastLifecycleGeneration = 0;
  private toastRegionOwner?: ToastRegionController;
  private toastRegionActive = false;
  private toastActivationStarted = false;

  constructor() {
    super();
    // Own interaction at the host boundary so hovering slotted content or focusing any composed
    // descendant restarts the same timer instead of depending on which shadow child was hit.
    this.addEventListener('pointerenter', this.onPointerEnter);
    this.addEventListener('pointerleave', this.onPointerLeave);
    this.addEventListener('focusin', (event) => this.onFocusIn(event as FocusEvent));
    this.addEventListener('focusout', (event) => this.onFocusOut(event as FocusEvent));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.toastConnectionGeneration += 1;
    // Keep assertive semantics on the light-DOM owner of the slotted message. A role inside the
    // shadow root would not reliably expose consumer-authored content to every accessibility tree.
    this.setAttribute('role', 'alert');
    if (this.toastPromise) {
      const currentController = toastRegionControllerFor(this);
      if (currentController && currentController !== this.toastRegionOwner) {
        currentController[TOAST_REGION_ENQUEUE](this);
      }
      const completion = this.toastPromise;
      const generation = this.toastLifecycleGeneration;
      const owner = this.toastRegionOwner;
      if (owner && this.parentElement !== owner) {
        const settleLostOwnership = (): void => {
          if (
            this.toastPromise === completion &&
            this.toastLifecycleGeneration === generation &&
            this.parentElement !== owner
          ) {
            this.finishToast();
          }
        };
        const view = this.ownerDocument.defaultView;
        if (view) view.queueMicrotask(settleLostOwnership);
        else queueMicrotask(settleLostOwnership);
      }
      if (!this.toastRegionActive) return;
      this.beginToastActivation();
    }
    if (this.transitionRequest) {
      void this.runTransition(this.transitionRequest);
      return;
    }
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
    const activeElement = deepActiveElement(this.ownerDocument);
    if (
      !this.pendingFocusRepair &&
      activeElement &&
      typeof (activeElement as HTMLElement).focus === 'function'
    ) {
      this.pendingFocusRepair = captureComposedFocusRepair(this, activeElement as HTMLElement) ?? undefined;
    }
    const toastConnectionGeneration = ++this.toastConnectionGeneration;
    const transitionBelongedToToast = Boolean(this.toastPromise);
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
      if (
        toastConnectionGeneration === this.toastConnectionGeneration &&
        !this.isConnected &&
        this.transitionRequest
      ) {
        if (transitionBelongedToToast) this.cancelTransition(this.transitionRequest);
        else this.settleTransitionCompletion(this.transitionRequest);
      }
    };
    const view = this.ownerDocument.defaultView;
    if (view) view.queueMicrotask(settleLastingToastDisconnect);
    else queueMicrotask(settleLastingToastDisconnect);
    super.disconnectedCallback();
  }

  override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    if (this.open) this.restartAutoHide();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (
      this.open &&
      !changed.has('open') &&
      (changed.has('duration') || changed.has('countdown'))
    ) {
      this.restartAutoHide();
    }
  }

  /** Show the alert and resolve after show motion and `lr-after-show` complete. */
  async show(): Promise<void> {
    // A method call is an operation, even during the element's first update. Defer until that
    // baseline render exists so it runs the lifecycle instead of being mistaken for silent
    // initial declarative state.
    if (!this.hasUpdated) await this.updateComplete;
    if (!this.open) this.requestOpenState(true);
    await this.transitionPromise;
  }

  /** Hide the alert and resolve after hide motion and `lr-after-hide` complete. */
  async hide(): Promise<void> {
    if (!this.hasUpdated) await this.updateComplete;
    if (this.open) this.requestOpenState(false);
    await this.transitionPromise;
  }

  /**
   * Move this alert into Lyra's singleton logical top-end toast region. The returned promise
   * resolves after the alert hides and is removed, or after a lasting external disconnect; the
   * same instance can be toasted again later. An already-open alert queued behind the active
   * window becomes hidden and inert without replaying its show lifecycle when promoted; focus in
   * that surface is repaired through the shared composed-focus contract before it becomes
   * unavailable. If its owner document cannot provide an upgraded bounded region controller, the
   * unavailable request is removed and settled without fallback.
   */
  toast(): Promise<void> {
    if (this.toastPromise) return this.toastPromise;

    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    this.toastPromise = completion;
    this.toastResolve = resolveCompletion;
    this.toastLifecycleGeneration += 1;
    this.toastActivationStarted = false;

    const region = getToastRegion(undefined, this.ownerDocument);
    const onAfterHide = (): void => {
      if (this.toastRegionOwner && this.parentElement === this.toastRegionOwner) this.remove();
      this.finishToast();
    };
    this.toastAfterHide = onAfterHide;
    this.addEventListener('lr-after-hide', onAfterHide, { once: true });
    const controller = region as Partial<ToastRegionController>;
    if (typeof controller[TOAST_REGION_ENQUEUE] === 'function') {
      controller[TOAST_REGION_ENQUEUE](this);
    } else {
      // An adopted, already-upgraded alert can outlive the registry that defined it. Do not fall
      // back to an unbounded unknown `<lr-toast>` in that owner document: discard the unavailable
      // operation and settle the public promise deterministically.
      if (region.childElementCount === 0) region.remove();
      this.remove();
      this.finishToast();
    }

    return completion;
  }

  /** @internal */
  [TOAST_REGION_SET_ACTIVE](owner: ToastRegionController, active: boolean): void {
    if (this.parentElement !== owner) return;
    const focusTarget = this.focusReturnTarget?.isConnected && !composedContains(this, this.focusReturnTarget)
      ? this.focusReturnTarget
      : nearestExternalFocusTarget(this);
    const focusRepair = active
      ? this.pendingFocusRepair
      : this.pendingFocusRepair ?? captureComposedFocusRepair(this, focusTarget);
    this.toastRegionOwner = owner;
    this.toastRegionActive = active;
    this.toggleAttribute('data-toast-queued', !active);
    // A previously rendered/open alert can be moved into a full region. Reflect queue ownership on
    // its existing surface synchronously, then schedule the same state into Lit's next render so
    // promotion cannot reveal stale hidden/inert attributes.
    const base = this.base;
    if (base) {
      base.hidden = !active;
      base.inert = !active;
    }
    this.requestUpdate();
    if (active) {
      if (focusRepair) applyComposedFocusRepair(focusRepair);
      this.pendingFocusRepair = undefined;
      if (this.transitionRequest) void this.runTransition(this.transitionRequest);
      this.beginToastActivation();
    } else {
      this.transitionToken += 1;
      if (focusRepair) applyComposedFocusRepair(focusRepair, focusTarget);
      this.pendingFocusRepair = undefined;
      this.clearAutoHide();
    }
  }

  /** @internal */
  [TOAST_REGION_EVICT](owner: ToastRegionController, _reason: 'overflow' | 'rejected'): void {
    if (this.toastRegionOwner !== owner) return;
    this.toastRegionOwner = undefined;
    this.toastRegionActive = false;
    this.removeAttribute('data-toast-queued');
    if (this.parentElement === owner) this.remove();
    this.finishToast();
  }

  private beginToastActivation(): void {
    const completion = this.toastPromise;
    const owner = this.toastRegionOwner;
    if (!completion || !owner || !this.toastRegionActive || this.toastActivationStarted) return;
    this.toastActivationStarted = true;
    const generation = this.toastLifecycleGeneration;
    void this.updateComplete.then(() => {
      if (
        this.toastPromise !== completion ||
        this.toastLifecycleGeneration !== generation ||
        this.toastRegionOwner !== owner ||
        !this.toastRegionActive ||
        !this.isConnected ||
        this.parentElement !== owner
      ) {
        return;
      }
      if (this.open) {
        this.restartAutoHide();
        return;
      }
      const accepted = this.requestOpenState(true);
      if (accepted) return;
      if (
        this.toastPromise === completion &&
        this.toastLifecycleGeneration === generation &&
        this.toastRegionOwner === owner &&
        this.parentElement === owner
      ) {
        const controller = owner as Partial<ToastRegionController>;
        if (typeof controller[TOAST_REGION_REJECT] === 'function') {
          controller[TOAST_REGION_REJECT](this);
        } else {
          if (this.parentElement === owner) this.remove();
          this.finishToast();
        }
      } else if (this.toastPromise === completion) {
        this.finishToast();
      }
    });
  }

  private finishToast(): void {
    if (this.toastAfterHide) {
      this.removeEventListener('lr-after-hide', this.toastAfterHide);
    }
    const resolve = this.toastResolve;
    this.toastAfterHide = undefined;
    this.toastResolve = undefined;
    this.toastPromise = undefined;
    this.toastRegionOwner = undefined;
    this.toastRegionActive = false;
    this.toastActivationStarted = false;
    this.toastLifecycleGeneration += 1;
    this.removeAttribute('data-toast-queued');
    this.requestUpdate();
    if (this.isConnected) {
      const base = this.base;
      if (base) {
        base.hidden = false;
        base.inert = false;
      }
      if (this.pendingFocusRepair) {
        applyComposedFocusRepair(this.pendingFocusRepair);
        this.pendingFocusRepair = undefined;
      }
    }
    resolve?.();
  }

  private settleTransitionCompletion(request: AlertTransitionRequest): void {
    if (request.settled) return;
    request.settled = true;
    request.resolve();
  }

  private cancelTransition(request: AlertTransitionRequest): void {
    request.cancelled = true;
    if (this.transitionRequest === request) this.transitionRequest = undefined;
    if (this.openRequest === request) this.openRequest = undefined;
    this.settleTransitionCompletion(request);
  }

  private finishTransition(request: AlertTransitionRequest): void {
    if (request.cancelled) return;
    if (this.transitionRequest === request) this.transitionRequest = undefined;
    if (this.openRequest === request) this.openRequest = undefined;
    this.settleTransitionCompletion(request);
  }

  private async runTransition(request: AlertTransitionRequest): Promise<void> {
    if (
      request.cancelled ||
      this.transitionRequest !== request ||
      (this.toastPromise && !this.toastRegionActive)
    ) return;
    const opening = request.target;
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
    if (!this.isConnected || token !== this.transitionToken || this.transitionRequest !== request) return;

    const base = this.base;
    if (opening) {
      if (base) void base.offsetWidth;
      await this.nextFrame();
      if (!this.isConnected || token !== this.transitionToken || this.transitionRequest !== request) return;
      this.removeAttribute('data-alert-showing');
    }

    await this.waitForMotion(base);
    if (!this.isConnected || token !== this.transitionToken || this.transitionRequest !== request) return;

    if (opening) {
      this.emit('lr-after-show');
      this.restartAutoHide();
    } else {
      this.removeAttribute('data-alert-hiding');
      this.emit('lr-after-hide');
    }
    this.finishTransition(request);
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
    if (this.toastPromise && !this.toastRegionActive) return;
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

  private onFocusIn = (event: FocusEvent): void => {
    const previous = event.relatedTarget as HTMLElement | null;
    if (
      previous?.nodeType === 1 &&
      !composedContains(this, previous) &&
      previous.isConnected
    ) {
      this.focusReturnTarget = previous;
    }
    const activeElement = deepActiveElement(this.ownerDocument);
    this.pendingFocusRepair =
      activeElement && typeof (activeElement as HTMLElement).focus === 'function'
        ? captureComposedFocusRepair(this, activeElement as HTMLElement) ?? undefined
        : undefined;
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
    if (next === null) {
      const parent = this.parentElement;
      const clearIfStillOwned = (): void => {
        if (this.isConnected && this.parentElement === parent) this.pendingFocusRepair = undefined;
      };
      const view = this.ownerDocument.defaultView;
      if (view) view.queueMicrotask(clearIfStillOwned);
      else queueMicrotask(clearIfStillOwned);
    } else {
      const external = next as HTMLElement;
      if (external.isConnected) this.focusReturnTarget = external;
      this.pendingFocusRepair = undefined;
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
        ?hidden=${Boolean(this.toastPromise && !this.toastRegionActive)}
        ?inert=${Boolean(this.toastPromise && !this.toastRegionActive)}
      >
        ${renderInertPresentation(html`<slot name="icon"></slot>`, {
          part: 'icon',
          hidden: !this.slotPresence.has('icon'),
        })}
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
