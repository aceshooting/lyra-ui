import { finiteMidpoint, finiteNumber, finiteRatio, minMax } from '../../../internal/numbers.js';
import type { ChoroplethPolygon, ChoroplethRegion } from './choropleth-geometry.js';

export type LyraChoroplethProjection = 'equirectangular' | 'mercator';
export type LyraChoroplethPalette = 'sequential' | 'diverging';

export interface ChoroplethMark {
  id: string;
  label: string;
  value: number | null;
  path: string;
  labelX: number | null;
  labelY: number | null;
  position: number | null;
}

export interface ChoroplethLayoutResult {
  regions: ChoroplethMark[];
  domain: readonly [number, number] | null;
  stops: { offset: number; value: number }[];
}

type Point = [number, number];

interface Polygon {
  rings: Point[][];
  center: number;
  area: number;
}

const MERCATOR_LIMIT = 85.05112878;
const DEGREES = 180 / Math.PI;

function project(polygon: ChoroplethPolygon, mercator: boolean): Polygon | undefined {
  const rings: Point[][] = [];
  let center = 0;
  let area = 0;
  for (const ring of polygon) {
    if (ring.length < 3) return;
    const projected: Point[] = [];
    let previous = 0;
    let shift = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const [lon, lat] of ring) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return;
      const jump = lon - previous;
      // A full turn explicitly traces the world boundary. Other dateline crossings use the short edge.
      if (projected.length && Math.abs(jump) > 180 && Math.abs(jump) < 360) shift -= Math.sign(jump) * 360;
      const x = lon + shift;
      const y = mercator
        ? -DEGREES * Math.asinh(Math.tan(Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat)) / DEGREES))
        : -lat;
      projected.push([x, y]);
      min = Math.min(min, x);
      max = Math.max(max, x);
      previous = lon;
    }
    const middle = (min + max) / 2;
    if (!rings.length) center = middle;
    const align = 360 * Math.round((center - middle) / 360);
    // Relative coordinates preserve area for small shapes far from the origin.
    const [ox, oy] = projected[0]!;
    let twiceArea = 0;
    for (let i = 0; i < projected.length; i++) {
      const a = projected[i]!;
      const b = projected[(i + 1) % projected.length]!;
      twiceArea += (a[0] - ox) * (b[1] - oy) - (a[1] - oy) * (b[0] - ox);
    }
    if (align) for (const p of projected) p[0] += align;
    area += (rings.length ? -1 : 1) * Math.abs(twiceArea);
    rings.push(projected);
  }
  return rings.length && area > 0 ? { rings, center, area } : undefined;
}

/** Place the map seam in the largest unoccupied gap between polygon centers. */
function alignPolygons(polygons: Polygon[]): void {
  const normalized = (lon: number) => ((lon % 360) + 360) % 360;
  const centers = polygons.map(p => normalized(p.center)).sort((a, b) => a - b);
  let cut = centers[0]!;
  let largest = cut + 360 - centers.at(-1)!;
  for (let i = 1; i < centers.length; i++) {
    const gap = centers[i]! - centers[i - 1]!;
    if (gap > largest) {
      cut = centers[i]!;
      largest = gap;
    }
  }
  for (const p of polygons) {
    const center = normalized(p.center);
    const shift = 360 * Math.round((center + (center < cut ? 360 : 0) - p.center) / 360);
    if (shift) for (const ring of p.rings) for (const point of ring) point[0] += shift;
  }
}

/** Find a filled horizontal interval using the same even-odd rule as the rendered path. */
function interior(polygon: Polygon): Point | undefined {
  let low = Infinity;
  let high = -Infinity;
  for (const p of polygon.rings[0]!) {
    low = Math.min(low, p[1]);
    high = Math.max(high, p[1]);
  }
  const levels = [...new Set(polygon.rings.flatMap(ring => ring.map(p => p[1])))].sort((a, b) => a - b);
  let best = 0;
  let point: Point | undefined;
  for (const fraction of [0.5, 0.375, 0.625, 0.25, 0.75, 0.125, 0.875, 0.0625, 0.9375]) {
    let y = low + fraction * (high - low);
    // At a vertex an even-odd interval can coincide with a horizontal boundary.
    const level = levels.indexOf(y);
    if (level >= 0) {
      const above = levels[level + 1];
      if (above === undefined) continue;
      y += (above - y) / 2;
      if (!(y > levels[level]! && y < above)) continue;
    }
    const cuts: number[] = [];
    for (const ring of polygon.rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        if ((a[1] > y) === (b[1] > y)) continue;
        cuts.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i += 2) {
      const left = cuts[i - 1]!;
      const width = cuts[i]! - left;
      const x = left + width / 2;
      if (width > best && x > left && x < cuts[i]!) {
        best = width;
        point = [x, y];
      }
    }
  }
  return point;
}

/** Fit decoded geographic polygons into SVG coordinates with one scale for both projected axes. */
export function layoutChoropleth(
  regions: readonly ChoroplethRegion[], width = 1, height = 1,
  projection: LyraChoroplethProjection = 'equirectangular',
  palette: LyraChoroplethPalette = 'sequential',
): ChoroplethLayoutResult {
  const result: ChoroplethLayoutResult = { regions: [], domain: null, stops: [] };
  if (finiteNumber(width, 0) <= 0 || finiteNumber(height, 0) <= 0) return result;
  const entries = regions.map(region => ({
    region, polygons: region.polygons.map(p => project(p, projection === 'mercator')).filter((p): p is Polygon => !!p),
  })).filter(entry => entry.polygons.length);
  if (!entries.length) return result;
  const polygons = entries.flatMap(entry => entry.polygons);
  alignPolygons(polygons);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygons) for (const ring of p.rings) for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const dx = maxX - minX;
  const dy = maxY - minY;
  if (!(dx > 0 && dy > 0)) return result;
  const ratio = dx / dy;
  const w = Math.min(width, height * ratio);
  const h = Math.min(height, width / ratio);
  const px = (x: number) => (width - w) / 2 + (x - minX) / dx * w;
  const py = (y: number) => (height - h) / 2 + (y - minY) / dy * h;
  const values = entries.map(e => e.region.value).filter((v): v is number => v !== null && Number.isFinite(v));
  const extentValues = minMax(values);
  if (extentValues) {
    const [low, high] = extentValues;
    const extent = Math.max(Math.abs(low), Math.abs(high));
    const [min, max]: [number, number] = palette === 'diverging' ? [extent ? -extent : 0, extent] : [low, high];
    result.domain = [min, max];
    result.stops = min === max ? [{ offset: 0.5, value: min }] : [
      { offset: 0, value: min },
      { offset: 0.5, value: finiteMidpoint(min, max) },
      { offset: 1, value: max },
    ];
  }
  for (const { region, polygons: parts } of entries) {
    const path = parts.flatMap(p => p.rings.map(ring =>
      ring.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x)},${py(y)}`).join('') + 'Z'
    )).join('');
    const biggest = parts.reduce((a, b) => a.area >= b.area ? a : b);
    const label = interior(biggest);
    const value = region.value !== null && Number.isFinite(region.value) ? region.value : null;
    const position = value !== null && result.domain ? finiteRatio(value, result.domain[0], result.domain[1], 0.5) : null;
    result.regions.push({ id: region.id, label: region.label, value, position, path,
      labelX: label ? px(label[0]) : null, labelY: label ? py(label[1]) : null });
  }
  return result;
}
