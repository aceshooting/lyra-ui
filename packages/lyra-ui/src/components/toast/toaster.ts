import { LyraToast, type ToastCreateOptions, type ToastPlacement } from './toast.js';
import type { LyraToastItem } from './toast-item.js';
import './toast.js';

let region: LyraToast | undefined;

/** Get (or lazily mount) the singleton toast region on `document.body`. */
function getRegion(placement?: ToastPlacement): LyraToast {
  if (!region || !region.isConnected) {
    region = document.createElement('lyra-toast') as LyraToast;
    document.body.appendChild(region);
  }
  if (placement) region.placement = placement;
  return region;
}

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
 * Show a toast. Ergonomic convenience over `<lyra-toast>.create()` that mounts
 * and reuses a single page-level region — the drop-in for `react-hot-toast`.
 *
 * @example toast('Saved');
 * @example toast({ message: 'Deleted', variant: 'danger', action: { label: 'Undo', onClick: undo } });
 */
export function toast(input: ToastOptions | string): ToastHandle {
  const opts: ToastOptions = typeof input === 'string' ? { message: input } : input;
  const item = getRegion(opts.placement)
    .create(opts.message, opts)
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
