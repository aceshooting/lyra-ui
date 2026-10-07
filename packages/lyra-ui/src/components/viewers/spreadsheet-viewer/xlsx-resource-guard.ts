import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
} from '../archive-viewer/zip-resource-guard.js';

const DEFAULT_MAX_XLSX_ENTRIES = 10_000;
const DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_XLSX_XML_NODES = 1_000_000;
const DEFAULT_MAX_XLSX_ROWS = 10_000;
const DEFAULT_MAX_XLSX_CELLS = 1_000_000;
/** The smallest binary (XLSB) record SheetJS stores as a cell. */
const MIN_BINARY_CELL_BYTES = 7;
/** Parts that make SheetJS read the archive as OpenDocument, Numbers or a nested workbook. */
const FOREIGN_PACKAGE_PART = /^(?:meta-inf\/manifest\.xml|objectdata\.xml|index\/document\.iwa|(?:.*\/)?index\.zip)$/;

export interface XlsxResourceGuardOptions {
  signal?: AbortSignal;
  maxXmlNodes?: number;
  maxRows?: number;
  maxCells?: number;
}

/**
 * Checks ZIP expansion plus worksheet row/cell and XML-node complexity before SheetJS expands an
 * XLSX archive. Every part is measured, because SheetJS parses parts by reference whatever their
 * name; `.bin` parts are bounded by size and OpenDocument or Numbers packages are refused. Legacy
 * binary XLS input is not ZIP-based and passes through to the parser.
 */
export function assertXlsxArchiveWithinLimits(
  source: ArrayBuffer,
  maxEntries = DEFAULT_MAX_XLSX_ENTRIES,
  maxUncompressedBytes = DEFAULT_MAX_XLSX_UNCOMPRESSED_BYTES,
  options: XlsxResourceGuardOptions = {},
): Promise<void> {
  const maxCells = options.maxCells ?? DEFAULT_MAX_XLSX_CELLS;
  const inspectXml = createXmlComplexityInspectorFactory({
    includeEntry: () => true,
    maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_XLSX_XML_NODES,
    maxRows: options.maxRows ?? DEFAULT_MAX_XLSX_ROWS,
    maxCells,
  });
  let binaryBytes = 0;
  return assertZipArchiveWithinLimits(source, {
    description: 'spreadsheet',
    maxEntries,
    maxUncompressedBytes,
    allowNonZip: true,
    signal: options.signal,
    createInspector: (entry) => {
      const name = entry.name.toLowerCase().replace(/[\\/]+/g, '/').replace(/^\//, '');
      if (FOREIGN_PACKAGE_PART.test(name)) {
        throw new LyraResourceLimitError('The spreadsheet archive is not a supported workbook.');
      }
      const xml = inspectXml(entry)!;
      if (!name.endsWith('.bin')) return xml;
      return {
        write(chunk) {
          binaryBytes += chunk.byteLength;
          if (binaryBytes > maxCells * MIN_BINARY_CELL_BYTES) {
            throw new LyraResourceLimitError('The spreadsheet archive contains too many binary records.');
          }
          xml.write(chunk);
        },
        close: () => xml.close(),
      };
    },
  });
}
