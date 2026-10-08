import { LyraResourceLimitError } from '../../../internal/resource-loader.js';
import {
  assertZipArchiveWithinLimits,
  createXmlComplexityInspectorFactory,
  zipEntryLookupNames,
  type ZipArchiveGuardOptions,
  type ZipEntryInspector,
} from '../archive-viewer/zip-resource-guard.js';

const MAX_RELATIONSHIP_BYTES = 8 * 1024 * 1024;
const RELATIONSHIP_PART_NAME = /^(?:(.*)\/)?_rels\/[^/]*\.rels$/i;
export const OFFICE_RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const XML_ENTITIES: Readonly<Record<string, string>> = { amp: '&', apos: '\'', gt: '>', lt: '<', quot: '"' };

function isXmlSpace(character: string | undefined): boolean {
  return character !== undefined && (character <= ' ' || character === '\u0080');
}

/** Attribute-value normalisation as the readers' XML parsers apply it. */
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

/** Targets of `Relationship` elements whose `Type` the reader parses; a linear scan looser than any reader's. */
function relationshipPartTargets(text: string, isPartType: (type: string) => boolean): string[] {
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
      if (attribute === 'Type' && isPartType(decodeAttributeValue(value))) partType = true;
      if (attribute === 'Target') values.push(decodeAttributeValue(value));
    }
    if (partType) targets.push(...values);
  }
  return targets;
}

/** The readers' own path join: an absolute target replaces the base, and one leading slash is dropped. */
function joinPartPath(base: string, target: string): string {
  const joined = target.startsWith('/') ? target : [base, target].filter(Boolean).join('/');
  return joined.startsWith('/') ? joined.slice(1) : joined;
}

export interface OoxmlPartGuard {
  guardOptions: Omit<ZipArchiveGuardOptions, 'createInspector'>;
  /** Parts node-counted by name. */
  partName: RegExp;
  /** Relationship types whose targets the reader parses as XML, whatever the target is named. */
  isPartType: (type: string) => boolean;
  maxNodes: number;
  /** Wraps the node counter with a further per-part inspector. */
  extend?: (counter: ZipEntryInspector) => ZipEntryInspector;
}

/** Node-counts every XML part of an OOXML package, including parts reached through relationships under any name. */
export async function assertOoxmlPartsWithinLimits(source: ArrayBuffer, config: OoxmlPartGuard): Promise<void> {
  const { guardOptions, extend } = config;
  let countEveryEntry = false;
  const countNodes = createXmlComplexityInspectorFactory({
    includeEntry: (name) => countEveryEntry || config.partName.test(name),
    maxNodes: config.maxNodes,
  });
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
      const inspect = extend ? extend(counter) : counter;
      if (!zipEntryLookupNames(entry.name).some((name) => RELATIONSHIP_PART_NAME.test(name))) return inspect;
      const part = { name: entry.name, chunks: [] as Uint8Array[] };
      relationshipParts.push(part);
      return {
        write(chunk) {
          inspect.write(chunk);
          relationshipBytes += chunk.byteLength;
          if (relationshipBytes > MAX_RELATIONSHIP_BYTES) {
            throw new LyraResourceLimitError(`The ${guardOptions.description} archive contains too many document relationships.`);
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
    const targets = relationshipPartTargets(
      part.chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode(),
      config.isPartType,
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
      return counter && extend ? extend(counter) : counter;
    },
  });
}
