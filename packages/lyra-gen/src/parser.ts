import type { JsonValue, LyraGenCatalogReference, LyraGenDiagnostic, LyraGenNode, LyraGenSourceRange, LyraGenView } from './types.js';

export interface MarkupLimits {
  readonly maxBytes: number;
  readonly maxLength: number;
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxAttributes: number;
  readonly maxJsonDepth: number;
  readonly maxJsonEntries: number;
}
export interface MarkupOptions {
  readonly catalog: LyraGenCatalogReference;
  readonly surfaceId: string;
  readonly revision: number;
  readonly allowedTags?: readonly string[];
  readonly limits?: Partial<MarkupLimits>;
}
export interface MarkupNodeSource extends LyraGenSourceRange {
  readonly attributes: Readonly<Record<string, LyraGenSourceRange>>;
}
export interface MarkupResult {
  readonly status: 'complete' | 'incomplete' | 'error';
  readonly view?: LyraGenView;
  readonly diagnostics: readonly LyraGenDiagnostic[];
  readonly sourceMap: Readonly<Record<string, MarkupNodeSource>>;
}
export const MARKUP_LIMITS: Readonly<MarkupLimits> = Object.freeze({
  maxBytes: 262144, maxLength: 262144, maxDepth: 32, maxNodes: 1000,
  maxAttributes: 64, maxJsonDepth: 32, maxJsonEntries: 10000
});
export const STRUCTURAL_TAGS = Object.freeze(['stack', 'row', 'grid', 'text', 'heading', 'divider', 'form']);
const forbidden = new Set(['__proto__', 'constructor', 'prototype', 'style', 'class', 'innerhtml', 'outerhtml', 'classname', 'srcdoc', 'is']);
const nameStart = /[A-Za-z]/;
const namePart = /[A-Za-z0-9_-]/;
const white = /[ \t\r\n]/;
const encoder = new TextEncoder();

function limitsFor(input?: Partial<MarkupLimits>): MarkupLimits {
  const result = { ...MARKUP_LIMITS };
  for (const key of Object.keys(result) as (keyof MarkupLimits)[]) {
    const value = input?.[key];
    if (value !== undefined && Number.isSafeInteger(value) && value > 0) result[key] = Math.min(value, result[key]);
  }
  return result;
}
function diagnostic(code: string, start: number, end = start): LyraGenDiagnostic {
  return { code, path: '', severity: 'error', message: `Lyra Markup: ${code}.`, source: { start, end } };
}
function failed(code: string, start: number, end = start, status: MarkupResult['status'] = 'error'): MarkupResult {
  return { status, diagnostics: [diagnostic(code, start, end)], sourceMap: {} };
}
class ParseFailure {
  constructor(readonly code: string, readonly start: number, readonly end: number, readonly incomplete = false) {}
}
function invalidScalar(value: number): boolean {
  return value === 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)
    || (value < 32 && value !== 9 && value !== 10 && value !== 13)
    || (value >= 0x7f && value <= 0x9f) || (value >= 0x202a && value <= 0x202e)
    || (value >= 0x2066 && value <= 0x2069) || value === 0x061c || value === 0x200e || value === 0x200f
    || (value >= 0xfdd0 && value <= 0xfdef) || (value & 0xffff) >= 0xfffe;
}
function checkUnicode(value: string, offset: number): void {
  let index = 0;
  for (const character of value) {
    if (invalidScalar(character.codePointAt(0)!)) throw new ParseFailure('invalid-unicode', offset + index, offset + index + character.length);
    index += character.length;
  }
}

