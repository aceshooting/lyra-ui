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
 * A synthetic anchor for `place()` -- structurally matches Floating UI's own `VirtualElement`
 * (`@floating-ui/dom`), so it can be passed to `computePosition()`/`autoUpdate()` wherever a real
 * `Element` is accepted. Lets a popup be positioned against an arbitrary rectangle (a graph node,
 * a canvas pixel, a chart datum, a text-selection range) instead of a real DOM element. See
 * `virtualAnchorFromRect()` to build one from a plain `{x, y, width?, height?}` rect.
 */
export interface VirtualAnchor {
  getBoundingClientRect(): DOMRect;
  /** A real element `place()`'s underlying platform can use for scale/RTL context that a plain
   *  rect can't supply on its own. Optional -- omitting it still works, but `autoUpdate()`'s
   *  ancestor-scroll/resize tracking has nothing to observe, so a caller whose anchor point moves
   *  on its own (e.g. a graph pan/zoom tick) must re-supply a fresh anchor itself. */
  contextElement?: Element;
}

/**
 * Builds a `VirtualAnchor` from a plain rect, for `showAt()`-style APIs that anchor a popup to an
 * arbitrary point or box instead of a real DOM element. `width`/`height` default to `0` (a point).
 */
export function virtualAnchorFromRect(rect: {
  x: number;
  y: number;
  width?: number;
  height?: number;
}): VirtualAnchor {
  const domRect = new DOMRect(rect.x, rect.y, rect.width ?? 0, rect.height ?? 0);
  return { getBoundingClientRect: () => domRect };
}

/**
 * Position `popup` (fixed) relative to `anchor` with flip/shift, keeping it
 * updated on scroll/resize. Returns a cleanup function that stops updating.
 */
export function place(
  anchor: Element | VirtualAnchor,
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
              '--lr-positioner-available-inline-size',
              `${Math.max(0, availableWidth)}px`,
            );
            elements.floating.style.setProperty(
              '--lr-positioner-available-block-size',
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
  // Read from `popup` rather than `anchor` -- a VirtualAnchor has no `ownerDocument` of its own,
  // and `popup` is always a real element in the same document a real `anchor` would be anyway.
  const visualViewport = popup.ownerDocument.defaultView?.visualViewport;
  const updateFromVisualViewport = () => void update();
  visualViewport?.addEventListener('resize', updateFromVisualViewport);
  visualViewport?.addEventListener('scroll', updateFromVisualViewport);

  return () => {
    stopAutoUpdate();
    visualViewport?.removeEventListener('resize', updateFromVisualViewport);
    visualViewport?.removeEventListener('scroll', updateFromVisualViewport);
  };
}

/**
 * Calls `onUpdate` with `target`'s current viewport-relative rect whenever it changes (scroll,
 * resize, layout mutation, or visual-viewport change) — the same auto-update machinery `place()`
 * uses, minus the anchor/floating placement math, for a caller that needs to track a raw rect
 * (e.g. a spotlight cutout sized to match an arbitrary target) rather than position a second
 * element relative to one. `target` is passed as both the reference and floating element to
 * Floating UI's `autoUpdate()` since only change notifications are needed, not independent
 * positioning of a second element -- `autoUpdate()` does not require these to differ; any
 * resulting double-invocation of `onUpdate` per tick (from ancestor-scroll listeners being
 * attached once per role) is harmless, since `getBoundingClientRect()` reads are idempotent.
 * Returns a cleanup function, same contract as `place()`. Calls `onUpdate` once synchronously
 * before returning so the first paint doesn't wait for a scroll/resize tick.
 */
export function trackRect(target: HTMLElement, onUpdate: (rect: DOMRect) => void): () => void {
  const update = () => onUpdate(target.getBoundingClientRect());
  const stopAutoUpdate = autoUpdate(target, target, update);
  const visualViewport = target.ownerDocument.defaultView?.visualViewport;
  const onVisualViewportChange = () => update();
  visualViewport?.addEventListener('resize', onVisualViewportChange);
  visualViewport?.addEventListener('scroll', onVisualViewportChange);
  update();
  return () => {
    stopAutoUpdate();
    visualViewport?.removeEventListener('resize', onVisualViewportChange);
    visualViewport?.removeEventListener('scroll', onVisualViewportChange);
  };
}
