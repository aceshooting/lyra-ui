import { ShaderLib } from 'three';
import type { ModelGeometryDescriptor, ModelMaterialDescriptor, ModelTextureDescriptor } from '../model/model-prepared-types.js';

interface MaterialChannelProfile {
  readonly kind: 'mesh-standard' | 'mesh-phong';
  readonly flatFaceNormals: boolean;
  readonly normalMapFrame: 'none' | 'tangent' | 'derivative';
  readonly colorComponents: 0 | 3 | 4;
  readonly uvChannels: readonly (0 | 1)[];
  readonly coverage: 'opaque' | 'mask';
  readonly featureKey: string;
}
interface GeographicShader {
  readonly vertexPrelude: string;
  readonly fragmentPrelude: string;
  readonly defines: string;
  readonly positionEncoding: 'tile-xy-meters-z';
  readonly projectFunction: 'lrProjectPosition';
  readonly horizonPositionFunction: 'lrHorizonPosition';
  readonly horizonOccludedFunction: 'lrHorizonOccluded';
}
interface Attribute { readonly count: number; readonly components: number; read(row: number, component: number): number }
const profiles = new WeakSet<MaterialChannelProfile>();
const approvedSources = Object.freeze({
  'mesh-standard': Object.freeze({ vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader }),
  'mesh-phong': Object.freeze({ vertexShader: ShaderLib.phong.vertexShader, fragmentShader: ShaderLib.phong.fragmentShader })
});
const fail = (): never => { throw new TypeError('Unsupported geographic model material.'); };
function own(value: unknown, key: string, optional = false): unknown {
  if (!value || typeof value !== 'object') return fail();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) { if (optional) return undefined; return fail(); }
  if (!Object.hasOwn(descriptor, 'value')) return fail();
  return descriptor.value;
}
function fields(value: unknown, allowed: readonly string[]): void {
  if (!value || typeof value !== 'object') return fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) return fail();
    own(value, key);
  }
}
function integer(value: unknown, maximum = 1000000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) return fail();
  return value;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail();
  return value;
}
function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value)) return fail();
  const length = integer(own(value, 'length'), maximum);
  return Array.from({ length }, (_, index) => own(value, String(index)));
}
const constructors = { Float32Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Uint32Array };
function numeric(value: unknown): { readonly tag: keyof typeof constructors; readonly values: ArrayLike<number> } {
  const prototype = Object.getPrototypeOf(Float32Array.prototype) as object;
  const get = (key: PropertyKey) => Object.getOwnPropertyDescriptor(prototype, key)?.get?.call(value) as unknown;
  try {
    const tag = get(Symbol.toStringTag);
    if (typeof tag !== 'string' || !Object.hasOwn(constructors, tag)) return fail();
    const backing = get('buffer');
    integer(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')?.get?.call(backing), 268435456);
    if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(backing)) return fail();
    const length = integer(get('length'), 67108864), offset = integer(get('byteOffset'), 268435456);
    const kind = tag as keyof typeof constructors;
    return { tag: kind, values: new constructors[kind](backing as ArrayBuffer, offset, length) };
  } catch { return fail(); }
}
function attribute(value: unknown, components: readonly number[]): Attribute {
  fields(value, ['array', 'itemSize', 'normalized', 'count', 'stride', 'offset', 'colorConversion']);
  if (own(value, 'colorConversion', true) !== undefined) return fail();
  const size = integer(own(value, 'itemSize'), 4), count = integer(own(value, 'count'));
  const stride = integer(own(value, 'stride'), 64), offset = integer(own(value, 'offset'), 64);
  const normalized = own(value, 'normalized');
  if (!components.includes(size) || count === 0 || stride < size || offset + size > stride || typeof normalized !== 'boolean') return fail();
  const { values, tag } = numeric(own(value, 'array'));
  if ((count - 1) * stride + offset + size > values.length || tag === 'Uint32Array') return fail();
  if (tag === 'Float32Array' && normalized) return fail();
  const divisor = tag === 'Int8Array' ? 127 : tag === 'Int16Array' ? 32767 : tag === 'Uint16Array' ? 65535 : 255;
  const signed = tag === 'Int8Array' || tag === 'Int16Array';
  const result: Attribute = { count, components: size, read(row, component) {
    const value = finite(values[row * stride + offset + component]);
    return normalized ? signed ? Math.max(-1, value / divisor) : value / divisor : value;
  } };
  for (let row = 0; row < count; row++) for (let axis = 0; axis < size; axis++) result.read(row, axis);
  return result;
}

