import { assertZipArchiveWithinLimits } from '../archive-viewer/zip-resource-guard.js';

export const DEFAULT_MAX_PPTX_ENTRIES = 4_000;
export const DEFAULT_MAX_PPTX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;

export interface PptxResourceGuardOptions {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  signal?: AbortSignal;
}

/** Checks ZIP entry count and measured expansion before the PPTX renderer opens an archive. */
export function assertPptxArchiveWithinLimits(
  source: ArrayBuffer,
  options: PptxResourceGuardOptions = {},
): Promise<void> {
  return assertZipArchiveWithinLimits(source, {
    description: 'PPTX',
    maxEntries: options.maxEntries ?? DEFAULT_MAX_PPTX_ENTRIES,
    maxUncompressedBytes: options.maxUncompressedBytes ?? DEFAULT_MAX_PPTX_UNCOMPRESSED_BYTES,
    signal: options.signal,
  });
}
