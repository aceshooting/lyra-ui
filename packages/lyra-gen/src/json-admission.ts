import { jsonStringBytes } from './json-bytes.js';
import type { JsonValue, LyraGenDiagnostic, LyraGenLimits, LyraGenMapSchema, LyraGenResult, LyraGenSchema } from './types.js';

/*
 * Bounded JSON admission and schema validation. `schema.ts` exposes the public surface; validation
 * internals call these directly with already resolved limits and already admitted values.
 */

export const HARD_LIMIT_VALUES: Readonly<LyraGenLimits> = Object.freeze({
  maxBytes: 4_194_304, maxDepth: 64, maxNodes: 100_000, maxStringLength: 262_144,
  maxArrayLength: 10_000, maxObjectKeys: 1_024, maxDiagnostics: 100
});
export const DEFAULT_LIMIT_VALUES: Readonly<LyraGenLimits> = Object.freeze({
  maxBytes: 1_048_576, maxDepth: 32, maxNodes: 20_000, maxStringLength: 65_536,
  maxArrayLength: 2_000, maxObjectKeys: 256, maxDiagnostics: 20
});
const LIMIT_NAMES = Object.keys(DEFAULT_LIMIT_VALUES) as (keyof LyraGenLimits)[];

function computeLimits(overrides: Partial<LyraGenLimits>): Readonly<LyraGenLimits> {
  const result = { ...DEFAULT_LIMIT_VALUES };
  for (const key of LIMIT_NAMES) {
    const descriptor = Object.getOwnPropertyDescriptor(overrides, key);
    const value: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      result[key] = Math.min(HARD_LIMIT_VALUES[key], Math.max(1, Math.floor(value)));
    }
  }
  return Object.freeze(result);
}

/** Frozen overrides (including every resolved result) cannot change, so their resolution is reused. */
const resolvedLimits = new WeakMap<object, Readonly<LyraGenLimits>>();
let defaultLimits: Readonly<LyraGenLimits> | undefined;
export function resolveLimitValues(overrides?: Partial<LyraGenLimits>): Readonly<LyraGenLimits> {
  if (overrides === undefined) return defaultLimits ??= remember(computeLimits({}));
  const cacheable = typeof overrides === 'object' && overrides !== null && Object.isFrozen(overrides);
  const cached = cacheable ? resolvedLimits.get(overrides) : undefined;
  if (cached) return cached;
  const result = remember(computeLimits(overrides));
  if (cacheable) resolvedLimits.set(overrides, result);
  return result;
}
function remember(limits: Readonly<LyraGenLimits>): Readonly<LyraGenLimits> {
  resolvedLimits.set(limits, limits);
  return limits;
}

const limitKeys = new WeakMap<Readonly<LyraGenLimits>, string>();
/** A value identity for resolved limits, so caches can compare two resolutions cheaply. */
export function limitsKey(limits: Readonly<LyraGenLimits>): string {
  let key = limitKeys.get(limits);
  if (key === undefined) { key = LIMIT_NAMES.map(name => limits[name]).join(','); limitKeys.set(limits, key); }
  return key;
}

export function safeKey(key: string): boolean {
  return key !== '__proto__' && key !== 'prototype' && key !== 'constructor';
}

