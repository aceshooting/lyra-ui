import { jsonStringBytes } from './json-bytes.js';
import type { JsonValue, LyraGenDiagnostic, LyraGenLimits, LyraGenResult, LyraGenSchema } from './types.js';

export const HARD_LIMITS: Readonly<LyraGenLimits> = Object.freeze({
  maxBytes: 4_194_304, maxDepth: 64, maxNodes: 100_000, maxStringLength: 262_144,
  maxArrayLength: 10_000, maxObjectKeys: 1_024, maxDiagnostics: 100
});
export const DEFAULT_LIMITS: Readonly<LyraGenLimits> = Object.freeze({
  maxBytes: 1_048_576, maxDepth: 32, maxNodes: 20_000, maxStringLength: 65_536,
  maxArrayLength: 2_000, maxObjectKeys: 256, maxDiagnostics: 20
});

/** Invalid overrides use defaults; finite positive overrides can never exceed hard ceilings. */
export function resolveLimits(overrides: Partial<LyraGenLimits> = {}): Readonly<LyraGenLimits> {
  const result = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS) as (keyof LyraGenLimits)[]) {
    const descriptor = Object.getOwnPropertyDescriptor(overrides, key);
    const value: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      result[key] = Math.min(HARD_LIMITS[key], Math.max(1, Math.floor(value)));
    }
  }
  return Object.freeze(result);
}

export function isSafeKey(key: string): boolean {
  return key !== '__proto__' && key !== 'prototype' && key !== 'constructor';
}

export function escapePointerSegment(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

function diagnostic(code: string, path: string, message: string): LyraGenDiagnostic {
  return { code, path, message, severity: 'error' };
}

class AdmissionFailure {
  constructor(readonly diagnostic: LyraGenDiagnostic) {}
}

/** Copies and freezes plain JSON without invoking accessor properties or toJSON hooks. */
export function snapshotJson(input: unknown, overrides?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
  const limits = resolveLimits(overrides);
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  let bytes = 0;
  const fail = (code: string, path: string, message: string): never => {
    throw new AdmissionFailure(diagnostic(code, path, message));
  };
  const count = (amount: number, path: string) => {
    bytes += amount;
    if (bytes > limits.maxBytes) fail('limit.bytes', path, 'JSON exceeds the byte limit.');
  };
  const stringBytes = (value: string, path: string) => {
    if (value.length > limits.maxStringLength) fail('limit.string', path, 'String exceeds the length limit.');
    count(jsonStringBytes(value), path);
  };
  const visit = (value: unknown, path: string, depth: number): JsonValue => {
    if (++nodes > limits.maxNodes) fail('limit.nodes', path, 'JSON exceeds the value count limit.');
    if (depth > limits.maxDepth) fail('limit.depth', path, 'JSON exceeds the nesting limit.');
    if (value === null) { count(4, path); return null; }
    if (typeof value === 'string') { stringBytes(value, path); return value; }
    if (typeof value === 'boolean') { count(value ? 4 : 5, path); return value; }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('json.number', path, 'Numbers must be finite.');
      count(String(value).length, path);
      return value;
    }
    if (typeof value !== 'object' || value === null) return fail('json.type', path, 'Only JSON values are permitted.');
    if (ancestors.has(value)) return fail('json.cycle', path, 'Cyclic values are not permitted.');
    const array = Array.isArray(value);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null) {
      return fail('json.prototype', path, 'Objects must have a plain prototype.');
    }
    if (array && prototype !== Array.prototype) return fail('json.prototype', path, 'Arrays must have the standard prototype.');
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    if (array) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      const length: unknown = lengthDescriptor?.value;
      if (typeof length !== 'number' || length > limits.maxArrayLength) return fail('limit.array', path, 'Array exceeds the item limit.');
      if (keys.length !== length + 1) return fail('json.array', path, 'Sparse arrays and extra array properties are not permitted.');
      count(2 + Math.max(0, length - 1), path);
      const result: JsonValue[] = [];
      for (let index = 0; index < length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        const childPath = `${path}/${index}`;
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('json.accessor', childPath, 'Only enumerable data properties are permitted.');
        result.push(visit(descriptor.value, childPath, depth + 1));
      }
      ancestors.delete(value);
      return Object.freeze(result);
    }
    if (keys.length > limits.maxObjectKeys) return fail('limit.keys', path, 'Object exceeds the property limit.');
    count(2 + Math.max(0, keys.length - 1), path);
    const result: Record<string, JsonValue> = {};
    for (const key of keys) {
      if (typeof key !== 'string') return fail('json.key', path, 'Symbol properties are not permitted.');
      const childPath = `${path}/${escapePointerSegment(key)}`;
      if (!isSafeKey(key)) return fail('json.key', childPath, 'Prototype-related keys are not permitted.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('json.accessor', childPath, 'Only enumerable data properties are permitted.');
      stringBytes(key, childPath);
      count(1, childPath);
      result[key] = visit(descriptor.value, childPath, depth + 1);
    }
    ancestors.delete(value);
    return Object.freeze(result);
  };
  try {
    return { ok: true, value: visit(input, '', 0), diagnostics: [] };
  } catch (error: unknown) {
    return { ok: false, diagnostics: [error instanceof AdmissionFailure ? error.diagnostic : diagnostic('json.unreadable', '', 'Value could not be inspected safely.')] };
  }
}

