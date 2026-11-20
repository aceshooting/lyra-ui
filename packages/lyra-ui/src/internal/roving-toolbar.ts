import { resolveListMove } from './list-navigation.js';

/** Resolves the next stop in a horizontal toolbar without owning its focus policy. */
export class RovingToolbarController {
  move(
    event: KeyboardEvent,
    count: number,
    current: number,
    direction: 'ltr' | 'rtl',
    isAvailable?: (index: number) => boolean,
  ): number | null {
    if (event.defaultPrevented) return null;
    return resolveListMove(event, { count, current, direction, orientation: 'horizontal', isAvailable });
  }
}

export { leaseTabIndex, type TabIndexLease } from './tab-index-lease.js';

/** Options for observing every attribute and subtree change that can add or remove a toolbar stop. */
export function observeStopChanges(): MutationObserverInit {
  return {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [
      'aria-disabled',
      'aria-hidden',
      'contenteditable',
      'controls',
      'disabled',
      'hidden',
      'href',
      'inert',
      'open',
      'role',
      'tabindex',
      'type',
    ],
    childList: true,
    subtree: true,
  };
}
