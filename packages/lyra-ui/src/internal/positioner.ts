import {
  computePosition,
  autoUpdate,
  flip,
  shift,
  offset,
  type Placement,
} from '@floating-ui/dom';

export interface PlaceOptions {
  placement?: Placement;
  offset?: number;
}

/**
 * Position `popup` (fixed) relative to `anchor` with flip/shift, keeping it
 * updated on scroll/resize. Returns a cleanup function that stops updating.
 */
export function place(
  anchor: HTMLElement,
  popup: HTMLElement,
  opts: PlaceOptions = {},
): () => void {
  popup.style.position = 'fixed';
  popup.style.margin = '0';

  const update = () =>
    computePosition(anchor, popup, {
      // The popup is `position: fixed`, so Floating UI must compute viewport-relative
      // coordinates; without this it defaults to 'absolute' and the popup lands off by
      // the scroll offset (appears too far down on a scrolled page).
      strategy: 'fixed',
      placement: opts.placement ?? 'bottom-start',
      middleware: [offset(opts.offset ?? 4), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      popup.style.left = `${x}px`;
      popup.style.top = `${y}px`;
    });

  return autoUpdate(anchor, popup, update);
}
