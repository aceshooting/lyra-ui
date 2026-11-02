/** Authored geographic position; altitude is meters above sea level or displayed terrain. */
export interface LyraMapPosition {
  readonly lngLat: readonly [longitude: number, latitude: number];
  /** Altitude in meters. Defaults to 0. */
  readonly altitude?: number;
  /** Altitude reference. Defaults to 'sea-level'. */
  readonly altitudeReference?: 'sea-level' | 'terrain';
}
export type LyraMapQuaternion = readonly [x: number, y: number, z: number, w: number];
export type LyraMapModelFormat = 'gltf' | 'glb' | 'stl' | 'obj' | 'ply' | 'xyz' | 'pcd';
/** A retained record reuses its owned snapshot; replace the record to request new content. */
export type LyraMapModelSource =
  | { readonly format: LyraMapModelFormat; readonly bytes: ArrayBuffer | Uint8Array }
  | { readonly format: LyraMapModelFormat; readonly src: string };
export interface LyraMapSceneObjectBase {
  readonly id: string;
  readonly label: string;
  /** Optional requested CSS color; omitted input has no authored color override. */
  readonly color?: string;
  /** Requested opacity from 0 through 1. Defaults to 1. */
  readonly opacity?: number;
  /** Whether the object can be activated from its text row. Defaults to true. */
  readonly interactive?: boolean;
  /** Requested rendered label visibility. Defaults to false; text rows always retain the label. */
  readonly showLabel?: boolean;
}
export interface LyraMapSceneMarker extends LyraMapSceneObjectBase {
  readonly kind: 'marker';
  readonly position: LyraMapPosition;
  /** Requested positive marker radius. Defaults to 6. */
  readonly radius?: number;
}
/** Drawn as a native line; altitude is carried in the data and reported as `partial`/`altitude` when not representable. */
export interface LyraMapScenePath extends LyraMapSceneObjectBase {
  readonly kind: 'path';
  readonly positions: readonly LyraMapPosition[];
  /**
   * Path interpolation. Defaults to 'great-circle', the shortest route on the globe; 'linear'
   * joins vertices straight in longitude/latitude. Both cross the antimeridian the shorter way.
   */
  readonly interpolation?: 'linear' | 'great-circle';
  /** Requested positive path width. Defaults to 2. */
  readonly width?: number;
}
/**
 * A great-circle ground track whose altitude interpolates linearly between the endpoints plus a
 * parabolic rise of `height` meters at the midpoint. A nonzero altitude or height is drawn as the
 * ground track and reported as `partial` with code `altitude`.
 */
export interface LyraMapSceneArc extends LyraMapSceneObjectBase {
  readonly kind: 'arc';
  readonly start: LyraMapPosition;
  readonly end: LyraMapPosition;
  /** Nonnegative midpoint rise in meters above the chord between endpoint altitudes. */
  readonly height: number;
  /** Requested positive arc width. Defaults to 2. */
  readonly width?: number;
}
export interface LyraMapSceneModel extends LyraMapSceneObjectBase {
  readonly kind: 'model';
  readonly position: LyraMapPosition;
  readonly source: LyraMapModelSource;
  /** Positive model scale in meters per source unit. Defaults to 1. */
  readonly metersPerUnit?: number;
  /** Scalar-last quaternion, normalized on admission. Defaults to identity [0, 0, 0, 1]. */
  readonly orientation?: LyraMapQuaternion;
}
export type LyraMapSceneObject = LyraMapSceneMarker | LyraMapScenePath | LyraMapSceneArc | LyraMapSceneModel;
/** New assignments are admitted atomically; undefined clears accepted scene ownership. */
export interface LyraMapScene { readonly objects: readonly LyraMapSceneObject[]; }
/**
 * `altitude`: a path or arc is drawn as its ground track because the flat map cannot show its
 * authored altitude or arc height. `model`: model objects are not drawn.
 */
export type LyraMapSceneErrorCode = 'invalid' | 'limit' | 'model' | 'resource' | 'engine' | 'projection' | 'terrain' |
  'context-lost' | 'altitude';
/**
 * `loading` until every renderer settles; `ready` when every accepted object is installed on the
 * map exactly; `partial` with a code when some objects are missing or drawn without altitude;
 * `unavailable` with a code when nothing could be drawn. Installation does not assert that pixels
 * are visible: terrain, occlusion and viewport still apply.
 */
export interface LyraMapSceneStateDetail {
  readonly revision: number;
  readonly state: 'loading' | 'ready' | 'partial' | 'empty' | 'unavailable' | 'error';
  readonly code?: LyraMapSceneErrorCode;
}
export interface LyraMapSceneActivateDetail {
  readonly id: string;
  readonly kind: 'marker' | 'path' | 'arc' | 'model' | 'custom';
  readonly layerId?: string;
  readonly source: 'pointer' | 'keyboard';
  readonly position?: LyraMapPosition;
}
