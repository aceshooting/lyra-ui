import { validateParsedModel } from './model-validation.js';
import { EmbeddedTextureLoader } from './embedded-texture-loader.js';
import { Box3, BufferAttribute, BufferGeometry, Color, Group, LoadingManager, Material, Mesh, MeshStandardMaterial, Object3D, Points, PointsMaterial, SRGBColorSpace, Texture } from 'three';
import { GLTFLoader, type GLTFLoaderPlugin, type GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ModelAdmissionError, readModelAdmission } from './admission.js';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import type { ModelAdmission, ModelEmbeddedResource, ModelParserInput } from './types.js';

export interface ParsedModel {
  readonly object: Object3D;
  readonly bounds: Box3 | null;
  readonly vertices: number;
  readonly indices: number;
  dispose(): void;
}
export interface ModelParseOptions { readonly signal?: AbortSignal }
interface GeometryObject extends Object3D { geometry: BufferGeometry; material: Material | Material[] }
function invalid(): never { throw new ModelAdmissionError('invalid'); }
function requireValid(value: unknown): asserts value { if (!value) invalid(); }
function aborted(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('Model parsing was aborted', 'AbortError'); }
function geometryObject(value: Object3D): value is GeometryObject { return 'geometry' in value && value.geometry instanceof BufferGeometry && 'material' in value; }
function materials(object: GeometryObject): Material[] { return Array.isArray(object.material) ? object.material : [object.material]; }
function materialTextures(material: Material): Texture[] { return Object.values(material).filter((value): value is Texture => value instanceof Texture); }

function disposeObjects(roots: readonly Object3D[], extraTextures: ReadonlySet<Texture>, images: ReadonlySet<ImageBitmap>): void {
  const geometries = new Set<BufferGeometry>(); const ownedMaterials = new Set<Material>(); const textures = new Set(extraTextures);
  for (const root of roots) root.traverse((object) => {
    if (!geometryObject(object)) return;
    geometries.add(object.geometry);
    for (const material of materials(object)) { ownedMaterials.add(material); materialTextures(material).forEach((texture) => textures.add(texture)); }
  });
  const failures: unknown[] = [];
  const attempt = (dispose: () => void): void => { try { dispose(); } catch (error) { failures.push(error); } };
  textures.forEach((texture) => attempt(() => texture.dispose()));
  ownedMaterials.forEach((material) => attempt(() => material.dispose()));
  geometries.forEach((geometry) => attempt(() => geometry.dispose()));
  images.forEach((image) => attempt(() => image.close())); roots.forEach((root) => attempt(() => root.removeFromParent()));
  if (failures.length) throw new AggregateError(failures, 'Model resource disposal failed');
}

/** The standard loader's optional extension factories never register for this static subset. */
class StaticGLTFLoader extends GLTFLoader {
  override register(_callback: (parser: GLTFParser) => GLTFLoaderPlugin): this { return this; }
}

function gltfDocument(input: ModelParserInput): Record<string, unknown> {
  const bytes = input.format === 'glb' ? input.bytes.subarray(20, 20 + new DataView(input.bytes.buffer).getUint32(12, true)) : input.bytes;
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}

