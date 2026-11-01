import { ModelAdmissionError } from './admission.js';
import { MODEL_LIMITS } from './limits.js';
import type { AdmittedModelInput, ModelAllocationHooks, ModelAttributeScalarKind, ModelDecoderServices, ModelNumericArray } from './model-prepared-types.js';

const arrays = { i8: Int8Array, u8: Uint8Array, u8c: Uint8ClampedArray, i16: Int16Array, u16: Uint16Array, i32: Int32Array, u32: Uint32Array, f32: Float32Array, f64: Float64Array } as const;
export function createModelDecoderServices(admitted: AdmittedModelInput, allocations?: ModelAllocationHooks): { readonly services: ModelDecoderServices; readonly allocatedBytes: number } {
  let allocatedBytes = 0;
  const allocate = (kind: ModelAttributeScalarKind, length: number, purpose: 'attribute' | 'index'): ModelNumericArray => {
    if (!Object.hasOwn(arrays, kind) || !Number.isSafeInteger(length) || length < 0) throw new ModelAdmissionError('invalid');
    const constructor = arrays[kind]; const bytes = length * constructor.BYTES_PER_ELEMENT;
    if (!Number.isSafeInteger(bytes) || allocatedBytes + bytes > admitted.counts.decodedBytes || allocatedBytes + bytes > MODEL_LIMITS.decodedBytes) throw new ModelAdmissionError('limit');
    allocations?.reserve(purpose, bytes);
    allocatedBytes += bytes; return new constructor(length);
  };
  return { services: { allocateAttribute: (kind, length) => allocate(kind, length, 'attribute'), allocateIndex: (kind, length) => allocate(kind, length, 'index') as Uint8Array | Uint16Array | Uint32Array }, get allocatedBytes() { return allocatedBytes; } };
}
