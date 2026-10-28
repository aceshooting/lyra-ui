import { LYRA_DEFAULT_largeDataInvalid, LYRA_DEFAULT_largeDataLimit } from './default-strings/shared.generated.js';
import type { LyraMessage } from './localization-types.js';

/**
 * Typed-column input for views too large for the shared public-collection snapshot (at most
 * 10,000 entries and 50,000 nested values per assignment). Columns are admitted without per-item
 * object copies; the column object is immutable by contract, so callers publish a change by
 * assigning a new object, and validation runs once per assignment.
 */

/** Graph columns: row `i` of every node column describes node `i`; edges index into the nodes. */
export interface LyraGraphColumns {
  readonly ids: readonly string[];
  readonly x?: Float32Array;
  readonly y?: Float32Array;
  readonly z?: Float32Array;
  readonly size?: Float32Array;
  readonly category?: Uint16Array;
  readonly categories?: readonly string[];
  readonly labels?: readonly string[];
  readonly source: Uint32Array;
  readonly target: Uint32Array;
  readonly edgeCategory?: Uint16Array;
  /** Finite signed 3D curvature per edge; render projections clamp to [-1, 1] without changing this borrowed array. */
  readonly edgeCurvature?: Float32Array;
}

/** Point columns: row `i` of every column describes point `i`. */
export interface LyraPointColumns {
  readonly ids: readonly string[];
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z?: Float32Array;
  readonly cluster?: Uint16Array;
  readonly clusters?: readonly string[];
  readonly labels?: readonly string[];
}

export interface GraphColumnLimits {
  readonly nodes: number;
  readonly edges: number;
}

/** Documented ceilings: 200,000 graph nodes, 1,000,000 graph edges and 1,000,000 points. */
export const GRAPH_COLUMN_LIMITS: GraphColumnLimits = Object.freeze({ nodes: 200_000, edges: 1_000_000 });
export const POINT_COLUMN_LIMIT = 1_000_000;
/** Rows per page when a built-in renderer or the list alternative pages through large input. */
export const LARGE_DATA_PAGE_SIZE = 200;

export type TypedColumnIssueCode =
  | 'not-an-object'
  | 'missing'
  | 'wrong-type'
  | 'length-mismatch'
  | 'out-of-range'
  | 'not-finite'
  | 'invalid-id'
  | 'duplicate-id'
  | 'too-many';

/** The first problem found: the column, the offending row when there is one, and a ceiling for `too-many`. */
export interface TypedColumnIssue {
  readonly code: TypedColumnIssueCode;
  readonly column: string;
  readonly index?: number;
  readonly limit?: number;
}

export type TypedColumnResult<Columns> =
  | { readonly ok: true; readonly columns: Columns; readonly count: number }
  | { readonly ok: false; readonly issue: TypedColumnIssue };

type TypedArrayName = 'Float32Array' | 'Uint16Array' | 'Uint32Array';

// The %TypedArray%.prototype[@@toStringTag] getter reports the real kind of any typed array,
// including one from another realm, and `undefined` for everything else.
const typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  Symbol.toStringTag,
)?.get as ((this: unknown) => string | undefined) | undefined;

function typedArrayKind(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !typedArrayTag) return undefined;
  return typedArrayTag.call(value);
}

class ColumnError extends Error {
  constructor(readonly issue: TypedColumnIssue) {
    super(issue.code);
  }
}

function fail(issue: TypedColumnIssue): never {
  throw new ColumnError(Object.freeze(issue));
}

/** Reads each own data property exactly once, so an accessor cannot change a column mid-validation. */
function snapshot(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail({ code: 'not-an-object', column: '' });
  const copy: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    copy[key] = descriptor && 'value' in descriptor ? descriptor.value : undefined;
  }
  return copy;
}

function typedColumn<T>(columns: Record<string, unknown>, column: string, kind: TypedArrayName, required: boolean, length?: number): T | undefined {
  const value = columns[column];
  if (value === undefined) return required ? fail({ code: 'missing', column }) : undefined;
  if (typedArrayKind(value) !== kind) fail({ code: 'wrong-type', column });
  if (length !== undefined && (value as ArrayLike<number>).length !== length) fail({ code: 'length-mismatch', column });
  return value as T;
}

/** Category and cluster names: a `Uint16Array` index can address at most this many. */
const MAX_NAMES = 0x10000;

