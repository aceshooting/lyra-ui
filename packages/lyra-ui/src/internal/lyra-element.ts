import {
  LitElement,
  type CSSResultGroup,
  type PropertyDeclaration,
  type PropertyValues,
} from 'lit';
import { property } from 'lit/decorators.js';
import {
  captureFormInternals,
  ExternalLabelController,
} from './form-control-labels.js';
import { tokens } from './tokens.styles.js';
import { palette } from './tokens/palette.styles.js';
import { resolveIntlLocale } from './intl-cache.js';
import {
  observeInheritedContext,
  beginInheritedContextUpdate,
  finishInheritedContextUpdate,
  markInheritedContextUpdateRendered,
  queueInheritedDirectionChange,
  recordInheritedDirectionRead,
  recordInheritedLocaleRead,
} from './inherited-context-observer.js';
import {
  canonicalizeLyraLocale,
  enableLyraLocaleCache,
  invalidateLyraLocaleCache,
  lyraLocaleCatalogVersion,
  peekLyraLocale,
  recordLyraOwnerDocumentConnection,
  resolveLyraDirection,
  resolveLyraString,
  resolveLyraLocale,
  snapshotLyraLocaleStrings,
  subscribeLyraLocaleForHost,
} from './localization-runtime.js';
import type { LyraLocaleStrings } from './localization.js';

export interface LyraEmitOptions {
  /** Set only for events whose listener may veto an operation before it runs. */
  cancelable?: boolean;
}

export type LyraEventMap = Record<string, Event>;

/**
 * Public event-detail view: collection paths and their containing records are recursively readonly.
 * Components may construct a mutable local value before `emit()`; listeners always receive the
 * detached, frozen runtime snapshot represented by this type.
 */
export type LyraEventDetailSnapshot<Value> = Value extends (
  ...args: never[]
) => unknown
  ? Value
  : Value extends ArrayBufferView
  ? readonly number[]
  : Value extends DOMRectReadOnly
  ? Readonly<{
      x: number;
      y: number;
      width: number;
      height: number;
      top: number;
      right: number;
      bottom: number;
      left: number;
    }>
  : Value extends ReadonlyMap<infer Key, infer Entry>
  ? ReadonlyMap<
      LyraEventDetailSnapshot<Key>,
      LyraEventDetailSnapshot<Entry>
    >
  : Value extends ReadonlySet<infer Entry>
  ? ReadonlySet<LyraEventDetailSnapshot<Entry>>
  : Value extends readonly unknown[]
  ? { readonly [Key in keyof Value]: LyraEventDetailSnapshot<Value[Key]> }
  : Value extends object
  ? { readonly [Key in keyof Value]: LyraEventDetailSnapshot<Value[Key]> }
  : Value;

/**
 * The trailing `emit()` arguments for one entry of a component's event map.
 *
 * The map entry is the single source of truth: `CustomEvent<{ id: string }>` makes `detail`
 * **required** and typed, while `CustomEvent<null>` (or an optional detail) makes it omittable.
 * The runtime normalizes an omitted detail to the platform's canonical `null`. Entries that are
 * not `CustomEvent` at all — the native re-emits some components list
 * as `input: Event` / `load: Event` — keep the permissive shape, since there is no declared detail
 * to check against.
 *
 * The tuple wrappers (`[Events[K]] extends [CustomEvent<…>]`) stop the conditional from
 * distributing over a union-typed map entry, which would otherwise turn one required `detail` into
 * a union of argument lists that no call site can satisfy.
 */
export type LyraEmitArgs<Events, K extends keyof Events & string> = [
  Events[K]
] extends [CustomEvent<infer Detail>]
  ? null extends Detail
    ? [detail?: Detail, options?: LyraEmitOptions]
    : undefined extends Detail
    ? [detail?: Detail, options?: LyraEmitOptions]
    : [detail: Detail, options?: LyraEmitOptions]
  : [detail?: unknown, options?: LyraEmitOptions];

/** The `CustomEvent` `emit()` returns for one entry of a component's event map. */
export type LyraEmittedEvent<Events, K extends keyof Events & string> = [
  Events[K]
] extends [CustomEvent<infer Detail>]
  ? CustomEvent<Detail>
  : CustomEvent<unknown>;

/** Maximum number of array entries retained by the shared public-collection snapshot boundary. */
const PUBLIC_COLLECTION_ENTRY_LIMIT = 10_000;
/** Maximum number of plain-record properties retained across one snapshot. */
const PUBLIC_COLLECTION_NODE_LIMIT = 50_000;
/** Maximum nesting depth traversed while detaching plain records and nested arrays. */
const PUBLIC_COLLECTION_DEPTH_LIMIT = 16;
const OMIT_COLLECTION_VALUE = Symbol('omit-public-collection-value');

