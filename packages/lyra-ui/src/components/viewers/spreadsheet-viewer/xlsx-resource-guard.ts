import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
} from '../archive-viewer/zip-resource-guard.js';

export const DEFAULT_MAX_XLSX_ENTRIES = 10_000;
export const DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MAX_XLSX_XML_NODES = 1_000_000;
export const DEFAULT_MAX_XLSX_ROWS = 10_000;
export const DEFAULT_MAX_XLSX_CELLS = 1_000_000;

export interface XlsxResourceGuardOptions {
  signal?: AbortSignal;
  maxXmlNodes?: number;
  maxRows?: number;
  maxCells?: number;
}

/**
 * Checks ZIP expansion plus worksheet row/cell and XML-node complexity before SheetJS expands an
 * XLSX archive. Legacy binary XLS input is not ZIP-based and passes through to the parser.
 */
export function assertXlsxArchiveWithinLimits(
  source: ArrayBuffer,
  maxEntries = DEFAULT_MAX_XLSX_ENTRIES,
  maxUncompressedBytes = DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES,
  options: XlsxResourceGuardOptions = {},
): Promise<void> {
  return assertZipArchiveWithinLimits(source, {
    description: 'spreadsheet',
    maxEntries,
    maxUncompressedBytes,
    allowNonZip: true,
    signal: options.signal,
    createInspector: createXmlComplexityInspectorFactory({
      includeEntry: (name) => /\.xml$/i.test(name),
      maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_XLSX_XML_NODES,
      maxRows: options.maxRows ?? DEFAULT_MAX_XLSX_ROWS,
      maxCells: options.maxCells ?? DEFAULT_MAX_XLSX_CELLS,
    }),
  });
}
