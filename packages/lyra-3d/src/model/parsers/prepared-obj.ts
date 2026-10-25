import { ModelAdmissionError } from '../admission.js';
import type { ModelWorkUnit } from '../model-work.js';
import type { ModelAttributeDescriptor, ModelDescriptor, ModelGeometryDescriptor, ModelMaterialDescriptor, ModelNodeDescriptor, ModelPreparedDecoder } from '../model-prepared-types.js';
import { createModelGeneratorWork } from '../model-work-generator.js';

interface ObjSection {
  name: string; declared: boolean; smooth: boolean; kind: 'mesh' | 'line-segments' | 'points';
  position: number; normal: number; color: number; uv: number;
  positions: number; normals: number; colors: number; uvs: number; hasUV: boolean;
}
const identity = (): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const indexOf = (value: string | undefined, count: number): number => { const index = Number.parseInt(value ?? '', 10); return index >= 0 ? index - 1 : count + index; };

export const createPreparedObj: ModelPreparedDecoder = (input, services) => {
  if (input.plan.format !== 'obj' || input.input.format !== 'obj') throw new ModelAdmissionError('unsupported');
  const plan = input.plan;
  function* decode(): Generator<ModelWorkUnit, ModelDescriptor> {
    yield 'records'; const sourcePositions = services.allocateAttribute('f64', plan.vertices * 3) as Float64Array;
    yield 'records'; const sourceColors = services.allocateAttribute('f64', plan.vertices * 3) as Float64Array;
    yield 'records'; const sourceNormals = services.allocateAttribute('f64', plan.normals * 3) as Float64Array;
    yield 'records'; const sourceUvs = services.allocateAttribute('f64', plan.uvs * 2) as Float64Array;
    yield 'records'; const positions = services.allocateAttribute('f32', input.counts.vertices * 3) as Float32Array;
    yield 'records'; const normals = services.allocateAttribute('f32', input.counts.vertices * 3) as Float32Array;
    yield 'records'; const colors = services.allocateAttribute('f64', input.counts.vertices * 3) as Float64Array;
    yield 'records'; const uvs = services.allocateAttribute('f32', input.counts.vertices * 2) as Float32Array;
    let vertexCount = 0; let normalCount = 0; let uvCount = 0;
    let positionOffset = 0; let normalOffset = 0; let colorOffset = 0; let uvOffset = 0;
    const section = (name: string, declared: boolean): ObjSection => ({ name, declared, smooth: true, kind: 'mesh', position: positionOffset, normal: normalOffset, color: colorOffset, uv: uvOffset, positions: 0, normals: 0, colors: 0, uvs: 0, hasUV: false });
    let current = section('', false); const sections = [current];
    function* addPosition(index: number): Generator<ModelWorkUnit, void> {
      for (let axis = 0; axis < 3; axis++) { yield 'scalars'; positions[positionOffset++] = sourcePositions[index * 3 + axis]!; current.positions++; }
    }
    function* addColor(index: number): Generator<ModelWorkUnit, void> {
      if (Number.isNaN(sourceColors[index * 3]!)) return;
      for (let axis = 0; axis < 3; axis++) { yield 'scalars'; colors[colorOffset++] = sourceColors[index * 3 + axis]!; current.colors++; }
    }
    function* face(a: string[], b: string[], c: string[]): Generator<ModelWorkUnit, void> {
      const references = [a, b, c];
      const vertices = references.map(reference => indexOf(reference[0], vertexCount));
      for (const vertex of vertices) yield* addPosition(vertex);
      for (const vertex of vertices) yield* addColor(vertex);
      if (a[2] !== undefined && a[2] !== '') {
        for (const reference of references) for (let axis = 0; axis < 3; axis++) {
          yield 'scalars'; normals[normalOffset++] = sourceNormals[indexOf(reference[2], normalCount) * 3 + axis]!; current.normals++;
        }
      } else {
        yield 'records';
        const [ia, ib, ic] = vertices as [number, number, number];
        const ab = [0, 1, 2].map(axis => sourcePositions[ia * 3 + axis]! - sourcePositions[ib * 3 + axis]!);
        const cb = [0, 1, 2].map(axis => sourcePositions[ic * 3 + axis]! - sourcePositions[ib * 3 + axis]!);
        const value = [cb[1]! * ab[2]! - cb[2]! * ab[1]!, cb[2]! * ab[0]! - cb[0]! * ab[2]!, cb[0]! * ab[1]! - cb[1]! * ab[0]!];
        const inverseLength = 1 / (Math.sqrt(value[0]! * value[0]! + value[1]! * value[1]! + value[2]! * value[2]!) || 1);
        for (let vertex = 0; vertex < 3; vertex++) for (let axis = 0; axis < 3; axis++) {
          yield 'scalars'; normals[normalOffset++] = value[axis]! * inverseLength; current.normals++;
        }
      }
      const hasUV = a[1] !== undefined && a[1] !== '';
      if (hasUV) current.hasUV = true;
      for (const reference of references) for (let axis = 0; axis < 2; axis++) {
        yield 'scalars'; uvs[uvOffset++] = hasUV ? sourceUvs[indexOf(reference[1], uvCount) * 2 + axis]! : 0; current.uvs++;
      }
    }
    const bytes = input.input.bytes; const decoder = new TextDecoder(); let start = 0;
    for (let offset = 0; offset <= bytes.length; offset++) {
      if (offset < bytes.length) { yield 'bytes'; if (bytes[offset] !== 10) continue; }
      if (offset === bytes.length && start === offset) break;
      yield 'records';
      let line = decoder.decode(bytes.subarray(start, offset)); start = offset + 1;
      if (line.endsWith('\r')) line = line.slice(0, -1);
      line = line.trimStart();
      if (!line || line.startsWith('#')) continue;
      const row = line.split(/\s+/); const directive = row[0];
      if (directive === 'v') {
        for (let axis = 0; axis < 3; axis++) { yield 'scalars'; sourcePositions[vertexCount * 3 + axis] = Number.parseFloat(row[axis + 1]!); }
        for (let axis = 0; axis < 3; axis++) { yield 'scalars'; sourceColors[vertexCount * 3 + axis] = row.length >= 7 ? Number.parseFloat(row[axis + 4]!) : NaN; }
        vertexCount++;
      } else if (directive === 'vn') {
        for (let axis = 0; axis < 3; axis++) { yield 'scalars'; sourceNormals[normalCount * 3 + axis] = Number.parseFloat(row[axis + 1]!); }
        normalCount++;
      } else if (directive === 'vt') {
        for (let axis = 0; axis < 2; axis++) { yield 'scalars'; sourceUvs[uvCount * 2 + axis] = Number.parseFloat(row[axis + 1]!); }
        uvCount++;
      } else if (directive === 'o' || directive === 'g') {
        const name = line.slice(1).trim();
        if (!current.declared) { current.name = name; current.declared = true; }
        else { current = section(name, true); sections.push(current); }
      } else if (directive === 's') {
        const value = line.split(' ')[1]; current.smooth = value === undefined || !['0', 'off'].includes(value.trim().toLowerCase());
      } else if (directive === 'f') {
        const values = line.slice(1).trim().split(/\s+/);
        const first = values[0]!.split('/');
        for (let index = 1; index < values.length - 1; index++) {
          yield 'records'; yield* face(first, values[index]!.split('/'), values[index + 1]!.split('/'));
        }
      } else if (directive === 'p') {
        current.kind = 'points';
        for (const reference of line.slice(1).trim().split(' ')) { const index = indexOf(reference, vertexCount); yield* addPosition(index); yield* addColor(index); }
      } else if (directive === 'l') {
        current.kind = 'line-segments';
        const values = line.slice(1).trim().split(' '); const hasUV = line.includes('/');
        for (const reference of values) yield* addPosition(indexOf(reference.split('/')[0], vertexCount));
        if (hasUV) for (const reference of values) {
          const part = reference.split('/')[1];
          for (let axis = 0; axis < 2; axis++) { yield 'scalars'; uvs[uvOffset++] = sourceUvs[indexOf(part, uvCount) * 2 + axis]!; current.uvs++; }
        }
      }
    }
    const nodes: ModelNodeDescriptor[] = [{ kind: 'group', name: '', matrix: identity(), children: [], geometry: null, materials: [] }];
    const children: number[] = []; const geometries: ModelGeometryDescriptor[] = []; const materials: ModelMaterialDescriptor[] = [];
    const cache = new Map<string, number>();
    const attribute = (array: Float32Array | Float64Array, itemSize: 2 | 3): ModelAttributeDescriptor => ({ array, itemSize, normalized: false, count: array.length / itemSize, stride: itemSize, offset: 0 });
    const cloud = sections.length === 1 && current.positions === 0;
    if (cloud && vertexCount) {
      current.kind = 'points'; current.name = ''; current.smooth = true;
      for (let index = 0; index < vertexCount; index++) yield* addPosition(index);
      if (!Number.isNaN(sourceColors[0]!)) for (let index = 0; index < vertexCount; index++) for (let axis = 0; axis < 3; axis++) {
        yield 'scalars'; colors[colorOffset++] = sourceColors[index * 3 + axis]!; current.colors++;
      }
    }
    for (const object of sections) {
      yield 'records'; if (!object.positions) continue;
      const attributes: Record<string, ModelAttributeDescriptor> = { position: attribute(positions.subarray(object.position, object.position + object.positions), 3) };
      if (object.normals) attributes['normal'] = attribute(normals.subarray(object.normal, object.normal + object.normals), 3);
      if (object.colors) attributes['color'] = { ...attribute(colors.subarray(object.color, object.color + object.colors), 3), colorConversion: { space: 'srgb', scale: 1, output: 'f32' } };
      if (object.hasUV) attributes['uv'] = attribute(uvs.subarray(object.uv, object.uv + object.uvs), 2);
      const key = `${object.smooth}_${!!object.colors}`;
      let material = cache.get(key);
      if (material === undefined) {
        material = materials.length;
        const base = { name: '', color: [1, 1, 1] as const, opacity: 1, transparent: false, alphaTest: 0, depthWrite: true, side: 0 as const, vertexColors: !!object.colors, ...(!cloud ? { flatShading: !object.smooth } : {}) };
        if (object.kind === 'points') materials.push({ ...base, kind: 'points', size: 1, sizeAttenuation: false, map: null });
        else if (object.kind === 'line-segments') materials.push({ ...base, kind: 'line-basic', linewidth: 1, map: null });
        else materials.push({ ...base, kind: 'mesh-phong', flatShading: !object.smooth, emissive: [0, 0, 0], specular: [17 / 255, 17 / 255, 17 / 255], specularConversion: 'srgb', shininess: 30, aoMapIntensity: 1 });
        cache.set(key, material);
      }
      const geometry = geometries.length; geometries.push({ attributes, index: null, groups: [], drawRange: { start: 0, count: null } });
      children.push(nodes.length); nodes.push({ kind: object.kind, name: object.name, matrix: identity(), children: [], geometry, materials: [material] });
    }
    nodes[0] = { ...nodes[0]!, children };
    return { protocol: 1, roots: [0], selectedRoot: 0, nodes, geometries, materials, textures: [] };
  }
  return createModelGeneratorWork(decode);
};
