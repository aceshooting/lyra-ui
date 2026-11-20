import { isPlainDataRecord, readOwnArrayLength, requireOwnDataValue } from '../../../internal/data-descriptors.js';
import { boundedLegendText } from '../../../internal/choropleth-no-data.js';
import { isRuntimeArray } from '../../../internal/object-guards.js';

type ChoroplethPoint = readonly [number, number];
export type ChoroplethPolygon = readonly (readonly ChoroplethPoint[])[];
export interface ChoroplethRegion {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly polygons: readonly ChoroplethPolygon[];
}
export interface ChoroplethGeometry {
  readonly status: 'ready' | 'empty' | 'invalid' | 'limit';
  readonly regions: readonly ChoroplethRegion[];
}

const MAX_FEATURES = 1000;
const MAX_POSITIONS = 50000;
const MAX_ARCS = 10000;
const MAX_NODES = 100000;
const MAX_DEPTH = 32;
const MAX_TEXT = 1024;
/** Valid GeoJSON and TopoJSON geometry without area; a feature of this type is skipped. */
const UNFILLED = new Set<unknown>([null, 'Point', 'MultiPoint', 'LineString', 'MultiLineString']);
const INVALID = Symbol('invalid geometry');
const LIMIT = Symbol('geometry limit');

function within(value: number, maximum: number): void {
  if (value > maximum) throw LIMIT;
}
function record(value: unknown): object {
  if (!isPlainDataRecord(value)) throw INVALID;
  return value;
}
function read(value: object, key: string | number): unknown {
  return requireOwnDataValue(value, key, 'Expected own data');
}
function length(value: unknown, maximum: number): number {
  if (!isRuntimeArray(value)) throw INVALID;
  const size = readOwnArrayLength(value);
  if (size === undefined) throw INVALID;
  within(size, maximum);
  return size;
}
function pair(value: unknown, exact = false): ChoroplethPoint {
  const size = length(value, 16);
  if (size < 2 || (exact && size !== 2)) throw INVALID;
  const ordinates: number[] = [];
  for (let index = 0; index < size; index++) {
    const n = read(value as object, index);
    if (typeof n !== 'number' || !Number.isFinite(n)) throw INVALID;
    if (index < 2) ordinates.push(n);
  }
  return [ordinates[0]!, ordinates[1]!];
}
function geographic(x: number, y: number): ChoroplethPoint {
  if (!(x >= -180 && x <= 180 && y >= -90 && y <= 90)) throw INVALID;
  return [x, y];
}
function equal(a: ChoroplethPoint, b: ChoroplethPoint): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
function closed(points: ChoroplethPoint[]): readonly ChoroplethPoint[] {
  if (points.length < 4 || !equal(points[0]!, points[points.length - 1]!)) throw INVALID;
  return points;
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? boundedLegendText(value, MAX_TEXT) : undefined;
}
type Pending = Omit<ChoroplethRegion, 'id' | 'label'> & { id?: string; label?: string };

/**
 * Projects caller-owned polygon data into bounded, detached region snapshots. Features without
 * area (null, point or line geometry) and features whose ID exceeds the text limit are skipped
 * but still count toward the feature limit. A non-empty `object` selects one TopoJSON object.
 */
