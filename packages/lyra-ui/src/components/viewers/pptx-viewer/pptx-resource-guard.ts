import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
} from '../archive-viewer/zip-resource-guard.js';

const DEFAULT_MAX_PPTX_ENTRIES = 4_000;
const DEFAULT_MAX_PPTX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_PPTX_XML_NODES = 1_000_000;

export interface PptxResourceGuardOptions {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  maxXmlNodes?: number;
  signal?: AbortSignal;
}

/** Checks ZIP entry count, measured expansion and XML-node complexity before the PPTX renderer opens an archive. */
export function assertPptxArchiveWithinLimits(
  source: ArrayBuffer,
  options: PptxResourceGuardOptions = {},
): Promise<void> {
  return assertZipArchiveWithinLimits(source, {
    description: 'PPTX',
    maxEntries: options.maxEntries ?? DEFAULT_MAX_PPTX_ENTRIES,
    maxUncompressedBytes: options.maxUncompressedBytes ?? DEFAULT_MAX_PPTX_UNCOMPRESSED_BYTES,
    signal: options.signal,
    createInspector: createXmlComplexityInspectorFactory({
      includeEntry: (name) => /\.(?:xml|rels)$/i.test(name),
      maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_PPTX_XML_NODES,
    }),
  });
}
