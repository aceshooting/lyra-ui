import { compareNullable } from '../../../internal/sort-compare.js';
import { foldSearchText } from '../../../internal/search-haystack.js';
import { parseIsoDate, localDate } from '../../../internal/calendar-date.js';
import { isDateObject } from '../../../internal/dom-guards.js';
import { getCollator, resolveIntlLocale } from '../../../internal/intl-cache.js';
import { escapeDelimitedField } from '../../../internal/csv.js';
import type {
  DataGridAggregation,
  DataGridColumn,
  DataGridCsvOptions,
  DataGridFilter,
  DataGridFilterType,
  DataGridSortingState,
} from './data-grid-types.js';

export function columnId<Row>(column: DataGridColumn<Row>, _index: number): string {
  if (typeof column.id === 'string' && column.id.trim() !== '') return column.id;
  if (typeof column.field === 'string' && column.field.trim() !== '') return column.field;
  return '';
}

export function pathValue(value: unknown, path: string): unknown {
  if (!path) return undefined;
  let current = value;
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function columnValue<Row>(column: DataGridColumn<Row>, row: Row): unknown {
  if (column.value) return column.value(row);
  return column.field ? pathValue(row, column.field) : undefined;
}

function comparableText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (isDateObject(value)) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
  if (Array.isArray(value)) return value.map(comparableText).join(' ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, (_key, nested) =>
        typeof nested === 'bigint' ? nested.toString() : nested,
      ) ?? '';
    } catch {
      return '';
    }
  }
  return String(value);
}

