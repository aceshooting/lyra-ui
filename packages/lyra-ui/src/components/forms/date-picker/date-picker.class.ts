import {
  html,
  nothing,
  type ComplexAttributeConverter,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import { nextId } from '../../../internal/a11y.js';
import { isRtl } from '../../../internal/rtl.js';
import { styles } from './date-picker.styles.js';
import {
  monthMatrix,
  weekdayLabels,
  monthTitle,
  formatISO,
  parseISO,
  isSameDay,
  addMonths,
  addMonthsClampingDay,
  clampDate,
  dateTimeFormat,
  normalizeCalendarMode,
  normalizeCalendarMonths,
  normalizeWeekdayFormat,
  resolveFirstDayOfWeek,
  type CalendarMode,
  type WeekdayFormat,
} from './calendar-core.js';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

const modeConverter: ComplexAttributeConverter<CalendarMode> = {
  fromAttribute: normalizeCalendarMode,
  toAttribute: normalizeCalendarMode,
};

const monthsConverter: ComplexAttributeConverter<1 | 2> = {
  fromAttribute: normalizeCalendarMonths,
  toAttribute: normalizeCalendarMonths,
};

const weekdayFormatConverter: ComplexAttributeConverter<WeekdayFormat> = {
  fromAttribute: normalizeWeekdayFormat,
  toAttribute: normalizeWeekdayFormat,
};

export interface LyraDatePickerEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
}
/**
 * `<lr-date-picker>` — an inline month-grid calendar for picking a single date
 * or a date range. Mirrors the core `<wa-date-picker>` API under `lr-`.
 *
 * Value is ISO 8601: `YYYY-MM-DD` (single) or `YYYY-MM-DD/YYYY-MM-DD` (range).
 *
 * @customElement lr-date-picker
 * @event change - The user committed a value.
 * @event input - The value changed during interaction (range: after the first click).
 * @csspart base - The date-picker wrapper.
 * @csspart month - A visible month wrapper.
 * @csspart header - The month header.
 * @csspart title - The month title.
 * @csspart previous - The previous-month button.
 * @csspart next - The next-month button.
 * @csspart weekdays - The weekday header row.
 * @csspart weekday - A weekday label.
 * @csspart grid - A month date grid.
 * @csspart week - A calendar week row.
 * @csspart day - A calendar day button.
 * @csspart day-today - A day representing today.
 * @csspart day-outside - A day outside the active month.
 * @csspart day-selected - A selected day.
 * @csspart day-range-start - The start of a selected range.
 * @csspart day-range-end - The end of a selected range.
 * @csspart day-range-inner - An interior day in a selected range.
 * @csspart day-placeholder - A non-day grid placeholder.
 */
export class LyraDatePicker extends LyraElement<LyraDatePickerEventMap> {
  static styles = [LyraElement.styles, styles];

