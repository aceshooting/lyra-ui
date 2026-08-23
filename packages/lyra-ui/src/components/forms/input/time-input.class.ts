import type { Placement } from '@floating-ui/dom';
import {
  html,
  nothing,
  type ComplexAttributeConverter,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated, isBarredFromValidation } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import {
  acquireAriaDescription,
  type AriaDescriptionLease,
} from '../../../internal/aria-controls.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { closeIcon, chevronIcon } from '../../../internal/icons.js';
import { finiteNumber } from '../../../internal/numbers.js';
import { place } from '../../../internal/positioner.js';
import { rtlAwarePlacement } from '../../../internal/rtl.js';
import {
  activateNonmodalOverlay,
  composedContains,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { submitOnEnter } from '../../../internal/submit-on-enter.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import {
  dayPeriodLabels,
  hasTimeStepMismatch,
  isTimeInRange,
  localeTimePattern,
  normalizeTimeValue,
  parseTimeValue,
  timeValueFromMilliseconds,
  timeStepBaseMilliseconds,
  to24Hour,
  type TimeHourFormat,
  type TimePatternPart,
} from './time-input-shared.js';
import { styles } from './time-input.styles.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_popover, LYRA_DEFAULT_timeInputDayPeriod, LYRA_DEFAULT_timeInputEmptySegment, LYRA_DEFAULT_timeInputHour, LYRA_DEFAULT_timeInputInvalid, LYRA_DEFAULT_timeInputLabel, LYRA_DEFAULT_timeInputMaxMessage, LYRA_DEFAULT_timeInputMinMessage, LYRA_DEFAULT_timeInputMinute, LYRA_DEFAULT_timeInputNow, LYRA_DEFAULT_timeInputOpen, LYRA_DEFAULT_timeInputPopup, LYRA_DEFAULT_timeInputRangeMessage, LYRA_DEFAULT_timeInputSecond, LYRA_DEFAULT_timeInputStepMessage } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraTimeInputHourFormat = TimeHourFormat;
export type LyraTimeInputStep = number | 'any';
export type LyraTimeInputPlacement =
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

type SegmentName = 'hour' | 'minute' | 'second' | 'dayPeriod';
type DayPeriod = 'am' | 'pm';

interface TimeDraft {
  hour: number | null;
  minute: number | null;
  second: number | null;
  dayPeriod: DayPeriod | null;
}

export interface LyraTimeInputEventMap {
  input: InputEvent;
  change: Event;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-clear': CustomEvent<null>;
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
  'lr-invalid': CustomEvent<null>;
}

class LyraTimeInputBase extends LyraElement<LyraTimeInputEventMap> {}

const stepConverter: ComplexAttributeConverter<LyraTimeInputStep> = {
  fromAttribute(value: string | null): LyraTimeInputStep {
    if (value === 'any') return 'any';
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
  },
  toAttribute(value: LyraTimeInputStep): string {
    return String(value);
  },
};

const hourFormatConverter: ComplexAttributeConverter<LyraTimeInputHourFormat> = {
  fromAttribute(value: string | null): LyraTimeInputHourFormat {
    return value === '12' || value === '24' ? value : 'auto';
  },
  toAttribute(value: LyraTimeInputHourFormat): string {
    return value;
  },
};

