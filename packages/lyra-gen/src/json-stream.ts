import { isSafeKey, resolveLimits, snapshotJson } from './schema.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenView } from './types.js';

export interface JsonViewStreamOptions {
  readonly catalog: LyraGenCatalog;
  readonly limits?: Partial<LyraGenLimits>;
}
export interface JsonViewStreamResult {
  readonly status: 'incomplete' | 'complete' | 'error' | 'cancelled';
  /** Available only after an explicit finish and successful full-view validation. */
  readonly view?: LyraGenView;
  readonly diagnostics: readonly LyraGenDiagnostic[];
  readonly receivedBytes: number;
  readonly receivedCodeUnits: number;
}
export interface JsonViewStream {
  push(chunk: string): JsonViewStreamResult;
  finish(): JsonViewStreamResult;
  cancel(): JsonViewStreamResult;
}
type Frame =
  | { kind: 'object'; state: 'key-or-end' | 'key' | 'colon' | 'value' | 'comma-or-end'; keys: Set<string> }
  | { kind: 'array'; state: 'value-or-end' | 'value' | 'comma-or-end'; count: number };
type Token = { kind: 'string' | 'number' | 'literal'; text: string; start: number; key: boolean; escaped: boolean; unicode: number };
const isSpace = (code: number): boolean => code === 0x20 || code === 0x0a || code === 0x0d || code === 0x09;
const isDigit = (code: number): boolean => code >= 0x30 && code <= 0x39;
const isHex = (code: number): boolean => isDigit(code) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);
const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;

