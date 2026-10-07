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

/** A temporary tabindex assignment that preserves later author writes. */
export interface TabIndexLease {
  set(element: HTMLElement | undefined, value: 0 | -1): void;
  release(): void;
  hasAuthored(element: HTMLElement): boolean;
}

export function leaseTabIndex(): TabIndexLease {
  let element: HTMLElement | undefined;
  let authored: string | null = null;
  let lastManaged: string | null = null;
  let consumerOwns = false;

  const release = (): void => {
    if (element && !consumerOwns && element.getAttribute('tabindex') === lastManaged) {
      if (authored === null) element.removeAttribute('tabindex');
      else element.setAttribute('tabindex', authored);
    }
    element = undefined;
    authored = null;
    lastManaged = null;
    consumerOwns = false;
  };

  return {
    set(next, value) {
      if (element !== next) {
        release();
        element = next;
        authored = next?.getAttribute('tabindex') ?? null;
      }
      if (!next) return;
      if (consumerOwns || (lastManaged !== null && next.getAttribute('tabindex') !== lastManaged)) {
        consumerOwns = true;
        return;
      }
      next.tabIndex = value;
      lastManaged = next.getAttribute('tabindex');
    },
    release,
    hasAuthored(target) {
      if (target !== element || lastManaged === null) return target.hasAttribute('tabindex');
      return target.getAttribute('tabindex') === lastManaged ? authored !== null : target.hasAttribute('tabindex');
    },
  };
}