/** Validates the submitted physical mesh channels; geographic correspondence is a later geometry receipt. */
export function validateModelMaterialChannels(input: {
  readonly geometry: ModelGeometryDescriptor; readonly material: ModelMaterialDescriptor; readonly textures: readonly ModelTextureDescriptor[];
}): MaterialChannelProfile {
  fields(input, ['geometry', 'material', 'textures']);
  const geometry = own(input, 'geometry'), material = own(input, 'material');
  fields(geometry, ['attributes', 'index', 'indexAttribute', 'groups', 'groupNames', 'hasColors', 'alpha', 'drawRange']);
  const kind = own(material, 'kind');
  if (kind !== 'mesh-standard' && kind !== 'mesh-phong') return fail();
  const base = ['kind', 'name', 'color', 'opacity', 'transparent', 'alphaTest', 'depthWrite', 'side', 'vertexColors', 'flatShading', 'colorConversion'];
  fields(material, kind === 'mesh-standard' ? [...base, 'emissiveConversion', 'roughness', 'metalness', 'emissive', 'normalScale', 'aoMapIntensity', 'maps'] :
    [...base, 'specularConversion', 'emissive', 'specular', 'shininess', 'aoMapIntensity']);
  if (own(material, 'transparent') !== false) return fail();
  const name = own(material, 'name');
  if (typeof name !== 'string' || name.length > 16384) return fail();
  const tuple = (value: unknown, size: number) => {
    const entries = list(value, size);
    if (entries.length !== size) return fail();
    entries.forEach(finite);
  };
  tuple(own(material, 'color'), 3); tuple(own(material, 'emissive'), 3);
  finite(own(material, 'aoMapIntensity'));
  const conversion = own(material, 'colorConversion', true);
  if (conversion !== undefined && conversion !== 'srgb' && conversion !== 'linear-srgb') return fail();
  if (kind === 'mesh-standard') {
    tuple(own(material, 'normalScale'), 2);
    for (const member of ['metalness', 'roughness']) { const value = finite(own(material, member)); if (value < 0 || value > 1) return fail(); }
    const emissiveConversion = own(material, 'emissiveConversion', true);
    if (emissiveConversion !== undefined && emissiveConversion !== 'linear-srgb') return fail();
  } else {
    tuple(own(material, 'specular'), 3);
    if (finite(own(material, 'shininess')) < 0) return fail();
    const specularConversion = own(material, 'specularConversion', true);
    if (specularConversion !== undefined && specularConversion !== 'srgb') return fail();
  }
  const opacity = finite(own(material, 'opacity')), alphaTest = finite(own(material, 'alphaTest'));
  if (opacity < 0 || opacity > 1 || alphaTest < 0 || alphaTest > 1 || ![0, 1, 2].includes(integer(own(material, 'side'), 2)) ||
    typeof own(material, 'depthWrite') !== 'boolean' || typeof own(material, 'vertexColors') !== 'boolean') return fail();
  const rawAttributes = own(geometry, 'attributes');
  fields(rawAttributes, ['position', 'normal', 'tangent', 'color', 'uv', 'uv1']);
  const position = attribute(own(rawAttributes, 'position'), [3]), normal = attribute(own(rawAttributes, 'normal'), [3]);
  const optional = (name: string, sizes: readonly number[]) => {
    const raw = own(rawAttributes, name, true);
    if (raw === undefined) return undefined;
    const value = attribute(raw, sizes);
    if (value.count !== position.count) return fail();
    return value;
  };
  const tangent = optional('tangent', [4]), color = optional('color', [3, 4]);
  const uv = optional('uv', [2]), uv1 = optional('uv1', [2]);
  if (normal.count !== position.count || (own(material, 'vertexColors') && !color)) return fail();
  for (let row = 0; row < position.count; row++) {
    const n = [normal.read(row, 0), normal.read(row, 1), normal.read(row, 2)], length = Math.hypot(...n);
    if (length < 1e-12) return fail();
    if (tangent) {
      const t = [tangent.read(row, 0), tangent.read(row, 1), tangent.read(row, 2)], size = Math.hypot(...t);
      if (size < 1e-12 || Math.abs(n.reduce((sum, value, axis) => sum + value * t[axis]!, 0) / (length * size)) > 1e-3 || Math.abs(Math.abs(tangent.read(row, 3)) - 1) > 1e-6) return fail();
    }
  }
  let index: Attribute | undefined;
  const rawIndex = own(geometry, 'index');
  const rawIndexAttribute = own(geometry, 'indexAttribute', true);
  if (rawIndex !== null) {
    if (rawIndexAttribute !== undefined) return fail();
    const data = numeric(rawIndex);
    if (!['Uint8Array', 'Uint16Array', 'Uint32Array'].includes(data.tag)) return fail();
    index = { count: data.values.length, components: 1, read(row) { return integer(data.values[row], position.count - 1); } };
  } else if (rawIndexAttribute !== undefined) {
    // Generated mesh partitions normalize index attributes before this narrow material stage.
    return fail();
  }
  const total = index?.count ?? position.count;
  if (total > 6000000) return fail();
  for (let row = 0; row < total; row++) index?.read(row, 0);
  const range = own(geometry, 'drawRange'); fields(range, ['start', 'count']);
  const start = integer(own(range, 'start'), total), rawCount = own(range, 'count');
  const count = rawCount === null ? total - start : integer(rawCount, total - start);
  if (start % 3 !== 0 || count % 3 !== 0 || count === 0) return fail();
  const groups = list(own(geometry, 'groups'), 100000);
  for (const group of groups) {
    fields(group, ['start', 'count', 'materialIndex']);
    const offset = integer(own(group, 'start'), total), length = integer(own(group, 'count'), total - offset);
    if (offset % 3 !== 0 || length % 3 !== 0 || own(group, 'materialIndex') !== 0) return fail();
  }
  const textures = list(own(input, 'textures'), 100000);
  const mapFeatures: string[] = [];
  const textureAt = (value: unknown, usage: string): { readonly uv: Attribute; readonly index: number } | undefined => {
    if (value === null) return undefined;
    const textureIndex = integer(value, textures.length - 1), texture = textures[textureIndex];
    fields(texture, ['name', 'resource', 'magFilter', 'minFilter', 'wrapS', 'wrapT', 'texCoord', 'colorSpace', 'flipY', 'generateMipmaps']);
    const textureName = own(texture, 'name');
    if (typeof textureName !== 'string' || textureName.length > 16384) return fail();
    integer(own(texture, 'resource'), 100000);
    if (![9728, 9729].includes(finite(own(texture, 'magFilter'))) ||
      ![9728, 9729, 9984, 9985, 9986, 9987].includes(finite(own(texture, 'minFilter'))) ||
      ![33071, 33648, 10497].includes(finite(own(texture, 'wrapS'))) ||
      ![33071, 33648, 10497].includes(finite(own(texture, 'wrapT'))) ||
      !['srgb', 'none'].includes(own(texture, 'colorSpace') as string) ||
      typeof own(texture, 'flipY') !== 'boolean' || typeof own(texture, 'generateMipmaps') !== 'boolean') return fail();
    const channel = own(texture, 'texCoord');
    if (channel !== 0 && channel !== 1) return fail();
    const channelUv = channel === 0 ? uv : uv1;
    if (!channelUv) return fail();
    mapFeatures.push(`${usage}:${channel}`);
    return { uv: channelUv, index: textureIndex };
  };
  let normalMap: ReturnType<typeof textureAt>;
  if (kind === 'mesh-standard') {
    const maps = own(material, 'maps'); fields(maps, ['baseColor', 'normal', 'metalness', 'roughness', 'emissive', 'ao']);
    for (const name of ['baseColor', 'metalness', 'roughness', 'emissive', 'ao']) textureAt(own(maps, name), name);
    normalMap = textureAt(own(maps, 'normal'), 'normal');
  }
  const flat = own(material, 'flatShading', true);
  if (flat !== undefined && typeof flat !== 'boolean') return fail();
  const vertex = (row: number) => index ? index.read(row, 0) : row;
  for (let row = start; row < start + count; row += 3) {
    const a = vertex(row), b = vertex(row + 1), c = vertex(row + 2);
    if (flat) {
      const ab = [0, 1, 2].map(axis => position.read(b, axis) - position.read(a, axis));
      const ac = [0, 1, 2].map(axis => position.read(c, axis) - position.read(a, axis));
      const cross = [ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!];
      const length = Math.hypot(...cross);
      if (!Number.isFinite(length) || length < 1e-12) return fail();
      for (const id of [a, b, c]) {
        const n = [0, 1, 2].map(axis => normal.read(id, axis)), size = Math.hypot(...n);
        if (n.reduce((sum, value, axis) => sum + value * cross[axis]!, 0) / (size * length) < 1 - 1e-4) return fail();
      }
    }
    if (normalMap && !tangent) {
      const u = normalMap.uv;
      const area = (u.read(b, 0) - u.read(a, 0)) * (u.read(c, 1) - u.read(a, 1)) - (u.read(b, 1) - u.read(a, 1)) * (u.read(c, 0) - u.read(a, 0));
      if (!Number.isFinite(area) || Math.abs(area) < 1e-12) return fail();
    }
  }
  const profile: MaterialChannelProfile = Object.freeze({ kind, flatFaceNormals: flat === true,
    normalMapFrame: normalMap ? tangent ? 'tangent' : 'derivative' : 'none', colorComponents: color ? color.components as 3 | 4 : 0,
    uvChannels: Object.freeze([...(uv ? [0 as const] : []), ...(uv1 ? [1 as const] : [])]), coverage: alphaTest > 0 ? 'mask' : 'opaque',
    featureKey: JSON.stringify([kind, flat === true, Boolean(normalMap), Boolean(tangent), color?.components ?? 0, own(material, 'vertexColors'), Boolean(uv), Boolean(uv1), mapFeatures, alphaTest > 0, own(material, 'side')]) });
  profiles.add(profile);
  return profile;
}

