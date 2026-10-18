import {
  computePosition,
  autoUpdate,
  getOverflowAncestors,
  arrow,
  flip,
  shift,
  offset,
  platform,
  size,
  hide,
  type Boundary,
  type Middleware,
  type MiddlewareData,
  type Placement,
  type SideObject,
} from '@floating-ui/dom';
import {
  establishesFixedContainingBlock,
  findFixedContainingBlockAncestor,
  isNativeTopLayerElement,
} from './fixed-containing-block.js';
import {
  applyReferenceHidden,
  ancestorZoom,
  compensateAncestorZoom,
  hasTopLayerAncestor,
  isLibraryPromotedAndShowing,
  needsTopLayerEscape,
  promoteToTopLayer,
  stripStaleTopLayer,
} from './top-layer-escape.js';
import {
  finiteGeometry,
  PositionerGeometryError,
  validatedClientRect,
  type VirtualAnchor,
} from './positioner-geometry.js';

export { virtualAnchorFromRect, type VirtualAnchor } from './positioner-geometry.js';
export { releaseTopLayer } from './top-layer-escape.js';

/** What `place()` reports back after each recomputation, for a caller that renders an arrow or
 *  reflects the resolved side (which `flip()` may have changed) into a part name or attribute. */
export interface PlacementResult {
  /** The placement actually used, after `flip()`/`shift()` — not necessarily the requested one. */
  placement: Placement;
  /** Arrow offsets within the popup, present only when an `arrow` element was supplied. */
  arrow?: { x?: number; y?: number };
}

/**
 * Which CSS positioning scheme the popup is laid out with. `fixed` (this library's default)
 * normally positions against the viewport, but transformed, filtered or containing ancestors can
 * establish its containing block and clipping still applies. It does not guarantee escape from
 * every ancestor: `place()` itself never promotes an element into the top layer. An element that
 * is already in the native top layer (an open `popover`, a modal `<dialog>`) is positioned against
 * the viewport. A `fixed` popup under a CSS `zoom` ancestor is positioned in zoomed coordinates,
 * so keep the popup outside the zoomed subtree. `absolute` positions against its containing block
 * and can scroll with that content; choose the strategy to match the surrounding layout.
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
  /** Shared clipping context for every overflow-aware middleware. A middleware-specific boundary
   *  below takes precedence when supplied. An empty array intentionally means viewport-only
   *  clipping because Floating UI still applies its viewport root boundary. */
  boundary?: PlaceBoundary;
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
type HoverBridgeQuad = [number, number][];
interface HoverBridgeRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
interface InlineStyleValue {
  value: string;
  priority: string;
}
interface PlacementStyleWrite {
  transaction: PlacementStyleTransactionRecord;
  element: HTMLElement;
  property: string;
  previous: InlineStyleValue;
  previousOwner?: PlacementStyleWrite;
  written: InlineStyleValue;
}
type PlacementStyleTransactionState = 'open' | 'committed' | 'rolled-back';
interface PlacementStyleTransactionRecord {
  state: PlacementStyleTransactionState;
}
interface PlacementStyleTransaction {
  set(element: HTMLElement, property: string, value: string, priority?: string): void;
  ownedValue(element: HTMLElement, property: string): InlineStyleValue | undefined;
  commit(): void;
  rollback(): void;
}
interface StagedPlacementStyles {
  availableInline?: string;
  availableBlock?: string;
}
interface PlacementRunState {
  generation: number;
  nextUpdateGeneration: number;
}
interface PlacementUpdateState {
  placementGeneration: number;
  updateGeneration: number;
}
interface SyncedPopupDimensions {
  width?: InlineStyleValue;
  height?: InlineStyleValue;
}
interface SyncedPopupOwnership extends SyncedPopupDimensions {
  placementGeneration: number;
  updateGeneration: number;
}
interface PlacementSyncOwnershipController {
  beginPlacement(popup: HTMLElement): PlacementRunState;
  beginUpdate(run: PlacementRunState): PlacementUpdateState;
  publish(
    popup: HTMLElement,
    update: PlacementUpdateState,
    dimensions: SyncedPopupDimensions,
  ): void;
  release(popup: HTMLElement, run: PlacementRunState): void;
}
const placementStyleOwners = new WeakMap<HTMLElement, Map<string, PlacementStyleWrite>>();

/**
 * Clips `bridge` to the quad spanning the anchor and the popup, so the `offset` gap between them
 * stays hoverable. Written as physical coordinates on purpose: both rects are already viewport
 * pixels, and a logical property cannot express a quad whose two edges belong to different boxes.
 */
function hoverBridgeQuad(
  anchorRect: HoverBridgeRect,
  popupRect: HoverBridgeRect,
  placement: Placement,
): HoverBridgeQuad {
  const side = placement.split('-')[0];
  const onBlockAxis = side === 'top' || side === 'bottom';
  const [first, second] = (onBlockAxis
    ? anchorRect.top < popupRect.top
    : anchorRect.left < popupRect.left)
    ? [anchorRect, popupRect] : [popupRect, anchorRect];
  return onBlockAxis
    ? [
        [first.left, first.bottom], [first.right, first.bottom],
        [second.right, second.top], [second.left, second.top],
      ]
    : [
        [first.right, first.top], [second.left, second.top],
        [second.left, second.bottom], [first.right, first.bottom],
      ];
}

