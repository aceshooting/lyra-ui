import { Matrix4, PropertyBinding, Quaternion, Vector3 } from 'three';
import { ModelAdmissionError } from '../admission.js';
import { ModelWorkMeter, type ModelWorkUnit } from '../model-work.js';
import type {
  AdmittedModelInput, ModelAttributeDescriptor, ModelAttributeScalarKind, ModelDescriptor,
  ModelGeometryDescriptor, ModelJsonRecord, ModelJsonValue, ModelMaterialBase, ModelMaterialDescriptor,
  ModelNodeDescriptor, ModelNumericArray, ModelPreparedDecoder, ModelRgb, ModelTextureDescriptor,
} from '../model-prepared-types.js';

type Task<T> = Generator<ModelWorkUnit, T, void>;
type GltfPlan = Extract<AdmittedModelInput['plan'], { format: 'gltf' | 'glb' }>;
type MutableNode = { -readonly [Key in keyof ModelNodeDescriptor]: ModelNodeDescriptor[Key] } & { children: number[] };
type StandardMaterial = Extract<ModelMaterialDescriptor, { kind: 'mesh-standard' }>;
type MutableTexture = { -readonly [Key in keyof ModelTextureDescriptor]: ModelTextureDescriptor[Key] };
const attributes = { POSITION: 'position', NORMAL: 'normal', TANGENT: 'tangent', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', COLOR_0: 'color' } as const;
const identity = (): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const record = (value: ModelJsonValue | undefined): ModelJsonRecord => value as ModelJsonRecord;
const list = (value: ModelJsonValue | undefined): readonly ModelJsonValue[] => value === undefined ? [] : value as readonly ModelJsonValue[];
const number = (value: ModelJsonValue | undefined, fallback = 0): number => value === undefined ? fallback : value as number;
const name = (value: ModelJsonValue | undefined): string => typeof value === 'string' ? value : '';
const rgb = (value: ModelJsonValue | undefined, fallback: ModelRgb): ModelRgb => value === undefined ? fallback : [number(list(value)[0]), number(list(value)[1]), number(list(value)[2])];

function scalarLayout(component: number): { kind: ModelAttributeScalarKind; size: number } {
  switch (component) {
    case 5120: return { kind: 'i8', size: 1 };
    case 5121: return { kind: 'u8', size: 1 };
    case 5122: return { kind: 'i16', size: 2 };
    case 5123: return { kind: 'u16', size: 2 };
    case 5125: return { kind: 'u32', size: 4 };
    case 5126: return { kind: 'f32', size: 4 };
    default: throw new ModelAdmissionError('invalid');
  }
}
function readScalar(view: DataView, offset: number, component: number): number {
  switch (component) {
    case 5120: return view.getInt8(offset);
    case 5121: return view.getUint8(offset);
    case 5122: return view.getInt16(offset, true);
    case 5123: return view.getUint16(offset, true);
    case 5125: return view.getUint32(offset, true);
    case 5126: return view.getFloat32(offset, true);
    default: throw new ModelAdmissionError('invalid');
  }
}
function transform(definition: ModelJsonRecord): number[] {
  const matrix = new Matrix4(); const position = new Vector3(); const rotation = new Quaternion(); const scale = new Vector3(1, 1, 1);
  if (definition['matrix'] !== undefined) {
    matrix.fromArray(list(definition['matrix']) as readonly number[]);
    // Object3D.applyMatrix4 decomposes before the next matrix update.
    matrix.decompose(position, rotation, scale);
  } else {
    if (definition['translation'] !== undefined) position.fromArray(list(definition['translation']) as readonly number[]);
    if (definition['rotation'] !== undefined) rotation.fromArray(list(definition['rotation']) as readonly number[]);
    if (definition['scale'] !== undefined) scale.fromArray(list(definition['scale']) as readonly number[]);
  }
  return matrix.compose(position, rotation, scale).toArray();
}

export const createPreparedGltf: ModelPreparedDecoder = (input, services) => {
  if ((input.plan.format !== 'gltf' && input.plan.format !== 'glb') || input.input.format !== input.plan.format) throw new ModelAdmissionError('unsupported');
  let owned: AdmittedModelInput | undefined = input;
  let active = true;
  let pending: IteratorResult<ModelWorkUnit, ModelDescriptor> | undefined;
  const nodes: MutableNode[] = []; const geometries: ModelGeometryDescriptor[] = [];
  const materials: ModelMaterialDescriptor[] = []; const textures: MutableTexture[] = []; const roots: number[] = [];
  const accessorCache = new Map<number, ModelAttributeDescriptor>(); const storageCache = new Map<string, ModelNumericArray>();
  const baseMaterials = new Map<number, StandardMaterial>();
  const geometryCache = new Map<string, number>(); const materialCache = new Map<string, number>(); const textureCache = new Map<string, number>();
  const meshTemplates = new Map<number, readonly MutableNode[]>(); const nodeNames = new Map<number, string>();
  const uniqueNames = new Map<string, number>(); const meshReferences = new Map<number, number>(); const meshUses = new Map<number, number>();
  const imageResources = new Map<number, number>(); const nodeIds = new Map<number, number>();

  function unique(value: string): string {
    const cleaned = PropertyBinding.sanitizeNodeName(value); const count = uniqueNames.get(cleaned);
    if (count === undefined) { uniqueNames.set(cleaned, 0); return cleaned; }
    uniqueNames.set(cleaned, count + 1); return `${cleaned}_${count + 1}`;
  }
  function* accessor(plan: GltfPlan, index: number): Task<ModelAttributeDescriptor> {
    const cached = accessorCache.get(index); if (cached) return cached;
    yield 'records';
    const definition = plan.accessors[index]!; const source = plan.views[definition.view]!;
    const resource = owned!.resources[source.resource]!; const layout = scalarLayout(definition.component);
    const interleaved = source.stride !== null && source.stride !== 0 && source.stride !== definition.components * layout.size;
    const stride = interleaved ? source.stride! / layout.size : definition.components;
    const start = interleaved ? Math.floor(definition.offset / source.stride!) * source.stride! : definition.offset;
    const offset = interleaved ? definition.offset % source.stride! / layout.size : 0;
    const length = definition.count * stride;
    if (start + length * layout.size > source.length) throw new ModelAdmissionError('invalid');
    const key = interleaved ? `${definition.view}:${definition.component}:${start}:${definition.count}` : `accessor:${index}`;
    let array = storageCache.get(key);
    if (!array) {
      array = services.allocateAttribute(layout.kind, length); storageCache.set(key, array);
      const view = new DataView(resource.bytes.buffer, resource.bytes.byteOffset + source.offset + start, length * layout.size);
      for (let scalar = 0; scalar < length; scalar++) {
        for (let byte = 0; byte < layout.size; byte++) yield 'bytes';
        yield 'scalars'; array[scalar] = readScalar(view, scalar * layout.size, definition.component);
      }
    }
    const result: ModelAttributeDescriptor = { array, itemSize: definition.components, normalized: definition.normalized, count: definition.count, stride, offset };
    accessorCache.set(index, result); return result;
  }
  function* geometry(plan: GltfPlan, primitive: ModelJsonRecord): Task<number> {
    yield 'records';
    const definitions = record(primitive['attributes']); const mode = number(primitive['mode'], 4);
    let key = `${String(primitive['indices'])}:${String(primitive['mode'])}`;
    for (const semantic of Object.keys(attributes) as (keyof typeof attributes)[]) if (definitions[semantic] !== undefined) key += `:${semantic}:${String(definitions[semantic])}`;
    const existing = geometryCache.get(key); if (existing !== undefined) return existing;
    const result: Record<string, ModelAttributeDescriptor> = {};
    for (const semantic of Object.keys(attributes) as (keyof typeof attributes)[]) {
      if (definitions[semantic] === undefined) continue;
      result[attributes[semantic]] = yield* accessor(plan, number(definitions[semantic]));
    }
    let index: Uint8Array | Uint16Array | Uint32Array | null = null;
    let sourceIndex: ModelAttributeDescriptor | undefined;
    let indexAttribute: ModelAttributeDescriptor | undefined;
    if (primitive['indices'] !== undefined) sourceIndex = yield* accessor(plan, number(primitive['indices']));
    const count = sourceIndex?.count ?? result['position']!.count;
    const at = (position: number): number => sourceIndex ? sourceIndex.array[position * sourceIndex.stride + sourceIndex.offset]! : position;
    if (mode === 5 || mode === 6) {
      let maximum = 0;
      for (let i = 0; i < count; i++) { yield 'scalars'; maximum = Math.max(maximum, at(i)); }
      index = services.allocateIndex(maximum >= 65535 ? 'u32' : 'u16', (count - 2) * 3);
      let cursor = 0;
      for (let triangle = 0; triangle < count - 2; triangle++) {
        const a = mode === 6 ? 0 : triangle % 2 === 0 ? triangle : triangle + 2;
        const b = triangle + 1; const c = mode === 6 ? triangle + 2 : triangle % 2 === 0 ? triangle + 2 : triangle;
        for (const vertex of [a, b, c]) { yield 'scalars'; index[cursor++] = at(vertex); }
      }
    } else if (sourceIndex) {
      if (sourceIndex.stride === 1 && sourceIndex.offset === 0) index = sourceIndex.array as Uint8Array | Uint16Array | Uint32Array;
      else indexAttribute = sourceIndex;
    }
    const id = geometries.length;
    geometries.push({ attributes: result, index, ...(indexAttribute ? { indexAttribute } : {}), groups: [], drawRange: { start: 0, count: null } });
    geometryCache.set(key, id); return id;
  }
  function texture(document: ModelJsonRecord, info: ModelJsonRecord, colorSpace?: 'srgb'): number {
    const definition = record(list(document['textures'])[number(info['index'])]);
    const source = number(definition['source']); const samplerIndex = definition['sampler'];
    const sampler: ModelJsonRecord = samplerIndex === undefined ? {} : record(list(document['samplers'])[number(samplerIndex)]);
    const key = `${source}:${String(samplerIndex)}`; let base = textureCache.get(key);
    if (base === undefined) {
      const image = record(list(document['images'])[source]); const minFilter = number(sampler['minFilter'], 9987) as ModelTextureDescriptor['minFilter'];
      base = textures.length; textureCache.set(key, base);
      textures.push({ name: name(definition['name']) || name(image['name']), resource: imageResources.get(source)!,
        magFilter: number(sampler['magFilter'], 9729) as ModelTextureDescriptor['magFilter'], minFilter,
        wrapS: number(sampler['wrapS'], 10497) as ModelTextureDescriptor['wrapS'], wrapT: number(sampler['wrapT'], 10497) as ModelTextureDescriptor['wrapT'],
        texCoord: 0, colorSpace: 'none', flipY: false, generateMipmaps: minFilter !== 9728 && minFilter !== 9729 });
    }
    let selected = base;
    // Channel-one assignments create separate texture instances, including repeated slots.
    if (number(info['texCoord']) > 0) { selected = textures.length; textures.push({ ...textures[base]!, texCoord: 1 }); }
    if (colorSpace) textures[selected]!.colorSpace = colorSpace;
    return selected;
  }
  function* baseMaterial(document: ModelJsonRecord, index: number): Task<StandardMaterial> {
    const cached = baseMaterials.get(index); if (cached) return cached;
    yield 'records';
    const definition: ModelJsonRecord = index < 0 ? {} : record(list(document['materials'])[index]);
    const pbr: ModelJsonRecord = definition['pbrMetallicRoughness'] === undefined ? {} : record(definition['pbrMetallicRoughness']);
    const factor = pbr['baseColorFactor']; const alpha = definition['alphaMode'];
    const base: ModelMaterialBase = { name: name(definition['name']), color: rgb(factor, [1, 1, 1]),
      ...(factor === undefined ? index < 0 ? { colorConversion: 'srgb' as const } : {} : { colorConversion: 'linear-srgb' as const }),
      opacity: factor === undefined ? 1 : number(list(factor)[3]), transparent: alpha === 'BLEND', depthWrite: alpha !== 'BLEND',
      alphaTest: alpha === 'MASK' ? number(definition['alphaCutoff'], 0.5) : 0, side: definition['doubleSided'] === true ? 2 : 0,
      vertexColors: false };
    const maps: { baseColor: number | null; normal: number | null; metalness: number | null; roughness: number | null; emissive: number | null; ao: number | null } = { baseColor: null, normal: null, metalness: null, roughness: null, emissive: null, ao: null };
    for (const [value, slot, colorSpace] of [
      [pbr['baseColorTexture'], 'baseColor', 'srgb'], [pbr['metallicRoughnessTexture'], 'metalness', undefined],
      [pbr['metallicRoughnessTexture'], 'roughness', undefined], [definition['normalTexture'], 'normal', undefined],
      [definition['occlusionTexture'], 'ao', undefined], [definition['emissiveTexture'], 'emissive', 'srgb'],
    ] as const) {
      if (value !== undefined) { yield 'records'; maps[slot] = texture(document, record(value), colorSpace); }
    }
    const normal: ModelJsonRecord = definition['normalTexture'] === undefined ? {} : record(definition['normalTexture']);
    const occlusion: ModelJsonRecord = definition['occlusionTexture'] === undefined ? {} : record(definition['occlusionTexture']);
    const scale = number(normal['scale'], 1);
    const result: StandardMaterial = { ...base, kind: 'mesh-standard', flatShading: false,
      roughness: number(pbr['roughnessFactor'], 1), metalness: number(pbr['metallicFactor'], 1),
      emissive: rgb(definition['emissiveFactor'], [0, 0, 0]), ...(definition['emissiveFactor'] === undefined ? {} : { emissiveConversion: 'linear-srgb' as const }),
      normalScale: [scale, scale], aoMapIntensity: number(occlusion['strength'], 1), maps };
    baseMaterials.set(index, result); return result;
  }
  function* material(document: ModelJsonRecord, primitive: ModelJsonRecord, geometryId: number): Task<number> {
    yield 'records';
    const geometry = geometries[geometryId]!; const mode = number(primitive['mode'], 4);
    const kind = mode === 0 ? 'points' : mode <= 3 ? 'line-basic' : 'mesh-standard';
    const vertexColors = geometry.attributes['color'] !== undefined; const flatShading = geometry.attributes['normal'] === undefined;
    const derivative = geometry.attributes['tangent'] === undefined;
    const key = `${String(primitive['material'])}:${kind}:${vertexColors}:${flatShading}:${derivative}`;
    const previous = materialCache.get(key); if (previous !== undefined) return previous;
    const standard = yield* baseMaterial(document, number(primitive['material'], -1));
    const base: ModelMaterialBase = { name: standard.name, color: standard.color,
      ...(standard.colorConversion ? { colorConversion: standard.colorConversion } : {}), opacity: standard.opacity,
      transparent: standard.transparent, depthWrite: standard.depthWrite, alphaTest: standard.alphaTest, side: standard.side,
      vertexColors, ...(flatShading || kind === 'mesh-standard' ? { flatShading } : {}) };
    let result: ModelMaterialDescriptor;
    if (kind === 'points') result = { ...base, kind, size: 1, sizeAttenuation: false, map: standard.maps.baseColor };
    else if (kind === 'line-basic') result = { ...base, kind, linewidth: 1, map: standard.maps.baseColor };
    else result = { ...standard, ...base, kind, flatShading, normalScale: [standard.normalScale[0], derivative ? -standard.normalScale[1] : standard.normalScale[1]] };
    const id = materials.length; materials.push(result); materialCache.set(key, id); return id;
  }
  function* discover(document: ModelJsonRecord, index: number): Task<void> {
    yield 'records';
    const definition = record(list(document['nodes'])[index]); const nodeName = name(definition['name']);
    nodeNames.set(index, nodeName ? unique(nodeName) : '');
    for (const child of list(definition['children'])) yield* discover(document, number(child));
  }
  function* mesh(plan: GltfPlan, index: number): Task<readonly MutableNode[]> {
    const previous = meshTemplates.get(index); if (previous) return previous;
    const definition = record(list(plan.document['meshes'])[index]); const templates: MutableNode[] = [];
    for (const value of list(definition['primitives'])) {
      const primitive = record(value); const geometryId = yield* geometry(plan, primitive);
      const materialId = yield* material(plan.document, primitive, geometryId); yield 'records';
      const mode = number(primitive['mode'], 4); const kind = mode === 0 ? 'points' : mode === 1 ? 'line-segments' : mode === 2 ? 'line-loop' : mode === 3 ? 'line' : 'mesh';
      templates.push({ kind, name: unique(name(definition['name']) || `mesh_${index}`), matrix: identity(), children: [], geometry: geometryId, materials: [materialId] });
    }
    meshTemplates.set(index, templates); return templates;
  }
  function* node(plan: GltfPlan, index: number): Task<number> {
    const previous = nodeIds.get(index); if (previous !== undefined) return previous;
    yield 'records'; const definition = record(list(plan.document['nodes'])[index]);
    let result: MutableNode;
    if (definition['mesh'] === undefined) result = { kind: 'object', name: '', matrix: identity(), children: [], geometry: null, materials: [] };
    else {
      const meshIndex = number(definition['mesh']); const templates = yield* mesh(plan, meshIndex);
      if (templates.length === 1) result = { ...templates[0]!, children: [] };
      else {
        result = { kind: 'group', name: '', matrix: identity(), children: [], geometry: null, materials: [] };
        for (const template of templates) { yield 'records'; result.children.push(nodes.length); nodes.push({ ...template, children: [] }); }
      }
      if ((meshReferences.get(meshIndex) ?? 0) > 1) {
        const use = meshUses.get(meshIndex) ?? 0; meshUses.set(meshIndex, use + 1); result.name += `_instance_${use}`;
      }
    }
    yield 'records';
    if (nodeNames.get(index)) result.name = nodeNames.get(index)!;
    result.matrix = transform(definition); const id = nodes.length; nodes.push(result); nodeIds.set(index, id);
    for (const child of list(definition['children'])) result.children.push(yield* node(plan, number(child)));
    return id;
  }
  function* generate(): Task<ModelDescriptor> {
    const plan = owned!.plan as GltfPlan; const document = plan.document;
    for (let i = 0; i < owned!.resources.length; i++) { yield 'records'; const resource = owned!.resources[i]!; if (resource.kind === 'image') imageResources.set(resource.index, i); }
    for (const value of list(document['nodes'])) { yield 'records'; const definition = record(value); if (definition['mesh'] !== undefined) { const index = number(definition['mesh']); meshReferences.set(index, (meshReferences.get(index) ?? 0) + 1); } }
    for (const value of list(document['scenes'])) {
      yield 'records'; const definition = record(value); const sceneName = name(definition['name']);
      roots.push(nodes.length); nodes.push({ kind: 'group', name: sceneName ? unique(sceneName) : '', matrix: identity(), children: [], geometry: null, materials: [] });
      for (const child of list(definition['nodes'])) yield* discover(document, number(child));
    }
    const scenes = list(document['scenes']);
    for (let scene = 0; scene < scenes.length; scene++) {
      const definition = record(scenes[scene]);
      for (const child of list(definition['nodes'])) nodes[roots[scene]!]!.children.push(yield* node(plan, number(child)));
    }
    if (!roots.length) { yield 'records'; roots.push(nodes.length); nodes.push({ kind: 'group', name: '', matrix: identity(), children: [], geometry: null, materials: [] }); }
    return { protocol: 1, roots, selectedRoot: roots[number(document['scene'])]!, nodes, geometries, materials, textures };
  }
  const iterator = generate();
  const release = (): void => {
    owned = undefined; baseMaterials.clear(); accessorCache.clear(); storageCache.clear(); geometryCache.clear(); materialCache.clear(); textureCache.clear();
    meshTemplates.clear(); nodeNames.clear(); uniqueNames.clear(); meshReferences.clear(); meshUses.clear(); imageResources.clear(); nodeIds.clear();
  };
  return {
    step(budget) {
      if (!active) throw new Error('Model decoder work is no longer active');
      const meter = new ModelWorkMeter(budget);
      try {
        pending ??= iterator.next();
        while (!pending.done) {
          if (!meter.take(pending.value)) return { done: false, used: meter.used };
          pending = iterator.next();
        }
        active = false; const value = pending.value; pending = undefined; release();
        return { done: true, used: meter.used, value };
      } catch (error) {
        active = false; iterator.return(undefined as never); pending = undefined; release();
        nodes.length = 0; geometries.length = 0; materials.length = 0; textures.length = 0; roots.length = 0;
        throw error;
      }
    },
    dispose() {
      if (!active) return;
      active = false; iterator.return(undefined as never); pending = undefined; release();
      nodes.length = 0; geometries.length = 0; materials.length = 0; textures.length = 0; roots.length = 0;
    },
  };
};