function numericDate(value: unknown): number | undefined {
  if (isDateObject(value)) return Number.isFinite(value.getTime()) ? value.getTime() : undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function finiteValue(value: unknown): number | undefined {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function filterList(value: unknown): readonly unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (value === null || typeof value !== 'object') return undefined;
  try {
    return Array.from(Set.prototype.values.call(value) as IterableIterator<unknown>);
  } catch {
    return undefined;
  }
}

function valuesFromFilter(value: unknown): readonly unknown[] {
  return filterList(value) ?? (value == null || value === '' ? [] : [value]);
}

function valuesFromCell(value: unknown): readonly unknown[] {
  return filterList(value) ?? [value];
}

function sameValue(left: unknown, right: unknown, collator: () => Intl.Collator): boolean {
  if (Object.is(left, right)) return true;
  return collator().compare(
    comparableText(left),
    comparableText(right),
  ) === 0;
}

function localCalendarDay(value: unknown): number | undefined {
  const parts = typeof value === 'string' ? parseIsoDate(value.trim()) : undefined;
  return parts ? localDate(parts.y, parts.m - 1, parts.d).getTime() : undefined;
}

function matchesRange(value: unknown, filter: unknown, date: boolean): boolean {
  if (!Array.isArray(filter)) return true;
  const [rawStart, rawEnd] = filter;
  const read = date
    ? (candidate: unknown) => localCalendarDay(candidate) ?? numericDate(candidate)
    : finiteValue;
  const current = read(value);
  if (current === undefined) return false;
  const start = read(rawStart);
  const end = read(rawEnd);
  if (start !== undefined && current < start) return false;
  if (end !== undefined) {
    if (date) {
      const inclusiveEnd = new Date(end);
      inclusiveEnd.setHours(23, 59, 59, 999);
      if (current > inclusiveEnd.getTime()) return false;
    } else if (current > end) return false;
  }
  return true;
}

export function matchesFilter<Row>(
  row: Row,
  column: DataGridColumn<Row>,
  filter: unknown,
  locale: string,
): boolean {
  const intlLocale = resolveIntlLocale(locale);
  const value = columnValue(column, row);
  if (column.filterFn) return Boolean(column.filterFn(value, filter, row));
  const type: DataGridFilterType = column.filterType ?? 'text';
  if (type === 'number-range') return matchesRange(value, filter, false);
  if (type === 'date-range') return matchesRange(value, filter, true);
  let collator: Intl.Collator | undefined;
  const comparison = (): Intl.Collator =>
    collator ??= getCollator(intlLocale, { sensitivity: 'base', numeric: true });
  if (type === 'equals') return comparison().compare(comparableText(value), comparableText(filter)) === 0;

  const needles = valuesFromFilter(filter);
  if (needles.length === 0) return true;
  const values = valuesFromCell(value);
  if (type === 'set' || type === 'includes-any') {
    return needles.some((needle) => values.some((candidate) => sameValue(candidate, needle, comparison)));
  }
  if (type === 'includes-all') {
    return needles.every((needle) => values.some((candidate) => sameValue(candidate, needle, comparison)));
  }

  return foldSearchText(comparableText(value), intlLocale).includes(
    foldSearchText(comparableText(filter), intlLocale),
  );
}

/** A lazy folded cell corpus; callers replace it when canonical rows or locale change. */
export function textFilterCorpus<Row>(locale: string): (column: DataGridColumn<Row>, row: Row) => string {
  const intlLocale = resolveIntlLocale(locale);
  const columns = new Map<DataGridColumn<Row>, Map<Row, string>>();
  return (column, row) => {
    let cells = columns.get(column);
    if (!cells) { cells = new Map(); columns.set(column, cells); }
    let text = cells.get(row);
    if (text === undefined) {
      text = foldSearchText(comparableText(columnValue(column, row)), intlLocale);
      cells.set(row, text);
    }
    return text;
  };
}

export function filterRows<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  filters: readonly DataGridFilter[],
  locale: string,
  textFor?: (column: DataGridColumn<Row>, row: Row) => string,
): Row[] {
  if (filters.length === 0) return [...rows];
  const byId = new Map(columns.map((column, index) => [columnId(column, index), column]));
  const predicates = filters.flatMap(filter => {
    const column = byId.get(filter.id);
    if (!column) return [];
    if (!column.filterFn && (column.filterType === undefined || column.filterType === 'text')) {
      if (valuesFromFilter(filter.value).length === 0) return [(_row: Row) => true];
      const intlLocale = resolveIntlLocale(locale);
      const needle = foldSearchText(comparableText(filter.value), intlLocale);
      return [(row: Row) => (textFor ? textFor(column, row) : foldSearchText(comparableText(columnValue(column, row)), intlLocale)).includes(needle)];
    }
    if (!column.filterFn && (column.filterType === 'number-range' || column.filterType === 'date-range') && Array.isArray(filter.value)) {
      const date = column.filterType === 'date-range';
      const read = date ? (value: unknown) => localCalendarDay(value) ?? numericDate(value) : finiteValue;
      const start = read(filter.value[0]);
      let end = read(filter.value[1]);
      if (date && end !== undefined) {
        const dayEnd = new Date(end); dayEnd.setHours(23, 59, 59, 999); end = dayEnd.getTime();
      }
      return [(row: Row) => {
        const value = read(columnValue(column, row));
        return value !== undefined && (start === undefined || value >= start) && (end === undefined || value <= end);
      }];
    }
    return [(row: Row) => matchesFilter(row, column, filter.value, locale)];
  });
  return rows.filter(row => predicates.every(predicate => predicate(row)));
}

/** Per-column strings preserve matching boundaries between adjacent cells. */
export function searchHaystacks<Row>(rows: readonly Row[], columns: readonly DataGridColumn<Row>[], locale: string): ReadonlyMap<Row, readonly string[]> {
  const intlLocale = resolveIntlLocale(locale);
  const searchable = columns.filter(column => (column.field || column.value) && column.searchable !== false);
  return new Map(rows.map(row => [row, searchable.map(column => foldSearchText(comparableText(columnValue(column, row)), intlLocale))]));
}

