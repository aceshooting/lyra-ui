import type { PapaParseApi } from './papaparse-loader.js';

export interface DelimitedGridResult {
  data: unknown[][];
  errors: unknown[];
}

export interface DelimitedRecordResult {
  fields: string[];
  rows: Record<string, string>[];
  errors: unknown[];
}

/** Shared PapaParse configuration for raw grid viewers. */
export function parseDelimitedGrid(parser: PapaParseApi, text: string): DelimitedGridResult {
  const result = parser.parse(text, { skipEmptyLines: true }) as {
    data?: unknown[][];
    errors?: unknown[];
  };
  return {
    data: Array.isArray(result.data) ? result.data : [],
    errors: Array.isArray(result.errors) ? result.errors : [],
  };
}

/** Shared PapaParse configuration for header-keyed dataset viewers. */
export function parseDelimitedRecords(parser: PapaParseApi, text: string): DelimitedRecordResult {
  const result = parser.parse(text, { delimiter: '', header: true, skipEmptyLines: true }) as {
    data?: Record<string, string>[];
    meta?: { fields?: string[] };
    errors?: unknown[];
  };
  return {
    fields: Array.isArray(result.meta?.fields) ? result.meta.fields : [],
    rows: Array.isArray(result.data) ? result.data : [],
    errors: Array.isArray(result.errors) ? result.errors : [],
  };
}

export function delimitedColumnCount(rows: readonly unknown[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

export function delimitedCellText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

