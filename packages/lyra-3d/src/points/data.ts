import { LYRA_3D_WORLD_LIMIT } from '../core/orbit.js';
import type { PointsAxis, PointsEngineData } from './types.js';

const POINTS_MAX_ROWS = 1_000_000;
const POINTS_MAX_SEGMENTS = 1_000_000;
const POINTS_MAX_LABEL_TEXT = 4 * 1024 * 1024;
export interface AdmittedPointsData extends PointsEngineData {
  readonly mode: '2d' | '3d';
  readonly axes: readonly PointsAxis[];
}
const world = (value: number) => Number.isFinite(value) && Math.abs(value) <= LYRA_3D_WORLD_LIMIT;
const text = (value: string) => {
  if (typeof value !== 'string') throw new TypeError('Point and axis labels must be plain strings');
  return value.slice(0, 256);
};
/** Atomically validates and copies one immutable revision. No rows are decimated or reordered. */
export function admitPointsData(input: PointsEngineData): AdmittedPointsData {
  if (!(input.positions instanceof Float32Array) || !(input.positions.buffer instanceof ArrayBuffer) || input.positions.length % 3 !== 0 || input.positions.length > POINTS_MAX_ROWS * 3 || !input.positions.every(world)) throw new RangeError('Invalid point positions or world range');
  const count = input.positions.length / 3;
  if (input.sizes !== undefined && (!(input.sizes instanceof Float32Array) || !(input.sizes.buffer instanceof ArrayBuffer) || input.sizes.length !== count || !input.sizes.every((value) => Number.isFinite(value) && value >= 0 && value <= 1024))) throw new RangeError('Invalid point sizes');
  if (input.categories !== undefined && (!(input.categories instanceof Uint16Array) || !(input.categories.buffer instanceof ArrayBuffer) || input.categories.length !== count)) throw new RangeError('Invalid point categories');
  let colors: Float32Array | undefined;
  const sourceColors = input.colors;
  if (sourceColors !== undefined) {
    if (!(sourceColors instanceof Float32Array) || !(sourceColors.buffer instanceof ArrayBuffer) || sourceColors.length !== count * 3) throw new RangeError('Invalid point colors');
    colors = new Float32Array(sourceColors);
    if (!colors.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw new RangeError('Invalid point colors');
  }
  if (input.segments !== undefined && (!(input.segments instanceof Uint32Array) || !(input.segments.buffer instanceof ArrayBuffer) || input.segments.length % 2 !== 0 || input.segments.length > POINTS_MAX_SEGMENTS * 2 || !input.segments.every((value) => value < count))) throw new RangeError('Invalid point segment indices');
  const mode = input.mode ?? '3d';
  if (mode !== '2d' && mode !== '3d') throw new RangeError('Invalid points mode');
  let labels: string[] | undefined;
  if (input.labels !== undefined) {
    if (!Array.isArray(input.labels) || input.labels.length !== count) throw new RangeError('Invalid point label rows');
    let total = 0;
    labels = Array.from(input.labels, (value) => {
      const result = text(value); total += value.length;
      if (total > POINTS_MAX_LABEL_TEXT) throw new RangeError('Point label text exceeds its limit');
      return result;
    });
  }
  if (input.axes !== undefined && (!Array.isArray(input.axes) || input.axes.length > 3)) throw new RangeError('Invalid point axes');
  const seen = new Set<string>();
  const axes: PointsAxis[] = Array.from(input.axes ?? [], (axis) => {
    if (!axis || !['x', 'y', 'z'].includes(axis.axis) || seen.has(axis.axis) || !world(axis.min) || !world(axis.max) || axis.min > axis.max || !Array.isArray(axis.ticks) || axis.ticks.length > 128 || (axis.grid !== undefined && typeof axis.grid !== 'boolean')) throw new RangeError('Invalid point axis');
    seen.add(axis.axis);
    const ticks = Array.from(axis.ticks, (tick) => {
      if (!tick || typeof tick !== 'object' || !('value' in tick) || typeof tick.value !== 'number' ||
        !('label' in tick) || typeof tick.label !== 'string' || !world(tick.value) ||
        tick.value < axis.min || tick.value > axis.max) throw new RangeError('Invalid point axis tick');
      return { value: tick.value, label: text(tick.label) };
    });
    return { axis: axis.axis, min: axis.min, max: axis.max, ticks, label: axis.label === undefined ? undefined : text(axis.label), grid: axis.grid ?? false };
  });
  const positions = input.positions.slice();
  if (mode === '2d') for (let row = 2; row < positions.length; row += 3) positions[row] = 0;
  return { positions, sizes: input.sizes?.slice(), categories: input.categories?.slice(), colors, segments: input.segments?.slice(), labels, axes, mode };
}