class Scanner {
  position = 0;
  nodes = 0;
  entries = 0;
  readonly ids = new Set<string>();
  readonly sourceMap: Record<string, MarkupNodeSource> = Object.create(null) as Record<string, MarkupNodeSource>;
  readonly tags: Set<string>;
  constructor(readonly source: string, readonly options: MarkupOptions, readonly limits: MarkupLimits) {
    this.tags = new Set(options.allowedTags ?? STRUCTURAL_TAGS);
  }
  error(code: string, start = this.position, incomplete = false): never {
    throw new ParseFailure(code, start, this.position, incomplete);
  }
  skip(): void { while (this.position < this.source.length && white.test(this.source[this.position]!)) this.position++; }
  expect(value: string): void {
    if (!this.source.startsWith(value, this.position)) this.error('expected-token', this.position, this.position === this.source.length);
    this.position += value.length;
  }
  name(): string {
    const start = this.position;
    if (!nameStart.test(this.source[this.position] ?? '')) this.error('invalid-name', start, start === this.source.length);
    this.position++;
    while (this.position < this.source.length && namePart.test(this.source[this.position]!)) this.position++;
    return this.source.slice(start, this.position);
  }
  decode(raw: string, start: number): string {
    let value = '';
    let cursor = 0;
    while (cursor < raw.length) {
      if (raw[cursor] !== '&') { value += raw[cursor++]; continue; }
      const end = raw.indexOf(';', cursor + 1);
      if (end < 0) throw new ParseFailure('invalid-entity', start + cursor, start + raw.length);
      const entity = raw.slice(cursor + 1, end);
      const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
      if (Object.hasOwn(named, entity)) value += named[entity];
      else {
        const radix = /^#x[0-9a-fA-F]+$/.test(entity) ? 16 : /^#[0-9]+$/.test(entity) ? 10 : 0;
        if (!radix) throw new ParseFailure('invalid-entity', start + cursor, start + end + 1);
        const point = Number.parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
        if (!Number.isSafeInteger(point) || invalidScalar(point)) throw new ParseFailure('invalid-entity', start + cursor, start + end + 1);
        value += String.fromCodePoint(point);
      }
      cursor = end + 1;
    }
    return value;
  }
  quoted(): string {
    const quote = this.source[this.position++]!;
    const start = this.position;
    while (this.position < this.source.length && this.source[this.position] !== quote) {
      if (this.source[this.position] === '<') this.error('raw-less-than');
      this.position++;
    }
    if (this.position === this.source.length) this.error('unfinished-attribute', start - 1, true);
    const value = this.decode(this.source.slice(start, this.position), start);
    this.position++;
    return value;
  }
  jsonString(): string {
    const start = this.position++;
    let escaped = false;
    while (this.position < this.source.length) {
      const character = this.source[this.position++]!;
      if (escaped) { escaped = false; continue; }
      if (character === '\\') { escaped = true; continue; }
      if (character === '"') {
        let value: string;
        try { value = JSON.parse(this.source.slice(start, this.position)) as string; }
        catch { return this.error('invalid-json-string', start); }
        try { checkUnicode(value, start); } catch { return this.error('invalid-json-unicode', start); }
        return value;
      }
    }
    return this.error('unfinished-json-string', start, true);
  }
  json(depth = 0): JsonValue {
    if (depth > this.limits.maxJsonDepth) this.error('json-depth-limit');
    if (++this.entries > this.limits.maxJsonEntries) this.error('json-entry-limit');
    this.skip();
    const start = this.position;
    const character = this.source[this.position];
    if (character === '"') return this.jsonString();
    if (character === '{' || character === '[') {
      this.position++;
      const object = character === '{';
      const close = object ? '}' : ']';
      const result: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      const array: JsonValue[] = [];
      this.skip();
      if (this.source[this.position] === close) { this.position++; return object ? result : array; }
      while (true) {
        this.skip();
        let key = '';
        if (object) {
          if (this.source[this.position] !== '"') this.error('expected-json-key', this.position, this.position === this.source.length);
          key = this.jsonString();
          if (['__proto__', 'prototype', 'constructor'].includes(key)) this.error('unsafe-json-key', start);
          if (Object.hasOwn(result, key)) this.error('duplicate-json-key', start);
          this.skip(); this.expect(':');
        }
        const value = this.json(depth + 1);
        if (object) result[key] = value; else array.push(value);
        this.skip();
        if (this.source[this.position] === close) { this.position++; return object ? result : array; }
        this.expect(',');
      }
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]] as const) {
      if (this.source.startsWith(literal, this.position)) { this.position += literal.length; return value; }
      if (literal.startsWith(this.source.slice(this.position)) && this.source.length - this.position < literal.length) this.error('unfinished-json', start, true);
    }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(this.source.slice(this.position));
    if (!match) {
      if (this.source.slice(start) === '-') this.error('unfinished-json-number', start, true);
      this.error('invalid-json', start, this.position === this.source.length);
    }
    this.position += match[0].length;
    const remainingNumber = this.source.slice(start);
    if (this.position < this.source.length && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][+-]?[0-9]*)?$/.test(remainingNumber)) {
      this.error('unfinished-json-number', start, true);
    }
    const number = Number(match[0]);
    if (!Number.isFinite(number)) this.error('nonfinite-number', start);
    return number;
  }
  node(depth: number): LyraGenNode {
    if (depth > this.limits.maxDepth) this.error('depth-limit');
    if (++this.nodes > this.limits.maxNodes) this.error('node-limit');
    const start = this.position;
    this.expect('<');
    const type = this.name();
    if (this.position === this.source.length) this.error('unfinished-tag', start, true);
    if (!this.tags.has(type) || ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base'].includes(type.toLowerCase())) this.error('unknown-tag', start);
    const attrs: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    const ranges: Record<string, LyraGenSourceRange> = Object.create(null) as Record<string, LyraGenSourceRange>;
    let selfClosing = false;
    while (true) {
      const before = this.position; this.skip();
      if (this.source.startsWith('/>', this.position)) { this.position += 2; selfClosing = true; break; }
      if (this.source[this.position] === '>') { this.position++; break; }
      if (this.position === this.source.length) this.error('unfinished-tag', start, true);
      if (before === this.position) this.error('attribute-separator');
      const attrStart = this.position;
      const key = this.name();
      if (/^on/i.test(key) || forbidden.has(key.toLowerCase())) this.error('forbidden-attribute', attrStart);
      if (Object.hasOwn(attrs, key)) this.error('duplicate-attribute', attrStart);
      if (Object.keys(attrs).length >= this.limits.maxAttributes) this.error('attribute-limit', attrStart);
      this.skip(); this.expect('='); this.skip();
      const character = this.source[this.position];
      let value: JsonValue;
      if (character === '"' || character === "'") value = this.quoted();
      else if (character === '{') { this.position++; value = this.json(); this.skip(); this.expect('}'); }
      else this.error('expected-attribute-value', this.position, this.position === this.source.length);
      attrs[key] = value;
      ranges[key] = { start: attrStart, end: this.position };
    }
    if (typeof attrs['id'] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(attrs['id'])) this.error('invalid-id', start);
    const id = attrs['id'];
    if (this.ids.has(id)) this.error('duplicate-id', start);
    this.ids.add(id);
    const children: LyraGenNode[] = [];
    let text = '';
    if (!selfClosing) {
      while (!this.source.startsWith('</', this.position)) {
        if (this.position === this.source.length) this.error('unfinished-element', start, true);
        if (this.source[this.position] === '<') children.push(this.node(depth + 1));
        else {
          const textStart = this.position;
          while (this.position < this.source.length && this.source[this.position] !== '<') this.position++;
          text += this.decode(this.source.slice(textStart, this.position), textStart);
        }
      }
      this.position += 2;
      const close = this.name(); this.skip(); this.expect('>');
      if (close !== type) this.error('mismatched-close', start);
    }
    if (children.length && !/^[ \t\r\n]*$/.test(text)) this.error('mixed-content', start);
    if (attrs['text'] !== undefined && typeof attrs['text'] !== 'string') this.error('invalid-text', ranges['text']!.start);
    if (attrs['text'] !== undefined && text.length && !children.length) this.error('duplicate-text', start);
    if (attrs['slot'] !== undefined && typeof attrs['slot'] !== 'string') this.error('invalid-slot', ranges['slot']!.start);
    const bindings = attrs['bindings'];
    if (bindings !== undefined && (bindings === null || Array.isArray(bindings) || typeof bindings !== 'object'
      || Object.entries(bindings).some(([key, value]) => forbidden.has(key.toLowerCase()) || /^on/i.test(key) || typeof value !== 'string' || (value !== '' && !value.startsWith('/')) || /~(?![01])/u.test(value)))) this.error('invalid-bindings', start);
    const action = attrs['action'];
    if (action !== undefined && (action === null || Array.isArray(action) || typeof action !== 'object'
      || !('name' in action) || typeof action['name'] !== 'string' || !action['name'] || Object.keys(action).some(key => key !== 'name' && key !== 'payload'))) this.error('invalid-action', start);
    const props: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    for (const [key, value] of Object.entries(attrs)) if (!['id', 'slot', 'text', 'bindings', 'action'].includes(key)) props[key] = value;
    const node: LyraGenNode = {
      id, type,
      ...(Object.keys(props).length ? { props } : {}),
      ...(children.length ? { children } : {}),
      ...(typeof attrs['text'] === 'string' ? { text: attrs['text'] } : !children.length && text.length && (!/^[ \t\r\n]*$/.test(text) || type === 'text' || type === 'heading') ? { text } : {}),
      ...(typeof attrs['slot'] === 'string' ? { slot: attrs['slot'] } : {}),
      ...(bindings !== undefined ? { bindings: bindings as Readonly<Record<string, string>> } : {}),
      ...(action !== undefined ? { action: action as unknown as LyraGenNode['action'] } : {})
    };
    this.sourceMap[id] = { start, end: this.position, attributes: ranges };
    return node;
  }
}

