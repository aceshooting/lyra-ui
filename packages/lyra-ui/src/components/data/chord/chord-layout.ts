import { isPlainDataRecord, readOwnArrayLength, readOwnDataValue } from '../../../internal/data-descriptors.js';
import { isRuntimeArray } from '../../../internal/object-guards.js';

/** A named row and corresponding column in a symmetric relationship matrix. */
export interface LyraChordEntity {
  readonly id: string;
  readonly label: string;
}

export interface ChordArc extends LyraChordEntity {
  index: number;
  value: number;
  startAngle: number;
  endAngle: number;
}

export interface ChordRibbon {
  source: string;
  target: string;
  sourceIndex: number;
  targetIndex: number;
  value: number;
  sourceStartAngle: number;
  sourceEndAngle: number;
  targetStartAngle: number;
  targetEndAngle: number;
}

export interface ChordLayoutResult {
  status: 'ready' | 'empty' | 'invalid' | 'limit';
  truncated: boolean;
  arcs: ChordArc[];
  ribbons: ChordRibbon[];
}

const MAX_ENTITIES = 32;
const FULL_TURN = 2 * Math.PI;
const ARC_GAP = 0.04;

interface AngularSpan {
  start: number;
  end: number;
}

interface Row {
  id: string;
  label: string;
  values: number[];
  total: number;
  ends: Map<number, AngularSpan>;
}

/** Read one bounded square matrix and validate symmetry before producing any marks. */
function readRows(entities: readonly LyraChordEntity[], matrix: readonly (readonly number[])[], count: number): Row[] | undefined {
  const rows: Row[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < count; i++) {
    const entity = readOwnDataValue(entities, i);
    const cells = readOwnDataValue(matrix, i);
    if (!isPlainDataRecord(entity) || !isRuntimeArray(cells) || readOwnArrayLength(cells) !== count) return;
    const id = readOwnDataValue(entity, 'id');
    const label = readOwnDataValue(entity, 'label');
    if (typeof id !== 'string' || !id || ids.has(id) || typeof label !== 'string') return;
    ids.add(id);
    let total = 0;
    const values: number[] = [];
    for (let j = 0; j < count; j++) {
      const weight = readOwnDataValue(cells, j);
      if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) return;
      if (j < i && weight !== rows[j]!.values[i]) return;
      values.push(weight);
      total = Math.min(Number.MAX_VALUE, total + weight);
    }
    rows.push({ id, label, values, total, ends: new Map() });
  }
  return rows;
}

/** Clockwise radians from twelve o'clock. The diagonal contributes once to its entity's weight. */
export function layoutChord(
  entities: readonly LyraChordEntity[],
  matrix: readonly (readonly number[])[],
): ChordLayoutResult {
  const result: ChordLayoutResult = { status: 'invalid', truncated: false, arcs: [], ribbons: [] };
  if (!isRuntimeArray(entities)) return result;
  const count = readOwnArrayLength(entities);
  if (count === undefined) return result;
  if (count > MAX_ENTITIES) {
    result.status = 'limit';
    result.truncated = true;
    return result;
  }
  if (!isRuntimeArray(matrix) || readOwnArrayLength(matrix) !== count) return result;
  const rows = readRows(entities, matrix, count);
  if (!rows) return result;
  const active = rows.filter(row => row.total > 0);
  if (!active.length) {
    result.status = 'empty';
    return result;
  }

  // Normalize before summation so even a matrix of maximum finite weights has finite angles.
  const largest = Math.max(...active.map(row => Math.max(...row.values)));
  const mass = active.reduce((sum, row) => sum + row.values.reduce((n, v) => n + v / largest, 0), 0);
  const radians = (FULL_TURN - active.length * ARC_GAP) / mass;
  let cursor = ARC_GAP / 2;
  for (const [index, row] of rows.entries()) {
    if (!row.total) continue;
    const startAngle = cursor;
    for (const [target, value] of row.values.entries()) {
      if (!value) continue;
      const end = cursor + value / largest * radians;
      if (end > cursor) row.ends.set(target, { start: cursor, end });
      else result.truncated = true;
      cursor = end;
    }
    if (cursor > startAngle) {
      result.arcs.push({ id: row.id, label: row.label, index, value: row.total, startAngle, endAngle: cursor });
    }
    cursor += ARC_GAP;
  }
  for (const [i, row] of rows.entries()) {
    for (let j = i; j < count; j++) {
      const from = row.ends.get(j);
      const to = rows[j]!.ends.get(i);
      if (!from || !to) continue;
      // A self-ribbon connects adjacent halves of its single reserved interval.
      const middle = from.start + (from.end - from.start) / 2;
      const sourceEndAngle = i === j ? middle : from.end;
      const targetStartAngle = i === j ? middle : to.start;
      if (!(sourceEndAngle > from.start && to.end > targetStartAngle)) {
        result.truncated = true;
        continue;
      }
      result.ribbons.push({
        source: row.id, target: rows[j]!.id, sourceIndex: i, targetIndex: j, value: row.values[j]!,
        sourceStartAngle: from.start, sourceEndAngle, targetStartAngle, targetEndAngle: to.end,
      });
    }
  }
  result.status = 'ready';
  return result;
}
