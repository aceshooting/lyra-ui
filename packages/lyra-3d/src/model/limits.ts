/** Fixed input ceilings, enforced before a format loader or image decoder runs. */
export const MODEL_LIMITS = Object.freeze({
  encodedBytes: 64 * 1024 * 1024,
  decodedBytes: 256 * 1024 * 1024,
  vertices: 1_000_000,
  indices: 6_000_000,
  resources: 256,
  textureAxis: 4096,
  imagePixels: 16_777_216,
  totalImagePixels: 67_108_864,
  entries: 4096,
  jsonDepth: 32,
  jsonTokens: 200_000,
  headerBytes: 64 * 1024,
  lineBytes: 16 * 1024,
  polygonVertices: 256,
  coordinate: 1e20,
});