/** Parse untrusted syntax. A complete result still requires catalog and host validation. */
export function parseMarkup(source: string, options: MarkupOptions): MarkupResult {
  if (typeof source !== 'string') return failed('invalid-input', 0);
  const limits = limitsFor(options.limits);
  if (source.length > limits.maxLength) return failed('source-length-limit', limits.maxLength, limits.maxLength);
  if (encoder.encode(source).length > limits.maxBytes) return failed('source-byte-limit', 0, source.length);
  if (!options.catalog?.id || !options.catalog.version || !options.surfaceId || !Number.isSafeInteger(options.revision) || options.revision < 0) return failed('invalid-context', 0);
  const scanner = new Scanner(source, options, limits);
  try {
    checkUnicode(source, 0);
    scanner.skip();
    const root = scanner.node(1);
    scanner.skip();
    if (scanner.position !== source.length) scanner.error('trailing-content');
    return { status: 'complete', view: { version: '1', catalog: { id: options.catalog.id, version: options.catalog.version }, surfaceId: options.surfaceId, revision: options.revision, root }, diagnostics: [], sourceMap: scanner.sourceMap };
  } catch (error) {
    if (error instanceof ParseFailure) return failed(error.code, error.start, error.end, error.incomplete ? 'incomplete' : 'error');
    return failed('invalid-input', scanner.position);
  }
}