function styleMapFor<T>(store: WeakMap<HTMLElement, Map<string, T>>, element: HTMLElement): Map<string, T> {
  let values = store.get(element);
  if (!values) {
    values = new Map();
    store.set(element, values);
  }
  return values;
}

function readInlineStyle(element: HTMLElement, property: string): InlineStyleValue {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function sameInlineStyle(left: InlineStyleValue, right: InlineStyleValue): boolean {
  return left.value === right.value && left.priority === right.priority;
}

function writeInlineStyle(element: HTMLElement, property: string, value: InlineStyleValue): void {
  element.style.removeProperty(property);
  if (value.value) element.style.setProperty(property, value.value, value.priority);
}

/** @internal */
export function createPlacementSyncOwnershipController(): PlacementSyncOwnershipController {
  /** Exact popup dimensions a successful `sync` update still owns, or a no-sizing tombstone. */
  const syncedDimensions = new WeakMap<HTMLElement, SyncedPopupOwnership>();
  let nextPlacementGeneration = 0;

  const isOlderThan = (
    update: PlacementUpdateState,
    current: SyncedPopupOwnership,
  ): boolean =>
    update.placementGeneration < current.placementGeneration ||
    (update.placementGeneration === current.placementGeneration &&
      update.updateGeneration < current.updateGeneration);

  return {
    beginPlacement() {
      return { generation: ++nextPlacementGeneration, nextUpdateGeneration: 0 };
    },
    beginUpdate(run) {
      return {
        placementGeneration: run.generation,
        updateGeneration: ++run.nextUpdateGeneration,
      };
    },
    publish(popup, update, dimensions) {
      const current = syncedDimensions.get(popup);
      if (current && isOlderThan(update, current)) return;
      // Keep an empty successful publication as a tombstone. Otherwise an older computation that
      // settles later could recreate sizing ownership the newer successful update superseded.
      syncedDimensions.set(popup, {
        ...dimensions,
        placementGeneration: update.placementGeneration,
        updateGeneration: update.updateGeneration,
      });
    },
    release(popup, run) {
      const dimensions = syncedDimensions.get(popup);
      if (dimensions && dimensions.placementGeneration > run.generation) return;
      for (const dimension of ['width', 'height'] as const) {
        const owned = dimensions?.[dimension];
        if (owned && sameInlineStyle(readInlineStyle(popup, dimension), owned)) {
          writeInlineStyle(popup, dimension, { value: '', priority: '' });
        }
      }
      // An unsynced placement is itself a successful ownership decision. Its tombstone prevents
      // any later update from an older still-live placement from reintroducing a stale marker.
      syncedDimensions.set(popup, {
        placementGeneration: run.generation,
        updateGeneration: Number.MAX_SAFE_INTEGER,
      });
    },
  };
}

const placementSyncOwnership = createPlacementSyncOwnershipController();

/** @internal */
export function createPlacementStyleTransaction(): PlacementStyleTransaction {
  const writes: PlacementStyleWrite[] = [];
  const transaction: PlacementStyleTransactionRecord = { state: 'open' };

  return {
    set(element, property, value, priority = '') {
      if (transaction.state !== 'open') return;
      const owners = styleMapFor(placementStyleOwners, element);
      // Record every write with a distinct owner identity. Another placement transaction or
      // consumer can intervene between two writes from this transaction; reusing the first
      // predecessor would then roll back across that newer value. The reverse journal walk
      // naturally collapses uninterrupted writes from one transaction back to their baseline.
      const previous = readInlineStyle(element, property);
      const currentOwner = owners.get(property);
      const write: PlacementStyleWrite = {
        transaction,
        element,
        property,
        previous,
        // CSSOM does not expose setter provenance. Retain the recorded owner only while its last
        // write still matches the observable value+priority; a distinct external write severs the
        // ownership chain and becomes this generation's rollback baseline.
        previousOwner:
          currentOwner && sameInlineStyle(previous, currentOwner.written)
            ? currentOwner
            : undefined,
        written: previous,
      };
      writes.push(write);
      writeInlineStyle(element, property, { value, priority });
      write.written = readInlineStyle(element, property);
      owners.set(property, write);
    },
    ownedValue(element, property) {
      if (transaction.state !== 'open') return undefined;
      const owner = placementStyleOwners.get(element)?.get(property);
      if (owner?.transaction !== transaction) return undefined;
      const current = readInlineStyle(element, property);
      return sameInlineStyle(current, owner.written) ? current : undefined;
    },
    commit() {
      if (transaction.state !== 'open') return;
      transaction.state = 'committed';
      for (const write of writes) {
        const owners = placementStyleOwners.get(write.element);
        if (
          owners?.get(write.property) === write
        ) {
          owners.delete(write.property);
        }
      }
      writes.length = 0;
    },
    rollback() {
      if (transaction.state !== 'open') return;
      transaction.state = 'rolled-back';
      for (const write of writes.reverse()) {
        const owners = placementStyleOwners.get(write.element);
        if (
          owners?.get(write.property) !== write
        ) {
          continue;
        }
        // CSSOM exposes value and priority, but not setter provenance. Observable external
        // changes are preserved; an exact no-op setter is indistinguishable from no mutation.
        if (!sameInlineStyle(readInlineStyle(write.element, write.property), write.written)) {
          owners.delete(write.property);
          continue;
        }
        let previous = write.previous;
        let previousOwner = write.previousOwner;
        while (previousOwner?.transaction.state === 'rolled-back') {
          previous = previousOwner.previous;
          previousOwner = previousOwner.previousOwner;
        }
        writeInlineStyle(write.element, write.property, previous);
        if (previousOwner?.transaction.state === 'open') owners.set(write.property, previousOwner);
        else owners.delete(write.property);
      }
      writes.length = 0;
    },
  };
}

function writeHoverBridge(
  bridge: HTMLElement,
  quad: HoverBridgeQuad,
  styleTransaction: PlacementStyleTransaction,
): void {
  HOVER_BRIDGE_CORNERS.forEach((corner, index) => {
    const [x, y] = quad[index] as [number, number];
    styleTransaction.set(bridge, `--lr-positioner-hover-bridge-${corner}-x`, `${x}px`);
    styleTransaction.set(bridge, `--lr-positioner-hover-bridge-${corner}-y`, `${y}px`);
  });
}

/**
 * Corrects fixed containing-block detection and absolute containing blocks hidden from native
 * `offsetParent` by shadow boundaries or ancestor zoom. Other platform geometry remains native
 * except for the measured inline coordinate system installed for each placement pass.
 */
async function correctedGetOffsetParent(
  element: Element,
  polyfill?: (element: HTMLElement) => Element | null,
): Promise<Element | Window> {
  const defaultOffsetParent = await platform.getOffsetParent(element, polyfill);
  if (!(element instanceof HTMLElement)) return defaultOffsetParent;
  const view = element.ownerDocument.defaultView;
  if (!view) return defaultOffsetParent;
  // Native top-layer elements are positioned against the viewport even though their DOM ancestor
  // chain remains unchanged. In particular, a manual popover nested in a transformed virtual row
  // must not inherit that row as the fixed-position containing block.
  if (isNativeTopLayerElement(element)) return view;
  const position = view.getComputedStyle(element).position;
  // Native offsetParent can skip a positioned ancestor in another shadow root. Its viewport
  // fallback then double-adds that ancestor's offset when the browser applies absolute insets.
  // Walk the rendered ancestry (including assigned slots) to use the actual containing block.
  if (position === 'absolute') {
    return findFixedContainingBlockAncestor(element, true) ??
      (Math.abs(ancestorZoom(element) - 1) > 1e-6 ? view : defaultOffsetParent);
  }
  if (position !== 'fixed') return defaultOffsetParent;
  // Floating UI can skip a nearer filtered inline in WebKit and return an outer transformed
  // block. Resolve the rendered ancestry first so both measurements and insets use the nearest
  // effective containing block, including across slots and shadow roots.
  const nearestContainingBlock = findFixedContainingBlockAncestor(element);
  if (nearestContainingBlock) return nearestContainingBlock;
  // Retain a valid platform fallback outside the ancestry walk, such as the document body.
  if (defaultOffsetParent instanceof Element && establishesFixedContainingBlock(defaultOffsetParent)) {
    return defaultOffsetParent;
  }
  return view;
}

/** Measures fixed containing-block coordinates without touching the popup's own transform.
 * Inline font-box metrics cannot reliably distinguish effective scale from rounding. */
function fixedInlineCoordinates(containingBlock: HTMLElement): {
  origin: { left: number; top: number };
  scale: { x: number; y: number };
} | undefined {
  const probe = containingBlock.ownerDocument.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'all:initial!important;position:fixed!important;left:0!important;top:0!important;width:0!important;height:0!important;visibility:hidden!important';
  try {
    (containingBlock.shadowRoot ?? containingBlock).appendChild(probe);
    if (probe.getClientRects().length === 0) return undefined;
    const origin = validatedClientRect(probe.getBoundingClientRect(), 'place() fixed origin');
    // A fixed box has definite dimensions, unlike the inline's font box. Its viewport size
    // includes real ancestor transforms and zoom. Preserve the zero-size origin above.
    probe.style.setProperty('width', '100px', 'important');
    probe.style.setProperty('height', '100px', 'important');
    const size = validatedClientRect(probe.getBoundingClientRect(), 'place() fixed scale');
    const scale = { x: size.width / 100, y: size.height / 100 };
    return scale.x > 0 && scale.y > 0 ? { origin, scale } : undefined;
  } finally {
    probe.remove();
  }
}

async function popupRectAtPosition(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  strategy: PlaceStrategy,
  x: number,
  y: number,
  placementPlatform = platform,
): Promise<HoverBridgeRect> {
  const currentRect = validatedClientRect(popup.getBoundingClientRect(), 'place() popup rect');
  const offsetParent = await correctedGetOffsetParent(popup);
  const rect = await placementPlatform.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements: { reference: anchor, floating: popup },
    // Convert only the local origin: the measured popup dimensions are already in viewport units.
    rect: { x, y, width: 0, height: 0 },
    offsetParent: offsetParent as Element,
    strategy,
  });
  const { x: left, y: top } = rect;
  const { width, height } = currentRect;
  // Preserve raw numeric values rather than constructing a DOMRect, whose coercions could turn
  // invalid platform values into accepted numbers. The shared guard also checks edge overflow.
  return validatedClientRect({
    x: left, y: top, width, height, left, top, right: left + width, bottom: top + height,
  } as DOMRect, 'place() converted popup rect');
}

