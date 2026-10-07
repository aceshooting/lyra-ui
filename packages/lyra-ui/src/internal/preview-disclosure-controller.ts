import { deferredPlace } from './anchored-overlay-runtime.js';
import { isKeyboardFocusEvent } from './focus-modality.js';
import { activateNonmodalOverlay, type OverlayHandle } from './nonmodal-overlay-manager.js';
import { OwnedTimeout } from './owned-timer.js';
import { resolveEffectivePositioningStrategy } from './positioning-strategy.js';

export interface PreviewDisclosureOptions {
  host: HTMLElement;
  button: () => HTMLElement | undefined;
  panel: () => HTMLElement | undefined;
  hasContent: () => boolean;
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  hideDelayMs: number;
}

/** Shared hover/focus ownership and anchored, nonmodal lifecycle for small preview controls. */
export class PreviewDisclosureController {
  private cleanupPositioner?: () => void;
  private overlayHandle?: OverlayHandle;
  private readonly hideTimer: OwnedTimeout;
  private hovering = false;
  private focused = false;

  constructor(private readonly options: PreviewDisclosureOptions) {
    this.hideTimer = new OwnedTimeout(options.host);
  }

  /** Call when the host's open state has rendered. */
  syncOpen(): void {
    this.releaseOverlay();
    const { host, button, panel, isOpen } = this.options;
    const anchor = button();
    const surface = panel();
    if (!isOpen() || !anchor || !surface) return;
    this.cleanupPositioner = deferredPlace(anchor, surface, {
      placement: 'top-start',
      strategy: resolveEffectivePositioningStrategy(host, undefined, 'fixed'),
    });
    this.overlayHandle = activateNonmodalOverlay({
      host,
      panel: () => panel() ?? null,
      onEscape: () => this.closeNow(),
      restoreFocusTo: null,
    });
  }

  /** A slot emptied after opening cannot leave an empty tooltip visible. */
  ensureContent(): void {
    if (this.options.isOpen() && !this.options.hasContent()) this.closeNow();
  }

  pointerEnter(): void {
    this.hovering = true;
    this.show();
  }

  pointerLeave(): void {
    this.hovering = false;
    this.scheduleHide();
  }

  focusIn(event: FocusEvent): void {
    if (!isKeyboardFocusEvent(event)) return;
    this.focused = true;
    this.show();
  }

  focusOut(): void {
    this.focused = false;
    if (!this.hovering) this.closeNow();
  }

  /** Some preview wrappers route Escape locally as well as through the shared overlay stack. */
  handleEscape(event: KeyboardEvent): boolean {
    if (event.key !== 'Escape' || event.isComposing || !this.options.isOpen() || !this.overlayHandle?.isTopmost()) return false;
    event.preventDefault();
    this.closeNow();
    return true;
  }

  closeNow(): void {
    this.clearHideTimer();
    if (this.options.isOpen()) this.options.setOpen(false);
  }

  disconnect(): void {
    this.releaseOverlay();
    this.clearHideTimer();
    this.hovering = false;
    this.focused = false;
    this.options.setOpen(false);
  }

  private show(): void {
    if (!this.options.hasContent()) return;
    this.clearHideTimer();
    if (!this.options.isOpen()) this.options.setOpen(true);
  }

  private scheduleHide(): void {
    if (!this.options.isOpen() || this.hovering || this.focused) return;
    this.clearHideTimer();
    this.hideTimer.schedule(this.options.hideDelayMs, () => {
      this.options.setOpen(false);
    });
  }

  private clearHideTimer(): void {
    this.hideTimer.cancel();
  }

  private releaseOverlay(): void {
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
  }
}
