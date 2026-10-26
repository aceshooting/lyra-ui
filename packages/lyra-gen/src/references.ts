import { isSafeKey, resolveLimits, snapshotJson } from './schema.js';
import type { JsonValue, LyraGenLimits, LyraGenResult } from './types.js';

function failure<T>(code: string, message: string): LyraGenResult<T> {
  return { ok: false, diagnostics: [{ code, message, path: '', severity: 'error' }] };
}

/** Parse a bounded RFC 6901 pointer. Prototype paths are never addressable. */
export function parsePointer(pointer: string): LyraGenResult<readonly string[]> {
  if (typeof pointer !== 'string' || pointer.length > 4096 || (pointer !== '' && !pointer.startsWith('/'))) {
    return failure('pointer.invalid', 'Expected a bounded JSON Pointer.');
  }
  const segments = pointer === '' ? [] : pointer.slice(1).split('/');
  if (segments.length > 64 || segments.some(segment => /~(?![01])/u.test(segment))) {
    return failure('pointer.invalid', 'Invalid JSON Pointer escape or depth.');
  }
  const decoded = segments.map(segment => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));
  if (decoded.some(segment => !isSafeKey(segment))) return failure('security.prototype', 'Unsafe pointer segment.');
  return { ok: true, value: Object.freeze(decoded), diagnostics: [] };
}

/** Read only own data properties; getters and inherited values are never consulted. */
export function readPointer(value: JsonValue, pointer: string): LyraGenResult<JsonValue> {
  const parsed = parsePointer(pointer);
  if (!parsed.ok) return parsed;
  let current: unknown = value;
  for (const segment of parsed.value) {
    if (current === null || typeof current !== 'object') return failure('pointer.missing', 'The pointer does not resolve.');
    if (Array.isArray(current) && !/^(0|[1-9][0-9]*)$/u.test(segment)) return failure('pointer.invalid', 'Array indices must be canonical nonnegative integers.');
    const descriptor = Object.getOwnPropertyDescriptor(current, segment);
    if (!descriptor || !('value' in descriptor)) return failure('pointer.missing', 'The pointer does not resolve to a data property.');
    current = descriptor.value;
  }
  return { ok: true, value: current as JsonValue, diagnostics: [] };
}

export interface LyraGenReferenceValue {
  readonly value: JsonValue;
  readonly revision?: number;
  readonly stale?: boolean;
}
export interface LyraGenReferenceContext {
  readonly data?: ReadonlyMap<string, LyraGenReferenceValue>;
  readonly tools?: ReadonlyMap<string, LyraGenReferenceValue>;
  readonly expectedRevisions?: ReadonlyMap<string, number>;
  readonly limits?: Partial<LyraGenLimits>;
}

/** Resolve only explicit {$ref:'@data:name#/pointer'} objects through host-owned maps. */
export function resolveReferences(input: unknown, context: LyraGenReferenceContext): LyraGenResult<JsonValue> {
  const snapshot = snapshotJson(input, context.limits);
  if (!snapshot.ok) return snapshot;
  let failureResult: LyraGenResult<JsonValue> | undefined;
  let remaining = 256;
  let materializedBytes = 0;
  const maxBytes = resolveLimits(context.limits).maxBytes;
  const encoder = new TextEncoder();
  const walk = (value: JsonValue): JsonValue => {
    if (failureResult) return null;
    if (Array.isArray(value)) return value.map(walk);
    if (value === null || typeof value !== 'object') return value;
    if (Object.hasOwn(value, '$ref')) {
      const reference = (value as Record<string, JsonValue>)['$ref'];
      if (--remaining < 0 || Object.keys(value).length !== 1 || typeof reference !== 'string') {
        failureResult = failure('reference.invalid', 'Invalid reference object or reference budget exceeded.');
        return null;
      }
      const match = /^@(data|tool):([A-Za-z0-9_.-]{1,128})(#.*)?$/u.exec(reference);
      if (!match) { failureResult = failure('reference.invalid', 'References must name an authorized data or tool entry.'); return null; }
      const source = match[1] === 'data' ? context.data : context.tools;
      const entry = source?.get(match[2]!);
      const expected = context.expectedRevisions?.get(reference.split('#')[0]!);
      if (!entry) { failureResult = failure('reference.unauthorized', 'The reference is unavailable to this host.'); return null; }
      if (entry.stale || (expected !== undefined && entry.revision !== expected)) { failureResult = failure('reference.stale', 'The reference revision is stale.'); return null; }
      // Account for the entire supplied entry before traversing or copying its selected region.
      const admitted = snapshotJson(entry.value, context.limits);
      if (!admitted.ok) { failureResult = admitted; return null; }
      const selected = readPointer(admitted.value, match[3]?.slice(1) ?? '');
      if (!selected.ok) { failureResult = selected; return null; }
      materializedBytes += encoder.encode(JSON.stringify(selected.value)).byteLength;
      if (materializedBytes > maxBytes) { failureResult = failure('limit.references', 'Resolved references exceed the accumulated byte budget.'); return null; }
      // Resolved host data is literal data, never recursively interpreted as another reference.
      return selected.value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child)]));
  };
  const resolved = walk(snapshot.value);
  return failureResult ?? snapshotJson(resolved, context.limits);
}
