import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import type { LyraDateRangePreset } from '../../forms/date-picker/date-picker.class.js';
import type { LyraInputType } from '../../forms/input/input.class.js';
import type { LyraSize } from '../../../internal/variants.js';
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
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { DebounceController } from '../../../internal/debounce-controller.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './filter-bar.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_filterBarActiveFilters, LYRA_DEFAULT_filterBarReset } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

// Deliberately NOT a bare side-effect import of the composed controls' own `.class.js` modules
// (select/combobox/dropdown/dropdown-item/option/date-input/input/chip/chip-group/button/
// spinner): every composed element below is rendered by tag name in `html` templates with zero
// compile-time coupling, exactly like `<lr-icon-button>` composes `<lr-icon>` without importing
// `icon.class.js` from its own class module. This file is therefore a genuinely side-effect-free
// class module (see coding-conventions.md's "Tree-shakeable exports"), which is what makes
// `filter-bar-register.ts` (the lean registration entry -- see its own header comment) actually
// lean: registering only `<lr-filter-bar>` and leaving every composed control's own registration
// to whichever entry, default or per-control, the consumer separately imports. `filter-bar.ts`
// (the default entry) keeps importing every composed control's own registration module directly,
// so an existing `import '@aceshooting/lyra-ui/components/layout/filter-bar/filter-bar.js'`
// keeps registering everything it always has.

/** Which existing Lyra input family renders a given filter -- this component composes these,
 *  it never invents a new filter-input type of its own. `'date'` and `'date-range'` both map
 *  to `<lr-date-input>` (single vs. `mode="range"`); `'select'`/`'combobox'` map to their
 *  same-named counterparts, with `combobox`'s own `multiple` opting into a multi-value filter;
 *  `'text'` -- an open-ended free-text query rather than a closed choice set -- maps to
 *  `<lr-input>`, composed exactly like the rest (its own label/hint/error chrome, its own
 *  `required`), with this component adding only the optional `debounce` every free-text filter
 *  otherwise hand-rolls at the call site. `'checkbox-menu'` maps to `<lr-dropdown>` plus one
 *  `<lr-dropdown-item type="checkbox">` per option -- the library's own checkbox menu, a
 *  toolbar-button shape for a small fixed set of independently togglable categories, with the
 *  same `string[]` value a `'combobox'` with `multiple` carries. `'custom'` delegates rendering
 *  and event-to-value conversion to the definition's `custom` adapter, so an existing Lyra
 *  control can participate without this component growing a branch for every control family.
 *  `'chip'` is the one type that maps to no control at all: its value is owned by a widget
 *  elsewhere on the page, and this component renders only its active-filter chip. */
export type LyraFilterBarControlType =
  | 'select'
  | 'combobox'
  | 'checkbox-menu'
  | 'date'
  | 'date-range'
  | 'text'
  | 'chip'
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
  /** Extra text this option also matches on, forwarded verbatim to `<lr-option>`'s own
   *  `search-text`, so a `'combobox'` filter can match a long canonical key ("SEV-1 production
   *  outage") while the row keeps displaying the short `label` ("Urgent"). **`'combobox'` only.**
   *  The attribute is written on every choice type's `<lr-option>`, but only `<lr-combobox>`
   *  consults it: `<lr-select>`'s listbox type-ahead matches the option's `label` alone, so
   *  declaring `searchText` on a `'select'` filter's options changes nothing there, and a
   *  `'checkbox-menu'` has no text entry to match against at all. Omitted leaves the control's
   *  default (match on the label alone). */
  readonly searchText?: string;
  /**
   * Marks this option non-actionable: forwarded to `<lr-option>`'s own `disabled` for a `'select'`
   * or `'combobox'` filter, and to the composed `<lr-dropdown-item>`'s own `disabled` for a
   * `'checkbox-menu'` filter. The composed control already renders it as a genuinely disabled row
   * (no tab stop / roving stop, no hover or press affordance, `aria-disabled`) and already steps
   * roving/arrow-key navigation past it -- this field only forwards a value that control already
   * knows how to honour. Omitted or `false` renders the option exactly as before this field
   * existed.
   */
  readonly disabled?: boolean;
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
   * the same list formatting as built-in choice filters and booleans render as `true`/`false`.
   * `locale` is `effectiveLocale`, the same value every built-in filter type's own chip formatting
   * (`getListFormat`/`getDateTimeFormat`) already receives -- an existing single-argument
   * `formatValue` implementation keeps working unchanged, since JS simply ignores a second
   * argument it never declared. */
  readonly formatValue?: (value: LyraFilterBarFieldValue, locale: string) => string;
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
  /** While `definition.debounce` has a commit pending, this is that pending value rather than the
   *  last-committed one -- exactly like `'combobox'`'s own debounce -- so a renderer that binds
   *  this as a fully controlled `.value=` never reverts mid-delay. Otherwise the last-committed
   *  value, same as always. */
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
  /** Reads the adapter value and commits it -- immediately, or (with `definition.debounce` set) via
   *  that same delayed-commit path; stopPropagation is handled by the filter bar. */
  readonly onValueChange: (event: Event) => void;
  /** Aliases for consumers whose custom control uses native-style input/change naming. */
  readonly onInput: (event: Event) => void;
  readonly onChange: (event: Event) => void;
  /** Marks the custom filter touched so required validation becomes visible, flushing a pending
   *  `definition.debounce` commit first so an unflushed edit never flashes a stale required error. */
  readonly onFocusout: () => void;
}

/** Renderer and adapter for a `type: "custom"` filter definition. The returned control is placed
 * inside the filter bar's `filter-control` part and is re-rendered with the current value. */
export interface LyraFilterBarCustomControl {
  readonly render: (context: LyraFilterBarCustomControlContext) => TemplateResult;
  readonly adapter: LyraFilterBarCustomControlAdapter;
}

/** Whether a filter's `label` renders as the composed control's own visible label -- `'visible'`,
 *  the default and the behaviour every definition had before this option existed -- is routed to
 *  that control's accessible name instead (`'hidden'`), for a compact toolbar row, or is
 *  `'auto'`: rendered as the visible label while the bar's own allocation is wide enough for it,
 *  and visually clipped (never removed, so the name is unchanged) once it is not. */
export type LyraFilterBarLabelVisibility = 'visible' | 'hidden' | 'auto';

/** Which currently-active filters `render()`'s chip row shows -- see `LyraFilterBar.activeFiltersDisplay`. */
export type LyraFilterBarActiveFiltersDisplay = 'all' | 'changed' | 'hidden';

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

/** The fields every built-in (non-`'custom'`) filter type forwards to whichever Lyra control it
 *  composes. They live here rather than on each type so one filter row can be declared compact,
 *  adorned and labelled the same way regardless of which control renders it. A `'custom'`
 *  definition deliberately does NOT extend this: its renderer owns the control's markup outright,
 *  so a field this component could not forward anywhere would be inert public API. */
interface LyraFilterBarComposedDefinitionBase extends LyraFilterBarDefinitionBase {
  /** Forwarded to the composed control's own `size`, the library's one shared control ladder.
   *  Defaults to `'m'`, matching every one of those controls' own default. */
  readonly size?: LyraSize;
  /** Optional decorative leading visual rendered into the composed control's own `start` slot,
   *  exactly like `LyraFilterBarOption.icon`: inert and `aria-hidden`, so it never contributes to
   *  the field's accessible name. */
  readonly icon?: unknown;
  /** Whether `label` renders as the composed control's own visible label (`'visible'`, the
   *  default) or is routed to its accessible name instead (`'hidden'`) -- which also supplies the
   *  label as the control's `placeholder` when the definition declares none, so the field still
   *  reads as itself with no stacked label above it. The label never simply disappears: routing it
   *  is the point, and a filter whose label were dropped would leave the control unnamed.
   *
   *  `'auto'` is the width-dependent middle: the label renders exactly as `'visible'` does --
   *  same stacked label element, same accessible name computed from it, no `aria-label` and no
   *  placeholder fallback -- and is *visually clipped* by this component's own stylesheet once the
   *  bar's own allocation drops below `30rem` (a container query on the host, so it reads the bar's
   *  allocated width and not the viewport's). Clipped, never removed: the name comes from the same
   *  node at every width, which is exactly what visually hiding `::part(filter-control-label)` from
   *  a consumer stylesheet could not achieve. The threshold is fixed rather than themeable -- a
   *  container query's prelude cannot read a custom property, so a `--lr-*` hook for it would parse
   *  and silently never apply. */
  readonly labelVisibility?: LyraFilterBarLabelVisibility;
}

/** The composed fields whose control also ships a built-in clear action. `'checkbox-menu'` is
 *  deliberately absent: its composed `<lr-dropdown>` has no clear affordance of its own, and the
 *  active-filter chip's own remove action already clears it. */
interface LyraFilterBarClearableDefinitionBase extends LyraFilterBarComposedDefinitionBase {
  /** Forwarded to the composed control's own clear action (`clearable` on `<lr-input>`/
   *  `<lr-combobox>`/`<lr-select>`, the same option under its `with-clear` spelling on
   *  `<lr-date-input>`). Defaults to `false`, matching those controls' own default. */
  readonly clearable?: boolean;
}

export interface LyraFilterBarSelectDefinition extends LyraFilterBarClearableDefinitionBase {
  readonly type: 'select';
  readonly options: readonly LyraFilterBarOption[];
}

/** A `'checkbox-menu'` filter: `<lr-dropdown>` plus one `<lr-dropdown-item type="checkbox">`
 *  (`role="menuitemcheckbox"`) per option, behind a single toolbar trigger button. Its value is a
 *  `string[]` exactly like a `'combobox'` with `multiple`, so the two are interchangeable in the
 *  bar's value record, chips, reset path and events -- the choice between them is an interaction
 *  one: a searchable list of many values versus a small fixed set toggled in place. Unlike every
 *  other built-in type it renders no stacked label above its control; the trigger button carries
 *  the label as its own text, and `labelVisibility: 'hidden'` makes that text visually hidden
 *  (never removed) so the button keeps its accessible name. */
export interface LyraFilterBarCheckboxMenuDefinition extends LyraFilterBarComposedDefinitionBase {
  readonly type: 'checkbox-menu';
  readonly options: readonly LyraFilterBarOption[];
}

