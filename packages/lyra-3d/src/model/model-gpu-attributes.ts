import { BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, type Object3D } from 'three';
import { ModelAdmissionError } from './model-admission-error.js';
import { MODEL_LIMITS } from './limits.js';
import { createModelGeneratorWork } from './model-work-generator.js';
import type { ModelIncrementalWork } from './model-work.js';

const drawingAttributes = ['position', 'normal', 'uv', 'uv1', 'color'] as const;

export function modelGpuAttributesNeedConversion(object: Object3D): boolean {
  if (!('geometry' in object) || !(object.geometry instanceof BufferGeometry)) return false;
  const geometry = object.geometry;
  return drawingAttributes.some(name => geometry.getAttribute(name)?.array instanceof Float64Array);
}

/** GPU storage is private until installation; parser-owned attribute identities stay intact. */
export function createModelGpuAttributeWork(drawables: Iterable<{ readonly object: Object3D }>): ModelIncrementalWork<void> {
  return createModelGeneratorWork(function* () {
    const geometries = new Set<BufferGeometry>();
    const targets = new Map<BufferAttribute | InterleavedBuffer, Float64Array>();
    const converted = new Map<Float64Array, Float32Array>();
    let allocated = 0;
    for (const { object } of drawables) {
      yield 'records';
      if (!('geometry' in object) || !(object.geometry instanceof BufferGeometry) || geometries.has(object.geometry)) continue;
      const geometry = object.geometry; geometries.add(geometry);
      for (const name of drawingAttributes) {
        yield 'records'; const attribute = geometry.getAttribute(name);
        if (!attribute || !(attribute.array instanceof Float64Array)) continue;
        const target = attribute instanceof InterleavedBufferAttribute ? attribute.data : attribute;
        if (target instanceof BufferAttribute || target instanceof InterleavedBuffer) targets.set(target, attribute.array);
        else throw new ModelAdmissionError('invalid');
      }
    }
    for (const source of targets.values()) {
      yield 'records'; if (converted.has(source)) continue;
      const bytes = source.length * Float32Array.BYTES_PER_ELEMENT;
      allocated += bytes;
      if (!Number.isSafeInteger(allocated) || allocated > MODEL_LIMITS.decodedBytes) throw new ModelAdmissionError('limit');
      let charged = 0;
      if (bytes) yield { unit: 'bytes', run(limit) { const used = Math.min(limit, bytes - charged); charged += used; return { used, done: charged === bytes }; } };
      const output = new Float32Array(source.length); let offset = 0;
      if (source.length) yield { unit: 'scalars', run(limit) {
        const end = Math.min(source.length, offset + limit), start = offset;
        for (; offset < end; offset++) {
          const value = source[offset]!, rounded = Math.fround(value);
          if (!Number.isFinite(value) || !Number.isFinite(rounded)) throw new ModelAdmissionError('invalid');
          output[offset] = rounded;
        }
        return { used: offset - start, done: offset === source.length };
      } };
      converted.set(source, output);
    }
    // No original storage changes until every conversion has passed finite-range validation.
    for (const [target, source] of targets) {
      yield 'records'; target.array = converted.get(source)!; target.needsUpdate = true;
    }
  });
}
