import { modelAdmissionCheck as check, chargeModelBytes, type ModelResourceBudget } from './model-admission-policy.js';
import { ModelJsonString, ModelJsonStringCursor } from './model-json-string.js';
import type { ModelWorkGenerator } from './model-work-generator.js';

const base64Value = (code: number): number => code >= 65 && code <= 90 ? code - 65 : code >= 97 && code <= 122 ? code - 71 : code >= 48 && code <= 57 ? code + 4 : code === 43 ? 62 : code === 47 ? 63 : -1;

export function* readModelDataUri<Mime extends string>(value: unknown, mimes: readonly Mime[], budget: ModelResourceBudget): ModelWorkGenerator<{ bytes: Uint8Array<ArrayBuffer>; mime: Mime; uri: string | ModelJsonString }> {
  check(typeof value === 'string' || value instanceof ModelJsonString, 'external-resource');
  const character = (index: number): string => value.charAt(index);
  const header = new ModelJsonStringCursor(value);
  if (value.length) yield { unit: 'scalars', run(limit) {
    let used = 0;
    while (used < limit && header.position < value.length) {
      const span = header.span(limit - used); const comma = span.indexOf(',');
      const count = comma < 0 ? span.length : comma; header.advance(count); used += count;
      if (comma >= 0) return { used, done: true };
    }
    return { used, done: header.position === value.length };
  } };
  const comma = header.position;
  const found = comma < value.length;
  const headerLength = found ? comma : Math.max(0, value.length - 1);
  let mime: Mime | undefined;
  for (const candidate of mimes) {
    const expected = `data:${candidate};base64`;
    if (headerLength !== expected.length) continue;
    let matches = true;
    for (let index = 0; index < expected.length; index++) { yield 'scalars'; if (character(index) !== expected.charAt(index)) matches = false; }
    if (matches) { mime = candidate; break; }
  }
  check(mime !== undefined, 'external-resource');
  // Legacy slice(comma + 1) consumes the whole input when no comma was found.
  const start = found ? comma + 1 : 0; const encodedLength = value.length - start;
  check(encodedLength > 0 && encodedLength % 4 === 0);
  const padding = character(value.length - 1) === '=' ? character(value.length - 2) === '=' ? 2 : 1 : 0;
  const length = encodedLength / 4 * 3 - padding;
  chargeModelBytes(budget, length);
  const validation = new ModelJsonStringCursor(value, start); const end = value.length - padding;
  if (validation.position < end) yield { unit: 'scalars', run(limit) {
    let used = 0;
    while (used < limit && validation.position < end) {
      const span = validation.span(Math.min(limit - used, end - validation.position));
      check(/^[A-Za-z0-9+/]+$/.test(span)); validation.advance(span.length); used += span.length;
    }
    return { used, done: validation.position === end };
  } };
  for (let i = value.length - padding; i < value.length; i++) { yield 'scalars'; check(character(i) === '='); }
  if (padding) check((base64Value(character(value.length - padding - 1).charCodeAt(0)) & (padding === 2 ? 15 : 3)) === 0);
  budget.allocations?.reserve('embedded', length);
  const bytes = new Uint8Array(length); let output = 0;
  const encoded = new ModelJsonStringCursor(value, start);
  yield { unit: 'records', run(limit) {
    const count = Math.min(limit, (value.length - encoded.position) / 4);
    for (let index = 0; index < count; index++) {
      const a = base64Value(encoded.takeCode()); const b = base64Value(encoded.takeCode());
      const c = base64Value(encoded.takeCode()); const d = base64Value(encoded.takeCode());
      bytes[output++] = (a << 2) | (b >> 4);
      if (output < length) bytes[output++] = (b << 4) | (c >> 2);
      if (output < length) bytes[output++] = (c << 6) | d;
    }
    return { used: count, done: encoded.position === value.length };
  } };
  return { bytes, mime, uri: value };
}
