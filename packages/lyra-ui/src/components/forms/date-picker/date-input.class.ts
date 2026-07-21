import {
  html,
  nothing,
  type ComplexAttributeConverter,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { closeIcon, calendarIcon } from '../../../internal/icons.js';
import { composedContains, deepActiveElement } from '../../../internal/overlay-manager.js';
import {
  dateTimeFormat,
  parseISO,
  formatISO,
  normalizeCalendarMonths,
  normalizeWeekdayFormat,
  type WeekdayFormat,
} from './calendar-core.js';
import { styles } from './date-input.styles.js';
import { LyraDatePicker } from './date-picker.class.js';
import './date-picker.class.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';

/** Determines the locale's day/month/year field order from a real formatted
 *  sample (Jan 2, 2026 -- a date where day/month/year are all numerically
 *  distinguishable), instead of relying on Date.parse()'s implementation-defined
 *  (commonly mm/dd/yyyy-biased) heuristics for an ambiguous separated date. */
function localeDateOrder(locale: string): ('day' | 'month' | 'year')[] {
  try {
    const parts = getDateTimeFormat(locale || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2026, 0, 2));
    const order = parts
      .filter(
        (p): p is Intl.DateTimeFormatPart & { type: 'day' | 'month' | 'year' } =>
          p.type === 'day' || p.type === 'month' || p.type === 'year',
      )
      .map((p) => p.type);
    return order.length === 3 ? order : ['month', 'day', 'year'];
  } catch {
    return ['month', 'day', 'year']; // Date.parse()'s own bias, as a last-resort fallback
  }
}

const monthsConverter: ComplexAttributeConverter<1 | 2> = {
  fromAttribute: normalizeCalendarMonths,
  toAttribute: normalizeCalendarMonths,
};

/**
 * String-aware boolean attribute converter for `spellcheck`. Lit's built-in
 * `type: Boolean` converter is presence-based -- the attribute's mere
 * presence (regardless of its string value) maps to `true`, so a plain-
 * markup consumer writing the literal `spellcheck="false"` would actually get
 * `true` (this component's default), the opposite of what that string reads
 * as -- the same bug class `<lr-textarea>`'s `spellcheckConverter` and
 * `<lr-generation-status>`'s `showStopConverter` document and fix. Mirrors
 * that shape: attribute absent (or removed) -> `true` (the default);
 * `spellcheck="false"` -> `false`; anything else present (no value,
 * `="true"`, ...) -> `true`.
 */
const spellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
};

const weekdayFormatConverter: ComplexAttributeConverter<WeekdayFormat> = {
  fromAttribute: normalizeWeekdayFormat,
  toAttribute: normalizeWeekdayFormat,
};

export type LyraDateInputSelectionDirection = 'forward' | 'backward' | 'none';
export type LyraDateInputSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

export interface LyraDateInputEventMap {
  'lr-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
  'lr-clear': CustomEvent<undefined>;
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
class LyraDateInputBase extends LyraElement<LyraDateInputEventMap> {}

/**
 * `<lr-date-input>` — a date field with an attached calendar popover.
 * Mirrors the core `<wa-date-input>` API under `lr-`. Value is ISO 8601
 * (`YYYY-MM-DD`, or `YYYY-MM-DD/YYYY-MM-DD` in range mode). Form-associated.
 *
 * This component uses a single text field; typing accepts ISO or a
 * locale-parseable date.
 *
 * `size` uses the same `2xs`–`xl` scale as `lr-input`/`lr-select`/`lr-combobox`'s own `size`,
 * default `m`. The calendar-toggle and clear buttons keep a constant touch-target size at every
 * tier (mirroring `lr-input`'s own password-toggle button), so only the field's density scales.
 *
 * @customElement lr-date-input
 * @event input - Fired on edits.
 * @event change - Fired on committed date transitions.
 * @event lr-show / lr-hide - Calendar popover lifecycle.
 * @event lr-clear - The clear button was used.
 * @event blur - Re-dispatched from the internal `<input>`'s own `blur`, bubbling and composed
 *   unlike the native event.
 * @event focus - Re-dispatched from the internal `<input>`'s own `focus`, for the same reason as
 *   `blur`.
 * @csspart form-control - The outer form-control wrapper.
 * @csspart form-control-label - The label wrapper.
 * @csspart input-wrapper - The input and button wrapper.
 * @csspart input - The text input.
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
 * @cssprop [--lr-date-input-control-min-height=var(--lr-size-2-5rem)] - Minimum block size of the
 *   input row, scaled by `size` to mirror `lr-input`'s own min-height scale. Each default sits
 *   below the row's transitively-pinned height, so it is dead until a consumer raises it -- the
 *   unset render is unchanged.
 * @cssprop --lr-date-input-control-height - Exact block size of the input row. Undeclared by
 *   default, so the row grows to fit its content (floored by `--lr-date-input-control-min-height`).
 *   Set it to pin a fixed height; the calendar toggle keeps its own 24x24 touch target even when
 *   this pins a shorter row.
 * @slot label - Custom label content.
 * @slot error - Custom error content.
 * @slot hint - Custom hint content.
 * @slot start - Adornment at the inline-start of the input row, before the text field.
 * @slot end - Adornment after the text field and the built-in clear action, and before the
 *   calendar toggle — so consumer content never sits outboard of the calendar button.
 */
export class LyraDateInput extends FormAssociated(LyraDateInputBase) {
  static styles = [LyraElement.styles, styles];

