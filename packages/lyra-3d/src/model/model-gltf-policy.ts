import { ModelJsonString } from './model-json-string.js';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import { modelAdmissionCheck as check, modelAdmissionInteger as integer, modelAdmissionNumber as number, chargeModelBytes as charge, chargeModelGeometry as geometry, type ModelResourceBudget as Budget } from './model-admission-policy.js';
import type { AdmittedFormatPlan, ModelJsonRecord, ModelPreparedResource } from './model-prepared-types.js';
import type { ModelWorkGenerator } from './model-work-generator.js';
import { readModelJson } from './model-json-work.js';
import { readModelDataUri as dataUri } from './model-resource-work.js';
type RecordValue = Record<string, unknown>;
type ImageMime = 'image/png' | 'image/jpeg';
interface Accessor { count: number; components: number; component: number; normalized: boolean; max: number; type: string; bounds: boolean }
interface BufferView { bytes: Uint8Array<ArrayBuffer>; stride: number; offset: number }
function* mapRecords<T, U>(values: readonly T[], visit: (value: T, index: number) => ModelWorkGenerator<U>): ModelWorkGenerator<U[]> {
  const result: U[] = [];
  for (let index = 0; index < values.length; index++) { yield 'records'; result.push(yield* visit(values[index]!, index)); }
  return result;
}
function object(value: unknown): RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof ModelJsonString)); return value as RecordValue;
}
function* fields(value: unknown, names: string[]): ModelWorkGenerator<RecordValue> {
  const record = object(value);
  for (const key in record) {
    if (!Object.hasOwn(record, key)) continue;
    yield 'records';
    check(names.includes(key) || key === 'name', 'unsupported');
    if (key === 'name') check(typeof record[key] === 'string' && record[key].length <= 1024);
  }
  return record;
}
function array(value: unknown, max: number = LIMIT.entries): unknown[] {
  if (value === undefined) return [];
  check(Array.isArray(value)); check(value.length <= max, 'limit'); return value;
}
function reference<T>(value: unknown, entries: readonly T[]): T {
  const index = integer(value); check(index < entries.length); return entries[index]!;
}
function vector(value: unknown, size: number): void {
  check(Array.isArray(value) && value.length === size); value.forEach(number);
}
function* imageMetadata(bytes: Uint8Array, mime: ImageMime, budget: Budget): ModelWorkGenerator<{ width: number; height: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0; let height = 0;
  if (mime === 'image/png') {
    check(bytes.length >= 45 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value));
    let offset = 8; let ended = false; let idat = false; let chunks = 0;
    while (offset < bytes.length) {
      yield 'records';
      check(++chunks <= LIMIT.entries, 'limit');
      check(offset + 12 <= bytes.length);
      const length = view.getUint32(offset); check(offset + 12 + length <= bytes.length);
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (offset === 8) {
        check(type === 'IHDR' && length === 13);
        width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
        const depth = bytes[offset + 16]; const color = bytes[offset + 17];
        check(depth === 8 && (color === 0 || color === 2 || color === 4 || color === 6), 'unsupported');
        check(bytes[offset + 18] === 0 && bytes[offset + 19] === 0 && bytes[offset + 20] === 0, 'unsupported');
      } else {
        // Restrict metadata and animation chunks to avoid independently compressed or multi-frame content.
        check(['IDAT', 'IEND'].includes(type), 'unsupported');
        if (type === 'IDAT') { check(!ended && length > 0); idat = true; }
        if (type === 'IEND') { check(length === 0 && idat && offset + 12 === bytes.length); ended = true; }
      }
      offset += 12 + length;
    }
    check(ended);
  } else {
    check(bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216);
    let offset = 2; let scan = false; let segments = 0;
    while (offset < bytes.length) {
      yield 'records';
      check(++segments <= LIMIT.entries, 'limit');
      check(bytes[offset++] === 255);
      while (bytes[offset] === 255) { yield 'bytes'; offset++; }
      const marker = bytes[offset++]; check(marker !== undefined);
      if (marker === 217) { check(scan && offset === bytes.length); break; }
      check(marker !== 0 && marker !== 216 && !(marker >= 208 && marker <= 215));
      check(offset + 2 <= bytes.length);
      const length = view.getUint16(offset); check(length >= 2 && offset + length <= bytes.length);
      if (marker === 192 || marker === 194) {
        check(!width && length >= 8 && bytes[offset + 2] === 8);
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5);
        const channels = bytes[offset + 7]; check(channels === 1 || channels === 3, 'unsupported');
        check(length === 8 + 3 * channels);
      } else if (marker === 224) {
        // The common JFIF header is supported without its optional embedded thumbnail.
        check(length === 16 && String.fromCharCode(...bytes.subarray(offset + 2, offset + 7)) === 'JFIF\0', 'unsupported');
        check(bytes[offset + 14] === 0 && bytes[offset + 15] === 0, 'unsupported');
      } else if (marker === 238) {
        check(length === 14 && String.fromCharCode(...bytes.subarray(offset + 2, offset + 7)) === 'Adobe', 'unsupported');
      } else check([196, 219, 221, 218].includes(marker), 'unsupported');
      // Excludes DNL, extra frames, thumbnails, EXIF/ICC and independently compressed metadata.
      offset += length;
      if (marker === 218) {
        check(width > 0); scan = true;
        while (offset < bytes.length) {
      yield 'records';
          if (bytes[offset] !== 255) { offset++; continue; }
          const next = bytes[offset + 1];
          if (next === 0 || (next !== undefined && next >= 208 && next <= 215)) offset += 2;
          else break;
        }
      }
    }
    check(scan && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217);
  }
  integer(width, LIMIT.textureAxis, 1); integer(height, LIMIT.textureAxis, 1);
  const pixels = width * height; check(pixels <= LIMIT.imagePixels, 'limit');
  budget.pixels += pixels; check(budget.pixels <= LIMIT.totalImagePixels, 'limit');
  charge(budget, Math.ceil(pixels * 4 * 4 / 3));
  return { width, height };
}
function* unpackGlb(bytes: Uint8Array<ArrayBuffer>): ModelWorkGenerator<{ document: RecordValue; bin?: Uint8Array<ArrayBuffer> }> {
  check(bytes.length >= 20);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  check(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.length);
  let offset = 12; let document: RecordValue | undefined; let bin: Uint8Array<ArrayBuffer> | undefined;
  while (offset < bytes.length) {
      yield 'records';
    check(offset + 8 <= bytes.length);
    const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true);
    check(length % 4 === 0 && length > 0 && offset + 8 + length <= bytes.length);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (!document) { check(type === 0x4e4f534a); document = yield* readModelJson(chunk); }
    else { check(type === 0x004e4942 && !bin); bin = chunk; }
    offset += 8 + length;
  }
  check(document); return { document, bin };
}

