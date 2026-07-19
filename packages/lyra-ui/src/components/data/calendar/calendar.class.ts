import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { formatISO, monthMatrix, parseISO, weekdayLabels } from '../../forms/date-picker/calendar-core.js';
import { sanitizeSwatchColor } from '../../../internal/safe-css.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { styles } from './calendar.styles.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';

export interface CalendarEvent { id?: string; date: string; title: string; start?: string; end?: string; color?: string; data?: unknown; }
export interface LyraCalendarEventMap { 'lr-date-select': CustomEvent<{ date: string }>; 'lr-event-select': CustomEvent<{ event: CalendarEvent }>; 'lr-view-change': CustomEvent<{ viewDate: string }>; }
const monthStart = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

/** `<lr-calendar>` — responsive month calendar with event markers and agenda mode.
 *
 * Month-view event markers are a mouse-only quick-select affordance layered on
 * top of the focusable day cell: the day grid's own roving-tabindex/arrow-key
 * navigation already targets the day `<button>`, and nesting a second
 * focusable control inside that same native `<button>` is not valid (a
 * `<button>` element must not contain interactive/tabindex descendants, and
 * `role="button"` itself forbids focusable descendants regardless). Agenda
 * view renders each event as its own real `<button part="agenda-event">` and
 * is the fully keyboard-accessible way to reach `lr-event-select`.
 *
 * @customElement lr-calendar
 * @event lr-date-select - A calendar date was selected.
 * @event lr-event-select - An event was selected.
 * @event lr-view-change - The visible month changed.
 * @csspart header - Calendar header.
 * @csspart nav - A previous/next navigation control in the header (the previous button, and the wrapper around the next button).
 * @csspart nav-glyph - The previous/next chevron glyph, mirrored under RTL.
 * @csspart title - The header's month/year title.
 * @csspart weekdays - Weekday header row.
 * @csspart weekday - One weekday header cell.
 * @csspart grid - Month grid.
 * @csspart week - One week row within the month grid.
 * @csspart day - Day cell.
 * @csspart date - The day-of-month number inside a day cell.
 * @csspart event - Event marker.
 * @csspart agenda - Agenda list.
 * @csspart agenda-event - One focusable event button in agenda view (`view="agenda"` only).
 * @cssprop [--lr-calendar-day-min-block-size=var(--lr-size-6rem)] - Minimum block size of a day cell.
 * @cssprop [--lr-calendar-day-min-block-size-narrow=4rem] - Minimum block size of a day cell once the host is narrower than 28rem.
 */