function validatePlaceNumericOptions(opts: PlaceOptions): void {
  // `offset` and `skidding` are signed; every padding after them must also be nonnegative.
  (
    [
      'offset',
      'skidding',
      'flipPadding',
      'shiftPadding',
      'padding',
      'autoSizePadding',
      'arrowPadding',
    ] as const
  ).forEach((name, index) => {
    const value = opts[name];
    if (value !== undefined) finiteGeometry(value, `place() ${name}`, index > 1);
  });
}

function validateAnchorBeforeSetup(anchor: Element | VirtualAnchor): void {
  try {
    validatedClientRect(anchor.getBoundingClientRect(), 'place() anchor rect');
  } catch (error) {
    // A hostile getter/revoked proxy already follows the established async fail-closed path once
    // Floating UI begins. Only a rect that was actually returned with invalid numeric geometry is
    // a synchronous caller contract error.
    if (error instanceof PositionerGeometryError) throw error;
  }
}

/**
 * Position `popup` relative to `anchor` with flip/shift, keeping it updated on scroll/resize.
 * Returns a cleanup function that stops updating. Re-calling `place()` on the same popup with
 * different options is the supported way to change them: each call re-establishes every write it
 * owns, so no run inherits the previous one's sizing. Throws `RangeError` before observers,
 * callbacks, or style writes when an input rect or numeric option is non-finite, or when a rect
 * dimension/padding is negative; signed finite `offset` and `skidding` remain supported.
 */
