import {
  html,
  nothing,
  type ComplexAttributeConverter,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { property, state, query } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import {
  FormAssociated,
  isBarredFromValidation,
} from "../../../internal/form-associated.js";
import {
  SET_ANCHORED_VALIDITY,
  VALIDITY_ANCHOR,
} from "../../../internal/anchored-validity.js";
import { place } from "../../../internal/positioner.js";
import { nextId } from "../../../internal/a11y.js";
import {
  closeIcon,
  calendarIcon,
  chevronIcon,
} from "../../../internal/icons.js";
import {
  activateOverlay,
  type OverlayHandle,
} from "../../../internal/overlay-manager.js";
import { setCustomState } from "../../../internal/custom-states.js";
import { finiteCount, finiteNumber } from "../../../internal/numbers.js";
import { isDateObject } from "../../../internal/dom-guards.js";
import { getNumberFormat } from "../../../internal/intl-cache.js";
import {
  dateTimeFormat,
  parseISO,
  formatISO,
  localDate,
  utcDate,
  normalizeCalendarMonths,
  normalizeWeekdayFormat,
  type WeekdayFormat,
} from "./calendar-core.js";
import { sizes } from "../../../internal/sizes.styles.js";
import type { LyraAppearance, LyraSize } from "../../../internal/variants.js";
import { styles } from "./date-input.styles.js";
import {
  LyraDatePicker,
  type DateRange,
  type LyraDatePickerDayContent,
  type LyraDatePickerDisabledDates,
  type LyraDatePickerFirstDayOfWeek,
  type LyraDatePickerPageBy,
} from "./date-picker.class.js";
import "./date-picker.class.js";
import { spellcheckFromAttributeConverter as spellcheckConverter } from "../../../internal/converters.js";
import {
  isImplicitSubmission,
  submitOnEnter,
} from "../../../internal/submit-on-enter.js";
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from "../../../internal/native-event-relay.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from "../../../internal/localization.js";
import {
  LYRA_DEFAULT_chooseDate,
  LYRA_DEFAULT_clear,
  LYRA_DEFAULT_date,
  LYRA_DEFAULT_dateInputFutureDisabled,
  LYRA_DEFAULT_dateInputInvalid,
  LYRA_DEFAULT_dateInputMaxMessage,
  LYRA_DEFAULT_dateInputMinMessage,
  LYRA_DEFAULT_dateInputPastDisabled,
  LYRA_DEFAULT_fieldRequired,
  LYRA_DEFAULT_openCalendar,
} from "../../../internal/default-strings.generated.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Determines the locale's day/month/year field order from a real formatted
 *  sample (Jan 2, 2026 -- a date where day/month/year are all numerically
 *  distinguishable), instead of relying on Date.parse()'s implementation-defined
 *  (commonly mm/dd/yyyy-biased) heuristics for an ambiguous separated date. */
function localeDateOrder(locale: string): ("day" | "month" | "year")[] {
  try {
    const parts = dateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(2026, 0, 2));
    const order = parts
      .filter(
        (
          p
        ): p is Intl.DateTimeFormatPart & { type: "day" | "month" | "year" } =>
          p.type === "day" || p.type === "month" || p.type === "year"
      )
      .map((p) => p.type);
    return order.length === 3 ? order : ["month", "day", "year"];
  } catch {
    return ["month", "day", "year"]; // Date.parse()'s own bias, as a last-resort fallback
  }
}

const BIDI_FORMATTING_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Normalizes the locale digits and bidi marks the component itself can render before parsing. */
function normalizeLocalizedDateText(raw: string, locale: string): string {
  let normalized = raw.replace(BIDI_FORMATTING_MARKS, "");
  try {
    const formatter = getNumberFormat(locale || undefined, {
      useGrouping: false,
    });
    for (let digit = 0; digit <= 9; digit++) {
      const localized = formatter
        .format(digit)
        .replace(BIDI_FORMATTING_MARKS, "");
      if (localized && localized !== String(digit))
        normalized = normalized.split(localized).join(String(digit));
    }
  } catch {
    // Malformed runtime locale: ASCII input remains available.
  }
  return normalized.trim();
}

const monthsConverter: ComplexAttributeConverter<1 | 2> = {
  fromAttribute: normalizeCalendarMonths,
  toAttribute: normalizeCalendarMonths,
};

const weekdayFormatConverter: ComplexAttributeConverter<WeekdayFormat> = {
  fromAttribute: normalizeWeekdayFormat,
  toAttribute: normalizeWeekdayFormat,
};

function normalizeDateInputAppearance(
  value: unknown
): Extract<LyraAppearance, "filled" | "outlined" | "filled-outlined"> {
  return value === "filled" || value === "filled-outlined" ? value : "outlined";
}

const appearanceConverter: ComplexAttributeConverter<
  Extract<LyraAppearance, "filled" | "outlined" | "filled-outlined">
> = {
  fromAttribute: normalizeDateInputAppearance,
  toAttribute: normalizeDateInputAppearance,
};

const placements: ReadonlySet<string> = new Set([
  "top",
  "top-start",
  "top-end",
  "right",
  "right-start",
  "right-end",
  "bottom",
  "bottom-start",
  "bottom-end",
  "left",
  "left-start",
  "left-end",
]);

function normalizeDateInputPlacement(value: unknown): LyraDateInputPlacement {
  return typeof value === "string" && placements.has(value)
    ? (value as LyraDateInputPlacement)
    : "bottom-start";
}

const placementConverter: ComplexAttributeConverter<LyraDateInputPlacement> = {
  fromAttribute: normalizeDateInputPlacement,
  toAttribute: normalizeDateInputPlacement,
};

function normalizeDateInputPageBy(value: unknown): LyraDatePickerPageBy {
  return value === "single" ? "single" : "months";
}

const pageByConverter: ComplexAttributeConverter<LyraDatePickerPageBy> = {
  fromAttribute: normalizeDateInputPageBy,
  toAttribute: normalizeDateInputPageBy,
};

