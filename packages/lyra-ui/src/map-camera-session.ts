import { createMapCameraSessionController, type MapCameraSession, type MapCameraSessionOptions } from './internal/map-camera-session-controller.js';

export { MapCameraSessionError } from './internal/map-camera-session-controller.js';
export type {
  MapViewpoint, MapCameraTransition, MapCameraKeyframe, MapCameraTour, MapCameraFollowOptions,
  MapCameraSession, MapCameraSessionOptions, MapCameraSessionSnapshot, MapCameraSessionMode,
  MapCameraSessionReason, MapCameraSessionErrorCode, MapCameraTrackingStatus, MapCameraTrackingIssue,
} from './internal/map-camera-session-controller.js';

/**
 * Takes ownership of a connected, style-ready `lr-map` camera for saved viewpoints, clock-driven
 * tours and scene-object following. Registers no elements and loads no engine.
 *
 * One session may own a map at a time. A user gesture, an `lr-map` camera command or `center`/`zoom`
 * assignment, or a style, projection or terrain change ends the current action; the map then emits
 * `lr-map-camera-interrupt`. Disconnecting the map disposes the session permanently.
 */
export function createMapCameraSession(map: HTMLElement, options?: MapCameraSessionOptions): MapCameraSession {
  return createMapCameraSessionController(map, options);
}
