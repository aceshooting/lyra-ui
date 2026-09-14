import type { PropertyDeclaration, ReactiveElement } from 'lit';
import { readPersistedState } from './persisted-state.js';

/**
 * Restore-on-first-update support for a reactive property that also persists to `localStorage`.
 *
 * A component with a `storage-key` has to answer one question before it restores anything: did the
 * consumer set this property, or is it still sitting on its declared default? Only the second case
 * may be overwritten by stored state -- a controlled `.open=${false}` binding must stay
 * authoritative over whatever an earlier session left behind, with no change event firing for a
 * value the consumer never asked for.
 *
 * `changedProperties.has(name)` cannot answer it. A declared default lands in the very first
 * `changedProperties` batch on its own: with assignment-semantics class fields the initializer runs
 * through the generated setter during construction, and a hand-installed accessor registered with
 * `noAccessor` is worse still -- Lit marks it `wrapped` and seeds the first batch with its current
 * value even when nothing ever assigned it. Either way the guard is `true` for every instance, so
 * the restore it guards never runs at all. That failure is silent: the component keeps rendering,
 * the stored value is simply ignored forever.
 *
 * This module supplies the one shape that does answer it -- an accessor pair over a private
 * per-instance slot that records whether the *setter* ever ran. The declared default is supplied
 * through `initial` rather than a class field, so no write happens during construction, and the
 * flag stays `false` until something outside the component assigns the property (a JS write, an
 * attribute parsed before upgrade, or a pre-upgrade own property Lit replays).
 *
 * Call-site shape (a static block keeps the installation inside class evaluation instead of adding
 * a module-level side effect a bundler cannot drop):
 *
 * ```ts
 * class LyraExample extends LyraElement {
 *   // No initializer and no class field: `initial` below is the declared default. A class field
 *   // would assign through the setter during construction and mark the property explicitly set,
 *   // which is the exact confusion this module exists to remove.
 *   declare open: boolean;
 *   static {
 *     definePersistedProperty(this.prototype, 'open', {
 *       attribute: true, type: Boolean, reflect: true, initial: false,
 *     });
 *   }
 * }
 * ```
 *
 * The restore itself belongs in `willUpdate()`, before the first render, so the restored value
 * folds into the first paint instead of scheduling a second update. It is gated on
 * `!this.hasUpdated`, matching the shapes it replaces:
 *
 * ```ts
 * if (!this.hasUpdated) {
 *   const restored = restoreFromStorage<boolean>(
 *     this.storageFullKey,
 *     isPersistedPropertyExplicitlySet(this, 'open'),
 *     (v): v is { value?: boolean } =>
 *       typeof v === 'object' && v !== null && typeof (v as { value?: unknown }).value === 'boolean',
 *   );
 *   if (restored !== undefined) this.open = restored;
 * }
 * ```
 *
 * Both halves of that gate are load bearing and neither replaces the other. `!this.hasUpdated`
 * answers "is this the first pass"; the flag answers "did anything outside the component set this
 * property", which is the question `changedProperties.has()` gets wrong. Dropping `!hasUpdated`
 * does not merely cost a `localStorage` read per update: for a component with a `storage-key`,
 * nothing stored yet and no consumer write, the flag never rises, so a value that appears in that
 * key later -- a second instance sharing the key, another tab -- is applied mid-life, long after
 * first paint, with no consumer action. Dropping the flag instead re-introduces the original bug,
 * because `!hasUpdated` alone cannot see a consumer's pre-upgrade binding.
 *
 * Applying a restore goes through the setter, so it marks the property explicitly set too. That
 * keeps a restore that does run from running twice -- a reconnect, a `storage-key` change -- and so
 * from clobbering a consumer's (or the user's) intervening choice with stale storage.
 *
 * A record holding several fields under one key (a rail persisting open state, width and mode
 * together) reads through `readPersistedState()` directly and gates each field with
 * `isPersistedPropertyExplicitlySet()`; `restoreFromStorage()` covers the single-value
 * `{ value }` record only. Every field gated that way must itself be installed by
 * `definePersistedProperty()` -- an ordinary `@property` owns no persisted slot, so asking about it
 * throws rather than silently answering `false` and turning a sound guard into an unconditional
 * overwrite. A field that stays an ordinary `@property` with no declared default keeps its existing
 * `!changed.has(name)` guard, which is sound precisely because nothing enters an undefaulted
 * property into the first `changedProperties` batch. `scripts/check-persisted-restore.mjs` gates
 * both halves of that rule.
 */

interface PersistedSlot {
  value: unknown;
  explicitlySet: boolean;
}

/** Per-element slots. A WeakMap (rather than a field on the element) keeps both the value and the
 *  flag unreachable from the public surface, and keeps two instances of the same component from
 *  ever sharing either one. */
const persistedSlots = new WeakMap<object, Map<PropertyKey, PersistedSlot>>();

/** The property names each prototype had installed on it. A slot is created lazily by the first
 *  read or write, so its absence cannot tell "installed but untouched" apart from "never
 *  installed"; this registry can, which is what makes the flag reader fail closed. */
const installedProperties = new WeakMap<object, Set<PropertyKey>>();

/** Whether any prototype in `host`'s chain had `name` installed by
 *  {@linkcode definePersistedProperty}. */
function ownsPersistedProperty(host: object, name: PropertyKey): boolean {
  for (
    let proto: object | null = Object.getPrototypeOf(host);
    proto !== null;
    proto = Object.getPrototypeOf(proto)
  ) {
    if (installedProperties.get(proto)?.has(name) === true) return true;
  }
  return false;
}

