import type { PapaParseApi } from './papaparse-loader.js';
import {
  DEFAULT_MAX_TABLE_COLUMNS,
  DEFAULT_MAX_TABLE_ROWS,
  LyraResourceLimitError,
} from './resource-loader.js';

export const DEFAULT_MAX_DELIMITED_CELLS = 1_000_000;
export const DEFAULT_MAX_DELIMITED_ERRORS = 100;

export interface DelimitedParseLimits {
  readonly maxRows?: number;
  readonly maxColumns?: number;
  readonly maxCells?: number;
  readonly maxErrors?: number;
}

export interface DelimitedGridResult {
  data: unknown[][];
  errors: unknown[];
}

export interface DelimitedRecordResult {
  fields: string[];
  rows: Record<string, string>[];
  errors: unknown[];
}

interface EffectiveDelimitedParseLimits {
  maxRows: number;
  maxColumns: number;
  maxCells: number;
  maxErrors: number;
}

interface PapaParserHandle {
  abort(): void;
}

interface PapaStepResult<T> {
  data?: T;
  errors?: unknown[];
  meta?: { fields?: string[] };
}

interface PapaReturnedResult<T> {
  data?: T[];
  errors?: unknown[];
  meta?: { fields?: string[] };
}

type DelimitedNewline = '\r\n' | '\n' | '\r';

interface StructuralRow {
  fieldCount: number;
}

interface StructuralScan {
  rows: StructuralRow[];
  parserErrorCount: number;
  parserErrors: DelimitedParserError[];
}

interface DelimitedParserError {
  type: 'Quotes';
  code: 'InvalidQuotes' | 'MissingQuotes';
  message: string;
  row: number;
  index: number;
}

interface DelimitedDialect {
  delimiter: string;
  delimiterDetected: boolean;
  newline: DelimitedNewline;
}

interface DelimitedPreflight {
  dataRowCount: number;
  quoteErrors: DelimitedParserError[];
}

const DELIMITER_CANDIDATES = [',', '\t', '|', ';', '\x1e', '\x1f'] as const;
const DELIMITER_SAMPLE_ROWS = 10;

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function effectiveLimits(limits: DelimitedParseLimits = {}): EffectiveDelimitedParseLimits {
  return {
    maxRows: positiveInteger(limits.maxRows, DEFAULT_MAX_TABLE_ROWS),
    maxColumns: positiveInteger(limits.maxColumns, DEFAULT_MAX_TABLE_COLUMNS),
    maxCells: positiveInteger(limits.maxCells, DEFAULT_MAX_DELIMITED_CELLS),
    maxErrors: positiveInteger(limits.maxErrors, DEFAULT_MAX_DELIMITED_ERRORS),
  };
}

function newlineAt(
  text: string,
  index: number,
  newline: DelimitedNewline | null,
): DelimitedNewline | null {
  if (newline !== null) return text.startsWith(newline, index) ? newline : null;
  if (text[index] === '\r') return text[index + 1] === '\n' ? '\r\n' : '\r';
  return text[index] === '\n' ? '\n' : null;
}

function isIgnorablePostQuoteWhitespace(value: string): boolean {
  // PapaParse accepts a post-quote run when the complete substring is empty after String#trim.
  // Testing each code unit preserves that behavior without retaining the substring.
  return value.trim() === '';
}

/** Walks the grammar without retaining field strings or row arrays. The same scanner chooses a
 * dialect from a small public PapaParse candidate set and rejects amplification limits before the
 * peer can materialize an oversized parse result. */
