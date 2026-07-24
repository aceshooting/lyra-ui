import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
} from '../archive-viewer/zip-resource-guard.js';

export const DEFAULT_MAX_EPUB_ENTRIES = 10_000;
export const DEFAULT_MAX_EPUB_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MAX_EPUB_XML_NODES = 250_000;

export interface EpubResourceGuardOptions {
  signal?: AbortSignal;
  maxXmlNodes?: number;
}

/** Checks ZIP expansion and document-node complexity before epub.js expands an EPUB archive. */
export function assertEpubArchiveWithinLimits(
  source: ArrayBuffer,
  maxEntries = DEFAULT_MAX_EPUB_ENTRIES,
  maxUncompressedBytes = DEFAULT_MAX_EPUB_UNCOMPRESSED_BYTES,
  options: EpubResourceGuardOptions = {},
): Promise<void> {
  return assertZipArchiveWithinLimits(source, {
    description: 'EPUB',
    maxEntries,
    maxUncompressedBytes,
    signal: options.signal,
    createInspector: createXmlComplexityInspectorFactory({
      includeEntry: (name) => /\.(?:xhtml?|html?|xml|opf|ncx|rels)$/i.test(name),
      maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_EPUB_XML_NODES,
    }),
  });
}
