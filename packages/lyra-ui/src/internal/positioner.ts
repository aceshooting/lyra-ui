import {
  computePosition,
  autoUpdate,
  arrow,
  flip,
  shift,
  offset,
  size,
  type Boundary,
  type Placement,
} from '@floating-ui/dom';

/** What `place()` reports back after each recomputation, for a caller that renders an arrow or
 *  reflects the resolved side (which `flip()` may have changed) into a part name or attribute. */
export interface PlacementResult {
  /** The placement actually used, after `flip()`/`shift()` — not necessarily the requested one. */
  placement: Placement;
  /** Arrow offsets within the popup, present only when an `arrow` element was supplied. */
  arrow?: { x?: number; y?: number };
}

/**
 * Which CSS positioning scheme the popup is laid out with. `fixed` (this library's default) keeps
 * the popup out of every ancestor's transform/filter/containment context and survives scrolling
 * containers; `absolute` positions against the nearest positioned ancestor instead, which is what a
 * caller wants when the popup must scroll away with the content it belongs to.
 */
export type PlaceStrategy = 'absolute' | 'fixed';

/** Which axes `autoSize` re-measures against its own boundary and padding. */
export type PlaceAutoSize = 'horizontal' | 'vertical' | 'both';

/** Which of the anchor's dimensions the popup copies. */
export type PlaceSync = 'width' | 'height' | 'both';

/**
 * What `flip()` settles on when no candidate placement fits.
 * `best-fit` takes the least-overflowing candidate; `initial-placement` keeps the requested one.
 */
export type PlaceFlipFallbackStrategy = 'best-fit' | 'initial-placement';

/** The clipping context an overflow-aware middleware measures against, instead of the viewport. */
export type PlaceBoundary = Element | Element[];

export interface PlaceOptions {
  placement?: Placement;
  /** CSS positioning scheme for the popup. Default `'fixed'`. */
  strategy?: PlaceStrategy;
  /** Distance from the anchor along the placement axis. */
  offset?: number;
  /** Distance along the perpendicular axis — Floating UI's cross-axis offset. */
  skidding?: number;
  /** Flip to the opposite side when the requested one does not fit. Default `true`. */
  flip?: boolean;
  /** Placements `flip()` tries, in order, instead of just the opposite side. */
  flipFallbackPlacements?: Placement[];
  /** What `flip()` falls back to when none of the candidates fit. Default `'best-fit'`. */
  flipFallbackStrategy?: PlaceFlipFallbackStrategy;
  /** Clipping context `flip()` measures overflow against. Default: the clipping ancestors. */
  flipBoundary?: PlaceBoundary;
  /** Padding kept clear inside the flip boundary. Default `0`, matching Floating UI. */
  flipPadding?: number;
  /** Shift along the anchor's edge to stay in view. Default `true`. */
  shift?: boolean;
  /** Clipping context `shift()` measures overflow against. Default: the clipping ancestors. */
  shiftBoundary?: PlaceBoundary;
  /** Padding kept clear inside the shift boundary. Defaults to `padding` when omitted. */
  shiftPadding?: number;
  /** Viewport padding used by `shift()` and the available-size measurement. */
  padding?: number;
  /**
   * Re-measures the available space on the named axes against `autoSizeBoundary`/`autoSizePadding`
   * instead of the shared `padding`, overwriting the matching
   * `--lr-positioner-available-inline-size`/`--lr-positioner-available-block-size` value. The
   * unnamed axis keeps the default measurement — `place()` has always published both, so this
   * narrows or widens an existing constraint rather than introducing one.
   */
  autoSize?: PlaceAutoSize;
  /** Clipping context the `autoSize` measurement uses. Default: the clipping ancestors. */
  autoSizeBoundary?: PlaceBoundary;
  /** Padding kept clear inside the auto-size boundary. Default `0`, matching Floating UI. */
  autoSizePadding?: number;
  /** Copies the anchor's inline size, block size, or both onto the popup. */
  sync?: PlaceSync;
  /** An arrow element inside the popup to position against the anchor's centre. */
  arrow?: HTMLElement;
  /** Keeps the arrow this far from the popup's corners. */
  arrowPadding?: number;
  /**
   * An element to clip into the quad spanning the anchor and the popup, so a pointer crossing the
   * `offset` gap between them never leaves both. `place()` writes the four corner coordinates as
   * `--lr-positioner-hover-bridge-*` custom properties on it; the caller's own stylesheet turns
   * those into a `clip-path`.
   */
  hoverBridge?: HTMLElement;
  /** Called after every recomputation with the resolved placement. */
  onPlaced?: (result: PlacementResult) => void;
}

