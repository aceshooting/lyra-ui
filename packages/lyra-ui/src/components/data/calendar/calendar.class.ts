import { isRepeatedActivationKey, shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { html, isServer, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { occurrenceKeys } from '../../../internal/render-keys.js';
import { property, state } from 'lit/decorators.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  addMonths,
  addMonthsClampingDay,
  clampDate,
  dateTimeFormat,
  formatISO,
  localDate,
  monthMatrix,
  parseISO,
  resolveFirstDayOfWeek,
  weekdayLabels,
} from '../../../internal/calendar-core.js';
import type { LyraDatePickerFirstDayOfWeek } from '../../forms/date-picker/date-picker.class.js';
import { isSafeNonArrayObject } from '../../../internal/object-guards.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { styles } from './calendar.styles.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  getOwnDataDescriptor,
} from '../../../internal/data-descriptors.js';
import { bdi } from '../../../internal/bidi.js';
import { ThemeWatcher } from '../../../internal/theme-watcher.js';
import { EventForegroundResolver } from './calendar-event-colors.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_calendarEmpty, LYRA_DEFAULT_calendarEventsOverflow, LYRA_DEFAULT_calendarInputLimit, LYRA_DEFAULT_calendarLabel, LYRA_DEFAULT_calendarNextMonth, LYRA_DEFAULT_calendarPreviousMonth } from '../../../internal/default-strings/data.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface CalendarEvent {
  readonly id?: string;
  readonly date: string | number | Date;
  readonly title: string;
  /** Event fill (any CSS color). Without `textColor`, a readable foreground is derived from it. */
  readonly color?: string;
  /** Event text color (any CSS color). Defaults to a foreground derived from `color`, else `--lr-calendar-event-color`. */
  readonly textColor?: string;
  readonly data?: unknown;
}

/** Facts about one rendered day cell, passed to {@link LyraCalendarDayContent}. */
export interface LyraCalendarDayContext {
  /** The day as an ISO `YYYY-MM-DD` string. */
  readonly date: string;
  /** The day belongs to an adjacent month shown to fill the 6-week grid. */
  readonly outside: boolean;
  /** The day is today. */
  readonly today: boolean;
  /** The day is the selected `value`. */
  readonly selected: boolean;
  /** The caller's events on this day (original identities, every one, not just the rendered four). */
  readonly events: readonly CalendarEvent[];
}

/** Renders extra content under a month-view day number; return `null`/`undefined` for none. */
export type LyraCalendarDayContent = (date: Date, context: LyraCalendarDayContext) => unknown;
export interface LyraCalendarEventMap {
  'lr-date-select': CustomEvent<{ date: string }>;
  'lr-event-select': CustomEvent<{ event: CalendarEvent }>;
  'lr-month-change': CustomEvent<{ viewDate: string }>;
}
const monthStart = (date: Date): Date => localDate(date.getFullYear(), date.getMonth(), 1);

/** Caps how many event buttons mount inside one day cell of the month grid before the rest
 *  collapse behind a localized "+N more" notice. A day cell has little vertical room (see
 *  `--lr-calendar-day-min-block-size`), so unlike this library's list-shaped 500-row render
 *  ceilings this stays small on purpose. */
const MAX_DAY_CELL_EVENTS = 4;
/** Caps how many event buttons mount in agenda view for the visible month before the rest
 *  collapse behind a localized "+N more" notice. Agenda view has no per-cell space constraint, so
 *  this matches the 500-row ceiling used by every other bounded list in this library (e.g.
 *  `lr-task-list`'s `MAX_RENDERED_TASKS`). */
const MAX_AGENDA_EVENTS = 500;
/** Descendants of caller day content whose own click must not also select the day. */
const INTERACTIVE_CONTENT = 'a[href], button, input, select, textarea, summary, label, [contenteditable]:not([contenteditable="false"])';

