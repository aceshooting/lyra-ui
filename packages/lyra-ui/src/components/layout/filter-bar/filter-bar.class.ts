import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import type { LyraDateRangePreset } from '../../forms/date-picker/date-picker.class.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  collectFocusableElements,
  deepActiveElement,
} from '../../../internal/overlay-manager.js';
import {
  getDateTimeFormat,
  getListFormat,
} from '../../../internal/intl-cache.js';
import { styles } from './filter-bar.styles.js';
import '../../forms/select/select.class.js';
import '../../forms/combobox/combobox.class.js';
import '../../forms/combobox/option.class.js';
import '../../forms/date-picker/date-input.class.js';
import '../../forms/input/input.class.js';
import '../../overlays/chip/chip.class.js';
import '../../overlays/chip/chip-group.class.js';
import '../../forms/button/button.class.js';
import '../../overlays/spinner/spinner.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_filterBarActiveFilters, LYRA_DEFAULT_filterBarReset } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Which existing Lyra input family renders a given filter -- this component composes these,
 *  it never invents a new filter-input type of its own. `'date'` and `'date-range'` both map
 *  to `<lr-date-input>` (single vs. `mode="range"`); `'select'`/`'combobox'` map to their
 *  same-named counterparts, with `combobox`'s own `multiple` opting into a multi-value filter;
 *  `'text'` -- an open-ended free-text query rather than a closed choice set -- maps to
 *  `<lr-input>`, composed exactly like the rest (its own label/hint/error chrome, its own
 *  `required`), with this component adding only the optional `debounce` every free-text filter
 *  otherwise hand-rolls at the call site. `'custom'` delegates rendering and event-to-value
 *  conversion to the definition's `custom` adapter, so an existing Lyra control can participate
 *  without this component growing a branch for every control family. */
export type LyraFilterBarControlType =
  | 'select'
  | 'combobox'
  | 'date'
  | 'date-range'
  | 'text'
  | 'custom';

/** One closed-set choice for a `'select'`/`'combobox'` filter. */
export interface LyraFilterBarOption {
  readonly value: string;
  readonly label: string;
  /** Optional decorative leading visual rendered into the `<lr-option>`'s `start` slot — a status
   *  dot, a type glyph, a flag. Deliberately general Lit content rather than an icon-name string,
   *  matching `LyraSegmentedItem`/`LyraPaletteItem`'s own `icon` fields. It is rendered inert and
   *  `aria-hidden`, so it never contributes to the option's accessible name. */
  readonly icon?: unknown;
}

/** One filter's current value. Built-in controls use strings/string arrays; an untyped boolean
 * `false` at that boundary is canonical empty while `true` remains set. Custom controls may use
 * either boolean meaning through their adapter (for example, an `lr-checkbox` filter). */
export type LyraFilterBarFieldValue = string | readonly string[] | boolean | undefined;

/** Value/label bridge for a custom filter control. The renderer wires one of the context's event
 * handlers to the control's committed-change event; the adapter turns that event into the plain
 * value stored by `lr-filter-bar`. */
export interface LyraFilterBarCustomControlAdapter {
  /** Reads the new filter value from the custom control's event. `event.currentTarget` is the
   * rendered control when the handler is attached directly to it. */
  readonly valueFromEvent: (event: Event) => LyraFilterBarFieldValue;
  /** Canonical value that means this custom filter is cleared. Cleared values are omitted from
   * the sparse bar value. */
  readonly clearValue: LyraFilterBarFieldValue;
  /** Optional domain-specific empty predicate. When omitted, `Object.is(value, clearValue)` is
   * used (with shallow string-array equality for array clear values). */
  readonly isEmpty?: (value: LyraFilterBarFieldValue) => boolean;
  /** Formats the stored value for the active-filter chip. When omitted, strings and arrays use
   * the same list formatting as built-in choice filters and booleans render as `true`/`false`. */
  readonly formatValue?: (value: LyraFilterBarFieldValue) => string;
}

/** Context supplied to a custom filter renderer. The renderer owns the custom control's markup
 * and should bind `value`, `disabled`, `required`, and `errorText` as appropriate for that
 * control, then attach `onValueChange` (or the more specific `onInput`/`onChange`) to its
 * committed-value event and `onFocusout` to its blur/focusout event. */
export interface LyraFilterBarCustomControlContext {
  /** The custom definition's stable business identity. */
  readonly filterId: string;
  readonly label: string;
  readonly definition: LyraFilterBarCustomDefinition;
  readonly value: LyraFilterBarFieldValue;
  readonly disabled: boolean;
  readonly required: boolean;
  readonly errorText: string;
  /** Aborted when this exact schema is replaced, removed, disconnected, or superseded after
   * reconnect, so async custom renderers can release their work. */
  readonly signal: AbortSignal;
  /** Monotonic schema identity for diagnostics and cache keys. */
  readonly generation: number;
  /** Directly commits a value, useful for a custom control whose event has no DOM event payload. */
  readonly setValue: (value: LyraFilterBarFieldValue) => void;
  /** Reads the adapter value and commits it; stopPropagation is handled by the filter bar. */
  readonly onValueChange: (event: Event) => void;
  /** Aliases for consumers whose custom control uses native-style input/change naming. */
  readonly onInput: (event: Event) => void;
  readonly onChange: (event: Event) => void;
  /** Marks the custom filter touched so required validation becomes visible. */
  readonly onFocusout: () => void;
}

/** Renderer and adapter for a `type: "custom"` filter definition. The returned control is placed
 * inside the filter bar's `filter-control` part and is re-rendered with the current value. */
export interface LyraFilterBarCustomControl {
  readonly render: (context: LyraFilterBarCustomControlContext) => TemplateResult;
  readonly adapter: LyraFilterBarCustomControlAdapter;
}

interface LyraFilterBarDefinitionBase {
  /** Stable, unique business identity and the key used in `LyraFilterBarValue`. */
  readonly filterId: string;
  /** Visible label, forwarded to the composed control's own `label` prop (so it renders through
   *  that control's own label/hint/error chrome) -- caller-supplied content, not routed through
   *  `this.localize()` by this component (the same "data, not UI copy" carve-out a table's own
   *  column headers get). */
  readonly label: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly defaultValue?: string | readonly string[] | boolean;
}

export interface LyraFilterBarSelectDefinition extends LyraFilterBarDefinitionBase {
  readonly type: 'select';
  readonly options: readonly LyraFilterBarOption[];
}

export interface LyraFilterBarComboboxDefinition extends LyraFilterBarDefinitionBase {
  readonly type: 'combobox';
  readonly options: readonly LyraFilterBarOption[];
  readonly multiple?: boolean;
}