function stringColumn(columns: Record<string, unknown>, column: string, length?: number): readonly string[] | undefined {
  const value = columns[column];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return fail({ code: 'wrong-type', column });
  if (length !== undefined && value.length !== length) fail({ code: 'length-mismatch', column });
  if (length === undefined && value.length > MAX_NAMES) fail({ code: 'too-many', column, limit: MAX_NAMES });
  for (let index = 0; index < value.length; index += 1) {
    if (typeof value[index] !== 'string') fail({ code: 'wrong-type', column, index });
  }
  return value as readonly string[];
}

function finiteColumn(values: Float32Array | undefined, column: string, minimum = Number.NEGATIVE_INFINITY): void {
  if (!values) return;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] as number;
    if (!Number.isFinite(value)) fail({ code: 'not-finite', column, index });
    if (value < minimum) fail({ code: 'out-of-range', column, index });
  }
}

function indexColumn(values: Uint16Array | Uint32Array | undefined, column: string, size: number | undefined): void {
  if (!values || size === undefined) return;
  for (let index = 0; index < values.length; index += 1) {
    if ((values[index] as number) >= size) fail({ code: 'out-of-range', column, index });
  }
}

function idColumn(columns: Record<string, unknown>, limit: number, limitColumn: string): readonly string[] {
  const value = columns['ids'];
  if (value === undefined) return fail({ code: 'missing', column: 'ids' });
  if (!Array.isArray(value)) return fail({ code: 'wrong-type', column: 'ids' });
  if (value.length > limit) fail({ code: 'too-many', column: limitColumn, limit });
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const id: unknown = value[index];
    if (typeof id !== 'string' || id.length === 0) fail({ code: 'invalid-id', column: 'ids', index });
    if (seen.has(id as string)) fail({ code: 'duplicate-id', column: 'ids', index });
    seen.add(id as string);
  }
  return value as readonly string[];
}

function validate<Columns>(build: () => { columns: Columns; count: number }): TypedColumnResult<Columns> {
  try {
    const { columns, count } = build();
    return Object.freeze({ ok: true as const, columns, count });
  } catch (error) {
    if (error instanceof ColumnError) return Object.freeze({ ok: false as const, issue: error.issue });
    throw error;
  }
}

const GRAPH_KEYS = ['ids', 'x', 'y', 'z', 'size', 'category', 'categories', 'labels', 'source', 'target', 'edgeCategory', 'edgeCurvature'];
const POINT_KEYS = ['ids', 'x', 'y', 'z', 'cluster', 'clusters', 'labels'];

/**
 * Validates graph columns: unique non-empty ids within the node ceiling, every node column as
 * long as `ids`, finite coordinates and non-negative sizes, `source`/`target` of equal length
 * within the edge ceiling and indexing existing nodes, and category indices inside their name
 * lists (at most 65,536 names, the range of a `Uint16Array` index). The result references the caller's arrays in a frozen shell; nothing is copied.
 */
export function validateGraphColumns(value: unknown, limits: GraphColumnLimits = GRAPH_COLUMN_LIMITS): TypedColumnResult<LyraGraphColumns> {
  return validate(() => {
    const columns = snapshot(value, GRAPH_KEYS);
    const ids = idColumn(columns, limits.nodes, 'ids');
    const nodes = ids.length;
    const x = typedColumn<Float32Array>(columns, 'x', 'Float32Array', false, nodes);
    const y = typedColumn<Float32Array>(columns, 'y', 'Float32Array', false, nodes);
    const z = typedColumn<Float32Array>(columns, 'z', 'Float32Array', false, nodes);
    const size = typedColumn<Float32Array>(columns, 'size', 'Float32Array', false, nodes);
    const category = typedColumn<Uint16Array>(columns, 'category', 'Uint16Array', false, nodes);
    const categories = stringColumn(columns, 'categories');
    const labels = stringColumn(columns, 'labels', nodes);
    const source = typedColumn<Uint32Array>(columns, 'source', 'Uint32Array', true) as Uint32Array;
    if (source.length > limits.edges) fail({ code: 'too-many', column: 'source', limit: limits.edges });
    const target = typedColumn<Uint32Array>(columns, 'target', 'Uint32Array', true, source.length) as Uint32Array;
    const edgeCategory = typedColumn<Uint16Array>(columns, 'edgeCategory', 'Uint16Array', false, source.length);
    const edgeCurvature = typedColumn<Float32Array>(columns, 'edgeCurvature', 'Float32Array', false, source.length);
    finiteColumn(edgeCurvature, 'edgeCurvature');
    for (const [name, values] of [['x', x], ['y', y], ['z', z]] as const) finiteColumn(values, name);
    finiteColumn(size, 'size', 0);
    indexColumn(source, 'source', nodes);
    indexColumn(target, 'target', nodes);
    indexColumn(category, 'category', categories?.length);
    indexColumn(edgeCategory, 'edgeCategory', categories?.length);
    const admitted: Record<string, unknown> = { ids, source, target };
    for (const [key, entry] of Object.entries({ x, y, z, size, category, categories, labels, edgeCategory, edgeCurvature })) {
      if (entry !== undefined) admitted[key] = entry;
    }
    return { columns: Object.freeze(admitted) as unknown as LyraGraphColumns, count: nodes };
  });
}