interface CanonicalCalendarEvent {
  readonly color?: string;
  readonly textColor?: string;
  readonly date: string;
  readonly source: CalendarEvent;
  readonly title: string;
}

const canonicalEventSnapshots = new WeakMap<
  readonly unknown[],
  readonly CanonicalCalendarEvent[]
>();

function normalizeCalendarEventDate(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const date = parseISO(value);
    return date ? formatISO(date) : undefined;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : formatISO(date);
  }
  if (value === null || typeof value !== 'object') return undefined;
  try {
    const epoch = Date.prototype.getTime.call(value);
    if (!Number.isFinite(epoch)) return undefined;
    return formatISO(new Date(epoch));
  } catch {
    return undefined;
  }
}

/** Copies only fields rendered by the calendar; the original event stays opaque and is emitted by identity. */
/** A `repeat()` identity for a rendered event from its projected fields (the source stays opaque). */
function calendarEventKey(event: CanonicalCalendarEvent): string {
  return `${event.date}\u0000${event.title}`;
}

function projectCalendarEvent(value: unknown): CanonicalCalendarEvent | undefined {
  if (!isSafeNonArrayObject(value)) return undefined;
  const date = getOwnDataDescriptor(value, 'date');
  const title = getOwnDataDescriptor(value, 'title');
  const color = getOwnDataDescriptor(value, 'color');
  const textColor = getOwnDataDescriptor(value, 'textColor');
  if (
    date === MISSING_OWN_DATA_DESCRIPTOR ||
    date === UNSAFE_OWN_DATA_DESCRIPTOR ||
    title === MISSING_OWN_DATA_DESCRIPTOR ||
    title === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof title.value !== 'string' ||
    title.value.trim().length === 0
  )
    return undefined;
  const normalizedDate = normalizeCalendarEventDate(date.value);
  if (!normalizedDate) return undefined;
  return Object.freeze({
    source: value as CalendarEvent & Record<string, unknown>,
    date: normalizedDate,
    title: title.value,
    color:
      color === MISSING_OWN_DATA_DESCRIPTOR ||
      color === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof color.value !== 'string'
        ? undefined
        : color.value,
    textColor:
      textColor === MISSING_OWN_DATA_DESCRIPTOR ||
      textColor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof textColor.value !== 'string'
        ? undefined
        : textColor.value,
  });
}

function canonicalCalendarEvents(
  values: readonly unknown[]
): readonly CanonicalCalendarEvent[] {
  const cached = canonicalEventSnapshots.get(values);
  if (cached) return cached;
  const projected: CanonicalCalendarEvent[] = [];
  for (const value of values) {
    const event = projectCalendarEvent(value);
    if (event) projected.push(event);
  }
  const snapshot = Object.freeze(projected);
  canonicalEventSnapshots.set(values, snapshot);
  return snapshot;
}

/** The two display modes `view` accepts. */
export type CalendarView = 'month' | 'agenda';
const CALENDAR_VIEW = literalSetConverter<CalendarView>(['month', 'agenda'], 'month');

/** The shared closed weekday vocabulary `lr-date-picker`/`lr-date-input` already accept
 *  (`'auto'`, then `'sun'` through `'sat'`) -- reusing {@link LyraDatePickerFirstDayOfWeek}
 *  instead of a parallel string union. */
export type LyraCalendarFirstDayOfWeek = LyraDatePickerFirstDayOfWeek;