export interface LyraFilterBarComboboxDefinition extends LyraFilterBarClearableDefinitionBase {
  readonly type: 'combobox';
  readonly options: readonly LyraFilterBarOption[];
  /** A `multiple` combobox filter collapses past the composed `<lr-combobox>`'s own
   *  `max-options-visible` (default `3`, not forwarded by this component) into a localized "+N"
   *  overflow indicator -- the same substance as `<lr-select>`'s own `multiple`-mode overflow chip.
   *  Like that chip, it carries a second, distinguishing `tag-overflow` part alongside the plain
   *  `tag` part, forwarded here as `filter-control-tag-overflow` so a consumer can style just the
   *  overflow indicator without also restyling every ordinary selected tag. */
  readonly multiple?: boolean;
  /** `'combobox'` only -- how long (ms) to wait after the last selection change (a pick, a
   *  multi-select toggle, an `allowCustomValue`/`allowCreate` commit, or the clear action) before
   *  committing it to `value` and emitting a single `lr-input`, coalescing a burst of rapid picks
   *  into one commit the same way `'text'`'s own `debounce` coalesces keystrokes. Omitted, `0`, or
   *  a non-finite value means no debounce at all: every change commits immediately. Unlike
   *  `'text'`, the composed `<lr-combobox>`'s `.value=` binding stays fully controlled throughout:
   *  while a commit is pending, it renders that pending selection rather than the last-committed
   *  `value`, so the control's own display never reverts mid-delay. A pending debounce is flushed
   *  by the control's own blur/focusout and cancelled outright by `reset()`, a chip removal, and
   *  disconnection -- identical to `'text'`. */
  readonly debounce?: number;
  /** Forwarded to the composed `<lr-combobox>`'s own `empty-text`: what its listbox shows when a
   *  query matches none of the declared options ("No matching tags"). `'combobox'` only. Caller
   *  copy, so -- like `label` -- it is not routed through `this.localize()`; omitted leaves that
   *  control's own localized default in place. */
  readonly emptyText?: string;
}

export interface LyraFilterBarTextDefinition extends LyraFilterBarClearableDefinitionBase {
  readonly type: 'text';
  /** `'text'` only -- how long (ms) to wait after the last keystroke before committing the typed
   *  value to `value` and emitting a single `lr-input`, so a server-side query runs once per pause
   *  instead of once per character. Omitted, `0`, or a non-finite value means no debounce at all:
   *  every keystroke commits immediately. A pending debounce is always flushed by the field's own
   *  `change`/blur (so a blur never loses the last keystroke) and cancelled outright by
   *  `reset()`, a chip removal, and disconnection. Ignored for every other `type`, whose commits
   *  are discrete choices with nothing to debounce. */
  readonly debounce?: number;
  /** Forwarded verbatim to the composed `<lr-input>`'s own `type`, so a `'text'` filter can render
   *  as `search`/`email`/`tel`/`url`/etc. instead of the default `text`. `'text'` only. */
  readonly inputType?: LyraInputType;
}

interface LyraFilterBarDateDefinitionBase extends LyraFilterBarClearableDefinitionBase {
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
  /** How long (ms) to wait after the custom control's own committed-value event (whatever the
   *  adapter's `valueFromEvent` reads via `context.onValueChange`/`onInput`/`onChange`) before
   *  committing it to `value` and emitting a single `lr-input` -- identical to `'text'`'s
   *  per-keystroke debounce and `'combobox'`'s per-selection-change debounce, and sharing the same
   *  per-`filterId` debounce-controller map, so it needs no separate wiring. Omitted, `0`, or a
   *  non-finite value means no debounce at all: every commit lands immediately, exactly as before
   *  this field existed. While a commit is pending, `context.value` renders that pending value
   *  rather than the last-committed `value` -- exactly like `'combobox'` -- so a custom control
   *  bound to it as a fully controlled `.value=` never reverts mid-delay. A pending debounce is
   *  flushed by `context.onFocusout` and cancelled outright by `reset()`, a chip removal, and
   *  disconnection, identical to `'text'`/`'combobox'`. This closes the gap `'text'`'s own
   *  debounce left: before this field existed, a custom free-text filter had to hand-roll the same
   *  timer plus its flush/cancel lifecycle itself to get the same behaviour. */
  readonly debounce?: number;
}

/** A control-less filter whose value is owned by a widget elsewhere on the page -- a calendar
 *  heatmap cell, a map selection, a chart brush. `<lr-filter-bar>` renders NO control for it and it
 *  occupies NO toolbar cell, but it is a filter in every other sense this component knows: it lives
 *  in `value` under its own `filterId`, rides every `lr-input`/`lr-reset` detail, counts toward
 *  `hasActiveFilters` (so it enables the reset button) and `invalidFilterIds`, renders a removable
 *  active-filter chip subject to `activeFiltersDisplay`, and is cleared by a chip removal and by
 *  `reset()` alongside every other filter.
 *
 *  It extends the shared definition base rather than the composed one for the same reason
 *  `'custom'` does: `size`/`icon`/`labelVisibility`/`clearable` have no control to be forwarded to,
 *  so declaring them would be inert public API. The inherited `placeholder` is likewise inert here
 *  (there is no field to place it in), exactly as it already is for `'custom'`. The inherited
 *  `required` IS honoured, but only in bookkeeping: a required-but-empty chip filter appears in
 *  `invalidFilterIds` and fails `checkValidity()`, while rendering no inline error -- this component
 *  renders no element for that filter on which one could appear, so the widget that owns the value
 *  owns its error affordance too. The inherited `defaultValue` is
 *  restored by `reset()` and compared by `activeFiltersDisplay: 'changed'` like any other type's. */
export interface LyraFilterBarChipDefinition extends LyraFilterBarDefinitionBase {
  readonly type: 'chip';
  /** The chip's text for the current value. `locale` is `effectiveLocale` -- the same value every
   *  built-in type's own chip formatting (`getListFormat`/`getDateTimeFormat`) and a custom
   *  adapter's `formatValue` already receive -- because such a value is normally a formatted string
   *  (a localized date) rather than a label looked up in an options list. Caller-supplied copy, so
   *  (like `label`) this component does not route the result through `this.localize()`; passing the
   *  locale is what lets the caller do it. Omitted falls back to the same ladder a custom adapter's
   *  omitted `formatValue` uses: a string array formats as a localized conjunction list, any other
   *  value renders `String(value)`, and `undefined` renders `''`. */
  readonly formatValue?: (value: LyraFilterBarFieldValue, locale: string) => string;
  /** The value written when this filter's chip is removed (or `clearFilter()` runs). Defaults to
   *  `''`, matching what every non-multi built-in type writes. Declare `[]` for a `string[]`-valued
   *  chip filter. A domain sentinel (`'all'`) must be paired with `isEmpty`, or the bar will treat
   *  the "cleared" value as still set and keep rendering a chip for it -- the identical pairing
   *  `LyraFilterBarCustomControlAdapter.clearValue`/`isEmpty` documents. */
  readonly clearValue?: LyraFilterBarFieldValue;
  /** Optional domain-specific empty predicate. Omitted, this filter uses the same built-in rule
   *  every non-`'custom'` type uses: absent, `false`, `''` and `[]` are empty, everything else is
   *  set. */
  readonly isEmpty?: (value: LyraFilterBarFieldValue) => boolean;
}

/** A host-declared filter. The discriminant makes choice options and custom adapters mandatory
 * exactly where runtime needs them, while excluding irrelevant fields from every other mode. */
export type LyraFilterBarFilterDefinition =
  | LyraFilterBarSelectDefinition
  | LyraFilterBarComboboxDefinition
  | LyraFilterBarCheckboxMenuDefinition
  | LyraFilterBarTextDefinition
  | LyraFilterBarDateDefinition
  | LyraFilterBarDateRangeDefinition
  | LyraFilterBarChipDefinition
  | LyraFilterBarCustomDefinition;

/**
 * The whole filter bar's current state: a plain, JSON-serializable object keyed by
 * `LyraFilterBarFilterDefinition.filterId`. This is the entire URL-querystring/app-state serialization
 * contract -- this component only reads and writes plain data through `value`, and never touches
 * `location`/`history`/storage itself; the host owns turning this object into (and back out of)
 * a querystring, matching every other Lyra "controlled" component's convention.
 */
export type LyraFilterBarValue = Readonly<Record<string, LyraFilterBarFieldValue>>;

/**
 * The `value` field shape one filter definition implies, at the type level only -- the same
 * per-definition narrowing `LyraPickerValue<Multiple>` (`picker-value.ts`) does for
 * `<lr-select>`/`<lr-combobox>`, applied to `<lr-filter-bar>`'s per-`filterId` value record
 * instead of a single control's own `value`. A `'checkbox-menu'` (always `string[]`, exactly like
 * a `multiple` `'combobox'`) and a `'combobox'` with `multiple: true` narrow to `readonly
 * string[]`; every other `'combobox'` and every `'select'`/`'text'`/`'date'`/`'date-range'` narrow
 * to `string`; a `'custom'` definition keeps the full unconstrained `LyraFilterBarFieldValue`,
 * since its adapter is free to use either boolean meaning (see `LyraFilterBarCustomControlAdapter`),
 * and so does a `'chip'` definition, whose value is owned by a widget this component never renders.
 */
export type LyraFilterBarDefinitionValue<D extends LyraFilterBarFilterDefinition> =
  D extends LyraFilterBarCheckboxMenuDefinition
    ? readonly string[]
    : D extends LyraFilterBarComboboxDefinition
      ? D extends { multiple: true }
        ? readonly string[]
        : string
      : D extends LyraFilterBarCustomDefinition
        ? LyraFilterBarFieldValue
        : D extends LyraFilterBarChipDefinition
          ? LyraFilterBarFieldValue
          : string;

