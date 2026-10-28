export type MapAltitudeReference = 'sea-level' | 'terrain';
export type MapSceneErrorCode = 'invalid' | 'limit' | 'model' | 'resource' | 'engine' | 'projection' | 'terrain' | 'context-lost';
export type MapQuaternion = readonly [x: number, y: number, z: number, w: number];
export type MapEnuPoint = readonly [east: number, north: number, up: number];

/** Geographic degrees and meter altitude; omitted altitude/reference mean zero above sea level. */
export interface MapPosition {
  readonly lngLat: readonly [longitude: number, latitude: number];
  readonly altitude?: number;
  readonly altitudeReference?: MapAltitudeReference;
}

/** Resolved altitude includes displayed terrain exaggeration once, before the authored offset. */
export type MapResolvedPosition =
  | { readonly lngLat: readonly [number, number]; readonly altitude: number; readonly status: 'resolved' }
  | { readonly lngLat: readonly [number, number]; readonly status: 'terrain-pending' | 'terrain-unavailable' };

export interface MapProjectedPosition {
  readonly point?: readonly [number, number];
  readonly visible: boolean;
  readonly status: 'resolved' | 'terrain-pending' | 'terrain-unavailable' | 'visibility-pending' | 'clipped' | 'occluded';
}

export interface MapGeographicOrigin {
  readonly tile: { readonly z: number; readonly x: number; readonly y: number; readonly wrap: number };
  readonly key: string;
}

/** Admission ceilings; byte and vertex limits do not promise rendering throughput. */
export interface MapSceneLimits {
  readonly objects: number;
  readonly models: number;
  readonly modelConcurrency: number;
  readonly geographicVertices: number;
  readonly effectVertices: number;
  readonly modelEncodedBytes: number;
  readonly modelDecodedBytes: number;
  readonly modelVertices: number;
  readonly modelIndices: number;
  readonly modelImagePixels: number;
  readonly terrainSamples: number;
  readonly terrainTexturePixels: number;
}

export interface MapGeographicServices {
  readonly limits: Readonly<MapSceneLimits>;
  resolve(position: MapPosition): MapResolvedPosition;
  frameFor(position: MapPosition): MapGeographicOrigin;
  fromEnu(origin: Extract<MapResolvedPosition, { status: 'resolved' }>, point: MapEnuPoint): MapPosition;
}

/** Services are valid only during their owning render/prerender callback. */
export interface MapGeographicFrame {
  resolve(position: MapPosition): MapResolvedPosition;
  project(position: MapPosition): MapProjectedPosition;
  encode(position: MapResolvedPosition, origin: MapGeographicOrigin): readonly [number, number, number];
  shader(origin: MapGeographicOrigin): MapGeographicShader;
  /** Captures owned numeric data for deferred planning; the capture call requires a live callback. */
  captureProjection(origin: MapGeographicOrigin): MapProjectionSnapshot;
}

export type MapGeographicUniform =
  | { readonly name: string; readonly type: 'float'; readonly value: number }
  | { readonly name: string; readonly type: 'vec4'; readonly value: readonly [number, number, number, number] }
  | { readonly name: string; readonly type: 'mat4'; readonly value: readonly number[] };

/**
 * Tile-local xy and meter z use one native projection contract.
 * Forward lrHorizonPosition through a highp varying and discard fragments where
 * lrHorizonOccluded returns true, before color, depth or picking output.
 * Nonzero globe transitions use sphere-horizon visibility, not exact intersection
 * with the visually interpolated basemap surface.
 */
export interface MapGeographicShader {
  readonly key: string;
  readonly vertexPrelude: string;
  readonly fragmentPrelude: string;
  readonly defines: string;
  readonly positionEncoding: 'tile-xy-meters-z';
  readonly projectFunction: 'lrProjectPosition';
  readonly horizonPositionFunction: 'lrHorizonPosition';
  readonly horizonOccludedFunction: 'lrHorizonOccluded';
  readonly horizonMode: 'none' | 'sphere';
  readonly uniforms: readonly MapGeographicUniform[];
}

/** Executable trusted capability; create returns a fresh instance for each mount epoch. */
export interface MapCustom3dLayer {
  readonly id: string;
  readonly label: string;
  readonly before?: string;
  readonly create: (context: MapLayerContext) => MapLayerInstance;
}

export interface MapLayerContext {
  /** Borrowed context: never resize or destroy its canvas or lose the context. */
  readonly gl: WebGL2RenderingContext;
  readonly signal: AbortSignal;
  readonly geographic: MapGeographicServices;
  requestRender(): void;
  reportState(state: 'ready' | 'loading' | 'unavailable', code?: 'terrain' | 'resource'): void;
}

export interface MapLayerFrame {
  readonly revision: number;
  /** Owned view/layout/context metadata remains readable after the render callback. */
  readonly projectionStamp: MapProjectionStamp;
  /** Monotonic rendering milliseconds, independent of any application simulation clock. */
  readonly time: number;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly reducedMotion: boolean;
  readonly geographic: MapGeographicFrame;
}

