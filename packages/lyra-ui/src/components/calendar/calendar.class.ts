import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { formatISO, monthMatrix, weekdayLabels } from '../date-picker/calendar-core.js';
import { sanitizeSwatchColor } from '../../internal/safe-css.js';
import { styles } from './calendar.styles.js';

export interface CalendarEvent { id?: string; date: string; title: string; start?: string; end?: string; color?: string; data?: unknown; }
export interface LyraCalendarEventMap { 'lyra-date-select': CustomEvent<{ date: string }>; 'lyra-event-select': CustomEvent<{ event: CalendarEvent }>; 'lyra-view-change': CustomEvent<{ viewDate: string }>; }
const monthStart = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

/** `<lyra-calendar>` — responsive month calendar with event markers and agenda mode.
 *
 * Month-view event markers are a mouse-only quick-select affordance layered on
 * top of the focusable day cell: the day grid's own roving-tabindex/arrow-key
 * navigation already targets the day `<button>`, and nesting a second
 * focusable control inside that same native `<button>` is not valid (a
 * `<button>` element must not contain interactive/tabindex descendants, and
 * `role="button"` itself forbids focusable descendants regardless). Agenda
 * view renders each event as its own real `<button part="agenda-event">` and
 * is the fully keyboard-accessible way to reach `lyra-event-select`.
 *
 * @customElement lyra-calendar
 * @event lyra-date-select - A calendar date was selected.
 * @event lyra-event-select - An event was selected.
 * @event lyra-view-change - The visible month changed.
 * @csspart header - Calendar header.
 * @csspart nav-glyph - The previous/next chevron glyph, mirrored under RTL.
 * @csspart weekdays - Weekday header row.
 * @csspart weekday - One weekday header cell.
 * @csspart grid - Month grid.
 * @csspart week - One week row within the month grid.
 * @csspart day - Day cell.
 * @csspart event - Event marker.
 * @csspart agenda - Agenda list.
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
  /** `firstDayOfWeek` clamped into the 0–6 range `monthMatrix`/`weekdayLabels` expect, tolerating a malformed or out-of-range attribute value instead of letting it silently drop leading days of the month or produce `Invalid Date`. */
  private get normalizedFirstDayOfWeek(): number { const numeric = Number(this.firstDayOfWeek); return Number.isFinite(numeric) ? (((Math.trunc(numeric) % 7) + 7) % 7) : 1; }
  private changeMonth(delta: number): void { const next = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth() + delta, 1); this.viewDate = formatISO(next); this.emit('lyra-view-change', { viewDate: this.viewDate }); }
  private selectDate(date: string): void { this.value = date; this.focusedDate = date; this.emit('lyra-date-select', { date }); }
  private eventsFor(date: string): CalendarEvent[] { return this.events.filter((event) => event.date === date); }
  private weeks(): Date[][] { const start = this.viewStart; return monthMatrix(start.getFullYear(), start.getMonth(), this.normalizedFirstDayOfWeek); }
  private onDayKeyDown(event: KeyboardEvent, date: Date): void { let delta = 0; if (event.key === 'ArrowLeft') delta = this.effectiveDirection === 'rtl' ? 1 : -1; else if (event.key === 'ArrowRight') delta = this.effectiveDirection === 'rtl' ? -1 : 1; else if (event.key === 'ArrowUp') delta = -7; else if (event.key === 'ArrowDown') delta = 7; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.selectDate(formatISO(date)); return; } else return; event.preventDefault(); const next = new Date(date); next.setDate(next.getDate() + delta); this.focusedDate = formatISO(next); queueMicrotask(() => this.renderRoot.querySelector<HTMLElement>(`[data-date="${this.focusedDate}"]`)?.focus()); }
  private weekdays(): string[] { return weekdayLabels(this.normalizedFirstDayOfWeek, 'short', this.effectiveLocale); }
  render(): TemplateResult {
    const start = this.viewStart; const weeks = this.weeks(); const monthTitle = new Intl.DateTimeFormat(this.effectiveLocale, { month: 'long', year: 'numeric' }).format(start); const today = formatISO(new Date()); const label = this.accessibleLabel || this.localize('calendarLabel');
    const dayLabelFmt = new Intl.DateTimeFormat(this.effectiveLocale, { dateStyle: 'full' });
    const agenda = this.events.filter((event) => event.date.startsWith(this.viewDate.slice(0, 7))).sort((a, b) => a.date.localeCompare(b.date));
    return html`<section aria-label=${label}><header part="header"><button part="nav" type="button" aria-label=${this.localize('previous')} @click=${() => this.changeMonth(-1)}><span part="nav-glyph" aria-hidden="true">‹</span></button><span part="title">${monthTitle}</span><span part="nav"><button type="button" aria-label=${this.localize('next')} @click=${() => this.changeMonth(1)}><span part="nav-glyph" aria-hidden="true">›</span></button></span></header>
      ${this.view === 'agenda' ? html`<div part="agenda">${agenda.length ? agenda.map((event) => html`<button part="agenda-event" type="button" @click=${() => this.emit('lyra-event-select', { event })}><strong>${event.date}</strong> ${event.title}</button>`) : html`<p>${this.localize('calendarEmpty')}</p>`}</div>` : html`<div part="weekdays">${this.weekdays().map((day) => html`<span part="weekday">${day}</span>`)}</div><div part="grid" role="grid" aria-label=${monthTitle}>${weeks.map((week) => html`<div part="week" role="row">${week.map((date) => { const dateIso = formatISO(date); const dayEvents = this.eventsFor(dateIso); return html`<button part="day" type="button" role="gridcell" data-date=${dateIso} data-outside=${date.getMonth() !== start.getMonth() ? 'true' : 'false'} data-today=${dateIso === today ? 'true' : 'false'} data-selected=${dateIso === this.value ? 'true' : 'false'} aria-selected=${dateIso === this.value ? 'true' : 'false'} aria-label=${dayLabelFmt.format(date)} tabindex=${dateIso === (this.focusedDate || this.value || today) ? '0' : '-1'} @click=${() => this.selectDate(dateIso)} @keydown=${(event: KeyboardEvent) => this.onDayKeyDown(event, date)}><span part="date">${date.getDate()}</span>${dayEvents.map((item) => { const bg = item.color ? sanitizeSwatchColor(item.color) : undefined; return html`<span part="event" style=${styleMap(bg ? { background: bg } : {})} @click=${(event: Event) => { event.stopPropagation(); this.emit('lyra-event-select', { event: item }); }}>${item.title}</span>`; })}</button>`; })}</div>`)}</div>`}</section>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-calendar': LyraCalendar; } }
