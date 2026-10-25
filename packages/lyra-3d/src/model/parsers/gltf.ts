import { Group, type Object3D } from 'three';
import { GLTFLoader, type GLTFLoaderPlugin, type GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EmbeddedTextureLoader } from '../embedded-texture-loader.js';
import { ModelAdmissionError } from '../admission.js';
import { MODEL_LIMITS as LIMIT } from '../limits.js';
import { aborted, requireValid, type ModelParserContext } from '../model-parser-common.js';
import type { ModelEmbeddedResource, ModelParserInput } from '../types.js';

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
export async function parse(context: ModelParserContext): Promise<Object3D> {
  const { input, manager, images, textures, roots, signal } = context;
  const imageMap = new Map<string, ImageBitmap>(); const imageUris = new Map<number, string>();
  for (const resource of input.resources) if (resource.kind === 'image') {
    const uri = `data:${resource.mimeType};lyra-embedded,${resource.index}`;
    imageMap.set(uri, await decodeImage(resource, images, signal)); imageUris.set(resource.index, uri);
  }
  aborted(signal);
  const handler = new EmbeddedTextureLoader(manager, imageMap, textures, signal);
  context.retirement.push(() => handler.retire());
  manager.addHandler(/^data:image\/(?:png|jpeg);lyra-embedded,\d+$/, handler);
  const result = await new StaticGLTFLoader(manager).parseAsync(embeddedGlb(input, imageUris), '');
  roots.push(...result.scenes); const object = result.scene ?? new Group(); if (!roots.includes(object)) roots.push(object);
  aborted(signal); requireValid(!handler.failed);
  return object;
}
