import { PartialViewTracker, type LyraGenPartialView, type LyraGenProgressiveOptions } from './partial-view.js';
import { isSafeKey, parseJson } from './schema.js';
import type { JsonValue, LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenNode, LyraGenResult, LyraGenSchema, LyraGenView } from './types.js';

/**
 * Lyra Lines: an opt-in compact wire profile for generated views. It is only a transport syntax:
 * `parseLines()` turns it into an ordinary JSON v1 `LyraGenView`, which is then validated and stored
 * exactly like JSON output. Nothing is ever stored as Lines.
 *
 *   lines/1 <catalog-id> <catalog-version>
 *   <type>#<id> <required props in catalog order...> key=value ... @member=JSON ... | text
 *    <child, one indentation step deeper>
 */
export const LINES_HEADER = 'lines/1';

export interface LyraGenLinesLimits {
  /** Whole input in UTF-16 code units. */
  readonly maxLength: number;
  /** Whole input in UTF-8 bytes. */
  readonly maxBytes: number;
  /** One line in UTF-16 code units, enforced while streaming before its newline arrives. */
  readonly maxLineLength: number;
  /** Nesting levels, the root included. */
  readonly maxDepth: number;
  readonly maxNodes: number;
  /** Values after the type and id on one line. */
  readonly maxFields: number;
}
/** Default and hard ceilings; overrides can only lower them. */
export const LINES_LIMITS: Readonly<LyraGenLinesLimits> = Object.freeze({
  maxLength: 262144, maxBytes: 262144, maxLineLength: 65536, maxDepth: 32, maxNodes: 1000, maxFields: 64,
});

export interface LyraGenLinesOptions {
  /** Host-supplied surface of the produced view; never taken from generated text. */
  readonly surfaceId: string;
  /** Host-supplied revision of the produced view. */
  readonly revision: number;
  /**
   * Allow nodes without `#id`. Default `false`: every node needs an explicit id. When enabled, a
   * missing id becomes `<type>-<n>` (the node's position among nodes of that type, counted in
   * document order from 1, explicit ids included) and a missing root id becomes `root`. Derived ids
   * are written into the view before validation, so a collision is rejected like any duplicate.
   */
  readonly elideIds?: boolean;
  readonly limits?: Partial<LyraGenLinesLimits>;
  /** Bounds for each embedded JSON value (string length, nesting, entries). */
  readonly valueLimits?: Partial<LyraGenLimits>;
}
export interface LyraGenLinesStreamOptions extends LyraGenLinesOptions {
  /** Offer validated previews while streaming; omitted means no previews. `minCodeUnits` defaults to 0 here. */
  readonly progressive?: LyraGenProgressiveOptions;
  /** View-validation limits for previews. */
  readonly validationLimits?: Partial<LyraGenLimits>;
  /** Apply catalog-directed property normalization while validating previews. */
  readonly normalize?: boolean;
}
export interface LyraGenLinesStep {
  readonly status: 'incomplete' | 'error';
  readonly diagnostics: readonly LyraGenDiagnostic[];
  /** A new validated preview assembled by this push (progressive mode only). */
  readonly partial?: LyraGenPartialView;
}
export interface LyraGenLinesParser {
  push(chunk: string): LyraGenLinesStep;
  /** The parsed, not yet validated, view; pass it to `validateView()` before rendering or storing it. */
  finish(): LyraGenResult<LyraGenView>;
  cancel(): LyraGenResult<LyraGenView>;
}
export interface LyraGenLinesEncodeOptions {
  /** Omit ids that equal the id `parseLines(..., { elideIds: true })` would derive. Default `false`. */
  readonly elideIds?: boolean;
}

/** Node members written as `@name=JSON`, in emission order. */
export const LINES_MEMBERS = Object.freeze(['slot', 'bindings', 'reads', 'liveReads', 'dataQuery', 'repeat', 'itemReads', 'visible', 'checks', 'computes', 'a11y', 'action'] as const);
type Member = typeof LINES_MEMBERS[number];
const memberSet: ReadonlySet<string> = new Set(LINES_MEMBERS);