/** Scans each arriving code unit once; no generated control is admitted before finish(). */
export function createJsonViewStream(options: JsonViewStreamOptions): JsonViewStream {
  const limits = resolveLimits(options.limits);
  const chunks: string[] = [];
  const frames: Frame[] = [];
  let token: Token | undefined;
  let started = false;
  let bytes = 0;
  let offset = 0;
  let nodes = 0;
  let previousHighSurrogate = false;
  let terminal: JsonViewStreamResult | undefined;

  const result = (status: JsonViewStreamResult['status'], diagnostics: readonly LyraGenDiagnostic[] = [], view?: LyraGenView): JsonViewStreamResult =>
    Object.freeze({ status, diagnostics: Object.freeze([...diagnostics]), receivedBytes: bytes, receivedCodeUnits: offset, ...(view ? { view } : {}) });
  const fail = (code: string, message: string, start = offset, end = start + 1): void => {
    if (terminal) return;
    terminal = result('error', [{ code, message, path: '', severity: 'error', source: { start, end } }]);
    chunks.length = 0;
    frames.length = 0;
    token = undefined;
  };
  const beginValue = (): boolean => {
    const frame = frames.at(-1);
    if (frame) {
      if ((frame.kind === 'object' && frame.state !== 'value') || (frame.kind === 'array' && frame.state !== 'value' && frame.state !== 'value-or-end')) {
        fail('json.syntax', 'Expected a separator before another value.'); return false;
      }
      if (frame.kind === 'array' && ++frame.count > limits.maxArrayLength) { fail('limit.array', 'Array exceeds the item limit.'); return false; }
      frame.state = 'comma-or-end';
    } else {
      if (started) { fail('json.syntax', 'Only one root JSON value is permitted.'); return false; }
      started = true;
    }
    if (++nodes > limits.maxNodes) { fail('limit.nodes', 'JSON exceeds the value count limit.'); return false; }
    if (frames.length > limits.maxDepth) { fail('limit.depth', 'JSON exceeds the nesting limit.'); return false; }
    return true;
  };
  const finishToken = (): void => {
    if (!token) return;
    const completed = token;
    token = undefined;
    if (completed.kind === 'number') {
      if (!number.test(completed.text)) fail('json.syntax', 'Invalid JSON number.', completed.start, offset);
      else if (!Number.isFinite(Number(completed.text))) fail('json.number', 'Numbers must be finite.', completed.start, offset);
      return;
    }
    if (completed.kind === 'literal') {
      if (!['true', 'false', 'null'].includes(completed.text)) fail('json.syntax', 'Invalid JSON literal.', completed.start, offset);
      return;
    }
    let value: unknown;
    try { value = JSON.parse(completed.text); } catch { fail('json.syntax', 'Invalid JSON string.', completed.start, offset + 1); return; }
    if (typeof value !== 'string') { fail('json.syntax', 'Expected a string.', completed.start, offset + 1); return; }
    if (value.length > limits.maxStringLength) { fail('limit.string', 'String exceeds the length limit.', completed.start, offset + 1); return; }
    if (completed.key) {
      const frame = frames.at(-1);
      if (frame?.kind !== 'object') { fail('json.syntax', 'Unexpected object key.', completed.start, offset + 1); return; }
      if (!isSafeKey(value)) { fail('json.key', 'Prototype-related keys are not permitted.', completed.start, offset + 1); return; }
      if (frame.keys.has(value)) { fail('json.duplicate-key', 'Duplicate object properties are not permitted.', completed.start, offset + 1); return; }
      if (frame.keys.size >= limits.maxObjectKeys) { fail('limit.keys', 'Object exceeds the property limit.', completed.start, offset + 1); return; }
      frame.keys.add(value);
      frame.state = 'colon';
    }
  };
  const consume = (character: string): void => {
    const code = character.charCodeAt(0);
    if (token) {
      if (token.kind === 'string') {
        token.text += character;
        if (token.unicode > 0) {
          if (!isHex(code)) fail('json.syntax', 'Invalid Unicode escape.');
          else token.unicode--;
        } else if (token.escaped) {
          token.escaped = false;
          if (character === 'u') token.unicode = 4;
          else if (!'"\\/bfnrt'.includes(character)) fail('json.syntax', 'Invalid JSON escape.');
        } else if (code === 0x5c) token.escaped = true;
        else if (code === 0x22) finishToken();
        else if (code < 32) fail('json.syntax', 'Unescaped control character.');
        return;
      }
      if (isSpace(code) || code === 0x2c || code === 0x7d || code === 0x5d) {
        finishToken();
        if (terminal) return;
      } else {
        token.text += character;
        if (token.kind === 'literal' && !['true', 'false', 'null'].some(value => value.startsWith(token!.text))) fail('json.syntax', 'Invalid JSON literal.', token.start, offset + 1);
        else if (token.kind === 'number' && !(isDigit(code) || code === 0x65 || code === 0x45 || code === 0x2b || code === 0x2e || code === 0x2d)) fail('json.syntax', 'Invalid JSON number.', token.start, offset + 1);
        return;
      }
    }
    if (isSpace(code)) return;
    const frame = frames.at(-1);
    if (character === '}' || character === ']') {
      const valid = character === '}'
        ? frame?.kind === 'object' && (frame.state === 'key-or-end' || frame.state === 'comma-or-end')
        : frame?.kind === 'array' && (frame.state === 'value-or-end' || frame.state === 'comma-or-end');
      if (!valid) fail('json.syntax', 'Unexpected closing delimiter.');
      else frames.pop();
      return;
    }
    if (character === ',') {
      if (!frame || frame.state !== 'comma-or-end') fail('json.syntax', 'Unexpected comma.');
      else if (frame.kind === 'object') frame.state = 'key';
      else frame.state = 'value';
      return;
    }
    if (character === ':') {
      if (frame?.kind !== 'object' || frame.state !== 'colon') fail('json.syntax', 'Unexpected colon.');
      else frame.state = 'value';
      return;
    }
    const key = frame?.kind === 'object' && (frame.state === 'key' || frame.state === 'key-or-end');
    if (key && character !== '"') { fail('json.syntax', 'Expected a quoted object key.'); return; }
    if (!key && !beginValue()) return;
    if (character === '{') frames.push({ kind: 'object', state: 'key-or-end', keys: new Set() });
    else if (character === '[') frames.push({ kind: 'array', state: 'value-or-end', count: 0 });
    else if (character === '"') token = { kind: 'string', text: character, start: offset, key, escaped: false, unicode: 0 };
    else if (code === 0x2d || isDigit(code)) token = { kind: 'number', text: character, start: offset, key: false, escaped: false, unicode: 0 };
    else if ('tfn'.includes(character)) token = { kind: 'literal', text: character, start: offset, key: false, escaped: false, unicode: 0 };
    else fail('json.syntax', 'Unexpected JSON token.');
  };
  return {
    push(chunk: string): JsonViewStreamResult {
      if (terminal) return terminal;
      if (typeof chunk !== 'string') { fail('json.chunk', 'A stream chunk must be a string.', offset, offset); return terminal!; }
      if (chunk.length === 0) return result('incomplete');
      // At most maxBytes chunks can be retained because every admitted nonempty chunk has a code unit.
      chunks.push(chunk);
      // Start of the pending run of ordinary string characters, or -1 when not inside one.
      let plain = token?.kind === 'string' && !token.escaped && token.unicode === 0 ? 0 : -1;
      for (let index = 0; index < chunk.length && !terminal; index++) {
        const code = chunk.charCodeAt(index);
        bytes += code >= 0xdc00 && code <= 0xdfff && previousHighSurrogate ? 1 : code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
        previousHighSurrogate = code >= 0xd800 && code <= 0xdbff;
        if (bytes > limits.maxBytes) { fail('limit.bytes', 'JSON source exceeds the byte limit.'); break; }
        if (plain >= 0) {
          // Inside a string with no pending escape, ordinary characters only extend the text.
          if (code !== 0x22 && code !== 0x5c && code >= 32) { offset++; continue; }
          token!.text += chunk.slice(plain, index); plain = -1;
        }
        consume(chunk[index]!);
        offset++;
        if (!terminal && token?.kind === 'string' && !token.escaped && token.unicode === 0) plain = index + 1;
      }
      if (plain >= 0 && plain < chunk.length && token) token.text += chunk.slice(plain);
      return terminal ?? result('incomplete');
    },
    finish(): JsonViewStreamResult {
      if (terminal) return terminal;
      if (token?.kind === 'string' || frames.length > 0 && !token) {
        fail('json.incomplete', 'JSON ended before its value was complete.', token?.start ?? offset, offset);
        return terminal!;
      }
      finishToken();
      if (terminal) return terminal;
      if (!started || frames.length > 0) { fail('json.incomplete', 'JSON ended before its value was complete.', offset, offset); return terminal!; }
      const source = chunks.join('');
      chunks.length = 0;
      // The scanner already enforced syntax, depth, unsafe and duplicate keys, and the byte limit
      // (the same rules parseJson's preflight applies), so only the parse and the bounded snapshot remain.
      let parsed: ReturnType<typeof snapshotJson>;
      try { parsed = snapshotJson(JSON.parse(source), limits); }
      catch { parsed = { ok: false, diagnostics: [{ code: 'json.syntax', path: '', severity: 'error', message: 'Invalid JSON syntax.' }] }; }
      const checked = parsed.ok ? validateView(parsed.value, options.catalog, { limits }) : parsed;
      terminal = checked.ok ? result('complete', checked.diagnostics, checked.value) : result('error', checked.diagnostics);
      return terminal;
    },
    cancel(): JsonViewStreamResult {
      if (!terminal) { chunks.length = 0; frames.length = 0; token = undefined; terminal = result('cancelled'); }
      return terminal;
    }
  };
}

/** Uses the same scanner and final validation as streamed input, including diagnostic offsets. */
export function parseJsonView(source: string, options: JsonViewStreamOptions): JsonViewStreamResult {
  const stream = createJsonViewStream(options);
  stream.push(source);
  return stream.finish();
}
