import type { Object3D } from 'three';
import { ModelAdmissionError } from './model-admission-error.js';
import { createModelAdmissionWork } from './model-admission-kernel.js';
import { createModelDescriptorValidation } from './model-descriptor-validation.js';
import { MODEL_LIMITS } from './limits.js';
import { createModelMaterialization, decodePreparedImages, type ModelImageServices } from './model-materialization.js';
import { aborted } from './model-parser-common.js';
import { decodePreparedModel } from './model-preparation-kernel.js';
import type { AdmittedModelInput, ModelAllocationHooks, ModelAllocationPurpose, ModelDescriptor, OwnedModelInput } from './model-prepared-types.js';
import { runModelWork } from './model-work-runner.js';

export interface ModelStorageReceipt { readonly key: string; readonly byteLength: number; readonly purpose: ModelAllocationPurpose }
export interface ModelStorageRequest { readonly token: string; readonly purpose: ModelAllocationPurpose; readonly byteLength: number }
export interface ModelStorageLease { readonly key: string; release(): void }
export interface ModelPreparationBudget {
  reserve(request: ModelStorageRequest): ModelStorageLease;
  admitCounts(counts: AdmittedModelInput['counts']): void;
  noteNativeImage(resource: number, width: number, height: number): void;
}
export interface PreparedModelAsset {
  /** Conservative owned-allocation reservations; decoder intermediates remain charged until retirement. */
  readonly storage: readonly ModelStorageReceipt[];
  /** Pixel policy receipts, not estimates of native image backing bytes. */
  readonly unknownNativeImages: readonly { readonly resource: number; readonly width: number; readonly height: number }[];
  dispose(): void;
}
export interface ModelInstance { readonly object: Object3D; dispose(): void }
interface AssetState {
  admitted?: AdmittedModelInput;
  descriptor?: ModelDescriptor;
  readonly images: Map<number, ImageBitmap>;
  readonly allocations: ReturnType<typeof allocationOwner>;
  references: number;
  retiring: boolean;
  retired: boolean;
}
const assets = new WeakMap<PreparedModelAsset, AssetState>();
const invalid = (): never => { throw new ModelAdmissionError('invalid'); };
let nextOwner = 0;

function allocationOwner(budget: ModelPreparationBudget, signal?: AbortSignal) {
  if (nextOwner === Number.MAX_SAFE_INTEGER) invalid();
  const owner = ++nextOwner;
  const leases: ModelStorageLease[] = [], receipts: ModelStorageReceipt[] = [];
  let released = false;
  const hooks: ModelAllocationHooks = { reserve(purpose, byteLength) {
    aborted(signal);
    if (released || !Number.isSafeInteger(byteLength) || byteLength < 0) invalid();
    const lease = budget.reserve(Object.freeze({ token: `model-${owner}-${leases.length}`, purpose, byteLength }));
    leases.push(lease);
    if (typeof lease.key !== 'string' || !lease.key || typeof lease.release !== 'function') invalid();
    receipts.push(Object.freeze({ key: lease.key, byteLength, purpose }));
    aborted(signal);
  } };
  return { hooks, receipts, scratch(byteLength: number) {
    aborted(signal);
    if (released || !Number.isSafeInteger(byteLength) || byteLength < 0) invalid();
    const lease = budget.reserve(Object.freeze({ token: `model-${owner}-scratch`, purpose: 'scratch', byteLength }));
    let scratchReleased = false;
    const storage = { release() { if (scratchReleased) return; scratchReleased = true; lease.release(); } };
    try { aborted(signal); } catch (error) { storage.release(); throw error; }
    return storage;
  }, release() {
    if (released) return;
    released = true;
    for (const lease of leases.splice(0).reverse()) try { lease.release(); } catch { /* Release every owned lease. */ }
  } };
}

