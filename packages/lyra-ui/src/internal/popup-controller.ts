import { DocumentPointerListener } from './document-pointer.js';
import { PopupTransitionWaiters, settlePopupTransition } from './anchored-overlay-runtime.js';

export type PopupLifecycleEvent = 'lr-after-show' | 'lr-after-hide';

export interface PopupControllerOptions {
  host: HTMLElement & { readonly updateComplete: Promise<unknown> };
  /** The element whose animations a settle waits for; omit for pointer-only use. */
  popup?: () => Element | null;
  /** Dispatches a host event; returns whether a listener cancelled it; omit for pointer-only use. */
  emit?: (name: 'lr-show' | 'lr-hide' | PopupLifecycleEvent, cancelable: boolean) => boolean;
  /** Called for a capture-phase `pointerdown` while bound. */
  onPointer: (event: PointerEvent) => void;
}

/** Dispatches a popup lifecycle event through a host's protected `emit()`; true when cancelled. */
export function emitPopupEvent(host: object, name: string, cancelable: boolean): boolean {
  const emit = (host as { emit(name: string, detail?: null, init?: { cancelable: boolean }): Event }).emit;
  return emit.call(host, name, null, { cancelable }).defaultPrevented;
}

/** The open, veto, settle and outside-press bookkeeping shared by the anchored popup controls. */
export class PopupController {
  /** True while the current update's open transition was cancelled by a listener. */
  vetoed = false;
  private token = 0;
  private readonly waiters = new PopupTransitionWaiters<PopupLifecycleEvent>();
  private readonly pointer: DocumentPointerListener;

  constructor(private readonly options: PopupControllerOptions) {
    this.pointer = new DocumentPointerListener(options.host, options.onPointer);
  }

  bindPointer(): void {
    if (this.options.host.isConnected) this.pointer.bind();
  }

  unbindPointer(): void {
    this.pointer.unbind();
  }

  /** Supersedes any in-flight settle and releases every pending show()/hide() caller. */
  cancel(): void {
    this.token++;
    this.waiters.resolve('lr-after-show');
    this.waiters.resolve('lr-after-hide');
  }

  /** Registers the caller of show()/hide(), releasing the opposite direction's callers. */
  wait(opening: boolean): Promise<void> {
    this.waiters.resolve(opening ? 'lr-after-hide' : 'lr-after-show');
    return this.waiters.wait(opening ? 'lr-after-show' : 'lr-after-hide');
  }

  /** Releases the callers of one lifecycle event without emitting it. */
  release(event: PopupLifecycleEvent): void {
    this.waiters.resolve(event);
  }

  /**
   * Emits the cancelable `lr-show`/`lr-hide` request for an `open` write already applied. When a
   * listener cancels it `flip` restores the previous state and the cancelled direction's callers are
   * released. Returns whether the transition was cancelled.
   */
  announce(open: boolean, flip: () => void): boolean {
    this.vetoed = this.options.emit?.(open ? 'lr-show' : 'lr-hide', true) ?? false;
    if (this.vetoed) {
      flip();
      this.waiters.resolve(open ? 'lr-after-show' : 'lr-after-hide');
    }
    return this.vetoed;
  }

  /**
   * Waits for placement and animations, then emits the after-event and releases its callers.
   * `waitForPosition` receives a staleness probe and resolves `false` to abandon the settle.
   */
  async settle(
    event: PopupLifecycleEvent,
    hooks: {
      waitForPosition?: (stale: () => boolean) => Promise<boolean>;
      conceal?: () => void;
    } = {},
  ): Promise<void> {
    const token = ++this.token;
    const stale = (): boolean => this.token !== token;
    const { waitForPosition } = hooks;
    await settlePopupTransition({
      host: this.options.host,
      popup: this.options.popup ?? (() => null),
      isCurrent: () => !stale(),
      waitForPosition: event === 'lr-after-show' && waitForPosition ? () => waitForPosition(stale) : undefined,
      conceal: event === 'lr-after-hide' ? hooks.conceal : undefined,
      onSettled: () => {
        this.options.emit?.(event, false);
        this.waiters.resolve(event);
      },
    });
  }
}
