import { setNativeRangeText } from '../../../internal/native-text-control.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { GlassScrollLayer } from '../../../internal/glass-scroll-layer.js';
import { observeReactivePropertyWrites } from '../../../internal/reactive-property-writes.js';
import {
  html,
  nothing,
  type ComplexAttributeConverter,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  FormAssociated,
  isBarredFromValidation,
} from '../../../internal/form-associated.js';
import {
  SET_ANCHORED_VALIDITY,
  VALIDITY_ANCHOR,
} from '../../../internal/anchored-validity.js';
import {
  deferredPlaceReady as place,
  settlePopupTransition,
  PopupTransitionWaiters,
  waitForDeferredPlacement,
  type DeferredOperationHandle,
} from '../../../internal/anchored-overlay-runtime.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { DocumentPointerListener } from '../../../internal/document-pointer.js';
import { acquireNativeControlDescription, type NativeControlDescriptionLease } from '../../../internal/native-control-description.js';
import { nextId } from '../../../internal/a11y.js';
import {
  closeIcon,
  calendarIcon,
  chevronIcon,
} from '../../../internal/icons.js';
import {
  activateNonmodalOverlay,
  composedContains,
  deepActiveElement,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { finiteCount, finiteNumber } from '../../../internal/numbers.js';
import { isDateObject } from '../../../internal/dom-guards.js';
import {
  localeDateOrder,
  normalizeLocaleDigits,
  stripBidiFormattingMarks,
  type LocaleDateField,
} from '../../../internal/locale-date.js';
import {
  dateTimeFormat,
  parseISO,
  formatISO,
  localDate,
  utcDate,
  normalizeCalendarMonths,
  normalizeWeekdayFormat,
  type WeekdayFormat,
} from './calendar-core.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import type { LyraSelectionDirection } from '../../../internal/shared-unions.js';
import { styles } from './date-input.styles.js';
import {
  LyraDatePicker,
  type DateRange,
  type LyraDatePickerDayContent,
  type LyraDatePickerDisabledDates,
  type LyraDatePickerFirstDayOfWeek,
  type LyraDatePickerPageBy,
  type LyraDateRangePreset,
  inclusiveDayCount,
  parseDisabledWeekdays,
  projectDisabledDateKeys,
} from './date-picker.class.js';
import './date-picker.class.js';
import {
  literalSetConverter,
  spellcheckFromAttributeConverter as spellcheckConverter,
} from '../../../internal/converters.js';
import {
  isImplicitSubmission,
  submitOnEnter,
} from '../../../internal/submit-on-enter.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_chooseDate, LYRA_DEFAULT_clear, LYRA_DEFAULT_date, LYRA_DEFAULT_dateInputFutureDisabled, LYRA_DEFAULT_dateInputInvalid, LYRA_DEFAULT_dateInputMaxMessage, LYRA_DEFAULT_dateInputMinMessage, LYRA_DEFAULT_dateInputPastDisabled, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_openCalendar } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

type DateField = LocaleDateField;
type DateFields = Partial<Record<DateField, string>>;
/** Field owners: 0 = both endpoints, 1 = range start, 2 = range end. */
type DatePattern = { regex: RegExp; fields: [0 | 1 | 2, DateField][] };
type FormatPart = Intl.DateTimeFormatPart & { source?: string };

const DASH_CLASS = '[-\\u2010-\\u2015\\u2212~\\u301c\\uff5e]';
const DASH_LIKE = new RegExp(DASH_CLASS, 'u');

/** Regex for one literal: optional whitespace around its characters, any dash for any dash. */
function literalPattern(literal: string): string {
  const visible = Array.from(literal.replace(/\s+/gu, ''));
  if (!visible.length) return literal ? '\\s+' : '';
  const chars = visible.map((char) =>
    DASH_LIKE.test(char) ? DASH_CLASS : char.replace(/[.*+?^${}()|[\]\\/]/gu, '\\$&')
  );
  return `\\s*${chars.join('\\s*')}\\s*`;
}

function compileDatePattern(parts: readonly FormatPart[]): DatePattern | null {
  const fields: DatePattern['fields'] = [];
  const pieces: string[] = [];
  for (const part of parts) {
    if (part.type === 'day' || part.type === 'month' || part.type === 'year') {
      fields.push([part.source === 'startRange' ? 1 : part.source === 'endRange' ? 2 : 0, part.type]);
      pieces.push('(\\d{1,4})');
    } else {
      pieces.push(literalPattern(stripBidiFormattingMarks(part.value)));
    }
  }
  // Each endpoint needs exactly one day, month and year.
  for (const owner of [1, 2] as const) {
    for (const type of ['day', 'month', 'year'] as const) {
      if (fields.filter(([o, t]) => t === type && (o === 0 || o === owner)).length !== 1) return null;
    }
  }
  // A leading or trailing literal (e.g. ` \u0433.`) is optional.
  const first = pieces.indexOf('(\\d{1,4})');
  const last = pieces.lastIndexOf('(\\d{1,4})');
  const optional = (source: string) => (source ? `(?:${source})?` : '');
  const source =
    optional(pieces.slice(0, first).join('')) +
    pieces.slice(first, last + 1).join('') +
    optional(pieces.slice(last + 1).join(''));
  return { regex: new RegExp(`^\\s*${source}\\s*$`, 'iu'), fields };
}

function localeDatePatterns(locale: string) {
  const formatter = dateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' });
  let letters = '';
  const compile = (parts: readonly FormatPart[]) => {
    for (const part of parts) {
      if (part.type === 'literal') letters += (part.value.match(/\p{L}/gu) ?? []).join('');
    }
    return compileDatePattern(parts);
  };
  let single: DatePattern | null = null;
  try {
    single = compile(formatter.formatToParts(localDate(2026, 0, 2)));
  } catch {
    // The order-based numeric parse still applies.
  }
  const ranges: DatePattern[] = [];
  // Day-only, month+day and all-field differences: every shape formatRange() collapses to.
  for (const [from, to] of [
    [localDate(2026, 0, 2), localDate(2026, 0, 3)],
    [localDate(2026, 0, 2), localDate(2026, 1, 3)],
    [localDate(2025, 0, 2), localDate(2026, 1, 3)],
  ] as const) {
    try {
      const pattern = compile(formatter.formatRangeToParts(from, to));
      if (pattern) ranges.push(pattern);
    } catch {
      // Typed ranges fall back to six digit groups.
    }
  }
  return { single, ranges, letters: letters.toLowerCase() };
}

/** A valid local date from digit groups; a one- or two-digit year means 20xx. */
function dateFromFields({ day, month, year }: DateFields): Date | null {
  if (!day || !month || !year) return null;
  const fullYear = year.length <= 2 ? 2000 + Number(year) : Number(year);
  return parseISO(
    `${String(fullYear).padStart(4, '0')}-${String(Number(month)).padStart(2, '0')}-${String(
      Number(day)
    ).padStart(2, '0')}`
  );
}

function matchDatePattern(pattern: DatePattern | null, text: string): [Date, Date] | null {
  const match = pattern?.regex.exec(text);
  if (!pattern || !match) return null;
  const start: DateFields = {};
  const end: DateFields = {};
  pattern.fields.forEach(([owner, type], index) => {
    if (owner !== 2) start[type] = match[index + 1];
    if (owner !== 1) end[type] = match[index + 1];
  });
  const from = dateFromFields(start);
  const to = dateFromFields(end);
  return from && to ? [from, to] : null;
}

function hasForeignLetters(text: string, letters: string): boolean {
  return (text.match(/\p{L}/gu) ?? []).some((letter) => !letters.includes(letter.toLowerCase()));
}

/** Normalizes the locale digits and bidi marks the component itself can render before parsing. */
function normalizeLocalizedDateText(raw: string, locale: string): string {
  return normalizeLocaleDigits(raw, locale).trim();
}

const monthsConverter: ComplexAttributeConverter<1 | 2> = {
  fromAttribute: normalizeCalendarMonths,
  toAttribute: normalizeCalendarMonths,
};

const weekdayFormatConverter: ComplexAttributeConverter<WeekdayFormat> = {
  fromAttribute: normalizeWeekdayFormat,
  toAttribute: normalizeWeekdayFormat,
};

/** The full shared `LyraAppearance` vocabulary, matching `<lr-select>`'s trigger and
 *  `<lr-combobox>`'s own converter. A value outside this set -- a typo, or any other unsupported
 *  string -- clamps to the documented `'outlined'` default; see `appearance`'s own doc comment. */
const APPEARANCE = literalSetConverter<LyraAppearance>(
  ['accent', 'filled', 'outlined', 'filled-outlined', 'plain'],
  'outlined'
);

const placements: ReadonlySet<string> = new Set([
  'top',
  'top-start',
  'top-end',
  'right',
  'right-start',
  'right-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'left-start',
  'left-end',
]);

function normalizeDateInputPlacement(value: unknown): LyraDateInputPlacement {
  return typeof value === 'string' && placements.has(value)
    ? (value as LyraDateInputPlacement)
    : 'bottom-start';
}

const placementConverter: ComplexAttributeConverter<LyraDateInputPlacement> = {
  fromAttribute: normalizeDateInputPlacement,
  toAttribute: normalizeDateInputPlacement,
};

function normalizeDateInputPageBy(value: unknown): LyraDatePickerPageBy {
  return value === 'single' ? 'single' : 'months';
}

const pageByConverter: ComplexAttributeConverter<LyraDatePickerPageBy> = {
  fromAttribute: normalizeDateInputPageBy,
  toAttribute: normalizeDateInputPageBy,
};

export type LyraDateInputSelectionDirection = LyraSelectionDirection;
export type LyraDateInputPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end';
/** Source-compatible date-input name for the shared picker weekday vocabulary. */
export type LyraDateInputFirstDayOfWeek = LyraDatePickerFirstDayOfWeek;
export type LyraDateInputValidatorResult =
  | void
  | boolean
  | string
  | ValidityStateFlags;
/** Result shape accepted from object validators used by the upstream form-control contract. */
export interface LyraDateInputObjectValidatorResult {
  message: string;
  isValid: boolean;
  invalidKeys: Exclude<keyof ValidityState, 'valid'>[];
}
/** Structural compatibility shape for an object validator. The `never` callback input is
 * intentional: it lets an array typed by another custom-element package remain assignable while
 * Lyra invokes the callback with this host at runtime. Author new Lyra validators with the
 * strongly typed function or `validate()` branches of {@linkcode LyraDateInputValidator}. */
export interface LyraDateInputObjectValidator {
  /** Host attributes that trigger a fresh validity check when they change. */
  observedAttributes?: string[];
  checkValidity: (input: never) => LyraDateInputObjectValidatorResult;
  message?: string | ((input: never) => string);
}

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

function isValidityFlagKey(value: unknown): value is keyof ValidityStateFlags {
  return typeof value === 'string' && VALIDITY_FLAG_KEYS.has(value);
}

export type LyraDateInputValidator =
  | ((value: string, input: LyraDateInput) => LyraDateInputValidatorResult)
  | {
      validate(
        value: string,
        input: LyraDateInput
      ): LyraDateInputValidatorResult;
    }
  | LyraDateInputObjectValidator;
export interface LyraDateInputEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
  'lr-clear': CustomEvent<null>;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  input: InputEvent;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
}
class LyraDateInputBase extends LyraElement<LyraDateInputEventMap> {}

