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
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { finiteCount } from '../../../internal/numbers.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
} from '../../../internal/native-event-relay.js';
import type { LyraSize, LyraSizeStep } from '../../../internal/variants.js';
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

/** Alias of the library-wide {@linkcode LyraSizeStep}; kept as a named export so existing imports
 *  and the generated manifest keep resolving while there is exactly one definition of the ladder. */
export type LyraDatePickerSize = LyraSizeStep;

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export type LyraDatePickerPageBy = 'months' | 'single';
export type LyraDatePickerView = 'days' | 'months' | 'years' | 'decades';
export type LyraDatePickerDisabledDates = string | string[] | Date[];
export type LyraDatePickerDayContent = (date: Date) => unknown;

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

function normalizePageBy(value: unknown): LyraDatePickerPageBy {
  return value === 'single' ? 'single' : 'months';
}

function normalizeView(value: unknown): LyraDatePickerView {
  return value === 'months' || value === 'years' || value === 'decades' ? value : 'days';
}

const pageByConverter: ComplexAttributeConverter<LyraDatePickerPageBy> = {
  fromAttribute: normalizePageBy,
  toAttribute: normalizePageBy,
};

const viewConverter: ComplexAttributeConverter<LyraDatePickerView> = {
  fromAttribute: normalizeView,
  toAttribute: normalizeView,
};

export interface LyraDatePickerEventMap {
  input: InputEvent;
  change: Event;
  'lr-focus-day': CustomEvent<{ date: Date }>;
  'lr-view-change': CustomEvent<{ view: LyraDatePickerView; date: Date }>;
}
/**
 * `<lr-date-picker>` — an inline month-grid calendar for picking a single date
 * or a date range. Mirrors the core `<wa-date-picker>` API under `lr-`.
 *
 * Value is ISO 8601: `YYYY-MM-DD` (single) or `YYYY-MM-DD/YYYY-MM-DD` (range).
 *
 * Deliberately does **not** perform implicit form submission on Enter (unlike its `<lr-date-input>`
 * wrapper, which routes through `internal/submit-on-enter.ts`): Enter selects the focused day in
 * the calendar grid — the grid's own commit key, the same carve-out `<lr-textarea>` has for a
 * newline. This element is also not form-associated; the wrapping `<lr-date-input>` is what
 * participates in a `<form>`.
 *
 * @customElement lr-date-picker
 * @event {Event} change - The user committed a value. Bubbling, composed, and non-cancelable.
 * @event {InputEvent} input - The value changed during interaction (range: after the first
 *   click). Bubbling, composed, and non-cancelable.
 * @event lr-focus-day - Keyboard or pointer focus moved to a day; detail is `{ date }`.
 * @event lr-view-change - The user changed the calendar view; detail is `{ view, date }`.
 * @slot header - Replaces the built-in navigation header.
 * @slot previous-icon - Replaces the previous-page icon.
 * @slot next-icon - Replaces the next-page icon.
 * @slot footer - Content below the calendar grids.
 * @slot day-YYYY-MM-DD - Lyra extension for replacing an individual ISO calendar day's content.
 * @csspart date-picker - The date-picker wrapper.
 * @csspart base - The date-picker wrapper.
 * @csspart months - The visible-month collection.
 * @csspart month - A visible month wrapper.
 * @csspart header - The month header.
 * @csspart nav - The navigation controls.
 * @csspart title - The month title.
 * @csspart month-label - The interactive month label.
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
 * @csspart day-range-preview - A day in the pending range preview.
 * @csspart day-disabled - A disabled day.
 * @csspart day-label - The visible day label.
 * @csspart day-weekend - A Saturday or Sunday.
 * @csspart day-placeholder - A non-day grid placeholder.
 * @csspart weeknumbers - The week-number column.
 * @csspart weeknumber - One week number.
 * @csspart footer - The footer region.
 * @csspart view-grid - A month/year/decade selection grid.
 * @csspart view-row - A row in a selection grid.
 * @csspart view-cell - A cell in a selection grid.
 * @csspart view-item - A month/year/decade selection button.
 * @csspart view-item-disabled - A disabled selection item.
 * @csspart view-item-selected - The item containing the selected date.
 * @csspart view-item-today - The item containing today.
 * @cssprop [--lr-date-picker-month-gap=var(--lr-space-l)] - Gap between visible months.
 * @cssprop [--lr-date-picker-header-gap=var(--lr-space-s)] - Month-header child gap.
 * @cssprop [--lr-date-picker-radius=var(--lr-radius)] - Calendar and control corner radius.
 * @cssprop [--lr-date-picker-nav-hover-bg=var(--lr-color-brand-quiet)] - Hover background of the
 *   `[part="previous"]`/`[part="next"]` month-navigation buttons.
 * @cssstate disabled - Matches while date selection and navigation are disabled.
 * @cssstate range - Matches while `mode="range"` is active.
 * @cssstate readonly - Matches while selection is read-only.
 * @status experimental
 * @since 4.0.0
 */
