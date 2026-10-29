import type { CustomLayerInterface, MapFeaturePreparationOptions, MapFeatureRequirements } from '@aceshooting/lyra-map';
import type { MapPosition } from './scene.js';

type NativeSceneLayer = Pick<CustomLayerInterface, 'id' | 'type' | 'renderingMode' | 'render' | 'prerender'> & {
  onAdd?(map: SceneBridgeNativeMap, gl: WebGL2RenderingContext): void;
  onRemove?(map: SceneBridgeNativeMap, gl: WebGL2RenderingContext): void;
};

/** A marker with resolved presentation values; rgba alpha already includes authored opacity. */
export interface SceneMarker {
  readonly id: string;
  readonly position: MapPosition;
  readonly acceptedPositionRevision: number;
  readonly radiusCss: number;
  readonly rgba: readonly [red: number, green: number, blue: number, alpha: number];
}

/** An owned immutable packet; replace its identity whenever accepted input changes. */
export interface SceneRenderInput {
  readonly acceptedSceneRevision: number;
  readonly presentationRevision: number;
  /** Required field; undefined keeps nonempty input pending until allocation is available. */
  readonly allocation: {
    readonly revision: number;
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
    readonly padding: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  } | undefined;
  readonly reducedMotion: boolean;
  readonly markers: readonly SceneMarker[];
}

/** Marker installation state does not assert completed visibility or whole-scene readiness. */
export interface SceneBridgeStatus {
  readonly state: 'pending' | 'installed' | 'empty' | 'unavailable';
  readonly acceptedSceneRevision: number;
  readonly presentationRevision: number;
  readonly allocationRevision: number | undefined;
  readonly markerInstallationRevision: number;
  readonly code?: 'engine' | 'limit' | 'render' | 'context-lost';
}

/** Callbacks are synchronous; capture returns the same packet identity until it is replaced. */
export interface SceneBridgeHost {
  readonly signal: AbortSignal;
  readonly isCurrent: () => boolean;
  readonly captureRenderInput: () => SceneRenderInput;
  readonly subscribeRenderInput: (changed: () => void) => () => void;
  readonly onState: (status: SceneBridgeStatus) => void;
  readonly onError: (code: NonNullable<SceneBridgeStatus['code']>) => void;
}

/** The public native map operations borrowed by the bridge. */
export interface SceneBridgeNativeMap {
  addLayer(layer: NativeSceneLayer, beforeId?: string): unknown;
  removeLayer(id: string): unknown;
  getLayer(id: string): object | undefined;
  getCanvas(): HTMLCanvasElement;
  isStyleLoaded(): boolean | void;
  triggerRepaint(): void;
  getCenter(): { readonly lng: number; readonly lat: number };
  getZoom(): number;
  getPitch(): number;
  getBearing(): number;
  getTerrain(): { readonly source: string } | null;
  getProjection(): unknown;
  on(type: 'move' | 'resize' | 'terrain' | 'projectiontransition' | 'sourcedata' | 'style.load' | 'render',
    listener: (event: { readonly sourceId?: string }) => void): unknown;
  off(type: 'move' | 'resize' | 'terrain' | 'projectiontransition' | 'sourcedata' | 'style.load' | 'render',
    listener: (event: { readonly sourceId?: string }) => void): unknown;
  prepareFeatures?(requirements: MapFeatureRequirements, options?: MapFeaturePreparationOptions): Promise<void>;
}

/** Lifecycle controls; native rendering and resource authority remain internal. */
export interface SceneBridge {
  /** Call before replacing the native map style. */
  invalidateStyle(): void;
  requestFrame(): void;
  setVisible(visible: boolean): void;
  /** Idempotent; call before removing the native map. */
  dispose(): void;
}

export declare function createSceneBridge(map: SceneBridgeNativeMap, host: SceneBridgeHost): SceneBridge;
