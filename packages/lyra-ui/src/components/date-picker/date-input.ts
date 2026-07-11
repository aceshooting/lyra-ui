import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { closeIcon, calendarIcon } from '../../internal/icons.js';
import { parseISO, formatISO, type WeekdayFormat } from './calendar-core.js';
import { styles } from './date-input.styles.js';
import { LyraDatePicker } from './date-picker.js';
import './date-picker.js';

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
 * @csspart form-control, form-control-label, input-wrapper, input, clear-button, expand-button, popup, date-picker, hint, error
 * @slot error - Custom error content.
 */
export class LyraDateInput extends FormAssociated(LyraElement) {
  static styles = [LyraElement.styles, styles];

  @property() mode: 'single' | 'range' = 'single';
  @property() min = '';
  @property() max = '';
  @property({ type: Boolean, reflect: true }) readonly = false;
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

  private cleanupFn?: () => void;
  // Set on the date input's first `blur`; gates the `data-invalid`
  // reflection below so validity styling never flashes on first render.
  @state() private touched = false;

  private get displayText(): string {
    const parts = this.value.split('/');
    const from = parseISO(parts[0] ?? '');
    const to = parseISO(parts[1] ?? '');
    if (!from) return '';
    const fmt = (d: Date) => d.toLocaleDateString(this.locale || undefined);
    return this.mode === 'range' && to ? `${fmt(from)} – ${fmt(to)}` : fmt(from);
  }

  /** Open the calendar popover. */
  show(): void {
    if (this.open || this.disabled || this.readonly) return;
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
    document.removeEventListener('pointerdown', this.onDocPointer);
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
    if (changed.has('touched') || changed.has('required') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  private onInputChange = (e: Event): void => {
    const raw = (e.target as HTMLInputElement).value.trim();
    if (!raw) {
      this.value = '';
      this.emit('input');
      this.emit('change');
      return;
    }
    const parsed = parseISO(raw) ?? (isNaN(Date.parse(raw)) ? null : new Date(Date.parse(raw)));
    if (parsed) {
      this.value = formatISO(parsed);
      this.emit('input');
      this.emit('change');
    }
  };

  private onInputKey = (e: KeyboardEvent): void => {
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      this.show();
    }
  };

  private onInputBlur = (): void => {
    this.touched = true;
  };

  private onPickerChange = (e: Event): void => {
    e.stopPropagation();
    const picker = e.target as LyraDatePicker;
    this.value = picker.value;
    this.emit('input');
    this.emit('change');
    if (this.mode === 'single') this.hide();
  };

  render(): TemplateResult {
    const hasValue = this.value.length > 0;
    return html`
      <div part="form-control">
        <label part="form-control-label">${this.label}<slot name="label"></slot></label>
        <div part="input-wrapper">
          <input
            part="input"
            type="text"
            aria-label=${this.label || this.placeholder || 'Date'}
            .value=${this.displayText}
            placeholder=${this.placeholder}
            ?disabled=${this.disabled}
            ?readonly=${this.readonly}
            @change=${this.onInputChange}
            @keydown=${this.onInputKey}
            @blur=${this.onInputBlur}
          />
          ${this.withClear && hasValue
            ? html`<button
                part="clear-button"
                type="button"
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
            ?disabled=${this.disabled || this.readonly}
            @click=${() => (this.open ? this.hide() : this.show())}
          >
            <span part="expand-icon" aria-hidden="true">${calendarIcon()}</span>
          </button>
        </div>
        <div part="popup" role="dialog" aria-label="Choose date">
          <lyra-date-picker
            part="date-picker"
            .value=${this.value}
            .mode=${this.mode}
            .min=${this.min}
            .max=${this.max}
            .months=${this.months}
            .locale=${this.locale}
            first-day-of-week=${this.firstDayOfWeek}
            weekday-format=${this.weekdayFormat}
            @change=${this.onPickerChange}
          ></lyra-date-picker>
        </div>
        <div part="error">${this.errorText}<slot name="error"></slot></div>
        <div part="hint">${this.hint}<slot name="hint"></slot></div>
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