export function* readGltfPolicy(bytes: Uint8Array<ArrayBuffer>, format: 'gltf' | 'glb', budget: Budget): ModelWorkGenerator<AdmittedFormatPlan> {
  const unpacked = format === 'glb' ? yield* unpackGlb(bytes) : { document: yield* readModelJson(bytes), bin: undefined };
  const root = yield* fields(unpacked.document, ['asset', 'buffers', 'bufferViews', 'accessors', 'meshes', 'nodes', 'scenes', 'scene', 'materials', 'textures', 'images', 'samplers']);
  const asset = yield* fields(root['asset'], ['version', 'minVersion', 'generator', 'copyright']);
  check(asset['version'] === '2.0' && (asset['minVersion'] === undefined || asset['minVersion'] === '2.0'));
  for (const key of ['generator', 'copyright']) if (asset[key] !== undefined) check(typeof asset[key] === 'string' && asset[key].length <= 4096);
  const bufferDefs = array(root['buffers'], LIMIT.resources); const imageDefs = array(root['images'], LIMIT.resources);
  check(bufferDefs.length + imageDefs.length <= LIMIT.resources, 'limit');
  let binUsed = false;
  const buffers = yield* mapRecords(bufferDefs, function* (value, index) {
    const buffer = yield* fields(value, ['byteLength', 'uri']); const length = integer(buffer['byteLength'], LIMIT.encodedBytes, 1);
    let data: Uint8Array<ArrayBuffer>; let uri: ModelPreparedResource['uri'] = null; let mimeType = 'application/octet-stream';
    if (buffer['uri'] === undefined) {
      check(index === 0 && unpacked.bin !== undefined && !binUsed); binUsed = true;
      check(unpacked.bin.length >= length && unpacked.bin.length <= length + 3);
      for (let i = length; i < unpacked.bin.length; i++) check(unpacked.bin[i] === 0);
      data = unpacked.bin.subarray(0, length); charge(budget, length);
    } else {
      const embedded = yield* dataUri(buffer['uri'], ['application/octet-stream', 'application/gltf-buffer'], budget);
      data = embedded.bytes; uri = embedded.uri; mimeType = embedded.mime; check(data.length === length);
    }
    budget.resources.push({ kind: 'buffer', index, uri, mimeType, bytes: data }); return data;
  });
  check(!unpacked.bin || binUsed);
  const views: BufferView[] = yield* mapRecords(array(root['bufferViews']), function* (value) {
    const entry = yield* fields(value, ['buffer', 'byteOffset', 'byteLength', 'byteStride', 'target']);
    const buffer = reference(entry['buffer'], buffers);
    const offset = integer(entry['byteOffset'] ?? 0); const length = integer(entry['byteLength'], LIMIT.encodedBytes, 1);
    check(offset + length <= buffer.length);
    const stride = entry['byteStride'] === undefined ? 0 : integer(entry['byteStride'], 252, 4);
    check(stride % 4 === 0);
    if (entry['target'] !== undefined) check(entry['target'] === 34962 || entry['target'] === 34963);
    charge(budget, length); return { bytes: buffer.subarray(offset, offset + length), stride, offset };
  });
  const accessors: Accessor[] = yield* mapRecords(array(root['accessors']), function* (value) {
    const entry = yield* fields(value, ['bufferView', 'byteOffset', 'componentType', 'normalized', 'count', 'type', 'min', 'max']);
    const source = reference(entry['bufferView'], views);
    const component = integer(entry['componentType']); const sizes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
    const size = sizes[component]; check(size !== undefined);
    const counts: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    const type = entry['type']; check(typeof type === 'string' || type instanceof ModelJsonString); check(typeof type === 'string', 'unsupported'); const components = Object.hasOwn(counts, type) ? counts[type] : undefined; check(components !== undefined, 'unsupported');
    const count = integer(entry['count'], LIMIT.indices, 1); const offset = integer(entry['byteOffset'] ?? 0);
    const stride = source.stride || size * components;
    check(stride >= size * components && stride % size === 0 && offset % size === 0 && (source.offset + offset) % size === 0);
    check(offset + (count - 1) * stride + size * components <= source.bytes.length);
    if (entry['normalized'] !== undefined) check(typeof entry['normalized'] === 'boolean' && (!entry['normalized'] || (component !== 5126 && component !== 5125)));
    if (entry['min'] !== undefined) vector(entry['min'], components);
    if (entry['max'] !== undefined) vector(entry['max'], components);
    charge(budget, count * components * 4);
    const view = new DataView(source.bytes.buffer, source.bytes.byteOffset, source.bytes.byteLength); let max = -Infinity;
    let row = 0; let axis = 0;
    yield { unit: 'scalars', run(limit) {
      let used = 0; let nextRow = row; let nextAxis = axis; let nextMax = max;
      while (used < limit && nextRow < count) {
        const position = offset + nextRow * stride + nextAxis * size;
        const value = component === 5126 ? view.getFloat32(position, true) : component === 5125 ? view.getUint32(position, true) : component === 5123 ? view.getUint16(position, true) : component === 5122 ? view.getInt16(position, true) : component === 5121 ? view.getUint8(position) : view.getInt8(position);
        number(value); nextMax = Math.max(nextMax, value); used++;
        if (++nextAxis === components) { nextAxis = 0; nextRow++; }
      }
      row = nextRow; axis = nextAxis; max = nextMax;
      return { used, done: row === count };
    } };
    return { count, components, component, normalized: entry['normalized'] === true, max, type, bounds: entry['min'] !== undefined && entry['max'] !== undefined };
  });
  const images = yield* mapRecords(imageDefs, function* (value, index) {
    const entry = yield* fields(value, ['uri', 'bufferView', 'mimeType']);
    let data: Uint8Array<ArrayBuffer>; let uri: ModelPreparedResource['uri'] = null; let mimeType: ImageMime;
    if (entry['uri'] !== undefined) {
      check(entry['bufferView'] === undefined);
      const embedded = yield* dataUri(entry['uri'], ['image/png', 'image/jpeg'], budget);
      data = embedded.bytes; uri = embedded.uri; mimeType = embedded.mime;
      check(entry['mimeType'] === undefined || entry['mimeType'] === mimeType);
    } else {
      const source = reference(entry['bufferView'], views); check(source.stride === 0);
      check(entry['mimeType'] === 'image/png' || entry['mimeType'] === 'image/jpeg', 'unsupported');
      data = source.bytes; mimeType = entry['mimeType']; charge(budget, data.length);
    }
    const metadata = yield* imageMetadata(data, mimeType, budget);
    budget.resources.push({ kind: 'image', index, uri, mimeType, bytes: data, ...metadata });
    return metadata;
  });
  const samplers = yield* mapRecords(array(root['samplers']), function* (value) {
    const sampler = yield* fields(value, ['magFilter', 'minFilter', 'wrapS', 'wrapT']);
    if (sampler['magFilter'] !== undefined) check([9728, 9729].includes(number(sampler['magFilter'])));
    if (sampler['minFilter'] !== undefined) check([9728, 9729, 9984, 9985, 9986, 9987].includes(number(sampler['minFilter'])));
    for (const key of ['wrapS', 'wrapT']) if (sampler[key] !== undefined) check([33071, 33648, 10497].includes(number(sampler[key])));
    return sampler;
  });
  const textureCharge = (image: { width: number; height: number }): void => {
    const pixels = image.width * image.height;
    budget.pixels += pixels; check(budget.pixels <= LIMIT.totalImagePixels, 'limit');
    charge(budget, Math.ceil(pixels * 4 * 4 / 3));
  };
  const textures = yield* mapRecords(array(root['textures'], LIMIT.resources), function* (value) {
    const texture = yield* fields(value, ['source', 'sampler']); const image = reference(texture['source'], images);
    if (texture['sampler'] !== undefined) reference(texture['sampler'], samplers);
    textureCharge(image); return image;
  });
  const textureInfo = function* (value: unknown, additional: string[] = []): ModelWorkGenerator<void> {
    const info = yield* fields(value, ['index', 'texCoord', ...additional]); textureCharge(reference(info['index'], textures));
    integer(info['texCoord'] ?? 0, 1);
    for (const key of additional) if (info[key] !== undefined) number(info[key]);
  };
  const materials = yield* mapRecords(array(root['materials']), function* (value) {
    const material = yield* fields(value, ['pbrMetallicRoughness', 'normalTexture', 'occlusionTexture', 'emissiveTexture', 'emissiveFactor', 'alphaMode', 'alphaCutoff', 'doubleSided']);
    if (material['pbrMetallicRoughness'] !== undefined) {
      const pbr = yield* fields(material['pbrMetallicRoughness'], ['baseColorFactor', 'baseColorTexture', 'metallicFactor', 'roughnessFactor', 'metallicRoughnessTexture']);
      if (pbr['baseColorFactor'] !== undefined) vector(pbr['baseColorFactor'], 4);
      for (const key of ['metallicFactor', 'roughnessFactor']) if (pbr[key] !== undefined) number(pbr[key]);
      for (const key of ['baseColorTexture', 'metallicRoughnessTexture']) if (pbr[key] !== undefined) yield* textureInfo(pbr[key]);
    }
    if (material['normalTexture'] !== undefined) yield* textureInfo(material['normalTexture'], ['scale']);
    if (material['occlusionTexture'] !== undefined) yield* textureInfo(material['occlusionTexture'], ['strength']);
    if (material['emissiveTexture'] !== undefined) yield* textureInfo(material['emissiveTexture']);
    if (material['emissiveFactor'] !== undefined) vector(material['emissiveFactor'], 3);
    if (material['alphaMode'] !== undefined) check(['OPAQUE', 'MASK', 'BLEND'].includes(String(material['alphaMode'])));
    if (material['alphaCutoff'] !== undefined) number(material['alphaCutoff']);
    if (material['doubleSided'] !== undefined) check(typeof material['doubleSided'] === 'boolean');
    return material;
  });
  let primitiveCount = 0;
  const meshes = yield* mapRecords(array(root['meshes']), function* (value) {
    const mesh = yield* fields(value, ['primitives']); let vertices = 0; let indices = 0;
    const primitives = array(mesh['primitives']); check(primitives.length > 0);
    for (const value of primitives) {
      yield 'records';
      check(++primitiveCount <= LIMIT.entries, 'limit');
      const primitive = yield* fields(value, ['attributes', 'indices', 'material', 'mode']);
      const attributes = yield* fields(primitive['attributes'], ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0']);
      check(attributes['name'] === undefined);
      const position = reference(attributes['POSITION'], accessors);
      check(position.type === 'VEC3' && position.component === 5126 && !position.normalized && position.bounds);
      for (const [key, value] of Object.entries(attributes)) {
        const attribute = reference(value, accessors); check(attribute.count === position.count);
        const width = key.startsWith('TEXCOORD') ? 2 : key === 'TANGENT' ? 4 : key === 'COLOR_0' ? attribute.components : 3;
        check(attribute.components === width && (key !== 'COLOR_0' || width === 3 || width === 4));
        check(attribute.component === 5126 || ((key.startsWith('TEXCOORD') || key === 'COLOR_0') && attribute.normalized && [5121, 5123].includes(attribute.component)));
      }
      const mode = integer(primitive['mode'] ?? 4, 6);
      let count = position.count; let indexed = false;
      if (primitive['indices'] !== undefined) {
        const accessor = reference(primitive['indices'], accessors);
        check(accessor.type === 'SCALAR' && [5121, 5123, 5125].includes(accessor.component) && !accessor.normalized && accessor.max < position.count);
        count = accessor.count; indexed = true;
      }
      if (mode === 4) check(count % 3 === 0);
      if (mode === 1) check(count % 2 === 0);
      if (mode === 2 || mode === 3) check(count >= 2);
      if (mode === 5 || mode === 6) check(count >= 3);
      if (primitive['material'] !== undefined) reference(primitive['material'], materials);
      vertices += position.count; indices += mode >= 5 ? (count - 2) * 3 : indexed ? count : 0;
      check(vertices <= LIMIT.vertices && indices <= LIMIT.indices, 'limit');
    }
    return { vertices, indices, primitives: primitives.length };
  });
  const nodes = yield* mapRecords(array(root['nodes']), function* (value) {
    const node = yield* fields(value, ['mesh', 'children', 'matrix', 'translation', 'rotation', 'scale']);
    if (node['mesh'] !== undefined) reference(node['mesh'], meshes);
    if (node['matrix'] !== undefined) { vector(node['matrix'], 16); check(node['translation'] === undefined && node['rotation'] === undefined && node['scale'] === undefined); }
    for (const [key, length] of [['translation', 3], ['rotation', 4], ['scale', 3]] as const) if (node[key] !== undefined) vector(node[key], length);
    const children: number[] = [];
    for (const child of array(node['children'])) { yield 'records'; children.push(integer(child)); }
    return { mesh: node['mesh'], children };
  });
  const parents = new Uint8Array(nodes.length);
  for (const node of nodes) for (const child of node.children) { yield 'records'; reference(child, nodes); check(parents[child] === 0); parents[child] = 1; }
  const states = new Uint8Array(nodes.length);
  const heights = new Uint8Array(nodes.length);
  const visit = function* (index: number, depth: number): ModelWorkGenerator<number> {
    yield 'records';
    check(depth <= LIMIT.jsonDepth, 'limit'); check(states[index] !== 1);
    if (states[index] === 2) return heights[index]!;
    states[index] = 1; let height = 0;
    for (const child of nodes[index]!.children) height = Math.max(height, (yield* visit(child, depth + 1)) + 1);
    check(height <= LIMIT.jsonDepth, 'limit');
    heights[index] = height; states[index] = 2; return height;
  };
  for (let index = 0; index < nodes.length; index++) yield* visit(index, 0);
  const roots = new Set<number>();
  const scenes = yield* mapRecords(array(root['scenes']), function* (value) {
    const scene = yield* fields(value, ['nodes']);
    for (const value of array(scene['nodes'])) {
      yield 'records';
      const index = integer(value); reference(index, nodes); check(parents[index] === 0 && !roots.has(index)); roots.add(index);
    }
    return scene;
  });
  if (root['scene'] !== undefined) reference(root['scene'], scenes);
  const instances = new Uint32Array(meshes.length);
  for (const node of nodes) { yield 'records'; if (node.mesh !== undefined) instances[node.mesh as number]!++; }
  let drawables = 0;
  for (let index = 0; index < meshes.length; index++) {
    yield 'records'; const mesh = meshes[index]!;
    const count = Math.max(1, instances[index]!); drawables += mesh.primitives * count;
    check(drawables <= LIMIT.entries, 'limit');
    geometry(budget, mesh.vertices * count, mesh.indices * count);
  }
  const planViews: Extract<AdmittedFormatPlan, { format: 'gltf' | 'glb' }>['views'][number][] = [];
  for (const value of array(root['bufferViews'])) { yield 'records'; const entry = object(value); planViews.push({ resource: entry['buffer'] as number, offset: (entry['byteOffset'] ?? 0) as number, length: entry['byteLength'] as number, stride: (entry['byteStride'] ?? null) as number | null }); }
  const planAccessors: Extract<AdmittedFormatPlan, { format: 'gltf' | 'glb' }>['accessors'][number][] = [];
  const rawAccessors = array(root['accessors']);
  for (let index = 0; index < rawAccessors.length; index++) {
    yield 'records'; const entry = object(rawAccessors[index]); const checked = accessors[index]!;
    planAccessors.push({ view: entry['bufferView'] as number, offset: (entry['byteOffset'] ?? 0) as number, count: checked.count, components: checked.components as 1 | 2 | 3 | 4, component: checked.component as 5120 | 5121 | 5122 | 5123 | 5125 | 5126, normalized: checked.normalized, type: checked.type as 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' });
  }
  return { format, document: unpacked.document as ModelJsonRecord, views: planViews, accessors: planAccessors };

}

