import { ModelAdmissionError } from '../admission.js';
import type { ModelWorkUnit } from '../model-work.js';
import { createModelGeneratorWork } from '../model-work-generator.js';
import type { ModelAttributeDescriptor, ModelDescriptor, ModelGeometryDescriptor, ModelMaterialDescriptor, ModelPreparedDecoder } from '../model-prepared-types.js';

const identity = (): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export const createPreparedStl: ModelPreparedDecoder = (input, services) => {
  if (input.plan.format !== 'stl' || input.input.format !== 'stl') throw new ModelAdmissionError('unsupported');
  const plan = input.plan;
  function* decode(): Generator<ModelWorkUnit, ModelDescriptor> {
    const bytes = input.input.bytes;
    // The native loader probes its binary face count before checking the ASCII prefix.
    if (bytes.length < 84) throw new ModelAdmissionError('invalid');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    yield 'scalars'; const binaryFacets = view.getUint32(80, true);
    let variant = plan.variant;
    if (84 + binaryFacets * 50 === bytes.length) variant = 'binary';
    else {
      let asciiPrefix = false;
      for (let offset = 0; offset < 5; offset++) {
        yield 'records';
        if (bytes[offset] === 115 && bytes[offset + 1] === 111 && bytes[offset + 2] === 108 && bytes[offset + 3] === 105 && bytes[offset + 4] === 100) asciiPrefix = true;
      }
      variant = asciiPrefix ? 'ascii' : 'binary';
    }
    const facets = variant === 'binary' ? binaryFacets : plan.facets;
    // Native binary probing can select a different route than admission; refuse its oversized output before allocation.
    if (facets * 3 > input.counts.vertices || (variant === 'binary' && facets > 0 && 84 + facets * 50 - 2 > bytes.length)) throw new ModelAdmissionError('invalid');
    const count = facets * 9;
    yield 'records'; const positions = services.allocateAttribute('f32', count) as Float32Array;
    yield 'records'; const normals = services.allocateAttribute('f32', count) as Float32Array;
    let colors: Float64Array | undefined;
    let alpha: number | undefined;
    const groups: { start: number; count: number; materialIndex: number }[] = [];
    const groupNames: string[] = [];
    if (variant === 'binary') {
      let defaultColor: [number, number, number] | undefined;
      for (let index = 0; index < 70; index++) {
        yield 'bytes';
        if (view.getUint32(index, false) === 0x434f4c4f && view.getUint8(index + 4) === 0x52 && view.getUint8(index + 5) === 0x3d) {
          defaultColor = [view.getUint8(index + 6) / 255, view.getUint8(index + 7) / 255, view.getUint8(index + 8) / 255];
          alpha = view.getUint8(index + 9) / 255;
        }
      }
      if (defaultColor) {
        if (facets > 0 && 84 + facets * 50 > bytes.length) throw new ModelAdmissionError('invalid');
        yield 'records'; colors = services.allocateAttribute('f64', count) as Float64Array; }
      for (let face = 0; face < facets; face++) {
        const start = 84 + face * 50;
        let color = defaultColor;
        if (color) {
          yield 'scalars'; const packed = view.getUint16(start + 48, true);
          if (!(packed & 0x8000)) color = [(packed & 31) / 31, ((packed >> 5) & 31) / 31, ((packed >> 10) & 31) / 31];
        }
        for (let vertex = 0; vertex < 3; vertex++) for (let axis = 0; axis < 3; axis++) {
          const target = face * 9 + vertex * 3 + axis;
          yield 'scalars'; positions[target] = view.getFloat32(start + 12 + vertex * 12 + axis * 4, true);
          yield 'scalars'; normals[target] = view.getFloat32(start + axis * 4, true);
          if (colors && color) { yield 'scalars'; colors[target] = color[axis]!; }
        }
      }
    } else {
      const decoder = new TextDecoder(); let start = 0; let output = 0; let groupStart = 0;
      let normal = [0, 0, 0]; let pendingName = -1;
      for (let offset = 0; offset <= bytes.length; offset++) {
        if (offset < bytes.length) { yield 'bytes'; if (bytes[offset] !== 10) continue; }
        if (offset === bytes.length && start === offset) break;
        yield 'records';
        const line = decoder.decode(bytes.subarray(start, offset)); start = offset + 1;
        const row = line.trim().split(/\s+/);
        if (pendingName >= 0) {
          const ending = line.indexOf('endsolid');
          groupNames[pendingName] = (ending >= 0 ? line.slice(0, ending + 8) : line).match(/^[^\r\n]+/)?.[0] ?? '';
          pendingName = -1;
        }
        if (row[0] === 'solid') {
          groupStart = output / 3; groupNames.push(line.match(/solid\s(.+)/)?.[1] ?? '');
          if (/solid$/.test(line)) pendingName = groupNames.length - 1;
        }
        else if (row[0] === 'facet') normal = row.slice(2).map(Number);
        else if (row[0] === 'vertex') for (let axis = 0; axis < 3; axis++) {
          yield 'scalars'; positions[output] = Number(row[axis + 1]);
          yield 'scalars'; normals[output++] = normal[axis]!;
        }
        else if (row[0] === 'endsolid') groups.push({ start: groupStart, count: output / 3 - groupStart, materialIndex: groups.length });
      }
    }
    const attribute = (array: Float32Array | Float64Array): ModelAttributeDescriptor => ({ array, itemSize: 3, normalized: false, count: array.length / 3, stride: 3, offset: 0 });
    const attributes: Record<string, ModelAttributeDescriptor> = { position: attribute(positions), normal: attribute(normals) };
    if (colors) attributes['color'] = { ...attribute(colors), colorConversion: { space: 'srgb', scale: 1, output: 'f32' } };
    const geometry: ModelGeometryDescriptor = { attributes, index: null, groups, drawRange: { start: 0, count: null },
      ...(variant === 'ascii' ? { groupNames } : {}), ...(colors ? { hasColors: true, alpha } : {}) };
    const material: ModelMaterialDescriptor = {
      kind: 'mesh-standard', name: '', color: [1, 1, 1], opacity: 1, transparent: false, alphaTest: 0, depthWrite: true, side: 0,
      vertexColors: !!colors, flatShading: false, roughness: 1, metalness: 0, emissive: [0, 0, 0], normalScale: [1, 1], aoMapIntensity: 1,
      maps: { baseColor: null, normal: null, metalness: null, roughness: null, emissive: null, ao: null },
    };
    return { protocol: 1, roots: [0], selectedRoot: 0, nodes: [{ kind: 'mesh', name: '', matrix: identity(), children: [], geometry: 0, materials: [0] }], geometries: [geometry], materials: [material], textures: [] };
  }
  return createModelGeneratorWork(decode);
};
