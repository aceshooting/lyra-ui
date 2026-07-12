import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
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
  clampDate,
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
 * @csspart base, month, header, title, previous, next, weekdays, weekday, grid, week
 * @csspart day, day-today, day-outside, day-selected, day-range-start, day-range-end, day-range-inner, day-placeholder
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
  // Set right before `commit()` assigns `value`, so `willUpdate` can tell its
  // own write apart from an external assignment. Internal commits already
  // know the right date is on-screen (it's the cell the user just clicked, or
  // the view the user navigated to), so they must not force the view back to
  // `selection.from`'s month -- only an externally-set `value` should do that.
  private suppressViewSync = false;

  get selection(): DateRange {
    const parts = this.value.split('/');
    return { from: parseISO(parts[0] ?? ''), to: parseISO(parts[1] ?? '') };
  }

  /** Read-only Date view of a single-mode value. */
  get valueAsDate(): Date | null {
    return this.mode === 'single' ? this.selection.from : null;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('value')) {
      const external = !this.suppressViewSync;
      this.suppressViewSync = false;
      if (external && this.value) {
        const from = this.selection.from;
        if (from) this.viewDate = new Date(from.getFullYear(), from.getMonth(), 1);
      }
    }
  }

  private get fdow(): number {
    return resolveFirstDayOfWeek(this.firstDayOfWeek, this.locale);
  }

  private isDisabled(d: Date, min: Date | null, max: Date | null, today: Date): boolean {
    if (this.disabled || this.readonly) return true;
    if (min && d < min) return true;
    if (max && d > max) return true;
    if (this.disablePast && d < today) return true;
    if (this.disableFuture && d > today) return true;
    return false;
  }

  private commit(from: Date | null, to: Date | null, fire: boolean): void {
    const next =
      this.mode === 'range'
        ? from && to
          ? `${formatISO(from)}/${formatISO(to)}`
          : from
            ? formatISO(from)
            : ''
        : from
          ? formatISO(from)
          : '';
    // Only arm the suppression when `value` is actually about to change --
    // that's the only case `willUpdate` will see `changed.has('value')` and
    // get a chance to consume (and clear) the flag.
    if (next !== this.value) this.suppressViewSync = true;
    this.value = next;
    this.emit('input');
    if (fire) this.emit('change');
  }

  private selectDate(date: Date): void {
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (this.isDisabled(date, min, max, today)) return;
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

  /** Navigate the view to a date and focus it, clamped to `min`/`max`. */
  goToDate(date: string | Date): void {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!d) return;
    const clamped = clampDate(d, parseISO(this.min), parseISO(this.max));
    this.viewDate = new Date(clamped.getFullYear(), clamped.getMonth(), 1);
    this.focusedDate = clamped;
    this.focusPending = true;
  }

  private nav(delta: number): void {
    this.viewDate = addMonths(this.viewDate, delta);
  }

  private onGridKey = (e: KeyboardEvent): void => {
    const current =
      this.focusedDate ?? this.selection.from ?? new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const step = (base: Date, days: number): Date => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
    // Walks in the requested direction until an enabled day is found, bounded
    // by a step cap (366 days -- more than a year) so an all-disabled range
    // (e.g. min/max entirely in the past with disable-past set) can't loop
    // forever; returns null rather than landing focus on a disabled cell,
    // whose `.focus()` would be a silent no-op anyway.
    const firstEnabledFrom = (base: Date, dayStep: number): Date | null => {
      let d = base;
      for (let i = 0; i < 366; i++) {
        if (!this.isDisabled(d, min, max, today)) return d;
        d = step(d, dayStep);
      }
      return null;
    };
    let next: Date | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = firstEnabledFrom(step(current, -1), -1);
        break;
      case 'ArrowRight':
        next = firstEnabledFrom(step(current, 1), 1);
        break;
      case 'ArrowUp':
        next = firstEnabledFrom(step(current, -7), -1);
        break;
      case 'ArrowDown':
        next = firstEnabledFrom(step(current, 7), 1);
        break;
      case 'PageUp':
        next = firstEnabledFrom(new Date(current.getFullYear(), current.getMonth() - 1, current.getDate()), 1);
        break;
      case 'PageDown':
        next = firstEnabledFrom(new Date(current.getFullYear(), current.getMonth() + 1, current.getDate()), 1);
        break;
      case 'Home':
        next = firstEnabledFrom(new Date(current.getFullYear(), current.getMonth(), 1), 1);
        break;
      case 'End':
        next = firstEnabledFrom(new Date(current.getFullYear(), current.getMonth() + 1, 0), -1);
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
    if (!next) return;
    this.focusedDate = next;
    this.viewDate = this.viewDateForFocus(next);
    this.focusPending = true;
  };

  /**
   * The anchor month for a newly-focused date, sliding the view by the
   * minimum amount needed to bring it into view. With `months` > 1, a date
   * that's already visible in a later grid must not discard an earlier grid
   * that's already on-screen.
   */
  private viewDateForFocus(next: Date): Date {
    const firstMonth = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const nextMonth = new Date(next.getFullYear(), next.getMonth(), 1);
    const lastMonth = addMonths(firstMonth, this.months - 1);
    if (nextMonth < firstMonth) return nextMonth;
    if (nextMonth > lastMonth) return addMonths(nextMonth, -(this.months - 1));
    return firstMonth;
  }

  protected updated(): void {
    if (this.focusPending && this.focusedDate) {
      this.focusPending = false;
      const iso = formatISO(this.focusedDate);
      const cell = this.renderRoot.querySelector(`[data-date="${iso}"]`) as HTMLElement | null;
      cell?.focus();
    }
  }

  private renderDay(
    date: Date,
    shownMonth: number,
    selection: DateRange,
    min: Date | null,
    max: Date | null,
    today: Date,
    rowHasVisibleDay: boolean,
  ): TemplateResult {
    const outside = date.getMonth() !== shownMonth;
    // Outside-month days are empty placeholders by default (matches WA), keeping the
    // 6-row grid aligned without low-contrast faded numbers.
    if (outside && !this.withOutsideDays) {
      // role="gridcell" stays either way. A trailing week can land entirely
      // outside the shown month (monthMatrix always emits 6 rows of 7), and
      // ARIA's row role requires at least one visible gridcell descendant --
      // so only rows that already have a real, visible day cell may hide
      // their placeholders from the accessibility tree.
      return html`<span
        part="day-placeholder"
        role="gridcell"
        aria-hidden=${rowHasVisibleDay ? 'true' : nothing}
      ></span>`;
    }
    const { from, to } = selection;
    const disabled = this.isDisabled(date, min, max, today);
    const isToday = isSameDay(date, today);
    const isStart = from && isSameDay(date, from);
    const isEnd = to && isSameDay(date, to);
    const selected = this.mode === 'single' ? isStart : isStart || isEnd;
    const inRange = this.mode === 'range' && from && to && date > from && date < to;
    // Falls back to "first non-outside day of the currently-shown month"
    // when there's neither a focusedDate nor a selection, so the grid always
    // has exactly one tabbable cell -- otherwise every cell computes `false`
    // and keyboard users tabbing into an empty picker land nowhere.
    const focused =
      this.focusedDate != null
        ? isSameDay(date, this.focusedDate)
        : isStart
          ? true
          : !from && date.getMonth() === shownMonth && date.getDate() === 1;

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

  private renderMonth(
    offset: number,
    selection: DateRange,
    min: Date | null,
    max: Date | null,
    today: Date,
    fdow: number,
    labels: string[],
  ): TemplateResult {
    const base = addMonths(this.viewDate, offset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const matrix = monthMatrix(year, month, fdow);
    const isFirst = offset === 0;
    const isLast = offset === this.months - 1;

    return html`<div part="month">
      <div part="header">
        ${isFirst
          ? html`<button
              part="previous"
              type="button"
              aria-label="Previous month"
              ?disabled=${this.disabled || this.readonly}
              @click=${() => this.nav(-1)}
            >
              ${chevronIcon()}
            </button>`
          : html`<span></span>`}
        <div part="title">${monthTitle(year, month, this.locale)}</div>
        ${isLast
          ? html`<button
              part="next"
              type="button"
              aria-label="Next month"
              ?disabled=${this.disabled || this.readonly}
              @click=${() => this.nav(1)}
            >
              ${chevronIcon()}
            </button>`
          : html`<span></span>`}
      </div>
      <div part="weekdays">${labels.map((l) => html`<span part="weekday">${l}</span>`)}</div>
      <div part="grid" role="grid" @keydown=${this.onGridKey}>
        ${matrix.map((week) => {
          const rowHasVisibleDay = week.some((d) => d.getMonth() === month);
          return html`<div part="week" role="row">${week.map((d) =>
            this.renderDay(d, month, selection, min, max, today, rowHasVisibleDay),
          )}</div>`;
        })}
      </div>
    </div>`;
  }

  render(): TemplateResult {
    const selection = this.selection;
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fdow = this.fdow;
    const labels = weekdayLabels(fdow, this.weekdayFormat, this.locale);
    const monthEls: TemplateResult[] = [];
    for (let i = 0; i < this.months; i++) {
      monthEls.push(this.renderMonth(i, selection, min, max, today, fdow, labels));
    }
    return html`<div part="base">${monthEls}</div>`;
  }
}

defineElement('date-picker', LyraDatePicker);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-date-picker': LyraDatePicker;
  }
}
