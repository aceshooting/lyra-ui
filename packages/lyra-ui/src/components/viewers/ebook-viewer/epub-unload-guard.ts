type ManagerClass = new (...args: unknown[]) => { addEventListeners(...args: unknown[]): unknown };

/** Rendition capabilities the caller has already read through data descriptors. */
export interface EpubManagerCapabilities {
  readonly settings: unknown;
  readonly requireManager: ((manager: unknown) => unknown) | undefined;
}

function isManagerClass(value: unknown): value is ManagerClass {
  if (typeof value !== 'function') return false;
  const prototype = Object.getOwnPropertyDescriptor(value, 'prototype')?.value as unknown;
  if (typeof prototype !== 'object' || prototype === null) return false;
  let current: object | null = prototype;
  for (let depth = 0; current && depth < 8; depth += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(current, 'addEventListeners');
    if (descriptor) return typeof descriptor.value === 'function';
    current = Object.getPrototypeOf(current) as object | null;
  }
  return false;
}

/**
 * Keeps the epub.js view manager from registering a window `unload` listener.
 *
 * Every epub.js view manager adds one in `addEventListeners()` and never removes it, so each
 * rendition stays reachable from the window for the page's lifetime, and engines that disallow
 * `unload` by default report a permissions-policy violation on every render. The viewer already
 * destroys its rendition and book when it disconnects, so the listener has no remaining purpose.
 *
 * Pass the capabilities of the rendition `renderTo()` returns: the rendition builds its manager
 * later, from `settings.manager`, once the book opens. The replacement subclasses whichever manager
 * the rendition would have used and skips only `unload` while upstream registers its listeners, so
 * scroll and snap handling are unchanged. `settings.manager` is read and replaced only as an own
 * writable data property; any other shape is left untouched. epub.js registers on the window of
 * the realm that loaded it, which is this module's `window`.
 */
export function guardEpubUnloadListener({ settings, requireManager }: EpubManagerCapabilities): void {
  if (typeof settings !== 'object' || settings === null || !requireManager) return;
  const descriptor = Object.getOwnPropertyDescriptor(settings, 'manager');
  if (!descriptor || !('value' in descriptor) || !descriptor.writable) return;
  const Manager = requireManager(descriptor.value);
  if (!isManagerClass(Manager)) return;
  class UnloadFreeManager extends Manager {
    override addEventListeners(...args: unknown[]): unknown {
      const ownListener = Object.hasOwn(window, 'addEventListener');
      const previous = window.addEventListener;
      window.addEventListener = function (this: Window, type: string, ...rest: unknown[]) {
        if (type === 'unload') return;
        return (previous as (...values: unknown[]) => void).call(this, type, ...rest);
      } as typeof window.addEventListener;
      try {
        return super.addEventListeners(...args);
      } finally {
        if (ownListener) window.addEventListener = previous;
        else delete (window as { addEventListener?: unknown }).addEventListener;
      }
    }
  }
  Object.defineProperty(settings, 'manager', { ...descriptor, value: UnloadFreeManager });
}
