export const MAP_IMAGE_MAX_DIMENSION = 2048;
export const MAP_IMAGE_MAX_PIXELS = 4_194_304;
export const MAP_IMAGE_MAX_ENCODED_BYTES = 1_048_576;
/** Limits apply to backing pixels; pixelRatio changes logical size without multiplying allocation.
 * The count admits sprite catalogs; the aggregate pixel and byte budgets bound the atlas itself. */
export const MAP_IMAGE_LIMITS = Object.freeze({ count: 1024, idLength: 128, svgBytes: 262_144,
  encodedBytes: MAP_IMAGE_MAX_ENCODED_BYTES, totalBytes: 8_388_608, dimension: MAP_IMAGE_MAX_DIMENSION, pixels: MAP_IMAGE_MAX_PIXELS,
  totalPixels: 16_777_216, elements: 2048, decodeTimeoutMs: 15_000 });
