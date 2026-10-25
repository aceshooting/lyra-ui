import { Box3, BufferAttribute, BufferGeometry, Color, Group, InterleavedBuffer, InterleavedBufferAttribute, Line, LineBasicMaterial, LineLoop, LineSegments, LinearFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, LinearSRGBColorSpace, Mesh, MeshPhongMaterial, MeshStandardMaterial, MirroredRepeatWrapping, NearestFilter, NearestMipmapLinearFilter, NearestMipmapNearestFilter, NoColorSpace, Object3D, Points, PointsMaterial, RepeatWrapping, ClampToEdgeWrapping, Sphere, SRGBColorSpace, Texture, Vector3, type Material } from 'three';
import { MODEL_LIMITS } from './limits.js';
import { ModelAdmissionError } from './admission.js';
import { aborted, type ParsedModel } from './model-parser-common.js';
import type { AdmittedModelInput, ModelAttributeDescriptor, ModelDescriptor, ModelMaterialDescriptor } from './model-prepared-types.js';
import { createModelGeneratorWork, type ModelWorkGenerator } from './model-work-generator.js';

export async function decodePreparedImages(admitted: AdmittedModelInput, signal?: AbortSignal): Promise<Map<number, ImageBitmap>> {
  const images = new Map<number, ImageBitmap>();
  try {
    for (let index = 0; index < admitted.resources.length; index++) {
      const resource = admitted.resources[index]!; if (resource.kind !== 'image') continue;
      aborted(signal); if (typeof createImageBitmap !== 'function') throw new ModelAdmissionError('unsupported');
      const image = await createImageBitmap(new Blob([resource.bytes], { type: resource.mimeType }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      images.set(index, image); aborted(signal);
      if (image.width !== resource.width || image.height !== resource.height) throw new ModelAdmissionError('invalid');
    }
    return images;
  } catch (error) { for (const image of images.values()) try { image.close(); } catch { /* Release every owned image. */ } throw error; }
}

export function createModelMaterialization(descriptor: ModelDescriptor, admitted: AdmittedModelInput, images: Map<number, ImageBitmap>) {
  const geometries: BufferGeometry[] = []; const materials: Material[] = []; const textures: Texture[] = []; const nodes: Object3D[] = [];
  let disposed = false; let published = false;
  const textureSources = new Map<number, Texture>();
  const dispose = (): void => {
    if (disposed) return; disposed = true;
    for (const texture of textures) try { texture.dispose(); } catch { /* Continue releasing owned resources. */ }
    for (const material of materials) try { material.dispose(); } catch { /* Continue releasing owned resources. */ }
    for (const geometry of geometries) try { geometry.dispose(); } catch { /* Continue releasing owned resources. */ }
    for (const image of images.values()) try { image.close(); } catch { /* Continue releasing owned resources. */ }
    for (const node of nodes) node.removeFromParent(); images.clear(); textureSources.clear();
  };
  const attributes = new Map<ModelAttributeDescriptor, BufferAttribute | InterleavedBufferAttribute>();
  const interleaved = new Map<object, Map<number, InterleavedBuffer>>();
  let allocation = 0; const buffers = new Set<ArrayBufferLike>();

  const color = new Color();
  const attribute = function* (source: ModelAttributeDescriptor): ModelWorkGenerator<BufferAttribute | InterleavedBufferAttribute> {
    const cached = attributes.get(source); if (cached) return cached;
    let array = source.array;
    if (source.colorConversion) {
      const conversion = source.colorConversion;
      const size = conversion.output === 'f32' ? 4 : 1;
      allocation += source.count * 3 * size; if (allocation > admitted.counts.decodedBytes) throw new ModelAdmissionError('limit');
      yield 'records'; const output = conversion.output === 'f32' ? new Float32Array(source.count * 3) : new Uint8Array(source.count * 3);
      for (let row = 0; row < source.count; row++) {
        yield 'records'; const offset = row * 3;
        if (conversion.authoredRows && conversion.authoredRows[row] === 0) { output[offset] = array[offset]!; output[offset + 1] = array[offset + 1]!; output[offset + 2] = array[offset + 2]!; continue; }
        color.setRGB(array[offset]! / conversion.scale, array[offset + 1]! / conversion.scale, array[offset + 2]! / conversion.scale, conversion.space === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace);
        output[offset] = conversion.output === 'u8-normalized' ? Math.round(color.r * 255) : color.r;
        output[offset + 1] = conversion.output === 'u8-normalized' ? Math.round(color.g * 255) : color.g;
        output[offset + 2] = conversion.output === 'u8-normalized' ? Math.round(color.b * 255) : color.b;
        for (let axis = 0; axis < 3; axis++) if (!Number.isFinite(output[offset + axis]) || Math.abs(output[offset + axis]!) > MODEL_LIMITS.coordinate) throw new ModelAdmissionError('invalid');
      }
      array = output;
    }
    let result: BufferAttribute | InterleavedBufferAttribute;
    if (source.stride === source.itemSize && source.offset === 0) result = new BufferAttribute(array, source.itemSize, source.normalized);
    else {
      let byStride = interleaved.get(array); if (!byStride) { byStride = new Map(); interleaved.set(array, byStride); }
      let buffer = byStride.get(source.stride); if (!buffer) { buffer = new InterleavedBuffer(array, source.stride); byStride.set(source.stride, buffer); }
      result = new InterleavedBufferAttribute(buffer, source.itemSize, source.offset, source.normalized);
    }
    attributes.set(source, result); return result;
  };
  const rgb = (target: Color, values: readonly [number, number, number], conversion?: 'srgb' | 'linear-srgb'): void => { if (conversion) target.setRGB(...values, conversion === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace); else { target.r = values[0]; target.g = values[1]; target.b = values[2]; } };
  const textureAt = (index: number | null): Texture | null => index === null ? null : textures[index]!;
  const material = (source: ModelMaterialDescriptor): Material => {
    const result = source.kind === 'points' ? new PointsMaterial() : source.kind === 'line-basic' ? new LineBasicMaterial() : source.kind === 'mesh-phong' ? new MeshPhongMaterial() : new MeshStandardMaterial();
    result.name = source.name; result.opacity = source.opacity; result.transparent = source.transparent; result.alphaTest = source.alphaTest; result.depthWrite = source.depthWrite; result.side = source.side; result.vertexColors = source.vertexColors;
    rgb(result.color, source.color, source.colorConversion);
    if (source.flatShading !== undefined) (result as Material & { flatShading: boolean }).flatShading = source.flatShading;
    if (source.kind === 'points') { const points = result as PointsMaterial; points.size = source.size; points.sizeAttenuation = source.sizeAttenuation; points.map = textureAt(source.map); }
    else if (source.kind === 'line-basic') { const line = result as LineBasicMaterial; line.linewidth = source.linewidth; line.map = textureAt(source.map); }
    else if (source.kind === 'mesh-phong') { const phong = result as MeshPhongMaterial; rgb(phong.emissive, source.emissive); rgb(phong.specular, source.specular, source.specularConversion); phong.shininess = source.shininess; phong.aoMapIntensity = source.aoMapIntensity; }
    else {
      const standard = result as MeshStandardMaterial; rgb(standard.emissive, source.emissive, source.emissiveConversion); standard.roughness = source.roughness; standard.metalness = source.metalness; standard.normalScale.set(...source.normalScale); standard.aoMapIntensity = source.aoMapIntensity;
      standard.map = textureAt(source.maps.baseColor); standard.normalMap = textureAt(source.maps.normal); standard.metalnessMap = textureAt(source.maps.metalness); standard.roughnessMap = textureAt(source.maps.roughness); standard.emissiveMap = textureAt(source.maps.emissive); standard.aoMap = textureAt(source.maps.ao);
    }
    return result;
  };
  const filters = { 9728: NearestFilter, 9729: LinearFilter, 9984: NearestMipmapNearestFilter, 9985: LinearMipmapNearestFilter, 9986: NearestMipmapLinearFilter, 9987: LinearMipmapLinearFilter } as const;
  const wraps = { 33071: ClampToEdgeWrapping, 33648: MirroredRepeatWrapping, 10497: RepeatWrapping } as const;
  const work = createModelGeneratorWork(function* (): ModelWorkGenerator<ParsedModel> {
    try {
      for (const geometry of descriptor.geometries) {
        for (const source of Object.values(geometry.attributes)) {
          yield 'records';
          for (const array of [source.array, source.colorConversion?.authoredRows]) if (array && !buffers.has(array.buffer)) { buffers.add(array.buffer); allocation += array.buffer.byteLength; }
        }
        for (const array of [geometry.index, geometry.indexAttribute?.array]) if (array) { yield 'records'; if (!buffers.has(array.buffer)) { buffers.add(array.buffer); allocation += array.buffer.byteLength; } }
      }
      if (allocation > admitted.counts.decodedBytes) throw new ModelAdmissionError('limit');
      for (const source of descriptor.textures) {
        yield 'records'; const image = images.get(source.resource); if (!image) throw new ModelAdmissionError('invalid'); const previous = textureSources.get(source.resource); const texture = previous ? previous.clone() : new Texture(image); textures.push(texture); if (!previous) textureSources.set(source.resource, texture);
        texture.name = source.name; texture.magFilter = filters[source.magFilter]; texture.minFilter = filters[source.minFilter]; texture.wrapS = wraps[source.wrapS]; texture.wrapT = wraps[source.wrapT]; texture.channel = source.texCoord; texture.colorSpace = source.colorSpace === 'srgb' ? SRGBColorSpace : NoColorSpace; texture.flipY = source.flipY; texture.generateMipmaps = source.generateMipmaps; texture.needsUpdate = true;
      }
      for (const source of descriptor.materials) { yield 'records'; materials.push(material(source)); }
      const point = new Vector3();
      for (const source of descriptor.geometries) {
        yield 'records'; const geometry = new BufferGeometry(); geometries.push(geometry);
        for (const [name, value] of Object.entries(source.attributes)) geometry.setAttribute(name, yield* attribute(value));
        if (source.index) geometry.setIndex(new BufferAttribute(source.index, 1));
        else if (source.indexAttribute) geometry.setIndex((yield* attribute(source.indexAttribute)) as BufferAttribute);
        for (const group of source.groups) { yield 'records'; geometry.addGroup(group.start, group.count, group.materialIndex); }
        geometry.setDrawRange(source.drawRange.start, source.drawRange.count ?? Infinity);
        if (source.groupNames) geometry.userData['groupNames'] = [...source.groupNames];
        if (source.hasColors !== undefined) (geometry as BufferGeometry & { hasColors: boolean }).hasColors = source.hasColors;
        if (source.alpha !== undefined) (geometry as BufferGeometry & { alpha: number }).alpha = source.alpha;
        const position = geometry.getAttribute('position'); const bounds = new Box3();
        for (let row = 0; row < position.count; row++) { yield 'records'; point.fromBufferAttribute(position, row); bounds.expandByPoint(point); }
        geometry.boundingBox = bounds; const center = bounds.getCenter(new Vector3()); let radiusSquared = 0;
        for (let row = 0; row < position.count; row++) { yield 'records'; point.fromBufferAttribute(position, row); radiusSquared = Math.max(radiusSquared, center.distanceToSquared(point)); }
        geometry.boundingSphere = new Sphere(center, Math.sqrt(radiusSquared));
      }
      for (const source of descriptor.nodes) {
        yield 'records'; const geometry = source.geometry === null ? undefined : geometries[source.geometry]!;
        const assigned: Material[] = []; for (const index of source.materials) { yield 'records'; assigned.push(materials[index]!); } const paint = assigned.length === 1 ? assigned[0]! : assigned;
        const node = source.kind === 'object' ? new Object3D() : source.kind === 'group' ? new Group() : source.kind === 'points' ? new Points(geometry, paint) : source.kind === 'line' ? new Line(geometry, paint) : source.kind === 'line-segments' ? new LineSegments(geometry, paint) : source.kind === 'line-loop' ? new LineLoop(geometry, paint) : new Mesh(geometry, paint);
        node.name = source.name; node.matrix.fromArray(source.matrix); node.matrix.decompose(node.position, node.quaternion, node.scale); node.matrixAutoUpdate = false; nodes.push(node);
      }
      for (let index = 0; index < descriptor.nodes.length; index++) for (const child of descriptor.nodes[index]!.children) { yield 'records'; nodes[index]!.add(nodes[child]!); }
      const pending: Object3D[] = []; for (const index of descriptor.roots) { yield 'records'; pending.push(nodes[index]!); }
      while (pending.length) { yield 'records'; const node = pending.pop()!; node.matrixWorld.copy(node.parent ? node.parent.matrixWorld.clone().multiply(node.matrix) : node.matrix); for (const child of node.children) { yield 'records'; pending.push(child); } }
      const bounds = new Box3(); let vertices = 0; let indices = 0; const selected = nodes[descriptor.selectedRoot]!; const selectedNodes = [selected];
      while (selectedNodes.length) {
        yield 'records'; const node = selectedNodes.pop()!; for (const child of node.children) { yield 'records'; selectedNodes.push(child); }
        if (!('geometry' in node)) continue;
        const geometry = (node as Mesh).geometry; const position = geometry.getAttribute('position'); vertices += position.count; indices += geometry.index?.count ?? 0;
        for (let row = 0; row < position.count; row++) { yield 'records'; point.fromBufferAttribute(position, row).applyMatrix4(node.matrixWorld); bounds.expandByPoint(point); }
      }
      published = true; return { object: selected, bounds: bounds.isEmpty() ? null : bounds, vertices, indices, dispose };
    } finally { if (!published) dispose(); }
  });
  return { step: work.step, dispose() { work.dispose(); if (!published) dispose(); } };
}