const PLACEMENTS = new Set<LyraTimeInputPlacement>([
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

const placementConverter: ComplexAttributeConverter<LyraTimeInputPlacement> = {
  fromAttribute(value: string | null): LyraTimeInputPlacement {
    return PLACEMENTS.has(value as LyraTimeInputPlacement)
      ? (value as LyraTimeInputPlacement)
      : 'bottom-start';
  },
  toAttribute(value: LyraTimeInputPlacement): string {
    return value;
  },
};

const blankDraft = (): TimeDraft => ({ hour: null, minute: null, second: null, dayPeriod: null });
const pad = (value: number): string => String(value).padStart(2, '0');

function isElementNode(value: unknown): value is Element {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Element>;
  return candidate.nodeType === 1 &&
    typeof candidate.getRootNode === 'function' &&
    typeof candidate.contains === 'function';
}

function containsElement(container: Element | null, value: unknown): value is Element {
  if (!container || !isElementNode(value)) return false;
  try {
    // Calling a native Node method also rejects a structural lookalike that is not a real DOM node.
    return container.contains(value);
  } catch {
    return false;
  }
}

/**
 * `<lr-time-input>` — a locale-aware segmented time field with an attached column picker.
 *
 * Mirrors the public `<wa-time-input>` surface under the `lr-` prefix. The submitted value is a
 * timezone-free 24-hour string (`HH:mm`, or `HH:mm:ss` when seconds are shown); an incomplete
 * draft submits the empty string. Use `<lr-native-time-input>` for the Lyra 7 browser-native
 * `input[type=time]` experience.
 *
 * The outer row follows the shared control-height ladder without adding padding around its action
 * hit targets: compact tiers grow only enough for the clear/expand buttons, while `l` and `xl`
 * retain their larger shared heights.
 * Locale digits and ASCII digits are accepted symmetrically. Constraint bounds are formatted
 * through the same locale presentation, while the wire value remains ASCII. Numeric step
 * validation and picker options use the native time step base (valid `min`, then the reset
 * default, then midnight) and the picker projects only complete times on that grid.
 * Each picker column is a one-stop listbox: ArrowUp/ArrowDown/Home/End rove its enabled options,
 * and the native option button supplies Enter/Space activation.
 * When a controlled locale, hour format, or step change removes the segment that currently owns
 * focus, focus moves to the first surviving segment after the new pattern renders. Changes never
 * reclaim focus from another control.
 * The semantic group and every spinbutton expose explicit required/invalid states. Requiredness
 * also has one localized hidden group description that composes with the visible hint/error
 * relationship; visible error chrome wins `aria-invalid` immediately, while intrinsic/custom
 * invalidity is exposed only after interaction.
 *
 * @customElement lr-time-input
 * @event input - Native `InputEvent` fired for user edits.
 * @event change - Native `Event` fired when a complete value is committed.
 * @event focus - Re-dispatched when focus enters the segmented editing surface.
 * @event blur - Re-dispatched when focus leaves the segmented editing surface.
 * @event lr-input - Prefixed compatibility alias for `input` with `detail.value`.
 * @event lr-change - Prefixed compatibility alias for `change` with `detail.value`.
 * @event lr-clear - The clear action removed the value.
 * @event lr-show - Cancelable event fired before the picker opens.
 * @event lr-after-show - The opening transition finished.
 * @event lr-hide - Cancelable event fired before the picker closes.
 * @event lr-after-hide - The closing transition finished.
 * @event lr-invalid - The control failed a validity check; cancelable. Calling `preventDefault()`
 *   also cancels the native `invalid` event it aliases, suppressing the browser's own validation
 *   bubble and `reportValidity()`'s focus/scroll.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @slot start - Adornment before the segments.
 * @slot end - Adornment after the clear action and before the expand action.
 * @slot clear-icon - Replaces the clear glyph.
 * @slot expand-icon - Replaces the picker expand glyph.
 * @slot footer - Replaces the default Now footer action.
 * @csspart form-control - The outer form-control wrapper.
 * @csspart form-control-input - The row containing segments and actions.
 * @csspart form-control-label - The wrap-safe label wrapper; unbroken localized text stays within
 *   the host allocation.
 * @csspart label - Compatibility alias for `form-control-label` on the same node.
 * @csspart base - The segmented time row.
 * @csspart time-input - Compatibility alias for `base` on the same node.
 * @csspart input-wrapper - The row containing segments and actions.
 * @csspart input - The segmented editing surface.
 * @csspart segment - An editable time segment.
 * @csspart segment-literal - A locale-derived separator.
 * @csspart start - Shrinkable wrapper around the `start` slot; long content ellipsizes.
 * @csspart end - Shrinkable wrapper around the `end` slot; long content ellipsizes.
 * @csspart clear-button - The clear action.
 * @csspart expand-button - The picker toggle.
 * @csspart expand-icon - The picker-toggle glyph.
 * @csspart popup - The positioned picker surface.
 * @csspart columns - The picker column group.
 * @csspart column - One hour, minute, second, or day-period column. It scrolls only in the block
 *   axis and clips inline overflow when a consumer supplies an undersized `--column-width`.
 * @csspart column-item - A picker column option.
 * @csspart column-item-selected - A selected picker option; also carries `column-item`.
 * @csspart now-button - The default Now footer action.
 * @csspart hint - The hint message.
 * @csspart error - Ordinary validation text referenced by the segmented input through
 *   `aria-describedby`; it is not a live region, avoiding duplicate native validation feedback.
 * @cssprop [--lr-time-input-gap=var(--lr-form-control-gap)] - Gap between segments, adornments,
 *   and actions in the outer row. Undeclared on the host so ancestor theme wrappers can set it.
 * @cssprop [--lr-time-input-radius=var(--lr-form-control-radius)] - Outer row corner radius.
 *   `pill` supplies `--lr-radius-pill` only as the fallback, so a component-scoped value wins.
 * @cssprop [--lr-time-input-border-color=var(--lr-color-border)] - Outer row border color, with
 *   appearance-specific fallbacks.
 * @cssprop [--lr-time-input-fill=transparent] - Outer row background, with appearance-specific
 *   fallbacks.
 * @cssprop [--lr-time-input-color=var(--lr-color-text)] - Outer row text color, including the
 *   accent appearance fallback.
 * @cssprop [--lr-time-input-focus-border-color=var(--lr-color-brand)] - Open/focused row border.
 * @cssprop [--lr-time-input-segment-hover-bg=var(--lr-color-brand-quiet)] - Segment hover fill.
 * @cssprop --lr-time-input-segment-active-bg - Segment pressed fill; derived from hover when unset.
 * @cssprop [--lr-time-input-segment-focus-bg=var(--lr-time-input-segment-hover-bg,var(--lr-color-brand-quiet))] -
 *   Keyboard-focused segment fill.
 * @cssprop [--lr-time-input-action-color=var(--lr-color-text-quiet)] - Resting clear/expand color.
 * @cssprop [--lr-time-input-action-hover-color=var(--lr-color-text)] - Hovered clear/expand color.
 * @cssprop [--lr-time-input-action-hover-bg=var(--lr-color-brand-quiet)] - Clear/expand/Now hover fill.
 * @cssprop --lr-time-input-action-active-bg - Clear/expand/Now pressed fill; derived from hover when unset.
 * @cssprop [--lr-time-input-column-hover-bg=var(--lr-color-brand-quiet)] - Picker-option hover fill.
 * @cssprop --lr-time-input-column-active-bg - Picker-option pressed fill; derived from hover when unset.
 * @cssprop [--lr-time-input-column-selected-bg=var(--lr-color-brand)] - Selected option fill.
 * @cssprop [--lr-time-input-column-selected-color=var(--lr-color-on-brand)] - Selected option text.
 * @cssprop [--lr-time-input-column-selected-font-weight=var(--lr-font-weight-semibold)] - Selected option weight.
 * @cssprop --lr-time-input-column-selected-hover-bg - Selected-option hover fill; derived when unset.
 * @cssprop --lr-time-input-column-selected-active-bg - Selected-option pressed fill; derived when unset.
 * @cssprop [--column-item-height=2.25em] - Picker row height.
 * @cssprop [--column-width=3em] - Picker column width.
 * @cssprop [--show-duration=var(--lr-duration-fast)] - Picker opening duration.
 * @cssprop [--hide-duration=var(--lr-duration-fast)] - Picker closing duration.
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @cssstate blank - Present while the committed value is empty.
 * @cssstate disabled - Present while the control is disabled directly or by a fieldset.
 * @cssstate open - Present while the column picker is open.
 * @method show - `show(): Promise<void>` opens the picker and settles after `lr-after-show`.
 * @method hide - `hide(): Promise<void>` closes the picker and settles after `lr-after-hide`.
 * @status stable
 * @since 4.0.0
 */
export class LyraTimeInput extends FormAssociated(LyraTimeInputBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    popover: LYRA_DEFAULT_popover,
    timeInputDayPeriod: LYRA_DEFAULT_timeInputDayPeriod,
    timeInputEmptySegment: LYRA_DEFAULT_timeInputEmptySegment,
    timeInputHour: LYRA_DEFAULT_timeInputHour,
    timeInputInvalid: LYRA_DEFAULT_timeInputInvalid,
    timeInputLabel: LYRA_DEFAULT_timeInputLabel,
    timeInputMaxMessage: LYRA_DEFAULT_timeInputMaxMessage,
    timeInputMinMessage: LYRA_DEFAULT_timeInputMinMessage,
    timeInputMinute: LYRA_DEFAULT_timeInputMinute,
    timeInputNow: LYRA_DEFAULT_timeInputNow,
    timeInputOpen: LYRA_DEFAULT_timeInputOpen,
    timeInputPopup: LYRA_DEFAULT_timeInputPopup,
    timeInputRangeMessage: LYRA_DEFAULT_timeInputRangeMessage,
    timeInputSecond: LYRA_DEFAULT_timeInputSecond,
    timeInputStepMessage: LYRA_DEFAULT_timeInputStepMessage,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraTimeInput>[] {
    return [currentValidityValidator('required', 'disabled', 'readonly', 'value', 'min', 'max', 'step')];
  }
  static override styles = [LyraElement.styles, sizes, srOnly, styles];

  static override properties = {
    open: { type: Boolean, reflect: true, noAccessor: true },
    readonly: { type: Boolean, reflect: true, noAccessor: true },
    step: { converter: stepConverter, reflect: true, noAccessor: true },
  };

  @property({ reflect: true }) appearance: LyraAppearance = 'outlined';
  @property() autocomplete = '';
  @property({ type: Number, reflect: true }) distance = 0;
  @property() hint = '';
  @property({ attribute: 'hour-format', converter: hourFormatConverter, reflect: true }) hourFormat: LyraTimeInputHourFormat = 'auto';
  @property() label = '';
  @property({ reflect: true }) min = '';
  @property({ reflect: true }) max = '';
  @property({ type: Boolean, reflect: true }) pill = false;
  @property({ converter: placementConverter, reflect: true }) placement: LyraTimeInputPlacement = 'bottom-start';
  @property({ reflect: true }) size: LyraSize = 'm';
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  @property({ type: Boolean, attribute: 'with-now' }) withNow = false;
  @property({ attribute: 'error-text' }) errorText = '';

  @state() private activeSegment: SegmentName = 'hour';
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;
  @state() private hasFooterSlot = false;

  private _open = false;
  private _readonly = false;
  private _step: LyraTimeInputStep = 60;
  private draft: TimeDraft = blankDraft();
  private partial = false;
  private secondsVisible = false;
  private digitBuffer = '';
  private digitSegment?: SegmentName;
  private pendingSegmentFocus?: SegmentName;
  private restoringSegmentFocus = false;
  private cleanupPositioner?: () => void;
  private overlayHandle?: OverlayHandle;
  private lightDismissDocument?: Document;
  private restoreFocusOnClose = true;
  private transitionToken = 0;
  private visibilityPromise: Promise<void> = Promise.resolve();
  private segmentOrderKey = '';
  private pickerGridKey = '';
  private pickerGridMilliseconds: number[] = [];
  private inputId = nextId('time-input');
  private labelId = nextId('time-input-label');
  private hintId = nextId('time-input-hint');
  private errorId = nextId('time-input-error');
  private requiredDescriptionId = nextId('time-input-required');
  private popupId = nextId('time-input-popup');
  private requiredDescriptionLease?: AriaDescriptionLease;
  private requiredDescriptionTarget?: HTMLElement;
  /** Clock seam for deterministic local-time tests. */
  private now = (): Date => new Date();

  constructor() {
    super();
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncRequiredDescription();
  }

  /** Whether the column picker is open.
   * @default false */
  get open(): boolean {
    return this._open;
  }

  set open(next: boolean) {
    void this.requestVisibility(Boolean(next), this.isConnected && this.hasUpdated, true);
  }

  /** Whether the control remains focusable but blocks user edits.
   * @default false */
  get readonly(): boolean {
    return this._readonly;
  }

  set readonly(next: boolean) {
    const old = this._readonly;
    this._readonly = Boolean(next);
    this.toggleAttribute('readonly', this._readonly);
    this.updateValidity();
    this.requestUpdate('readonly', old);
  }

  /** Allowed value step in seconds, or `any` to disable step validation. Numeric grids use valid
   * `min`, then `defaultValue`, then midnight as their base; picker columns project that full grid.
   * @default 60 */
  get step(): LyraTimeInputStep {
    return this._step;
  }

  set step(next: LyraTimeInputStep) {
    const old = this._step;
    if (next === 'any') {
      this._step = next;
    } else {
      const numeric = finiteNumber(Number(next), 60);
      this._step = numeric > 0 ? numeric : 60;
    }
    const parsedValue = parseTimeValue(this.value);
    this.secondsVisible = this.numericStep < 60 ||
      (parsedValue !== undefined && parsedValue.precision !== 'minute');
    this.updateValidity();
    this.requestUpdate('step', old);
  }

  override get disabled(): boolean {
    return super.disabled;
  }

  override set disabled(next: boolean) {
    super.disabled = next;
    if (next) this.forceClose(false);
    this.syncComponentStates();
  }

  override get value(): string {
    return super.value;
  }

  override set value(next: string | Date | null) {
    let normalized = normalizeTimeValue(next);
    if (normalized && this.numericStep < 60 && parseTimeValue(normalized)?.precision === 'minute') {
      normalized += ':00';
    }
    this.partial = false;
    this.resetDigitBuffer();
    this.syncDraft(normalized);
    super.value = normalized;
    this.syncComponentStates();
  }

  /** Milliseconds since local midnight, or `NaN` while blank/incomplete.
   *
   *  Assigning sets `value` from the same scale. `NaN`, a negative number, or a full day or more
   *  clears the field rather than wrapping, matching how a native time input treats an
   *  out-of-range `valueAsNumber`. Assignment is silent, like the native property. */
  get valueAsNumber(): number {
    return parseTimeValue(this.value)?.milliseconds ?? Number.NaN;
  }

  set valueAsNumber(next: number) {
    this.value = timeValueFromMilliseconds(next);
  }

  /** A Date carrying the selected local clock fields on today's local calendar date.
   *
   *  Assigning reads the same local clock fields back off the given Date, so it round-trips with
   *  the getter; `null` or an invalid Date clears the field. Assignment is silent. */
  get valueAsDate(): Date | null {
    const parsed = parseTimeValue(this.value);
    if (!parsed) return null;
    const result = this.now();
    result.setHours(parsed.hour, parsed.minute, parsed.second, parsed.millisecond);
    return result;
  }

  set valueAsDate(next: Date | null) {
    this.value = normalizeTimeValue(next);
  }

  private get numericStep(): number {
    return this.step === 'any' ? 60 : finiteNumber(this.step, 60);
  }

  private get includeSeconds(): boolean {
    return this.numericStep < 60 || this.secondsVisible;
  }

  private get pattern(): TimePatternPart[] {
    return localeTimePattern(this.effectiveLocale, this.hourFormat, this.includeSeconds);
  }

  private get segmentOrder(): SegmentName[] {
    return this.pattern
      .filter((part): part is TimePatternPart & { type: SegmentName } => part.type !== 'literal')
      .map((part) => part.type);
  }

  /** Reads component state plus the UA's synchronous fieldset cascade when a browser selector
   * predicate exists. Lit's server element shim has no callable `matches()`, so SSR falls back to
   * the reactive authority instead of aborting public-state application before the first render. */
  private get liveDisabled(): boolean {
    const matches = (this as Partial<Element>).matches;
    return this.effectiveDisabled || (typeof matches === 'function' && matches.call(this, ':disabled'));
  }

  private activeSegmentFor(order = this.segmentOrder): SegmentName {
    return order.includes(this.activeSegment) ? this.activeSegment : (order[0] ?? 'hour');
  }

  private get usesTwelveHour(): boolean {
    return this.segmentOrder.includes('dayPeriod');
  }

  private get draftComplete(): boolean {
    return (
      this.draft.hour !== null &&
      this.draft.minute !== null &&
      (!this.includeSeconds || this.draft.second !== null) &&
      (!this.usesTwelveHour || this.draft.dayPeriod !== null)
    );
  }

  private get draftHasAny(): boolean {
    return Object.values(this.draft).some((value) => value !== null);
  }

  private syncDraft(value: string): void {
    const parsed = parseTimeValue(value);
    if (!parsed) {
      this.draft = blankDraft();
      this.secondsVisible = this.numericStep < 60;
      return;
    }
    this.draft = {
      hour: parsed.hour,
      minute: parsed.minute,
      second: parsed.second,
      dayPeriod: parsed.hour >= 12 ? 'pm' : 'am',
    };
    this.secondsVisible = this.numericStep < 60 || parsed.precision !== 'minute';
  }

  private canonicalDraftValue(): string {
    if (!this.draftComplete) return '';
    const value = `${pad(this.draft.hour!)}:${pad(this.draft.minute!)}`;
    return this.includeSeconds ? `${value}:${pad(this.draft.second!)}` : value;
  }

  private syncComponentStates(): void {
    setCustomState(this.internals, 'blank', this.value === '');
    setCustomState(this.internals, 'disabled', this.effectiveDisabled);
    setCustomState(this.internals, 'open', this.open);
  }

  private formattedNumber(value: number, minimumIntegerDigits: number): string {
    try {
      return getNumberFormat(this.effectiveLocale, {
        minimumIntegerDigits,
        useGrouping: false,
      }).format(value);
    } catch {
      return String(value).padStart(minimumIntegerDigits, '0');
    }
  }

  /** Accepts both ASCII digits and the active numbering system's single-key digit glyphs. */
  private inputDigit(key: string): string | undefined {
    if (/^[0-9]$/.test(key)) return key;
    try {
      const formatter = getNumberFormat(this.effectiveLocale, { useGrouping: false });
      for (let value = 0; value <= 9; value++) {
        const integer = formatter.formatToParts(value)
          .find((part) => part.type === 'integer')?.value;
        if (integer === key) return String(value);
      }
    } catch {
      // ASCII remains accepted when an Intl implementation rejects the requested locale.
    }
    return undefined;
  }

  /** Formats a canonical constraint value through the same locale pattern as the segment UI. */
  private displayTime(value: string): string {
    const parsed = parseTimeValue(value);
    if (!parsed) return value;
    const includeSeconds = parsed.precision !== 'minute';
    const labels = dayPeriodLabels(this.effectiveLocale);
    return localeTimePattern(this.effectiveLocale, this.hourFormat, includeSeconds)
      .map((part) => {
        if (part.type === 'literal') return part.value;
        if (part.type === 'hour') {
          const hour = this.usesTwelveHour ? parsed.hour % 12 || 12 : parsed.hour;
          return this.formattedNumber(hour, this.usesTwelveHour ? 1 : 2);
        }
        if (part.type === 'minute') return this.formattedNumber(parsed.minute, 2);
        if (part.type === 'second') return this.formattedNumber(parsed.second, 2);
        return parsed.hour >= 12 ? labels.pm : labels.am;
      })
      .join('');
  }

  private segmentNumericValue(name: SegmentName): number | null {
    if (name === 'hour') {
      if (this.draft.hour === null) return null;
      return this.usesTwelveHour ? this.draft.hour % 12 || 12 : this.draft.hour;
    }
    if (name === 'minute') return this.draft.minute;
    if (name === 'second') return this.draft.second;
    return this.draft.dayPeriod === 'am' ? 0 : this.draft.dayPeriod === 'pm' ? 1 : null;
  }

  private segmentText(name: SegmentName): string {
    if (this.digitSegment === name && this.digitBuffer) {
      return this.formattedNumber(Number(this.digitBuffer), this.digitBuffer.length);
    }
    if (name === 'dayPeriod') {
      const labels = dayPeriodLabels(this.effectiveLocale);
      return this.draft.dayPeriod ? labels[this.draft.dayPeriod] : '--';
    }
    const value = this.segmentNumericValue(name);
    if (value === null) return '--';
    const minimumDigits = name === 'hour' && this.usesTwelveHour ? 1 : 2;
    return this.formattedNumber(value, minimumDigits);
  }

  private segmentLabel(name: SegmentName): string {
    const keys: Record<SegmentName, string> = {
      hour: 'timeInputHour',
      minute: 'timeInputMinute',
      second: 'timeInputSecond',
      dayPeriod: 'timeInputDayPeriod',
    };
    return this.localize(keys[name]!);
  }

  private segmentBounds(name: SegmentName): { min: number; max: number } {
    if (name === 'hour') return this.usesTwelveHour ? { min: 1, max: 12 } : { min: 0, max: 23 };
    if (name === 'dayPeriod') return { min: 0, max: 1 };
    return { min: 0, max: 59 };
  }

  private setDraftSegment(name: SegmentName, value: number | DayPeriod | null, user = true): void {
    if (this.liveDisabled || (user && this.readonly)) return;
    if (name === 'hour') {
      if (value === null) {
        this.draft.hour = null;
      } else {
        const numeric = Number(value);
        this.draft.hour = this.usesTwelveHour
          ? to24Hour(numeric, this.draft.dayPeriod ?? 'am')
          : numeric;
      }
    } else if (name === 'dayPeriod') {
      const period = value === 'pm' ? 'pm' : value === 'am' ? 'am' : null;
      if (period && this.draft.hour !== null) {
        const displayHour = this.draft.hour % 12 || 12;
        this.draft.hour = to24Hour(displayHour, period);
      }
      this.draft.dayPeriod = period;
    } else {
      this.draft[name] = value === null ? null : Number(value);
    }
    if (!user) {
      this.requestUpdate();
      return;
    }
    this.publishDraftEdit();
  }

  private publishDraftEdit(): void {
    const before = super.value;
    const next = this.canonicalDraftValue();
    this.partial = this.draftHasAny && !this.draftComplete;
    super.value = next;
    this.syncComponentStates();
    dispatchNativeInputEvent(this, { inputType: 'insertReplacementText' });
    this.emit('lr-input', { value: this.value });
    if (next !== '' && next !== before) {
      dispatchNativeEvent(this, 'change');
      this.emit('lr-change', { value: this.value });
    }
    this.requestUpdate();
  }

  private commitUserValue(value: string, inputType = 'insertReplacementText', forceChange = false): void {
    const before = this.value;
    this.value = value;
    dispatchNativeInputEvent(this, { inputType });
    this.emit('lr-input', { value: this.value });
    if (forceChange || this.value !== before) {
      dispatchNativeEvent(this, 'change');
      this.emit('lr-change', { value: this.value });
    }
  }

  private resetDigitBuffer(): void {
    this.digitBuffer = '';
    this.digitSegment = undefined;
  }

  private moveSegment(from: SegmentName, direction: -1 | 1): void {
    const order = this.segmentOrder;
    const current = Math.max(0, order.indexOf(from));
    const next = Math.min(order.length - 1, Math.max(0, current + direction));
    this.activeSegment = order[next] ?? 'hour';
    this.segmentElement(this.activeSegment)?.focus();
  }

  private acceptDigit(name: SegmentName, digit: string): void {
    if (name === 'dayPeriod') return;
    if (this.digitSegment !== name) {
      this.digitSegment = name;
      this.digitBuffer = '';
    }
    const bounds = this.segmentBounds(name);
    let candidateText = `${this.digitBuffer}${digit}`.slice(-2);
    let candidate = Number(candidateText);
    if (candidate > bounds.max || (candidateText.length === 2 && candidate < bounds.min)) {
      candidateText = digit;
      candidate = Number(digit);
    }
    this.digitBuffer = candidateText;
    if (candidate >= bounds.min && candidate <= bounds.max) this.setDraftSegment(name, candidate);
    else this.requestUpdate();

    const cannotAcceptAnother = candidate * 10 > bounds.max;
    if (candidateText.length === 2 || cannotAcceptAnother) {
      this.resetDigitBuffer();
      this.moveSegment(name, 1);
    }
  }

  private stepSegment(name: SegmentName, delta: -1 | 1): void {
    const bounds = this.segmentBounds(name);
    const current = this.segmentNumericValue(name);
    const next = current === null
      ? bounds.min
      : ((current - bounds.min + delta + (bounds.max - bounds.min + 1)) % (bounds.max - bounds.min + 1)) + bounds.min;
    if (name === 'dayPeriod') this.setDraftSegment(name, next === 0 ? 'am' : 'pm');
    else this.setDraftSegment(name, next);
  }

  private onSegmentKeyDown = (event: KeyboardEvent): void => {
    const target = event.currentTarget as HTMLElement;
    const name = target.dataset['segment'] as SegmentName;
    if (this.liveDisabled) return;

    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      void this.show();
      return;
    }
    const digit = this.inputDigit(event.key);
    if (digit !== undefined && !event.ctrlKey && !event.metaKey && !event.altKey && !this.readonly) {
      event.preventDefault();
      this.acceptDigit(name, digit);
      return;
    }
    if (name === 'dayPeriod' && !this.readonly && (event.key.toLowerCase() === 'a' || event.key.toLowerCase() === 'p')) {
      event.preventDefault();
      this.setDraftSegment(name, event.key.toLowerCase() === 'a' ? 'am' : 'pm');
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const physical = event.key === 'ArrowRight' ? 1 : -1;
      this.resetDigitBuffer();
      this.moveSegment(name, (this.effectiveDirection === 'rtl' ? -physical : physical) as -1 | 1);
      return;
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !this.readonly) {
      event.preventDefault();
      this.resetDigitBuffer();
      this.stepSegment(name, event.key === 'ArrowUp' ? 1 : -1);
      return;
    }
    if ((event.key === 'Home' || event.key === 'End') && !this.readonly) {
      event.preventDefault();
      const bounds = this.segmentBounds(name);
      const next = event.key === 'Home' ? bounds.min : bounds.max;
      this.setDraftSegment(name, name === 'dayPeriod' ? (next === 0 ? 'am' : 'pm') : next);
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && !this.readonly) {
      event.preventDefault();
      this.resetDigitBuffer();
      this.setDraftSegment(name, null);
      return;
    }
    if (event.key === 'Enter') {
      if (this.open) void this.hide();
      else if (!this.readonly) submitOnEnter(this, event);
    }
  };

  private onSegmentPaste = (event: ClipboardEvent): void => {
    if (this.liveDisabled || this.readonly) return;
    const pasted = normalizeTimeValue(event.clipboardData?.getData('text').trim() ?? '');
    if (!pasted) return;
    event.preventDefault();
    this.resetDigitBuffer();
    this.commitUserValue(pasted, 'insertFromPaste', true);
  };

  private onSegmentFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    if (this.liveDisabled) return;
    const target = event.target as HTMLElement;
    const focusedSegment = (target.dataset['segment'] as SegmentName) ?? this.activeSegment;
    if (this.restoringSegmentFocus) {
      queueMicrotask(() => {
        if (this.isConnected && this.segmentOrder.includes(focusedSegment)) {
          this.activeSegment = focusedSegment;
        }
      });
      return;
    } else {
      this.activeSegment = focusedSegment;
    }
    const related = event.relatedTarget;
    if (containsElement(this.renderRoot.querySelector('[part="input"]'), related)) return;
    relayNativeEvent(this, event);
  };

  private onSegmentBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    if (this.pendingSegmentFocus) {
      this.resetDigitBuffer();
      return;
    }
    const related = event.relatedTarget;
    if (containsElement(this.renderRoot.querySelector('[part="input"]'), related)) return;
    // Disabling a focused segment (its tabindex drops to -1) makes the
    // browser force a blur here that is not a real user interaction; don't mark the field touched
    // for it.
    if (!this.liveDisabled) this.touched = true;
    this.resetDigitBuffer();
    relayNativeEvent(this, event);
  };

  private segmentElement(name: SegmentName): HTMLElement | null {
    return this.renderRoot?.querySelector(`[data-segment="${name}"]`) as HTMLElement | null;
  }

  /** Focuses the active segment unless the control is directly or fieldset disabled. */
  override focus(options?: FocusOptions): void {
    if (this.liveDisabled) return;
    const order = this.segmentOrder;
    const activeSegment = this.activeSegmentFor(order);
    if (activeSegment !== this.activeSegment) this.activeSegment = activeSegment;
    this.segmentElement(activeSegment)?.focus(options);
  }

  override blur(): void {
    const active = this.shadowRoot?.activeElement;
    if (active && typeof (active as HTMLElement).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }

  override click(): void {
    if (!this.liveDisabled) this.focus();
  }

  private setOpen(next: boolean): void {
    if (this._open === next) return;
    const old = this._open;
    this._open = next;
    this.syncComponentStates();
    this.requestUpdate('open', old);
  }

  private syncOpenAttribute(): void {
    this.toggleAttribute('open', this._open);
  }

  private requestVisibility(next: boolean, announce: boolean, restoreFocus: boolean): Promise<void> {
    if (this._open === next) return this.visibilityPromise;
    if (next && this.liveDisabled) {
      this.syncOpenAttribute();
      return Promise.resolve();
    }
    if (announce) {
      const event = this.emit(next ? 'lr-show' : 'lr-hide', null, { cancelable: true });
      if (event.defaultPrevented) {
        this.syncOpenAttribute();
        return Promise.resolve();
      }
    }
    this.restoreFocusOnClose = restoreFocus;
    this.setOpen(next);
    this.visibilityPromise = announce
      ? this.settleTransition(next ? 'lr-after-show' : 'lr-after-hide')
      : Promise.resolve();
    return this.visibilityPromise;
  }

  /** Opens the picker unless disabled or vetoed by `lr-show`. */
  show(): Promise<void> {
    return this.requestVisibility(true, true, true);
  }

  /** Closes the picker unless vetoed by `lr-hide`. */
  hide(): Promise<void> {
    return this.requestVisibility(false, true, true);
  }

  private forceClose(restoreFocus: boolean): void {
    if (!this._open) return;
    this.restoreFocusOnClose = restoreFocus;
    this.setOpen(false);
  }

  private async settleTransition(event: 'lr-after-show' | 'lr-after-hide'): Promise<void> {
    const token = ++this.transitionToken;
    await this.updateComplete;
    if (this.transitionToken !== token) return;
    if (this.isConnected) {
      const view = this.ownerDocument.defaultView;
      if (view) await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
      if (this.transitionToken !== token) return;
      const popup = this.renderRoot.querySelector('[part="popup"]');
      const animations = popup?.getAnimations({ subtree: true }) ?? [];
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      if (this.transitionToken !== token) return;
    }
    this.emit(event);
  }

  private positionPopup(): void {
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    const anchor = this.renderRoot.querySelector('[part~="time-input"]') as HTMLElement | null;
    const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
    if (!anchor || !popup) return;
    this.cleanupPositioner = place(anchor, popup, {
      placement: rtlAwarePlacement(this.placement as Placement, this),
      offset: finiteNumber(this.distance, 0),
      sync: 'width',
    });
  }

  private activatePopup(): void {
    if (!this.isConnected) return;
    this.positionPopup();
    this.overlayHandle = activateNonmodalOverlay({
      host: this,
      panel: () => this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null,
      onEscape: () => void this.hide(),
      restoreFocusTo: this.segmentElement(this.activeSegment),
    });
    this.lightDismissDocument = this.ownerDocument;
    this.lightDismissDocument.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.updateComplete.then(() => {
      this.renderRoot.querySelector('[part~="column-item-selected"]')?.scrollIntoView({ block: 'center' });
    });
  }

  private teardownPopup(): void {
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    this.overlayHandle?.deactivate({ restoreFocus: this.restoreFocusOnClose });
    this.overlayHandle = undefined;
    this.lightDismissDocument?.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.lightDismissDocument = undefined;
    this.restoreFocusOnClose = true;
  }

  private onDocumentPointerDown = (event: Event): void => {
    const target = event.composedPath()[0];
    if (isElementNode(target) && composedContains(this, target)) return;
    void this.requestVisibility(false, true, false);
  };

  private onExpand = (): void => {
    if (this.liveDisabled) return;
    if (this.open) void this.hide();
    else void this.show();
  };

  private onClear = (): void => {
    if (this.liveDisabled || this.readonly || (!this.draftHasAny && this.value === '')) return;
    this.touched = true;
    this.commitUserValue('', 'deleteContentBackward', true);
    this.emit('lr-clear');
    this.focus();
  };

  private onNow = (): void => {
    if (this.liveDisabled || this.readonly) return;
    const now = this.now();
    let value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (this.includeSeconds) value += `:${pad(now.getSeconds())}`;
    this.commitUserValue(value);
  };

  private onColumnSelect(name: SegmentName, value: number | DayPeriod): void {
    if (this.readonly || this.liveDisabled) return;
    this.resetDigitBuffer();
    this.setDraftSegment(name, value);
    this.activeSegment = name;
    this.updateComplete.then(() => this.segmentElement(name)?.focus());
  }

  private onPopupPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
  };

  private onAutofillInput = (event: InputEvent): void => {
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement;
    const normalized = normalizeTimeValue(input.value);
    const intentionalClear = input.value === '' && (
      event.isTrusted ||
      event.inputType.startsWith('delete') ||
      event.inputType === 'insertReplacementText'
    );
    if (input.value === '' && this.value !== '' && !intentionalClear) {
      input.value = this.value;
      return;
    }
    if ((input.value !== '' && !normalized) || this.readonly || this.liveDisabled) return;
    this.value = normalized;
    dispatchNativeInputEvent(this, {
      data: event.data,
      inputType: event.inputType || 'insertReplacementText',
    });
    this.emit('lr-input', { value: this.value });
  };

  private onAutofillChange = (event: Event): void => {
    event.stopPropagation();
    const input = event.currentTarget as HTMLInputElement;
    const normalized = normalizeTimeValue(input.value);
    if ((input.value !== '' && !normalized) || this.readonly || this.liveDisabled) return;
    this.value = normalized;
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: this.value });
  };

  private updateSlotState(event: Event): void {
    const slot = event.currentTarget as HTMLSlotElement;
    const present = slot.assignedNodes({ flatten: true }).some(
      (node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? '').trim().length > 0,
    );
    if (slot.name === 'label') this.hasLabelSlot = present;
    else if (slot.name === 'hint') this.hasHintSlot = present;
    else if (slot.name === 'error') this.hasErrorSlot = present;
    else if (slot.name === 'start') this.hasStartSlot = present;
    else if (slot.name === 'end') this.hasEndSlot = present;
    else if (slot.name === 'footer') this.hasFooterSlot = present;
  }

  protected updateValidity(): void {
    // Every barring condition, not just `readonly`: an own/fieldset-cascaded `disabled` (and any
    // platform condition `willValidate` folds in) bars constraint validation exactly as `readonly`
    // does, and this override used to check only the one it happened to own — so a
    // `<lr-time-input required disabled>` kept publishing `valueMissing` and `:state(invalid)`.
    if (isBarredFromValidation(this, this.internals)) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    const flags: ValidityStateFlags = {};
    let message = '';
    if (this.required && this.value === '') flags.valueMissing = true;
    if (this.partial) flags.badInput = true;
    const parsed = parseTimeValue(this.value);
    if (this.value !== '' && !parsed) flags.badInput = true;

    if (parsed && !isTimeInRange(this.value, this.min, this.max)) {
      const parsedMin = parseTimeValue(this.min);
      const parsedMax = parseTimeValue(this.max);
      if (parsedMin && parsedMax && parsedMin.milliseconds > parsedMax.milliseconds) {
        flags.rangeUnderflow = true;
        message = this.localize('timeInputRangeMessage', undefined, {
          min: this.displayTime(this.min),
          max: this.displayTime(this.max),
        });
      } else if (parsedMin && parsed.milliseconds < parsedMin.milliseconds) {
        flags.rangeUnderflow = true;
        message = this.localize('timeInputMinMessage', undefined, { min: this.displayTime(this.min) });
      } else {
        flags.rangeOverflow = true;
        message = this.localize('timeInputMaxMessage', undefined, { max: this.displayTime(this.max) });
      }
    }
    if (parsed && hasTimeStepMismatch(this.value, this.step, this.min, this.defaultValue)) {
      flags.stepMismatch = true;
      message ||= this.localize('timeInputStepMessage');
    }
    if (flags.badInput) message = this.localize('timeInputInvalid');
    else if (flags.valueMissing) message = this.localize('fieldRequired');
    this[SET_ANCHORED_VALIDITY](flags, message);
  }

  override checkValidity(): boolean {
    this.updateValidity();
    return super.checkValidity();
  }

  override reportValidity(): boolean {
    this.touched = true;
    this.updateValidity();
    return super.reportValidity();
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.segmentElement(this.activeSegmentFor());
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
    this.partial = false;
    this.resetDigitBuffer();
  }

  override formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore' = 'restore',
  ): void {
    super.formStateRestoreCallback(state, reason);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      const slots = Array.from(this.children ?? []).map((element) => element.getAttribute('slot'));
      this.hasLabelSlot = slots.includes('label');
      this.hasHintSlot = slots.includes('hint');
      this.hasErrorSlot = slots.includes('error');
      this.hasStartSlot = slots.includes('start');
      this.hasEndSlot = slots.includes('end');
      this.hasFooterSlot = slots.includes('footer');
    }
    if (this.open && this.effectiveDisabled) this.forceClose(false);
    const order = this.segmentOrder;
    const orderKey = order.join('|');
    const orderChanged = orderKey !== this.segmentOrderKey;
    const focusedSegment = orderChanged
      ? (this.shadowRoot?.activeElement?.getAttribute('data-segment') as SegmentName | null)
      : null;
    const nextActiveSegment =
      focusedSegment && order.includes(focusedSegment)
        ? focusedSegment
        : this.activeSegmentFor(order);
    if (focusedSegment) {
      this.pendingSegmentFocus = order.includes(focusedSegment)
        ? focusedSegment
        : nextActiveSegment;
    }
    this.segmentOrderKey = orderKey;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('open')) {
      if (this.open) this.activatePopup();
      else this.teardownPopup();
    } else if (this.open && (changed.has('placement') || changed.has('distance'))) {
      this.positionPopup();
    }
    if (
      changed.has('value') ||
      changed.has('required') ||
      changed.has('readonly') ||
      changed.has('min') ||
      changed.has('max') ||
      changed.has('step')
    ) {
      this.updateValidity();
    }
    this.syncComponentStates();
    this.toggleAttribute('data-invalid', this.touched && !this.validity.valid);
    this.syncRequiredDescription();
    const pendingSegmentFocus = this.pendingSegmentFocus;
    this.pendingSegmentFocus = undefined;
    if (pendingSegmentFocus && !this.effectiveDisabled) {
      this.restoringSegmentFocus = true;
      try {
        this.segmentElement(pendingSegmentFocus)?.focus();
      } finally {
        this.restoringSegmentFocus = false;
      }
    }
  }

  override disconnectedCallback(): void {
    this.releaseRequiredDescription();
    this.transitionToken++;
    this.forceClose(false);
    this.teardownPopup();
    this.syncOpenAttribute();
    this.pendingSegmentFocus = undefined;
    super.disconnectedCallback();
  }

  /** Owns only requiredness text; the rendered hint and error IDs remain the baseline owners. */
  private syncRequiredDescription(): void {
    const target = this.renderRoot.querySelector<HTMLElement>('[part~="input"]');
    const description = this.renderRoot.querySelector<HTMLElement>(`#${this.requiredDescriptionId}`);
    if (!this.required || !target || !description) {
      this.releaseRequiredDescription();
      return;
    }
    if (this.requiredDescriptionTarget !== target) {
      this.releaseRequiredDescription();
      this.requiredDescriptionTarget = target;
      this.requiredDescriptionLease = acquireAriaDescription(target, [description]);
      return;
    }
    this.requiredDescriptionLease?.update([description]);
  }

  private releaseRequiredDescription(): void {
    this.requiredDescriptionLease?.release();
    this.requiredDescriptionLease = undefined;
    this.requiredDescriptionTarget = undefined;
  }

  private renderSegment(name: SegmentName, invalid: boolean): TemplateResult {
    const value = this.segmentNumericValue(name);
    const bounds = this.segmentBounds(name);
    const empty = value === null;
    return html`
      <span
        part="segment"
        role="spinbutton"
        data-segment=${name}
        ?data-empty=${empty}
        tabindex=${this.activeSegmentFor() === name && !this.effectiveDisabled ? '0' : '-1'}
        aria-label=${this.segmentLabel(name)}
        aria-valuemin=${bounds.min}
        aria-valuemax=${bounds.max}
        aria-valuenow=${empty ? nothing : value}
        aria-valuetext=${empty ? this.localize('timeInputEmptySegment') : this.segmentText(name)}
        aria-disabled=${String(this.effectiveDisabled)}
        aria-readonly=${String(this.readonly)}
        aria-required=${String(this.required)}
        aria-invalid=${String(invalid)}
        @keydown=${this.onSegmentKeyDown}
        @paste=${this.onSegmentPaste}
        @focus=${this.onSegmentFocus}
        @blur=${this.onSegmentBlur}
      >${this.segmentText(name)}</span>
    `;
  }

  private renderPatternPart(part: TimePatternPart, invalid: boolean): TemplateResult {
    return part.type === 'literal'
      ? html`<span part="segment-literal" aria-hidden="true">${part.value}</span>`
      : this.renderSegment(part.type, invalid);
  }

  private columnValues(name: SegmentName): Array<number | DayPeriod> {
    const numericStep = finiteNumber(Number(this.step), 60);
    const stepMilliseconds = numericStep > 0 ? numericStep * 1000 : 60_000;
    const stepBase = timeStepBaseMilliseconds(this.min, this.defaultValue);
    const baseRemainder = ((stepBase % stepMilliseconds) + stepMilliseconds) % stepMilliseconds;
    const everyWholeSecondIsOnGrid = stepMilliseconds <= 1000 &&
      Math.abs(1000 % stepMilliseconds) <= 0.000_001 &&
      (baseRemainder <= 0.000_001 || stepMilliseconds - baseRemainder <= 0.000_001);
    if (this.step === 'any' || (!parseTimeValue(this.min) && !parseTimeValue(this.max) && everyWholeSecondIsOnGrid)) {
      if (name === 'dayPeriod') return ['am', 'pm'];
      if (name === 'hour') {
        const length = this.usesTwelveHour ? 12 : 24;
        return Array.from({ length }, (_, index) => this.usesTwelveHour ? index + 1 : index);
      }
      return Array.from({ length: 60 }, (_, value) => value);
    }

    const candidates = this.validPickerGridMilliseconds();
    const candidateValue = (segment: SegmentName, milliseconds: number): number | DayPeriod => {
      const hour = Math.floor(milliseconds / 3_600_000);
      if (segment === 'hour') return this.usesTwelveHour ? hour % 12 || 12 : hour;
      if (segment === 'minute') return Math.floor(milliseconds / 60_000) % 60;
      if (segment === 'second') return Math.floor(milliseconds / 1000) % 60;
      return hour >= 12 ? 'pm' : 'am';
    };
    const matching = candidates.filter((milliseconds) => {
      for (const companion of this.segmentOrder) {
        if (companion === name) continue;
        const current = companion === 'dayPeriod'
          ? this.draft.dayPeriod
          : this.segmentNumericValue(companion);
        if (current !== null && candidateValue(companion, milliseconds) !== current) return false;
      }
      return true;
    });
    const source = matching.length > 0 ? matching : candidates;
    const values = new Set<number | DayPeriod>();
    for (const milliseconds of source) {
      values.add(candidateValue(name, milliseconds));
    }

    const selected = name === 'dayPeriod' ? this.draft.dayPeriod : this.segmentNumericValue(name);
    if (
      selected !== null &&
      parseTimeValue(this.value) &&
      isTimeInRange(this.value, this.min, this.max) &&
      !hasTimeStepMismatch(this.value, this.step, this.min, this.defaultValue)
    ) values.add(selected);
    if (name === 'dayPeriod') return ['am', 'pm'].filter((period) => values.has(period as DayPeriod)) as DayPeriod[];
    return [...values].filter((value): value is number => typeof value === 'number')
      .sort((left, right) => left - right);
  }

  /** Bounded projection of every whole-second point on the effective native time step grid. */
  private validPickerGridMilliseconds(): number[] {
    const key = `${this.step}|${this.min}|${this.max}|${this.defaultValue}`;
    if (key === this.pickerGridKey) return this.pickerGridMilliseconds;
    this.pickerGridKey = key;
    const numericStep = finiteNumber(Number(this.step), 60);
    const stepMilliseconds = (numericStep > 0 ? numericStep : 60) * 1000;
    const base = timeStepBaseMilliseconds(this.min, this.defaultValue);
    const parsedMin = parseTimeValue(this.min);
    const parsedMax = parseTimeValue(this.max);
    const inRange = (milliseconds: number): boolean => {
      if (parsedMin && parsedMax && parsedMin.milliseconds > parsedMax.milliseconds) {
        return milliseconds >= parsedMin.milliseconds || milliseconds <= parsedMax.milliseconds;
      }
      return (!parsedMin || milliseconds >= parsedMin.milliseconds) &&
        (!parsedMax || milliseconds <= parsedMax.milliseconds);
    };
    const values: number[] = [];
    const normalizedBase = ((base % stepMilliseconds) + stepMilliseconds) % stepMilliseconds;
    if (stepMilliseconds >= 1000) {
      for (let milliseconds = normalizedBase; milliseconds < 86_400_000; milliseconds += stepMilliseconds) {
        const wholeSecond = Math.abs(milliseconds % 1000) <= 0.000_001 ||
          Math.abs(1000 - milliseconds % 1000) <= 0.000_001;
        if (wholeSecond && inRange(milliseconds)) values.push(Math.round(milliseconds));
      }
    } else {
      for (let second = 0; second < 86_400; second++) {
        const milliseconds = second * 1000;
        const remainder = ((milliseconds - base) % stepMilliseconds + stepMilliseconds) % stepMilliseconds;
        const onGrid = remainder <= 0.000_001 || stepMilliseconds - remainder <= 0.000_001;
        if (onGrid && inRange(milliseconds)) values.push(milliseconds);
      }
    }
    this.pickerGridMilliseconds = values;
    return values;
  }

  private onColumnKeyDown = (event: KeyboardEvent): void => {
    if (this.liveDisabled) return;
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const current = event.currentTarget as HTMLButtonElement;
    const column = current.closest('[role="listbox"]');
    const options = Array.from(column?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])
      .filter((option) => !option.disabled);
    if (options.length === 0) return;
    event.preventDefault();
    const index = Math.max(0, options.indexOf(current));
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    for (const option of options) option.tabIndex = option === options[nextIndex] ? 0 : -1;
    options[nextIndex]!.focus();
    options[nextIndex]!.scrollIntoView({ block: 'nearest' });
  };

  private isColumnValueSelected(name: SegmentName, value: number | DayPeriod): boolean {
    if (name === 'dayPeriod') return this.draft.dayPeriod === value;
    return this.segmentNumericValue(name) === value;
  }

  private columnText(name: SegmentName, value: number | DayPeriod): string {
    if (name === 'dayPeriod') return dayPeriodLabels(this.effectiveLocale)[value as DayPeriod];
    return this.formattedNumber(value as number, name === 'hour' && this.usesTwelveHour ? 1 : 2);
  }

  private renderColumn(name: SegmentName): TemplateResult {
    const values = this.columnValues(name);
    const hasSelection = values.some((value) => this.isColumnValueSelected(name, value));
    return html`
      <div part="column" role="listbox" aria-label=${this.segmentLabel(name)}>
        ${values.map((value, index) => {
          const selected = this.isColumnValueSelected(name, value);
          return html`
            <button
              type="button"
              part=${selected ? 'column-item column-item-selected' : 'column-item'}
              role="option"
              data-column=${name}
              data-value=${value}
              aria-selected=${String(selected)}
              tabindex=${!this.effectiveDisabled && (selected || (!hasSelection && index === 0)) ? '0' : '-1'}
              ?disabled=${this.effectiveDisabled}
              @pointerdown=${this.onPopupPointerDown}
              @keydown=${this.onColumnKeyDown}
              @click=${() => this.onColumnSelect(name, value)}
            >${this.columnText(name, value)}</button>
          `;
        })}
      </div>
    `;
  }

  override render(): TemplateResult {
    const hasLabel = this.withLabel || this.label.length > 0 || this.hasLabelSlot;
    const hasHint = this.withHint || this.hint.length > 0 || this.hasHintSlot;
    const shownError = this.errorText || (this.touched ? this.validationMessage : '');
    const hasError = this.hasErrorSlot || shownError.length > 0;
    const describedBy = [hasError ? this.errorId : '', hasHint ? this.hintId : ''].filter(Boolean).join(' ');
    const invalid = hasError || (this.touched && !this.validity.valid);
    const hostAccessibleName = this.getAttribute('aria-label');
    const accessibleName = hostAccessibleName ?? (this.label || this.localize('timeInputLabel'));
    const showClear = this.withClear && (this.value !== '' || this.draftHasAny);
    const nativeStep = this.step === 'any' ? 'any' : String(this.step);

    return html`
      <div part="form-control">
        <label id=${this.labelId} part="form-control-label label" ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.updateSlotState}></slot>
        </label>
        <div part="base time-input input-wrapper form-control-input">
          <span part="start" ?hidden=${!this.hasStartSlot}>
            <slot name="start" @slotchange=${this.updateSlotState}></slot>
          </span>
          <div
            id=${this.inputId}
            part="input"
            role="group"
            aria-label=${hostAccessibleName !== null || !hasLabel ? accessibleName : nothing}
            aria-labelledby=${hostAccessibleName === null && hasLabel ? this.labelId : nothing}
            aria-describedby=${describedBy || nothing}
            aria-invalid=${String(invalid)}
            aria-controls=${this.popupId}
            aria-haspopup="dialog"
            aria-expanded=${String(this.open)}
          >${this.pattern.map((part) => this.renderPatternPart(part, invalid))}</div>
          ${showClear
            ? html`
                <button
                  type="button"
                  part="clear-button"
                  aria-label=${this.localize('clear')}
                  ?disabled=${this.effectiveDisabled || this.readonly}
                  @click=${this.onClear}
                ><span aria-hidden="true" inert><slot name="clear-icon">${closeIcon()}</slot></span></button>
              `
            : nothing}
          <span part="end" ?hidden=${!this.hasEndSlot}>
            <slot name="end" @slotchange=${this.updateSlotState}></slot>
          </span>
          <button
            type="button"
            part="expand-button"
            aria-label=${this.localize('timeInputOpen')}
            aria-controls=${this.popupId}
            aria-expanded=${String(this.open)}
            ?disabled=${this.effectiveDisabled}
            @click=${this.onExpand}
          ><span part="expand-icon" aria-hidden="true" inert><slot name="expand-icon">${chevronIcon()}</slot></span></button>
        </div>
        <div
          id=${this.popupId}
          part="popup"
          role="dialog"
          aria-label=${this.localize('timeInputPopup')}
          ?data-hidden=${!this.open}
        >
          <div part="columns">
            ${this.segmentOrder.map((name) => this.renderColumn(name))}
          </div>
          ${this.hasFooterSlot
            ? html`<slot name="footer" @slotchange=${this.updateSlotState}></slot>`
            : this.withNow
              ? html`<button
                  type="button"
                  part="now-button"
                  ?disabled=${this.effectiveDisabled || this.readonly}
                  @click=${this.onNow}
                >${this.localize('timeInputNow')}</button>`
              : html`<slot name="footer" @slotchange=${this.updateSlotState}></slot>`}
        </div>
        <div id=${this.errorId} part="error" ?hidden=${!hasError}>
          ${shownError}<slot name="error" @slotchange=${this.updateSlotState}></slot>
        </div>
        <div id=${this.hintId} part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.updateSlotState}></slot>
        </div>
        <span
          id=${this.requiredDescriptionId}
          class="sr-only"
          data-required-description
          ?hidden=${!this.required}
        >${this.localize('fieldRequired')}</span>
        <input
          class="sr-only"
          data-autofill
          type="time"
          tabindex="-1"
          aria-hidden="true"
          aria-label=${accessibleName}
          .value=${this.value}
          autocomplete=${this.autocomplete}
          min=${this.min}
          max=${this.max}
          step=${nativeStep}
          ?disabled=${this.effectiveDisabled}
          ?readonly=${this.readonly}
          @input=${this.onAutofillInput}
          @change=${this.onAutofillChange}
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-time-input': LyraTimeInput;
  }
}
