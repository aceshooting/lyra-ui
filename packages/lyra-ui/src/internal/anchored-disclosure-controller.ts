import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { settlePopupTransition } from './anchored-overlay-runtime.js';
import { OverlayTransitionGate } from './overlay-shared.js';

type DisclosureLifecycleEvent = 'lr-show' | 'lr-hide' | 'lr-after-show' | 'lr-after-hide';

/** What a host supplies to {@link AnchoredDisclosureController}. */
export interface AnchoredDisclosureOptions {
  host: HTMLElement & ReactiveControllerHost;
  /** The host's committed open state. */
  isOpen: () => boolean;
  /** Writes the host's open state (and whatever else rides on it). */
  setOpen: (next: boolean) => void;
  /** Dispatches a lifecycle event; returns whether a listener cancelled it. */
  emit: (name: DisclosureLifecycleEvent, cancelable: boolean) => boolean;
  /** The element the host animates, or null when none is rendered. */
  popup: () => HTMLElement | null;
  /** Starts the host's registered exit/enter animation; undefined when motion is disabled. */
  animate: (showing: boolean, popup: HTMLElement) => Animation | undefined;
  /**
   * Resolves true when the popup is placed and the open may reveal. `isCurrent` is false once a
   * newer transition superseded this one; a host with a placement-failure policy applies it here.
   */
  readyToShow: (isCurrent: () => boolean) => Promise<boolean>;
  /** Settled-closed bookkeeping (for example hiding the popup part), after `data-closing` clears. */
  afterHide: () => void;
}

/**
 * Show, hide and settle for an anchored disclosure (popover, tooltip): the veto-then-commit
 * lifecycle events, a gate that coalesces re-entrant requests, a settle token that supersedes an
 * in-flight transition, the exit animation, and the `data-closing` marker. Hosts keep their own
 * preconditions, open-state write, placement policy and motion; the settle ordering is the
 * library's one, `settlePopupTransition`.
 */
export class AnchoredDisclosureController implements ReactiveController {
  private token = 0;
  private animation?: Animation;
  private readonly gate = new OverlayTransitionGate();

  constructor(private readonly options: AnchoredDisclosureOptions) {
    options.host.addController(this);
  }

  /** A pending after-event must not announce a transition the detached host left behind. */
  hostDisconnected(): void {
    this.reset();
  }

  get open(): boolean {
    return this.options.isOpen();
  }

  /**
   * Opens unless a listener cancels `lr-show` or `refuse()` returns true (checked after the
   * event, for example a peer that will not close). A vetoed open re-syncs the `open` attribute.
   */
  show(refuse?: () => boolean): Promise<void> {
    const { host } = this.options;
    if (this.open) return Promise.resolve();
    return this.gate.request(true, () => {
      if (this.options.emit('lr-show', true) || refuse?.() === true) {
        this.syncOpenAttribute();
        return;
      }
      this.cancelAnimation();
      host.removeAttribute('data-closing');
      this.options.setOpen(true);
      return this.settle('lr-after-show');
    });
  }

  /** Closes unless a listener cancels `lr-hide`; `beforeClose` runs once the close is committed. */
  hide(beforeClose?: () => void): Promise<void> {
    if (!this.open) return Promise.resolve();
    return this.gate.request(false, () => {
      if (this.options.emit('lr-hide', true)) {
        this.syncOpenAttribute();
        return;
      }
      return this.forceClose(beforeClose);
    });
  }

  /** The close half of `hide()` without the veto point, for structural teardown. */
  forceClose(beforeClose?: () => void): Promise<void> {
    if (!this.open) return Promise.resolve();
    beforeClose?.();
    this.cancelAnimation();
    if (this.options.host.isConnected) this.options.host.setAttribute('data-closing', '');
    this.options.setOpen(false);
    return this.settle('lr-after-hide');
  }

  /** Supersedes any in-flight settle and clears the exit state, without a lifecycle event. */
  reset(): void {
    this.token++;
    this.cancelAnimation();
    this.options.host.removeAttribute('data-closing');
  }

  /**
   * Waits for render, placement (on show), the host's motion and settled-closed layout (on hide),
   * then emits the matching `lr-after-*` event. A newer transition silently supersedes this one.
   */
  settle(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const { options } = this;
    const token = ++this.token;
    const showing = event === 'lr-after-show';
    const isCurrent = (): boolean => this.token === token;
    return settlePopupTransition({
      host: options.host,
      isCurrent,
      waitForPosition: showing ? () => options.readyToShow(isCurrent) : undefined,
      animate: async () => {
        if (!options.host.isConnected) return;
        const popup = options.popup();
        const animation = popup ? options.animate(showing, popup) : undefined;
        this.animation = animation;
        await animation?.finished.catch(() => undefined);
        if (isCurrent()) this.cancelAnimation();
      },
      conceal: showing ? undefined : () => {
        options.host.removeAttribute('data-closing');
        options.afterHide();
      },
      onSettled: () => { options.emit(event, false); },
    });
  }

  /** A vetoed transition must leave the reflected attribute agreeing with the property. */
  private syncOpenAttribute(): void {
    this.options.host.toggleAttribute('open', this.open);
  }

  private cancelAnimation(): void {
    this.animation?.cancel();
    this.animation = undefined;
  }
}
