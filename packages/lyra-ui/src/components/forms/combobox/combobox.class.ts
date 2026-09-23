import { acquireNativeControlDescription, type NativeControlDescriptionLease } from '../../../internal/native-control-description.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  LyraElement,
  type LyraEventDetailSnapshot,
} from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import { loadAnchoredOverlayRuntime } from '../../../internal/anchored-overlay-runtime.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { chevronIcon, closeIcon } from '../../../internal/icons.js';
import {
  AnchoredValidityController,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import {
  setCustomState,
  syncValidityStates,
} from '../../../internal/custom-states.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import { finiteCount, finiteDuration } from '../../../internal/numbers.js';
import { DebounceController } from '../../../internal/debounce-controller.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import { styles } from './combobox.styles.js';
import type { LyraOption } from './option.class.js';
import './option.class.js';
import {
  autocorrectConverter,
  literalSetConverter,
  omittedEmptyStringConverter,
  optionalLiteralSetConverter,
  spellcheckConverter,
} from '../../../internal/converters.js';
import type { PlaceStrategy, PlaceSync } from '../../../internal/positioner.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  withStaticValidityCheck,
} from '../../../internal/invalid-event-alias.js';
import { tag } from '../../../internal/prefix.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
import { renderDataState } from '../../../internal/data-state-renderer.js';
import type {
  LyraPickerDetailValue,
  LyraPickerValue,
} from '../../../internal/picker-value.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  activateNonmodalOverlay,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import {
  isOptionSelectedDirty,
  isOptionSelectedWrite,
  wasOptionInitiallySelected,
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from '../../../internal/option-selection.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_collapse, LYRA_DEFAULT_comboboxCreate, LYRA_DEFAULT_comboboxLabel, LYRA_DEFAULT_comboboxLoadError, LYRA_DEFAULT_comboboxOverflow, LYRA_DEFAULT_comboboxRequired, LYRA_DEFAULT_comboboxSelectedOverflow, LYRA_DEFAULT_date, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loading, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_noData, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_notInCatalog, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_restore, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_tableLoadFailed, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type OptionFilter = (option: LyraOption, query: string) => boolean;

function isLyraOptionElement(value: unknown): value is LyraOption {
  return isHtmlElement(value) && value.localName === tag('option');
}

/**
 * Normalizes a `value` assignment to the committed array form. `undefined` and `null` mean
 * "clear" -- the documented contract for an unset assignment -- while every string, INCLUDING
 * `''`, is a candidate value: `<lr-option value="">` is a legitimate row, so an empty string must
 * round-trip as a real selection rather than being silently folded into "clear" the way a falsy
 * check would. A caller that means "clear" explicitly passes `[]`, never `''`.
 */
function normalizeSelectionValues(
  next: string | string[] | null | undefined
): string[] {
  if (Array.isArray(next))
    return next.filter((value): value is string => typeof value === 'string');
  return typeof next === 'string' ? [next] : [];
}
export type LyraComboboxPlacement = 'top' | 'bottom';

/** Unsupported values resolve to *absent*, so the listbox falls back to this control's own
 *  default rather than to a member baked into the converter. */
const POSITIONING_STRATEGY = optionalLiteralSetConverter<PlaceStrategy>(['absolute', 'fixed']);

/** The full shared `LyraAppearance` vocabulary, matching `<lr-select>`'s trigger. A value outside
 *  this set -- a typo, or any other unsupported string -- clamps to the documented `'outlined'`
 *  default; see `appearance`'s own doc comment. */
const APPEARANCE = literalSetConverter<LyraAppearance>(
  ['accent', 'filled', 'outlined', 'filled-outlined', 'plain'],
  'outlined'
);
export type LyraComboboxTagRenderer = (
  option: LyraOption,
  index: number
) => unknown;

/** What a `validators` entry may return: nothing/`true` passes, a string is the message, `false` is
 *  a generic failure, and an object of {@linkcode ValidityStateFlags} names the flags to raise. */
export type LyraComboboxValidatorResult =
  | void
  | boolean
  | string
  | ValidityStateFlags;
/** Result shape accepted from object validators used by the upstream form-control contract. */
export interface LyraComboboxObjectValidatorResult {
  message: string;
  isValid: boolean;
  invalidKeys: Exclude<keyof ValidityState, 'valid'>[];
}
/** Structural compatibility shape for an object validator. The `never` callback input is
 * intentional: it lets an array typed by another custom-element package remain assignable while
 * Lyra invokes the callback with this host at runtime. Author new Lyra validators with the
 * strongly typed function or `validate()` branches of {@linkcode LyraComboboxValidator}. */
export interface LyraComboboxObjectValidator {
  /** Host attributes that trigger a fresh validity check when they change. */
  observedAttributes?: string[];
  checkValidity: (input: never) => LyraComboboxObjectValidatorResult;
  message?: string | ((input: never) => string);
}
export type LyraComboboxValidator =
  | ((
      value: string | string[],
      input: LyraCombobox
    ) => LyraComboboxValidatorResult)
  | {
      validate(
        value: string | string[],
        input: LyraCombobox
      ): LyraComboboxValidatorResult;
    }
  | LyraComboboxObjectValidator;

const VALIDITY_FLAG_KEYS: ReadonlySet<string> = new Set<
  keyof ValidityStateFlags
>([
  'badInput',
  'customError',
  'patternMismatch',
  'rangeOverflow',
  'rangeUnderflow',
  'stepMismatch',
  'tooLong',
  'tooShort',
  'typeMismatch',
  'valueMissing',
]);

/** Let Lit's `useDefault` restore this component's false default on attribute removal. The shared
 * native converter intentionally treats a missing attribute as true for true-default controls. */
const comboboxSpellcheckConverter = {
  ...spellcheckConverter,
  fromAttribute: (value: string | null, type?: unknown): boolean | undefined =>
    value === null
      ? undefined
      : spellcheckConverter.fromAttribute?.(value, type),
};

function isValidityFlagKey(value: unknown): value is keyof ValidityStateFlags {
  return typeof value === 'string' && VALIDITY_FLAG_KEYS.has(value);
}

export interface ComboboxSourceRow {
  readonly value: string;
  readonly label: string;
  readonly sub?: string;
  /** Optional decorative leading visual. Its rendered subtree is inert and aria-hidden. */
  readonly icon?: unknown;
  /** Leading adornment, mirroring `<lr-option>`'s `start`/`prefix` slots. Inert and aria-hidden,
   *  like `icon`, so it never joins the option's accessible name. */
  readonly start?: unknown;
  /** Trailing adornment, mirroring `<lr-option>`'s `end`/`suffix` slots. */
  readonly end?: unknown;
  /** Optional trailing metadata badge. */
  readonly badge?: string | number;
  /** Spoken option label when the visible row needs additional context. */
  readonly accessibleLabel?: string;
  /** Opaque application payload retained in `selectedRows`. */
  readonly data?: unknown;
  readonly dotColor?: string;
  readonly group?: string;
  readonly disabled?: boolean;
  /** @internal Marks the synthetic, cancelable "create this value" action row. */
  readonly createInput?: string;
  /** @internal Marks the synthetic row standing in for a committed value no option or async row
   *  claims -- see `<lr-combobox>`'s `showUnknownOption`. */
  readonly unknownValue?: string;
}

/** Bounded async response envelope. `total` is the provider-side match count before its own cap. */
export interface ComboboxSourceResult {
  readonly rows: readonly ComboboxSourceRow[];
  readonly total?: number;
}

/** Async row provider for a remote-backed combobox. Receives the current query and an options bag
 *  carrying an `AbortSignal` and the component's hard row ceiling. Forward the signal to
 *  `fetch(url, { signal })` and honor `limit` when practical. A legacy bare row array remains valid;
 *  `{ rows, total }` exposes provider-side truncation truthfully.
 *  The options parameter is required by the exported type so implementations can consume the
 *  cancellation signal. A one-parameter `(query) => …` function remains assignable under
 *  TypeScript's ordinary function-parameter compatibility rules. */
export type ComboboxSource = (
  query: string,
  options: { signal: AbortSignal; limit: number }
) => Promise<readonly ComboboxSourceRow[] | ComboboxSourceResult>;
export type LyraComboboxSelectionDirection = LyraSelectionDirection;

/** One debounced `source()` call, captured when it was armed rather than read back when it fires:
 *  the query text, the generation `token` that decides whether its result is still the current
 *  one, the realm it must run (and abort) in, and the exact `source` function installed at the
 *  time -- a later `source` assignment supersedes it through the token, and must not retroactively
 *  redirect a call the consumer already triggered. */
interface ComboboxSourceRequest {
  readonly query: string;
  readonly token: number;
  /** `Window & typeof globalThis`, not a bare `Window`: the realm is captured so the request can
   *  construct its `AbortController` *in that realm*, and the global constructors live on the
   *  `typeof globalThis` half. A bare `Window` drops them and the `new owner.AbortController()`
   *  below stops compiling (TS2339). */
  readonly owner: Window & typeof globalThis;
  readonly source: ComboboxSource;
}

const MAX_SOURCE_ROWS = 2_000;
const MAX_SOURCE_TEXT_UNITS = 250_000;
const MAX_SOURCE_FIELD_UNITS = 4_096;
const MAX_RENDER_ROWS = 1_000;

function normalizeSourceResult(input: unknown): {
  rows: ComboboxSourceRow[];
  total: number;
  truncated: boolean;
} {
  let candidateRows: unknown;
  let candidateTotal: unknown;
  try {
    if (Array.isArray(input)) {
      candidateRows = input;
    } else if (typeof input === 'object' && input !== null) {
      candidateRows = (input as { rows?: unknown }).rows;
      candidateTotal = (input as { total?: unknown }).total;
    }
  } catch {
    throw new TypeError('Invalid combobox source result');
  }
  if (!Array.isArray(candidateRows))
    throw new TypeError('Invalid combobox source result');

  const providerTotal =
    typeof candidateTotal === 'number' &&
    Number.isFinite(candidateTotal) &&
    candidateTotal >= 0
      ? Math.trunc(candidateTotal)
      : candidateRows.length;
  const rows: ComboboxSourceRow[] = [];
  let textUnits = 0;
  const limit = Math.min(candidateRows.length, MAX_SOURCE_ROWS);
  for (let index = 0; index < limit; index++) {
    try {
      const value = (candidateRows[index] as { value?: unknown } | null)?.value;
      const label = (candidateRows[index] as { label?: unknown } | null)?.label;
      if (
        typeof value !== 'string' ||
        typeof label !== 'string' ||
        value.length > MAX_SOURCE_FIELD_UNITS ||
        label.length > MAX_SOURCE_FIELD_UNITS
      ) {
        continue;
      }
      const source = candidateRows[index] as Record<string, unknown>;
      const optionalText = (key: string): string | undefined => {
        const candidate = source[key];
        return typeof candidate === 'string' &&
          candidate.length <= MAX_SOURCE_FIELD_UNITS
          ? candidate
          : undefined;
      };
      const sub = optionalText('sub');
      const accessibleLabel = optionalText('accessibleLabel');
      const dotColor = optionalText('dotColor');
      const group = optionalText('group');
      const badgeCandidate = source['badge'];
      const badge =
        typeof badgeCandidate === 'string' &&
        badgeCandidate.length <= MAX_SOURCE_FIELD_UNITS
          ? badgeCandidate
          : typeof badgeCandidate === 'number' &&
            Number.isFinite(badgeCandidate)
          ? badgeCandidate
          : undefined;
      const units =
        value.length +
        label.length +
        (sub?.length ?? 0) +
        (accessibleLabel?.length ?? 0) +
        (dotColor?.length ?? 0) +
        (group?.length ?? 0) +
        (typeof badge === 'string' ? badge.length : 0);
      if (textUnits + units > MAX_SOURCE_TEXT_UNITS) break;
      textUnits += units;
      rows.push({
        value,
        label,
        ...(sub === undefined ? {} : { sub }),
        ...(source['icon'] === undefined ? {} : { icon: source['icon'] }),
        ...(source['start'] === undefined ? {} : { start: source['start'] }),
        ...(source['end'] === undefined ? {} : { end: source['end'] }),
        ...(badge === undefined ? {} : { badge }),
        ...(accessibleLabel === undefined ? {} : { accessibleLabel }),
        ...(source['data'] === undefined ? {} : { data: source['data'] }),
        ...(dotColor === undefined ? {} : { dotColor }),
        ...(group === undefined ? {} : { group }),
        ...(typeof source['disabled'] === 'boolean'
          ? { disabled: source['disabled'] }
          : {}),
      });
    } catch {
      // A hostile getter invalidates only its row; valid siblings remain usable.
    }
  }
  const total = Math.max(providerTotal, candidateRows.length);
  return { rows, total, truncated: total > rows.length };
}

/** Detail of `lr-filter`: the in-progress filter text, never the committed selection. */
export interface ComboboxFilterDetail {
  value: string;
}

export type { LyraPickerDetailValue, LyraPickerValue };

export interface LyraComboboxEventMap<Multiple extends boolean = boolean> {
  'lr-invalid': CustomEvent<null>;
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
  'lr-clear': CustomEvent<null>;
  'lr-create': CustomEvent<{ inputValue: string }>;
  'lr-filter': CustomEvent<ComboboxFilterDetail>;
  /** `detail.data` is index-aligned with `detail.value`: `data[i]` is the opaque `data` payload
   *  behind `value[i]` (light-DOM `<lr-option data>` or an async source row's own `data`), by
   *  reference and never deep-cloned, or `undefined` for a value resolving to no live row/option. */
  'lr-change': CustomEvent<
    LyraEventDetailSnapshot<{
      readonly value: LyraPickerDetailValue<Multiple>;
      readonly data: readonly unknown[];
    }>
  >;
  'lr-activate': CustomEvent<{ value: string }>;
  'lr-source-error': CustomEvent<{ error: unknown; query: string }>;
  'lr-retry': CustomEvent<null>;
  input: InputEvent | CustomEvent<
    LyraEventDetailSnapshot<{
      readonly value: LyraPickerDetailValue<Multiple>;
      readonly data: readonly unknown[];
    }>
  >;
  change: CustomEvent<
    LyraEventDetailSnapshot<{
      readonly value: LyraPickerDetailValue<Multiple>;
      readonly data: readonly unknown[];
    }>
  >;
  blur: FocusEvent;
  focus: FocusEvent;
}
/**
 * Stable per-event aliases, so a host can name one event's type without restating the detail
 * schema (or re-deriving it from `LyraComboboxEventMap`). Each narrows with the same `Multiple`
 * parameter the component does: `LyraComboboxChangeEvent<false>`'s `detail.value` is a `string`.
 */
export type LyraComboboxChangeEvent<Multiple extends boolean = boolean> =
  LyraComboboxEventMap<Multiple>['lr-change'];
export type LyraComboboxSourceErrorEvent =
  LyraComboboxEventMap['lr-source-error'];