  static properties = {
    mode: { noAccessor: true },
    min: { noAccessor: true },
    max: { noAccessor: true },
    readonly: { type: Boolean, reflect: true, noAccessor: true },
    disablePast: { type: Boolean, attribute: 'disable-past', noAccessor: true },
    disableFuture: { type: Boolean, attribute: 'disable-future', noAccessor: true },
  };

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, attribute: 'with-clear' }) withClear = false;
  /** Visual size — same `2xs`–`xl` scale as `lr-input`/`lr-select`/`lr-combobox`'s own `size`.
   *  `'2xs'` is the tightest tier, for dense toolbar-embedded fields. */
  @property({ reflect: true }) size: LyraDateInputSize = 'm';
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
  @property({ converter: spellcheckConverter }) spellcheck = true;
  /** Forwarded to the internal `<input>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() autocapitalize = '';
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
  @property({ attribute: 'inputmode' }) inputMode = '';
  @property({ attribute: 'enterkeyhint' }) enterKeyHint = '';
  /** Overrides the internal `<input>`'s computed accessible name. Wins over
   *  `label`/`placeholder`/the localized `date` fallback in that order --
   *  see the `aria-label` binding in `render()`. Attribute-reflects from a
   *  host-level `aria-label` so a plain-markup consumer gets ARIA-name
   *  forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() locale = '';
  @property({ converter: monthsConverter }) months: 1 | 2 = 1;
  @property({ attribute: 'first-day-of-week' }) firstDayOfWeek = 'auto';
  @property({ attribute: 'weekday-format', converter: weekdayFormatConverter }) weekdayFormat: WeekdayFormat = 'short';
  @property({ type: Boolean, attribute: 'with-outside-days' }) withOutsideDays = false;
  /** Accessible label for the clear button. Override for a non-English `locale`. */
  @property({ attribute: 'clear-label' }) clearLabel = '';
  /** Accessible label for the calendar-toggle button. Override for a non-English `locale`. */
  @property({ attribute: 'open-label' }) openLabel = '';
  /** Accessible name for the calendar popover dialog. Left at the built-in default it
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring this to be set; an explicit override wins verbatim. */
  @property({ attribute: 'dialog-label' }) dialogLabel = 'Choose date';

  @query('input[part="input"]') private inputElement?: HTMLInputElement;

  private cleanupFn?: () => void;
  private popupTrigger?: HTMLElement;
  private restorePopupFocusOnClose = false;
  private inputId = nextId('date-input');
  private popupId = nextId('date-popup');
  // Set on the date input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;

  constructor() {
    super();
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
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasEndSlot = false;
  @state() private validityRevision = 0;

  private _mode: 'single' | 'range' = 'single';
  private _min = '';
  private _max = '';
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
    this.updateValidity();
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
    this.updateValidity();
    this.requestUpdate('readonly', old);
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
    return (this.inputElement?.selectionDirection as LyraDateInputSelectionDirection | null) ?? null;
  }

  set selectionDirection(value: LyraDateInputSelectionDirection | null) {
    if (this.inputElement) this.inputElement.selectionDirection = value ?? 'none';
  }

  get value(): string {
    return super.value;
  }

  set value(next: string) {
    this.setTypedBadInput(false);
    super.value = this.normalizeCommittedValue(next ?? '');
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
    if (parts.length === 2 && dates[0]! > dates[1]!) return `${parts[1]}/${parts[0]}`;
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

  protected updateValidity(): void {
    if (this.readonly) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }

    const flags: ValidityStateFlags = {};
    let underflowMessage = '';
    let overflowMessage = '';
    const incompleteRange = this.isIncompleteRangeValue(this.value);
    if (this.required && (this.value === '' || incompleteRange)) flags.valueMissing = true;
    if (this.typedBadInput) flags.badInput = true;

    if (this.value !== '') {
      const dates = this.valueDates(this.value);
      if (!dates) {
        flags.badInput = true;
      } else {
        const min = this.parseStrictISO(this.min);
        const max = this.parseStrictISO(this.max);
        const today = this.now();
        today.setHours(0, 0, 0, 0);
        if (min !== null && dates.some((date) => date < min)) {
          flags.rangeUnderflow = true;
          underflowMessage = this.localize('dateInputMinMessage', undefined, { min: this.min });
        }
        if (this.disablePast && dates.some((date) => date < today)) {
          flags.rangeUnderflow = true;
          underflowMessage ||= this.localize('dateInputPastDisabled');
        }
        if (max !== null && dates.some((date) => date > max)) {
          flags.rangeOverflow = true;
          overflowMessage = this.localize('dateInputMaxMessage', undefined, { max: this.max });
        }
        if (this.disableFuture && dates.some((date) => date > today)) {
          flags.rangeOverflow = true;
          overflowMessage ||= this.localize('dateInputFutureDisabled');
        }
      }
    }

    let message = '';
    if (flags.badInput) message = this.localize('dateInputInvalid');
    else if (flags.rangeUnderflow) message = underflowMessage;
    else if (flags.rangeOverflow) message = overflowMessage;
    else if (flags.valueMissing) message = this.localize('fieldRequired');
    this[SET_ANCHORED_VALIDITY](flags, message);
  }

  checkValidity(): boolean {
    this.updateValidity();
    return super.checkValidity();
  }

  reportValidity(): boolean {
    this.updateValidity();
    return super.reportValidity();
  }

  private onVisibilityChange = (): void => {
    if (this.ownerDocument.visibilityState !== 'visible') return;
    this.updateValidity();
    this.validityRevision++;
  };

  private get displayText(): string {
    const parts = this.value.split('/');
    // parts[0] always exists (String.split() on '/' never returns an empty array); only
    // parts[1] (the range end) can be missing when `value` has no '/' separator.
    const from = parseISO(parts[0]);
    const to = parseISO(parts[1] ?? '');
    if (!from) return '';
    const formatter = dateTimeFormat(this.effectiveLocale, {});
    const fmt = (d: Date) => formatter.format(d);
    return this.mode === 'range' && to ? `${fmt(from)} – ${fmt(to)}` : fmt(from);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasStartSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'start');
      this.hasEndSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'end');
    }
    if (changed.has('open')) {
      if (this.open) {
        if (!this.popupTrigger) {
          const active = deepActiveElement(this.ownerDocument);
          this.popupTrigger = active && typeof (active as HTMLElement).focus === 'function' ? (active as HTMLElement) : undefined;
        }
        this.ownerDocument.addEventListener('pointerdown', this.onDocPointer);
      } else {
        this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
        const active = deepActiveElement(this.ownerDocument);
        const popup = this.renderRoot.querySelector('[part="popup"]');
        const restoreFocus = this.restorePopupFocusOnClose || (popup !== null && composedContains(popup, active));
        const trigger = this.popupTrigger;
        this.popupTrigger = undefined;
        this.restorePopupFocusOnClose = false;
        if (restoreFocus && trigger?.isConnected) trigger.focus();
      }
    }
  }

  /** Open the calendar popover. */
  show(): void {
    if (this.open || this.effectiveDisabled || this.readonly) return;
    this.open = true;
    this.emit('lr-show');
  }
  /** Close the calendar popover. */
  hide(restoreFocus = false): void {
    if (!this.open) return;
    this.restorePopupFocusOnClose ||= restoreFocus;
    this.open = false;
    this.emit('lr-hide');
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.ownerDocument.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Clear the value. */
  clear(): void {
    // Matches how `onInputBlur` already flips this on the first blur -- an
    // explicit user-initiated clear() is itself an interaction, so a
    // required-and-now-empty field must surface its invalid state right
    // away instead of silently looking valid until some later blur.
    this.touched = true;
    this.value = '';
    this.emit('input');
    this.emit('change');
    this.emit('lr-clear');
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupFn?.();
    this.cleanupFn = undefined;
    this.ownerDocument.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
    this.popupTrigger = undefined;
    this.restorePopupFocusOnClose = false;
    // Reset so a reconnect (e.g. a drag-drop reparent) re-triggers
    // `updated()`'s `open`-driven branch -- without this, `open` stays
    // stuck `true` across the disconnect, `updated()` never sees it
    // *change*, and `place()` never gets called again to re-bind
    // positioning to the (possibly relocated) anchor.
    this.open = false;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('open')) {
      this.cleanupFn?.();
      this.cleanupFn = undefined;
      if (this.open) {
        const anchor = this.renderRoot.querySelector('[part="input-wrapper"]') as HTMLElement | null;
        const popup = this.renderRoot.querySelector('[part="popup"]') as HTMLElement | null;
        if (anchor && popup) this.cleanupFn = place(anchor, popup);
      }
    }
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
      changed.has('typedBadInput') ||
      changed.has('validityRevision')
    ) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
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
    const trimmed = raw.trim();
    if (!trimmed) {
      // The mixin's value setter recomputes validity (updateValidity()),
      // which clears any stale badInput state along the way.
      this.value = '';
      return true;
    }
    const parsed = this.mode === 'range' ? this.parseRangeText(trimmed) : this.parseSingleText(trimmed);
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
    const committed = this.applyTypedText((e.target as HTMLInputElement).value);
    if (committed) {
      this.emit('input');
      this.emit('change');
    }
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
    const looksLikeISO = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    if (looksLikeISO) return parseISO(raw);

    const ambiguous = /^(\d{1,4})[/.-](\d{1,4})[/.-](\d{1,4})$/.exec(raw);
    if (ambiguous) {
      const [, g1, g2, g3] = ambiguous;
      if (g1.length === 4) {
        return parseISO(`${g1}-${g2.padStart(2, '0')}-${g3.padStart(2, '0')}`);
      }
      const order = localeDateOrder(this.effectiveLocale);
      const values = [Number(g1), Number(g2), Number(g3)];
      const fields: Partial<Record<'day' | 'month' | 'year', number>> = {};
      order.forEach((type, i) => {
        fields[type] = values[i];
      });
      if (fields.day != null && fields.month != null && fields.year != null) {
        const year = fields.year < 100 ? 2000 + fields.year : fields.year;
        return parseISO(
          `${String(year).padStart(4, '0')}-${String(fields.month).padStart(2, '0')}-${String(fields.day).padStart(2, '0')}`,
        );
      }
    }

    return isNaN(Date.parse(raw)) ? null : new Date(Date.parse(raw));
  }

  private parseSingleText(raw: string): string | null {
    const parsed = this.parseOneDate(raw);
    return parsed ? formatISO(parsed) : null;
  }

  /** Only round-trips the exact `displayText` shape this component itself
   *  renders (`"<locale from> – <locale to>"`) — a raw ISO range typed
   *  directly (`"2026-05-01/2026-05-15"`) is also accepted as a convenience.
   *  A reversed typed range (`to` before `from`) is normalized into
   *  from-before-to order, matching what the date-picker's own UI-driven
   *  `commit()` already does for a UI-picked range. */
  private parseRangeText(raw: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [a, b] = raw.split('/');
      const from = parseISO(a);
      const to = parseISO(b);
      if (!from || !to) return null;
      return from <= to ? raw : `${b}/${a}`;
    }
    const separator = ' – '; // matches displayText's ` – ` join exactly
    const idx = raw.indexOf(separator);
    if (idx === -1) return null;
    const from = this.parseOneDate(raw.slice(0, idx).trim());
    const to = this.parseOneDate(raw.slice(idx + separator.length).trim());
    if (!from || !to) return null;
    return from <= to ? `${formatISO(from)}/${formatISO(to)}` : `${formatISO(to)}/${formatISO(from)}`;
  }

  private onInputKey = (e: KeyboardEvent): void => {
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      this.show();
    }
  };

  // Attached to the whole form-control, not just the text input, so Escape
  // closes the popover from anywhere inside it -- including the nested
  // picker's own day/nav buttons, which take real DOM focus (roving
  // tabindex) rather than the input keeping focus throughout.
  private onFormControlKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.hide(true);
    }
  };

  private onInputBlur = (): void => {
    this.touched = true;
    this.emit('blur');
  };

  private onInputFocus = (): void => {
    this.emit('focus');
  };

  /** Focus the internal date text input. */
  override focus(options?: FocusOptions): void {
    this.inputElement?.focus(options);
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
    direction?: LyraDateInputSelectionDirection,
  ): void {
    this.inputElement?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
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

  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.value = typeof state === 'string' ? state : '';
  }

  formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onStartSlotChange = (e: Event): void => {
    this.hasStartSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onEndSlotChange = (e: Event): void => {
    this.hasEndSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // The nested picker's `input` event isn't wired anywhere else, so without
  // this listener it bubbles+composes straight through this shadow boundary
  // (LyraElement.emit always dispatches bubbles:true, composed:true) and
  // fires on this host a *second* time, on top of the explicit emit below.
  private onPickerInput = (e: Event): void => {
    e.stopPropagation();
    const picker = e.target as LyraDatePicker;
    this.value = picker.value;
    this.emit('input');
  };

  private onPickerChange = (e: Event): void => {
    e.stopPropagation();
    const picker = e.target as LyraDatePicker;
    this.value = picker.value;
    this.emit('change');
    // The picker only fires `change` once a selection is finalized (a single
    // pick, or the second click of a range), so this is always the right
    // moment to close, in either mode.
    this.hide(true);
  };

  render(): TemplateResult {
    const hasValue = this.value.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const invalid = this.touched && !this.internals.validity.valid;
    const describedBy = [hasError ? 'date-input-error' : '', hasHint ? 'date-input-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      <div part="form-control" @keydown=${this.onFormControlKey}>
        <label part="form-control-label" for=${this.inputId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </label>
        <div part="input-wrapper">
          <span part="start" ?hidden=${!this.hasStartSlot}>
            <slot name="start" @slotchange=${this.onStartSlotChange}></slot>
          </span>
          <input
            id=${this.inputId}
            part="input"
            type="text"
            aria-label=${this.accessibleLabel || (hasLabel ? nothing : this.placeholder || this.localize('date'))}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${invalid ? 'true' : 'false'}
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
            @change=${this.onInputChange}
            @keydown=${this.onInputKey}
            @focus=${this.onInputFocus}
            @blur=${this.onInputBlur}
          />
          ${this.withClear && hasValue
            ? html`<button
                part="clear-button"
                type="button"
                ?disabled=${this.effectiveDisabled || this.readonly}
                aria-label=${this.localize('clear', this.clearLabel || undefined)}
                @click=${() => this.clear()}
              >
                ${closeIcon()}
              </button>`
            : ''}
          <span part="end" ?hidden=${!this.hasEndSlot}>
            <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
          </span>
          <button
            part="expand-button"
            type="button"
            aria-label=${this.localize('openCalendar', this.openLabel || undefined)}
            aria-haspopup="dialog"
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.popupId}
            ?disabled=${this.effectiveDisabled || this.readonly}
            @click=${() => (this.open ? this.hide() : this.show())}
          >
            <span part="expand-icon" aria-hidden="true">${calendarIcon()}</span>
          </button>
        </div>
        <div
          id=${this.popupId}
          part="popup"
          role="dialog"
          aria-label=${this.localize(
            'chooseDate',
            this.dialogLabel === 'Choose date' ? undefined : this.dialogLabel,
          )}
        >
          <lr-date-picker
            part="date-picker"
            .value=${this.value}
            .mode=${this.mode}
            .min=${this.min}
            .max=${this.max}
            .months=${normalizeCalendarMonths(this.months)}
            .locale=${this.effectiveLocale}
            .disabled=${this.effectiveDisabled}
            .readonly=${this.readonly}
            .disablePast=${this.disablePast}
            .disableFuture=${this.disableFuture}
            .withOutsideDays=${this.withOutsideDays}
            first-day-of-week=${this.firstDayOfWeek}
            .weekdayFormat=${normalizeWeekdayFormat(this.weekdayFormat)}
            @input=${this.onPickerInput}
            @change=${this.onPickerChange}
          ></lr-date-picker>
        </div>
        <div id="date-input-error" part="error" ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
        <div id="date-input-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
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
