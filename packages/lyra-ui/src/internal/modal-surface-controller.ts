import type { NativeModalCarrier } from './native-modal-carrier.js';
import { promoteToTopLayer, releaseTopLayer } from './top-layer-escape.js';
import { DeferredFocusReturn, captureFocusReturnOpener } from './deferred-focus-return.js';

/** Keeps a modal host above sibling top-layer surfaces when no nested native carrier is needed. */
export class ModalSurfaceController {
  private opener: HTMLElement | null = null;
  private readonly deferredFocusReturn = new DeferredFocusReturn();
  constructor(
    private readonly host: HTMLElement & { readonly updateComplete: Promise<unknown> },
    private readonly carrier: NativeModalCarrier,
    private readonly surface?: () => HTMLElement | null,
  ) {}

  prepare(): void {
    this.carrier.prepare();
  }

  /** Applies the common open effect before component-specific state resets. */
  open(activate: () => void): void {
    this.deferredFocusReturn.cancel();
    this.opener = captureFocusReturnOpener(this.host);
    this.prepare();
    activate();
  }

  /** Returns focus after the owner's synchronous overlay deactivation if its opener reappears. */
  close(hadOverlay: boolean, deactivate: () => void, isCurrent: () => boolean): void {
    this.hide();
    deactivate();
    const opener = this.opener;
    this.opener = null;
    if (hadOverlay && opener && this.host.isConnected) {
      this.deferredFocusReturn.schedule({
        host: this.host,
        candidates: () => [opener],
        isCurrent,
      });
    }
  }

  disconnect(): void {
    this.hide();
    this.deferredFocusReturn.cancel();
  }

  show(): void {
    if (!this.host.isConnected || this.carrier.show()) return;
    if (this.surface) {
      const surface = this.surface();
      if (surface) promoteToTopLayer(surface);
      return;
    }
    if (typeof this.host.showPopover !== 'function') return;
    if (this.host.getAttribute('popover') !== 'manual') this.host.setAttribute('popover', 'manual');
    try {
      if (!this.host.matches(':popover-open')) this.host.showPopover();
    } catch {
      // A browser without host-popover support leaves the z-index fallback intact.
    }
  }

  hide(): void {
    this.carrier.hide();
    if (this.surface) {
      const surface = this.surface();
      if (surface) releaseTopLayer(surface);
      return;
    }
    try {
      if (this.host.matches(':popover-open')) this.host.hidePopover();
    } catch {
      // The host was not promoted.
    }
  }
}