export type LyraDateInputSelectionDirection = "forward" | "backward" | "none";
export type LyraDateInputPlacement =
  | "top"
  | "top-start"
  | "top-end"
  | "right"
  | "right-start"
  | "right-end"
  | "bottom"
  | "bottom-start"
  | "bottom-end"
  | "left"
  | "left-start"
  | "left-end";
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
  invalidKeys: Exclude<keyof ValidityState, "valid">[];
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
  "badInput",
  "customError",
  "patternMismatch",
  "rangeOverflow",
  "rangeUnderflow",
  "stepMismatch",
  "tooLong",
  "tooShort",
  "typeMismatch",
  "valueMissing",
]);

function isValidityFlagKey(value: unknown): value is keyof ValidityStateFlags {
  return typeof value === "string" && VALIDITY_FLAG_KEYS.has(value);
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
  "lr-invalid": CustomEvent<null>;
  "lr-show": CustomEvent<null>;
  "lr-after-show": CustomEvent<null>;
  "lr-hide": CustomEvent<null>;
  "lr-after-hide": CustomEvent<null>;
  "lr-clear": CustomEvent<null>;
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
 * default `m`. The calendar-toggle and clear buttons keep a constant touch-target size at every
 * tier (mirroring `lr-input`'s own password-toggle button), so only the field's density scales.
 * In a constrained row the editable input shrinks first, while each public `start`/`end`
 * adornment is capped at 40% so unbroken consumer content cannot widen the field.
 *
 * @customElement lr-date-input
 * @event {InputEvent} input - Fired on edits as a bubbling, composed, non-cancelable native event.
 * @event {Event} change - Fired on committed date transitions as a bubbling, composed,
 *   non-cancelable native event.
 * @event lr-show - Fired before the calendar popover opens; cancelable.
 * @event lr-after-show - The calendar popover finished opening.
 * @event lr-hide - Fired before the calendar popover closes; cancelable.
 * @event lr-after-hide - The calendar popover finished closing.
 * @event lr-clear - The clear button was used.
 * @event {FocusEvent} blur - Re-dispatched from the internal `<input>`'s own `blur` as a bubbling,
 *   composed, non-cancelable event, unlike the native event.
 * @event {FocusEvent} focus - Re-dispatched from the internal `<input>`'s own `focus` as a
 *   bubbling, composed, non-cancelable event, unlike the native event.
 * @event lr-invalid - The date input failed a validity check; cancelable. Calling
 *   `preventDefault()` also cancels the native `invalid` event it aliases, suppressing the
 *   browser's own validation bubble and `reportValidity()`'s focus/scroll.
 * @csspart date-input - The date-input wrapper.
 * @csspart base - Deprecated alias wrapper for `date-input`.
 * @csspart form-control - The outer form-control wrapper.
 * @csspart form-control-label - The label wrapper.
 * @csspart label - Deprecated label alias.
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
 * @csspart date-picker - The nested date picker.
 * @csspart hint - The hint message.
 * @csspart error - The validation message.
 * @cssprop [--lr-date-input-padding-block=var(--lr-space-xs)] - Block padding of the input row, scaled by `size`.
 * @cssprop [--lr-date-input-padding-inline=var(--lr-space-s)] - Inline padding of the input row, scaled by `size`.
 * @cssprop [--lr-date-input-font-size=inherit] - Font size of the text input, scaled by `size`.
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
 *   `--lr-theme-form-control-height-*` moves this control and every sibling field together. Each
 *   default sits below the row's transitively-pinned height, so it is dead until a consumer raises
 *   it -- the unset render is unchanged.
 * @cssprop --lr-date-input-control-height - Exact block size of the input row. Undeclared by
 *   default, so the row grows to fit its content (floored by `--lr-date-input-control-min-height`).
 *   Set it to pin a fixed height; the calendar toggle keeps its own 24x24 touch target even when
 *   this pins a shorter row.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Popup enter-transition duration.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Popup exit-transition duration.
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
 * @status experimental
 * @since 4.0.0
 */
export class LyraDateInput extends FormAssociated(LyraDateInputBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> =
    {
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
      attribute: "disable-past",
      reflect: true,
      noAccessor: true,
    },
    disableFuture: {
      type: Boolean,
      attribute: "disable-future",
      reflect: true,
      noAccessor: true,
    },
  };

  @property({ converter: appearanceConverter, reflect: true })
  appearance: Extract<
    LyraAppearance,
    "filled" | "outlined" | "filled-outlined"
  > = "outlined";
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
      (typeof this.matches === "function" && this.matches(":disabled"));
    this._open = Boolean(next) && !this.readonly && !liveDisabled;
    if (this._open === old) {
      if (next && !this._open && this.hasAttribute("open"))
        this.removeAttribute("open");
      return;
    }
    this.requestUpdate("open", old);
  }
  @property({ type: Boolean, attribute: "with-clear" }) withClear = false;
  @property({ type: Boolean, attribute: "with-hint" }) withHint = false;
  @property({ type: Boolean, attribute: "with-label" }) withLabel = false;
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with
   *  `lr-input`/`lr-select`/`lr-combobox`. `'2xs'` is the tightest tier, for dense
   *  toolbar-embedded fields. The Web Awesome / Shoelace spellings `small`/`medium`/`large` are
   *  accepted for `s`/`m`/`l`, so a migration is a tag rename with no attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = "m";
  /** Rounds the input row's corners to a full pill, mirroring `lr-input`'s own `pill`. It is a
   *  single override of `--lr-date-input-radius`, so a consumer setting that property directly
   *  still wins for a bespoke shape. */
  @property({ type: Boolean, reflect: true }) pill = false;
  @property() label = "";
  @property() hint = "";
  @property({ attribute: "error-text" }) errorText = "";
  @property() placeholder = "";
  /** Forwarded to the internal `<input>`'s own `spellcheck`. Defaults to `true`, matching the
   *  native element's own default. Uses {@link spellcheckConverter} rather than Lit's default
   *  presence-based `type: Boolean` converter -- see that converter's doc comment. A bare
   *  `.spellcheck` property binding can still turn this off with `spellcheck="false"`; a Lit
   *  template can do the same with either that attribute string or a `.spellcheck=${false}`
   *  binding. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the internal `<input>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = "";
  /** Forwarded to the internal `<input>`'s own `autocorrect` (Safari/WebKit-specific). Empty
   *  string omits the attribute (browser default).
   *  Named `autoCorrect` (capital `C`), not `autocorrect`, purely to dodge a TS `lib.dom.d.ts`
   *  collision: newer DOM typings declare a `boolean`-typed `HTMLElement.autocorrect` IDL member,
   *  which conflicts with this component's `string`-typed property of the same name. The explicit
   *  attribute mapping preserves the standard lowercase `autocorrect` wire name in both Lit and
   *  generated component metadata. */
  @property({ attribute: "autocorrect" }) autoCorrect = "";
  /** Forwarded to the internal date text input. Empty strings preserve the browser default. */
  @property() autocomplete = "";
  @property({ attribute: "inputmode" }) override inputMode = "";
  @property({ attribute: "enterkeyhint" }) override enterKeyHint = "";
  /** Overrides the internal `<input>`'s computed accessible name. Wins over
   *  `label`/`placeholder`/the localized `date` fallback in that order --
   *  see the `aria-label` binding in `render()`. Attribute-reflects from a
   *  host-level `aria-label` so a plain-markup consumer gets ARIA-name
   *  forwarding without setting a JS property. */
  @property({ attribute: "aria-label" }) accessibleLabel: string | null = null;
  @property() override locale = "";
  @property({ converter: monthsConverter, reflect: true }) months: 1 | 2 = 1;
  @property({ attribute: "first-day-of-week", reflect: true })
  firstDayOfWeek: LyraDateInputFirstDayOfWeek = "auto";
  @property({
    attribute: "weekday-format",
    converter: weekdayFormatConverter,
    reflect: true,
  })
  weekdayFormat: WeekdayFormat = "short";
  @property({ type: Boolean, attribute: "with-outside-days", reflect: true })
  withOutsideDays = false;
  @property({ type: Boolean, attribute: "with-week-numbers", reflect: true })
  withWeekNumbers = false;
  @property({ attribute: "disabled-dates" })
  disabledDates: LyraDatePickerDisabledDates = "";
  @property({ attribute: "disabled-days-of-week" }) disabledDaysOfWeek = "";
  /** Optional JavaScript predicate that disables matching calendar dates. */
  @property({ attribute: false }) isDateDisabled?: (date: Date) => boolean;
  /** Optional JavaScript renderer for individual calendar-day content. */
  @property({ attribute: false }) dayContent?: LyraDatePickerDayContent;
  @property({ type: Number, attribute: "min-range", reflect: true })
  minRange = 0;
  @property({ type: Number, attribute: "max-range", reflect: true })
  maxRange = 0;
  @property({ converter: pageByConverter, attribute: "page-by", reflect: true })
  pageBy: LyraDatePickerPageBy = "months";
  @property({ reflect: true }) today = "";
  @property({ type: Number, reflect: true }) distance = 0;
  @property({ converter: placementConverter, reflect: true })
  placement: LyraDateInputPlacement = "bottom-start";
  /** Event names that mark the control as user-interacted for `:state(user-*)` styling. */
  @property({ attribute: false }) assumeInteractionOn: string[] = ["input"];
  /** Additional JavaScript validators run after the intrinsic date constraints. Accepts a
   * function, an object with `validate(value, input)`, or the mapped object-validator shape with
   * `checkValidity(input)` and `{ isValid, message, invalidKeys }` results. Object validators can
   * list host `observedAttributes` that should trigger live revalidation. */
  @property({ attribute: false }) validators: LyraDateInputValidator[] = [];
  /** Accessible label for the clear button. Override for a non-English `locale`. */
  @property({ attribute: "clear-label" }) clearLabel = "";
  /** Accessible label for the calendar-toggle button. Override for a non-English `locale`. */
  @property({ attribute: "open-label" }) openLabel = "";
  /** Accessible name for the calendar popover dialog. Left at the built-in default it
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring this to be set; an explicit override wins verbatim. */
  @property({ attribute: "dialog-label" }) dialogLabel = "Choose date";

  @query('input[part="input"]') private inputElement?: HTMLInputElement;
  private validationTargetOverride?: HTMLElement;
  /** Raw text the Enter key already committed, or `null`. Lets `onInputChange()` recognise -- and
   *  ignore -- the native `change` the browser fires for that very same keystroke, which would
   *  otherwise re-commit the identical text and emit a second `input`/`change` pair. */
  private enterCommittedText: string | null = null;
  /** Whether the internal text field already relayed the native input event for the edit that is
   *  about to commit. Synthetic test/integration changes can arrive without a preceding input;
   *  those receive one generated InputEvent so every committed transition keeps the same public
   *  input/change sequence without duplicating real browser input events. */
  private inputRelayedSinceCommit = false;

  private cleanupFn?: () => void;
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private visibilityListenerDocument?: Document;
  private visibilityListener?: () => void;
  private overlayHandle?: OverlayHandle;
  private restorePopupFocusOnClose = false;
  private transitionToken = 0;
  private transitionWaiters = new Map<
    "lr-after-show" | "lr-after-hide",
    Set<() => void>
  >();
  private interactionListeners = new Map<string, EventListener>();
  private validatorAttributeObserver?: {
    observer: MutationObserver;
    owner: Window;
  };
  private inputId = nextId("date-input");
  private popupId = nextId("date-popup");
  // Set on the date input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;

  constructor() {
    super();
    this.addEventListener("invalid", () => {
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
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;
  @state() private validityRevision = 0;

  private _mode: "single" | "range" = "single";
  private _min = "";
  private _max = "";
  private _open = false;
  private _readonly = false;
  private _disablePast = false;
  private _disableFuture = false;
  private typedBadInput = false;
  /** Clock seam for temporal validity and deterministic day-boundary tests. */
  private now = (): Date => new Date();

  get mode(): "single" | "range" {
    return this._mode;
  }

  set mode(next: "single" | "range") {
    const old = this._mode;
    this._mode = next === "range" ? "range" : "single";
    this.internals.setFormValue(
      this.isIncompleteRangeValue(this.value) ? "" : this.value
    );
    this.updateValidity();
    this.syncCustomStates();
    this.requestUpdate("mode", old);
  }

  get min(): string {
    return this._min;
  }

  set min(next: string) {
    const old = this._min;
    this._min = next ?? "";
    this.updateValidity();
    this.requestUpdate("min", old);
  }

  get max(): string {
    return this._max;
  }

  set max(next: string) {
    const old = this._max;
    this._max = next ?? "";
    this.updateValidity();
    this.requestUpdate("max", old);
  }

  get readonly(): boolean {
    return this._readonly;
  }

  set readonly(next: boolean) {
    const old = this._readonly;
    this._readonly = Boolean(next);
    this.toggleAttribute("readonly", this._readonly);
    if (this._readonly) void this.hide();
    this.updateValidity();
    this.requestUpdate("readonly", old);
  }

  override get disabled(): boolean {
    return super.disabled;
  }

  override set disabled(next: boolean) {
    super.disabled = next;
    if (next) void this.hide();
    this.syncCustomStates();
  }

  get disablePast(): boolean {
    return this._disablePast;
  }

  set disablePast(next: boolean) {
    const old = this._disablePast;
    this._disablePast = Boolean(next);
    this.updateValidity();
    this.requestUpdate("disablePast", old);
  }

  get disableFuture(): boolean {
    return this._disableFuture;
  }

  set disableFuture(next: boolean) {
    const old = this._disableFuture;
    this._disableFuture = Boolean(next);
    this.updateValidity();
    this.requestUpdate("disableFuture", old);
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
      this.inputElement.selectionDirection = value ?? "none";
  }

  override get value(): string {
    return super.value;
  }

  override set value(next: string) {
    this.setTypedBadInput(false);
    const normalized = this.normalizeCommittedValue(next ?? "");
    super.value = normalized;
    // A first range endpoint is a real live UI value, but it is not yet a complete submitted
    // range. Native FormData still includes this named control with the empty-string value.
    this.internals.setFormValue(
      this.isIncompleteRangeValue(normalized) ? "" : normalized
    );
    this.syncCustomStates();
  }

  get valueAsDate(): Date | null {
    return this.mode === "single" ? this.parseStrictISO(this.value) : null;
  }

  set valueAsDate(next: Date | null) {
    this.value =
      isDateObject(next) && Number.isFinite(next.getTime())
        ? formatISO(next)
        : "";
  }

  /** Date-range projection of `value`; writes normalize reversed endpoints and remain event-silent. */
  get valueAsRange(): DateRange {
    if (this.mode !== "range") return { from: null, to: null };
    const [from = "", to = ""] = this.value.split("/");
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
      : "";
  }

  /** Native input used as the browser validation bubble's focus anchor. */
  get validationTarget(): HTMLElement | undefined {
    return this.validationTargetOverride ?? this.inputElement;
  }

  set validationTarget(next: HTMLElement | undefined) {
    const old = this.validationTarget;
    this.validationTargetOverride = next ?? undefined;
    this.requestUpdate("validationTarget", old);
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | undefined {
    return this.validationTarget;
  }

  /** Clear consumer-supplied validity, then recompute intrinsic and configured validators. */
  override resetValidity(): void {
    this.setCustomValidity("");
    this.updateValidity();
  }

  private setTypedBadInput(next: boolean): void {
    const old = this.typedBadInput;
    this.typedBadInput = next;
    if (old !== next) this.requestUpdate("typedBadInput", old);
  }

  private parseStrictISO(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return parseISO(value);
  }

  private normalizeCommittedValue(value: string): string {
    if (value === "") return "";
    const parts = value.split("/");
    if (parts.length !== 1 && parts.length !== 2) return "";
    const dates = parts.map((part) => this.parseStrictISO(part));
    if (dates.some((date) => date === null)) return "";
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
    return this.mode === "range" && value !== "" && !value.includes("/");
  }

  private valueDates(value: string): Date[] | null {
    const parts = value.split("/");
    const expectedParts = this.mode === "range" && parts.length === 2 ? 2 : 1;
    if (parts.length !== expectedParts) return null;
    const dates = parts.map((part) => this.parseStrictISO(part));
    return dates.some((date) => date === null) ? null : (dates as Date[]);
  }

  private configuredDisabledDateKeys(): Set<string> {
    const values = Array.isArray(this.disabledDates)
      ? this.disabledDates
      : String(this.disabledDates || "").split(/[\s,]+/);
    return new Set(
      values
        .map((value) => (isDateObject(value) ? value : parseISO(String(value))))
        .filter(
          (value): value is Date =>
            isDateObject(value) && Number.isFinite(value.getTime())
        )
        .map((value) => formatISO(value))
    );
  }

  private configuredDisabledWeekdays(): Set<number> {
    const names: Record<string, number> = {
      sun: 0,
      sunday: 0,
      mon: 1,
      monday: 1,
      tue: 2,
      tues: 2,
      tuesday: 2,
      wed: 3,
      wednesday: 3,
      thu: 4,
      thur: 4,
      thurs: 4,
      thursday: 4,
      fri: 5,
      friday: 5,
      sat: 6,
      saturday: 6,
    };
    return new Set(
      String(this.disabledDaysOfWeek || "")
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(
          (value) =>
            names[value] ?? (/^[0-6]$/.test(value) ? Number(value) : -1)
        )
        .filter((value) => value >= 0)
    );
  }

  private rangeLength(from: Date, to: Date): number {
    const fromUtc = utcDate(
      from.getFullYear(),
      from.getMonth(),
      from.getDate()
    ).getTime();
    const toUtc = utcDate(
      to.getFullYear(),
      to.getMonth(),
      to.getDate()
    ).getTime();
    return Math.round(Math.abs(toUtc - fromUtc) / 86_400_000) + 1;
  }

  private validatorResult(): { flags?: ValidityStateFlags; message?: string } {
    for (const validator of Array.isArray(this.validators)
      ? this.validators
      : []) {
      let result: LyraDateInputValidatorResult;
      try {
        if (
          typeof validator === "object" &&
          validator !== null &&
          "checkValidity" in validator
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
            typeof checked?.message === "string" ? checked.message : "";
          if (!message && typeof validator.message === "string")
            message = validator.message;
          if (!message && typeof validator.message === "function") {
            message = validator.message(this as never);
          }
          return {
            flags,
            message: message || this.localize("dateInputInvalid"),
          };
        }
        result =
          typeof validator === "function"
            ? validator(this.value, this)
            : validator?.validate(this.value, this);
      } catch {
        return {
          flags: { customError: true },
          message: this.localize("dateInputInvalid"),
        };
      }
      if (result === undefined || result === true) continue;
      if (typeof result === "string")
        return { flags: { customError: true }, message: result };
      if (result === false)
        return {
          flags: { customError: true },
          message: this.localize("dateInputInvalid"),
        };
      if (
        result &&
        typeof result === "object" &&
        Object.values(result).some(Boolean)
      ) {
        return { flags: result, message: this.localize("dateInputInvalid") };
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
    let underflowMessage = "";
    let overflowMessage = "";
    const incompleteRange = this.isIncompleteRangeValue(this.value);
    if (this.required && (this.value === "" || incompleteRange))
      flags.valueMissing = true;
    if (this.typedBadInput) flags.badInput = true;

    if (this.value !== "") {
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
          underflowMessage = this.localize("dateInputMinMessage", undefined, {
            min: this.min,
          });
        }
        if (this.disablePast && dates.some((date) => date < today)) {
          flags.rangeUnderflow = true;
          underflowMessage ||= this.localize("dateInputPastDisabled");
        }
        if (max !== null && dates.some((date) => date > max)) {
          flags.rangeOverflow = true;
          overflowMessage = this.localize("dateInputMaxMessage", undefined, {
            max: this.max,
          });
        }
        if (this.disableFuture && dates.some((date) => date > today)) {
          flags.rangeOverflow = true;
          overflowMessage ||= this.localize("dateInputFutureDisabled");
        }
        const disabledDates = this.configuredDisabledDateKeys();
        const disabledWeekdays = this.configuredDisabledWeekdays();
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
        if (this.mode === "range" && dates.length === 2) {
          const length = this.rangeLength(dates[0]!, dates[1]!);
          const minimum = finiteCount(this.minRange, 0);
          const maximum = finiteCount(this.maxRange, 0);
          if (minimum > 0 && length < minimum) {
            flags.rangeUnderflow = true;
            underflowMessage ||= this.localize("dateInputInvalid");
          }
          if (maximum > 0 && length > maximum) {
            flags.rangeOverflow = true;
            overflowMessage ||= this.localize("dateInputInvalid");
          }
        }
      }
    }

    const configured = this.validatorResult();
    if (configured.flags) Object.assign(flags, configured.flags);

    let message = "";
    if (configured.message) message = configured.message;
    else if (flags.badInput || flags.customError)
      message = this.localize("dateInputInvalid");
    else if (flags.rangeUnderflow) message = underflowMessage;
    else if (flags.rangeOverflow) message = overflowMessage;
    else if (flags.valueMissing) message = this.localize("fieldRequired");
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
    if (this.ownerDocument.visibilityState !== "visible") return;
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
    ownerDocument.addEventListener("visibilitychange", listener);
  }

  private unbindVisibilityListener(): void {
    if (this.visibilityListenerDocument && this.visibilityListener) {
      this.visibilityListenerDocument.removeEventListener(
        "visibilitychange",
        this.visibilityListener
      );
    }
    this.visibilityListenerDocument = undefined;
    this.visibilityListener = undefined;
  }

  private get displayText(): string {
    const parts = this.value.split("/");
    // parts[0] always exists (String.split() on '/' never returns an empty array); only
    // parts[1] (the range end) can be missing when `value` has no '/' separator.
    const from = parseISO(parts[0]!);
    const to = parseISO(parts[1] ?? "");
    if (!from) return "";
    const formatter = dateTimeFormat(this.effectiveLocale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const fmt = (d: Date) => formatter.format(d);
    if (this.mode !== "range" || !to) return fmt(from);
    try {
      return formatter.formatRange(from, to);
    } catch {
      return `${fmt(from)} – ${fmt(to)}`;
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute("slot") === "hint"
      );
      this.hasErrorSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute("slot") === "error"
      );
      this.hasLabelSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute("slot") === "label"
      );
      this.hasStartSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute("slot") === "start"
      );
      this.hasEndSlot = Array.from(this.children ?? []).some(
        (el) => el.getAttribute("slot") === "end"
      );
    }
    if (changed.has("open")) {
      if (this.open && this.isConnected) {
        this.bindDocumentPointer();
      } else {
        this.unbindDocumentPointer();
      }
    }
  }

  /** Synchronous disabled truth for public actions, including an ancestor fieldset cascade that
   * can precede `formDisabledCallback()` and the next rendered native `disabled` attribute. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(":disabled");
  }

  /** Open the calendar popover, unless the cancelable `lr-show` request is vetoed. */
  show(): Promise<void> {
    if (this.open || this.liveDisabled || this.readonly)
      return Promise.resolve();
    const request = this.emit("lr-show", null, { cancelable: true });
    if (request.defaultPrevented) return Promise.resolve();
    this.resolveTransitionWaiters("lr-after-hide");
    const settled = this.waitForTransition("lr-after-show");
    this.open = true;
    void this.settleTransition("lr-after-show");
    return settled;
  }
  /** Close the calendar popover, unless the cancelable `lr-hide` request is vetoed. */
  hide(restoreFocus: boolean = false): Promise<void> {
    if (!this.open) return Promise.resolve();
    const request = this.emit("lr-hide", null, { cancelable: true });
    if (request.defaultPrevented) return Promise.resolve();
    this.resolveTransitionWaiters("lr-after-show");
    const settled = this.waitForTransition("lr-after-hide");
    this.restorePopupFocusOnClose ||= restoreFocus;
    this.open = false;
    void this.settleTransition("lr-after-hide");
    return settled;
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) void this.hide(false);
  };

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
    ownerDocument.addEventListener("pointerdown", listener);
  }

  private unbindDocumentPointer(): void {
    if (this.pointerListenerDocument && this.pointerListener) {
      this.pointerListenerDocument.removeEventListener(
        "pointerdown",
        this.pointerListener
      );
    }
    this.pointerListenerDocument = undefined;
    this.pointerListener = undefined;
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
    });
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () =>
        this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null,
      onEscape: () => {
        void this.hide(true);
      },
      modal: false,
      trapFocus: false,
    });
  }

  private async settleTransition(
    event: "lr-after-show" | "lr-after-hide"
  ): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (this.isConnected) {
      const view = this.ownerDocument.defaultView;
      if (view)
        await new Promise<void>((resolve) =>
          view.requestAnimationFrame(() => resolve())
        );
      if (this.transitionToken !== token) return;
      const popup = this.renderRoot.querySelector('[part="popup"]');
      const animations = popup?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(
        animations.map((animation) => animation.finished.catch(() => undefined))
      );
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
    this.resolveTransitionWaiters(event);
  }

  private waitForTransition(
    event: "lr-after-show" | "lr-after-hide"
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const waiters =
        this.transitionWaiters.get(event) ?? new Set<() => void>();
      waiters.add(resolve);
      this.transitionWaiters.set(event, waiters);
    });
  }

  private resolveTransitionWaiters(
    event: "lr-after-show" | "lr-after-hide"
  ): void {
    const waiters = this.transitionWaiters.get(event);
    if (!waiters) return;
    this.transitionWaiters.delete(event);
    for (const resolve of waiters) resolve();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.bindVisibilityListener();
    this.syncInteractionListeners();
    this.syncValidatorAttributeObserver();
    this.syncCustomStates();
    if (this.hasUpdated && this.open)
      queueMicrotask(() => this.reconnectOpenPopup());
  }

  /** Clear the value. */
  clear(): void {
    if (!this.value || this.liveDisabled || this.readonly) return;
    // Matches how `onInputBlur` already flips this on the first blur -- an
    // explicit user-initiated clear() is itself an interaction, so a
    // required-and-now-empty field must surface its invalid state right
    // away instead of silently looking valid until some later blur.
    this.touched = true;
    this.value = "";
    this.emit("lr-clear");
    this.inputRelayedSinceCommit = false;
    dispatchNativeInputEvent(this, { inputType: "deleteContentBackward" });
    dispatchNativeEvent(this, "change");
  }

  private syncInteractionListeners(): void {
    const requested = new Set(
      (Array.isArray(this.assumeInteractionOn)
        ? this.assumeInteractionOn
        : []
      ).filter(
        (name): name is string => typeof name === "string" && name.length > 0
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
      typeof MutationObserverCtor !== "function"
    )
      return;

    const attributes = new Set<string>();
    for (const validator of Array.isArray(this.validators)
      ? this.validators
      : []) {
      if (
        typeof validator !== "object" ||
        validator === null ||
        !("checkValidity" in validator)
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
        if (typeof name === "string" && name.length > 0) attributes.add(name);
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
    setCustomState(this.internals, "blank", this.value === "");
    setCustomState(this.internals, "disabled", this.effectiveDisabled);
    setCustomState(this.internals, "open", this.open);
    setCustomState(this.internals, "range", this.mode === "range");
  }

  override disconnectedCallback(): void {
    this.transitionToken++;
    this.cleanupFn?.();
    this.cleanupFn = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindVisibilityListener();
    this.unbindDocumentPointer();
    this.disconnectValidatorAttributeObserver();
    this.restorePopupFocusOnClose = false;
    this.resolveTransitionWaiters("lr-after-show");
    this.resolveTransitionWaiters("lr-after-hide");
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
    this.cleanupFn?.();
    this.cleanupFn = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: false });
    this.overlayHandle = undefined;
    this.unbindVisibilityListener();
    this.unbindDocumentPointer();
    this.disconnectValidatorAttributeObserver();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has("disabledDates") ||
      changed.has("disabledDaysOfWeek") ||
      changed.has("isDateDisabled") ||
      changed.has("minRange") ||
      changed.has("maxRange") ||
      changed.has("today") ||
      changed.has("validators")
    ) {
      this.updateValidity();
    }
    if (
      changed.has("open") ||
      (this.open && (changed.has("placement") || changed.has("distance")))
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
          });
        }
      }
    }
    if (changed.has("open")) {
      if (this.open && this.isConnected) {
        const popup = this.renderRoot.querySelector(
          '[part="popup"]'
        ) as HTMLElement | null;
        if (popup) {
          this.overlayHandle = activateOverlay({
            host: this,
            panel: () =>
              this.renderRoot.querySelector(
                '[part="popup"]'
              ) as HTMLElement | null,
            onEscape: () => {
              void this.hide(true);
            },
            modal: false,
            trapFocus: false,
          });
        }
      } else if (!this.open) {
        this.overlayHandle?.deactivate({
          restoreFocus: this.restorePopupFocusOnClose,
        });
        this.overlayHandle = undefined;
        this.restorePopupFocusOnClose = false;
      }
    }
    if (changed.has("assumeInteractionOn")) this.syncInteractionListeners();
    if (changed.has("validators")) this.syncValidatorAttributeObserver();
    this.syncCustomStates();
    if (
      changed.has("touched") ||
      changed.has("required") ||
      changed.has("value") ||
      changed.has("mode") ||
      changed.has("min") ||
      changed.has("max") ||
      changed.has("readonly") ||
      changed.has("disablePast") ||
      changed.has("disableFuture") ||
      changed.has("disabledDates") ||
      changed.has("disabledDaysOfWeek") ||
      changed.has("minRange") ||
      changed.has("maxRange") ||
      changed.has("validators") ||
      changed.has("typedBadInput") ||
      changed.has("validityRevision")
    ) {
      this.toggleAttribute(
        "data-invalid",
        this.touched && !this.internals.validity.valid
      );
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
      // The mixin's value setter recomputes validity (updateValidity()),
      // which clears any stale badInput state along the way.
      this.value = "";
      return true;
    }
    const parsed =
      this.mode === "range"
        ? this.parseRangeText(trimmed)
        : this.parseSingleText(trimmed);
    if (parsed) {
      this.value = parsed;
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
    const raw = (e.target as HTMLInputElement).value;
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
      if (!this.inputRelayedSinceCommit) {
        dispatchNativeInputEvent(this, { inputType: "insertReplacementText" });
      }
      this.inputRelayedSinceCommit = false;
      relayNativeEvent(this, e);
    } else {
      this.inputRelayedSinceCommit = false;
    }
  };

  private onInput = (event: InputEvent): void => {
    event.stopPropagation();
    if (this.liveDisabled) return;
    this.inputRelayedSinceCommit = true;
    relayNativeEvent(this, event);
  };

  /** Parses one date, ISO-first (so a calendar-invalid ISO string like
   *  "2026-02-30" is rejected rather than silently rolled over by Date.parse()).
   *  A 3-part, ambiguous slash/dot/dash-separated date (e.g. "15/07/2026") is
   *  parsed according to the locale's own day/month/year order (via a real
   *  Intl.DateTimeFormat sample, see localeDateOrder()) rather than
   *  Date.parse()'s implementation-defined heuristics -- this is what prevents
   *  e.g. an en-GB "15/07/2026" from being silently misread as some other day.
   *  A 4-digit first group (e.g. "2026-7-15") is never locale-guessed, though:
   *  it's unambiguously a year regardless of locale/separator (ISO's own
   *  year-first convention, just without zero-padding), so it's routed
   *  straight through parseISO() instead -- this is what lets a non-padded
   *  ISO-ish date keep parsing correctly (it did via Date.parse() before the
   *  ambiguous-date regex below existed at all).
   *  Anything else (e.g. "July 15, 2026") still falls through to Date.parse(). */
  private parseOneDate(raw: string): Date | null {
    raw = normalizeLocalizedDateText(raw, this.effectiveLocale);
    const looksLikeISO = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    if (looksLikeISO) return parseISO(raw);

    const ambiguous = /^(\d{1,4})[/.-](\d{1,4})[/.-](\d{1,4})$/.exec(raw);
    if (ambiguous) {
      // safe: g1/g2/g3 are mandatory (non-optional) capture groups, so a successful match populates all three
      const [, g1, g2, g3] = ambiguous;
      if (g1!.length === 4) {
        return parseISO(
          `${g1}-${g2!.padStart(2, "0")}-${g3!.padStart(2, "0")}`
        );
      }
      const order = localeDateOrder(this.effectiveLocale);
      const values = [Number(g1), Number(g2), Number(g3)];
      const fields: Partial<Record<"day" | "month" | "year", number>> = {};
      order.forEach((type, i) => {
        fields[type] = values[i];
      });
      if (fields.day != null && fields.month != null && fields.year != null) {
        const year = fields.year < 100 ? 2000 + fields.year : fields.year;
        return parseISO(
          `${String(year).padStart(4, "0")}-${String(fields.month).padStart(
            2,
            "0"
          )}-${String(fields.day).padStart(2, "0")}`
        );
      }
    }

    const timestamp = Date.parse(raw);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
  }

  private parseSingleText(raw: string): string | null {
    const parsed = this.parseOneDate(raw);
    return parsed ? formatISO(parsed) : null;
  }

  /** Literal joining the start/end ranges for this locale's Gregorian numeric formatter. */
  private localizedRangeSeparator(): string {
    const formatter = dateTimeFormat(this.effectiveLocale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    try {
      const parts = formatter.formatRangeToParts(
        localDate(2026, 0, 2),
        localDate(2026, 0, 3)
      );
      const firstEnd = parts.findIndex((part) => part.source === "endRange");
      let lastStart = -1;
      for (let index = 0; index < firstEnd; index++) {
        if (parts[index]?.source === "startRange") lastStart = index;
      }
      const separator = parts
        .slice(lastStart + 1, firstEnd)
        .map((part) => part.value)
        .join("");
      return normalizeLocalizedDateText(separator, this.effectiveLocale) || "–";
    } catch {
      return "–";
    }
  }

  /** Only round-trips the exact `displayText` shape this component itself
   *  renders (`"<locale from> – <locale to>"`) — a raw ISO range typed
   *  directly (`"2026-05-01/2026-05-15"`) is also accepted as a convenience.
   *  A reversed typed range (`to` before `from`) is normalized into
   *  from-before-to order, matching what the date-picker's own UI-driven
   *  `commit()` already does for a UI-picked range. */
  private parseRangeText(raw: string): string | null {
    raw = normalizeLocalizedDateText(raw, this.effectiveLocale);
    if (
      raw ===
        normalizeLocalizedDateText(this.displayText, this.effectiveLocale) &&
      this.value.includes("/")
    ) {
      return this.normalizeCommittedValue(this.value);
    }
    if (/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(raw)) {
      // safe: the regex above guarantees exactly one '/', so split yields two defined parts
      const [a, b] = raw.split("/");
      const from = parseISO(a!);
      const to = parseISO(b!);
      if (!from || !to) return null;
      return from <= to ? raw : `${b}/${a}`;
    }
    const separator = this.localizedRangeSeparator();
    const idx = raw.indexOf(separator);
    if (idx === -1) return null;
    const from = this.parseOneDate(raw.slice(0, idx).trim());
    const to = this.parseOneDate(raw.slice(idx + separator.length).trim());
    if (!from || !to) return null;
    return from <= to
      ? `${formatISO(from)}/${formatISO(to)}`
      : `${formatISO(to)}/${formatISO(from)}`;
  }

  private onInputKey = (e: KeyboardEvent): void => {
    if (e.altKey && e.key === "ArrowDown") {
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
        if (!this.inputRelayedSinceCommit) {
          dispatchNativeInputEvent(this, {
            inputType: "insertReplacementText",
          });
        }
        this.inputRelayedSinceCommit = false;
        dispatchNativeEvent(this, "change");
      } else {
        this.inputRelayedSinceCommit = false;
      }
      // Set after the commit, since `applyTypedText()` clears the token itself.
      this.enterCommittedText = raw;
    }
    submitOnEnter(this, e);
  };

  private onInputBlur = (event: FocusEvent): void => {
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
    if (start === undefined || end === undefined) {
      input.setRangeText(replacement);
    } else {
      input.setRangeText(replacement, start, end, selectMode);
    }
    // Mirrors onInputChange's parse-or-revert contract for a programmatic
    // edit of the same underlying text -- keeps value/validity in sync
    // without emitting input/change (programmatic assignments stay silent).
    this.applyTypedText(input.value);
  }

  override formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: "restore" | "autocomplete"
  ): void {
    this.value = typeof state === "string" ? state : "";
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  formDisabledCallback(disabled: boolean): void {
    const parent = Object.getPrototypeOf(LyraDateInput.prototype) as {
      formDisabledCallback: (this: LyraDateInput, disabled: boolean) => void;
    };
    parent.formDisabledCallback.call(this, disabled);
    if (disabled) void this.hide();
    this.syncCustomStates();
  }

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  // The nested picker's `input` event isn't wired anywhere else, so without
  // this listener it bubbles+composes straight through this shadow boundary
  // (LyraElement.emit always dispatches bubbles:true, composed:true) and
  // fires on this host a *second* time, on top of the explicit emit below.
  private onPickerInput = (e: InputEvent): void => {
    e.stopPropagation();
    if (this.liveDisabled) return;
    const picker = e.target as LyraDatePicker;
    this.value = picker.value;
    this.inputRelayedSinceCommit = false;
    relayNativeEvent(this, e);
  };

  private onPickerChange = (e: Event): void => {
    e.stopPropagation();
    if (this.liveDisabled) return;
    const picker = e.target as LyraDatePicker;
    this.value = picker.value;
    relayNativeEvent(this, e);
    // The picker only fires `change` once a selection is finalized (a single
    // pick, or the second click of a range), so this is always the right
    // moment to close, in either mode.
    this.hide(true);
  };

  override render(): TemplateResult {
    const hasValue = this.value.length > 0;
    const hasHint = this.withHint || this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel =
      this.withLabel || this.hasLabelSlot || this.label.length > 0;
    const invalid = this.touched && !this.internals.validity.valid;
    const describedBy = [
      hasError ? "date-input-error" : "",
      hasHint ? "date-input-hint" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const dynamicDaySlots = [
      ...new Set(
        Array.from(this.children ?? [])
          .map((child) => child.getAttribute("slot") ?? "")
          .filter((name) => /^day-\d{4}-\d{2}-\d{2}$/.test(name))
      ),
    ];
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
                  @slotchange=${this.onLabelSlotChange}
                ></slot
              ></span>
            </label>
            <div part="input-wrapper">
              <span part="start" ?hidden=${!this.hasStartSlot}>
                <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
              </span>
              <span part="form-control-input">
                <span part="segment">
                  <span part="segment-literal" hidden></span>
                  <input
                    id=${this.inputId}
                    part="input"
                    type="text"
                    role="combobox"
                    aria-label=${this.accessibleLabel ||
                    (hasLabel
                      ? nothing
                      : this.placeholder || this.localize("date"))}
                    aria-describedby=${describedBy || nothing}
                    aria-required=${this.required ? "true" : "false"}
                    aria-invalid=${invalid ? "true" : "false"}
                    aria-haspopup="dialog"
                    aria-expanded=${this.open ? "true" : "false"}
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
              ${this.withClear && hasValue
                ? html`<button
                    part="clear-button"
                    type="button"
                    ?disabled=${this.effectiveDisabled || this.readonly}
                    aria-label=${this.localize(
                      "clear",
                      this.clearLabel || undefined
                    )}
                    @click=${() => this.clear()}
                  >
                    <span aria-hidden="true" inert
                      ><slot name="clear-icon">${closeIcon()}</slot></span
                    >
                  </button>`
                : nothing}
              <span part="end" ?hidden=${!this.hasEndSlot}>
                <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
              </span>
              <button
                part="expand-button"
                type="button"
                aria-label=${this.localize(
                  "openCalendar",
                  this.openLabel || undefined
                )}
                aria-haspopup="dialog"
                aria-expanded=${this.open ? "true" : "false"}
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
              role="dialog"
              aria-hidden=${this.open ? "false" : "true"}
              aria-label=${this.localize(
                "chooseDate",
                this.dialogLabel === "Choose date"
                  ? undefined
                  : this.dialogLabel
              )}
            >
              <lr-date-picker
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
              </lr-date-picker>
            </div>
            <div id="date-input-error" part="error" ?hidden=${!hasError}>
              ${this.errorText}<slot
                name="error"
                @slotchange=${this.onErrorSlotChange}
              ></slot>
            </div>
            <div id="date-input-hint" part="hint" ?hidden=${!hasHint}>
              ${this.hint}<slot
                name="hint"
                @slotchange=${this.onHintSlotChange}
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
    "lr-date-input": LyraDateInput;
  }
}