interface CollectionSnapshotBudget {
  remaining: number;
  readonly seen: WeakMap<object, unknown>;
  readonly additions: object[];
  readonly realm: SnapshotRealm;
}

interface SnapshotRealm {
  readonly Array: ArrayConstructor;
  readonly Map: MapConstructor;
  readonly Object: ObjectConstructor;
  readonly Set: SetConstructor;
}

function snapshotRealm(view?: Window | null): SnapshotRealm {
  const candidate = view as unknown as Partial<SnapshotRealm> | undefined;
  return {
    Array: candidate?.Array ?? Array,
    Map: candidate?.Map ?? Map,
    Object: candidate?.Object ?? Object,
    Set: candidate?.Set ?? Set,
  };
}

function isRealmNeutralPlainRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
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
  create: () => T | typeof OMIT_COLLECTION_VALUE
): T | typeof OMIT_COLLECTION_VALUE {
  const remaining = budget.remaining;
  const additions = budget.additions.length;
  const result = create();
  if (result !== OMIT_COLLECTION_VALUE) return result;
  budget.remaining = remaining;
  for (let index = budget.additions.length - 1; index >= additions; index -= 1)
    budget.seen.delete(budget.additions[index]!);
  budget.additions.length = additions;
  return OMIT_COLLECTION_VALUE;
}

