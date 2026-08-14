import { finiteCount } from '../../../internal/numbers.js';
import { LyraResourceLimitError } from '../../../internal/resource-loader.js';

export interface VCardName {
  familyNames: string;
  givenNames: string;
  additionalNames: string;
  honorificPrefixes: string;
  honorificSuffixes: string;
}
export interface VCardTypedValue { value: string; types: string[]; }
export interface VCardAddress {
  poBox: string;
  extendedAddress: string;
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
  types: string[];
}
export interface VCardContact {
  fn: string;
  n?: VCardName;
  org: string[];
  tel: VCardTypedValue[];
  email: VCardTypedValue[];
  adr: VCardAddress[];
}

export interface ParseVCardsOptions {
  /** Maximum retained contacts, normalized to a whole number in `0…250`. */
  maxContacts?: number;
}

const DEFAULT_MAX_CONTACTS = 250;
const MAX_CONTACTS = 250;
const MAX_RENDERED_CONTACT_CHARS = 2 * 1024 * 1024;
const MAX_LOGICAL_LINES = 100_000;
const MAX_PROPERTIES_PER_CONTACT = 10_000;
const MAX_PROPERTY_CHARS = 1_048_576;
const BEGIN_MARKER = /^BEGIN:VCARD$/i;
const END_MARKER = /^END:VCARD$/i;
const SUPPORTED_VERSIONS = new Set(['2.1', '3.0', '4.0']);

interface ParsedProperty {
  name: string;
  parameters: Map<string, string[]>;
  types: string[];
  value: string;
}

function malformed(message: string): Error {
  return new Error(`Malformed vCard: ${message}`);
}

function normalizedMaxContacts(value: number | ParseVCardsOptions): number {
  const candidate = typeof value === 'number' ? value : value.maxContacts ?? DEFAULT_MAX_CONTACTS;
  return finiteCount(candidate, DEFAULT_MAX_CONTACTS, MAX_CONTACTS);
}

function splitOutsideQuotes(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | null = null;
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      current += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      quote = quote ? null : '"';
      current += character;
      continue;
    }
    if (!quote && character === separator) {
      parts.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  if (quote) throw malformed('unterminated quoted parameter');
  parts.push(current);
  return parts;
}

function propertyColon(line: string): number {
  let quote = false;
  let escaped = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quote = !quote;
      continue;
    }
    if (character === ':' && !quote) return index;
  }
  return -1;
}