/** Collapse admitted buffers into one BIN, so GLTFLoader never invokes a file loader. */
function embeddedGlb(input: ModelParserInput, imageUris: ReadonlyMap<number, string>): ArrayBuffer {
  const document = gltfDocument(input);
  const buffers = input.resources.filter((resource) => resource.kind === 'buffer');
  const offsets: number[] = []; let length = 0;
  for (const resource of buffers) { offsets.push(length); length += Math.ceil(resource.bytes.length / 4) * 4; }
  requireValid(length <= LIMIT.encodedBytes + LIMIT.resources * 3);
  const views = (document['bufferViews'] ?? []) as Record<string, unknown>[];
  for (const view of views) { view['byteOffset'] = offsets[view['buffer'] as number]! + ((view['byteOffset'] ?? 0) as number); view['buffer'] = 0; }
  document['buffers'] = length ? [{ byteLength: length }] : [];
  for (const [index, image] of ((document['images'] ?? []) as Record<string, unknown>[]).entries()) {
    delete image['bufferView']; image['uri'] = imageUris.get(index)!;
    image['mimeType'] = input.resources.find((resource) => resource.kind === 'image' && resource.index === index)!.mimeType;
  }
  const json = new TextEncoder().encode(JSON.stringify(document)); const jsonLength = Math.ceil(json.length / 4) * 4;
  const output = new Uint8Array(20 + jsonLength + (length ? 8 + length : 0)); const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, output.length, true);
  view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true); output.fill(32, 20, 20 + jsonLength); output.set(json, 20);
  if (length) {
    view.setUint32(20 + jsonLength, length, true); view.setUint32(24 + jsonLength, 0x004e4942, true);
    buffers.forEach((resource, index) => output.set(resource.bytes, 28 + jsonLength + offsets[index]!));
  }
  return output.buffer;
}
async function decodeImage(resource: ModelEmbeddedResource, images: Set<ImageBitmap>, signal?: AbortSignal): Promise<ImageBitmap> {
  aborted(signal);
  if (typeof createImageBitmap !== 'function') throw new ModelAdmissionError('unsupported');
  const image = await createImageBitmap(new Blob([resource.bytes], { type: resource.mimeType }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  images.add(image); aborted(signal);
  requireValid(image.width === resource.width && image.height === resource.height);
  return image;
}
function xyz(input: ModelParserInput): Points {
  const positions: number[] = []; const colors: number[] = []; const color = new Color(); let hasColors = false;
  for (const line of new TextDecoder().decode(input.bytes).split('\n')) {
    const trimmed = line.trim(); if (!trimmed || trimmed.startsWith('#')) continue;
    const row = trimmed.split(/\s+/).map(Number); positions.push(row[0]!, row[1]!, row[2]!);
    color.setRGB((row[3] ?? 255) / 255, (row[4] ?? 255) / 255, (row[5] ?? 255) / 255, SRGBColorSpace);
    colors.push(color.r, color.g, color.b); hasColors ||= row.length === 6;
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  if (hasColors) geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return new Points(geometry, new PointsMaterial({ vertexColors: hasColors }));
}

/** Parse an opaque admission receipt with no external requests or format extension plugins. */
export async function parseModel(admission: ModelAdmission, options: ModelParseOptions = {}): Promise<ParsedModel> {
  aborted(options.signal); const input = readModelAdmission(admission);
  const images = new Set<ImageBitmap>(); const textures = new Set<Texture>(); const roots: Object3D[] = [];
  let handler: EmbeddedTextureLoader | undefined;
  let transferred = false;
  let parsed: ParsedModel;
  try {
    const manager = new LoadingManager(); manager.setURLModifier(() => { throw new ModelAdmissionError('external-resource'); });
    let object: Object3D;
    if (input.format === 'gltf' || input.format === 'glb') {
      const imageMap = new Map<string, ImageBitmap>(); const imageUris = new Map<number, string>();
      for (const resource of input.resources) if (resource.kind === 'image') {
        const uri = `data:${resource.mimeType};lyra-embedded,${resource.index}`;
        imageMap.set(uri, await decodeImage(resource, images, options.signal)); imageUris.set(resource.index, uri);
      }
      aborted(options.signal);
      handler = new EmbeddedTextureLoader(manager, imageMap, textures, options.signal);
      manager.addHandler(/^data:image\/(?:png|jpeg);lyra-embedded,\d+$/, handler);
      const result = await new StaticGLTFLoader(manager).parseAsync(embeddedGlb(input, imageUris), '');
      roots.push(...result.scenes); object = result.scene ?? new Group(); if (!roots.includes(object)) roots.push(object);
      aborted(options.signal); requireValid(!handler.failed);
    } else if (input.format === 'obj') object = new OBJLoader(manager).parse(new TextDecoder().decode(input.bytes));
    else if (input.format === 'pcd') object = new PCDLoader(manager).parse(input.bytes.buffer);
    else if (input.format === 'xyz') object = xyz(input);
    else {
      const geometry = input.format === 'stl' ? new STLLoader(manager).parse(input.bytes.buffer) : new PLYLoader(manager).parse(input.bytes.buffer);
      const hasColors = geometry.hasAttribute('color');
      object = input.format === 'ply' && !geometry.index ? new Points(geometry, new PointsMaterial({ vertexColors: hasColors })) : new Mesh(geometry, new MeshStandardMaterial({ vertexColors: hasColors, flatShading: !geometry.hasAttribute('normal') }));
    }
    if (!roots.includes(object)) roots.push(object);
    aborted(options.signal); const allScenes = validateParsedModel(roots, admission);
    const measured = roots.length === 1 ? allScenes : validateParsedModel([object], admission);
    let disposed = false; transferred = true;
    parsed = { object, ...measured, dispose() { if (!disposed) { disposed = true; handler?.retire(); disposeObjects(roots, textures, images); } } };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof ModelAdmissionError) throw error;
    throw new ModelAdmissionError('invalid');
  } finally {
    if (!transferred) {
      handler?.retire();
      // A cleanup listener must not replace the original parse/abort failure.
      try { disposeObjects(roots, textures, images); } catch { /* Every owned resource was attempted. */ }
    }
  }
  return parsed;
}
