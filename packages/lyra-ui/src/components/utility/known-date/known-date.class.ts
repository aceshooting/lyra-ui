import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './known-date.styles.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';

export type LyraKnownDateSize = 'xs' | 's' | 'm' | 'l' | 'xl';
export type LyraKnownDateField = 'day' | 'month' | 'year';

/** Parse `YYYY-MM-DD` into a local Date, or null if invalid (calendar-invalid
 *  combinations like Feb 30 are rejected, not silently rolled over). Local
 *  port of `date-picker/calendar-core.ts#parseISO` -- duplicated rather than
 *  imported so this component's own directory stays self-contained. */
function parseISO(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** Format a Date as local `YYYY-MM-DD`. Local port of
 *  `date-picker/calendar-core.ts#formatISO` -- see {@link parseISO}. */
function formatISO(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Determines the locale's day/month/year field order from a real formatted
 *  sample (Jan 2, 2026 -- a date where day/month/year are all numerically
 *  distinguishable), instead of relying on `Date.parse()`'s implementation-
 *  defined (commonly mm/dd/yyyy-biased) heuristics for an ambiguous separated
 *  date. Local port of `date-picker/date-input.class.ts`'s own
 *  `localeDateOrder()` -- see {@link parseISO}'s doc comment for why it's
 *  duplicated rather than imported. */
function localeDateOrder(locale: string): LyraKnownDateField[] {
  try {
    const parts = getDateTimeFormat(locale || undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(2026, 0, 2));
    const order = parts
      .filter(
        (p): p is Intl.DateTimeFormatPart & { type: LyraKnownDateField } =>
          p.type === 'day' || p.type === 'month' || p.type === 'year',
      )
      .map((p) => p.type);
    return order.length === 3 ? order : ['month', 'day', 'year'];
  } catch {
    return ['month', 'day', 'year']; // Date.parse()'s own bias, as a last-resort fallback
  }
}

export interface LyraKnownDateEventDetail {
  /** Canonical ISO 8601 date (`YYYY-MM-DD`), or `''` while incomplete/invalid. Mirrors `value`. */
  value: string;
  /** Per-field raw text as currently typed, always present even while incomplete. */
  day: string;
  month: string;
  year: string;
  /** Which field the user was last editing when this event fired. */
  field: LyraKnownDateField;
}

export interface LyraKnownDateEventMap {
  input: CustomEvent<LyraKnownDateEventDetail>;
  change: CustomEvent<LyraKnownDateEventDetail>;
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
}

class LyraKnownDateBase extends LyraElement<LyraKnownDateEventMap> {}

/**
 * `<lr-known-date>` — a date a user already knows (a birthdate, a passport
 * issue/expiry date) collected as three plain, labeled day/month/year number
 * fields in the locale's natural field order, rather than a calendar popup.
 * Form-associated; the submitted form value is always canonical ISO 8601
 * (`YYYY-MM-DD`), or `''` while any field is blank or the combination isn't a
 * real calendar date. Mirrors Web Awesome's `wa-known-date` API surface under
 * `lr-`, with `appearance`/`pill`/`form` dropped and `size` normalized to
 * this library's own `xs`–`xl` scale, matching every other lyra form control
 * mirrored from a Web Awesome counterpart.
 *
 * A field's own `<input>` shows exactly what was typed (never reformatted or
 * reverted) -- only the composite `value` is zero-padded. Auto-advance
 * (typing a field's last digit moves focus to the next field) and
 * backspace-to-previous-field-when-empty are this library's own additions on
 * top of Web Awesome's bare typing model, which documents no auto-advance;
 * don't remove them to "restore" WA parity. Arrow-key field-to-field
 * navigation at a field's text boundary is RTL-aware: the *physical* key that
 * means "toward the next field" flips under an inherited `dir="rtl"`, while
 * the field order itself (locale-derived) does not. Non-digit keystrokes are
 * rejected before they reach a field's state -- no locale-specific numeral
 * input (e.g. Arabic-Indic digits) is supported.
 *
 * No resizable text-editing surface exists (three fixed-width digit fields),
 * so resize forwarding doesn't apply, and `spellcheck`/`autocapitalize`/
 * `autocorrect`/`wrap` don't meaningfully apply to 2–4-digit numeric fields
 * either -- the same carve-out `lr-input[type="number"]` already documents.
 *
 * @customElement lr-known-date
 * @event input - Fires on every keystroke in any field. `detail.value` is the canonical ISO date
 *   only once all three fields resolve to a real calendar date, otherwise `''`; `detail.day`/
 *   `month`/`year` always carry the live raw typed text.
 * @event change - Fires when a field loses focus (including a Tab/auto-advance move away from it)
 *   and the composite value has newly transitioned to a different complete date, or from complete
 *   back to incomplete/blank. Programmatic `value`/`valueAsDate` assignment stays silent.
 * @event focus - Re-dispatched, bubbling and composed, when any of the three internal fields
 *   receives focus (native `focus` doesn't bubble or cross a shadow boundary).
 * @event blur - Re-dispatched, bubbling and composed, once when focus leaves all three internal
 *   fields for something outside the control -- not once per internal field-to-field Tab.
 * @slot label - Custom label/legend content, alongside the `label` attribute.
 * @slot hint - Custom hint content, alongside the `hint` attribute.
 * @slot error - Custom error content, alongside the `errorText` attribute.
 * @csspart form-control - The outer wrapper around legend, fieldset, hint, and error.
 * @csspart fieldset - The `<fieldset>` grouping the three fields.
 * @csspart legend - The `<legend>` element.
 * @csspart fields - The row wrapping the three field blocks.
 * @csspart field - Each field block (label + input), repeated three times; distinguished by
 *   `data-field="day"|"month"|"year"`.
 * @csspart field-input - The native per-field `<input type="text" inputmode="numeric">`, repeated
 *   three times; distinguished by `data-field="day"|"month"|"year"`.
 * @csspart field-label - The small visible per-field text label ("Day"/"Month"/"Year").
 * @csspart hint - The hint message.
 * @csspart error - The validation message.
 * @cssprop [--lr-known-date-field-padding-block=var(--lr-space-s)] - Block padding of each
 *   `field-input`, auto-swapped per `size`.
 * @cssprop [--lr-known-date-field-padding-inline=var(--lr-space-s)] - Inline padding of each
 *   `field-input`, auto-swapped per `size`.
 * @cssprop [--lr-known-date-field-font-size=var(--lr-font-size-md-sm)] - Font size of each
 *   `field-input`, auto-swapped per `size`.
 * @cssprop [--lr-known-date-field-min-height=var(--lr-size-2-5rem)] - Minimum block size of each
 *   `field-input`, auto-swapped per `size` (`xs`→`1.5rem`, `s`→`1.875rem`, `l`→`3rem`,
 *   `xl`→`3.5rem`) -- matches `lr-input`'s/`lr-date-input`'s own min-height scale, so a birthdate
 *   field sitting in a form row next to those controls renders at the same height. At `xs`/`s`/`m`
 *   the floor now exceeds the field's own content height and actively pins the rendered box; at
 *   `l`/`xl` the content height already exceeds the floor, so those two tiers are unaffected.
 * @cssprop --lr-known-date-field-height - Exact block size of each `field-input`. Undeclared by
 *   default, so the field grows to fit its content, floored by `--lr-known-date-field-min-height`.
 *   Set it to pin a fixed height.
 * @cssprop [--lr-known-date-field-gap=var(--lr-space-s)] - Gap between the three field blocks.
 * @cssprop [--lr-known-date-day-field-width=var(--lr-size-3-5em)] - Inline size of the day field.
 * @cssprop [--lr-known-date-month-field-width=var(--lr-size-3-5em)] - Inline size of the month
 *   field.
 * @cssprop [--lr-known-date-year-field-width=var(--lr-size-5em)] - Inline size of the year field.
 * @cssprop [--lr-known-date-invalid-border-color=var(--lr-color-danger)] - Border color of each
 *   `field-input` while `:host([data-invalid])` is set.
 */
export class LyraKnownDate extends FormAssociated(LyraKnownDateBase) {
  static styles = [LyraElement.styles, styles];

  static properties = {
    min: { noAccessor: true },
    max: { noAccessor: true },
    readonly: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property({ reflect: true }) size: LyraKnownDateSize = 'm';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  /** BCP-47 override for field order and field-label localization sampling. Empty string falls
   *  back to `this.effectiveLocale` (inherited `lang`/ancestor), exactly like `lr-date-input`'s
   *  `locale`. Redeclared (non-reflecting) over `LyraElement`'s own reflecting `locale` for the
   *  same reason `lr-date-input` does. */
  @property() locale = '';
  /** Forwarded to the internal day field as-is when non-empty. The special value `'bday'`
   *  expands into `'bday-day'`/`'bday-month'`/`'bday-year'` split across the three fields; any
   *  other non-empty value is forwarded verbatim to all three fields unmodified. */
  @property() autocomplete = '';
  /** Overrides the fieldset's computed accessible name (normally the `<legend>`'s content). Applied
   *  as `aria-label` on the `part="fieldset"` element, which owns the role -- not just the host. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  /** Visible + accessible per-field label for the day field. Routes through
   *  `this.localize('knownDateDay', ...)`. */
  @property({ attribute: 'day-label' }) dayLabel = 'Day';
  /** Visible + accessible per-field label for the month field. Routes through
   *  `this.localize('knownDateMonth', ...)`. */
  @property({ attribute: 'month-label' }) monthLabel = 'Month';
  /** Visible + accessible per-field label for the year field. Routes through
   *  `this.localize('knownDateYear', ...)`. */
  @property({ attribute: 'year-label' }) yearLabel = 'Year';

  @state() private dayText = '';
  @state() private monthText = '';
  @state() private yearText = '';
  // Set on the first blur that leaves the whole control (not a field-to-field
  // Tab); gates the touched-only invalid presentation, same as every other
  // lyra form control.
  @state() private touched = false;
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;

  private _min = '';
  private _max = '';
  private _readonly = false;
  /** The last value a `change` event was fired for (or the constructed initial value) -- lets
   *  `commitChangeIfNeeded()` fire `change` only on a real transition, matching `lr-date-input`'s
   *  own "input fires more often than change" contract. */
  private lastCommittedValue = '';
  private lastEditedField: LyraKnownDateField = 'day';

  private readonly hintId = nextId('known-date-hint');
  private readonly errorId = nextId('known-date-error');
  private readonly dayId = nextId('known-date-day');
  private readonly monthId = nextId('known-date-month');
  private readonly yearId = nextId('known-date-year');

  constructor() {
    super();
    this.addEventListener('invalid', () => {
      this.touched = true;
    });
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

  get value(): string {
    return super.value;
  }

  /** Normalizes an assignment to the canonical ISO date or `''`, and repopulates the three raw
   *  field texts to match -- a declarative `value="2007-3-27"` (non-padded) or a calendar-invalid
   *  literal (`"2007-02-30"`) sanitizes to `''`, same strict-ISO gate as `lr-date-input`'s
   *  `parseStrictISO()`. Programmatic assignment stays silent (no `input`/`change`), matching every
   *  `FormAssociated` sibling's documented contract. */
  set value(next: string) {
    const parsed = this.parseStrictISO(next ?? '');
    if (parsed) {
      this.dayText = String(parsed.getDate());
      this.monthText = String(parsed.getMonth() + 1);
      this.yearText = String(parsed.getFullYear());
      super.value = formatISO(parsed);
    } else {
      this.dayText = '';
      this.monthText = '';
      this.yearText = '';
      super.value = '';
    }
    this.lastCommittedValue = super.value;
  }

  /** The composite value as a local-midnight `Date`, or `null` while incomplete/invalid. */
  get valueAsDate(): Date | null {
    return this.value ? parseISO(this.value) : null;
  }

  set valueAsDate(next: Date | null) {
    this.value = next ? formatISO(next) : '';
  }

  private parseStrictISO(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return parseISO(value);
  }

  private get fieldOrder(): LyraKnownDateField[] {
    return localeDateOrder(this.effectiveLocale);
  }

  private textFor(field: LyraKnownDateField): string {
    if (field === 'day') return this.dayText;
    if (field === 'month') return this.monthText;
    return this.yearText;
  }

  private setFieldText(field: LyraKnownDateField, text: string): void {
    if (field === 'day') this.dayText = text;
    else if (field === 'month') this.monthText = text;
    else this.yearText = text;
  }

  private idFor(field: LyraKnownDateField): string {
    if (field === 'day') return this.dayId;
    if (field === 'month') return this.monthId;
    return this.yearId;
  }

  private get effectiveDayLabel(): string {
    return this.localize('knownDateDay', this.dayLabel === 'Day' ? undefined : this.dayLabel);
  }

  private get effectiveMonthLabel(): string {
    return this.localize('knownDateMonth', this.monthLabel === 'Month' ? undefined : this.monthLabel);
  }

  private get effectiveYearLabel(): string {
    return this.localize('knownDateYear', this.yearLabel === 'Year' ? undefined : this.yearLabel);
  }

  private labelFor(field: LyraKnownDateField): string {
    if (field === 'day') return this.effectiveDayLabel;
    if (field === 'month') return this.effectiveMonthLabel;
    return this.effectiveYearLabel;
  }

  /** `'bday'` expands into per-field companion tokens; any other non-empty value forwards
   *  verbatim to all three fields (see the `autocomplete` property doc comment). */
  private autocompleteFor(field: LyraKnownDateField): string {
    if (!this.autocomplete) return '';
    if (this.autocomplete === 'bday') return `bday-${field}`;
    return this.autocomplete;
  }

  /** Computes the canonical zero-padded ISO date from the three raw typed field texts, or `''`
   *  when any field is empty or the combination isn't a real calendar date. */
  private computeCanonicalValue(): string {
    if (!this.dayText || !this.monthText || !this.yearText) return '';
    const iso = `${this.yearText.padStart(4, '0')}-${this.monthText.padStart(2, '0')}-${this.dayText.padStart(2, '0')}`;
    return parseISO(iso) ? iso : '';
  }

  /** Recomputes the composite value from the three field texts and pushes it through the base
   *  `FormAssociated` setter directly (bypassing this class's own `value` setter above, which
   *  would otherwise re-derive and clobber the raw per-field text this method is reading from). */
  private commitFromFields(): void {
    super.value = this.computeCanonicalValue();
  }

  private get eventDetail(): Omit<LyraKnownDateEventDetail, 'field'> {
    return { value: this.value, day: this.dayText, month: this.monthText, year: this.yearText };
  }

  private detailFor(field: LyraKnownDateField): LyraKnownDateEventDetail {
    return { ...this.eventDetail, field };
  }

  /** Fires `change` only on a real transition of the composite value -- called on every field
   *  blur (whether that blur stays inside the control or leaves it), which also covers an
   *  auto-advance move since focusing another field synchronously blurs the current one first. */
  private commitChangeIfNeeded(): void {
    if (this.value === this.lastCommittedValue) return;
    this.lastCommittedValue = this.value;
    this.emit('change', this.detailFor(this.lastEditedField));
  }

  private fieldInputElement(field: LyraKnownDateField): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>(`input[data-field="${field}"]`);
  }

  /** Moves focus to the field `delta` steps away from `field` in locale field order; a no-op past
   *  either end (e.g. Backspace-empty on the first field, or auto-advance past the last field). */
  private focusAdjacentField(field: LyraKnownDateField, delta: number): void {
    const order = this.fieldOrder;
    const targetIndex = order.indexOf(field) + delta;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    this.fieldInputElement(order[targetIndex]!)?.focus();
  }

  protected updateValidity(): void {
    if (this.readonly) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    const flags: ValidityStateFlags = {};
    let message = '';
    const blank = this.dayText === '' && this.monthText === '' && this.yearText === '';

    if (this.value === '') {
      // A blank composite is `valueMissing` only when *all three* fields are
      // blank (native `<input required>`'s own "empty string" semantics
      // applied here) -- a partially filled required date is `badInput`
      // instead, since an incomplete date is bad input, not a missing one.
      if (this.required && blank) {
        flags.valueMissing = true;
        message = this.localize('fieldRequired');
      } else if (!blank) {
        flags.badInput = true;
        message = this.localize('dateInputInvalid');
      }
    } else {
      const date = parseISO(this.value)!;
      const min = this.parseStrictISO(this.min);
      const max = this.parseStrictISO(this.max);
      if (min && date < min) {
        flags.rangeUnderflow = true;
        message = this.localize('dateInputMinMessage', undefined, { min: this.min });
      }
      if (max && date > max) {
        flags.rangeOverflow = true;
        message ||= this.localize('dateInputMaxMessage', undefined, { max: this.max });
      }
    }
    this[SET_ANCHORED_VALIDITY](flags, message);
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // Unconditional (not gated on `changed.has('value')`) -- `value` uses
    // `noAccessor` and its base setter is never invoked for a freshly
    // constructed, attribute-less instance (the constructor seeds the form
    // value directly via `internals.setFormValue('')`), so a `changed`-gated
    // check would leave `:state(blank)` never set at all for that common
    // case. Both branches are idempotent, so running this on every update is
    // cheap and always correct.
    if (this.value === '') this.internals.states.add('blank');
    else this.internals.states.delete('blank');
    if (
      changed.has('touched') ||
      changed.has('required') ||
      changed.has('value') ||
      changed.has('min') ||
      changed.has('max') ||
      changed.has('readonly')
    ) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  private onLabelSlotChange = (e: Event): void => {
    this.hasLabelSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onFieldInput = (field: LyraKnownDateField, e: Event): void => {
    const input = e.target as HTMLInputElement;
    const maxLength = field === 'year' ? 4 : 2;
    const digits = input.value.replace(/\D/g, '').slice(0, maxLength);
    if (input.value !== digits) input.value = digits;
    this.setFieldText(field, digits);
    this.lastEditedField = field;
    this.commitFromFields();
    this.emit('input', this.detailFor(field));
    // Auto-advance is purely digit-count-based (length reaches the field's
    // own cap), not value-based -- this library's own addition layered on
    // top of Web Awesome's bare typing model, see the class doc comment.
    if (field !== 'year' && digits.length === maxLength) this.focusAdjacentField(field, 1);
  };

  private onFieldKeydown = (field: LyraKnownDateField, e: KeyboardEvent): void => {
    const input = e.currentTarget as HTMLInputElement;
    if (e.key === 'Backspace' && this.textFor(field) === '') {
      e.preventDefault();
      this.focusAdjacentField(field, -1);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    const rtl = this.effectiveDirection === 'rtl';
    // The physical key that means "toward the next field" flips under an
    // inherited RTL direction; the field order itself does not.
    if (e.key === 'ArrowLeft' && atStart) {
      e.preventDefault();
      this.focusAdjacentField(field, rtl ? 1 : -1);
    } else if (e.key === 'ArrowRight' && atEnd) {
      e.preventDefault();
      this.focusAdjacentField(field, rtl ? -1 : 1);
    }
  };

  private onFieldFocus = (): void => {
    this.emit('focus');
  };

  private onFieldBlur = (e: FocusEvent): void => {
    // Native blur can be observed at the shadow host in some engines even though it does not
    // bubble. Suppress that private field event so the public bridge below emits exactly one host
    // event when focus leaves the composite control.
    e.stopPropagation();
    this.commitChangeIfNeeded();
    const related = e.relatedTarget as Node | null;
    const active = this.shadowRoot?.activeElement;
    const staysInsideControl =
      e.isTrusted &&
      ((related instanceof HTMLInputElement && related.dataset.field !== undefined) ||
        (active instanceof HTMLInputElement && active !== e.target && active.dataset.field !== undefined));
    if (staysInsideControl) return;
    this.touched = true;
    this.emit('blur');
  };

  /** Focuses the first field in locale order. */
  override focus(options?: FocusOptions): void {
    this.fieldInputElement(this.fieldOrder[0]!)?.focus(options);
  }

  /** Blurs whichever internal field currently has focus, if any. */
  override blur(): void {
    (this.renderRoot.querySelector('input:focus') as HTMLInputElement | null)?.blur();
  }

  private renderField(field: LyraKnownDateField, describedBy: string, invalid: boolean): TemplateResult {
    const id = this.idFor(field);
    const maxLength = field === 'year' ? 4 : 2;
    return html`
      <div part="field" data-field=${field}>
        <label part="field-label" for=${id}>${this.labelFor(field)}</label>
        <input
          id=${id}
          part="field-input"
          data-field=${field}
          type="text"
          inputmode="numeric"
          maxlength=${maxLength}
          autocomplete=${this.autocompleteFor(field) || nothing}
          aria-describedby=${describedBy || nothing}
          aria-invalid=${invalid ? 'true' : 'false'}
          aria-required=${this.required ? 'true' : 'false'}
          aria-readonly=${this.readonly ? 'true' : 'false'}
          .value=${this.textFor(field)}
          ?required=${this.required}
          ?disabled=${this.effectiveDisabled}
          ?readonly=${this.readonly}
          @input=${(e: Event) => this.onFieldInput(field, e)}
          @keydown=${(e: KeyboardEvent) => this.onFieldKeydown(field, e)}
          @focus=${this.onFieldFocus}
          @blur=${this.onFieldBlur}
        />
      </div>
    `;
  }

  render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const validationError = this.touched ? this.validationMessage : '';
    const renderedError = this.errorText || validationError;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || renderedError.length > 0;
    const invalid = this.touched && !this.internals.validity.valid;
    const describedBy = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ');

    return html`
      <div part="form-control">
        <fieldset part="fieldset" aria-label=${this.accessibleLabel || nothing}>
          <legend part="legend" ?hidden=${!hasLabel}>
            <slot name="label" @slotchange=${this.onLabelSlotChange}>${this.label}</slot>
          </legend>
          <div part="fields">
            ${this.fieldOrder.map((field) => this.renderField(field, describedBy, invalid))}
          </div>
        </fieldset>
        <div id=${this.hintId} part="hint" ?hidden=${!hasHint}>
          <slot name="hint" @slotchange=${this.onHintSlotChange}>${this.hint}</slot>
        </div>
        <div id=${this.errorId} part="error" role="alert" ?hidden=${!hasError}>
          <slot name="error" @slotchange=${this.onErrorSlotChange}>${renderedError}</slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-known-date': LyraKnownDate;
  }
}