/** Corner order matches a `polygon()` traversal: top-left, top-right, bottom-right, bottom-left. */
const HOVER_BRIDGE_CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

/** Popups whose inline size a `place()` run wrote through `sync` -- see the release in `place()`. */
const syncedPopups = new WeakSet<HTMLElement>();

/**
 * Clips `bridge` to the quad spanning the anchor and the popup, so the `offset` gap between them
 * stays hoverable. Written as physical coordinates on purpose: both rects are already viewport
 * pixels, and a logical property cannot express a quad whose two edges belong to different boxes.
 */
function updateHoverBridge(
  bridge: HTMLElement,
  anchorRect: DOMRect,
  popupRect: DOMRect,
  placement: Placement,
): void {
  const side = placement.split('-')[0];
  const onBlockAxis = side === 'top' || side === 'bottom';
  let quad: [number, number][];
  if (onBlockAxis) {
    quad =
      anchorRect.top < popupRect.top
        ? [
            [anchorRect.left, anchorRect.bottom],
            [anchorRect.right, anchorRect.bottom],
            [popupRect.right, popupRect.top],
            [popupRect.left, popupRect.top],
          ]
        : [
            [popupRect.left, popupRect.bottom],
            [popupRect.right, popupRect.bottom],
            [anchorRect.right, anchorRect.top],
            [anchorRect.left, anchorRect.top],
          ];
  } else {
    quad =
      anchorRect.left < popupRect.left
        ? [
            [anchorRect.right, anchorRect.top],
            [popupRect.left, popupRect.top],
            [popupRect.left, popupRect.bottom],
            [anchorRect.right, anchorRect.bottom],
          ]
        : [
            [popupRect.right, popupRect.top],
            [anchorRect.left, anchorRect.top],
            [anchorRect.left, anchorRect.bottom],
            [popupRect.right, popupRect.bottom],
          ];
  }
  HOVER_BRIDGE_CORNERS.forEach((corner, index) => {
    const [x, y] = quad[index] as [number, number];
    bridge.style.setProperty(`--lr-positioner-hover-bridge-${corner}-x`, `${x}px`);
    bridge.style.setProperty(`--lr-positioner-hover-bridge-${corner}-y`, `${y}px`);
  });
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
 * An optional `contextElement` is forwarded verbatim -- see `VirtualAnchor.contextElement`.
 */
export function virtualAnchorFromRect(rect: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  contextElement?: Element;
}): VirtualAnchor {
  const domRect = new DOMRect(rect.x, rect.y, rect.width ?? 0, rect.height ?? 0);
  return { getBoundingClientRect: () => domRect, contextElement: rect.contextElement };
}

/**
 * Position `popup` relative to `anchor` with flip/shift, keeping it updated on scroll/resize.
 * Returns a cleanup function that stops updating. Re-calling `place()` on the same popup with
 * different options is the supported way to change them: each call re-establishes every write it
 * owns, so no run inherits the previous one's sizing.
 */