export function decodeChoroplethGeometry(
  input: unknown, field = 'value', labelField = 'name', object = '',
): ChoroplethGeometry {
  if (input == null) return { status: 'empty', regions: [] };
  try {
    if (typeof field !== 'string' || typeof labelField !== 'string' || typeof object !== 'string') throw INVALID;
    within(Math.max(field.length, labelField.length), MAX_TEXT);
    let nodes = 0, positions = 0, expanded = 0, references = 0, features = 0;
    const pending: Pending[] = [];
    const ids = new Set<string>();
    const decoded: ChoroplethPoint[][] = [];
    function each(source: unknown, maximum: number, visitEntry: (entry: unknown) => void): void {
      const size = length(source, maximum);
      within(nodes += size, MAX_NODES);
      for (let index = 0; index < size; index++) visitEntry(read(source as object, index));
    }
    function list<T>(source: unknown, maximum: number, project: (entry: unknown) => T): T[] {
      const result: T[] = [];
      each(source, maximum, entry => result.push(project(entry)));
      return result;
    }
    function loadArcs(source: object): void {
      const transform = read(source, 'transform');
      const t = transform === undefined ? undefined : record(transform);
      const scale = t ? pair(read(t, 'scale'), true) : undefined;
      const translate = t ? pair(read(t, 'translate'), true) : undefined;
      each(read(source, 'arcs'), MAX_ARCS, arc => {
        let x = 0, y = 0;
        const points = list(arc, MAX_POSITIONS - positions, entry => {
          positions++;
          const [a, b] = pair(entry);
          if (!scale || !translate) return geographic(a, b);
          if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) throw INVALID;
          x += a; y += b;
          if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw INVALID;
          return geographic(x * scale[0] + translate[0], y * scale[1] + translate[1]);
        });
        if (points.length < 2) throw INVALID;
        decoded.push(points);
      });
    }
    function ring(source: unknown, topology: boolean): readonly ChoroplethPoint[] {
      if (!topology) return closed(list(source, MAX_POSITIONS - positions, entry => {
        positions++;
        within(++expanded, MAX_POSITIONS);
        const [x, y] = pair(entry);
        return geographic(x, y);
      }));
      const points: ChoroplethPoint[] = [];
      each(source, MAX_ARCS - references, ref => {
        references++;
        if (typeof ref !== 'number' || !Number.isSafeInteger(ref)) throw INVALID;
        const reverse = ref < 0;
        const index = reverse ? -ref - 1 : ref;
        if (index >= decoded.length) throw INVALID;
        const arc = decoded[index]!;
        const start = points.length ? 1 : 0;
        if (start && !equal(points[points.length - 1]!, arc[reverse ? arc.length - 1 : 0]!)) throw INVALID;
        within(expanded += arc.length - start, MAX_POSITIONS);
        for (let i = start; i < arc.length; i++) points.push(arc[reverse ? arc.length - 1 - i : i]!);
      });
      return closed(points);
    }
    function append(source: object, topology: boolean, depth: number, polygons: ChoroplethPolygon[]): void {
      within(depth, MAX_DEPTH);
      const type = read(source, 'type');
      if (type === 'GeometryCollection') {
        each(read(source, 'geometries'), MAX_FEATURES, g => append(record(g), topology, depth + 1, polygons));
        return;
      }
      if (UNFILLED.has(type)) return;
      if (type !== 'Polygon' && type !== 'MultiPolygon') throw INVALID;
      const data = read(source, topology ? 'arcs' : 'coordinates');
      function polygon(value: unknown): void {
        const rings = list(value, MAX_POSITIONS, r => ring(r, topology));
        if (!rings.length) throw INVALID;
        polygons.push(rings);
      }
      if (type === 'Polygon') polygon(data);
      else each(data, MAX_POSITIONS, polygon);
    }
    function region(owner: object, geometry: unknown, topology: boolean, depth: number): void {
      within(++features, MAX_FEATURES);
      if (geometry === null) return;
      const rawId = read(owner, 'id');
      if (typeof rawId === 'string' && rawId.length > MAX_TEXT) return;
      const polygons: ChoroplethPolygon[] = [];
      append(record(geometry), topology, depth, polygons);
      if (!polygons.length) return;
      const props = read(owner, 'properties');
      const properties = props == null ? undefined : record(props);
      const id = typeof rawId === 'number' && Number.isFinite(rawId) ? String(rawId) : text(rawId);
      const label = properties ? text(read(properties, labelField)) : undefined;
      const value = properties ? read(properties, field) : undefined;
      if (id !== undefined) ids.add(id);
      pending.push({ id, label, value: typeof value === 'number' && Number.isFinite(value) ? value : null, polygons });
    }
    function visit(value: unknown, topology: boolean, depth: number): void {
      within(depth, MAX_DEPTH);
      const object = record(value);
      const type = read(object, 'type');
      if (type === 'GeometryCollection') {
        each(read(object, 'geometries'), MAX_FEATURES, g => visit(g, topology, depth + 1));
      } else if (!topology && type === 'Feature') {
        region(object, read(object, 'geometry'), false, depth);
      } else {
        region(object, object, topology, depth);
      }
    }
    const root = record(input);
    const type = read(root, 'type');
    if (type === 'Topology') {
      loadArcs(root);
      const objects = record(read(root, 'objects'));
      if (object) {
        if (Object.hasOwn(objects, object)) visit(read(objects, object), true, 0);
      } else {
        let count = 0;
        for (const key in objects) {
          if (!Object.hasOwn(objects, key)) continue;
          within(++count, MAX_FEATURES);
          within(key.length, MAX_TEXT);
          visit(read(objects, key), true, 0);
        }
      }
    } else if (type === 'FeatureCollection') {
      each(read(root, 'features'), MAX_FEATURES, feature => {
        const f = record(feature);
        if (read(f, 'type') !== 'Feature') throw INVALID;
        region(f, read(f, 'geometry'), false, 0);
      });
    } else visit(root, false, 0);
    const seen = new Set<string>();
    let sequence = 0;
    const regions = pending.map(({ id, label, ...rest }) => {
      if (id === undefined || seen.has(id)) {
        do { id = 'region-' + String(++sequence); } while (ids.has(id));
      }
      seen.add(id);
      return { id, label: label ?? id, ...rest };
    });
    return { status: regions.length ? 'ready' : 'empty', regions };
  } catch (error) {
    return { status: error === LIMIT ? 'limit' : 'invalid', regions: [] };
  }
}
