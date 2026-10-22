import { MODEL_LIMITS as LIMIT } from './limits.js';
import type { ModelAdmission, ModelAdmissionFailure, ModelEmbeddedResource, ModelFormat, ModelParserInput } from './types.js';

type RecordValue = Record<string, unknown>;
type ImageMime = 'image/png' | 'image/jpeg';
interface Budget { decoded: number; vertices: number; indices: number; pixels: number; resources: ModelEmbeddedResource[] }
interface Accessor { count: number; components: number; component: number; normalized: boolean; max: number; type: string; bounds: boolean }
interface BufferView { bytes: Uint8Array<ArrayBuffer>; stride: number; offset: number }
const snapshots = new WeakMap<ModelAdmission, ModelParserInput>();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Stable reason codes are intended for localization by the owning component. */
export class ModelAdmissionError extends Error {
  readonly code: ModelAdmissionFailure;
  constructor(code: ModelAdmissionFailure) {
    super(`Model admission failed: ${code}`);
    this.name = 'ModelAdmissionError';
    this.code = code;
  }
}
function fail(code: ModelAdmissionFailure = 'invalid'): never { throw new ModelAdmissionError(code); }
function check(condition: unknown, code: ModelAdmissionFailure = 'invalid'): asserts condition { if (!condition) fail(code); }
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER, min = 0): number {
  check(typeof value === 'number' && Number.isSafeInteger(value) && value >= min);
  check(value <= max, 'limit'); return value;
}
function number(value: unknown): number {
  check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= LIMIT.coordinate); return value;
}
function object(value: unknown): RecordValue {
  check(value !== null && typeof value === 'object' && !Array.isArray(value)); return value as RecordValue;
}
function fields(value: unknown, names: string[]): RecordValue {
  const record = object(value);
  for (const key of Object.keys(record)) {
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
function charge(budget: Budget, bytes: number): void { budget.decoded += bytes; check(budget.decoded <= LIMIT.decodedBytes, 'limit'); }
function geometry(budget: Budget, vertices: number, indices: number): void {
  budget.vertices += vertices; budget.indices += indices;
  check(budget.vertices <= LIMIT.vertices && budget.indices <= LIMIT.indices, 'limit');
  // Conservative storage for typed attributes, indices and loader staging number arrays.
  charge(budget, vertices * 160 + indices * 16);
}
function text(bytes: Uint8Array): string {
  try { return decoder.decode(bytes); } catch { return fail(); }
}
function json(bytes: Uint8Array): RecordValue {
  let depth = 0; let tokens = 0; let quoted = false; let escaped = false;
  for (const byte of bytes) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (byte === 92) escaped = true;
      else if (byte === 34) quoted = false;
    } else if (byte === 34) { quoted = true; tokens++; }
    else if (byte === 123 || byte === 91) { depth++; tokens++; }
    else if (byte === 125 || byte === 93) depth--;
    else if (byte === 44 || byte === 58) tokens++;
    check(depth <= LIMIT.jsonDepth && tokens <= LIMIT.jsonTokens, 'limit');
  }
  check(depth === 0 && !quoted);
  try { return object(JSON.parse(text(bytes))); } catch (error) { if (error instanceof ModelAdmissionError) throw error; return fail(); }
}
function dataUri<Mime extends string>(value: unknown, mimes: readonly Mime[], budget: Budget): { bytes: Uint8Array<ArrayBuffer>; mime: Mime; uri: string } {
  check(typeof value === 'string', 'external-resource');
  const comma = value.indexOf(',');
  const header = value.slice(0, comma);
  const mime = mimes.find((candidate) => header === `data:${candidate};base64`);
  check(mime !== undefined, 'external-resource');
  const encoded = value.slice(comma + 1);
  check(encoded.length > 0 && encoded.length % 4 === 0);
  // Validate incrementally: a repetition over a large base64 string can overflow a regexp engine.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const length = encoded.length / 4 * 3 - padding;
  charge(budget, length);
  for (let i = 0; i < encoded.length - padding; i++) check(alphabet.indexOf(encoded[i]!) >= 0);
  for (let i = encoded.length - padding; i < encoded.length; i++) check(encoded[i] === '=');
  if (padding) check((alphabet.indexOf(encoded[encoded.length - padding - 1]!) & (padding === 2 ? 15 : 3)) === 0);
  const bytes = new Uint8Array(length);
  let output = 0;
  for (let i = 0; i < encoded.length; i += 4) {
    const a = alphabet.indexOf(encoded[i]!); const b = alphabet.indexOf(encoded[i + 1]!);
    const c = alphabet.indexOf(encoded[i + 2]!); const d = alphabet.indexOf(encoded[i + 3]!);
    bytes[output++] = (a << 2) | (b >> 4);
    if (output < length) bytes[output++] = (b << 4) | (c >> 2);
    if (output < length) bytes[output++] = (c << 6) | d;
  }
  return { bytes, mime, uri: value };
}
function imageMetadata(bytes: Uint8Array, mime: ImageMime, budget: Budget): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0; let height = 0;
  if (mime === 'image/png') {
    check(bytes.length >= 45 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value));
    let offset = 8; let ended = false; let idat = false; let chunks = 0;
    while (offset < bytes.length) {
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
      check(++segments <= LIMIT.entries, 'limit');
      check(bytes[offset++] === 255);
      while (bytes[offset] === 255) offset++;
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
function unpackGlb(bytes: Uint8Array<ArrayBuffer>): { document: RecordValue; bin?: Uint8Array<ArrayBuffer> } {
  check(bytes.length >= 20);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  check(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2 && view.getUint32(8, true) === bytes.length);
  let offset = 12; let document: RecordValue | undefined; let bin: Uint8Array<ArrayBuffer> | undefined;
  while (offset < bytes.length) {
    check(offset + 8 <= bytes.length);
    const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true);
    check(length % 4 === 0 && length > 0 && offset + 8 + length <= bytes.length);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (!document) { check(type === 0x4e4f534a); document = json(chunk); }
    else { check(type === 0x004e4942 && !bin); bin = chunk; }
    offset += 8 + length;
  }
  check(document); return { document, bin };
}

