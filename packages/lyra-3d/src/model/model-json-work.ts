import { ModelJsonStringBuilder, ModelJsonString } from './model-json-string.js';
import { MODEL_LIMITS as LIMIT } from './limits.js';
import { modelAdmissionCheck as check } from './model-admission-policy.js';
import type { ModelJsonRecord, ModelJsonValue } from './model-prepared-types.js';
import { decodeModelText, ModelTextCursor } from './model-text-work.js';
import { createModelGeneratorWork, type ModelWorkGenerator } from './model-work-generator.js';

const whitespace = (value: string | undefined): boolean => value === ' ' || value === '\t' || value === '\r' || value === '\n';
const digit = (value: string | undefined): boolean => value !== undefined && value >= '0' && value <= '9';
const escapes: Readonly<Record<string, string>> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
function* spaces(cursor: ModelTextCursor): ModelWorkGenerator<void> {
  if (!whitespace(cursor.peek())) return;
  yield { unit: 'scalars', run(limit) {
    let used = 0;
    while (used < limit && whitespace(cursor.peek())) { cursor.take(); used++; }
    return { used, done: !whitespace(cursor.peek()) };
  } };
}
function* string(cursor: ModelTextCursor): ModelWorkGenerator<string | ModelJsonString> {
  yield 'scalars'; check(cursor.take() === '"');
  const result = new ModelJsonStringBuilder();
  let state: 'plain' | 'escape' | 'unicode' = 'plain'; let code = 0; let hexadecimal = 0;
  yield { unit: 'scalars', run(limit) {
    let used = 0;
    while (used < limit) {
      if (state === 'plain') {
        const span = cursor.span(limit - used); check(span.length > 0);
        const special = span.search(/["\\\u0000-\u001f]/);
        const length = special < 0 ? span.length : special;
        if (length) { result.append(span.slice(0, length)); cursor.advance(length); used += length; }
        if (special < 0) continue;
        const value = cursor.take()!; used++;
        if (value === '"') return { used, done: true };
        check(value === '\\'); state = 'escape';
      } else {
        const value = cursor.take(); used++; check(value !== undefined);
        if (state === 'escape') {
          if (value === 'u') { state = 'unicode'; code = 0; hexadecimal = 0; }
          else { check(Object.hasOwn(escapes, value)); result.append(escapes[value]!); state = 'plain'; }
        } else {
          check(/^[0-9a-fA-F]$/.test(value)); code = code * 16 + parseInt(value, 16);
          if (++hexadecimal === 4) { result.append(String.fromCharCode(code)); state = 'plain'; }
        }
      }
    }
    return { used, done: false };
  } };
  return result.finish();
}
function* numeric(cursor: ModelTextCursor): ModelWorkGenerator<number> {
  let negative = false; let significant = ''; let digits = 0; let fractional = 0; let nonzero = false; let sticky = false;
  if (cursor.peek() === '-') { yield 'scalars'; cursor.take(); negative = true; }
  const consume = (fraction: boolean): void => {
    const value = cursor.take()!;
    if (fraction) fractional++;
    if (value !== '0') nonzero = true;
    if (nonzero) { digits++; if (significant.length < 800) significant += value; else if (value !== '0') sticky = true; }
  };
  const sequence = function* (fraction: boolean): ModelWorkGenerator<void> {
    yield { unit: 'scalars', run(limit) {
      let used = 0;
      while (used < limit && digit(cursor.peek())) { consume(fraction); used++; }
      return { used, done: !digit(cursor.peek()) };
    } };
  };
  if (cursor.peek() === '0') { yield 'scalars'; consume(false); check(!digit(cursor.peek())); }
  else { check(digit(cursor.peek()) && cursor.peek() !== '0'); yield* sequence(false); }
  if (cursor.peek() === '.') {
    yield 'scalars'; cursor.take(); check(digit(cursor.peek()));
    yield* sequence(true);
  }
  let exponent = 0; let exponentSign = 1;
  if (cursor.peek() === 'e' || cursor.peek() === 'E') {
    yield 'scalars'; cursor.take();
    if (cursor.peek() === '+' || cursor.peek() === '-') { yield 'scalars'; if (cursor.take() === '-') exponentSign = -1; }
    check(digit(cursor.peek()));
    yield { unit: 'scalars', run(limit) {
      let used = 0;
      while (used < limit && digit(cursor.peek())) { exponent = Math.min(1_000_000_000, exponent * 10 + Number(cursor.take())); used++; }
      return { used, done: !digit(cursor.peek()) };
    } };
  }
  if (!nonzero) return negative ? -0 : 0;
  // Binary64 midpoint decimals have fewer than 800 significant digits. Retain a sticky tail
  // beyond that bound so exact ties round in the same direction without parsing an input-sized token.
  if (sticky) significant += '1';
  return Number(`${negative ? '-' : ''}${significant}e${exponentSign * exponent - fractional + digits - significant.length}`);
}
function* value(cursor: ModelTextCursor): ModelWorkGenerator<ModelJsonValue> {
  yield* spaces(cursor);
  const first = cursor.peek();
  if (first === '"') return yield* string(cursor);
  if (first === '-' || digit(first)) return yield* numeric(cursor);
  if (first === '[') {
    yield 'scalars'; cursor.take(); const result: ModelJsonValue[] = []; yield* spaces(cursor);
    if (cursor.peek() === ']') { yield 'scalars'; cursor.take(); return result; }
    for (;;) {
      result.push(yield* value(cursor)); yield* spaces(cursor);
      yield 'scalars'; const next = cursor.take(); if (next === ']') return result; check(next === ',');
    }
  }
  if (first === '{') {
    yield 'scalars'; cursor.take(); const result: Record<string, ModelJsonValue> = {}; yield* spaces(cursor);
    if (cursor.peek() === '}') { yield 'scalars'; cursor.take(); return result; }
    for (;;) {
      yield* spaces(cursor); const decodedKey = yield* string(cursor);
      // No admitted field name is this long. Keep its insertion position until policy refusal,
      // after the entire document has passed syntax and UTF-8 validation.
      const key = typeof decodedKey === 'string' ? decodedKey : '\0oversized-json-key';
      yield* spaces(cursor);
      yield 'scalars'; check(cursor.take() === ':');
      const entry = yield* value(cursor);
      Object.defineProperty(result, key, { value: entry, writable: true, configurable: true, enumerable: true });
      yield* spaces(cursor); yield 'scalars'; const next = cursor.take(); if (next === '}') return result; check(next === ',');
    }
  }
  for (const [token, output] of [['true', true], ['false', false], ['null', null]] as const) {
    if (first !== token.charAt(0)) continue;
    for (const character of token) { yield 'scalars'; check(cursor.take() === character); }
    return output;
  }
  check(false);
}
export function* readModelJson(bytes: Uint8Array): ModelWorkGenerator<ModelJsonRecord> {
  let depth = 0; let tokens = 0; let quoted = false; let escaped = false;
  let offset = 0;
  if (bytes.length) yield { unit: 'bytes', run(limit) {
    const end = Math.min(offset + limit, bytes.length); const used = end - offset;
    while (offset < end) {
      const byte = bytes[offset++]!;
      if (quoted) { if (escaped) escaped = false; else if (byte === 92) escaped = true; else if (byte === 34) quoted = false; }
      else if (byte === 34) { quoted = true; tokens++; }
      else if (byte === 123 || byte === 91) { depth++; tokens++; }
      else if (byte === 125 || byte === 93) depth--;
      else if (byte === 44 || byte === 58) tokens++;
      check(depth <= LIMIT.jsonDepth && tokens <= LIMIT.jsonTokens, 'limit');
    }
    return { used, done: offset === bytes.length };
  } };
  check(depth === 0 && !quoted);
  const cursor = new ModelTextCursor(yield* decodeModelText(bytes));
  const result = yield* value(cursor); yield* spaces(cursor); check(cursor.peek() === undefined);
  check(result !== null && typeof result === 'object' && !Array.isArray(result) && !(result instanceof ModelJsonString));
  return result as ModelJsonRecord;
}
export const createModelJsonWork = (bytes: Uint8Array) => createModelGeneratorWork(() => readModelJson(bytes));
