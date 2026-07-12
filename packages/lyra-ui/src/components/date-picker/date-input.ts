import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../internal/anchored-validity.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { closeIcon, calendarIcon } from '../../internal/icons.js';
import { parseISO, formatISO, type WeekdayFormat } from './calendar-core.js';
import { styles } from './date-input.styles.js';
import { LyraDatePicker } from './date-picker.js';
import './date-picker.js';

/** Determines the locale's day/month/year field order from a real formatted
 *  sample (Jan 2, 2026 -- a date where day/month/year are all numerically
 *  distinguishable), instead of relying on Date.parse()'s implementation-defined
 *  (commonly mm/dd/yyyy-biased) heuristics for an ambiguous separated date. */
function localeDateOrder(locale: string): ('day' | 'month' | 'year')[] {
  try {
    const parts = new Intl.DateTimeFormat(locale || undefined, {
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

/**
 * `<lyra-date-input>` — a date field with an attached calendar popover.
 * Mirrors the core `<wa-date-input>` API under `lyra-`. Value is ISO 8601
 * (`YYYY-MM-DD`, or `YYYY-MM-DD/YYYY-MM-DD` in range mode). Form-associated.
 *
 * v1 uses a single text field (locale-segmented spinbuttons are a future
 * enhancement); typing accepts ISO or a locale-parseable date.
 *
 * @customElement lyra-date-input
 * @event input - Fired on edits.
 * @event change - Fired on committed date transitions.
 * @event lyra-show / lyra-hide - Calendar popover lifecycle.
 * @event lyra-clear - The clear button was used.
 * @csspart form-control, form-control-label, input-wrapper, input, clear-button, expand-button, expand-icon, popup, date-picker, hint, error
 * @slot label - Custom label content.
 * @slot error - Custom error content.
 * @slot hint - Custom hint content.
 */
export class LyraDateInput extends FormAssociated(LyraElement) {
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
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property() locale = '';
  @property({ type: Number }) months: 1 | 2 = 1;
  @property({ attribute: 'first-day-of-week' }) firstDayOfWeek = 'auto';
  @property({ attribute: 'weekday-format' }) weekdayFormat: WeekdayFormat = 'short';
  @property({ type: Boolean, attribute: 'with-outside-days' }) withOutsideDays = false;

  private cleanupFn?: () => void;
  private inputId = nextId('date-input');
  private popupId = nextId('date-popup');
  // Set on the date input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;
  // `[part]:empty` never matches — the part always contains a literal
  // `<slot>` child element regardless of assigned content — so real
  // emptiness is tracked in JS instead (same fix as lyra-stat's
  // icon/caption, commit 6c1004c) and reflected via `hidden`. Applies to
  // `form-control-label` too: the required-asterisk `::after` attaches to
  // that box, so leaving it always-visible orphans a stray ' *' when no
  // `label` is set.
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  @state() private hasLabelSlot = false;

  private _mode: 'single' | 'range' = 'single';
  private _min = '';
  private _max = '';
  private _readonly = false;
  private _disablePast = false;
  private _disableFuture = false;
  private typedBadInput = false;

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

  private valueDates(value: string): Date[] | null {
    const parts = value.split('/');
    const expectedParts = this.mode === 'range' ? 2 : 1;
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
    if (this.required && this.value === '') flags.valueMissing = true;
    if (this.typedBadInput) flags.badInput = true;

    if (this.value !== '') {
      const dates = this.valueDates(this.value);
      if (!dates) {
        flags.badInput = true;
      } else {
        const min = this.parseStrictISO(this.min);
        const max = this.parseStrictISO(this.max);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (min !== null && dates.some((date) => date < min)) {
          flags.rangeUnderflow = true;
          underflowMessage = `Date must be on or after ${this.min}.`;
        }
        if (this.disablePast && dates.some((date) => date < today)) {
          flags.rangeUnderflow = true;
          underflowMessage ||= 'Date cannot be in the past.';
        }
        if (max !== null && dates.some((date) => date > max)) {
          flags.rangeOverflow = true;
          overflowMessage = `Date must be on or before ${this.max}.`;
        }
        if (this.disableFuture && dates.some((date) => date > today)) {
          flags.rangeOverflow = true;
          overflowMessage ||= 'Date cannot be in the future.';
        }
      }
    }

    let message = '';
    if (flags.badInput) message = 'Enter a valid date.';
    else if (flags.rangeUnderflow) message = underflowMessage;
    else if (flags.rangeOverflow) message = overflowMessage;
    else if (flags.valueMissing) message = 'Please fill out this field.';
    this[SET_ANCHORED_VALIDITY](flags, message);
  }

  private get displayText(): string {
    const parts = this.value.split('/');
    const from = parseISO(parts[0] ?? '');
    const to = parseISO(parts[1] ?? '');
    if (!from) return '';
    const fmt = (d: Date) => d.toLocaleDateString(this.locale || undefined);
    return this.mode === 'range' && to ? `${fmt(from)} – ${fmt(to)}` : fmt(from);
  }

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
    }
  }

  /** Open the calendar popover. */
  show(): void {
    if (this.open || this.effectiveDisabled || this.readonly) return;
    this.open = true;
    this.emit('lyra-show');
    document.addEventListener('pointerdown', this.onDocPointer);
  }
  /** Close the calendar popover. */
  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.emit('lyra-hide');
    document.removeEventListener('pointerdown', this.onDocPointer);
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  /** Clear the value. */
  clear(): void {
    this.value = '';
    this.emit('input');
    this.emit('change');
    this.emit('lyra-clear');
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupFn?.();
    this.cleanupFn = undefined;
    document.removeEventListener('pointerdown', this.onDocPointer);
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
      changed.has('typedBadInput')
    ) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  private onInputChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    const raw = target.value.trim();
    if (!raw) {
      // The mixin's value setter recomputes validity (updateValidity()),
      // which clears any stale badInput state along the way.
      this.value = '';
      this.emit('input');
      this.emit('change');
      return;
    }
    const parsed = this.mode === 'range' ? this.parseRangeText(raw) : this.parseSingleText(raw);
    if (parsed) {
      this.value = parsed;
      this.emit('input');
      this.emit('change');
    } else {
      // Unparseable text: don't silently keep the committed value while the
      // field still shows garbage -- revert the display to the last commit
      // and flag bad input. Parseable dates outside an active bound instead
      // commit above and expose their precise range validity state.
      target.value = this.displayText;
      this.setTypedBadInput(true);
      this.updateValidity();
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
      const order = localeDateOrder(this.locale);
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
      this.hide();
      (this.renderRoot.querySelector('[part="expand-button"]') as HTMLElement | null)?.focus();
    }
  };

  private onInputBlur = (): void => {
    this.touched = true;
  };

  formStateRestoreCallback(
    state: string | File | FormData | null,
    _mode?: 'restore' | 'autocomplete',
  ): void {
    this.value = typeof state === 'string' ? state : '';
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
    this.hide();
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
          <input
            id=${this.inputId}
            part="input"
            type="text"
            aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || 'Date')}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${invalid ? 'true' : 'false'}
            .value=${this.displayText}
            placeholder=${this.placeholder}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readonly}
            @change=${this.onInputChange}
            @keydown=${this.onInputKey}
            @blur=${this.onInputBlur}
          />
          ${this.withClear && hasValue
            ? html`<button
                part="clear-button"
                type="button"
                ?disabled=${this.effectiveDisabled || this.readonly}
                aria-label="Clear"
                @click=${() => this.clear()}
              >
                ${closeIcon()}
              </button>`
            : ''}
          <button
            part="expand-button"
            type="button"
            aria-label="Open calendar"
            aria-haspopup="dialog"
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.popupId}
            ?disabled=${this.effectiveDisabled || this.readonly}
            @click=${() => (this.open ? this.hide() : this.show())}
          >
            <span part="expand-icon" aria-hidden="true">${calendarIcon()}</span>
          </button>
        </div>
        <div id=${this.popupId} part="popup" role="dialog" aria-label="Choose date">
          <lyra-date-picker
            part="date-picker"
            .value=${this.value}
            .mode=${this.mode}
            .min=${this.min}
            .max=${this.max}
            .months=${this.months}
            .locale=${this.locale}
            .disabled=${this.effectiveDisabled}
            .readonly=${this.readonly}
            .disablePast=${this.disablePast}
            .disableFuture=${this.disableFuture}
            .withOutsideDays=${this.withOutsideDays}
            first-day-of-week=${this.firstDayOfWeek}
            weekday-format=${this.weekdayFormat}
            @input=${this.onPickerInput}
            @change=${this.onPickerChange}
          ></lyra-date-picker>
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

defineElement('date-input', LyraDateInput);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-date-input': LyraDateInput;
  }
}
