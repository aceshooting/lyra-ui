import type { JsonPrimitive, LyraGenSchema } from './types.js';

/**
 * Model-facing hints for validation diagnostics. Hints are computed only after a check has failed,
 * and they name declared catalog vocabulary (component, property, slot, action, query and state
 * path names), schema bounds and expected shapes. They never repeat a generated value.
 */

const MAX_LISTED = 24;
const MAX_NAME = 64;

/** Bounded Levenshtein distance; returns `limit + 1` once the distance is known to exceed `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    let best = row;
    for (let column = 1; column <= b.length; column++) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      const value = Math.min(previous[column]! + 1, current[column - 1]! + 1, previous[column - 1]! + cost);
      current.push(value);
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length]!;
}

/** The declared name closest to `input` within `limit` edits; the first declared name wins a tie. */
export function nearestName(input: unknown, candidates: Iterable<string>, limit = 2): string | undefined {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_NAME) return undefined;
  let found: string | undefined;
  let best = limit + 1;
  for (const candidate of candidates) {
    if (candidate === input || candidate.length > MAX_NAME) continue;
    const measured = distance(input, candidate, Math.min(limit, best - 1));
    if (measured < best) { best = measured; found = candidate; if (best === 1) break; }
  }
  return best <= limit ? found : undefined;
}

/** A bounded, comma-separated list of declared names. */
export function listNames(names: readonly string[]): string {
  const shown = names.slice(0, MAX_LISTED).join(', ');
  return names.length > MAX_LISTED ? `${shown} and ${names.length - MAX_LISTED} more` : shown;
}

/** `Did you mean "x"? <Label>: a, b.` or `<Label>: a, b.`; an empty declaration uses `none`. */
export function unknownNameHint(input: unknown, declared: readonly string[], label: string, none: string): string {
  if (!declared.length) return none;
  const near = nearestName(input, declared);
  return `${near ? `Did you mean "${near}"? ` : ''}${label}: ${listNames(declared)}.`;
}

const primitive = (value: JsonPrimitive): string => typeof value === 'string' ? JSON.stringify(value.length > MAX_NAME ? `${value.slice(0, MAX_NAME)}...` : value) : String(value);
const article = (word: string): string => /^[aeiou]/u.test(word) ? `an ${word}` : `a ${word}`;
const between = (min: number | undefined, max: number | undefined, unit: string): string =>
  min !== undefined && max !== undefined ? (min === max ? `exactly ${min} ${unit}` : `${min} to ${max} ${unit}`)
    : min !== undefined ? `at least ${min} ${unit}` : max !== undefined ? `at most ${max} ${unit}` : '';

/** A short noun phrase for a schema: `a string of at most 8 characters`, `one of: "a", "b"`. */
function describeSchema(schema: LyraGenSchema, depth = 0): string {
  if (schema.enum?.length) return `one of: ${schema.enum.slice(0, MAX_LISTED).map(primitive).join(', ')}${schema.enum.length > MAX_LISTED ? ', ...' : ''}`;
  if ('anyOf' in schema) return depth > 1 ? 'one of several shapes' : `one of: ${schema.anyOf.slice(0, 6).map(branch => describeSchema(branch, depth + 1)).join(', ')}`;
  switch (schema.type) {
    case 'string': { const size = between(schema.minLength, schema.maxLength, 'characters'); return size ? `a string of ${size}` : 'a string'; }
    case 'number': case 'integer': {
      const { minimum: min, maximum: max } = schema;
      const range = min !== undefined && max !== undefined ? ` from ${min} to ${max}` : min !== undefined ? ` of at least ${min}` : max !== undefined ? ` of at most ${max}` : '';
      return `${article(schema.type)}${range}`;
    }
    case 'boolean': return 'true or false';
    case 'null': return 'null';
    case 'array': {
      const size = between(schema.minItems, schema.maxItems, 'items');
      return `an array${size ? ` of ${size}` : ''}${depth > 1 ? '' : `, each ${describeSchema(schema.items, depth + 1)}`}`;
    }
    case 'object': {
      const names = Object.keys(schema.properties);
      const required = schema.required ?? [];
      if (typeof schema.additionalProperties === 'object') return `an object of at most ${schema.maxProperties} entries`;
      if (!names.length) return 'an empty object';
      return `an object with ${required.length ? `required ${listNames(required)}` : `properties ${listNames(names)}`}`;
    }
  }
}

/** The sub-schema a value pointer (relative to the schema's root value) addresses; undefined through anyOf or unknown members. */
function schemaAt(schema: LyraGenSchema, segments: readonly string[]): LyraGenSchema | undefined {
  let current: LyraGenSchema | undefined = schema;
  for (const raw of segments) {
    if (!current || 'anyOf' in current) return undefined;
    const segment = raw.replace(/~1/gu, '/').replace(/~0/gu, '~');
    if (current.type === 'array') { if (!/^\d+$/u.test(segment)) return undefined; current = current.items; }
    else if (current.type === 'object') current = Object.hasOwn(current.properties, segment) ? current.properties[segment] : typeof current.additionalProperties === 'object' ? current.additionalProperties : undefined;
    else return undefined;
  }
  return current;
}

const segmentsOf = (pointer: string): string[] => pointer === '' ? [] : pointer.slice(1).split('/');
const decode = (segment: string | undefined): string => (segment ?? '').replace(/~1/gu, '/').replace(/~0/gu, '~');

/** The expected shape for a missing required member `name` of `schema`. */
export function requiredHint(name: string, schema: LyraGenSchema | undefined): string {
  return `Add the required property "${name.length > MAX_NAME ? `${name.slice(0, MAX_NAME)}...` : name}"${schema ? ` (${describeSchema(schema)})` : ''}.`;
}

/**
 * Hint for a schema diagnostic `code` at `pointer`, relative to the value `schema` validated. For
 * `schema.required` and `schema.property` the last segment is the member name.
 */
export function schemaHint(code: string, schema: LyraGenSchema, pointer: string): string | undefined {
  const segments = segmentsOf(pointer);
  if (code === 'schema.required' || code === 'schema.property') {
    const parent = schemaAt(schema, segments.slice(0, -1));
    if (!parent || 'anyOf' in parent || parent.type !== 'object') return undefined;
    const name = decode(segments.at(-1));
    if (code === 'schema.required') return requiredHint(name, Object.hasOwn(parent.properties, name) ? parent.properties[name] : undefined);
    return unknownNameHint(name, Object.keys(parent.properties), 'Allowed properties', 'This object admits no properties.');
  }
  const target = schemaAt(schema, segments);
  if (!target) return undefined;
  if (code === 'schema.enum' && target.enum?.length) return `Allowed values: ${target.enum.slice(0, MAX_LISTED).map(primitive).join(', ')}${target.enum.length > MAX_LISTED ? ', ...' : ''}.`;
  if (code === 'schema.any-of' && 'anyOf' in target) return `Expected ${describeSchema(target)}.`;
  if (['schema.type', 'schema.range', 'schema.length'].includes(code)) return `Expected ${describeSchema(target)}.`;
  return undefined;
}
