import { Matrix4, Vector3 } from 'three';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import { modelAdmissionCheck as check } from './model-admission-policy.js';
import type { AdmittedModelInput, ModelAttributeDescriptor, ModelDescriptor, ModelNumericArray } from './model-prepared-types.js';
import { createModelGeneratorWork, type ModelWorkGenerator } from './model-work-generator.js';

function record(value: unknown): Record<string, unknown> { check(value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)); return value as Record<string, unknown>; }
function fields(value: unknown, names: readonly string[]): Record<string, unknown> { const result = record(value); for (const key in result) if (Object.hasOwn(result, key)) { check(names.includes(key)); check(Object.hasOwn(Object.getOwnPropertyDescriptor(result, key)!, 'value')); } return result; }
function integer(value: unknown, max: number): number { check(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max); return value; }
function finite(value: unknown): number { check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LIMIT.coordinate); return value; }
function boolean(value: unknown): void { check(typeof value === 'boolean'); }
function list(value: unknown, max: number): unknown[] { check(Array.isArray(value) && value.length <= max); return value; }
function tuple(value: unknown, length: number): void { const values = list(value, length); check(values.length === length); for (let index = 0; index < length; index++) finite(values[index]); }
function name(value: unknown): void { check(typeof value === 'string' && value.length <= 16384); }
function reference(value: unknown, length: number): number { return integer(value, length - 1); }
const arrays = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
function numericArray(value: unknown): ModelNumericArray { check(arrays.some(kind => value instanceof kind)); const result = value as ModelNumericArray; check(result.buffer instanceof ArrayBuffer && !('resizable' in result.buffer && result.buffer.resizable)); try { check(new Uint8Array(result.buffer, 0, 0).byteLength === 0); } catch { check(false); } return result; }
function component(attribute: ModelAttributeDescriptor, row: number, axis: number): number {
  const value = attribute.array[row * attribute.stride + attribute.offset + axis]!;
  if (!attribute.normalized || attribute.colorConversion) return value;
  if (attribute.array instanceof Uint8Array || attribute.array instanceof Uint8ClampedArray) return value / 255;
  if (attribute.array instanceof Uint16Array) return value / 65535;
  if (attribute.array instanceof Uint32Array) return value / 4294967295;
  if (attribute.array instanceof Int8Array) return Math.max(value / 127, -1);
  if (attribute.array instanceof Int16Array) return Math.max(value / 32767, -1);
  if (attribute.array instanceof Int32Array) return Math.max(value / 2147483647, -1);
  return value;
}