export interface LyraFilterBarTextDefinition extends LyraFilterBarDefinitionBase {
  readonly type: 'text';
  /** `'text'` only -- how long (ms) to wait after the last keystroke before committing the typed
   *  value to `value` and emitting a single `lr-input`, so a server-side query runs once per pause
   *  instead of once per character. Omitted, `0`, or a non-finite value means no debounce at all:
   *  every keystroke commits immediately. A pending debounce is always flushed by the field's own
   *  `change`/blur (so a blur never loses the last keystroke) and cancelled outright by
   *  `reset()`, a chip removal, and disconnection. Ignored for every other `type`, whose commits
   *  are discrete choices with nothing to debounce. */
  readonly debounce?: number;
}

interface LyraFilterBarDateDefinitionBase extends LyraFilterBarDefinitionBase {
  /** ISO `YYYY-MM-DD` lower bound, forwarded to `<lr-date-input>`'s own `min`. `'date'`/`'date-range'` only. */
  readonly min?: string;
  /** ISO `YYYY-MM-DD` upper bound, forwarded to `<lr-date-input>`'s own `max`. `'date'`/`'date-range'` only. */
  readonly max?: string;
}

export interface LyraFilterBarDateDefinition extends LyraFilterBarDateDefinitionBase {
  readonly type: 'date';
}

export interface LyraFilterBarDateRangeDefinition extends LyraFilterBarDateDefinitionBase {
  readonly type: 'date-range';
  /** Quick-range options ("Last 7 days", "This month", "All time") forwarded verbatim to the
   *  composed `<lr-date-input>`'s own `presets`, exactly like `min`/`max` -- this is the dashboard
   *  filter shape that row was built for, and `type: 'custom'` would mean hand-rendering the same
   *  control plus a full adapter just to set one property, forfeiting the built-in date-range chip
   *  localization on the way.
   *
   *  `'date-range'` only, deliberately not on the shared date base: a preset names two dates, so
   *  `<lr-date-picker>` ignores the list outside range mode, and declaring it on `'date'` would
   *  type-check a field that is guaranteed inert. Which preset a commit came from arrives on that
   *  edit's own `lr-input` as `appliedPreset`. */
  readonly presets?: readonly LyraDateRangePreset[];
}

export interface LyraFilterBarCustomDefinition extends LyraFilterBarDefinitionBase {
  readonly type: 'custom';
  readonly custom: LyraFilterBarCustomControl;
}

/** A host-declared filter. The discriminant makes choice options and custom adapters mandatory
 * exactly where runtime needs them, while excluding irrelevant fields from every other mode. */
export type LyraFilterBarFilterDefinition =
  | LyraFilterBarSelectDefinition
  | LyraFilterBarComboboxDefinition
  | LyraFilterBarTextDefinition
  | LyraFilterBarDateDefinition
  | LyraFilterBarDateRangeDefinition
  | LyraFilterBarCustomDefinition;

/**
 * The whole filter bar's current state: a plain, JSON-serializable object keyed by
 * `LyraFilterBarFilterDefinition.filterId`. This is the entire URL-querystring/app-state serialization
 * contract -- this component only reads and writes plain data through `value`, and never touches
 * `location`/`history`/storage itself; the host owns turning this object into (and back out of)
 * a querystring, matching every other Lyra "controlled" component's convention.
 */
export type LyraFilterBarValue = Readonly<Record<string, LyraFilterBarFieldValue>>;

export interface LyraFilterBarInputDetail {
  /** The full current value of every filter, not just the one that changed. */
  readonly value: LyraFilterBarValue;
  /** The filter that changed, or `undefined` when every filter changed at once (a `reset()`). */
  readonly filterId?: string;
  /** For a `'date-range'` filter committed from its quick-range row: the `presets` entry that
   *  produced this value, resolved from the composed `<lr-date-input>`'s own `appliedPreset`.
   *  `undefined` for every other filter type, and for a range picked or typed by hand.
   *
   *  A filter bar whose values round-trip through a query string has to persist WHICH preset is
   *  active rather than the pair it froze to -- "Last 7 days" must still mean the last 7 days after
   *  tomorrow's reload -- and that fact is not recoverable from `value`, which holds only the frozen
   *  ISO range. It rides the event rather than `value` because it is metadata about one edit, not a
   *  filter value: `value` stays the plain, JSON-serializable record it has always been. The entry
   *  is the bar's own frozen snapshot of the definition, so it compares identical to
   *  `filters[i].presets[j]`. */
  readonly appliedPreset?: LyraDateRangePreset;
}

export interface LyraFilterBarValidityDetail {
  readonly valid: boolean;
  /** Filter ids currently failing their own `required` check. */
  readonly invalidFilterIds: readonly string[];
}

export interface LyraFilterBarResetDetail {
  readonly value: LyraFilterBarValue;
}

export interface LyraFilterBarEventMap {
  'lr-input': CustomEvent<LyraFilterBarInputDetail>;
  'lr-validity-change': CustomEvent<LyraEventDetailSnapshot<LyraFilterBarValidityDetail>>;
  'lr-reset': CustomEvent<LyraFilterBarResetDetail>;
}

const MAX_FILTER_COLLECTION_ENTRIES = 10_000;
const MAX_FILTER_COLLECTION_NODES = 50_000;
const MAX_FILTER_COLLECTION_DEPTH = 16;
const OMIT_FILTER_VALUE = Symbol('omit-filter-value');
const EMPTY_FILTERS: readonly LyraFilterBarFilterDefinition[] = Object.freeze([]);
const EMPTY_VALUE: LyraFilterBarValue = Object.freeze({});
// One shared identity, so a date filter that declares no quick-range row never hands the composed
// control a fresh array per render (which would dirty-check as a change every time).
const EMPTY_DATE_PRESETS: readonly LyraDateRangePreset[] = Object.freeze([]);

interface FilterSnapshotBudget {
  remaining: number;
  readonly seen: WeakMap<object, unknown>;
}

function isPlainFilterRecord(value: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null;
  } catch {
    return false;
  }
}

