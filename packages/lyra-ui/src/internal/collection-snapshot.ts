import { LitElement } from 'lit';
import type { LyraElement, LyraCollectionSupport } from './lyra-element.js';
import {
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  getOwnDataDescriptor,
} from './data-descriptors.js';
import { devWarnOnce } from './dev-warning.js';

/** Maximum number of array entries retained by the shared public-collection snapshot boundary. */
const PUBLIC_COLLECTION_ENTRY_LIMIT = 10_000;
/** Maximum number of plain-record properties retained across one snapshot. */
const PUBLIC_COLLECTION_NODE_LIMIT = 50_000;
/** Maximum non-rollback source positions inspected while producing one snapshot. */
const PUBLIC_COLLECTION_WORK_LIMIT = PUBLIC_COLLECTION_NODE_LIMIT * 2;
/** Maximum nesting depth traversed while detaching plain records and nested arrays. */
const PUBLIC_COLLECTION_DEPTH_LIMIT = 256;
const OMIT_COLLECTION_VALUE = Symbol('omit-public-collection-value');
const EXHAUSTED_COLLECTION_VALUE = Symbol('exhausted-public-collection-value');

type CollectionSnapshotFailure =
  | typeof OMIT_COLLECTION_VALUE
  | typeof EXHAUSTED_COLLECTION_VALUE;

function isCollectionSnapshotFailure(
  value: unknown
): value is CollectionSnapshotFailure {
  return (
    value === OMIT_COLLECTION_VALUE || value === EXHAUSTED_COLLECTION_VALUE
  );
}

/**
 * Which end of an over-limit root array the boundary keeps: the leading entries (`'oldest'`, the
 * default), or the trailing ones (`'newest'`) for append-ordered data such as logs, transcripts
 * and sample streams, whose newest entries are the ones a reader needs.
 */
export type CollectionRetention = 'oldest' | 'newest';

/** What the shared boundary had to drop from the root of one assignment. */
export interface CollectionTruncation {
  /** Which end of an ordered root was kept. */
  readonly kept: CollectionRetention;
  /** Root entries the retained snapshot holds. */
  readonly retained: number;
  /** Root entries (array positions, `Map`/`Set` entries, or record keys) in the assigned source. */
  readonly source: number;
}

/** Options for {@link snapshotPublicCollection}. */
export interface PublicCollectionSnapshotOptions {
  /** Which end of an over-limit root array to keep. Defaults to `'oldest'`. */
  readonly retain?: CollectionRetention;
  /** Called once when the snapshot retains fewer root entries than the source holds. */
  readonly onTruncate?: (truncation: CollectionTruncation) => void;
}

interface CollectionSnapshotBudget {
  remaining: number;
  remainingWork: number;
  readonly seen: WeakMap<object, unknown>;
  readonly additions: object[];
  readonly realm: SnapshotRealm;
  /** Root-array retention; nested arrays never truncate (an over-limit one fails its record). */
  readonly retention?: CollectionRetention;
  /** What the root lost, written only by root-level code and only when it lost entries. */
  rootLoss?: CollectionTruncation;
}

function recordRootLoss(
  budget: CollectionSnapshotBudget,
  kept: CollectionRetention,
  source: number,
  retained: number
): void {
  if (retained < source) budget.rootLoss = Object.freeze({ kept, retained, source });
}

function consumeSnapshotWork(budget: CollectionSnapshotBudget): boolean {
  if (budget.remainingWork <= 0) return false;
  budget.remainingWork -= 1;
  return true;
}

interface SnapshotRealm {
  readonly Array: ArrayConstructor;
  readonly Date: DateConstructor;
  readonly Map: MapConstructor;
  readonly Object: ObjectConstructor;
  readonly Set: SetConstructor;
}

function snapshotRealm(view?: Window | SnapshotRealm | null): SnapshotRealm {
  const candidate = view as Partial<SnapshotRealm> | undefined;
  return {
    Array: candidate?.Array ?? Array,
    Date: candidate?.Date ?? Date,
    Map: candidate?.Map ?? Map,
    Object: candidate?.Object ?? Object,
    Set: candidate?.Set ?? Set,
  };
}

function isRealmNeutralPlainRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const constructor = Object.getOwnPropertyDescriptor(
      prototype,
      'constructor'
    );
    return Boolean(
      constructor &&
        'value' in constructor &&
        typeof constructor.value === 'function' &&
        constructor.value.name === 'Object' &&
        Object.getPrototypeOf(prototype) === null
    );
  } catch {
    return false;
  }
}

function isArrayValue(value: unknown): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

function isNativeArrayBufferView(value: object): value is ArrayBufferView {
  try {
    return ArrayBuffer.isView(value);
  } catch {
    return false;
  }
}

function isImmutableBlob(value: object): boolean {
  if (typeof Blob === 'undefined') return false;
  const sizeGetter = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')?.get;
  if (!sizeGetter) return false;
  try {
    sizeGetter.call(value);
    return true;
  } catch {
    return false;
  }
}

const MUTATING_DATE_METHODS = new Set<PropertyKey>([
  'setDate',
  'setFullYear',
  'setHours',
  'setMilliseconds',
  'setMinutes',
  'setMonth',
  'setSeconds',
  'setTime',
  'setUTCDate',
  'setUTCFullYear',
  'setUTCHours',
  'setUTCMilliseconds',
  'setUTCMinutes',
  'setUTCMonth',
  'setUTCSeconds',
  'setYear',
]);

function nativeDateTime(value: object): number | typeof OMIT_COLLECTION_VALUE {
  try {
    return Date.prototype.getTime.call(value);
  } catch {
    return OMIT_COLLECTION_VALUE;
  }
}

/** A Date has mutable internal slots that `Object.freeze()` cannot protect. Keep its familiar
 * read API and realm-specific `instanceof` behavior behind a proxy whose target is unreachable,
 * while rejecting both normal mutators and borrowed `Date.prototype` mutators. */
