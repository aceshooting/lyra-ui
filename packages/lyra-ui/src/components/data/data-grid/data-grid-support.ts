import type { ComplexAttributeConverter } from 'lit';
import {
  getOwnDataDescriptor,
  readOwnArrayLength,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { resolveIntlLocale } from '../../../internal/intl-cache.js';
import type { DataGridColumn, DataGridFilter, DataGridKey, DataGridJsonValue, DataGridPinSide, DataGridScrollOptions, DataGridSelectable, DataGridSortingState } from './data-grid-types.js';

export * from './data-grid-types.js';


export const selectableConverter: ComplexAttributeConverter<DataGridSelectable> = {
  fromAttribute(value): DataGridSelectable {
    if (value === null) return 'none';
    if (value === '' || value === 'multiple') return 'multiple';
    return value === 'single' || value === 'none' ? value : 'none';
  },
  toAttribute(value): string | null {
    if (value === 'none') return null;
    return value === '' || value === 'multiple' ? '' : value;
  },
};

export interface DataDisplayRow<Row> {
  kind: 'row';
  row: Row;
  key: DataGridKey;
  depth: number;
  sourceIndex: number;
}

export interface DataDisplayGroup<Row> {
  kind: 'group';
  key: string;
  value: unknown;
  columnId: string;
  rows: Row[];
  depth: number;
}

export type DisplayItem<Row> = DataDisplayRow<Row> | DataDisplayGroup<Row>;

export interface DataGridViewportAnchor {
  readonly itemKey: string;
  readonly offset: number;
}

/** A virtual target is re-aligned only after its newly rendered measurements have settled. */
export interface PendingVirtualScroll {
  readonly itemKey: string;
  readonly align: NonNullable<DataGridScrollOptions['align']> | 'nearest';
}

const displayKeys = new WeakMap<object, string>();

/** A typed, stable DOM/cache key. `row:1` and `group:1` must never share a measured height. */
export function displayItemKey<Row>(item: DisplayItem<Row>): string {
  let key = displayKeys.get(item);
  if (!key) {
    key = item.kind === 'group' ? `group:${item.key.length}:${item.key}` : `row:${typeof item.key}:${String(item.key)}`;
    displayKeys.set(item, key);
  }
  return key;
}

const DATA_GRID_COLUMN_PROPERTIES = [
  'id',
  'field',
  'label',
  'align',
  'width',
  'minWidth',
  'maxWidth',
  'flex',
  'formatter',
  'cellTitle',
  'value',
  'sortable',
  'sortFn',
  'comparator',
  'sortDescFirst',
  'sortUndefined',
  'searchable',
  'filterable',
  'filterType',
  'filterFn',
  'hidden',
  'hideable',
  'resizable',
  'movable',
  'pinnable',
  'pinned',
  'footer',
  'aggregation',
  'aggregatedFormatter',
] as const satisfies readonly (keyof DataGridColumn<unknown>)[];

const DATA_GRID_COLUMN_CALLBACK_PROPERTIES = new Set<string>([
  'formatter',
  'cellTitle',
  'value',
  'comparator',
  'filterFn',
  'aggregatedFormatter',
]);

const DATA_GRID_SORT_ALGORITHMS = new Set<string>([
  'alphanumeric',
  'alphanumericCaseSensitive',
  'text',
  'textCaseSensitive',
  'datetime',
  'basic',
]);

const DATA_GRID_FILTER_TYPES = new Set<string>([
  'text',
  'equals',
  'number-range',
  'date-range',
  'set',
  'includes-any',
  'includes-all',
]);

const DATA_GRID_AGGREGATIONS = new Set<string>([
  'sum',
  'min',
  'max',
  'mean',
  'median',
  'count',
  'unique',
  'uniqueCount',
  'extent',
]);

type DataGridColumnProperty = (typeof DATA_GRID_COLUMN_PROPERTIES)[number];

/** Returns whether an admitted own data value can reach every later column use safely. */
function isSafeColumnPropertyValue(
  property: DataGridColumnProperty,
  value: unknown
): boolean {
  if (value === undefined) return true;
  if (DATA_GRID_COLUMN_CALLBACK_PROPERTIES.has(property))
    return typeof value === 'function';
  switch (property) {
    case 'id':
    case 'field':
    case 'label':
      return typeof value === 'string';
    case 'width':
    case 'minWidth':
    case 'maxWidth':
    case 'flex':
      return typeof value === 'number' && Number.isFinite(value);
    case 'sortable':
    case 'sortDescFirst':
    case 'searchable':
    case 'filterable':
    case 'hidden':
    case 'hideable':
    case 'resizable':
    case 'movable':
    case 'pinnable':
      return typeof value === 'boolean';
    case 'align':
      return (
        value === 'left' ||
        value === 'center' ||
        value === 'right' ||
        value === 'start' ||
        value === 'end'
      );
    case 'sortFn':
      return typeof value === 'string' && DATA_GRID_SORT_ALGORITHMS.has(value);
    case 'sortUndefined':
      return (
        value === 'first' || value === 'last' || value === 1 || value === -1
      );
    case 'filterType':
      return typeof value === 'string' && DATA_GRID_FILTER_TYPES.has(value);
    case 'pinned':
      return (
        value === false ||
        value === 'left' ||
        value === 'right' ||
        value === 'start' ||
        value === 'end'
      );
    case 'footer':
      return typeof value === 'string' || typeof value === 'function';
    default:
      // Every other column property is a callback (handled above) or one of the cases before this
      // one, so only `aggregation` can arrive here.
      return (
        typeof value === 'function' ||
        (typeof value === 'string' && DATA_GRID_AGGREGATIONS.has(value))
      );
  }
}

export function snapshotColumns<Row>(
  value: readonly DataGridColumn<Row>[],
  occurrenceId: (column: object) => string
): readonly DataGridColumn<Row>[] {
  const output: DataGridColumn<Row>[] = [];
  const seen = new Set<string>();
  let length = 0;
  try {
    if (!Array.isArray(value)) return Object.freeze(output);
    length = Math.min(readOwnArrayLength(value) ?? 0, MAX_DATA_GRID_COLUMN_ENTRIES);
  } catch {
    return Object.freeze(output);
  }
  for (let index = 0; index < length; index += 1) {
    const candidate = getOwnDataDescriptor(value, String(index));
    if (
      candidate === MISSING_OWN_DATA_DESCRIPTOR ||
      candidate === UNSAFE_OWN_DATA_DESCRIPTOR
    )
      continue;
    const column = candidate.value;
    try {
      if (
        column === null ||
        typeof column !== 'object' ||
        Array.isArray(column)
      )
        continue;
      const descriptors = new Map<
        DataGridColumnProperty,
        ReturnType<typeof getOwnDataDescriptor>
      >();
      for (const property of DATA_GRID_COLUMN_PROPERTIES)
        descriptors.set(property, getOwnDataDescriptor(column, property));
      const idDescriptor =
        descriptors.get('id') ?? MISSING_OWN_DATA_DESCRIPTOR;
      const fieldDescriptor =
        descriptors.get('field') ?? MISSING_OWN_DATA_DESCRIPTOR;
      // An unsafe id can poison the first-wins identity. A safe id is sufficient on its own,
      // however, so an unsafe optional field is omitted from the projection.
      if (idDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
      const hasId = idDescriptor !== MISSING_OWN_DATA_DESCRIPTOR;
      const authoredId = hasId ? idDescriptor.value : undefined;
      const hasSafeId =
        typeof authoredId === 'string' && authoredId.trim() !== '';
      if (hasId && authoredId !== undefined && !hasSafeId) continue;
      const hasField = fieldDescriptor !== MISSING_OWN_DATA_DESCRIPTOR;
      const authoredField =
        fieldDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR || !hasField
          ? undefined
          : fieldDescriptor.value;
      const hasSafeField =
        typeof authoredField === 'string' && authoredField.trim() !== '';
      if (
        !hasSafeId &&
        (fieldDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
          (hasField && authoredField !== undefined && !hasSafeField))
      )
        continue;
      const identity =
        hasSafeId
          ? authoredId
          : hasSafeField
            ? authoredField
            : occurrenceId(column);
      if (seen.has(identity)) continue;
      seen.add(identity);
      const snapshot = Object.create(null) as Record<string, unknown>;
      for (const property of DATA_GRID_COLUMN_PROPERTIES) {
        const descriptor = descriptors.get(property);
        if (
          descriptor === undefined ||
          descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
          descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
        )
          continue;
        if (property === 'field' && !hasSafeField) continue;
        if (!isSafeColumnPropertyValue(property, descriptor.value)) continue;
        snapshot[property] = descriptor.value;
      }
      if (authoredId === undefined && authoredField === undefined)
        snapshot['id'] = identity;
      output.push(Object.freeze(snapshot) as DataGridColumn<Row>);
    } catch {
      // Keep later valid definitions when a hostile record/getter fails.
    }
  }
  return Object.freeze(output);
}

export interface ResizeSession {
  columnId: string;
  startClientX: number;
  startWidth: number;
  initialStateWidth: number | undefined;
  pointerId: number;
  moved: boolean;
  direction: 'ltr' | 'rtl';
}

export interface ColumnDragSession {
  readonly sourceId: string;
  readonly token: string;
}

export const VIRTUALIZATION_THRESHOLD = 80;
export const VIRTUAL_OVERSCAN = 5;
export const DATA_GRID_TREE_NODE_LIMIT = 10_000;
export const DATA_GRID_TREE_DEPTH_LIMIT = 64;
const MAX_DATA_GRID_KEY_ENTRIES = 100_000;
const MAX_DATA_GRID_COLUMN_ENTRIES = 10_000;
export const DATA_GRID_DRAG_TYPE = 'application/x-lyra-data-grid-column';
/** Sentinel for `isRebind()` when a property has no stored snapshot to compare against. */
export const REBIND_NO_SNAPSHOT = Symbol('no snapshot');

export function frozenArray<Value>(values: Iterable<Value>): readonly Value[] {
  return Object.freeze([...values]);
}

/**
 * Whether a re-normalized controlled collection is the same VALUE as the one already held.
 *
 * Both setters below rebuild a fresh frozen array on every write, so the new reference is never
 * `===` the previous one and Lit's dirty check always reports a change. `updated()` turns any
 * `filters`/`sort` change into `scheduleServerRequest()`, which RESTARTS the request debounce -- so
 * a host that re-binds these properties on every render (the ordinary controlled pattern, often
 * driven by this grid's own events) kept pushing the server request further away and re-rendered
 * for nothing. Comparing the normalized content instead means only a real change schedules work.
 */
export function sameFilterState(
  left: readonly DataGridFilter[],
  right: readonly DataGridFilter[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((filter, index) => {
    const other = right[index];
    if (!other || filter.id !== other.id) return false;
    const value = filter.value;
    const otherValue = other.value;
    if (Array.isArray(value) || Array.isArray(otherValue)) {
      if (!Array.isArray(value) || !Array.isArray(otherValue)) return false;
      return (
        value.length === otherValue.length &&
        value.every((entry, position) => Object.is(entry, otherValue[position]))
      );
    }
    return Object.is(value, otherValue);
  });
}

export function sameSortState(
  left: readonly DataGridSortingState[number][],
  right: readonly DataGridSortingState[number][],
): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => {
      const other = right[index];
      return other !== undefined && entry.id === other.id && entry.desc === other.desc;
    })
  );
}