function source(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1048576) return fail();
  return value;
}
function once(text: string, token: string): void {
  if (text.split(token).length !== 2) return fail();
}

/** Patches owned pinned Three mesh sources only; no live renderer or material is installed here. */
export function patchModelMaterialShader(input: { readonly vertexShader: string; readonly fragmentShader: string }, frame: GeographicShader, profile: MaterialChannelProfile) {
  if (!profiles.has(profile)) return fail();
  const vertex = source(own(input, 'vertexShader')), fragment = source(own(input, 'fragmentShader'));
  const approved = approvedSources[profile.kind];
  if (vertex !== approved.vertexShader || fragment !== approved.fragmentShader) return fail();
  const vertexPrelude = source(own(frame, 'vertexPrelude')), fragmentPrelude = source(own(frame, 'fragmentPrelude'));
  const defines = own(frame, 'defines');
  if (typeof defines !== 'string' || defines.length > 65536 || own(frame, 'positionEncoding') !== 'tile-xy-meters-z' ||
    own(frame, 'projectFunction') !== 'lrProjectPosition' || own(frame, 'horizonPositionFunction') !== 'lrHorizonPosition' || own(frame, 'horizonOccludedFunction') !== 'lrHorizonOccluded') return fail();
  const marker = profile.kind === 'mesh-standard' ? '#define STANDARD' : '#define PHONG';
  if (!vertex.includes(marker) || !fragment.includes(marker)) return fail();
  for (const token of ['#include <project_vertex>', '#include <normal_vertex>', '#include <uv_vertex>', 'vViewPosition = - mvPosition.xyz;']) once(vertex, token);
  for (const token of ['void main() {', '#include <alphatest_fragment>', '#include <map_fragment>', '#include <normal_fragment_maps>']) once(fragment, token);
  const vertexShader = `${defines}\n${vertexPrelude}\nattribute vec3 a_lr_geographic_position;\nvarying highp vec3 v_lr_horizon_position;\n` + vertex.replace('#include <project_vertex>',
    'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);\ngl_Position = lrProjectPosition(a_lr_geographic_position);\nv_lr_horizon_position = lrHorizonPosition(a_lr_geographic_position);');
  const fragmentShader = `${fragmentPrelude}\nvarying highp vec3 v_lr_horizon_position;\n` + fragment.replace('void main() {', 'void main() {\nif (lrHorizonOccluded(v_lr_horizon_position)) discard;');
  // Length-delimited full sources avoid cache collisions and exclude origin/uniform-only changes.
  const programKey = `lr-map-material-1:${profile.featureKey.length}:${profile.featureKey}:${vertexShader.length}:${vertexShader}:${fragmentShader.length}:${fragmentShader}`;
  return Object.freeze({ vertexShader, fragmentShader, programKey,
    materialConfiguration: Object.freeze({ flatShading: false as const, premultipliedAlpha: true as const, transparent: false as const }) });
}