  /** ISO value: `YYYY-MM-DD` or `YYYY-MM-DD/YYYY-MM-DD`. */
  @property() value = '';
  @property({ converter: modeConverter }) mode: CalendarMode = 'single';
  @property() min = '';
  @property() max = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ converter: monthsConverter }) months: 1 | 2 = 1;
  @property() locale = '';
  @property({ attribute: 'first-day-of-week' }) firstDayOfWeek = 'auto';
  @property({ attribute: 'weekday-format', converter: weekdayFormatConverter }) weekdayFormat: WeekdayFormat = 'short';
  @property({ type: Boolean, attribute: 'disable-past' }) disablePast = false;
  @property({ type: Boolean, attribute: 'disable-future' }) disableFuture = false;
  @property({ type: Boolean, attribute: 'with-outside-days' }) withOutsideDays = false;
  /** Accessible label for the previous-month button. Left at the built-in default it
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring this to be set; an explicit override wins verbatim. */
  @property({ attribute: 'previous-label' }) previousLabel = 'Previous month';
  /** Accessible label for the next-month button. Left at the built-in default it
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring this to be set; an explicit override wins verbatim. */
  @property({ attribute: 'next-label' }) nextLabel = 'Next month';

  @state() private viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  @state() private focusedDate: Date | null = null;
  private focusPending = false;
  // Stable per-instance ids for each visible month's title, referenced by
  // that month's grid via aria-labelledby -- `months` only ever renders 1 or
  // 2 months, so two ids always suffice regardless of which is in use.
  private readonly titleIds = [nextId('date-picker-title'), nextId('date-picker-title')];
  // Set right before `commit()` assigns `value`, so `willUpdate` can tell its
  // own write apart from an external assignment. Internal commits already
  // know the right date is on-screen (it's the cell the user just clicked, or
  // the view the user navigated to), so they must not force the view back to
  // `selection.from`'s month -- only an externally-set `value` should do that.
  private suppressViewSync = false;

  private get effectiveMode(): CalendarMode {
    return normalizeCalendarMode(this.mode);
  }

  private get visibleMonths(): 1 | 2 {
    return normalizeCalendarMonths(this.months);
  }

  private get effectiveWeekdayFormat(): WeekdayFormat {
    return normalizeWeekdayFormat(this.weekdayFormat);
  }

  get selection(): DateRange {
    const parts = this.value.split('/');
    return { from: parseISO(parts[0] ?? ''), to: parseISO(parts[1] ?? '') };
  }

  /** Read-only Date view of a single-mode value. */
  get valueAsDate(): Date | null {
    return this.effectiveMode === 'single' ? this.selection.from : null;
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

    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.normalizeFocusedDate(min, max, today);
  }

  private get fdow(): number {
    return resolveFirstDayOfWeek(this.firstDayOfWeek, this.effectiveLocale);
  }

  private isDisabled(d: Date, min: Date | null, max: Date | null, today: Date): boolean {
    if (this.disabled || this.readonly) return true;
    if (min && d < min) return true;
    if (max && d > max) return true;
    if (this.disablePast && d < today) return true;
    if (this.disableFuture && d > today) return true;
    return false;
  }

  /**
   * Finds the closest enabled date around an invalid roving-focus anchor.
   * Constraints can move the first valid date outside the current month, so
   * the search deliberately isn't limited to the visible grid.
   */
  private nearestEnabledDate(anchor: Date, min: Date | null, max: Date | null, today: Date): Date | null {
    if (!this.isDisabled(anchor, min, max, today)) return new Date(anchor.getTime());
    for (let distance = 1; distance <= 732; distance++) {
      const before = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - distance);
      if (!this.isDisabled(before, min, max, today)) return before;
      const after = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + distance);
      if (!this.isDisabled(after, min, max, today)) return after;
    }
    return null;
  }

  private isVisibleDate(date: Date): boolean {
    const start = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const end = addMonths(start, this.visibleMonths);
    return date >= start && date < end;
  }

  /**
   * Keeps the grid's single `tabindex="0"` cell usable when a selected or
   * previously focused date becomes disabled through a live constraint
   * update. An all-disabled calendar intentionally has no focusable day.
   */
  private normalizeFocusedDate(min: Date | null, max: Date | null, today: Date): void {
    const anchor = this.focusedDate ?? this.selection.from;
    if (!anchor) return;

    const disabled = this.isDisabled(anchor, min, max, today);
    if (!disabled && this.isVisibleDate(anchor)) return;

    const next = disabled ? this.nearestEnabledDate(anchor, min, max, today) : this.firstEnabledDate(min, max, today);
    if (!next) {
      this.focusedDate = null;
      this.focusPending = false;
      return;
    }

    this.focusedDate = next;
    this.viewDate = this.viewDateForFocus(next);
    // Only take real DOM focus when a live constraint change genuinely
    // invalidated a cell that already had it -- e.g. min/max tightening out
    // from under the focused day. Re-anchoring the roving tabindex because the
    // anchor merely scrolled out of view (nav() moving viewDate) must not
    // steal focus off whatever the user is actually operating (a nav button,
    // or nothing at all); onGridKey and goToDate already arm focusPending
    // explicitly for the keyboard-driven paths that should take focus.
    if (disabled) this.focusPending = true;
  }

  /** The first enabled day at/after the first visible month's start, scanning
   *  forward across all visible months -- used as the sole focusable day when
   *  there's no selection and no prior keyboard focus, so the empty-grid case
   *  never defaults to a possibly-disabled day 1. Returns null if every
   *  visible day is disabled (pathological but possible with a very narrow
   *  min/max window). */
  private firstEnabledDate(min: Date | null, max: Date | null, today: Date): Date | null {
    let d = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
    const lastVisibleMonth = addMonths(d, this.visibleMonths - 1);
    const boundEnd = new Date(lastVisibleMonth.getFullYear(), lastVisibleMonth.getMonth() + 1, 0);
    for (let i = 0; i < 732 && d <= boundEnd; i++) {
      if (!this.isDisabled(d, min, max, today)) return d;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return null;
  }

  private commit(from: Date | null, to: Date | null, fire: boolean): void {
    const next =
      this.effectiveMode === 'range'
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
    if (this.effectiveMode === 'range') {
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
    if (!d || !Number.isFinite(d.getTime())) return;
    // A `Date` argument (goToToday() passes `new Date()`) can carry a
    // non-midnight time-of-day, but isDisabled()/normalizeFocusedDate()
    // always compare against a midnight-normalized `today` -- leaving the
    // time-of-day on `focusedDate` made `disableFuture` misclassify today
    // itself as a future date any time after 00:00:00, bumping the roving
    // focus back to yesterday. parseISO()-parsed strings are already
    // midnight, so this only ever changes a `Date` argument's clock time.
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const clamped = clampDate(midnight, parseISO(this.min), parseISO(this.max));
    this.viewDate = new Date(clamped.getFullYear(), clamped.getMonth(), 1);
    this.focusedDate = clamped;
    this.focusPending = true;
  }

  private nav(delta: number): void {
    this.viewDate = addMonths(this.viewDate, delta);
  }

  private onGridKey = (e: KeyboardEvent): void => {
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current =
      this.focusedDate ??
      this.selection.from ??
      this.firstEnabledDate(min, max, today) ??
      new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), 1);
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
    // The grid's cells are laid out via `grid-template-columns` with no
    // explicit `direction` override, so under `dir="rtl"` the browser mirrors
    // the column order itself (day 1 of the week renders at the inline-start
    // edge, which `direction` puts on the right) -- the same auto-mirroring
    // `<lr-tabs>`/`<lr-split>`/`<lr-tree>` rely on for their own
    // row/track layouts. So ArrowLeft/ArrowRight must swap which physical key
    // advances a day, or keyboard nav would point the opposite way from what
    // the mirrored grid shows. ArrowUp/ArrowDown move by week (the block
    // axis), which `direction` never affects, so those stay as-is.
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: Date | null = null;
    switch (e.key) {
      case backwardKey:
        next = firstEnabledFrom(step(current, -1), -1);
        break;
      case forwardKey:
        next = firstEnabledFrom(step(current, 1), 1);
        break;
      case 'ArrowUp':
        next = firstEnabledFrom(step(current, -7), -1);
        break;
      case 'ArrowDown':
        next = firstEnabledFrom(step(current, 7), 1);
        break;
      case 'PageUp':
        next = firstEnabledFrom(addMonthsClampingDay(current, -1), 1);
        break;
      case 'PageDown':
        next = firstEnabledFrom(addMonthsClampingDay(current, 1), 1);
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
    const lastMonth = addMonths(firstMonth, this.visibleMonths - 1);
    if (nextMonth < firstMonth) return nextMonth;
    if (nextMonth > lastMonth) return addMonths(nextMonth, -(this.visibleMonths - 1));
    return firstMonth;
  }

  protected updated(): void {
    if (this.focusPending && this.focusedDate) {
      this.focusPending = false;
      const iso = formatISO(this.focusedDate);
      // Scoped to the one cell actually marked as the roving tab stop, not
      // just any cell carrying this date -- withOutsideDays + months > 1 can
      // render the same date twice (see renderDay()'s outsideDuplicate), and
      // a bare [data-date] match would grab whichever copy comes first in
      // DOM order (the greyed-out outside one) instead of the real day.
      const cell = this.renderRoot.querySelector(
        `[data-date="${iso}"][tabindex="0"]`,
      ) as HTMLElement | null;
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
    fallbackFocusDate: Date | null,
    dayLabelFmt: Intl.DateTimeFormat,
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
    const selected = this.effectiveMode === 'single' ? isStart : isStart || isEnd;
    const inRange = this.effectiveMode === 'range' && from && to && date > from && date < to;
    // With withOutsideDays + months > 1, a date near the seam between two
    // visible months renders twice: once as a trailing/leading outside day
    // of one month's grid, once as the real day of the adjacent month's own
    // grid (isVisibleDate() is true for it precisely in that case, since
    // its own calendar month is itself one of the visible months). The
    // outside copy must never be focus-eligible then -- only the true
    // rendering counts -- or both copies could satisfy the checks below,
    // producing two tabindex="0" cells for one date.
    const outsideDuplicate = outside && this.isVisibleDate(date);
    // Falls back to the first *enabled* day across the visible month(s) (see
    // firstEnabledDate()) when there's neither a focusedDate nor a selection,
    // so the grid always has exactly one tabbable cell -- otherwise every
    // cell computes `false` and keyboard users tabbing into an empty picker
    // land nowhere. Must not just be "day 1 of the shown month" unconditionally:
    // day 1 can itself be disabled (e.g. disable-past opened on any day other
    // than the 1st), which would land the sole tabindex="0" cell on a button
    // that can never actually receive focus.
    const focused =
      outsideDuplicate
        ? false
        : this.focusedDate != null
          ? isSameDay(date, this.focusedDate)
          : isStart && !disabled
            ? true
            : !from && fallbackFocusDate != null && isSameDay(date, fallbackFocusDate);

    const parts = ['day'];
    if (outside) parts.push('day-outside');
    if (isToday) parts.push('day-today');
    if (selected) parts.push('day-selected');
    if (isStart && this.effectiveMode === 'range') parts.push('day-range-start');
    if (isEnd) parts.push('day-range-end');
    if (inRange) parts.push('day-range-inner');

    return html`<button
      part=${parts.join(' ')}
      role="gridcell"
      data-date=${formatISO(date)}
      aria-selected=${selected ? 'true' : 'false'}
      aria-label=${dayLabelFmt.format(date)}
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
    fallbackFocusDate: Date | null,
    dayLabelFmt: Intl.DateTimeFormat,
  ): TemplateResult {
    const base = addMonths(this.viewDate, offset);
    const year = base.getFullYear();
    const month = base.getMonth();
    const matrix = monthMatrix(year, month, fdow);
    const isFirst = offset === 0;
    const isLast = offset === this.visibleMonths - 1;
    const titleId = this.titleIds[offset];

    return html`<div part="month">
      <div part="header">
        ${isFirst
          ? html`<button
              part="previous"
              type="button"
              aria-label=${this.localize(
                'previousMonth',
                this.previousLabel === 'Previous month' ? undefined : this.previousLabel,
              )}
              ?disabled=${this.disabled || this.readonly}
              @click=${() => this.nav(-1)}
            >
              ${chevronIcon()}
            </button>`
          : html`<span></span>`}
        <div part="title" id=${titleId}>${monthTitle(year, month, this.effectiveLocale)}</div>
        ${isLast
          ? html`<button
              part="next"
              type="button"
              aria-label=${this.localize(
                'nextMonth',
                this.nextLabel === 'Next month' ? undefined : this.nextLabel,
              )}
              ?disabled=${this.disabled || this.readonly}
              @click=${() => this.nav(1)}
            >
              ${chevronIcon()}
            </button>`
          : html`<span></span>`}
      </div>
      <div part="weekdays">${labels.map((l) => html`<span part="weekday">${l}</span>`)}</div>
      <div part="grid" role="grid" aria-labelledby=${titleId} @keydown=${this.onGridKey}>
        ${matrix.map((week) => {
          const rowHasVisibleDay = week.some((d) => d.getMonth() === month);
          return html`<div part="week" role="row">${week.map((d) =>
            this.renderDay(d, month, selection, min, max, today, rowHasVisibleDay, fallbackFocusDate, dayLabelFmt),
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
    const labels = weekdayLabels(fdow, this.effectiveWeekdayFormat, this.effectiveLocale);
    // Hoisted once per render and reused across every day cell, rather than
    // each cell constructing its own Intl.DateTimeFormat via
    // toLocaleDateString() -- mirrors how the weekday-header and month-title
    // labels already share a single formatter instead of one per cell.
    const dayLabelFmt = dateTimeFormat(this.effectiveLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    // Only bother scanning for a fallback focus day when it's actually
    // needed: there's no point walking the visible days if a focusedDate or
    // an existing selection already determines the sole tabbable cell.
    const fallbackFocusDate =
      this.focusedDate || selection.from ? null : this.firstEnabledDate(min, max, today);
    const monthEls: TemplateResult[] = [];
    for (let i = 0; i < this.visibleMonths; i++) {
      monthEls.push(
        this.renderMonth(i, selection, min, max, today, fdow, labels, fallbackFocusDate, dayLabelFmt),
      );
    }
    return html`<div part="base">${monthEls}</div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-date-picker': LyraDatePicker;
  }
}