export function place(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  opts: PlaceOptions = {},
): () => void {
  return placeImpl(anchor, popup, opts);
}

/** Library-internal hooks `placeAnchoredSurface()` threads through one placement run. Public
 *  `place()` never passes them, so `PlaceOptions` stays unchanged. */
interface PlacementEscapeHooks {
  /** Before every computation. */
  beforeCompute(): void;
  /** Extra middleware appended after the public chain. */
  middleware: Middleware[];
  /** After every computation, with the offset parent the (corrected) platform resolved for the
   *  popup and that pass's middleware data. Returning true rolls this pass back and runs the
   *  update once more. */
  afterResolve(offsetParent: Element | Window, data: MiddlewareData): boolean;
}

/** Consecutive roll-back-and-rerun passes one run may take before it commits regardless. */
const MAX_ESCAPE_RERUNS = 2;

function placeImpl(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  opts: PlaceOptions,
  hooks?: PlacementEscapeHooks,
): () => void {
  // Reject hostile JS inputs before claiming placement ownership, touching inline styles, adding
  // observers, or scheduling a callback. A valid virtual anchor can later become invalid, so each
  // update repeats the rect preflight below and disposes without committing partial coordinates.
  validatePlaceNumericOptions(opts);
  validateAnchorBeforeSetup(anchor);
  // A placement computation may finish out of order after a visual-viewport or observer update,
  // and an older `place()` call can likewise still be settling while its replacement starts.
  // Style generations keep those computations from overwriting each other; placement/update
  // generations apply the same rule to the separate successful-sync release marker.
  const placementRun = placementSyncOwnership.beginPlacement(popup);
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
  let disposed = false;
  let escapeReruns = 0;
  let stopAutoUpdate: (() => void) | undefined;
  let stopResize: (() => void) | undefined;
  let stopScroll: (() => void) | undefined;
  let scrollFrame: number | undefined;
  let updateGeneration = 0;
  const openStyleTransactions = new Set<PlacementStyleTransaction>();
  const view = popup.ownerDocument.defaultView ?? window;
  const visualViewport = view.visualViewport;
  const updateFromVisualViewport = () => update();
  const cancelScrollFrame = (): void => {
    if (scrollFrame === undefined) return;
    view.cancelAnimationFrame(scrollFrame);
    scrollFrame = undefined;
  };
  const updateFromScroll = (): void => {
    if (disposed) return;
    // Invalidate promises immediately, even while the replacement waits for a frame.
    updateGeneration++;
    if (scrollFrame !== undefined) return;
    scrollFrame = view.requestAnimationFrame(() => {
      scrollFrame = undefined;
      update();
    });
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    updateGeneration++;
    cancelScrollFrame();
    stopScroll?.();
    stopResize?.();
    stopAutoUpdate?.();
    stopAutoUpdate = undefined;
    visualViewport?.removeEventListener('resize', updateFromVisualViewport);
    for (const transaction of [...openStyleTransactions].reverse()) transaction.rollback();
    openStyleTransactions.clear();
  };

  // `sync` is the only option here that writes inline sizing nothing else rewrites, so dropping it
  // has to release that sizing. Released on *setup* rather than in the returned cleanup: a caller
  // that re-`place()`s on every property change (which `<lr-popup>` does) would otherwise clear
  // the width a frame before the next async pass restores it, flashing the popup to full content
  // size on every unrelated update. The ownership snapshot keeps that release scoped to the exact
  // values a successful previous run actually sized. A failed/rolled-back run owns nothing, and a
  // later consumer write is preserved rather than being cleared merely because an older sync run
  // succeeded. `autoSize` needs no equivalent: the always-on `size()` below rewrites
  // both available-size properties on every pass, so a dropped `autoSize` self-corrects.
  if (!sync) {
    placementSyncOwnership.release(popup, placementRun);
  }
  // `flip`/`shift` default on: every caller before these options existed got them unconditionally,
  // and they are what keeps a popup inside the viewport. Only `<lr-popup>` turns them off, and
  // only because it is the low-level primitive whose whole job is to expose the raw knobs.
  // Order is load-bearing and matches what shipped before `sync`/`autoSize` existed: with both
  // omitted the array below is exactly `[offset, flip, shift, arrow?, size]`.
  const middlewareFor = (
    styleTransaction: PlacementStyleTransaction,
    stagedStyles: StagedPlacementStyles,
    isCurrent: () => boolean,
  ) =>
    [
      offset({ mainAxis: opts.offset ?? 4, crossAxis: opts.skidding ?? 0 }),
      // Sizing to the anchor has to happen before flip/shift measure overflow, or they would each
      // reason about the pre-sync box.
      sync
        ? size({
            apply({ rects, elements }) {
              if (!isCurrent()) return;
              const referenceWidth = finiteGeometry(
                rects.reference.width,
                'place() reference width',
                true,
              );
              const referenceHeight = finiteGeometry(
                rects.reference.height,
                'place() reference height',
                true,
              );
              styleTransaction.set(
                elements.floating,
                'width',
                sync === 'width' || sync === 'both' ? `${referenceWidth}px` : '',
              );
              styleTransaction.set(
                elements.floating,
                'height',
                sync === 'height' || sync === 'both' ? `${referenceHeight}px` : '',
              );
            },
          })
        : undefined,
      opts.flip === false
        ? undefined
        : flip({
            boundary: (opts.flipBoundary ?? opts.boundary) as Boundary | undefined,
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
            boundary: (opts.shiftBoundary ?? opts.boundary) as Boundary | undefined,
            padding: opts.shiftPadding ?? padding,
          }),
      opts.arrow ? arrow({ element: opts.arrow, padding: opts.arrowPadding ?? 0 }) : undefined,
      size({
        boundary: opts.boundary as Boundary | undefined,
        padding,
        apply({ availableWidth, availableHeight }) {
          if (!isCurrent()) return;
          // Available-size variables do not affect middleware measurement, so keep them off the
          // live element until every later geometry read has succeeded. Synced dimensions cannot
          // be staged because flip and shift must measure the resized box; those writes stay in
          // the rollback journal above.
          stagedStyles.availableInline = `${Math.max(0, finiteGeometry(availableWidth, 'place() available width'))}px`;
          stagedStyles.availableBlock = `${Math.max(0, finiteGeometry(availableHeight, 'place() available height'))}px`;
        },
      }),
      // Runs last so it overwrites the shared measurement above, and only on the axes it names.
      autoSize
        ? size({
            boundary: (opts.autoSizeBoundary ?? opts.boundary) as Boundary | undefined,
            padding: opts.autoSizePadding ?? 0,
            apply({ availableWidth, availableHeight }) {
              if (!isCurrent()) return;
              if (autoSize === 'horizontal' || autoSize === 'both') {
                stagedStyles.availableInline = `${Math.max(0, finiteGeometry(availableWidth, 'place() auto-size available width'))}px`;
              }
              if (autoSize === 'vertical' || autoSize === 'both') {
                stagedStyles.availableBlock = `${Math.max(0, finiteGeometry(availableHeight, 'place() auto-size available height'))}px`;
              }
            },
          })
        : undefined,
      ...(hooks?.middleware ?? []),
    ].filter((entry) => entry !== undefined);

  function update(): void {
    if (disposed) return;
    cancelScrollFrame();
    const generation = ++updateGeneration;
    const isCurrent = () => !disposed && generation === updateGeneration;
    try {
      validatedClientRect(anchor.getBoundingClientRect(), 'place() anchor rect');
    } catch {
      dispose();
      return;
    }
    try {
      hooks?.beforeCompute();
    } catch {
      // The escape is best-effort; a failure leaves the surface on the ordinary fixed path.
    }
    const updateRun = placementSyncOwnership.beginUpdate(placementRun);
    const styleTransaction = createPlacementStyleTransaction();
    const stagedStyles: StagedPlacementStyles = {};
    openStyleTransactions.add(styleTransaction);
    const rollback = () => {
      styleTransaction.rollback();
      openStyleTransactions.delete(styleTransaction);
    };
    let resolvedOffsetParent: Element | Window | undefined;
    // Element rects and every overflow-detecting middleware (flip, shift, size, hide, arrow) ask
    // for the same element's offset parent; one pass walks each element's ancestry once.
    const offsetParents = new Map<Element, Promise<Element | Window>>();
    const recordingGetOffsetParent: typeof correctedGetOffsetParent = async (element, polyfill) => {
      let pending = polyfill ? undefined : offsetParents.get(element);
      if (!pending) {
        pending = correctedGetOffsetParent(element, polyfill);
        if (!polyfill) offsetParents.set(element, pending);
      }
      const result = await pending;
      if (element === popup) resolvedOffsetParent = result;
      return result;
    };
    let inlineCoordinates: ReturnType<typeof fixedInlineCoordinates>;
    let inlineOffsetParent: HTMLElement | undefined;
    const placementPlatform: typeof platform = {
      ...platform,
      getOffsetParent: recordingGetOffsetParent,
      async getElementRects(data) {
        const rects = await platform.getElementRects.call(this, data);
        const parent = resolvedOffsetParent;
        // Inline font-box metrics can invent scale, including under ancestor zoom. Measure
        // their actual fixed origin and scale before dimension-dependent middleware.
        const calibrate = strategy === 'fixed' && parent instanceof HTMLElement &&
          !(parent instanceof HTMLSlotElement) &&
          getComputedStyle(parent).display === 'inline' &&
          // A popup's own zoom also scales its insets; it is outside this parent-coordinate fix.
          ['', 'normal', '1'].includes(getComputedStyle(popup).zoom || '');
        inlineCoordinates = calibrate ? fixedInlineCoordinates(parent) : undefined;
        inlineOffsetParent = inlineCoordinates ? parent as HTMLElement : undefined;
        if (!inlineCoordinates || !inlineOffsetParent) return rects;
        const viewport = await platform.convertOffsetParentRelativeRectToViewportRelativeRect({
          elements: { reference: data.reference, floating: data.floating },
          rect: rects.reference, offsetParent: inlineOffsetParent, strategy,
        });
        const { origin, scale } = inlineCoordinates;
        return { ...rects, reference: {
          x: finiteGeometry((viewport.x - origin.left) / scale.x, 'place() inline reference x'),
          y: finiteGeometry((viewport.y - origin.top) / scale.y, 'place() inline reference y'),
          width: finiteGeometry(viewport.width / scale.x, 'place() inline reference width'),
          height: finiteGeometry(viewport.height / scale.y, 'place() inline reference height'),
        } };
      },
      getScale(element) {
        return inlineCoordinates && element === inlineOffsetParent
          ? inlineCoordinates.scale : platform.getScale!(element);
      },
      convertOffsetParentRelativeRectToViewportRelativeRect(data) {
        if (inlineCoordinates && data.offsetParent === inlineOffsetParent && data.strategy === 'fixed') {
          const { origin, scale } = inlineCoordinates;
          return {
            x: origin.left + data.rect.x * scale.x, y: origin.top + data.rect.y * scale.y,
            width: data.rect.width * scale.x, height: data.rect.height * scale.y,
          };
        }
        return platform.convertOffsetParentRelativeRectToViewportRelativeRect(data);
      },
    };
    void computePosition(anchor, popup, {
      strategy,
      placement: opts.placement ?? 'bottom-start',
      middleware: middlewareFor(styleTransaction, stagedStyles, isCurrent),
      // Use the same containing-block coordinates for middleware and the eventual inset writes.
      platform: placementPlatform,
    }).then(
      async ({ x, y, placement, middlewareData }) => {
        if (!isCurrent()) {
          rollback();
          return;
        }
        let bridgeQuad: HoverBridgeQuad | undefined;
        try {
          finiteGeometry(x, 'place() resolved x');
          finiteGeometry(y, 'place() resolved y');
          if (middlewareData.arrow?.x !== undefined) {
            finiteGeometry(middlewareData.arrow.x, 'place() resolved arrow x');
          }
          if (middlewareData.arrow?.y !== undefined) {
            finiteGeometry(middlewareData.arrow.y, 'place() resolved arrow y');
          }
          if (hooks && escapeReruns < MAX_ESCAPE_RERUNS) {
            const view = popup.ownerDocument.defaultView ?? window;
            let rerun = false;
            try {
              rerun = hooks.afterResolve(resolvedOffsetParent ?? view, middlewareData);
            } catch {
              rerun = false;
            }
            if (rerun) {
              escapeReruns++;
              rollback();
              update();
              return;
            }
          }
          escapeReruns = 0;
          if (hoverBridge) {
            const anchorRect = validatedClientRect(
              anchor.getBoundingClientRect(),
              'place() anchor rect',
            );
            const placedPopupRect = await popupRectAtPosition(
              anchor,
              popup,
              strategy,
              x,
              y,
              placementPlatform,
            );
            if (!isCurrent()) {
              rollback();
              return;
            }
            bridgeQuad = hoverBridgeQuad(anchorRect, placedPopupRect, placement);
          }
          if (!isCurrent()) {
            rollback();
            return;
          }
          if (stagedStyles.availableInline !== undefined) {
            styleTransaction.set(
              popup,
              '--lr-positioner-available-inline-size',
              stagedStyles.availableInline,
            );
          }
          if (stagedStyles.availableBlock !== undefined) {
            styleTransaction.set(
              popup,
              '--lr-positioner-available-block-size',
              stagedStyles.availableBlock,
            );
          }
          styleTransaction.set(popup, 'left', `${finiteGeometry(x, 'place() resolved x')}px`);
          styleTransaction.set(popup, 'top', `${finiteGeometry(y, 'place() resolved y')}px`);
          if (hoverBridge && bridgeQuad) writeHoverBridge(hoverBridge, bridgeQuad, styleTransaction);
          const ownedSyncDimensions = sync
            ? {
                width: styleTransaction.ownedValue(popup, 'width'),
                height: styleTransaction.ownedValue(popup, 'height'),
              }
            : undefined;
          styleTransaction.commit();
          openStyleTransactions.delete(styleTransaction);
          if (sync) {
            // A distinct external or newer placement write may have won before commit. Publishing
            // an empty marker advances the successful-update generation without claiming sizing;
            // an older completion can therefore neither erase nor relabel newer ownership.
            placementSyncOwnership.publish(
              popup,
              updateRun,
              ownedSyncDimensions ?? {},
            );
          }
        } catch {
          if (isCurrent()) dispose();
          else rollback();
          return;
        }
        // Consumer callbacks deliberately sit outside the internal failure boundary. A callback
        // exception remains observable to its caller instead of being mistaken for positioning
        // failure and silently suppressed.
        opts.onPlaced?.({ placement, arrow: middlewareData.arrow });
      },
      () => {
        if (isCurrent()) dispose();
        else rollback();
      },
    );
  }

  const reference = (anchor as Element).nodeType === 1
    ? anchor as Element
    : (anchor as VirtualAnchor).contextElement;
  const scrollTargets = new Set<EventTarget>([
    ...(reference ? getOverflowAncestors(reference) : []),
    ...getOverflowAncestors(popup),
    ...(visualViewport ? [visualViewport] : []),
  ]);
  for (const target of scrollTargets) {
    target.addEventListener('scroll', updateFromScroll, { passive: true });
    // Run before autoUpdate's resize listener: real resizes retain immediate placement even
    // when a scroll is pending, while its scroll-induced layout observer delivery is coalesced.
    target.addEventListener('resize', cancelScrollFrame);
  }
  stopScroll = () => {
    for (const target of scrollTargets) {
      target.removeEventListener('scroll', updateFromScroll);
      target.removeEventListener('resize', cancelScrollFrame);
    }
  };

  // Size middleware may resize an observed surface. Updating inside resize delivery would
  // invalidate another observation at the same depth; defer only that source to the next frame.
  // Initial placement, ancestor resize and layout shifts retain immediate publication. Scroll
  // listeners are separate because autoUpdate's public callback does not identify its source.
  const stop = autoUpdate(anchor, popup, () => {
    if (scrollFrame === undefined) update();
  }, { elementResize: false, ancestorScroll: false });
  // autoUpdate publishes synchronously, and that update can reject a now-invalid virtual rect.
  if (disposed) {
    stop();
    return dispose;
  }
  stopAutoUpdate = stop;
  stopResize = observeElementResize(anchor, popup, update);
  // The visual viewport changes independently of the layout viewport when a
  // mobile on-screen keyboard opens or closes. Floating UI's normal window
  // resize listener does not receive those events, so keep the available-size
  // CSS variables and fixed coordinates in sync with the visual viewport too.
  // Read from `popup` rather than `anchor` -- a VirtualAnchor has no `ownerDocument` of its own,
  // and `popup` is always a real element in the same document a real `anchor` would be anyway.
  visualViewport?.addEventListener('resize', updateFromVisualViewport);

  return dispose;
}

