import type { LyraMapAnchorBoundary, LyraMapAnchorCloseReason, LyraMapAnchorSafeArea } from './map-anchor-options.js';

/**
 * @internal Prefix-independent key shared by `lr-map` and its `lr-map-anchor` children. A
 * `Symbol.for()` key keeps the contract working when two copies of the library meet on one page.
 */
export const MAP_ANCHOR_SEAM: unique symbol = Symbol.for('@aceshooting/lyra-ui.map-anchor.v1') as never;

/** @internal What a map asks of a child anchor: re-check its attachment, publish placement, or close. */
export type MapAnchorChildOperation = LyraMapAnchorCloseReason | 'refresh' | 'placed' | 'unplaced' | 'autofocus';

/** @internal What a child anchor asks of the map whose `anchors` slot renders it. */
export type MapAnchorOwnerOperation = 'attach' | 'detach' | 'sync' | 'request' | 'capture' | 'retire' | 'repair' | 'focus';

/** @internal The child-anchor surface a map and its placement runtime read. */
export interface MapAnchorChild extends HTMLElement {
  readonly open: boolean;
  readonly lngLat?: readonly [number, number] | null;
  readonly closable: boolean;
  readonly boundary?: LyraMapAnchorBoundary;
  readonly safeArea?: LyraMapAnchorSafeArea;
  readonly isUpdatePending: boolean;
  [MAP_ANCHOR_SEAM](operation: MapAnchorChildOperation): boolean;
}

/** @internal The registry an upgraded map exposes to the anchors it renders. */
export interface MapAnchorOwner extends HTMLElement {
  [MAP_ANCHOR_SEAM](anchor: MapAnchorChild, operation: MapAnchorOwnerOperation, value?: unknown): unknown;
}