/** `<lr-calendar>` — responsive month calendar with event markers and agenda mode.
 *
 * Month-view event markers are real buttons inside each focusable gridcell, so
 * keyboard users can activate individual events without switching views. In the day grid the
 * arrows move by day/week (mirrored under RTL), PageUp/PageDown by month, and Home/End to the
 * first/last day of the month, like `lr-date-picker`.
 * Agenda view renders the same events as full-width buttons. Early ISO dates retain their
 * authored local year in month rendering and navigation. Dates use the Gregorian calendar with
 * localized names and digits. Navigation and selection stay within ISO years 0000–9999. Colored agenda actions keep their
 * foreground/background pairing during hover and press.
 *
 * Event text: an event's `textColor` wins; otherwise an event with a `color` gets a foreground
 * derived from its resolved fill (the theme's on-brand or text color when either reaches 4.5:1,
 * else white or black, whichever contrasts more; a translucent fill is judged over
 * `--lr-color-surface`), re-derived on theme changes or `refreshTheme()`. Events with neither use
 * `--lr-calendar-event-bg`/`--lr-calendar-event-color` in month view.
 *
 * `dayContent` (JS only, default unset) renders caller content in a `[part="day-content"]` block
 * under each month-view day number (agenda view has no day cells). The cell keeps its full-date
 * accessible name and references the content via `aria-describedby`; clicking the content selects
 * the day unless the click lands on an interactive descendant or calls `preventDefault()`. Keep
 * the content non-interactive: arrow keys move between cells, not into them.
 *
 * Events retain at most the first 10,000 entries as detached readonly sequences; records retain
 * caller identity without deep cloning. The limit notice discloses omitted input in either view.
 * Public collection properties take bounded, detached readonly sequences. Calendar-only fields
 * are projected from own data descriptors once per assignment; `lr-event-select` retains the
 * caller's original event identity. Create a new collection and reassign it after changes;
 * mutating the assigned array does not update the view.
 *
 * At most 4 events render as `[part="event"]` buttons inside a single month-view day cell, and at
 * most 500 events render as `[part="agenda-event"]` buttons in agenda view; either ceiling past
 * that count renders a localized `[part="event-limit"]`/`[part="agenda-limit"]` "+N more" notice
 * rather than mounting an unbounded number of buttons.
 *
 * `firstDayOfWeek` defaults to `'auto'`, deriving the week start from `effectiveLocale` (via the
 * shared `resolveFirstDayOfWeek()` contract also used by `lr-date-picker`/`lr-date-input`), and
 * also accepts one of the shared weekday-name tokens (`'sun'` through `'sat'`) for an explicit,
 * locale-independent week start.
 *
 * @customElement lr-calendar
 * @event lr-date-select - A calendar date was selected.
 * @event lr-event-select - An event was selected.
 * @event lr-month-change - The visible month changed. Detail: `{ viewDate: string }`.
 * @csspart limit - Input admission limit notice.
 * @csspart header - Calendar header.
 * @csspart navigation - Wrapper around both month-navigation controls and the title.
 * @csspart nav - Either month-navigation button.
 * @csspart previous-button - Previous-month button.
 * @csspart next-button - Next-month button.
 * @csspart nav-glyph - The previous/next chevron glyph, mirrored under RTL.
 * @csspart title - The header's month/year title.
 * @csspart weekdays - Weekday header row.
 * @csspart weekday - One weekday header cell.
 * @csspart grid - Month grid.
 * @csspart week - One week row within the month grid.
 * @csspart day - Day cell.
 * @csspart date - The day-of-month number inside a day cell.
 * @csspart day-content - Caller content rendered by `dayContent` under the day number.
 * @csspart event - Event marker.
 * @csspart event-limit - Localized "+N more" notice shown in a day cell whose events exceed the
 *   4-event per-cell render ceiling.
 * @csspart agenda - Agenda list.
 * @csspart agenda-event - One focusable event button in agenda view (`view="agenda"` only).
 * @csspart agenda-limit - Localized "+N more" notice shown in agenda view when the visible month's
 *   events exceed the 500-event render ceiling.
 * @csspart empty - The agenda view's localized "no events" message.
 * @cssprop [--lr-calendar-nav-hover-bg=var(--lr-color-brand-quiet)] - Month-navigation hover background.
 * @cssprop [--lr-calendar-nav-active-bg=color-mix(in oklab, var(--lr-calendar-nav-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Month-navigation pressed background.
 * @cssprop [--lr-calendar-day-hover-bg=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))] - Day hover background; the default is a neutral step distinct from the selected fill.
 * @cssprop [--lr-calendar-day-active-bg=color-mix(in oklab, var(--lr-calendar-day-hover-bg, color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Day pressed background.
 * @cssprop [--lr-calendar-event-bg=var(--lr-color-brand)] - Month-view event fill for events without a `color`.
 * @cssprop [--lr-calendar-event-color=var(--lr-color-on-brand)] - Month-view event text color for events without a `color` or `textColor`.
 * @cssprop --lr-calendar-event-hover-tint - Tint over a month-view event while hovered.
 * @cssprop [--lr-calendar-agenda-event-hover-bg=var(--lr-color-brand-quiet)] - Agenda-event hover background override; without one, colored events retain their event fill.
 * @cssprop [--lr-calendar-agenda-event-active-bg=color-mix(in oklab, var(--lr-calendar-agenda-event-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Agenda-event pressed background override; without one, colored events retain their event fill.
 * @cssprop [--lr-calendar-day-min-block-size=var(--lr-size-6rem)] - Minimum block size of a day cell.
 * @cssprop [--lr-calendar-day-min-block-size-narrow=var(--lr-size-4rem)] - Minimum block size of a day cell once the host is narrower than 28rem.
 * @cssprop [--lr-calendar-day-selected-bg=var(--lr-color-brand-quiet)] - Background of a selected day cell, decoupled from the shared token also driving the nav-button/agenda-event hover background.
 * @cssprop [--lr-calendar-day-outside-color=var(--lr-color-text-quiet)] - Text color of an adjacent-month day cell.
 * @cssprop [--lr-calendar-day-outside-bg=var(--lr-color-surface)] - Background of an adjacent-month day cell.
 * @cssprop [--lr-calendar-day-today-outline-color=var(--lr-color-brand)] - Outline color of today's day cell.
 * @status stable
 * @since 4.0.0
 */