function scanDelimitedStructure(
  text: string,
  delimiter: string,
  newline: DelimitedNewline | null,
  maxRows = Number.POSITIVE_INFINITY,
  onRow?: (row: StructuralRow) => void,
  maxParserErrors = Number.POSITIVE_INFINITY,
  collectParserErrors = false,
): StructuralScan {
  const rows: StructuralRow[] = [];
  const parserErrors: DelimitedParserError[] = [];
  // PapaParse strips one leading UTF-8 BOM before parsing; skipping it in the structural pass keeps
  // a quoted first field at field-start here too.
  const sourceOffset = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let index = sourceOffset;
  let inQuotes = false;
  let atFieldStart = true;
  let fieldCount = 1;
  let rowHasValue = false;
  let rowTouched = false;
  let parserErrorCount = 0;
  let quotedFieldIndex = 0;
  let completedRows = 0;

  const addParserError = (
    code: DelimitedParserError['code'],
    message: string,
  ): void => {
    parserErrorCount++;
    if (parserErrorCount > maxParserErrors) {
      throw tableLimit('The table contains too many parser errors.');
    }
    if (collectParserErrors) {
      parserErrors.push({
        type: 'Quotes',
        code,
        message,
        row: completedRows,
        index: quotedFieldIndex,
      });
    }
  };

  const finishRow = (): boolean => {
    completedRows++;
    if (fieldCount > 1 || rowHasValue) {
      const row = { fieldCount };
      if (!onRow) rows.push(row);
      onRow?.(row);
    }
    fieldCount = 1;
    rowHasValue = false;
    rowTouched = false;
    atFieldStart = true;
    return completedRows >= maxRows;
  };

  while (index < text.length) {
    if (inQuotes) {
      if (text[index] !== '"') {
        rowHasValue = true;
        index++;
        continue;
      }

      if (text[index + 1] === '"') {
        rowHasValue = true;
        index += 2;
        continue;
      }

      let afterQuote = index + 1;
      while (
        afterQuote < text.length
        && !text.startsWith(delimiter, afterQuote)
        && newlineAt(text, afterQuote, newline) === null
        && isIgnorablePostQuoteWhitespace(text[afterQuote]!)
      ) {
        afterQuote++;
      }
      if (
        (afterQuote === text.length && afterQuote === index + 1)
        || text.startsWith(delimiter, afterQuote)
        || newlineAt(text, afterQuote, newline) !== null
      ) {
        inQuotes = false;
        atFieldStart = false;
        index = afterQuote;
        continue;
      }

      // PapaParse treats a quote that is neither escaped nor followed by the field/row boundary
      // as a recoverable InvalidQuotes diagnostic and keeps looking for a valid closing quote.
      addParserError('InvalidQuotes', 'Trailing quote on quoted field is malformed');
      rowHasValue = true;
      index++;
      continue;
    }

    if (atFieldStart && text[index] === '"') {
      inQuotes = true;
      quotedFieldIndex = index + 1 - sourceOffset;
      rowTouched = true;
      index++;
      continue;
    }

    if (text.startsWith(delimiter, index)) {
      fieldCount++;
      rowTouched = true;
      atFieldStart = true;
      index += delimiter.length;
      continue;
    }

    const matchedNewline = newlineAt(text, index, newline);
    if (matchedNewline !== null) {
      index += matchedNewline.length;
      if (finishRow()) break;
      continue;
    }

    rowHasValue = true;
    rowTouched = true;
    atFieldStart = false;
    index++;
  }

  if (index >= text.length) {
    if (inQuotes) addParserError('MissingQuotes', 'Quoted field unterminated');
    if (rowTouched || fieldCount > 1 || rowHasValue) finishRow();
  }

  return { rows, parserErrorCount, parserErrors };
}

function delimiterScore(rows: readonly StructuralRow[]): { delta: number; average: number } | null {
  if (!rows.length) return null;
  let delta = 0;
  let total = 0;
  let previous: number | undefined;
  for (const row of rows) {
    total += row.fieldCount;
    if (previous !== undefined) delta += Math.abs(row.fieldCount - previous);
    previous = row.fieldCount;
  }
  const average = total / rows.length;
  return average >= 2 ? { delta, average } : null;
}

/** PapaParse examines at most the first MiB, removes non-greedy pairs of quoted text, then compares
 * the first CR/LF and the proportion of CR-separated segments beginning with LF. This equivalent
 * single pass avoids the peer's substring/replace/split allocations. */
function detectedNewline(text: string): DelimitedNewline {
  // PapaParse strips one leading BOM before taking its sample, so the full post-BOM MiB remains
  // observable when the first line ending sits exactly at that boundary.
  const sourceOffset = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const limit = Math.min(text.length, sourceOffset + 1024 * 1024);
  let index = sourceOffset;
  let outputIndex = 0;
  let carriageReturns = 0;
  let lineFeeds = 0;
  let crSegmentsBeginningWithLf = 0;
  let firstCarriageReturn = Number.POSITIVE_INFINITY;
  let firstLineFeed = Number.POSITIVE_INFINITY;
  let previousOutputWasCr = false;

  while (index < limit) {
    if (text[index] === '"') {
      const closingQuote = text.indexOf('"', index + 1);
      if (closingQuote !== -1 && closingQuote < limit) {
        index = closingQuote + 1;
        continue;
      }
    }

    const value = text[index]!;
    if (value === '\r') {
      if (firstCarriageReturn === Number.POSITIVE_INFINITY) firstCarriageReturn = outputIndex;
      carriageReturns++;
    } else if (value === '\n') {
      if (firstLineFeed === Number.POSITIVE_INFINITY) firstLineFeed = outputIndex;
      lineFeeds++;
      if (outputIndex === 0 || previousOutputWasCr) crSegmentsBeginningWithLf++;
    }
    previousOutputWasCr = value === '\r';
    outputIndex++;
    index++;
  }

  if (carriageReturns === 0 || (lineFeeds > 0 && firstLineFeed < firstCarriageReturn)) return '\n';
  return crSegmentsBeginningWithLf >= (carriageReturns + 1) / 2 ? '\r\n' : '\r';
}

