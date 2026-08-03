import { tag } from '../../../internal/prefix.js';
import type { LyraToast, ToastPlacement } from './toast.class.js';

const DEFAULT_PLACEMENT: ToastPlacement = 'top-end';
const regions = new WeakMap<Document, Map<ToastPlacement, LyraToast>>();

/**
 * Return the page-level toast region for one logical placement. This module intentionally has no
 * registration import, so class-only component modules can share region ownership without gaining
 * top-level side effects; each component's registration entry loads `<lr-toast>` when needed.
 * Regions are singleton per owner document as well as placement so an adopted alert never jumps
 * browsing contexts when it is toasted.
 */
export function getToastRegion(
  placement: ToastPlacement = DEFAULT_PLACEMENT,
  ownerDocument: Document = document,
): LyraToast {
  let documentRegions = regions.get(ownerDocument);
  if (!documentRegions) {
    documentRegions = new Map();
    regions.set(ownerDocument, documentRegions);
  }
  let region = documentRegions.get(placement);
  if (!region || !region.isConnected) {
    region = ownerDocument.createElement(tag('toast')) as LyraToast;
    region.placement = placement;
    ownerDocument.body.appendChild(region);
    documentRegions.set(placement, region);
  }
  return region;
}
