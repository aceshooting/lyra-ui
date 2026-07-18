import { LyraToast, type ToastCreateOptions, type ToastPlacement } from './toast.js';
import type { LyraToastItem } from './toast-item.js';
import './toast.js';

const DEFAULT_PLACEMENT: ToastPlacement = 'top-end';

const regions = new Map<ToastPlacement, LyraToast>();

/**
 * Get (or lazily mount) the singleton toast region for a given placement.
 * Each placement gets its own region element so that a `toast()` call
 * targeting one placement never relocates toasts already showing at another
 * -- `placement` is a per-call option, not a global, retroactive one.
 */
function getRegion(placement: ToastPlacement = DEFAULT_PLACEMENT): LyraToast {
  let region = regions.get(placement);
  if (!region || !region.isConnected) {
    region = document.createElement('lr-toast') as LyraToast;
    region.placement = placement;
    document.body.appendChild(region);
    regions.set(placement, region);
  }
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
 * Show a toast. Ergonomic convenience over `<lr-toast>.create()` that mounts
 * and reuses a page-level region per placement — the drop-in for `react-hot-toast`.
 *
 * @example toast('Saved');
 * @example toast({ message: 'Deleted', variant: 'danger', action: { label: 'Undo', onClick: undo } });
 */
export function toast(input: ToastOptions | string): ToastHandle {
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
  const item = getRegion(opts.placement)
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