function detectDialect(text: string): DelimitedDialect {
  const newline = detectedNewline(text);
  let bestDelimiter: string | undefined;
  let bestDelta = Number.POSITIVE_INFINITY;
  let bestAverage = 0;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const scan = scanDelimitedStructure(text, delimiter, newline, DELIMITER_SAMPLE_ROWS);
    const score = delimiterScore(scan.rows);
    if (
      score
      && (score.delta < bestDelta || (score.delta === bestDelta && score.average > bestAverage))
    ) {
      bestDelimiter = delimiter;
      bestDelta = score.delta;
      bestAverage = score.average;
    }
  }

  const delimiterDetected = bestDelimiter !== undefined;
  const delimiter = bestDelimiter ?? ',';
  return { delimiter, delimiterDetected, newline };
}

function undetectableDelimiterError(): unknown {
  return {
    type: 'Delimiter',
    code: 'UndetectableDelimiter',
    message: "Unable to auto-detect delimiting character; defaulted to ','",
  };
}

function tableLimit(message: string): LyraResourceLimitError {
  return new LyraResourceLimitError(message);
}

function preflightDelimitedText(
  text: string,
  dialect: DelimitedDialect,
  header: boolean,
  limits: EffectiveDelimitedParseLimits,
): DelimitedPreflight {
  let sawHeader = false;
  let headerColumns = 0;
  let dataRowCount = 0;
  let totalCells = 0;
  let parserErrorCount = dialect.delimiterDetected ? 0 : 1;

  const scan = scanDelimitedStructure(
    text,
    dialect.delimiter,
    dialect.newline,
    Number.POSITIVE_INFINITY,
    (row) => {
      if (row.fieldCount > limits.maxColumns) {
        throw tableLimit('The table contains too many columns.');
      }
      totalCells += row.fieldCount;
      if (totalCells > limits.maxCells) {
        throw tableLimit('The table contains too many cells.');
      }

      if (header && !sawHeader) {
        sawHeader = true;
        headerColumns = row.fieldCount;
      } else {
        dataRowCount++;
        if (dataRowCount > limits.maxRows) {
          throw tableLimit('The table contains too many rows.');
        }
        if (header && row.fieldCount !== headerColumns) parserErrorCount++;
      }
      if (parserErrorCount > limits.maxErrors) {
        throw tableLimit('The table contains too many parser errors.');
      }
    },
    limits.maxErrors,
    true,
  );

  parserErrorCount += scan.parserErrorCount;
  if (parserErrorCount > limits.maxErrors) {
    throw tableLimit('The table contains too many parser errors.');
  }

  return { dataRowCount, quoteErrors: scan.parserErrors };
}

function isQuoteDiagnostic(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const diagnostic = value as { type?: unknown; code?: unknown };
  return diagnostic.type === 'Quotes'
    && (diagnostic.code === 'InvalidQuotes' || diagnostic.code === 'MissingQuotes');
}

function recordFieldCount(row: Record<string, string>): number {
  const extra = (row as Record<string, unknown>)['__parsed_extra'];
  return Object.keys(row).filter((key) => key !== '__parsed_extra').length
    + (Array.isArray(extra) ? extra.length : 0);
}