function own(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return invalid();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return invalid();
  return descriptor.value;
}
function snapshot(input: OwnedModelInput, hooks: ModelAllocationHooks): OwnedModelInput {
  const format = own(input, 'format');
  if (!['gltf', 'glb', 'obj', 'stl', 'ply', 'xyz', 'pcd'].includes(format as string)) return invalid();
  const bytes = own(input, 'bytes');
  const prototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
  const get = (target: object, key: PropertyKey) => Object.getOwnPropertyDescriptor(target, key)?.get;
  if (get(prototype, Symbol.toStringTag)?.call(bytes) !== 'Uint8Array') return invalid();
  let source: Uint8Array<ArrayBuffer>;
  try {
    const buffer = get(prototype, 'buffer')?.call(bytes) as ArrayBuffer;
    get(ArrayBuffer.prototype, 'byteLength')?.call(buffer);
    if (get(ArrayBuffer.prototype, 'resizable')?.call(buffer)) return invalid();
    const length: unknown = get(prototype, 'byteLength')?.call(bytes);
    const offset: unknown = get(prototype, 'byteOffset')?.call(bytes);
    if (typeof length !== 'number' || typeof offset !== 'number' || length < 1 || length > MODEL_LIMITS.encodedBytes) return invalid();
    source = new Uint8Array(buffer, offset, length);
  } catch { return invalid(); }
  hooks.reserve('encoded', source.byteLength);
  return { format: format as OwnedModelInput['format'], bytes: new Uint8Array(source) };
}

function retire(asset: PreparedModelAsset, state: AssetState): void {
  if (state.retired || !state.retiring || state.references > 0) return;
  state.retired = true;
  const images = new Set(state.images.values());
  state.images.clear(); state.admitted = undefined; state.descriptor = undefined;
  assets.delete(asset);
  for (const image of images) try { image.close(); } catch { /* Close all images. */ }
  state.allocations.release();
}

/** Owns one validated CPU asset, independently from style/context epoch wrappers. */
export async function prepareModelAsset(input: OwnedModelInput, options: {
  readonly budget: ModelPreparationBudget; readonly execution: 'local'; readonly signal?: AbortSignal;
}, services: Pick<ModelImageServices, 'decodeImage'> = {}): Promise<PreparedModelAsset> {
  const { signal, budget } = options;
  aborted(signal);
  if (options.execution !== 'local') return invalid();
  const allocations = allocationOwner(budget, signal);
  let images: Map<number, ImageBitmap> | undefined;
  try {
    // Reservation and the sole caller-input copy happen synchronously before the first await.
    const owned = snapshot(input, allocations.hooks);
    const admitted = await runModelWork(createModelAdmissionWork(owned, allocations.hooks), signal); aborted(signal);
    budget.admitCounts(Object.freeze({ ...admitted.counts })); aborted(signal);
    const descriptor = await decodePreparedModel(admitted, signal, allocations.hooks); aborted(signal);
    await runModelWork(createModelDescriptorValidation(descriptor, admitted, { reserve: allocations.scratch }), signal); aborted(signal);
    const unknownNativeImages: { readonly resource: number; readonly width: number; readonly height: number }[] = [];
    images = await decodePreparedImages(admitted, signal, { ...services, beforeDecode(resource, width, height) {
      budget.noteNativeImage(resource, width, height);
      aborted(signal);
      unknownNativeImages.push(Object.freeze({ resource, width, height }));
    } });
    aborted(signal);
    const state: AssetState = { admitted, descriptor, images, allocations, references: 0, retiring: false, retired: false };
    const asset: PreparedModelAsset = Object.freeze({ storage: Object.freeze([...allocations.receipts]),
      unknownNativeImages: Object.freeze(unknownNativeImages), dispose() { state.retiring = true; retire(asset, state); } });
    assets.set(asset, state); images = undefined;
    return asset;
  } catch (error) {
    if (images) for (const image of images.values()) try { image.close(); } catch { /* Close all images. */ }
    allocations.release(); throw error;
  }
}

/** Creates owned epoch wrappers while retaining the asset's borrowed CPU geometry and native images. */
export async function instantiatePreparedModel(asset: PreparedModelAsset, options: {
  readonly budget: ModelPreparationBudget; readonly signal?: AbortSignal;
}): Promise<ModelInstance> {
  const state = assets.get(asset);
  if (!state || state.retiring || !state.admitted || !state.descriptor) return invalid();
  aborted(options.signal);
  const allocations = allocationOwner(options.budget, options.signal);
  state.references++;
  try {
    const parsed = await runModelWork(createModelMaterialization(state.descriptor, state.admitted,
      new Map(state.images), { closeImages: false, allocations: allocations.hooks }), options.signal);
    try { aborted(options.signal); } catch (error) { parsed.dispose(); throw error; }
    let disposed = false;
    const instance: ModelInstance = Object.freeze({ object: parsed.object, dispose() {
      if (disposed) return;
      disposed = true;
      try { parsed.dispose(); } finally {
        allocations.release(); state.references--; retire(asset, state);
      }
    } });
    return instance;
  } catch (error) {
    allocations.release(); state.references--; retire(asset, state); throw error;
  }
}
