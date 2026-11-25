import { AdmissionFailure, DEFAULT_LIMIT_VALUES, HARD_LIMIT_VALUES, admitJson, errorDiagnostic, pointerSegment, resolveLimitValues, safeKey, validateSchemaValue } from './json-admission.js';
import type { JsonValue, LyraGenLimits, LyraGenResult, LyraGenSchema } from './types.js';

export const HARD_LIMITS: Readonly<LyraGenLimits> = HARD_LIMIT_VALUES;
export const DEFAULT_LIMITS: Readonly<LyraGenLimits> = DEFAULT_LIMIT_VALUES;

/** Invalid overrides use defaults; finite positive overrides can never exceed hard ceilings. */
export function resolveLimits(overrides?: Partial<LyraGenLimits>): Readonly<LyraGenLimits> {
  return resolveLimitValues(overrides);
}

export function isSafeKey(key: string): boolean {
  return safeKey(key);
}

export function escapePointerSegment(value: string): string {
  return pointerSegment(value);
}

/** Copies and freezes plain JSON without invoking accessor properties or toJSON hooks. */
export function snapshotJson(input: unknown, overrides?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
  return admitJson(input, resolveLimitValues(overrides)).result;
}

/** Parse bounded JSON; duplicate property names are rejected instead of silently overwritten. */
export function parseJson(source: string, overrides?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
  const limits = resolveLimits(overrides);
  if (typeof source !== 'string' || source.length > limits.maxBytes || new TextEncoder().encode(source).byteLength > limits.maxBytes) {
    return { ok: false, diagnostics: [errorDiagnostic('limit.bytes', '', 'JSON source exceeds the byte limit.')] };
  }
  // Preflight nesting before JSON.parse, and retain each object's decoded member names.
  const stack: ({ kind: '{'; keys: Set<string>; expectingKey: boolean } | { kind: '[' })[] = [];
  try {
    for (let index = 0; index < source.length; index++) {
      const character = source[index];
      if (character === '"') {
        const start = index++;
        while (index < source.length) {
          if (source[index] === '\\') { index += 2; continue; }
          if (source[index] === '"') break;
          index++;
        }
        const top = stack.at(-1);
        if (top?.kind === '{' && top.expectingKey) {
          const key: unknown = JSON.parse(source.slice(start, index + 1));
          if (typeof key !== 'string' || top.keys.has(key)) throw new AdmissionFailure(errorDiagnostic('json.duplicate-key', '', 'Duplicate object properties are not permitted.'));
          top.keys.add(key);
          top.expectingKey = false;
        }
      } else if (character === '{' || character === '[') {
        stack.push(character === '{' ? { kind: '{', keys: new Set(), expectingKey: true } : { kind: '[' });
        if (stack.length > limits.maxDepth + 1) throw new AdmissionFailure(errorDiagnostic('limit.depth', '', 'JSON exceeds the nesting limit.'));
      } else if (character === '}' || character === ']') {
        stack.pop();
      } else if (character === ',') {
        const top = stack.at(-1);
        if (top?.kind === '{') top.expectingKey = true;
      }
    }
    const value: unknown = JSON.parse(source);
    return snapshotJson(value, limits);
  } catch (error: unknown) {
    return { ok: false, diagnostics: [error instanceof AdmissionFailure ? error.diagnostic : errorDiagnostic('json.syntax', '', 'Invalid JSON syntax.')] };
  }
}

/** Validates the supported schema subset and returns an owned immutable value on success. */
export function validateSchema(input: unknown, schema: LyraGenSchema, overrides?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
  return validateSchemaValue(input, schema, resolveLimitValues(overrides));
}