/**
 * `<lr-date-input>` — a date field with an attached calendar popover.
 * Mirrors the core `<wa-date-input>` API under `lr-`. Value is ISO 8601
 * (`YYYY-MM-DD`, or `YYYY-MM-DD/YYYY-MM-DD` in range mode). Form-associated.
 * The ISO model is explicitly proleptic Gregorian for every locale. Display uses locale digits
 * and `Intl.DateTimeFormat.formatRange()`; parsing normalizes those digits and bidi marks so the
 * component's own Arabic/Persian presentation always round-trips to the same ISO value.
 *
 * This component uses a single text field; typing accepts ISO or a
 * locale-parseable date. Enter commits the typed text and then performs the implicit form
 * submission a native `<input>` would (see `internal/submit-on-enter.ts` — the internal input is
 * in a shadow root and has no form owner, so the platform can never do it here); the commit runs
 * first so the submitted value is the date the field visibly shows.
 * That text field is also the popup-opening `role="combobox"` owner, with explicit
 * `aria-haspopup`, `aria-controls`, and `aria-expanded`; the adjacent button remains an equivalent
 * pointer/keyboard toggle rather than carrying the only popup relationship.
 *
 * `size` uses the same `2xs`–`xl` scale as `lr-input`/`lr-select`/`lr-combobox`'s own `size`,
 * default `m`. The calendar-toggle and clear buttons fit within the selected control height
 * while retaining a 24px target. The smallest tiers can grow to accommodate that minimum.
 * In a constrained row the editable input shrinks first, while each public `start`/`end`
 * adornment is capped at 40% so unbroken consumer content cannot widen the field.
 *
 * Host aria-describedby targets in the host root resolve onto the native combobox input before
 * its local error and hint guidance, and follow target replacement, reconnect, and adoption.
 *
 * @customElement lr-date-input
 * @event lr-input - Typed value edit notification; detail includes `value`.
 * @event lr-change - Typed value commit notification; detail includes `value`.
 * @event {InputEvent} input - Fired on edits as a bubbling, composed, non-cancelable native event.
 * @event {Event} change - Fired on committed date transitions as a bubbling, composed,
 *   non-cancelable native event.
 * @event lr-show - Fired before the calendar popover opens; cancelable.
 * @event lr-after-show - The calendar popover finished opening.
 * @event lr-hide - Fired before the calendar popover closes; cancelable unless disabling or
 *   `readonly` forces the close.
 * @event lr-after-hide - The calendar popover finished closing.
 * @event lr-clear - The clear button or `clear()` emptied the value; follows `input` and `change`.
 * @event {FocusEvent} blur - Re-dispatched from the internal `<input>`'s own `blur` as a bubbling,
 *   composed, non-cancelable event, unlike the native event.
 * @event {FocusEvent} focus - Re-dispatched from the internal `<input>`'s own `focus` as a
 *   bubbling, composed, non-cancelable event, unlike the native event.
 * @event lr-invalid - The date input failed a validity check; cancelable. Calling
 *   `preventDefault()` also cancels the native `invalid` event it aliases, suppressing the
 *   browser's own validation bubble and `reportValidity()`'s focus/scroll.
 * @csspart date-input - The date-input wrapper.
 * @csspart base - Permanent compatibility name for the nested base wrapper.
 * @csspart form-control - The outer form-control wrapper.
 * @csspart form-control-label - The outer label wrapper.
 * @csspart label - Permanent compatibility name for the inner label-content wrapper.
 * @csspart form-control-input - The editable date surface.
 * @csspart input-wrapper - The input and button wrapper.
 * @csspart input - The text input.
 * @csspart segment - The editable date segment wrapper.
 * @csspart segment-literal - A literal inside the editable date surface.
 * @csspart range-separator - The range separator.
 * @csspart start - Wrapper around the `start` adornment slot; `hidden` while nothing is slotted.
 * @csspart end - Wrapper around the `end` adornment slot; `hidden` while nothing is slotted.
 * @csspart clear-button - The clear control.
 * @csspart expand-button - The calendar popup toggle.
 * @csspart expand-icon - The calendar icon.
 * @csspart popup - The positioned calendar popup.
 * @csspart date-picker - The nested date picker, rendered only while the calendar is open or closing.
 * @csspart presets - The nested picker's quick-range row, forwarded from `<lr-date-picker>`.
 * @csspart preset-button - One quick-range button, forwarded from `<lr-date-picker>`.
 * @csspart hint - The hint message.
 * @csspart error - The validation message.
 * @cssprop [--lr-date-input-color=inherit] - Trigger text color. Defaults to the inherited text
 *   color, and to `--lr-color-on-brand` under `appearance="accent"`.
 * @cssprop [--lr-date-input-padding-block=var(--lr-form-control-padding-block)] - Text input block padding, scaled by `size`.
 * @cssprop [--lr-date-input-padding-inline=var(--lr-form-control-padding-inline)] - Inline padding of the input row, scaled by `size`.
 * @cssprop [--lr-date-input-font-size=var(--lr-form-control-font-size)] - Font size of the text input, scaled by `size`.
 * @cssprop [--lr-date-input-placeholder-color=var(--lr-color-text-quiet)] - Placeholder text color.
 * @cssprop [--lr-date-input-gap=var(--lr-space-xs)] - Gap between input-row children.
 * @cssprop [--lr-date-input-radius=var(--lr-radius)] - Input-row corner radius. `pill` changes its
 *   private default to `--lr-radius-pill`; an inherited or direct public value still wins.
 * @cssprop [--lr-date-input-focus-border-color=var(--lr-color-brand)] - Focused row border color.
 * @cssprop [--lr-date-input-action-hover-color=var(--lr-color-text)] - Clear/calendar action color on hover.
 * @cssprop [--lr-date-input-action-hover-bg=transparent] - Clear/calendar action background on hover.
 * @cssprop [--lr-date-input-action-hover-radius=var(--lr-date-input-radius)] - Clear/calendar action corner radius on hover.
 * @cssprop [--lr-date-input-action-active-color=var(--lr-date-input-action-hover-color,var(--lr-color-text))] - Clear/calendar action color while pressed.
 * @cssprop [--lr-date-input-action-active-bg=color-mix(...)] - Clear/calendar action background while pressed.
 * @cssprop [--lr-date-input-action-active-radius=var(--lr-date-input-radius)] - Clear/calendar action corner radius while pressed.
 * @cssprop [--lr-date-input-control-min-height=var(--lr-form-control-height)] - Minimum block size
 *   of the input row, read from the shared form-control height ladder so retuning
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together.
 *   The smallest tiers can grow to fit the action buttons' 24px minimum and row borders.
 * @cssprop --lr-date-input-control-height - Exact block size of the input row. Undeclared by
 *   default, so the row grows to fit its content (floored by `--lr-date-input-control-min-height`).
 *   Set it to pin a fixed height; the calendar toggle keeps its own 24x24 touch target even when
 *   this pins a shorter row.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Popup enter-transition duration.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Popup exit-transition duration.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-container-high)] - Calendar popup background, shared with other floating surfaces.
 * @cssprop [--lr-overlay-border=var(--lr-color-border)] - Calendar popup border color, retaining the form control's boundary contrast.
 * @cssprop [--lr-overlay-radius=var(--lr-radius-container)] - Calendar popup corner radius, shared with other floating surfaces.
 * @cssprop [--lr-date-input-fill=var(--lr-color-surface)] - Resting background of the input row.
 * The `filled`/`filled-outlined` treatments default it to `--lr-color-surface-raised`; a value set
 * here wins over every treatment.
 * @cssprop [--lr-date-input-border-color=var(--lr-color-border)] - Resting border color of the
 * input row, `transparent` by default on the `filled` treatment.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control is focused. One name for every field-shaped control in the
 * library, so a halo is configured once rather than per component. Additive: the brand border cue
 * is the accessibility answer to focus and is never replaced by it.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot start - Adornment at the inline-start of the input row, before the text field.
 * @slot end - Adornment after the text field and the built-in clear action, and before the
 *   calendar toggle — so consumer content never sits outboard of the calendar button.
 * @slot clear-icon - Replaces the clear icon.
 * @slot expand-icon - Replaces the calendar icon.
 * @slot previous-icon - Replaces the previous-month icon in the calendar.
 * @slot next-icon - Replaces the next-month icon in the calendar.
 * @slot footer - Calendar footer content.
 * @slot day-YYYY-MM-DD - Content for an individual ISO calendar day.
 * @slot error - Lyra extension for custom validation markup.
 * @cssstate blank - Matches while the committed value is empty.
 * @cssstate disabled - Matches while disabled directly or through an ancestor fieldset.
 * @cssstate open - Matches while the calendar popover is open.
 * @cssstate range - Matches while `mode="range"` is active.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for the calendar
 *   popup's `fixed` default, read from computed style when it is (re)positioned. Set it once on
 *   `:root`, a theme, or one clipping ancestor to change every unset date input beneath it; an
 *   unrecognized value falls back to `fixed`.
 * @status experimental
 * @since 4.0.0
 */
