import { acquireMapHandlerLease, type MapHandlerLease, type MapHandlerLeaseContext } from '../../../internal/map-handler-lease.js';

export type MapDrawingPanContext = MapHandlerLeaseContext;
export type MapDrawingPanLease = MapHandlerLease;

/**
 * Temporarily disables only native drag pan. Its ownership is independent of the drawing
 * session double-click zoom lease. Release before advancing the component's
 * connection/style/drawing-session generation; a stale lease never restores a native handler.
 */
export function acquireMapDrawingPan(peer: unknown, context: MapDrawingPanContext): MapDrawingPanLease {
  return acquireMapHandlerLease(peer, 'dragPan', context);
}