function boundedParse<T>(
  parser: PapaParseApi,
  text: string,
  header: boolean,
  limitsInput: DelimitedParseLimits,
  isRow: (value: unknown) => value is T,
  rowFieldCount: (row: T) => number,
): { rows: T[]; fields: string[]; errors: unknown[] } {
  const limits = effectiveLimits(limitsInput);
  const dialect = detectDialect(text);
  const preflight = preflightDelimitedText(text, dialect, header, limits);
  const rows: T[] = [];
  const fields: string[] = [];
  const errors: unknown[] = [...preflight.quoteErrors];
  if (!dialect.delimiterDetected) errors.push(undetectableDelimiterError());
  let remainingQuoteDuplicates = preflight.quoteErrors.length;
  let parsedRows = 0;
  let totalCells = 0;
  let limitError: LyraResourceLimitError | undefined;

  const setFields = (candidate: unknown): void => {
    if (!Array.isArray(candidate)) return;
    const normalized = candidate.filter((field): field is string => typeof field === 'string');
    if (normalized.length !== candidate.length) throw new TypeError('PapaParse returned invalid fields.');
    if (normalized.length > limits.maxColumns) {
      limitError = tableLimit('The table contains too many columns.');
      return;
    }
    if (!fields.length && normalized.length) {
      fields.push(...normalized);
      totalCells += normalized.length;
      if (totalCells > limits.maxCells) {
        limitError = tableLimit('The table contains too many cells.');
      }
    }
  };

  const appendErrors = (candidate: unknown): void => {
    if (!Array.isArray(candidate) || !candidate.length || limitError) return;
    const retained: unknown[] = [];
    for (const diagnostic of candidate) {
      if (remainingQuoteDuplicates > 0 && isQuoteDiagnostic(diagnostic)) {
        remainingQuoteDuplicates--;
      } else {
        retained.push(diagnostic);
      }
    }
    if (errors.length + retained.length > limits.maxErrors) {
      limitError = tableLimit('The table contains too many parser errors.');
      return;
    }
    errors.push(...retained);
  };

  const abort = (handle: PapaParserHandle): void => {
    try {
      handle.abort();
    } catch {
      // The resource-limit outcome stays authoritative if a malformed peer rejects abort too.
    }
  };

  let returned: unknown;
  try {
    returned = parser.parse(text, {
      delimiter: dialect.delimiter,
      newline: dialect.newline,
      header,
      skipEmptyLines: true,
      // PapaParse's automatic fast path splits the complete string before invoking `step`; force
      // the incremental grammar so the callback can actually stop parser work at the budget.
      fastMode: false,
      step: (rawResult: unknown, handle: PapaParserHandle): void => {
        const result = rawResult as PapaStepResult<T>;
        if (header) setFields(result.meta?.fields);
        appendErrors(result.errors);
        if (limitError) {
          abort(handle);
          return;
        }
        if (!isRow(result.data)) throw new TypeError('PapaParse returned an invalid row.');

        const columnCount = rowFieldCount(result.data);
        parsedRows++;
        totalCells += columnCount;
        if (parsedRows > limits.maxRows) {
          limitError = tableLimit('The table contains too many rows.');
        } else if (columnCount > limits.maxColumns) {
          limitError = tableLimit('The table contains too many columns.');
        } else if (totalCells > limits.maxCells) {
          limitError = tableLimit('The table contains too many cells.');
        }
        if (limitError) {
          abort(handle);
          return;
        }
        rows.push(result.data);
      },
    });
  } catch (error) {
    if (limitError) throw limitError;
    throw error;
  }
  if (limitError) throw limitError;

  const returnedResult = returned as PapaReturnedResult<T> | undefined;
  if (header) setFields(returnedResult?.meta?.fields);
  appendErrors(returnedResult?.errors);
  if (limitError) throw limitError;

  // A conforming PapaParse streaming call invokes `step` once per retained data row. Refuse a
  // parse-shaped peer that silently ignores the callback instead of accepting its materialized
  // array and defeating the resource boundary.
  if (preflight.dataRowCount > 0 && parsedRows === 0) {
    throw new TypeError('PapaParse did not honor streaming row callbacks.');
  }

  return { rows, fields, errors };
}

/** Parses raw delimited rows with row, column, aggregate-cell, and diagnostic budgets enforced
 * before materialization and again from PapaParse's streaming callback. */
export function parseDelimitedGrid(
  parser: PapaParseApi,
  text: string,
  limits: DelimitedParseLimits = {},
): DelimitedGridResult {
  const result = boundedParse<unknown[]>(
    parser,
    text,
    false,
    limits,
    Array.isArray,
    (row) => row.length,
  );
  return { data: result.rows, errors: result.errors };
}

/** Parses header-keyed records with row, field, aggregate-cell, and diagnostic budgets enforced
 * before materialization and again from PapaParse's streaming callback. */
export function parseDelimitedRecords(
  parser: PapaParseApi,
  text: string,
  limits: DelimitedParseLimits = {},
): DelimitedRecordResult {
  const result = boundedParse<Record<string, string>>(
    parser,
    text,
    true,
    limits,
    (row): row is Record<string, string> => typeof row === 'object' && row !== null && !Array.isArray(row),
    recordFieldCount,
  );
  return { fields: result.fields, rows: result.rows, errors: result.errors };
}

export function delimitedColumnCount(rows: readonly unknown[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

export function delimitedCellText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}
