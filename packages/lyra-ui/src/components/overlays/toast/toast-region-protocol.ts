/** @internal Shared protocol between a toast region and the different element types it can own. */
export const TOAST_REGION_ENQUEUE: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/toast-region/enqueue/v1',
) as never;
/** @internal */
export const TOAST_REGION_SET_ACTIVE: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/toast-region/set-active/v1',
) as never;
/** @internal */
export const TOAST_REGION_REJECT: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/toast-region/reject/v1',
) as never;
/** @internal */
export const TOAST_REGION_EVICT: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/toast-region/evict/v1',
) as never;

/** @internal */
export type ToastRegionEvictionReason = 'overflow' | 'rejected';

/** @internal */
export interface ToastRegionEntry extends HTMLElement {
  [TOAST_REGION_SET_ACTIVE](owner: ToastRegionController, active: boolean): void;
  [TOAST_REGION_EVICT](owner: ToastRegionController, reason: ToastRegionEvictionReason): void;
}

/** @internal */
export interface ToastRegionController extends HTMLElement {
  [TOAST_REGION_ENQUEUE](entry: ToastRegionEntry): void;
  [TOAST_REGION_REJECT](entry: ToastRegionEntry): void;
}

/** @internal */
export function isToastRegionEntry(value: Element): value is ToastRegionEntry {
  return typeof (value as Partial<ToastRegionEntry>)[TOAST_REGION_SET_ACTIVE] === 'function' &&
    typeof (value as Partial<ToastRegionEntry>)[TOAST_REGION_EVICT] === 'function';
}

/** @internal */
export function toastRegionControllerFor(value: Element): ToastRegionController | undefined {
  const parent = value.parentElement as Partial<ToastRegionController> | null;
  return parent && typeof parent[TOAST_REGION_ENQUEUE] === 'function' &&
      typeof parent[TOAST_REGION_REJECT] === 'function'
    ? parent as ToastRegionController
    : undefined;
}