function snapshotFilterEntry(
  value: unknown,
  budget: FilterSnapshotBudget,
  depth: number,
): unknown | typeof OMIT_FILTER_VALUE {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (typeof value === 'function') return value;
  if (depth > MAX_FILTER_COLLECTION_DEPTH || budget.remaining <= 0) return OMIT_FILTER_VALUE;
  const existing = budget.seen.get(value);
  if (existing !== undefined) return existing;

  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return OMIT_FILTER_VALUE;
  }
  if (isArray) {
    const output: unknown[] = [];
    budget.seen.set(value, output);
    let length = 0;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (
        descriptor &&
        'value' in descriptor &&
        typeof descriptor.value === 'number' &&
        Number.isSafeInteger(descriptor.value) &&
        descriptor.value >= 0
      ) {
        length = Math.min(descriptor.value, MAX_FILTER_COLLECTION_ENTRIES);
      }
    } catch {
      return Object.freeze(output);
    }
    for (let index = 0; index < length && budget.remaining > 0; index += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        continue;
      }
      if (!descriptor || !('value' in descriptor)) continue;
      budget.remaining -= 1;
      const entry = snapshotFilterEntry(descriptor.value, budget, depth + 1);
      if (entry !== OMIT_FILTER_VALUE) output.push(entry);
    }
    return Object.freeze(output);
  }

  if (!isPlainFilterRecord(value)) return value;
  const output: Record<PropertyKey, unknown> = {};
  budget.seen.set(value, output);
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return OMIT_FILTER_VALUE;
  }
  let retained = 0;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (retained >= MAX_FILTER_COLLECTION_ENTRIES || budget.remaining <= 0) break;
    const descriptor = descriptors[key as keyof PropertyDescriptorMap];
    if (!descriptor?.enumerable || !('value' in descriptor)) continue;
    retained += 1;
    budget.remaining -= 1;
    // Lit TemplateResults are immutable rendering identities rather than plain filter data. Their
    // `strings` array carries a non-enumerable `raw` contract that a record clone cannot preserve.
    const entry = key === 'icon'
      ? descriptor.value
      : snapshotFilterEntry(descriptor.value, budget, depth + 1);
    if (entry !== OMIT_FILTER_VALUE) {
      Object.defineProperty(output, key, {
        value: entry,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  }
  return Object.freeze(output);
}

function snapshotFilterDefinitions(
  value: readonly LyraFilterBarFilterDefinition[] | null | undefined,
): readonly LyraFilterBarFilterDefinition[] {
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return EMPTY_FILTERS;
  }
  if (!isArray) return EMPTY_FILTERS;
  const snapshot = snapshotFilterEntry(
    value,
    { remaining: MAX_FILTER_COLLECTION_NODES, seen: new WeakMap() },
    0,
  );
  // `value` was synchronously proven to be an array above. Snapshotting an array always returns
  // its frozen array clone; the non-array fallback was unreachable through this private path.
  return snapshot as readonly LyraFilterBarFilterDefinition[];
}

function snapshotFilterFieldValue(value: unknown): LyraFilterBarFieldValue {
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return undefined;
  }
  if (!isArray) {
    return typeof value === 'string' || typeof value === 'boolean' || value === undefined
      ? value
      : undefined;
  }
  const output: string[] = [];
  let sourceLength = 0;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      descriptor &&
      'value' in descriptor &&
      typeof descriptor.value === 'number' &&
      Number.isSafeInteger(descriptor.value) &&
      descriptor.value >= 0
    ) {
      sourceLength = descriptor.value;
    }
  } catch {
    return Object.freeze(output);
  }
  const length = Math.min(sourceLength, MAX_FILTER_COLLECTION_ENTRIES);
  for (let index = 0; index < length; index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      continue;
    }
    if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string') {
      output.push(descriptor.value);
    }
  }
  return Object.freeze(output);
}

const SELECT_EXPORT_PARTS = [
  'form-control-label: filter-control-label',
  'trigger: filter-control-field',
  'display-input: filter-control-input',
  'start: filter-control-start',
  'end: filter-control-end',
  'listbox: filter-control-listbox',
  'option: filter-control-option',
  'clear-button: filter-control-clear-button',
  'expand-icon: filter-control-expand-icon',
  'error: filter-control-error',
  'hint: filter-control-hint',
].join(', ');

const COMBOBOX_EXPORT_PARTS = [
  'form-control-label: filter-control-label',
  'combobox: filter-control-field',
  'combobox-input: filter-control-input',
  'start: filter-control-start',
  'end: filter-control-end',
  'listbox: filter-control-listbox',
  'option: filter-control-option',
  'clear-button: filter-control-clear-button',
  'expand-icon: filter-control-expand-icon',
  'error: filter-control-error',
  'hint: filter-control-hint',
].join(', ');

const INPUT_EXPORT_PARTS = [
  'form-control-label: filter-control-label',
  'input-wrapper: filter-control-field',
  'input: filter-control-input',
  'start: filter-control-start',
  'end: filter-control-end',
  'clear-button: filter-control-clear-button',
  'error: filter-control-error',
  'hint: filter-control-hint',
].join(', ');

const DATE_INPUT_EXPORT_PARTS = [
  'form-control-label: filter-control-label',
  'input-wrapper: filter-control-field',
  'input: filter-control-input',
  'start: filter-control-start',
  'end: filter-control-end',
  'clear-button: filter-control-clear-button',
  'expand-button: filter-control-expand-button',
  'expand-icon: filter-control-expand-icon',
  'popup: filter-control-popup',
  'error: filter-control-error',
  'hint: filter-control-hint',
].join(', ');

/** A built-in filter's value counts as active (shown as a chip, counted toward
 * `hasActiveFilters`, satisfying `required`) once it is neither absent, `false`, `''`, nor `[]`. */
function isBuiltInSet(value: LyraFilterBarFieldValue): boolean {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  return Array.isArray(value) ? value.length > 0 : value !== '';
}

/** Defines an arbitrary public filter id as an own data property. Assignment cannot be used here:
 * `__proto__` is a valid id and invokes Object.prototype's legacy setter on an ordinary record. */
function defineFilterValueEntry(
  record: Record<string, LyraFilterBarFieldValue>,
  key: string,
  value: LyraFilterBarFieldValue,
): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/** Clones the controlled value at its object and string-array boundaries into a mutable record. */
function cloneFilterValueRecord(
  value: LyraFilterBarValue,
): Record<string, LyraFilterBarFieldValue> {
  const clone: Record<string, LyraFilterBarFieldValue> = {};
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(value);
  let retained = 0;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (retained >= MAX_FILTER_COLLECTION_ENTRIES) break;
    const descriptor = descriptors[key as keyof PropertyDescriptorMap];
    if (typeof key !== 'string' || !descriptor?.enumerable || !('value' in descriptor)) continue;
    retained += 1;
    const fieldValue = snapshotFilterFieldValue(descriptor.value);
    if (fieldValue !== undefined) defineFilterValueEntry(clone, key, fieldValue);
  }
  return clone;
}

/** Clones and freezes the public controlled-value snapshot. */
function cloneFilterValue(value: LyraFilterBarValue): LyraFilterBarValue {
  return Object.freeze(cloneFilterValueRecord(value));
}