export class LyraDatePicker extends LyraElement<LyraDatePickerEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** ISO value: `YYYY-MM-DD` or `YYYY-MM-DD/YYYY-MM-DD`. */
  @property({ reflect: true }) value = '';
  @property({ converter: modeConverter, reflect: true }) mode: CalendarMode = 'single';
  @property({ reflect: true }) min = '';
  @property({ reflect: true }) max = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ converter: monthsConverter, reflect: true }) months: 1 | 2 = 1;
  /** Visual size — scales `--lr-cell-size` proportionally; not pixel-matched to
   *  `lr-input`'s row-height scale (a calendar cell isn't a text row). The Web Awesome / Shoelace spellings
   *  `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a tag rename with no
   *  attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  @property({ reflect: true }) override locale = '';
  @property({ attribute: 'first-day-of-week', reflect: true }) firstDayOfWeek = 'auto';
  @property({ attribute: 'weekday-format', converter: weekdayFormatConverter, reflect: true }) weekdayFormat: WeekdayFormat = 'short';
  @property({ type: Boolean, attribute: 'disable-past', reflect: true }) disablePast = false;
  @property({ type: Boolean, attribute: 'disable-future', reflect: true }) disableFuture = false;
  @property({ type: Boolean, attribute: 'with-outside-days', reflect: true }) withOutsideDays = false;
  @property({ type: Boolean, attribute: 'with-week-numbers', reflect: true }) withWeekNumbers = false;
  @property({ attribute: 'disabled-dates' }) disabledDates: LyraDatePickerDisabledDates = '';
  @property({ attribute: 'disabled-days-of-week' }) disabledDaysOfWeek = '';
  /** Optional JavaScript predicate that disables matching calendar dates. */
  @property({ attribute: false }) isDateDisabled?: (date: Date) => boolean;
  /** Optional JavaScript renderer for individual calendar-day content. */
  @property({ attribute: false }) dayContent?: LyraDatePickerDayContent;
  @property({ type: Number, attribute: 'min-range', reflect: true }) minRange = 0;
  @property({ type: Number, attribute: 'max-range', reflect: true }) maxRange = 0;
  @property({ attribute: 'page-by', reflect: true, converter: pageByConverter }) pageBy: LyraDatePickerPageBy = 'months';
  @property({ reflect: true }) today = '';
  @property({ attribute: 'focused-date', reflect: true }) focusedDate = '';
  @property({ reflect: true, converter: viewConverter }) view: LyraDatePickerView = 'days';
  /** Accessible label for the previous-month button. Left at the built-in default it
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring this to be set; an explicit override wins verbatim. */
  @property({ attribute: 'previous-label' }) previousLabel = 'Previous month';
  /** Accessible label for the next-month button. Left at the built-in default it
   *  routes through `this.localize()` so a locale/`.strings` override applies without
   *  requiring this to be set; an explicit override wins verbatim. */
  @property({ attribute: 'next-label' }) nextLabel = 'Next month';

  @state() private viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  @state() private rangePreview: Date | null = null;
  private focusPending = false;
  private readonly internals = attachInternalsSafely(this);
  private disabledDatesCacheSource?: LyraDatePickerDisabledDates;
  private disabledDatesCache = new Set<string>();
  private disabledWeekdaysCacheSource?: string;
  private disabledWeekdaysCache = new Set<number>();
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

  private get effectiveView(): LyraDatePickerView {
    return normalizeView(this.view);
  }

  get selection(): DateRange {
    const parts = this.value.split('/');
    return { from: parseISO(parts[0] ?? ''), to: parseISO(parts[1] ?? '') };
  }

  /** Date view of a single-mode value. Writes serialize to local ISO and are silent. */
  get valueAsDate(): Date | null {
    return this.effectiveMode === 'single' ? this.selection.from : null;
  }

  set valueAsDate(next: Date | null) {
    if (next == null || !Number.isFinite(next.getTime())) {
      this.value = '';
      return;
    }
    this.value = formatISO(next);
  }

  /** Date-range view of a range-mode value. Reversed endpoints are normalized. */
  get valueAsRange(): DateRange {
    return this.effectiveMode === 'range' ? this.selection : { from: null, to: null };
  }

  set valueAsRange(next: DateRange) {
    let from = next?.from instanceof Date && Number.isFinite(next.from.getTime()) ? next.from : null;
    let to = next?.to instanceof Date && Number.isFinite(next.to.getTime()) ? next.to : null;
    if (from && to && to < from) [from, to] = [to, from];
    this.value = from ? (to ? `${formatISO(from)}/${formatISO(to)}` : formatISO(from)) : '';
  }

  private get focusedDateValue(): Date | null {
    return parseISO(this.focusedDate);
  }

  private setFocusedDate(date: Date | null): void {
    this.focusedDate = date ? formatISO(date) : '';
  }

  private resolvedToday(): Date {
    const configured = parseISO(this.today);
    const today = configured ?? new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  private syncCustomStates(): void {
    setCustomState(this.internals, 'disabled', this.disabled);
    setCustomState(this.internals, 'range', this.effectiveMode === 'range');
    setCustomState(this.internals, 'readonly', this.readonly);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    if (changed.has('value')) {
      const external = !this.suppressViewSync;
      this.suppressViewSync = false;
      if (external && this.value) {
        const from = this.selection.from;
        if (from) this.viewDate = new Date(from.getFullYear(), from.getMonth(), 1);
      }
    }

    if (changed.has('focusedDate')) {
      const focused = this.focusedDateValue;
      if (focused && !this.isVisibleDate(focused)) {
        this.viewDate = this.viewDateForFocus(focused);
      }
    }

    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = this.resolvedToday();
    this.normalizeFocusedDate(min, max, today);
    this.syncCustomStates();
  }

  private get fdow(): number {
    return resolveFirstDayOfWeek(this.firstDayOfWeek, this.effectiveLocale);
  }

  private get disabledDateKeys(): ReadonlySet<string> {
    if (this.disabledDatesCacheSource === this.disabledDates) return this.disabledDatesCache;
    this.disabledDatesCacheSource = this.disabledDates;
    const values = Array.isArray(this.disabledDates)
      ? this.disabledDates
      : String(this.disabledDates || '').split(/[\s,]+/);
    this.disabledDatesCache = new Set(
      values
        .map((value) => value instanceof Date ? value : parseISO(String(value)))
        .filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()))
        .map((value) => formatISO(value)),
    );
    return this.disabledDatesCache;
  }

  private get disabledWeekdays(): ReadonlySet<number> {
    if (this.disabledWeekdaysCacheSource === this.disabledDaysOfWeek) return this.disabledWeekdaysCache;
    this.disabledWeekdaysCacheSource = this.disabledDaysOfWeek;
    const names: Record<string, number> = {
      sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
      wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
      fri: 5, friday: 5, sat: 6, saturday: 6,
    };
    const parsed = String(this.disabledDaysOfWeek || '')
      .toLowerCase()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((value) => names[value] ?? (/^[0-6]$/.test(value) ? Number(value) : -1))
      .filter((value) => value >= 0);
    this.disabledWeekdaysCache = new Set(parsed);
    return this.disabledWeekdaysCache;
  }

  private rangeLength(from: Date, to: Date): number {
    const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round(Math.abs(toUtc - fromUtc) / 86_400_000) + 1;
  }

  private isDisabled(d: Date, min: Date | null, max: Date | null, today: Date): boolean {
    if (this.disabled || this.readonly) return true;
    if (min && d < min) return true;
    if (max && d > max) return true;
    if (this.disablePast && d < today) return true;
    if (this.disableFuture && d > today) return true;
    if (this.disabledDateKeys.has(formatISO(d))) return true;
    if (this.disabledWeekdays.has(d.getDay())) return true;
    try {
      if (this.isDateDisabled?.(new Date(d.getTime()))) return true;
    } catch {
      // A consumer predicate is advisory. A thrown predicate must not make the calendar unusable.
    }
    if (this.effectiveMode === 'range') {
      const { from, to } = this.selection;
      if (from && !to && !isSameDay(from, d)) {
        const length = this.rangeLength(from, d);
        const minimum = finiteCount(this.minRange, 0);
        const maximum = finiteCount(this.maxRange, 0);
        if (minimum > 0 && length < minimum) return true;
        if (maximum > 0 && length > maximum) return true;
      }
    }
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
    const anchor = this.focusedDateValue ?? this.selection.from;
    if (!anchor) return;

    const disabled = this.isDisabled(anchor, min, max, today);
    if (!disabled && this.isVisibleDate(anchor)) return;

    const next = disabled ? this.nearestEnabledDate(anchor, min, max, today) : this.firstEnabledDate(min, max, today);
    if (!next) {
      this.setFocusedDate(null);
      this.focusPending = false;
      return;
    }

    this.setFocusedDate(next);
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
    dispatchNativeInputEvent(this);
    if (fire) dispatchNativeEvent(this, 'change');
  }

  private selectDate(date: Date): void {
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = this.resolvedToday();
    if (this.isDisabled(date, min, max, today)) return;
    this.setFocusedDate(date);
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
    this.goToDate(this.resolvedToday());
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
    this.setFocusedDate(clamped);
    this.focusPending = true;
  }

  private nav(delta: number): void {
    const page = this.pageBy === 'single' ? 1 : this.visibleMonths;
    this.viewDate = addMonths(this.viewDate, delta * page);
  }

  /** Focus the current roving day (or the first item in a non-day view). */
  override focus(options?: FocusOptions): void {
    const target = this.renderRoot?.querySelector<HTMLElement>(
      '[part~="day"][tabindex="0"], [part~="view-item"]:not(:disabled)',
    );
    target?.focus(options);
  }

  private setView(next: LyraDatePickerView, date = this.viewDate): void {
    if (next === this.view) return;
    this.view = next;
    this.emit('lr-view-change', { view: next, date: new Date(date.getTime()) });
  }

  private advanceView(): void {
    const next: Record<LyraDatePickerView, LyraDatePickerView> = {
      days: 'months', months: 'years', years: 'decades', decades: 'decades',
    };
    this.setView(next[this.effectiveView]);
  }

  private onDayFocus(date: Date): void {
    this.setFocusedDate(date);
    this.emit('lr-focus-day', { date: new Date(date.getTime()) });
  }

  private onGridKey = (e: KeyboardEvent): void => {
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = this.resolvedToday();
    const current =
      this.focusedDateValue ??
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
    // `<lr-tab-group>`/`<lr-split>`/`<lr-tree>` rely on for their own
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
    this.setFocusedDate(next);
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

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    const focusedDate = this.focusedDateValue;
    if (this.focusPending && focusedDate) {
      this.focusPending = false;
      const iso = formatISO(focusedDate);
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
    let inRangePreview = false;
    if (this.effectiveMode === 'range' && from && !to && this.rangePreview) {
      const start = this.rangePreview < from ? this.rangePreview : from;
      const end = this.rangePreview < from ? from : this.rangePreview;
      inRangePreview = date >= start && date <= end && !isSameDay(date, from);
    }
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
    const focusedDate = this.focusedDateValue;
    const focused =
      outsideDuplicate
        ? false
        : focusedDate != null
          ? isSameDay(date, focusedDate)
          : isStart && !disabled
            ? true
            : !from && fallbackFocusDate != null && isSameDay(date, fallbackFocusDate);

    const parts = ['day'];
    if (disabled) parts.push('day-disabled');
    if (date.getDay() === 0 || date.getDay() === 6) parts.push('day-weekend');
    if (outside) parts.push('day-outside');
    if (isToday) parts.push('day-today');
    if (selected) parts.push('day-selected');
    if (isStart && this.effectiveMode === 'range') parts.push('day-range-start');
    if (isEnd) parts.push('day-range-end');
    if (inRange) parts.push('day-range-inner');
    if (inRangePreview) parts.push('day-range-preview');

    let content: unknown = date.getDate();
    try {
      content = this.dayContent?.(new Date(date.getTime())) ?? date.getDate();
    } catch {
      content = date.getDate();
    }
    const iso = formatISO(date);

    return html`<button
      part=${parts.join(' ')}
      role="gridcell"
      data-date=${iso}
      aria-selected=${selected ? 'true' : 'false'}
      aria-label=${dayLabelFmt.format(date)}
      tabindex=${focused ? '0' : '-1'}
      ?disabled=${disabled}
      @click=${() => this.selectDate(date)}
      @focus=${() => this.onDayFocus(date)}
      @pointerenter=${() => { this.rangePreview = date; }}
      @pointerleave=${() => { this.rangePreview = null; }}
    >
      <span part="day-label"><slot name=${`day-${iso}`}>${content}</slot></span>
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

    const weekNumber = (date: Date): number => {
      const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = utc.getUTCDay() || 7;
      utc.setUTCDate(utc.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
      return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
    };

    return html`<div part="month">
      <div part="header">
        <slot name="header">
          <div part="nav">
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
                  <span aria-hidden="true"><slot name="previous-icon">${chevronIcon()}</slot></span>
                </button>`
              : html`<span></span>`}
            <button
              part="title"
              id=${titleId}
              type="button"
              ?disabled=${this.disabled || this.readonly}
              @click=${this.advanceView}
            ><span part="month-label">${monthTitle(year, month, this.effectiveLocale)}</span></button>
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
                  <span aria-hidden="true"><slot name="next-icon">${chevronIcon()}</slot></span>
                </button>`
              : html`<span></span>`}
          </div>
        </slot>
      </div>
      <div part="weekdays">${labels.map((l) => html`<span part="weekday">${l}</span>`)}</div>
      <div class="calendar-body">
        ${this.withWeekNumbers
          ? html`<div part="weeknumbers" aria-hidden="true">
              ${matrix.map((week) => html`<span part="weeknumber">${weekNumber(week[0]!)}</span>`)}
            </div>`
          : nothing}
        <div part="grid" role="grid" aria-labelledby=${titleId} @keydown=${this.onGridKey}>
          ${matrix.map((week) => {
            const rowHasVisibleDay = week.some((d) => d.getMonth() === month);
            return html`<div part="week" role="row">${week.map((d) =>
              this.renderDay(d, month, selection, min, max, today, rowHasVisibleDay, fallbackFocusDate, dayLabelFmt),
            )}</div>`;
          })}
        </div>
      </div>
    </div>`;
  }

  private viewPeriodDisabled(start: Date, end: Date): boolean {
    if (this.disabled || this.readonly) return true;
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    return Boolean((min && end < min) || (max && start > max));
  }

  private renderViewItem(
    start: Date,
    end: Date,
    label: string,
    today: Date,
    selected: Date | null,
  ): TemplateResult {
    const disabled = this.viewPeriodDisabled(start, end);
    const isToday = today >= start && today <= end;
    const isSelected = selected != null && selected >= start && selected <= end;
    const parts = ['view-item'];
    if (disabled) parts.push('view-item-disabled');
    if (isToday) parts.push('view-item-today');
    if (isSelected) parts.push('view-item-selected');
    return html`<div part="view-cell" role="gridcell">
      <button
        part=${parts.join(' ')}
        type="button"
        ?disabled=${disabled}
        aria-selected=${isSelected ? 'true' : 'false'}
        @click=${() => this.pickViewItem(start)}
      >${label}</button>
    </div>`;
  }

  private pickViewItem(date: Date): void {
    if (this.disabled || this.readonly) return;
    this.viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
    if (this.effectiveView === 'months') this.setView('days', date);
    else if (this.effectiveView === 'years') this.setView('months', date);
    else if (this.effectiveView === 'decades') this.setView('years', date);
  }

  private navView(delta: number): void {
    const months = this.effectiveView === 'months' ? 12 : this.effectiveView === 'years' ? 144 : 1440;
    this.viewDate = addMonths(this.viewDate, delta * months);
  }

  private renderView(today: Date): TemplateResult {
    const selected = this.selection.from;
    const year = this.viewDate.getFullYear();
    const yearFormatter = dateTimeFormat(this.effectiveLocale, { year: 'numeric' });
    const monthFormatter = dateTimeFormat(this.effectiveLocale, { month: 'short' });
    let items: Array<{ start: Date; end: Date; label: string }> = [];
    let title = '';

    if (this.effectiveView === 'months') {
      title = yearFormatter.format(new Date(year, 0, 1));
      items = Array.from({ length: 12 }, (_, month) => ({
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0),
        label: monthFormatter.format(new Date(year, month, 1)),
      }));
    } else if (this.effectiveView === 'years') {
      const startYear = Math.floor(year / 12) * 12;
      title = `${yearFormatter.format(new Date(startYear, 0, 1))}–${yearFormatter.format(new Date(startYear + 11, 0, 1))}`;
      items = Array.from({ length: 12 }, (_, offset) => {
        const itemYear = startYear + offset;
        return {
          start: new Date(itemYear, 0, 1),
          end: new Date(itemYear, 11, 31),
          label: yearFormatter.format(new Date(itemYear, 0, 1)),
        };
      });
    } else {
      const startYear = Math.floor(year / 120) * 120;
      title = `${yearFormatter.format(new Date(startYear, 0, 1))}–${yearFormatter.format(new Date(startYear + 119, 0, 1))}`;
      items = Array.from({ length: 12 }, (_, offset) => {
        const decadeStart = startYear + offset * 10;
        return {
          start: new Date(decadeStart, 0, 1),
          end: new Date(decadeStart + 9, 11, 31),
          label: `${yearFormatter.format(new Date(decadeStart, 0, 1))}–${yearFormatter.format(new Date(decadeStart + 9, 0, 1))}`,
        };
      });
    }

    const rows: typeof items[] = [];
    for (let index = 0; index < items.length; index += 4) rows.push(items.slice(index, index + 4));
    return html`
      <div part="header">
        <slot name="header">
          <div part="nav">
            <button
              part="previous"
              type="button"
              aria-label=${this.localize('previousMonth', this.previousLabel === 'Previous month' ? undefined : this.previousLabel)}
              ?disabled=${this.disabled || this.readonly}
              @click=${() => this.navView(-1)}
            ><span aria-hidden="true"><slot name="previous-icon">${chevronIcon()}</slot></span></button>
            <button
              part="title"
              type="button"
              ?disabled=${this.disabled || this.readonly || this.effectiveView === 'decades'}
              @click=${this.advanceView}
            ><span part="month-label">${title}</span></button>
            <button
              part="next"
              type="button"
              aria-label=${this.localize('nextMonth', this.nextLabel === 'Next month' ? undefined : this.nextLabel)}
              ?disabled=${this.disabled || this.readonly}
              @click=${() => this.navView(1)}
            ><span aria-hidden="true"><slot name="next-icon">${chevronIcon()}</slot></span></button>
          </div>
        </slot>
      </div>
      <div part="view-grid" role="grid">
        ${rows.map((row) => html`<div part="view-row" role="row">
          ${row.map((item) => this.renderViewItem(item.start, item.end, item.label, today, selected))}
        </div>`)}
      </div>
    `;
  }

  override render(): TemplateResult {
    const selection = this.selection;
    const min = parseISO(this.min);
    const max = parseISO(this.max);
    const today = this.resolvedToday();
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
      this.focusedDateValue || selection.from ? null : this.firstEnabledDate(min, max, today);
    const monthEls: TemplateResult[] = [];
    if (this.effectiveView === 'days') {
      for (let i = 0; i < this.visibleMonths; i++) {
        monthEls.push(
          this.renderMonth(i, selection, min, max, today, fdow, labels, fallbackFocusDate, dayLabelFmt),
        );
      }
    }
    return html`<div part="base">
      <div part="date-picker">
        ${this.effectiveView === 'days'
          ? html`<div part="months">${monthEls}</div>`
          : this.renderView(today)}
        <div part="footer"><slot name="footer"></slot></div>
      </div>
    </div>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-date-picker': LyraDatePicker;
  }
}
