import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import { DOCX_ZIP_LIMITS, DocxZipAdmissionError, inspectDocxZip } from '../../../internal/docx-zip-admission.js';
import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
  zipEntryLookupNames,
} from '../archive-viewer/zip-resource-guard.js';

const DEFAULT_MAX_DOCX_ENTRIES = DOCX_ZIP_LIMITS.entries;
const DEFAULT_MAX_DOCX_UNCOMPRESSED_BYTES = DOCX_ZIP_LIMITS.expanded;
const DEFAULT_MAX_DOCX_XML_NODES = DOCX_ZIP_LIMITS.nodes;
const MAX_DOCX_RELATIONSHIP_BYTES = 8 * 1024 * 1024;
const DOCX_XML_PART_NAME = /\.(?:xml|rels)$/i;
const RELATIONSHIP_PART_NAME = /^(?:(.*)\/)?_rels\/[^/]*\.rels$/i;
const OFFICE_RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
/** Relationship types whose targets Mammoth parses as XML, whatever the target part is named. */
const MAMMOTH_XML_PART_TYPES = new Set(
  ['officeDocument', 'styles', 'numbering', 'footnotes', 'endnotes', 'comments']
    .map((kind) => OFFICE_RELATIONSHIP + kind),
);
const XML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', apos: '\'', gt: '>', lt: '<', quot: '"' };

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

function isXmlSpace(character: string | undefined): boolean {
  return character !== undefined && (character <= ' ' || character === '\u0080');
}

/** Attribute-value normalisation as Mammoth's XML parser applies it. */
function decodeAttributeValue(value: string): string {
  return value.replace(/[\t\n\r]/g, ' ').replace(/&#?\w+;/g, (reference) => {
    const name = reference.slice(1, -1);
    if (Object.hasOwn(XML_ENTITIES, name)) return XML_ENTITIES[name]!;
    if (!name.startsWith('#')) return reference;
    const code = parseInt(name.slice(1).replace('x', '0x'));
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : reference;
  });
}

function isTagDelimiter(character: string | undefined): boolean {
  return character === undefined || isXmlSpace(character) || '<>/="\''.includes(character);
}

/** Targets of `Relationship` elements whose `Type` Mammoth parses; a linear scan looser than Mammoth's. */
function mammothPartTargets(text: string): string[] {
  const targets: string[] = [];
  for (let start = text.indexOf('<'); start >= 0; start = text.indexOf('<', start + 1)) {
    let index = start + 1;
    while (!isTagDelimiter(text[index])) index++;
    const name = text.slice(start + 1, index);
    if (name.slice(name.lastIndexOf(':') + 1) !== 'Relationship') continue;
    let partType = false;
    const values: string[] = [];
    while (index < text.length && text[index] !== '>' && text[index] !== '<') {
      if (isXmlSpace(text[index]) || text[index] === '/') {
        index++;
        continue;
      }
      const attributeStart = index;
      while (!isTagDelimiter(text[index])) index++;
      const attribute = text.slice(attributeStart, index);
      while (isXmlSpace(text[index])) index++;
      if (text[index] === '=') {
        index++;
        while (isXmlSpace(text[index])) index++;
      }
      const quote = text[index];
      let value = '';
      if (quote === '"' || quote === '\'') {
        const end = text.indexOf(quote, index + 1);
        if (end < 0) break;
        value = text.slice(index + 1, end);
        index = end + 1;
      } else if (!isTagDelimiter(quote)) {
        const valueStart = index;
        while (!isTagDelimiter(text[index])) index++;
        value = text.slice(valueStart, index);
      } else if (attribute === '') {
        break;
      }
      if (attribute === 'Type' && MAMMOTH_XML_PART_TYPES.has(decodeAttributeValue(value))) partType = true;
      if (attribute === 'Target') values.push(decodeAttributeValue(value));
    }
    if (partType) targets.push(...values);
  }
  return targets;
}

/** Mammoth's own path join: an absolute target replaces the base, and one leading slash is dropped. */
function joinPartPath(base: string, target: string): string {
  const joined = target.startsWith('/') ? target : [base, target].filter(Boolean).join('/');
  return joined.startsWith('/') ? joined.slice(1) : joined;
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
  let countEveryEntry = false;
  const countNodes = createXmlComplexityInspectorFactory({
    includeEntry: (name) => countEveryEntry || DOCX_XML_PART_NAME.test(name),
    maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_DOCX_XML_NODES,
  });
  const guardOptions = {
    description: 'DOCX',
    maxEntries,
    maxUncompressedBytes,
    maxEntryBytes: options.strictAdmission ? DOCX_ZIP_LIMITS.entry : undefined,
    verifyCrc: options.strictAdmission,
    signal: options.signal,
  };
  const skipped: string[] = [];
  const relationshipParts: { name: string; chunks: Uint8Array[] }[] = [];
  let relationshipBytes = 0;

  await assertZipArchiveWithinLimits(source, {
    ...guardOptions,
    createInspector: (entry) => {
      const counter = countNodes(entry);
      if (!counter) {
        skipped.push(entry.name);
        return undefined;
      }
      const depth = options.strictAdmission ? createDocxXmlDepthInspector(DOCX_ZIP_LIMITS.depth) : undefined;
      const inspect = depth ? {
        write(chunk: Uint8Array) { counter.write(chunk); depth.write(chunk); },
        close() { counter.close(); depth.close(); },
      } : counter;
      if (!zipEntryLookupNames(entry.name).some((name) => RELATIONSHIP_PART_NAME.test(name))) return inspect;
      const part = { name: entry.name, chunks: [] as Uint8Array[] };
      relationshipParts.push(part);
      return {
        write(chunk) {
          inspect.write(chunk);
          relationshipBytes += chunk.byteLength;
          if (relationshipBytes > MAX_DOCX_RELATIONSHIP_BYTES) {
            throw new LyraResourceLimitError('The DOCX archive contains too many document relationships.');
          }
          part.chunks.push(chunk);
        },
        close: () => inspect.close(),
      };
    },
  });

  const candidates = new Set<string>();
  for (const part of relationshipParts) {
    const decoder = new TextDecoder();
    const targets = mammothPartTargets(
      part.chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode(),
    );
    for (const name of zipEntryLookupNames(part.name)) {
      const match = RELATIONSHIP_PART_NAME.exec(name);
      if (!match) continue;
      for (const target of targets) {
        for (const lookup of zipEntryLookupNames(joinPartPath(match[1] ?? '', target))) candidates.add(lookup);
      }
    }
  }
  const uncounted = new Set(skipped.filter((name) => zipEntryLookupNames(name).some((lookup) => candidates.has(lookup))));
  if (uncounted.size === 0) return;

  countEveryEntry = true;
  await assertZipArchiveWithinLimits(source, {
    ...guardOptions,
    createInspector: (entry) => {
      if (!uncounted.has(entry.name)) return undefined;
      const counter = countNodes(entry);
      if (!counter || !options.strictAdmission) return counter;
      const depth = createDocxXmlDepthInspector(DOCX_ZIP_LIMITS.depth);
      return {
        write(chunk: Uint8Array) { counter.write(chunk); depth.write(chunk); },
        close() { counter.close(); depth.close(); },
      };
    },
  });
}