export function place(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  opts: PlaceOptions = {},
): () => void {
  // The popup defaults to `position: fixed`, so Floating UI must compute viewport-relative
  // coordinates; with the default 'absolute' strategy the popup would land off by the scroll
  // offset (appearing too far down on a scrolled page). A caller that deliberately wants the
  // popup to scroll with a positioned ancestor asks for `strategy: 'absolute'` explicitly.
  const strategy = opts.strategy ?? 'fixed';
  popup.style.position = strategy;
  popup.style.margin = '0';

  const padding = opts.padding ?? 8;
  const sync = opts.sync;
  const autoSize = opts.autoSize;
  const hoverBridge = opts.hoverBridge;

  // `sync` is the only option here that writes inline sizing nothing else rewrites, so dropping it
  // has to release that sizing. Released on *setup* rather than in the returned cleanup: a caller
  // that re-`place()`s on every property change (which `<lr-popup>` does) would otherwise clear
  // the width a frame before the next async pass restores it, flashing the popup to full content
  // size on every unrelated update. The WeakSet keeps that release scoped to popups a previous run
  // actually sized -- an unconditional clear would trample inline sizing a different caller set
  // for its own reasons. `autoSize` needs no equivalent: the always-on `size()` below rewrites
  // both available-size properties on every pass, so a dropped `autoSize` self-corrects.
  if (sync) syncedPopups.add(popup);
  else if (syncedPopups.delete(popup)) {
    popup.style.width = '';
    popup.style.height = '';
  }
  // `flip`/`shift` default on: every caller before these options existed got them unconditionally,
  // and they are what keeps a popup inside the viewport. Only `<lr-popup>` turns them off, and
  // only because it is the low-level primitive whose whole job is to expose the raw knobs.
  // Order is load-bearing and matches what shipped before `sync`/`autoSize` existed: with both
  // omitted the array below is exactly `[offset, flip, shift, arrow?, size]`.
  const middleware = [
    offset({ mainAxis: opts.offset ?? 4, crossAxis: opts.skidding ?? 0 }),
    // Sizing to the anchor has to happen before flip/shift measure overflow, or they would each
    // reason about the pre-sync box.
    sync
      ? size({
          apply({ rects, elements }) {
            elements.floating.style.width =
              sync === 'width' || sync === 'both' ? `${rects.reference.width}px` : '';
            elements.floating.style.height =
              sync === 'height' || sync === 'both' ? `${rects.reference.height}px` : '';
          },
        })
      : undefined,
    opts.flip === false
      ? undefined
      : flip({
          boundary: opts.flipBoundary as Boundary | undefined,
          fallbackPlacements: opts.flipFallbackPlacements,
          fallbackStrategy:
            opts.flipFallbackStrategy === 'initial-placement'
              ? 'initialPlacement'
              : opts.flipFallbackStrategy === 'best-fit'
                ? 'bestFit'
                : undefined,
          padding: opts.flipPadding,
        }),
    opts.shift === false
      ? undefined
      : shift({
          boundary: opts.shiftBoundary as Boundary | undefined,
          padding: opts.shiftPadding ?? padding,
        }),
    opts.arrow ? arrow({ element: opts.arrow, padding: opts.arrowPadding ?? 0 }) : undefined,
    size({
      padding,
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
    // Runs last so it overwrites the shared measurement above, and only on the axes it names.
    autoSize
      ? size({
          boundary: opts.autoSizeBoundary as Boundary | undefined,
          padding: opts.autoSizePadding ?? 0,
          apply({ availableWidth, availableHeight, elements }) {
            if (autoSize === 'horizontal' || autoSize === 'both') {
              elements.floating.style.setProperty(
                '--lr-positioner-available-inline-size',
                `${Math.max(0, availableWidth)}px`,
              );
            }
            if (autoSize === 'vertical' || autoSize === 'both') {
              elements.floating.style.setProperty(
                '--lr-positioner-available-block-size',
                `${Math.max(0, availableHeight)}px`,
              );
            }
          },
        })
      : undefined,
  ].filter((entry) => entry !== undefined);

  const update = () =>
    computePosition(anchor, popup, {
      strategy,
      placement: opts.placement ?? 'bottom-start',
      middleware,
    }).then(({ x, y, placement, middlewareData }) => {
      popup.style.left = `${x}px`;
      popup.style.top = `${y}px`;
      // Read both rects back after the write: the hover bridge spans the rendered gap, and under
      // the `absolute` strategy `x`/`y` are offset-parent-relative while the quad is not.
      if (hoverBridge) {
        updateHoverBridge(
          hoverBridge,
          anchor.getBoundingClientRect(),
          popup.getBoundingClientRect(),
          placement,
        );
      }
      opts.onPlaced?.({ placement, arrow: middlewareData.arrow });
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