/**
 * `<lr-filter-bar>` — a row of dashboard filters, each declared by the host (`filters`) rather
 * than invented by this component: every filter composes an existing Lyra input --
 * `<lr-select>`/`<lr-combobox>` for closed choice sets, `<lr-date-input>` (single or `mode="range"`)
 * for dates, `<lr-input>` for a free-text query -- plus a `<lr-chip-group>` of removable
 * `<lr-chip>`s summarizing the currently-active filters, an `<lr-button>` that resets every
 * filter, and (while `loading`) an `<lr-spinner>` status indicator.
 *
 * A `'text'` filter is the one control that is *not* a fully controlled `.value=` binding: a text
 * field re-rendered from `value` mid-typing would push a stale value back into the field and drop
 * the caret to the end, so the field owns its own value while the user types and an external
 * `value` write is synced back in only once no edit is in flight (see `syncTextControls()`). Its
 * optional per-filter `debounce` (ms) is the only behaviour this component adds on top of the
 * composed control itself -- flushed by that field's own `change`/blur, cancelled by `reset()`, a
 * chip removal, and `disconnectedCallback`, so a stale keystroke can never overwrite a reset or
 * fire after teardown.
 *
 * Controlled, like every other Lyra data component: `value` is a plain, JSON-serializable object
 * (`LyraFilterBarValue`) the host reads/writes directly -- this component never touches
 * `location`/`history`/storage itself, so turning `value` into (and back out of) a URL
 * querystring or an app state store is entirely the host's own concern. Every edit -- picking an
 * option, committing a date, removing an active-filter chip, or clicking reset -- goes through
 * the same `setFilterValue()` path and emits a single `lr-input` carrying the *full* resulting
 * `value`, not just the changed filter's own value, mirroring `<lr-tool-param-form>`'s identical
 * "always the whole object" event contract. A composed control's own `lr-input`/`lr-change`
 * aliases stay inside this wrapper; its native-style `input`/`change` events retain their normal
 * bubbling path. Date/date-range chip labels localize only
 * round-trip-valid ISO `YYYY-MM-DD` segments, including literal four-digit years `0000`-`0099`.
 * Impossible dates, malformed values, and a range with either invalid endpoint remain verbatim so
 * display never invents a normalized day. A `'date-range'` filter may also declare `presets`,
 * forwarded to its composed `<lr-date-input>` exactly like `min`/`max`; the entry that produced a
 * commit rides that edit's own `lr-input` as `appliedPreset`, so a bar whose values round-trip
 * through a query string can persist which range is active rather than the pair it froze to.
 *
 * Validation is scoped to each filter definition's own `required` flag: `invalidFilterIds`/
 * `checkValidity()` are always live (plain getters over `filters`/`value`, not cached), and
 * `reportValidity()` additionally reveals every currently-invalid filter's inline error (rendered
 * by that filter's own composed control, via its `errorText`/`required` props -- this component
 * never renders a second, duplicate label/hint/error chrome of its own around an already-chromed
 * control) the same way a blur naturally would. `lr-validity-change` fires whenever the computed
 * `{ valid, invalidFilterIds }` actually changes.
 *
 * Deliberately not form-associated: a dashboard filter bar's state is not a submitted form field,
 * and every value it holds already round-trips through `value` directly -- see `disabled` below,
 * a plain property with no `<fieldset disabled>` cascade, for the same reason.
 *
 * The composed reset action stays on `lr-button`'s default `m` size tier, matching the default
 * select/combobox/input/date field height beside it instead of introducing a shorter action row.
 * The active-filter row and its composed chip group also zero every nested flex auto minimum, so
 * an unbroken localized value stays inside a narrow allocation and the chip's own label ellipsis
 * remains the overflow owner in both writing directions.
 *
 * @customElement lr-filter-bar
 * @event lr-input - A filter's value changed (including a chip removal or `reset()`).
 *   `detail: { value, filterId, appliedPreset }` -- `value` is always the complete object;
 *   `filterId` is the one filter that changed, or `undefined` for a `reset()`; `appliedPreset` is
 *   the `'date-range'` quick-range entry that produced this commit, and `undefined` everywhere
 *   else (another filter type, or a range picked/typed by hand).
 * @event lr-validity-change - The computed `{ valid, invalidFilterIds }` changed.
 * @event lr-reset - `reset()` ran (via the reset button or a direct call). `detail: { value }`.
 * @csspart base - The root `role="group"` wrapper.
 * @csspart controls - The row holding every filter control, the reset button, and the loading status.
 * @csspart filter-control - One filter's composed built-in control, or the wrapper around a
 *   custom renderer's control.
 * @csspart filter-control-label - A built-in control's label element.
 * @csspart filter-control-field - A built-in control's field frame: select trigger, combobox
 *   container, or text/date input wrapper.
 * @csspart filter-control-input - A built-in control's display or editable input.
 * @csspart filter-control-start - A built-in control's start adornment wrapper.
 * @csspart filter-control-end - A built-in control's end adornment wrapper.
 * @csspart filter-control-listbox - A select or combobox options popover.
 * @csspart filter-control-option - A select or combobox option row.
 * @csspart filter-control-clear-button - A built-in control's clear action, when rendered.
 * @csspart filter-control-expand-button - A date input's calendar-popup action.
 * @csspart filter-control-expand-icon - A select, combobox, or date-input expansion icon.
 * @csspart filter-control-popup - A date input's positioned calendar popup.
 * @csspart filter-control-error - A built-in control's validation message.
 * @csspart filter-control-hint - A built-in control's hint message.
 * @csspart reset-button - The reset `<lr-button>`.
 * @csspart status - The loading `<lr-spinner>`, only rendered while `loading`.
 * @csspart active-filters - The `role="group"` wrapper around the active-filter chip row, only rendered while any filter is set.
 * @csspart chips - The `<lr-chip-group>` inside `active-filters`.
 * @csspart chip - One active-filter `<lr-chip>`.
 * @status stable
 * @since 4.1.0
 */
