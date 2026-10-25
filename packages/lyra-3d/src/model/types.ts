import type { Lyra3dEngine } from '../core/contract.js';
import type { Lyra3dOrbitCamera } from '../core/orbit.js';

export type ModelFormat = 'gltf' | 'glb' | 'stl' | 'obj' | 'ply' | 'xyz' | 'pcd';
export type ModelAdmissionFailure = 'invalid' | 'limit' | 'unsupported' | 'external-resource';

/** Opaque admission receipt. Only receipts returned by admitModel can be read. */
export interface ModelAdmission {
  readonly format: ModelFormat;
  readonly encodedBytes: number;
  readonly decodedBytes: number;
  readonly vertices: number;
  readonly indices: number;
  readonly resources: number;
  /** Conservative pixel reservations, including texture/material aliases. */
  readonly imagePixels: number;
}

export interface ModelEmbeddedResource {
  readonly kind: 'buffer' | 'image';
  readonly index: number;
  /** Exact admitted data URI, or null for an embedded GLB/buffer-view resource. */
  readonly uri: string | null;
  readonly mimeType: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly width?: number;
  readonly height?: number;
}

/**
 * An independent parser-owned snapshot. Never enable external URL loading or extension plugins.
 * A loader's resource manager must fail closed except for these exact embedded resources.
 * Validate finite world matrices and computed bounds before fitting a camera or rendering:
 * finite serialized transforms can overflow when composed.
 */
export interface ModelParserInput {
  readonly format: ModelFormat;
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly resources: readonly ModelEmbeddedResource[];
}
/** Owned bytes and their format. setData copies and admits synchronously; setDataAsync copies before accepting its revision. */
export interface ModelEngineData {
  readonly bytes: ArrayBuffer | Uint8Array;
  readonly format: ModelFormat;
}
export interface ModelEngine extends Lyra3dEngine<ModelEngineData, Lyra3dOrbitCamera> {
  /**
   * Prepare and atomically install owned input without changing setData's synchronous contract.
   * Always returns a Promise. Basic refusal reserves no revision; accepted deep failure does.
   * Abort, replacement or disposal rejects with AbortError and retains the previously installed model.
   */
  setDataAsync(data: ModelEngineData, revision: number, options?: { readonly signal?: AbortSignal }): Promise<void>;
}