export class LyraCalendar extends LyraElement<LyraCalendarEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    calendarEmpty: LYRA_DEFAULT_calendarEmpty,
    calendarEventsOverflow: LYRA_DEFAULT_calendarEventsOverflow,
    calendarInputLimit: LYRA_DEFAULT_calendarInputLimit,
    calendarLabel: LYRA_DEFAULT_calendarLabel,
    calendarNextMonth: LYRA_DEFAULT_calendarNextMonth,
    calendarPreviousMonth: LYRA_DEFAULT_calendarPreviousMonth,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['events']);
  /** Each `CalendarEvent` is caller-owned data (often correlated back to a caller-side record via
   *  `id`/`data`, or matched by reference in an imperative callback) -- only the sequence itself
   *  is bounded/detached/frozen; the emitted `lr-event-select` detail must carry the exact object
   *  the caller passed in `events`, not a structural clone. */
  protected static override readonly identityCollectionProperties = Object.freeze(['events']);

  static override styles = [LyraElement.styles, styles];
  /** Assign a new array to update: mutating an array and assigning it again does not. */
  @property({ attribute: false }) events: readonly CalendarEvent[] = [];
  /** Selected date as an ISO `YYYY-MM-DD` string; empty when no date is selected. Activating a day sets it. */
  /** Selected date as an ISO `YYYY-MM-DD` string; empty when no date is selected. Activating a day sets it. */
  /** Selected date as an ISO `YYYY-MM-DD` string; empty when no date is selected. Activating a day sets it. */
  /** Selected date as an ISO `YYYY-MM-DD` string; empty when no date is selected. Activating a day sets it. */
  @property() value = '';
  /** First day of the visible month as an ISO date string (attribute `view-date`). Defaults to the first day of the current month; month navigation updates it. */
  @property({ attribute: 'view-date' }) viewDate: string = formatISO(new Date()).slice(0, 7) + '-01';
  private _view: CalendarView = 'month';
  /** Presentation of the events: `'month'` (default) renders a day grid, `'agenda'` renders a chronological event list. Unsupported values normalize to `'month'`. */
  @property({ reflect: true, converter: CALENDAR_VIEW })
  get view(): CalendarView { return this._view; }
  set view(value: CalendarView) {
    const normalized = CALENDAR_VIEW.normalizeReflected(this, 'view', value);
    const previous = this._view;
    if (previous === normalized) return;
    this._view = normalized;
    this.requestUpdate('view', previous);
  }
  /** First day of the week: `'auto'` (default) derives it from the effective locale; `'sun'` through `'sat'` pins it explicitly. */
  @property({ attribute: 'first-day-of-week' })
  firstDayOfWeek: LyraCalendarFirstDayOfWeek = 'auto';
  /** Optional JavaScript renderer for extra content under each month-view day number, called with a
   *  copy of the day's `Date` and a {@link LyraCalendarDayContext}. Return `null`/`undefined` for
   *  none; a throwing renderer leaves that day without content. Default: unset (no content). */
  @property({ attribute: false }) dayContent?: LyraCalendarDayContent;
  /** Accessible name of the calendar (attribute `aria-label`). A host `aria-label` wins; when absent, the localized default label is used. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private focusedDate = '';
  private readonly foregrounds = new EventForegroundResolver(this);
  constructor() {
    super();
    new ThemeWatcher(this, () => { if (this.foregrounds.clear()) this.requestUpdate(); });
  }
  override connectedCallback(): void {
    super.connectedCallback();
    if (this.foregrounds.clear()) this.requestUpdate();
  }
  /** Re-derives the readable text colors of colored events from the live theme. Theme attribute
   *  and color-scheme changes are picked up automatically; call this after changing tokens some
   *  other way (for example an inline style). */
  refreshTheme(): void {
    this.foregrounds.clear();
    this.requestUpdate();
  }
  /** The sanitized fill and the explicit or derived text color of one event. */
  private eventPaint(event: CanonicalCalendarEvent): { readonly background?: string; readonly foreground?: string } {
    const background = event.color ? sanitizeCssColor(event.color) : undefined;
    const explicit = event.textColor ? sanitizeCssColor(event.textColor) : undefined;
    const foreground = explicit ?? (background && !isServer ? this.foregrounds.resolve(background) : undefined);
    return { background, foreground };
  }
  private renderDayContent(date: Date, context: LyraCalendarDayContext): unknown {
    if (!this.dayContent) return undefined;
    try {
      const content = this.dayContent(new Date(date.getTime()), Object.freeze(context));
      return content === null || content === undefined || content === nothing || content === false || content === '' ? undefined : content;
    } catch {
      return undefined;
    }
  }
  /** A click selects the day unless it lands on an event button or an interactive descendant of the caller's day content. */
  private onDayClick(event: MouseEvent, dateIso: string): void {
    if (event.target === event.currentTarget) { this.selectDate(dateIso); return; }
    const target = event.target as Element;
    if (target.getAttribute('part') === 'date') { this.selectDate(dateIso); return; }
    if (event.defaultPrevented) return;
    for (const node of event.composedPath()) {
      if (node === event.currentTarget || !(node instanceof Element)) break;
      if (node.getAttribute('part') === 'day-content') { this.selectDate(dateIso); return; }
      if (node.hasAttribute('tabindex') || node.shadowRoot?.delegatesFocus || node.matches(INTERACTIVE_CONTENT)) return;
    }
  }
  private get viewStart(): Date { const parsed = parseISO(this.viewDate); return parsed ? monthStart(parsed) : monthStart(new Date()); }
  /** `firstDayOfWeek` resolved into the 0–6 range `monthMatrix`/`weekdayLabels` expect --
   *  `'auto'`, a weekday-name token, or any other malformed token all go through the shared
   *  `resolveFirstDayOfWeek()` contract, which derives `'auto'` from `effectiveLocale` and falls
   *  back to Sunday (0) for anything else. */
  private get normalizedFirstDayOfWeek(): number {
    return resolveFirstDayOfWeek(this.firstDayOfWeek, this.effectiveLocale);
  }
  private changeMonth(delta: number): void {
    const viewDate = formatISO(addMonths(this.viewStart, delta));
    if (!viewDate) return;
    this.commitMonth(viewDate);
  }
  private commitMonth(viewDate: string): void {
    this.viewDate = viewDate;
    this.emit('lr-month-change', { viewDate });
    this.announcements.announcePolite(dateTimeFormat(this.effectiveLocale, { month: 'long', year: 'numeric' }).format(this.viewStart));
  }
  private selectDate(date: string): void { if (!date) return; this.value = date; this.focusedDate = date; this.emit('lr-date-select', { date }); }
  /** Invalid rows are omitted; all later rendering uses the descriptor-safe projection. */
  private get effectiveEvents(): readonly CanonicalCalendarEvent[] {
    return canonicalCalendarEvents(this.events);
  }
  /** `events` bucketed by ISO date, built once per render — the month grid reads events for each of its 42 day cells and re-renders on every roving-focus arrow-key move, so a per-cell linear scan of `events` would cost O(cells × events) per keystroke. */
  private buckets?: [readonly CanonicalCalendarEvent[], Map<string, CanonicalCalendarEvent[]>];
  private cachedBuckets(events: readonly CanonicalCalendarEvent[]): Map<string, CanonicalCalendarEvent[]> { if (this.buckets?.[0] !== events) this.buckets = [events, this.bucketEventsByDate(events)]; return this.buckets[1]; }
  private bucketEventsByDate(events: readonly CanonicalCalendarEvent[]): Map<string, CanonicalCalendarEvent[]> { const buckets = new Map<string, CanonicalCalendarEvent[]>(); for (const event of events) { const bucket = buckets.get(event.date); if (bucket) bucket.push(event); else buckets.set(event.date, [event]); } return buckets; }
  private agendaMemo?: { events: readonly CanonicalCalendarEvent[]; month: string; rows: readonly CanonicalCalendarEvent[] };
  private agendaEvents(events: readonly CanonicalCalendarEvent[], month: string): readonly CanonicalCalendarEvent[] {
    if (this.agendaMemo?.events !== events || this.agendaMemo.month !== month) {
      this.agendaMemo = { events, month, rows: events.filter(event => event.date.startsWith(month)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0) };
    }
    return this.agendaMemo.rows;
  }
  private weeks(): Date[][] { const start = this.viewStart; return monthMatrix(start.getFullYear(), start.getMonth(), this.normalizedFirstDayOfWeek); }
  /** Roving focus can reach adjacent-month days within the fixed 6×7 grid. */
  private gridBounds(weeks: Date[][]): [Date, Date] { return [weeks[0]![0]!, weeks[weeks.length - 1]![6]!]; }
  private onDayKeyDown(event: KeyboardEvent, date: Date): void {
    if (shouldIgnoreNavigationKey(event)) return;
    const rtl = this.effectiveDirection === 'rtl';
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    let next: Date;
    switch (event.key) {
      case 'ArrowLeft': next = localDate(year, month, day + (rtl ? 1 : -1)); break;
      case 'ArrowRight': next = localDate(year, month, day + (rtl ? -1 : 1)); break;
      case 'ArrowUp': next = localDate(year, month, day - 7); break;
      case 'ArrowDown': next = localDate(year, month, day + 7); break;
      case 'PageUp': next = addMonthsClampingDay(date, -1); break;
      case 'PageDown': next = addMonthsClampingDay(date, 1); break;
      case 'Home': next = localDate(year, month, 1); break;
      case 'End': next = localDate(year, month + 1, 0); break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isRepeatedActivationKey(event)) this.selectDate(formatISO(date));
        return;
      default: return;
    }
    event.preventDefault();
    next = clampDate(next, localDate(0), localDate(9999, 11, 31));
    const [gridFirst, gridLast] = this.gridBounds(this.weeks());
    if (next < gridFirst || next > gridLast) {
      this.commitMonth(formatISO(monthStart(next)));
    }
    this.focusedDate = formatISO(next);
    queueMicrotask(() => this.renderRoot.querySelector<HTMLElement>(`[data-date="${this.focusedDate}"]`)?.focus());
  }
  private weekdays(): string[] { return weekdayLabels(this.normalizedFirstDayOfWeek, 'short', this.effectiveLocale); }
  private readonly announcements = new AnnouncementSinkController(this);
  private initialLimitUpdate = true;
  private lastLimitNotice = '';
  private inputLimitMessage(): string {
    const limit = publicCollectionTruncation(this, 'events');
    return limit ? this.localize('calendarInputLimit', undefined, { count: getNumberFormat(this.effectiveLocale).format(limit.retained), total: getNumberFormat(this.effectiveLocale).format(limit.source) }) : '';
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const notice = this.inputLimitMessage();
    if (!this.initialLimitUpdate && notice && notice !== this.lastLimitNotice) this.announcements.announcePolite(notice);
    this.initialLimitUpdate = false;
    this.lastLimitNotice = notice;
  }
  override adoptedCallback(): void { super.adoptedCallback(); this.announcements.adopted(); }

  override render(): TemplateResult {
    const start = this.viewStart; const weeks = this.weeks(); const monthTitle = dateTimeFormat(this.effectiveLocale, { month: 'long', year: 'numeric' }).format(start); const today = formatISO(new Date()); const label = hostAriaLabel(this) ?? this.localize('calendarLabel');
    const dayLabelFmt = dateTimeFormat(this.effectiveLocale, { dateStyle: 'full' });
    const agendaDateFmt = dateTimeFormat(this.effectiveLocale, { dateStyle: 'medium' });
    const dayNumberFmt = getNumberFormat(this.effectiveLocale);
    const events = this.effectiveEvents;
    const canGoBack = Boolean(formatISO(addMonths(start, -1)));
    const canGoForward = Boolean(formatISO(addMonths(start, 1)));
    const monthPrefix = formatISO(start).slice(0, 7);
    const agenda = this.view === 'agenda'
      ? this.agendaEvents(events, monthPrefix)
      : [];
    const agendaTruncated = agenda.length > MAX_AGENDA_EVENTS;
    const renderedAgenda = agenda.slice(0, MAX_AGENDA_EVENTS);
    const agendaKeys = occurrenceKeys(renderedAgenda, calendarEventKey);
    const eventsByDate = this.view === 'month' ? this.cachedBuckets(events) : undefined;
    // The roving tab stop prefers focusedDate/value/today, in that order, but
    // any of those can point outside the currently visible 6-week grid (e.g.
    // after changeMonth() navigates away with no prior selection/focus) --
    // falling back to the first rendered day keeps exactly one cell tabbable
    // instead of leaving the whole grid keyboard-unreachable.
    const [gridFirst, gridLast] = this.gridBounds(weeks);
    const rawAnchor = this.focusedDate || this.value || today;
    const rawAnchorDate = parseISO(rawAnchor);
    const anchor = rawAnchorDate && rawAnchorDate >= gridFirst && rawAnchorDate <= gridLast ? formatISO(rawAnchorDate) : formatISO(start);
    const inputLimit = this.inputLimitMessage();
    return html`<section aria-label=${label}>${inputLimit ? html`<p part="limit">${inputLimit}</p>` : nothing}<header part="header navigation"><button part="nav previous-button" type="button" ?disabled=${!canGoBack} aria-label=${this.localize('calendarPreviousMonth')} @click=${() => this.changeMonth(-1)}><span part="nav-glyph" aria-hidden="true">‹</span></button><span part="title">${monthTitle}</span><button part="nav next-button" type="button" ?disabled=${!canGoForward} aria-label=${this.localize('calendarNextMonth')} @click=${() => this.changeMonth(1)}><span part="nav-glyph" aria-hidden="true">›</span></button></header>
      ${this.view === 'agenda' ? html`<div part="agenda">${agenda.length ? html`${repeat(renderedAgenda, (_event, index) => agendaKeys[index], (event) => { const date = parseISO(event.date); const { background: bg, foreground: fg } = this.eventPaint(event); return html`<button part="agenda-event" type="button" style=${styleMap(bg ? { '--_lr-calendar-agenda-event-background': bg, '--_lr-calendar-agenda-event-foreground': fg ?? 'var(--lr-color-on-brand)' } : fg ? { '--_lr-calendar-agenda-event-foreground': fg } : {})} @click=${() => this.emit('lr-event-select', { event: event.source })}><strong>${date ? agendaDateFmt.format(date) : event.date}</strong> ${bdi(event.title)}</button>`; })}${agendaTruncated ? html`<span part="agenda-limit">${this.localize('calendarEventsOverflow', undefined, { n: getNumberFormat(this.effectiveLocale).format(agenda.length - MAX_AGENDA_EVENTS) })}</span>` : nothing}` : html`<p part="empty">${this.localize('calendarEmpty')}</p>`}</div>` : html`<div part="weekdays">${this.weekdays().map((day) => html`<span part="weekday">${day}</span>`)}</div><div part="grid" role="grid" aria-label=${monthTitle}>${weeks.map((week) => html`<div part="week" role="row">${week.map((date) => { const dateIso = formatISO(date);
        if (!dateIso) return html`<div part="day" role="gridcell" aria-disabled="true" aria-selected="false"></div>`;
        const dayEvents = eventsByDate?.get(dateIso) ?? []; const dayTruncated = dayEvents.length > MAX_DAY_CELL_EVENTS; const shownEvents = dayEvents.slice(0, MAX_DAY_CELL_EVENTS); const shownKeys = occurrenceKeys(shownEvents, calendarEventKey); const outside = date.getMonth() !== start.getMonth(); const dayContent = this.renderDayContent(date, { date: dateIso, outside, today: dateIso === today, selected: dateIso === this.value, events: dayEvents.map((entry) => entry.source) }); const dayContentId = `day-content-${dateIso}`; return html`<div part="day" role="gridcell" data-date=${dateIso} data-outside=${outside ? 'true' : 'false'} data-today=${dateIso === today ? 'true' : 'false'} data-selected=${dateIso === this.value ? 'true' : 'false'} aria-selected=${dateIso === this.value ? 'true' : 'false'} aria-current=${dateIso === today ? 'date' : nothing} aria-label=${dayLabelFmt.format(date)} aria-describedby=${dayContent === undefined ? nothing : dayContentId} tabindex=${dateIso === anchor ? '0' : '-1'} @click=${(event: MouseEvent) => this.onDayClick(event, dateIso)} @keydown=${(event: KeyboardEvent) => { if (event.target === event.currentTarget) this.onDayKeyDown(event, date); }}><span part="date">${dayNumberFmt.format(date.getDate())}</span>${dayContent === undefined ? nothing : html`<div part="day-content" id=${dayContentId}>${dayContent}</div>`}${repeat(shownEvents, (_item, index) => shownKeys[index], (item) => { const { background: bg, foreground: fg } = this.eventPaint(item); return html`<button part="event" type="button" style=${styleMap({ ...(bg ? { backgroundColor: bg } : {}), ...(fg ? { color: fg } : {}) })} @click=${(event: Event) => { event.stopPropagation(); this.emit('lr-event-select', { event: item.source }); }}>${bdi(item.title)}</button>`; })}${dayTruncated ? html`<span part="event-limit">${this.localize('calendarEventsOverflow', undefined, { n: getNumberFormat(this.effectiveLocale).format(dayEvents.length - MAX_DAY_CELL_EVENTS) })}</span>` : nothing}</div>`; })}</div>`)}</div>`}</section>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-calendar': LyraCalendar; } }