export function searchRows<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  term: string,
  locale: string,
  searchFn: ((value: unknown, term: string, row: Row) => boolean) | null,
  haystacks?: ReadonlyMap<Row, readonly string[]>,
): Row[] {
  const intlLocale = resolveIntlLocale(locale);
  const needle = term.trim();
  if (!needle) return [...rows];
  const searchable = columns.filter((column) => (column.field || column.value) && column.searchable !== false);
  const normalizedNeedle = searchFn ? '' : foldSearchText(needle, intlLocale);
  if (!searchFn && haystacks) return rows.filter(row => haystacks.get(row)?.some(value => value.includes(normalizedNeedle)));
  return rows.filter((row) =>
    searchable.some((column) => {
      const value = columnValue(column, row);
      return searchFn
        ? Boolean(searchFn(value, needle, row))
        : foldSearchText(comparableText(value), intlLocale)
            .includes(normalizedNeedle);
    }),
  );
}

function undefinedRank<Row>(
  column: DataGridColumn<Row>,
  left: unknown,
  right: unknown,
): number | undefined {
  const leftMissing = left === null || left === undefined ||
    (typeof left === 'number' && !Number.isFinite(left));
  const rightMissing = right === null || right === undefined ||
    (typeof right === 'number' && !Number.isFinite(right));
  if (leftMissing === rightMissing) return undefined;
  const policy = column.sortUndefined ?? 'last';
  const missingFirst = policy === 'first' || policy === -1;
  return leftMissing === missingFirst ? -1 : 1;
}

/** One row's sort value for one sort column, with its derived comparison forms computed at most
 *  once per sort instead of once per comparison. */
interface SortCell {
  readonly value: unknown;
  text?: string;
  time?: number | null;
}

function cellText(cell: SortCell): string {
  return (cell.text ??= comparableText(cell.value));
}

function cellTime(cell: SortCell): number | undefined {
  if (cell.time === undefined) cell.time = numericDate(cell.value) ?? null;
  return cell.time ?? undefined;
}

type CellCompare<Row> = (left: SortCell, right: SortCell, leftRow: Row, rightRow: Row) => number;

/** The comparison one column applies, resolved (with its collator) once per sort. */
function cellComparator<Row>(column: DataGridColumn<Row>, locale: string): CellCompare<Row> {
  const comparator = column.comparator;
  if (comparator) {
    return (left, right, leftRow, rightRow) =>
      comparator(left.value, right.value, leftRow, rightRow);
  }
  const algorithm = column.sortFn ?? 'alphanumeric';
  const caseSensitive = algorithm === 'alphanumericCaseSensitive' || algorithm === 'textCaseSensitive';
  const numeric = algorithm === 'alphanumeric' || algorithm === 'alphanumericCaseSensitive';
  let collator: Intl.Collator | undefined;
  return (left, right) => {
    if (algorithm === 'datetime') {
      const leftTime = cellTime(left);
      const rightTime = cellTime(right);
      if (leftTime !== undefined && rightTime !== undefined) return compareNullable(leftTime, rightTime, 1, locale);
    }
    if (algorithm === 'basic' && typeof left.value === 'number' && typeof right.value === 'number') {
      return compareNullable(left.value, right.value, 1, locale);
    }
    collator ??= getCollator(locale, {
      sensitivity: caseSensitive ? 'variant' : 'base',
      numeric,
    });
    return collator.compare(cellText(left), cellText(right));
  };
}

