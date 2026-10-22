import { deflateSync } from 'node:zlib';

/** Small authored model inputs shared by the model tests. */
export const utf8 = (text) => new TextEncoder().encode(text);
export const bytesOf = (values) => new Uint8Array(new Float32Array(values).buffer);
export const dataUri = (bytes, mime = 'application/octet-stream') => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
export const TRIANGLE = [0, 0, 0, 1, 0, 0, 0, 1, 0];

export const triangleJson = () => ({
  asset: { version: '2.0' },
  buffers: [{ byteLength: 36, uri: dataUri(bytesOf(TRIANGLE)) }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
});

/** A GLB whose single BIN chunk holds the triangle followed by an embedded image. */
export function glbWithImage(image, mimeType, change = () => {}) {
  const bin = new Uint8Array(36 + Math.ceil(image.length / 4) * 4);
  bin.set(bytesOf(TRIANGLE)); bin.set(image, 36);
  const json = triangleJson(); delete json.buffers[0].uri; json.buffers[0].byteLength = bin.length;
  json.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: image.length }];
  json.images = [{ bufferView: 1, mimeType }];
  json.textures = [{ source: 0 }]; json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }];
  json.meshes[0].primitives[0].material = 0;
  change(json);
  const text = JSON.stringify(json);
  const jsonBytes = utf8(text.padEnd(Math.ceil(text.length / 4) * 4, ' '));
  const result = new Uint8Array(12 + 8 + jsonBytes.length + 8 + bin.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.length, true);
  view.setUint32(12, jsonBytes.length, true); view.setUint32(16, 0x4e4f534a, true); result.set(jsonBytes, 20);
  const offset = 20 + jsonBytes.length;
  view.setUint32(offset, bin.length, true); view.setUint32(offset + 4, 0x004e4942, true); result.set(bin, offset + 8);
  return result;
}

/** An authored PNG with independently computed chunk checksums. */
export function png(width = 1, height = 1) {
  const chunk = (type, data) => {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); result.write(type, 4, 4, 'ascii'); Buffer.from(data).copy(result, 8);
    let crc = 0xffffffff;
    for (const byte of result.subarray(4, -4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4); return result;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]));
}

/** A baseline grayscale 1x1 JPEG; `extra` segments are inserted after the JFIF header. */
export function jpeg(extra = []) {
  const segment = (marker, data) => { const length = data.length + 2; return [255, marker, length >> 8, length & 255, ...data]; };
  const huffman = [1, ...Array(15).fill(0), 0];
  return new Uint8Array([255, 216,
    ...segment(224, [74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...extra,
    ...segment(219, [0, ...Array(64).fill(1)]),
    ...segment(192, [8, 0, 1, 0, 1, 1, 1, 17, 0]),
    ...segment(196, [0, ...huffman, 16, ...huffman]),
    ...segment(218, [1, 1, 0, 0, 63, 0]), 63, 255, 217]);
}

/** The Adobe APP14 colour-transform segment some encoders add. */
export const adobeSegment = (identifier = 'Adobe') => [255, 238, 0, 14, ...[...identifier].map((letter) => letter.charCodeAt(0)), 0, 100, 0, 0, 0, 0, 0];