export interface MapLayerItem {
  readonly id: string;
  readonly label: string;
  readonly position: MapPosition;
}

export interface MapLayerPick {
  readonly id: string;
  readonly position?: MapPosition;
}

export interface MapLayerInstance {
  prerender?(frame: MapLayerFrame): void;
  render(frame: MapLayerFrame): void;
  /** Synchronous and idempotent; releases only resources owned by this instance. */
  dispose(): void;
  items?(): readonly MapLayerItem[];
  /** Completion waits for GPU work and must reject or cancel stale frame results. */
  pick?(point: readonly [number, number], frameRevision: number): Promise<MapLayerPick | null>;
  setInteraction?(state: { readonly hoveredId?: string; readonly focusedId?: string }): void;
}

export type MapSceneAllocationPool = 'cpu-buffer' | 'worker-buffer' | 'gpu-buffer' | 'gpu-texture';

/** Trusted storage keys describe actual allocations, not object IDs, URLs or content hashes. */
export type MapSceneAllocation =
  | {
    readonly kind: 'bytes';
    readonly key: string;
    readonly pool: Exclude<MapSceneAllocationPool, 'gpu-texture'>;
    readonly byteLength: number;
  }
  | {
    readonly kind: 'texture';
    readonly key: string;
    readonly pool: 'gpu-texture';
    readonly width: number;
    readonly height: number;
    readonly layers: number;
    readonly faces: 1 | 6;
    readonly bytesPerPixel: 1 | 2 | 4 | 8 | 16;
    readonly mipLevels: number;
  };

/** Declared payload storage excludes native image objects, driver padding and other unknown overhead. */
export interface MapSceneResourceUsage {
  readonly knownBytes: number;
  readonly pools: Readonly<Record<MapSceneAllocationPool, number>>;
}

export interface MapSceneAllocationPlan extends MapSceneResourceUsage {
  readonly allocations: readonly { readonly key: string; readonly pool: MapSceneAllocationPool; readonly bytes: number }[];
}

export interface MapSceneResourceReservation {
  /** Release only after the corresponding owned storage has actually retired. */
  release(): void;
}

export interface MapSceneResourceLedger {
  readonly usage: MapSceneResourceUsage;
  reserve(resources: readonly MapSceneAllocation[]): MapSceneResourceReservation;
}

/** Plans the conservative union of all declared live storage, with no inferred scheduling. */
export declare function planSceneAllocations(resources: readonly MapSceneAllocation[], limits: { readonly bytes: number }): MapSceneAllocationPlan;
export declare function createSceneResourceLedger(limits: { readonly bytes: number }): MapSceneResourceLedger;

export type MapProjectionVec4 = readonly [number, number, number, number];
export type MapProjectionMat4 = readonly [
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number
];
export interface MapProjectionTile {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  readonly wrap: number;
}
export interface MapProjectionLayout {
  readonly revision: number;
  readonly tileZoom: number;
  readonly centerLongitude: number;
}
export interface MapProjectionOriginRequest {
  readonly layoutRevision: number;
  readonly tile: MapProjectionTile;
  readonly key: string;
  readonly representative: readonly [longitude: number, latitude: number];
}
export interface MapProjectionStamp {
  readonly viewRevision: number;
  readonly contextEpoch: number;
  readonly layout: MapProjectionLayout;
}
/** Owned native Float32 uniform values and their geographic/view provenance. */
export interface MapProjectionSnapshot extends MapProjectionStamp {
  readonly contract: 1;
  readonly tile: MapProjectionTile;
  readonly width: number;
  readonly height: number;
  readonly mainMatrix: MapProjectionMat4;
  readonly fallbackMatrix: MapProjectionMat4;
  readonly clippingPlane: MapProjectionVec4;
  readonly tileMercatorCoords: MapProjectionVec4;
  readonly projectionTransition: number;
}
declare const compiledProjection: unique symbol;
export interface MapCompiledProjection {
  readonly [compiledProjection]: true;
  readonly snapshot: MapProjectionSnapshot;
  readonly effectiveProjection: 'mercator' | 'mixed' | 'globe';
}
export type MapRawProjection =
  | {
      readonly status: 'projected';
      readonly clip: MapProjectionVec4;
      readonly tilePosition: readonly [x: number, y: number, meters: number];
      readonly horizonOccluded: boolean;
    }
  | { readonly status: 'origin-needed'; readonly request: MapProjectionOriginRequest };

/** Selects a canonical tile and nearest world copy without retaining frame services. */
export declare function projectionOriginFor(position: MapPosition, layout: MapProjectionLayout): MapProjectionOriginRequest;
/** Copies and validates native Float32 uniform data into a runtime-branded handle. */
export declare function compileProjectionSnapshot(snapshot: MapProjectionSnapshot): MapCompiledProjection;
/** Evaluates raw homogeneous coordinates without division or completed visibility claims. */
export declare function evaluateSceneProjection(position: MapPosition, projection: MapCompiledProjection): MapRawProjection;
