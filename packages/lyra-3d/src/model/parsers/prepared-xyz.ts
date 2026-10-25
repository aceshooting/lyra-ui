import { ModelAdmissionError } from '../admission.js';
import { MODEL_LIMITS } from '../limits.js';
import { decodeModelText, ModelLineCursor } from '../model-text-work.js';
import { createModelGeneratorWork, type ModelWorkGenerator } from '../model-work-generator.js';
import type { ModelAttributeDescriptor, ModelDescriptor, ModelPreparedDecoder } from '../model-prepared-types.js';

export const createPreparedXyz: ModelPreparedDecoder = (input, services) => {
  if (input.input.format !== 'xyz' || input.plan.format !== 'xyz') throw new ModelAdmissionError('unsupported');
  return createModelGeneratorWork(function* (): ModelWorkGenerator<ModelDescriptor> {
    const count = input.counts.vertices;
    yield 'records'; const positions = services.allocateAttribute('f32', count * 3) as Float32Array;
    let colors: Float64Array | undefined; let authoredRows: Uint8Array | undefined; let index = 0;
    const cursor = new ModelLineCursor(yield* decodeModelText(input.input.bytes), MODEL_LIMITS.lineBytes, MODEL_LIMITS.vertices + MODEL_LIMITS.indices);
    for (let line = yield* cursor.next(); line !== undefined; line = yield* cursor.next()) {
      if (!line || line.startsWith('#')) continue;
      const row = line.split(/\s+/).map(Number);
      if (index >= count) throw new ModelAdmissionError('invalid');
      for (let axis = 0; axis < 3; axis++) { yield 'scalars'; positions[index * 3 + axis] = row[axis]!; }
      if (row.length === 6 && !colors) {
        yield 'records'; colors = services.allocateAttribute('f64', count * 3) as Float64Array;
        yield 'records'; authoredRows = services.allocateAttribute('u8', count) as Uint8Array;
        for (let earlier = 0; earlier < index * 3; earlier++) { yield 'scalars'; colors[earlier] = 1; }
      }
      if (colors) {
        if (row.length === 6) { yield 'scalars'; authoredRows![index] = 1; }
        for (let axis = 0; axis < 3; axis++) { yield 'scalars'; colors[index * 3 + axis] = row.length === 6 ? row[axis + 3]! / 255 : 1; }
      }
      index++;
    }
    if (index !== count) throw new ModelAdmissionError('invalid');
    const attributes: Record<string, ModelAttributeDescriptor> = { position: { array: positions, itemSize: 3, normalized: false, count, stride: 3, offset: 0 } };
    if (colors) attributes['color'] = { array: colors, itemSize: 3, normalized: false, count, stride: 3, offset: 0, colorConversion: { space: 'srgb', scale: 1, output: 'f32', authoredRows } };
    return { protocol: 1, roots: [0], selectedRoot: 0,
      nodes: [{ kind: 'points', name: '', matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], children: [], geometry: 0, materials: [0] }],
      geometries: [{ attributes, index: null, groups: [], drawRange: { start: 0, count: null } }],
      materials: [{ kind: 'points', name: '', color: [1, 1, 1], opacity: 1, transparent: false, alphaTest: 0, depthWrite: true, side: 0, vertexColors: !!colors, size: 1, sizeAttenuation: true, map: null }], textures: [] };
  });
};