/**
 * `<lr-combobox>` — a filterable single/multi select that combines a text
 * input with a listbox. Mirrors the core `<wa-combobox>` API under `lr-`.
 *
 * Options are `<lr-option value>` children. Emits native-style `change`/`input`
 * (like Web Awesome) plus `lr-show`/`lr-hide`/`lr-clear`.
 * Enter commits the highlighted option while the listbox has one; with nothing highlighted it
 * performs the implicit form submission a native text field would (see
 * `internal/submit-on-enter.ts` — the internal input is in a shadow root and has no form owner, so
 * the platform can never do it here).
 * Standard size tiers share their outer control height with sibling Lyra controls; the decorative
 * expand icon scales inside that allocation without creating an independent action target.
 * If local options or async rows change while a row is keyboard-active, the active descendant
 * clamps to the nearest enabled survivor and clears when none remain.
 * An async `source` failure renders as a disabled listbox row, not a shadow-root live region; each
 * current post-mount rejection appends the localized `comboboxLoadError` message to the shared
 * light-DOM assertive announcement sink. Raw caught error text is never exposed to users.
 * The floating listbox is a nonmodal shared-overlay-manager entry. Visual stack order, Escape,
 * outside-pointer dismissal, and focus handoff are therefore owned by only the newest Lyra
 * overlay, including when another popup such as `lr-color-picker` remains open underneath it.
 * The editable combobox input exposes explicit stateful `aria-invalid`: visible error chrome wins
 * immediately, while intrinsic/custom invalidity is exposed only after interaction.
 *
 * Host `aria-describedby` targets supplement internal hint/error guidance on the semantic
 * control, including live target replacement and document adoption. Removing label, hint, or
 * error attributes safely omits their content while retaining native null property readback.
 * Mounted option `selected` writes immediately update the live value and submission silently;
 * reset defaults stay independent, and later default changes preserve a dirty selection.
 *
 * Composing keys stay with text editing. Inert source options and their inert ancestors are
 * unavailable through popup rows; named option adornment mutations refresh their presentation.
 * Single mode exposes one selected occurrence while retaining backing multiple-selection history.
 *
 * Assigning `undefined`/`null` to `value` clears the selection; every string, including `''`, is
 * instead a candidate value resolved against the current local options/async rows -- an
 * `<lr-option value="">` (or a matching row) is legitimate and now round-trips like any other. A
 * committed value matching no current option/row (a stale value, or a programmatic assignment with
 * a typo) still commits rather than being dropped, but renders with a dashed/italic
 * `[part='unknown-value']` badge instead of silently passing the raw string off as an ordinary
 * label -- see `isUnknownValue()`. Suppressed while an async `source` fetch has never yet resolved
 * for this element, or while the public `loading` property is set (for a consumer mounting
 * `<lr-option>` children asynchronously itself, with no `source` involved), and never shown for an
 * `allowCustomValue` commit, which is a sanctioned unmatched value, not a stale one. Over that same
 * unresolved window the raw value itself is withheld too -- the trigger (and any `multiple`-mode
 * tag for the same value) shows the `loadingText` placeholder instead of the raw string, since it
 * is not yet knowable whether the value is even unmatched.
 *
 * @customElement lr-combobox
 * @slot - `<lr-option>` elements.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot start - Adornment at the inline-start of the trigger row, before the selected-value tags
 *   and the filter input. Slotted content is decorative chrome, not an option: `collectOptions()`
 *   only ever collects `<lr-option>` elements from the default slot.
 * @slot end - Adornment after the filter input and the built-in clear action, and before the
 *   expand icon — so consumer content never sits outboard of the dropdown chevron.
 * @slot clear-icon - Replaces the clear button's built-in icon.
 * @slot expand-icon - Replaces the dropdown indicator's built-in icon.
 * @event {CustomEvent<LyraEventDetailSnapshot<{ readonly value: LyraPickerDetailValue<Multiple>; readonly data: readonly unknown[]; }>>} change - The selection changed through user
 * interaction. A bubbling, composed, non-cancelable event carrying `detail: { value, data }` (the
 * new committed selection: a string in single mode, a string[] in `multiple` mode; `data` is
 * index-aligned with `value` -- `data[i]` is the opaque `data` payload of the row/option behind
 * `value[i]`, by reference and never deep-cloned, or `undefined` for a value that resolves to no
 * live row/option -- see `isUnknownValue()`).
 * @event {InputEvent | CustomEvent<LyraEventDetailSnapshot<{ readonly value: LyraPickerDetailValue<Multiple>; readonly data: readonly unknown[]; }>>} input - The user typed in the
 * filter or changed the selection. Text edits expose the original InputEvent (no `value` detail);
 * selection changes emit a bubbling, composed, non-cancelable event carrying `detail: { value, data }`.
 * @event {CustomEvent<LyraEventDetailSnapshot<{ readonly value: LyraPickerDetailValue<Multiple>; readonly data: readonly unknown[]; }>>} lr-change - Prefixed compatibility alias fired
 * after `input` and `change` on the same selection change, mirroring `<lr-checkbox>`'s `lr-change`.
 * `detail: { value, data }`. Not fired for typing or a programmatic `value` assignment.
 * @event lr-activate - Fired on every activation of an available listbox row -- a click, or
 *   Enter on the active row -- whether or not the selection actually moved. `detail: { value }`
 *   carries the activated option's own value, always a single string even in `multiple` mode.
 *   Bubbling and composed, so a host outside the shadow tree receives it. Not cancelable: it is a
 *   notification that the user picked a row, not a veto point, and nothing in this component
 *   branches on it. In single-select mode, re-picking the already-selected row is the case
 *   `change`/`lr-change` deliberately stay silent for -- "re-run that filter" is a real intent --
 *   and it is otherwise unobservable, because the rows live in this shadow root, so a retargeted
 *   `click` names no option and a keyboard commit produces no click at all. When an activation does
 *   move the selection, `input`/`change`/`lr-change` are emitted first. Not fired for typing, for a
 *   committed custom value that matches no row, for the clear button, or for a programmatic `value`
 *   assignment.
 * @event lr-source-error - An async `source` call rejected. `detail: { error, query }` carries the
 *   raw rejection, so a host can log or report it (the rendered copy stays localized and never
 *   shows it), plus the exact query string that call was made with -- the rejected call's own
 *   query, not necessarily `this.query`/`inputValue`, which may have moved on (or been cleared by
 *   closing the listbox) by the time the rejection settles. Not cancelable — the failure has
 *   already happened and the error row is already what rendered, so there is nothing to veto.
 * @event lr-retry - The failed-load state's `[part='retry-button']` was activated. Cancelable —
 *   the built-in action calls `refresh()`, and `preventDefault()` leaves the failure on screen for
 *   a host that owns its own retry timing.
 * @method refresh - `refresh(): void` — re-runs the current `source` query without changing the
 *   source's identity, its debounce controller, or its delay. Queues for the next open when the
 *   listbox is closed; does nothing without a `source`.
 * @slot source-error - Replaces the built-in failed-`source` state, retry control included. Named
 *   apart from the form-control `error` slot deliberately: they are different failures and a
 *   control has to be able to show both.
 * @event lr-show - The listbox is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed and the reflected attribute untouched.
 * @event lr-after-show - The listbox finished opening and its transition settled.
 * @event lr-hide - The listbox is about to close, however `open` became false. Conditionally
 *   cancelable: connected transitions can be vetoed on the same terms as `lr-show`; an
 *   already-removed element closing on disconnect cannot honour a veto. A connected veto also
 *   preserves the live filter query, active option, and async rows exactly.
 * @event lr-after-hide - The listbox finished closing and its transition settled.
 * @event lr-clear - The value was cleared.
 * @event {CustomEvent<{ inputValue: string }>} lr-create - Cancelable request to create a
 *   nonmatching input value. Prevent the event to supply a normalized option/value yourself.
 * @event {CustomEvent<ComboboxFilterDetail>} lr-filter - The in-progress filter text changed
 * through user input. `detail.value` is the live filter string, which is not the same thing as the
 * host's `value` (the committed selection). User-input only: typing and the clear button announce
 * it. Programmatic edits, including `setRangeText()`, are silent. `setRangeText()` preserves
 * the replaced filter text and synchronizes its query/options without changing selected value.
 * Picking a row, resetting the form, and dismissing the listbox also update the filter silently.
 * @event {FocusEvent} blur - Re-dispatched from the internal native input as a bubbling, composed,
 * non-cancelable event.
 * @event {FocusEvent} focus - Re-dispatched from the internal native input as a bubbling, composed,
 * non-cancelable event.
 * @event lr-invalid - The combobox failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @csspart form-control - The outer wrapper around label, combobox, listbox, error and hint.
 * @csspart form-control-label - The `<label>` element.
 * @csspart label - Compatibility wrapper around the visible label content.
 * @csspart form-control-input - Compatibility wrapper around the editable control.
 * @csspart combobox - The input container (positioning anchor).
 * @csspart combobox-input - The text input.
 * @csspart start - Wrapper around the `start` adornment slot; `hidden` while nothing is slotted.
 * @csspart end - Wrapper around the `end` adornment slot; `hidden` while nothing is slotted.
 * @csspart listbox - The managed nonmodal options popover; its stack depth comes from
 *   `--lr-overlay-stack-index` with `--lr-layer-dropdown` as the standalone fallback.
 * @csspart group-label - The heading of an option group (rows sharing a `group`), named as on
 *   `lr-select` and `lr-emoji-picker` so one rule can style every grouped list.
 * @csspart option - An option row.
 * @csspart option-dot - An option row's leading status dot (when `dot-color` is set).
 * @csspart option-start - An option row's leading adornment, cloned from the source
 *   `<lr-option>`'s `start`/`prefix` slot (or an async row's `start`). Inert and aria-hidden.
 * @csspart option-end - An option row's trailing adornment, cloned from the source
 *   `<lr-option>`'s `end`/`suffix` slot (or an async row's `end`). Inert and aria-hidden.
 * @csspart option-icon - An async option row's optional decorative leading visual. Its rendered
 *   subtree remains visible but is inert and hidden from assistive technology.
 * @csspart option-label - An option row's label/sub wrapper.
 * @csspart option-sub - An option row's secondary line (when `sub` is set).
 * @csspart option-badge - An async option row's optional trailing metadata badge, and the
 *   localized "not in catalog" badge on a synthetic unmatched-value row (`show-unknown-option`).
 * @csspart option-overflow - The "+N more" indicator shown when rows are capped by `maxRender`.
 * @csspart unknown-value - Badge shown next to the closed single-select input, or a `multiple`-mode
 *   tag, when the committed value matches no current option/row (see `isUnknownValue()`).
 * @csspart tags - The multi-select tag container.
 * @csspart tag - An individual selected tag.
 * @csspart tag-label - The wrapping/ellipsis-safe selected-tag label.
 * @csspart tag__content - Compatibility wrapper around a selected tag's visible content.
 * @csspart tag__remove-button - A tag's remove button.
 * @csspart tag__remove-button__base - Compatibility name on a tag's remove button.
 * @csspart clear-button - The clear button.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart error - Ordinary form-validation text referenced by the internal input; it is not a
 *   live region, avoiding a second announcement alongside native validation/focus feedback.
 * @csspart source-error-row - The listbox row holding the failed-`source` state.
 * @csspart source-error - The shared failed-load state itself, with `source-error-base`,
 *   `source-error-icon`, `source-error-heading`, `source-error-description` and
 *   `source-error-actions` forwarded from the composed `<lr-empty>`.
 * @csspart retry-button - The retry control inside the failed-load state.
 * @csspart hint - The hint message.
 * @cssprop --lr-combobox-trigger-padding - Padding inside the input container.
 * @cssprop [--lr-combobox-text-color=inherit] - Trigger text color. Defaults to the inherited text
 *   color, and to `--lr-color-on-brand` under `appearance="accent"`.
 * @cssprop [--lr-combobox-trigger-min-height=var(--lr-form-control-height)] - Minimum
 *   input-container block size. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 * @cssprop --lr-combobox-trigger-height - Exact input-container height. Unset by default, which
 *   leaves `--lr-combobox-trigger-min-height` as a floor only; set it to a length to both floor and
 *   cap the row (e.g. to pixel-match `<lr-input>`/`<lr-select>` in the same toolbar). Because it is
 *   never declared by the component itself, it can be set from an ancestor or an outer-tree rule as
 *   well as inline on the element. Intended for a single-row combobox: in `multiple` mode a tag row
 *   long enough to wrap overflows the pinned box visibly (nothing is clipped or made unreachable),
 *   so leave it unset there.
 * @cssprop [--lr-combobox-font-size=var(--lr-form-control-font-size)] - Input text size, from the
 *   shared form-control size ladder.
 * @cssprop --lr-combobox-tag-padding - Selected-tag padding.
 * @cssprop --lr-combobox-tag-font-size - Selected-tag text size.
 * @cssprop [--lr-combobox-tag-bg=var(--lr-color-brand-quiet)] - Selected-tag background. Scoped
 *   independently of every other use of the shared `--lr-color-brand-quiet` token in this file.
 * @cssprop [--lr-combobox-tag-color=var(--lr-color-text)] - Selected-tag text color.
 * @cssprop [--lr-combobox-tag-radius=var(--lr-radius)] - Selected-tag corner radius.
 * @cssprop [--lr-combobox-unknown-value-border-style=dashed] - Border style of a `multiple`-mode
 *   tag whose committed value matches no current option/row.
 * @cssprop [--lr-combobox-unknown-value-border-color=var(--lr-color-border)] - Border color of the
 *   same unknown-value tag.
 * @cssprop --lr-combobox-expand-size - Decorative expand-icon box size, scaled by `size`.
 * @cssprop [--lr-combobox-gap=var(--lr-space-xs)] - Gap between the start/end adornments, tags,
 *   and filter input inside the trigger row. Unlike the size knobs above it does not vary by
 *   `size` tier. Override it to retune without a `::part(combobox)` rule.
 * @cssprop [--lr-combobox-radius=var(--lr-radius)] - Corner radius of the trigger row
 *   (`[part='combobox']`). Does not vary by `size` tier; the `pill` attribute swaps it for
 *   `--lr-radius-pill`.
 * @cssprop [--lr-combobox-option-active-bg=var(--lr-color-brand-quiet)] - Background of a hovered
 *   or keyboard-active option row.
 * @cssprop [--lr-combobox-option-selected-bg=transparent] - Background of the currently-selected
 *   option row. Not declared on `:host`; retheme without hijacking `--lr-color-brand`.
 * @cssprop [--lr-combobox-option-selected-border=var(--lr-color-brand)] - Border color of the
 *   selected option row.
 * @cssprop [--lr-combobox-option-selected-color=var(--lr-color-brand)] - Text color of the
 *   selected option row.
 * @cssprop [--lr-combobox-option-selected-font-weight=var(--lr-font-weight-semibold)] - Font
 *   weight of the selected option row.
 * @cssprop [--lr-combobox-option-badge-bg=var(--lr-color-brand-quiet)] - Background of the
 *   `[part='option-badge']` trailing metadata badge, and the "not in catalog" badge on a
 *   synthetic unmatched-value row (`show-unknown-option`).
 * @cssprop [--tag-max-size=var(--lr-size-5rem)] - Maximum inline size of a built-in selected tag.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Listbox enter-transition duration.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Listbox exit-transition duration.
 * @cssprop [--lr-combobox-fill=var(--lr-color-surface)] - Resting background of the trigger row.
 * The `filled`/`filled-outlined` treatments default it to `--lr-color-surface-raised`; a value set
 * here wins over every treatment.
 * @cssprop [--lr-combobox-border-color=var(--lr-color-border)] - Resting border color of the
 * trigger row, `transparent` by default on the `filled` treatment.
 * @cssprop [--lr-combobox-open-border-color=var(--lr-color-brand)] - Border color of the trigger
 * row while it holds focus — the state the listbox opens in. Bound to `:focus-within` rather than to
 * `open`, so it paints on a focused row whose listbox is closed too; the name is symmetric with
 * `lr-select`'s `--lr-select-open-border-color`, which is gated on `open` itself.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control is focused. One name for every field-shaped control in the
 * library, so a halo is configured once rather than per component. Additive: the focus outline and
 * border cue are the accessibility answer to focus and are never replaced by it.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill,
 * on the listbox popup. This is the public arm the popup never had: retinting it no longer means
 * retinting the page surface every card and input reads.
 * @cssprop [--lr-overlay-border=var(--lr-color-border)] - Shared floating-surface edge colour, on
 * the listbox popup.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, on the
 * listbox popup.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored listbox
 * popup.
 * @cssstate blank - Matches while no value is selected.
 * @cssstate disabled - Matches while disabled directly or by an ancestor fieldset.
 * @cssstate required - Matches while `required` is set, so a consumer can mark the field without
 *   duplicating that flag in their own markup.
 * @cssstate optional - Matches while `required` is not set (the complement of `required`).
 * @cssstate valid - Matches while the control satisfies its constraints.
 * @cssstate invalid - Matches while it does not — including a pristine required-and-empty
 *   combobox, exactly like native `:invalid`.
 * @cssstate user-valid - `valid`, but only after the user has interacted: blurred the filter
 *   input, committed a selection, `reportValidity()`, or a submission attempt. Not after a
 *   silent `checkValidity()` alone.
 * @cssstate user-invalid - `invalid`, but only after that same interaction — a required combobox
 *   nobody has touched yet is invalid without being styled as an error.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for
 *   {@link positioningStrategy}, read from computed style when the listbox is positioned. Set it
 *   once on `:root`, a theme, or one clipping ancestor to change every unset combobox beneath it
 *   instead of authoring `positioning-strategy` on each instance; an explicit value on the
 *   instance always wins over it.
 * @status stable
 * @since 4.0.0
 */
export class LyraCombobox<
  Multiple extends boolean = boolean,
