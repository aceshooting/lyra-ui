import {
  computePosition,
  autoUpdate,
  flip,
  shift,
  offset,
  size,
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
      middleware: [
        offset(opts.offset ?? 4),
        flip(),
        shift({ padding: 8 }),
        size({
          padding: 8,
          apply({ availableWidth, availableHeight, elements }) {
            elements.floating.style.setProperty(
              '--lyra-positioner-available-inline-size',
              `${Math.max(0, availableWidth)}px`,
            );
            elements.floating.style.setProperty(
              '--lyra-positioner-available-block-size',
              `${Math.max(0, availableHeight)}px`,
            );
          },
        }),
      ],
    }).then(({ x, y }) => {
      popup.style.left = `${x}px`;
      popup.style.top = `${y}px`;
    });

  const stopAutoUpdate = autoUpdate(anchor, popup, update);
  // The visual viewport changes independently of the layout viewport when a
  // mobile on-screen keyboard opens or closes. Floating UI's normal window
  // resize listener does not receive those events, so keep the available-size
  // CSS variables and fixed coordinates in sync with the visual viewport too.
  const visualViewport = anchor.ownerDocument.defaultView?.visualViewport;
  const updateFromVisualViewport = () => void update();
  visualViewport?.addEventListener('resize', updateFromVisualViewport);
  visualViewport?.addEventListener('scroll', updateFromVisualViewport);

  return () => {
    stopAutoUpdate();
    visualViewport?.removeEventListener('resize', updateFromVisualViewport);
    visualViewport?.removeEventListener('scroll', updateFromVisualViewport);
  };
}
