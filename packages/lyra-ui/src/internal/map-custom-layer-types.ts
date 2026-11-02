import type { LyraMapPosition } from '../components/media/map/map-scene-types.js';

/** A position resolved to meters above sea level, or why its terrain height is not known yet. */
export type LyraMapResolvedPosition =
  | { readonly lngLat: readonly [number, number]; readonly altitude: number; readonly status: 'resolved' }
  | { readonly lngLat: readonly [number, number]; readonly status: 'terrain-pending' | 'terrain-unavailable' };

/** CSS-pixel projection of one position; `visible` excludes clipped and horizon-occluded positions. */
export interface LyraMapProjectedPosition {
  readonly point?: readonly [number, number];
  readonly visible: boolean;
  readonly status: 'resolved' | 'terrain-pending' | 'terrain-unavailable' | 'visibility-pending' | 'clipped' | 'occluded';
}

/** A tile-local coordinate origin for one world copy; valid for the current view only. */
export interface LyraMapGeographicOrigin {
  readonly tile: { readonly z: number; readonly x: number; readonly y: number; readonly wrap: number };
  readonly key: string;
}

export type LyraMapGeographicUniform =
  | { readonly name: string; readonly type: 'float'; readonly value: number }
  | { readonly name: string; readonly type: 'vec4'; readonly value: readonly [number, number, number, number] }
  | { readonly name: string; readonly type: 'mat4'; readonly value: readonly number[] };

/**
 * GLSL ES 3.00 prelude and uniforms for one origin. Prefix your vertex body with `defines` and
 * `vertexPrelude`, then call `lrProjectPosition(vec3)` with tile-local xy and meter z. On a globe,
 * forward `lrHorizonPosition()` through a highp varying and discard fragments where
 * `lrHorizonOccluded()` (from `fragmentPrelude`) returns true.
 */
export interface LyraMapGeographicShader {
  readonly key: string;
  readonly vertexPrelude: string;
  readonly fragmentPrelude: string;
  readonly defines: string;
  readonly positionEncoding: 'tile-xy-meters-z';
  readonly projectFunction: 'lrProjectPosition';
  readonly horizonPositionFunction: 'lrHorizonPosition';
  readonly horizonOccludedFunction: 'lrHorizonOccluded';
  readonly horizonMode: 'none' | 'sphere';
  readonly uniforms: readonly LyraMapGeographicUniform[];
}

/** Geographic services that outlive one frame; terrain resolution reads the current view. */
export interface LyraMapGeographicServices {
  readonly limits: Readonly<Record<string, number>>;
  resolve(position: LyraMapPosition): LyraMapResolvedPosition;
  /** The tile origin nearest the current view for a position. */
  frameFor(position: LyraMapPosition): LyraMapGeographicOrigin;
  /** Offsets a resolved position by east/north/up meters on the renderer sphere. */
  fromEnu(origin: Extract<LyraMapResolvedPosition, { status: 'resolved' }>,
    point: readonly [east: number, north: number, up: number]): LyraMapPosition;
}

/** Per-frame geographic transforms; they expire when the render callback returns. */
export interface LyraMapGeographicFrame {
  resolve(position: LyraMapPosition): LyraMapResolvedPosition;
  project(position: LyraMapPosition): LyraMapProjectedPosition;
  /** Tile-local `[x, y, meters]` for a resolved position in the origin's world copy. */
  encode(position: LyraMapResolvedPosition, origin: LyraMapGeographicOrigin): readonly [number, number, number];
  shader(origin: LyraMapGeographicOrigin): LyraMapGeographicShader;
}

/** What a custom layer receives once per mount epoch. */
export interface LyraMapCustomLayerContext {
  /** The map's own context: never resize or destroy its canvas or lose the context. */
  readonly gl: WebGL2RenderingContext;
  /** Aborted when this epoch ends (removal, style replacement, context loss). */
  readonly signal: AbortSignal;
  readonly geographic: LyraMapGeographicServices;
  requestRender(): void;
  reportState(state: 'ready' | 'loading' | 'unavailable', code?: 'terrain' | 'resource'): void;
}

/** The shared camera for one frame: CSS size, device pixel ratio and geographic transforms. */
export interface LyraMapCustomLayerFrame {
  /** View revision; pass it back to reject stale picks. */
  readonly revision: number;
  /** Monotonic rendering milliseconds. */
  readonly time: number;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly reducedMotion: boolean;
  readonly geographic: LyraMapGeographicFrame;
}

export interface LyraMapCustomLayerPick {
  readonly id: string;
  readonly position?: LyraMapPosition;
}

export interface LyraMapCustomLayerInstance {
  /** Runs before the main pass, for offscreen work. */
  prerender?(frame: LyraMapCustomLayerFrame): void;
  render(frame: LyraMapCustomLayerFrame): void;
  /**
   * Releases this instance's GL objects. Runs on removal, style replacement, context loss and map
   * disconnection; after a loss `context.gl.isContextLost()` is true and the objects are already gone.
   */
  dispose(): void;
  /** Hit-tests CSS pixel `point` for the frame `revision`; resolve null for no hit. */
  pick?(point: readonly [x: number, y: number], revision: number): Promise<LyraMapCustomLayerPick | null>;
}

/** A trusted custom WebGL2 layer. `create()` runs once per mount epoch and returns a fresh instance. */
export interface LyraMapCustomLayer {
  /** Your identifier, reported as `layerId` when a pick activates. */
  readonly id: string;
  /** Plain-text name. */
  readonly label: string;
  /** An existing style layer id to render beneath. */
  readonly before?: string;
  create(context: LyraMapCustomLayerContext): LyraMapCustomLayerInstance;
}

/** `removed` is final: `remove()` was called or the map disconnected. */
export type LyraMapCustomLayerState = 'loading' | 'ready' | 'unavailable' | 'removed';
export type LyraMapCustomLayerCode = 'engine' | 'render' | 'invalid' | 'context-lost' | 'terrain' | 'resource';

export interface LyraMapCustomLayerStatus {
  readonly state: LyraMapCustomLayerState;
  readonly code?: LyraMapCustomLayerCode;
}

export interface LyraMapCustomLayerOptions {
  /** Called after every state change. */
  readonly onStateChange?: (status: LyraMapCustomLayerStatus) => void;
}

export interface LyraMapCustomLayerHandle {
  readonly id: string;
  /** The latest status. */
  readonly status: LyraMapCustomLayerStatus;
  requestRender(): void;
  setVisible(visible: boolean): void;
  /** Asks the current instance; resolves null without an installed instance or for a stale view. */
  pick(point: readonly [x: number, y: number]): Promise<LyraMapCustomLayerPick | null>;
  /** Idempotent. Disposes the instance and removes the native layer. */
  remove(): void;
}