export function* validateModelDescriptor(value: unknown, admitted: AdmittedModelInput): ModelWorkGenerator<ModelDescriptor> {
  yield 'records';
  const data = fields(value, ['protocol', 'roots', 'selectedRoot', 'nodes', 'geometries', 'materials', 'textures']); check(data['protocol'] === 1);
  const nodes = list(data['nodes'], LIMIT.entries * 3); const geometries = list(data['geometries'], LIMIT.entries);
  const materials = list(data['materials'], LIMIT.entries * 3); const textures = list(data['textures'], LIMIT.entries * 6);
  const roots = list(data['roots'], LIMIT.entries + 1); reference(data['selectedRoot'], nodes.length);
  const buffers = new Set<ArrayBuffer>(); let bytes = 0;
  const charge = (array: ModelNumericArray): void => { const buffer = array.buffer as ArrayBuffer; if (buffers.has(buffer)) return; buffers.add(buffer); bytes += buffer.byteLength; check(bytes <= admitted.counts.decodedBytes && bytes <= LIMIT.decodedBytes); };
  const attribute = function* (value: unknown, count: number): ModelWorkGenerator<ModelAttributeDescriptor> {
    yield 'records'; const entry = fields(value, ['array', 'itemSize', 'normalized', 'count', 'stride', 'offset', 'colorConversion']);
    const array = numericArray(entry['array']); charge(array);
    const size = integer(entry['itemSize'], 4); check(size >= 1); boolean(entry['normalized']); check(entry['count'] === count);
    const stride = integer(entry['stride'], array.length + 4); const offset = integer(entry['offset'], array.length + 4);
    check(stride >= size && offset + size <= stride && array.length === count * stride);
    if (entry['colorConversion'] !== undefined) {
      const conversion = fields(entry['colorConversion'], ['space', 'scale', 'output', 'authoredRows']);
      check(size === 3 && stride === 3 && offset === 0 && count * 3 === array.length);
      check(conversion['space'] === 'srgb');
      if (conversion['authoredRows'] !== undefined) {
        check(admitted.input.format === 'xyz'); const mask = conversion['authoredRows'];
        check(mask instanceof Uint8Array && mask.length === count); numericArray(mask); charge(mask);
        for (let row = 0; row < mask.length; row++) { yield 'scalars'; check(mask[row] === 0 || mask[row] === 1); if (mask[row] === 0) check(array[row * 3] === 1 && array[row * 3 + 1] === 1 && array[row * 3 + 2] === 1); }
      }
      if (admitted.input.format === 'ply') check(array instanceof Uint8Array && conversion['scale'] === 255 && conversion['output'] === 'u8-normalized' && entry['normalized'] === true);
      else if (admitted.input.format === 'pcd') check(array instanceof Uint8Array && conversion['scale'] === 255 && conversion['output'] === 'f32' && entry['normalized'] === false);
      else { check(['obj', 'stl', 'xyz'].includes(admitted.input.format)); check(array instanceof Float64Array && conversion['scale'] === 1 && conversion['output'] === 'f32' && entry['normalized'] === false); }
    }
    const result = entry as unknown as ModelAttributeDescriptor;
    for (let row = 0; row < count; row++) for (let axis = 0; axis < size; axis++) { yield 'scalars'; finite(component(result, row, axis)); }
    return result;
  };
  const positions: ModelAttributeDescriptor[] = []; const indexCounts: number[] = [];
  for (const raw of geometries) {
    yield 'records'; const geometry = fields(raw, ['attributes', 'index', 'indexAttribute', 'groups', 'drawRange', 'groupNames', 'hasColors', 'alpha']);
    check(geometry['index'] === null || geometry['indexAttribute'] === undefined);
    const attributes = fields(geometry['attributes'], ['position', 'normal', 'color', 'uv', 'uv1', 'tangent']);
    const position = record(attributes['position']); check(position['itemSize'] === 3); const count = integer(position['count'], LIMIT.vertices);
    let found: ModelAttributeDescriptor | undefined;
    for (const key in attributes) {
      if (!Object.hasOwn(attributes, key)) continue;
      const parsed = yield* attribute(attributes[key], count); if (key === 'position') found = parsed;
      check(key === 'color' || parsed.colorConversion === undefined);
      if (parsed.array instanceof Float64Array && !parsed.colorConversion) {
        check(admitted.plan.format === 'ply');
        const properties = admitted.plan.elements.find(element => element.name === 'vertex')!.properties;
        const component = key === 'position' ? 'x' : key === 'normal' ? 'nx' : key === 'uv' ? properties.some(property => property.name === 's') ? 's' : 'u' : '';
        const property = properties.find(property => property.name === component);
        check(property?.kind === 'scalar' && property.scalar.kind === 'float' && property.scalar.bytes === 8);
      }
    }
    check(found); positions.push(found);
    let indexCount = 0;
    if (geometry['index'] !== null) {
      const index = geometry['index']; check(index instanceof Uint8Array || index instanceof Uint16Array || index instanceof Uint32Array);
      numericArray(index); charge(index); indexCount = index.length; check(indexCount <= LIMIT.indices);
      for (const item of index) { yield 'scalars'; reference(item, count); }
    }
    if (geometry['indexAttribute'] !== undefined) {
      const raw = record(geometry['indexAttribute']); indexCount = integer(raw['count'], LIMIT.indices);
      const parsed = yield* attribute(raw, indexCount);
      check(parsed.itemSize === 1 && !parsed.normalized && parsed.colorConversion === undefined && (parsed.array instanceof Uint8Array || parsed.array instanceof Uint16Array || parsed.array instanceof Uint32Array));
      for (let row = 0; row < indexCount; row++) { yield 'scalars'; reference(component(parsed, row, 0), count); }
    }
    const drawLength = geometry['index'] !== null || geometry['indexAttribute'] !== undefined ? indexCount : count;
    indexCounts.push(indexCount);
    for (const group of list(geometry['groups'], LIMIT.entries)) { yield 'records'; const entry = fields(group, ['start', 'count', 'materialIndex']); const start = integer(entry['start'], drawLength); const length = integer(entry['count'], drawLength); check(start + length <= (drawLength)); integer(entry['materialIndex'], LIMIT.entries); }
    const range = fields(geometry['drawRange'], ['start', 'count']); const start = integer(range['start'], drawLength); if (range['count'] !== null) check(start + integer(range['count'], drawLength) <= (drawLength));
    if (geometry['groupNames'] !== undefined) { check(admitted.input.format === 'stl'); for (const item of list(geometry['groupNames'], LIMIT.entries)) { yield 'records'; name(item); } }
    if (geometry['hasColors'] !== undefined) { check(admitted.input.format === 'stl'); boolean(geometry['hasColors']); }
    if (geometry['alpha'] !== undefined) { check(admitted.input.format === 'stl'); const alpha = finite(geometry['alpha']); check(alpha >= 0 && alpha <= 1); }
  }
  let imagePixels = 0;
  for (const resource of admitted.resources) if (resource.kind === 'image') { yield 'records'; imagePixels += resource.width! * resource.height!; }
  check(imagePixels <= admitted.counts.imagePixels && imagePixels <= LIMIT.totalImagePixels);
  const textureVariants = new Set<string>();
  let textureInstances = 0;
  if (admitted.plan.format === 'gltf' || admitted.plan.format === 'glb') {
    const document = admitted.plan.document;
    textureInstances = Array.isArray(document['textures']) ? document['textures'].length : 0;
    for (const source of Array.isArray(document['materials']) ? document['materials'] : []) {
      yield 'records'; const material = record(source);
      for (const key of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) if (material[key] !== undefined) textureInstances++;
      if (material['pbrMetallicRoughness'] !== undefined) {
        const pbr = record(material['pbrMetallicRoughness']);
        if (pbr['baseColorTexture'] !== undefined) textureInstances++;
        if (pbr['metallicRoughnessTexture'] !== undefined) textureInstances += 2;
      }
    }
  }
  check(textures.length <= textureInstances);
  for (const raw of textures) {
    yield 'records'; check(admitted.input.format === 'gltf' || admitted.input.format === 'glb');
    const entry = fields(raw, ['name', 'resource', 'magFilter', 'minFilter', 'wrapS', 'wrapT', 'texCoord', 'colorSpace', 'flipY', 'generateMipmaps']); name(entry['name']);
    const resource = admitted.resources[reference(entry['resource'], admitted.resources.length)]!; check(resource.kind === 'image');
    check([9728, 9729].includes(finite(entry['magFilter']))); check([9728, 9729, 9984, 9985, 9986, 9987].includes(finite(entry['minFilter'])));
    check([33071, 33648, 10497].includes(finite(entry['wrapS'])) && [33071, 33648, 10497].includes(finite(entry['wrapT'])));
    integer(entry['texCoord'], 1); check(entry['colorSpace'] === 'none' || entry['colorSpace'] === 'srgb'); boolean(entry['flipY']); boolean(entry['generateMipmaps']);
    // Native clones share Source; UV channels do not create a distinct GPU texture variant.
    const variant = [entry['resource'], entry['magFilter'], entry['minFilter'], entry['wrapS'], entry['wrapT'], entry['colorSpace'], entry['flipY'], entry['generateMipmaps']].join(':');
    if (!textureVariants.has(variant)) { textureVariants.add(variant); imagePixels += resource.width! * resource.height!; }
    check(imagePixels <= admitted.counts.imagePixels && imagePixels <= LIMIT.totalImagePixels);
  }
  const textureReference = (value: unknown): void => { if (value !== null) reference(value, textures.length); };
  for (const raw of materials) {
    yield 'records'; const material = fields(raw, ['kind', 'name', 'color', 'opacity', 'transparent', 'alphaTest', 'depthWrite', 'side', 'vertexColors', 'flatShading', 'colorConversion', 'emissiveConversion', 'specularConversion', 'size', 'sizeAttenuation', 'map', 'linewidth', 'emissive', 'specular', 'shininess', 'roughness', 'metalness', 'normalScale', 'aoMapIntensity', 'maps']);
    name(material['name']); tuple(material['color'], 3); finite(material['opacity']); finite(material['alphaTest']); boolean(material['transparent']); boolean(material['depthWrite']); boolean(material['vertexColors']); integer(material['side'], 2);
    if (material['flatShading'] !== undefined) boolean(material['flatShading']);
    if (material['colorConversion'] !== undefined) { check(admitted.input.format === 'gltf' || admitted.input.format === 'glb'); check(material['colorConversion'] === 'srgb' || material['colorConversion'] === 'linear-srgb'); }
    if (material['kind'] === 'points') { finite(material['size']); boolean(material['sizeAttenuation']); textureReference(material['map']); }
    else if (material['kind'] === 'line-basic') { finite(material['linewidth']); textureReference(material['map']); }
    else if (material['kind'] === 'mesh-phong') { check(admitted.input.format === 'obj'); boolean(material['flatShading']); tuple(material['emissive'], 3); tuple(material['specular'], 3); finite(material['shininess']); finite(material['aoMapIntensity']); if (material['specularConversion'] !== undefined) check(material['specularConversion'] === 'srgb'); }
    else {
      check(material['kind'] === 'mesh-standard'); boolean(material['flatShading']); tuple(material['emissive'], 3); tuple(material['normalScale'], 2); finite(material['roughness']); finite(material['metalness']); finite(material['aoMapIntensity']);
      if (material['emissiveConversion'] !== undefined) { check(admitted.input.format === 'gltf' || admitted.input.format === 'glb'); check(material['emissiveConversion'] === 'linear-srgb'); }
      const maps = fields(material['maps'], ['baseColor', 'normal', 'metalness', 'roughness', 'emissive', 'ao']); for (const key of ['baseColor', 'normal', 'metalness', 'roughness', 'emissive', 'ao']) textureReference(maps[key]);
    }
  }
  const parents = new Int32Array(nodes.length); parents.fill(-1); let vertices = 0; let indices = 0; let drawables = 0;
  for (let index = 0; index < nodes.length; index++) {
    yield 'records'; const node = fields(nodes[index], ['kind', 'name', 'matrix', 'children', 'geometry', 'materials']); name(node['name']); tuple(node['matrix'], 16);
    check(typeof node['kind'] === 'string' && ['object', 'group', 'mesh', 'points', 'line', 'line-segments', 'line-loop'].includes(node['kind']));
    const ids = list(node['materials'], LIMIT.entries);
    for (const id of ids) { yield 'records'; reference(id, materials.length); }
    if (node['geometry'] === null) check((node['kind'] === 'object' || node['kind'] === 'group') && ids.length === 0);
    else {
      const geometry = reference(node['geometry'], geometries.length); check(node['kind'] !== 'object' && node['kind'] !== 'group' && ids.length > 0);
      if (ids.length > 1) for (const group of (record(geometries[geometry])['groups'] as Record<string, unknown>[])) reference(group['materialIndex'], ids.length);
      vertices += positions[geometry]!.count; indices += indexCounts[geometry]!; check(++drawables <= LIMIT.entries && vertices <= admitted.counts.vertices && indices <= admitted.counts.indices);
    }
    for (const child of list(node['children'], LIMIT.entries)) { yield 'records'; const id = reference(child, nodes.length); check(id !== index && parents[id] === -1); parents[id] = index; }
  }
  const rootSet = new Set<number>();
  for (const root of roots) { yield 'records'; const id = reference(root, nodes.length); check(parents[id] === -1 && !rootSet.has(id)); rootSet.add(id); }
  check(rootSet.has(data['selectedRoot'] as number));
  const reachable = new Set<number>(); const pending = [...rootSet];
  while (pending.length) { yield 'records'; const id = pending.pop()!; check(!reachable.has(id)); reachable.add(id); for (const child of record(nodes[id])['children'] as number[]) { yield 'records'; pending.push(child); } }
  check(reachable.size === nodes.length);
  const matrices: (Matrix4 | undefined)[] = []; const depths: number[] = []; const active = new Set<number>(); const point = new Vector3();
  const visit = function* (index: number, depth: number): ModelWorkGenerator<Matrix4> {
    yield 'records'; check(depth <= LIMIT.jsonDepth * 3 && !active.has(index)); if (matrices[index]) return matrices[index]!;
    active.add(index); const node = record(nodes[index]); const matrix = new Matrix4().fromArray(node['matrix'] as number[]);
    const parent = parents[index]!; if (parent !== -1) matrix.premultiply(yield* visit(parent, depth + 1));
    depths[index] = parent === -1 ? 0 : depths[parent]! + 1; check(depths[index]! <= LIMIT.jsonDepth * 3);
    matrix.elements.forEach(finite); matrices[index] = matrix; active.delete(index);
    if (node['geometry'] !== null) {
      const position = positions[node['geometry'] as number]!;
      for (let row = 0; row < position.count; row++) { yield 'records'; point.set(component(position, row, 0), component(position, row, 1), component(position, row, 2)).applyMatrix4(matrix); finite(point.x); finite(point.y); finite(point.z); }
    }
    return matrix;
  };
  for (let index = 0; index < nodes.length; index++) yield* visit(index, 0);
  return value as ModelDescriptor;
}
export const createModelDescriptorValidation = (value: unknown, admitted: AdmittedModelInput) => createModelGeneratorWork(() => validateModelDescriptor(value, admitted));
