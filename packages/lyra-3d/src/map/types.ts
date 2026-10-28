export type MapVector3 = readonly [number, number, number];
export type MapQuaternion = readonly [number, number, number, number];
export type MapMatrix = readonly number[];
export interface ModelPlacementOptions {
  readonly nodeTransforms?: readonly MapMatrix[];
  readonly metersPerUnit?: number;
  readonly orientation?: MapQuaternion;
}
export interface AdmittedSceneModel {
  readonly id: string;
  readonly label: string;
  readonly kind: 'model';
  readonly position: {
    readonly lngLat: readonly [number, number];
    readonly altitude: number;
    readonly altitudeReference: 'sea-level' | 'terrain';
  };
  readonly source: {
    readonly format: 'gltf' | 'glb' | 'stl' | 'obj' | 'ply' | 'xyz' | 'pcd';
    /** An exclusive prepared copy; consumers must not mutate it. */
    readonly bytes: Uint8Array<ArrayBuffer>;
  };
  readonly metersPerUnit: number;
  readonly orientation: MapQuaternion;
  readonly color?: string;
  readonly opacity: number;
  readonly interactive: boolean;
  readonly showLabel: boolean;
}
export interface SceneAllocation { readonly key: string; readonly bytes: number }
export interface SceneReservation { release(): void }
export interface SceneResourceLedger {
  readonly bytes: number;
  reserve(owner: string, allocations: readonly SceneAllocation[]): SceneReservation;
}