export function pointerSegment(value: string): string {
  return value.includes('~') || value.includes('/') ? value.replace(/~/g, '~0').replace(/\//g, '~1') : value;
}

/** JSON Pointer of a segment stack; built only when a diagnostic needs it. */
function pointerOf(segments: readonly string[]): string {
  let path = '';
  for (const segment of segments) path += '/' + pointerSegment(segment);
  return path;
}

/** Length in code points, so astral characters count once like JSON Schema string lengths. */
function codePointLength(value: string): number {
  let length = 0;
  for (let index = 0; index < value.length; index++, length++) {
    if ((value.codePointAt(index) ?? 0) > 0xffff) index++;
  }
  return length;
}

export function errorDiagnostic(code: string, path: string, message: string): LyraGenDiagnostic {
  return { code, path, message, severity: 'error' };
}

export class AdmissionFailure {
  constructor(readonly diagnostic: LyraGenDiagnostic) {}
}

/** The admitted copy of one view node with what admitting it counted, for reuse inside a larger view. */
interface AdmittedNode {
  readonly value: JsonValue;
  readonly nodes: number;
  readonly bytes: number;
  /** Deepest nesting below the node itself. */
  readonly height: number;
}
/** Admitted view nodes keyed by their (immutable) input objects. */
export type NodeAdmissions = WeakMap<object, AdmittedNode>;

interface JsonAdmission {
  readonly result: LyraGenResult<JsonValue>;
  /** Whether every object and array of an admitted input was already frozen. */
  readonly frozen: boolean;
}

const OTHER = 0, VIEW = 1, NODE = 2, CHILDREN = 3;

/**
 * Copy and freeze plain JSON without invoking accessor properties or toJSON hooks. With
 * `nodeAdmissions`, the input is a view: node objects found in the map are reused with their counts
 * instead of being copied again, and every newly admitted node is added. Limits are enforced on the
 * same totals, but a failure's diagnostic may then differ from a plain admission's, so such callers
 * fall back to plain admission to report it.
 */
export function admitJson(input: unknown, limits: Readonly<LyraGenLimits>, nodeAdmissions?: NodeAdmissions, trackFrozen = false): JsonAdmission {
  const ancestors = new WeakSet<object>();
  const segments: string[] = [];
  let nodes = 0;
  let bytes = 0;
  let deepest = 0;
  let frozen = true;
  const fail = (code: string, message: string): never => {
    throw new AdmissionFailure(errorDiagnostic(code, pointerOf(segments), message));
  };
  const count = (amount: number) => {
    bytes += amount;
    if (bytes > limits.maxBytes) fail('limit.bytes', 'JSON exceeds the byte limit.');
  };
  const stringBytes = (value: string) => {
    if (value.length > limits.maxStringLength) fail('limit.string', 'String exceeds the length limit.');
    count(jsonStringBytes(value));
  };
  const visit = (value: unknown, depth: number, role: number): JsonValue => {
    if (role === NODE && value !== null && typeof value === 'object') {
      const admitted = nodeAdmissions!.get(value);
      if (admitted) {
        nodes += admitted.nodes;
        if (nodes > limits.maxNodes) fail('limit.nodes', 'JSON exceeds the value count limit.');
        if (depth + admitted.height > limits.maxDepth) fail('limit.depth', 'JSON exceeds the nesting limit.');
        count(admitted.bytes);
        if (depth + admitted.height > deepest) deepest = depth + admitted.height;
        return admitted.value;
      }
      const startNodes = nodes, startBytes = bytes, outerDeepest = deepest;
      deepest = depth;
      const result = visitValue(value, depth, role);
      nodeAdmissions!.set(value, { value: result, nodes: nodes - startNodes, bytes: bytes - startBytes, height: deepest - depth });
      if (outerDeepest > deepest) deepest = outerDeepest;
      return result;
    }
    return visitValue(value, depth, role);
  };
  const visitValue = (value: unknown, depth: number, role: number): JsonValue => {
    if (++nodes > limits.maxNodes) fail('limit.nodes', 'JSON exceeds the value count limit.');
    if (depth > limits.maxDepth) fail('limit.depth', 'JSON exceeds the nesting limit.');
    if (depth > deepest) deepest = depth;
    if (value === null) { count(4); return null; }
    if (typeof value === 'string') { stringBytes(value); return value; }
    if (typeof value === 'boolean') { count(value ? 4 : 5); return value; }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('json.number', 'Numbers must be finite.');
      count(String(value).length);
      return value;
    }
    if (typeof value !== 'object' || value === null) return fail('json.type', 'Only JSON values are permitted.');
    if (ancestors.has(value)) return fail('json.cycle', 'Cyclic values are not permitted.');
    const array = Array.isArray(value);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null) {
      return fail('json.prototype', 'Objects must have a plain prototype.');
    }
    if (array && prototype !== Array.prototype) return fail('json.prototype', 'Arrays must have the standard prototype.');
    if (trackFrozen && frozen && !Object.isFrozen(value)) frozen = false;
    const keys = Reflect.ownKeys(value);
    ancestors.add(value);
    if (array) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      const length: unknown = lengthDescriptor?.value;
      if (typeof length !== 'number' || length > limits.maxArrayLength) return fail('limit.array', 'Array exceeds the item limit.');
      if (keys.length !== length + 1) return fail('json.array', 'Sparse arrays and extra array properties are not permitted.');
      count(2 + Math.max(0, length - 1));
      const itemRole = role === CHILDREN ? NODE : OTHER;
      const result: JsonValue[] = [];
      for (let index = 0; index < length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        segments.push(String(index));
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('json.accessor', 'Only enumerable data properties are permitted.');
        result.push(visit(descriptor.value, depth + 1, itemRole));
        segments.pop();
      }
      ancestors.delete(value);
      return Object.freeze(result);
    }
    if (keys.length > limits.maxObjectKeys) return fail('limit.keys', 'Object exceeds the property limit.');
    count(2 + Math.max(0, keys.length - 1));
    const result: Record<string, JsonValue> = {};
    for (const key of keys) {
      if (typeof key !== 'string') return fail('json.key', 'Symbol properties are not permitted.');
      segments.push(key);
      if (!safeKey(key)) return fail('json.key', 'Prototype-related keys are not permitted.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return fail('json.accessor', 'Only enumerable data properties are permitted.');
      stringBytes(key);
      count(1);
      const childRole = role === VIEW ? (key === 'root' ? NODE : OTHER) : role === NODE && key === 'children' ? CHILDREN : OTHER;
      result[key] = visit(descriptor.value, depth + 1, childRole);
      segments.pop();
    }
    ancestors.delete(value);
    return Object.freeze(result);
  };
  try {
    return { result: { ok: true, value: visit(input, 0, nodeAdmissions ? VIEW : OTHER), diagnostics: [] }, frozen };
  } catch (error: unknown) {
    return { result: { ok: false, diagnostics: [error instanceof AdmissionFailure ? error.diagnostic : errorDiagnostic('json.unreadable', '', 'Value could not be inspected safely.')] }, frozen: false };
  }
}