> extends LyraElement<LyraComboboxEventMap<Multiple>> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    collapse: LYRA_DEFAULT_collapse,
    comboboxCreate: LYRA_DEFAULT_comboboxCreate,
    comboboxLabel: LYRA_DEFAULT_comboboxLabel,
    comboboxLoadError: LYRA_DEFAULT_comboboxLoadError,
    comboboxOverflow: LYRA_DEFAULT_comboboxOverflow,
    comboboxRequired: LYRA_DEFAULT_comboboxRequired,
    comboboxSelectedOverflow: LYRA_DEFAULT_comboboxSelectedOverflow,
    date: LYRA_DEFAULT_date,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    loading: LYRA_DEFAULT_loading,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    noData: LYRA_DEFAULT_noData,
    noMatches: LYRA_DEFAULT_noMatches,
    notInCatalog: LYRA_DEFAULT_notInCatalog,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    restore: LYRA_DEFAULT_restore,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-change',
    'input',
    'change',
  ]);
  /** `data` carries opaque per-row caller payload -- preserve each item's identity through the
   *  frozen event envelope instead of recursively cloning unknown data, the same policy
   *  `<lr-prompt-queue>`'s `lr-queue-change` detail uses for its own `items`. */
  protected static override readonly identityEventDetailCollectionItems = Object.freeze({
    'lr-change': Object.freeze(['data']),
    input: Object.freeze(['data']),
    change: Object.freeze(['data']),
  });

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    multiple: { type: Boolean, reflect: true, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    readonly: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: {
      reflect: true,
      noAccessor: true,
      converter: omittedEmptyStringConverter,
    },
    maxOptionsVisible: {
      type: Number,
      attribute: 'max-options-visible',
      noAccessor: true,
    },
    maxRender: { type: Number, attribute: 'max-render', noAccessor: true },
    sourceDelay: { type: Number, attribute: 'source-delay', noAccessor: true },
  };

  @property() placeholder = '';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** Whether the listbox is open. Disabled or readonly controls reject direct reopen attempts,
   * including a synchronous fieldset cascade. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const old = this._open;
    const liveDisabled =
      this.effectiveDisabled ||
      (typeof this.matches === 'function' && this.matches(':disabled'));
    this._open = Boolean(next) && !this.readonly && !liveDisabled;
    if (this._open === old) {
      if (next && !this._open && this.hasAttribute('open'))
        this.removeAttribute('open');
      return;
    }
    this.requestUpdate('open', old);
  }
  /** Allows a nonmatching query to be created as a new option through the cancelable `lr-create`
   * veto point. The default action appends and selects an `<lr-option>`. */
  @property({ type: Boolean, attribute: 'allow-create' }) allowCreate = false;
  /** Lets a single-select combobox commit arbitrary text without adding an option. */
  @property({ type: Boolean, attribute: 'allow-custom-value' })
  allowCustomValue = false;
  /**
   * Appends every committed value that no option or async row claims to the end of the listbox as
   * a synthetic, re-selectable row badged with the localized `notInCatalog` text -- the policy
   * `<lr-model-select>` already ships.
   *
   * Off by default, because it adds a row to a listbox that has always rendered only real options.
   * Turn it on wherever a stored value can outlive its catalog entry: without it, the out-of-list
   * value is visible on the trigger but absent from the listbox, so a user who opens the listbox
   * has no way back to the value they arrived with.
   * @default false
   */
  @property({ type: Boolean, attribute: 'show-unknown-option', reflect: true })
  showUnknownOption = false;
  /**
   * Renders the label for a committed value that matches no option or row.
   *
   * The existing tag/option renderers cannot serve this case: they are handed a matched option,
   * which by definition does not exist here, so the raw value string was the only thing left to
   * render. This hook applies everywhere that value's label appears -- the trigger, a `multiple`
   * tag, and the synthetic listbox row -- and is used only while the value is genuinely unmatched,
   * so it can never override a real option's own label. A blank return falls back to the raw
   * value, exactly as no hook at all would. Caller-supplied text: it is not localized here. Not
   * consulted while an async `source` fetch has never yet resolved for this element, or while
   * `loading` is `true` -- the value is not yet known to be unmatched at all, so `loadingText`
   * renders instead (see `isUnknownValue()`).
   */
  @property({ attribute: false }) getUnknownLabel?: (value: string) => string;
  /**
   * Whether a committed value's real label may still be pending -- e.g. the `<lr-option>` catalog
   * behind it is still being fetched/mounted asynchronously (with no `source` involved) and simply
   * hasn't arrived yet. Mirrors `<lr-select>`'s own `loading` property. While `true`, a committed
   * value that currently matches no option/row (the same condition `isUnknownValue()` tests)
   * renders the localized `loadingText` placeholder in the trigger label or the relevant `multiple`
   * tag instead of the raw value, and is not flagged with the dashed/italic
   * `notInCatalog`/`[part='unknown-value']` badge a genuinely unmatched value gets -- "not yet
   * resolved" is a different state from "known to be missing". The open listbox shows the same
   * loading row a `source` fetch in flight shows. Independent of `source`'s own async lifecycle:
   * either condition alone is enough to suppress the unknown-value presentation. Never mutates
   * `value`/`selectedOptions` itself, and does not itself disable the trigger. Reflected so
   * `:host([loading])` is available as a styling hook.
   * @default false
   */
  @property({ type: Boolean, reflect: true }) loading = false;

  private _appearance: LyraAppearance = 'outlined';
  /**
   * Visual treatment shared with other Lyra form controls -- the full five-value `LyraAppearance`
   * vocabulary, matching `<lr-select>`'s trigger (its nearest sibling, sharing `<lr-option>`
   * children). A raw attribute/property write outside this set, including a typo, clamps to the
   * `'outlined'` default rather than silently rendering unstyled.
   * @default 'outlined'
   */
  @property({ converter: APPEARANCE, reflect: true })
  get appearance(): LyraAppearance {
    return this._appearance;
  }
  set appearance(next: LyraAppearance) {
    const normalized = APPEARANCE.normalizeReflected(this, 'appearance', next);
    const old = this._appearance;
    this._appearance = normalized;
    if (normalized === old) return;
    this.requestUpdate('appearance', old);
  }
  /** Preferred vertical side for the floating listbox. */
  @property({ reflect: true }) placement: LyraComboboxPlacement = 'bottom';
  /**
   * Copies the trigger's width, height, or both onto the listbox -- the same property
   * `<lr-dropdown>`/`<lr-popup>` spell. Unset (the default), the listbox sizes to its own content,
   * clamped between `--lr-size-12rem` and `--lr-size-28rem`, exactly as before. Set `sync="width"`
   * so a full-width trigger with short option labels gets a listbox that aligns to its own edges
   * instead of floating narrower in the middle -- the width clamp described above no longer
   * applies while this is set, since the anchor's own width is now the intentional bound.
   * @default undefined
   */
  @property({ reflect: true }) sync?: PlaceSync;
  private _positioningStrategy?: PlaceStrategy;
  /**
   * CSS positioning scheme the listbox is laid out with -- the property `<lr-select>`,
   * `<lr-popover>`, `<lr-dropdown>`, `<lr-tooltip>` and `<lr-color-picker>` all spell the same way.
   * `fixed` (this control's default, and what it has always rendered) positions against the
   * viewport and escapes most clipping ancestors, which is why it suits a typeahead list that
   * usually lives inside a scrollable region; `absolute` positions against the nearest containing
   * block and scrolls with it. An unsupported value resolves back to the default. Like
   * `placement`, a change takes effect the next time the listbox opens.
   *
   * This reports only the instance's own authored value (or the default). When the instance sets
   * nothing, the listbox is placed with the `--lr-positioning-strategy` cascading custom property
   * honoured ahead of that default -- see that `@cssprop`.
   *
   * No `hoist` alias, deliberately, unlike `<lr-select>`. There it is Shoelace's established
   * spelling; here it would be a boolean whose default is `true`, so the attribute could only ever
   * express the value the control already has. Use `positioning-strategy="absolute"` to opt out.
   * @default 'fixed'
   */
  @property({
    attribute: 'positioning-strategy',
    reflect: true,
    converter: POSITIONING_STRATEGY,
  })
  get positioningStrategy(): PlaceStrategy {
    return this._positioningStrategy ?? 'fixed';
  }
  set positioningStrategy(next: PlaceStrategy) {
    const normalized = POSITIONING_STRATEGY.normalize(next) ?? 'fixed';
    const old = this.positioningStrategy;
    // Recorded even when it matches the default: an author who explicitly writes the default
    // still authored a value, and the shared resolver has to tell that apart from "unset" --
    // only "unset" falls through to a cascading ancestor override.
    this._positioningStrategy = normalized;
    if (normalized !== old) this.requestUpdate('positioningStrategy', old);
  }
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-input`/`lr-select`. The
   *  Web Awesome / Shoelace spellings `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a
   *  migration is a tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Rounds the trigger row's corners to a full pill, mirroring `lr-input`'s own `pill`. It is a
   *  single override of `--lr-combobox-radius`, so a consumer setting that property directly still
   *  wins for a bespoke shape. */
  @property({ type: Boolean, reflect: true }) pill = false;
  /** Show a clear button while the combobox has something to clear on either axis: a committed
   *  selection, or visible filter text (the open listbox in single-select, any time in `multiple`
   *  mode — a closed single-select shows the selected label, not the query, so a stale query alone
   *  never surfaces the button). Clearing a selection emits `input`/`change`/`lr-clear`; clearing
   *  filter text emits `lr-filter` with an empty `value`; each fires only for the axis that
   *  actually changed. Named after Shoelace's `clearable`; Web Awesome spells the same idea
   *  `with-clear`, which is accepted as an alias so either migration keeps working. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** Web Awesome's spelling of {@link clearable}, accepted so a mechanical `wa-` → `lr-` rename
   *  does not silently drop the clear button. Prefer `clearable` in new code. */
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  /** SSR slot-presence hint for label content. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR slot-presence hint for hint content. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  /** Custom selected-tag renderer in multiple mode. Returned strings stay text, never markup. */
  @property({ attribute: false }) getTag?: LyraComboboxTagRenderer;
  /** Additional JavaScript validators run after the intrinsic `required` constraint — the same
   * contract `lr-date-input` implements. Accepts a function, an object with
   * `validate(value, input)`, or the mapped object-validator shape with `checkValidity(input)` and
   * `{ isValid, message, invalidKeys }` results. Object validators can list host
   * `observedAttributes` that should trigger live revalidation. */
  @property({ attribute: false }) validators: LyraComboboxValidator[] = [];
  /** Native editing-assistance attributes forwarded to the wrapped input. */
  @property() autocomplete = 'off';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Native spellchecking forwarded to the filter input. Attribute removal restores this
   * component's declared `false` default instead of the converter's native-HTML `true` fallback. */
  @property({ converter: comboboxSpellcheckConverter, useDefault: true })
  override spellcheck = false;
  @property() override autocapitalize = '';
  private autocorrectValue = true;
  /** Optional no-match copy override. Omission localizes `noMatches`; a supplied string, including
   * `"No matches"` or `""`, renders verbatim. */
  @property({ attribute: 'empty-text' }) emptyText?: string;
  /** Optional loading-copy override. Omission localizes `loading`; a supplied string, including
   * `"Loading…"` or `""`, renders verbatim. Shown both in the listbox's own loading row and, for a
   * committed value a `source` fetch has never resolved (see `labelFor()`), in place of the raw
   * value on the trigger/tags -- the same key covers both spots. */
  @property({ attribute: 'loading-text' }) loadingText?: string;
  /** Optional capped-list copy override. Omission localizes `comboboxOverflow`; a supplied string,
   * including the built-in English template or `""`, wins verbatim after `{n}` interpolation. */
  @property({ attribute: 'overflow-text' }) overflowText?: string;
  @property({ attribute: false }) filter: OptionFilter | null = null;
  /** Optional bounded async row source. Receives `{ signal, limit: 2000 }`; may return a legacy
   * readonly row array or `{ rows, total? }`. Results are clone-normalized under row/text ceilings. */
  @property({ attribute: false }) source: ComboboxSource | null = null;

  /** Web Awesome's boolean `autocorrect` IDL; its HTML attribute uses `on`/`off`. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean) {
    this.autocorrectValue = Boolean(next);
    // Attribute presence controls whether the native hint is omitted, so removing an `on`
    // attribute must render even though the normalized boolean remains `true`.
    this.requestUpdate();
  }
  /** Lowercase mapped IDL aliases for the remaining camel-case native spellings. */
  get inputmode(): string {
    return this.inputMode;
  }
  set inputmode(next: string) {
    this.inputMode = next ?? '';
  }
  get enterkeyhint(): string {
    return this.enterKeyHint;
  }
  set enterkeyhint(next: string) {
    this.enterKeyHint = next ?? '';
  }

  /** Live text in the native filter input. Programmatic writes are event-silent.
   * @default '' */
  get inputValue(): string {
    return this.query;
  }
  set inputValue(next: string) {
    this.explicitInputValue = true;
    this.query = next ?? '';
    this.activeIndex = -1;
    if (this.source) this.runSource(this.query);
    this.requestUpdate();
  }

  // The in-progress filter text. Public read access is the `lr-filter` event
  // rather than a property, so consumers never have to reach into the shadow
  // input for it. Exactly two writers are user-driven and therefore emit:
  // `onInput()` (typing) and `clear()` (the clear button, but only when the
  // query it blanks was actually non-empty). Every other assignment below --
  // `setRangeText()` (a programmatic editing API; native
  // `<input>.setRangeText()` likewise fires no `input` event),
  // `formResetCallback()`, `hide()`, and `pickRow()`'s two commit resets -- is
  // the component blanking its own filter, never the user driving it, so none
  // of them emit.
  @state() private query = '';
  /** Public `inputValue` and `setRangeText()` writes remain visible while closed; stale user filter
   * text left behind by a direct `open = false` write does not. */
  private explicitInputValue = false;
  @state() private activeIndex = -1;
  @state() private options: LyraOption[] = [];
  // Set on the combobox input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  // Bumped whenever validity is recomputed outside a property write (an observed-attribute change
  // seen by a `validators` entry), so `updated()`'s `data-invalid` reflection re-runs for it.
  @state() private validityRevision = 0;
  private validatorAttributeObserver?: {
    observer: MutationObserver;
    owner: Window;
  };
  // Applies to `form-control-label` too: leaving that box visible would orphan its required
  // asterisk. The default option slot keeps its identity-aware collection handler below.
  private readonly slotPresence = new SlotPresenceController(this);
  /** True while a `source` fetch is actively in flight. Distinct from the public {@link loading}
   *  property, which a consumer sets directly; combined with it wherever a loading state is read. */
  @state() private sourceLoading = false;
  /**
   * True while the last `source` call rejected and the popup shows the retry state instead of rows.
   *
   * The popup swaps `role="listbox"` for `role="dialog"` (and the input gains the matching
   * `aria-haspopup="dialog"`) for exactly that span, because the failure state's retry `button` is
   * not a valid listbox child -- axe's `aria-required-children` fails outright on it. `dialog` is
   * one of the four popup roles WAI-ARIA allows a `role="combobox"` to own, so the still-expanded
   * `aria-controls` target keeps a valid owner; `role="presentation"` would leave the expanded
   * popup with none. `aria-activedescendant` is dropped over the same span: no option row renders
   * while the failure state is the only content, so any retained active index would be a dangling
   * idref.
   */
  @state() private sourceFailed = false;
  /**
   * True once a `source` call has settled at least once (success or rejection) since the last
   * time `source` itself was assigned. Distinguishes "not yet known" (this stays `false`, from
   * mount through the debounce delay and the in-flight call) from "genuinely unknown" (a real
   * settle happened and the value still matched nothing) -- see `isUnknownValue()` and
   * `labelFor()`, which both key off it instead of the narrower `loading` flag so the raw value
   * never leaks, badged or not, before the first real answer comes back.
   */
  @state() private sourceEverSettled = false;
  @state() private asyncRows: ComboboxSourceRow[] = [];
  private _sourceTotal = 0;
  private _sourceTruncated = false;
  private sourceErrorAnnouncementSink?: AnnouncementSink;
  @query('[part="combobox-input"]') private inputEl?: HTMLInputElement;
  // The default (unnamed) slot carrying `<lr-option>` children -- read once from `firstUpdated()`
  // in addition to its own `@slotchange` listener; see `collectInitialSlotAssignment`'s doc.
  @query('slot:not([name])') private optionsSlot?: HTMLSlotElement;
  /** The debounced `source()` call. Scheduled on -- and cancelled through -- the realm this
   *  combobox lives in at the time, so a combobox adopted into another document neither leaves a
   *  task behind on the old realm nor loses the ability to cancel the new one. */
  private readonly sourceDebounce = new DebounceController<ComboboxSourceRequest>(
    0,
    (request) => this.runSourceRequest(request),
    () => this.ownerDocument.defaultView,
  );
  private sourceToken = 0;
  /** A `refresh()` asked for while the listbox was closed. Held rather than run, because a closed
   *  combobox deliberately does not fetch -- the same convention that already governs the
   *  open-driven first query -- and replayed on the next open. */
  private refreshQueued = false;
  /** Aborted when a newer query supersedes the in-flight one, or on disconnect, so the source's
   *  own `fetch` can cancel. */
  private sourceAbort?: AbortController;
  // Guards the proactive `asyncRows` warm-up in `willUpdate()` below so it
  // fires at most once per mount instead of re-running (and endlessly
  // resetting the debounce timer) on every subsequent render while the fetch
  // is still in flight.
  private _sourceWarmed = false;
  private _selectedLabelCache = new Map<string, string>();
  private _selectedRowCache = new Map<string, ComboboxSourceRow>();
  /** A structured selection assigned before local options or async rows became available. */
  private pendingSelectedRowValues?: string[];
  // Rebuilt once per render (in render(), before renderRows()) from the
  // currently-visible row set -- backs the delegated listbox click/mousedown
  // handlers' data-value lookup below, instead of each option row closing
  // over its own row object.
  private _rowsByValue = new Map<string, ComboboxSourceRow>();

  private internals: ElementInternals;
  private _open = false;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  // Tracked separately from the consumer's own `disabled` -- a native
  // `<input>`'s own `disabled` IDL property/attribute is never mutated by
  // fieldset cascading, so a consumer's explicit `disabled` must survive the
  // fieldset re-enabling (see `formDisabledCallback` below).
  private _fieldsetDisabled = false;
  private listId = nextId('combobox-list');
  private inputId = nextId('combobox-input');
  private cleanup?: () => void;
  @state() private listboxPositioned = false;
  private positioningGeneration = 0;
  private positioningReady: Promise<boolean> = Promise.resolve(false);
  private resolvePositioningReady?: (positioned: boolean) => void;
  private overlayHandle?: OverlayHandle;
  private restoreFocusOnClose = true;
  private restoringOverlayFocus = false;
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  @state() private listboxHidden = true;

  private _isFirstUpdate = true;
  private openVetoed = false;
  /** Set only by `hide()`. Cleanup is applied in `willUpdate()` after `lr-hide` accepts the close,
   * so a veto remains an atomic no-op for the query, active row, and async result set. */
  private closeCleanupPending = false;
  private transitionToken = 0;
  private transitionWaiters = new Map<
    'lr-after-show' | 'lr-after-hide',
    Set<() => void>
  >();
  private _selected: string[] = [];
  private singleSelectedOption?: LyraOption;
  private readonly sourceOptionsByRow = new WeakMap<ComboboxSourceRow, LyraOption>();
  private _valueDirty = false;
  private _multiple = false;
  private _disabled = false;
  private _required = false;
  private _readonly = false;
  // What `form.reset()` restores to. Captured exactly once, from whatever
  // `<lr-option selected>` markup was present the first time slotted
  // options are collected (mirrors native `<select><option selected>`) —
  // never from the `value` setter, so a user picking an option (even the
  // very first pick on an initially-unselected combobox) can't itself
  // become the reset default (native `defaultValue`/`defaultSelected`
  // semantics: only declarative/attribute state feeds the default, plain
  // property assignment never does).
  private _defaultSelected: string[] = [];
  private _defaultCaptured = false;
  // A restored value must win over declarative selected markup collected by
  // the first asynchronous slotchange. Cleared by the next ordinary value write.
  private _restoredStateActive = false;

  // Hand-written accessor (mirrors the `value` accessor below, and the
  // `FormAssociated.name` in `../../internal/form-associated.ts`): a
  // form-associated custom element's submitted entry name is resolved by the
  // browser from the live `name` *content attribute*, read synchronously at
  // FormData-construction/submit time (see `syncFormValue()` below) -- Lit's
  // async (microtask-deferred) `reflect: true` alone would leave a
  // property-only assignment like `el.name = 'b'` invisible to a same-tick
  // `new FormData(form)`/submit, so the attribute write happens here instead.
  private _name = '';
  private validationTargetOverride?: HTMLElement;
  // `noAccessor` hand-rolled accessors (mirrors `name`/`multiple`/etc. above): these feed
  // virtualization/render-limiting logic (`shownTags.slice`, `renderedRows`'s cap) directly, so a
  // NaN/negative value must never reach it -- sanitized synchronously here via `finiteCount`
  // rather than left for Lit's default async field setter to hand through unchecked.
  /**
   * Bounds the popup to roughly this many option rows, leaving the rest reachable by scrolling.
   *
   * This is the third and last of three similarly-named caps, which is exactly the confusion this
   * property exists to end -- each does something different:
   * - `visibleOptions` (this one) caps how many suggestion rows are **visible** at once. Purely
   *   presentational: every row is still rendered and still reachable by scrolling.
   * - `maxOptionsVisible` caps how many **selected tags** are shown in multi-select before the
   *   "+N" summary. Nothing to do with the suggestion list.
   * - `maxRender` caps how many suggestion rows are **rendered into the DOM at all**, as a
   *   performance ceiling; rows past it do not exist and are summarized by `option-overflow`.
   *
   * Unset imposes no bound of its own, leaving the listbox's existing max-height behavior exactly
   * as it was. Zero, negative, and non-finite values normalize to unset rather than collapsing the
   * popup.
   */
  @property({ type: Number, attribute: 'visible-options' }) visibleOptions?: number;

  private _maxOptionsVisible = 3;
  private _maxRender = 200;
  private _sourceDelay = 200;

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(
      this,
      this.internals,
      () => this[VALIDITY_ANCHOR]()
    );
    installCustomErrorProperty(
      this,
      () => this.validityController.customValidityMessage
    );
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init)
    );
    // Interactive validation (a submission attempt, `reportValidity()`) is interaction, exactly
    // like blurring or committing a selection; `checkValidity()`'s own call below runs inside
    // `withStaticValidityCheck()` so this listener can tell the silent query apart from every
    // other path that raises the same `invalid` event.
    installInteractionOnInvalid(this, this.markInteracted);
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  /** Returns the owning form, including an external owner selected by the `form` attribute. */
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  /** Native element used as the constraint-validation focus anchor. */
  get validationTarget(): HTMLElement | undefined {
    return this.validationTargetOverride ?? this.inputEl ?? undefined;
  }
  set validationTarget(next: HTMLElement | undefined) {
    this.validationTargetOverride = next ?? undefined;
    this.validityController.refreshAnchor();
  }

  /** Clears consumer-supplied validity and restores the current intrinsic constraints. */
  resetValidity(): void {
    this.validityController.setCustomValidity('');
    this.updateValidity();
  }

  /** The internal native filter input, for direct DOM access when needed. */
  get input(): HTMLInputElement | null {
    return this.inputEl ?? null;
  }

  get selectionStart(): number | null {
    return this.inputEl?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.inputEl) this.inputEl.selectionStart = value;
  }

  get selectionEnd(): number | null {
    return this.inputEl?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.inputEl) this.inputEl.selectionEnd = value;
  }

  get selectionDirection(): LyraComboboxSelectionDirection | null {
    return this.inputEl
      ?.selectionDirection as LyraComboboxSelectionDirection | null;
  }

  set selectionDirection(value: LyraComboboxSelectionDirection | null) {
    if (this.inputEl) this.inputEl.selectionDirection = value;
  }

  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.inputEl?.focus(options);
  }

  override blur(): void {
    this.inputEl?.blur();
  }

  /** Activates the trigger the same way a real mouse click on `[part='combobox']` would --
   *  focuses the filter input and opens the listbox (mirrors `onComboMouseDown` below). Without
   *  this override, `HTMLElement.prototype.click()` on the host is a no-op: a custom element has
   *  no native click activation behavior of its own, so a generic form-submit helper, test
   *  utility, or automation script calling `.click()` on `<lr-combobox>` directly (rather than on
   *  its shadow-internal parts) would otherwise silently do nothing. */
  override click(): void {
    if (this.liveDisabled) return;
    this.inputEl?.focus();
    this.show();
  }

  select(): void {
    this.inputEl?.select();
  }

  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraComboboxSelectionDirection
  ): void {
    this.inputEl?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(
    replacement: string,
    start: number,
    end: number,
    selectMode?: SelectionMode
  ): void;
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode?: SelectionMode
  ): void {
    const input = this.inputEl;
    if (!input) return;
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    this.explicitInputValue = true;
    this.query = input.value;
    this.activeIndex = -1;
    if (this.source) this.runSource(this.query);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    return this.validationTarget;
  }

  private localDescriptionIds = '';
  private externalDescriptionLease?: NativeControlDescriptionLease;

  private syncExternalDescription(): void {
    if (!this.isConnected) return;
    const target = this.renderRoot.querySelector<HTMLElement>('[part="combobox-input"]');
    if (!target) return;
    if (this.externalDescriptionLease) this.externalDescriptionLease.update(target);
    else this.externalDescriptionLease = acquireNativeControlDescription(this, target, () => this.localDescriptionIds);
  }

  private releaseExternalDescription(): void {
    this.externalDescriptionLease?.release();
    this.externalDescriptionLease = undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncExternalDescription();
    this.syncSourceErrorAnnouncementSink();
    this.updateValidity();
    // A reconnect rebuilds the observer against the (possibly new) owning document.
    if (this.hasUpdated) this.syncValidatorAttributeObserver();
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (this.open) this.reconnectOpenPopup();
        else if (
          this.source &&
          this._selected.length &&
          this.asyncRows.length === 0
        ) {
          this.runSource('');
        }
      });
    }
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.releaseExternalDescription();
    if (this.hasUpdated) this.syncExternalDescription();
    this.listboxPositioned = false;
    this.invalidateListboxPositioning();
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.clearSourceTimer();
    this.sourceToken += 1;
    this.sourceAbort?.abort();
    this.sourceAbort = undefined;
    this.releaseSourceErrorAnnouncementSink();
    this.syncSourceErrorAnnouncementSink();
  }

  private syncSourceErrorAnnouncementSink(): void {
    if (!this.isConnected) return;
    if (
      this.sourceErrorAnnouncementSink?.element.ownerDocument ===
      this.ownerDocument
    )
      return;
    this.releaseSourceErrorAnnouncementSink();
    this.sourceErrorAnnouncementSink = acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private releaseSourceErrorAnnouncementSink(): void {
    this.sourceErrorAnnouncementSink?.release();
    this.sourceErrorAnnouncementSink = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    // `hasUpdated` flips to `true` before `updated()` even sees its first
    // call, so it can't distinguish "just mounted" from "just changed" there
    // -- capture that distinction here, while it's still reliable, for
    // `updated()`'s `open`-handling below to consult.
    this._isFirstUpdate = !this.hasUpdated;
    this.announceOpenTransition(changed);
    if (this.open) this.listboxHidden = false;
    if (changed.has('open') && !this.openVetoed) this.listboxPositioned = false;
    if (changed.has('open') && this.openVetoed) {
      this.closeCleanupPending = false;
    } else if (changed.has('open') && !this.open) {
      this.finalizeCloseState();
    }
    if (changed.has('source')) {
      this.clearSourceTimer();
      this.sourceAbort?.abort();
      this.sourceAbort = undefined;
      this.sourceToken++;
      this.sourceLoading = false;
      this.sourceFailed = false;
      this.sourceEverSettled = false;
      this.asyncRows = [];
      this._sourceTotal = 0;
      this._sourceTruncated = false;
      this.activeIndex = -1;
      this._sourceWarmed = false;
      if (this.source && this.open) this.runSource(this.query);
    }
    // In source (async) mode, `labelFor()` can only resolve a programmatically
    // -set value's label from `asyncRows` -- and nothing normally populates
    // `asyncRows` until the listbox is actually opened. Fire the fetch once,
    // independent of `open`, so the closed input / multi-select tag chips can
    // already show the real label the very first time they render (the
    // common "edit an existing record" case) instead of the raw value string.
    if (
      !this._sourceWarmed &&
      this.source &&
      (this._selected.length > 0 ||
        (this.pendingSelectedRowValues?.length ?? 0) > 0) &&
      this.asyncRows.length === 0
    ) {
      this._sourceWarmed = true;
      this.runSource('');
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed); // no-op in LyraElement/ReactiveElement today, but a future
    // mixin's firstUpdated() layered under this class must still run.
    // happy-dom (through at least 20.14.5) never fires the default slot's INITIAL `slotchange` --
    // see `collectInitialSlotAssignment`'s own doc -- so an <lr-combobox> whose <lr-option>
    // children already exist at connect (the ordinary "render once data is ready" Lit pattern)
    // would otherwise render zero options under it. Collect once here too, from the slot's current
    // assignment; `collectOptionsFromSlot()` is idempotent (identity-diffed against the previous
    // option set), so a real browser firing the initial event as well contributes no duplicate
    // selection-seeding side effect. Skipped when nothing is assigned yet: an empty result has no
    // default to seed, and capturing now would flip `_defaultCaptured` before options appended
    // later through a genuine `slotchange` get their normal first-pass handling.
    // Deferred a microtask: `options` is reactive, so writing it (and any selection it seeds)
    // synchronously inside `firstUpdated()` -- after this same update has already been marked
    // complete -- trips Lit's "scheduled an update after an update completed" dev warning. A real
    // `slotchange` event runs this same collection from a task/microtask entirely outside the
    // update cycle, which never trips it; queuing a microtask here reproduces that same
    // "outside the cycle" timing instead of writing `options` from inside it. Still guaranteed to
    // land before any caller's own `await el.updateComplete` continuation: that continuation is
    // queued only once this update's promise resolves, later in this same synchronous turn, so it
    // always joins the microtask queue behind the one queued here.
    const slot = this.optionsSlot;
    queueMicrotask(() => {
      collectInitialSlotAssignment(slot, (s) => {
        if (s.assignedElements({ flatten: true }).some(isLyraOptionElement)) {
          this.collectOptionsFromSlot(s);
        }
      });
    });
  }

  /** Submitted field name.
   * @default '' */
  get name(): string {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) {
      this.setAttribute('name', this._name);
    } else {
      this.removeAttribute('name');
    }
    this.syncFormValue();
    this.requestUpdate('name', old);
  }

  /** Enables multiple selection.
   * @default false */
  get multiple(): boolean {
    return this._multiple;
  }
  set multiple(next: boolean) {
    const old = this._multiple;
    this._multiple = Boolean(next);
    this.toggleAttribute('multiple', this._multiple);
    this.reflectSelected();
    this.syncFormValue();
    this.requestUpdate('multiple', old);
  }

  /** Disables every interactive sub-control.
   * @default false */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.hide();
    // Disabling bars constraint validation, so the violation itself is recomputed here -- not just
    // the states republished.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** Requires at least one committed selection.
   * @default false */
  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  /** Forwards native read-only behavior to the internal filter input: the committed value stays
   *  fixed and still submits with the form, the control remains focusable, selectable and
   *  copyable, but no popup opens and no edit -- typed, picked, or a tag/clear-button removal --
   *  can change it. Mirrors `<lr-input>`'s own `readonly`; bars constraint validation exactly like
   *  `disabled` -- see `isBarredFromValidation()`.
   * @default false */
  get readonly(): boolean {
    return this._readonly;
  }
  set readonly(next: boolean) {
    const old = this._readonly;
    this._readonly = Boolean(next);
    this.toggleAttribute('readonly', this._readonly);
    if (this._readonly) this.hide();
    this.updateValidity();
    this.requestUpdate('readonly', old);
  }

  /** The selected value(s): a string in single mode, a string[] in `multiple` mode.
   *
   *  Assigning `undefined` or `null` clears the selection -- the documented "unset" contract.
   *  Every string, including `''`, is instead a candidate value: `<lr-option value="">` (or a
   *  matching async row) is a legitimate row, and assigning `''` selects it when present,
   *  mirroring what picking that row already did. A `''`/string assignment that matches nothing
   *  still commits, exactly like any other unmatched string -- see `isUnknownValue()`.
   *
   *  `LyraPickerValue<Multiple>` narrows to `string` on a `LyraCombobox<false>` and `string[]` on a
   *  `LyraCombobox<true>`; the unnarrowed default resolves to the published union below, which is
   *  why the manifest type is pinned here rather than left to the inferred alias name.
   *  @type {string | string[]} */
  get value(): LyraPickerValue<Multiple> {
    return (
      this.multiple ? [...this._selected] : this._selected[0] ?? ''
    ) as LyraPickerValue<Multiple>;
  }
  set value(next: LyraPickerValue<Multiple> | null | undefined) {
    this.setValue(next, true);
  }

  private setValue(next: string | string[] | null | undefined, dirty: boolean, preferred?: LyraOption): void {
    const old = this._selected;
    this.singleSelectedOption = preferred;
    if (dirty) {
      this._restoredStateActive = false;
      this._valueDirty = true;
    }
    this._selected = normalizeSelectionValues(next);
    const selected = new Set(this._selected);
    for (const value of selected) {
      const row =
        this.effectiveRows.find((candidate) => candidate.value === value) ??
        this.asyncRows.find((candidate) => candidate.value === value);
      if (row) this._selectedRowCache.set(value, row);
    }
    for (const value of this._selectedRowCache.keys()) {
      if (!selected.has(value)) this._selectedRowCache.delete(value);
    }
    // `_selectedLabelCache` gets the identical treatment -- otherwise it
    // grows by one permanent entry per distinct value ever selected over the
    // element's lifetime, unlike `_selectedRowCache` above which is already
    // pruned back to the live selection on every write.
    for (const value of this._selectedLabelCache.keys()) {
      if (!selected.has(value)) this._selectedLabelCache.delete(value);
    }
    this.syncFormValue();
    this.reflectSelected();
    this.updateValidity();
    this.requestUpdate('value', old);
  }

  /** Maximum number of selected-value **tags** shown before the rest collapse behind a "+N" tag
   *  (multi-select only). Sanitized to a finite, non-negative integer.
   *
   *  Not to be confused with the two caps on the suggestion list: `visibleOptions` bounds how many
   *  suggestion rows are visible at once, and `maxRender` bounds how many are rendered at all.
   *  This one only ever concerns the tags for values already chosen.
   * @default 3 */
  get maxOptionsVisible(): number {
    return this._maxOptionsVisible;
  }
  set maxOptionsVisible(next: number) {
    const old = this._maxOptionsVisible;
    this._maxOptionsVisible = finiteCount(next, 3);
    this.requestUpdate('maxOptionsVisible', old);
  }

  /** Maximum number of suggestion rows **rendered into the DOM at all** before the rest collapse
   *  behind the overflow indicator (the current selection is always kept visible regardless). This
   *  is a performance ceiling, not a visible-height affordance: rows past it do not exist and
   *  cannot be scrolled to. Use `visibleOptions` to bound the popup's height while keeping every
   *  row reachable, and `maxOptionsVisible` for the selected-tag cap. Sanitized to a finite,
   *  non-negative integer capped at 1,000.
   *
   *  Rows render in full rather than as a recycled scroll window, because the filter input's
   *  `aria-activedescendant` is an IDREF and can only resolve within its own tree scope — rows
   *  hosted inside a nested windowing element would sit one shadow root deeper than the input
   *  that must point at them. Raising this to cover a few-hundred-entry list (countries,
   *  currencies, time zones) is the intended use; past roughly a thousand rows, `source` narrows
   *  the set before it becomes DOM and is the better tool. */
  get maxRender(): number {
    return this._maxRender;
  }
  /** Debounce (ms) between the last keystroke and the `source` call. Sanitized to a finite
   *  duration clamped to `[0, browser-timer-ceiling]`; `0` fires on every keystroke, a
   *  non-finite value falls back to the `200` default. */
  get sourceDelay(): number {
    return this._sourceDelay;
  }
  set sourceDelay(next: number) {
    const old = this._sourceDelay;
    this._sourceDelay = finiteDuration(next, 200);
    this.requestUpdate('sourceDelay', old);
  }

  set maxRender(next: number) {
    const old = this._maxRender;
    this._maxRender = Math.min(finiteCount(next, 200), MAX_RENDER_ROWS);
    this.requestUpdate('maxRender', old);
  }

  /** Provider-side match count for the latest accepted source response, before component caps. */
  get sourceTotal(): number {
    return this._sourceTotal;
  }

  /** Whether the latest response contained or reported more rows than the bounded retained set. */
  get sourceTruncated(): boolean {
    return this._sourceTruncated;
  }

  /** Structured rows corresponding to the current selection, including opaque async-row data.
   * Assigning rows from the current local or async source maps their stable `value` fields back to
   * controlled selection. Detached values are ignored, duplicates collapse, single mode keeps the
   * first row, and the write is silent like `value`. A property binding that arrives before local
   * options or async rows is deferred until that source resolves. Read rows remain detached
   * snapshots. */
  get selectedRows(): ComboboxSourceRow[] {
    return this.resolveSelectedRowSlots()
      .filter((row): row is ComboboxSourceRow => row != null)
      .map((row) => ({ ...row }));
  }

  /** Same lookup as `selectedRows`, but keeps one slot per `_selected` entry -- `undefined` where
   *  nothing resolves -- so a caller needing index alignment with `value` (the `data` field of
   *  `input`/`change`/`lr-change`'s detail) never has to guess which value a dropped row
   *  belonged to. */
  private resolveSelectedRowSlots(): Array<ComboboxSourceRow | undefined> {
    return this._selected.map(
      (value) =>
        this._selectedRowCache.get(value) ??
        this.effectiveRows.find((row) => row.value === value) ??
        this.asyncRows.find((row) => row.value === value)
    );
  }

  set selectedRows(next: readonly ComboboxSourceRow[]) {
    const values: string[] = [];
    const seen = new Set<string>();
    if (Array.isArray(next)) {
      for (const candidate of next) {
        let value: unknown;
        try {
          value = candidate?.value;
        } catch {
          continue;
        }
        if (typeof value !== 'string' || seen.has(value)) continue;
        seen.add(value);
        values.push(value);
      }
    }
    if (values.length > 0 && this.selectionSourceRows.length === 0) {
      this.pendingSelectedRowValues = values;
      if (this.source && this.isConnected) {
        this._sourceWarmed = true;
        this.runSource('');
      }
      return;
    }
    this.pendingSelectedRowValues = undefined;
    this.applySelectedRowValues(values);
  }

  /** Shared with every other form control: disabled (own or fieldset-cascaded) bars validation. */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  /** Runs `validators` in order and returns the first failure. Mirrors `lr-date-input`'s reading of
   *  the same contract: a thrown validator fails closed with the generic localized message rather
   *  than escaping into the caller that happened to write `value`. */
  private validatorResult(): { flags?: ValidityStateFlags; message?: string } {
    // Validators are declared against the un-narrowed class (`LyraFormValidator<LyraCombobox>`),
    // which `this` is not assignable to while `Multiple` is an unresolved type parameter. Resolved
    // once here rather than cast at each of the call sites below.
    const self = this as unknown as LyraCombobox<boolean>;
    const current = self.value;
    for (const validator of Array.isArray(this.validators)
      ? this.validators
      : []) {
      let result: LyraComboboxValidatorResult;
      try {
        if (
          typeof validator === 'object' &&
          validator !== null &&
          'checkValidity' in validator
        ) {
          const checked = validator.checkValidity(this as never);
          if (checked?.isValid === true) continue;
          const flags: ValidityStateFlags = {};
          for (const key of Array.isArray(checked?.invalidKeys)
            ? checked.invalidKeys
            : []) {
            if (isValidityFlagKey(key)) flags[key] = true;
          }
          if (!Object.values(flags).some(Boolean)) flags.customError = true;
          let message =
            typeof checked?.message === 'string' ? checked.message : '';
          if (!message && typeof validator.message === 'string')
            message = validator.message;
          if (!message && typeof validator.message === 'function') {
            message = validator.message(this as never);
          }
          return { flags, message: message || this.localize('valueInvalid') };
        }
        result =
          typeof validator === 'function'
            ? validator(current, self)
            : validator?.validate(current, self);
      } catch {
        return {
          flags: { customError: true },
          message: this.localize('valueInvalid'),
        };
      }
      if (result === undefined || result === true) continue;
      if (typeof result === 'string')
        return { flags: { customError: true }, message: result };
      if (result === false)
        return {
          flags: { customError: true },
          message: this.localize('valueInvalid'),
        };
      if (
        result &&
        typeof result === 'object' &&
        Object.values(result).some(Boolean)
      ) {
        return { flags: result, message: this.localize('valueInvalid') };
      }
    }
    return {};
  }

  /** Watches the host attributes any object validator listed in `observedAttributes`, so changing
   *  one revalidates live. Bound to the owning window so a re-parent into another document (or a
   *  disconnect) can never leave the previous document's observer firing into this host. */
  private syncValidatorAttributeObserver(): void {
    this.disconnectValidatorAttributeObserver();
    const owner = this.ownerDocument.defaultView;
    const MutationObserverCtor = owner?.MutationObserver;
    if (
      !this.isConnected ||
      !owner ||
      typeof MutationObserverCtor !== 'function'
    )
      return;

    const attributes = new Set<string>();
    for (const validator of Array.isArray(this.validators)
      ? this.validators
      : []) {
      if (
        typeof validator !== 'object' ||
        validator === null ||
        !('checkValidity' in validator)
      )
        continue;
      let observed: unknown;
      try {
        observed = validator.observedAttributes;
      } catch {
        continue;
      }
      if (!Array.isArray(observed)) continue;
      for (const name of observed) {
        if (typeof name === 'string' && name.length > 0) attributes.add(name);
      }
    }
    if (attributes.size === 0) return;

    const binding = {} as { observer: MutationObserver; owner: Window };
    const observer = new MutationObserverCtor(() => {
      if (
        this.validatorAttributeObserver !== binding ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== owner
      )
        return;
      this.updateValidity();
      this.validityRevision++;
    });
    binding.observer = observer;
    binding.owner = owner;
    try {
      observer.observe(this, {
        attributes: true,
        attributeFilter: [...attributes],
      });
      this.validatorAttributeObserver = binding;
    } catch {
      observer.disconnect();
    }
  }

  private disconnectValidatorAttributeObserver(): void {
    const binding = this.validatorAttributeObserver;
    this.validatorAttributeObserver = undefined;
    binding?.observer.disconnect();
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      // A barred control reports no violation at all, exactly like a native disabled `<select>` --
      // leaving `valueMissing` raised is what leaked `:state(invalid)` onto disabled required
      // comboboxes, and with it the documented `:state(user-invalid)` error styling. Configured
      // validators are barred with it, exactly as the intrinsic constraint is.
      this.validityController.setValidity({});
      this.syncCustomStates();
      return;
    }
    const flags: ValidityStateFlags = {};
    let message = '';
    if (this.required && this._selected.length === 0) {
      flags.valueMissing = true;
      message = this.localize('comboboxRequired');
    }
    const configured = this.validatorResult();
    if (configured.flags) Object.assign(flags, configured.flags);
    if (configured.message) message = configured.message;
    this.validityController.setValidity(flags, message);
    this.syncCustomStates();
  }

  /**
   * Publishes the six validity custom states (`:state(required)`/`optional`, `valid`/`invalid`,
   * `user-valid`/`user-invalid`). The implementation is shared with every other form-associated
   * control in the library — see `internal/custom-states.ts`; this component drives
   * `ElementInternals` directly rather than through the `FormAssociated` mixin (its value is a
   * `string[]` in `multiple` mode, which that string-value mixin cannot carry), so it calls the
   * helper itself. `touched` is this component's own interaction flag, already set by the filter
   * input's blur, so the `user-*` pair stays off a pristine control the way native
   * `:user-invalid` does.
   */
  private syncCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.barredFromValidation,
    });
    setCustomState(this.internals, 'blank', this._selected.length === 0);
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
  }

  private syncFormValue(): void {
    const state = JSON.stringify(this._selected);
    if (this.multiple) {
      // A FormData form value submits under the keys baked into the FormData
      // itself, bypassing the element's own `name` the way a plain string
      // value would use it -- so an unnamed multi-select must contribute
      // nothing (matching a nameless native `<select multiple>`) rather than
      // inventing a shared key that would merge with any other unnamed
      // combobox in the same form.
      if (!this.name) {
        this.internals.setFormValue(null, state);
        return;
      }
      const fd = new FormData();
      for (const v of this._selected) fd.append(this.name, v);
      this.internals.setFormValue(fd, state);
    } else {
      this.internals.setFormValue(this._selected[0] ?? '', state);
    }
  }

  /** Effective disabled state: this element's own `disabled` OR an ancestor
   *  `<fieldset disabled>`'s inherited state -- mirrors native `<input>`, whose
   *  own `disabled` IDL property/attribute is never mutated by a fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  formResetCallback(): void {
    // A reset form is pristine again, so the `user-*` states stop matching even though a required
    // combobox is immediately invalid once more. The `value` write below re-runs updateValidity()
    // (and therefore syncCustomStates()) with this flag already cleared.
    this.touched = false;
    this._restoredStateActive = false;
    this._valueDirty = false;
    const resetValues =
      this._defaultSelected.length > 0
        ? this._defaultSelected
        : this.options
            .filter((option) => wasOptionInitiallySelected(option))
            .map((option) => option.value);
    if (this._defaultSelected.length === 0 && resetValues.length > 0)
      this._defaultSelected = [...resetValues];
    const defaults = new Set(resetValues);
    for (const option of this.options) {
      option[RESET_OPTION_SELECTED_FROM_OWNER](defaults.has(option.value));
    }
    // `.slice(0, 1)` -- not `resetValues[0] ?? ''` -- so an empty reset target stays an empty
    // array rather than the sentinel `''`, which setValue()/normalizeSelectionValues() now treats
    // as a real candidate value rather than "clear".
    this.setValue(
      this.multiple ? [...resetValues] : resetValues.slice(0, 1),
      false
    );
    this.query = '';
    this.explicitInputValue = false;
  }
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    let selected: string[] = [];
    if (typeof state === 'string') {
      try {
        const parsed: unknown = JSON.parse(state);
        if (
          Array.isArray(parsed) &&
          parsed.every((value) => typeof value === 'string')
        )
          selected = parsed;
      } catch {
        // Malformed persisted state restores an empty selection.
      }
    }
    // `.slice(0, 1)` -- not `selected[0] ?? ''` -- so "nothing was ever submitted" stays an empty
    // array (clear) rather than the sentinel `''`, which is now a real candidate value.
    this.assignValue(this.multiple ? selected : selected.slice(0, 1));
    this._restoredStateActive = true;
  }
  /**
   * Called by the browser when an ancestor `<fieldset disabled>` toggles.
   * Tracked separately from the consumer's own `disabled` (see
   * `effectiveDisabled`) so a consumer's explicit `disabled` survives the
   * fieldset re-enabling instead of being permanently overwritten.
   */
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.hide();
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.updateValidity();
    this.requestUpdate();
  }
  private markInteracted = (): void => {
    if (this.touched) return;
    this.touched = true;
    this.updateValidity();
    this.syncCustomStates();
  };
  checkValidity(): boolean {
    // Recomputed at call time, like a native control: `validators` is a plain JS array whose
    // entries can start failing without any property on this host changing, so a check that read
    // only the last published state would answer from a stale snapshot.
    this.updateValidity();
    // Silent query: must never mark a pristine control as interacted, however invalid it already
    // is. `withStaticValidityCheck()` tells the `installInteractionOnInvalid()` listener above
    // that whatever `invalid` event fires synchronously inside this call is this call, not a
    // submission attempt.
    return withStaticValidityCheck(this, () => this.internals.checkValidity());
  }
  reportValidity(): boolean {
    // Reporting is what a submit attempt does, and a failed submit is precisely when native
    // `:user-invalid` starts matching — so it counts as interaction, exactly as it does in the
    // `FormAssociated` mixin. (A submission attempt itself never calls this method -- it drives
    // `ElementInternals` directly -- which is what `installInteractionOnInvalid()` above covers.)
    this.touched = true;
    this.updateValidity();
    this.syncCustomStates();
    return this.internals.reportValidity();
  }

  /**
   * Sets or clears a consumer-supplied validation error — the standard channel for a rejection no
   * client-side constraint can express ("that option is no longer available"). A non-empty
   * `message` raises `customError` and becomes `validationMessage`, so the control fails
   * `checkValidity()`, blocks submission, and matches `:state(invalid)`; `''` clears it.
   *
   * Clearing restores the control's own computed validity rather than forcing it valid: a
   * `required` combobox with nothing chosen stays `valueMissing`. The custom error also survives
   * every intrinsic recomputation in between (each selection/`required` change re-runs
   * `updateValidity()`) and a `form.reset()` — matching a native control, where only another
   * `setCustomValidity('')` clears it.
   *
   * The message is caller-supplied content, so it is used verbatim and never localized here.
   */
  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.syncCustomStates();
  }

  override disconnectedCallback(): void {
    this.listboxHidden = true;
    this.releaseExternalDescription();
    this.transitionToken++;
    this.listboxPositioned = false;
    this.releaseSourceErrorAnnouncementSink();
    this.disconnectValidatorAttributeObserver();
    super.disconnectedCallback();
    this.invalidateListboxPositioning();
    this.clearSourceTimer();
    this.sourceToken += 1;
    // Cancel any in-flight source request so its fetch is aborted on disconnect.
    this.sourceAbort?.abort();
    this.sourceAbort = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.resolveTransitionWaiters('lr-after-show');
    this.resolveTransitionWaiters('lr-after-hide');
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // `true` across the disconnect/reconnect and `changed.has('open')` never
    // fires again, leaving the listbox rendered open with no positioning and
    // no outside-click listener.
    this.open = false;
  }

  private collectOptions = (e: Event): void => {
    this.collectOptionsFromSlot(e.target as HTMLSlotElement);
  };

  /**
   * Reads the default slot's currently assigned `<lr-option>` elements and applies them --
   * wired as the `slotchange` handler (via `collectOptions`) for every later mutation, and called
   * once more from `firstUpdated()` (see `collectInitialSlotAssignment`) to cover an environment,
   * or a real-browser timing race, where the slot's initial assignment never fires `slotchange`.
   * Idempotent over an unchanged assigned-element set: `previous` below is an identity set of the
   * options already applied, so a second call that reads back the same elements finds nothing new
   * to seed and falls through to the harmless `reflectSelected()` re-sync at the end.
   */
  private collectOptionsFromSlot(slot: HTMLSlotElement): void {
    const previous = new Set(this.options);
    this.options = slot
      .assignedElements({ flatten: true })
      .filter(isLyraOptionElement);
    // The option set (or an option's own adornment children) may have changed wholesale; re-clone
    // lazily on the next render rather than serving a stale adornment.
    this.adornmentClones = new WeakMap();
    this.normalizeActiveIndex();
    this.applyPendingSelectedRows();
    if (!this._defaultCaptured) {
      this._defaultCaptured = true;
      // Seed the initial selection — and the reset default — from
      // declarative `<lr-option selected>` markup — mirrors native
      // `<select><option selected>`, which was previously silently ignored.
      // This is the only place `_defaultSelected` is set; picking an option
      // later (the `value` setter) never redefines the reset default, so an
      // initially-unselected combobox always resets back to empty even
      // after the user has picked something.
      const allDefaults = this.options
        .filter((option) => option.defaultSelected)
        .map((option) => option.value);
      const allLive = this.options
        .filter((option) => option.selected)
        .map((option) => option.value);
      const defaults = this.multiple ? allDefaults : allDefaults.slice(0, 1);
      const live = this.multiple ? allLive : allLive.slice(0, 1);
      const initialLive = this.options
        .filter((option) => wasOptionInitiallySelected(option))
        .map((option) => option.value);
      const optionDirty = this.options.some((option) =>
        isOptionSelectedDirty(option)
      );
      const dirtySelected = this.options.filter(
        (option) => isOptionSelectedDirty(option) && option.selected
      );
      const dirtyValues = dirtySelected.map((option) => option.value);
      this._defaultSelected = [
        ...(defaults.length > 0
          ? defaults
          : initialLive.length > 0
          ? initialLive
          : live),
      ];
      const fromDefaults = defaults.length > 0;
      const initial = optionDirty
        ? this.multiple
          ? allLive
          : dirtyValues.slice(-1)[0]
          ? dirtyValues.slice(-1)
          : live
        : fromDefaults
        ? defaults
        : live;
      if (initial.length && !this._restoredStateActive && !this._valueDirty) {
        // safe: initial.length is truthy, so initial[0] exists.
        const next = this.multiple ? initial : initial[0]!;
        if (fromDefaults && !optionDirty) this.setValue(next, false);
        else this.assignValue(next);
        return; // The selection write already called reflectSelected().
      }
      if (optionDirty) this._valueDirty = true;
    } else {
      // Options slotted in after the first pass (e.g. a lazily-populated
      // list appended post-connect) still declare selection the same way a
      // native `<select><option selected>` would -- seed newly-arrived ones
      // into the live selection instead of letting reflectSelected() below
      // strip their `selected` attribute back off.
      const newDefaults = this.options.filter(
        (option) => !previous.has(option) && option.defaultSelected
      );
      const newLive = this.options.filter(
        (option) =>
          !previous.has(option) && option.selected && !option.defaultSelected
      );
      this.refreshOptionDefaults();
      const eligible = [
        ...(!this._restoredStateActive && !this._valueDirty ? newDefaults : []),
        ...(!this._restoredStateActive ? newLive : []),
      ];
      if (eligible.length) {
        const values = eligible.map((option) => option.value);
        const next = this.multiple
          ? [...new Set([...this._selected, ...values])]
          : // safe: eligible.length is truthy, so the last value exists.
            values[values.length - 1]!;
        if (newLive.length > 0) this.assignValue(next);
        else this.setValue(next, false);
        return; // `value=`'s setter already called reflectSelected()
      }
    }
    this.reflectSelected();
  }

  private refreshOptionDefaults(): void {
    const declared = this.options
      .filter((option) => option.defaultSelected)
      .map((option) => option.value);
    this._defaultSelected = this.multiple ? declared : declared.slice(0, 1);
    if (!this._valueDirty && !this._restoredStateActive) {
      // `_defaultSelected` is already capped to at most one entry in single mode, so spreading it
      // (rather than `this._defaultSelected[0] ?? ''`) commits an empty array -- not the sentinel
      // `''` -- when there is no default.
      this.setValue([...this._defaultSelected], false);
    }
  }

  private optionRefreshPending = false;

  private onOptionChange = (e: Event): void => {
    // The notification is sealed here rather than allowed to keep bubbling: it
    // is a private child-to-parent refresh signal, not part of this
    // component's event contract, and it carries the *option's* target/detail
    // rather than the combobox's. Left uncontained it escapes the host and
    // reaches consumer code as an undocumented, undiscoverable event; a
    // consumer who needs to know the value moved already has
    // `lr-change`/`change`/`input`. A listener bound directly to the
    // `<lr-option>` still sees it -- the option is the event target, and the
    // target's own listeners run before this slot listener.
    e.stopPropagation();
    const option = e.composedPath().find(isLyraOptionElement);
    if (isLyraOptionElement(option) && this.options.includes(option) && isOptionSelectedWrite(e)) {
      if (this.multiple) {
        const next = option.selected
          ? this._selected.includes(option.value) ? this._selected : [...this._selected, option.value]
          : this._selected.filter((value) => value !== option.value);
        this.assignValue(next);
      } else {
        this._valueDirty = true;
        this._restoredStateActive = false;
        // An unselected source option does not own a custom/unmatched committed value.
        if (!option.selected && this.singleSelectedOption !== option) return;
        // `[]`, not `''`, for the deselected branch: `''` is now a real candidate value (an option
        // may declare it), so only an explicit empty array unambiguously means "clear".
        this.setValue(option.selected ? option.value : [], true, option.selected ? option : undefined);
      }
      return;
    }
    if (isLyraOptionElement(option) &&
        this.adornmentClones.get(option)?.markup !== this.adornmentMarkup(option)) {
      this.adornmentClones.delete(option);
    }
    // Many options notify together during mounting or a catalog metadata refresh. Reconcile the
    // complete catalog once per microtask batch; explicit selected writes above remain immediate.
    if (this.optionRefreshPending) return;
    this.optionRefreshPending = true;
    // Touch the `options` array reference so Lit's change-detection sees a
    // "new" value and re-renders `renderRows()`/`filtered`/`labelFor()` off
    // the options' now-current data -- the *set* of options is unchanged,
    // only one member's own properties are, so this skips
    // collectOptions()'s selection-seeding logic entirely.
    queueMicrotask(() => {
      this.optionRefreshPending = false;
      this.refreshOptionDefaults();
      this.reflectSelected();
      this.options = [...this.options];
      this.normalizeActiveIndex();
    });
  };

  private reflectSelected(): void {
    const value = this._selected[0];
    if (!this.singleSelectedOption || !this.options.includes(this.singleSelectedOption) || this.singleSelectedOption.value !== value) {
      this.singleSelectedOption = this.options.find((option) => option.value === value);
    }
    const selected = new Set(this._selected);
    for (const option of this.options) {
      option[SET_OPTION_SELECTED_FROM_OWNER](this.multiple ? selected.has(option.value) : option === this.singleSelectedOption);
    }
  }

  private labelFor(value: string): string {
    // An explicitly blank (or whitespace-only) label carries no useful information -- fall
    // through to the next candidate (ultimately the raw value) exactly as a missing label would,
    // rather than rendering/announcing an empty segment.
    const nonBlank = (label: string | undefined): string | undefined =>
      label !== undefined && label.trim().length > 0 ? label : undefined;
    // The unmatched-value hook wins outright, and only for a value that is genuinely unmatched:
    // `getTag` cannot serve this case because it is handed a matched option, which by definition
    // does not exist here. It stays ahead of the label cache so the hook can never be shadowed by
    // a cached raw string -- `pickRow()` keeps a synthetic row out of that cache precisely so the
    // two can never disagree about whether a value is unmatched.
    if (this.getUnknownLabel && this.isUnknownValue(value)) {
      const override = nonBlank(this.getUnknownLabel(value));
      if (override !== undefined) return override;
    }
    // Checked in order: an explicit pick's own label (works even after the
    // source rows backing it have since changed), a slotted `<lr-option>`
    // (local mode), then the last-fetched async row set (source mode) -- a
    // value set programmatically (e.g. `el.value = 'b'` before the listbox
    // has ever been opened) has no chance to have populated the first two,
    // so without this last fallback it would render as the raw value string
    // instead of its label.
    //
    // One fallback still sits ahead of the raw value itself: a `source` combobox whose async
    // catalogue has never resolved even once (see `sourceEverSettled`) has no way yet to know
    // whether `value` matches anything, so showing the raw value here -- machine key, numeric id,
    // whatever it is -- would be exactly the untranslated flash the unknown-value badge exists to
    // avoid, just without the badge (`isUnknownValue()` also suppresses over this same window, so
    // the badge cannot compensate). A resolved-but-still-unmatched value falls all the way through
    // to the raw value below, same as always.
    return (
      (!this.source && !this.multiple && this.singleSelectedOption?.value === value ? nonBlank(this.singleSelectedOption.label) : undefined) ??
      nonBlank(this._selectedLabelCache.get(value)) ??
      nonBlank(this.options.find((o) => o.value === value)?.label) ??
      nonBlank(this.asyncRows.find((r) => r.value === value)?.label) ??
      (this.loading || (this.source && !this.sourceEverSettled)
        ? this.statusText('loading', this.loadingText)
        : undefined) ??
      value
    );
  }

  /**
   * Whether a committed value matches no currently-known row -- a stale value from before its
   * option/row disappeared, or a programmatic `value` assignment that never matched anything.
   * Drives the dashed/italic "not in catalog" presentation in `render()`, so a genuinely
   * unresolved value never leaks its raw string with no explanation, while `labelFor()` keeps the
   * raw value itself fully reachable.
   *
   * Suppressed entirely until a `source` combobox's async fetch has settled at least once (see
   * `sourceEverSettled`): from mount through the debounce delay and the in-flight call itself,
   * simply hasn't had a chance to populate `asyncRows` yet, which is "not yet known", not
   * "genuinely unknown" -- the private `sourceLoading` flag alone would miss the debounce-delay
   * span before the request even starts, which is exactly the window `labelFor()`'s own
   * loading-placeholder fallback needs this to agree with. Also suppressed while the public
   * `loading` property is `true`, for a consumer mounting `<lr-option>` children asynchronously
   * itself with no `source` involved -- see `loading`.
   *
   * Checked against the same four sources as `labelFor()`, but as a plain existence test rather
   * than a label lookup, so a real match with a deliberately blank label is never misreported as
   * unknown. `_selectedLabelCache` also covers `allowCustomValue`'s committed text (cached against
   * itself in `commitCustomValue()`) -- a sanctioned "not from the option list" value, not a stale
   * one, so it must never show this badge.
   */
  private isUnknownValue(value: string): boolean {
    if (this.loading || (this.source && !this.sourceEverSettled)) return false;
    return !(
      (!this.source && !this.multiple && this.singleSelectedOption?.value === value) ||
      this._selectedLabelCache.has(value) ||
      this.options.some((option) => option.value === value) ||
      this.asyncRows.some((row) => row.value === value)
    );
  }

  /** The current row set in a source-agnostic shape, before capping. */
  /**
   * Cloned adornment nodes, keyed by the option they came from. Cached because `effectiveRows` runs
   * on every render pass: handing Lit a fresh clone each time would rebuild the whole popup's
   * adornment DOM on every keystroke. Option notifications compare the authored markup snapshot
   * before invalidating it; changes to a label or secondary text leave unchanged clones intact.
   * Recollecting the option set drops the snapshots so detached edits are picked up as well.
   */
  private adornmentClones = new WeakMap<LyraOption, { start?: unknown; end?: unknown; markup: string }>();

  private adornmentMarkup(option: LyraOption): string {
    return Array.from(option.children)
      .filter((child) => ['start', 'end', 'prefix', 'suffix'].includes(child.getAttribute('slot') ?? ''))
      .map((child) => child.outerHTML)
      .join('');
  }

  /**
   * `<lr-option>` documents `start`/`end` (plus the Shoelace `prefix`/`suffix` aliases) adornment
   * slots, but the popup is built from row DATA rather than from the option elements, so slotted
   * nodes have nowhere to land. Clone them into the row instead.
   *
   * `cloneNode(true)`, never `createElementNS`: the latter yields an inert, never-upgrading custom
   * element (AGENTS.md), which would silently break the `<lr-flag>`/avatar case this exists for.
   * Cloning also leaves the author's own subtree exactly where they put it -- moving the live node
   * would empty their markup as a side effect of opening a dropdown.
   */
  private adornmentsFor(option: LyraOption): { start?: unknown; end?: unknown } {
    const cached = this.adornmentClones.get(option);
    if (cached) return cached;
    const cloneSlot = (selector: string): unknown => {
      const nodes = Array.from(option.querySelectorAll<HTMLElement>(selector));
      if (nodes.length === 0) return undefined;
      return nodes.map((node) => node.cloneNode(true));
    };
    const resolved = {
      markup: this.adornmentMarkup(option),
      start: cloneSlot(':scope > [slot="start"], :scope > [slot="prefix"]'),
      end: cloneSlot(':scope > [slot="end"], :scope > [slot="suffix"]'),
    };
    this.adornmentClones.set(option, resolved);
    return resolved;
  }

  private rowForOption(option: LyraOption): ComboboxSourceRow {
    const adornments = this.adornmentsFor(option);
    const row: ComboboxSourceRow = {
      value: option.value,
      label: option.label,
      sub: option.sub || undefined,
      dotColor: option.dotColor || undefined,
      group: option.group || undefined,
      disabled: option.disabled || option.inert || option.closest('[inert]') !== null,
      // By reference, never cloned -- `option.data` is opaque caller payload, the light-DOM
      // counterpart to an async source row's own `data` field.
      data: option.data,
      ...(adornments.start === undefined ? {} : { start: adornments.start }),
      ...(adornments.end === undefined ? {} : { end: adornments.end }),
    };
    this.sourceOptionsByRow.set(row, option);
    return row;
  }

  private get selectionSourceRows(): ComboboxSourceRow[] {
    return this.source
      ? this.asyncRows
      : this.options.map((option) => this.rowForOption(option));
  }

  private applySelectedRowValues(values: readonly string[]): void {
    const rowsByValue = new Map<string, ComboboxSourceRow>();
    for (const row of this.selectionSourceRows) {
      if (!rowsByValue.has(row.value)) rowsByValue.set(row.value, row);
    }
    const rows = values
      .map((value) => rowsByValue.get(value))
      .filter((row): row is ComboboxSourceRow => row !== undefined);
    // `limited` is already capped to at most one row in single mode, so mapping it directly --
    // rather than `limited[0]?.value ?? ''` -- commits an empty array, not the sentinel `''`, when
    // nothing matched.
    const limited = this.multiple ? rows : rows.slice(0, 1);
    this.assignValue(limited.map((row) => row.value));
    for (const row of limited) this._selectedRowCache.set(row.value, row);
  }

  private applyPendingSelectedRows(acceptEmptySource = false): boolean {
    if (
      this.pendingSelectedRowValues === undefined ||
      (!acceptEmptySource && this.selectionSourceRows.length === 0)
    ) {
      return false;
    }
    const values = this.pendingSelectedRowValues;
    this.pendingSelectedRowValues = undefined;
    this.applySelectedRowValues(values);
    return true;
  }

  private get effectiveRows(): ComboboxSourceRow[] {
    if (this.source) return this.asyncRows;
    return this.filtered.map((option) => this.rowForOption(option));
  }

  /**
   * Synthetic rows standing in for committed values that no option or async row claims.
   *
   * Opt-in, and derived fresh from the current `value` on every render -- never stored -- so the
   * row appears exactly while the value is genuinely unmatched and vanishes the moment a real row
   * claims it. Without it, a committed out-of-list value is visible on the trigger but absent from
   * the listbox, so a user who opens the listbox has no way back to the value they arrived with.
   *
   * Filtered by the active query, exactly like `createRow` is: a row that survives a query it does
   * not match would both mislead (the user typed `zzz` and is shown `ghost`) and suppress the
   * "no matches" copy forever, since `render()` derives that branch from the rendered row count.
   * An empty query keeps every unmatched value's row. The fold is the default substring one rather
   * than the author's `filter` hook, which is typed against a real `<lr-option>` this row has none
   * of.
   */
  private get unknownRows(): ComboboxSourceRow[] {
    if (!this.showUnknownOption) return [];
    const locale = this.effectiveLocale;
    const query = this.query.trim().toLocaleLowerCase(locale);
    return this._selected
      .filter((value) => this.isUnknownValue(value))
      .map((value) => ({
        value,
        label: this.labelFor(value),
        badge: this.localize('notInCatalog'),
        unknownValue: value,
      }))
      .filter(
        (row) =>
          !query ||
          row.label.toLocaleLowerCase(locale).includes(query) ||
          row.value.toLocaleLowerCase(locale).includes(query)
      );
  }

  /** Synthetic action shown only when the current nonempty query has no exact label/value match. */
  private get createRow(): ComboboxSourceRow | undefined {
    if (!this.allowCreate) return undefined;
    const inputValue = this.query.trim();
    if (!inputValue) return undefined;
    const locale = this.effectiveLocale;
    const folded = inputValue.toLocaleLowerCase(locale);
    const rows = this.source
      ? this.asyncRows
      : this.options.map((option) => ({
          value: option.value,
          label: option.label,
        }));
    if (
      rows.some(
        (row) =>
          row.value.toLocaleLowerCase(locale) === folded ||
          row.label.toLocaleLowerCase(locale) === folded
      )
    ) {
      return undefined;
    }
    return {
      value: inputValue,
      label: this.localize('comboboxCreate', undefined, { value: inputValue }),
      createInput: inputValue,
    };
  }

  /** `effectiveRows` capped to `maxRender`, always keeping the current selection visible. */
  private get renderedRows(): { rows: ComboboxSourceRow[]; overflow: number } {
    const all = this.effectiveRows;
    const create = this.createRow;
    const sourceOverflow = this.source
      ? Math.max(0, this._sourceTotal - all.length)
      : 0;
    const unknown = this.unknownRows;
    if (all.length <= this.maxRender) {
      return {
        rows: [...all, ...unknown, ...(create ? [create] : [])],
        overflow: sourceOverflow,
      };
    }
    const originalIndex = new Map(all.map((r, i) => [r, i]));
    const capped = all.slice(0, this.maxRender);
    const cappedValues = new Set(capped.map((r) => r.value));
    let appendedOutOfCap = false;
    for (const v of this._selected) {
      if (!cappedValues.has(v)) {
        const selectedRow = all.find((r) => r.value === v);
        if (selectedRow) {
          capped.push(selectedRow);
          appendedOutOfCap = true;
        }
      }
    }
    if (appendedOutOfCap) {
      // A preserved out-of-cap selection was just tacked onto the very end,
      // regardless of its own `group` -- stable-sort back by each row's
      // original position so it lands among its own group's other rows
      // instead of forcing renderRows() to emit that group's label a second
      // time after whatever group happens to trail the cap.
      capped.sort((a, b) => originalIndex.get(a)! - originalIndex.get(b)!);
    }
    // Appended AFTER the cap, exactly like the create row: a value the user has already committed
    // must stay visible however long the match list is.
    capped.push(...unknown);
    if (create) capped.push(create);
    return {
      rows: capped,
      overflow:
        all.length - capped.length + unknown.length + (create ? 1 : 0) + sourceOverflow,
    };
  }

  /** Keeps the roving index inside the current source-agnostic enabled-row set without turning an
   *  untouched `-1` cursor into an implicit selection. Local slot refreshes, option property
   *  changes, and async responses all pass through this one clamp. */
  private normalizeActiveIndex(): void {
    if (this.activeIndex < 0) return;
    const navigableCount = this.renderedRows.rows.filter(
      (row) => !row.disabled
    ).length;
    const next =
      navigableCount > 0 ? Math.min(this.activeIndex, navigableCount - 1) : -1;
    if (next !== this.activeIndex) this.activeIndex = next;
  }

  private get filtered(): LyraOption[] {
    // `toLocaleLowerCase()` (not the invariant-Unicode `toLowerCase()`) so a
    // `tr`/`az` locale's dotted/dotless I case-folds the way that locale
    // actually expects -- matches `<lr-table>`'s identical filter fold.
    const locale = this.effectiveLocale;
    const q = this.query.trim().toLocaleLowerCase(locale);
    const selectedLabel = !this.multiple
      ? this.labelFor(this._selected[0] ?? '') ?? ''
      : '';
    const effective =
      q && q === selectedLabel.toLocaleLowerCase(locale) ? '' : q;
    if (!effective) return this.options;
    const fn: OptionFilter =
      this.filter ??
      ((o, query) =>
        o.label.toLocaleLowerCase(locale).includes(query) ||
        o.searchText.toLocaleLowerCase(locale).includes(query));
    return this.options.filter((o) => fn(o, effective));
  }

  private get displayValue(): string {
    if (this.multiple || this.open || this.explicitInputValue)
      return this.query;
    return this._selected[0] ? this.labelFor(this._selected[0]) : '';
  }

  /**
   * Emits the cancelable `lr-show`/`lr-hide` veto point for this update's `open` transition.
   *
   * It lives here rather than in `updated()` because a veto has to be answered *before* anything
   * observable happens: `willUpdate()` still runs ahead of render and attribute reflection, so
   * restoring `open` here leaves the listbox, the reflected attribute and the property agreeing
   * with each other without a visible open-then-close flash. Keeping it on the `open` transition
   * (rather than inside `show()`/`hide()`) preserves the existing rule that the lifecycle fires
   * however `open` changed, including a direct `el.open = true` that bypasses both methods.
   */
  private announceOpenTransition(changed: PropertyValues): void {
    this.openVetoed = false;
    if (!changed.has('open') || this._isFirstUpdate) return;
    const name = this.open ? 'lr-show' : 'lr-hide';
    // Removal cannot be vetoed -- the element is already gone -- so the disconnect-driven close
    // is announced without offering a veto nobody could honour.
    if (!this.isConnected) {
      this.emit('lr-hide');
      return;
    }
    if (!this.emit(name, null, { cancelable: true }).defaultPrevented) return;
    this.openVetoed = true;
    this.open = !this.open;
    // `show()`/`hide()` already registered a waiter for the transition this veto just cancelled;
    // without resolving it their returned promise would never settle.
    this.resolveTransitionWaiters(
      this.open ? 'lr-after-hide' : 'lr-after-show'
    );
  }

  /** Opens the listbox and resolves after `lr-after-show`. */
  show(): Promise<void> {
    if (this.open || this.liveDisabled || this.readonly) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-hide');
    const settled = this.waitForTransition('lr-after-show');
    this.open = true;
    return settled;
  }
  /** Closes the listbox and resolves after `lr-after-hide`. */
  hide(): Promise<void> {
    if (!this.open) return Promise.resolve();
    this.resolveTransitionWaiters('lr-after-show');
    const settled = this.waitForTransition('lr-after-hide');
    this.closeCleanupPending = true;
    this.open = false;
    return settled;
  }

  private finalizeCloseState(): void {
    if (!this.closeCleanupPending) return;
    this.closeCleanupPending = false;
    this.activeIndex = -1;
    // Single-select mode only shows `query` while `open` (see `displayValue`
    // above) -- but dismissing without picking a row (blur, Escape, or an
    // outside click) previously left an abandoned filter string sitting in
    // `query` forever, so the *next* reopen would reappear with stale text
    // and re-filter the list from it. Multiple mode is unaffected: its input
    // always shows `query` regardless of `open`, by design (a persistent
    // search box next to the tags).
    if (!this.multiple) {
      const queryChanged = this.query !== '';
      this.query = '';
      this.explicitInputValue = false;
      if (queryChanged && this.source) {
        this.asyncRows = [];
        this.sourceFailed = false;
        this._sourceTotal = 0;
        this._sourceTruncated = false;
      }
    }
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (e.composedPath().includes(this)) return;
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.dismissBackdrop();
      return;
    }
    this.restoreFocusOnClose = false;
    void this.hide();
  };

  private activateListboxOverlay(): void {
    this.invalidateListboxPositioning();
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.restoreFocusOnClose = true;
    this.overlayHandle = activateNonmodalOverlay({
      host: this,
      panel: () =>
        this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null,
      onEscape: () => void this.hide(),
      onBackdrop: () => {
        this.restoreFocusOnClose = false;
        void this.hide();
      },
      restoreFocusTo: this.inputEl ?? null,
    });
    this.bindDocumentPointer();
    const anchor = this.renderRoot.querySelector(
      '[part="combobox"]'
    ) as HTMLElement | null;
    const listbox = this.renderRoot.querySelector(
      '[part="listbox"]'
    ) as HTMLElement | null;
    if (anchor && listbox) {
      const generation = this.positioningGeneration;
      this.positioningReady = new Promise<boolean>((resolve) => {
        this.resolvePositioningReady = resolve;
      });
      void this.startListboxPositioning(generation, anchor, listbox);
    }
  }

  private invalidateListboxPositioning(): void {
    this.positioningGeneration++;
    this.cleanup?.();
    this.cleanup = undefined;
    this.resolvePositioningReady?.(false);
    this.resolvePositioningReady = undefined;
  }

  private resolveCurrentPositioning(positioned: boolean): void {
    const resolve = this.resolvePositioningReady;
    this.resolvePositioningReady = undefined;
    resolve?.(positioned);
  }

  private async startListboxPositioning(
    generation: number,
    anchor: HTMLElement,
    listbox: HTMLElement,
  ): Promise<void> {
    try {
      const { place } = await loadAnchoredOverlayRuntime();
      if (
        generation !== this.positioningGeneration ||
        !this.open ||
        !this.isConnected ||
        this.renderRoot.querySelector('[part="combobox"]') !== anchor ||
        this.renderRoot.querySelector('[part="listbox"]') !== listbox
      ) {
        return;
      }
      const cleanup = place(anchor, listbox, {
        placement: `${this.placement}-start`,
        strategy: resolveEffectivePositioningStrategy(this, this._positioningStrategy, 'fixed'),
        sync: this.sync,
        onPlaced: () => {
          if (generation !== this.positioningGeneration) return;
          this.listboxPositioned = true;
          void this.updateComplete.then(() => {
            if (generation !== this.positioningGeneration || !this.open) return;
            this.resolveCurrentPositioning(true);
          });
        },
      });
      if (generation !== this.positioningGeneration) cleanup();
      else this.cleanup = cleanup;
    } catch {
      if (generation !== this.positioningGeneration) return;
      this.resolveCurrentPositioning(false);
      void this.hide();
    }
  }

  private teardownListboxOverlay(
    restoreFocus = this.restoreFocusOnClose
  ): void {
    this.invalidateListboxPositioning();
    this.restoringOverlayFocus = restoreFocus;
    try {
      this.overlayHandle?.deactivate({ restoreFocus });
    } finally {
      this.restoringOverlayFocus = false;
    }
    this.overlayHandle = undefined;
    this.unbindDocumentPointer();
    this.restoreFocusOnClose = true;
  }

  private bindDocumentPointer(): void {
    if (!this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    if (this.pointerListenerDocument === ownerDocument && this.pointerListener)
      return;
    this.unbindDocumentPointer();
    const listener = (event: PointerEvent): void => {
      if (
        this.pointerListener !== listener ||
        this.pointerListenerDocument !== ownerDocument ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onDocPointer(event);
    };
    this.pointerListenerDocument = ownerDocument;
    this.pointerListener = listener;
    ownerDocument.addEventListener('pointerdown', listener, true);
  }

  private unbindDocumentPointer(): void {
    if (this.pointerListenerDocument && this.pointerListener) {
      this.pointerListenerDocument.removeEventListener(
        'pointerdown',
        this.pointerListener,
        true
      );
    }
    this.pointerListenerDocument = undefined;
    this.pointerListener = undefined;
  }

  private reconnectOpenPopup(): void {
    if (!this.isConnected || !this.open) return;
    this.activateListboxOverlay();
    if (this.source && this.asyncRows.length === 0) this.runSource(this.query);
  }

  /**
   * Applies `visibleOptions` as an inline `max-block-size` on the listbox.
   *
   * Measured rather than computed from a token, because a row's height varies with `sub` lines,
   * adornments, and group labels -- an estimate would cut a row in half. Measuring where row N
   * *starts* also naturally accounts for the listbox's own padding.
   *
   * The inline value keeps the positioner clamp inside its own `min()` rather than overriding the
   * stylesheet's: an inline declaration beats the shadow stylesheet outright, so writing a bare
   * pixel length here would let a capped listbox overflow the space the positioner actually has.
   * The property is removed entirely when the cap is unset, normalizes away, or is not exceeded, so
   * the stylesheet's own expression is what applies and behavior is unchanged.
   *
   * Deliberately NOT a custom property: `check-style-policy` forbids component runtime code writing
   * a documented `@cssprop`, and rightly so -- a documented hook is consumer-owned.
   */
  private syncVisibleOptionsCap(): void {
    const listbox = (this.renderRoot as ShadowRoot | undefined)?.querySelector<HTMLElement>(
      '[part="listbox"]',
    );
    if (!listbox) return;
    const clear = (): void => {
      listbox.style.removeProperty('max-block-size');
    };
    const requested =
      typeof this.visibleOptions === 'number' ? finiteCount(this.visibleOptions, 0) : 0;
    if (requested <= 0) return clear();
    const rows = listbox.querySelectorAll<HTMLElement>('[part="option"]');
    if (rows.length <= requested) return clear();
    const boundary = rows[requested];
    if (!boundary) return clear();
    const cap = boundary.getBoundingClientRect().top - listbox.getBoundingClientRect().top;
    if (!Number.isFinite(cap) || cap <= 0) return clear();
    listbox.style.setProperty(
      'max-block-size',
      `min(${Math.ceil(cap)}px, var(--lr-positioner-available-block-size, var(--lr-size-18rem)))`,
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    this.syncExternalDescription();
    this.syncVisibleOptionsCap();
    // A vetoed transition already put `open` back during willUpdate(), so `changed` still names it
    // while nothing about the state actually moved: tearing down and rebuilding the popup
    // machinery here would undo the veto it was meant to honour.
    if (changed.has('open') && !this.openVetoed) {
      // All `open`-driven side effects (positioning and the click-outside listener) live here
      // rather than in show()/hide() so they run however `open` became true -- via
      // show()/hide()'s own user-interaction paths, or a consumer/test
      // setting `el.open` directly, which bypasses both entirely. The lr-show/lr-hide veto point
      // itself runs one step earlier, in willUpdate().
      if (this.open && this.isConnected) {
        this.activateListboxOverlay();
        // Don't settle a "show" transition for markup that's simply
        // rendering open for the first time (e.g. `<lr-combobox open>`) --
        // only for an actual closed-to-open transition.
        if (!this._isFirstUpdate) {
          void this.settleTransition('lr-after-show');
        }
        // Both branches go through the DEBOUNCED path on purpose: this runs inside updated(), and
        // the immediate path writes `loading` synchronously, which is a Lit change-in-update.
        if (this.refreshQueued) {
          this.refreshQueued = false;
          this.runSource(this.query);
        } else if (this.source && this.asyncRows.length === 0) {
          this.runSource(this.query);
        }
      } else if (!this.open) {
        this.teardownListboxOverlay();
        if (!this._isFirstUpdate) {
          void this.settleTransition('lr-after-hide');
        }
      } else {
        this.teardownListboxOverlay(false);
      }
    } else if (changed.has('open') && this.openVetoed) {
      this.restoreFocusOnClose = true;
    }
    if (changed.has('name')) this.syncFormValue();
    if (changed.has('validators')) {
      this.updateValidity();
      this.syncValidatorAttributeObserver();
    }
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value') ||
      changed.has('validators') ||
      changed.has('validityRevision')
    ) {
      this.toggleAttribute(
        'data-invalid',
        this.touched && !this.internals.validity.valid
      );
    }
    // The listbox is a fixed-height, scrollable box (see combobox.styles.ts's
    // `max-block-size`/`overflow-y`) -- without this, arrowing/Home/End past
    // its visible rows moves `activeIndex` and `aria-activedescendant`
    // correctly but leaves the highlighted row scrolled out of view for a
    // sighted keyboard user. `block: 'nearest'` is a no-op whenever the
    // active row is already fully visible. Mirrors lr-mention-popover's
    // identical fix for the same shape of listbox.
    if (changed.has('activeIndex')) {
      this.renderRoot
        .querySelector<HTMLElement>('[part="option"][data-active]')
        ?.scrollIntoView({ block: 'nearest' });
    }
  }

  private async settleTransition(
    event: 'lr-after-show' | 'lr-after-hide'
  ): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (event === 'lr-after-show') {
      while (this.open && !this.listboxPositioned) {
        const readiness = this.positioningReady;
        const positioned = await readiness;
        if (this.transitionToken !== token) return;
        if (positioned) break;
        if (readiness === this.positioningReady) return;
      }
      await this.updateComplete;
      if (this.transitionToken !== token) return;
    }
    if (this.isConnected) {
      const view = this.ownerDocument.defaultView;
      if (view)
        await new Promise<void>((resolve) =>
          view.requestAnimationFrame(() => resolve())
        );
      if (this.transitionToken !== token) return;
      const listbox = this.renderRoot.querySelector('[part="listbox"]');
      const animations = listbox?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(
        animations.map((animation) => animation.finished.catch(() => undefined))
      );
      if (this.transitionToken !== token) return;
    }
    if (event === 'lr-after-hide') {
      this.listboxHidden = true;
      await this.updateComplete;
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
    this.resolveTransitionWaiters(event);
  }

  private waitForTransition(
    event: 'lr-after-show' | 'lr-after-hide'
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters =
        this.transitionWaiters.get(event) ?? new Set<() => void>();
      waiters.add(resolve);
      this.transitionWaiters.set(event, waiters);
    });
  }

  private resolveTransitionWaiters(
    event: 'lr-after-show' | 'lr-after-hide'
  ): void {
    const waiters = this.transitionWaiters.get(event);
    if (!waiters) return;
    this.transitionWaiters.delete(event);
    for (const resolve of waiters) resolve();
  }

  /** Dispatches the platform-style value events used by non-text user
   * interactions: `input`, `change`, and the prefixed `lr-change` alias, each
   * carrying `detail: { value, data }` (the new committed selection, and its index-aligned opaque
   * `data` payload -- `data[i]` describes `value[i]`, `undefined` where that value resolves to no
   * live row/option, never shifted or dropped; see `selectedRows`, which drops that slot instead
   * since its own contract is "structured rows for the current selection", not index alignment).
   * Text editing
   * keeps and exposes the original InputEvent from the shadow input so its
   * data/inputType metadata is not lost. `this.emit()` (from `LyraElement`)
   * already dispatches a bubbling, composed, non-cancelable `CustomEvent`. */
  private emitValueEvents(): void {
    // Pinned to the un-narrowed class. Inside the class body `Multiple` is an unresolved type
    // parameter, which leaves the detail type an unresolved conditional that no concrete argument
    // list can be checked against -- the same reason `<lr-popover>`'s own lifecycle emits resolve
    // against its base event map. The constraint already guarantees the payload's shape.
    const self = this as unknown as LyraCombobox<boolean>;
    const data = this.resolveSelectedRowSlots().map((row) => row?.data);
    self.emit('input', { value: self.value, data });
    self.emit('change', { value: self.value, data });
    self.emit('lr-change', { value: self.value, data });
  }

  /**
   * This component's own channel for writing `value`.
   *
   * The public accessor is narrowed by `Multiple`, and inside the class body that parameter is
   * unresolved -- so no concrete `string` or `string[]` is assignable to it, even though every
   * value written here is one of the two. One documented cast in one place, rather than a dozen at
   * the call sites; the runtime path is the public setter, unchanged.
   */
  private assignValue(next: string | string[] | null | undefined): void {
    this.value = next as LyraPickerValue<Multiple> | null | undefined;
  }

  /** Runs the cancelable option-creation contract, then performs its default append/select behavior. */
  private createOption(inputValue: string): void {
    if (this.liveDisabled || this.readonly) return;
    const event = this.emit('lr-create', { inputValue }, { cancelable: true });
    if (event.defaultPrevented) return;
    const option = this.ownerDocument.createElement(
      tag('option')
    ) as LyraOption;
    option.setAttribute('value', inputValue);
    option.textContent = inputValue;
    this.append(option);
    this.pickRow({ value: inputValue, label: inputValue });
  }

  /** Commits arbitrary text in the single-select custom-value mode without adding an option. */
  private commitCustomValue(inputValue: string): void {
    if (this.liveDisabled || this.readonly || this.multiple || !inputValue) return;
    const selectionChanged = this._selected[0] !== inputValue;
    this._selectedLabelCache.set(inputValue, inputValue);
    this.assignValue(inputValue);
    this.query = '';
    this.explicitInputValue = false;
    void this.hide();
    if (selectionChanged) this.emitValueEvents();
  }

  private pickRow(row: ComboboxSourceRow): void {
    const sourceOption = this.sourceOptionsByRow.get(row);
    if (this.liveDisabled || this.readonly || row.disabled || (sourceOption && (sourceOption.disabled || sourceOption.closest('[inert]')))) return;
    if (row.createInput !== undefined) {
      this.createOption(row.createInput);
      return;
    }
    // A synthetic unmatched-value row is derived FROM the committed value (`unknownRows`), so
    // picking it is not evidence the value is known -- caching its label would make
    // `isUnknownValue()` report it as a sanctioned pick from then on, permanently retiring the
    // `[part="unknown-value"]` badge and the row itself for a value that still matches nothing.
    // `_selectedRowCache` is skipped for the same reason: it backs the public `selectedRows`,
    // which must never hand back a row this component invented. `lr-select` keeps the same
    // separation by routing the identical click through `selectUnknownValue()`.
    const synthetic = row.unknownValue !== undefined;
    const selectionChanged = this.multiple || this._selected[0] !== row.value;
    if (this.multiple) {
      const set = new Set(this._selected);
      if (set.has(row.value)) {
        set.delete(row.value);
        this._selectedRowCache.delete(row.value);
      } else {
        set.add(row.value);
        if (!synthetic) {
          this._selectedLabelCache.set(row.value, row.label);
          this._selectedRowCache.set(row.value, row);
        }
      }
      this.assignValue([...set]);
      this.query = '';
      this.explicitInputValue = false;
    } else {
      if (!synthetic) {
        this._selectedLabelCache.set(row.value, row.label);
        this._selectedRowCache.clear();
        this._selectedRowCache.set(row.value, row);
      }
      this.setValue(row.value, true, sourceOption);
      this.query = '';
      this.explicitInputValue = false;
      this.hide();
    }
    // The query resets to '' above but `asyncRows` doesn't refresh on its
    // own -- re-run `source` so the listbox (still open in multiple mode,
    // and whatever `asyncRows` holds for the next time it reopens in single
    // mode) matches the now-empty input instead of the stale prior query.
    if (this.source) this.runSource(this.query);
    if (selectionChanged) this.emitValueEvents();
    // Every activation of an available row reports, including the re-pick of the current selection
    // that `change`/`lr-change` are defined to stay silent for. See the class doc's `lr-activate`
    // entry.
    this.emit('lr-activate', { value: row.value });
  }

  /**
   * Removes exactly the occurrence at `index`, never every row sharing its public string value --
   * `multiple` mode's committed `value` can legitimately hold a repeated string (the `value`
   * setter never dedupes), and `shownTags` renders one tag per occurrence, so a value-keyed removal
   * would delete every duplicate in one click. Mirrors `<lr-select>`'s `removeValueAt()`.
   */
  private removeValueAt(index: number): void {
    if (this.liveDisabled || this.readonly) return;
    if (index < 0 || index >= this._selected.length) return;
    const next = this._selected.filter((_, i) => i !== index);
    this.assignValue(next);
    this.emitValueEvents();
  }

  /**
   * The clear button clears both axes the control owns — the committed selection and the
   * in-progress filter text — but each announces only its own change. A query-only clear must stay
   * silent on `input`/`change`/`lr-clear` (there is no selection transition to report; that early
   * return is why the button used to be gated on the selection alone), while a selection-only clear
   * must stay silent on `lr-filter` (the filter text never moved).
   */
  private clear(): void {
    if (this.liveDisabled || this.readonly) return;
    const hadSelection = this._selected.length > 0;
    const queryChanged = this.query !== '';
    if (!hadSelection && !queryChanged) return;
    if (hadSelection) this.assignValue([]);
    this.query = '';
    this.explicitInputValue = false;
    if (this.source) this.runSource(this.query);
    if (hadSelection) {
      this.emitValueEvents();
      this.emit('lr-clear');
    }
    if (queryChanged) this.emit('lr-filter', { value: this.query });
  }

  private onInput = (e: Event): void => {
    if (this.liveDisabled || this.readonly) return;
    this.explicitInputValue = false;
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
    if (this.source) this.runSource(this.query);
    // One of the two user-driven `query` writers that announce the new filter text (the other is
    // the clear button, via `clear()`) -- see the `query` declaration above.
    this.emit('lr-filter', { value: this.query });
  };

  /**
   * Re-runs the current `source` query.
   *
   * The gap it closes: nothing else could invalidate a *stable* `source`. Reassigning the property
   * is the only other route, and that is a source-IDENTITY change -- it clears `asyncRows`, the
   * totals, and the pending-selection cache, which is the correct reaction to a genuinely
   * different provider and the wrong one for "ask the same provider again". `refresh()` therefore
   * changes nothing about the source, the debounce controller, or its delay: it simply issues one
   * more request for the text already typed, bypassing the debounce wait (the caller IS the
   * intent; there is no keystroke burst to coalesce).
   *
   * Called while the listbox is closed, it queues for the next open rather than fetching, matching
   * the component's existing "only queries while open" behaviour. Without a `source` it does
   * nothing at all -- local `<lr-option>` children are already live DOM.
   */
  refresh(): void {
    if (!this.source) return;
    if (!this.open) {
      this.refreshQueued = true;
      return;
    }
    this.refreshQueued = false;
    this.runSource(this.query, { immediate: true });
  }

  private runSource(query: string, options?: { immediate?: boolean }): void {
    const source = this.source;
    if (!source) return;
    this.clearSourceTimer();
    // Abort any in-flight request from a prior query so its fetch can be cancelled.
    this.sourceAbort?.abort();
    this.sourceAbort = undefined;
    const token = ++this.sourceToken;
    const ownerWindow = this.ownerDocument.defaultView;
    if (!this.isConnected || !ownerWindow) return;
    const request = { query, token, owner: ownerWindow, source };
    if (options?.immediate) {
      // Straight through the same settle callback the debounce would have called, so the token
      // guard, abort wiring and result handling stay in exactly one place.
      this.runSourceRequest(request);
      return;
    }
    this.sourceDebounce.delayMs = this._sourceDelay;
    this.sourceDebounce.push(request);
  }

  /** Runs one debounced `source()` call. The generation `token` is the guard that keeps a stale
   *  result from overwriting a newer one: it is re-checked here and again in every continuation
   *  below, because each `await` is another chance for a newer query, a re-parent, or a disconnect
   *  to have superseded this request while it was in flight. */
  private runSourceRequest({
    query,
    token,
    owner: ownerWindow,
    source,
  }: ComboboxSourceRequest): void {
    if (
      token !== this.sourceToken ||
      !this.isConnected ||
      this.ownerDocument.defaultView !== ownerWindow
    ) {
      return;
    }
    const controller = new ownerWindow.AbortController();
    this.sourceAbort = controller;
    this.sourceLoading = true;
    this.sourceFailed = false;
    // `Promise.resolve().then(() => source(query, ...))` moves the call
    // itself inside a `.then()` callback, so a *synchronous* throw from
    // `source(query)` becomes a normal promise rejection the
    // following `.catch()` handles, instead of escaping this debounced
    // settle callback as an uncaught exception.
    Promise.resolve()
      .then(() =>
        source(query, { signal: controller.signal, limit: MAX_SOURCE_ROWS })
      )
      .then((result) => {
        if (
          token !== this.sourceToken ||
          !this.isConnected ||
          this.ownerDocument.defaultView !== ownerWindow
        ) {
          return;
        }
        const normalized = normalizeSourceResult(result);
        this._sourceTotal = normalized.total;
        this._sourceTruncated = normalized.truncated;
        this.asyncRows = normalized.rows;
        this.sourceFailed = false;
        this.sourceEverSettled = true;
        this.normalizeActiveIndex();
        this.applyPendingSelectedRows(true);
        const selected = new Set(this._selected);
        for (const row of normalized.rows) {
          if (selected.has(row.value))
            this._selectedRowCache.set(row.value, row);
        }
      })
      .catch((err) => {
        if (
          token !== this.sourceToken ||
          !this.isConnected ||
          this.ownerDocument.defaultView !== ownerWindow
        ) {
          return;
        }
        // A caller that forwarded the signal to fetch() surfaces cancellation as an AbortError;
        // that is expected teardown, not a source failure, so don't warn about it.
        if (
          typeof err === 'object' &&
          err !== null &&
          'name' in err &&
          err.name === 'AbortError'
        ) {
          return;
        }
        this.asyncRows = [];
        this._sourceTotal = 0;
        this._sourceTruncated = false;
        this.activeIndex = -1;
        this.sourceFailed = true;
        // A rejection is still a real settle -- the alternative (staying "not yet known" forever)
        // would strand the trigger showing a loading placeholder for a query that has already
        // failed and will not resolve on its own, with the retry state as the only way out.
        this.sourceEverSettled = true;
        this.sourceErrorAnnouncementSink?.announce(
          this.localize('comboboxLoadError')
        );
        // Non-cancelable: the failure has already happened and the error row is already the
        // rendered outcome, so there is nothing here for a listener to veto. It carries the raw
        // rejection so a host can log or report it -- the rendered copy stays localized and never
        // leaks the message.
        this.emit('lr-source-error', { error: err, query });
        console.warn('<lr-combobox> source() rejected:', err);
      })
      .finally(() => {
        if (token === this.sourceToken) this.sourceLoading = false;
      });
  }

  private clearSourceTimer(): void {
    // Cancel, never dispose: a disconnect may be a re-parent, and the combobox must still be able
    // to debounce a later query. The controller clears through the realm that scheduled the work.
    this.sourceDebounce.cancel();
  }

  private onInputBlur = (event: FocusEvent): void => {
    // A blur the platform forces when this focused native input becomes
    // `disabled` (see the `?disabled=${this.effectiveDisabled}` binding above) is not a real user
    // interaction -- marking `touched` for it could reenter an in-flight Lit update and trip Lit's
    // dev-mode "scheduled an update after an update completed" warning.
    if (!this.liveDisabled) this.touched = true;
    // Synchronously, not from `updated()`: `:state(user-invalid)` has to be true the moment focus
    // leaves, the same instant native `:user-invalid` starts matching.
    this.syncCustomStates();
    // A mouse click outside the element is already handled by
    // onDocPointer/hide(), but that leaves keyboard users with no way to
    // dismiss the listbox short of Escape -- tabbing focus away from the
    // input should close it too, the same as it would for a native
    // `<select>`'s popup.
    this.restoreFocusOnClose = false;
    this.hide();
    relayNativeEvent(this, event);
  };

  private onInputFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    if (!this.restoringOverlayFocus) this.show();
    relayNativeEvent(this, event);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.isComposing || e.keyCode === 229 || this.liveDisabled || this.readonly) return;
    const navigable = this.renderedRows.rows.filter((r) => !r.disabled);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) {
          void this.show();
          return;
        }
        this.activeIndex = Math.min(navigable.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) {
          void this.show();
          return;
        }
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter': {
        const activeRow = navigable[this.activeIndex];
        if (this.open && this.activeIndex >= 0 && activeRow) {
          e.preventDefault();
          this.pickRow(activeRow);
          break;
        }
        const create = this.createRow;
        if (this.open && create) {
          e.preventDefault();
          this.createOption(create.createInput!);
          break;
        }
        if (
          this.open &&
          this.allowCustomValue &&
          !this.multiple &&
          this.query.trim()
        ) {
          e.preventDefault();
          this.commitCustomValue(this.query.trim());
          break;
        }
        // Nothing highlighted to commit, so the keystroke means what it means in any other text
        // field: implicit submission of the ancestor form. The internal input lives in a shadow
        // root and has no form owner, so the platform can never do it here.
        submitOnEnter(this, e);
        break;
      }
      case 'Escape':
        if (
          this.open &&
          (!this.overlayHandle?.isActive() || this.overlayHandle.isTopmost())
        ) {
          e.preventDefault();
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = navigable.length - 1;
        }
        break;
      case 'Backspace':
        if (this.multiple && !this.query && this._selected.length) {
          this.removeValueAt(this._selected.length - 1);
        }
        break;
    }
  };

  private onComboMouseDown = (e: MouseEvent): void => {
    if (this.liveDisabled) return;
    // The free-text input owns the browser's native caret placement and Shift-selection defaults.
    // A mousedown whose real target is the input itself (not just something inside it -- there is
    // nothing inside it) must therefore remain uncancelled; preventing it here would strip basic
    // text editing from the combobox's own input. Its own `focus` handler (`onInputFocus`) already
    // opens the listbox, so nothing else needs to run on this path. Mirrors
    // `internal/catalog-picker.ts`'s `handleComboMouseDown`.
    if (e.composedPath()[0] === this.inputEl) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    this.inputEl?.focus();
    this.show();
  };

  // Delegated onto [part="listbox"] (see render()) rather than one closure
  // pair allocated per option per render -- the click handler resolves the
  // target row via closest('[part="option"]') + a data-value lookup into
  // `_rowsByValue`.
  //
  // mousedown must be cancelled for ANY press inside the listbox, not just on
  // option rows: the browser's default action moves focus to the pressed
  // element, so a drag on the listbox scrollbar, a press on a group label, or
  // the overflow row would blur the input, whose blur handler hides the
  // dropdown mid-interaction. Cancelling mousedown does not suppress the
  // subsequent click, so option selection still lands in onListboxClick.
  private onListboxMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest(
      '[part="option"]'
    ) as HTMLElement | null;
    const value = optionEl?.dataset['value'];
    if (value === undefined) return;
    const row = this._rowsByValue.get(value);
    if (row) this.pickRow(row);
  };

  private renderRows(
    rows: ComboboxSourceRow[],
    activeId: string
  ): TemplateResult[] {
    const out: TemplateResult[] = [];
    let currentGroup: string | undefined;
    let currentGroupRows: TemplateResult[] = [];
    let groupIndex = 0;
    const selectedSet = new Set(this.multiple ? this._selected : this._selected.slice(0, 1));
    const flushGroup = (): void => {
      if (!currentGroupRows.length) return;
      if (currentGroup) {
        const labelId = `${this.listId}-group-${groupIndex++}`;
        out.push(html`<div role="group" aria-labelledby=${labelId}>
          <div id=${labelId} part="group-label" class="group-label">${currentGroup}</div>
          ${currentGroupRows}
        </div>`);
      } else {
        out.push(...currentGroupRows);
      }
      currentGroupRows = [];
    };
    rows.forEach((o, i) => {
      if (o.group !== currentGroup) {
        flushGroup();
        currentGroup = o.group;
      }
      const id = `${this.listId}-opt-${i}`;
      const selected = this.multiple || this.source
        ? selectedSet.has(o.value)
        : this.singleSelectedOption !== undefined && this.sourceOptionsByRow.get(o) === this.singleSelectedOption;
      if (selected && !this.multiple) selectedSet.delete(o.value);
      currentGroupRows.push(
        html`<div
          part="option"
          id=${id}
          role="option"
          data-value=${o.value}
          ?data-create=${o.createInput !== undefined}
          ?data-unknown-value=${o.unknownValue !== undefined}
          aria-selected=${selected ? 'true' : 'false'}
          aria-disabled=${o.disabled ? 'true' : 'false'}
          aria-label=${o.accessibleLabel || nothing}
          ?data-active=${id === activeId}
        >
          ${o.start
            ? renderInertPresentation(o.start, { part: 'option-start' })
            : ''}
          ${o.icon
            ? renderInertPresentation(o.icon, { part: 'option-icon' })
            : ''}
          ${o.dotColor
            ? html`<span
                part="option-dot"
                style=${styleMap({
                  background: sanitizeCssColor(o.dotColor) ?? 'transparent',
                })}
              ></span>`
            : ''}
          <span part="option-label">
            <span>${o.label}</span>
            ${o.sub ? html`<span part="option-sub">${o.sub}</span>` : ''}
          </span>
          ${o.badge != null
            ? html`<span part="option-badge">${o.badge}</span>`
            : ''}
          ${o.end
            ? renderInertPresentation(o.end, { part: 'option-end' })
            : ''}
        </div>`
      );
    });
    flushGroup();
    return out;
  }

  /** One built-in selected chip, or the consumer's safe Lit/DOM/text replacement. */
  private renderTag(value: string, index: number): unknown {
    const option = this.options.find((candidate) => candidate.value === value);
    if (this.getTag && option) return this.getTag(option, index);
    const label = this.labelFor(value);
    const unknown = this.isUnknownValue(value);
    return html`<span part="tag" ?data-unknown-value=${unknown}>
      <span part="tag-label"
        ><span part="tag__content">${label}</span
        >${unknown
          ? html`<span part="unknown-value">${this.localize('notInCatalog')}</span>`
          : ''}</span
      >
      <button
        part="tag__remove-button"
        type="button"
        ?disabled=${this.effectiveDisabled || this.readonly}
        aria-label=${this.localize('removeWithContext', undefined, { label })}
        @click=${(event: Event) => {
          event.stopPropagation();
          // Guards a stale closed-over `index`/`value` pair: a second click on this same button,
          // fired before Lit re-renders the tag row away, would otherwise remove whatever
          // occurrence now sits at `index` after the first click shifted the array.
          if (this._selected[index] !== value) return;
          this.removeValueAt(index);
        }}
      >
        <span part="tag__remove-button__base">${closeIcon()}</span>
      </button>
    </span>`;
  }

  private statusText(
    key: string,
    override: string | undefined,
    values?: Record<string, string | number>
  ): string {
    if (override == null) return this.localize(key, undefined, values);
    if (values === undefined) return override;
    return override.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = values[name];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : match;
    });
  }

  override render(): TemplateResult {
    const { rows, overflow } = this.renderedRows;
    this._rowsByValue = new Map(rows.map((r) => [r.value, r]));
    const navigable = rows.filter((r) => !r.disabled);
    const active =
      this.activeIndex >= 0 ? navigable[this.activeIndex] : undefined;
    const activeId = active ? `${this.listId}-opt-${rows.indexOf(active)}` : '';

    const shownTags = this.multiple
      ? this._selected.slice(0, this.maxOptionsVisible)
      : [];
    const extra = this.multiple ? this._selected.length - shownTags.length : 0;
    const hasValue = this._selected.length > 0;
    // Only when displayValue actually renders the resolved label: while open, in multiple mode, or
    // after an explicit inputValue/setRangeText() write, the input shows the query/text instead
    // (see displayValue below), and a multi-mode unknown value is flagged per chip by renderTag()
    // instead.
    const singleValueUnknown =
      !this.multiple &&
      !this.open &&
      !this.explicitInputValue &&
      hasValue &&
      this.isUnknownValue(this._selected[0]!);
    // The clear button covers both axes, so it also has to render for a filter-only state.
    // `displayValue` only surfaces `query` while the listbox is open (single-select) or in
    // `multiple` mode -- outside those, a closed single-select shows the *selected label*, so a
    // button gated on the bare `query !== ''` would offer to clear text the user cannot see.
    const hasVisibleQuery = this.query !== '' && (this.open || this.multiple);
    const hasHint =
      this.withHint || this.slotPresence.has('hint') || (this.hint ?? '').length > 0;
    const hasError =
      this.slotPresence.has('error') || (this.errorText ?? '').length > 0;
    const hasLabel =
      this.withLabel || this.slotPresence.has('label') || (this.label ?? '').length > 0;
    const describedBy = this.localDescriptionIds = [
      hasError ? 'combobox-error' : '',
      hasHint ? 'combobox-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const invalid =
      hasError || (this.touched && !this.internals.validity.valid);

    return html`
      <div part="form-control">
        <label
          part="form-control-label"
          for=${this.inputId}
          ?hidden=${!hasLabel}
        >
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div part="combobox" @mousedown=${this.onComboMouseDown}>
          <span part="form-control-input" class="control-contents">
            <span part="start" ?hidden=${!this.slotPresence.has('start')}>
              <slot name="start"></slot>
            </span>
            <div part="tags">
              ${shownTags.map((value, index) => this.renderTag(value, index))}
              ${extra > 0
                ? html`<span part="tag"
                    >${this.localize('comboboxSelectedOverflow', undefined, {
                      n: getNumberFormat(this.effectiveLocale).format(extra),
                    })}</span
                  >`
                : ''}
            </div>
            <input
              id=${this.inputId}
              part="combobox-input"
              role="combobox"
              aria-label=${hostAriaLabel(this) ??
              (hasLabel
                ? nothing
                : this.placeholder || this.localize('comboboxLabel'))}
              aria-describedby=${describedBy || nothing}
              aria-expanded=${this.open ? 'true' : 'false'}
              aria-controls=${this.listId}
              aria-haspopup=${this.sourceFailed ? 'dialog' : nothing}
              aria-activedescendant=${this.sourceFailed ? nothing : activeId || nothing}
              aria-autocomplete="list"
              aria-required=${this.required ? 'true' : 'false'}
              aria-invalid=${invalid ? 'true' : 'false'}
              autocomplete=${this.autocomplete || nothing}
              inputmode=${this.inputMode || nothing}
              enterkeyhint=${this.enterKeyHint || nothing}
              spellcheck=${this.spellcheck}
              autocapitalize=${this.autocapitalize || nothing}
              autocorrect=${this.hasAttribute('autocorrect') ||
              !this.autocorrect
                ? this.autocorrect
                  ? 'on'
                  : 'off'
                : nothing}
              .value=${this.displayValue}
              placeholder=${hasValue && !this.multiple ? '' : this.placeholder}
              ?disabled=${this.effectiveDisabled}
              ?readonly=${this.readonly}
              ?data-unknown-value=${singleValueUnknown}
              @input=${this.onInput}
              @keydown=${this.onKeyDown}
              @focus=${this.onInputFocus}
              @blur=${this.onInputBlur}
            />
            ${singleValueUnknown
              ? html`<span part="unknown-value">${this.localize('notInCatalog')}</span>`
              : ''}
            ${(this.clearable || this.withClear) &&
            (hasValue || hasVisibleQuery)
              ? html`<button
                  part="clear-button"
                  type="button"
                  ?disabled=${this.effectiveDisabled || this.readonly}
                  aria-label=${this.localize('clear')}
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this.clear();
                  }}
                >
                  <span aria-hidden="true" inert
                    ><slot name="clear-icon">${closeIcon()}</slot></span
                  >
                </button>`
              : ''}
            <span part="end" ?hidden=${!this.slotPresence.has('end')}>
              <slot name="end"></slot>
            </span>
            <span part="expand-icon" aria-hidden="true" inert
              ><slot name="expand-icon">${chevronIcon()}</slot></span
            >
          </span>
        </div>
        <div
          part="listbox"
          ?hidden=${this.listboxHidden}
          ?data-positioned=${this.listboxPositioned}
          id=${this.listId}
          role=${this.sourceFailed ? 'dialog' : 'listbox'}
          aria-label=${this.sourceFailed ? this.localize('comboboxLoadError') : nothing}
          aria-multiselectable=${this.sourceFailed
            ? nothing
            : this.multiple
            ? 'true'
            : 'false'}
          @mousedown=${this.onListboxMouseDown}
          @click=${this.onListboxClick}
        >
          ${this.loading || this.sourceLoading
            ? html`<div class="loading" role="option" aria-selected="false" aria-disabled="true"
                >${this.statusText('loading', this.loadingText)}</div
              >`
            : this.sourceFailed
            ? html`<div class="source-error" part="source-error-row" role="presentation">
                ${renderDataState(
                  this,
                  {
                    loading: false,
                    error: true,
                    empty: false,
                    // The component's own catalog key, resolved here so adopting the shared
                    // renderer does not change a single word of the shipped copy.
                    errorHeading: this.localize('comboboxLoadError'),
                    compact: true,
                    // A listbox may not own a document-outline heading -- the renderer's own doc
                    // comment names this exact position as the case to opt out in.
                    headingLevel: 'none',
                    onRetry: () => this.refresh(),
                    emitRetry: (detail, init: { cancelable: true }) =>
                      this.emit('lr-retry', detail, init),
                    // `error` is already this form control's validation-message slot; see the
                    // renderer's `slotNames` doc for why that collision has to be renamed here.
                    slotNames: { error: 'source-error' },
                  },
                  { error: 'source-error' },
                  'lr-retry'
                )}
              </div>`
            : rows.length === 0
            ? html`<div class="empty" role="option" aria-selected="false" aria-disabled="true"
                >${this.statusText('noMatches', this.emptyText)}</div
              >`
            : html`${this.renderRows(rows, activeId)}
              ${overflow > 0
                ? html`<div part="option-overflow">${this.statusText(
                      'comboboxOverflow',
                      this.overflowText,
                      {
                        n: getNumberFormat(this.effectiveLocale).format(overflow),
                      }
                    )}</div>`
                : ''}`}
        </div>
        <div id="combobox-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error"></slot>
        </div>
        <div id="combobox-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint"></slot>
        </div>
      </div>
      <slot
        @slotchange=${this.collectOptions}
        @lr-option-change=${this.onOptionChange}
        hidden
      ></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-combobox': LyraCombobox;
  }
}
