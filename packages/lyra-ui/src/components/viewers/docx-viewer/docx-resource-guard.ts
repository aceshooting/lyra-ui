import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
} from '../archive-viewer/zip-resource-guard.js';

export const DEFAULT_MAX_DOCX_ENTRIES = 10_000;
export const DEFAULT_MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MAX_DOCX_XML_NODES = 250_000;

export interface DocxResourceGuardOptions {
  signal?: AbortSignal;
  maxXmlNodes?: number;
}

/** Checks ZIP expansion and XML-node complexity before Mammoth expands a DOCX archive. */
export function assertDocxArchiveWithinLimits(
  source: ArrayBuffer,
  maxEntries = DEFAULT_MAX_DOCX_ENTRIES,
  maxUncompressedBytes = DEFAULT_MAX_DOCX_UNCOMPRESSED_BYTES,
  options: DocxResourceGuardOptions = {},
): Promise<void> {
  return assertZipArchiveWithinLimits(source, {
    description: 'DOCX',
    maxEntries,
    maxUncompressedBytes,
    signal: options.signal,
    createInspector: createXmlComplexityInspectorFactory({
      includeEntry: (name) => /\.(?:xml|rels)$/i.test(name),
      maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_DOCX_XML_NODES,
    }),
  });
}