function isWindowLike(value: Element | Window): value is Window {
  return !(value instanceof Element);
}

/** {@link placeAnchoredSurface} options: the public `PlaceOptions` plus the library-internal
 *  top-layer switch, which public `place()` does not accept. */
export interface AnchoredSurfaceOptions extends PlaceOptions {
  /** Promote a `fixed` popup (and its hover bridge) into the browser top layer whether or not an
   *  ancestor traps it. A surface stacked beneath a sibling only because an ancestor is a plain
   *  stacking context (a `z-index`ed fixed header) is not trapped, so the automatic escape leaves
   *  it alone; this is the explicit opt-in for that case. The caller also passes the `fixed`
   *  strategy: an `absolute` popup is never promoted. Like every promotion, it lasts until the
   *  popup settles with `[hidden]` or `releaseTopLayer()` is called. */
  topLayer?: boolean;
}

/**
 * Library-internal `place()` for anchored surfaces: identical geometry, plus the top-layer escape
 * (`top-layer-escape.ts`). A `fixed` popup whose containing block is an ancestor -- a transformed
 * virtual-list row, a filtered card, a `contain`ed panel -- is shown in the browser top layer
 * where the native Popover API exists, re-tested on every update, so it lays out against the
 * viewport and no ancestor clips it; `topLayer` promotes it unconditionally. The hover bridge,
 * which is `position: fixed` whatever the popup strategy, is judged on its own. Both are
 * compensated for an ancestor CSS `zoom` (an `absolute` popup only for the zoom between its offset
 * parent and itself), and a promoted popup whose reference scrolls out of view is hidden until it
 * returns. Disposing a run never demotes: a promotion lasts until the popup settles with
 * `[hidden]` or `releaseTopLayer()` is called.
 * `src/utilities/positioner.ts` does not re-export this.
 * @internal
 */
