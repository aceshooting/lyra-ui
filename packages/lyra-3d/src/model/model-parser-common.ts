import { BufferGeometry, Texture, type Box3, type LoadingManager, type Material, type Object3D } from 'three';
import { ModelAdmissionError } from './admission.js';
import type { ModelAdmission, ModelParserInput } from './types.js';

export interface ParsedModel {
  readonly object: Object3D;
  readonly bounds: Box3 | null;
  readonly vertices: number;
  readonly indices: number;
  dispose(): void;
}
interface GeometryObject extends Object3D { geometry: BufferGeometry; material: Material | Material[] }
function invalid(): never { throw new ModelAdmissionError('invalid'); }
export function requireValid(value: unknown): asserts value { if (!value) invalid(); }
export function aborted(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('Model parsing was aborted', 'AbortError'); }
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

export interface ModelParserContext {
  readonly input: ModelParserInput;
  readonly admission: ModelAdmission;
  readonly manager: LoadingManager;
  readonly signal?: AbortSignal;
  readonly roots: Object3D[];
  readonly textures: Set<Texture>;
  readonly images: Set<ImageBitmap>;
  readonly retirement: (() => void)[];
}
export type FormatParser = (context: ModelParserContext) => Object3D | Promise<Object3D>;

export function disposeParserContext(context: ModelParserContext): void {
  const failures: unknown[] = [];
  for (const retire of context.retirement) try { retire(); } catch (error) { failures.push(error); }
  try { disposeObjects(context.roots, context.textures, context.images); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, 'Model resource disposal failed');
}