export function sortRows<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  sorting: readonly DataGridSortingState[number][],
  locale: string,
): Row[] {
  if (sorting.length === 0) return [...rows];
  const byId = new Map(columns.map((column, index) => [columnId(column, index), column]));
  const active: Array<{
    readonly desc: boolean;
    readonly column: DataGridColumn<Row>;
    readonly compare: CellCompare<Row>;
  }> = [];
  for (const sort of sorting) {
    const column = byId.get(sort.id);
    if (column) active.push({ desc: sort.desc, column, compare: cellComparator(column, locale) });
  }
  // Decorate once: every sort value is read (and its text/time form derived) once per row.
  const decorated = rows.map((row, index) => ({
    row,
    index,
    cells: active.map(({ column }): SortCell => ({ value: columnValue(column, row) })),
  }));
  return decorated
    .sort((left, right) => {
      for (let position = 0; position < active.length; position += 1) {
        const { desc, column, compare } = active[position]!;
        const leftCell = left.cells[position]!;
        const rightCell = right.cells[position]!;
        const missing = undefinedRank(column, leftCell.value, rightCell.value);
        if (missing !== undefined) {
          return typeof (column.sortUndefined ?? 'last') === 'string'
            ? missing
            : desc ? -missing : missing;
        }
        const compared = compare(leftCell, rightCell, left.row, right.row);
        if (compared !== 0) return desc ? -compared : compared;
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

export function aggregateValues<Row>(
  aggregation: DataGridAggregation<Row>,
  rows: readonly Row[],
  values: readonly unknown[],
): unknown {
  if (typeof aggregation === 'function') return aggregation(rows, values);
  if (aggregation === 'count') return rows.length;
  const defined = values.filter((value) => value !== null && value !== undefined);
  if (aggregation === 'unique') return [...new Set(defined)];
  if (aggregation === 'uniqueCount') return new Set(defined).size;
  const numeric = defined.map(finiteValue).filter((value): value is number => value !== undefined);
  if (numeric.length === 0) return aggregation === 'extent' ? [] : undefined;
  if (aggregation === 'sum' || aggregation === 'mean') {
    let scale = 0;
    for (const value of numeric) scale = Math.max(scale, Math.abs(value));
    let scaledTotal = 0;
    if (scale > 0) {
      for (const value of numeric) scaledTotal += value / scale;
    }
    const result = scale === 0 ? 0 : aggregation === 'sum'
      ? scaledTotal * scale
      : (scaledTotal / numeric.length) * scale;
    return Number.isFinite(result) ? result : undefined;
  }
  if (aggregation === 'median') {
    const sorted = [...numeric].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[middle];
    const left = sorted[middle - 1] ?? 0;
    const right = sorted[middle] ?? 0;
    const median = Math.sign(left) === Math.sign(right)
      ? left + (right - left) / 2
      : left / 2 + right / 2;
    return Number.isFinite(median) ? median : undefined;
  }
  let minimum = numeric[0]!;
  let maximum = minimum;
  for (const value of numeric) {
    // Stable sorting previously kept the first minimum and last maximum, including -0/0 ties.
    if (value < minimum) minimum = value;
    if (value >= maximum) maximum = value;
  }
  if (aggregation === 'min') return minimum;
  if (aggregation === 'max') return maximum;
  return [minimum, maximum];
}

export function rowsAsDelimited<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  options: DataGridCsvOptions = {},
): string {
  const delimiter = options.delimiter || ',';
  const includeHeaders = options.includeHeaders ?? true;
  const bodyOptions = { delimiter, escapeFormulas: options.escapeFormulas ?? true };
  const textOptions = { delimiter, escapeFormulas: false };
  const requested = options.columnIds ? new Set(options.columnIds) : undefined;
  const visible = columns.filter(
    (column, index) => column.hidden !== true && (!requested || requested.has(columnId(column, index))),
  );
  const lines: string[] = [];
  if (includeHeaders) {
    lines.push(visible.map((column, index) =>
      escapeDelimitedField(column.label ?? columnId(column, index), textOptions)).join(delimiter));
  }
  for (const row of rows) {
    lines.push(visible.map((column) => {
      const value = columnValue(column, row);
      // Numeric cells still need quoting when their text contains the separator.
      const finiteNumeric = typeof value === 'number' && Number.isFinite(value);
      return escapeDelimitedField(comparableText(value), finiteNumeric ? textOptions : bodyOptions);
    }).join(delimiter));
  }
  return lines.join('\r\n');
}