type CompiledSchema = { readonly ok: true; readonly value: LyraGenSchema; readonly structural: boolean } | { readonly ok: false; readonly result: LyraGenResult<JsonValue> };
/**
 * Admitted schemas by object and limits. Only a schema whose every object was already frozen is
 * kept: its admission and structural inspection cannot change between calls.
 */
const compiledSchemas = new WeakMap<object, Map<string, CompiledSchema>>();
function compileSchema(schema: LyraGenSchema, limits: Readonly<LyraGenLimits>): CompiledSchema {
  const cacheable = schema !== null && typeof schema === 'object';
  const key = cacheable ? limitsKey(limits) : '';
  const cached = cacheable ? compiledSchemas.get(schema)?.get(key) : undefined;
  if (cached) return cached;
  const admitted = admitJson(schema, limits, undefined, true);
  if (!admitted.result.ok) {
    return { ok: false, result: admitted.result.diagnostics.every(item => item.code.startsWith('limit.')) ? admitted.result : { ok: false, diagnostics: [errorDiagnostic('schema.invalid', '', 'Schema must be bounded plain JSON.')] } };
  }
  const compiled: CompiledSchema = { ok: true, value: admitted.result.value as unknown as LyraGenSchema, structural: inspectSchema(admitted.result.value, limits) };
  if (cacheable && admitted.frozen) {
    let byLimits = compiledSchemas.get(schema);
    if (!byLimits) compiledSchemas.set(schema, byLimits = new Map());
    byLimits.set(key, compiled);
  }
  return compiled;
}

/** Validate a value against a schema. */
export function validateSchemaValue(input: unknown, schema: LyraGenSchema, limits: Readonly<LyraGenLimits>): LyraGenResult<JsonValue> {
  const admitted = admitJson(input, limits).result;
  if (!admitted.ok) return admitted;
  return validateAdmittedValue(admitted.value, schema, limits) ?? admitted;
}

/**
 * Validate a value that is already part of an admitted snapshot made under the same limits (a part
 * of an admitted value always admits on its own). Returns the failure, or undefined when valid.
 */
