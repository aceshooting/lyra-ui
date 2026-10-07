import { isPlainDataRecord, readOwnArrayLength } from './data-descriptors.js';

const OMIT = Symbol('omit-structured-value');
const LIMIT = Symbol('structured-node-limit');
const DEPTH = Symbol('structured-depth-limit');
const MAX_ARRAY_LENGTH = 0xffff_ffff;

/** Internal, fixed resource profiles. Component adapters cannot raise these ceilings. */
const PROFILES = {
  form: {
    nodes: 50_000, work: 100_000, entries: 10_000, depth: 16,
    countEntries: true, countContainers: false, enumerableArrays: false,
    nullPrototype: false, opaque: false,
  },
  schema: {
    nodes: 50_000, work: 200_000, entries: 50_000, depth: 100,
    countEntries: false, countContainers: true, enumerableArrays: true,
    nullPrototype: true, opaque: false,
  },
  chart: {
    nodes: 10_000, work: 10_000, entries: 10_000, depth: 32,
    countEntries: true, countContainers: true, enumerableArrays: false,
    nullPrototype: true, opaque: true,
  },
  chartData: {
    nodes: 100_000, work: 100_000, entries: 10_000, depth: 32,
    countEntries: true, countContainers: true, enumerableArrays: false,
    nullPrototype: true, opaque: true,
  },
} as const;

export interface SnapshotStructure {
  readonly shape?: 'record' | 'array';
  readonly depth: number;
  /** Schema containers such as properties and tuple lists do not consume a schema node. */
  readonly container?: boolean;
  readonly child?: (key: string, value: unknown) => SnapshotStructure | undefined;
}

export interface StructuredSnapshotOptions {
  readonly profile: keyof typeof PROFILES;
  readonly structure?: SnapshotStructure;
  readonly omitKeys?: ReadonlySet<string>;
  readonly onArrayTruncate?: () => void;
  readonly onClone?: (source: object, snapshot: object) => void;
}

/** Clone arrays and plain records through own data descriptors, with transactional aliases and
 * retained-node accounting. Failed branches reclaim nodes, never inspected source positions.
 * Native/opaque leaves are accepted only by the chart profiles, which do not introspect them. */