/** Parse bounded JSON; duplicate property names are rejected instead of silently overwritten. */
export function parseJson(source: string, overrides?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
  const limits = resolveLimits(overrides);
  if (typeof source !== 'string' || source.length > limits.maxBytes || new TextEncoder().encode(source).byteLength > limits.maxBytes) {
    return { ok: false, diagnostics: [diagnostic('limit.bytes', '', 'JSON source exceeds the byte limit.')] };
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
          if (typeof key !== 'string' || top.keys.has(key)) throw new AdmissionFailure(diagnostic('json.duplicate-key', '', 'Duplicate object properties are not permitted.'));
          top.keys.add(key);
          top.expectingKey = false;
        }
      } else if (character === '{' || character === '[') {
        stack.push(character === '{' ? { kind: '{', keys: new Set(), expectingKey: true } : { kind: '[' });
        if (stack.length > limits.maxDepth + 1) throw new AdmissionFailure(diagnostic('limit.depth', '', 'JSON exceeds the nesting limit.'));
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
    return { ok: false, diagnostics: [error instanceof AdmissionFailure ? error.diagnostic : diagnostic('json.syntax', '', 'Invalid JSON syntax.')] };
  }
}

/** Validates the supported schema subset and returns an owned immutable value on success. */
export function validateSchema(input: unknown, schema: LyraGenSchema, overrides?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
  const limits = resolveLimits(overrides);
  const admitted = snapshotJson(input, limits);
  if (!admitted.ok) return admitted;
  const schemaResult = snapshotJson(schema, limits);
  if (!schemaResult.ok) return { ok: false, diagnostics: [diagnostic('schema.invalid', '', 'Schema must be bounded plain JSON.')] };
  const diagnostics: LyraGenDiagnostic[] = [];
  const report = (code: string, path: string, message: string) => {
    if (diagnostics.length < limits.maxDiagnostics) diagnostics.push(diagnostic(code, path, message));
  };
  let work = 0;
  const check = (value: JsonValue, current: LyraGenSchema, path: string): boolean => {
    if (++work > limits.maxNodes) { report('limit.validation', path, 'Schema validation exceeds the work limit.'); return false; }
    if (current.enum) {
      let found = false;
      for (const item of current.enum) {
        if (++work > limits.maxNodes) { report('limit.validation', path, 'Schema validation exceeds the work limit.'); return false; }
        if (item === value) { found = true; break; }
      }
      if (!found) { report('schema.enum', path, 'Value is not an admitted enum member.'); return false; }
    }
    if ('anyOf' in current) {
      const before = diagnostics.length;
      for (const branch of current.anyOf) {
        if (check(value, branch, path)) { diagnostics.length = before; return true; }
        diagnostics.length = before;
        if (work > limits.maxNodes) break;
      }
      report(work > limits.maxNodes ? 'limit.validation' : 'schema.any-of', path, 'Value does not match an admitted schema alternative.');
      return false;
    }
    let valid = true;
    const invalid = (code: string, message: string) => { valid = false; report(code, path, message); };
    switch (current.type) {
      case 'null': if (value !== null) invalid('schema.type', 'Expected null.'); break;
      case 'boolean': if (typeof value !== 'boolean') invalid('schema.type', 'Expected a boolean.'); break;
      case 'string':
        if (typeof value !== 'string') invalid('schema.type', 'Expected a string.');
        else {
          let length = 0;
          for (let index = 0; index < value.length; index++, length++) {
            if ((value.codePointAt(index) ?? 0) > 0xffff) index++;
          }
          if (length < (current.minLength ?? 0) || length > (current.maxLength ?? limits.maxStringLength)) invalid('schema.length', 'String length is outside the admitted range.');
        }
        break;
      case 'number': case 'integer':
        if (typeof value !== 'number' || (current.type === 'integer' && !Number.isInteger(value))) invalid('schema.type', 'Expected a finite number of the declared type.');
        else if (value < (current.minimum ?? -Infinity) || value > (current.maximum ?? Infinity)) invalid('schema.range', 'Number is outside the admitted range.');
        break;
      case 'array':
        if (!Array.isArray(value)) invalid('schema.type', 'Expected an array.');
        else {
          if (value.length < (current.minItems ?? 0) || value.length > (current.maxItems ?? limits.maxArrayLength)) invalid('schema.length', 'Array length is outside the admitted range.');
          for (let index = 0; index < value.length && work <= limits.maxNodes; index++) if (!check(value[index] as JsonValue, current.items, `${path}/${index}`)) valid = false;
        }
        break;
      case 'object':
        if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid('schema.type', 'Expected an object.');
        else {
          const object = value as Record<string, JsonValue>;
          for (const name of current.required ?? []) {
            if (++work > limits.maxNodes) { valid = false; report('limit.validation', path, 'Schema validation exceeds the work limit.'); break; }
            if (!Object.hasOwn(object, name)) { valid = false; report('schema.required', `${path}/${escapePointerSegment(name)}`, 'Required property is missing.'); }
          }
          for (const [name, child] of Object.entries(object)) {
            const childPath = `${path}/${escapePointerSegment(name)}`;
            if (!Object.hasOwn(current.properties, name)) { valid = false; report('schema.property', childPath, 'Property is not admitted by the schema.'); }
            else if (!check(child, current.properties[name] as LyraGenSchema, childPath)) valid = false;
            if (work > limits.maxNodes) break;
          }
        }
        break;
    }
    return valid;
  };
  const structural = inspectSchema(schemaResult.value, limits);
  if (!structural) return { ok: false, diagnostics: [diagnostic('schema.invalid', '', 'Schema uses an unsupported or malformed contract.')] };
  const valid = check(admitted.value, schemaResult.value as unknown as LyraGenSchema, '');
  return valid ? admitted : { ok: false, diagnostics };
}

