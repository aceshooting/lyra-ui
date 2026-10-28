import { ModelAdmissionError } from './model-admission-error.js';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import type { ModelAdmissionFailure, ModelFormat } from './types.js';
import type { ModelAllocationHooks, ModelPreparedResource, OwnedModelInput } from './model-prepared-types.js';

export interface ModelResourceBudget { decoded: number; vertices: number; indices: number; pixels: number; resources: ModelPreparedResource[]; readonly allocations?: ModelAllocationHooks }
export function modelAdmissionCheck(condition: unknown, code: ModelAdmissionFailure = 'invalid'): asserts condition {
  if (!condition) throw new ModelAdmissionError(code);
}
export function modelAdmissionInteger(value: unknown, max = Number.MAX_SAFE_INTEGER, min = 0): number {
  modelAdmissionCheck(typeof value === 'number' && Number.isSafeInteger(value) && value >= min);
  modelAdmissionCheck(value <= max, 'limit'); return value;
}
export function modelAdmissionNumber(value: unknown): number {
  modelAdmissionCheck(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LIMIT.coordinate); return value;
}
export function modelAdmissionNumeric(value: string | undefined): number {
  modelAdmissionCheck(value !== undefined && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)); return modelAdmissionNumber(Number(value));
}
export function chargeModelBytes(budget: ModelResourceBudget, bytes: number): void {
  budget.decoded += bytes; modelAdmissionCheck(budget.decoded <= LIMIT.decodedBytes, 'limit');
}
export function chargeModelGeometry(budget: ModelResourceBudget, vertices: number, indices: number): void {
  budget.vertices += vertices; budget.indices += indices;
  modelAdmissionCheck(budget.vertices <= LIMIT.vertices && budget.indices <= LIMIT.indices, 'limit');
  chargeModelBytes(budget, vertices * 160 + indices * 16);
}
export function createModelResourceBudget(allocations?: ModelAllocationHooks): ModelResourceBudget { return { decoded: 0, vertices: 0, indices: 0, pixels: 0, resources: [], ...(allocations ? { allocations } : {}) }; }

export function snapshotModelInput(input: ArrayBuffer | Uint8Array, format: ModelFormat): OwnedModelInput {
  modelAdmissionCheck(['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd'].includes(format), 'unsupported');
  modelAdmissionCheck(input instanceof ArrayBuffer || input instanceof Uint8Array);
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  modelAdmissionCheck(source.buffer instanceof ArrayBuffer && !('resizable' in source.buffer && source.buffer.resizable));
  modelAdmissionCheck(source.byteLength <= LIMIT.encodedBytes, 'limit');
  return { format, bytes: new Uint8Array(source) };
}
