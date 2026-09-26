import {
  computePosition,
  autoUpdate,
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
} from '@floating-ui/dom';
import {
  establishesFixedContainingBlock,
  findFixedContainingBlockAncestor,
  fixedContainingBlockParentNode,
  isLastTraversableFixedContainingBlockNode,
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
  element: HTMLElement;
  property: string;
  previous: InlineStyleValue;
  previousOwner?: PlacementStyleWriteOwner;
  written: InlineStyleValue;
  owner?: PlacementStyleWriteOwner;
}
type PlacementStyleTransactionState = 'open' | 'committed' | 'rolled-back';
interface PlacementStyleTransactionRecord {
  state: PlacementStyleTransactionState;
}
interface PlacementStyleWriteOwner {
  generation: number;
  transaction: PlacementStyleTransactionRecord;
  write: PlacementStyleWrite;
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
const placementStyleOwners = new WeakMap<HTMLElement, Map<string, PlacementStyleWriteOwner>>();
let placementStyleGeneration = 0;

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
  let quad: HoverBridgeQuad;
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
  return quad;
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
      if (dimensions?.width && sameInlineStyle(readInlineStyle(popup, 'width'), dimensions.width)) {
        writeInlineStyle(popup, 'width', { value: '', priority: '' });
      }
      if (
        dimensions?.height &&
        sameInlineStyle(readInlineStyle(popup, 'height'), dimensions.height)
      ) {
        writeInlineStyle(popup, 'height', { value: '', priority: '' });
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
  const lastWrites = new WeakMap<HTMLElement, Map<string, PlacementStyleWrite>>();
  const transaction: PlacementStyleTransactionRecord = { state: 'open' };

  return {
    set(element, property, value, priority = '') {
      if (transaction.state !== 'open') return;
      let owners = placementStyleOwners.get(element);
      if (!owners) {
        owners = new Map();
        placementStyleOwners.set(element, owners);
      }
      // Record every write as a distinct ownership generation. Another placement transaction or
      // consumer can intervene between two writes from this transaction; reusing the first
      // predecessor would then roll back across that newer value. The reverse journal walk
      // naturally collapses uninterrupted writes from one transaction back to their baseline.
      const previous = readInlineStyle(element, property);
      const currentOwner = owners.get(property);
      const write: PlacementStyleWrite = {
        element,
        property,
        previous,
        // CSSOM does not expose setter provenance. Retain the recorded owner only while its last
        // write still matches the observable value+priority; a distinct external write severs the
        // ownership chain and becomes this generation's rollback baseline.
        previousOwner:
          currentOwner && sameInlineStyle(previous, currentOwner.write.written)
            ? currentOwner
            : undefined,
        written: previous,
      };
      writes.push(write);
      writeInlineStyle(element, property, { value, priority });
      write.written = readInlineStyle(element, property);
      write.owner = {
        generation: ++placementStyleGeneration,
        transaction,
        write,
      };
      owners.set(property, write.owner);
      let elementWrites = lastWrites.get(element);
      if (!elementWrites) {
        elementWrites = new Map();
        lastWrites.set(element, elementWrites);
      }
      elementWrites.set(property, write);
    },
    ownedValue(element, property) {
      if (transaction.state !== 'open') return undefined;
      const write = lastWrites.get(element)?.get(property);
      const owner = placementStyleOwners.get(element)?.get(property);
      if (!write?.owner || owner?.generation !== write.owner.generation) return undefined;
      const current = readInlineStyle(element, property);
      return sameInlineStyle(current, write.written) ? current : undefined;
    },
    commit() {
      if (transaction.state !== 'open') return;
      transaction.state = 'committed';
      for (const write of writes) {
        const owners = placementStyleOwners.get(write.element);
        if (
          write.owner &&
          owners?.get(write.property)?.generation === write.owner.generation
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
          !write.owner ||
          owners?.get(write.property)?.generation !== write.owner.generation
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
          previous = previousOwner.write.previous;
          previousOwner = previousOwner.write.previousOwner;
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
 * Overrides only `@floating-ui/dom`'s default `platform.getOffsetParent` -- merged over every
 * other default platform method wherever it is passed as `{ ...platform, getOffsetParent:
 * correctedGetOffsetParent }` -- to correct the WebKit blind spot described in
 * `fixed-containing-block.ts`. Only intervenes when the
 * default implementation already fell all the way back to the window AND the element being
 * positioned is itself `position: fixed` (exactly the path a hoisted `place()` popup takes):
 * every other case (a real offset parent, an `absolute`-strategy popup, an SVG or top-layer
 * element) keeps upstream's answer completely unchanged.
 */
async function correctedGetOffsetParent(
  element: Element,
  polyfill?: (element: HTMLElement) => Element | null,
): Promise<Element | Window> {
  return correctOffsetParent(element, await platform.getOffsetParent(element, polyfill));
}

function correctOffsetParent(
  element: Element,
  defaultOffsetParent: Element | Window,
): Element | Window {
  if (!(element instanceof HTMLElement)) return defaultOffsetParent;
  const view = element.ownerDocument.defaultView;
  if (!view) return defaultOffsetParent;
  // Native top-layer elements are positioned against the viewport even though their DOM ancestor
  // chain remains unchanged. In particular, a manual popover nested in a transformed virtual row
  // must not inherit that row as the fixed-position containing block.
  if (isNativeTopLayerElement(element)) return view;
  if (defaultOffsetParent !== view) return defaultOffsetParent;
  if (view.getComputedStyle(element).position !== 'fixed') return defaultOffsetParent;
  return findFixedContainingBlockAncestor(element) ?? defaultOffsetParent;
}

async function popupRectAtPosition(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  strategy: PlaceStrategy,
  x: number,
  y: number,
  currentRect: DOMRect,
): Promise<HoverBridgeRect> {
  const offsetParent = await correctedGetOffsetParent(popup);
  const rect = await platform.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements: { reference: anchor, floating: popup },
    rect: { x, y, width: currentRect.width, height: currentRect.height },
    offsetParent: offsetParent as Element,
    strategy,
  });
  const convertedX = finiteGeometry(rect.x, 'place() converted popup rect.x');
  const convertedY = finiteGeometry(rect.y, 'place() converted popup rect.y');
  const width = finiteGeometry(rect.width, 'place() converted popup rect.width', true);
  const height = finiteGeometry(rect.height, 'place() converted popup rect.height', true);
  return {
    top: convertedY,
    right: finiteGeometry(convertedX + width, 'place() converted popup rect.right'),
    bottom: finiteGeometry(convertedY + height, 'place() converted popup rect.bottom'),
    left: convertedX,
  };
}

function validatePlaceNumericOptions(opts: PlaceOptions): void {
  for (const [name, value] of [
    ['offset', opts.offset],
    ['skidding', opts.skidding],
  ] as const) {
    if (value !== undefined) finiteGeometry(value, `place() ${name}`);
  }
  for (const [name, value] of [
    ['flipPadding', opts.flipPadding],
    ['shiftPadding', opts.shiftPadding],
    ['padding', opts.padding],
    ['autoSizePadding', opts.autoSizePadding],
    ['arrowPadding', opts.arrowPadding],
  ] as const) {
    if (value !== undefined) finiteGeometry(value, `place() ${name}`, true);
  }
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
  /** Resolves the popup's offset parent in place of the corrected platform method. */
  resolveOffsetParent?: typeof correctedGetOffsetParent;
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
  const openStyleTransactions = new Set<PlacementStyleTransaction>();
  const visualViewport = popup.ownerDocument.defaultView?.visualViewport;
  const updateFromVisualViewport = () => update();

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    stopAutoUpdate?.();
    stopAutoUpdate = undefined;
    visualViewport?.removeEventListener('resize', updateFromVisualViewport);
    visualViewport?.removeEventListener('scroll', updateFromVisualViewport);
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
  ) =>
    [
      offset({ mainAxis: opts.offset ?? 4, crossAxis: opts.skidding ?? 0 }),
      // Sizing to the anchor has to happen before flip/shift measure overflow, or they would each
      // reason about the pre-sync box.
      sync
        ? size({
            apply({ rects, elements }) {
              if (disposed) return;
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
          if (disposed) return;
          // Available-size variables do not affect middleware measurement, so keep them off the
          // live element until every later geometry read has succeeded. Synced dimensions cannot
          // be staged because flip and shift must measure the resized box; those writes stay in
          // the rollback journal above.
          stagedStyles.availableInline = `${Math.max(
            0,
            finiteGeometry(availableWidth, 'place() available width'),
          )}px`;
          stagedStyles.availableBlock = `${Math.max(
            0,
            finiteGeometry(availableHeight, 'place() available height'),
          )}px`;
        },
      }),
      // Runs last so it overwrites the shared measurement above, and only on the axes it names.
      autoSize
        ? size({
            boundary: (opts.autoSizeBoundary ?? opts.boundary) as Boundary | undefined,
            padding: opts.autoSizePadding ?? 0,
            apply({ availableWidth, availableHeight }) {
              if (disposed) return;
              if (autoSize === 'horizontal' || autoSize === 'both') {
                stagedStyles.availableInline = `${Math.max(
                  0,
                  finiteGeometry(availableWidth, 'place() auto-size available width'),
                )}px`;
              }
              if (autoSize === 'vertical' || autoSize === 'both') {
                stagedStyles.availableBlock = `${Math.max(
                  0,
                  finiteGeometry(availableHeight, 'place() auto-size available height'),
                )}px`;
              }
            },
          })
        : undefined,
      ...(hooks?.middleware ?? []),
    ].filter((entry) => entry !== undefined);

  function update(): void {
    if (disposed) return;
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
    let resolvedOffsetParent: Element | Window | undefined;
    const recordingGetOffsetParent: typeof correctedGetOffsetParent = async (element, polyfill) => {
      const result =
        element === popup && hooks?.resolveOffsetParent
          ? await hooks.resolveOffsetParent(element, polyfill)
          : await correctedGetOffsetParent(element, polyfill);
      if (element === popup) resolvedOffsetParent = result;
      return result;
    };
    void computePosition(anchor, popup, {
      strategy,
      placement: opts.placement ?? 'bottom-start',
      middleware: middlewareFor(styleTransaction, stagedStyles),
      // Corrects a WebKit-only blind spot in Floating UI's own containing-block detection for
      // `backdrop-filter`/`filter` ancestors -- see `correctedGetOffsetParent`'s block comment.
      platform: {
        ...platform,
        getOffsetParent: hooks ? recordingGetOffsetParent : correctedGetOffsetParent,
      },
    }).then(
      async ({ x, y, placement, middlewareData }) => {
        if (disposed) {
          styleTransaction.rollback();
          openStyleTransactions.delete(styleTransaction);
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
              styleTransaction.rollback();
              openStyleTransactions.delete(styleTransaction);
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
            const currentPopupRect = validatedClientRect(
              popup.getBoundingClientRect(),
              'place() popup rect',
            );
            const placedPopupRect = await popupRectAtPosition(
              anchor,
              popup,
              strategy,
              x,
              y,
              currentPopupRect,
            );
            if (disposed) {
              styleTransaction.rollback();
              openStyleTransactions.delete(styleTransaction);
              return;
            }
            bridgeQuad = hoverBridgeQuad(anchorRect, placedPopupRect, placement);
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
          styleTransaction.set(popup, 'left', `${x}px`);
          styleTransaction.set(popup, 'top', `${y}px`);
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
          dispose();
          return;
        }
        // Consumer callbacks deliberately sit outside the internal failure boundary. A callback
        // exception remains observable to its caller instead of being mistaken for positioning
        // failure and silently suppressed.
        opts.onPlaced?.({ placement, arrow: middlewareData.arrow });
      },
      () => dispose(),
    );
  }

  stopAutoUpdate = autoUpdate(anchor, popup, update);
  // The visual viewport changes independently of the layout viewport when a
  // mobile on-screen keyboard opens or closes. Floating UI's normal window
  // resize listener does not receive those events, so keep the available-size
  // CSS variables and fixed coordinates in sync with the visual viewport too.
  // Read from `popup` rather than `anchor` -- a VirtualAnchor has no `ownerDocument` of its own,
  // and `popup` is always a real element in the same document a real `anchor` would be anyway.
  visualViewport?.addEventListener('resize', updateFromVisualViewport);
  visualViewport?.addEventListener('scroll', updateFromVisualViewport);

  return dispose;
}

function isWindowLike(value: Element | Window): value is Window {
  return !(value instanceof Element);
}

/** The containing block of an absolutely positioned element: its nearest flat-tree ancestor that
 *  is positioned or establishes a containing block, or `null` for the initial containing block. */
function absoluteContainingBlock(element: HTMLElement): Element | null {
  let node: Node = fixedContainingBlockParentNode(element);
  while (node instanceof Element && !isLastTraversableFixedContainingBlockNode(node)) {
    const view = node.ownerDocument.defaultView;
    if (view && view.getComputedStyle(node).position !== 'static') return node;
    if (establishesFixedContainingBlock(node)) return node;
    const parent = fixedContainingBlockParentNode(node);
    if (parent === node) break;
    node = parent;
  }
  return null;
}

/**
 * Library-internal `place()` for anchored surfaces: identical geometry, plus the top-layer escape
 * (`top-layer-escape.ts`). A `fixed` popup whose containing block is an ancestor -- a transformed
 * virtual-list row, a filtered card, a `contain`ed panel -- is shown in the browser top layer
 * where the native Popover API exists, re-tested on every update, so it lays out against the
 * viewport and no ancestor clips it. The hover bridge, which is `position: fixed` whatever the
 * popup strategy, is judged on its own. Both are compensated for an ancestor CSS `zoom` (an
 * `absolute` popup only for the zoom between its offset parent and itself), and a promoted popup
 * whose reference scrolls out of view is hidden until it returns. Disposing a run never demotes:
 * a promotion lasts until the popup settles with `[hidden]` or `releaseTopLayer()` is called.
 * `src/utilities/positioner.ts` does not re-export this.
 * @internal
 */
export function placeAnchoredSurface(
  anchor: Element | VirtualAnchor,
  popup: HTMLElement,
  opts: PlaceOptions = {},
): () => void {
  // Validate before any escape write, exactly like place() itself.
  validatePlaceNumericOptions(opts);
  validateAnchorBeforeSetup(anchor);
  const bridge = opts.hoverBridge;
  const fixed = (opts.strategy ?? 'fixed') === 'fixed';
  const escape = (element: HTMLElement, eligible: boolean): void => {
    if (isLibraryPromotedAndShowing(element)) return;
    if (eligible && needsTopLayerEscape(element)) promoteToTopLayer(element, popup);
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
    // Chromium reports the nearest ancestor with a different effective zoom as `offsetParent`,
    // which under an ancestor CSS `zoom` is not the element an absolute popup is laid out against.
    // Resolve the real containing block there instead.
    resolveOffsetParent(element, polyfill) {
      if (!fixed && element instanceof HTMLElement && Math.abs(ancestorZoom(element) - 1) > 1e-6) {
        return Promise.resolve(
          absoluteContainingBlock(element) ?? element.ownerDocument.defaultView ?? window,
        );
      }
      return correctedGetOffsetParent(element, polyfill);
    },
    beforeCompute() {
      if (bridge) escape(bridge, true);
      if (fixed) compensateAncestorZoom(popup, null);
      if (bridge) compensateAncestorZoom(bridge, null, popup);
    },
    middleware: [
      {
        name: referenceHidden.name,
        options: referenceHidden.options,
        fn: (state) =>
          isLibraryPromotedAndShowing(popup) && referenceMeasurable()
            ? referenceHidden.fn(state)
            : {},
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
