import { acquireMapHandlerLease, type MapHandlerLease, type MapHandlerLeaseContext } from '../../../internal/map-handler-lease.js';

export type MapDrawingGestureContext = MapHandlerLeaseContext;
export type MapDrawingGestureLease = MapHandlerLease;

/**
 * Temporarily disables only native double-click zoom. Release before advancing the component's
 * connection/style/drawing-session generation; a stale lease never restores a native handler.
 */
export function acquireMapDrawingGesture(peer: unknown, context: MapDrawingGestureContext): MapDrawingGestureLease {
  return acquireMapHandlerLease(peer, 'doubleClickZoom', context);
}
