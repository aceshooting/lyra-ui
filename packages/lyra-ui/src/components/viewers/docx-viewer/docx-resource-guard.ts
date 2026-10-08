import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import { DOCX_ZIP_LIMITS, DocxZipAdmissionError, inspectDocxZip } from '../../../internal/docx-zip-admission.js';
import { assertOoxmlPartsWithinLimits, OFFICE_RELATIONSHIP } from '../document-viewer/ooxml-part-guard.js';

const DEFAULT_MAX_DOCX_ENTRIES = DOCX_ZIP_LIMITS.entries;
const DEFAULT_MAX_DOCX_UNCOMPRESSED_BYTES = DOCX_ZIP_LIMITS.expanded;
const DEFAULT_MAX_DOCX_XML_NODES = DOCX_ZIP_LIMITS.nodes;
const DOCX_XML_PART_NAME = /\.(?:xml|rels)$/i;
/** Relationship types whose targets Mammoth parses as XML, whatever the target part is named. */
const MAMMOTH_XML_PART_TYPES = new Set(
  ['officeDocument', 'styles', 'numbering', 'footnotes', 'endnotes', 'comments']
    .map((kind) => OFFICE_RELATIONSHIP + kind),
);

export interface DocxResourceGuardOptions {
  signal?: AbortSignal;
  maxXmlNodes?: number;
  strictAdmission?: boolean;
}

export function createDocxXmlDepthInspector(maxDepth: number): { write(chunk: Uint8Array): void; close(): void } {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let depth = 0;
  let state: 'text' | 'open' | 'tag' | 'close' | 'bang' | 'comment' | 'cdata' | 'pi' = 'text';
  let bang = '';
  let tail = '';
  let quote = '';
  let lastNonSpace = '';
  let tagName = '';
  let readingTagName = false;
  let closeName = '';
  let closeNameEnded = false;
  const names: string[] = [];
  const invalid = (): never => { throw new LyraResourceLimitError('The DOCX archive contains invalid XML.'); };
  const consume = (text: string): void => {
    for (const char of text) {
      if (state === 'text') {
        if (char === '<') state = 'open';
        continue;
      }
      if (state === 'open') {
        if (char === '!') { state = 'bang'; bang = ''; }
        else if (char === '?') { state = 'pi'; tail = ''; }
        else if (char === '/') { state = 'close'; closeName = ''; closeNameEnded = false; }
        else if (/^[\p{L}_:]$/u.test(char)) {
          if (++depth > maxDepth) throw new LyraResourceLimitError('The DOCX archive contains overly deep XML.');
          state = 'tag';
          quote = '';
          lastNonSpace = char;
          tagName = char;
          readingTagName = true;
        } else invalid();
        continue;
      }
      if (state === 'bang') {
        bang += char;
        if ('--'.startsWith(bang) && bang === '--') { state = 'comment'; tail = ''; }
        else if ('[CDATA['.startsWith(bang) && bang === '[CDATA[') { state = 'cdata'; tail = ''; }
        else if (!'--'.startsWith(bang) && !'[CDATA['.startsWith(bang)) invalid();
        continue;
      }
      if (state === 'comment' || state === 'cdata' || state === 'pi') {
        tail = (tail + char).slice(-3);
        if ((state === 'comment' && tail === '-->') || (state === 'cdata' && tail === ']]>') || (state === 'pi' && tail.endsWith('?>'))) {
          state = 'text';
          tail = '';
        }
        continue;
      }
      if (state === 'close') {
        if (char === '>') {
          if (!closeName || names.pop() !== closeName) invalid();
          depth--;
          state = 'text';
        } else if (!closeNameEnded && /^[\p{L}\p{N}\p{M}_.:-]$/u.test(char)) closeName += char;
        else if (/\s/u.test(char) && closeName) closeNameEnded = true;
        else invalid();
        continue;
      }
      if (readingTagName) {
        if (/^[\p{L}\p{N}\p{M}_.:-]$/u.test(char)) {
          tagName += char;
          lastNonSpace = char;
          continue;
        }
        names.push(tagName);
        readingTagName = false;
      }
      if (quote) { if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'") quote = char;
      else if (char === '>') {
        if (lastNonSpace === '/') { names.pop(); depth--; }
        state = 'text';
      } else if (char === '<') invalid();
      else if (!/\s/u.test(char)) lastNonSpace = char;
    }
  };
  return {
    write(chunk) {
      try { consume(decoder.decode(chunk, { stream: true })); }
      catch (error) { if (error instanceof LyraResourceLimitError) throw error; invalid(); }
    },
    close() {
      try { consume(decoder.decode()); }
      catch (error) { if (error instanceof LyraResourceLimitError) throw error; invalid(); }
      if (state !== 'text' || depth !== 0 || names.length !== 0) invalid();
    },
  };
}

/**
 * Checks ZIP expansion and XML-node complexity before Mammoth expands a DOCX archive, including
 * parts Mammoth reaches through relationships under any name.
 */
export async function assertDocxArchiveWithinLimits(
  source: ArrayBuffer,
  maxEntries: number = DEFAULT_MAX_DOCX_ENTRIES,
  maxUncompressedBytes: number = DEFAULT_MAX_DOCX_UNCOMPRESSED_BYTES,
  options: DocxResourceGuardOptions = {},
): Promise<void> {
  if (options.strictAdmission) {
    try {
      inspectDocxZip(new Uint8Array(source), options.signal);
    } catch (error) {
      if (error instanceof DocxZipAdmissionError && error.code === 'aborted') {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      throw new LyraResourceLimitError('The DOCX archive is malformed or exceeds its resource limits.');
    }
  }
  await assertOoxmlPartsWithinLimits(source, {
    guardOptions: {
      description: 'DOCX',
      maxEntries,
      maxUncompressedBytes,
      maxEntryBytes: options.strictAdmission ? DOCX_ZIP_LIMITS.entry : undefined,
      verifyCrc: options.strictAdmission,
      signal: options.signal,
    },
    partName: DOCX_XML_PART_NAME,
    isPartType: (type) => MAMMOTH_XML_PART_TYPES.has(type),
    maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_DOCX_XML_NODES,
    extend: options.strictAdmission
      ? (counter) => {
          const depth = createDocxXmlDepthInspector(DOCX_ZIP_LIMITS.depth);
          return {
            write(chunk: Uint8Array) { counter.write(chunk); depth.write(chunk); },
            close() { counter.close(); depth.close(); },
          };
        }
      : undefined,
  });
}
