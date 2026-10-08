import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
  zipEntryLookupNames,
  type ZipEntryInspector,
} from '../archive-viewer/zip-resource-guard.js';

const DEFAULT_MAX_EPUB_ENTRIES = 10_000;
const DEFAULT_MAX_EPUB_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_EPUB_XML_NODES = 250_000;
const MAX_EPUB_PACKAGE_BYTES = 8 * 1024 * 1024;
const EPUB_XML_PART_NAME = /\.(?:xhtml?|html?|xml|opf|ncx|rels)$/i;
const EPUB_XML_MEDIA_TYPE = /(?:xml|html)$/i;

function joinEntryPath(base: string, target: string): string {
  const parts = (target.startsWith('/') ? target.slice(1) : `${base}${target}`).split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.' && part !== '') resolved.push(part);
  }
  return resolved.join('/');
}

function decodeTarget(href: string): string[] {
  const path = href.split(/[#?]/, 1)[0] ?? '';
  try { return [...new Set([path, decodeURIComponent(path)])]; } catch { return [path]; }
}

export interface EpubResourceGuardOptions {
  signal?: AbortSignal;
  maxXmlNodes?: number;
}

/** Checks ZIP expansion and document-node complexity before epub.js expands an EPUB archive,
 *  including package and content documents the container and manifest name under any extension. */
export async function assertEpubArchiveWithinLimits(
  source: ArrayBuffer,
  maxEntries = DEFAULT_MAX_EPUB_ENTRIES,
  maxUncompressedBytes = DEFAULT_MAX_EPUB_UNCOMPRESSED_BYTES,
  options: EpubResourceGuardOptions = {},
): Promise<void> {
  let countEveryEntry = false;
  const countNodes = createXmlComplexityInspectorFactory({
    includeEntry: (name) => countEveryEntry || EPUB_XML_PART_NAME.test(name),
    maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_EPUB_XML_NODES,
  });
  const guardOptions = {
    description: 'EPUB',
    maxEntries,
    maxUncompressedBytes,
    signal: options.signal,
  };
  const skipped = new Set<string>();
  const captured = new Map<string, Uint8Array[]>();
  let capturedBytes = 0;
  const capture = (name: string, inspector: ZipEntryInspector | undefined): ZipEntryInspector => {
    const chunks: Uint8Array[] = [];
    captured.set(name, chunks);
    return {
      write(chunk) {
        inspector?.write(chunk);
        capturedBytes += chunk.byteLength;
        if (capturedBytes > MAX_EPUB_PACKAGE_BYTES) throw new LyraResourceLimitError('The EPUB package metadata is too large.');
        chunks.push(chunk);
      },
      close: () => inspector?.close(),
    };
  };
  const parse = (name: string): Document | null => {
    const decoder = new TextDecoder();
    const chunks = captured.get(name) ?? [];
    const text = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
    const document = new DOMParser().parseFromString(text, 'application/xml');
    return document.getElementsByTagName('parsererror').length > 0 ? null : document;
  };
  const isContainer = (entryName: string): boolean => zipEntryLookupNames(entryName)
    .some((name) => name.toLowerCase() === 'meta-inf/container.xml');

  await assertZipArchiveWithinLimits(source, {
    ...guardOptions,
    createInspector: (entry) => {
      const counter = countNodes(entry);
      if (!counter) skipped.add(entry.name);
      return isContainer(entry.name) ? capture(entry.name, counter) : counter;
    },
  });

  const packages = new Set<string>();
  for (const name of captured.keys()) {
    for (const rootfile of parse(name)?.getElementsByTagNameNS('*', 'rootfile') ?? []) {
      for (const path of decodeTarget(rootfile.getAttribute('full-path') ?? '')) packages.add(joinEntryPath('', path));
    }
  }
  const named = (entryName: string, wanted: Set<string>): boolean => zipEntryLookupNames(entryName)
    .some((name) => wanted.has(joinEntryPath('', name)));
  if (packages.size === 0) return;

  // Package documents under any name: count the uncounted and read every one for its manifest.
  countEveryEntry = true;
  captured.clear();
  capturedBytes = 0;
  const uncountedPackages = new Set([...skipped].filter((name) => named(name, packages)));
  await assertZipArchiveWithinLimits(source, {
    ...guardOptions,
    createInspector: (entry) => {
      if (!named(entry.name, packages)) return undefined;
      return capture(entry.name, uncountedPackages.has(entry.name) ? countNodes(entry) : undefined);
    },
  });

  const targets = new Set<string>();
  for (const name of captured.keys()) {
    const base = [...zipEntryLookupNames(name)].find((lookup) => packages.has(joinEntryPath('', lookup))) ?? name;
    const directory = base.includes('/') ? `${base.slice(0, base.lastIndexOf('/'))}/` : '';
    for (const item of parse(name)?.getElementsByTagNameNS('*', 'item') ?? []) {
      if (!EPUB_XML_MEDIA_TYPE.test((item.getAttribute('media-type') ?? '').trim())) continue;
      for (const path of decodeTarget(item.getAttribute('href') ?? '')) targets.add(joinEntryPath(directory, path));
    }
  }
  const uncounted = new Set([...skipped].filter((name) => named(name, targets) && !uncountedPackages.has(name)));
  if (uncounted.size === 0) return;
  await assertZipArchiveWithinLimits(source, {
    ...guardOptions,
    createInspector: (entry) => (uncounted.has(entry.name) ? countNodes(entry) : undefined),
  });
}
