import { getActiveNativeModal, getNativeModalMountTarget } from '../../../internal/native-modal-context.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraToast, LyraToastPlacement } from './toast.class.js';

const DEFAULT_PLACEMENT: LyraToastPlacement = 'top-end';
const regions = new WeakMap<HTMLElement, Map<LyraToastPlacement, LyraToast>>();

/**
 * Return the page-level toast region for one logical placement. This module intentionally has no
 * registration import, so class-only component modules can share region ownership without gaining
 * top-level side effects; each component's registration entry loads `<lr-toast>` when needed.
 * Regions are singleton per active native-modal context and placement, so a notification remains
 * in the interaction context that created it and never jumps browsing contexts.
 */
export function getToastRegion(
  placement: LyraToastPlacement = DEFAULT_PLACEMENT,
  ownerDocument: Document = document,
): LyraToast {
  const modal = getActiveNativeModal(ownerDocument);
  const parent = modal ? getNativeModalMountTarget(modal) : ownerDocument.body;
  let documentRegions = regions.get(parent);
  if (!documentRegions) {
    documentRegions = new Map();
    regions.set(parent, documentRegions);
  }
  let region = documentRegions.get(placement);
  if (!region || !region.isConnected || region.ownerDocument !== ownerDocument) {
    region = ownerDocument.createElement(tag('toast')) as LyraToast;
    region.placement = placement;
    if (typeof region.showPopover === 'function') region.popover = 'manual';
    parent.appendChild(region);
    if (modal) {
      // A native modal leaves body content platform-inert, so this region lives inside it.
      const ownedRegion = region;
      const discard = (): void => {
        modal.removeEventListener('close', onClose);
        modal.removeEventListener('beforetoggle', beforeToggle);
        ownedRegion.remove();
        if (documentRegions.get(placement) === ownedRegion) documentRegions.delete(placement);
      };
      const onClose = (): void => {
        if (!modal.open) discard();
      };
      const beforeToggle = (event: Event): void => {
        if ((event as ToggleEvent).newState === 'closed') discard();
      };
      // beforetoggle closes ownership synchronously, so close-and-reopen in one task cannot
      // accidentally admit fresh notifications into the previous modal session's region.
      modal.addEventListener('beforetoggle', beforeToggle);
      modal.addEventListener('close', onClose);
    }
    documentRegions.set(placement, region);
  }
  // Top-layer order is show order: re-showing lifts the region above modals opened since.
  if (region.popover === 'manual' && !region.matches(':focus-within')) {
    if (region.matches(':popover-open')) region.hidePopover();
    region.showPopover();
  }
  return region;
}
