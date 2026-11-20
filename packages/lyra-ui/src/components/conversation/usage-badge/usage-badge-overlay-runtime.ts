import type { LyraElement } from '../../../internal/lyra-element.js';
import {
  deferredPlace as place,
  syncTopLayerRelease,
  topLayerPlacement,
} from '../../../internal/anchored-overlay-runtime.js';
import { activateNonmodalOverlay, type OverlayHandle } from '../../../internal/nonmodal-overlay-manager.js';
import type { OverlayOrderReservation } from '../../../internal/overlay-order.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { RenderedStateController } from '../../../internal/rendered-state.js';

export type UsageBadgeOverlayHandle = Pick<OverlayHandle, 'deactivate' | 'isTopmost'> & {
  /** Re-places the open tooltip for a changed `topLayer`, releasing a promotion it no longer wants. */
  setTopLayer(topLayer: boolean): void;
};

/** Loads only for an open badge; no modal inerting, scroll lock, or automatic focus movement. */
export function activateUsageBadgeOverlay(
  host: LyraElement,
  onEscape: () => void,
  orderReservation?: OverlayOrderReservation,
  topLayer = false,
): UsageBadgeOverlayHandle | undefined {
  const anchor = host.renderRoot.querySelector<HTMLElement>('[part="base"]');
  const panel = () => host.renderRoot.querySelector<HTMLElement>('[part="tooltip"]');
  const popup = panel();
  if (!anchor || !popup) return;
  let placedTopLayer: boolean | undefined;
  let cleanupPositioner: (() => void) | undefined;
  const placeTooltip = (next: boolean): void => {
    cleanupPositioner?.();
    placedTopLayer = syncTopLayerRelease(popup, placedTopLayer, next);
    cleanupPositioner = place(anchor, popup, {
      placement: 'top-start',
      ...topLayerPlacement(next, resolveEffectivePositioningStrategy(host, undefined, 'fixed')),
    });
  };
  placeTooltip(topLayer);
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
      cleanupPositioner = undefined;
      renderedState.stop();
      return handle.deactivate(options);
    },
    setTopLayer: (next) => {
      if (cleanupPositioner) placeTooltip(next);
    },
    isTopmost: () => {
      renderedState.check();
      return handle.isTopmost();
    },
  };
}