export class LyraCalendar extends LyraElement<LyraCalendarEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ attribute: false }) events: CalendarEvent[] = [];
  @property() value = '';
  @property({ attribute: 'view-date' }) viewDate = formatISO(new Date()).slice(0, 7) + '-01';
  @property({ reflect: true }) view: 'month' | 'agenda' = 'month';
  @property({ type: Number, attribute: 'first-day-of-week' }) firstDayOfWeek = 1;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private focusedDate = '';
  private get viewStart(): Date { const parsed = new Date(`${this.viewDate}T00:00:00`); return Number.isNaN(parsed.valueOf()) ? monthStart(new Date()) : monthStart(parsed); }
  /** `firstDayOfWeek` clamped into the 0–6 range `monthMatrix`/`weekdayLabels` expect, tolerating a malformed or out-of-range attribute value instead of letting it silently drop leading days of the month or produce `Invalid Date`. `finiteInteger` sanitizes a NaN/non-finite/fractional raw value to a safe integer (falling back to `1` to match this property's own default) before the modulo wraps any still-out-of-range integer (including negatives) into `[0, 6]`. */
  private get normalizedFirstDayOfWeek(): number { const sanitized = finiteInteger(this.firstDayOfWeek, 1); return ((sanitized % 7) + 7) % 7; }
  private changeMonth(delta: number): void { const next = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth() + delta, 1); this.viewDate = formatISO(next); this.emit('lr-view-change', { viewDate: this.viewDate }); }
  private selectDate(date: string): void { this.value = date; this.focusedDate = date; this.emit('lr-date-select', { date }); }
  /** `events` bucketed by ISO date, built once per render — the month grid reads events for each of its 42 day cells and re-renders on every roving-focus arrow-key move, so a per-cell linear scan of `events` would cost O(cells × events) per keystroke. */
  private bucketEventsByDate(): Map<string, CalendarEvent[]> { const buckets = new Map<string, CalendarEvent[]>(); for (const event of this.events) { const bucket = buckets.get(event.date); if (bucket) bucket.push(event); else buckets.set(event.date, [event]); } return buckets; }
  private weeks(): Date[][] { const start = this.viewStart; return monthMatrix(start.getFullYear(), start.getMonth(), this.normalizedFirstDayOfWeek); }
  /** The first and last date actually rendered by the current 6×7 grid — wider than the
   *  visible month itself (leading/trailing days from adjacent months fill out the fixed
   *  42-cell layout), so both the roving-tabindex anchor and arrow-key navigation must bound
   *  themselves against this, not just the shown month. */
  private gridBounds(weeks: Date[][]): [Date, Date] { return [weeks[0][0], weeks[weeks.length - 1][6]]; }
  /** Arrow-key navigation that lands past the currently rendered 6-week grid (there is no
   *  7th row to step into) used to leave `focusedDate` pointing at a date with no matching
   *  cell anywhere on screen — a keyboard dead end, since neither the roving tab stop nor the
   *  post-move `.focus()` lookup could ever find it. Rolling the view to the target date's own
   *  month, mirroring how `changeMonth()` already updates `viewDate`, guarantees the new grid
   *  always contains it. */
  private onDayKeyDown(event: KeyboardEvent, date: Date): void { let delta = 0; if (event.key === 'ArrowLeft') delta = this.effectiveDirection === 'rtl' ? 1 : -1; else if (event.key === 'ArrowRight') delta = this.effectiveDirection === 'rtl' ? -1 : 1; else if (event.key === 'ArrowUp') delta = -7; else if (event.key === 'ArrowDown') delta = 7; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.selectDate(formatISO(date)); return; } else return; event.preventDefault(); const next = new Date(date); next.setDate(next.getDate() + delta); const [gridFirst, gridLast] = this.gridBounds(this.weeks()); if (next < gridFirst || next > gridLast) { this.viewDate = formatISO(monthStart(next)); this.emit('lr-view-change', { viewDate: this.viewDate }); } this.focusedDate = formatISO(next); queueMicrotask(() => this.renderRoot.querySelector<HTMLElement>(`[data-date="${this.focusedDate}"]`)?.focus()); }
  private weekdays(): string[] { return weekdayLabels(this.normalizedFirstDayOfWeek, 'short', this.effectiveLocale); }
  render(): TemplateResult {
    const start = this.viewStart; const weeks = this.weeks(); const monthTitle = getDateTimeFormat(this.effectiveLocale, { month: 'long', year: 'numeric' }).format(start); const today = formatISO(new Date()); const label = this.accessibleLabel || this.localize('calendarLabel');
    const dayLabelFmt = getDateTimeFormat(this.effectiveLocale, { dateStyle: 'full' });
    const agenda = this.events.filter((event) => event.date.startsWith(this.viewDate.slice(0, 7))).sort((a, b) => a.date.localeCompare(b.date));
    const eventsByDate = this.view === 'month' ? this.bucketEventsByDate() : undefined;
    // The roving tab stop prefers focusedDate/value/today, in that order, but
    // any of those can point outside the currently visible 6-week grid (e.g.
    // after changeMonth() navigates away with no prior selection/focus) --
    // falling back to the first rendered day keeps exactly one cell tabbable
    // instead of leaving the whole grid keyboard-unreachable.
    const [gridFirst, gridLast] = this.gridBounds(weeks);
    const rawAnchor = this.focusedDate || this.value || today;
    const rawAnchorDate = parseISO(rawAnchor);
    const anchor = rawAnchorDate && rawAnchorDate >= gridFirst && rawAnchorDate <= gridLast ? rawAnchor : formatISO(start);
    return html`<section aria-label=${label}><header part="header"><button part="nav" type="button" aria-label=${this.localize('previous')} @click=${() => this.changeMonth(-1)}><span part="nav-glyph" aria-hidden="true">‹</span></button><span part="title">${monthTitle}</span><span part="nav"><button type="button" aria-label=${this.localize('next')} @click=${() => this.changeMonth(1)}><span part="nav-glyph" aria-hidden="true">›</span></button></span></header>
      ${this.view === 'agenda' ? html`<div part="agenda">${agenda.length ? agenda.map((event) => html`<button part="agenda-event" type="button" @click=${() => this.emit('lr-event-select', { event })}><strong>${event.date}</strong> ${event.title}</button>`) : html`<p>${this.localize('calendarEmpty')}</p>`}</div>` : html`<div part="weekdays">${this.weekdays().map((day) => html`<span part="weekday">${day}</span>`)}</div><div part="grid" role="grid" aria-label=${monthTitle}>${weeks.map((week) => html`<div part="week" role="row">${week.map((date) => { const dateIso = formatISO(date); const dayEvents = eventsByDate?.get(dateIso) ?? []; return html`<button part="day" type="button" role="gridcell" data-date=${dateIso} data-outside=${date.getMonth() !== start.getMonth() ? 'true' : 'false'} data-today=${dateIso === today ? 'true' : 'false'} data-selected=${dateIso === this.value ? 'true' : 'false'} aria-selected=${dateIso === this.value ? 'true' : 'false'} aria-label=${dayLabelFmt.format(date)} tabindex=${dateIso === anchor ? '0' : '-1'} @click=${() => this.selectDate(dateIso)} @keydown=${(event: KeyboardEvent) => this.onDayKeyDown(event, date)}><span part="date">${date.getDate()}</span>${dayEvents.map((item) => { const bg = item.color ? sanitizeSwatchColor(item.color) : undefined; return html`<span part="event" style=${styleMap(bg ? { background: bg } : {})} @click=${(event: Event) => { event.stopPropagation(); this.emit('lr-event-select', { event: item }); }}>${item.title}</span>`; })}</button>`; })}</div>`)}</div>`}</section>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-calendar': LyraCalendar; } }
