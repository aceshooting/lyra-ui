import { ModelAdmissionError } from './admission.js';
import { MODEL_LIMITS } from './limits.js';
import type { AdmittedModelInput, ModelAttributeScalarKind, ModelDecoderServices, ModelNumericArray } from './model-prepared-types.js';

const arrays = { i8: Int8Array, u8: Uint8Array, u8c: Uint8ClampedArray, i16: Int16Array, u16: Uint16Array, i32: Int32Array, u32: Uint32Array, f32: Float32Array, f64: Float64Array } as const;
export function createModelDecoderServices(admitted: AdmittedModelInput): { readonly services: ModelDecoderServices; readonly allocatedBytes: number } {
  let allocatedBytes = 0;
  const allocate = (kind: ModelAttributeScalarKind, length: number): ModelNumericArray => {
    if (!Object.hasOwn(arrays, kind) || !Number.isSafeInteger(length) || length < 0) throw new ModelAdmissionError('invalid');
    const constructor = arrays[kind]; const bytes = length * constructor.BYTES_PER_ELEMENT;
    if (!Number.isSafeInteger(bytes) || allocatedBytes + bytes > admitted.counts.decodedBytes || allocatedBytes + bytes > MODEL_LIMITS.decodedBytes) throw new ModelAdmissionError('limit');
    allocatedBytes += bytes; return new constructor(length);
  };
  return { services: { allocateAttribute: allocate, allocateIndex: (kind, length) => allocate(kind, length) as Uint8Array | Uint16Array | Uint32Array }, get allocatedBytes() { return allocatedBytes; } };
}