function snapshotReadonlyDate(
  source: object,
  time: number,
  budget: CollectionSnapshotBudget
): Date {
  const target = new budget.realm.Date(time);
  const boundMethods = new Map<PropertyKey, Function>();
  const rejectMutation = () => {
    throw new TypeError('Cannot mutate a readonly Date snapshot');
  };
  const snapshot = new Proxy(target, {
    get(date, key) {
      if (MUTATING_DATE_METHODS.has(key)) return rejectMutation;
      if (key === 'constructor') return budget.realm.Date;
      const value = Reflect.get(date, key, date) as unknown;
      if (typeof value !== 'function') return value;
      const cached = boundMethods.get(key);
      if (cached) return cached;
      const bound = value.bind(date);
      boundMethods.set(key, bound);
      return bound;
    },
  });
  rememberSnapshot(budget, source, snapshot);
  return Object.freeze(snapshot);
}

function rememberSnapshot(
  budget: CollectionSnapshotBudget,
  source: object,
  snapshot: unknown
): void {
  budget.seen.set(source, snapshot);
  budget.additions.push(source);
}

function snapshotTransaction<T>(
  budget: CollectionSnapshotBudget,
  create: () => T | CollectionSnapshotFailure
): T | CollectionSnapshotFailure {
  const remaining = budget.remaining;
  const additions = budget.additions.length;
  const result = create();
  if (!isCollectionSnapshotFailure(result)) return result;
  // A failed branch may return its retained-node allowance and provisional aliases, but source
  // positions already inspected remain spent so many hostile rows cannot multiply total work.
  budget.remaining = remaining;
  for (let index = budget.additions.length - 1; index >= additions; index -= 1)
    budget.seen.delete(budget.additions[index]!);
  budget.additions.length = additions;
  return result;
}

function emptyRealmArray(realm: SnapshotRealm): readonly unknown[] {
  return Object.freeze(new realm.Array());
}

function* ownEnumerableStringKeys(value: object): IterableIterator<string> {
  for (const key in value) yield key;
}