export function validateAdmittedValue(value: JsonValue, schema: LyraGenSchema, limits: Readonly<LyraGenLimits>): LyraGenResult<JsonValue> | undefined {
  const compiled = compileSchema(schema, limits);
  if (!compiled.ok) return compiled.result;
  if (!compiled.structural) return { ok: false, diagnostics: [errorDiagnostic('schema.invalid', '', 'Schema uses an unsupported or malformed contract.')] };
  const diagnostics: LyraGenDiagnostic[] = [];
  const segments: string[] = [];
  const report = (code: string, message: string, member?: string) => {
    if (diagnostics.length < limits.maxDiagnostics) diagnostics.push(errorDiagnostic(code, member === undefined ? pointerOf(segments) : `${pointerOf(segments)}/${pointerSegment(member)}`, message));
  };
  let work = 0;
  const check = (value: JsonValue, current: LyraGenSchema): boolean => {
    if (++work > limits.maxNodes) { report('limit.validation', 'Schema validation exceeds the work limit.'); return false; }
    if (current.enum) {
      let found = false;
      for (const item of current.enum) {
        if (++work > limits.maxNodes) { report('limit.validation', 'Schema validation exceeds the work limit.'); return false; }
        if (item === value) { found = true; break; }
      }
      if (!found) { report('schema.enum', 'Value is not an admitted enum member.'); return false; }
    }
    if ('anyOf' in current) {
      const before = diagnostics.length;
      for (const branch of current.anyOf) {
        if (check(value, branch)) { diagnostics.length = before; return true; }
        diagnostics.length = before;
        if (work > limits.maxNodes) break;
      }
      report(work > limits.maxNodes ? 'limit.validation' : 'schema.any-of', 'Value does not match an admitted schema alternative.');
      return false;
    }
    let valid = true;
    const invalid = (code: string, message: string) => { valid = false; report(code, message); };
    switch (current.type) {
      case 'null': if (value !== null) invalid('schema.type', 'Expected null.'); break;
      case 'boolean': if (typeof value !== 'boolean') invalid('schema.type', 'Expected a boolean.'); break;
      case 'string':
        if (typeof value !== 'string') invalid('schema.type', 'Expected a string.');
        else {
          const length = codePointLength(value);
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
          for (let index = 0; index < value.length && work <= limits.maxNodes; index++) {
            segments.push(String(index));
            if (!check(value[index] as JsonValue, current.items)) valid = false;
            segments.pop();
          }
        }
        break;
      case 'object':
        if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid('schema.type', 'Expected an object.');
        else {
          const object = value as Record<string, JsonValue>;
          const map = typeof current.additionalProperties === 'object' ? current as LyraGenMapSchema : undefined;
          if (map) {
            const count = Object.keys(object).length;
            if (count < (map.minProperties ?? 0) || count > map.maxProperties) { invalid('schema.length', 'Object property count is outside the admitted range.'); break; }
          }
          for (const name of current.required ?? []) {
            if (++work > limits.maxNodes) { valid = false; report('limit.validation', 'Schema validation exceeds the work limit.'); break; }
            if (!Object.hasOwn(object, name)) { valid = false; report('schema.required', 'Required property is missing.', name); }
          }
          for (const [name, child] of Object.entries(object)) {
            segments.push(name);
            if (Object.hasOwn(current.properties, name)) { if (!check(child, current.properties[name] as LyraGenSchema)) valid = false; }
            else if (!map) { valid = false; report('schema.property', 'Property is not admitted by the schema.'); }
            else {
              const length = codePointLength(name);
              if (length < (map.propertyNames.minLength ?? 0) || length > map.propertyNames.maxLength) { valid = false; report('schema.property-name', 'Property name length is outside the admitted range.'); }
              else if (!check(child, map.additionalProperties)) valid = false;
            }
            segments.pop();
            if (work > limits.maxNodes) break;
          }
        }
        break;
    }
    return valid;
  };
  return check(value, compiled.value) ? undefined : { ok: false, diagnostics };
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
        const additional = schema['additionalProperties'];
        if (additional !== undefined && additional !== false) {
          // An open map is admitted only with explicit width and key-length ceilings.
          for (const key of ['minProperties', 'maxProperties', 'propertyNames']) allowed.add(key);
          if (additional === null || typeof additional !== 'object' || Array.isArray(additional) || !inspect(additional)) return false;
          const rawNames = schema['propertyNames'];
          if (rawNames === null || typeof rawNames !== 'object' || Array.isArray(rawNames)) return false;
          const names = rawNames as Record<string, JsonValue>;
          if (!Object.keys(names).every(key => key === 'type' || key === 'minLength' || key === 'maxLength') || (names['type'] !== undefined && names['type'] !== 'string')) return false;
          const count = (value: JsonValue | undefined) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
          if (!count(schema['maxProperties']) || (schema['minProperties'] !== undefined && !count(schema['minProperties'])) || Number(schema['minProperties'] ?? 0) > Number(schema['maxProperties'])) return false;
          if (!count(names['maxLength']) || (names['minLength'] !== undefined && !count(names['minLength'])) || Number(names['minLength'] ?? 0) > Number(names['maxLength'])) return false;
        }
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
