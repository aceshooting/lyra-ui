import { LyraToast, type ToastCreateOptions, type ToastPlacement } from './toast.class.js';
import { LyraToastItem } from './toast-item.class.js';
import { getToastRegion } from './toast-region.js';
import { defineElement } from '../../../internal/prefix.js';

export interface ToastOptions extends ToastCreateOptions {
  message: string;
  placement?: ToastPlacement;
  /** Optional action button rendered after the message. */
  action?: { label: string; onClick: (item: LyraToastItem) => void };
}

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
export function toast(input: ToastOptions | string): ToastHandle {
  // Keep the package root genuinely registration-free while preserving the synchronous helper
  // contract. Importing this module loads only pure class modules; invoking the imperative helper
  // installs exactly the two elements it creates.
  defineElement('toast-item', LyraToastItem);
  defineElement('toast', LyraToast);
  const opts: ToastOptions = typeof input === 'string' ? { message: input } : input;
  // An action must remain available until the user can reach it. Callers can
  // still opt into a finite duration explicitly; the convenience API makes
  // only the omitted-duration/action combination persistent.
  const createOptions: ToastCreateOptions = {
    variant: opts.variant,
    duration: opts.duration ?? (opts.action ? 0 : undefined),
    size: opts.size,
    withIcon: opts.withIcon,
  };
  const item = getToastRegion(opts.placement)
    .create(opts.message, createOptions)
    .then((el) => {
      if (opts.action) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = opts.action.label;
        btn.addEventListener('click', () => opts.action!.onClick(el));
        el.appendChild(btn);
      }
      return el;
    });

  return {
    item,
    dismiss: () => {
      void item.then((el) => el.hide());
    },
  };
}