export interface MarkupParser {
  push(chunk: string): MarkupResult;
  finish(): MarkupResult;
  cancel(): MarkupResult;
}

/** Bounded final-commit stream; no view is exposed until finish. */
export function createMarkupParser(options: MarkupOptions): MarkupParser {
  const limits = limitsFor(options.limits);
  let chunks: string[] = [];
  let length = 0;
  let done: MarkupResult | undefined;
  let overflow = false;
  const pending = (): MarkupResult => ({ status: 'incomplete', diagnostics: [], sourceMap: {} });
  return {
    push(chunk) {
      if (done) return failed('stream-closed', length);
      if (typeof chunk !== 'string') { chunks = []; done = failed('invalid-input', 0); return done; }
      length += chunk.length;
      if (length > limits.maxLength) { overflow = true; chunks = []; }
      else if (!overflow && chunk.length) chunks.push(chunk);
      return overflow ? failed('source-length-limit', limits.maxLength) : pending();
    },
    finish() {
      if (!done) {
        done = overflow ? failed('source-length-limit', limits.maxLength) : parseMarkup(chunks.join(''), options);
        chunks = [];
      }
      return done;
    },
    cancel() {
      chunks = [];
      done = failed('cancelled', 0, 0, 'incomplete');
      return done;
    }
  };
}