export class LyraDateInput extends FormAssociated(LyraDateInputBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    chooseDate: LYRA_DEFAULT_chooseDate,
    clear: LYRA_DEFAULT_clear,
    date: LYRA_DEFAULT_date,
    dateInputFutureDisabled: LYRA_DEFAULT_dateInputFutureDisabled,
    dateInputInvalid: LYRA_DEFAULT_dateInputInvalid,
    dateInputMaxMessage: LYRA_DEFAULT_dateInputMaxMessage,
    dateInputMinMessage: LYRA_DEFAULT_dateInputMinMessage,
    dateInputPastDisabled: LYRA_DEFAULT_dateInputPastDisabled,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    openCalendar: LYRA_DEFAULT_openCalendar,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    mode: { reflect: true, noAccessor: true },
    min: { reflect: true, noAccessor: true },
    max: { reflect: true, noAccessor: true },
    readonly: { type: Boolean, reflect: true, noAccessor: true },
    disablePast: {
      type: Boolean,
      attribute: 'disable-past',
      reflect: true,
      noAccessor: true,
    },
    disableFuture: {
      type: Boolean,
      attribute: 'disable-future',
      reflect: true,
      noAccessor: true,
    },
  };

  private _appearance: LyraAppearance = 'outlined';
  /**
   * Visual treatment shared with other Lyra form controls -- the full five-value `LyraAppearance`
   * vocabulary, matching `<lr-select>`'s trigger and `<lr-combobox>`'s own `appearance`. A raw
   * attribute/property write outside this set, including a typo, clamps to the `'outlined'`
   * default rather than silently rendering unstyled.
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
  /** Whether the calendar popup is open. Disabled or readonly controls reject direct reopen
   * attempts, including the synchronous fieldset cascade before its callback runs. */
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
  /** Shows the clear action while there is a value; same as `withClear`. */
  @property({ type: Boolean, reflect: true }) clearable = false;
  /** Alias of {@link clearable}. */
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with
   *  `lr-input`/`lr-select`/`lr-combobox`. `'2xs'` is the tightest tier, for dense
   *  toolbar-embedded fields. The Web Awesome / Shoelace spellings `small`/`medium`/`large` are
   *  accepted for `s`/`m`/`l`, so a migration is a tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Rounds the input row's corners to a full pill, mirroring `lr-input`'s own `pill`. It is a
   *  single override of `--lr-date-input-radius`, so a consumer setting that property directly
   *  still wins for a bespoke shape. */
  @property({ type: Boolean, reflect: true }) pill = false;
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  /** Forwarded to the internal `<input>`'s own `spellcheck`. Defaults to `true`, matching the
   *  native element's own default. Uses {@link spellcheckConverter} rather than Lit's default
   *  presence-based `type: Boolean` converter -- see that converter's doc comment. A bare
   *  `.spellcheck` property binding can still turn this off with `spellcheck="false"`; a Lit
   *  template can do the same with either that attribute string or a `.spellcheck=${false}`
   *  binding. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the internal `<input>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = '';
  /** Forwarded to the internal `<input>`'s own `autocorrect` (Safari/WebKit-specific). Empty
   *  string omits the attribute (browser default).
   *  Named `autoCorrect` (capital `C`), not `autocorrect`, purely to dodge a TS `lib.dom.d.ts`
   *  collision: newer DOM typings declare a `boolean`-typed `HTMLElement.autocorrect` IDL member,
   *  which conflicts with this component's `string`-typed property of the same name. The explicit
   *  attribute mapping preserves the standard lowercase `autocorrect` wire name in both Lit and
   *  generated component metadata. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  /** Forwarded to the internal date text input. Empty strings preserve the browser default. */
  @property() autocomplete = '';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';
  /** Overrides the internal `<input>`'s computed accessible name. Wins over
   *  `label`/`placeholder`/the localized `date` fallback in that order --
   *  see the `aria-label` binding in `render()`. Attribute-reflects from a
   *  host-level `aria-label` so a plain-markup consumer gets ARIA-name
   *  forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() override locale = '';
  @property({ converter: monthsConverter, reflect: true }) months: 1 | 2 = 1;
  @property({ attribute: 'first-day-of-week', reflect: true })
  firstDayOfWeek: LyraDateInputFirstDayOfWeek = 'auto';
  @property({
    attribute: 'weekday-format',
    converter: weekdayFormatConverter,
    reflect: true,
  })
  weekdayFormat: WeekdayFormat = 'short';

  /**
   * Quick-range options forwarded verbatim to the nested `<lr-date-picker>`; see that component's
   * own `presets` doc for the semantics. Range mode only, and unset renders nothing.
   *
   * Forwarded rather than reimplemented: the picker lives in this component's shadow root, so a
   * consumer has no route to it -- a CSS part cannot set a JS property -- and this compact
   * text-field-plus-popover shape is the one a dashboard time filter actually uses.
   */
  @property({ attribute: false }) presets: readonly LyraDateRangePreset[] = Object.freeze([]);

  private _appliedPreset?: LyraDateRangePreset;

  /**
   * The preset whose button produced the current `value`, or `undefined` when the value was picked
   * on the calendar, typed into the field, cleared, or reset. Read it inside your own
   * `change`/`input` handler.
   *
   * Mirrors the nested `<lr-date-picker>`'s own `appliedPreset` across this shadow boundary,
   * because the readback is what the compact popover shape needs most: a dashboard filter has to
   * persist WHICH preset is active rather than the pair it froze to -- "Last 7 days" must still
   * mean the last 7 days after tomorrow's reload. That fact is not recoverable from `value`:
   * re-deriving it by string-matching is the mapping table `presets` exists to delete, and it is
   * ambiguous anyway (Today and This month coincide on the 1st of a month, and a hand-picked range
   * can equal a preset's pair by construction). The picker instance itself is unreachable from
   * outside -- a CSS part cannot yield it -- so a consumer cannot read it there.
   *
   * A property rather than an event detail, for the same reason it is one on the picker:
   * `input`/`change` here are NATIVE events, deliberately indistinguishable from a manual
   * selection so existing handlers need no special case, and a native Event cannot carry a detail
   * without changing its type. The mirror is updated before those events are relayed, so a handler
   * reading it observes the preset that caused the very commit it is handling; it is `undefined`
   * while the popover has never been opened, since no preset button has run.
   */
  get appliedPreset(): LyraDateRangePreset | undefined {
    return this._appliedPreset;
  }
  @property({ type: Boolean, attribute: 'with-outside-days', reflect: true })
  withOutsideDays = false;
  @property({ type: Boolean, attribute: 'with-week-numbers', reflect: true })
  withWeekNumbers = false;
  @property({ attribute: 'disabled-dates' })
  disabledDates: LyraDatePickerDisabledDates = '';
  @property({ attribute: 'disabled-days-of-week' }) disabledDaysOfWeek = '';
  /** Optional JavaScript predicate that disables matching calendar dates. */
  @property({ attribute: false }) isDateDisabled?: (date: Date) => boolean;
  /** Optional JavaScript renderer for individual calendar-day content. */
  @property({ attribute: false }) dayContent?: LyraDatePickerDayContent;
  @property({ type: Number, attribute: 'min-range', reflect: true })
  minRange = 0;
  @property({ type: Number, attribute: 'max-range', reflect: true })
  maxRange = 0;
  @property({ converter: pageByConverter, attribute: 'page-by', reflect: true })
  pageBy: LyraDatePickerPageBy = 'months';
  @property({ reflect: true }) today = '';
  @property({ type: Number, reflect: true }) distance = 0;
  @property({ converter: placementConverter, reflect: true })
  placement: LyraDateInputPlacement = 'bottom-start';
  /** Event names that mark the control as user-interacted for `:state(user-*)` styling. */
  @property({ attribute: false }) assumeInteractionOn: string[] = ['input'];
  /** Additional JavaScript validators run after the intrinsic date constraints. Accepts a
   * function, an object with `validate(value, input)`, or the mapped object-validator shape with
   * `checkValidity(input)` and `{ isValid, message, invalidKeys }` results. Object validators can
   * list host `observedAttributes` that should trigger live revalidation. */
  @property({ attribute: false }) validators: LyraDateInputValidator[] = [];
  /** Accessible label for the clear button. Omitted copy localizes; explicit text,
   * including the built-in English label or an empty string, wins verbatim.
   * @default ''
   */
  @property({ attribute: 'clear-label' })
  clearLabel = '';
  private clearLabelAuthored = false;

  /** Accessible label for the calendar-toggle button. Omitted copy localizes; explicit text,
   * including the built-in English label or an empty string, wins verbatim.
   * @default ''
   */
  @property({ attribute: 'open-label' })
  openLabel = '';
  private openLabelAuthored = false;

  /** Accessible label for the calendar popover dialog. Omitted copy localizes; explicit text,
   * including the built-in English label or an empty string, wins verbatim.
   * @default 'Choose date'
   */
  @property({ attribute: 'dialog-label' })
  dialogLabel = 'Choose date';
  private dialogLabelAuthored = false;

  @query('input[part="input"]') private inputElement?: HTMLInputElement;
  private validationTargetOverride?: HTMLElement;
  /** Raw text the Enter key already committed, or `null`. Lets `onInputChange()` recognise -- and
   *  ignore -- the native `change` the browser fires for that very same keystroke, which would
   *  otherwise re-commit the identical text and emit a second `input`/`change` pair. */
  private enterCommittedText: string | null = null;
  /** Set while the field's own text commits; that text is already on screen. */
  private committingTypedText = false;
  private forcingClose = false;
  /** Whether the internal text field already relayed the native input event for the edit that is
   *  about to commit. Synthetic test/integration changes can arrive without a preceding input;
   *  those receive one generated InputEvent so every committed transition keeps the same public
   *  input/change sequence without duplicating real browser input events. */
  private inputRelayedSinceCommit = false;

  private cleanupFn?: DeferredOperationHandle;
  private readonly pointer = new DocumentPointerListener(this, (event) => this.onDocPointer(event));
  private visibilityListenerDocument?: Document;
  private visibilityListener?: () => void;
  private overlayHandle?: OverlayHandle;
  private restorePopupFocusOnClose = false;
  /** Removes the settled-closed calendar popup from layout (`[hidden]{display:none}`) so its
   *  stale last-placed box stops contributing to an ancestor's scrollable overflow. Cleared
   *  synchronously in `willUpdate()` before `place()` measures the popup, so the first
   *  measurement still sees a real box; re-set once the close transition settles. */
  @state() private popupHidden = true;
  /** Gates the popup's open-transition CSS separately from `popupHidden`: unhiding and becoming
   *  visible in the same render would skip the opacity/transform transition entirely (no prior
   *  painted frame to transition from), so this flips to `true` only once `place()` has actually
   *  positioned the popup, one render after `popupHidden` clears. */
  @state() private popupPositioned = false;
  private transitionToken = 0;
  private readonly transitionWaiters = new PopupTransitionWaiters<'lr-after-show' | 'lr-after-hide'>();
  private interactionListeners = new Map<string, EventListener>();
  private daySlotObserver?: MutationObserver;
  private disabledDateKeysCache?: [unknown, ReadonlySet<string>];
  private renderedDaySlots = '';
  private validatorAttributeObserver?: {
    observer: MutationObserver;
    owner: Window;
  };
  private localDescriptionIds = '';
  private externalDescription?: NativeControlDescriptionLease;
  private inputId = nextId('date-input');
  private popupId = nextId('date-popup');
  // Set on the date input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;

  static override get observedAttributes(): string[] {
    const attributes = super.observedAttributes;
    observeReactivePropertyWrites(this.prototype, ['clearLabel', 'openLabel', 'dialogLabel'], (instance: LyraDateInput, name, value) => {
      const authored = value != null;
      let ownershipChanged = false;
      switch (name) {
        case 'clearLabel':
          // The field initializer precedes its ownership flag; later equal writes are authored.
          if (instance.clearLabelAuthored === undefined) return;
          ownershipChanged = authored !== instance.clearLabelAuthored;
          instance.clearLabelAuthored = authored;
          break;
        case 'openLabel':
          // The field initializer precedes its ownership flag; later equal writes are authored.
          if (instance.openLabelAuthored === undefined) return;
          ownershipChanged = authored !== instance.openLabelAuthored;
          instance.openLabelAuthored = authored;
          break;
        case 'dialogLabel':
          // The field initializer precedes its ownership flag; later equal writes are authored.
          if (instance.dialogLabelAuthored === undefined) return;
          ownershipChanged = authored !== instance.dialogLabelAuthored;
          instance.dialogLabelAuthored = authored;
          break;
      }
      if (ownershipChanged) instance.requestUpdate();
    });
    return attributes;
  }

  constructor() {
    super();
    new GlassScrollLayer(this, '[part="popup"]', () => this.open);
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
  }
  // `[part]:empty` never matches — the part always contains a literal
  // `<slot>` child element regardless of assigned content — so real
  // emptiness is tracked in JS instead (same fix as lr-stat's
  // icon/caption) and reflected via `hidden`. Applies to
  // `form-control-label` too: the required-asterisk `::after` attaches to
  // that box, so leaving it always-visible orphans a stray ' *' when no
  // `label` is set.
  private get hasHintSlot(): boolean { return this.slotPresence.has('hint'); }
  private get hasErrorSlot(): boolean { return this.slotPresence.has('error'); }
  private readonly slotPresence = new SlotPresenceController(this);
  private get hasLabelSlot(): boolean { return this.slotPresence.has('label'); }
  private get hasStartSlot(): boolean { return this.slotPresence.has('start'); }
  private get hasEndSlot(): boolean { return this.slotPresence.has('end'); }
  @state() private validityRevision = 0;

  private _mode: 'single' | 'range' = 'single';
  private _min = '';
  private _max = '';
  private _open = false;
  private _readonly = false;
  private _disablePast = false;
  private _disableFuture = false;
  private typedBadInput = false;
  /** Clock seam for temporal validity and deterministic day-boundary tests. */
  private now = (): Date => new Date();

  get mode(): 'single' | 'range' {
    return this._mode;
  }

  set mode(next: 'single' | 'range') {
    const old = this._mode;
    this._mode = next === 'range' ? 'range' : 'single';
    this.internals.setFormValue(
      this.isIncompleteRangeValue(this.value) ? '' : this.value
    );
    this.updateValidity();
    this.syncCustomStates();
    this.requestUpdate('mode', old);
  }

  get min(): string {
    return this._min;
  }

  set min(next: string) {
    const old = this._min;
    this._min = next ?? '';
    this.updateValidity();
    this.requestUpdate('min', old);
  }

  get max(): string {
    return this._max;
  }

  set max(next: string) {
    const old = this._max;
    this._max = next ?? '';
    this.updateValidity();
    this.requestUpdate('max', old);
  }

  get readonly(): boolean {
    return this._readonly;
  }

  set readonly(next: boolean) {
    const old = this._readonly;
    this._readonly = Boolean(next);
    this.toggleAttribute('readonly', this._readonly);
    if (this._readonly) this.forceClose();
    this.updateValidity();
    this.requestUpdate('readonly', old);
  }

  override get disabled(): boolean {
    return super.disabled;
  }

  override set disabled(next: boolean) {
    super.disabled = next;
    if (next) this.forceClose();
    this.syncCustomStates();
  }

  get disablePast(): boolean {
    return this._disablePast;
  }

  set disablePast(next: boolean) {
    const old = this._disablePast;
    this._disablePast = Boolean(next);
    this.updateValidity();
    this.requestUpdate('disablePast', old);
  }

  get disableFuture(): boolean {
    return this._disableFuture;
  }

  set disableFuture(next: boolean) {
    const old = this._disableFuture;
    this._disableFuture = Boolean(next);
    this.updateValidity();
    this.requestUpdate('disableFuture', old);
  }

  /** The underlying date text input for platform-specific integrations. */
  get input(): HTMLInputElement | undefined {
    return this.inputElement;
  }

  get selectionStart(): number | null {
    return this.inputElement?.selectionStart ?? null;
  }

  set selectionStart(value: number | null) {
    if (this.inputElement) this.inputElement.selectionStart = value ?? 0;
  }

  get selectionEnd(): number | null {
    return this.inputElement?.selectionEnd ?? null;
  }

  set selectionEnd(value: number | null) {
    if (this.inputElement) this.inputElement.selectionEnd = value ?? 0;
  }

  get selectionDirection(): LyraDateInputSelectionDirection | null {
    return (
      (this.inputElement
        ?.selectionDirection as LyraDateInputSelectionDirection | null) ?? null
    );
  }

  set selectionDirection(value: LyraDateInputSelectionDirection | null) {
    if (this.inputElement)
      this.inputElement.selectionDirection = value ?? 'none';
  }

  override get value(): string {
    return super.value;
  }

  override set value(next: string) {
    this.setTypedBadInput(false);
    const old = super.value;
    const normalized = this.normalizeCommittedValue(next ?? '');
    super.value = normalized;
    // A first range endpoint is a real live UI value, but it is not yet a complete submitted
    // range. Native FormData still includes this named control with the empty-string value.
    this.internals.setFormValue(
      this.isIncompleteRangeValue(normalized) ? '' : normalized
    );
    this.syncCustomStates();
    if (normalized !== old) this.valueReplaced();
  }

  /** Ends the Enter commit window and shows a value that did not come from the typed text. */
  private valueReplaced(): void {
    this.enterCommittedText = null;
    if (!this.committingTypedText) {
      this.inputRelayedSinceCommit = false;
      if (this.inputElement) this.inputElement.value = this.displayText;
    }
  }

  get valueAsDate(): Date | null {
    return this.mode === 'single' ? this.parseStrictISO(this.value) : null;
  }

  set valueAsDate(next: Date | null) {
    this.value =
      isDateObject(next) && Number.isFinite(next.getTime())
        ? formatISO(next)
        : '';
  }

  /** Same as `valueAsDate`: the value at local midnight. */
  get valueAsLocalDate(): Date | null {
    return this.valueAsDate;
  }

  set valueAsLocalDate(next: Date | null) {
    this.valueAsDate = next;
  }

  /** The value at UTC midnight, like a native date input's `valueAsDate`. */
  get valueAsUTCDate(): Date | null {
    const local = this.valueAsDate;
    return local ? utcDate(local.getFullYear(), local.getMonth(), local.getDate()) : null;
  }

  set valueAsUTCDate(next: Date | null) {
    this.valueAsDate = isDateObject(next)
      ? localDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate())
      : null;
  }

  /** Date-range projection of `value`; writes normalize reversed endpoints and remain event-silent. */
  get valueAsRange(): DateRange {
    if (this.mode !== 'range') return { from: null, to: null };
    const [from = '', to = ''] = this.value.split('/');
    return { from: this.parseStrictISO(from), to: this.parseStrictISO(to) };
  }

  set valueAsRange(next: DateRange) {
    let from =
      isDateObject(next?.from) && Number.isFinite(next.from.getTime())
        ? next.from
        : null;
    let to =
      isDateObject(next?.to) && Number.isFinite(next.to.getTime())
        ? next.to
        : null;
    if (from && to && to < from) [from, to] = [to, from];
    this.value = from
      ? to
        ? `${formatISO(from)}/${formatISO(to)}`
        : formatISO(from)
      : '';
  }

  /** Native input used as the browser validation bubble's focus anchor. */
  get validationTarget(): HTMLElement | undefined {
    return this.validationTargetOverride ?? this.inputElement;
  }

  set validationTarget(next: HTMLElement | undefined) {
    const old = this.validationTarget;
    this.validationTargetOverride = next ?? undefined;
    this.requestUpdate('validationTarget', old);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    return this.validationTarget;
  }

  /** Clear consumer-supplied validity, then recompute intrinsic and configured validators. */
  override resetValidity(): void {
    this.setCustomValidity('');
    this.updateValidity();
  }

  private setTypedBadInput(next: boolean): void {
    const old = this.typedBadInput;
    this.typedBadInput = next;
    if (old !== next) this.requestUpdate('typedBadInput', old);
  }

  private parseStrictISO(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return parseISO(value);
  }

  private normalizeCommittedValue(value: string): string {
    if (value === '') return '';
    const parts = value.split('/');
    if (parts.length !== 1 && parts.length !== 2) return '';
    const dates = parts.map((part) => this.parseStrictISO(part));
    if (dates.some((date) => date === null)) return '';
    if (parts.length === 2 && dates[0]! > dates[1]!)
      return `${parts[1]}/${parts[0]}`;
    return value;
  }

  /** A single ISO date committed while in range mode -- the shape the nested
   *  picker's `commit()` produces after only the first click of a range pick
   *  (`from` set, `to` still null). This is a normal, transient in-progress
   *  selection, not a malformed value: it just hasn't picked up its second
   *  endpoint yet. */
  private isIncompleteRangeValue(value: string): boolean {
    return this.mode === 'range' && value !== '' && !value.includes('/');
  }

  private valueDates(value: string): Date[] | null {
    const parts = value.split('/');
    const expectedParts = this.mode === 'range' && parts.length === 2 ? 2 : 1;
    if (parts.length !== expectedParts) return null;
    const dates = parts.map((part) => this.parseStrictISO(part));
    return dates.some((date) => date === null) ? null : (dates as Date[]);
  }

  private get disabledDateKeys(): ReadonlySet<string> {
    const source = this.disabledDates;
    if (!this.disabledDateKeysCache || this.disabledDateKeysCache[0] !== source) {
      this.disabledDateKeysCache = [source, new Set(projectDisabledDateKeys(source))];
    }
    return this.disabledDateKeysCache[1];
  }

  private validatorResult(): { flags?: ValidityStateFlags; message?: string } {
    for (const validator of Array.isArray(this.validators)
      ? this.validators
      : []) {
      let result: LyraDateInputValidatorResult;
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
          return {
            flags,
            message: message || this.localize('dateInputInvalid'),
          };
        }
        result =
          typeof validator === 'function'
            ? validator(this.value, this)
            : validator?.validate(this.value, this);
      } catch {
        return {
          flags: { customError: true },
          message: this.localize('dateInputInvalid'),
        };
      }
      if (result === undefined || result === true) continue;
      if (typeof result === 'string')
        return { flags: { customError: true }, message: result };
      if (result === false)
        return {
          flags: { customError: true },
          message: this.localize('dateInputInvalid'),
        };
      if (
        result &&
        typeof result === 'object' &&
        Object.values(result).some(Boolean)
      ) {
        return { flags: result, message: this.localize('dateInputInvalid') };
      }
    }
    return {};
  }

  protected updateValidity(): void {
    // Every barring condition, not just `readonly`: an own/fieldset-cascaded `disabled` (and any
    // platform condition `willValidate` folds in) bars constraint validation exactly as `readonly`
    // does, and this override used to check only the one it happened to own — so a
    // `<lr-date-input required disabled>` kept publishing `valueMissing` and `:state(invalid)`.
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }

    const flags: ValidityStateFlags = {};
    let underflowMessage = '';
    let overflowMessage = '';
    const incompleteRange = this.isIncompleteRangeValue(this.value);
    if (this.required && (this.value === '' || incompleteRange))
      flags.valueMissing = true;
    if (this.typedBadInput) flags.badInput = true;

    if (this.value !== '') {
      const dates = this.valueDates(this.value);
      if (!dates) {
        flags.badInput = true;
      } else {
        const min = this.parseStrictISO(this.min);
        const max = this.parseStrictISO(this.max);
        const configuredToday = this.parseStrictISO(this.today);
        const now = configuredToday ?? this.now();
        const today = localDate(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        if (min !== null && dates.some((date) => date < min)) {
          flags.rangeUnderflow = true;
          underflowMessage = this.localize('dateInputMinMessage', undefined, {
            min: this.displayDate(min),
          });
        }
        if (this.disablePast && dates.some((date) => date < today)) {
          flags.rangeUnderflow = true;
          underflowMessage ||= this.localize('dateInputPastDisabled');
        }
        if (max !== null && dates.some((date) => date > max)) {
          flags.rangeOverflow = true;
          overflowMessage = this.localize('dateInputMaxMessage', undefined, {
            max: this.displayDate(max),
          });
        }
        if (this.disableFuture && dates.some((date) => date > today)) {
          flags.rangeOverflow = true;
          overflowMessage ||= this.localize('dateInputFutureDisabled');
        }
        const disabledDates = this.disabledDateKeys;
        const disabledWeekdays = parseDisabledWeekdays(this.disabledDaysOfWeek);
        let configuredDisabled = dates.some(
          (date) =>
            disabledDates.has(formatISO(date)) ||
            disabledWeekdays.has(date.getDay())
        );
        if (!configuredDisabled && this.isDateDisabled) {
          try {
            configuredDisabled = dates.some((date) =>
              Boolean(this.isDateDisabled?.(new Date(date.getTime())))
            );
          } catch {
            configuredDisabled = false;
          }
        }
        if (configuredDisabled) flags.customError = true;
        if (this.mode === 'range' && dates.length === 2) {
          const length = inclusiveDayCount(dates[0]!, dates[1]!);
          const minimum = finiteCount(this.minRange, 0);
          const maximum = finiteCount(this.maxRange, 0);
          if (minimum > 0 && length < minimum) {
            flags.rangeUnderflow = true;
            underflowMessage ||= this.localize('dateInputInvalid');
          }
          if (maximum > 0 && length > maximum) {
            flags.rangeOverflow = true;
            overflowMessage ||= this.localize('dateInputInvalid');
          }
        }
      }
    }

    const configured = this.validatorResult();
    if (configured.flags) Object.assign(flags, configured.flags);

    let message = '';
    if (configured.message) message = configured.message;
    else if (flags.badInput || flags.customError)
      message = this.localize('dateInputInvalid');
    else if (flags.rangeUnderflow) message = underflowMessage;
    else if (flags.rangeOverflow) message = overflowMessage;
    else if (flags.valueMissing) message = this.localize('fieldRequired');
    this[SET_ANCHORED_VALIDITY](flags, message);
  }

  override checkValidity(): boolean {
    this.updateValidity();
    return super.checkValidity();
  }

  override reportValidity(): boolean {
    this.updateValidity();
    return super.reportValidity();
  }

  private onVisibilityChange = (): void => {
    if (this.ownerDocument.visibilityState !== 'visible') return;
    this.updateValidity();
    this.validityRevision++;
  };

  private bindVisibilityListener(): void {
    if (!this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    if (
      this.visibilityListenerDocument === ownerDocument &&
      this.visibilityListener
    )
      return;
    this.unbindVisibilityListener();
    const listener = (): void => {
      if (
        this.visibilityListener !== listener ||
        this.visibilityListenerDocument !== ownerDocument ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onVisibilityChange();
    };
    this.visibilityListenerDocument = ownerDocument;
    this.visibilityListener = listener;
    ownerDocument.addEventListener('visibilitychange', listener);
  }

  private unbindVisibilityListener(): void {
    if (this.visibilityListenerDocument && this.visibilityListener) {
      this.visibilityListenerDocument.removeEventListener(
        'visibilitychange',
        this.visibilityListener
      );
    }
    this.visibilityListenerDocument = undefined;
    this.visibilityListener = undefined;
  }

  private displayDate(date: Date): string {
    return dateTimeFormat(this.effectiveLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(date);
  }

  private get displayText(): string {
    const parts = this.value.split('/');
    // parts[0] always exists (String.split() on '/' never returns an empty array); only
    // parts[1] (the range end) can be missing when `value` has no '/' separator.
    const from = parseISO(parts[0]!);
    const to = parseISO(parts[1] ?? '');
    if (!from) return '';
    const formatter = dateTimeFormat(this.effectiveLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const fmt = (d: Date) => formatter.format(d);
    if (this.mode !== 'range' || !to) return fmt(from);
    try {
      return formatter.formatRange(from, to);
    } catch {
      return `${fmt(from)} – ${fmt(to)}`;
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('open')) {
      if (this.open && this.isConnected) {
        this.bindDocumentPointer();
      } else {
        this.unbindDocumentPointer();
      }
      this.popupPositioned = false;
    }
    if (this.open) this.popupHidden = false;
  }

  /** Synchronous disabled truth for public actions, including an ancestor fieldset cascade that
   * can precede `formDisabledCallback()` and the next rendered native `disabled` attribute. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  /** Open the calendar popover, unless the cancelable `lr-show` request is vetoed. */
  show(): Promise<void> {
    if (this.open || this.liveDisabled || this.readonly)
      return Promise.resolve();
    const request = this.emit('lr-show', null, { cancelable: true });
    if (request.defaultPrevented) return Promise.resolve();
    this.transitionWaiters.resolve('lr-after-hide');
    const settled = this.transitionWaiters.wait('lr-after-show');
    this.open = true;
    void this.settleTransition('lr-after-show');
    return settled;
  }
  /** Close the calendar popover, unless the cancelable `lr-hide` request is vetoed. */
  hide(restoreFocus: boolean = false): Promise<void> {
    if (!this.open) return Promise.resolve();
    const request = this.emit('lr-hide', null, { cancelable: !this.forcingClose });
    if (request.defaultPrevented) return Promise.resolve();
    this.transitionWaiters.resolve('lr-after-show');
    const settled = this.transitionWaiters.wait('lr-after-hide');
    this.restorePopupFocusOnClose ||= restoreFocus;
    this.open = false;
    void this.settleTransition('lr-after-hide');
    return settled;
  }
  /** Closes with a non-cancelable `lr-hide`: a disabled or readonly field cannot stay open. */
  private forceClose(): void {
    this.forcingClose = true;
    try {
      void this.hide();
    } finally {
      this.forcingClose = false;
    }
  }

  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) void this.hide(false);
  };

  private bindDocumentPointer(): void {
    if (this.isConnected) this.pointer.bind();
  }

  private unbindDocumentPointer(): void {
    this.pointer.unbind();
  }

  private reconnectOpenPopup(): void {
    if (!this.isConnected || !this.open) return;
    this.bindDocumentPointer();
    this.cleanupFn?.();
    const anchor = this.renderRoot.querySelector(
      '[part="input-wrapper"]'
    ) as HTMLElement | null;
    const popup = this.renderRoot.querySelector(
      '[part="popup"]'
    ) as HTMLElement | null;
    if (!anchor || !popup) return;
    this.cleanupFn = place(anchor, popup, {
      placement: normalizeDateInputPlacement(this.placement),
      offset: finiteNumber(this.distance, 0),
      strategy: resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
    });
    {
      const operation = this.cleanupFn;
      void operation.ready.then((positioned) => {
        if (positioned && this.cleanupFn === operation && this.open && this.isConnected) {
          this.popupPositioned = true;
        }
      });
    }
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = activateNonmodalOverlay({
      host: this,
      panel: () =>
        this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null,
      onEscape: () => {
        void this.hide(true);
      },
    });
  }

  private async settleTransition(
    event: 'lr-after-show' | 'lr-after-hide'
  ): Promise<void> {
    const token = ++this.transitionToken;
    await settlePopupTransition({
      host: this,
      popup: () => this.renderRoot.querySelector('[part="popup"]'),
      isCurrent: () => this.transitionToken === token,
      waitForPosition: event === 'lr-after-show' ? async () => {
        const positioned = await waitForDeferredPlacement(() => this.cleanupFn);
        if (this.transitionToken !== token || !this.open) return false;
        if (!positioned) {
          this.transitionWaiters.resolve('lr-after-show');
          this.open = false;
          return false;
        }
        return true;
      } : undefined,
      conceal: event === 'lr-after-hide' ? () => { this.popupHidden = true; } : undefined,
      onSettled: () => {
        this.emit(event);
        this.transitionWaiters.resolve(event);
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.observeDaySlots();
    this.syncExternalDescription();
    this.bindVisibilityListener();
    this.syncInteractionListeners();
    this.syncValidatorAttributeObserver();
    this.syncCustomStates();
    if (this.hasUpdated && this.open)
      queueMicrotask(() => this.reconnectOpenPopup());
  }

  private daySlotNames(): string[] {
    return [
      ...new Set(
        Array.from(this.children ?? [])
          .map((child) => child.getAttribute('slot') ?? '')
          .filter((name) => /^day-\d{4}-\d{2}-\d{2}$/.test(name))
      ),
    ];
  }

  /** Re-renders when day content changes, so late day slots get forwarded. */
  private observeDaySlots(): void {
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    if (this.daySlotObserver || !Observer) return;
    this.daySlotObserver = new Observer(() => {
      if (this.daySlotNames().join(' ') !== this.renderedDaySlots) this.requestUpdate();
    });
    this.daySlotObserver.observe(this, { childList: true, subtree: true, attributeFilter: ['slot'] });
  }

  /** Unlike `clear()`, the clear button returns focus to the field. */
  private onClearClick = (): void => {
    this.clear();
    this.inputElement?.focus();
  };

  /** Clear the value (`input`, `change`, `lr-clear`); inert while blank, disabled or readonly. */
  clear(): void {
    if (!this.value || this.liveDisabled || this.readonly) return;
    // Matches how `onInputBlur` already flips this on the first blur -- an
    // explicit user-initiated clear() is itself an interaction, so a
    // required-and-now-empty field must surface its invalid state right
    // away instead of silently looking valid until some later blur.
    this.touched = true;
    // Nothing is selected any more, so no preset describes the value -- set before the events
    // below, which a consumer reads `appliedPreset` from.
    this._appliedPreset = undefined;
    this.value = '';
    this.inputRelayedSinceCommit = false;
    dispatchNativeInputEvent(this, { inputType: 'deleteContentBackward' });
    this.emit('lr-input', { value: '' });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: '' });
    this.emit('lr-clear');
  }

  private syncInteractionListeners(): void {
    const requested = new Set(
      (Array.isArray(this.assumeInteractionOn)
        ? this.assumeInteractionOn
        : []
      ).filter(
        (name): name is string => typeof name === 'string' && name.length > 0
      )
    );
    for (const [name, listener] of this.interactionListeners) {
      if (requested.has(name)) continue;
      this.removeEventListener(name, listener);
      this.interactionListeners.delete(name);
    }
    for (const name of requested) {
      if (this.interactionListeners.has(name)) continue;
      const listener: EventListener = () => {
        this.touched = true;
        this.syncCustomStates();
      };
      this.addEventListener(name, listener);
      this.interactionListeners.set(name, listener);
    }
  }

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

  private syncCustomStates(): void {
    setCustomState(this.internals, 'blank', this.value === '');
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
    setCustomState(this.internals, 'open', this.open);
    setCustomState(this.internals, 'range', this.mode === 'range');
  }

  override disconnectedCallback(): void {
    this.popupHidden = true;
    this.daySlotObserver?.disconnect();
    this.daySlotObserver = undefined;
    this.externalDescription?.release();
    this.externalDescription = undefined;
    this.transitionToken++;
    this.cleanupFn?.();
    this.cleanupFn = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindVisibilityListener();
    this.unbindDocumentPointer();
    this.disconnectValidatorAttributeObserver();
    this.restorePopupFocusOnClose = false;
    this.transitionWaiters.resolve('lr-after-show');
    this.transitionWaiters.resolve('lr-after-hide');
    for (const [name, listener] of this.interactionListeners)
      this.removeEventListener(name, listener);
    this.interactionListeners.clear();
    // One keystroke's worth of transient state; a reconnect starts from a clean slate rather than
    // carrying a token that could swallow the first `change` after it.
    this.enterCommittedText = null;
    this.inputRelayedSinceCommit = false;
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // stuck `true` across the disconnect, `updated()` never sees it
    // *change*, and `place()` never gets called again to re-bind
    // positioning to the (possibly relocated) anchor.
    this.open = false;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.externalDescription?.release();
    this.externalDescription = undefined;
    this.syncExternalDescription();
    this.cleanupFn?.();
    this.cleanupFn = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindVisibilityListener();
    this.unbindDocumentPointer();
    this.disconnectValidatorAttributeObserver();
  }

  private syncExternalDescription(): void {
    if (!this.isConnected) return;
    const input = this.renderRoot?.querySelector<HTMLInputElement>('input') ?? null;
    if (this.externalDescription) this.externalDescription.update(input);
    else this.externalDescription = acquireNativeControlDescription(this, input, () => this.localDescriptionIds);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncExternalDescription();
    if (
      changed.has('disabledDates') ||
      changed.has('disabledDaysOfWeek') ||
      changed.has('isDateDisabled') ||
      changed.has('minRange') ||
      changed.has('maxRange') ||
      changed.has('today') ||
      changed.has('validators')
    ) {
      this.updateValidity();
    }
    if (
      changed.has('open') ||
      (this.open && (changed.has('placement') || changed.has('distance')))
    ) {
      this.cleanupFn?.();
      this.cleanupFn = undefined;
      if (this.open && this.isConnected) {
        const anchor = this.renderRoot.querySelector(
          '[part="input-wrapper"]'
        ) as HTMLElement | null;
        const popup = this.renderRoot.querySelector(
          '[part="popup"]'
        ) as HTMLElement | null;
        if (anchor && popup) {
          this.cleanupFn = place(anchor, popup, {
            placement: normalizeDateInputPlacement(this.placement),
            offset: finiteNumber(this.distance, 0),
            strategy: resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
          });
          const operation = this.cleanupFn;
          void operation.ready.then((positioned) => {
            if (positioned && this.cleanupFn === operation && this.open && this.isConnected) {
              this.popupPositioned = true;
            }
          });
        }
      }
    }
    if (changed.has('open')) {
      if (this.open && this.isConnected) {
        const popup = this.renderRoot.querySelector(
          '[part="popup"]'
        ) as HTMLElement | null;
        if (popup) {
          this.overlayHandle = activateNonmodalOverlay({
            host: this,
            panel: () =>
              this.renderRoot.querySelector(
                '[part="popup"]'
              ) as HTMLElement | null,
            onEscape: () => {
              void this.hide(true);
            },
          });
        }
      } else if (!this.open) {
        // `restorePopupFocusOnClose` only rises through `hide(true)` (Escape, a finalized
        // selection). An application that closes the popup by assigning `open = false` never
        // reaches `hide()` at all -- and the popup hides to `visibility: hidden`, which
        // force-blurs whatever was focused inside it, stranding a keyboard user who was standing
        // on a calendar day onto `<body>`. So the live "focus is still inside the popup" term is
        // what keeps that path accessible; the flag alone is not sufficient. Read it here, before
        // the deactivation, because style recalc has not run yet at this point in `updated()`.
        // Outside-pointer dismissal (`hide(false)`) does reach this branch with focus still inside
        // the popup -- this render lands in a microtask, ahead of the press's own focus default
        // action -- so it hands the trigger one turn of focus. The press then immediately takes it
        // to whatever was clicked, or unfocuses over non-focusable content, so the target the user
        // pressed still wins; Chromium, Firefox and WebKit all agree on that ordering.
        const popup = this.renderRoot.querySelector(
          '[part="popup"]'
        ) as HTMLElement | null;
        const focusWasInsidePopup =
          popup !== null &&
          composedContains(popup, deepActiveElement(this.ownerDocument));
        this.overlayHandle?.deactivate({
          restoreFocus: this.restorePopupFocusOnClose || focusWasInsidePopup,
        });
        this.overlayHandle = undefined;
        this.restorePopupFocusOnClose = false;
      }
    }
    if (changed.has('assumeInteractionOn')) this.syncInteractionListeners();
    if (changed.has('validators')) this.syncValidatorAttributeObserver();
    this.syncCustomStates();
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value') ||
      changed.has('mode') ||
      changed.has('min') ||
      changed.has('max') ||
      changed.has('readonly') ||
      changed.has('disablePast') ||
      changed.has('disableFuture') ||
      changed.has('disabledDates') ||
      changed.has('disabledDaysOfWeek') ||
      changed.has('minRange') ||
      changed.has('maxRange') ||
      changed.has('validators') ||
      changed.has('typedBadInput') ||
      changed.has('validityRevision')
    ) {
      this.toggleAttribute(
        'data-invalid',
        this.touched && !this.internals.validity.valid
      );
    }
  }

  private commitTypedValue(next: string): void {
    this.committingTypedText = true;
    try {
      this.value = next;
    } finally {
      this.committingTypedText = false;
    }
  }

  /** Parses raw typed text and, if it resolves to a real date (or range),
   *  commits it as the new value; otherwise reverts the field to the last
   *  committed display text and flags bad input. Either branch keeps `value`,
   *  form value, and validity in sync, which is what lets this double as both
   *  the native `<input>`'s `change` handler and the implementation of the
   *  public `setRangeText()` editing method -- a programmatic edit of the same
   *  underlying text needs the identical parse-or-revert contract. Returns
   *  whether the text actually committed, so callers can decide whether to
   *  emit `input`/`change` (only a real, user-driven edit does). */
  private applyTypedText(raw: string): boolean {
    // Any real commit ends the "the Enter key just committed this" window (see `onInputKey`); the
    // Enter path itself re-arms the token immediately after calling in here.
    this.enterCommittedText = null;
    const trimmed = raw.trim();
    if (!trimmed) {
      // A hand-authored value did not come from a preset button -- the same reason the picker drops
      // its own copy on a calendar click. Only a commit that actually *changes* the value clears
      // it: unparseable text reverts to the last committed value below, and the parse path also
      // runs for text that merely re-derives the current value (a blur after an already-committed
      // edit, `setRangeText()` writing back what was already there), neither of which is a new
      // selection to attribute to the user.
      if (this.value !== '') this._appliedPreset = undefined;
      // The mixin's value setter recomputes validity (updateValidity()),
      // which clears any stale badInput state along the way.
      this.commitTypedValue('');
      return true;
    }
    const parsed =
      this.mode === 'range'
        ? this.parseRangeText(trimmed)
        : this.parseSingleText(trimmed);
    if (parsed) {
      if (parsed !== this.value) this._appliedPreset = undefined;
      this.commitTypedValue(parsed);
      return true;
    }
    // Unparseable text: don't silently keep the committed value while the
    // field still shows garbage -- revert the display to the last commit
    // and flag bad input. Parseable dates outside an active bound instead
    // commit above and expose their precise range validity state.
    if (this.inputElement) this.inputElement.value = this.displayText;
    this.setTypedBadInput(true);
    this.updateValidity();
    return false;
  }

  private onInputChange = (e: Event): void => {
    // The native `change` originates inside this shadow root. Always stop that source and expose
    // one host-originating equivalent below only when the raw text commits successfully.
    e.stopPropagation();
    if (this.liveDisabled) return;
    this.commitInputChange((e.target as HTMLInputElement).value, e);
  };

  private commitInputChange(raw: string, source?: Event): void {
    // The Enter key already committed this text (see `onInputKey`), and the browser fires its own
    // `change` for that same keystroke -- and again on the following blur, by which point the
    // re-render has replaced the typed text with the formatted `displayText`. Both are the same
    // commit, so both are ignored rather than re-emitting `input`/`change` for one edit. Both
    // conditions describe a no-op commit by construction (the text re-derives the value the
    // control already holds), so the token can safely outlive the first match; any genuinely
    // different text falls through, and any real commit clears it in `applyTypedText()`.
    if (
      this.enterCommittedText !== null &&
      (raw === this.enterCommittedText || raw === this.displayText)
    ) {
      return;
    }
    this.enterCommittedText = null;
    const committed = this.applyTypedText(raw);
    if (committed) {
      const value = this.value;
      if (!this.inputRelayedSinceCommit) {
        dispatchNativeInputEvent(this, { inputType: 'insertReplacementText' });
        this.emit('lr-input', { value });
      }
      this.inputRelayedSinceCommit = false;
      if (source) relayNativeEvent(this, source);
      else dispatchNativeEvent(this, 'change');
      this.emit('lr-change', { value });
    } else {
      this.inputRelayedSinceCommit = false;
    }
  }

  private onInput = (event: InputEvent): void => {
    event.stopPropagation();
    if (this.liveDisabled) return;
    this.enterCommittedText = null;
    this.inputRelayedSinceCommit = true;
    const value = this.value;
    relayNativeEvent(this, event);
    this.emit('lr-input', { value });
  };

  /** Three digit groups in the locale's day/month/year order; a 4-digit first group is the year. */
  private numericDate(groups: readonly string[]): Date | null {
    if (groups.length !== 3) return null;
    const order: DateField[] =
      groups[0]!.length === 4
        ? ['year', 'month', 'day']
        : localeDateOrder(this.effectiveLocale, 'gregory');
    const fields: DateFields = {};
    order.forEach((type, index) => {
      fields[type] = groups[index];
    });
    return dateFromFields(fields);
  }

  /** Own display shape, strict ISO, then digit groups; only spelled-out text hits Date.parse(). */
  private parseOneDate(raw: string): Date | null {
    const text = normalizeLocalizedDateText(raw, this.effectiveLocale);
    const patterns = localeDatePatterns(this.effectiveLocale);
    const own = matchDatePattern(patterns.single, text);
    if (own) return own[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return parseISO(text);
    const groups = text.match(/\d+/g) ?? [];
    if (!hasForeignLetters(text, patterns.letters)) return this.numericDate(groups);
    if (groups.length === 3) return null;
    const timestamp = Date.parse(text);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
  }

  private parseSingleText(raw: string): string | null {
    const parsed = this.parseOneDate(raw);
    return parsed ? formatISO(parsed) : null;
  }

  /** Literal joining the start/end ranges for this locale's Gregorian numeric formatter. */
  private localizedRangeSeparator(): string {
    const formatter = dateTimeFormat(this.effectiveLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    try {
      const parts = formatter.formatRangeToParts(
        localDate(2026, 0, 2),
        localDate(2026, 0, 3)
      );
      const firstEnd = parts.findIndex((part) => part.source === 'endRange');
      let lastStart = -1;
      for (let index = 0; index < firstEnd; index++) {
        if (parts[index]?.source === 'startRange') lastStart = index;
      }
      const separator = parts
        .slice(lastStart + 1, firstEnd)
        .map((part) => part.value)
        .join('');
      return normalizeLocalizedDateText(separator, this.effectiveLocale) || '–';
    } catch {
      return '–';
    }
  }

  /** Parses every range shape the field renders, raw ISO and six digit groups, in order. */
  private parseRangeText(raw: string): string | null {
    raw = normalizeLocalizedDateText(raw, this.effectiveLocale);
    if (
      raw ===
        normalizeLocalizedDateText(this.displayText, this.effectiveLocale) &&
      this.value.includes('/')
    ) {
      return this.normalizeCommittedValue(this.value);
    }
    if (/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(raw)) {
      // safe: the regex above guarantees exactly one '/', so split yields two defined parts
      const [a, b] = raw.split('/');
      const from = parseISO(a!);
      const to = parseISO(b!);
      if (!from || !to) return null;
      return from <= to ? raw : `${b}/${a}`;
    }
    const patterns = localeDatePatterns(this.effectiveLocale);
    let pair: [Date, Date] | null = null;
    for (const pattern of [...patterns.ranges, patterns.single]) {
      pair ??= matchDatePattern(pattern, raw);
    }
    if (!pair) {
      const groups = raw.match(/\d+/g) ?? [];
      if (!hasForeignLetters(raw, patterns.letters)) {
        if (groups.length !== 6) return null;
        const from = this.numericDate(groups.slice(0, 3));
        const to = this.numericDate(groups.slice(3));
        pair = from && to ? [from, to] : null;
      } else {
        const separator = this.localizedRangeSeparator();
        const idx = raw.indexOf(separator);
        if (idx === -1) return null;
        const from = this.parseOneDate(raw.slice(0, idx).trim());
        const to = this.parseOneDate(raw.slice(idx + separator.length).trim());
        pair = from && to ? [from, to] : null;
      }
    }
    if (!pair) return null;
    const [from, to] = pair[0] <= pair[1] ? pair : [pair[1], pair[0]];
    const start = formatISO(from);
    const end = formatISO(to);
    return start && end ? `${start}/${end}` : null;
  }

  private onInputKey = (e: KeyboardEvent): void => {
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      this.show();
      return;
    }
    if (this.liveDisabled || this.readonly) return;
    if (!isImplicitSubmission(e)) return;
    // Commit first, submit second. The submitted form value is read synchronously from
    // `ElementInternals`, and the typed text has not reached it yet -- the native `change` that
    // would normally commit it fires as part of this keystroke's own default action, i.e. after
    // this handler. Without this the form would carry the previously committed date (or nothing)
    // while the field visibly shows the new one.
    const input = this.inputElement;
    if (input && input.value !== this.displayText) {
      const raw = input.value;
      if (this.applyTypedText(raw)) {
        const value = this.value;
        if (!this.inputRelayedSinceCommit) {
          dispatchNativeInputEvent(this, {
            inputType: 'insertReplacementText',
          });
          this.emit('lr-input', { value });
        }
        this.inputRelayedSinceCommit = false;
        dispatchNativeEvent(this, 'change');
        this.emit('lr-change', { value });
      } else {
        this.inputRelayedSinceCommit = false;
      }
      // Set after the commit, since `applyTypedText()` clears the token itself.
      this.enterCommittedText = raw;
    }
    submitOnEnter(this, e);
  };

  private onInputBlur = (event: FocusEvent): void => {
    // A reset can leave the browser's last native-change baseline equal to retyped text.
    // Flush the pending edit even when that browser therefore omits change on blur.
    // A preceding native change already cleared the flag, so ordinary blur stays silent.
    if (!this.liveDisabled && this.inputRelayedSinceCommit && this.inputElement) {
      this.commitInputChange(this.inputElement.value);
    }
    // A blur the platform itself forces when a focused native control becomes `disabled` is not a
    // real user interaction -- marking `touched` for it could reenter an in-flight Lit update and
    // trip Lit's dev-mode "scheduled an update after an update completed" warning; this is the
    // same fix as <lr-input>'s onBlur.
    if (!this.liveDisabled) this.touched = true;
    relayNativeEvent(this, event);
  };

  private onInputFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  /** Activate the internal date text input unless the form control is effectively disabled. */
  override click(): void {
    if (!this.liveDisabled) this.inputElement?.click();
  }

  /** Focus the internal date text input unless the form control is effectively disabled. */
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.inputElement?.focus(options);
  }

  /** Blur the internal date text input. */
  override blur(): void {
    this.inputElement?.blur();
  }

  /** Select all editable date text. */
  select(): void {
    this.inputElement?.select();
  }

  /** Set the selection range in the editable date text. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: LyraDateInputSelectionDirection
  ): void {
    this.inputElement?.setSelectionRange(start, end, direction);
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
    const input = this.inputElement;
    if (!input) return;
    setNativeRangeText(input, replacement, start, end, selectMode);
    // Mirrors onInputChange's parse-or-revert contract for a programmatic
    // edit of the same underlying text -- keeps value/validity in sync
    // without emitting input/change (programmatic assignments stay silent).
    this.applyTypedText(input.value);
  }

  override formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete'
  ): void {
    this.value = typeof state === 'string' ? state : '';
  }

  override formResetCallback(): void {
    super.formResetCallback();
    // Like a native field, a reset discards uncommitted typed text.
    this.valueReplaced();
    this.touched = false;
    // A reset restores `defaultValue`, which is author-supplied markup rather than anything the
    // user chose from the quick-range row.
    this._appliedPreset = undefined;
  }

  formDisabledCallback(disabled: boolean): void {
    const parent = Object.getPrototypeOf(LyraDateInput.prototype) as {
      formDisabledCallback: (this: LyraDateInput, disabled: boolean) => void;
    };
    parent.formDisabledCallback.call(this, disabled);
    if (disabled) this.forceClose();
    this.syncCustomStates();
  }

  // The nested picker's `input` event isn't wired anywhere else, so without
  // this listener it bubbles+composes straight through this shadow boundary
  // (LyraElement.emit always dispatches bubbles:true, composed:true) and
  // fires on this host a *second* time, on top of the explicit emit below.
  private onPickerInput = (e: InputEvent): void => {
    e.stopPropagation();
    if (this.liveDisabled) return;
    const picker = e.target as LyraDatePicker;
    this.value = picker.value;
    // Mirrored BEFORE the relay below, so a consumer reading `appliedPreset` inside the handler
    // this very event runs sees the preset that caused it -- the picker sets its own copy before
    // committing, and clears it on a hand-pick, so both halves of the contract carry across.
    this._appliedPreset = picker.appliedPreset;
    this.inputRelayedSinceCommit = false;
    const value = this.value;
    relayNativeEvent(this, e);
    this.emit('lr-input', { value });
  };

  private onPickerChange = (e: Event): void => {
    e.stopPropagation();
    if (this.liveDisabled) return;
    const picker = e.target as LyraDatePicker;
    this.value = picker.value;
    this._appliedPreset = picker.appliedPreset;
    const value = this.value;
    relayNativeEvent(this, e);
    this.emit('lr-change', { value });
    // The picker only fires `change` once a selection is finalized (a single
    // pick, or the second click of a range), so this is always the right
    // moment to close, in either mode.
    this.hide(true);
  };

  override render(): TemplateResult {
    const hasValue = this.value.length > 0;
    const hasHint = this.withHint || this.hasHintSlot || (this.hint ?? '').length > 0;
    const hasError = this.hasErrorSlot || (this.errorText ?? '').length > 0;
    const hasLabel =
      this.withLabel || this.hasLabelSlot || (this.label ?? '').length > 0;
    const invalid = hasError || (this.touched && !this.internals.validity.valid);
    const describedBy = this.localDescriptionIds = [
      hasError ? 'date-input-error' : '',
      hasHint ? 'date-input-hint' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const dynamicDaySlots = this.daySlotNames();
    this.renderedDaySlots = dynamicDaySlots.join(' ');
    return html`
      <div part="date-input">
        <div part="base">
          <div part="form-control">
            <label
              part="form-control-label"
              for=${this.inputId}
              ?hidden=${!hasLabel}
            >
              <span part="label"
                >${this.label}<slot
                  name="label"
                ></slot
              ></span>
            </label>
            <div part="input-wrapper">
              <span part="start" ?hidden=${!this.hasStartSlot}>
                <slot name="start"></slot>
              </span>
              <span part="form-control-input">
                <span part="segment">
                  <span part="segment-literal" hidden></span>
                  <input
                    id=${this.inputId}
                    part="input"
                    type="text"
                    role="combobox"
                    aria-label=${this.accessibleLabel ??
                    (hasLabel
                      ? nothing
                      : this.placeholder || this.localize('date'))}
                    aria-describedby=${describedBy || nothing}
                    aria-required=${this.required ? 'true' : 'false'}
                    aria-invalid=${invalid ? 'true' : 'false'}
                    aria-haspopup="dialog"
                    aria-expanded=${this.open ? 'true' : 'false'}
                    aria-controls=${this.popupId}
                    spellcheck=${this.spellcheck}
                    autocapitalize=${this.autocapitalize || nothing}
                    autocorrect=${this.autoCorrect || nothing}
                    autocomplete=${this.autocomplete || nothing}
                    inputmode=${this.inputMode || nothing}
                    enterkeyhint=${this.enterKeyHint || nothing}
                    .value=${this.displayText}
                    placeholder=${this.placeholder}
                    ?required=${this.required}
                    ?disabled=${this.effectiveDisabled}
                    ?readonly=${this.readonly}
                    @input=${this.onInput}
                    @change=${this.onInputChange}
                    @keydown=${this.onInputKey}
                    @focus=${this.onInputFocus}
                    @blur=${this.onInputBlur}
                  />
                </span>
                <span part="range-separator" hidden aria-hidden="true">–</span>
              </span>
              ${(this.clearable || this.withClear) && hasValue
                ? html`<button
                    part="clear-button"
                    type="button"
                    ?disabled=${this.effectiveDisabled || this.readonly}
                    aria-label=${this.clearLabelAuthored ? this.clearLabel : this.localize('clear')}
                    @click=${this.onClearClick}
                  >
                    <span aria-hidden="true" inert
                      ><slot name="clear-icon">${closeIcon()}</slot></span
                    >
                  </button>`
                : nothing}
              <span part="end" ?hidden=${!this.hasEndSlot}>
                <slot name="end"></slot>
              </span>
              <button
                part="expand-button"
                type="button"
                aria-label=${this.openLabelAuthored ? this.openLabel : this.localize('openCalendar')}
                aria-haspopup="dialog"
                aria-expanded=${this.open ? 'true' : 'false'}
                aria-controls=${this.popupId}
                ?disabled=${this.effectiveDisabled || this.readonly}
                @click=${() => {
                  void (this.open ? this.hide() : this.show());
                }}
              >
                <span part="expand-icon" aria-hidden="true" inert
                  ><slot name="expand-icon">${calendarIcon()}</slot></span
                >
              </button>
            </div>
            <div
              id=${this.popupId}
              part="popup"
              ?hidden=${this.popupHidden}
              ?data-positioned=${this.popupPositioned}
              role="dialog"
              aria-hidden=${this.open ? 'false' : 'true'}
              aria-label=${this.dialogLabelAuthored ? this.dialogLabel : this.localize('chooseDate')}
            >
              <span class="glass-scroll-layer" aria-hidden="true"></span>
              ${this.popupHidden
                ? nothing
                : html`<lr-date-picker
                part="date-picker"
                .value=${this.value}
                .mode=${this.mode}
                .min=${this.min}
                .max=${this.max}
                .months=${normalizeCalendarMonths(this.months)}
                .size=${this.size}
                .locale=${this.effectiveMessageLocale}
                .disabled=${this.effectiveDisabled}
                .readonly=${this.readonly}
                .disabledDates=${this.disabledDates}
                .disabledDaysOfWeek=${this.disabledDaysOfWeek}
                .isDateDisabled=${this.isDateDisabled}
                .dayContent=${this.dayContent}
                .disablePast=${this.disablePast}
                .disableFuture=${this.disableFuture}
                .minRange=${finiteCount(this.minRange, 0)}
                .maxRange=${finiteCount(this.maxRange, 0)}
                .pageBy=${normalizeDateInputPageBy(this.pageBy)}
                .today=${this.today}
                .withOutsideDays=${this.withOutsideDays}
                .withWeekNumbers=${this.withWeekNumbers}
                .firstDayOfWeek=${this.firstDayOfWeek}
                .weekdayFormat=${normalizeWeekdayFormat(this.weekdayFormat)}
                .presets=${this.presets}
                exportparts="presets, preset-button"
                @lr-input=${(event: Event) => event.stopPropagation()}
                @lr-change=${(event: Event) => event.stopPropagation()}
                @input=${this.onPickerInput}
                @change=${this.onPickerChange}
                @lr-focus-day=${(event: Event) => event.stopPropagation()}
                @lr-view-change=${(event: Event) => event.stopPropagation()}
              >
                <slot name="previous-icon" slot="previous-icon"
                  >${chevronIcon()}</slot
                >
                <slot name="next-icon" slot="next-icon">${chevronIcon()}</slot>
                <slot name="footer" slot="footer"></slot>
                ${dynamicDaySlots.map(
                  (name) => html`<slot name=${name} slot=${name}></slot>`
                )}
              </lr-date-picker>`}
            </div>
            <div id="date-input-error" part="error" ?hidden=${!hasError}>
              ${this.errorText}<slot
                name="error"
              ></slot>
            </div>
            <div id="date-input-hint" part="hint" ?hidden=${!hasHint}>
              ${this.hint}<slot
                name="hint"
              ></slot>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-date-input': LyraDateInput;
  }
}