/**
 * Validates point columns: unique non-empty ids within the point ceiling, finite `x`, `y` and
 * optional `z` as long as `ids`, and cluster indices inside `clusters` when names are given.
 */
export function validatePointColumns(value: unknown, limit = POINT_COLUMN_LIMIT): TypedColumnResult<LyraPointColumns> {
  return validate(() => {
    const columns = snapshot(value, POINT_KEYS);
    const ids = idColumn(columns, limit, 'ids');
    const points = ids.length;
    const x = typedColumn<Float32Array>(columns, 'x', 'Float32Array', true, points) as Float32Array;
    const y = typedColumn<Float32Array>(columns, 'y', 'Float32Array', true, points) as Float32Array;
    const z = typedColumn<Float32Array>(columns, 'z', 'Float32Array', false, points);
    const cluster = typedColumn<Uint16Array>(columns, 'cluster', 'Uint16Array', false, points);
    const clusters = stringColumn(columns, 'clusters');
    const labels = stringColumn(columns, 'labels', points);
    for (const [name, values] of [['x', x], ['y', y], ['z', z]] as const) finiteColumn(values, name);
    indexColumn(cluster, 'cluster', clusters?.length);
    const admitted: Record<string, unknown> = { ids, x, y };
    for (const [key, entry] of Object.entries({ z, cluster, clusters, labels })) {
      if (entry !== undefined) admitted[key] = entry;
    }
    return { columns: Object.freeze(admitted) as unknown as LyraPointColumns, count: points };
  });
}

export interface LargeDataPage {
  readonly page: number;
  readonly pageCount: number;
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
}

/** One page of `total` rows; `page` (zero-based) clamps into range and an empty input has one empty page. */
export function largeDataPage(total: number, page: number, pageSize = LARGE_DATA_PAGE_SIZE): LargeDataPage {
  const rows = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : LARGE_DATA_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(rows / size));
  const current = Number.isFinite(page) ? Math.min(pageCount - 1, Math.max(0, Math.floor(page))) : 0;
  return Object.freeze({ page: current, pageCount, start: current * size, end: Math.min(rows, (current + 1) * size) });
}

export type LargeDataMessageKey = 'largeDataInvalid' | 'largeDataLimit';

export const LARGE_DATA_DEFAULT_STRINGS: Readonly<Record<LargeDataMessageKey, LyraMessage>> = Object.freeze({
  largeDataInvalid: LYRA_DEFAULT_largeDataInvalid,
  largeDataLimit: LYRA_DEFAULT_largeDataLimit,
});

/**
 * The localized error-state message for an issue. `property` names the element property that
 * received the columns (`graphColumns`); column names are API identifiers and stay untranslated.
 * `formatNumber` formats the ceiling with the element's effective locale.
 */
export function typedColumnIssueMessage(
  issue: TypedColumnIssue,
  property: string,
  formatNumber: (value: number) => string,
): { readonly key: LargeDataMessageKey; readonly values: Readonly<Record<string, string>> } {
  return issue.code === 'too-many' && issue.limit !== undefined
    ? { key: 'largeDataLimit', values: { limit: formatNumber(issue.limit) } }
    : { key: 'largeDataInvalid', values: { column: issue.column ? `${property}.${issue.column}` : property } };
}
