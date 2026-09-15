import type { LyraToastOptions } from './toast.class.js';
import type { LyraToastItem } from './toast-item.class.js';
import { getToastRegion } from './toast-region.js';
import { defineElement, tag } from '../../../internal/prefix.js';

export type { LyraToastOptions } from './toast.class.js';

export interface ToastHandle {
  /** Resolves to the created toast item. */
  item: Promise<LyraToastItem>;
  /** Dismiss the toast early. */
  dismiss: () => void;
}

let elementsRegistered: Promise<void> | undefined;

/**
 * Dynamically imports and registers `<lr-toast>`/`<lr-toast-item>` exactly once. Deferred to the
 * first actual `toast()` call so merely importing this helper (or the package root, which
 * re-exports it) never pulls the element class implementations into an eagerly loaded bundle --
 * only actually showing a toast does. Idempotent and safe to race: every caller shares the same
 * pending/settled promise.
 */
function registerToastElements(): Promise<void> {
  elementsRegistered ??= Promise.all([import('./toast.class.js'), import('./toast-item.class.js')]).then(
    ([{ LyraToast }, { LyraToastItem }]) => {
      defineElement('toast-item', LyraToastItem);
      defineElement('toast', LyraToast);
    },
  );
  return elementsRegistered;
}

/**
 * Show a toast. Ergonomic convenience over `<lr-toast>.create()` that mounts
 * and reuses a page-level region per placement — the drop-in for `react-hot-toast`.
 *
 * @example toast('Saved');
 * @example toast({ message: 'Deleted', variant: 'danger', action: { label: 'Undo', onClick: undo } });
 */
export function toast(input: LyraToastOptions | string): ToastHandle {
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
  const item: Promise<LyraToastItem> = registerToastElements().then(() => {
    const registry = ownerDocument.defaultView?.customElements;
    if (!registry?.get(tag('toast')) || !registry.get(tag('toast-item'))) {
      throw new TypeError('Toast elements are not registered in the requested owner document.');
    }
    return getToastRegion(opts.placement, ownerDocument).create(normalized);
  });

  return {
    item,
    dismiss: () => {
      void item.then((el) => el.hide());
    },
  };
}