function inspectSchema(value: JsonValue, limits: LyraGenLimits): boolean {
  let count = 0;
  const inspect = (input: JsonValue): boolean => {
    if (++count > limits.maxNodes || input === null || typeof input !== 'object' || Array.isArray(input)) return false;
    const schema = input as Record<string, JsonValue>;
    const allowed = new Set(['type', 'description', 'enum', 'default']);
    if (schema['description'] !== undefined && typeof schema['description'] !== 'string') return false;
    if (schema['enum'] !== undefined && (!Array.isArray(schema['enum']) || schema['enum'].length === 0 || schema['enum'].some(item => item !== null && typeof item === 'object'))) return false;
    const bound = (key: string, integer = true) => schema[key] === undefined || (typeof schema[key] === 'number' && (!integer || (Number.isSafeInteger(schema[key]) && schema[key] >= 0)));
    if ('anyOf' in schema) {
      allowed.add('anyOf');
      if ('type' in schema || !Array.isArray(schema['anyOf']) || schema['anyOf'].length === 0 || schema['anyOf'].length > 16 || !schema['anyOf'].every(inspect)) return false;
    } else switch (schema['type']) {
      case 'string':
        allowed.add('minLength'); allowed.add('maxLength');
        if (!bound('minLength') || !bound('maxLength') || Number(schema['minLength'] ?? 0) > Number(schema['maxLength'] ?? Infinity)) return false;
        break;
      case 'number': case 'integer':
        allowed.add('minimum'); allowed.add('maximum');
        if (!bound('minimum', false) || !bound('maximum', false) || Number(schema['minimum'] ?? -Infinity) > Number(schema['maximum'] ?? Infinity)) return false;
        break;
      case 'boolean': case 'null': break;
      case 'array':
        for (const key of ['items', 'minItems', 'maxItems']) allowed.add(key);
        if (!bound('minItems') || !bound('maxItems') || Number(schema['minItems'] ?? 0) > Number(schema['maxItems'] ?? Infinity) || schema['items'] === undefined || !inspect(schema['items'])) return false;
        break;
      case 'object': {
        for (const key of ['properties', 'required', 'additionalProperties']) allowed.add(key);
        const properties = schema['properties'];
        if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return false;
        if (schema['additionalProperties'] !== undefined && schema['additionalProperties'] !== false) return false;
        if (schema['required'] !== undefined && (!Array.isArray(schema['required']) || schema['required'].some(key => typeof key !== 'string' || !Object.hasOwn(properties, key)) || new Set(schema['required']).size !== schema['required'].length)) return false;
        if (!Object.values(properties).every(inspect)) return false;
        break;
      }
      default: return false;
    }
    return Object.keys(schema).every(key => allowed.has(key));
  };
  return inspect(value);
}