function unquoteParameter(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"')) return trimmed;
  if (!trimmed.endsWith('"') || trimmed.length < 2) {
    throw malformed('unterminated quoted parameter');
  }
  return trimmed.slice(1, -1).replace(/\\([\\"])/g, '$1');
}

function decodeQuotedPrintable(value: string, charset: string): string {
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (let index = 0; index < value.length;) {
    if (value[index] === '=') {
      const hex = value.slice(index + 1, index + 3);
      if (!/^[\dA-F]{2}$/i.test(hex)) throw malformed('invalid quoted-printable escape');
      bytes.push(Number.parseInt(hex, 16));
      index += 3;
      continue;
    }
    const codePoint = value.codePointAt(index)!;
    const character = String.fromCodePoint(codePoint);
    bytes.push(...encoder.encode(character));
    index += character.length;
  }
  try {
    return new TextDecoder(charset || 'utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    throw malformed(`unsupported or invalid charset ${charset || 'utf-8'}`);
  }
}

function unescapeValue(value: string): string {
  return value.replace(/\\(\\|,|;|:|[nN])/g, (_match, character: string) =>
    character.toLowerCase() === 'n' ? '\n' : character);
}

function splitUnescaped(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (character === '\\' && index + 1 < value.length) {
      current += character + value[index + 1]!;
      index++;
      continue;
    }
    if (character === separator) {
      parts.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts;
}

function parseProperty(line: string): ParsedProperty {
  if (line.length > MAX_PROPERTY_CHARS) {
    throw new LyraResourceLimitError('A vCard property is too large.');
  }
  const colon = propertyColon(line);
  if (colon <= 0) throw malformed('property is missing its value delimiter');
  const head = splitOutsideQuotes(line.slice(0, colon), ';');
  const rawName = head.shift()?.trim() ?? '';
  const name = rawName.slice(rawName.lastIndexOf('.') + 1).toUpperCase();
  if (!/^[A-Z][A-Z0-9-]*$/.test(name)) throw malformed('invalid property name');

  const parameters = new Map<string, string[]>();
  const types: string[] = [];
  for (const rawParameter of head) {
    if (!rawParameter.trim()) throw malformed('empty parameter');
    const equals = rawParameter.indexOf('=');
    if (equals < 0) {
      // vCard 2.1 permits bare type tokens such as `TEL;HOME;VOICE:`.
      const type = unquoteParameter(rawParameter).toLowerCase();
      if (!type) throw malformed('empty type parameter');
      types.push(type);
      continue;
    }
    const key = rawParameter.slice(0, equals).trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9-]*$/.test(key)) throw malformed('invalid parameter name');
    const rawValue = unquoteParameter(rawParameter.slice(equals + 1));
    const values = splitOutsideQuotes(rawValue, ',').map((item) => item.trim()).filter(Boolean);
    if (!values.length) throw malformed(`empty ${key} parameter`);
    parameters.set(key, [...(parameters.get(key) ?? []), ...values]);
    if (key === 'TYPE') types.push(...values.map((item) => item.toLowerCase()));
  }

  let value = line.slice(colon + 1);
  const encoding = parameters.get('ENCODING')?.at(-1)?.toUpperCase();
  if (encoding && encoding !== 'QUOTED-PRINTABLE' && encoding !== '8BIT') {
    throw malformed(`unsupported encoding ${encoding}`);
  }
  const charset = parameters.get('CHARSET')?.at(-1) ?? 'utf-8';
  if (encoding === 'QUOTED-PRINTABLE') value = decodeQuotedPrintable(value, charset);
  else if (parameters.has('CHARSET') && !/^(?:UTF-8|US-ASCII)$/i.test(charset)) {
    throw malformed(`charset ${charset} requires quoted-printable encoding`);
  }
  return { name, parameters, types, value };
}

function structured(value: string, count: number): string[] {
  const parts = splitUnescaped(value, ';').map(unescapeValue);
  while (parts.length < count) parts.push('');
  return parts.slice(0, count);
}

function isQuotedPrintableSoftLine(line: string): boolean {
  if (!line.endsWith('=')) return false;
  const colon = propertyColon(line);
  return colon > 0 && /(?:^|;)ENCODING\s*=\s*"?QUOTED-PRINTABLE"?(?:;|:)/i.test(line.slice(0, colon + 1));
}

function unfoldBlockLines(physicalLines: string[]): string[] {
  const lines: string[] = [];
  for (const physicalLine of physicalLines) {
    if (lines.length && isQuotedPrintableSoftLine(lines.at(-1)!)) {
      lines[lines.length - 1] = lines.at(-1)!.slice(0, -1)
        + (physicalLine.startsWith(' ') || physicalLine.startsWith('\t')
          ? physicalLine.slice(1)
          : physicalLine);
      continue;
    }
    if (physicalLine.startsWith(' ') || physicalLine.startsWith('\t')) {
      if (!lines.length) throw malformed('orphan folded line');
      lines[lines.length - 1] += physicalLine.slice(1);
      continue;
    }
    if (!physicalLine) continue;
    lines.push(physicalLine);
    if (lines.length > MAX_PROPERTIES_PER_CONTACT) {
      throw new LyraResourceLimitError('The vCard contains too many properties.');
    }
  }
  return lines;
}

function parseBlock(physicalLines: string[]): VCardContact {
  const contact: VCardContact = { fn: '', org: [], tel: [], email: [], adr: [] };
  let version = '';
  for (const line of unfoldBlockLines(physicalLines)) {
    const property = parseProperty(line);
    if (property.name === 'VERSION') {
      if (version) throw malformed('duplicate VERSION property');
      version = property.value.trim();
      continue;
    }
    switch (property.name) {
      case 'FN':
        contact.fn = unescapeValue(property.value);
        break;
      case 'N': {
        const [familyNames = '', givenNames = '', additionalNames = '', honorificPrefixes = '', honorificSuffixes = ''] = structured(property.value, 5);
        contact.n = { familyNames, givenNames, additionalNames, honorificPrefixes, honorificSuffixes };
        break;
      }
      case 'ORG':
        contact.org = splitUnescaped(property.value, ';').map(unescapeValue).filter(Boolean);
        break;
      case 'TEL':
        contact.tel.push({ value: unescapeValue(property.value), types: property.types });
        break;
      case 'EMAIL':
        contact.email.push({ value: unescapeValue(property.value), types: property.types });
        break;
      case 'ADR': {
        const [poBox = '', extendedAddress = '', streetAddress = '', locality = '', region = '', postalCode = '', country = ''] = structured(property.value, 7);
        contact.adr.push({
          poBox,
          extendedAddress,
          streetAddress,
          locality,
          region,
          postalCode,
          country,
          types: property.types,
        });
        break;
      }
      default:
        break;
    }
  }
  if (!version) throw malformed('missing VERSION property');
  if (!SUPPORTED_VERSIONS.has(version)) throw malformed(`unsupported VERSION ${version}`);
  return contact;
}

function renderedContactChars(contact: VCardContact): number {
  let total = contact.fn.length + contact.org.reduce((sum, value) => sum + value.length, 0);
  if (contact.n) total += Object.values(contact.n).reduce((sum, value) => sum + value.length, 0);
  for (const value of [...contact.tel, ...contact.email]) {
    total += value.value.length + value.types.reduce((sum, type) => sum + type.length, 0);
  }
  for (const address of contact.adr) {
    total += address.poBox.length + address.extendedAddress.length + address.streetAddress.length
      + address.locality.length + address.region.length + address.postalCode.length
      + address.country.length + address.types.reduce((sum, type) => sum + type.length, 0);
  }
  return total;
}

/**
 * Parses vCard 2.1, 3.0 and 4.0 records with strict line-boundary framing. Non-empty data outside a
 * card, nested/unclosed cards, unsupported profiles and malformed properties fail closed.
 */
export function parseVCards(
  text: string,
  options: number | ParseVCardsOptions = DEFAULT_MAX_CONTACTS,
): VCardContact[] {
  if (text.includes('\0')) throw malformed('NUL byte');
  const maxContacts = normalizedMaxContacts(options);
  const physicalLines = text.split(/\r\n|\r|\n/);
  if (physicalLines.length > MAX_LOGICAL_LINES) {
    throw new LyraResourceLimitError('The vCard contains too many lines.');
  }

  const contacts: VCardContact[] = [];
  let renderedChars = 0;
  let block: string[] | null = null;
  for (const physicalLine of physicalLines) {
    const marker = physicalLine.trim();
    if (BEGIN_MARKER.test(marker)) {
      if (block) throw malformed('nested BEGIN:VCARD');
      block = [];
      continue;
    }
    if (END_MARKER.test(marker)) {
      if (!block) throw malformed('END:VCARD without BEGIN:VCARD');
      if (contacts.length >= maxContacts) {
        throw new LyraResourceLimitError('The vCard contains too many contacts.');
      }
      const contact = parseBlock(block);
      renderedChars += renderedContactChars(contact);
      if (renderedChars > MAX_RENDERED_CONTACT_CHARS) {
        throw new LyraResourceLimitError('The vCard contains too much rendered contact text.');
      }
      contacts.push(contact);
      block = null;
      continue;
    }
    if (block) {
      block.push(physicalLine);
      if (block.length > MAX_PROPERTIES_PER_CONTACT * 2) {
        throw new LyraResourceLimitError('The vCard contains too many properties.');
      }
    } else if (marker) {
      throw malformed('data outside BEGIN:VCARD/END:VCARD');
    }
  }
  if (block) throw malformed('missing END:VCARD');
  return contacts;
}
