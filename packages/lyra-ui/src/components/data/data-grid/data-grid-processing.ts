import { getCollator, resolveIntlLocale } from '../../../internal/intl-cache.js';
import { UNSAFE_LEADING } from '../../utility/export-button/csv.js';
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
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
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
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : undefined;
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

function valuesFromFilter(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  return value === null || value === undefined || value === '' ? [] : [value];
}

function valuesFromCell(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  return [value];
}

function sameValue(left: unknown, right: unknown, locale: string): boolean {
  if (Object.is(left, right)) return true;
  return getCollator(locale, { sensitivity: 'base', numeric: true }).compare(
    comparableText(left),
    comparableText(right),
  ) === 0;
}

function matchesRange(value: unknown, filter: unknown, date: boolean): boolean {
  if (!Array.isArray(filter)) return true;
  const [rawStart, rawEnd] = filter;
  const read = date ? numericDate : finiteValue;
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
  const collator = getCollator(intlLocale, { sensitivity: 'base', numeric: true });

  if (type === 'number-range') return matchesRange(value, filter, false);
  if (type === 'date-range') return matchesRange(value, filter, true);
  if (type === 'equals') return collator.compare(comparableText(value), comparableText(filter)) === 0;

  const needles = valuesFromFilter(filter);
  if (needles.length === 0) return true;
  const values = valuesFromCell(value);
  if (type === 'set' || type === 'includes-any') {
    return needles.some((needle) => values.some((candidate) => sameValue(candidate, needle, locale)));
  }
  if (type === 'includes-all') {
    return needles.every((needle) => values.some((candidate) => sameValue(candidate, needle, locale)));
  }

  return comparableText(value).toLocaleLowerCase(intlLocale).includes(
    comparableText(filter).toLocaleLowerCase(intlLocale),
  );
}

export function filterRows<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  filters: readonly DataGridFilter[],
  locale: string,
): Row[] {
  if (filters.length === 0) return [...rows];
  const byId = new Map(columns.map((column, index) => [columnId(column, index), column]));
  return rows.filter((row) =>
    filters.every((filter) => {
      const column = byId.get(filter.id);
      return !column || matchesFilter(row, column, filter.value, locale);
    }),
  );
}

export function searchRows<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  term: string,
  locale: string,
  searchFn: ((value: unknown, term: string, row: Row) => boolean) | null,
): Row[] {
  const intlLocale = resolveIntlLocale(locale);
  const needle = term.trim();
  if (!needle) return [...rows];
  const searchable = columns.filter((column) => (column.field || column.value) && column.searchable !== false);
  return rows.filter((row) =>
    searchable.some((column) => {
      const value = columnValue(column, row);
      return searchFn
        ? Boolean(searchFn(value, needle, row))
        : comparableText(value)
            .toLocaleLowerCase(intlLocale)
            .includes(needle.toLocaleLowerCase(intlLocale));
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

function compareValues<Row>(
  column: DataGridColumn<Row>,
  left: unknown,
  right: unknown,
  leftRow: Row,
  rightRow: Row,
  locale: string,
): number {
  if (column.comparator) return column.comparator(left, right, leftRow, rightRow);
  const algorithm = column.sortFn ?? 'alphanumeric';
  if (algorithm === 'datetime') {
    const leftTime = numericDate(left);
    const rightTime = numericDate(right);
    if (leftTime !== undefined && rightTime !== undefined) return leftTime - rightTime;
  }
  if (algorithm === 'basic' && typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  const caseSensitive = algorithm === 'alphanumericCaseSensitive' || algorithm === 'textCaseSensitive';
  const numeric = algorithm === 'alphanumeric' || algorithm === 'alphanumericCaseSensitive';
  return getCollator(locale, {
    sensitivity: caseSensitive ? 'variant' : 'base',
    numeric,
  }).compare(comparableText(left), comparableText(right));
}

export function sortRows<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  sorting: readonly DataGridSortingState[number][],
  locale: string,
): Row[] {
  if (sorting.length === 0) return [...rows];
  const byId = new Map(columns.map((column, index) => [columnId(column, index), column]));
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const sort of sorting) {
        const column = byId.get(sort.id);
        if (!column) continue;
        const leftValue = columnValue(column, left.row);
        const rightValue = columnValue(column, right.row);
        const missing = undefinedRank(column, leftValue, rightValue);
        if (missing !== undefined) {
          return typeof (column.sortUndefined ?? 'last') === 'string'
            ? missing
            : sort.desc ? -missing : missing;
        }
        const compared = compareValues(
          column,
          leftValue,
          rightValue,
          left.row,
          right.row,
          locale,
        );
        if (compared !== 0) return sort.desc ? -compared : compared;
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
  const sorted = [...numeric].sort((left, right) => left - right);
  if (aggregation === 'sum') return numeric.reduce((sum, value) => sum + value, 0);
  if (aggregation === 'min') return sorted[0];
  if (aggregation === 'max') return sorted.at(-1);
  if (aggregation === 'mean') return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  if (aggregation === 'median') {
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : sorted[middle];
  }
  return [sorted[0], sorted.at(-1)];
}

function csvCell(value: unknown, delimiter: string, escapeFormulas: boolean): string {
  let text = comparableText(value);
  // Shares `UNSAFE_LEADING` with `escapeCsvField()` so both writers guard the same set: the bare
  // ASCII sigils plus the fullwidth twins an import normalizes back to them and the leading
  // whitespace a spreadsheet strips before parsing the cell. A real numeric cell is exempt --
  // its text can only ever be a number literal, and text-prefixing it would break every
  // downstream sum.
  if (escapeFormulas && typeof value !== 'number' && UNSAFE_LEADING.test(text)) text = `'${text}`;
  if (text.includes(delimiter) || /['\r\n]/u.test(text)) text = `'${text.replaceAll('"', '""')}"`;
  return text;
}

export function rowsAsDelimited<Row>(
  rows: readonly Row[],
  columns: readonly DataGridColumn<Row>[],
  options: DataGridCsvOptions = {},
): string {
  const delimiter = options.delimiter ?? ',';
  const includeHeaders = options.includeHeaders ?? true;
  const escapeFormulas = options.escapeFormulas ?? true;
  const requested = options.columnIds ? new Set(options.columnIds) : undefined;
  const visible = columns.filter(
    (column, index) => column.hidden !== true && (!requested || requested.has(columnId(column, index))),
  );
  const lines: string[] = [];
  if (includeHeaders) {
    lines.push(visible.map((column, index) => csvCell(column.label ?? columnId(column, index), delimiter, false)).join(delimiter));
  }
  for (const row of rows) {
    lines.push(visible.map((column) => csvCell(columnValue(column, row), delimiter, escapeFormulas)).join(delimiter));
  }
  return lines.join('\r\n');
}