/** Converts arbitrary filter state into an isolated JSON-safe value. Sets intentionally become
 * arrays because the filter matcher already treats both as the same multi-value vocabulary. */
export function serializableFilterValue(value: unknown): DataGridJsonValue {
  try {
    const serialized = JSON.stringify({ value }, (_key, nested: unknown) => {
      if (typeof nested === 'bigint') return nested.toString();
      if (typeof nested === 'number' && !Number.isFinite(nested)) return null;
      if (
        nested !== null &&
        typeof nested === 'object' &&
        Object.prototype.toString.call(nested) === '[object Set]'
      )
        return [...(nested as Set<unknown>)];
      return nested;
    });
    if (!serialized) return null;
    const snapshot =
      (JSON.parse(serialized) as { value?: unknown }).value ?? null;
    const stack = [snapshot];
    const visited = new Set<unknown>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (
        current === null ||
        typeof current !== 'object' ||
        visited.has(current)
      )
        continue;
      visited.add(current);
      for (const nested of Object.values(current)) stack.push(nested);
      Object.freeze(current);
    }
    return snapshot as DataGridJsonValue;
  } catch {
    return null;
  }
}

export function isKey(value: unknown): value is DataGridKey {
  return (
    (typeof value === 'string' && value.trim() !== '') ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export function snapshotKeys(value: readonly DataGridKey[]): readonly DataGridKey[] {
  if (!value || typeof value !== 'object') return Object.freeze([]);
  const output: DataGridKey[] = [];
  const seen = new Set<DataGridKey>();
  try {
    let inspected = 0;
    for (const key of value) {
      if (isKey(key) && !seen.has(key)) {
        seen.add(key);
        output.push(key);
      }
      if (++inspected >= MAX_DATA_GRID_KEY_ENTRIES) break;
    }
  } catch {
    // Preserve the admitted prefix when a host iterable throws.
  }
  return frozenArray(output);
}

export function keysEqual(left: DataGridKey, right: DataGridKey): boolean {
  return typeof left === typeof right && left === right;
}

/** A key's membership form: `keysEqual()` compares type and value, so the type is part of it. */
export function typedKey(key: DataGridKey): string {
  return `${typeof key}:${String(key)}`;
}

/** Whether two key lists select the same rows, regardless of order. */
export function sameKeySet(left: readonly DataGridKey[], right: readonly DataGridKey[]): boolean {
  if (left.length !== right.length) return false;
  const known = new Set(left.map(typedKey));
  return known.size === left.length && right.every((key) => known.has(typedKey(key)));
}

/** Membership sets for the frozen key snapshots this grid holds (`selectedRowKeys`,
 *  `expandedRowKeys`). A snapshot never changes, so its set is built once and every row-loop
 *  membership test is O(1) instead of a scan over every key. */
const frozenKeyIndexes = new WeakMap<readonly DataGridKey[], ReadonlySet<string>>();

export function arrayHasKey(keys: readonly DataGridKey[], key: DataGridKey): boolean {
  let index = frozenKeyIndexes.get(keys);
  if (!index) {
    // Checked only on a cache miss: some engines answer `isFrozen` for an array in O(length).
    if (!Object.isFrozen(keys)) return keys.some((candidate) => keysEqual(candidate, key));
    index = new Set(keys.map(typedKey));
    frozenKeyIndexes.set(keys, index);
  }
  return index.has(typedKey(key));
}

export function isElementValue(value: unknown): value is Element {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Element>;
  return candidate.nodeType === 1 && typeof candidate.closest === 'function';
}

export function valueControl(
  value: EventTarget | null | undefined
): { value: string } | null {
  if (
    !isElementValue(value) ||
    typeof (value as Partial<HTMLInputElement>).value !== 'string'
  )
    return null;
  return value as HTMLInputElement | HTMLSelectElement;
}

export function checkableControl(
  value: EventTarget | null | undefined
): HTMLInputElement | null {
  if (
    !isElementValue(value) ||
    typeof (value as Partial<HTMLInputElement>).checked !== 'boolean'
  )
    return null;
  return value as HTMLInputElement;
}

function dateText(value: object): string | undefined {
  try {
    const timestamp = Date.prototype.getTime.call(value);
    return Number.isFinite(timestamp)
      ? Date.prototype.toISOString.call(value)
      : '';
  } catch {
    return undefined;
  }
}

export function humanizeIdentifier(value: string, locale: string): string {
  const intlLocale = resolveIntlLocale(locale);
  return value
    .replaceAll(/[._-]+/gu, ' ')
    .replaceAll(/([a-z\d])([A-Z])/gu, '$1 $2')
    .replace(/^./u, (first) => first.toLocaleUpperCase(intlLocale));
}

export function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const serializedDate = dateText(value);
    if (serializedDate !== undefined) return serializedDate;
  }
  if (Array.isArray(value)) return value.map(safeText).join(', ');
  if (typeof value === 'object') {
    try {
      return (
        JSON.stringify(value, (_key, nested) =>
          typeof nested === 'bigint' ? nested.toString() : nested
        ) ?? ''
      );
    } catch {
      return '';
    }
  }
  return String(value);
}

/** Normalizes `DataGridPinSide`'s `'start'`/`'end'` spelling to the `'left'`/`'right'` values the
 *  render/layout/sort logic below is keyed to. Both spellings mean the same inline-start/
 *  inline-end edges -- the CSS already resolves `[data-pin='left'|'right']` through
 *  `inset-inline-start`/`inset-inline-end`, so either spelling mirrors under `dir="rtl"`
 *  identically. Mirrors `table.class.ts`'s `stickyDirection()`. Storage (`columnPinning`,
 *  `column.pinned`) and `getColumnPin()` keep echoing back whichever spelling the caller set --
 *  only render/layout call sites normalize through this. */
export function normalizePinSide(side: DataGridPinSide): 'left' | 'right' | false {
  if (side === 'start') return 'left';
  if (side === 'end') return 'right';
  return side;
}

export function normalizedGroupBy(
  value: string | readonly string[] | null
): readonly string[] {
  if (typeof value !== 'string') {
    return (value ?? [])
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, DATA_GRID_TREE_DEPTH_LIMIT);
  }
  return value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, DATA_GRID_TREE_DEPTH_LIMIT);
}