export function snapshotStructuredData(value: unknown, options: StructuredSnapshotOptions): {
  readonly value: unknown;
  readonly invalid: boolean;
  readonly truncated: boolean;
} {
  const profile = PROFILES[options.profile];
  let remaining: number = profile.nodes;
  let work: number = profile.work;
  let invalid = false;
  let truncated = false;
  const seen = new WeakMap<object, object>();
  const additions: object[] = [];
  const active = new Set<object>();
  const failure = (entry: unknown) => entry === OMIT || entry === LIMIT || entry === DEPTH;
  const transaction = (create: () => unknown): unknown => {
    const nodes = remaining;
    const size = additions.length;
    const wasTruncated = truncated;
    const result = create();
    if (failure(result)) {
      remaining = nodes;
      if (result === OMIT) truncated = wasTruncated;
      while (additions.length > size) seen.delete(additions.pop()!);
    }
    return result;
  };
  const visit = (source: unknown, structure: SnapshotStructure): unknown => {
    const object = source !== null && typeof source === 'object';
    let array = false;
    try { array = Array.isArray(source); } catch { invalid = true; return OMIT; }
    if (structure.shape && (!object || (structure.shape === 'array' ? !array : array || !isPlainDataRecord(source)))) {
      invalid = true;
      return OMIT;
    }
    if (!object && typeof source !== 'function') return source;
    if (typeof source === 'function') {
      if (profile.opaque) return source;
      invalid = true;
      return OMIT;
    }
    const input = source as object;
    if (profile.opaque && active.has(input)) return OMIT;
    if (profile.enumerableArrays && seen.has(input)) return seen.get(input);
    if (structure.depth > profile.depth) { truncated = true; return DEPTH; }
    if (remaining <= 0 && !(profile.enumerableArrays && structure.container === false)) {
      truncated = true;
      return LIMIT;
    }
    if (seen.has(input)) return seen.get(input);
    if (!array && !isPlainDataRecord(input)) {
      if (profile.opaque) return source;
      invalid = true;
      return OMIT;
    }
    if (profile.countContainers && structure.container !== false) remaining -= 1;
    let length = 0;
    if (array) {
      if (!profile.enumerableArrays && --work < 0) { truncated = true; return LIMIT; }
      try {
        const sourceLength = readOwnArrayLength(input);
        if (sourceLength === undefined || sourceLength > MAX_ARRAY_LENGTH) {
          invalid = true;
          return OMIT;
        }
        length = Math.min(sourceLength, profile.entries);
        if (sourceLength > profile.entries) {
          truncated = true;
          options.onArrayTruncate?.();
        }
        // A length trap can revoke its proxy after returning an apparently valid descriptor.
        if (profile.opaque && !Object.getOwnPropertyDescriptor(input, 'length')) return OMIT;
      } catch { invalid = true; return OMIT; }
    }
    const output = array ? (profile.opaque ? Array.from({ length }, () => undefined) : new Array<unknown>(length)) : Object.create(profile.nullPrototype ? null : Object.prototype) as Record<string, unknown>;
    seen.set(input, output);
    additions.push(input);
    active.add(input);
    let retained = 0;
    function* keys(): IterableIterator<string> {
      if (array && !profile.enumerableArrays) {
        for (let index = 0; index < length; index += 1) yield String(index);
      } else {
        for (const key in input) yield key;
      }
    }
    try {
      for (const key of keys()) {
        const index = array && isSnapshotArrayIndex(key) ? Number(key) : null;
        if (--work < 0 || (profile.countEntries && (remaining <= 0 || (!array && options.profile === 'form' && retained >= profile.entries)))) {
          truncated = true;
          if (index !== null && !profile.opaque) (output as unknown[]).length = index;
          break;
        }
        if (index !== null && index >= length) continue;
        // Chart configuration charges every visited position, including holes and rejected keys.
        if (profile.opaque) remaining -= 1;
        if (options.omitKeys?.has(key)) continue;
        let descriptor: PropertyDescriptor | undefined;
        try { descriptor = Object.getOwnPropertyDescriptor(input, key); }
        catch {
          invalid = true;
          if (profile.opaque || (array && !profile.enumerableArrays)) continue;
          return OMIT;
        }
        if (!descriptor || ((profile.enumerableArrays || !array) && !descriptor.enumerable)) continue;
        if (!Object.hasOwn(descriptor, 'value')) { invalid = true; continue; }
        const child = structure.child ? structure.child(key, descriptor.value) : { depth: structure.depth + 1 };
        if (!child) { truncated = true; continue; }
        const entry = transaction(() => {
          if (profile.countEntries && !profile.opaque) remaining -= 1;
          return visit(descriptor.value, child);
        });
        if (entry === OMIT || (profile.opaque && (entry === LIMIT || entry === DEPTH))) continue;
        if (entry === DEPTH && profile.enumerableArrays) continue;
        if (entry === LIMIT || entry === DEPTH) {
          if (index !== null && !profile.opaque) (output as unknown[]).length = index;
          break;
        }
        retained += 1;
        Object.defineProperty(output, key, { value: entry, enumerable: true, configurable: false, writable: false });
      }
      Object.freeze(output);
      options.onClone?.(input, output);
      return output;
    } catch { invalid = true; return OMIT; }
    finally { active.delete(input); }
  };
  const result = transaction(() => visit(value, options.structure ?? { depth: 0 }));
  return {
    value: failure(result) ? undefined : result,
    invalid: invalid || result === OMIT,
    truncated: truncated || result === LIMIT || result === DEPTH,
  };
}

export function isSnapshotArrayIndex(key: string): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < MAX_ARRAY_LENGTH && String(index) === key;
}

export interface SnapshotArrayAdmission {
  readonly source: object;
  readonly length: number;
}

/** Classify once: a proxy can revoke while returning its length descriptor. */
export function admitSnapshotArray(
  value: unknown,
  onTruncate?: () => void,
): SnapshotArrayAdmission | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = readOwnArrayLength(value);
    if (length === undefined) return undefined;
    if (length > 10_000) onTruncate?.();
    return { source: value, length: Math.min(length, 10_000) };
  } catch { return undefined; }
}

export function snapshotArrayStillAdmitted(admission: SnapshotArrayAdmission): boolean {
  const length = readOwnArrayLength(admission.source);
  return length !== undefined && length >= admission.length;
}

/** Apply a component's field policy to an admitted, bounded sequence without invoking getters.
 * Compact projections omit undefined results; positional projections fill missing/unsafe entries. */
export function projectSnapshotArray<T>(
  admission: SnapshotArrayAdmission | undefined,
  project: (value: unknown) => T | undefined,
  options: { readonly missing: T } | { readonly compact: true },
): readonly T[] | undefined {
  if (!admission || !snapshotArrayStillAdmitted(admission)) return undefined;
  const compact = 'compact' in options;
  const output: T[] = 'missing' in options
    ? Array.from({ length: admission.length }, () => options.missing) : [];
  for (let index = 0; index < admission.length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try { descriptor = Object.getOwnPropertyDescriptor(admission.source, String(index)); }
    catch { continue; }
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) continue;
    const entry = project(descriptor.value);
    if (compact) { if (entry !== undefined) output.push(entry); }
    else if (entry !== undefined) output[index] = entry;
  }
  return Object.freeze(output);
}
