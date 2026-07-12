import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { chevronIcon } from '../../internal/icons.js';
import { styles } from './date-picker.styles.js';
import {
  monthMatrix,
  weekdayLabels,
  monthTitle,
  formatISO,
  parseISO,
  isSameDay,
  addMonths,
  resolveFirstDayOfWeek,
  type WeekdayFormat,
} from './calendar-core.js';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

/**
 * `<lyra-date-picker>` — an inline month-grid calendar for picking a single date
 * or a date range. Mirrors the core `<wa-date-picker>` API under `lyra-`.
 *
 * Value is ISO 8601: `YYYY-MM-DD` (single) or `YYYY-MM-DD/YYYY-MM-DD` (range).
 *
 * @customElement lyra-date-picker
 * @event change - The user committed a value.
 * @event input - The value changed during interaction (range: after the first click).
 * @csspart base, month, header, title, previous, next, weekdays, weekday, grid
 * @csspart day, day-today, day-outside, day-selected, day-range-start, day-range-end, day-range-inner
 */
export class LyraDatePicker extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** ISO value: `YYYY-MM-DD` or `YYYY-MM-DD/YYYY-MM-DD`. */
  @property() value = '';
  @property() mode: 'single' | 'range' = 'single';
  @property() min = '';
  @property() max = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ type: Number }) months: 1 | 2 = 1;
  @property() locale = '';
  @property({ attribute: 'first-day-of-week' }) firstDayOfWeek = 'auto';
  @property({ attribute: 'weekday-format' }) weekdayFormat: WeekdayFormat = 'short';
  @property({ type: Boolean, attribute: 'disable-past' }) disablePast = false;
  @property({ type: Boolean, attribute: 'disable-future' }) disableFuture = false;
  @property({ type: Boolean, attribute: 'with-outside-days' }) withOutsideDays = false;

  @state() private viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  @state() private focusedDate: Date | null = null;
  private focusPending = false;

  get selection(): DateRange {
    const parts = this.value.split('/');
    return { from: parseISO(parts[0] ?? ''), to: parseISO(parts[1] ?? '') };
  }

  /** Read-only Date view of a single-mode value. */
  get valueAsDate(): Date | null {
    return this.mode === 'single' ? this.selection.from : null;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('value') && this.value) {
      const from = this.selection.from;
      if (from) this.viewDate = new Date(from.getFullYear(), from.getMonth(), 1);
    }
  }

  private get fdow(): number {
    return resolveFirstDayOfWeek(this.firstDayOfWeek, this.locale);
  }

  private isDisabled(d: Date): boolean {
    if (this.disabled || this.readonly) return true;
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    if (min && d < min) return true;
    if (max && d > max) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (this.disablePast && d < today) return true;
    if (this.disableFuture && d > today) return true;
    return false;
  }

  private commit(from: Date | null, to: Date | null, fire: boolean): void {
    this.value =
      this.mode === 'range'
        ? from && to
          ? `${formatISO(from)}/${formatISO(to)}`
          : from
            ? formatISO(from)
            : ''
        : from
          ? formatISO(from)
          : '';
    this.emit('input');
    if (fire) this.emit('change');
  }

  private selectDate(date: Date): void {
    if (this.disabled || this.readonly || this.isDisabled(date)) return;
    this.focusedDate = date;
    if (this.mode === 'range') {
      const { from, to } = this.selection;
      if (!from || (from && to)) {
        this.commit(date, null, false);
      } else {
        let a = from;
        let b = date;
        if (b < a) [a, b] = [b, a];
        this.commit(a, b, true);
      }
    } else {
      this.commit(date, null, true);
    }
  }

  /** Clear the selection and emit input + change. */
  clear(): void {
    this.commit(null, null, true);
  }

  /** Navigate to today and focus it. */
  goToToday(): void {
    this.goToDate(new Date());
  }

  /** Navigate the view to a date and focus it. */
  goToDate(date: string | Date): void {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!d) return;
    this.viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    this.focusedDate = d;
    this.focusPending = true;
  }

  private nav(delta: number): void {
    this.viewDate = addMonths(this.viewDate, delta);
  }

  private onGridKey = (e: KeyboardEvent): void => {
    const current = this.focusedDate ?? this.selection.from ?? new Date();
    let next: Date | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
        break;
      case 'ArrowRight':
        next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
        break;
      case 'ArrowUp':
        next = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7);
        break;
      case 'ArrowDown':
        next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
        break;
      case 'PageUp':
        next = new Date(current.getFullYear(), current.getMonth() - 1, current.getDate());
        break;
      case 'PageDown':
        next = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
        break;
      case 'Home':
        next = new Date(current.getFullYear(), current.getMonth(), 1);
        break;
      case 'End':
        next = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.selectDate(current);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.focusedDate = next;
    this.viewDate = new Date(next.getFullYear(), next.getMonth(), 1);
    this.focusPending = true;
  };

  protected updated(): void {
    if (this.focusPending && this.focusedDate) {
      this.focusPending = false;
      const iso = formatISO(this.focusedDate);
      const cell = this.renderRoot.querySelector(`[data-date="${iso}"]`) as HTMLElement | null;
      cell?.focus();
    }
  }

  private renderDay(date: Date, shownMonth: number): TemplateResult {
    const outside = date.getMonth() !== shownMonth;
    // Outside-month days are empty placeholders by default (matches WA), keeping the
    // 6-row grid aligned without low-contrast faded numbers.
    if (outside && !this.withOutsideDays) {
      return html`<span part="day-placeholder" role="gridcell"></span>`;
    }
    const { from, to } = this.selection;
    const disabled = this.isDisabled(date);
    const today = new Date();
    const isToday = isSameDay(date, today);
    const isStart = from && isSameDay(date, from);
    const isEnd = to && isSameDay(date, to);
    const selected = this.mode === 'single' ? isStart : isStart || isEnd;
    const inRange = this.mode === 'range' && from && to && date > from && date < to;
    const focused =
      this.focusedDate && isSameDay(date, this.focusedDate) ? true : !this.focusedDate && isStart;

    const parts = ['day'];
    if (outside) parts.push('day-outside');
    if (isToday) parts.push('day-today');
    if (selected) parts.push('day-selected');
    if (isStart && this.mode === 'range') parts.push('day-range-start');
    if (isEnd) parts.push('day-range-end');
    if (inRange) parts.push('day-range-inner');

    return html`<button
      part=${parts.join(' ')}
      role="gridcell"
      data-date=${formatISO(date)}
      aria-selected=${selected ? 'true' : 'false'}
      aria-label=${date.toLocaleDateString(this.locale || undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
      tabindex=${focused ? '0' : '-1'}
      ?disabled=${disabled}
      @click=${() => this.selectDate(date)}
    >
      ${date.getDate()}
    </button>`;
  }

  private renderMonth(offset: number): TemplateResult {
    const base = addMonths(this.viewDate, offset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const matrix = monthMatrix(year, month, this.fdow);
    const labels = weekdayLabels(this.fdow, this.weekdayFormat, this.locale);
    const isFirst = offset === 0;
    const isLast = offset === this.months - 1;

    return html`<div part="month">
      <div part="header">
        ${isFirst
          ? html`<button part="previous" type="button" aria-label="Previous month" @click=${() => this.nav(-1)}>
              ${chevronIcon()}
            </button>`
          : html`<span></span>`}
        <div part="title">${monthTitle(year, month, this.locale)}</div>
        ${isLast
          ? html`<button part="next" type="button" aria-label="Next month" @click=${() => this.nav(1)}>
              ${chevronIcon()}
            </button>`
          : html`<span></span>`}
      </div>
      <div part="weekdays">${labels.map((l) => html`<span part="weekday">${l}</span>`)}</div>
      <div part="grid" role="grid" @keydown=${this.onGridKey}>
        ${matrix.map(
          (week) => html`<div part="week" role="row">${week.map((d) => this.renderDay(d, month))}</div>`,
        )}
      </div>
    </div>`;
  }

  render(): TemplateResult {
    const monthEls: TemplateResult[] = [];
    for (let i = 0; i < this.months; i++) monthEls.push(this.renderMonth(i));
    return html`<div part="base">${monthEls}</div>`;
  }
}

defineElement('date-picker', LyraDatePicker);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-date-picker': LyraDatePicker;
  }
}