function slotFor(host: object, name: PropertyKey, initial: unknown): PersistedSlot {
  let owned = persistedSlots.get(host);
  if (owned === undefined) {
    owned = new Map<PropertyKey, PersistedSlot>();
    persistedSlots.set(host, owned);
  }
  let slot = owned.get(name);
  if (slot === undefined) {
    slot = { value: initial, explicitlySet: false };
    owned.set(name, slot);
  }
  return slot;
}

/** Declaration for a property installed by {@linkcode definePersistedProperty}. Everything except
 *  `initial` and `coerce` is forwarded verbatim to Lit's own property registration. */
export interface PersistedPropertyOptions<V> {
  /** The value the property reads before anything assigns it. Declared here rather than as a class
   *  field precisely because a class field would run through the setter. */
  initial: V;
  /** `true` for the lower-cased property name, a string for an explicit attribute name, `false`
   *  for a property with no attribute. Required: an attribute is the most common way a consumer
   *  sets one of these properties, so the decision is never left implicit. */
  attribute: boolean | string;
  /** Reflects the property back to its attribute through Lit's own reflection, which suppresses
   *  the attribute-to-property write it would otherwise trigger. */
  reflect?: boolean;
  /** Lit's attribute converter hint (`Boolean`, `Number`, `String`, `Object`, `Array`). */
  type?: PropertyDeclaration<V>['type'];
  /** Replaces the default attribute converter. A property declared with `initial: true` needs
   *  `trueDefaultBooleanConverter` from `./converters.js` here: Lit's presence-based boolean
   *  converter cannot parse `prop="false"`, so a `true`-defaulting boolean is unsettable from
   *  markup without it. */
  converter?: PropertyDeclaration<V>['converter'];
  /** Replaces Lit's `notEqual` dirty check. Applies to the update this module's setter requests,
   *  so returning `false` keeps a write out of the render pass while the getter still reports it. */
  hasChanged?: PropertyDeclaration<V>['hasChanged'];
  /** Normalizes every incoming write (for example `Boolean(next)` for a property a consumer may
   *  set to a truthy non-boolean). Never applied to `initial`, which is already the declared
   *  value. */
  coerce?: (next: V) => V;
}

/**
 * Installs a get/set pair for `name` on `target` (a class prototype) plus the private
 * explicitly-set flag {@linkcode isPersistedPropertyExplicitlySet} reads, and registers the
 * property with Lit using `noAccessor` so Lit leaves that pair in place.
 *
 * The property is not backed by a class field, so nothing assigns it during construction and the
 * flag reports only genuine writes. Adding a class field of the same name re-introduces exactly
 * the ambiguity this removes.
 */
export function definePersistedProperty<T extends ReactiveElement, K extends keyof T & string>(
  target: T,
  name: K,
  options: PersistedPropertyOptions<T[K]>,
): void {
  const { initial, coerce, ...declaration } = options;
  const owned = installedProperties.get(target) ?? new Set<PropertyKey>();
  owned.add(name);
  installedProperties.set(target, owned);
  Object.defineProperty(target, name, {
    configurable: true,
    enumerable: true,
    get(this: ReactiveElement): T[K] {
      return slotFor(this, name, initial).value as T[K];
    },
    set(this: ReactiveElement, next: T[K]): void {
      const slot = slotFor(this, name, initial);
      slot.explicitlySet = true;
      const previous = slot.value as T[K];
      slot.value = coerce === undefined ? next : coerce(next);
      this.requestUpdate(name, previous);
    },
  });
  const constructor = target.constructor as unknown as typeof ReactiveElement;
  constructor.createProperty(name, { ...declaration, noAccessor: true });
}

/**
 * Whether `name` was ever assigned on `host` -- by a JS write, by an attribute Lit converted, or
 * by a pre-upgrade own property Lit replayed before the first update. A property still holding the
 * `initial` value it was declared with reports `false`, which is the one distinction
 * `changedProperties.has()` cannot make.
 *
 * Throws when `name` was never installed on `host` by {@linkcode definePersistedProperty} -- a
 * typo, or an ordinary `@property` a multi-field restore tried to gate this way. Answering `false`
 * there would be far worse than throwing: `false` reads as "the consumer has not set it", so the
 * restore fires unconditionally and overwrites a consumer's explicit binding with stale storage,
 * which is the exact regression this module exists to prevent.
 */
export function isPersistedPropertyExplicitlySet(host: object, name: PropertyKey): boolean {
  if (!ownsPersistedProperty(host, name)) {
    throw new TypeError(
      `isPersistedPropertyExplicitlySet(): '${String(name)}' is not installed by definePersistedProperty() on this element. Install it, or guard that field some other way.`,
    );
  }
  return persistedSlots.get(host)?.get(name)?.explicitlySet === true;
}

/**
 * The persisted value for `storageKey`, or `undefined` when there is nothing to apply.
 *
 * Returns `undefined` -- without touching storage at all -- when `wasExplicitlySet` is `true`, so
 * a consumer-supplied value is never overwritten. Otherwise it reads through
 * `readPersistedState()`, which already fails silently on unavailable storage, malformed JSON and
 * a record that fails `isValid`. An unset `storageKey` reads nothing, matching the rule that a
 * component without persistence configured touches storage neither to read nor to write.
 */
export function restoreFromStorage<V>(
  storageKey: string | undefined,
  wasExplicitlySet: boolean,
  isValid: (parsed: unknown) => parsed is { value?: V },
): V | undefined {
  if (wasExplicitlySet) return undefined;
  const parsed = readPersistedState(storageKey, isValid);
  return parsed === null ? undefined : parsed.value;
}