function snapshotDataRecord(
  value: object,
  keys: Iterable<string>,
  prototype: object | null,
  budget: CollectionSnapshotBudget,
  depth: number,
  preserveRecordKeys?: ReadonlySet<PropertyKey>,
  preserveCollectionItemKeys?: ReadonlySet<PropertyKey>
): unknown | CollectionSnapshotFailure {
  const output = budget.realm.Object.create(prototype) as Record<
    PropertyKey,
    unknown
  >;
  rememberSnapshot(budget, value, output);
  try {
    for (const key of keys) {
      if (!consumeSnapshotWork(budget)) return EXHAUSTED_COLLECTION_VALUE;
      const descriptor = getOwnDataDescriptor(value, key);
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
        !descriptor.enumerable
      )
        continue;
      if (budget.remaining <= 0) return EXHAUSTED_COLLECTION_VALUE;
      budget.remaining -= 1;
      const entry = preserveRecordKeys?.has(key)
        ? descriptor.value
        : preserveCollectionItemKeys?.has(key)
        ? snapshotIdentityCollection(descriptor.value, budget.realm, budget)
        : snapshotCollectionValue(descriptor.value, budget, depth + 1);
      if (isCollectionSnapshotFailure(entry)) return entry;
      Object.defineProperty(output, key, {
        value: entry,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  } catch {
    return OMIT_COLLECTION_VALUE;
  }
  return Object.freeze(output);
}

/**
 * Detaches the data-bearing portion of a public collection without invoking accessors or an
 * arbitrary iterable. Platform objects and functions remain identity values; arrays and plain
 * records are copied recursively, bounded, and frozen before they become observable.
 */
function snapshotCollectionValue(
  value: unknown,
  budget: CollectionSnapshotBudget,
  depth: number,
  preserveRecordKeys?: ReadonlySet<PropertyKey>,
  preserveCollectionItemKeys?: ReadonlySet<PropertyKey>,
  allowPrefixTruncation = false
): unknown | CollectionSnapshotFailure {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return value;
  }
  if (typeof value === 'function') return value;
  if (budget.seen.has(value)) return budget.seen.get(value);
  if (depth > PUBLIC_COLLECTION_DEPTH_LIMIT || budget.remaining <= 0)
    return EXHAUSTED_COLLECTION_VALUE;

  if (isArrayValue(value)) {
    if (!consumeSnapshotWork(budget)) return EXHAUSTED_COLLECTION_VALUE;
    const lengthDescriptor = getOwnDataDescriptor(value, 'length');
    if (lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR) {
      return allowPrefixTruncation
        ? emptyRealmArray(budget.realm)
        : OMIT_COLLECTION_VALUE;
    }
    if (
      lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    )
      return allowPrefixTruncation
        ? emptyRealmArray(budget.realm)
        : OMIT_COLLECTION_VALUE;
    const sourceLength = lengthDescriptor.value;
    if (
      !allowPrefixTruncation &&
      sourceLength > PUBLIC_COLLECTION_ENTRY_LIMIT
    )
      return EXHAUSTED_COLLECTION_VALUE;
    const length = Math.min(sourceLength, PUBLIC_COLLECTION_ENTRY_LIMIT);
    // An append-ordered root walks from its end, so either way the snapshot is the longest
    // contiguous run from the retained end that fits both the entry limit and the value budget.
    const newest = allowPrefixTruncation && budget.retention === 'newest';
    const output = new budget.realm.Array() as unknown[];
    rememberSnapshot(budget, value, output);
    const kept: unknown[] = [];
    // Positions walked (the retained run), and those skipped because their value cannot cross
    // the boundary (left as holes).
    let walked = 0;
    let dropped = 0;
    for (; walked < length; walked += 1) {
      if (budget.remaining <= 0 || !consumeSnapshotWork(budget)) {
        if (!allowPrefixTruncation) return EXHAUSTED_COLLECTION_VALUE;
        break;
      }
      const index = newest ? sourceLength - 1 - walked : walked;
      const descriptor = getOwnDataDescriptor(value, String(index));
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR) continue;
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) {
        if (!allowPrefixTruncation) return OMIT_COLLECTION_VALUE;
        dropped += 1;
        continue;
      }
      const entry = snapshotTransaction(budget, () => {
        budget.remaining -= 1;
        return snapshotCollectionValue(descriptor.value, budget, depth + 1);
      });
      if (entry === OMIT_COLLECTION_VALUE) {
        if (!allowPrefixTruncation) return OMIT_COLLECTION_VALUE;
        dropped += 1;
        continue;
      }
      if (entry === EXHAUSTED_COLLECTION_VALUE) {
        if (!allowPrefixTruncation) return EXHAUSTED_COLLECTION_VALUE;
        break;
      }
      kept.push(index, entry);
    }
    output.length = walked;
    const offset = newest ? sourceLength - walked : 0;
    for (let index = 0; index < kept.length; index += 2) {
      Object.defineProperty(output, (kept[index] as number) - offset, {
        value: kept[index + 1],
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    if (allowPrefixTruncation)
      recordRootLoss(budget, newest ? 'newest' : 'oldest', sourceLength, walked - dropped);
    return Object.freeze(output);
  }

  // Plain records dominate this hot path. Classify them before Map/Set brand probes so a normal
  // 10k-row assignment does not incur two caught TypeErrors for every row.
  if (isRealmNeutralPlainRecord(value)) {
    let prototype: object | null;
    try {
      prototype = Object.getPrototypeOf(value);
    } catch {
      return OMIT_COLLECTION_VALUE;
    }
    return snapshotDataRecord(
      value,
      ownEnumerableStringKeys(value),
      prototype === null ? null : budget.realm.Object.prototype,
      budget,
      depth,
      preserveRecordKeys,
      preserveCollectionItemKeys
    );
  }

  const dateTime = nativeDateTime(value);
  if (dateTime !== OMIT_COLLECTION_VALUE)
    return snapshotReadonlyDate(value, dateTime, budget);

  const entries = nativeMapEntries(value);
  if (entries)
    return snapshotDetachedMap(
      value,
      entries,
      budget,
      depth,
      allowPrefixTruncation
    );
  const values = nativeSetValues(value);
  if (values)
    return snapshotDetachedSet(
      value,
      values,
      budget,
      depth,
      allowPrefixTruncation
    );
  // Mutable binary views have no truthful recursively-frozen same-shape representation. No
  // enrolled public property uses one; a hostile/untyped assignment fails closed here. Event
  // contracts that expose bytes must define their own detached representation.
  if (isNativeArrayBufferView(value)) return OMIT_COLLECTION_VALUE;
  const rect = snapshotDOMRect(value, budget);
  if (rect !== OMIT_COLLECTION_VALUE) return rect;
  if (isImmutableBlob(value)) return value;

  // JavaScript exposes a custom-prototype record's own names only through eager reflection, while
  // `for...in` also traverses its prototype. Neither can satisfy this generic boundary's bounded,
  // prototype-independent work contract. Components that deliberately accept such records use a
  // schema-aware owned accessor with domain-specific limits instead.
  return OMIT_COLLECTION_VALUE;
}

/** Counts a plain record's enumerable keys, up to the boundary's own work ceiling. */
function boundedRecordSize(value: object): number | undefined {
  let size = 0;
  try {
    for (const key in value) {
      if (typeof key === 'string') size += 1;
      if (size >= PUBLIC_COLLECTION_WORK_LIMIT) break;
    }
  } catch {
    return undefined;
  }
  return size;
}

/**
 * @internal Applies the shared bounded collection snapshot at a component-owned accessor.
 *
 * One assignment retains at most 10,000 entries per array and 50,000 values in total. A root array,
 * `Map` or `Set` that exceeds either keeps a contiguous run of its entries, a root record keeps
 * nothing, and a root entry holding a value that cannot cross the boundary (a class instance, a
 * typed array) is left out. `options.onTruncate` reports any such loss, so the root is never cut
 * silently; `options.retain` chooses whether an over-limit root array keeps its leading entries
 * (the default) or its trailing, newest ones.
 */
export function snapshotPublicCollection(
  value: unknown,
  view?: Window | null,
  options: PublicCollectionSnapshotOptions = {}
): unknown {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    return value;
  const realm = snapshotRealm(view);
  const budget: CollectionSnapshotBudget = {
    remaining: PUBLIC_COLLECTION_NODE_LIMIT,
    remainingWork: PUBLIC_COLLECTION_WORK_LIMIT,
    seen: new WeakMap(),
    additions: [],
    realm,
    retention: options.retain ?? 'oldest',
  };
  const snapshot = snapshotTransaction(budget, () =>
    snapshotCollectionValue(value, budget, 0, undefined, undefined, true)
  );
  if (!isCollectionSnapshotFailure(snapshot)) {
    if (budget.rootLoss) options.onTruncate?.(budget.rootLoss);
    return snapshot;
  }
  if (isArrayValue(value) || isNativeArrayBufferView(value as object))
    return emptyRealmArray(realm);
  if (typeof value === 'object') {
    if (nativeMapEntries(value))
      return readonlyMapFacade(new realm.Map(), realm);
    if (nativeSetValues(value))
      return readonlySetFacade(new realm.Set(), realm);
    if (isRealmNeutralPlainRecord(value)) {
      const size = boundedRecordSize(value);
      if (size) options.onTruncate?.(Object.freeze({ kept: 'oldest', retained: 0, source: size }));
      const prototype = Object.getPrototypeOf(value);
      return Object.freeze(
        realm.Object.create(
          prototype === null ? null : realm.Object.prototype
        ) as object
      );
    }
  }
  // Unclassifiable roots (including revoked/proxy-wrapped collections) never cross by identity.
  return emptyRealmArray(realm);
}

function nativeMapEntries(
  value: object
): IterableIterator<readonly [unknown, unknown]> | undefined {
  try {
    return Map.prototype.entries.call(value) as IterableIterator<
      readonly [unknown, unknown]
    >;
  } catch {
    return undefined;
  }
}

function nativeSetValues(value: object): IterableIterator<unknown> | undefined {
  try {
    return Set.prototype.values.call(value) as IterableIterator<unknown>;
  } catch {
    return undefined;
  }
}

function snapshotDOMRect(
  value: object,
  budget: CollectionSnapshotBudget
): Readonly<Record<string, number>> | typeof OMIT_COLLECTION_VALUE {
  if (typeof DOMRectReadOnly === 'undefined') return OMIT_COLLECTION_VALUE;
  const nativePrototype = DOMRectReadOnly.prototype;
  const output = budget.realm.Object.create(
    budget.realm.Object.prototype
  ) as Record<string, number>;
  for (const key of [
    'x',
    'y',
    'width',
    'height',
    'top',
    'right',
    'bottom',
    'left',
  ] as const) {
    let coordinate: unknown;
    try {
      const getter = Object.getOwnPropertyDescriptor(nativePrototype, key)?.get;
      if (!getter) return OMIT_COLLECTION_VALUE;
      coordinate = getter.call(value);
    } catch {
      return OMIT_COLLECTION_VALUE;
    }
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate))
      return OMIT_COLLECTION_VALUE;
    Object.defineProperty(output, key, {
      value: coordinate,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(output);
}

function readonlyMapFacade(
  backing: ReadonlyMap<unknown, unknown>,
  realm = snapshotRealm()
): ReadonlyMap<unknown, unknown> {
  let facade: ReadonlyMap<unknown, unknown>;
  facade = realm.Object.create(realm.Object.prototype) as ReadonlyMap<
    unknown,
    unknown
  >;
  Object.defineProperties(facade, {
    size: { enumerable: true, get: () => backing.size },
    entries: { value: () => backing.entries() },
    get: { value: (key: unknown) => backing.get(key) },
    has: { value: (key: unknown) => backing.has(key) },
    keys: { value: () => backing.keys() },
    values: { value: () => backing.values() },
    forEach: {
      value: (
        callback: (
          value: unknown,
          key: unknown,
          map: ReadonlyMap<unknown, unknown>
        ) => void,
        thisArg?: unknown
      ) =>
        backing.forEach((entry, key) =>
          callback.call(thisArg, entry, key, facade)
        ),
    },
    [Symbol.iterator]: { value: () => backing[Symbol.iterator]() },
  });
  return Object.freeze(facade);
}

function readonlySetFacade(
  backing: ReadonlySet<unknown>,
  realm = snapshotRealm()
): ReadonlySet<unknown> {
  let facade: ReadonlySet<unknown>;
  facade = realm.Object.create(realm.Object.prototype) as ReadonlySet<unknown>;
  Object.defineProperties(facade, {
    size: { enumerable: true, get: () => backing.size },
    entries: { value: () => backing.entries() },
    has: { value: (entry: unknown) => backing.has(entry) },
    keys: { value: () => backing.keys() },
    values: { value: () => backing.values() },
    forEach: {
      value: (
        callback: (
          value: unknown,
          key: unknown,
          set: ReadonlySet<unknown>
        ) => void,
        thisArg?: unknown
      ) =>
        backing.forEach((entry) =>
          callback.call(thisArg, entry, entry, facade)
        ),
    },
    [Symbol.iterator]: { value: () => backing[Symbol.iterator]() },
  });
  return Object.freeze(facade);
}

/** Creates a frozen facade whose mutating `Map` methods and mutable backing store are unreachable. */
function snapshotIdentityMap(
  entries: IterableIterator<readonly [unknown, unknown]>,
  realm = snapshotRealm(),
  budget?: CollectionSnapshotBudget
): ReadonlyMap<unknown, unknown> | typeof EXHAUSTED_COLLECTION_VALUE {
  const backing = new realm.Map<unknown, unknown>();
  for (let count = 0; count < PUBLIC_COLLECTION_ENTRY_LIMIT; count += 1) {
    const next = entries.next();
    if (next.done) break;
    if (budget && !consumeSnapshotWork(budget))
      return EXHAUSTED_COLLECTION_VALUE;
    backing.set(next.value[0], next.value[1]);
  }
  return readonlyMapFacade(backing, realm);
}

/** Creates a frozen facade whose mutating `Set` methods and mutable backing store are unreachable. */
function snapshotIdentitySet(
  values: IterableIterator<unknown>,
  realm = snapshotRealm(),
  budget?: CollectionSnapshotBudget
): ReadonlySet<unknown> | typeof EXHAUSTED_COLLECTION_VALUE {
  const backing = new realm.Set<unknown>();
  for (let count = 0; count < PUBLIC_COLLECTION_ENTRY_LIMIT; count += 1) {
    const next = values.next();
    if (next.done) break;
    if (budget && !consumeSnapshotWork(budget))
      return EXHAUSTED_COLLECTION_VALUE;
    backing.add(next.value);
  }
  return readonlySetFacade(backing, realm);
}

/** A native `Map`/`Set` size read through the platform getter, never through the object itself. */
function nativeCollectionSize(source: object, kind: 'map' | 'set'): number | undefined {
  try {
    const size = Object.getOwnPropertyDescriptor(kind === 'map' ? Map.prototype : Set.prototype, 'size')
      ?.get?.call(source) as unknown;
    return typeof size === 'number' ? size : undefined;
  } catch {
    return undefined;
  }
}

/** Records a root `Map`/`Set` that kept fewer entries than its native size reports. */
function recordNativeCollectionLoss(
  budget: CollectionSnapshotBudget,
  source: object,
  kind: 'map' | 'set',
  retained: number
): void {
  const size = nativeCollectionSize(source, kind);
  if (size !== undefined) recordRootLoss(budget, 'oldest', size, retained);
}

function snapshotDetachedMap(
  source: object,
  entries: IterableIterator<readonly [unknown, unknown]>,
  budget: CollectionSnapshotBudget,
  depth: number,
  allowPrefixTruncation: boolean
): ReadonlyMap<unknown, unknown> | typeof EXHAUSTED_COLLECTION_VALUE {
  const backing = new budget.realm.Map<unknown, unknown>();
  const facade = readonlyMapFacade(backing, budget.realm);
  rememberSnapshot(budget, source, facade);
  const settle = (): ReadonlyMap<unknown, unknown> => {
    if (allowPrefixTruncation) recordNativeCollectionLoss(budget, source, 'map', backing.size);
    return facade;
  };
  for (let count = 0; count < PUBLIC_COLLECTION_ENTRY_LIMIT; count += 1) {
    let next: IteratorResult<readonly [unknown, unknown]>;
    try {
      next = entries.next();
    } catch {
      break;
    }
    if (next.done) break;
    if (budget.remaining <= 0 || !consumeSnapshotWork(budget))
      return allowPrefixTruncation
        ? settle()
        : EXHAUSTED_COLLECTION_VALUE;
    const pair = snapshotTransaction<readonly [unknown, unknown]>(budget, () => {
      budget.remaining -= 1;
      const key = snapshotCollectionValue(next.value[0], budget, depth + 1);
      if (isCollectionSnapshotFailure(key)) return key;
      const entry = snapshotCollectionValue(next.value[1], budget, depth + 1);
      return isCollectionSnapshotFailure(entry)
        ? entry
        : ([key, entry] as const);
    });
    if (pair === EXHAUSTED_COLLECTION_VALUE)
      return allowPrefixTruncation
        ? settle()
        : EXHAUSTED_COLLECTION_VALUE;
    if (pair !== OMIT_COLLECTION_VALUE) backing.set(pair[0], pair[1]);
  }
  return settle();
}

function snapshotDetachedSet(
  source: object,
  values: IterableIterator<unknown>,
  budget: CollectionSnapshotBudget,
  depth: number,
  allowPrefixTruncation: boolean
): ReadonlySet<unknown> | typeof EXHAUSTED_COLLECTION_VALUE {
  const backing = new budget.realm.Set<unknown>();
  const facade = readonlySetFacade(backing, budget.realm);
  rememberSnapshot(budget, source, facade);
  const settle = (): ReadonlySet<unknown> => {
    if (allowPrefixTruncation) recordNativeCollectionLoss(budget, source, 'set', backing.size);
    return facade;
  };
  for (let count = 0; count < PUBLIC_COLLECTION_ENTRY_LIMIT; count += 1) {
    let next: IteratorResult<unknown>;
    try {
      next = values.next();
    } catch {
      break;
    }
    if (next.done) break;
    if (budget.remaining <= 0 || !consumeSnapshotWork(budget))
      return allowPrefixTruncation
        ? settle()
        : EXHAUSTED_COLLECTION_VALUE;
    const entry = snapshotTransaction(budget, () => {
      budget.remaining -= 1;
      return snapshotCollectionValue(next.value, budget, depth + 1);
    });
    if (entry === EXHAUSTED_COLLECTION_VALUE)
      return allowPrefixTruncation
        ? settle()
        : EXHAUSTED_COLLECTION_VALUE;
    if (entry !== OMIT_COLLECTION_VALUE) backing.add(entry);
  }
  return settle();
}

/**
 * @param root - Only for a root assignment (never with `budget`): which end of an over-limit array
 *   to keep, and where to report entries the 10,000-entry limit cut off.
 */
function snapshotIdentityCollection(
  value: unknown,
  view?: Window | SnapshotRealm | null,
  budget?: CollectionSnapshotBudget,
  root?: PublicCollectionSnapshotOptions
): unknown | CollectionSnapshotFailure {
  const realm = snapshotRealm(view);
  if (
    budget &&
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    budget.seen.has(value)
  )
    return budget.seen.get(value);
  if (isArrayValue(value)) {
    if (budget && !consumeSnapshotWork(budget))
      return EXHAUSTED_COLLECTION_VALUE;
    const lengthDescriptor = getOwnDataDescriptor(value, 'length');
    const sourceLength =
      lengthDescriptor !== MISSING_OWN_DATA_DESCRIPTOR &&
      lengthDescriptor !== UNSAFE_OWN_DATA_DESCRIPTOR &&
      typeof lengthDescriptor.value === 'number' &&
      Number.isSafeInteger(lengthDescriptor.value) &&
      lengthDescriptor.value >= 0
        ? lengthDescriptor.value
        : 0;
    const length = Math.min(sourceLength, PUBLIC_COLLECTION_ENTRY_LIMIT);
    const kept: CollectionRetention = root?.retain ?? 'oldest';
    const offset = kept === 'newest' ? sourceLength - length : 0;
    const output = new realm.Array(length) as unknown[];
    if (budget) rememberSnapshot(budget, value, output);
    for (let index = 0; index < length; index += 1) {
      if (budget && !consumeSnapshotWork(budget))
        return EXHAUSTED_COLLECTION_VALUE;
      const descriptor = getOwnDataDescriptor(value, String(offset + index));
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
      )
        continue;
      Object.defineProperty(output, index, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    if (length < sourceLength)
      root?.onTruncate?.(Object.freeze({ kept, retained: length, source: sourceLength }));
    return Object.freeze(output);
  }
  if (value === null || typeof value !== 'object') return value;
  const mapEntries = nativeMapEntries(value);
  if (mapEntries) {
    const output = snapshotIdentityMap(mapEntries, realm, budget);
    if (output === EXHAUSTED_COLLECTION_VALUE) return output;
    if (budget) rememberSnapshot(budget, value, output);
    reportIdentityCollectionLoss(root, value, 'map', output.size);
    return output;
  }
  const setValues = nativeSetValues(value);
  if (setValues) {
    const output = snapshotIdentitySet(setValues, realm, budget);
    if (output === EXHAUSTED_COLLECTION_VALUE) return output;
    if (budget) rememberSnapshot(budget, value, output);
    reportIdentityCollectionLoss(root, value, 'set', output.size);
    return output;
  }
  return emptyRealmArray(realm);
}

function reportIdentityCollectionLoss(
  root: PublicCollectionSnapshotOptions | undefined,
  source: object,
  kind: 'map' | 'set',
  retained: number
): void {
  if (!root?.onTruncate) return;
  const size = nativeCollectionSize(source, kind);
  if (size !== undefined && retained < size)
    root.onTruncate(Object.freeze({ kept: 'oldest', retained, source: size }));
}

function snapshotEventDetail(
  value: unknown,
  view: Window | null | undefined,
  preserveRootKeys: ReadonlySet<PropertyKey>,
  preserveCollectionItemKeys: ReadonlySet<PropertyKey>
): unknown {
  if (value === undefined || value === null) return value;
  const budget: CollectionSnapshotBudget = {
    remaining: PUBLIC_COLLECTION_NODE_LIMIT,
    remainingWork: PUBLIC_COLLECTION_WORK_LIMIT,
    seen: new WeakMap(),
    additions: [],
    realm: snapshotRealm(view),
  };
  const snapshot = snapshotTransaction(budget, () =>
    snapshotCollectionValue(
      value,
      budget,
      0,
      preserveRootKeys,
      preserveCollectionItemKeys
    )
  );
  return isCollectionSnapshotFailure(snapshot) ? null : snapshot;
}

function trustedLyraConstructorChain(
  instance: object
): readonly (typeof LyraElement)[] {
  const constructors: (typeof LyraElement)[] = [];
  let prototype: object | null = Object.getPrototypeOf(instance);
  while (prototype && prototype !== LitElement.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    if (typeof descriptor?.value === 'function')
      constructors.push(descriptor.value as typeof LyraElement);
    prototype = Object.getPrototypeOf(prototype);
  }
  return constructors;
}

interface CollectionPropertyPolicy {
  readonly owns: boolean;
  readonly preservesItemIdentity: boolean;
  readonly preservesObjectIdentity: boolean;
  /** Enrolled in `appendOrderedCollectionProperties`: an over-limit root keeps its newest entries. */
  readonly retainsNewest: boolean;
}

/**
 * The constructors from `ctor` up to (but excluding) `LitElement` — the same set
 * {@link trustedLyraConstructorChain} derives from an instance, read from the class itself so the
 * ownership boundary can be resolved once per class rather than on every assignment.
 */
function lyraClassChain(
  ctor: typeof LyraElement
): readonly (typeof LyraElement)[] {
  const constructors: (typeof LyraElement)[] = [];
  let current: unknown = ctor;
  while (typeof current === 'function' && current !== LitElement) {
    constructors.push(current as typeof LyraElement);
    current = Object.getPrototypeOf(current);
  }
  return constructors;
}

const collectionPolicyByConstructor = new WeakMap<
  object,
  Map<PropertyKey, CollectionPropertyPolicy>
>();

function collectionPropertyPolicy(
  ctor: typeof LyraElement,
  name: PropertyKey
): CollectionPropertyPolicy {
  let policies = collectionPolicyByConstructor.get(ctor);
  if (!policies) {
    policies = new Map();
    collectionPolicyByConstructor.set(ctor, policies);
  }
  const cached = policies.get(name);
  if (cached) return cached;
  let owns = false;
  let preservesItemIdentity = false;
  let preservesObjectIdentity = false;
  let retainsNewest = false;
  for (const constructor of lyraClassChain(ctor)) {
    // Both fields are `protected static` -- hidden from external consumers of the class, but this
    // bookkeeping helper is part of LyraElement's own internal machinery, just expressed as a
    // module-level function rather than a method. The `hasOwnProperty` guard above already limits
    // the cast to a constructor that actually declares its own override of the field.
    const declared = constructor as unknown as {
      ownedCollectionProperties: readonly PropertyKey[];
      identityCollectionProperties: readonly PropertyKey[];
      identityCollectionObjectProperties: readonly PropertyKey[];
      appendOrderedCollectionProperties: readonly PropertyKey[];
    };
    if (
      Object.prototype.hasOwnProperty.call(
        constructor,
        'ownedCollectionProperties'
      ) &&
      declared.ownedCollectionProperties.includes(name)
    )
      owns = true;
    if (
      Object.prototype.hasOwnProperty.call(
        constructor,
        'identityCollectionProperties'
      ) &&
      declared.identityCollectionProperties.includes(name)
    )
      preservesItemIdentity = true;
    if (
      Object.prototype.hasOwnProperty.call(
        constructor,
        'identityCollectionObjectProperties'
      ) &&
      declared.identityCollectionObjectProperties.includes(name)
    )
      preservesObjectIdentity = true;
    if (
      Object.prototype.hasOwnProperty.call(
        constructor,
        'appendOrderedCollectionProperties'
      ) &&
      declared.appendOrderedCollectionProperties.includes(name)
    )
      retainsNewest = true;
  }
  const policy = Object.freeze({
    owns,
    preservesItemIdentity,
    preservesObjectIdentity,
    retainsNewest,
  });
  policies.set(name, policy);
  return policy;
}

const COLLECTION_ENROLLMENT_FIELDS = [
  'ownedCollectionProperties',
  'identityCollectionProperties',
  'identityCollectionObjectProperties',
  'appendOrderedCollectionProperties',
] as const;

/**
 * Every name any enrollment list mentions, including inherited declarations. The identity and
 * append-ordered lists are only *refinements* of an owned property, so a name they alone mention
 * resolves to a policy that owns nothing and installs no boundary -- the same inert outcome it has
 * always had. Collecting them anyway keeps that decision in one place (the policy) instead of splitting it
 * across the policy and the name scan.
 */
function enrolledCollectionPropertyNames(
  ctor: typeof LyraElement
): ReadonlySet<PropertyKey> {
  const names = new Set<PropertyKey>();
  for (const constructor of lyraClassChain(ctor))
    for (const field of COLLECTION_ENROLLMENT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(constructor, field)) continue;
      // `protected static`, so unreachable through the public class type; see the identical note
      // in `collectionPropertyPolicy()`. The guard above limits this to a declaring constructor.
      const declared = constructor as unknown as Record<
        (typeof COLLECTION_ENROLLMENT_FIELDS)[number],
        readonly PropertyKey[]
      >;
      for (const name of declared[field]) names.add(name);
    }
  return names;
}

/** The nearest descriptor for `name` on `prototype` or anything it inherits from. */
function inheritedPropertyDescriptor(
  prototype: object,
  name: PropertyKey
): PropertyDescriptor | undefined {
  let current: object | null = prototype;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor) return descriptor;
    current = Object.getPrototypeOf(current) as object | null;
  }
  return undefined;
}

const installedOwnershipBoundaries = new WeakSet<object>();

interface OwnershipBoundarySetter {
  readonly policy: CollectionPropertyPolicy;
  /** The unwrapped reactive setter, so re-wrapping never stacks two boundaries. */
  readonly originalSet: (this: LyraElement, value: unknown) => void;
}

/** Setters installed below, keyed by the boundary each one already applies. */
const ownershipBoundarySetters = new WeakMap<object, OwnershipBoundarySetter>();

function samePolicy(
  a: CollectionPropertyPolicy,
  b: CollectionPropertyPolicy
): boolean {
  return (
    a.owns === b.owns &&
    a.preservesItemIdentity === b.preservesItemIdentity &&
    a.preservesObjectIdentity === b.preservesObjectIdentity &&
    a.retainsNewest === b.retainsNewest
  );
}

/**
 * Installs the immutable-ownership boundary on `ctor`'s enrolled collection properties by wrapping
 * the reactive accessor Lit already defined for each of them.
 *
 * This used to be an override of `ReactiveElement.getPropertyDescriptor()`. Lit deprecated that
 * hook and **does not call it for standard decorators**, so the clone/freeze step would have
 * silently disappeared -- no error, no warning, no failing test -- the day this package or a
 * consumer's build switched decorator flavors, taking the documented "clone-owned, bounded,
 * frozen" guarantee of `colorSteps`, `legendStops`, `annotations` and ~180 sibling properties with
 * it. Wrapping the finished accessor instead is decorator-agnostic: legacy decorators, standard
 * `accessor` decorators, a `static properties` block and a hand-written `@property` getter/setter
 * pair all end in a prototype accessor by the time a class is finalized, which is what this walks.
 * Removing the override also stops the per-page-load dev-mode deprecation warning that no consumer
 * could act on or silence.
 *
 * Invoked from `observedAttributes`, which is where `ReactiveElement.finalize()` itself runs and
 * which `customElements.define()` (and `@lit-labs/ssr`'s registry shim, deliberately) always
 * reads. Registration is therefore the guaranteed install point, and it strictly precedes every
 * instance: constructing an unregistered custom element throws before any assignment can reach an
 * unwrapped setter.
 */
function installOwnedCollectionAccessors(ctor: typeof LyraElement): void {
  if (installedOwnershipBoundaries.has(ctor)) return;
  installedOwnershipBoundaries.add(ctor);
  const prototype = ctor.prototype as object;
  for (const name of enrolledCollectionPropertyNames(ctor)) {
    const policy = collectionPropertyPolicy(ctor, name);
    if (!policy.owns) continue;
    // Only a reactive property whose accessor Lit generated ever crossed the boundary: a
    // `noAccessor` declaration, and a name that is not a reactive property at all, never did.
    const declaration = ctor.elementProperties.get(name);
    if (!declaration || declaration.noAccessor) continue;
    const descriptor = inheritedPropertyDescriptor(prototype, name);
    const inheritedSet = descriptor?.set;
    if (!inheritedSet) continue;
    // A subclass may enroll an inherited property more strictly than its base did (adding an
    // item-identity or object-identity exception). Re-wrap the base's *unwrapped* setter with this
    // class's own policy rather than stacking a second snapshot on top of the base's boundary --
    // and leave the base's boundary alone when the two policies already agree.
    const installed = ownershipBoundarySetters.get(inheritedSet);
    if (installed && samePolicy(installed.policy, policy)) continue;
    const originalSet = installed?.originalSet ?? inheritedSet;
    const lastAssignments = new WeakMap<
      LyraElement,
      { readonly source: unknown; readonly retained: unknown }
    >();
    const set = function (this: LyraElement, value: unknown): void {
      const previous = lastAssignments.get(this);
      // Declarative renderers commonly rebind stable inputs on every parent render. Once the
      // boundary owns a source, repeating that exact source or round-tripping the getter's snapshot
      // is a no-op unless the property deliberately supplied a domain-specific change detector.
      // Identity-preserving collections remain explicit render requests because their live items
      // may have changed even while the array itself did not.
      if (
        previous &&
        declaration.hasChanged === undefined &&
        !policy.preservesItemIdentity &&
        !policy.preservesObjectIdentity &&
        (Object.is(value, previous.source) || Object.is(value, previous.retained))
      ) {
        return;
      }
      const ownerView = (this as unknown as { ownerDocument?: Document })
        .ownerDocument?.defaultView;
      let truncation: CollectionTruncation | undefined;
      const options: PublicCollectionSnapshotOptions = {
        retain: policy.retainsNewest ? 'newest' : 'oldest',
        onTruncate: (report) => {
          truncation = report;
        },
      };
      const snapshot =
        policy.preservesObjectIdentity &&
        value !== null &&
        typeof value === 'object' &&
        !isArrayValue(value)
          ? value
          : policy.preservesItemIdentity
          ? snapshotIdentityCollection(value, ownerView, undefined, options)
          : snapshotPublicCollection(value, ownerView, options);
      recordCollectionTruncation(this, name, truncation);
      originalSet.call(this, snapshot);
      lastAssignments.set(this, {
        source: value,
        retained: descriptor.get?.call(this) ?? snapshot,
      });
    };
    ownershipBoundarySetters.set(set, { policy, originalSet });
    Object.defineProperty(prototype, name, { ...descriptor, set });
  }
}


const collectionTruncations = new WeakMap<object, Map<PropertyKey, CollectionTruncation>>();

/** The page-wide development-warning key for one truncated property, so a test that assigns past
 *  the limits on purpose can seed or capture exactly that diagnostic. */
export function collectionTruncationWarningKey(tagName: string, property: PropertyKey): string {
  return `lyra-collection-truncated:${tagName}:${String(property)}`;
}

/** Remembers (or clears) what the latest assignment of an enrolled property lost, and tells a
 *  developer once per page per property; the message is a diagnostic, never shown to users. */
function recordCollectionTruncation(
  host: LyraElement,
  name: PropertyKey,
  truncation: CollectionTruncation | undefined
): void {
  let byName = collectionTruncations.get(host);
  if (!truncation) {
    byName?.delete(name);
    return;
  }
  if (!byName) {
    byName = new Map();
    collectionTruncations.set(host, byName);
  }
  byName.set(name, truncation);
  const tagName = host.localName;
  const property = String(name);
  devWarnOnce(
    collectionTruncationWarningKey(tagName, property),
    `<${tagName}>: '${property}' kept ${truncation.retained} of ${truncation.source} entries, the ` +
      `${truncation.kept}; an assignment keeps at most ${PUBLIC_COLLECTION_ENTRY_LIMIT} per array ` +
      `and ${PUBLIC_COLLECTION_NODE_LIMIT} values, and drops values it cannot copy.`
  );
}

/**
 * @internal What the latest assignment of an enrolled collection property on `host` lost to the
 * shared boundary's limits, or `undefined` when it kept everything. A component reads this to
 * disclose the loss, for example in a localized limit notice built from the source size.
 */
export function publicCollectionTruncation(
  host: object,
  property: PropertyKey
): CollectionTruncation | undefined {
  return collectionTruncations.get(host)?.get(property);
}

/** Snapshots an emitted detail when the emitting class enrolls the event as immutable. */
function snapshotEnrolledEventDetail(host: LyraElement<any>, name: string, detail: unknown): unknown {
  let snapshotsDetail = false;
  const identityDetailKeys = new Set<PropertyKey>();
  const identityCollectionItemKeys = new Set<PropertyKey>();
  for (const candidate of trustedLyraConstructorChain(host)) {
    const constructor = candidate as unknown as {
      immutableEventDetails: readonly string[];
      identityEventDetailProperties: Readonly<Record<string, readonly PropertyKey[]>>;
      identityEventDetailCollectionItems: Readonly<Record<string, readonly PropertyKey[]>>;
    };
    if (
      Object.prototype.hasOwnProperty.call(
        constructor,
        'immutableEventDetails'
      ) &&
      constructor.immutableEventDetails.includes(name)
    )
      snapshotsDetail = true;
    if (
      Object.prototype.hasOwnProperty.call(
        constructor,
        'identityEventDetailProperties'
      )
    )
      for (const key of constructor.identityEventDetailProperties[name] ?? [])
        identityDetailKeys.add(key);
    if (
      Object.prototype.hasOwnProperty.call(
        constructor,
        'identityEventDetailCollectionItems'
      )
    )
      for (const key of
        constructor.identityEventDetailCollectionItems[name] ?? [])
        identityCollectionItemKeys.add(key);
  }
  return snapshotsDetail ? snapshotEventDetail(
    detail, host.ownerDocument?.defaultView, identityDetailKeys, identityCollectionItemKeys
  ) : detail;
}

/** Whether `ctor` or an ancestor declares a non-empty `ownedCollectionProperties` list. */
function declaresOwnedCollections(ctor: typeof LyraElement): boolean {
  for (const constructor of lyraClassChain(ctor)) {
    if (!Object.prototype.hasOwnProperty.call(constructor, 'ownedCollectionProperties')) continue;
    const owned = (constructor as unknown as { ownedCollectionProperties: readonly PropertyKey[] })
      .ownedCollectionProperties;
    if (owned.length > 0) return true;
  }
  return false;
}

/** Explicit support for components that own collections or immutable event details. */
export const collectionSupport: LyraCollectionSupport = Object.freeze({
  installProperties: installOwnedCollectionAccessors,
  snapshotEvent: snapshotEnrolledEventDetail,
});

/**
 * Event-detail-only support, for a class that lists `immutableEventDetails` but owns no collection
 * property: the same detail snapshots without the accessor installer and its policy code, which
 * then stay out of that class's bundle. A class -- or a subclass -- that enrolls
 * `ownedCollectionProperties` must declare {@link collectionSupport} instead; with this object its
 * properties would not cross the boundary, which a development build reports.
 */
export const eventCollectionSupport: LyraCollectionSupport = /* @__PURE__ */ Object.freeze({
  installProperties(ctor: typeof LyraElement): void {
    if (!declaresOwnedCollections(ctor)) return;
    devWarnOnce(
      `lyra-event-collection-support:${ctor.name}`,
      `${ctor.name} enrolls ownedCollectionProperties but declares eventCollectionSupport; ` +
        'declare collectionSupport so those properties cross the immutable collection boundary.'
    );
  },
  snapshotEvent: snapshotEnrolledEventDetail,
});
