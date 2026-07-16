import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './calendar.styles.js';

export interface CalendarEvent { id?: string; date: string; title: string; start?: string; end?: string; color?: string; data?: unknown; }
export interface LyraCalendarEventMap { 'lyra-date-select': CustomEvent<{ date: string }>; 'lyra-event-select': CustomEvent<{ event: CalendarEvent }>; 'lyra-view-change': CustomEvent<{ viewDate: string }>; }
const pad = (value: number): string => String(value).padStart(2, '0');
const iso = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthStart = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

/** `<lyra-calendar>` — responsive month calendar with event markers and agenda mode.
 * @customElement lyra-calendar
 * @event lyra-date-select - A calendar date was selected.
 * @event lyra-event-select - An event was selected.
 * @event lyra-view-change - The visible month changed.
 * @csspart header - Calendar header.
 * @csspart grid - Month grid.
 * @csspart day - Day cell.
 * @csspart event - Event marker.
 * @csspart agenda - Agenda list.
 */
export class LyraCalendar extends LyraElement<LyraCalendarEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ attribute: false }) events: CalendarEvent[] = [];
  @property() value = '';
  @property({ attribute: 'view-date' }) viewDate = iso(new Date()).slice(0, 7) + '-01';
  @property({ reflect: true }) view: 'month' | 'agenda' = 'month';
  @property({ type: Number, attribute: 'first-day-of-week' }) firstDayOfWeek = 1;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private focusedDate = '';
  private get viewStart(): Date { const parsed = new Date(`${this.viewDate}T00:00:00`); return Number.isNaN(parsed.valueOf()) ? monthStart(new Date()) : monthStart(parsed); }
  private changeMonth(delta: number): void { const next = new Date(this.viewStart.getFullYear(), this.viewStart.getMonth() + delta, 1); this.viewDate = iso(next); this.emit('lyra-view-change', { viewDate: this.viewDate }); }
  private selectDate(date: string): void { this.value = date; this.focusedDate = date; this.emit('lyra-date-select', { date }); }
  private eventsFor(date: string): CalendarEvent[] { return this.events.filter((event) => event.date === date); }
  private days(): Date[] { const start = this.viewStart; const offset = (start.getDay() - this.firstDayOfWeek + 7) % 7; const first = new Date(start); first.setDate(1 - offset); return Array.from({ length: 42 }, (_v, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)); }
  private onDayKeyDown(event: KeyboardEvent, date: Date): void { let delta = 0; if (event.key === 'ArrowLeft') delta = this.effectiveDirection === 'rtl' ? 1 : -1; else if (event.key === 'ArrowRight') delta = this.effectiveDirection === 'rtl' ? -1 : 1; else if (event.key === 'ArrowUp') delta = -7; else if (event.key === 'ArrowDown') delta = 7; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.selectDate(iso(date)); return; } else return; event.preventDefault(); const next = new Date(date); next.setDate(next.getDate() + delta); this.focusedDate = iso(next); queueMicrotask(() => this.renderRoot.querySelector<HTMLElement>(`[data-date="${this.focusedDate}"]`)?.focus()); }
  private weekdays(): string[] { const base = new Date(2024, 0, 7 + this.firstDayOfWeek); return Array.from({ length: 7 }, (_v, i) => new Intl.DateTimeFormat(this.effectiveLocale, { weekday: 'short' }).format(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i))); }
  render(): TemplateResult {
    const start = this.viewStart; const days = this.days(); const monthTitle = new Intl.DateTimeFormat(this.effectiveLocale, { month: 'long', year: 'numeric' }).format(start); const today = iso(new Date()); const label = this.accessibleLabel || this.localize('calendarLabel');
    const agenda = this.events.filter((event) => event.date.startsWith(this.viewDate.slice(0, 7))).sort((a, b) => a.date.localeCompare(b.date));
    return html`<section aria-label=${label}><header part="header"><button part="nav" type="button" aria-label=${this.localize('previous')} @click=${() => this.changeMonth(-1)}>‹</button><span part="title">${monthTitle}</span><span part="nav"><button type="button" aria-label=${this.localize('next')} @click=${() => this.changeMonth(1)}>›</button></span></header>
      ${this.view === 'agenda' ? html`<div part="agenda">${agenda.length ? agenda.map((event) => html`<button part="agenda-event" type="button" @click=${() => this.emit('lyra-event-select', { event })}><strong>${event.date}</strong> ${event.title}</button>`) : html`<p>${this.localize('calendarEmpty')}</p>`}</div>` : html`<div part="grid" aria-label=${monthTitle}>${this.weekdays().map((day) => html`<div part="weekday">${day}</div>`)}${days.map((date) => { const dateIso = iso(date); const dayEvents = this.eventsFor(dateIso); return html`<button part="day" type="button" data-date=${dateIso} data-outside=${date.getMonth() !== start.getMonth() ? 'true' : 'false'} data-today=${dateIso === today ? 'true' : 'false'} data-selected=${dateIso === this.value ? 'true' : 'false'} tabindex=${dateIso === (this.focusedDate || this.value || today) ? '0' : '-1'} @click=${() => this.selectDate(dateIso)} @keydown=${(event: KeyboardEvent) => this.onDayKeyDown(event, date)}><span part="date">${date.getDate()}</span>${dayEvents.map((item) => html`<span part="event" style=${item.color ? `background:${item.color}` : ''} @click=${(event: Event) => { event.stopPropagation(); this.emit('lyra-event-select', { event: item }); }}>${item.title}</span>`)}</button>`; })}</div>`}</section>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-calendar': LyraCalendar; } }