function emptyRealmArray(realm: SnapshotRealm): readonly unknown[] {
  return Object.freeze(new realm.Array());
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
  preserveRecordKeys?: ReadonlySet<PropertyKey>
): unknown | typeof OMIT_COLLECTION_VALUE {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return value;
  }
  if (typeof value === 'function') return value;
  if (budget.seen.has(value)) return budget.seen.get(value);
  if (depth > PUBLIC_COLLECTION_DEPTH_LIMIT || budget.remaining <= 0)
    return OMIT_COLLECTION_VALUE;

  if (isArrayValue(value)) {
    let lengthDescriptor: PropertyDescriptor | undefined;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    } catch {
      return emptyRealmArray(budget.realm);
    }
    const length =
      lengthDescriptor &&
      'value' in lengthDescriptor &&
      typeof lengthDescriptor.value === 'number' &&
      Number.isSafeInteger(lengthDescriptor.value) &&
      lengthDescriptor.value >= 0
        ? Math.min(lengthDescriptor.value, PUBLIC_COLLECTION_ENTRY_LIMIT)
        : 0;
    const output = new budget.realm.Array(length) as unknown[];
    rememberSnapshot(budget, value, output);
    for (let index = 0; index < length; index += 1) {
      if (budget.remaining <= 0) {
        output.length = index;
        break;
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        continue;
      }
      if (!descriptor || !('value' in descriptor)) continue;
      const entry = snapshotTransaction(budget, () => {
        budget.remaining -= 1;
        return snapshotCollectionValue(descriptor.value, budget, depth + 1);
      });
      if (entry === OMIT_COLLECTION_VALUE) continue;
      Object.defineProperty(output, index, {
        value: entry,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
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
    const output = budget.realm.Object.create(
      prototype === null ? null : budget.realm.Object.prototype
    ) as Record<PropertyKey, unknown>;
    rememberSnapshot(budget, value, output);
    try {
      // `for...in` lets ordinary huge records stop at the admission budget instead of eagerly
      // allocating every descriptor. Inherited keys never consume the budget.
      for (const key in value) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !('value' in descriptor)) continue;
        if (budget.remaining <= 0) return OMIT_COLLECTION_VALUE;
        budget.remaining -= 1;
        const entry = preserveRecordKeys?.has(key)
          ? descriptor.value
          : snapshotCollectionValue(descriptor.value, budget, depth + 1);
        if (entry === OMIT_COLLECTION_VALUE) return OMIT_COLLECTION_VALUE;
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

  const entries = nativeMapEntries(value);
  if (entries) return snapshotDetachedMap(value, entries, budget, depth);
  const values = nativeSetValues(value);
  if (values) return snapshotDetachedSet(value, values, budget, depth);
  if (isNativeArrayBufferView(value))
    return snapshotArrayBufferView(value, budget);
  const rect = snapshotDOMRect(value, budget);
  if (rect !== OMIT_COLLECTION_VALUE) return rect;
  if (isImmutableBlob(value)) return value;
  return OMIT_COLLECTION_VALUE;
}

/** Internal snapshot seam for bespoke `noAccessor` public setters. */
export function snapshotPublicCollection<Value>(
  value: Value,
  view?: Window | null
): Value {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  )
    return value;
  const realm = snapshotRealm(view);
  const budget: CollectionSnapshotBudget = {
    remaining: PUBLIC_COLLECTION_NODE_LIMIT,
    seen: new WeakMap(),
    additions: [],
    realm,
  };
  const snapshot = snapshotTransaction(budget, () =>
    snapshotCollectionValue(value, budget, 0)
  );
  if (snapshot !== OMIT_COLLECTION_VALUE) return snapshot as Value;
  if (isArrayValue(value) || isNativeArrayBufferView(value as object))
    return emptyRealmArray(realm) as Value;
  if (typeof value === 'object') {
    if (nativeMapEntries(value))
      return readonlyMapFacade(new realm.Map(), realm) as Value;
    if (nativeSetValues(value))
      return readonlySetFacade(new realm.Set(), realm) as Value;
    if (isRealmNeutralPlainRecord(value)) {
      const prototype = Object.getPrototypeOf(value);
      return Object.freeze(
        realm.Object.create(
          prototype === null ? null : realm.Object.prototype
        ) as object
      ) as Value;
    }
  }
  // Unclassifiable roots (including revoked/proxy-wrapped collections) never cross by identity.
  return emptyRealmArray(realm) as Value;
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

function snapshotArrayBufferView(
  value: ArrayBufferView,
  budget: CollectionSnapshotBudget
): readonly number[] | typeof OMIT_COLLECTION_VALUE {
  let buffer: ArrayBufferLike;
  let byteLength: number;
  let byteOffset: number;
  try {
    buffer = value.buffer;
    byteLength = value.byteLength;
    byteOffset = value.byteOffset;
  } catch {
    return OMIT_COLLECTION_VALUE;
  }
  const length = Math.min(byteLength, PUBLIC_COLLECTION_ENTRY_LIMIT);
  const output = new budget.realm.Array(length) as number[];
  try {
    const bytes = new Uint8Array(buffer, byteOffset, length);
    for (let index = 0; index < length; index += 1) output[index] = bytes[index]!;
  } catch {
    return OMIT_COLLECTION_VALUE;
  }
  return Object.freeze(output);
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
  realm = snapshotRealm()
): ReadonlyMap<unknown, unknown> {
  const backing = new realm.Map<unknown, unknown>();
  for (
    let next = entries.next(), count = 0;
    !next.done && count < PUBLIC_COLLECTION_ENTRY_LIMIT;
    next = entries.next(), count += 1
  ) {
    backing.set(next.value[0], next.value[1]);
  }
  return readonlyMapFacade(backing, realm);
}

/** Creates a frozen facade whose mutating `Set` methods and mutable backing store are unreachable. */
function snapshotIdentitySet(
  values: IterableIterator<unknown>,
  realm = snapshotRealm()
): ReadonlySet<unknown> {
  const backing = new realm.Set<unknown>();
  for (
    let next = values.next(), count = 0;
    !next.done && count < PUBLIC_COLLECTION_ENTRY_LIMIT;
    next = values.next(), count += 1
  ) {
    backing.add(next.value);
  }
  return readonlySetFacade(backing, realm);
}

function snapshotDetachedMap(
  source: object,
  entries: IterableIterator<readonly [unknown, unknown]>,
  budget: CollectionSnapshotBudget,
  depth: number
): ReadonlyMap<unknown, unknown> {
  const backing = new budget.realm.Map<unknown, unknown>();
  const facade = readonlyMapFacade(backing, budget.realm);
  rememberSnapshot(budget, source, facade);
  for (let count = 0; count < PUBLIC_COLLECTION_ENTRY_LIMIT; count += 1) {
    let next: IteratorResult<readonly [unknown, unknown]>;
    try {
      next = entries.next();
    } catch {
      break;
    }
    if (next.done || budget.remaining <= 0) break;
    const pair = snapshotTransaction(budget, () => {
      budget.remaining -= 1;
      const key = snapshotCollectionValue(next.value[0], budget, depth + 1);
      if (key === OMIT_COLLECTION_VALUE) return OMIT_COLLECTION_VALUE;
      const entry = snapshotCollectionValue(next.value[1], budget, depth + 1);
      return entry === OMIT_COLLECTION_VALUE
        ? OMIT_COLLECTION_VALUE
        : ([key, entry] as const);
    });
    if (pair !== OMIT_COLLECTION_VALUE) backing.set(pair[0], pair[1]);
  }
  return facade;
}

function snapshotDetachedSet(
  source: object,
  values: IterableIterator<unknown>,
  budget: CollectionSnapshotBudget,
  depth: number
): ReadonlySet<unknown> {
  const backing = new budget.realm.Set<unknown>();
  const facade = readonlySetFacade(backing, budget.realm);
  rememberSnapshot(budget, source, facade);
  for (let count = 0; count < PUBLIC_COLLECTION_ENTRY_LIMIT; count += 1) {
    let next: IteratorResult<unknown>;
    try {
      next = values.next();
    } catch {
      break;
    }
    if (next.done || budget.remaining <= 0) break;
    const entry = snapshotTransaction(budget, () => {
      budget.remaining -= 1;
      return snapshotCollectionValue(next.value, budget, depth + 1);
    });
    if (entry !== OMIT_COLLECTION_VALUE) backing.add(entry);
  }
  return facade;
}

function snapshotIdentityCollection(value: unknown, view?: Window | null): unknown {
  const realm = snapshotRealm(view);
  if (isArrayValue(value)) {
    let lengthDescriptor: PropertyDescriptor | undefined;
    try {
      lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    } catch {
      return emptyRealmArray(realm);
    }
    const length =
      lengthDescriptor &&
      'value' in lengthDescriptor &&
      typeof lengthDescriptor.value === 'number' &&
      Number.isSafeInteger(lengthDescriptor.value) &&
      lengthDescriptor.value >= 0
        ? Math.min(lengthDescriptor.value, PUBLIC_COLLECTION_ENTRY_LIMIT)
        : 0;
    const output = new realm.Array(length) as unknown[];
    for (let index = 0; index < length; index += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        continue;
      }
      if (!descriptor || !('value' in descriptor)) continue;
      Object.defineProperty(output, index, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(output);
  }
  if (value === null || typeof value !== 'object') return value;
  const mapEntries = nativeMapEntries(value);
  if (mapEntries) return snapshotIdentityMap(mapEntries, realm);
  const setValues = nativeSetValues(value);
  if (setValues) return snapshotIdentitySet(setValues, realm);
  return value;
}

function snapshotEventDetail(
  value: unknown,
  view: Window | null | undefined,
  preserveRootKeys: ReadonlySet<PropertyKey>
): unknown {
  if (value === undefined || value === null) return value;
  const budget: CollectionSnapshotBudget = {
    remaining: PUBLIC_COLLECTION_NODE_LIMIT,
    seen: new WeakMap(),
    additions: [],
    realm: snapshotRealm(view),
  };
  const snapshot = snapshotTransaction(budget, () =>
    snapshotCollectionValue(value, budget, 0, preserveRootKeys)
  );
  return snapshot === OMIT_COLLECTION_VALUE ? null : snapshot;
}

/**
 * Internal controller seam for browser-derived state that must not change a hydrating element's
 * first render. A symbol keeps the hook out of the component API while allowing shared reactive
 * controllers to use the same hydration decision as their host.
 */
export const SEED_FIRST_RENDER_STATE = Symbol('lr-seed-first-render-state');
/** Internal query used by slot-presence controllers while SSR light DOM is unknowable. */
export const SLOT_PRESENCE_UNRESOLVED = Symbol('lr-slot-presence-unresolved');

const REACTIVE_HOST_ATTRIBUTES = [
  'aria-label',
  'aria-describedby',
  'lang',
  'dir',
] as const;
const DIRECTION_HOST_ATTRIBUTES = ['class', 'style', 'slot'] as const;

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
}

const collectionPolicyByPrototype = new WeakMap<
  object,
  Map<PropertyKey, CollectionPropertyPolicy>
>();

function collectionPropertyPolicy(
  instance: object,
  name: PropertyKey
): CollectionPropertyPolicy {
  const prototype = Object.getPrototypeOf(instance) as object;
  let policies = collectionPolicyByPrototype.get(prototype);
  if (!policies) {
    policies = new Map();
    collectionPolicyByPrototype.set(prototype, policies);
  }
  const cached = policies.get(name);
  if (cached) return cached;
  let owns = false;
  let preservesItemIdentity = false;
  for (const constructor of trustedLyraConstructorChain(instance)) {
    // Both fields are `protected static` -- hidden from external consumers of the class, but this
    // bookkeeping helper is part of LyraElement's own internal machinery, just expressed as a
    // module-level function rather than a method. The `hasOwnProperty` guard above already limits
    // the cast to a constructor that actually declares its own override of the field.
    const declared = constructor as unknown as {
      ownedCollectionProperties: readonly PropertyKey[];
      identityCollectionProperties: readonly PropertyKey[];
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
  }
  const policy = Object.freeze({ owns, preservesItemIdentity });
  policies.set(name, policy);
  return policy;
}

/**
 * Shared base for every Lyra component. Supplies the design-token layer
 * (`--lr-theme-*` theme-input properties with hardcoded `--lr-*` fallbacks).
 * RTL is handled by components using CSS logical properties rather than a forced `dir`.
 */
export class LyraElement<Events = LyraEventMap> extends LitElement {
  // `palette` before `tokens`: the ramp and the semantic grid are raw inputs, and `tokens` is
  // free to reference them. Both are shared `CSSResult` instances, so adopting them in every
  // component costs one stylesheet in the bundle, not one per component.
  static override styles: CSSResultGroup = [palette, tokens];

  /**
   * Reactive public properties whose array/tuple assignments cross the shared immutable ownership
   * boundary. Subclasses list only their own collection properties; the descriptor consults the
   * concrete constructor at assignment time, after static initialization has completed.
   */
  protected static readonly ownedCollectionProperties: readonly PropertyKey[] =
    Object.freeze([]);

  /**
   * Explicit exceptions whose item identity is itself part of the public contract (for example a
   * generic virtual-list row or a command object returned to an imperative callback). The array
   * sequence is still bounded, detached, and frozen; only its item references are retained.
   */
  protected static readonly identityCollectionProperties: readonly PropertyKey[] =
    Object.freeze([]);

  /** Events whose collection-bearing detail is detached and recursively frozen before dispatch. */
  protected static readonly immutableEventDetails: readonly string[] =
    Object.freeze([]);

  /** Explicit root detail fields whose object identity is part of an enrolled event contract. */
  protected static readonly identityEventDetailProperties: Readonly<
    Record<string, readonly PropertyKey[]>
  > = Object.freeze({});

  static override getPropertyDescriptor(
    name: PropertyKey,
    key: string | symbol,
    options: PropertyDeclaration
  ): PropertyDescriptor | undefined {
    const descriptor = super.getPropertyDescriptor(name, key, options);
    if (!descriptor?.set) return descriptor;
    const originalSet = descriptor.set;
    return {
      ...descriptor,
      set(this: LyraElement, value: unknown) {
        const policy = collectionPropertyPolicy(this, name);
        if (!policy.owns) {
          originalSet.call(this, value);
          return;
        }
        const ownerView = (this as unknown as { ownerDocument?: Document })
          .ownerDocument?.defaultView;
        originalSet.call(
          this,
          policy.preservesItemIdentity
            ? snapshotIdentityCollection(value, ownerView)
            : snapshotPublicCollection(value, ownerView)
        );
      },
    };
  }

  /** @internal English fallbacks owned by this class hierarchy and generated per component. */
  protected static readonly defaultStrings: Readonly<LyraLocaleStrings> =
    Object.freeze({});

  /**
   * Components commonly forward ARIA host attributes to an internal role and derive localization
   * from `lang`/`dir`. These global attributes are not reactive Lit properties, so observe them
   * centrally to keep post-render attribute changes in sync.
   */
  static override get observedAttributes(): string[] {
    return [
      ...new Set([
        ...super.observedAttributes,
        ...REACTIVE_HOST_ATTRIBUTES,
        ...DIRECTION_HOST_ATTRIBUTES,
      ]),
    ];
  }

  /** Optional locale override. Otherwise the nearest `locale`/`lang` ancestor is used. */
  @property({ reflect: true }) locale = '';

  private stringsValue: LyraLocaleStrings = snapshotLyraLocaleStrings({});

  /**
   * Immutable, bounded per-instance message overrides, useful for application-specific wording.
   * Assignment snapshots own data-string/plural entries; malformed/accessor entries are omitted
   * and later caller mutation cannot alter rendered copy without a new assignment.
   */
  @property({ attribute: false })
  get strings(): LyraLocaleStrings {
    return this.stringsValue;
  }
  set strings(value: LyraLocaleStrings) {
    const previous = this.stringsValue;
    this.stringsValue = snapshotLyraLocaleStrings(value);
    this.requestUpdate('strings', previous);
  }

  private stopLocaleSubscription?: () => void;
  private localeSubscriptionNeeded = false;
  private lastLocalizedCatalogVersion?: string;
  private pendingLoadController?: AbortController;
  /** Callbacks scheduled during the current update cycle, keyed so that two callers with
   *  *different* purposes each keep a slot. A single boolean here meant the second caller in a
   *  cycle was silently dropped. */
  private afterUpdateCallbacks?: Map<string, () => void>;
  /** Callbacks that came due while detached, replayed on reconnect. */
  private deferredAfterUpdate?: Map<string, () => void>;
  private stopInheritedContextObservation?: () => void;
  /** `undefined` until the first connect decides it, then true only between that connect and the
   *  first update of an element whose shadow DOM a server already rendered. See
   *  {@link seedFirstRenderState}. */
  private hydratingServerShadow?: boolean;
  /** Browser-only first-render reads coalesced behind one completed hydration update. */
  private deferredFirstRenderSeeds?: Set<() => void>;

  constructor() {
    super();
    // The external-label bridge is a property of being form-associated, not of any one component,
    // so it is installed here rather than repeated in every form-associated control that would
    // otherwise have to remember it (and would each be a silent a11y gap when they did not). It
    // costs one controller on a form-associated element and nothing at all on every other.
    if ((this.constructor as { formAssociated?: boolean }).formAssociated) {
      this.addController(new ExternalLabelController(this));
    }
  }

  /**
   * Records the internals a form-associated component attaches, so shared infrastructure can read
   * the platform-owned form relationships (`labels`, `form`) without every component having to
   * expose its own `internals` field publicly. Components attach through several different
   * spellings — the `FormAssociated` mixin, `attachInternalsSafely()`, a locally copied
   * `safeAttachInternals()` — but all of them bottom out in `host.attachInternals()`, which makes
   * this the one place that sees every case. Behaviour is otherwise unchanged, including the throw
   * a second attachment is required to produce.
   *
   * @internal
   */
  override attachInternals(): ElementInternals {
    const internals = super.attachInternals();
    captureFormInternals(this, internals);
    return internals;
  }

  override connectedCallback(): void {
    // Read before `super`, which creates the render root: on the very first connect a shadow root
    // can only already exist because the parser built it from server-rendered declarative markup,
    // which is exactly when the first browser render has to reproduce that markup rather than
    // whatever the browser alone can see.
    this.hydratingServerShadow ??= !this.hasUpdated && this.shadowRoot !== null;
    super.connectedCallback();
    recordLyraOwnerDocumentConnection(this);
    // A reconnected element may sit under a different `lang`/`dir` ancestor,
    // and Lit schedules no update for a pure DOM move — the memo from the
    // previous tree must not carry over.
    enableLyraLocaleCache(this);
    invalidateLyraLocaleCache(this);
    this.stopInheritedContextObservation?.();
    this.stopInheritedContextObservation = observeInheritedContext(this);
    if (this.localeSubscriptionNeeded) this.ensureLocaleSubscription();
    if (this.lastLocalizedCatalogVersion !== undefined) {
      const currentCatalogVersion = lyraLocaleCatalogVersion(
        resolveLyraLocale(this)
      );
      if (currentCatalogVersion !== this.lastLocalizedCatalogVersion)
        this.requestUpdate();
    }
    const deferred = this.deferredAfterUpdate;
    if (deferred) {
      this.deferredAfterUpdate = undefined;
      for (const [key, callback] of deferred)
        this.scheduleAfterUpdate(callback, key);
    }
  }

  override disconnectedCallback(): void {
    this.pendingLoadController?.abort();
    this.pendingLoadController = undefined;
    this.stopLocaleSubscription?.();
    this.stopLocaleSubscription = undefined;
    this.stopInheritedContextObservation?.();
    this.stopInheritedContextObservation = undefined;
    invalidateLyraLocaleCache(this);
    super.disconnectedCallback();
  }

  /**
   * Shared adoption hook for components that retain owner-realm resources. Subclasses override
   * this callback and call `super.adoptedCallback()` just as they do for connect/disconnect; the
   * base invalidation prevents locale or direction state resolved in the former document from
   * surviving until an unrelated update.
   */
  adoptedCallback(): void {
    this.stopLocaleSubscription?.();
    this.stopLocaleSubscription = undefined;
    invalidateLyraLocaleCache(this);
    if (this.isConnected && this.localeSubscriptionNeeded)
      this.ensureLocaleSubscription();
  }

  /**
   * Every update cycle begins with at least one `requestUpdate()` call, and
   * unlike `willUpdate()` (which subclasses routinely override without a
   * `super` call) it cannot be bypassed — so this is the one reliable seam
   * for dropping the memoized locale/direction. Resolution then happens at
   * most once per update cycle no matter how many times a template loop calls
   * `localize()`/`effectiveLocale`/`effectiveDirection`.
   */
  override requestUpdate(
    name?: PropertyKey,
    oldValue?: unknown,
    options?: PropertyDeclaration
  ): void {
    invalidateLyraLocaleCache(this);
    super.requestUpdate(name, oldValue, options);
  }

  protected override performUpdate(): void {
    beginInheritedContextUpdate(this);
    try {
      super.performUpdate();
    } finally {
      finishInheritedContextUpdate(this);
    }
  }

  protected override update(changedProperties: PropertyValues): void {
    super.update(changedProperties);
    markInheritedContextUpdateRendered(this);
  }

  private ensureLocaleSubscription(): void {
    this.localeSubscriptionNeeded = true;
    if (!this.isConnected || this.stopLocaleSubscription) return;
    this.stopLocaleSubscription = subscribeLyraLocaleForHost(this);
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    value: string | null
  ): void {
    const directionHostAttribute =
      oldValue !== value &&
      DIRECTION_HOST_ATTRIBUTES.includes(
        name as (typeof DIRECTION_HOST_ATTRIBUTES)[number]
      );
    if (directionHostAttribute)
      queueInheritedDirectionChange(this, name === 'slot');
    super.attributeChangedCallback(name, oldValue, value);
    if (
      oldValue !== value &&
      REACTIVE_HOST_ATTRIBUTES.includes(
        name as (typeof REACTIVE_HOST_ATTRIBUTES)[number]
      )
    ) {
      this.requestUpdate();
    } else if (directionHostAttribute) {
      // Capture happened before invalidation, so a same-task getter cannot replace the rendered
      // baseline before the coalesced observer comparison runs.
      invalidateLyraLocaleCache(this);
    }
  }

  /**
   * Runs `seed` before the first render — except while hydrating a server-rendered shadow root,
   * where it runs immediately *after* that first render instead.
   *
   * Several components read something only the browser can answer (their own light-DOM children,
   * a browser global such as `EyeDropper`) before their first render, so declaratively slotted
   * content never flashes the fallback for a frame. A server renderer can answer neither: Lit's
   * server DOM hands an element no children, and installs no browser globals. Seeding
   * unconditionally therefore makes the browser's first render disagree with the markup it is
   * supposed to be hydrating, which fails the hydration outright and throws the whole
   * server-rendered subtree away.
   *
   * Deferring by one update keeps both paths honest: a browser-only mount still seeds
   * synchronously (no flash, unchanged behavior), and a hydrating mount reproduces the server's
   * render, then corrects itself on the very next update.
   *
   * Call it from `willUpdate()` or `connectedCallback()`; it is a no-op once the element has
   * updated, so the usual `if (!this.hasUpdated)` guard around the seed is not needed.
   */
  protected seedFirstRenderState(seed: () => void): void {
    if (this.hasUpdated) return;
    this[SEED_FIRST_RENDER_STATE](seed);
  }

  /** @internal */
  [SEED_FIRST_RENDER_STATE](seed: () => void): void {
    if (!this.hydratingServerShadow) {
      seed();
      return;
    }
    const pending = (this.deferredFirstRenderSeeds ??= new Set());
    pending.add(seed);
    if (pending.size > 1) return;
    void this.updateComplete.then(
      () => {
        // Let every observer of the completed hydration update inspect the server-equivalent
        // first render before any browser-only correction schedules Lit's next one. A task (not
        // another promise reaction) is intentional: the SSR hydration client may register its
        // first-update observer only after custom-element definition resolves.
        setTimeout(() => {
          this.hydratingServerShadow = false;
          const seeds = this.deferredFirstRenderSeeds;
          this.deferredFirstRenderSeeds = undefined;
          for (const deferred of seeds ?? []) deferred();
          // Presence-driven renderers deliberately expose their slot wrappers while the server's
          // light-DOM answer is unresolved. Even an actually empty slot therefore needs one
          // corrective render after hydration to collapse that progressive fallback.
          this.requestUpdate();
        }, 0);
      },
      () => {
        // A first update that threw is not a hydration this element can still correct; drop the
        // flag so a later update seeds normally instead of deferring forever.
        this.hydratingServerShadow = false;
        this.deferredFirstRenderSeeds = undefined;
      }
    );
  }

  /**
   * Applies browser-derived state immediately, except during a server-shadow hydration's first
   * update. Unlike {@link seedFirstRenderState}, this remains active after the initial mount and
   * is therefore suitable for `slotchange` and observer callbacks that can arrive while Lit is
   * completing hydration.
   */
  protected updateBrowserDerivedState(update: () => void): void {
    this[SEED_FIRST_RENDER_STATE](update);
  }

  /** Keeps authored slot content visible in SSR/no-JS output until a browser can resolve it. */
  protected renderSlotPresence(present: boolean): boolean {
    return present || this[SLOT_PRESENCE_UNRESOLVED]();
  }

  /** @internal */
  [SLOT_PRESENCE_UNRESOLVED](): boolean {
    return typeof Node === 'undefined' || this.hydratingServerShadow === true;
  }

  /** Starts a component-owned cancellable load and aborts the previous one. */
  protected beginAbortableLoad(): AbortSignal | undefined {
    this.pendingLoadController?.abort();
    this.pendingLoadController = undefined;
    const AbortControllerCtor = this.ownerDocument.defaultView?.AbortController;
    if (!AbortControllerCtor) return undefined;
    this.pendingLoadController = new AbortControllerCtor();
    return this.pendingLoadController.signal;
  }

  /**
   * Runs callbacks once, after the current update completes, coalesced **per `key`**.
   *
   * Repeated schedules under the same key collapse to the first one — that is the whole point for
   * the default `'load'` key, where several property writes in one cycle must produce one fetch
   * rather than one per write. But callers with *different* purposes need their own slot: several
   * viewers schedule a `load()` and a locale-driven search recompute from the same `updated()`,
   * and while this coalesced on a single boolean the second one was silently dropped, leaving
   * search results collated for the previous locale. Pass a distinct `key` for distinct work.
   *
   * Lit still runs the update cycle while detached, so callbacks that come due then are held and
   * replayed on reconnect rather than dropped.
   */
  protected scheduleAfterUpdate(callback: () => void, key = 'load'): void {
    const pending = (this.afterUpdateCallbacks ??= new Map());
    if (pending.has(key)) return;
    pending.set(key, callback);
    // Only the first key of a cycle queues the drain; later keys join the same microtask.
    if (pending.size > 1) return;
    queueMicrotask(() => {
      const due = this.afterUpdateCallbacks;
      this.afterUpdateCallbacks = undefined;
      if (!due) return;
      if (this.isConnected) {
        for (const due_callback of due.values()) due_callback();
        return;
      }
      const held = (this.deferredAfterUpdate ??= new Map());
      for (const [heldKey, heldCallback] of due)
        if (!held.has(heldKey)) held.set(heldKey, heldCallback);
    });
  }

  /** Resolve a localized message using this component's overrides and locale. */
  protected localize(
    key: string,
    fallback?: string,
    values?: Record<string, string | number>
  ): string {
    const message = resolveLyraString(
      this,
      key,
      this.strings,
      fallback,
      values,
      (this.constructor as typeof LyraElement).defaultStrings
    );
    const locale = peekLyraLocale(this);
    recordInheritedLocaleRead(this, locale);
    if (locale !== undefined) {
      this.lastLocalizedCatalogVersion = lyraLocaleCatalogVersion(locale);
      this.ensureLocaleSubscription();
    }
    return message;
  }

  /** The canonical public locale used for message-catalog lookup and propagation to child controls. */
  protected get effectiveMessageLocale(): string {
    if (this.locale) return canonicalizeLyraLocale(this.locale);
    const locale = resolveLyraLocale(this);
    recordInheritedLocaleRead(this, locale);
    this.ensureLocaleSubscription();
    return locale;
  }

  /** The canonical, structurally valid locale used for locale-sensitive platform APIs. */
  protected get effectiveLocale(): string {
    return resolveIntlLocale(this.effectiveMessageLocale);
  }

  /** Explicit alias for helpers whose locale role would otherwise be ambiguous. */
  protected get effectiveIntlLocale(): string {
    return this.effectiveLocale;
  }

  /** The effective text direction, including inherited CSS direction. */
  protected get effectiveDirection(): 'ltr' | 'rtl' {
    const direction = resolveLyraDirection(this);
    recordInheritedDirectionRead(this, direction);
    return direction;
  }

  override addEventListener<K extends keyof Events & string>(
    type: K,
    listener: (this: this, event: Events[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
  override addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: this, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  override addEventListener(
    type: string,
    listener: unknown,
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject,
      options
    );
  }

  override removeEventListener<K extends keyof Events & string>(
    type: K,
    listener: (this: this, event: Events[K]) => unknown,
    options?: boolean | EventListenerOptions
  ): void;
  override removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: this, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
  override removeEventListener(
    type: string,
    listener: unknown,
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject,
      options
    );
  }

  /**
   * Dispatch a composed, bubbling custom event; notifications are not veto points by default.
   *
   * `name` and `detail` are both checked against the component's own `Events` map — the same map
   * that types {@link addEventListener}. A misspelled event name, or a detail whose shape does not
   * match the one the map (and therefore the JSDoc, the manifest and the docs) advertises, is a
   * compile error rather than a silently-dispatched event nobody listens for. Components that do
   * not declare an event map keep the permissive `LyraEventMap` default.
   */
  protected emit<K extends keyof Events & string>(
    name: K,
    ...args: LyraEmitArgs<Events, K>
  ): LyraEmittedEvent<Events, K> {
    const [detail, options] = args as [unknown, LyraEmitOptions | undefined];
    // Events belong to the element's current document realm. This matters after iframe adoption:
    // consumers legitimately use the owner window's constructor for identity checks, and an
    // event created by the embedding window fails that contract even though dispatch succeeds.
    // Inert documents have no `defaultView` but still retain their creator realm. A probe created
    // by that document exposes the correct constructor; the global fallback exists only for
    // incomplete DOM shims whose `createEvent()` is absent or throws.
    const ownerDocument = (this as unknown as { ownerDocument?: Document })
      .ownerDocument;
    let CustomEventCtor = ownerDocument?.defaultView?.CustomEvent;
    if (!CustomEventCtor && ownerDocument) {
      try {
        const candidate = ownerDocument.createEvent('CustomEvent').constructor;
        if (typeof candidate === 'function') {
          CustomEventCtor = candidate as typeof CustomEvent;
        }
      } catch {
        // Fall through to the compatibility constructor below.
      }
    }
    CustomEventCtor ??= globalThis.CustomEvent;
    let snapshotsDetail = false;
    const identityDetailKeys = new Set<PropertyKey>();
    for (const constructor of trustedLyraConstructorChain(this)) {
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
    }
    const event = new CustomEventCtor(name, {
      detail:
        detail === undefined
          ? null
          : snapshotsDetail
          ? snapshotEventDetail(
              detail,
              ownerDocument?.defaultView,
              identityDetailKeys
            )
          : detail,
      bubbles: true,
      composed: true,
      cancelable: options?.cancelable ?? false,
    });
    this.dispatchEvent(event);
    return event as LyraEmittedEvent<Events, K>;
  }
}