/**
 * `LyraFilterBarValue` narrowed to a keyed record whose per-`filterId` value type follows the
 * matching entry in `Defs` -- the filter-bar analogue of `LyraPickerValue<Multiple>`.
 *
 * `readonly LyraFilterBarFilterDefinition[] extends Defs` is true only for that unnarrowed
 * default (mirroring the `boolean extends Multiple` check `LyraPickerValue` uses), so an untyped
 * `<lr-filter-bar>` -- every shipped call site -- keeps exactly today's `LyraFilterBarValue` and
 * compiles unchanged. A literal `Defs` (typically declared with `as const satisfies readonly
 * LyraFilterBarFilterDefinition[]`) instead narrows each key to its own definition's value type.
 * This is deliberately types-only: the runtime shape (`LyraFilterBarFieldValue` per key) is
 * unchanged either way.
 *
 * ```ts
 * const FILTERS = [
 *   { filterId: 'status', label: 'Status', type: 'select', options: [...] },
 *   { filterId: 'tags', label: 'Tags', type: 'combobox', multiple: true, options: [...] },
 * ] as const satisfies readonly LyraFilterBarFilterDefinition[];
 * declare const bar: LyraFilterBar<typeof FILTERS>;
 * bar.value.status;  // string | undefined
 * bar.value.tags;    // readonly string[] | undefined
 * ```
 */
export type LyraFilterBarValueFor<
  Defs extends readonly LyraFilterBarFilterDefinition[],
> = readonly LyraFilterBarFilterDefinition[] extends Defs
  ? LyraFilterBarValue
  : Readonly<{
      [D in Defs[number] as D['filterId']]?: LyraFilterBarDefinitionValue<D>;
    }>;

export interface LyraFilterBarInputDetail<
  Defs extends readonly LyraFilterBarFilterDefinition[] = readonly LyraFilterBarFilterDefinition[],
