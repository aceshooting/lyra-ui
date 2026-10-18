import type { LyraSourceRevision } from '../../../data-sources.js';
import type { LyraSourceValue, LyraSourceRequest, LyraNumericDomain } from '../../../utilities/data-preparation.js';
import { sourceCount } from '../../../internal/source-request-controller.js';

export interface LyraHeatmapMatrixViewport {
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
}
export type LyraHeatmapMatrixReducer = 'mean' | 'min' | 'max';
export interface LyraHeatmapTile extends LyraHeatmapMatrixViewport {
  readonly count: number;
  readonly validCount: number;
  readonly min: number | null;
  readonly max: number | null;
  readonly sum: number;
}
export interface LyraHeatmapMatrixRangeSelectDetail extends LyraHeatmapTile {
  readonly revision: LyraSourceRevision;
}
export interface HeatmapSourceCell {
  readonly value: number | null;
  readonly rowLabel: string;
  readonly columnLabel: string;
}
/** Immutable indexed matrix. Query implementations own aggregation and storage. */
export interface LyraHeatmapMatrixSource {
  readonly revision: LyraSourceRevision;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly domain: LyraNumericDomain | null;
  query(request: LyraSourceRequest & LyraHeatmapMatrixViewport & { readonly maxCells: number }): LyraSourceValue<readonly LyraHeatmapTile[]>;
  getCell(row: number, column: number, request: LyraSourceRequest): LyraSourceValue<HeatmapSourceCell>;
}
function field(value: unknown, key: string): unknown {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) throw new TypeError('Invalid matrix record');
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Invalid matrix field');
  return descriptor.value;
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Invalid matrix number');
  return value;
}
export function matrixRectangle(value: unknown): LyraHeatmapMatrixViewport {
  const rowStart = sourceCount(field(value, 'rowStart')), rowEnd = sourceCount(field(value, 'rowEnd'));
  const columnStart = sourceCount(field(value, 'columnStart')), columnEnd = sourceCount(field(value, 'columnEnd'));
  if (rowStart >= rowEnd || columnStart >= columnEnd || !Number.isSafeInteger((rowEnd - rowStart) * (columnEnd - columnStart))) throw new RangeError('Invalid matrix rectangle');
  return Object.freeze({ rowStart, rowEnd, columnStart, columnEnd });
}
export function matrixDomain(value: unknown): LyraNumericDomain | null {
  if (value === null) return null;
  const min = finite(field(value, 'min')), max = finite(field(value, 'max'));
  if (min > max) throw new RangeError('Invalid matrix domain');
  return Object.freeze({ min, max });
}
export function matrixExactCell(value: unknown, domain: LyraNumericDomain | null): HeatmapSourceCell {
  const raw = field(value, 'value');
  const number = raw === null ? null : finite(raw);
  const rowLabel = field(value, 'rowLabel'), columnLabel = field(value, 'columnLabel');
  if (typeof rowLabel !== 'string' || typeof columnLabel !== 'string' || rowLabel.length > 1024 || columnLabel.length > 1024 ||
      (number !== null && (!domain || number < domain.min || number > domain.max))) throw new RangeError('Invalid matrix cell');
  return Object.freeze({ value: number, rowLabel, columnLabel });
}
export function matrixContains(outer: LyraHeatmapMatrixViewport, inner: LyraHeatmapMatrixViewport): boolean {
  return inner.rowStart >= outer.rowStart && inner.rowEnd <= outer.rowEnd && inner.columnStart >= outer.columnStart && inner.columnEnd <= outer.columnEnd;
}
/** Validates a complete rectangular partition in O(T log T) work and O(T) storage. */
export function matrixTiles(reply: unknown, rectangle: LyraHeatmapMatrixViewport, budget: number, domain: LyraNumericDomain | null): readonly LyraHeatmapTile[] {
  if (!Array.isArray(reply)) throw new TypeError('Invalid matrix tiles');
  const length = sourceCount(field(reply, 'length'));
  if (!length || length > budget) throw new RangeError('Invalid matrix tile budget');
  const tiles: LyraHeatmapTile[] = [];
  const boundaries = new Set<number>([rectangle.columnStart, rectangle.columnEnd]);
  const events: { row: number; start: number; end: number; delta: number }[] = [];
  for (let index = 0; index < length; index++) {
    const input = field(reply, String(index));
    const bounds = matrixRectangle(input);
    const count = sourceCount(field(input, 'count')), validCount = sourceCount(field(input, 'validCount'));
    const sum = finite(field(input, 'sum')), rawMin = field(input, 'min'), rawMax = field(input, 'max');
    const min = rawMin === null ? null : finite(rawMin), max = rawMax === null ? null : finite(rawMax);
    if (!matrixContains(rectangle, bounds) || count !== (bounds.rowEnd - bounds.rowStart) * (bounds.columnEnd - bounds.columnStart) || validCount > count) throw new RangeError('Invalid matrix tile counts');
    if (validCount === 0) {
      if (min !== null || max !== null || sum !== 0) throw new RangeError('Invalid empty matrix tile');
    } else {
      if (!domain || min === null || max === null || min > max || min < domain.min || max > domain.max) throw new RangeError('Invalid matrix tile extrema');
      const mean = sum / validCount;
      // Compare normalized values so tolerance arithmetic cannot overflow near MAX_VALUE.
      const scale = Math.max(1, Math.abs(min), Math.abs(max), Math.abs(mean));
      if (!Number.isFinite(mean) || mean / scale < min / scale - 32 * Number.EPSILON || mean / scale > max / scale + 32 * Number.EPSILON) throw new RangeError('Invalid matrix tile mean');
    }
    tiles.push(Object.freeze({ ...bounds, count, validCount, min, max, sum }));
    boundaries.add(bounds.columnStart); boundaries.add(bounds.columnEnd);
    events.push({ row: bounds.rowStart, start: bounds.columnStart, end: bounds.columnEnd, delta: 1 }, { row: bounds.rowEnd, start: bounds.columnStart, end: bounds.columnEnd, delta: -1 });
  }
  const columns = [...boundaries].sort((a, b) => a - b);
  const indices = new Map(columns.map((column, index) => [column, index]));
  const size = columns.length - 1;
  const low = new Int32Array(size * 4), high = new Int32Array(size * 4), lazy = new Int32Array(size * 4);
  function update(node: number, left: number, right: number, start: number, end: number, delta: number): void {
    if (start <= left && right <= end) { low[node] = low[node]! + delta; high[node] = high[node]! + delta; lazy[node] = lazy[node]! + delta; return; }
    const middle = Math.floor((left + right) / 2);
    if (start < middle) update(node * 2, left, middle, start, end, delta);
    if (end > middle) update(node * 2 + 1, middle, right, start, end, delta);
    low[node] = lazy[node]! + Math.min(low[node * 2]!, low[node * 2 + 1]!);
    high[node] = lazy[node]! + Math.max(high[node * 2]!, high[node * 2 + 1]!);
  }
  events.sort((a, b) => a.row - b.row);
  let previous = rectangle.rowStart, cursor = 0;
  while (cursor < events.length) {
    const row = events[cursor]!.row;
    if (row > previous && (low[1] !== 1 || high[1] !== 1)) throw new RangeError('Incomplete matrix partition');
    while (cursor < events.length && events[cursor]!.row === row) {
      const event = events[cursor++]!;
      update(1, 0, size, indices.get(event.start)!, indices.get(event.end)!, event.delta);
    }
    previous = row;
  }
  if (previous !== rectangle.rowEnd || low[1] !== 0 || high[1] !== 0) throw new RangeError('Incomplete matrix partition');
  return Object.freeze(tiles);
}