const typePattern = /^[A-Za-z][A-Za-z0-9_-]*/u;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}/u;
const wholeIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const keyPattern = /^(@?)([A-Za-z_$][A-Za-z0-9_$-]*)=/u;
const bareWordPattern = /^[A-Za-z][A-Za-z0-9_.-]*$/u;
const numberPattern = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;
const headerWordPattern = /^[A-Za-z0-9][A-Za-z0-9_.:+@-]*$/u;
const reservedWords = new Set(['true', 'false', 'null']);
// Raw C0 and C1 controls and unpaired surrogates never appear in a line; JSON escapes carry them.
const controlPattern = /[\u0000-\u001f\u007f-\u009f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/u;
const encoder = new TextEncoder();

function limitsFor(input?: Partial<LyraGenLinesLimits>): LyraGenLinesLimits {
  const result = { ...LINES_LIMITS };
  for (const key of Object.keys(result) as (keyof LyraGenLinesLimits)[]) {
    const value = input?.[key];
    if (value !== undefined && Number.isSafeInteger(value) && value > 0) result[key] = Math.min(value, result[key]);
  }
  return result;
}

/** Whether a string-typed schema (directly or through `anyOf`) enumerates `word`. */
function enumerates(schema: LyraGenSchema | undefined, word: string): boolean {
  if (!schema) return false;
  if ('anyOf' in schema) return schema.anyOf.some(branch => enumerates(branch, word));
  return Array.isArray(schema.enum) && schema.enum.includes(word);
}
const isBareWord = (value: string, schema: LyraGenSchema | undefined): boolean => bareWordPattern.test(value) && !reservedWords.has(value) && enumerates(schema, value);

class LinesFailure {
  constructor(readonly code: string, readonly message: string, readonly column: number, readonly width = 1, readonly path = '', readonly hint?: string) {}
}

/* ------------------------------------------------------------------ encoding */

function failEncode(code: string, path: string, message: string): LyraGenResult<string> {
  return { ok: false, diagnostics: [{ code, path, message, severity: 'error' }] };
}
const encodeText = (text: string): string => text.replace(/[\\\u0000-\u001f\u007f-\u009f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/gu, character =>
  character === '\\' ? '\\\\' : character === '\n' ? '\\n' : character === '\r' ? '\\r' : character === '\t' ? '\\t' : `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
const headerWord = (value: string): string => headerWordPattern.test(value) ? value : JSON.stringify(value);

/**
 * Encode a view as Lyra Lines for the given catalog. Required properties are written positionally in
 * the catalog's declared order up to the first one the node does not set; every other property is
 * `key=value`. Encoding then parsing with the same options reproduces the view exactly.
 */
export function encodeLines(view: LyraGenView, catalog: LyraGenCatalog, options: LyraGenLinesEncodeOptions = {}): LyraGenResult<string> {
  if (view.catalog?.id !== catalog.id || view.catalog?.version !== catalog.version) return failEncode('lines.encode.catalog', '/catalog', 'The view was generated against another catalog.');
  const lines = [`${LINES_HEADER} ${headerWord(catalog.id)} ${headerWord(catalog.version)}`];
  const counters = new Map<string, number>();
  const pending: { node: LyraGenNode; depth: number; path: string }[] = [{ node: view.root, depth: 0, path: '/root' }];
  while (pending.length) {
    const { node, depth, path } = pending.pop()!;
    const role = Object.hasOwn(catalog.components, node.type) ? catalog.components[node.type] : undefined;
    if (!role) return failEncode('lines.encode.unknown-type', path, 'The node type is not in the catalog.');
    for (const key of Object.keys(node)) if (!['id', 'type', 'props', 'children', 'text'].includes(key) && !memberSet.has(key)) return failEncode('lines.encode.member', path, `The node member ${key} has no Lines form.`);
    const ordinal = (counters.get(node.type) ?? 0) + 1;
    counters.set(node.type, ordinal);
    const derived = depth === 0 ? 'root' : `${node.type}-${ordinal}`;
    if (typeof node.id !== 'string' || !wholeIdPattern.test(node.id)) return failEncode('lines.encode.id', path, 'The node id cannot be written in Lines.');
    const parts = [`${' '.repeat(depth)}${node.type}${options.elideIds && node.id === derived ? '' : `#${node.id}`}`];
    const props = node.props ?? {};
    const required = role.required ?? [];
    const value = (key: string, entry: JsonValue | undefined): string | undefined => {
      if (typeof entry === 'string') return isBareWord(entry, role.properties[key]) ? entry : JSON.stringify(entry);
      if (entry === undefined || (typeof entry === 'number' && !Number.isFinite(entry))) return undefined;
      return JSON.stringify(entry);
    };
    let positional = 0;
    for (const key of required) {
      if (!Object.hasOwn(props, key)) break;
      const written = value(key, props[key]);
      if (written === undefined) return failEncode('lines.encode.value', `${path}/props/${key}`, 'The property value is not JSON.');
      parts.push(written);
      positional++;
    }
    const positionalKeys = new Set(required.slice(0, positional));
    for (const [key, entry] of Object.entries(props)) {
      if (positionalKeys.has(key)) continue;
      const written = value(key, entry);
      if (written === undefined || !keyPattern.test(`${key}=`)) return failEncode('lines.encode.value', `${path}/props/${key}`, 'The property cannot be written in Lines.');
      parts.push(`${key}=${written}`);
    }
    for (const member of LINES_MEMBERS) if (node[member] !== undefined) parts.push(`@${member}=${JSON.stringify(node[member])}`);
    if (node.text !== undefined) parts.push(node.text === '' ? '|' : `| ${encodeText(node.text)}`);
    lines.push(parts.join(' '));
    const children = node.children ?? [];
    for (let index = children.length - 1; index >= 0; index--) pending.push({ node: children[index]!, depth: depth + 1, path: `${path}/children/${index}` });
  }
  return { ok: true, value: `${lines.join('\n')}\n`, diagnostics: [] };
}

/* ------------------------------------------------------------------ parsing */

interface OpenNode {
  readonly fields: Record<string, unknown>;
  readonly children: LyraGenNode[];
  readonly path: string;
}
interface ParsedLine {
  readonly level: number;
  readonly path: string;
  readonly fields: Record<string, unknown>;
}

/** Reads one line's fields after the indentation; columns are 1-based in diagnostics. */
class LineReader {
  position = 0;
  constructor(readonly line: string, readonly valueLimits: Partial<LyraGenLimits> | undefined, readonly path: string) {}

  fail(code: string, message: string, start = this.position, width = 1, hint?: string): never {
    throw new LinesFailure(code, message, start, width, this.path, hint);
  }
  atEnd(): boolean { return this.position >= this.line.length; }
  /** Separator: one or more spaces, or the end of the line. */
  separator(): boolean {
    if (this.atEnd()) return false;
    if (this.line[this.position] !== ' ') this.fail('lines.separator', 'Separate values with a space.');
    while (this.line[this.position] === ' ') this.position++;
    return !this.atEnd();
  }
  /** The extent of a quoted string or bracketed JSON value starting at the cursor. */
  jsonExtent(): number {
    const start = this.position;
    let depth = 0;
    let inString = false;
    for (let index = start; index < this.line.length; index++) {
      const character = this.line[index];
      if (inString) {
        if (character === '\\') index++;
        else if (character === '"') { inString = false; if (depth === 0) return index + 1; }
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '[' || character === '{') depth++;
      else if (character === ']' || character === '}') { depth--; if (depth === 0) return index + 1; if (depth < 0) break; }
    }
    return this.fail('lines.unterminated', 'The string, array or object does not end on this line.', start, this.line.length - start);
  }
  json(text: string, start: number): JsonValue {
    const parsed = parseJson(text, this.valueLimits);
    if (!parsed.ok) this.fail('lines.json', `Invalid JSON value (${parsed.diagnostics[0]?.code ?? 'json'}).`, start, text.length);
    return parsed.value;
  }
  /** One value; a bare word is admitted only when `schema` enumerates it. */
  value(schema: LyraGenSchema | undefined, bareAllowed: boolean): JsonValue {
    const start = this.position;
    const first = this.line[start];
    if (first === '"' || first === '[' || first === '{') {
      const end = this.jsonExtent();
      this.position = end;
      if (!this.atEnd() && this.line[end] !== ' ') this.fail('lines.separator', 'Separate values with a space.');
      return this.json(this.line.slice(start, end), start);
    }
    let end = this.line.indexOf(' ', start);
    if (end < 0) end = this.line.length;
    const token = this.line.slice(start, end);
    this.position = end;
    if (first === '-' || (first !== undefined && first >= '0' && first <= '9')) {
      if (!numberPattern.test(token)) this.fail('lines.value', 'Invalid number.', start, token.length);
      return this.json(token, start);
    }
    if (reservedWords.has(token)) return this.json(token, start);
    if (!bareWordPattern.test(token)) this.fail('lines.value', 'Expected a JSON value, a number or an enum word.', start, token.length);
    if (!bareAllowed || !enumerates(schema, token)) this.fail('lines.bare-word', 'A bare word is only allowed for a value the property enumerates.', start, token.length, 'Quote free text as a JSON string.');
    return token;
  }
}

function decodeText(raw: string, reader: LineReader, offset: number): string {
  return raw.replace(/\\(u[0-9A-Fa-f]{4}|.?)/gu, (whole, escape: string, index: number) => {
    if (escape === '\\') return '\\';
    if (escape === 'n') return '\n';
    if (escape === 'r') return '\r';
    if (escape === 't') return '\t';
    if (escape.length === 5) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    return reader.fail('lines.escape', 'Text escapes are \\n, \\r, \\t, \\\\ and \\uXXXX.', offset + index, whole.length);
  });
}

/**
 * The incremental parser behind `parseLines()`. Each completed line is one complete node; with
 * `progressive`, validated previews are offered as lines complete.
 */
export function createLinesParser(catalog: LyraGenCatalog, options: LyraGenLinesStreamOptions): LyraGenLinesParser {
  const limits = limitsFor(options.limits);
  // Every completed line is a complete node, so previews may follow each line (minCodeUnits defaults to 0);
  // the tracker's quarter-of-input spacing still keeps preview validation linear in the stream length.
  const tracker = options.progressive ? new PartialViewTracker(catalog, { minCodeUnits: 0, ...options.progressive }, options.validationLimits, options.normalize) : undefined;
  const reference = { id: catalog.id, version: catalog.version };
  const stack: OpenNode[] = [];
  const counters = new Map<string, number>();
  const ids = new Set<string>();
  let root: LyraGenNode | undefined;
  let rootSeen = false;
  let headerSeen = false;
  let unit = 0;
  let nodes = 0;
  let buffer = '';
  let received = 0;
  let bytes = 0;
  let lineNumber = 0;
  let lineStart = 0;
  let failure: LyraGenDiagnostic[] | undefined;
  let finished: LyraGenResult<LyraGenView> | undefined;
  let dirty = false;

  const fail = (code: string, message: string, line: number, column: number, offset: number, width: number, path = '', hint?: string): void => {
    failure = [{ code, path, severity: 'error', message: `Lyra Lines line ${line}, column ${column}: ${message}`, source: { start: offset, end: offset + width }, ...(hint ? { hint } : {}) }];
    stack.length = 0;
    buffer = '';
  };
  const failAt = (error: LinesFailure): void => fail(error.code, error.message, lineNumber, error.column + 1, lineStart + error.column, error.width, error.path, error.hint);

  const close = (open: OpenNode): LyraGenNode => Object.freeze({ ...open.fields, ...(open.children.length ? { children: Object.freeze([...open.children]) } : {}) }) as unknown as LyraGenNode;
  const popTo = (level: number): void => {
    while (stack.length > level) {
      const node = close(stack.pop()!);
      const parent = stack.at(-1);
      if (parent) parent.children.push(node); else root = node;
    }
  };

  const header = (line: string): void => {
    const reader: LineReader = new LineReader(line, options.valueLimits, '');
    const words: string[] = [];
    while (!reader.atEnd()) {
      const start = reader.position;
      if (line[start] === '"') { reader.position = reader.jsonExtent(); const word = reader.json(line.slice(start, reader.position), start); words.push(typeof word === 'string' ? word : ''); }
      else { let end = line.indexOf(' ', start); if (end < 0) end = line.length; words.push(line.slice(start, end)); reader.position = end; }
      reader.separator();
    }
    if (words.length !== 3 || words[0] !== LINES_HEADER) throw new LinesFailure('lines.header', `The first line must be "${LINES_HEADER} <catalog-id> <catalog-version>".`, 0, line.length);
    if (words[1] !== catalog.id || words[2] !== catalog.version) throw new LinesFailure('lines.catalog-mismatch', 'The positional order was written for another catalog id or version.', 0, line.length, '', `Expected ${LINES_HEADER} ${headerWord(catalog.id)} ${headerWord(catalog.version)}.`);
  };

  const nodeLine = (line: string): ParsedLine => {
    let indent = 0;
    while (line[indent] === ' ') indent++;
    let level = 0;
    if (indent > 0) {
      if (!unit && rootSeen && stack.length) unit = indent;
      if (!unit || indent % unit !== 0) throw new LinesFailure('lines.indent', 'Indentation must be a whole number of steps.', 0, indent);
      level = indent / unit;
    }
    if (!rootSeen && level !== 0) throw new LinesFailure('lines.indent', 'The root node starts at column 1.', 0, indent);
    if (rootSeen && level === 0) throw new LinesFailure('lines.multiple-roots', 'A view has exactly one root node.', 0, 1);
    if (level > stack.length) throw new LinesFailure('lines.indent', 'A child is indented exactly one step deeper than its parent.', 0, indent);
    if (level + 1 > limits.maxDepth) throw new LinesFailure('lines.limit-depth', 'The view nests deeper than the limit.', 0, indent);
    if (++nodes > limits.maxNodes) throw new LinesFailure('lines.limit-nodes', 'The view has more nodes than the limit.', 0, line.length);
    const parent = level > 0 ? stack[level - 1] : undefined;
    // Closed siblings are counted; an open sibling at this level is closed before this node is added.
    const siblings = parent ? parent.children.length + (stack.length > level ? 1 : 0) : 0;
    const path = parent ? `${parent.path}/children/${siblings}` : '/root';
    const reader: LineReader = new LineReader(line, options.valueLimits, path);
    reader.position = indent;
    const typeMatch = typePattern.exec(line.slice(indent));
    if (!typeMatch) reader.fail('lines.type', 'A line starts with a catalog type.');
    const type = typeMatch[0];
    if (!Object.hasOwn(catalog.components, type)) reader.fail('lines.unknown-type', `The type ${type} is not in the catalog.`, indent, type.length);
    const role = catalog.components[type]!;
    reader.position += type.length;
    if (reader.position < line.length && line[reader.position] !== ' ' && line[reader.position] !== '#') reader.fail('lines.type', 'A type is followed by #id, a space or the end of the line.');
    let id: string | undefined;
    if (line[reader.position] === '#') {
      const idMatch = idPattern.exec(line.slice(reader.position + 1));
      if (!idMatch) reader.fail('lines.id', 'Invalid id after #.', reader.position + 1);
      id = idMatch[0];
      reader.position += 1 + id.length;
      if (reader.position < line.length && line[reader.position] !== ' ') reader.fail('lines.id', 'Invalid id after #.', reader.position);
    }
    const ordinal = (counters.get(type) ?? 0) + 1;
    counters.set(type, ordinal);
    if (id === undefined) {
      if (!options.elideIds) reader.fail('lines.id-required', 'Every node needs an explicit #id.', indent, type.length);
      id = level === 0 ? 'root' : `${type}-${ordinal}`;
    }
    if (ids.has(id)) reader.fail('lines.duplicate-id', `The id ${id} is already used.`, indent, reader.position - indent);
    ids.add(id);
    const required = role.required ?? [];
    const props: Record<string, JsonValue> = {};
    const members: Partial<Record<Member, JsonValue>> = {};
    let positional = 0;
    let named = false;
    let fields = 0;
    let text: string | undefined;
    while (reader.separator()) {
      const start = reader.position;
      if (++fields > limits.maxFields) reader.fail('lines.limit-fields', 'The line has more values than the limit.');
      if (line[start] === '|') {
        const rest = line.slice(start + 1);
        if (rest.length && rest[0] !== ' ') reader.fail('lines.separator', 'Text follows "| ".', start + 1);
        text = decodeText(rest.slice(1), reader, start + 2);
        break;
      }
      const keyMatch = keyPattern.exec(line.slice(start));
      if (keyMatch) {
        const [whole, at, key] = keyMatch as unknown as [string, string, string];
        if (!isSafeKey(key)) reader.fail('lines.unsafe-key', `The key ${key} is not permitted.`, start, whole.length);
        reader.position += whole.length;
        if (at) {
          if (!memberSet.has(key)) reader.fail('lines.unknown-member', `Unknown node member @${key}.`, start, whole.length);
          if (Object.hasOwn(members, key)) reader.fail('lines.duplicate', `The member @${key} is repeated.`, start, whole.length);
          if (reader.atEnd() || !'"[{-0123456789tfn'.includes(line[reader.position]!)) reader.fail('lines.value', 'A member value is JSON.');
          members[key as Member] = reader.value(undefined, false);
        } else {
          if (Object.hasOwn(props, key)) reader.fail('lines.duplicate', `The property ${key} is set twice.`, start, whole.length);
          props[key] = reader.value(Object.hasOwn(role.properties, key) ? role.properties[key] : undefined, true);
        }
        named = true;
        continue;
      }
      if (named) reader.fail('lines.positional-order', 'Positional values come before key=value pairs.', start);
      const key = required[positional];
      if (key === undefined) reader.fail('lines.positional-count', `${type} takes ${required.length} positional value${required.length === 1 ? '' : 's'} (${required.join(', ') || 'none'}).`, start);
      props[key] = reader.value(Object.hasOwn(role.properties, key) ? role.properties[key] : undefined, true);
      positional++;
    }
    return {
      level,
      path,
      fields: { id, type, ...(Object.keys(props).length ? { props: Object.freeze(props) } : {}), ...(text !== undefined ? { text } : {}), ...members },
    };
  };

  const consume = (raw: string): void => {
    lineNumber++;
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    bytes += encoder.encode(raw).length + 1;
    if (bytes > limits.maxBytes + 1) throw new LinesFailure('lines.limit-bytes', 'The input exceeds the byte limit.', 0, line.length);
    if (line.length > limits.maxLineLength) throw new LinesFailure('lines.limit-line', 'The line exceeds the length limit.', limits.maxLineLength, line.length - limits.maxLineLength);
    const tab = /^ *\t/u.exec(line);
    if (tab) throw new LinesFailure('lines.indent', 'Indent with spaces only.', tab[0].length - 1);
    const control = controlPattern.exec(line);
    if (control) throw new LinesFailure('lines.control-character', 'Raw control characters are not permitted; use JSON escapes.', control.index);
    if (!line.trim()) return;
    if (!headerSeen) { header(line); headerSeen = true; return; }
    const parsed = nodeLine(line);
    popTo(parsed.level);
    stack.push({ fields: parsed.fields, children: [], path: parsed.path });
    rootSeen = true;
    dirty = true;
  };
  const drain = (final: boolean): void => {
    for (let newline = buffer.indexOf('\n'); newline >= 0 && !failure; newline = buffer.indexOf('\n')) {
      const raw = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try { consume(raw); } catch (error) { if (error instanceof LinesFailure) failAt(error); else throw error; }
      lineStart += raw.length + 1;
    }
    if (failure) return;
    if (buffer.length > limits.maxLineLength) { lineNumber++; fail('lines.limit-line', 'The line exceeds the length limit.', lineNumber, limits.maxLineLength + 1, lineStart + limits.maxLineLength, buffer.length - limits.maxLineLength); return; }
    if (final && buffer.length) {
      const raw = buffer;
      buffer = '';
      try { consume(raw); } catch (error) { if (error instanceof LinesFailure) failAt(error); else throw error; }
    }
  };
  const candidate = (): { root: LyraGenNode; open: Set<string> } | undefined => {
    if (!stack.length) return undefined;
    const open = new Set<string>();
    let built: LyraGenNode | undefined;
    for (let level = stack.length - 1; level >= 0; level--) {
      const entry = stack[level]!;
      open.add(entry.fields['id'] as string);
      const children = built ? [...entry.children, built] : entry.children;
      built = { ...entry.fields, ...(children.length ? { children } : {}) } as unknown as LyraGenNode;
    }
    return built ? { root: built, open } : undefined;
  };
  const errorResult = (): LyraGenResult<LyraGenView> => ({ ok: false, diagnostics: failure! });

  if (typeof options.surfaceId !== 'string' || !options.surfaceId || !Number.isSafeInteger(options.revision) || options.revision < 0) {
    failure = [{ code: 'lines.context', path: '', severity: 'error', message: 'Lyra Lines needs a host surface id and a non-negative integer revision.' }];
  }

  return {
    push(chunk) {
      if (finished && !failure) fail('lines.closed', 'The stream is already finished.', lineNumber, 1, received, 0);
      if (failure) return { status: 'error', diagnostics: failure };
      if (typeof chunk !== 'string') { fail('lines.input', 'Chunks are strings.', lineNumber, 1, received, 0); return { status: 'error', diagnostics: failure! }; }
      received += chunk.length;
      if (received > limits.maxLength) { fail('lines.limit-length', 'The input exceeds the length limit.', lineNumber + 1, 1, limits.maxLength, received - limits.maxLength); return { status: 'error', diagnostics: failure! }; }
      buffer += chunk;
      drain(false);
      if (failure) return { status: 'error', diagnostics: failure };
      if (!tracker || !dirty || !tracker.due(received)) return { status: 'incomplete', diagnostics: [] };
      dirty = false;
      const next = candidate();
      const partial = next && tracker.offer({ version: '1', catalog: reference, surfaceId: options.surfaceId, revision: options.revision, root: next.root }, next.open, received);
      return partial ? { status: 'incomplete', diagnostics: [], partial } : { status: 'incomplete', diagnostics: [] };
    },
    finish() {
      if (finished) return finished;
      if (!failure) drain(true);
      if (!failure && !headerSeen) fail('lines.header', `The first line must be "${LINES_HEADER} <catalog-id> <catalog-version>".`, 1, 1, 0, 0);
      if (!failure && !rootSeen) fail('lines.empty', 'No root node was received.', lineNumber, 1, received, 0);
      if (failure) { finished = errorResult(); return finished; }
      popTo(0);
      finished = { ok: true, value: Object.freeze({ version: '1', catalog: reference, surfaceId: options.surfaceId, revision: options.revision, root: root! }), diagnostics: [] };
      return finished;
    },
    cancel() {
      if (!failure) fail('lines.cancelled', 'The stream was cancelled.', lineNumber, 1, received, 0);
      finished = errorResult();
      return finished;
    },
  };
}

/**
 * Parse Lyra Lines into a JSON v1 `LyraGenView`. The result is syntax-checked only: always pass it to
 * `validateView()` before rendering or storing it.
 */
export function parseLines(text: string, catalog: LyraGenCatalog, options: LyraGenLinesOptions): LyraGenResult<LyraGenView> {
  const parser = createLinesParser(catalog, options);
  if (typeof text !== 'string') return { ok: false, diagnostics: [{ code: 'lines.input', path: '', severity: 'error', message: 'Lyra Lines input is a string.' }] };
  const step = parser.push(text);
  return step.status === 'error' ? { ok: false, diagnostics: step.diagnostics } : parser.finish();
}
