import { LyraToast, type LyraToastOptions } from './toast.class.js';
import { LyraToastItem } from './toast-item.class.js';
import { getToastRegion } from './toast-region.js';
import { defineElement } from '../../../internal/prefix.js';

export type { LyraToastOptions } from './toast.class.js';

/** @deprecated Use the canonical `LyraToastOptions`. */
export type ToastOptions = LyraToastOptions;

export interface ToastHandle {
  /** Resolves to the created toast item. */
  item: Promise<LyraToastItem>;
  /** Dismiss the toast early. */
  dismiss: () => void;
}

/**
 * Show a toast. Ergonomic convenience over `<lr-toast>.create()` that mounts
 * and reuses a page-level region per placement — the drop-in for `react-hot-toast`.
 *
 * @example toast('Saved');
 * @example toast({ message: 'Deleted', variant: 'danger', action: { label: 'Undo', onClick: undo } });
 */
export function toast(input: LyraToastOptions | string): ToastHandle {
  // Keep the package root genuinely registration-free while preserving the synchronous helper
  // contract. Importing this module loads only pure class modules; invoking the imperative helper
  // installs exactly the two elements it creates.
  defineElement('toast-item', LyraToastItem);
  defineElement('toast', LyraToast);
  const opts: LyraToastOptions = typeof input === 'string' ? { message: input } : input;
  // An action must remain available until the user can reach it. Callers can
  // still opt into a finite duration explicitly; the convenience API makes
  // only the omitted-duration/action combination persistent.
  const ownerDocument = opts.ownerDocument ?? document;
  const normalized: LyraToastOptions = {
    ...opts,
    ownerDocument,
    duration: opts.duration ?? (opts.action ? 0 : undefined),
  };
  let item: Promise<LyraToastItem>;
  try {
    const registry = ownerDocument.defaultView?.customElements;
    if (!registry?.get('lr-toast') || !registry.get('lr-toast-item')) {
      throw new TypeError('Toast elements are not registered in the requested owner document.');
    }
    item = getToastRegion(opts.placement, ownerDocument).create(normalized);
  } catch (error) {
    item = Promise.reject(error);
  }

  return {
    item,
    dismiss: () => {
      void item.then((el) => el.hide());
    },
  };
}
