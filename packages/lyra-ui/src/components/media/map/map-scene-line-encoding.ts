/** Native tile-local units per tile edge. */
export const TILE_EXTENT = 8192;
/** Web Mercator latitude limit in degrees. */
export const MERCATOR_LATITUDE_LIMIT = 85.0511287798066;
const radians = Math.PI / 180;

export interface TileOrigin { readonly z: number; readonly x: number; readonly y: number }

/** The equivalent longitude in [-180, 180). */
export function canonicalLongitude(value: number): number {
  if (value >= -180 && value < 180) return value === 0 ? 0 : value;
  const result = ((value % 360) + 540) % 360 - 180;
  return result === 0 ? 0 : result;
}

/**
 * Tile-local `[x, y, meters]` relative to `tile`. Longitude is not wrapped, so an unwrapped line
 * that crosses the antimeridian stays continuous in the origin's world copy; latitude is clamped
 * to the Mercator limit.
 */
export function encodeTileVertex(longitude: number, latitude: number, altitude: number,
  tile: TileOrigin): readonly [number, number, number] {
  const size = 2 ** tile.z;
  const clamped = Math.max(-MERCATOR_LATITUDE_LIMIT, Math.min(MERCATOR_LATITUDE_LIMIT, latitude));
  const worldX = (longitude + 180) / 360;
  const worldY = clamped === 0 ? 0.5 : (1 - Math.asinh(Math.tan(clamped * radians)) / Math.PI) / 2;
  return [(worldX * size - tile.x) * TILE_EXTENT, (worldY * size - tile.y) * TILE_EXTENT, altitude];
}

/** Inverse of `encodeTileVertex()`, returning the unwrapped longitude. */
export function decodeTileVertex(x: number, y: number, altitude: number,
  tile: TileOrigin): readonly [number, number, number] {
  const size = 2 ** tile.z;
  const worldX = (x / TILE_EXTENT + tile.x) / size, worldY = (y / TILE_EXTENT + tile.y) / size;
  return [worldX * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY))) / radians, altitude];
}

/**
 * The longitude offset (a multiple of 360) that moves an unwrapped line so its first vertex is
 * canonical, keeping every later vertex in the same continuous frame.
 */
export function lineWorldShift(firstLongitude: number): number {
  return canonicalLongitude(firstLongitude) - firstLongitude;
}
