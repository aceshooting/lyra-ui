import type { ModelJsonString } from './model-json-string.js';
import type { ModelEmbeddedResource, ModelFormat } from './types.js';
import type { ModelIncrementalWork } from './model-work.js';

export interface OwnedModelInput { readonly format: ModelFormat; readonly bytes: Uint8Array<ArrayBuffer> }
export interface ModelAdmissionCounts {
  readonly encodedBytes: number; readonly decodedBytes: number; readonly vertices: number;
  readonly indices: number; readonly imagePixels: number; readonly resources: number;
}
export interface ModelScalarPlan { readonly bytes: 1 | 2 | 4 | 8; readonly kind: 'signed' | 'unsigned' | 'float' }
export type ModelPlyPropertyPlan = { readonly name: string; readonly kind: 'scalar'; readonly scalar: ModelScalarPlan }
  | { readonly name: string; readonly kind: 'list'; readonly count: ModelScalarPlan; readonly item: ModelScalarPlan };
export type ModelJsonValue = null | boolean | number | string | ModelJsonString | readonly ModelJsonValue[] | ModelJsonRecord;
export interface ModelJsonRecord { readonly [key: string]: ModelJsonValue }
export type AdmittedFormatPlan =
  | { readonly format: 'xyz'; readonly rows: number }
  | { readonly format: 'obj'; readonly vertices: number; readonly normals: number; readonly uvs: number; readonly outputVertices: number; readonly entries: number }
  | { readonly format: 'stl'; readonly variant: 'ascii' | 'binary'; readonly facets: number; readonly dataOffset: number }
  | { readonly format: 'ply'; readonly variant: 'ascii' | 'binary-le' | 'binary-be'; readonly dataOffset: number; readonly elements: readonly { readonly name: string; readonly count: number; readonly properties: readonly ModelPlyPropertyPlan[] }[] }
  | { readonly format: 'pcd'; readonly variant: 'ascii' | 'binary'; readonly dataOffset: number; readonly fields: readonly { readonly name: string; readonly scalar: ModelScalarPlan }[]; readonly width: number; readonly height: number; readonly points: number; readonly viewpoint: readonly number[] | null }
  | { readonly format: 'gltf' | 'glb'; readonly document: ModelJsonRecord;
      readonly views: readonly { readonly resource: number; readonly offset: number; readonly length: number; readonly stride: number | null }[];
      readonly accessors: readonly { readonly view: number; readonly offset: number; readonly count: number; readonly components: 1 | 2 | 3 | 4; readonly component: 5120 | 5121 | 5122 | 5123 | 5125 | 5126; readonly normalized: boolean; readonly type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' }[] };
export interface ModelPreparedResource extends Omit<ModelEmbeddedResource, 'uri'> { readonly uri: string | ModelJsonString | null }
export interface AdmittedModelInput { readonly input: OwnedModelInput; readonly counts: ModelAdmissionCounts; readonly resources: readonly ModelPreparedResource[]; readonly plan: AdmittedFormatPlan }
export type ModelNumericArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;
export type ModelAttributeScalarKind = 'i8' | 'u8' | 'u8c' | 'i16' | 'u16' | 'i32' | 'u32' | 'f32' | 'f64';
export interface ModelDecoderServices {
  allocateAttribute(kind: ModelAttributeScalarKind, length: number): ModelNumericArray;
  allocateIndex(kind: 'u8' | 'u16' | 'u32', length: number): Uint8Array | Uint16Array | Uint32Array;
}
export interface ModelAttributeDescriptor { readonly array: ModelNumericArray; readonly itemSize: 1 | 2 | 3 | 4; readonly normalized: boolean; readonly count: number; readonly stride: number; readonly offset: number; readonly colorConversion?: { readonly space: 'srgb' | 'linear-srgb'; readonly scale: 1 | 255; readonly output: 'f32' | 'u8-normalized'; readonly authoredRows?: Uint8Array } }
export interface ModelGeometryDescriptor {
  readonly attributes: Readonly<Record<string, ModelAttributeDescriptor>>;
  readonly index: Uint8Array | Uint16Array | Uint32Array | null;
  readonly indexAttribute?: ModelAttributeDescriptor;
  readonly groups: readonly { readonly start: number; readonly count: number; readonly materialIndex: number }[];
  readonly groupNames?: readonly string[]; readonly hasColors?: boolean; readonly alpha?: number;
  readonly drawRange: { readonly start: number; readonly count: number | null };
}
export interface ModelNodeDescriptor {
  readonly kind: 'object' | 'group' | 'mesh' | 'points' | 'line' | 'line-segments' | 'line-loop'; readonly name: string;
  readonly matrix: readonly number[]; readonly children: readonly number[]; readonly geometry: number | null; readonly materials: readonly number[];
}
export type ModelRgb = readonly [number, number, number];
export interface ModelMaterialBase {
  readonly flatShading?: boolean;
  readonly colorConversion?: 'srgb' | 'linear-srgb';
  readonly name: string; readonly color: ModelRgb; readonly opacity: number; readonly transparent: boolean;
  readonly alphaTest: number; readonly depthWrite: boolean; readonly side: 0 | 1 | 2; readonly vertexColors: boolean;
}
export type ModelMaterialDescriptor =
  | (ModelMaterialBase & { readonly kind: 'points'; readonly size: number; readonly sizeAttenuation: boolean; readonly map: number | null })
  | (ModelMaterialBase & { readonly kind: 'line-basic'; readonly linewidth: number; readonly map: number | null })
  | (ModelMaterialBase & { readonly kind: 'mesh-phong'; readonly aoMapIntensity: number; readonly specularConversion?: 'srgb'; readonly flatShading: boolean; readonly emissive: ModelRgb; readonly specular: ModelRgb; readonly shininess: number })
  | (ModelMaterialBase & { readonly kind: 'mesh-standard'; readonly emissiveConversion?: 'linear-srgb'; readonly flatShading: boolean; readonly roughness: number; readonly metalness: number; readonly emissive: ModelRgb;
      readonly normalScale: readonly [number, number]; readonly aoMapIntensity: number;
      readonly maps: { readonly baseColor: number | null; readonly normal: number | null; readonly metalness: number | null; readonly roughness: number | null; readonly emissive: number | null; readonly ao: number | null } });
export interface ModelTextureDescriptor {
  readonly name: string; readonly resource: number; readonly magFilter: 9728 | 9729; readonly minFilter: 9728 | 9729 | 9984 | 9985 | 9986 | 9987;
  readonly wrapS: 33071 | 33648 | 10497; readonly wrapT: 33071 | 33648 | 10497; readonly texCoord: 0 | 1;
  readonly colorSpace: 'srgb' | 'none'; readonly flipY: boolean; readonly generateMipmaps: boolean;
}
export interface ModelDescriptor {
  readonly protocol: 1; readonly roots: readonly number[]; readonly selectedRoot: number;
  readonly nodes: readonly ModelNodeDescriptor[]; readonly geometries: readonly ModelGeometryDescriptor[];
  readonly materials: readonly ModelMaterialDescriptor[]; readonly textures: readonly ModelTextureDescriptor[];
}

export type ModelPreparedDecoder = (input: AdmittedModelInput, services: ModelDecoderServices) => ModelIncrementalWork<ModelDescriptor>;
