import { tag } from '../../../internal/prefix.js';
import type { LyraToast, ToastPlacement } from './toast.class.js';

const DEFAULT_PLACEMENT: ToastPlacement = 'top-end';
const regions = new Map<ToastPlacement, LyraToast>();

/**
 * Return the page-level toast region for one logical placement. This module intentionally has no
 * registration import, so class-only component modules can share region ownership without gaining
 * top-level side effects; each component's registration entry loads `<lr-toast>` when needed.
 */
export function getToastRegion(placement: ToastPlacement = DEFAULT_PLACEMENT): LyraToast {
  let region = regions.get(placement);
  if (!region || !region.isConnected) {
    region = document.createElement(tag('toast')) as LyraToast;
    region.placement = placement;
    document.body.appendChild(region);
    regions.set(placement, region);
  }
  return region;
}