> {
  /** The full current value of every filter, not just the one that changed. */
  readonly value: LyraFilterBarValueFor<Defs>;
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

export interface LyraFilterBarResetDetail<
  Defs extends readonly LyraFilterBarFilterDefinition[] = readonly LyraFilterBarFilterDefinition[],
> {
  readonly value: LyraFilterBarValueFor<Defs>;
}

export interface LyraFilterBarEventMap<
  Defs extends readonly LyraFilterBarFilterDefinition[] = readonly LyraFilterBarFilterDefinition[],
> {
  'lr-input': CustomEvent<LyraFilterBarInputDetail<Defs>>;
  'lr-validity-change': CustomEvent<LyraEventDetailSnapshot<LyraFilterBarValidityDetail>>;
  'lr-reset': CustomEvent<LyraFilterBarResetDetail<Defs>>;
}

/**
 * Stable per-event aliases, so a host can name one event's type without restating the detail
 * schema (or re-deriving it from `LyraFilterBarEventMap`). Each narrows with the same `Defs`
 * parameter the component does: `LyraFilterBarInputEvent<typeof FILTERS>`'s `detail.value.status`
 * follows that `filterId`'s own definition.
 */
export type LyraFilterBarInputEvent<
  Defs extends readonly LyraFilterBarFilterDefinition[] = readonly LyraFilterBarFilterDefinition[],
> = LyraFilterBarEventMap<Defs>['lr-input'];
export type LyraFilterBarResetEvent<
  Defs extends readonly LyraFilterBarFilterDefinition[] = readonly LyraFilterBarFilterDefinition[],
> = LyraFilterBarEventMap<Defs>['lr-reset'];

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

/** `tag__remove-button`/`tag__remove-button__base` reach a selected tag's own remove button and
 * its inner icon wrapper -- the same reach a standalone `<lr-combobox>`/`<lr-select>` consumer
 * already has, now available from `<lr-filter-bar>` too. The alias targets follow this scheme's
 * own hyphenated convention (`filter-control-tag-remove-button`(`-base`)) rather than carrying the
 * source part's double-underscore compatibility spelling through verbatim, matching every other
 * entry here (`combobox-input` -> `filter-control-input`, not a mechanical rename). Without these
 * a consumer re-skinning filter tags as pills gets a pill with an unstyleable default remove
 * target inside it. */
const COMBOBOX_EXPORT_PARTS = [
  'form-control-label: filter-control-label',
  'combobox: filter-control-field',
  'combobox-input: filter-control-input',
  'start: filter-control-start',
  'end: filter-control-end',
  'listbox: filter-control-listbox',
  'option: filter-control-option',
  'tags: filter-control-tags',
  'tag: filter-control-tag',
  'tag-overflow: filter-control-tag-overflow',
  'tag-label: filter-control-tag-label',
  'tag__remove-button: filter-control-tag-remove-button',
  'tag__remove-button__base: filter-control-tag-remove-button-base',
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

const CHECKBOX_MENU_EXPORT_PARTS = [
  // The dropdown's positioned popup is the checkbox menu's own options surface, so it forwards
  // under the same `filter-control-listbox` name a select's or combobox's options popover already
  // uses -- one part name per surface across every filter type, rather than a fifth synonym.
  'base: filter-control-listbox',
].join(', ');

/** The `'checkbox-menu'` trigger's forwarded parts. `part="filter-control-field"` written on the
 * `<lr-button>` HOST would be silently inert: that host is `display: inline-block` and paints
 * nothing -- the border, background and radius all live on its internal `[part~='base']`. So a
 * consumer's `lr-filter-bar::part(filter-control-field) { border-color: … }`, which works for
 * every other filter type (a select's `trigger`, an input's/date's `input-wrapper`), would do
 * nothing at all here. Forwarding `base` puts the name on the element that actually draws the
 * field frame. `start` is forwarded for the same reason every other type forwards its own:
 * `'checkbox-menu'` accepts a definition `icon`, and lr-button's adornment wrapper is otherwise
 * unreachable across that shadow boundary. lr-button's own `label` wrapper (the flex row this
 * component lays its `filter-control-label`/`filter-control-input` spans out in -- see
 * `filter-bar.styles.ts`'s `.checkbox-menu lr-button::part(label)`) forwards to
 * `filter-control-label-group`, a THIRD, collision-resistant name distinct from either span it
 * contains. `caret` forwards to `filter-control-expand-icon`, the same name every other filter
 * type's own disclosure chevron already uses, so one consumer rule styles all of them. */
const CHECKBOX_MENU_TRIGGER_EXPORT_PARTS = [
  'base: filter-control-field',
  'start: filter-control-start',
  'label: filter-control-label-group',
  'caret: filter-control-expand-icon',
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

/** A `part` attribute is a space-separated token list, exactly like `class` -- so a `filterId`
 * containing whitespace could otherwise fabricate an unrelated extra token when concatenated into
 * one (`"x active-filters"` would silently split into `field-x` and a bare `active-filters` token
 * that collides with this component's own real `active-filters` chip-row part). Requiring the
 * whole id to already read as a plain CSS ident -- ASCII letters, digits, `-`, `_`, starting with
 * a letter -- rules out embedded whitespace and every other character that would need escaping to
 * appear in a `::part()` argument, without attempting to escape one in: `DOMTokenList` tokenizes
 * on raw ASCII whitespace, which a backslash escape cannot suppress. An id that fails this check
 * gets no per-filter handle at all; `fieldPartNames()` falls back to the bare `'field'` token,
 * identical to this component's behavior before the per-filter handle existed. */
const SAFE_FILTER_ID_PART = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/** The `field` wrapper's `part` attribute for one filter: the shared `field` token plus, for a
 * `filterId` that is safe to embed (see `SAFE_FILTER_ID_PART`), a collision-resistant
 * `field-<filterId>` token letting a consumer target exactly that field --
 * `lr-filter-bar::part(field-status) { flex: 2 1 20rem; }` -- while `::part(field)` continues to
 * match every field. */
function fieldPartNames(filterId: string): string {
  return SAFE_FILTER_ID_PART.test(filterId) ? `field field-${filterId}` : 'field';
}

/** The three built-in types that declare a closed `options` set. They share option validation,
 * `<lr-option>`-style rendering data and the same option-label chip formatting; only the control
 * they compose differs. */
type LyraFilterBarChoiceDefinition =
  | LyraFilterBarSelectDefinition
  | LyraFilterBarComboboxDefinition
  | LyraFilterBarCheckboxMenuDefinition;

/** Every filter type that actually renders a control. `'chip'` is the one type that renders none,
 *  so excluding it here is what makes `renderControl()` structurally unreachable for a chip
 *  definition instead of relying on a runtime guard -- the `'select'` fallback at the end of that
 *  method would otherwise render an empty `<lr-select>` for it. */
type LyraFilterBarControlDefinition = Exclude<
  LyraFilterBarFilterDefinition,
  LyraFilterBarChipDefinition
>;

function isChoiceDefinition(
  definition: LyraFilterBarFilterDefinition
): definition is LyraFilterBarChoiceDefinition {
  return (
    definition.type === 'select' ||
    definition.type === 'combobox' ||
    definition.type === 'checkbox-menu'
  );
}

/** A built-in filter's value counts as active (shown as a chip, counted toward
 * `hasActiveFilters`, satisfying `required`) once it is neither absent, `false`, `''`, nor `[]`. */
function isBuiltInSet(value: LyraFilterBarFieldValue): boolean {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  return Array.isArray(value) ? value.length > 0 : value !== '';
}

/** Whether `value` equals a filter definition's own declared `defaultValue` -- the equality
 *  `activeFiltersDisplay: 'changed'` filters active entries against. A `readonly string[]` value
 *  (a multi-select `'combobox'`/`'checkbox-menu'`) compares against a `readonly string[]` default
 *  positionally -- same length, same entry at each index -- matching this component's only other
 *  array-equality precedent, `LyraFilterBarCustomControlAdapter.isEmpty`'s own default `clearValue`
 *  comparison, rather than an order-insensitive set comparison this component has never used
 *  anywhere else. Every other pairing (string, boolean, or a mismatched array/non-array pairing)
 *  compares with `Object.is`, which already covers a `'date-range'` filter's value correctly: it is
 *  a single composed `"start/end"` string (see `displayValueFor`), so two of them are either the
 *  same string or they are not -- no date parsing involved. */
function filterValueEqualsDefault(
  value: LyraFilterBarFieldValue,
  defaultValue: LyraFilterBarDefinitionBase['defaultValue'],
): boolean {
  const valueIsArray = Array.isArray(value);
  const defaultIsArray = Array.isArray(defaultValue);
  if (valueIsArray || defaultIsArray) {
    if (!valueIsArray || !defaultIsArray) return false;
    return (
      value.length === defaultValue.length &&
      value.every((entry, index) => entry === defaultValue[index])
    );
  }
  return Object.is(value, defaultValue);
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
 * `<lr-chip>`s summarizing the currently-active filters (which filters that row admits is
 * `activeFiltersDisplay`'s own contract; removing a chip always clears that filter, regardless of
 * which chips the row is currently showing), an `<lr-button>` that resets every filter, and (while
 * `loading`) an `<lr-spinner>` status indicator.
 *
 * A `'text'` filter is the one control that is *not* a fully controlled `.value=` binding: a text
 * field re-rendered from `value` mid-typing would push a stale value back into the field and drop
 * the caret to the end, so the field owns its own value while the user types and an external
 * `value` write is synced back in only once no edit is in flight (see `syncTextControls()`). Its
 * optional per-filter `debounce` (ms) is the only behaviour this component adds on top of the
 * composed control itself -- flushed by that field's own `change`/blur, cancelled by `reset()`, a
 * chip removal, and `disconnectedCallback`, so a stale keystroke can never overwrite a reset or
 * fire after teardown. A `'combobox'` filter may declare the same `debounce`, coalescing a burst
 * of rapid picks into one delayed commit; unlike `'text'` its `.value=` binding stays fully
 * controlled, rendering the pending selection in place of the last-committed `value` for as long
 * as the commit is delayed. A `'custom'` definition may declare the same `debounce` too, applied to
 * whatever its adapter's `valueFromEvent` reads off `context.onValueChange`/`onInput`/`onChange`,
 * with identical flush-on-`context.onFocusout` and cancel-on-`reset()`/chip-removal/disconnect
 * semantics -- so a custom free-text filter no longer has to hand-roll that timer itself just to
 * match what `'text'` already does. Every built-in (non-`'custom'`) type also accepts optional
 * `size`/`icon`/`labelVisibility`, and every one whose composed control ships a clear action also
 * accepts `clearable` -- forwarded verbatim to that control's own same-named property (`icon` into
 * its `start` slot exactly like `LyraFilterBarOption.icon`; `clearable` reaching
 * `<lr-date-input>` under its `with-clear` spelling). `'text'` adds `inputType`, `'combobox'` adds
 * `emptyText`, and an option may carry `searchText` -- which only `<lr-combobox>` reads, since
 * `<lr-select>`'s type-ahead matches on the option label alone. `labelVisibility: 'hidden'` routes `label` to
 * the composed control's own `aria-label` and, with no declared `placeholder`, to its placeholder,
 * so a compact toolbar row still names every field. Every one of these is optional and defaults to
 * that composed control's own default, so an existing filter definition renders unchanged.
 *
 * A `'checkbox-menu'` filter is the one built-in type whose composed control is not a field:
 * `<lr-dropdown>` plus one `<lr-dropdown-item type="checkbox">` per option, behind a single
 * toolbar trigger that carries the label as its own text (no stacked label above it) and a menu
 * that stays open across toggles. Its value is a `string[]`, identical to a `'combobox'` with
 * `multiple`, so the two are interchangeable everywhere the bar's own bookkeeping is concerned --
 * choose between them on interaction, not on data shape. Because its trigger is a button rather
 * than a field, it deliberately renders no required marker and sets no `aria-invalid`: the
 * library's shared `formControlRequiredMarker` has no selector that matches a button trigger's
 * label, and `<lr-button>` does not forward a host `aria-invalid` onto the element that owns the
 * button role, so writing one would be silently inert. A revealed `required` error still reaches
 * assistive technology, as a screen-reader-only run inside the trigger's accessible name.
 *
 * A `'chip'` filter is the one type that composes no control at all. Its value is owned by a widget
 * elsewhere on the page -- a calendar heatmap cell, a map selection, a chart brush -- so the bar
 * renders no field for it and it claims no toolbar cell (no `field` wrapper, and therefore no blank
 * column where an empty one's validation spacer would otherwise reserve a row of height). It is a
 * filter in every other sense: it lives in `value` under its own `filterId`, rides every
 * `lr-input`/`lr-reset` detail, counts toward `hasActiveFilters` (so it enables the reset button,
 * which is exactly the "clear all" action an all-chip bar needs) and `invalidFilterIds`, renders a
 * removable active-filter chip subject to `activeFiltersDisplay`, and is cleared by a chip removal
 * and by `reset()` alongside every other filter. Its chip text comes from an optional
 * `formatValue(value, locale)` receiving `effectiveLocale` -- the same locale every built-in type's
 * own chip formatting and a custom adapter's `formatValue` already receive; omitted, a string array
 * formats as a localized conjunction list and anything else renders `String(value)` verbatim, never
 * through the date branch that would reformat an ISO day or mangle a value containing a slash.
 * `clearValue` (default `''`) is what a chip removal writes; a domain sentinel must be paired with
 * `isEmpty`, exactly as a custom adapter's own `clearValue`/`isEmpty` are. Its inherited
 * `placeholder` is inert (there is no field to place it in), as it already is for `'custom'`, and
 * its inherited `required` is honoured in bookkeeping only: a required-but-empty chip filter joins
 * `invalidFilterIds`/`checkValidity()`/`lr-validity-change` but renders no inline error, since this
 * component renders no element of its own on which one could appear.
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
 * @slot end - Extra host-supplied controls rendered inside `controls`, next to the reset button
 *   (for example, a "Save search" or "Export" action) -- this component renders no default
 *   content into it.
 * @csspart base - The root `role="group"` wrapper.
 * @csspart controls - The row holding every filter control, the `end` slot, the reset button, and
 *   the loading status.
 * @csspart field - The wrapper around one filter's composed control and its validation spacer;
 *   its flex-basis is `--lr-filter-bar-field-basis`. Also carries a second, per-filter token,
 *   `field-<filterId>` (for example `part="field field-status"`), so a consumer can target one
 *   field's own wrapper -- `lr-filter-bar::part(field-status) { flex: 2 1 20rem; }` -- and set any
 *   layout property, not just width, without affecting `::part(field)` rules that still match
 *   every field. The `field-<filterId>` token is omitted (the wrapper renders `part="field"`
 *   alone) when `filterId` is not a plain CSS ident (ASCII letters/digits/`-`/`_`, starting with a
 *   letter) -- `part` is a space-separated token list like `class`, so an id containing whitespace
 *   would otherwise silently fabricate an unrelated second token (including, in the worst case,
 *   one colliding with a real part name like `active-filters`). A `'chip'` filter renders no
 *   `field` wrapper at all, so neither `::part(field)` nor `::part(field-<filterId>)` ever matches
 *   one -- its only rendered surface is its active-filter `chip`.
 * @csspart end - Wrapper around the `end` slot; hidden while nothing is slotted.
 * @csspart filter-control - One filter's composed built-in control, or the wrapper around a
 *   custom renderer's control (and around a `'checkbox-menu'`'s dropdown plus its error line).
 * @csspart filter-control-label - A built-in control's label element. On a `'checkbox-menu'` this
 *   is the trigger button's own label text rather than a stacked label above the control, and it
 *   is visually hidden (never removed) under `labelVisibility: 'hidden'` -- except in the one case
 *   where the trigger's selection summary already IS the label (hidden routing, no declared
 *   `placeholder`, nothing selected), where it is omitted rather than naming the button twice.
 *   Under `labelVisibility: 'auto'` this component clips the same element itself once the bar's own
 *   allocation drops below `30rem`, and leaves it untouched above that -- so a consumer rule
 *   targeting this part sees a visible element at a wide allocation and a hairline, still-named one
 *   at a narrow one.
 * @csspart filter-control-label-group - A `'checkbox-menu'` trigger's composed `<lr-button>`'s own
 *   label wrapper: the flex row laying out `filter-control-label` and `filter-control-input`
 *   beside each other and, with `with-caret`, growing to fill the stretched trigger so its content
 *   starts at the leading edge instead of centring. No other filter type renders this part -- every
 *   other type's label and input are two independent elements with no shared wrapper of their own.
 * @csspart filter-control-field - A built-in control's field frame: select trigger, combobox
 *   container, text/date input wrapper, or a `'checkbox-menu'` trigger button's own frame (the
 *   element inside `<lr-button>` that draws the border, background and radius -- not the
 *   chrome-less button host).
 * @csspart filter-control-input - A built-in control's display or editable input, or a
 *   `'checkbox-menu'` trigger's selection summary.
 * @csspart filter-control-start - A built-in control's start adornment wrapper, including a
 *   `'checkbox-menu'` trigger button's own.
 * @csspart filter-control-end - A built-in control's end adornment wrapper.
 * @csspart filter-control-listbox - A select or combobox options popover, or a
 *   `'checkbox-menu'`'s popup surface.
 * @csspart filter-control-option - A select or combobox option row, or a `'checkbox-menu'`'s
 *   `role="menuitemcheckbox"` row.
 * @csspart filter-control-tags - A combobox's multi-select tag container.
 * @csspart filter-control-tag - A combobox's individual selected tag. The "+N" overflow indicator
 *   carries both `filter-control-tag` and `filter-control-tag-overflow`.
 * @csspart filter-control-tag-overflow - A combobox's "+N" indicator standing in for the
 *   selections past `max-options-visible`.
 * @csspart filter-control-tag-label - A combobox tag's wrapping/ellipsis-safe label; capped by
 *   that control's own `--tag-max-size`.
 * @csspart filter-control-tag-remove-button - A combobox tag's own remove button.
 * @csspart filter-control-tag-remove-button-base - Compatibility name for the icon wrapper inside
 *   a combobox tag's remove button; the same reach a standalone `lr-combobox`/`lr-select` consumer
 *   already has.
 * @csspart filter-control-clear-button - A built-in control's clear action, when rendered.
 * @csspart filter-control-expand-button - A date input's calendar-popup action.
 * @csspart filter-control-expand-icon - A select, combobox, or date-input expansion icon, or a
 *   `'checkbox-menu'` trigger's own `with-caret` disclosure chevron.
 * @csspart filter-control-popup - A date input's positioned calendar popup.
 * @csspart filter-control-error - A built-in control's validation message. A `'checkbox-menu'`
 *   renders this one itself (its composed dropdown has no error chrome), `aria-hidden` because the
 *   same text also joins the trigger's accessible name -- an idref cannot cross into that button's
 *   own shadow root.
 * @csspart filter-control-hint - A built-in control's hint message.
 * @csspart reset-button - The reset `<lr-button>`.
 * @csspart status - The loading `<lr-spinner>`, only rendered while `loading`.
 * @csspart active-filters - The `role="group"` wrapper around the active-filter chip row, only
 *   rendered while `activeFiltersDisplay` admits at least one currently-active filter (never, for
 *   `'hidden'`).
 * @csspart chips - The `<lr-chip-group>` inside `active-filters`.
 * @csspart chip - One active-filter `<lr-chip>`.
 * @cssprop [--lr-filter-bar-field-basis=var(--lr-size-12rem)] - Flex-basis of each filter's
 *   `field` wrapper, controlling how many fields fit per row before the row wraps.
 * @cssprop [--lr-filter-bar-gap=var(--lr-space-s)] - Gap between filter fields, the `end` slot,
 *   the reset button, and the loading status in the `controls` row.
 * @status stable
 * @since 4.1.0
 */
export class LyraFilterBar<
  Defs extends readonly LyraFilterBarFilterDefinition[] = readonly LyraFilterBarFilterDefinition[],
> extends LyraElement<LyraFilterBarEventMap<Defs>> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    filterBarActiveFilters: LYRA_DEFAULT_filterBarActiveFilters,
    filterBarReset: LYRA_DEFAULT_filterBarReset,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, srOnly, styles];
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

  /** Which currently-active filters render as removable chips in the row below the fields.
   *  `'all'` (default, and the only behaviour this component had before this property existed)
   *  shows one chip per filter that is not empty -- including a filter sitting at its own
   *  `defaultValue`, since a declared default is itself a value the filter currently holds.
   *  `'changed'` shows a chip only for a filter whose current value differs from its own
   *  `defaultValue` (see `filterValueEqualsDefault`) -- so a bar whose defaults narrow the view on
   *  load does not claim the user narrowed it, while a filter with no declared `defaultValue`
   *  counts as changed the moment it has any value at all, since there is nothing for it to still
   *  equal. `'hidden'` never renders the row, regardless of any filter's state. Every value other
   *  than `'changed'`/`'hidden'` (including a foreign attribute value) behaves like `'all'`,
   *  matching `labelVisibility`'s own foreign-value handling. Removing a chip always clears that
   *  filter, exactly as it always has -- this property only changes which already-active filters
   *  get a chip in the row, never what removing one does.
   *
   *  `'changed'` additionally gates the reset button on `hasChangedFilters` rather than
   *  `hasActiveFilters`, so an untouched defaults-only bar -- which renders no chip in this mode --
   *  no longer offers an enabled reset that would change nothing. `hasActiveFilters` itself is
   *  unaffected by this property in every mode, and so is reset enablement under `'all'`/`'hidden'`. */
  @property({ reflect: true, attribute: 'active-filters-display' })
  activeFiltersDisplay: LyraFilterBarActiveFiltersDisplay = 'all';

  /** Filters that have been visited (focusout'd) at least once -- gates only the *visual*
   *  inline-error presentation on each composed control, matching every other form control in
   *  this library (`lr-select`/`lr-combobox`/`lr-tool-param-form` all avoid flashing red before
   *  the user has touched anything). */
  @state() private touchedFilters = new Set<string>();

  /** Tracks whether the host-supplied `end` slot carries real content, so its wrapper part can
   *  stay `hidden` (and claim no layout space) while unused. */
  private readonly slotPresence = new SlotPresenceController(this);

  private _filters: readonly LyraFilterBarFilterDefinition[] = EMPTY_FILTERS;
  private _value: LyraFilterBarValue = EMPTY_VALUE;
  /** The last value passed to the `value` setter, cloned but NOT yet filtered down to the filter
   *  ids known at that moment. `filters`'s setter re-derives `_value` from this (not from the
   *  already-filtered `_value`) so a `value` assignment landing before its matching `filters`
   *  assignment -- same microtask/script order, or the same Lit template's binding order -- never
   *  permanently drops fields for filters that simply hadn't been declared yet. */
  private rawValue: LyraFilterBarValue = EMPTY_VALUE;
  // One in-flight `debounce` per `'text'`/`'combobox'` filter id, each owning the value it will
  // commit. A controller's `pending` is also what marks that field as "the user is mid-edit",
  // which suppresses the external-value sync in `syncTextControls()` (for `'text'`) and
  // substitutes its `pendingValue` into the composed `<lr-combobox>`'s `.value=` binding (for
  // `'combobox'`). An entry exists only while that field has an uncommitted edit: every exit path
  // drops the key -- a cancel disposes it, and a settle (natural or flushed) drops it from inside
  // its own callback -- so a filter id that disappears with a schema replacement leaves nothing
  // behind.
  private debounceControllers = new Map<string, DebounceController<LyraFilterBarFieldValue>>();
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
   * require a callable renderer and adapter. Exceptions thrown by admitted renderers propagate.
   *
   * `Defs` narrows this element's `value` to a keyed record typed per `filterId` -- see
   * `LyraFilterBarValueFor`; the unnarrowed default resolves to the published `readonly
   * LyraFilterBarFilterDefinition[]` below, which is why the manifest type is pinned here rather
   * than left to the class's own type parameter.
   * @type {readonly LyraFilterBarFilterDefinition[]} */
  get filters(): Defs {
    return this._filters as Defs;
  }
  set filters(next: Defs | null | undefined) {
    const old = this._filters;
    // Pinned to the un-narrowed class: inside the class body `Defs` is an unresolved type
    // parameter, which leaves it opaque to every concrete array below -- the same reason
    // `LyraSelect`'s `assignValue()`/`emitValueEvents()` widen through a `Multiple`-resolved
    // `self` first. The constraint already guarantees the runtime shape.
    const widened = next as readonly LyraFilterBarFilterDefinition[] | null | undefined;
    // A queued text edit belongs to the exact schema that rendered its control. Even a same-filterId
    // replacement may change type/defaults/debounce semantics, so a schema assignment cancels all
    // drafts before the new controls are reconciled.
    this.cancelDebounce();
    this.renewSchemaContext();
    const seen = new Set<string>();
    this._filters = Object.freeze(snapshotFilterDefinitions(widened).filter((definition) => {
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
        if (isChoiceDefinition(definition) && !Array.isArray(definition.options)) {
          return false;
        }
        if (definition.type === 'custom' && (!definition.custom?.adapter || typeof definition.custom.render !== 'function')) return false;
        seen.add(definition.filterId);
        return true;
      } catch {
        return false;
      }
    }).map((definition) => {
      if (!isChoiceDefinition(definition)) return definition;
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
    this._value = this.normalizeValue(this.rawValue);
    this.requestUpdate('filters', old);
    if (this._value !== oldValue) this.requestUpdate('value', oldValue);
  }

  /** The current value of every filter -- see the class doc's serialization contract. Reads and
   *  writes clone and freeze the record and each string-array field, bounded to 10,000 keys and
   *  10,000 array entries, so mutations never affect this component's state or a subsequent
   *  `lr-input` detail. Reassign after changes. `null`/`undefined` writes clear to the canonical
   *  empty record while reads stay non-null.
   *
   *  `LyraFilterBarValueFor<Defs>` narrows each key to the value type the matching entry in
   *  `filters` implies (see `LyraFilterBarDefinitionValue`) when this element is typed with a
   *  literal `Defs`; the unnarrowed default resolves to the published record below, which is why
   *  the manifest type is pinned here rather than left to the inferred alias name.
   *  @type {LyraFilterBarValue} */
  get value(): LyraFilterBarValueFor<Defs> {
    return cloneFilterValue(this._value) as LyraFilterBarValueFor<Defs>;
  }
  set value(next: LyraFilterBarValueFor<Defs> | null | undefined) {
    const old = this._value;
    // Pinned to the un-narrowed class -- see the `filters` setter's identical note.
    const widened = next as LyraFilterBarValue | null | undefined;
    // Best-effort, defensively-guarded: this snapshot only feeds `filters`'s later re-derivation
    // (below), so a hostile/unclonable `next` must still leave `_value` itself computed exactly as
    // before (never throwing, never changed by this snapshot's own field-dropping rules).
    try {
      this.rawValue = cloneFilterValue(widened ?? EMPTY_VALUE);
    } catch {
      this.rawValue = EMPTY_VALUE;
    }
    this._value = this.normalizeValue(widened);
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
    if (def.type === 'chip') {
      // Use-site guard rather than an admission rule in the `filters` setter: unlike a `'custom'`
      // definition's `render`, a malformed callback here still has a correct fallback, so a chip
      // filter with foreign data stays usable instead of vanishing.
      return typeof def.isEmpty === 'function' ? def.isEmpty(value) : !isBuiltInSet(value);
    }
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
        : def.type === 'chip'
          // Mirrors the `'custom'` arm above: a declared `clearValue` is the canonical "cleared"
          // reading of an absent key, so a domain sentinel paired with `isEmpty` (which is the
          // only coherent way to declare one) never reaches that predicate as `undefined`.
          ? def.clearValue
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

  /** Whether any filter currently has a value -- including one sitting at its own declared
   *  `defaultValue`, which is a value the filter holds like any other. Also what gates whether the
   *  `active-filters` chip row renders at all, and the reset button's own disabled state in every
   *  `activeFiltersDisplay` mode except `'changed'`, where `hasChangedFilters` gates it instead.
   *  This getter itself is unaffected by `activeFiltersDisplay`. */
  get hasActiveFilters(): boolean {
    return this._filters.some((def) => !this.isEmpty(def, this.valueFor(def)));
  }

  /** Whether one filter's current value differs from its own declared `defaultValue`, using
   *  `filterValueEqualsDefault` -- the exact equality `activeFiltersDisplay: 'changed'` already
   *  filters its chip row on, not a second comparison.
   *
   *  The `defaultIsSet` guard is what keeps a *pristine* filter out of the changed set: a filter
   *  declaring no meaningful default has nothing to still equal, so "changed" can only mean "holds
   *  a value". Reading that case through the raw equality instead would report a pristine bar as
   *  changed whenever a filter's cleared reading is a non-`undefined` sentinel -- a `'chip'`
   *  definition's own `clearValue` (`''` by default), or a `'custom'` adapter's. */
  private filterIsChanged(def: LyraFilterBarFilterDefinition): boolean {
    const value = this.valueFor(def);
    const defaultValue = def.defaultValue;
    const defaultIsSet =
      defaultValue !== undefined && !this.isEmpty(def, defaultValue);
    return defaultIsSet
      ? !filterValueEqualsDefault(value, defaultValue)
      : !this.isEmpty(def, value);
  }

  /** Whether any filter's value differs from its own declared `defaultValue`. Always live, never
   *  cached, exactly like `invalidFilterIds`.
   *
   *  This is the counterpart to `hasActiveFilters`, not a synonym: a bar whose every filter sits
   *  at a non-empty declared default reads `hasActiveFilters === true` (those defaults are real
   *  values, and each one still renders its own chip under `activeFiltersDisplay: 'all'`) and
   *  `hasChangedFilters === false` -- a bar whose defaults narrow the view on load does not claim
   *  the user narrowed it. A filter with no declared `defaultValue` counts as changed the moment it
   *  holds any value at all, since there is nothing for it to still equal; conversely, clearing a
   *  filter that *does* declare one counts as changed too, because `reset()` would restore it.
   *
   *  It differs from the `'changed'` chip row in exactly that last case: the row only ever
   *  considers filters that currently hold a value, so a cleared-but-defaulted filter shows no
   *  chip while still reading as changed here. */
  get hasChangedFilters(): boolean {
    return this._filters.some((def) => this.filterIsChanged(def));
  }

  /** What the reset button's own enablement keys on: whether pressing it would change anything.
   *  Under `activeFiltersDisplay: 'changed'` -- the mode whose whole premise is that a value
   *  sitting at its own declared default is not something the user applied -- that is
   *  `hasChangedFilters`, so an untouched defaults-only bar offers no reset to press (and shows no
   *  chip to remove either, which is the state the enabled button used to contradict). Every other
   *  mode keeps `hasActiveFilters`, byte for byte what this component has always gated on. */
  private get hasResettableFilters(): boolean {
    return this.activeFiltersDisplay === 'changed'
      ? this.hasChangedFilters
      : this.hasActiveFilters;
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
    // Pinned to the un-narrowed class. Inside the class body `Defs` is an unresolved type
    // parameter, which leaves the detail type an unresolved conditional that no concrete argument
    // list can be checked against -- the same reason `<lr-select>`'s own `emitValueEvents()`
    // resolves through a `Multiple`-widened `self` first. The constraint already guarantees the
    // payload's shape.
    const self = this as unknown as LyraFilterBar;
    self.value = self.resetValue;
    self.emit('lr-input', Object.freeze({
      value: self.value,
      filterId: undefined,
      appliedPreset: undefined,
    }));
    self.emit('lr-reset', Object.freeze({ value: self.value }));
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
    // Pinned to the un-narrowed class -- see `reset()`'s identical note.
    const self = this as unknown as LyraFilterBar;
    self.value = next;
    self.emit('lr-input', Object.freeze({
      value: self.value,
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

  /** Whether `delay` is a real, positive debounce -- non-finite/zero/negative means "no debounce"
   *  rather than scheduling a timer that would never behave sensibly. Shared by `'text'` and
   *  `'combobox'`. */
  private isDebounced(delay: number | undefined): delay is number {
    return typeof delay === 'number' && Number.isFinite(delay) && delay > 0;
  }

  /** Parks `value` under `id` and (re)starts its commit timer -- the shared mechanics behind
   *  `'text'`'s per-keystroke debounce, `'combobox'`'s per-selection-change debounce, and
   *  `'custom'`'s optional debounce. `commit` defaults to the built-in types' unconditional
   *  `setFilterValue(id, pending)`; `'custom'` overrides it with `setCustomContextValue`'s extra
   *  schema-generation/abort/connected guard, since -- unlike a built-in control -- a custom
   *  renderer's closures can otherwise outlive the schema that created them. */
  private scheduleDebounce(
    id: string,
    value: LyraFilterBarFieldValue,
    delay: number,
    commit: (pending: LyraFilterBarFieldValue) => void = (pending) =>
      this.setFilterValue(id, pending),
  ): void {
    let controller = this.debounceControllers.get(id);
    if (!controller) {
      const created: DebounceController<LyraFilterBarFieldValue> =
        new DebounceController<LyraFilterBarFieldValue>(delay, (pending) => {
          // Drop the key before committing. A settle ends this controller's life exactly like a
          // cancel does, so the map really does hold only mid-edit fields and a schema
          // replacement cannot strand a controller keyed on a filter id it removed. Dropping it
          // *first* leaves a re-entrant edit triggered by `setFilterValue()`'s own render owning
          // the fresh controller it creates, instead of having this one delete it.
          if (this.debounceControllers.get(id) === created) {
            this.debounceControllers.delete(id);
          }
          if (pending !== undefined) commit(pending);
        });
      controller = created;
      this.debounceControllers.set(id, created);
    }
    // Re-read on every edit: a schema replacement can change this filter's own `debounce`, and a
    // surviving controller must honour the new one rather than the delay it was built with.
    controller.delayMs = delay;
    controller.push(value);
  }

  /** Whether that field currently holds an uncommitted edit -- i.e. the user is mid-edit and owns
   *  the control (and its caret) until they pause, blur, or commit. */
  private hasPendingDebounce(id: string): boolean {
    return this.debounceControllers.get(id)?.pending ?? false;
  }

  private onControlChange = (def: LyraFilterBarFilterDefinition, e: Event): void => {
    // `appliedPreset` exists only on `<lr-date-input>`, and only while its own quick-range row
    // produced the commit -- it reads `undefined` on every other composed control, which is
    // exactly what the detail should then carry.
    const control = e.target as HTMLElement & {
      value: LyraFilterBarFieldValue;
      appliedPreset?: LyraDateRangePreset;
    };
    if (def.type === 'combobox' && this.isDebounced(def.debounce)) {
      this.scheduleDebounce(def.filterId, control.value, def.debounce);
      return;
    }
    this.setFilterValue(def.filterId, control.value, control.appliedPreset);
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
    const next = def.custom.adapter.valueFromEvent(e);
    if (this.isDebounced(def.debounce)) {
      this.scheduleDebounce(def.filterId, next, def.debounce, (pending) =>
        this.setCustomContextValue(def, generation, pending)
      );
      return;
    }
    this.setCustomContextValue(def, generation, next);
  };

  /** A `'text'` filter's keystroke: commits immediately, or (with a positive `debounce`) parks the
   *  value until the user pauses. */
  private onTextInput(def: LyraFilterBarTextDefinition, e: Event): void {
    if (this.disabled) return;
    const next = (e.target as HTMLElement & { value: string }).value ?? '';
    if (!this.isDebounced(def.debounce)) {
      this.cancelDebounce(def.filterId);
      this.setFilterValue(def.filterId, next);
      return;
    }
    this.scheduleDebounce(def.filterId, next, def.debounce);
  }

  /** Commits an in-flight keystroke/selection right now, ahead of its own delay -- the field's own
   *  `change`, or its blur. A no-op when nothing is pending, so it is safe to call on every blur.
   *  The settle callback drops the map entry, so a flushed field is left in the same state a
   *  naturally-settled one is: no controller, nothing pending. */
  private flushDebounce(id: string): void {
    this.debounceControllers.get(id)?.flush();
  }

  /** Discards an in-flight keystroke/selection without committing it -- one filter's, or (with no
   *  argument) every filter's. `syncTextControls()` then pushes the authoritative value back into
   *  an uncontrolled `'text'` field on the next render (a `'combobox'` field's own `.value=`
   *  binding reverts on its own, being fully controlled), so the discarded draft does not linger
   *  on screen either. */
  private cancelDebounce(id?: string): void {
    for (const [key, controller] of this.debounceControllers) {
      if (id !== undefined && key !== id) continue;
      // Dispose rather than merely cancel: the entry is dropped here, so nothing can ever push to
      // this instance again, and an already-queued callback can no longer reach a discarded draft.
      // The next edit builds a fresh controller carrying that filter's current `debounce`.
      controller.dispose();
      this.debounceControllers.delete(key);
    }
  }

  private onFieldFocusout(id: string): void {
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
        : def.type === 'chip'
          // Undeclared falls through to `''`, what every non-multi built-in type writes; an
          // array-valued or sentinel chip filter declares its own (paired with `isEmpty` for a
          // sentinel, or the bar keeps reading the "cleared" value as still set).
          ? def.clearValue ?? ''
          : def.type === 'checkbox-menu' || (def.type === 'combobox' && def.multiple)
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
      const formatted = def.custom?.adapter.formatValue?.(value, this.effectiveLocale);
      if (formatted !== undefined) return formatted;
      if (Array.isArray(value)) {
        return getListFormat(this.effectiveLocale, {
          style: 'long',
          type: 'conjunction',
        }).format(value);
      }
      return value === undefined ? '' : String(value);
    }
    if (def.type === 'chip') {
      // Deliberately *before* the date tail below, and unconditionally so: a chip filter's value is
      // owned by a widget this component never renders, so it is arbitrary caller data with no
      // range separator to prettify -- running it through that branch's `'/'` split would silently
      // reformat an ISO day and mangle any value containing a slash, the same trap the `'text'`
      // branch already records. The ladder below matches a custom adapter's own omitted
      // `formatValue` exactly, so there is one formatting contract for both control-less types.
      const formatted =
        typeof def.formatValue === 'function'
          ? def.formatValue(value, this.effectiveLocale)
          : undefined;
      if (formatted !== undefined) return formatted;
      if (Array.isArray(value)) {
        return getListFormat(this.effectiveLocale, {
          style: 'long',
          type: 'conjunction',
        }).format(value);
      }
      return value === undefined ? '' : String(value);
    }
    if (isChoiceDefinition(def)) {
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

  /** The filters `render()`'s chip row shows -- every non-empty filter under `'all'` (the
   *  default), only those whose value differs from their own `defaultValue` under `'changed'`, or
   *  none at all under `'hidden'` -- see `activeFiltersDisplay`. `clearFilter()`'s own focus-repair
   *  index is computed against this same list, so it always matches the chips actually rendered
   *  regardless of display mode. */
  private get activeEntries(): {
    def: LyraFilterBarFilterDefinition;
    display: string;
  }[] {
    if (this.activeFiltersDisplay === 'hidden') return [];
    return this._filters
      .filter((def) => !this.isEmpty(def, this.valueFor(def)))
      .filter(
        (def) =>
          this.activeFiltersDisplay !== 'changed' ||
          !filterValueEqualsDefault(this.valueFor(def), def.defaultValue)
      )
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
    this.closeCheckboxMenus();
    this.schemaAbortController?.abort();
    this.schemaAbortController = undefined;
    this.schemaGeneration += 1;
  }

  /** Closes every composed `'checkbox-menu'` dropdown outright. `<lr-popover>` deliberately
   *  *suspends* rather than closes on disconnect, so a filter bar moved between containers would
   *  otherwise come back with a menu the user never reopened -- the same transient-state reset
   *  this component already does for an in-flight debounce and the custom-renderer schema. Closing
   *  on both edges covers the case where the detached update lands too late to take effect. */
  private closeCheckboxMenus(): void {
    for (const menu of this.renderRoot?.querySelectorAll<HTMLElement & { open: boolean }>(
      'lr-dropdown[data-filter-id]'
    ) ?? []) {
      if (menu.open) menu.open = false;
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.closeCheckboxMenus();
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
      if (def.type !== 'text' || this.hasPendingDebounce(def.filterId)) continue;
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

  /** Optional decorative leading visual, rendered into a composed control's own leading slot as
   *  inert, aria-hidden chrome so it can neither take focus nor join that control's accessible
   *  name. Shared by `<lr-option>`'s own `icon` (select/combobox rows), a built-in filter
   *  definition's own `icon` (the composed field itself), and the `'checkbox-menu'` rows -- whose
   *  composed `<lr-dropdown-item>` names its leading slot `icon` rather than `start`, which is why
   *  the slot name is a parameter instead of a constant. */
  private renderStartAdornment(
    icon: unknown,
    slotName = 'start'
  ): TemplateResult | typeof nothing {
    return icon === undefined || icon === null
      ? nothing
      : html`<span slot=${slotName} aria-hidden="true" inert>${icon}</span>`;
  }

  /** One `<lr-option>`, shared by the select and combobox branches so an option's optional `icon`
   *  reaches both and `searchText` reaches the one control that reads it (`<lr-combobox>`; see
   *  `LyraFilterBarOption.searchText`). */
  private renderOption(option: LyraFilterBarOption): TemplateResult {
    return html`<lr-option
      value=${option.value}
      search-text=${option.searchText ?? nothing}
      ?disabled=${option.disabled === true}
      >${this.renderStartAdornment(option.icon)}${option.label}</lr-option
    >`;
  }

  /** The label/placeholder/accessible-name triple one composed control receives, resolved from
   *  `labelVisibility`. Hiding the label routes it to the control's own `aria-label` (which every
   *  composed control here honours over its computed internal name) and, when the definition
   *  declares no `placeholder` of its own, also uses it as the placeholder -- so the field still
   *  reads as itself once the stacked label is gone.
   *
   *  `'auto'` deliberately resolves to the SAME triple as `'visible'`, not to the hidden branch.
   *  Under `'auto'` the visible label element still exists at every width -- the narrow state only
   *  clips it visually (see `labelAutoAttribute()`) -- so routing the name onto the control as well
   *  would name a wide-allocation field twice, and a *narrow* one twice over too, since the clipped
   *  label is still in the accessibility tree. Anything other than `'hidden'` (including a foreign
   *  value) therefore keeps the visible routing, matching `activeFiltersDisplay`'s own
   *  foreign-value handling. */
  private labelRouting(def: LyraFilterBarComposedDefinitionBase): {
    readonly label: string;
    readonly placeholder: string;
    readonly accessibleLabel: string | typeof nothing;
  } {
    const hidden = def.labelVisibility === 'hidden';
    return {
      label: hidden ? '' : def.label,
      placeholder: def.placeholder || (hidden ? def.label : ''),
      accessibleLabel: hidden ? def.label : nothing,
    };
  }

  /** Marks a filter's rendered control as label-auto for `filter-bar.styles.ts`'s container query,
   *  which is what actually clips the label below the threshold. An attribute rather than a class
   *  because the same hook has to be readable from a rule reaching into the composed control's own
   *  shadow root -- `[data-label-auto]::part(form-control-label)` -- where a class on the host
   *  would work equally well but an attribute matches this component's existing `data-filter-id`
   *  marker. Absent for every other `labelVisibility`, so an unset filter renders byte-identical
   *  markup to before this option existed. */
  private labelAutoAttribute(def: LyraFilterBarComposedDefinitionBase): boolean {
    return def.labelVisibility === 'auto';
  }

  /** A `'checkbox-menu'` row was activated. The composed `<lr-dropdown-item>` fires this
   *  cancelable event with its *proposed* next `checked` state and commits that state itself
   *  unless the event is prevented -- so this handler always prevents it and derives the next
   *  `string[]` from the bar's own value instead. Without that, the row would self-toggle and the
   *  `?checked=` binding's dirty check would see no change on the next render, permanently
   *  desynchronizing a rejected toggle (a `disabled` bar, a removed filter) from the rendered
   *  checkmark. */
  private onCheckboxMenuToggle(
    def: LyraFilterBarCheckboxMenuDefinition,
    event: Event
  ): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.disabled) return;
    const detail = (event as CustomEvent<{ value: string; checked: boolean }>).detail;
    const current = this.valueFor(def);
    const selected = Array.isArray(current)
      ? current.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const next = detail.checked
      ? selected.includes(detail.value)
        ? selected
        : [...selected, detail.value]
      : selected.filter((entry) => entry !== detail.value);
    this.setFilterValue(def.filterId, Object.freeze(next));
  }

  /** The `'checkbox-menu'` branch: `<lr-dropdown>` plus one `<lr-dropdown-item type="checkbox">`
   *  per option. The menu deliberately stays open across toggles (`stay-open-on-select`), which is
   *  the whole interaction difference from a combobox. Unlike every other built-in branch the
   *  composed control brings no label/error chrome of its own, so this renders the only copy of
   *  each: the label as the trigger's own text (visually hidden, never removed, when
   *  `labelVisibility` is `'hidden'`), and the revealed required error both as a visible,
   *  `aria-hidden` line under the field and as a screen-reader-only run inside the trigger -- an
   *  idref cannot reach the trigger's own internal button across that shadow boundary, so joining
   *  the button's accessible name is the only way the error reaches assistive tech.
   *
   *  The label and the selection summary are two separate runs slotted into ONE `<lr-button>`
   *  label wrapper. lr-button's own `gap` sits between its start/label/end wrappers, not inside the
   *  label, so left alone the two runs concatenate ("TeamsCore and Design"); `filter-bar.styles.ts`
   *  lays that wrapper out as a flex row with its own gap instead. Under
   *  `labelVisibility: 'hidden'` with no declared `placeholder`, `labelRouting()` deliberately
   *  falls back to the label itself as the summary so the trigger still reads as itself once the
   *  stacked label is gone -- and the screen-reader-only label run is then dropped, because
   *  emitting both would name the button twice ("Teams Teams").
   *
   *  Two affordances every other built-in type inherits from its composed control are deliberately
   *  absent here, for mechanical reasons rather than editorial ones:
   *
   *  - **No `aria-invalid` on the trigger.** `<lr-button>` forwards exactly six host ARIA
   *    attributes onto the internal element that owns the button role (`aria-label`,
   *    `aria-haspopup`, `aria-expanded`, `aria-pressed`, `aria-current`, `aria-describedby`);
   *    `aria-invalid` is not one of them, so writing it here would leave it on a role-less
   *    `display: inline-block` host where no assistive technology would ever read it. A
   *    silently-inert ARIA attribute is worse than none, and the revealed error already reaches
   *    assistive tech through the trigger's accessible name.
   *  - **No required marker.** `formControlRequiredMarker` (`internal/form-control.styles.ts`)
   *    carries the library's only two marker shapes -- `:host([required])
   *    [part~='form-control-label']` and `[part='field'][data-required] [part='label']` -- and
   *    neither matches this structure: the host is not the required field, and this trigger's label
   *    part is `filter-control-label`. Re-typing the `::after` locally is precisely what that
   *    shared sheet exists to prevent, and renaming the span to `label`/`form-control-label` to fit
   *    would mint a permanent public part name on `<lr-filter-bar>` for a styling side effect.
   *  - **No stacked label above the field.** Every other built-in type's stacked label is rendered
   *    by the COMPOSED control itself (its own `form-control-label`, fed by this component's
   *    `.label=` binding) -- there is no shared "stacked label" template inside `<lr-filter-bar>`
   *    for this branch to opt into without inventing one. `labelVisibility` therefore keeps its
   *    existing, narrower meaning here (whether the label baked into the trigger's own text is
   *    visible or screen-reader-only), not "stacked vs. inline". Revisit only once a concrete
   *    layout is designed for it, rather than approximating one here.
   *
   *  The trigger DOES get the same `with-caret` disclosure chevron a `'select'`'s own trigger
   *  shows, both because a menu button with no expand indicator otherwise reads as a
   *  call-to-action rather than a field, and because `<lr-button>`'s own `with-caret` layout (the
   *  label grows to fill the stretched button, pinning the caret to the trailing edge -- see
   *  `button.class.ts`) is what left-aligns this trigger's content instead of centring it: no new
   *  layout of this component's own is involved. `label`/`caret` are forwarded from the composed
   *  `<lr-button>` under collision-resistant `filter-control-*` names -- `filter-control-label` and
   *  `filter-control-input` already name this component's OWN two spans rendered inside that label
   *  wrapper, so the wrapper itself needs a third, distinct name
   *  (`filter-control-label-group`) rather than colliding with either; the caret reuses
   *  `filter-control-expand-icon`, the same name a select/combobox/date-input's own disclosure
   *  chevron already forwards to, so one consumer rule styles every filter type's chevron. */
  private renderCheckboxMenu(
    def: LyraFilterBarCheckboxMenuDefinition,
    value: LyraFilterBarFieldValue,
    errorText: string
  ): TemplateResult {
    const selected = Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
    const size = def.size ?? 'm';
    const routing = this.labelRouting(def);
    const summary = selected.length > 0
      ? this.displayValueFor(def, value)
      : routing.placeholder;
    // See the doc block: under hidden routing the summary may already BE the label (the
    // placeholder fallback), and emitting the screen-reader-only label run as well would name the
    // trigger twice. Emit it only when it adds a name the summary does not already carry.
    const showLabel = def.labelVisibility !== 'hidden' || summary !== def.label;
    return html`<div
      part="filter-control"
      class="checkbox-menu"
      ?data-label-auto=${this.labelAutoAttribute(def)}
    >
      <lr-dropdown
        exportparts=${CHECKBOX_MENU_EXPORT_PARTS}
        data-filter-id=${def.filterId}
        aria-label=${def.label}
        stay-open-on-select
        .size=${size}
        ?disabled=${this.disabled}
        @lr-select=${this.stopControlAlias}
        @focusout=${() => this.onFieldFocusout(def.filterId)}
      >
        <lr-button
          slot="trigger"
          exportparts=${CHECKBOX_MENU_TRIGGER_EXPORT_PARTS}
          appearance="outlined"
          with-caret
          .size=${size}
          ?disabled=${this.disabled}
          >${this.renderStartAdornment(def.icon)}${showLabel
            ? html`<span
                part="filter-control-label"
                class=${def.labelVisibility === 'hidden' ? 'sr-only' : ''}
                >${def.label}</span
              >`
            : nothing}${summary
            ? html`<span part="filter-control-input">${summary}</span>`
            : nothing}${errorText
            ? html`<span class="sr-only">${errorText}</span>`
            : nothing}</lr-button
        >
        ${def.options.map(
          (option) => html`<lr-dropdown-item
            part="filter-control-option"
            type="checkbox"
            value=${option.value}
            ?checked=${selected.includes(option.value)}
            ?disabled=${option.disabled === true}
            @lr-menu-item-change=${(event: Event) => this.onCheckboxMenuToggle(def, event)}
            >${this.renderStartAdornment(option.icon, 'icon')}${option.label}</lr-dropdown-item
          >`
        )}
      </lr-dropdown>
      ${errorText
        ? html`<span part="filter-control-error" aria-hidden="true">${errorText}</span>`
        : nothing}
    </div>`;
  }

  private renderControl(def: LyraFilterBarControlDefinition): TemplateResult {
    const value = this.valueFor(def);
    const missing = Boolean(def.required) && this.isEmpty(def, value);
    const errorText =
      this.touchedFilters.has(def.filterId) && missing
        ? this.localize('fieldRequired')
        : '';
    const onChange = (e: Event) => this.onControlChange(def, e);
    const onFocusout = () => this.markTouched(def.filterId);

    if (def.type === 'custom') {
      const custom = def.custom;
      const generation = this.schemaGeneration;
      const signal = this.schemaSignal;
      const onCustomValueChange = (e: Event) => this.onCustomControlChange(def, generation, e);
      // While a debounce is in flight, render the pending (not-yet-committed) value instead of the
      // stale last-committed one -- exactly like the `'combobox'` branch -- so a custom control
      // bound to `context.value` as a fully controlled `.value=` never reverts mid-delay across an
      // unrelated re-render.
      const pending = this.debounceControllers.get(def.filterId)?.pendingValue;
      const effectiveValue = pending !== undefined ? pending : value;
      const context: LyraFilterBarCustomControlContext = {
        filterId: def.filterId,
        label: def.label,
        definition: def,
        value: effectiveValue,
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
          ) this.onFieldFocusout(def.filterId);
        },
      };
      return html`<div
        part="filter-control"
        data-filter-id=${def.filterId}
        @lr-input=${(event: Event) => event.stopPropagation()}
        @lr-change=${(event: Event) => event.stopPropagation()}
      >${custom.render(context)}</div>`;
    }

    if (def.type === 'checkbox-menu') return this.renderCheckboxMenu(def, value, errorText);

    const routing = this.labelRouting(def);

    if (def.type === 'combobox') {
      const multiple = Boolean(def.multiple);
      // While a debounce is in flight, render the pending (not-yet-committed) selection instead
      // of the last-committed `value` -- this control's `.value=` binding stays fully controlled,
      // unlike `'text'`'s uncontrolled-with-sync field, so without this substitution a render
      // triggered by anything else (another filter's edit, `disabled`/`loading` toggling) would
      // push the stale committed value back over the user's own pending pick.
      const pending = this.debounceControllers.get(def.filterId)?.pendingValue;
      const effectiveValue = pending !== undefined ? pending : value;
      // A single-value combobox's `.value=` binds `undefined`, never `''`, when this filter is
      // unset: `<lr-combobox>` treats `undefined`/`null` as "clear the selection" but treats every
      // string -- including `''` -- as a real, committed (if unmatched) value, rendering its
      // dashed/italic not-in-catalog treatment instead of the declared placeholder. See the
      // `'select'` branch below for the identical collision on `<lr-select>`.
      const comboValue = multiple
        ? Array.isArray(effectiveValue)
          ? effectiveValue
          : []
        : typeof effectiveValue === 'string'
        ? effectiveValue
        : undefined;
      return html`<lr-combobox
        part="filter-control"
        exportparts=${COMBOBOX_EXPORT_PARTS}
        data-filter-id=${def.filterId}
        ?data-label-auto=${this.labelAutoAttribute(def)}
        .label=${routing.label}
        aria-label=${routing.accessibleLabel}
        placeholder=${routing.placeholder}
        ?multiple=${multiple}
        ?required=${Boolean(def.required)}
        ?clearable=${Boolean(def.clearable)}
        .size=${def.size ?? 'm'}
        .emptyText=${def.emptyText}
        .errorText=${errorText}
        .value=${comboValue}
        ?disabled=${this.disabled}
        @change=${onChange}
        @lr-activate=${this.stopControlAlias}
        @lr-input=${this.stopControlAlias}
        @lr-change=${this.stopControlAlias}
        @focusout=${() => this.onFieldFocusout(def.filterId)}
        >${this.renderStartAdornment(def.icon)}${(def.options ?? []).map((o) => this.renderOption(o))}</lr-combobox
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
        ?data-label-auto=${this.labelAutoAttribute(def)}
        type=${def.inputType ?? 'text'}
        .label=${routing.label}
        aria-label=${routing.accessibleLabel}
        placeholder=${routing.placeholder}
        ?required=${Boolean(def.required)}
        ?clearable=${Boolean(def.clearable)}
        .size=${def.size ?? 'm'}
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
        @focusout=${() => this.onFieldFocusout(def.filterId)}
        >${this.renderStartAdornment(def.icon)}</lr-input
      >`;
    }

    if (def.type === 'date' || def.type === 'date-range') {
      return html`<lr-date-input
        part="filter-control"
        exportparts=${DATE_INPUT_EXPORT_PARTS}
        data-filter-id=${def.filterId}
        ?data-label-auto=${this.labelAutoAttribute(def)}
        .label=${routing.label}
        aria-label=${routing.accessibleLabel}
        placeholder=${routing.placeholder}
        .mode=${def.type === 'date-range' ? 'range' : 'single'}
        .min=${def.min || ''}
        .max=${def.max || ''}
        ?with-clear=${Boolean(def.clearable)}
        .size=${def.size ?? 'm'}
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
        >${this.renderStartAdornment(def.icon)}</lr-date-input
      >`;
    }

    // 'select' (also the fallback for an unrecognized type, so a filter with a bad `type` still
    // renders a usable, if empty, control instead of vanishing silently). `.value=` below binds
    // `undefined`, never `''`, while this filter is unset: `<lr-select>` treats `undefined`/`null`
    // as "clear the selection" but treats every string -- including `''` -- as a real, committed
    // (if unmatched) value, rendering its dashed/italic not-in-catalog treatment in place of the
    // declared placeholder. `def.type === 'date' || def.type === 'date-range'` above keeps its own
    // `''` fallback: `<lr-date-input>` has no catalog to mismatch against, so there is nothing for
    // an empty string to collide with there.
    return html`<lr-select
      part="filter-control"
      exportparts=${SELECT_EXPORT_PARTS}
      data-filter-id=${def.filterId}
      ?data-label-auto=${this.labelAutoAttribute(def)}
      .label=${routing.label}
      aria-label=${routing.accessibleLabel}
      placeholder=${routing.placeholder}
      ?required=${Boolean(def.required)}
      ?clearable=${Boolean(def.clearable)}
      .size=${def.size ?? 'm'}
      .errorText=${errorText}
      .value=${typeof value === 'string' ? value : undefined}
      ?disabled=${this.disabled}
      @change=${onChange}
      @lr-activate=${this.stopControlAlias}
      @lr-input=${this.stopControlAlias}
      @lr-change=${this.stopControlAlias}
      @focusout=${onFocusout}
      >${this.renderStartAdornment(def.icon)}${(def.options ?? []).map((o) =>
        this.renderOption(o)
      )}</lr-select
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
          ${this._filters
            // A `'chip'` filter renders no control and claims no toolbar cell: its value is owned
            // by a widget elsewhere on the page and it participates only through the value record,
            // the active-filter chip row and `reset()`. Filtering here (rather than returning
            // `nothing` from `renderControl`) is what keeps an empty `field` wrapper -- whose
            // validation spacer reserves a full row of height -- from painting a blank column, and
            // the type guard is what makes a chip definition structurally unreachable in
            // `renderControl`'s own `'select'` fallback. Keyed on `'chip'` exactly, never on
            // "not a known type": an unrecognized `type` must still fall back to `<lr-select>`.
            .filter((def): def is LyraFilterBarControlDefinition => def.type !== 'chip')
            .map((def) => html`<div part=${fieldPartNames(def.filterId)}>
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
              ?disabled=${this.disabled || this.loading || !this.hasResettableFilters}
              @click=${() => this.reset()}
            >
              ${this.localize('filterBarReset')}
            </lr-button>
            <span class="validation-spacer" aria-hidden="true"></span>
          </div>
          <span part="end" ?hidden=${!this.slotPresence.has('end')}>
            <slot name="end"></slot>
          </span>
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