export class LyraFilterBar extends LyraElement<LyraFilterBarEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    filterBarActiveFilters: LYRA_DEFAULT_filterBarActiveFilters,
    filterBarReset: LYRA_DEFAULT_filterBarReset,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-validity-change',
  ]);

  static override properties = {
    filters: { attribute: false, noAccessor: true },
    value: { attribute: false, noAccessor: true },
  };

  /** Accessible-name fallback for the root `role="group"` wrapper when the host has no
   *  `aria-label`, matching `<lr-control-group>`. Attribute presence wins, including an
   *  explicitly empty `aria-label`. */
  @property() label = '';

  /** Disables every composed filter control and the reset button. Plain property -- see the
   *  class doc for why this component isn't form-associated / fieldset-cascaded. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Shows the `status` spinner. Purely presentational -- filters stay editable while `loading`,
   *  since a host typically wants a user to keep refining filters while a previous query is
   *  still in flight; only the reset button (which would otherwise race a fresh, unrequeried
   *  reset against an in-flight fetch for the *previous* value) is disabled by it. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Filters that have been visited (focusout'd) at least once -- gates only the *visual*
   *  inline-error presentation on each composed control, matching every other form control in
   *  this library (`lr-select`/`lr-combobox`/`lr-tool-param-form` all avoid flashing red before
   *  the user has touched anything). */
  @state() private touchedFilters = new Set<string>();

  private _filters: readonly LyraFilterBarFilterDefinition[] = EMPTY_FILTERS;
  private _value: LyraFilterBarValue = EMPTY_VALUE;
  // One in-flight `debounce` timer per `'text'` filter id, plus the keystroke it will commit.
  // Presence in `debounceTimers` is also what marks that field as "the user is mid-edit", which
  // suppresses the external-value sync in `syncTextControls()`.
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingText = new Map<string, string>();
  private chipFocusGeneration = 0;
  // Guards lr-validity-change so it only fires on an actual change, not on every render --
  // `undefined` guarantees the first computed state always "changes" from it, mirroring
  // lr-tool-param-form's identical lastValidityKey.
  private lastValidityKey: string | undefined;
  private schemaGeneration = 0;
  private schemaAbortController?: AbortController;

  /** Host-declared filter definitions, rendered in array order. The first 10,000 definitions and
   * nested collection entries are deeply snapshotted and frozen; reassign after changing them.
   * `null`/`undefined` is treated as an empty array rather than throwing. Choice options require
   * string value/label data fields; malformed entries are omitted independently. Custom definitions
   * require a callable renderer and adapter. Exceptions thrown by admitted renderers propagate. */
  get filters(): readonly LyraFilterBarFilterDefinition[] {
    return this._filters;
  }
  set filters(next: readonly LyraFilterBarFilterDefinition[] | null | undefined) {
    const old = this._filters;
    // A queued text edit belongs to the exact schema that rendered its control. Even a same-filterId
    // replacement may change type/defaults/debounce semantics, so a schema assignment cancels all
    // drafts before the new controls are reconciled.
    this.cancelDebounce();
    this.renewSchemaContext();
    const seen = new Set<string>();
    this._filters = Object.freeze(snapshotFilterDefinitions(next).filter((definition) => {
      try {
        if (
          !definition ||
          typeof definition.filterId !== 'string' ||
          definition.filterId.length === 0 ||
          definition.filterId !== definition.filterId.trim()
        )
          return false;
        if (typeof definition.label !== 'string' || definition.label.trim().length === 0) return false;
        if (seen.has(definition.filterId)) return false;
        if ((definition.type === 'select' || definition.type === 'combobox') && !Array.isArray(definition.options)) {
          return false;
        }
        if (definition.type === 'custom' && (!definition.custom?.adapter || typeof definition.custom.render !== 'function')) return false;
        seen.add(definition.filterId);
        return true;
      } catch {
        return false;
      }
    }).map((definition) => {
      if (definition.type !== 'select' && definition.type !== 'combobox') return definition;
      const options = definition.options.filter((option) => {
        try {
          return option !== null && typeof option === 'object'
            && typeof Object.getOwnPropertyDescriptor(option, 'value')?.value === 'string'
            && typeof Object.getOwnPropertyDescriptor(option, 'label')?.value === 'string';
        } catch { return false; }
      });
      return Object.freeze({ ...definition, options: Object.freeze(options) });
    }));
    const ids = new Set(this._filters.map((definition) => definition.filterId));
    this.touchedFilters = new Set(
      [...this.touchedFilters].filter((id) => ids.has(id))
    );
    const oldValue = this._value;
    this._value = this.normalizeValue(this._value);
    this.requestUpdate('filters', old);
    if (this._value !== oldValue) this.requestUpdate('value', oldValue);
  }

  /** The current value of every filter -- see the class doc's serialization contract. Reads and
   *  writes clone and freeze the record and each string-array field, bounded to 10,000 keys and
   *  10,000 array entries, so mutations never affect this component's state or a subsequent
   *  `lr-input` detail. Reassign after changes. `null`/`undefined` writes clear to the canonical
   *  empty record while reads stay non-null. */
  get value(): LyraFilterBarValue {
    return cloneFilterValue(this._value);
  }
  set value(next: LyraFilterBarValue | null | undefined) {
    const old = this._value;
    this._value = this.normalizeValue(next);
    this.requestUpdate('value', old);
  }

  private renewSchemaContext(): void {
    this.schemaAbortController?.abort();
    const AbortControllerCtor = this.ownerDocument.defaultView?.AbortController ?? AbortController;
    this.schemaAbortController = new AbortControllerCtor();
    this.schemaGeneration += 1;
  }

  private get schemaSignal(): AbortSignal {
    if (!this.schemaAbortController) this.renewSchemaContext();
    return this.schemaAbortController!.signal;
  }

  private isEmpty(def: LyraFilterBarFilterDefinition, value: LyraFilterBarFieldValue): boolean {
    if (def.type !== 'custom') return !isBuiltInSet(value);
    const { adapter } = def.custom;
    if (adapter.isEmpty) return adapter.isEmpty(value);
    const clear = adapter.clearValue;
    if (Array.isArray(value) && Array.isArray(clear)) {
      return value.length === clear.length && value.every((entry, index) => entry === clear[index]);
    }
    return Object.is(value, clear);
  }

  private valueFor(def: LyraFilterBarFilterDefinition): LyraFilterBarFieldValue {
    return Object.prototype.hasOwnProperty.call(this._value, def.filterId)
      ? this._value[def.filterId]
      : def.type === 'custom'
        ? def.custom.adapter.clearValue
        : undefined;
  }

  private normalizeValue(value: LyraFilterBarValue | null | undefined): LyraFilterBarValue {
    const normalized: Record<string, LyraFilterBarFieldValue> = {};
    for (const def of this._filters) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value ?? {}, def.filterId);
      } catch {
        continue;
      }
      if (!descriptor || !('value' in descriptor)) continue;
      const fieldValue = snapshotFilterFieldValue(descriptor.value);
      if (this.isEmpty(def, fieldValue)) continue;
      defineFilterValueEntry(normalized, def.filterId, fieldValue);
    }
    return Object.freeze(normalized);
  }

  /** Whether any filter currently has a value. Also what gates the reset button's own disabled
   *  state and whether the `active-filters` chip row renders at all. */
  get hasActiveFilters(): boolean {
    return this._filters.some((def) => !this.isEmpty(def, this.valueFor(def)));
  }

  /** Filter ids currently failing their own `required` check -- a filter is invalid only when
   *  `required` is set and its value is unset (see `isSet`). Always live, never cached. */
  get invalidFilterIds(): readonly string[] {
    return Object.freeze(this._filters
      .filter((def) => def.required && this.isEmpty(def, this.valueFor(def)))
      .map((def) => def.filterId));
  }

  /** Whether every `required` filter currently has a value. Never reveals inline errors on its
   *  own -- see `reportValidity()`. */
  checkValidity(): boolean {
    return this.invalidFilterIds.length === 0;
  }

  /** Like `checkValidity()`, but also marks every currently-invalid filter as touched so its
   *  inline error becomes visible immediately -- the hook a consumer's own "Apply"/search action
   *  should call right before acting, mirroring `<lr-tool-param-form>`'s identical method. */
  reportValidity(): boolean {
    const invalid = this.invalidFilterIds;
    if (invalid.length)
      this.touchedFilters = new Set([...this.touchedFilters, ...invalid]);
    return invalid.length === 0;
  }

  /** Resets every filter to its own `defaultValue` (or unset, if it declared none), clears
   *  touched state, and emits both `lr-input` (the standard "value changed" event, so a listener
   *  that only listens for that still observes the reset) and `lr-reset` -- mirrors
   *  `<lr-combobox>`'s own `clear()`, which likewise emits its standard value events *plus* a
   *  dedicated `lr-clear`. */
  reset(): void {
    if (this.disabled) return;
    // Drop every in-flight keystroke first: a debounce that fired *after* the reset would
    // immediately overwrite the freshly-restored value with the discarded draft.
    this.cancelDebounce();
    this.touchedFilters = new Set();
    this.value = this.resetValue;
    this.emit('lr-input', Object.freeze({
      value: this.value,
      filterId: undefined,
      appliedPreset: undefined,
    }));
    this.emit('lr-reset', Object.freeze({ value: this.value }));
  }

  private get resetValue(): LyraFilterBarValue {
    const out: Record<string, LyraFilterBarFieldValue> = {};
    for (const def of this._filters) {
      if (def.defaultValue !== undefined && !this.isEmpty(def, def.defaultValue)) {
        const value = Array.isArray(def.defaultValue)
          ? Object.freeze([...def.defaultValue])
          : def.defaultValue;
        defineFilterValueEntry(out, def.filterId, value);
      }
    }
    return Object.freeze(out);
  }

  private setFilterValue(
    id: string,
    value: LyraFilterBarFieldValue,
    appliedPreset?: LyraDateRangePreset,
  ): void {
    const definition = this._filters.find((candidate) => candidate.filterId === id);
    if (this.disabled || !definition) return;
    // Object spread uses own-data-property creation, so existing special ids remain own entries.
    const next: Record<string, LyraFilterBarFieldValue> = { ...this._value };
    if (this.isEmpty(definition, value)) delete next[id];
    else defineFilterValueEntry(next, id, value);
    this.value = next;
    this.emit('lr-input', Object.freeze({
      value: this.value,
      filterId: id,
      appliedPreset,
    }));
  }

  private setCustomContextValue(
    definition: LyraFilterBarCustomDefinition,
    generation: number,
    value: LyraFilterBarFieldValue,
  ): void {
    if (
      generation !== this.schemaGeneration ||
      this.schemaSignal.aborted ||
      !this.isConnected ||
      !this._filters.includes(definition)
    ) return;
    this.setFilterValue(definition.filterId, value);
  }

  private markTouched(id: string): void {
    if (this.disabled || this.touchedFilters.has(id)) return;
    this.touchedFilters = new Set(this.touchedFilters).add(id);
  }

  private onControlChange = (id: string, e: Event): void => {
    // `appliedPreset` exists only on `<lr-date-input>`, and only while its own quick-range row
    // produced the commit -- it reads `undefined` on every other composed control, which is
    // exactly what the detail should then carry.
    const control = e.target as HTMLElement & {
      value: LyraFilterBarFieldValue;
      appliedPreset?: LyraDateRangePreset;
    };
    this.setFilterValue(id, control.value, control.appliedPreset);
  };

  /** Built-in controls keep their native-style `input`/`change` compatibility path, but their
   * prefixed aliases carry the child control's detail shape and must not impersonate this bar's
   * single full-value `lr-input` contract at the host boundary. */
  private stopControlAlias = (event: Event): void => {
    event.stopPropagation();
  };

  private onCustomControlChange = (
    def: LyraFilterBarCustomDefinition,
    generation: number,
    e: Event,
  ): void => {
    e.stopPropagation();
    this.setCustomContextValue(def, generation, def.custom.adapter.valueFromEvent(e));
  };

  /** A `'text'` filter's keystroke: commits immediately, or (with a positive `debounce`) parks the
   *  value until the user pauses. Non-finite/zero/negative delays mean "no debounce" rather than
   *  scheduling a timer that would never behave sensibly. */
  private onTextInput(def: LyraFilterBarTextDefinition, e: Event): void {
    if (this.disabled) return;
    const next = (e.target as HTMLElement & { value: string }).value ?? '';
    const delay = def.debounce;
    if (typeof delay !== 'number' || !Number.isFinite(delay) || delay <= 0) {
      this.cancelDebounce(def.filterId);
      this.setFilterValue(def.filterId, next);
      return;
    }
    this.pendingText.set(def.filterId, next);
    const existing = this.debounceTimers.get(def.filterId);
    if (existing !== undefined) clearTimeout(existing);
    this.debounceTimers.set(
      def.filterId,
      setTimeout(() => this.flushDebounce(def.filterId), delay)
    );
  }

  /** Commits an in-flight keystroke right now (the field's own `change`/blur, or the timer
   *  itself). A no-op when nothing is pending, so it is safe to call on every blur. */
  private flushDebounce(id: string): void {
    const timer = this.debounceTimers.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.debounceTimers.delete(id);
    const pending = this.pendingText.get(id);
    this.pendingText.delete(id);
    if (pending !== undefined) this.setFilterValue(id, pending);
  }

  /** Discards an in-flight keystroke without committing it -- one filter's, or (with no argument)
   *  every filter's. `syncTextControls()` then pushes the authoritative value back into the field
   *  on the next render, so the discarded draft does not linger on screen either. */
  private cancelDebounce(id?: string): void {
    for (const [key, timer] of this.debounceTimers) {
      if (id !== undefined && key !== id) continue;
      clearTimeout(timer);
      this.debounceTimers.delete(key);
      this.pendingText.delete(key);
    }
  }

  private onTextFocusout(id: string): void {
    // Flush before marking touched: `errorText` is recomputed from `_value` on the very next
    // render, so an unflushed debounce would flash "required" at a field the user *has* filled in.
    this.flushDebounce(id);
    this.markTouched(id);
  }

  private repairFocusAfterChipRemoval(
    index: number,
    filterId: string,
    shouldRepairFocus: boolean
  ): void {
    const generation = ++this.chipFocusGeneration;
    if (!shouldRepairFocus) return;
    void this.updateComplete.then(() => {
      if (
        !this.isConnected ||
        this.disabled ||
        generation !== this.chipFocusGeneration ||
        deepActiveElement(this.ownerDocument) !== this.ownerDocument.body
      )
        return;
      const chips = this.renderRoot.querySelectorAll<HTMLElement>('[part="chip"]');
      const chip = chips[Math.min(index, chips.length - 1)];
      const target = chip ? collectFocusableElements(chip)[0] : undefined;
      if (target) {
        target.focus();
        return;
      }
      for (const control of this.renderRoot.querySelectorAll<HTMLElement>(
        '[data-filter-id]'
      )) {
        if (control.dataset['filterId'] === filterId) {
          collectFocusableElements(control)[0]?.focus();
          return;
        }
      }
    });
  }

  private clearFilter(id: string, shouldRepairFocus = false): void {
    if (this.disabled) return;
    // Same race as reset(): a pending keystroke would land after the chip removal and undo it.
    this.cancelDebounce(id);
    const index = this.activeEntries.findIndex((entry) => entry.def.filterId === id);
    const def = this._filters.find((f) => f.filterId === id);
    if (!def) return;
    const clearValue: LyraFilterBarFieldValue =
      def.type === 'custom'
        ? def.custom.adapter.clearValue
        : def.type === 'combobox' && def.multiple
          ? []
          : '';
    this.setFilterValue(id, clearValue);
    this.repairFocusAfterChipRemoval(
      Math.max(0, index),
      id,
      shouldRepairFocus
    );
  }

  private displayValueFor(
    def: LyraFilterBarFilterDefinition,
    value: LyraFilterBarFieldValue
  ): string {
    if (def.type === 'custom') {
      const formatted = def.custom?.adapter.formatValue?.(value);
      if (formatted !== undefined) return formatted;
      if (Array.isArray(value)) {
        return getListFormat(this.effectiveLocale, {
          style: 'long',
          type: 'conjunction',
        }).format(value);
      }
      return value === undefined ? '' : String(value);
    }
    if (def.type === 'select' || def.type === 'combobox') {
      const values = Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : typeof value === 'string'
        ? [value]
        : [];
      // Show each option's own label, not its raw value, when it's a known choice -- falls back
      // to the raw value verbatim for a value that no longer matches any declared option.
      const labels = values.map(
        (v) => def.options?.find((o) => o.value === v)?.label ?? v
      );
      return labels.length > 1
        ? getListFormat(this.effectiveLocale, {
            style: 'long',
            type: 'conjunction',
          }).format(labels)
        : labels[0] ?? '';
    }
    if (def.type === 'text') {
      // Verbatim, deliberately *before* the date branch below: a free-text query is arbitrary user
      // input with no range separator to prettify, so running it through that branch's
      // `replace('/', ' – ')` would silently mangle any query containing a slash ("GET /api/v1").
      return typeof value === 'string' ? value : '';
    }
    if (typeof value !== 'string') return '';
    const formatter = getDateTimeFormat(this.effectiveLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const parseIso = (input: string): Date | undefined => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
      if (!match) return undefined;
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(0);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCFullYear(year, month - 1, day);
      return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
        ? date
        : undefined;
    };
    const segments = value.split('/');
    if (
      (def.type === 'date' && segments.length !== 1) ||
      (def.type === 'date-range' && segments.length !== 2)
    ) return value;
    const [startText, endText] = segments;
    const start = parseIso(startText ?? '');
    const end = endText === undefined ? undefined : parseIso(endText);
    if (!start || (endText !== undefined && (!end || end.getTime() < start.getTime()))) return value;
    return end ? formatter.formatRange(start, end) : formatter.format(start);
  }

  private get activeEntries(): {
    def: LyraFilterBarFilterDefinition;
    display: string;
  }[] {
    return this._filters
      .filter((def) => !this.isEmpty(def, this.valueFor(def)))
      .map((def) => ({
        def,
        display: this.displayValueFor(def, this.valueFor(def)),
      }));
  }

  /** Every `'text'` filter's debounce dies with the element. Without this a detached filter bar
   *  would still fire its timer and emit `lr-input` after teardown; a re-parent (which also runs
   *  this) simply drops the uncommitted keystroke, which the next keystroke or blur re-commits. */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cancelDebounce();
    this.schemaAbortController?.abort();
    this.schemaAbortController = undefined;
    this.schemaGeneration += 1;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.schemaAbortController || this.schemaAbortController.signal.aborted) {
      this.renewSchemaContext();
      if (this.hasUpdated) this.requestUpdate();
    }
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (this.isConnected) this.syncTextControls();
      });
    }
  }

  /** Pushes an *external* `value` change back into each uncontrolled `'text'` field -- a host
   *  write, a chip removal, a `reset()`. Skipped entirely while that field has a debounce in
   *  flight: the user is mid-edit and owns the field (and its caret) until they pause. */
  private syncTextControls(): void {
    if (!this._filters.some((def) => def.type === 'text')) return;
    const fields = new Map<string, HTMLElement & { value: string }>();
    for (const node of this.renderRoot.querySelectorAll(
      'lr-input[data-filter-id]'
    )) {
      const element = node as HTMLElement & { value: string };
      const id = element.dataset['filterId'];
      if (id !== undefined) fields.set(id, element);
    }
    for (const def of this._filters) {
      if (def.type !== 'text' || this.debounceTimers.has(def.filterId)) continue;
      const field = fields.get(def.filterId);
      if (!field) continue;
      const raw = this._value[def.filterId];
      const next = typeof raw === 'string' ? raw : '';
      if (field.value !== next) field.value = next;
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('disabled') && this.disabled) this.cancelDebounce();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncTextControls();
    if (changed.has('value') || changed.has('filters')) {
      const invalidFilterIds = this.invalidFilterIds;
      const valid = invalidFilterIds.length === 0;
      const key = JSON.stringify({ valid, invalidFilterIds });
      if (key !== this.lastValidityKey) {
        this.lastValidityKey = key;
        this.emit('lr-validity-change', Object.freeze({
          valid,
          invalidFilterIds: Object.freeze([...invalidFilterIds]),
        }));
      }
    }
  }

  /** One `<lr-option>`, shared by the select and combobox branches so an option's optional `icon`
   *  reaches both. The adornment goes into `<lr-option>`'s own `start` slot as inert, aria-hidden
   *  chrome, so it can neither take focus nor join the option's accessible name. */
  private renderOption(option: LyraFilterBarOption): TemplateResult {
    return html`<lr-option value=${option.value}
      >${option.icon === undefined || option.icon === null
        ? nothing
        : html`<span slot="start" aria-hidden="true" inert>${option.icon}</span>`}${option.label}</lr-option
    >`;
  }

  private renderControl(def: LyraFilterBarFilterDefinition): TemplateResult {
    const value = this.valueFor(def);
    const missing = Boolean(def.required) && this.isEmpty(def, value);
    const errorText =
      this.touchedFilters.has(def.filterId) && missing
        ? this.localize('fieldRequired')
        : '';
    const onChange = (e: Event) => this.onControlChange(def.filterId, e);
    const onFocusout = () => this.markTouched(def.filterId);

    if (def.type === 'custom') {
      const custom = def.custom;
      const generation = this.schemaGeneration;
      const signal = this.schemaSignal;
      const onCustomValueChange = (e: Event) => this.onCustomControlChange(def, generation, e);
      const context: LyraFilterBarCustomControlContext = {
        filterId: def.filterId,
        label: def.label,
        definition: def,
        value,
        disabled: this.disabled,
        required: Boolean(def.required),
        errorText,
        signal,
        generation,
        setValue: (next) => this.setCustomContextValue(def, generation, next),
        onValueChange: onCustomValueChange,
        onInput: onCustomValueChange,
        onChange: onCustomValueChange,
        onFocusout: () => {
          if (
            generation === this.schemaGeneration &&
            !signal.aborted &&
            this._filters.includes(def)
          ) onFocusout();
        },
      };
      return html`<div
        part="filter-control"
        data-filter-id=${def.filterId}
        @lr-input=${(event: Event) => event.stopPropagation()}
        @lr-change=${(event: Event) => event.stopPropagation()}
      >${custom.render(context)}</div>`;
    }

    if (def.type === 'combobox') {
      const multiple = Boolean(def.multiple);
      const comboValue = multiple
        ? Array.isArray(value)
          ? value
          : []
        : typeof value === 'string'
        ? value
        : '';
      return html`<lr-combobox
        part="filter-control"
        exportparts=${COMBOBOX_EXPORT_PARTS}
        data-filter-id=${def.filterId}
        .label=${def.label}
        placeholder=${def.placeholder || ''}
        ?multiple=${multiple}
        ?required=${Boolean(def.required)}
        .errorText=${errorText}
        .value=${comboValue}
        ?disabled=${this.disabled}
        @change=${onChange}
        @lr-input=${this.stopControlAlias}
        @lr-change=${this.stopControlAlias}
        @focusout=${onFocusout}
        >${(def.options ?? []).map((o) => this.renderOption(o))}</lr-combobox
      >`;
    }

    if (def.type === 'text') {
      // Deliberately no `.value=` binding, unlike every other branch here: re-rendering a
      // controlled text field mid-typing fights the caret (and, with a debounce pending, would
      // push the not-yet-committed old value back over what the user just typed). The field is
      // uncontrolled-with-sync instead -- see `syncTextControls()`.
      //
      // Driven off `lr-input`/`lr-change` rather than the native-style `input`/`change`: `lr-input`
      // re-emits its own composed `input` alongside the native one bubbling out of its shadow
      // root, so an `@input` listener here would fire (and commit) twice per keystroke. Its
      // `lr-*` aliases fire exactly once -- and must be stopped at the source, because they are
      // bubbling+composed and would otherwise escape this shadow root and reach the host as
      // *this* component's own `lr-input`, carrying `{ value: string }` instead of the documented
      // `{ value: LyraFilterBarValue, filterId }`. The native-style `input`/`change` keep
      // propagating, exactly as they already do from `lr-select`/`lr-date-input`.
      return html`<lr-input
        part="filter-control"
        exportparts=${INPUT_EXPORT_PARTS}
        data-filter-id=${def.filterId}
        type="text"
        .label=${def.label}
        placeholder=${def.placeholder || ''}
        ?required=${Boolean(def.required)}
        .errorText=${errorText}
        ?disabled=${this.disabled}
        @lr-input=${(e: Event) => {
          e.stopPropagation();
          this.onTextInput(def, e);
        }}
        @lr-change=${(e: Event) => {
          e.stopPropagation();
          this.flushDebounce(def.filterId);
        }}
        @focusout=${() => this.onTextFocusout(def.filterId)}
      ></lr-input>`;
    }

    if (def.type === 'date' || def.type === 'date-range') {
      return html`<lr-date-input
        part="filter-control"
        exportparts=${DATE_INPUT_EXPORT_PARTS}
        data-filter-id=${def.filterId}
        .label=${def.label}
        placeholder=${def.placeholder || ''}
        .mode=${def.type === 'date-range' ? 'range' : 'single'}
        .min=${def.min || ''}
        .max=${def.max || ''}
        .presets=${def.type === 'date-range'
          ? def.presets ?? EMPTY_DATE_PRESETS
          : EMPTY_DATE_PRESETS}
        ?required=${Boolean(def.required)}
        .errorText=${errorText}
        .value=${typeof value === 'string' ? value : ''}
        ?disabled=${this.disabled}
        @change=${onChange}
        @lr-input=${this.stopControlAlias}
        @lr-change=${this.stopControlAlias}
        @focusout=${onFocusout}
      ></lr-date-input>`;
    }

    // 'select' (also the fallback for an unrecognized type, so a filter with a bad `type` still
    // renders a usable, if empty, control instead of vanishing silently).
    return html`<lr-select
      part="filter-control"
      exportparts=${SELECT_EXPORT_PARTS}
      data-filter-id=${def.filterId}
      .label=${def.label}
      placeholder=${def.placeholder || ''}
      ?required=${Boolean(def.required)}
      .errorText=${errorText}
      .value=${typeof value === 'string' ? value : ''}
      ?disabled=${this.disabled}
      @change=${onChange}
      @lr-input=${this.stopControlAlias}
      @lr-change=${this.stopControlAlias}
      @focusout=${onFocusout}
      >${(def.options ?? []).map((o) => this.renderOption(o))}</lr-select
    >`;
  }

  private rendersValidationError(def: LyraFilterBarFilterDefinition): boolean {
    return Boolean(def.required) &&
      this.touchedFilters.has(def.filterId) &&
      this.isEmpty(def, this.valueFor(def));
  }

  override render(): TemplateResult {
    const accessibleLabel = this.hasAttribute('aria-label')
      ? this.getAttribute('aria-label')!
      : this.label || nothing;
    const active = this.activeEntries;
    return html`
      <div part="base" role="group" aria-label=${accessibleLabel}>
        <div part="controls">
          ${this._filters.map((def) => html`<div class="filter-field">
            ${this.renderControl(def)}
            <span
              class="validation-spacer"
              aria-hidden="true"
              ?hidden=${this.rendersValidationError(def)}
            ></span>
          </div>`)}
          <div class="reset-field">
            <lr-button
              part="reset-button"
              appearance="quiet"
              ?disabled=${this.disabled || this.loading || !this.hasActiveFilters}
              @click=${() => this.reset()}
            >
              ${this.localize('filterBarReset')}
            </lr-button>
            <span class="validation-spacer" aria-hidden="true"></span>
          </div>
          ${this.loading
            ? html`<lr-spinner part="status"></lr-spinner>`
            : nothing}
        </div>
        ${active.length > 0
          ? html`<div
              part="active-filters"
              role="group"
              aria-label=${this.localize('filterBarActiveFilters')}
            >
              <lr-chip-group part="chips">
                ${active.map(
                  ({ def, display }) => html`<lr-chip
                    part="chip"
                    ?removable=${!this.disabled}
                    value=${def.filterId}
                    @lr-remove=${(e: Event) => {
                      e.stopPropagation();
                      const chip = e.currentTarget as HTMLElement;
                      this.clearFilter(
                        def.filterId,
                        (() => {
                          const active = activeElementIn(chip.shadowRoot);
                          return (active as Partial<Node> | null)?.nodeType === 1;
                        })()
                      );
                    }}
                    >${def.label}: ${display}</lr-chip
                  >`
                )}
              </lr-chip-group>
            </div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-filter-bar': LyraFilterBar;
  }
}
