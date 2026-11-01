/** Radius of the sphere used by the geographic renderer, in meters. */
export const EARTH_RADIUS_METERS = 6371008.8;

const latitudeLimit = 85.0511287798066;
const radians = Math.PI / 180;
const degrees = 180 / Math.PI;
const fail = () => { throw new TypeError('Invalid geographic geometry.'); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const canonicalLongitude = value => {
  if (value >= -180 && value < 180) return value === 0 ? 0 : value;
  const result = ((value % 360) + 540) % 360 - 180;
  return result === 0 ? 0 : result;
};

function field(record, key, optional = false) {
  if (record === null || typeof record !== 'object') fail();
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor) {
    if (optional) return undefined;
    fail();
  }
  if (!Object.hasOwn(descriptor, 'value')) fail();
  return descriptor.value;
}

function tuple(value, length) {
  if (!Array.isArray(value) || field(value, 'length') !== length) fail();
  const result = [];
  for (let index = 0; index < length; index++) {
    const entry = field(value, String(index));
    if (!finite(entry)) fail();
    result.push(entry);
  }
  return result;
}

function position(value) {
  const [longitude, latitude] = tuple(field(value, 'lngLat'), 2);
  const authoredAltitude = field(value, 'altitude', true);
  const altitude = authoredAltitude === undefined ? 0 : authoredAltitude;
  const reference = field(value, 'altitudeReference', true);
  if (!finite(altitude) || altitude < -12000 || altitude > 100000000 ||
      Math.abs(latitude) > latitudeLimit || (reference !== undefined && reference !== 'sea-level')) fail();
  return { lngLat: [canonicalLongitude(longitude), latitude], altitude };
}

function tileCoordinates(value) {
  const z = field(value, 'z'), x = field(value, 'x'), y = field(value, 'y'), wrap = field(value, 'wrap');
  if (![z, x, y, wrap].every(Number.isSafeInteger) || z < 0 || z > 30) fail();
  const size = 2 ** z;
  if (x < 0 || x >= size || y < 0 || y >= size || Math.abs(wrap) > 1000000) fail();
  return { size, x, y, wrap };
}

/** Encodes a sea-level position as native tile-local xy and meter z. */
export function geographicToTile(value, tile) {
  const { lngLat: [longitude, latitude], altitude } = position(value);
  const { size, x, y } = tileCoordinates(tile);
  // A canonical tile and its wrapped copy have the same local coordinates.
  const worldX = (longitude + 180) / 360;
  const worldY = latitude === 0 ? 0.5 : (1 - Math.asinh(Math.tan(latitude * radians)) / Math.PI) / 2;
  return [(worldX * size - x) * 8192, (worldY * size - y) * 8192, altitude];
}

/** Converts a rigid ENU offset through the renderer's sphere, without terrain sampling. */
export function geographicFromEnu(value, point) {
  const origin = position(value);
  const [east, north, up] = tuple(point, 3);
  if (Math.hypot(east, north) > 100000 || Math.abs(up) > 100000000) fail();
  if (east === 0 && north === 0 && up === 0) return origin;
  const [longitude, latitude] = origin.lngLat.map(angle => angle * radians);
  const sinLongitude = Math.sin(longitude), cosLongitude = Math.cos(longitude);
  const sinLatitude = Math.sin(latitude), cosLatitude = Math.cos(latitude);
  const radial = EARTH_RADIUS_METERS + origin.altitude + up;
  const x = radial * cosLatitude * cosLongitude - east * sinLongitude - north * sinLatitude * cosLongitude;
  const y = radial * cosLatitude * sinLongitude + east * cosLongitude - north * sinLatitude * sinLongitude;
  const z = radial * sinLatitude + north * cosLatitude;
  const radius = Math.hypot(x, y, z);
  if (!finite(radius) || radial <= 0) fail();
  return position({
    lngLat: [Math.atan2(y, x) * degrees, Math.atan2(z, Math.hypot(x, y)) * degrees],
    altitude: radius - EARTH_RADIUS_METERS
  });
}

/** Interpolates the shortest geographic segment; altitude remains linear meters. */
export function interpolateGeographic(startValue, endValue, t, options) {
  const start = position(startValue), end = position(endValue);
  const authoredMode = options === undefined ? undefined : field(options, 'mode', true);
  const mode = authoredMode === undefined ? 'great-circle' : authoredMode;
  if (!finite(t) || t < 0 || t > 1 || (mode !== 'linear' && mode !== 'great-circle')) fail();
  const altitude = start.altitude + (end.altitude - start.altitude) * t;
  const delta = canonicalLongitude(end.lngLat[0] - start.lngLat[0]);
  if (mode === 'linear') return position({
    lngLat: [start.lngLat[0] + delta * t, start.lngLat[1] + (end.lngLat[1] - start.lngLat[1]) * t], altitude
  });
  const unit = ([longitude, latitude]) => {
    const lng = longitude * radians, lat = latitude * radians;
    return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
  };
  const a = unit(start.lngLat), b = unit(end.lngLat);
  const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sine = Math.hypot(...cross);
  const cosine = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  if (cosine < 0 && sine < 1e-8) fail();
  if (t === 0) return start;
  if (t === 1) return end;
  if (sine < 1e-12 && cosine > 0) return position({ lngLat: start.lngLat, altitude });
  const angle = Math.atan2(sine, cosine);
  const wa = Math.sin((1 - t) * angle) / sine, wb = Math.sin(t * angle) / sine;
  const [x, y, z] = a.map((entry, index) => wa * entry + wb * b[index]);
  return position({ lngLat: [Math.atan2(y, x) * degrees, Math.atan2(z, Math.hypot(x, y)) * degrees], altitude });
}