export function placeAnchoredSurface(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  opts: AnchoredSurfaceOptions = {},
): () => void {
  // Validate before any escape write, exactly like place() itself.
  validatePlaceNumericOptions(opts);
  validateAnchorBeforeSetup(anchor);
  const bridge = opts.hoverBridge;
  const fixed = (opts.strategy ?? 'fixed') === 'fixed';
  const escape = (element: HTMLElement, eligible: boolean): void => {
    if (isLibraryPromotedAndShowing(element)) return;
    if (eligible && (opts.topLayer || needsTopLayerEscape(element))) promoteToTopLayer(element, popup);
    else stripStaleTopLayer(element);
  };
  const referenceHidden = hide({ strategy: 'referenceHidden' });
  const referenceElement =
    anchor instanceof Element
      ? anchor
      : ((anchor as { contextElement?: Element }).contextElement ?? null);
  // Only a reference whose clipping ancestors Floating UI can measure truthfully: one inside
  // another top-layer surface (a submenu's parent item) is not clipped by the scrollers beyond it.
  const referenceMeasurable = (): boolean =>
    referenceElement !== null && !hasTopLayerAncestor(referenceElement);
  // Shown first, so the bridge stacks under the popup.
  if (bridge) escape(bridge, true);
  escape(popup, fixed);
  return placeImpl(anchor, popup, opts, {
    beforeCompute() {
      if (bridge) escape(bridge, true);
      if (fixed) compensateAncestorZoom(popup, null);
      if (bridge) compensateAncestorZoom(bridge, null, popup);
    },
    middleware: [
      {
        name: referenceHidden.name,
        options: referenceHidden.options,
        // A fixed surface -- promoted to the top layer or positioned against the viewport -- is not
        // clipped by the scrollers that clip its reference, so it is hidden while that reference
        // is scrolled out of view. An absolute surface is clipped with its reference already.
        fn: async (state) => {
          if (!fixed || !referenceMeasurable()) return {};
          const result = await referenceHidden.fn(state);
          const offsets = result.data?.['referenceHiddenOffsets'] as SideObject | undefined;
          const { width, height } = state.rects.reference;
          if (!offsets || (width > 0 && height > 0)) return result;
          // A point reference (a pointer or keyboard context-menu position) resting exactly on a
          // clipping edge reads as fully clipped; only a point strictly outside is hidden.
          return {
            data: {
              ...result.data,
              referenceHidden: offsets.top > 0 || offsets.right > 0 || offsets.bottom > 0 || offsets.left > 0,
            },
          };
        },
      },
    ],
    afterResolve(offsetParent, data) {
      applyReferenceHidden(popup, data.hide?.referenceHidden === true);
      if (!fixed) {
        return compensateAncestorZoom(popup, isWindowLike(offsetParent) ? null : offsetParent);
      }
      if (isWindowLike(offsetParent) || isLibraryPromotedAndShowing(popup)) return false;
      // A trap that appeared while open (a hover-lift transform, an animation wrapper): promote,
      // roll this pass back and re-run it once against top-layer geometry.
      return promoteToTopLayer(popup);
    },
  });
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
 * before returning (through `autoUpdate()`'s own initial publication) so the first paint doesn't
 * wait for a scroll/resize tick.
 */
export function trackRect(target: HTMLElement, onUpdate: (rect: DOMRect) => void): () => void {
  const update = () => onUpdate(target.getBoundingClientRect());
  const stopAutoUpdate = autoUpdate(target, target, update);
  const visualViewport = target.ownerDocument.defaultView?.visualViewport;
  const onVisualViewportChange = () => update();
  visualViewport?.addEventListener('resize', onVisualViewportChange);
  visualViewport?.addEventListener('scroll', onVisualViewportChange);
  return () => {
    stopAutoUpdate();
    visualViewport?.removeEventListener('resize', onVisualViewportChange);
    visualViewport?.removeEventListener('scroll', onVisualViewportChange);
  };
}

function observeElementResize(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  update: () => void,
): () => void {
  const view = popup.ownerDocument.defaultView;
  let active = true;
  let frame: number | undefined;
  const observer = view?.ResizeObserver ? new view.ResizeObserver(() => {
    if (!active || frame !== undefined) return;
    frame = view.requestAnimationFrame(() => {
      frame = undefined;
      if (active) update();
    });
  }) : undefined;
  const reference = (anchor as Element).nodeType === 1
    ? anchor as Element
    : (anchor as VirtualAnchor).contextElement;
  if (reference) observer?.observe(reference);
  observer?.observe(popup);
  return () => {
    active = false;
    observer?.disconnect();
    if (frame !== undefined) view?.cancelAnimationFrame(frame);
  };
}