function gltf(bytes: Uint8Array<ArrayBuffer>, format: 'gltf' | 'glb', budget: Budget): void {
  const unpacked = format === 'glb' ? unpackGlb(bytes) : { document: json(bytes), bin: undefined };
  const root = fields(unpacked.document, ['asset', 'buffers', 'bufferViews', 'accessors', 'meshes', 'nodes', 'scenes', 'scene', 'materials', 'textures', 'images', 'samplers']);
  const asset = fields(root['asset'], ['version', 'minVersion', 'generator', 'copyright']);
  check(asset['version'] === '2.0' && (asset['minVersion'] === undefined || asset['minVersion'] === '2.0'));
  for (const key of ['generator', 'copyright']) if (asset[key] !== undefined) check(typeof asset[key] === 'string' && asset[key].length <= 4096);
  const bufferDefs = array(root['buffers'], LIMIT.resources); const imageDefs = array(root['images'], LIMIT.resources);
  check(bufferDefs.length + imageDefs.length <= LIMIT.resources, 'limit');
  let binUsed = false;
  const buffers = bufferDefs.map((value, index) => {
    const buffer = fields(value, ['byteLength', 'uri']); const length = integer(buffer['byteLength'], LIMIT.encodedBytes, 1);
    let data: Uint8Array<ArrayBuffer>; let uri: string | null = null; let mimeType = 'application/octet-stream';
    if (buffer['uri'] === undefined) {
      check(index === 0 && unpacked.bin !== undefined && !binUsed); binUsed = true;
      check(unpacked.bin.length >= length && unpacked.bin.length <= length + 3);
      for (let i = length; i < unpacked.bin.length; i++) check(unpacked.bin[i] === 0);
      data = unpacked.bin.subarray(0, length); charge(budget, length);
    } else {
      const embedded = dataUri(buffer['uri'], ['application/octet-stream', 'application/gltf-buffer'], budget);
      data = embedded.bytes; uri = embedded.uri; mimeType = embedded.mime; check(data.length === length);
    }
    budget.resources.push({ kind: 'buffer', index, uri, mimeType, bytes: data }); return data;
  });
  check(!unpacked.bin || binUsed);
  const views: BufferView[] = array(root['bufferViews']).map((value) => {
    const entry = fields(value, ['buffer', 'byteOffset', 'byteLength', 'byteStride', 'target']);
    const buffer = reference(entry['buffer'], buffers);
    const offset = integer(entry['byteOffset'] ?? 0); const length = integer(entry['byteLength'], LIMIT.encodedBytes, 1);
    check(offset + length <= buffer.length);
    const stride = entry['byteStride'] === undefined ? 0 : integer(entry['byteStride'], 252, 4);
    check(stride % 4 === 0);
    if (entry['target'] !== undefined) check(entry['target'] === 34962 || entry['target'] === 34963);
    charge(budget, length); return { bytes: buffer.subarray(offset, offset + length), stride, offset };
  });
  const accessors: Accessor[] = array(root['accessors']).map((value) => {
    const entry = fields(value, ['bufferView', 'byteOffset', 'componentType', 'normalized', 'count', 'type', 'min', 'max']);
    const source = reference(entry['bufferView'], views);
    const component = integer(entry['componentType']); const sizes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
    const size = sizes[component]; check(size !== undefined);
    const counts: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    const type = entry['type']; check(typeof type === 'string'); const components = Object.hasOwn(counts, type) ? counts[type] : undefined; check(components !== undefined, 'unsupported');
    const count = integer(entry['count'], LIMIT.indices, 1); const offset = integer(entry['byteOffset'] ?? 0);
    const stride = source.stride || size * components;
    check(stride >= size * components && stride % size === 0 && offset % size === 0 && (source.offset + offset) % size === 0);
    check(offset + (count - 1) * stride + size * components <= source.bytes.length);
    if (entry['normalized'] !== undefined) check(typeof entry['normalized'] === 'boolean' && (!entry['normalized'] || (component !== 5126 && component !== 5125)));
    if (entry['min'] !== undefined) vector(entry['min'], components);
    if (entry['max'] !== undefined) vector(entry['max'], components);
    charge(budget, count * components * 4);
    const view = new DataView(source.bytes.buffer, source.bytes.byteOffset, source.bytes.byteLength); let max = -Infinity;
    for (let i = 0; i < count; i++) for (let j = 0; j < components; j++) {
      const position = offset + i * stride + j * size;
      const value = component === 5126 ? view.getFloat32(position, true) : component === 5125 ? view.getUint32(position, true) : component === 5123 ? view.getUint16(position, true) : component === 5122 ? view.getInt16(position, true) : component === 5121 ? view.getUint8(position) : view.getInt8(position);
      number(value); max = Math.max(max, value);
    }
    return { count, components, component, normalized: entry['normalized'] === true, max, type, bounds: entry['min'] !== undefined && entry['max'] !== undefined };
  });
  const images = imageDefs.map((value, index) => {
    const entry = fields(value, ['uri', 'bufferView', 'mimeType']);
    let data: Uint8Array<ArrayBuffer>; let uri: string | null = null; let mimeType: ImageMime;
    if (entry['uri'] !== undefined) {
      check(entry['bufferView'] === undefined);
      const embedded = dataUri(entry['uri'], ['image/png', 'image/jpeg'], budget);
      data = embedded.bytes; uri = embedded.uri; mimeType = embedded.mime;
      check(entry['mimeType'] === undefined || entry['mimeType'] === mimeType);
    } else {
      const source = reference(entry['bufferView'], views); check(source.stride === 0);
      check(entry['mimeType'] === 'image/png' || entry['mimeType'] === 'image/jpeg', 'unsupported');
      data = source.bytes; mimeType = entry['mimeType']; charge(budget, data.length);
    }
    const metadata = imageMetadata(data, mimeType, budget);
    budget.resources.push({ kind: 'image', index, uri, mimeType, bytes: data, ...metadata });
    return metadata;
  });
  const samplers = array(root['samplers']).map((value) => {
    const sampler = fields(value, ['magFilter', 'minFilter', 'wrapS', 'wrapT']);
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
  const textures = array(root['textures'], LIMIT.resources).map((value) => {
    const texture = fields(value, ['source', 'sampler']); const image = reference(texture['source'], images);
    if (texture['sampler'] !== undefined) reference(texture['sampler'], samplers);
    textureCharge(image); return image;
  });
  const textureInfo = (value: unknown, additional: string[] = []): void => {
    const info = fields(value, ['index', 'texCoord', ...additional]); textureCharge(reference(info['index'], textures));
    integer(info['texCoord'] ?? 0, 1);
    for (const key of additional) if (info[key] !== undefined) number(info[key]);
  };
  const materials = array(root['materials']).map((value) => {
    const material = fields(value, ['pbrMetallicRoughness', 'normalTexture', 'occlusionTexture', 'emissiveTexture', 'emissiveFactor', 'alphaMode', 'alphaCutoff', 'doubleSided']);
    if (material['pbrMetallicRoughness'] !== undefined) {
      const pbr = fields(material['pbrMetallicRoughness'], ['baseColorFactor', 'baseColorTexture', 'metallicFactor', 'roughnessFactor', 'metallicRoughnessTexture']);
      if (pbr['baseColorFactor'] !== undefined) vector(pbr['baseColorFactor'], 4);
      for (const key of ['metallicFactor', 'roughnessFactor']) if (pbr[key] !== undefined) number(pbr[key]);
      for (const key of ['baseColorTexture', 'metallicRoughnessTexture']) if (pbr[key] !== undefined) textureInfo(pbr[key]);
    }
    if (material['normalTexture'] !== undefined) textureInfo(material['normalTexture'], ['scale']);
    if (material['occlusionTexture'] !== undefined) textureInfo(material['occlusionTexture'], ['strength']);
    if (material['emissiveTexture'] !== undefined) textureInfo(material['emissiveTexture']);
    if (material['emissiveFactor'] !== undefined) vector(material['emissiveFactor'], 3);
    if (material['alphaMode'] !== undefined) check(['OPAQUE', 'MASK', 'BLEND'].includes(String(material['alphaMode'])));
    if (material['alphaCutoff'] !== undefined) number(material['alphaCutoff']);
    if (material['doubleSided'] !== undefined) check(typeof material['doubleSided'] === 'boolean');
    return material;
  });
  let primitiveCount = 0;
  const meshes = array(root['meshes']).map((value) => {
    const mesh = fields(value, ['primitives']); let vertices = 0; let indices = 0;
    const primitives = array(mesh['primitives']); check(primitives.length > 0);
    for (const value of primitives) {
      check(++primitiveCount <= LIMIT.entries, 'limit');
      const primitive = fields(value, ['attributes', 'indices', 'material', 'mode']);
      const attributes = fields(primitive['attributes'], ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0']);
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
  const nodes = array(root['nodes']).map((value) => {
    const node = fields(value, ['mesh', 'children', 'matrix', 'translation', 'rotation', 'scale']);
    if (node['mesh'] !== undefined) reference(node['mesh'], meshes);
    if (node['matrix'] !== undefined) { vector(node['matrix'], 16); check(node['translation'] === undefined && node['rotation'] === undefined && node['scale'] === undefined); }
    for (const [key, length] of [['translation', 3], ['rotation', 4], ['scale', 3]] as const) if (node[key] !== undefined) vector(node[key], length);
    return { mesh: node['mesh'], children: array(node['children']).map((value) => integer(value)) };
  });
  const parents = new Uint8Array(nodes.length);
  for (const node of nodes) for (const child of node.children) { reference(child, nodes); check(parents[child] === 0); parents[child] = 1; }
  const states = new Uint8Array(nodes.length);
  const heights = new Uint8Array(nodes.length);
  const visit = (index: number, depth: number): number => {
    check(depth <= LIMIT.jsonDepth, 'limit'); check(states[index] !== 1);
    if (states[index] === 2) return heights[index]!;
    states[index] = 1; let height = 0;
    for (const child of nodes[index]!.children) height = Math.max(height, visit(child, depth + 1) + 1);
    check(height <= LIMIT.jsonDepth, 'limit');
    heights[index] = height; states[index] = 2; return height;
  };
  nodes.forEach((_, index) => visit(index, 0));
  const roots = new Set<number>();
  const scenes = array(root['scenes']).map((value) => {
    const scene = fields(value, ['nodes']);
    for (const value of array(scene['nodes'])) {
      const index = integer(value); reference(index, nodes); check(parents[index] === 0 && !roots.has(index)); roots.add(index);
    }
    return scene;
  });
  if (root['scene'] !== undefined) reference(root['scene'], scenes);
  const instances = new Uint32Array(meshes.length);
  nodes.forEach((node) => { if (node.mesh !== undefined) instances[node.mesh as number]!++; });
  let drawables = 0;
  meshes.forEach((mesh, index) => {
    const count = Math.max(1, instances[index]!); drawables += mesh.primitives * count;
    check(drawables <= LIMIT.entries, 'limit');
    geometry(budget, mesh.vertices * count, mesh.indices * count);
  });
}

function* lines(value: string, canonical = false): Generator<string> {
  let start = 0; let count = 0;
  while (start < value.length) {
    const found = value.indexOf('\n', start); const end = found < 0 ? value.length : found;
    check(end - start <= LIMIT.lineBytes, 'limit'); check(++count <= LIMIT.indices + LIMIT.vertices, 'limit');
    const raw = value.slice(start, end); const line = raw.trim();
    if (canonical) check(raw === line && (!line || tokens(line).join(' ') === line), 'unsupported');
    yield line; start = end + 1;
  }
}
function tokens(line: string): string[] { return line.split(/\s+/); }
function numeric(value: string | undefined): number {
  check(value !== undefined && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)); return number(Number(value));
}
function numericInteger(value: string | undefined, max = Number.MAX_SAFE_INTEGER, min = 0): number {
  check(value !== undefined && /^[+-]?\d+$/.test(value)); return integer(Number(value), max, min);
}
function xyz(bytes: Uint8Array, budget: Budget): void {
  let count = 0;
  for (const line of lines(text(bytes))) {
    if (!line || line.startsWith('#')) continue;
    const row = tokens(line); check(row.length === 3 || row.length === 6, 'unsupported');
    row.forEach(numeric); if (row.length === 6) row.slice(3).forEach((value) => integer(Number(value), 255));
    check(++count <= LIMIT.vertices, 'limit');
  }
  geometry(budget, count, 0);
}
function obj(bytes: Uint8Array, budget: Budget): void {
  let vertices = 0; let normals = 0; let uvs = 0; let output = 0; let entries = 0;
  for (const line of lines(text(bytes))) {
    check(!line.includes('\\'), 'unsupported');
    if (!line || line.startsWith('#')) continue;
    check(!line.includes('#'), 'unsupported');
    const [directive, ...values] = tokens(line);
    if (directive === 'mtllib' || directive === 'usemtl') fail('external-resource');
    if (directive === 'v' || directive === 'vn' || directive === 'vt') {
      check(values.length === (directive === 'vt' ? 2 : 3) || (directive === 'v' && values.length === 6), 'unsupported');
      values.forEach(numeric);
      if (directive === 'v') vertices++;
      else if (directive === 'vn') normals++;
      else uvs++;
      check(vertices <= LIMIT.vertices && normals <= LIMIT.vertices && uvs <= LIMIT.vertices, 'limit');
    } else if (directive === 'f' || directive === 'l' || directive === 'p') {
      // The point and line loader splits references on literal spaces.
      if (directive !== 'f') check(tokens(line).join(' ') === line, 'unsupported');
      const minimum = directive === 'f' ? 3 : directive === 'l' ? 2 : 1;
      integer(values.length, LIMIT.polygonVertices, minimum);
      for (const value of values) {
        const parts = value.split('/'); check(parts.length <= (directive === 'p' ? 1 : directive === 'l' ? 2 : 3));
        check(parts[0] !== '');
        for (let i = 0; i < parts.length; i++) {
          if (i === 1 && parts[i] === '' && parts.length === 3) continue;
          const limit = [vertices, uvs, normals][i]!;
          const index = numericInteger(parts[i], Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER);
          check(index !== 0 && (index > 0 ? index <= limit : -index <= limit));
        }
      }
      output += directive === 'f' ? (values.length - 2) * 3 : directive === 'l' ? (values.length - 1) * 2 : values.length;
      check(output <= LIMIT.vertices, 'limit');
    } else if (directive === 'o' || directive === 'g' || directive === 's') {
      check(++entries <= LIMIT.entries, 'limit');
      if (directive === 's') check(values.length === 1 && (values[0] === 'off' || values[0] === 'on' || /^\d+$/.test(values[0]!)));
    } else fail('unsupported');
  }
  charge(budget, vertices * 6 * 8 + normals * 3 * 8 + uvs * 2 * 8);
  geometry(budget, output || vertices, 0);
}
function stl(bytes: Uint8Array, budget: Budget): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 84) {
    const faces = view.getUint32(80, true);
    if (84 + faces * 50 === bytes.length) {
      integer(faces * 3, LIMIT.vertices);
      for (let offset = 84; offset < bytes.length; offset += 50) for (let i = 0; i < 12; i++) number(view.getFloat32(offset + i * 4, true));
      geometry(budget, faces * 3, 0); return;
    }
  }
  let state = 0; let vertices = 0; let solids = 0;
  const solidName = (row: string[]): void => {
    const name = row.slice(1).join(' ');
    check(name.length <= 1024 && !/(solid|facet|vertex|normal|outer|loop)/i.test(name), 'unsupported');
  };
  for (const line of lines(text(bytes))) {
    if (!line) continue;
    const row = tokens(line);
    if (state === 0) { check(row[0] === 'solid'); solidName(row); check(++solids <= LIMIT.entries, 'limit'); state = 1; }
    else if (state === 1) {
      if (row[0] === 'endsolid') { solidName(row); state = 0; continue; }
      check(row.length === 5 && row[0] === 'facet' && row[1] === 'normal'); row.slice(2).forEach(numeric); state = 2;
    } else if (state === 2) { check(line === 'outer loop'); state = 3; }
    else if (state >= 3 && state <= 5) {
      check(row.length === 4 && row[0] === 'vertex'); row.slice(1).forEach(numeric);
      check(++vertices <= LIMIT.vertices, 'limit'); state++;
    } else if (state === 6) { check(line === 'endloop'); state = 7; }
    else { check(line === 'endfacet'); state = 1; }
  }
  check(state === 0 && solids > 0); geometry(budget, vertices, 0);
}
function header(bytes: Uint8Array, end: (line: string) => boolean, canonicalPly = false): { lines: string[]; offset: number } {
  const result: string[] = []; let start = 0;
  const crlf = bytes[3] === 13 && bytes[4] === 10;
  if (canonicalPly) check(bytes[0] === 112 && bytes[1] === 108 && bytes[2] === 121 && (bytes[3] === 10 || crlf), 'unsupported');
  for (let i = 0; i < bytes.length && i < LIMIT.headerBytes; i++) {
    check(bytes[i]! < 128 && bytes[i] !== 0);
    if (canonicalPly && bytes[i] === 13) check(crlf && bytes[i + 1] === 10, 'unsupported');
    if (bytes[i] !== 10) continue;
    if (canonicalPly) check((bytes[i - 1] === 13) === crlf, 'unsupported');
    check(i - start <= LIMIT.lineBytes, 'limit');
    const raw = text(bytes.subarray(start, canonicalPly && crlf ? i - 1 : i));
    const line = raw.trim(); start = i + 1;
    // The loader uses the magic line to choose its byte offset and an exact terminator.
    if (canonicalPly && (result.length === 0 || end(line))) check(raw === line, 'unsupported');
    // ASCII body extraction also searches for this marker without a line anchor.
    if (canonicalPly && !end(line)) check(!line.includes('end_header'), 'unsupported');
    result.push(line); check(result.length <= LIMIT.entries, 'limit');
    if (end(line)) return { lines: result, offset: start };
  }
  return fail(bytes.length >= LIMIT.headerBytes ? 'limit' : 'invalid');
}
interface Scalar { size: number; float: boolean; signed: boolean }
const plyScalars: Record<string, Scalar> = {
  char: { size: 1, float: false, signed: true }, int8: { size: 1, float: false, signed: true },
  uchar: { size: 1, float: false, signed: false }, uint8: { size: 1, float: false, signed: false },
  short: { size: 2, float: false, signed: true }, int16: { size: 2, float: false, signed: true },
  ushort: { size: 2, float: false, signed: false }, uint16: { size: 2, float: false, signed: false },
  int: { size: 4, float: false, signed: true }, int32: { size: 4, float: false, signed: true },
  uint: { size: 4, float: false, signed: false }, uint32: { size: 4, float: false, signed: false },
  float: { size: 4, float: true, signed: true }, float32: { size: 4, float: true, signed: true },
  double: { size: 8, float: true, signed: true }, float64: { size: 8, float: true, signed: true },
};
function scalarType(type: string | undefined): Scalar { check(type !== undefined && Object.hasOwn(plyScalars, type), 'unsupported'); return plyScalars[type]!; }
function scalarValue(value: number, type: Scalar): number {
  number(value);
  if (!type.float) integer(value, 2 ** (type.size * 8 - (type.signed ? 1 : 0)) - 1, type.signed ? -(2 ** (type.size * 8 - 1)) : 0);
  return value;
}
function asciiScalar(value: string | undefined, type: Scalar): number {
  return scalarValue(type.float ? numeric(value) : numericInteger(value, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER), type);
}
function binaryScalar(view: DataView, offset: number, type: Scalar, little: boolean): number {
  check(offset + type.size <= view.byteLength);
  return scalarValue(type.float ? type.size === 8 ? view.getFloat64(offset, little) : view.getFloat32(offset, little) : type.size === 1 ? type.signed ? view.getInt8(offset) : view.getUint8(offset) : type.size === 2 ? type.signed ? view.getInt16(offset, little) : view.getUint16(offset, little) : type.signed ? view.getInt32(offset, little) : view.getUint32(offset, little), type);
}
function ply(bytes: Uint8Array, budget: Budget): void {
  const source = header(bytes, (line) => line === 'end_header', true);
  check(source.lines[0] === 'ply'); const format = source.lines[1];
  check(format === 'format ascii 1.0' || format === 'format binary_little_endian 1.0' || format === 'format binary_big_endian 1.0', 'unsupported');
  const properties: { name: string; type: Scalar }[] = [];
  let vertexCount = -1; let faceCount = 0; let element = ''; let faceType: Scalar | undefined; let countType: Scalar | undefined;
  for (const line of source.lines.slice(2, -1)) {
    if (line.startsWith('comment ') || line === 'comment' || line.startsWith('obj_info ')) continue;
    const row = tokens(line);
    if (row[0] === 'element') {
      check(row.length === 3);
      if (row[1] === 'vertex') { check(vertexCount === -1 && !element); vertexCount = numericInteger(row[2], LIMIT.vertices); element = 'vertex'; }
      else if (row[1] === 'face') { check(vertexCount >= 0 && element === 'vertex'); faceCount = numericInteger(row[2], LIMIT.indices / 3); element = 'face'; }
      else fail('unsupported');
    } else if (row[0] === 'property') {
      if (element === 'vertex') {
        check(row.length === 3 && ['x', 'y', 'z', 'nx', 'ny', 'nz', 'red', 'green', 'blue', 'alpha', 's', 't', 'u', 'v'].includes(row[2]!), 'unsupported');
        check(!properties.some((property) => property.name === row[2]));
        const type = scalarType(row[1]);
        if (['red', 'green', 'blue', 'alpha'].includes(row[2]!)) check(type.size === 1 && !type.signed && !type.float, 'unsupported');
        properties.push({ name: row[2]!, type });
      } else {
        check(element === 'face' && !faceType && row.length === 5 && row[1] === 'list' && (row[4] === 'vertex_indices' || row[4] === 'vertex_index'), 'unsupported');
        countType = scalarType(row[2]); faceType = scalarType(row[3]); check(!countType.float && !faceType.float);
      }
    } else fail('unsupported');
  }
  check(vertexCount >= 0 && ['x', 'y', 'z'].every((name) => properties.some((property) => property.name === name)));
  check(element !== 'face' || (faceType && countType));
  let indices = 0;
  const addFace = (count: number, read: () => number): void => {
    integer(count, 4, 3); indices += (count - 2) * 3; check(indices <= LIMIT.indices, 'limit');
    for (let i = 0; i < count; i++) integer(read(), vertexCount - 1);
  };
  if (format === 'format ascii 1.0') {
    const body = lines(text(bytes.subarray(source.offset))); let rowIndex = 0;
    for (const line of body) {
      if (!line) continue;
      const row = tokens(line);
      if (rowIndex < vertexCount) {
        check(row.length === properties.length); row.forEach((value, i) => asciiScalar(value, properties[i]!.type));
      } else {
        check(rowIndex < vertexCount + faceCount);
        const count = asciiScalar(row[0], countType!); check(row.length === count + 1);
        let index = 1; addFace(count, () => asciiScalar(row[index++], faceType!));
      }
      rowIndex++;
    }
    check(rowIndex === vertexCount + faceCount);
  } else {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = source.offset;
    const little = format === 'format binary_little_endian 1.0';
    const read = (type: Scalar): number => { const value = binaryScalar(view, offset, type, little); offset += type.size; return value; };
    for (let i = 0; i < vertexCount; i++) properties.forEach((property) => read(property.type));
    for (let i = 0; i < faceCount; i++) addFace(read(countType!), () => read(faceType!));
    check(offset === bytes.length);
  }
  charge(budget, vertexCount * properties.length * 8 + indices * 8);
  geometry(budget, vertexCount, indices);
}
function pcd(bytes: Uint8Array, budget: Budget): void {
  const source = header(bytes, (line) => line.startsWith('DATA '));
  for (const line of text(bytes.subarray(0, source.offset)).split('\n')) {
    check(line === line.trim(), 'unsupported');
    if (line && !line.startsWith('#')) check(tokens(line).join(' ') === line, 'unsupported');
  }
  const values: Record<string, string[]> = {};
  for (const line of source.lines) {
    if (!line || line.startsWith('#')) continue;
    const [key, ...row] = tokens(line);
    check(key !== undefined && ['VERSION', 'FIELDS', 'SIZE', 'TYPE', 'COUNT', 'WIDTH', 'HEIGHT', 'VIEWPOINT', 'POINTS', 'DATA'].includes(key), 'unsupported');
    check(!Object.hasOwn(values, key)); values[key] = row;
  }
  check(values['VERSION']?.length === 1 && ['.7', '0.7'].includes(values['VERSION'][0]!));
  const names = values['FIELDS']; const sizes = values['SIZE']; const types = values['TYPE'];
  check(names && sizes && types && names.length <= 8 && sizes.length === names.length && types.length === names.length);
  check(['x', 'y', 'z'].every((name) => names.includes(name)) && new Set(names).size === names.length);
  const normalFields = ['normal_x', 'normal_y', 'normal_z'];
  check(!normalFields.some((name) => names.includes(name)) || normalFields.every((name) => names.includes(name)));
  const counts = values['COUNT'] ?? names.map(() => '1'); check(counts.length === names.length);
  const scalarTypes = names.map((name, i) => {
    check(['x', 'y', 'z', 'normal_x', 'normal_y', 'normal_z', 'rgb'].includes(name), 'unsupported');
    check(numericInteger(sizes[i]) === 4 && numericInteger(counts[i]) === 1, 'unsupported');
    check(types[i] === 'F' || (name === 'rgb' && types[i] === 'U'), 'unsupported');
    return { size: 4, signed: types[i] === 'F', float: types[i] === 'F' };
  });
  const oneInteger = (key: string, max: number): number => { check(values[key]?.length === 1); return numericInteger(values[key]![0], max); };
  const points = oneInteger('POINTS', LIMIT.vertices); const width = oneInteger('WIDTH', LIMIT.vertices); const height = oneInteger('HEIGHT', LIMIT.vertices);
  check(width * height === points && height > 0);
  if (values['VIEWPOINT']) { check(values['VIEWPOINT'].length === 7); values['VIEWPOINT'].forEach(numeric); }
  check(values['DATA']?.length === 1); const mode = values['DATA'][0]; check(mode === 'ascii' || mode === 'binary', 'unsupported');
  if (mode === 'ascii') {
    let count = 0;
    for (const line of lines(text(bytes.subarray(source.offset)), true)) {
      if (!line) continue;
      const row = tokens(line); check(row.length === names.length && count < points);
      row.forEach((value, i) => scalarValue(numeric(value), scalarTypes[i]!)); count++;
    }
    check(count === points);
  } else {
    check(bytes.length - source.offset === points * names.length * 4);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = source.offset;
    for (let i = 0; i < points; i++) for (let j = 0; j < names.length; j++) {
      // Packed RGB may have a NaN float representation; the parser consumes its raw integer bits.
      if (names[j] !== 'rgb') binaryScalar(view, offset, scalarTypes[j]!, true);
      offset += 4;
    }
  }
  charge(budget, points * names.length * 8); geometry(budget, points, 0);
}

/** Validate bounded supported format subsets before invoking any loader or decoder. */
export function admitModel(input: ArrayBuffer | Uint8Array, format: ModelFormat): ModelAdmission {
  check(['gltf', 'glb', 'stl', 'obj', 'ply', 'xyz', 'pcd'].includes(format), 'unsupported');
  check(input instanceof ArrayBuffer || input instanceof Uint8Array);
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  check(source.buffer instanceof ArrayBuffer && !('resizable' in source.buffer && source.buffer.resizable));
  check(source.byteLength <= LIMIT.encodedBytes, 'limit');
  const bytes = new Uint8Array(source);
  const budget: Budget = { decoded: 0, vertices: 0, indices: 0, pixels: 0, resources: [] };
  if (format === 'gltf' || format === 'glb') gltf(bytes, format, budget);
  else if (format === 'stl') stl(bytes, budget);
  else if (format === 'obj') obj(bytes, budget);
  else if (format === 'ply') ply(bytes, budget);
  else if (format === 'pcd') pcd(bytes, budget);
  else xyz(bytes, budget);
  const plan: ModelAdmission = Object.freeze({ format, encodedBytes: bytes.length, decodedBytes: budget.decoded, vertices: budget.vertices, indices: budget.indices, resources: budget.resources.length, imagePixels: budget.pixels });
  snapshots.set(plan, { format, bytes, resources: budget.resources }); return plan;
}

/** Return a detached snapshot only for a genuine admission receipt. */
export function readModelAdmission(plan: ModelAdmission): ModelParserInput {
  const source = snapshots.get(plan); check(source);
  return { format: source.format, bytes: source.bytes.slice(), resources: source.resources.map((resource) => ({ ...resource, bytes: resource.bytes.slice() })) };
}
