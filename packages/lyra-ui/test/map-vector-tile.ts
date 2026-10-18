/** A lazy spatial catalog: one distinct record per zoom-10 tile in a 1000-by-1000 grid. */
export const VECTOR_CATALOG_COUNT = 1_000_000;
const SIDE = 1000;
const INSET = 12;
const ZOOM = 10;

export function catalogPoint(index: number): { index: number; coordinates: [number, number]; tile: [number, number] } {
  if (!Number.isInteger(index) || index < 0 || index >= VECTOR_CATALOG_COUNT) throw new RangeError('Invalid catalog index');
  const x = INSET + index % SIDE;
  const y = INSET + Math.floor(index / SIDE);
  const longitude = (x + 0.5) / 2 ** ZOOM * 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / 2 ** ZOOM))) * 180 / Math.PI;
  return { index, coordinates: [longitude, latitude], tile: [x, y] };
}

function varint(value: number): number[] {
  const bytes: number[] = [];
  do { const next = value % 128; value = Math.floor(value / 128); bytes.push(next + (value ? 128 : 0)); } while (value);
  return bytes;
}
function uint(field: number, value: number): number[] { return [...varint(field * 8), ...varint(value)]; }
function bytes(field: number, value: readonly number[]): number[] { return [...varint(field * 8 + 2), ...varint(value.length), ...value]; }
function string(field: number, value: string): number[] { return bytes(field, [...new TextEncoder().encode(value)]); }

/** Encodes a genuine MVT layer/point geometry and properties, not a renderer stub. */
export function catalogVectorTile(z: number, x: number, y: number): { data: ArrayBuffer; featureCount: number } {
  if (![z, x, y].every(Number.isInteger) || z !== ZOOM) throw new RangeError('Unexpected tile coordinates');
  const column = x - INSET, row = y - INSET;
  if (column < 0 || column >= SIDE || row < 0 || row >= SIDE) return { data: new ArrayBuffer(0), featureCount: 0 };
  const index = row * SIDE + column;
  const feature = [
    ...uint(1, index), ...bytes(2, [0, 0, 1, 1]), ...uint(3, 1),
    ...bytes(4, [...varint(9), ...varint(4096), ...varint(4096)]),
  ];
  const layer = [
    ...uint(15, 2), ...string(1, 'catalog'), ...bytes(2, feature),
    ...string(3, 'catalogIndex'), ...string(3, 'name'),
    ...bytes(4, uint(5, index)), ...bytes(4, string(1, `Record ${index}`)), ...uint(5, 4096),
  ];
  return { data: new Uint8Array(bytes(3, layer)).buffer, featureCount: 1 };
}
