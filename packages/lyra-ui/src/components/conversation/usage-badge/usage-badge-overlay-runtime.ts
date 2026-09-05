import type { LyraElement } from '../../../internal/lyra-element.js';
import { deferredPlace as place } from '../../../internal/anchored-overlay-runtime.js';
import { activateNonmodalOverlay, type OverlayHandle } from '../../../internal/nonmodal-overlay-manager.js';
import type { OverlayOrderReservation } from '../../../internal/overlay-order.js';
import { RenderedStateController } from '../../../internal/rendered-state.js';

export type UsageBadgeOverlayHandle = Pick<OverlayHandle, 'deactivate' | 'isTopmost'>;

/** Loads only for an open badge; no modal inerting, scroll lock, or automatic focus movement. */
export function activateUsageBadgeOverlay(
  host: LyraElement,
  onEscape: () => void,
  orderReservation?: OverlayOrderReservation,
): UsageBadgeOverlayHandle | undefined {
  const anchor = host.renderRoot.querySelector<HTMLElement>('[part="base"]');
  const panel = () => host.renderRoot.querySelector<HTMLElement>('[part="tooltip"]');
  const popup = panel();
  if (!anchor || !popup) return;
  const cleanupPositioner = place(anchor, popup, { placement: 'top-start' });
  const handle = activateNonmodalOverlay({
    host, panel, onEscape, orderReservation,
    beforeInitialFocus: () => false,
    restoreFocusTo: null,
  });
  const renderedState = new RenderedStateController(host, panel, (rendered) => {
    if (!handle.isActive()) return;
    if (rendered) handle.resume();
    else handle.suspend();
  });
  if (handle.isActive()) renderedState.start();
  return {
    deactivate: (options) => {
      cleanupPositioner?.();
      renderedState.stop();
      return handle.deactivate(options);
    },
    isTopmost: () => {
      renderedState.check();
      return handle.isTopmost();
    },
  };
}
